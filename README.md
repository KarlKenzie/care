# CARE — Campus Assistance & Response Environment (CTU – Consolacion Campus)

HTML + CSS + JS front-end, with a **real back-end and database** (`server.py`, PostgreSQL).
Nothing is stored in the browser any more, so accounts and records are permanent and work on every
browser, every device, and in Incognito.

## Set up (first time only)
1. Install **PostgreSQL 12 or newer** and Python 3.9+.
2. Create an empty database (in `psql` or pgAdmin):
   ```sql
   CREATE DATABASE care;
   ```
3. Install the one Python package the server needs (the PostgreSQL driver):
   ```
   pip install -r requirements.txt
   ```
4. Put your PostgreSQL address in `server-config.json` → `"database_url"`
   (`postgresql://USER:PASSWORD@HOST:PORT/DATABASE`). Hosts like Render / Railway / Neon / Supabase give you this address;
   put it in the `DATABASE_URL` environment variable instead and leave the file alone.
5. The tables are created automatically the first time the server starts. If it complains about `citext`, run
   `CREATE EXTENSION citext;` once inside the `care` database as the `postgres` user.

## Run it
```
python server.py
```
It prints the addresses to open:

| Page | Address |
|---|---|
| SQRT / Clinic sign in | `http://localhost:8000/` |
| Administrator sign in | `http://localhost:8000/admin/` |
| Other phones/laptops on the same Wi-Fi | the `http://192.168.x.x:8000/` address printed at start-up |

Do **not** double-click the HTML files or use Live Server / `http.server` any more — the pages need `server.py`.

First sign-in: Administrator `karlkenjie` / `Care@2026` → **change it right away** (Profile → Change password),
or start the server once with `CARE_ADMIN_PASSWORD=YourOwnPassword` on a brand-new database.

## Where the data lives
In the PostgreSQL database you set in `database_url`. Back it up with `pg_dump care > care-backup.sql`
(restore with `psql care < care-backup.sql`). To start fresh, drop and re-create the database.
Accounts made in the very first version lived in the old browser's localStorage and are not copied over — re-create them in the admin site.


## What changed (and why)
| # | Request | How it is done |
|---|---|---|
| 1 | One click = one account | Button locks while saving; each attempt carries a unique key so the server returns the *first* result for repeats; the database has UNIQUE constraints as the last line of defence |
| 2 | Duplicate Gmail / username | Username is unique ignoring capitals. Gmail is compared the way Gmail does (capitals and dots ignored: `j.doe@gmail.com` = `jdoe@gmail.com`). Checked on create, edit and by the database itself |
| 3 | No duplicate e-mails | Same recipient + same password in 60 s is sent once, repeated clicks and second tabs are ignored. The admin can still send whenever needed (a newly generated password is always sent) |
| 4 | Logs protected | Access logs are append-only: there is no delete/clear function, and the database itself rejects any UPDATE, DELETE or TRUNCATE on the log table. Deleting an account never removes its log lines |
| 5 | Emergency contact | Numbers only (letters/dashes/spaces are blocked as you type). Must be an 11-digit mobile number starting `09`; obviously fake numbers (e.g. `09111111111`) are refused. Checked again on the server. To allow other formats edit `phone_problem()` in `server.py` and `phoneProblem()` in `js/core/input-guard.js` |
| 6 | Other spam / duplicate actions | Same protection on: sign in, forgot-password request, change password, create/edit student record, submit rescue report, save assessment, mark resolved, reset password, deactivate/reactivate/delete account, "Viewed record" log lines |
| 7–9 | Real database, permanent, any device | PostgreSQL behind `server.py` |
| 10 | Works in Incognito | Sign-in is checked by the server and kept in an HttpOnly cookie — nothing depends on localStorage |
| 11 | Secure storage | Passwords: salted PBKDF2-SHA256 (600,000 rounds), never sent to the browser. Random session tokens stored hashed. Sign-in throttling (6 wrong tries → 10-minute wait). CSRF protection, Content-Security-Policy, private files (`seed/`, `server-config.json`, `server.py`) cannot be downloaded. Role checks on the server (e.g. administrators cannot read medical records, SQRT cannot edit them) |

## E-mail (sending the password to the user's Gmail)
The server sends it — keys are no longer visible to website visitors. Fill in **one** of these in `server-config.json`
(copy `server-config.example.json`; environment variables work too):
* **SMTP / Gmail**: `smtp.host = smtp.gmail.com`, `port = 587`, `user = your@gmail.com`, `password = a Google "App password"`.
* **EmailJS** (what you used before): `service_id`, `template_id`, `public_key`, and in EmailJS → *Account → Security* turn on
  *"Allow EmailJS API for non-browser applications"* and paste the **private key**.

If neither is set, the admin sees the new password on screen and gives it to the user by hand.

## Using it from other devices / the internet
* Same Wi-Fi: use the address printed at start-up (allow Python through the firewall if asked).
* Over the internet: host `server.py` on any host that runs Python, and use a **hosted PostgreSQL** (Neon, Supabase, Render, Railway…).
  Set `DATABASE_URL` to its address (add `?sslmode=require` if the host asks for SSL); `PORT` is read automatically,
  `CARE_TRUST_PROXY=1` when behind the host's HTTPS proxy. Always use HTTPS on the internet.
  Because the data lives in PostgreSQL, the web host's disk can be temporary without losing anything.


## Folder structure
```
care/
├── server.py                 web server + API + PostgreSQL access (the only back-end file)
├── requirements.txt          the PostgreSQL driver (psycopg)
├── server-config.json        private settings (database address, e-mail keys) — never served to browsers
├── seed/accounts.json        first-run administrator account
├── index.html  admin/        the two sites
├── css/  assets/
├── js/core/                  api client, auth, mail checks, duplicate-click guard (utils.js), input guards
└── js/admin/  js/portal/     screens
```
