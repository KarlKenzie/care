#!/usr/bin/env python3
"""
CARE server — serves the website AND the API, and stores everything in a real database (PostgreSQL).

Run:   python server.py            (then open http://localhost:8000/)
One package is needed: the PostgreSQL driver.  pip install -r requirements.txt   (Python 3.9+, PostgreSQL 12+)

What lives here (and NOT in the browser any more):
  * accounts, student records, rescue reports, password requests, access logs  -> PostgreSQL
  * password hashing (PBKDF2-HMAC-SHA256, per-user salt)                          -> never leaves the server
  * sign-in sessions (random token in an HttpOnly cookie, stored hashed)           -> works in Incognito/any device
  * e-mailing credentials (SMTP or EmailJS REST)                                   -> keys never reach the browser
"""
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import smtplib
import socket
import ssl
import sys
import threading
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

try:
    import psycopg                          # ang driver sa PostgreSQL (psycopg 3)
    from psycopg import errors as pg_errors
except ImportError:                         # wala pa na-install
    sys.exit("Missing package: psycopg.  Run:  pip install -r requirements.txt")

ROOT = os.path.dirname(os.path.abspath(__file__))

# --------------------------------------------------------------------------- config
DEFAULTS = {
    "host": "0.0.0.0",            # 0.0.0.0 = reachable from other devices on the network
    "port": 8000,
    # address sa PostgreSQL:  postgresql://USER:PASSWORD@HOST:PORT/DATABASE   (usba sa server-config.json)
    "database_url": "postgresql://postgres@localhost:5432/care",
    "timezone_hours": 8,          # Philippines (UTC+8). Used for the date/time shown in logs & records
    "cookie_secure": "auto",      # "auto" = Secure cookie when the request came over HTTPS
    "trust_proxy": False,         # true when behind Render/Railway/Nginx (reads X-Forwarded-* headers)
    "admin_password": "",         # optional: first-run admin password (otherwise the one in seed/accounts.json)
    "pbkdf2_iterations": 600000,
    "email": {
        "emailjs": {"service_id": "", "template_id": "", "public_key": "", "private_key": ""},
        "smtp": {"host": "", "port": 587, "user": "", "password": "", "from": "", "ssl": False},
    },
}


def load_config():
    cfg = json.loads(json.dumps(DEFAULTS))
    path = os.environ.get("CARE_CONFIG", os.path.join(ROOT, "server-config.json"))
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            user = json.load(f)
        for k, v in user.items():
            if k.startswith("_"):
                continue
            if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                for k2, v2 in v.items():
                    if isinstance(v2, dict) and isinstance(cfg[k].get(k2), dict):
                        cfg[k][k2].update(v2)
                    else:
                        cfg[k][k2] = v2
            else:
                cfg[k] = v
    env = os.environ
    if env.get("PORT"): cfg["port"] = int(env["PORT"])
    if env.get("CARE_HOST"): cfg["host"] = env["CARE_HOST"]
    if env.get("DATABASE_URL"): cfg["database_url"] = env["DATABASE_URL"]            # gigamit sa Render / Railway / Neon / Supabase
    if env.get("CARE_DATABASE_URL"): cfg["database_url"] = env["CARE_DATABASE_URL"]  # mas lig-on kaysa DATABASE_URL
    if env.get("CARE_ADMIN_PASSWORD"): cfg["admin_password"] = env["CARE_ADMIN_PASSWORD"]
    if env.get("CARE_TRUST_PROXY"): cfg["trust_proxy"] = env["CARE_TRUST_PROXY"] == "1"
    if env.get("CARE_PBKDF2_ITER"): cfg["pbkdf2_iterations"] = int(env["CARE_PBKDF2_ITER"])
    return cfg


CFG = load_config()
TZ = timezone(timedelta(hours=float(CFG["timezone_hours"])))

DEPTS = ["Campus Safety Office", "University Clinic", "MIS Office"]
ROLES = ["SQRT", "CLINIC", "ADMIN"]
PROGRAMS = ["BAPOS", "BSIT", "BSBA", "BSHM", "BEED", "BSED-ENG", "BSED-FIL", "BSED-MATH"]
BLOCKS = ["1A", "1B", "2A", "2B", "3A", "3B", "3C", "4A", "4B"]
YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"]
ID_PREFIX = {"SQRT": "SQRT", "CLINIC": "CLN", "ADMIN": "ADM"}
LOGGABLE_FROM_CLIENT = {"Searched students", "Viewed record"}

SESSION_IDLE_S = 2 * 3600
SESSION_MAX_S = 12 * 3600


# --------------------------------------------------------------------------- small helpers
def now_ms():
    return int(time.time() * 1000)


def stamp():
    d = datetime.now(TZ)
    M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    h = d.hour
    ap = "AM" if h < 12 else "PM"
    h = h % 12 or 12
    return "%d %s %d, %d:%02d %s" % (d.day, M[d.month - 1], d.year, h, d.minute, ap)


class ApiError(Exception):
    def __init__(self, status, message, **extra):
        super().__init__(message)
        self.status, self.message, self.extra = status, message, extra


def clean(v, maxlen=200):
    """Trim a text value from the client and cap its length."""
    if v is None:
        return ""
    if not isinstance(v, str):
        v = str(v)
    return v.replace("\x00", "").strip()[:maxlen]      # PostgreSQL dili modawat sa NUL character


# --------------------------------------------------------------------------- validation
def name_problem(v, label):
    v = re.sub(r"\s{2,}", " ", v.strip())
    if not v:
        return "%s is required." % label
    if len(v) > 60:
        return "%s is too long." % label
    for c in v:
        if c in " '.-":
            continue
        if unicodedata.category(c)[0] not in ("L", "M"):
            return "%s: letters only. Numbers and symbols are not allowed." % label
    return None


def username_problem(v):
    if not re.fullmatch(r"[A-Za-z0-9._-]{3,40}", v or ""):
        return "Username must be 3–40 characters: letters, numbers, dot, dash or underscore."
    return None


def gmail_problem(v):
    v = (v or "").strip().lower()
    local = v.split("@")[0]
    if not re.fullmatch(r"[a-z0-9.]+@gmail\.com", v):
        return "Enter a valid Gmail address (example: name@gmail.com)."
    if len(local) < 6 or len(local) > 30 or local[0] == "." or local[-1] == "." or ".." in local:
        return "That Gmail address is not valid."
    return None


def email_key(v):
    """Gmail ignores dots in the name part, so j.doe@gmail.com and jdoe@gmail.com are the SAME mailbox."""
    v = (v or "").strip().lower()
    local, _, domain = v.partition("@")
    if domain in ("gmail.com", "googlemail.com"):
        local = local.replace(".", "")
        domain = "gmail.com"
    return local + "@" + domain


def password_problem(v):
    out = []
    if not isinstance(v, str) or len(v) < 6: out.append("at least 6 characters")
    if not isinstance(v, str) or not any(unicodedata.category(c)[0] == "L" for c in v): out.append("a letter")
    if not isinstance(v, str) or not re.search(r"[0-9]", v): out.append("a number")
    if isinstance(v, str) and len(v) > 200: return "That password is too long."
    return ("Your password still needs " + " and ".join(out) + ".") if out else None


def phone_problem(v):
    """Emergency contact: digits only. Philippine mobile number = 11 digits starting with 09."""
    v = (v or "").strip()
    if not v:
        return "Enter the emergency contact number."
    if not re.fullmatch(r"[0-9]+", v):
        return "Emergency contact must contain numbers only (no letters, spaces, dashes or +)."
    if len(v) != 11 or not v.startswith("09"):
        return "Enter a valid 11-digit mobile number that starts with 09 (example: 09171234567)."
    if len(set(v[2:])) == 1:
        return "That contact number does not look real. Please check it."
    return None


# --------------------------------------------------------------------------- passwords
def hash_password(pw):
    iters = int(CFG["pbkdf2_iterations"])
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, iters)
    return "pbkdf2_sha256$%d$%s$%s" % (iters, salt.hex(), dk.hex())


