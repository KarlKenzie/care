/* MAIL — Gmail checks in the browser (instant feedback). The e-mail itself is sent by the SERVER,
   so no e-mail keys are ever exposed to visitors. */
window.CARE = window.CARE || {};

(function () {
  // Gmail rule: @gmail.com, 6-30 letters/numbers/dots, no leading/trailing dot, no double dots
  function gmailProblem(v) {
    v = (v || '').trim().toLowerCase();
    var local = v.split('@')[0];
    if (!/^[a-z0-9.]+@gmail\.com$/.test(v)) return 'Enter a valid Gmail address (example: name@gmail.com).';
    if (local.length < 6 || local.length > 30 || local[0] === '.' || local.slice(-1) === '.' || /\.\./.test(local))
      return 'That Gmail address is not valid.';
    return null;
  }

  // Hide part of the address: ka***@gmail.com
  function mask(addr) { var p = (addr || '').split('@'); return p[0].slice(0, 2) + '***@' + (p[1] || ''); }

  // true when the server has e-mail set up (admin site only)
  function configured() {
    return CARE.api('GET', '/api/config').then(function (r) { return !!r.email; }).catch(function () { return false; });
  }

  CARE.mail = { gmailProblem: gmailProblem, mask: mask, configured: configured };
})();
