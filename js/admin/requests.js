/* REQUESTS — Password requests: makita dinhi ang "Forgot password" gikan sa SQRT/Clinic, ug ang admin ang mo-reset */
(function () {
  var S = CARE.admin.S, icon = CARE.icon, esc = CARE.esc, val = CARE.val, shell = CARE.admin.shell;
  function RQ() { return CARE.db.requests(); }
  function find() { return RQ().filter(function (r) { return r.id === S.rq; })[0]; }

  /* ----- screen: lista sa requests (pending una) */
  function viewRequests() {
    var list = RQ().slice().sort(function (a, b) {
      return (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1) || b.t - a.t;
    });
    if (!list.length) {
      return shell('Password requests', 'From SQRT and Clinic users',
        '<div class="empty"><h3>No password requests.</h3><p>Requests from the Forgot password page will appear here.</p></div>');
    }
    var rows = list.map(function (r) {
      var cls = r.status === 'Pending' ? 'pend' : (r.status === 'Done' ? 'ok' : 'off');
      return '<tr><td><b>' + esc(r.name) + '</b><div class="sm muted mono">' + esc(r.idno) + '</div></td>' +
        '<td>' + CARE.roleTag(r.role) + '</td><td>' + esc(r.email) + '</td>' +
        '<td class="mono" style="white-space:nowrap">' + esc(r.at) + '</td>' +
        '<td><span class="bdg ' + cls + '">' + r.status + '</span></td>' +
        '<td style="text-align:right">' + (r.status === 'Pending' ? '<button class="btn sm" data-rq="' + r.id + '">Review</button>' : '') + '</td></tr>';
    }).join('');
    return shell('Password requests', 'From SQRT and Clinic users',
      '<div class="tw"><table><thead><tr><th>Person</th><th>Role</th><th>Gmail</th><th>Requested</th><th>Status</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>');
  }

  /* ----- pop-up: usba ang username + bag-ong password, dayon ipadala sa Gmail */
  function requestModal() {
    var r = find(); if (!r) return '';
    var a = CARE.db.byId(r.uid) || {};
    return '<div class="scrim" id="rqscrim"><div class="modal" style="max-width:540px" role="dialog" aria-modal="true">' +
      '<span style="width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--bg)">' +
        icon('lock', 22, 'var(--prim)') + '</span>' +
      '<h2>Reset password</h2>' +
      '<p class="muted" style="margin:10px 0 16px">' + esc(r.name) + ' · ' + esc(r.idno) + '. The new password is emailed to ' +
        esc(CARE.mail.mask(r.email)) + '.</p>' +
      '<div class="fld"><label class="f" for="rqUser">Username</label>' +
        '<input class="in mono" id="rqUser" value="' + esc(a.user || '') + '"></div>' +
      '<div class="fld"><label class="f" for="rqPass">New password</label>' +
        '<div style="display:flex;gap:8px"><input class="in mono" id="rqPass" readonly value="' + esc(S.rqpw) + '" ' +
          'style="letter-spacing:.1em;font-weight:600;background:var(--goldb);border-color:var(--ambl)">' +
        '<button class="btn out" id="rqNew" style="width:auto;flex:0 0 auto">New</button></div></div>' +
      '<div id="rqWarn"></div>' +
      '<div id="rqErr"></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:20px">' +
        '<button class="btn out" id="rqDismiss" style="margin-right:auto">Dismiss request</button>' +
        '<button class="btn out" id="rqCancel">Cancel</button>' +
        '<button class="btn" id="rqSave">' + icon('check', 17, '#fff') + 'Save and send</button></div></div></div>';
  }

  /* ----- mga button */
  function wireRequests() {
    var $ = function (id) { return document.getElementById(id); };
    document.querySelectorAll('[data-rq]').forEach(function (el) {
      el.onclick = function () { S.rq = el.getAttribute('data-rq'); S.rqpw = CARE.auth.generatePassword(); CARE.admin.render(); };
    });
    if (!$('rqscrim')) return;

    function close() { S.rq = null; CARE.admin.render(); }
    function bad(t) { $('rqErr').innerHTML = '<div class="note red">' + icon('alert', 18) + '<span>' + esc(t) + '</span></div>'; }

    // Pahibaw-on ang admin kung wala pa na-set up ang EmailJS (kay dili gyud mo-email)
    CARE.mail.configured().then(function (ok) {
      if (!ok && $('rqWarn')) $('rqWarn').innerHTML = '<div class="note red">' + icon('alert', 18) +
        '<span><b>Email is NOT set up</b> (data/email-config.json is empty), so nothing will be emailed. ' +
        'After you click Save, the password is shown on screen. Copy it and give it to the user yourself.</span></div>';
    });

    $('rqNew').onclick = function () { S.rqpw = CARE.auth.generatePassword(); $('rqPass').value = S.rqpw; };
    $('rqCancel').onclick = close;
    $('rqscrim').onmousedown = function (e) { if (e.target === $('rqscrim')) close(); };

    $('rqDismiss').onclick = function () {
      var r = find(), lock = 'rq-dismiss-' + r.id;
      CARE.once(lock, $('rqDismiss'), function () {
        return CARE.api('POST', '/api/admin/requests/' + r.id + '/dismiss', {}, { key: CARE.key(lock) }).then(function () {
          CARE.keyDone(lock);
          return CARE.db.reload().then(function () { CARE.admin.go('requests', { flash: 'Request dismissed.' }); });
        }).catch(function (e) { bad(e.message); });
      });
    };

    // Save + send: ONE e-mail per attempt. Clicking again (or in another tab) cannot send it twice.
    $('rqSave').onclick = function () {
      var r = find(), user = val('rqUser'), pw = $('rqPass').value, lock = 'rq-reset-' + r.id;
      if (!user) return bad('Enter a username.');
      CARE.once(lock, $('rqSave'), function () {
        return CARE.api('POST', '/api/admin/requests/' + r.id + '/reset', { user: user, password: pw }, { key: CARE.key(lock + ':' + pw) }).then(function (res) {
          CARE.keyDone(lock + ':' + pw);
          return CARE.db.reload().then(function () {
            CARE.admin.go('requests', { flash: res.sent
              ? 'New password sent to ' + CARE.mail.mask(res.email) + '.'
              : 'Saved. Email is not set up yet. Give ' + res.first + ' this password: ' + pw });
          });
        }).catch(function (e) { bad(e.message); });
      });
    };
  }

  CARE.admin.views.requests = viewRequests;
  CARE.admin.requestModal = requestModal;
  CARE.admin.wirers.push(wireRequests);
})();