def verify_password(pw, stored):
    try:
        parts = stored.split("$")
        if parts[0] == "pbkdf2_sha256":
            iters, salt, want = int(parts[1]), bytes.fromhex(parts[2]), parts[3]
            got = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, iters).hex()
            return hmac.compare_digest(got, want)
        if parts[0] == "legacy_sha256":          # the old front-end-only hash (salt:password)
            got = hashlib.sha256((parts[1] + ":" + pw).encode("utf-8")).hexdigest()
            return hmac.compare_digest(got, parts[2])
    except Exception:
        pass
    return False


def needs_rehash(stored):
    p = stored.split("$")
    return p[0] != "pbkdf2_sha256" or int(p[1]) < int(CFG["pbkdf2_iterations"])


DUMMY_HASH = None


# --------------------------------------------------------------------------- database (PostgreSQL)
SCHEMA_LOCK_ID = 727001     # advisory lock: usa ra ka proseso ang maghimo sa mga table kung sabay-sabay mag-start
WRITE_LOCK_ID = 727002      # advisory lock: usa ra ka write transaction matag higayon (sama sa BEGIN IMMEDIATE kaniadto)

SCHEMA = """
-- citext = text nga dili mag-atiman sa capital/small letters (gamit sa Student ID)
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS accounts (
  n            INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  first        TEXT NOT NULL,
  last         TEXT NOT NULL,
  name         TEXT NOT NULL,
  username     TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  role         TEXT NOT NULL CHECK (role IN ('SQRT','CLINIC','ADMIN')),
  idno         TEXT UNIQUE,
  dept         TEXT NOT NULL,
  email        TEXT NOT NULL,
  email_key    TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL CHECK (status IN ('Active','Inactive')),
  last_in      TEXT NOT NULL DEFAULT 'Never',
  made         TEXT NOT NULL,
  pw_hash      TEXT NOT NULL,
  pending      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_n  INTEGER NOT NULL REFERENCES accounts(n) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('admin','portal')),
  created    BIGINT NOT NULL,
  last_seen  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id         CITEXT PRIMARY KEY,
  first      TEXT NOT NULL,
  last       TEXT NOT NULL,
  prog       TEXT NOT NULL,
  block      TEXT NOT NULL,
  year       TEXT NOT NULL,
  allergies  TEXT NOT NULL,
  conditions TEXT NOT NULL,
  treatments TEXT NOT NULL,
  contact    TEXT NOT NULL,
  updated    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  n           INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  sid         CITEXT NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  when_txt    TEXT NOT NULL,
  place       TEXT NOT NULL,
  reason      TEXT NOT NULL,
  symptoms    TEXT NOT NULL,
  actions     TEXT NOT NULL,
  response    TEXT NOT NULL,
  referred    TEXT NOT NULL,
  notes       TEXT NOT NULL,
  t           BIGINT NOT NULL,
  by_txt      TEXT NOT NULL,
  by_n        INTEGER,
  status      TEXT NOT NULL,
  assessment  TEXT,
  assessed_by TEXT,
  assessed_at TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  n         INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_n INTEGER NOT NULL REFERENCES accounts(n) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  idno      TEXT NOT NULL,
  role      TEXT NOT NULL,
  email     TEXT NOT NULL,
  "at"      TEXT NOT NULL,        -- naka-quote kay ang AT keyword sa SQL
  t         BIGINT NOT NULL,
  status    TEXT NOT NULL,
  handled   TEXT
);

-- Access logs: append-only. Walay foreign key, busa ang pag-delete sa account dili mo-apekto sa logs.
CREATE TABLE IF NOT EXISTS logs (
  n        INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  when_txt TEXT NOT NULL,
  t        BIGINT NOT NULL,
  who      TEXT NOT NULL,
  role     TEXT NOT NULL,
  act      TEXT NOT NULL,
  rec      TEXT NOT NULL,
  ok       INTEGER NOT NULL
);

-- Ang database mismo mobalibad sa UPDATE / DELETE / TRUNCATE sa logs
CREATE OR REPLACE FUNCTION logs_block_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Access logs are permanent and cannot be edited.';
  END IF;
  RAISE EXCEPTION 'Access logs are permanent and cannot be deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS logs_no_change ON logs;
CREATE TRIGGER logs_no_change BEFORE UPDATE OR DELETE OR TRUNCATE ON logs
  FOR EACH STATEMENT EXECUTE FUNCTION logs_block_change();

CREATE TABLE IF NOT EXISTS idempotency (
  scope     TEXT NOT NULL,
  key       TEXT NOT NULL,
  endpoint  TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  status    INTEGER NOT NULL,
  response  TEXT NOT NULL,
  created   BIGINT NOT NULL,
  PRIMARY KEY (scope, key, endpoint)
);

CREATE TABLE IF NOT EXISTS throttle (
  k TEXT NOT NULL,
  t BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS throttle_k ON throttle(k, t);
CREATE INDEX IF NOT EXISTS logs_t ON logs(n DESC);
CREATE INDEX IF NOT EXISTS reports_sid ON reports(sid);
"""


class Row(dict):
    """Usa ka laray (row) gikan sa database.
    Pwede i-access gamit ang ngalan row["n"]  o gamit ang numero row[0]  (parehas sa sqlite3.Row kaniadto)."""

    def __init__(self, names, values):
        super().__init__(zip(names, values))
        self._values = tuple(values)

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)


def row_factory(cursor):
    # kuhaon ang mga ngalan sa column kausa ra matag query, dayon himoong Row ang matag laray
    names = [col.name for col in (cursor.description or [])]
    return lambda values: Row(names, values)


class CareConnection(psycopg.Connection):
    """Parehas sa naandan nga psycopg connection, apan ang `?` sa SQL himoong `%s`
    (kana ang placeholder sa PostgreSQL), aron dili na usbon ang matag query sa code.
    Ayaw butangi og `?` o `%` sulod sa SQL text; ang values ibutang sa params."""

    def execute(self, query, params=None, **kwargs):
        if params is not None and isinstance(query, str):
            query = query.replace("?", "%s")
        return super().execute(query, params, **kwargs)


def connect():
    # autocommit: ang matag query mao ang iyang kaugalingong transaction, gawas kung mogamit og `with tx(conn)`
    return CareConnection.connect(CFG["database_url"], autocommit=True, row_factory=row_factory, connect_timeout=10)


def safe_url(url):
    """Ang address sa database nga walay password (luwas i-print)."""
    url = re.sub(r"(://[^:/@]*:)[^@]*@", r"\1****@", url)
    return re.sub(r"(password\s*=\s*)\S+", r"\1****", url)


class tx:
    """with tx(conn): ...  -> usa ka atomic write transaction.
    Usa ra ka write transaction ang molihok matag higayon (advisory lock), parehas sa BEGIN IMMEDIATE sa SQLite
    kaniadto. Busa ang "susiha dayon i-insert" sa code luwas gihapon bisan sabay-sabay ang daghang click."""

    def __init__(self, conn):
        self.c = conn
        self._t = conn.transaction()          # BEGIN ... COMMIT (o ROLLBACK kung naay error)

    def __enter__(self):
        self._t.__enter__()
        self.c.execute("SET LOCAL lock_timeout = '15s'")                       # dili mag-hulat sa kahangtoran
        self.c.execute("SELECT pg_advisory_xact_lock(%d)" % WRITE_LOCK_ID)
        return self.c

    def __exit__(self, et, ev, tb):
        return self._t.__exit__(et, ev, tb)


def create_schema(conn):
    """Himoa ang mga table kung wala pa. Luwas i-run kausa o makaduha."""
    with conn.transaction():
        conn.execute("SELECT pg_advisory_xact_lock(%d)" % SCHEMA_LOCK_ID)
        conn.execute(SCHEMA)


def reset_sequences(conn, tables):
    """Pagkahuman sa pag-insert nga naay klaro nga `n`, ipahiuli ang counter sa PostgreSQL sa labing dako nga `n`,
    aron ang sunod nga bag-ong laray dili mo-duplicate sa ID. (`tables` gikan ra sa code, dili sa user.)"""
    for t in tables:
        conn.execute("SELECT setval(pg_get_serial_sequence('%s','n'), COALESCE((SELECT MAX(n) FROM %s), 1), "
                     "(SELECT COUNT(*) > 0 FROM %s))" % (t, t, t))


