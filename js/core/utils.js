/* UTILS — gagmay nga helper nga gamiton sa tanang pahina */
window.CARE = window.CARE || {};

(function () {

  // Gi-escape ang text aron dili mosulod ang HTML/script gikan sa user input
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Kuhaon ang value sa input base sa id (naay trim)
  function val(id) {
    var e = document.getElementById(id);
    return e ? e.value.trim() : '';
  }

  // Label + value nga pares (gigamit sa profile)
  function kv(k, v, mono) {
    return '<div class="kv"><div class="k">' + esc(k) + '</div>' +
           '<div class="v' + (mono ? ' mono' : '') + '">' + esc(v) + '</div></div>';
  }

  // Petsa ug oras karon, pananglitan: "30 Oct 2026, 9:05 AM"
  function stamp() {
    var d = new Date();
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var h = d.getHours(), ap = h < 12 ? 'AM' : 'PM';
    h = h % 12 || 12;
    return d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear() + ', ' +
           h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap;
  }

  // Tag sa role (SQRT / CLINIC / ADMIN)
  function roleTag(r) {
    return '<span class="role ' + r.toLowerCase() + '">' + r + '</span>';
  }

  // Balik sa taas: ang page (mobile) ug ang .main nga area (PC)
  function scrollTop() {
    window.scrollTo(0, 0);
    var m = document.querySelector('.main');
    if (m) m.scrollTop = 0;
  }


  /* ---- DUPLICATE-CLICK PROTECTION ------------------------------------------------------------
     CARE.once(name, button, fn): runs fn only if the same action is not already running.
       - repeated clicks while it runs are ignored; the button is disabled and shows "Please wait…"
       - works even if the screen is re-drawn meanwhile (the lock is by action name, not by button)
     CARE.key(name) / CARE.keyDone(name): one Idempotency-Key per attempt. If a request is retried
       (slow network, double submit) the server returns the FIRST result instead of doing it twice. */
  var running = {}, keys = {}, successTick = 0;
  function once(name, btn, fn) {
    if (running[name]) return Promise.resolve(undefined);
    running[name] = true;
    var html = null, tick0 = successTick;
    if (btn) { html = btn.innerHTML; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Please wait…'; }
    function release() {
      running[name] = false;
      if (btn && document.body.contains(btn)) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = html; }
    }
    // After a SUCCESS the screen is about to change, so keep the button locked until it has (or 3 s). After a failure unlock at once.
    function finish(success) {
      if (!success) return release();
      var t0 = Date.now();
      (function wait() {
        var gone = btn ? !document.body.contains(btn) : Date.now() - t0 > 1000;
        if (gone || Date.now() - t0 > 3000) release(); else setTimeout(wait, 80);
      })();
    }
    return Promise.resolve().then(fn).then(function (r) { finish(successTick !== tick0); return r; },
                                           function (e) { finish(false); throw e; });
  }
  function uuid() {
    var a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function key(name) { return keys[name] || (keys[name] = uuid()); }
  function keyDone(name) { delete keys[name]; successTick++; }   // called when an action succeeded
  function succeeded() { successTick++; }

  CARE.once = once; CARE.key = key; CARE.keyDone = keyDone; CARE.succeeded = succeeded;
  CARE.scrollTop = scrollTop; CARE.esc = esc; CARE.val = val; CARE.kv = kv; CARE.stamp = stamp; CARE.roleTag = roleTag;
})();
