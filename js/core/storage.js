/* STORAGE — the browser no longer keeps any data. Everything lives in the server's database.
   CARE.db is only a read-only cache of what the server last sent, so the screens can stay simple.
   kind: 'admin' (administrator site) or 'portal' (SQRT / Clinic site). */
window.CARE = window.CARE || {};

(function () {
  var kind = document.body.classList.contains('portal') ? 'portal' : 'admin';
  var cache = { accounts: [], logs: [], students: [], reports: [], requests: [], stats: { logs: 0, fails: 0 } };
  var session = null;                       // the signed-in account (public fields only), or null

  /* ---- talk to the server. Resolves with the JSON, rejects with an Error that has .status and a readable .message */
  function api(method, path, body, opts) {
    opts = opts || {};
    var headers = { 'X-CARE': '1' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.key) headers['Idempotency-Key'] = opts.key;
    return fetch(path, { method: method, headers: headers, credentials: 'same-origin', cache: 'no-store',
                         body: body === undefined ? undefined : JSON.stringify(body) })
      .catch(function () { var e = new Error('Cannot reach the server. Check your connection and try again.'); e.status = 0; throw e; })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok) return j;
          var e = new Error(j.error || 'Something went wrong. Please try again.');
          e.status = r.status; e.data = j;
          if (r.status === 401 && j.signedOut && session) { session = null; if (CARE.onSignedOut) CARE.onSignedOut(); }
          throw e;
        });
      });
  }

  /* ---- load the data this signed-in user is allowed to see */
  function reload() {
    if (!session) return Promise.resolve();
    return api('GET', '/api/data?kind=' + kind).then(function (d) {
      cache = { accounts: d.accounts || [], logs: d.logs || [], students: d.students || [],
                reports: d.reports || [], requests: d.requests || [], stats: d.stats || { logs: 0, fails: 0 } };
      if (session) session = cache.accounts.filter(function (a) { return a.id === session.id; })[0] || session;
    }).catch(function () { /* keep showing the last data if the network blinks */ });
  }

  /* ---- start: ask the server who is signed in (cookie), then load their data */
  function init() {
    return api('GET', '/api/session?kind=' + kind).then(function (r) {
      session = r.account;
      return reload();
    });
  }

  function setSession(acc) { session = acc; }

  // fire-and-forget access-log entry for "Viewed record" / "Searched students" (the server de-duplicates rapid repeats)
  function audit(act, rec) { if (session) api('POST', '/api/audit', { act: act, rec: rec }).catch(function () {}); }

  CARE.api = api;
  CARE.kind = kind;
  CARE.db = {
    init: init, reload: reload, setSession: setSession, audit: audit,
    refresh: function () {},                     // kept so old calls still work; data is refreshed with reload()
    session: function () { return session; },
    accounts: function () { return cache.accounts; },
    logs: function () { return cache.logs; },
    students: function () { return cache.students; },
    reports: function () { return cache.reports; },
    requests: function () { return cache.requests; },
    stats: function () { return cache.stats; },
    byId: function (id) { return cache.accounts.filter(function (a) { return a.id === id; })[0]; }
  };

  // keep data fresh when the person comes back to this tab (other devices may have changed things)
  window.addEventListener('focus', function () { reload(); });
})();