def init_db():
    global DUMMY_HASH
    try:
        conn = connect()
    except psycopg.Error as e:
        sys.exit("\n  Can't connect to PostgreSQL.\n    Address : %s\n    Reason  : %s\n\n"
                 "  Check: 1) PostgreSQL is running   2) the database exists (CREATE DATABASE care;)\n"
                 "         3) user/password are right in server-config.json -> \"database_url\"\n"
                 % (safe_url(CFG["database_url"]), str(e).strip()))
    try:
        create_schema(conn)
    except psycopg.Error as e:
        sys.exit("\n  Could not create the tables: %s\n"
                 "  (If it mentions \"citext\": run  CREATE EXTENSION citext;  once as the postgres user in this database.)\n" % str(e).strip())
    conn.execute("DELETE FROM accounts WHERE pending=1")          # half-created accounts from a crash
    conn.execute("DELETE FROM idempotency WHERE created < ?", (now_ms() - 24 * 3600 * 1000,))
    conn.execute("DELETE FROM throttle WHERE t < ?", (now_ms() - 3600 * 1000,))
    conn.execute("DELETE FROM sessions WHERE created < ?", (int(time.time()) - SESSION_MAX_S,))
    DUMMY_HASH = hash_password("dummy-password-for-timing")
    if conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0] == 0:
        with tx(conn):
            seed_admin(conn)
    conn.close()


def seed_admin(conn):
    path = os.path.join(ROOT, "seed", "accounts.json")
    with open(path, encoding="utf-8") as f:
        seed = json.load(f)["accounts"]
    for a in seed:
        pw = CFG["admin_password"]
        stored = hash_password(pw) if (pw and a["role"] == "ADMIN") else "legacy_sha256$%s$%s" % (a["salt"], a["hash"])
        n = int(a["id"].split("-")[1])
        conn.execute(
            "INSERT INTO accounts(n,first,last,name,username,username_key,role,idno,dept,email,email_key,status,last_in,made,pw_hash)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (n, a["first"], a["last"], a["name"], a["user"], a["user"].lower(), a["role"], a["idno"], a["dept"],
             a["email"], email_key(a["email"]), a["status"], "Never", a["made"], stored))
    reset_sequences(conn, ["accounts"])          # kay klaro nga `n` ang gi-insert, i-sync ang counter
    print("  First run: created the administrator account from seed/accounts.json")


# --------------------------------------------------------------------------- serializers
def pub(a):
    return {"id": "U-%03d" % a["n"], "name": a["name"], "first": a["first"], "last": a["last"], "user": a["username"],
            "role": a["role"], "idno": a["idno"], "dept": a["dept"], "email": a["email"], "status": a["status"],
            "last_in": a["last_in"], "made": a["made"]}


def pub_student(s):
    return {k: s[k] for k in ("id", "first", "last", "prog", "block", "year", "allergies", "conditions", "treatments", "contact", "updated")}


def pub_report(r):
    return {"id": "RR-%03d" % r["n"], "sid": r["sid"], "when": r["when_txt"], "place": r["place"], "reason": r["reason"],
            "symptoms": r["symptoms"], "actions": r["actions"], "response": r["response"], "referred": r["referred"],
            "notes": r["notes"], "t": r["t"], "by": r["by_txt"], "status": r["status"], "assessment": r["assessment"],
            "assessedBy": r["assessed_by"], "assessedAt": r["assessed_at"]}


def pub_request(r):
    return {"id": "PR-%03d" % r["n"], "uid": "U-%03d" % r["account_n"], "name": r["name"], "idno": r["idno"],
            "role": r["role"], "email": r["email"], "at": r["at"], "t": r["t"], "status": r["status"], "handled": r["handled"]}


def uid_to_n(uid, prefix="U-"):
    m = re.fullmatch(re.escape(prefix) + r"(\d{1,9})", uid or "")
    if not m:
        raise ApiError(404, "Not found.")
    return int(m.group(1))


def add_log(conn, who, role, act, rec="—", ok=True):
    conn.execute("INSERT INTO logs(when_txt,t,who,role,act,rec,ok) VALUES(?,?,?,?,?,?,?)",
                 (stamp(), now_ms(), clean(who, 120), role, clean(act, 100), clean(rec or "—", 200), 1 if ok else 0))


# --------------------------------------------------------------------------- locks, throttling, idempotency
_STRIPES = [threading.Lock() for _ in range(128)]


def stripe(name):
    return _STRIPES[int(hashlib.md5(name.encode()).hexdigest(), 16) % len(_STRIPES)]


def throttle_count(conn, k, window_s):
    return conn.execute("SELECT COUNT(*) FROM throttle WHERE k=? AND t>?", (k, now_ms() - window_s * 1000)).fetchone()[0]


def throttle_hit(conn, k):
    conn.execute("INSERT INTO throttle(k,t) VALUES(?,?)", (k, now_ms()))


_recent_mail = {}
_recent_mail_lock = threading.Lock()


# --------------------------------------------------------------------------- e-mail
def email_configured():
    e = CFG["email"]
    sm, ej = e["smtp"], e["emailjs"]
    return bool((sm["host"] and sm["user"] and sm["password"]) or (ej["service_id"] and ej["template_id"] and ej["public_key"]))


