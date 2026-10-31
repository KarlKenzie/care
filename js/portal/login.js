/* LOGIN — sign in (SQRT / Clinic) ug "Forgot password" */

function loginPanel(){
  var qrt=S.loginRole==='qrt';
  var err = S.loginErr
    ? '<div class="note red" style="margin-bottom:16px">'+icon('alert',18)+
      '<span>'+esc(S.loginErr)+'</span></div>' : '';
  return '<h1 style="font-size:26px;font-weight:600">Sign in</h1>'+
    '<p class="sm muted" style="margin:8px 0 0">Accounts are issued by the University Clinic.</p>'+
    '<div class="tabs"><button id="tq" class="'+(qrt?'on':'')+'">SQRT Responder</button>'+
    '<button id="tc" class="'+(qrt?'':'on')+'">Clinic Staff</button></div>'+err+
    '<div class="fld"><label class="f" for="u">Username</label>'+
      '<input class="in" id="u" placeholder="Enter your username" autocomplete="username" value="'+esc(S.loginUser)+'"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label class="f" for="p">Password</label>'+
      '<input class="in" id="p" type="password" placeholder="Enter your password"></div>'+
    '<div style="text-align:right;margin-bottom:18px">'+
      '<a id="forgot" style="font-size:13px;font-weight:600;cursor:pointer">Forgot password?</a></div>'+
    '<button class="btn lg" id="signin">Sign in as '+(qrt?'SQRT Responder':'Clinic Staff')+'</button>'+
    '<div class="note info" style="margin-top:20px">'+icon('lock',17)+
    '<span><b>Authorized personnel only</b>All access is recorded.</span></div>';
}

function resetPanel(){
  if(S.reset.step==='ask'){
    return '<h1 style="font-size:26px;font-weight:600">Forgot password</h1>'+
      '<p class="sm muted" style="margin:8px 0 18px">Enter your account ID and the Gmail registered to your account. '+
      'The administrator will review your request and email you a new password.</p>'+
      '<div class="fld"><label class="f" for="rId">Account ID</label>'+
        '<input class="in mono" id="rId" placeholder="e.g. SQRT-001" autocomplete="off"></div>'+
      '<div class="fld"><label class="f" for="rMail">Gmail</label>'+
        '<input class="in" id="rMail" type="email" placeholder="name@gmail.com" autocomplete="email"></div>'+
      '<div id="rErr2" style="margin-top:6px"></div>'+
      '<button class="btn lg" id="sendreq" style="margin-top:14px">Send request</button>'+
      '<div style="text-align:center;margin-top:14px">'+
        '<a id="cancelreset" style="font-size:13px;font-weight:600;cursor:pointer">Cancel</a></div>';
  }
  return '<div style="text-align:center;padding:10px 0 4px">'+
    '<div style="width:56px;height:56px;border-radius:16px;background:var(--grnb);display:flex;'+
      'align-items:center;justify-content:center;margin:0 auto">'+icon('check',26,'var(--grn)')+'</div>'+
    '<h1 style="font-size:24px;font-weight:600;margin-top:16px">Request sent.</h1>'+
    '<p class="sm muted" style="margin:8px 0 22px">The administrator will review it. Your new password will be emailed to your Gmail.</p>'+
    '<button class="btn lg" id="backtologin">Back to sign in</button></div>';
}

function viewLogin(){
  return '<div class="login"><div class="l">'+
    '<div class="brand"><div><div class="w" style="font-size:26px">CARE</div>'+
    '<div class="s">Campus Assistance &amp; Response Environment</div>'+
    '<div class="c">CTU – Consolacion Campus</div></div></div>'+
    '<div style="flex-grow:1"></div>'+
    '<h2>Student medical information for <em>emergency response.</em></h2>'+
    '<p style="margin-top:18px">Connecting responders with essential student medical information '+
    'when it matters most.</p><div style="flex-grow:1"></div>'+
    '</div><div class="r"><div class="box">'+
    (S.reset ? resetPanel() : loginPanel())+
    '</div></div></div>';
}
