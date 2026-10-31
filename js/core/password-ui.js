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

  CARE.pwUI = { checklist: checklist, wireLive: wireLive, modal: modal, wireModal: wireModal };
})();