def send_credentials(to, name, username, password, reason):
    """Returns {'ok':bool,'sent':bool,'error':str}. sent=False means e-mail is not set up (admin gives the password by hand).

    Duplicate-click protection: the same recipient + same purpose + same password within 60 s is sent ONCE.
    A deliberate re-send (a freshly generated password) is always sent.
    """
    if not email_configured():
        return {"ok": True, "sent": False}
    sig = (to.lower(), reason, hashlib.sha256(password.encode()).hexdigest())
    with _recent_mail_lock:
        t = time.time()
        for k in [k for k, v in _recent_mail.items() if t - v > 60]:
            del _recent_mail[k]
        if sig in _recent_mail:
            return {"ok": True, "sent": True, "duplicate": True}
        _recent_mail[sig] = t
    message = "Your CARE account has been created." if reason == "new" else "Your CARE password was reset by the administrator."
    try:
        sm, ej = CFG["email"]["smtp"], CFG["email"]["emailjs"]
        if sm["host"] and sm["user"] and sm["password"]:
            msg = EmailMessage()
            msg["Subject"] = "CARE account — CTU Consolacion Campus"
            msg["From"] = sm["from"] or sm["user"]
            msg["To"] = to
            msg.set_content("Hello %s,\n\n%s\n\nUsername: %s\nPassword: %s\n\nSign in, then change your password from Profile.\n\n— CARE, CTU Consolacion Campus\n"
                            % (name, message, username, password))
            if sm.get("ssl"):
                s = smtplib.SMTP_SSL(sm["host"], int(sm["port"]), timeout=20, context=ssl.create_default_context())
            else:
                s = smtplib.SMTP(sm["host"], int(sm["port"]), timeout=20)
                s.starttls(context=ssl.create_default_context())
            with s:
                s.login(sm["user"], sm["password"])
                s.send_message(msg)
        else:
            body = {"service_id": ej["service_id"], "template_id": ej["template_id"], "user_id": ej["public_key"],
                    "template_params": {"to_email": to, "to_name": name, "username": username, "password": password,
                                        "message": message, "system_name": "CARE - CTU Consolacion Campus"}}
            if ej.get("private_key"):
                body["accessToken"] = ej["private_key"]
            req = urllib.request.Request("https://api.emailjs.com/api/v1.0/email/send", data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json", "User-Agent": "CARE-server/1.0"})
            urllib.request.urlopen(req, timeout=20).read()
        return {"ok": True, "sent": True}
    except urllib.error.HTTPError as e:
        with _recent_mail_lock:
            _recent_mail.pop(sig, None)
        txt = ""
        try: txt = e.read().decode("utf-8", "replace")[:200]
        except Exception: pass
        return {"ok": False, "error": txt or ("Error %s" % e.code)}
    except (urllib.error.URLError, socket.timeout, OSError):
        with _recent_mail_lock:
            _recent_mail.pop(sig, None)
        return {"ok": False, "error": "No internet connection."}
    except smtplib.SMTPRecipientsRefused:
        with _recent_mail_lock:
            _recent_mail.pop(sig, None)
        return {"ok": False, "error": "The mail server refused that address."}
    except Exception as e:  # noqa
        with _recent_mail_lock:
            _recent_mail.pop(sig, None)
        return {"ok": False, "error": str(e)[:200]}


# --------------------------------------------------------------------------- request context + sessions
class Ctx:
    def __init__(self, handler, conn, body):
        self.h, self.conn, self.body = handler, conn, body
        self.account = None
        self.set_cookies = []
        self.idem_key = handler.headers.get("Idempotency-Key", "").strip()
        if self.idem_key and not re.fullmatch(r"[A-Za-z0-9_\-]{8,100}", self.idem_key):
            self.idem_key = ""
        self.replay = False

    @property
    def ip(self):
        if CFG["trust_proxy"]:
            xf = self.h.headers.get("X-Forwarded-For", "")
            if xf:
                return xf.split(",")[0].strip()[:64]
        return self.h.client_address[0]

    @property
    def https(self):
        if CFG["cookie_secure"] is True: return True
        if CFG["cookie_secure"] is False: return False
        return CFG["trust_proxy"] and self.h.headers.get("X-Forwarded-Proto", "") == "https"

    def cookie(self, name):
        raw = self.h.headers.get("Cookie", "")
        if not raw: return ""
        try:
            c = SimpleCookie(); c.load(raw)
            return c[name].value if name in c else ""
        except Exception:
            return ""

    def put_cookie(self, kind, token, clear=False):
        parts = ["care_%s=%s" % (kind, "" if clear else token), "Path=/", "HttpOnly", "SameSite=Lax"]
        if clear: parts.append("Max-Age=0")
        if self.https: parts.append("Secure")
        self.set_cookies.append("; ".join(parts))


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def session_account(ctx, kind):
    tok = ctx.cookie("care_" + kind)
    if not tok:
        return None
    row = ctx.conn.execute(
        "SELECT a.*, s.created AS s_created, s.last_seen AS s_seen FROM sessions s JOIN accounts a ON a.n=s.account_n"
        " WHERE s.token_hash=? AND s.kind=? AND a.pending=0", (sha(tok), kind)).fetchone()
    if not row:
        return None
    now = int(time.time())
    if now - row["s_created"] > SESSION_MAX_S or now - row["s_seen"] > SESSION_IDLE_S or row["status"] != "Active":
        ctx.conn.execute("DELETE FROM sessions WHERE token_hash=?", (sha(tok),))
        return None
    if (kind == "admin") != (row["role"] == "ADMIN"):
        return None
    if now - row["s_seen"] > 60:
        ctx.conn.execute("UPDATE sessions SET last_seen=? WHERE token_hash=?", (now, sha(tok)))
    return row


def new_session(ctx, acc, kind):
    old = ctx.cookie("care_" + kind)
    if old:
        ctx.conn.execute("DELETE FROM sessions WHERE token_hash=?", (sha(old),))
    tok = secrets.token_urlsafe(32)
    now = int(time.time())
    ctx.conn.execute("INSERT INTO sessions(token_hash,account_n,kind,created,last_seen) VALUES(?,?,?,?,?)",
                     (sha(tok), acc["n"], kind, now, now))
    ctx.conn.execute("DELETE FROM sessions WHERE created < ?", (now - SESSION_MAX_S,))
    ctx.put_cookie(kind, tok)


# --------------------------------------------------------------------------- API handlers
def require_fields(body, *names):
    if not isinstance(body, dict):
        raise ApiError(400, "Invalid request.")
    return [body.get(n) for n in names]


def api_health(ctx, p):
    return 200, {"ok": True}


def api_session(ctx, p):
    kind = (ctx.h.query.get("kind", [""])[0])
    if kind not in ("admin", "portal"):
        raise ApiError(400, "Invalid request.")
    acc = session_account(ctx, kind)
    return 200, {"account": pub(acc) if acc else None}


def api_login(ctx, p):
    b = ctx.body if isinstance(ctx.body, dict) else {}
    username, password, role = clean(b.get("username"), 80), b.get("password"), b.get("role")
    if role not in ROLES: raise ApiError(400, "Invalid request.")
    if not username: raise ApiError(400, "Enter your username.")
    if not isinstance(password, str) or not password: raise ApiError(400, "Enter your password.")
    if len(password) > 200: raise ApiError(400, "That username or password is not correct.")
    c = ctx.conn
    k1, k2 = "login:%s:%s" % (ctx.ip, username.lower()), "loginip:%s" % ctx.ip
    if throttle_count(c, k1, 600) >= 6 or throttle_count(c, k2, 600) >= 40:
        raise ApiError(429, "Too many sign-in attempts. Please wait 10 minutes and try again.")
    acc = c.execute("SELECT * FROM accounts WHERE username_key=? AND pending=0", (username.lower(),)).fetchone()
    good = bool(acc) and acc["role"] == role and verify_password(password, acc["pw_hash"])
    if not acc:
        verify_password(password, DUMMY_HASH)           # same time whether the user exists or not
    if not good:
        throttle_hit(c, k1); throttle_hit(c, k2)
        add_log(c, acc["name"] if acc else username, role, "Sign-in attempt", "—", False)
        raise ApiError(401, "That username or password is not correct.")
    if acc["status"] != "Active":
        add_log(c, acc["name"], acc["role"], "Sign-in attempt", "—", False)
        raise ApiError(403, "This account is inactive. Contact the administrator.")
    with tx(c):
        if needs_rehash(acc["pw_hash"]):
            c.execute("UPDATE accounts SET pw_hash=? WHERE n=?", (hash_password(password), acc["n"]))
        c.execute("UPDATE accounts SET last_in=? WHERE n=?", (stamp(), acc["n"]))
        add_log(c, acc["name"], acc["role"], "Signed in", "—", True)
        c.execute("DELETE FROM throttle WHERE k=?", (k1,))
        new_session(ctx, acc, "admin" if role == "ADMIN" else "portal")
    acc = c.execute("SELECT * FROM accounts WHERE n=?", (acc["n"],)).fetchone()
    return 200, {"account": pub(acc)}


def api_logout(ctx, p):
    kind = (ctx.body or {}).get("kind") if isinstance(ctx.body, dict) else None
    if kind not in ("admin", "portal"): raise ApiError(400, "Invalid request.")
    tok = ctx.cookie("care_" + kind)
    if tok:
        ctx.conn.execute("DELETE FROM sessions WHERE token_hash=?", (sha(tok),))
    ctx.put_cookie(kind, "", clear=True)
    return 200, {"ok": True}


def api_config(ctx, p):
    return 200, {"email": email_configured()}


def api_data(ctx, p):
    c, me = ctx.conn, ctx.account
    if me["role"] == "ADMIN":
        accounts = [pub(a) for a in c.execute("SELECT * FROM accounts WHERE pending=0 ORDER BY n")]
        logs = [{"when": r["when_txt"], "who": r["who"], "role": r["role"], "act": r["act"], "rec": r["rec"], "ok": bool(r["ok"])}
                for r in c.execute("SELECT * FROM logs ORDER BY n DESC LIMIT 1000")]
        stats = {"logs": c.execute("SELECT COUNT(*) FROM logs").fetchone()[0],
                 "fails": c.execute("SELECT COUNT(*) FROM logs WHERE ok=0").fetchone()[0]}
        reqs = [pub_request(r) for r in c.execute("SELECT * FROM requests ORDER BY n")]
        return 200, {"accounts": accounts, "logs": logs, "requests": reqs, "students": [], "reports": [], "stats": stats}
    students = [pub_student(s) for s in c.execute("SELECT * FROM students ORDER BY last, first")]
    reports = [pub_report(r) for r in c.execute("SELECT * FROM reports ORDER BY n")]
    return 200, {"accounts": [pub(me)], "logs": [], "requests": [], "students": students, "reports": reports,
                 "stats": {"logs": 0, "fails": 0}}


def api_change_password(ctx, p):
    b = ctx.body if isinstance(ctx.body, dict) else {}
    cur, nxt = b.get("current"), b.get("next")
    me, c = ctx.account, ctx.conn
    if not isinstance(cur, str) or not cur: raise ApiError(400, "Enter your current password.")
    prob = password_problem(nxt)
    if prob: raise ApiError(400, prob)
    row = c.execute("SELECT pw_hash FROM accounts WHERE n=?", (me["n"],)).fetchone()
    if not verify_password(cur, row["pw_hash"]):
        raise ApiError(400, "Your current password is not correct.")
    kind = "admin" if me["role"] == "ADMIN" else "portal"
    with tx(c):
        c.execute("UPDATE accounts SET pw_hash=? WHERE n=?", (hash_password(nxt), me["n"]))
        keep = sha(ctx.cookie("care_" + kind))
        c.execute("DELETE FROM sessions WHERE account_n=? AND token_hash<>?", (me["n"], keep))   # sign out other devices
        add_log(c, me["name"], me["role"], "Changed password", "—", True)
    return 200, {"ok": True}


def api_reset_request(ctx, p):
    b = ctx.body if isinstance(ctx.body, dict) else {}
    idno, email = clean(b.get("idno"), 40).upper(), clean(b.get("email"), 120).lower()
    c = ctx.conn
    if not idno or not email: raise ApiError(400, "Enter your account ID and Gmail.")
    k = "reset:%s" % ctx.ip
    if throttle_count(c, k, 600) >= 8:
        raise ApiError(429, "Too many requests. Please wait a few minutes and try again.")
    throttle_hit(c, k)
    acc = c.execute("SELECT * FROM accounts WHERE upper(idno)=? AND role<>'ADMIN' AND pending=0", (idno,)).fetchone()
    if not acc or acc["email_key"] != email_key(email):
        raise ApiError(404, "We could not match that account ID and Gmail.")
    if acc["status"] != "Active":
        raise ApiError(403, "This account is inactive. Contact the administrator.")
    with stripe("reqcreate:%d" % acc["n"]), tx(c):
        if not c.execute("SELECT 1 FROM requests WHERE account_n=? AND status='Pending'", (acc["n"],)).fetchone():
            c.execute("INSERT INTO requests(account_n,name,idno,role,email,\"at\",t,status) VALUES(?,?,?,?,?,?,?,'Pending')",
                      (acc["n"], acc["name"], acc["idno"], acc["role"], acc["email"], stamp(), now_ms()))
            add_log(c, acc["name"], acc["role"], "Password reset request", acc["idno"], True)
    return 200, {"ok": True}


def api_audit(ctx, p):
    b = ctx.body if isinstance(ctx.body, dict) else {}
    act, rec = clean(b.get("act"), 60), clean(b.get("rec"), 160) or "—"
    if act not in LOGGABLE_FROM_CLIENT: raise ApiError(400, "Invalid request.")
    me, c = ctx.account, ctx.conn
    # spam guard: the same person doing the same thing to the same record within 10 s is one log entry
    dup = c.execute("SELECT 1 FROM logs WHERE who=? AND act=? AND rec=? AND t>?", (me["name"], act, rec, now_ms() - 10000)).fetchone()
    if not dup:
        add_log(c, me["name"], me["role"], act, rec, True)
    return 200, {"ok": True}


# ---- admin: accounts
def read_account_form(b, creating):
    first = re.sub(r"\s{2,}", " ", clean(b.get("first"), 80))
    last = re.sub(r"\s{2,}", " ", clean(b.get("last"), 80))
    user, role, dept, status = clean(b.get("user"), 60), b.get("role"), b.get("dept"), b.get("status")
    email = clean(b.get("email"), 120).lower()
    missing = [l for l, v in (("First name", first), ("Last name", last), ("Username", user), ("Gmail", email)) if not v]
    if missing: raise ApiError(400, "Missing: " + ", ".join(missing))
    for label, v in (("First name", first), ("Last name", last)):
        pr = name_problem(v, label)
        if pr: raise ApiError(400, pr)
    pr = username_problem(user)
    if pr: raise ApiError(400, pr)
    if role not in ROLES: raise ApiError(400, "Choose a role.")
    if dept not in DEPTS: raise ApiError(400, "Choose a department.")
    if status not in ("Active", "Inactive"): raise ApiError(400, "Choose a status.")
    return first, last, user, role, dept, status, email


def api_create_account(ctx, p):
    b = ctx.body if isinstance(ctx.body, dict) else {}
    c, me = ctx.conn, ctx.account
    first, last, user, role, dept, status, email = read_account_form(b, True)
    pw = b.get("password")
    pr = gmail_problem(email) or password_problem(pw)
    if pr: raise ApiError(400, pr)
    ek = email_key(email)
    n = None
    with tx(c):
        if c.execute("SELECT 1 FROM accounts WHERE username_key=?", (user.lower(),)).fetchone():
            raise ApiError(409, "That username already exists.")
        if c.execute("SELECT 1 FROM accounts WHERE email_key=?", (ek,)).fetchone():
            raise ApiError(409, "That Gmail is already used by another account.")
        last_no = c.execute("SELECT MAX(CASE WHEN split_part(idno,'-',2) ~ '^[0-9]+$' THEN CAST(split_part(idno,'-',2) AS INTEGER) END)"
            " FROM accounts WHERE role=?", (role,)).fetchone()[0] or 0
        idno = "%s-%03d" % (ID_PREFIX[role], last_no + 1)
        name = first + " " + last
        try:
            cur = c.execute(
                "INSERT INTO accounts(first,last,name,username,username_key,role,idno,dept,email,email_key,status,last_in,made,pw_hash,pending)"
                " VALUES(?,?,?,?,?,?,?,?,?,?,?,'Never',?,?,1) RETURNING n",
                (first, last, name, user, user.lower(), role, idno, dept, email, ek, status, stamp().split(",")[0], hash_password(pw)))
        except psycopg.IntegrityError:
            raise ApiError(409, "That username or Gmail is already used by another account.")
        n = cur.fetchone()["n"]
    # e-mail goes out BEFORE the account becomes visible; the half-made row already reserves the username + Gmail
    res = send_credentials(email, name, user, pw, "new")
    if not res["ok"]:
        c.execute("DELETE FROM accounts WHERE n=?", (n,))
        raise ApiError(502, "Gmail does not exist or cannot receive email. The account was not created. (%s)" % res.get("error", ""))
    with tx(c):
        c.execute("UPDATE accounts SET pending=0 WHERE n=?", (n,))
        add_log(c, me["name"], "ADMIN", "Created user account", "%s — %s" % (name, idno), True)
    acc = c.execute("SELECT * FROM accounts WHERE n=?", (n,)).fetchone()
    return 201, {"account": pub(acc), "sent": res["sent"]}


def api_update_account(ctx, p):
    n = uid_to_n(p["uid"])
    b = ctx.body if isinstance(ctx.body, dict) else {}
    c, me = ctx.conn, ctx.account
    with stripe("acct:%d" % n):
        u = c.execute("SELECT * FROM accounts WHERE n=? AND pending=0", (n,)).fetchone()
        if not u: raise ApiError(404, "Account not found.")
        first, last, user, role, dept, status, email = read_account_form(b, False)
        if u["n"] == me["n"] and (status != "Active" or role != "ADMIN"):
            raise ApiError(400, "You cannot deactivate or change the role of your own account.")
        if c.execute("SELECT 1 FROM accounts WHERE username_key=? AND n<>?", (user.lower(), n)).fetchone():
            raise ApiError(400, "That username is taken.")
        ek = u["email_key"]
        if email != (u["email"] or "").lower():
            pr = gmail_problem(email)
            if pr: raise ApiError(400, pr)
            ek = email_key(email)
            if c.execute("SELECT 1 FROM accounts WHERE email_key=? AND n<>?", (ek, n)).fetchone():
                raise ApiError(409, "That Gmail is already used by another account.")
        newpw, res = b.get("password"), None
        name = first + " " + last
        if newpw:
            pr = password_problem(newpw)
            if pr: raise ApiError(400, pr)
            res = send_credentials(email, name, user, newpw, "reset")
            if not res["ok"]:
                raise ApiError(502, "Gmail does not exist or cannot receive email. Nothing was changed. (%s)" % res.get("error", ""))
        was = u["role"]
        try:
            with tx(c):
                c.execute("UPDATE accounts SET first=?,last=?,name=?,username=?,username_key=?,role=?,dept=?,status=?,email=?,email_key=? WHERE n=?",
                          (first, last, name, user, user.lower(), role, dept, status, email, ek, n))
                if newpw:
                    c.execute("UPDATE accounts SET pw_hash=? WHERE n=?", (hash_password(newpw), n))
                if newpw or status != "Active" or role != was:
                    c.execute("DELETE FROM sessions WHERE account_n=?", (n,))
                add_log(c, me["name"], "ADMIN", "Reset password" if newpw else ("Updated user account" if was == role else "Changed user role"),
                        "%s — %s" % (name, u["idno"]), True)
        except psycopg.IntegrityError:
            raise ApiError(409, "That username or Gmail is already used by another account.")
    acc = c.execute("SELECT * FROM accounts WHERE n=?", (n,)).fetchone()
    return 200, {"account": pub(acc), "was": was, "sent": bool(res and res["sent"]), "reset": bool(newpw)}


def api_set_status(ctx, p):
    n = uid_to_n(p["uid"])
    status = (ctx.body or {}).get("status") if isinstance(ctx.body, dict) else None
    c, me = ctx.conn, ctx.account
    if status not in ("Active", "Inactive"): raise ApiError(400, "Invalid request.")
    if n == me["n"]: raise ApiError(400, "You cannot deactivate your own account.")
    with tx(c):
        u = c.execute("SELECT * FROM accounts WHERE n=? AND pending=0", (n,)).fetchone()
        if not u: raise ApiError(404, "Account not found.")
        if u["status"] != status:                                   # repeated clicks change nothing and log nothing
            c.execute("UPDATE accounts SET status=? WHERE n=?", (status, n))
            if status == "Inactive":
                c.execute("DELETE FROM sessions WHERE account_n=?", (n,))
            add_log(c, me["name"], "ADMIN", ("Deactivated" if status == "Inactive" else "Reactivated") + " user account", "—", True)
    return 200, {"account": pub(c.execute("SELECT * FROM accounts WHERE n=?", (n,)).fetchone())}


def api_delete_account(ctx, p):
    n = uid_to_n(p["uid"])
    c, me = ctx.conn, ctx.account
    if n == me["n"]: raise ApiError(400, "You cannot delete your own account.")
    with tx(c):
        u = c.execute("SELECT * FROM accounts WHERE n=? AND pending=0", (n,)).fetchone()
        if not u: raise ApiError(404, "Account not found.")
        c.execute("DELETE FROM accounts WHERE n=?", (n,))          # their sessions + password requests go with it; logs stay
        add_log(c, me["name"], "ADMIN", "Deleted user account", "%s — %s" % (u["name"], u["idno"] or "U-%03d" % n), True)
    return 200, {"ok": True}


# ---- admin: password requests
def api_request_reset(ctx, p):
    rn = uid_to_n(p["id"], "PR-")
    b = ctx.body if isinstance(ctx.body, dict) else {}
    c, me = ctx.conn, ctx.account
    user, pw = clean(b.get("user"), 60), b.get("password")
    if not user: raise ApiError(400, "Enter a username.")
    pr = username_problem(user) or password_problem(pw)
    if pr: raise ApiError(400, pr)
    with stripe("reqhandle:%d" % rn):                    # two clicks / two tabs can never both send an e-mail
        r = c.execute("SELECT * FROM requests WHERE n=?", (rn,)).fetchone()
        if not r: raise ApiError(404, "Request not found.")
        if r["status"] != "Pending": raise ApiError(409, "This request was already handled.")
        a = c.execute("SELECT * FROM accounts WHERE n=?", (r["account_n"],)).fetchone()
        if not a: raise ApiError(404, "Account not found.")
        if c.execute("SELECT 1 FROM accounts WHERE username_key=? AND n<>?", (user.lower(), a["n"])).fetchone():
            raise ApiError(400, "That username is taken.")
        res = send_credentials(a["email"], a["name"], user, pw, "reset")
        if not res["ok"]:
            raise ApiError(502, "Gmail does not exist or cannot receive email. Nothing was changed. (%s)" % res.get("error", ""))
        with tx(c):
            c.execute("UPDATE accounts SET username=?, username_key=?, pw_hash=? WHERE n=?", (user, user.lower(), hash_password(pw), a["n"]))
            c.execute("DELETE FROM sessions WHERE account_n=?", (a["n"],))
            c.execute("UPDATE requests SET status='Done', handled=? WHERE n=?", (stamp(), rn))
            add_log(c, me["name"], "ADMIN", "Reset password (request)", "%s — %s" % (a["name"], a["idno"]), True)
    return 200, {"sent": res["sent"], "email": a["email"], "first": a["first"]}


def api_request_dismiss(ctx, p):
    rn = uid_to_n(p["id"], "PR-")
    c, me = ctx.conn, ctx.account
    with tx(c):
        r = c.execute("SELECT * FROM requests WHERE n=?", (rn,)).fetchone()
        if not r: raise ApiError(404, "Request not found.")
        if r["status"] == "Pending":
            c.execute("UPDATE requests SET status='Dismissed', handled=? WHERE n=?", (stamp(), rn))
            add_log(c, me["name"], "ADMIN", "Dismissed password request", r["idno"], True)
    return 200, {"ok": True}


# ---- clinic: students
def read_student_form(b, creating):
    first = re.sub(r"\s{2,}", " ", clean(b.get("first"), 80))
    last = re.sub(r"\s{2,}", " ", clean(b.get("last"), 80))
    if not first or not last:
        raise ApiError(400, "First and last name are required.")
    for label, v in (("First name", first), ("Last name", last)):
        pr = name_problem(v, label)
        if pr: raise ApiError(400, pr)
    prog, block, year = b.get("prog"), b.get("block"), b.get("year")
    if prog not in PROGRAMS: raise ApiError(400, "Choose a program.")
    if block not in BLOCKS: raise ApiError(400, "Choose a block.")
    if year not in YEARS: raise ApiError(400, "Choose a year level.")
    contact = clean(b.get("contact"), 40)
    pr = phone_problem(contact)
    if pr: raise ApiError(400, pr)
    return {"first": first, "last": last, "prog": prog, "block": block, "year": year,
            "allergies": clean(b.get("allergies"), 1000) or "None recorded",
            "conditions": clean(b.get("conditions"), 1000) or "None recorded",
            "treatments": clean(b.get("treatments"), 1000) or "—", "contact": contact}


def api_create_student(ctx, p):
    b = ctx.body if isinstance(ctx.body, dict) else {}
    c, me = ctx.conn, ctx.account
    sid = clean(b.get("id"), 20)
    miss = [l for l, v in (("First name", clean(b.get("first"))), ("Last name", clean(b.get("last"))), ("Student ID", sid)) if not v]
    if miss: raise ApiError(400, "Missing: " + ", ".join(miss))
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9\-]{2,19}", sid):
        raise ApiError(400, "Student ID may contain only letters, numbers and dashes (3–20 characters).")
    f = read_student_form(b, True)
    try:
        with tx(c):
            if c.execute("SELECT 1 FROM students WHERE id=?", (sid,)).fetchone():
                raise ApiError(409, "That student ID already exists. Open the existing record instead.")
            c.execute("INSERT INTO students(id,first,last,prog,block,year,allergies,conditions,treatments,contact,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                      (sid, f["first"], f["last"], f["prog"], f["block"], f["year"], f["allergies"], f["conditions"], f["treatments"], f["contact"], stamp()))
            add_log(c, me["name"], me["role"], "Added student record", "%s %s — %s" % (f["first"], f["last"], sid), True)
    except psycopg.IntegrityError:
        raise ApiError(409, "That student ID already exists. Open the existing record instead.")
    return 201, {"student": pub_student(c.execute("SELECT * FROM students WHERE id=?", (sid,)).fetchone())}


def api_update_student(ctx, p):
    c, me = ctx.conn, ctx.account
    b = ctx.body if isinstance(ctx.body, dict) else {}
    f = read_student_form(b, False)
    with tx(c):
        s = c.execute("SELECT * FROM students WHERE id=?", (p["sid"],)).fetchone()
        if not s: raise ApiError(404, "Student record not found.")
        c.execute("UPDATE students SET first=?,last=?,prog=?,block=?,year=?,allergies=?,conditions=?,treatments=?,contact=?,updated=? WHERE id=?",
                  (f["first"], f["last"], f["prog"], f["block"], f["year"], f["allergies"], f["conditions"], f["treatments"], f["contact"], stamp(), s["id"]))
        add_log(c, me["name"], me["role"], "Updated medical record", "%s %s — %s" % (f["first"], f["last"], s["id"]), True)
    return 200, {"student": pub_student(c.execute("SELECT * FROM students WHERE id=?", (p["sid"],)).fetchone())}


# ---- SQRT: reports
def api_create_report(ctx, p):
    b = ctx.body if isinstance(ctx.body, dict) else {}
    c, me = ctx.conn, ctx.account
    sid = clean(b.get("sid"), 20)
    place, reason, sym, act = (clean(b.get(k), 300) for k in ("place", "reason", "symptoms", "actions"))
    sym, act = clean(b.get("symptoms"), 2000), clean(b.get("actions"), 2000)
    miss = [l for l, v in (("Student", sid), ("Location", place), ("Reason for rescue", reason),
                           ("Observed condition / symptoms", sym), ("Actions taken", act)) if not v]
    if miss: raise ApiError(400, "Missing: " + ", ".join(miss))
    referred = b.get("referred") if b.get("referred") in ("Yes", "No") else "Yes"
    when, resp, notes = clean(b.get("when"), 40) or stamp(), clean(b.get("response"), 2000) or "—", clean(b.get("notes"), 2000)
    by = "%s (%s)" % (me["name"], me["idno"])
    with stripe("report:%d" % me["n"]), tx(c):
        s = c.execute("SELECT * FROM students WHERE id=?", (sid,)).fetchone()
        if not s: raise ApiError(400, "Choose a student from the records.")
        # safety net for a double-click that slipped past the button lock: identical report by the same person in 30 s = same report
        dup = c.execute("SELECT * FROM reports WHERE by_n=? AND sid=? AND place=? AND reason=? AND symptoms=? AND actions=? AND t>? ORDER BY n DESC",
                        (me["n"], s["id"], place, reason, sym, act, now_ms() - 30000)).fetchone()
        if dup:
            return 200, {"report": pub_report(dup), "duplicate": True}
        cur = c.execute("INSERT INTO reports(sid,when_txt,place,reason,symptoms,actions,response,referred,notes,t,by_txt,by_n,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING n",
                        (s["id"], when, place, reason, sym, act, resp, referred, notes, now_ms(), by, me["n"], "Pending Clinic Review"))
        add_log(c, me["name"], me["role"], "Submitted rescue report", "%s %s — %s" % (s["first"], s["last"], s["id"]), True)
        row = c.execute("SELECT * FROM reports WHERE n=?", (cur.fetchone()["n"],)).fetchone()
    return 201, {"report": pub_report(row)}


def api_assess_report(ctx, p):
    rn = uid_to_n(p["id"], "RR-")
    text = clean((ctx.body or {}).get("text") if isinstance(ctx.body, dict) else "", 3000)
    c, me = ctx.conn, ctx.account
    if not text: raise ApiError(400, "Assessment is empty. Write your findings first.")
    with tx(c):
        r = c.execute("SELECT * FROM reports WHERE n=?", (rn,)).fetchone()
        if not r: raise ApiError(404, "Report not found.")
        if r["assessment"]: raise ApiError(409, "This report already has an assessment.")
        s = c.execute("SELECT * FROM students WHERE id=?", (r["sid"],)).fetchone()
        c.execute("UPDATE reports SET assessment=?, assessed_by=?, assessed_at=?, status='Resolved' WHERE n=?",
                  (text, "%s (%s)" % (me["name"], me["idno"]), stamp(), rn))
        add_log(c, me["name"], me["role"], "Added clinic assessment", "%s %s — %s" % (s["first"], s["last"], s["id"]), True)
    return 200, {"report": pub_report(c.execute("SELECT * FROM reports WHERE n=?", (rn,)).fetchone())}


def api_resolve_report(ctx, p):
    rn = uid_to_n(p["id"], "RR-")
    c, me = ctx.conn, ctx.account
    with tx(c):
        r = c.execute("SELECT * FROM reports WHERE n=?", (rn,)).fetchone()
        if not r: raise ApiError(404, "Report not found.")
        if r["status"] != "Resolved":                              # repeated clicks: one change, one log line
            s = c.execute("SELECT * FROM students WHERE id=?", (r["sid"],)).fetchone()
            c.execute("UPDATE reports SET status='Resolved' WHERE n=?", (rn,))
            add_log(c, me["name"], me["role"], "Marked report resolved", "%s %s — %s" % (s["first"], s["last"], s["id"]), True)
    return 200, {"report": pub_report(c.execute("SELECT * FROM reports WHERE n=?", (rn,)).fetchone())}


# method, regex, handler, auth, idempotent
#   auth: None (public) | ("admin",) | ("portal", roles...)
ROUTES = [
    ("GET",    r"/api/health$",                     api_health,           None, False),
    ("GET",    r"/api/session$",                    api_session,          None, False),
    ("POST",   r"/api/login$",                      api_login,            None, False),
    ("POST",   r"/api/logout$",                     api_logout,           None, False),
    ("POST",   r"/api/reset-request$",              api_reset_request,    None, True),
    ("GET",    r"/api/config$",                     api_config,           ("admin",), False),
    ("GET",    r"/api/data$",                       api_data,             ("any",), False),
    ("POST",   r"/api/password$",                   api_change_password,  ("any",), True),
    ("POST",   r"/api/audit$",                      api_audit,            ("portal", "SQRT", "CLINIC"), False),
    ("POST",   r"/api/admin/accounts$",             api_create_account,   ("admin",), True),
    ("PATCH",  r"/api/admin/accounts/(?P<uid>[^/]+)$", api_update_account, ("admin",), True),
    ("POST",   r"/api/admin/accounts/(?P<uid>[^/]+)/status$", api_set_status, ("admin",), True),
    ("DELETE", r"/api/admin/accounts/(?P<uid>[^/]+)$", api_delete_account, ("admin",), True),
    ("POST",   r"/api/admin/requests/(?P<id>[^/]+)/reset$",   api_request_reset,   ("admin",), True),
    ("POST",   r"/api/admin/requests/(?P<id>[^/]+)/dismiss$", api_request_dismiss, ("admin",), True),
    ("POST",   r"/api/students$",                   api_create_student,   ("portal", "CLINIC"), True),
    ("PATCH",  r"/api/students/(?P<sid>[^/]+)$",    api_update_student,   ("portal", "CLINIC"), True),
    ("POST",   r"/api/reports$",                    api_create_report,    ("portal", "SQRT"), True),
    ("POST",   r"/api/reports/(?P<id>[^/]+)/assessment$", api_assess_report, ("portal", "CLINIC"), True),
    ("POST",   r"/api/reports/(?P<id>[^/]+)/resolve$",    api_resolve_report, ("portal", "CLINIC"), True),
]
ROUTES = [(m, re.compile(rx), fn, auth, idem) for (m, rx, fn, auth, idem) in ROUTES]


def authenticate(ctx, auth):
    if auth is None:
        return
    kinds = ("admin", "portal") if auth[0] == "any" else (auth[0],)
    # "any" = whichever session the caller says they are using
    if auth[0] == "any":
        kind = (ctx.h.query.get("kind", [""])[0]) or (ctx.body.get("kind") if isinstance(ctx.body, dict) else "")
        if kind not in ("admin", "portal"): raise ApiError(400, "Invalid request.")
        kinds = (kind,)
    acc = None
    for k in kinds:
        acc = session_account(ctx, k)
        if acc: break
    if not acc:
        raise ApiError(401, "Your session has ended. Please sign in again.", signedOut=True)
    if auth[0] == "portal" and len(auth) > 1 and acc["role"] not in auth[1:]:
        raise ApiError(403, "Your role is not allowed to do that.")
    ctx.account = acc


def dispatch(ctx, method, path):
    found_path = False
    for m, rx, fn, auth, idem in ROUTES:
        mt = rx.match(path)
        if not mt:
            continue
        found_path = True
        if m != method:
            continue
        authenticate(ctx, auth)
        params = {k: unquote(v) for k, v in mt.groupdict().items()}
        if not (idem and ctx.idem_key):
            return fn(ctx, params)
        scope = "u%d" % ctx.account["n"] if ctx.account else "ip:" + ctx.ip
        bh = sha(json.dumps(ctx.body, sort_keys=True, default=str))
        endpoint = method + " " + path
        with stripe(scope + endpoint + ctx.idem_key):          # concurrent duplicates wait here, then get the first answer
            row = ctx.conn.execute("SELECT * FROM idempotency WHERE scope=? AND key=? AND endpoint=?", (scope, ctx.idem_key, endpoint)).fetchone()
            if row and row["body_hash"] == bh:
                ctx.replay = True
                return row["status"], json.loads(row["response"])
            status, payload = fn(ctx, params)
            if 200 <= status < 300:
                ctx.conn.execute("INSERT INTO idempotency(scope,key,endpoint,body_hash,status,response,created) VALUES(?,?,?,?,?,?,?)"
                                 " ON CONFLICT (scope,key,endpoint) DO UPDATE SET body_hash=EXCLUDED.body_hash,"
                                 " status=EXCLUDED.status, response=EXCLUDED.response, created=EXCLUDED.created",
                                 (scope, ctx.idem_key, endpoint, bh, status, json.dumps(payload), now_ms()))
            return status, payload
    if found_path:
        raise ApiError(405, "Method not allowed.")
    raise ApiError(404, "Not found.")


# --------------------------------------------------------------------------- HTTP layer
STATIC_TOP = {"index.html", "css", "js", "assets", "admin"}
MIME = {".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
        ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon"}
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
MAX_BODY = 64 * 1024


class Handler(BaseHTTPRequestHandler):
    server_version = "CARE"
    sys_version = ""

    def log_message(self, fmt, *args):
        if os.environ.get("CARE_QUIET") != "1":
            sys.stderr.write("%s  %s\n" % (self.log_date_time_string(), fmt % args))

    # ---- output
    def _headers(self, extra=()):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Content-Security-Policy", CSP)
        if CFG["trust_proxy"] and self.headers.get("X-Forwarded-Proto") == "https":
            self.send_header("Strict-Transport-Security", "max-age=31536000")
        for k, v in extra:
            self.send_header(k, v)

    def _json(self, status, payload, cookies=(), extra=()):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for c in cookies:
            self.send_header("Set-Cookie", c)
        self._headers(extra)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    # ---- static
    def _static(self, path):
        rel = unquote(path).lstrip("/")
        if rel == "":
            rel = "index.html"
        if rel == "admin":
            self.send_response(301); self.send_header("Location", "/admin/"); self.send_header("Content-Length", "0"); self._headers(); self.end_headers(); return
        if rel.endswith("/"):
            rel += "index.html"
        parts = rel.split("/")
        if rel == "favicon.ico":
            self.send_response(204); self.send_header("Content-Length", "0"); self._headers(); self.end_headers(); return
        if parts[0] not in STATIC_TOP or any(p.startswith(".") or p == "" for p in parts) or "\\" in rel or "\x00" in rel:
            return self._json(404, {"error": "Not found."})
        if parts[0] == "admin" and rel != "admin/index.html":
            return self._json(404, {"error": "Not found."})
        full = os.path.realpath(os.path.join(ROOT, rel))
        if not full.startswith(ROOT + os.sep) or not os.path.isfile(full):
            return self._json(404, {"error": "Not found."})
        ext = os.path.splitext(full)[1].lower()
        ctype = MIME.get(ext) or mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self._headers()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    # ---- api
    def _api(self, method, parsed):
        self.query = parse_qs(parsed.query)
        body = None
        if method != "GET":
            # CSRF: browsers cannot add this header on a cross-site form post, and cross-site fetch needs a CORS preflight we never grant
            if self.headers.get("X-CARE") != "1":
                return self._json(403, {"error": "Blocked request."})
            origin = self.headers.get("Origin")
            if origin and urlparse(origin).netloc != self.headers.get("Host"):
                return self._json(403, {"error": "Blocked request."})
            try:
                n = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                n = -1
            if n < 0 or n > MAX_BODY:
                return self._json(413, {"error": "Request too large."})
            raw = self.rfile.read(n) if n else b""
            if raw:
                try:
                    body = json.loads(raw.decode("utf-8"))
                except Exception:
                    return self._json(400, {"error": "Invalid request."})
        try:
            conn = connect()
        except psycopg.Error as e:               # patay o dili maabot ang PostgreSQL
            sys.stderr.write("DB connect error: %s\n" % e)
            return self._json(503, {"error": "Cannot reach the database right now. Please try again."})
        ctx = Ctx(self, conn, body)
        try:
            status, payload = dispatch(ctx, method, parsed.path)
            extra = [("Idempotent-Replay", "true")] if ctx.replay else []
            self._json(status, payload, ctx.set_cookies, extra)
        except ApiError as e:
            payload = {"error": e.message}
            payload.update(e.extra)
            self._json(e.status, payload, ctx.set_cookies)
        except pg_errors.RaiseException as e:   # gikan sa trigger sa logs (dili pwede i-edit/i-delete)
            self._json(409, {"error": e.diag.message_primary or "Not allowed."})
        except psycopg.IntegrityError:           # UNIQUE / FOREIGN KEY nga na-violate
            self._json(409, {"error": "That record already exists."})
        except psycopg.DataError:                # pananglitan ang text naay dili madawat nga character
            self._json(400, {"error": "The request has characters that are not allowed."})
        except psycopg.OperationalError as e:    # busy / nawala ang connection / lock timeout
            sys.stderr.write("DB error: %s\n" % e)
            self._json(503, {"error": "The database is busy. Please try again."})
        except Exception:
            import traceback
            traceback.print_exc()
            self._json(500, {"error": "Something went wrong on the server."})
        finally:
            conn.close()

    def _route(self, method):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return self._api(method, parsed)
        if method in ("GET", "HEAD"):
            return self._static(parsed.path)
        self._json(405, {"error": "Method not allowed."})

    def do_GET(self): self._route("GET")
    def do_HEAD(self): self._route("HEAD")
    def do_POST(self): self._route("POST")
    def do_PATCH(self): self._route("PATCH")
    def do_DELETE(self): self._route("DELETE")


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def main():
    init_db()
    srv = Server((CFG["host"], int(CFG["port"])), Handler)
    port = int(CFG["port"])
    print("\n  CARE is running.\n")
    print("    This computer :  http://localhost:%d/" % port)
    ip = lan_ip()
    if ip and CFG["host"] in ("0.0.0.0", ""):
        print("    Other devices :  http://%s:%d/   (same Wi-Fi / network)" % (ip, port))
    print("    Administrator :  /admin/")
    print("    Database      :  PostgreSQL  %s" % safe_url(CFG["database_url"]))
    print("    E-mail        :  %s\n" % ("ON" if email_configured() else "NOT set up (admin will see new passwords on screen)"))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")


if __name__ == "__main__":
    main()
