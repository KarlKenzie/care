/* AUTH — sign in / sign out / password. The server checks passwords and hashes them (PBKDF2).
   The browser never sees a password hash. The session is an HttpOnly cookie, so it works on any device/browser/Incognito. */
window.CARE = window.CARE || {};

(function () {
  // Password rule (also enforced on the server): 6+ characters, a letter, and a number.
  function pwProblems(v) {
    var out = [];
    if (v.length < 6) out.push('at least 6 characters');
    if (!/\p{L}/u.test(v)) out.push('a letter');
    if (!/[0-9]/.test(v)) out.push('a number');
    return out;
  }

  // Sign in — resolves { ok, account, error }
  function signIn(username, password, role) {
    if (!username) return Promise.resolve({ ok: false, error: 'Enter your username.' });
    if (!password) return Promise.resolve({ ok: false, error: 'Enter your password.' });
    return CARE.api('POST', '/api/login', { username: username, password: password, role: role }).then(function (r) {
      CARE.db.setSession(r.account); CARE.succeeded();
      return CARE.db.reload().then(function () { return { ok: true, account: r.account }; });
    }).catch(function (e) { return { ok: false, error: e.message }; });
  }

  // The signed-in user (or null)
  function current() { return CARE.db.session(); }

  function signOut() {
    CARE.db.setSession(null);
    return CARE.api('POST', '/api/logout', { kind: CARE.kind }).catch(function () {});
  }

  // Change password from Profile. Resolves null on success or an error text. One in-flight call only.
  function changePassword(acc, cur, next) {
    return CARE.once('change-password', null, function () {
      return CARE.api('POST', '/api/password', { kind: CARE.kind, current: cur, next: next }, { key: CARE.key('change-password') })
        .then(function () { CARE.keyDone('change-password'); return null; });
    }).then(function (r) { return r === undefined ? 'Please wait…' : r; }, function (e) { return e.message; });
  }

  // Random 8-character password (letters + numbers). Only a suggestion for the admin; the server hashes the saved one.
  function generatePassword() {
    var L = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', D = '23456789';
    function rnd(n) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
    function pick(set) { return set[rnd(set.length)]; }
    var out = [pick(L), pick(D)];
    while (out.length < 8) out.push(pick(L + D));
    for (var i = out.length - 1; i > 0; i--) { var j = rnd(i + 1), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out.join('');
  }

  // "Forgot password": resolves null on success or an error text
  function requestReset(idno, email) {
    idno = (idno || '').trim(); email = (email || '').trim();
    if (!idno || !email) return Promise.resolve('Enter your account ID and Gmail.');
    return CARE.api('POST', '/api/reset-request', { idno: idno, email: email }, { key: CARE.key('reset-request') })
      .then(function () { CARE.keyDone('reset-request'); return null; })
      .catch(function (e) { return e.message; });
  }

  CARE.auth = { generatePassword: generatePassword, requestReset: requestReset, signIn: signIn, signOut: signOut,
                current: current, pwProblems: pwProblems, changePassword: changePassword };
})();
