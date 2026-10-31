/* ADMIN APP — login, dashboard, profile ug change password sa Administrator */
(function () {
  var icon = CARE.icon, esc = CARE.esc, kv = CARE.kv, val = CARE.val;

  /* ---------------------------------------------------------- state */
  var S = {
    me: null,            // ang admin nga naka-sign in
    view: 'dashboard',   // karon nga screen
    hist: [],            // kasaysayan para sa back button
    dark: localStorage.getItem('care.theme') === 'dark',
    loginErr: null, loginUser: '', reset: null, pwMsg: null, pwModal: false, rq: null, rqpw: '',
    uid: null, editing: false, confirm: null, flash: null, newpw: '',
    q: '', role: 'All roles', status: 'All statuses',
    lq: '', lrole: 'All roles', lact: 'All actions', lres: 'All results'
  };

  var navSeq = 0;      // so a slow screen can never draw on top of a newer one
  var NAV = [['dashboard', 'Dashboard', 'home'], ['users', 'User accounts', 'users'], ['requests', 'Password requests', 'shield'], ['logs', 'Access logs', 'clock']];

  /* ----------------------------------------------------- navigation */
  // Kuhaon ang karon nga screen aron ibutang sa kasaysayan (para sa back button)
  function snap() { return { view: S.view, uid: S.uid, editing: S.editing, confirm: S.confirm }; }
  function same(a, b) {
    return a.view === b.view && a.uid === b.uid && a.editing === b.editing && !a.confirm === !b.confirm;
  }

  // Adtoa ang usa ka screen. o = { uid, editing, confirm, flash }
  function go(v, o) {
    o = o || {};
    var from = snap();
    if (v !== 'profile') S.pwMsg = null;
    S.pwModal = false;
    S.rq = null;
    S.view = v;
    if ('uid' in o) S.uid = o.uid;
    S.editing = !!o.editing; S.confirm = o.confirm || null; S.flash = o.flash || null;
    if (!same(from, snap())) S.hist.push(from);
    if (S.hist.length > 25) S.hist.shift();
    // fetch the newest data from the server (other admins/devices may have changed it), then draw
    var my = ++navSeq;
    CARE.db.reload().then(function () { if (my === navSeq) { render(); CARE.scrollTop(); } });
  }
  function back() {
    var prev = S.hist.pop();
    if (!prev) return;
    S.view = prev.view; S.uid = prev.uid; S.editing = prev.editing; S.confirm = prev.confirm;
    S.flash = null; var my = ++navSeq;
    CARE.db.reload().then(function () { if (my === navSeq) { render(); CARE.scrollTop(); } });
  }

  /* ------------------------------------------------------------ login */
  function loginPanel() {
    var err = S.loginErr
      ? '<div class="note red" style="margin-bottom:16px">' + icon('alert', 18) +
        '<span>' + esc(S.loginErr) + '</span></div>' : '';
    return '<h1 style="font-size:26px;font-weight:600">Administrator sign in</h1>' +
      '<p class="sm muted" style="margin:8px 0 18px">Issued by the MIS Office.</p>' + err +
      '<div class="fld"><label class="f" for="u">Username</label>' +
        '<input class="in" id="u" placeholder="Enter your username" autocomplete="username" ' +
          'value="' + esc(S.loginUser) + '"></div>' +
      '<div class="fld" style="margin-bottom:8px"><label class="f" for="p">Password</label>' +
        '<input class="in" id="p" type="password" placeholder="Enter your password" autocomplete="current-password"></div>' +
      '<div style="margin-bottom:18px"></div>' +
      '<button class="btn lg" id="signin">Sign in</button>' +
      '<div class="note info" style="margin-top:20px">' + icon('lock', 17) +
        '<span><b>Authorized personnel only</b>Administrative actions are logged.</span></div>';
  }

  function viewLogin() {
    return '<div class="login"><div class="l">' +
      '<div class="brand"><div><div class="w" style="font-size:26px">CARE</div>' +
        '<div class="s">Campus Assistance &amp; Response Environment</div>' +
        '<div class="c">CTU – Consolacion Campus</div></div></div>' +
      '<div style="flex-grow:1"></div>' +
      '<h2>System <em>administration.</em></h2>' +
      '<p style="margin-top:18px">Accounts and access records. No medical information.</p>' +
      '<div style="flex-grow:1"></div>' +
      '</div><div class="r"><div class="box">' +
      loginPanel() +
      '</div></div></div>';
  }

  /* ------------------------------------------------------------ shell */
  function shell(title, sub, body, actions) {
    var u = S.me;
    var flash = S.flash ? '<div class="note ok">' + icon('check', 18) + '<span>' + esc(S.flash) + '</span></div>' : '';
    var nav = NAV.map(function (n) {
      var on = S.view === n[0];
      return '<a data-go="' + n[0] + '" class="' + (on ? 'on' : '') + '">' +
        icon(n[2], 18, on ? '#C8A02E' : 'rgba(255,255,255,.72)') + '<span>' + n[1] + '</span></a>';
    }).join('');
    var mnav = NAV.map(function (n) {
      return '<a data-go="' + n[0] + '" class="' + (S.view === n[0] ? 'on' : '') + '">' +
        icon(n[2], 21) + '<span>' + n[1].split(' ')[0] + '</span><i></i></a>';
    }).join('') + '<a data-go="logout">' + icon('out', 21) + '<span>Sign out</span><i></i></a>';

    return '<div class="shell"><aside class="side">' +
      '<div class="brand"><div><div class="w">CARE</div>' +
        '<div class="s">Campus Assistance &amp; Response Environment</div>' +
        '<div class="c">CTU – Consolacion Campus</div></div></div>' +
      '<span class="chip">' + icon('lock', 14) + 'ADMINISTRATOR</span>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<div class="foot"></div><div class="tswitch" id="themeswitch"><span>' +
        (S.dark ? 'Dark mode' : 'Light mode') + '</span><span class="tr"><i></i></span></div>' +
      '<div class="who whoclick" data-go="profile"><span class="av">' + initials() + '</span>' +
        '<div><div class="n">' + esc(u.name) + '</div>' +
        '<div class="r">Administrator · ' + esc(u.idno) + '</div></div>' +
        icon('chev', 16, 'rgba(255,255,255,.45)') + '</div>' +
      '<div class="sout" data-go="logout">' + icon('out', 18, 'rgba(255,255,255,.66)') +
        '<span>Sign Out</span></div></aside>' +
      '<div class="main"><header class="top">' +
        '<div style="display:flex;align-items:center;gap:12px;min-width:0">' +
        (S.hist.length ? '<button class="iback" id="back" aria-label="Go back">' + icon('back', 19) + '</button>' : '') +
        '<div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div></div>' +
        '<div class="row">' + (actions || '') + '</div></header>' +
      '<div class="body">' + flash + body + '</div></div>' +
      '<nav class="mnav">' + mnav + '</nav>' + (S.confirm ? CARE.admin.confirmModal() : '') +
      (S.pwModal ? CARE.pwUI.modal() : '') +
      (S.rq ? CARE.admin.requestModal() : '') + '</div>';
  }

  /* -------------------------------------------------------- dashboard */
  function stat(l, v, m, c) {
    return '<div class="card stat"><div class="l">' + esc(l) + '</div>' +
      '<div class="v" style="color:' + (c || 'var(--ink)') + '">' + esc(v) + '</div>' +
      '<div class="m">' + esc(m) + '</div></div>';
  }

  function viewDashboard() {
    var users = CARE.db.accounts(), logs = CARE.db.logs(), st = CARE.db.stats();
    var active = users.filter(function (u) { return u.status === 'Active'; }).length;
    var qrt = users.filter(function (u) { return u.role === 'SQRT'; }).length;
    var cli = users.filter(function (u) { return u.role === 'CLINIC'; }).length;
    var fails = st.fails;

    var recent = logs.slice(0, 6).map(function (l) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line2)">' +
        '<div style="flex-grow:1;min-width:0"><div style="font-weight:600">' + esc(l.act) + '</div>' +
        '<div class="sm muted">' + esc(l.who) + ' · ' + esc(l.rec) + '</div></div>' +
        CARE.roleTag(l.role) + '<span class="sm muted mono" style="white-space:nowrap">' +
        esc(l.when.split(', ')[1]) + '</span></div>';
    }).join('');

    return shell('CARE Administration', 'CTU – Consolacion Campus',
      '<div class="grid g4">' +
        stat('User accounts', String(users.length), active + ' active') +
        stat('SQRT responders', String(qrt), 'Emergency response') +
        stat('Clinic staff', String(cli), 'Record maintenance') +
        stat('Access log entries', String(st.logs), 'All roles', 'var(--prim)') +
      '</div>' +
      (CARE.db.requests().filter(function (r) { return r.status === 'Pending'; }).length
        ? '<div class="note warn">' + icon('lock', 18) + '<span><b>' +
          CARE.db.requests().filter(function (r) { return r.status === 'Pending'; }).length +
          ' password request(s) waiting</b></span><button class="btn sm right" data-go="requests">Review</button></div>' : '') +
      (fails
        ? '<div class="note warn">' + icon('alert', 18) + '<span><b>' + fails + ' failed sign-in attempt' +
          (fails > 1 ? 's' : '') + ' in the log</b></span>' +
          '<button class="btn out sm right" data-go="logs">Open access logs</button></div>'
        : '<div class="note ok">' + icon('check', 18) + '<span><b>No failed sign-in attempts.</b></span></div>') +
      '<div class="grid g2">' +
        '<div class="card"><div class="ct"><div><h2>User accounts</h2>' +
          '<p>Who can sign in, and as what</p></div></div>' +
          '<div class="row"><button class="btn" data-go="users">' + icon('users', 17, '#fff') + 'Manage accounts</button>' +
          '<button class="btn out" data-go="add">' + icon('plus', 17) + 'Add account</button></div></div>' +
        '<div class="card"><div class="ct"><div><h2>Access log</h2>' +
          '<p>Record views, updates and sign-ins</p></div></div>' +
          '<div class="row"><button class="btn sec" data-go="logs">' + icon('clock', 17) + 'Open access logs</button>' +
          '</div></div>' +
      '</div>' +
      '<div class="card"><div class="ct"><div><h2>Recent activity</h2><p>Newest first</p></div>' +
        '<button class="btn out sm" data-go="logs">View all</button></div>' +
        (recent || '<p class="muted sm">No activity yet.</p>') + '</div>' +
      '<div class="note info">' + icon('lock', 18) + '<span><b>Administrators cannot</b> open a student medical ' +
        'record, edit it, or assess a rescue report.</span></div>');
  }

  /* ---------------------------------------------------------- profile */
  function viewProfile() {
    var u = S.me;
    var msg = S.pwMsg
      ? '<div class="note ' + (S.pwMsg.ok ? 'ok' : 'red') + '" style="margin-bottom:14px">' +
        icon(S.pwMsg.ok ? 'check' : 'alert', 18) + '<span>' + esc(S.pwMsg.text) + '</span></div>' : '';

    var details = '<div class="card">' +
      '<div style="display:flex;align-items:center;gap:15px">' +
        '<span class="av" style="width:56px;height:56px;border-radius:15px;font-size:19px">' + initials() + '</span>' +
        '<div><h2 style="font-size:21px;font-weight:600">' + esc(u.name) + '</h2>' +
        '<p class="sm muted" style="margin:4px 0 0">Administrator</p></div></div>' +
      '<div style="height:1px;background:var(--line2);margin:18px 0"></div>' +
      '<div class="grid g3">' +
        kv('Username', u.user, true) + kv('ID number', u.idno, true) + kv('Role', 'Administrator') +
        kv('Department', u.dept) + kv('Email', u.email) + kv('Account status', u.status) +
      '</div>' +
      '<div class="note info" style="margin-top:18px">' + icon('lock', 18) +
        '<span>Your details are maintained by the MIS Office. You can change your password here.</span></div></div>';

    // Ang button nga mo-open sa pop-up
    var password = '<div class="card"><div class="ct"><div><h2>Password</h2>' +
      '<p>Choose your own password</p></div>' +
      '<button class="btn" id="pwopen">' + icon('lock', 17, '#fff') + 'Change password</button></div></div>';

    return shell('Profile', u.name, msg + details + password);
  }

  // Initials sa avatar: unang letra sa first name + last name
  function initials() { return (S.me.first[0] + S.me.last[0]).toUpperCase(); }

  /* ----------------------------------------------------------- render */
  function render() {
    if (S.me) S.me = CARE.db.byId(S.me.id);          // newest copy of my account (from the server cache)
    var html;
    if (!S.me) html = viewLogin();
    else if (S.view === 'profile') html = viewProfile();
    else if (CARE.admin.views[S.view]) html = CARE.admin.views[S.view]();
    else html = viewDashboard();

    if (S.dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    // Ipabilin ang scroll sa content kung mag-render pag-usab sa parehas nga screen
    var oldMain = document.querySelector('.main'), keep = oldMain ? oldMain.scrollTop : 0;
    document.getElementById('app').innerHTML = html;
    var newMain = document.querySelector('.main');
    if (newMain) newMain.scrollTop = keep;
    wire();
  }

  /* ------------------------------------------------------------- wire */
  // Ikonekta ang tanang button/link human ma-render ang screen
  function wire() {
    var $ = function (id) { return document.getElementById(id); };

    // --- Sign in (one click = one sign-in, even if the button is clicked many times)
    if ($('signin')) $('signin').onclick = function () {
      S.loginUser = val('u');          // keep what was typed in case the password is wrong
      var pass = $('p').value;
      CARE.once('signin', $('signin'), function () {
        return CARE.auth.signIn(S.loginUser, pass, 'ADMIN');
      }).then(function (r) {
        if (!r) return;
        if (!r.ok) { S.loginErr = r.error; render(); return; }
        S.loginErr = null; S.reset = null; S.hist = []; S.me = r.account; go('dashboard');
      });
    };
    ['u', 'p'].forEach(function (id) {
      if ($(id)) $(id).onkeydown = function (e) { if (e.key === 'Enter') $('signin').click(); };
    });

    // --- Navigation (sidebar, profile, sign out)
    document.querySelectorAll('[data-go]').forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        var t = el.getAttribute('data-go');
        if (t === 'logout') {
          CARE.auth.signOut(); S.me = null; S.view = 'dashboard'; S.hist = [];
          S.reset = null; S.loginErr = null; render(); return;
        }
        go(t);
      };
    });
    if ($('back')) $('back').onclick = back;

    // --- Dark / light mode
    if ($('themeswitch')) $('themeswitch').onclick = function () {
      S.dark = !S.dark;
      localStorage.setItem('care.theme', S.dark ? 'dark' : 'light');
      render();
    };

    // --- Mga screen nga gikan sa ubang file (users.js, logs.js)
    CARE.admin.wirers.forEach(function (fn) { fn(); });

    // --- Ngalan: letra ra ang madawat
    CARE.guard.names(['eFirst', 'eLast']);

    // --- Password checklist ug Change password
    CARE.pwUI.wireLive('np1', 'np2');
    CARE.pwUI.wireLive('pw1', 'pw2');
    // --- Change password: button -> pop-up
    if ($('pwopen')) $('pwopen').onclick = function () { S.pwModal = true; S.pwMsg = null; render(); };
    CARE.pwUI.wireModal(
      function () { return S.me; },
      function (text) { S.pwModal = false; S.pwMsg = { ok: true, text: text }; render(); },
      function () { S.pwModal = false; render(); });
  }

  // If the server says the session ended (expired, deactivated, signed out elsewhere) go back to the sign-in screen
  CARE.onSignedOut = function () { S.me = null; S.view = 'dashboard'; S.hist = []; S.loginErr = 'Your session has ended. Please sign in again.'; render(); };

  // Ipagamit sa ubang file (users.js, logs.js, main.js)
  CARE.admin = { S: S, go: go, shell: shell, render: render, wire: wire, views: {}, wirers: [], confirmModal: null };
})();
