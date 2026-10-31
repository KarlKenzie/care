/* PASSWORD UI — checklist sa mga lagda ug ang "Change password" nga pop-up (modal) */
window.CARE = window.CARE || {};

(function () {

  // Lista sa mga lagda (×  = wala pa, ✓ = nahuman na)
  function checklist() {
    var items = [['len', 'At least 6 characters'], ['let', 'A letter'],
                 ['num', 'A number'], ['match', 'Both passwords match']];
    return '<div class="pwlist" id="pwlist">' + items.map(function (it) {
      return '<div id="pwc-' + it[0] + '"><span class="mk">&#215;</span><span>' + it[1] + '</span></div>';
    }).join('') + '</div>';
  }

  // Ikonekta ang checklist sa duha ka input (bag-ong password ug confirm)
  function wireLive(idNew, idConfirm) {
    var a = document.getElementById(idNew), b = document.getElementById(idConfirm);
    if (!a || !b) return;

    function mark(id, ok) {
      var el = document.getElementById('pwc-' + id);
      if (!el) return;
      el.className = ok ? 'ok' : '';
      el.firstChild.innerHTML = ok ? '&#10003;' : '&#215;';
    }
    function check() {
      var v = a.value || '', c = b.value || '';
      mark('len', v.length >= 6);
      mark('let', /\p{L}/u.test(v));
      mark('num', /[0-9]/.test(v));
      mark('match', v.length > 0 && v === c);
    }
    a.oninput = check; b.oninput = check; check();
  }

  // Ang pop-up (modal) sa Change password — makita kung gi-click ang "Change password" nga button
  function modal() {
    return '<div class="scrim" id="pwscrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="pwTitle">' +
      '<span style="width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;' +
        'background:var(--bg)">' + CARE.icon('lock', 22, 'var(--prim)') + '</span>' +
      '<h2 id="pwTitle">Change password</h2>' +
      '<p class="muted" style="margin:10px 0 16px">Choose your own password. Use letters and numbers.</p>' +
      '<div class="fld"><label class="f" for="pw0">Current password</label>' +
        '<input class="in" id="pw0" type="password" placeholder="Enter current password"></div>' +
      '<div class="fld"><label class="f" for="pw1">New password</label>' +
        '<input class="in" id="pw1" type="password" placeholder="At least 6 characters"></div>' +
      '<div class="fld"><label class="f" for="pw2">Confirm new password</label>' +
        '<input class="in" id="pw2" type="password" placeholder="Type it again"></div>' +
      checklist() + '<div id="pwErr" style="margin-top:14px"></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:20px">' +
        '<button class="btn out" id="pwcancel">Cancel</button>' +
        '<button class="btn" id="pwsave">' + CARE.icon('check', 17, '#fff') + 'Save password</button></div>' +
      '</div></div>';
  }

  // Ikonekta ang pop-up: getAcc() = account nga mausab, onDone(text) = human ma-save, onClose() = i-cancel
  function wireModal(getAcc, onDone, onClose) {
    var save = document.getElementById('pwsave');
    document.onkeydown = null;
    if (!save) return;
    var box = document.getElementById('pwErr');

    function bad(t) {
      box.innerHTML = '<div class="note red">' + CARE.icon('alert', 18) + '<span>' + CARE.esc(t) + '</span></div>';
    }
    save.onclick = async function () {
      var cur = document.getElementById('pw0').value;
      var a = document.getElementById('pw1').value, b = document.getElementById('pw2').value;
      var miss = CARE.auth.pwProblems(a);
      if (!cur) return bad('Enter your current password.');
      if (miss.length) return bad('Your password still needs ' + miss.join(' and ') + '.');
      if (a !== b) return bad('The two new passwords do not match.');
      var err = await CARE.auth.changePassword(getAcc(), cur, a);
      if (err) return bad(err);
      onDone('Password changed. Use it the next time you sign in.');
    };
    document.getElementById('pwcancel').onclick = onClose;
    var scrim = document.getElementById('pwscrim');
    scrim.onmousedown = function (e) { if (e.target === scrim) onClose(); };     // click sa gawas = isira
    document.onkeydown = function (e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') save.click();
    };
    wireLive('pw1', 'pw2');
    document.getElementById('pw0').focus();
  }

  /* ---- SHOW / HIDE PASSWORD (eye button) ------------------------------------------------------
     Every <input type="password"> on any screen (sign in, change password, ...) automatically gets an
     eye button on its right. Click it to see what you typed; click again to hide it.
     It also works for screens drawn later, because a MutationObserver watches the page. */
  var EYE_ON  = '<path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.8"/>';
  var EYE_OFF = EYE_ON + '<path d="M4 4l16 16"/>';
  function eyeSvg(off) {
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (off ? EYE_OFF : EYE_ON) + '</svg>';
  }
  function addEye(input) {
    if (input.getAttribute('data-eye') || !input.parentNode) return;
    input.setAttribute('data-eye', '1');
    var hadFocus = document.activeElement === input;
    var wrap = document.createElement('span');
    wrap.className = 'pwwrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pweye';
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('title', 'Show password');
    btn.innerHTML = eyeSvg(false);
    btn.onmousedown = function (e) { e.preventDefault(); };          // keep the cursor in the box
    btn.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = eyeSvg(show);
      var t = show ? 'Hide password' : 'Show password';
      btn.setAttribute('aria-label', t); btn.setAttribute('title', t);
      input.focus();
    };
    wrap.appendChild(btn);
    if (hadFocus) input.focus();
  }
  function scanEyes(root) {
    var list = (root.querySelectorAll ? root : document).querySelectorAll('input[type="password"]:not([data-eye])');
    for (var i = 0; i < list.length; i++) addEye(list[i]);
  }
  function startEyes() {
    scanEyes(document);
    new MutationObserver(function () { scanEyes(document); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startEyes); else startEyes();

  CARE.pwUI = { checklist: checklist, wireLive: wireLive, modal: modal, wireModal: wireModal };
})();
