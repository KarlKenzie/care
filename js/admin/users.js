/* USERS — User accounts: lista, detalye, add/edit, deactivate/reactivate (ang admin ra ang makahimo) */
(function () {
  var S = CARE.admin.S, icon = CARE.icon, esc = CARE.esc, kv = CARE.kv, val = CARE.val, roleTag = CARE.roleTag;
  var shell = CARE.admin.shell;
  function go(v, o) { CARE.admin.go(v, o); }
  function U() { return CARE.db.accounts(); }     // tanang accounts
  function LG() { return CARE.db.logs(); }        // tanang access logs
  function full(u) { return u.first + ' ' + u.last; }
  function initials(u) { return (u.first[0] + u.last[0]).toUpperCase(); }

  /* ----- password generator ug ID */
  function newPassword() { return CARE.auth.generatePassword(); }
    S.newpw = newPassword();   // password nga gi-generate para sa bag-ong account

    // Sunod nga Account ID, pananglitan U-002
    function nextUid() {
      var n = 0; U().forEach(function (u) { var v = parseInt(u.id.slice(2), 10); if (v > n) n = v; });
      return 'U-' + String(n + 1).padStart(3, '0');
    }
    // Sunod nga ID number base sa role, pananglitan SQRT-001, CLN-001, ADM-002
    function nextIdno(role) {
      var p = { SQRT: 'SQRT', CLINIC: 'CLN', ADMIN: 'ADM' }[role];
      var n = 0;
      U().forEach(function (u) {
        if (u.role !== role || !u.idno) return;
        var v = parseInt(u.idno.split('-')[1], 10); if (v > n) n = v;
      });
      return p + '-' + String(n + 1).padStart(3, '0');
    }

  /* ----- mga screen */
  function userFiltered(){
    var q=S.q.trim().toLowerCase();
    return U().filter(function(u){
      if(q && (full(u)+' '+u.last+' '+u.user+' '+u.dept+' '+(u.idno||'')+' '+u.id).toLowerCase().indexOf(q)===-1) return false;
      if(S.role!=='All roles' && u.role!==S.role) return false;
      if(S.status!=='All statuses' && u.status!==S.status) return false;
      return true;
    }).sort(function(a,b){ return a.last.localeCompare(b.last); });
  }
  function userRows(){
    var list=userFiltered();
    if(!list.length) return '<div class="empty"><h3>No accounts found.</h3>'+
      '<p>Try a different search, or clear the filters.</p></div>';
    return '<p class="sm muted" style="margin:0 0 10px">Showing '+list.length+' of '+U().length+' accounts</p>'+
      '<div class="tw"><table><thead><tr><th>Name</th><th>Department ID</th><th>Universal ID</th><th>Username</th><th>Role</th><th>Department</th>'+
      '<th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>'+
      list.map(function(u){
        return '<tr><td><div style="display:flex;align-items:center;gap:10px">'+
          '<span class="av" style="width:32px;height:32px;background:var(--navy)">'+initials(u)+'</span>'+
          '<b>'+esc(u.last)+', '+esc(u.first)+'</b></div></td>'+
          '<td class="mono sm">'+esc(u.idno||'—')+'</td><td class="mono sm">'+esc(u.id)+'</td>'+
          '<td class="mono sm">'+esc(u.user)+'</td><td>'+roleTag(u.role)+'</td>'+
          '<td class="sm">'+esc(u.dept)+'</td>'+
          '<td><span class="bdg '+(u.status==='Active'?'ok':'off')+'">'+esc(u.status)+'</span></td>'+
          '<td class="sm muted mono">'+esc(u.last_in)+'</td>'+
          '<td style="text-align:right"><div style="display:flex;gap:8px;justify-content:flex-end">'+
            '<button class="btn out sm" data-open="'+u.id+'">Open</button>'+
            '<button class="btn sec sm" data-edit="'+u.id+'">Edit</button>'+
            (u.id===S.me.id ? '' : '<button class="btn out sm" data-del="'+u.id+'">Delete</button>')+
            '</div></td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  function viewUsers(){
    function opts(a,c){ return a.map(function(o){return '<option'+(o===c?' selected':'')+'>'+o+'</option>';}).join(''); }
    return shell('User accounts','SQRT, Clinic and Administrator',
      '<div class="card"><div class="filters">'+
        '<div class="wide"><label class="f" for="q">Search by name, username, department or ID</label>'+
          '<input class="in" id="q" type="search" placeholder="e.g. Fernandez or clinic." value="'+esc(S.q)+'"></div>'+
        '<div><label class="f" for="fr">Role</label><select class="in" id="fr">'+
          opts(['All roles','SQRT','CLINIC','ADMIN'],S.role)+'</select></div>'+
        '<div><label class="f" for="fs">Status</label><select class="in" id="fs">'+
          opts(['All statuses','Active','Inactive'],S.status)+'</select></div>'+
        '<div><button class="btn" data-go="add" style="width:100%">'+icon('plus',17,'#fff')+'Add account</button></div>'+
      '</div></div><div id="rows">'+userRows()+'</div>'+
      '<div class="note info">'+icon('lock',18)+'<span>Account details only. Medical information is not shown '+
        'here.</span></div>');
  }

  function userForm(u){
    var e=u||{};
    function opts(a,c){ return a.map(function(o){return '<option'+(o===c?' selected':'')+'>'+o+'</option>';}).join(''); }
    return '<div class="card"><div class="ct"><div><h2>'+(u?'Edit account':'New account')+'</h2>'+
      '<p>The role sets what this person can reach.</p></div></div>'+
      '<div class="grid g2">'+
        '<div class="fld"><label class="f" for="eFirst">First name</label>'+
          '<input class="in" id="eFirst" value="'+esc(e.first||'')+'"></div>'+
        '<div class="fld"><label class="f" for="eLast">Last name</label>'+
          '<input class="in" id="eLast" value="'+esc(e.last||'')+'"></div>'+
      '</div>'+
      '<div class="grid g2">'+
        '<div class="fld"><label class="f" for="eUser">Username</label>'+
          '<input class="in mono" id="eUser" value="'+esc(e.user||'')+'" placeholder="sqrt.surname">'+
          '<div class="hint">Prefix with the role: sqrt. clinic. admin.</div></div>'+
        '<div class="fld"><label class="f" for="eRole">Role</label>'+
          '<select class="in" id="eRole">'+opts(['SQRT','CLINIC','ADMIN'],e.role||'SQRT')+'</select></div>'+
      '</div>'+
      '<div class="grid g2">'+
        '<div class="fld"><label class="f" for="eEmail">Gmail</label>'+
          '<input class="in" id="eEmail" value="'+esc(e.email||'')+'" placeholder="name@gmail.com"></div>'+
        (u ? '<div class="fld"><label class="f">Password</label>'+
               '<div style="display:flex;gap:8px">'+
               '<input class="in mono" id="ePass" readonly value="Unchanged">'+
               '<button class="btn out" id="genpw" style="width:auto;flex:0 0 auto">Generate new</button></div>'+
             '<div class="hint" id="gpHint">Keep as is, or generate a new password for this user.</div></div>'
           : '<div class="fld"><label class="f" for="ePass">Password</label>'+
             '<div style="display:flex;gap:8px">'+
               '<input class="in mono" id="ePass" readonly value="'+esc(S.newpw)+'" '+
                 'style="letter-spacing:.1em;font-weight:600;background:var(--goldb);border-color:var(--ambl)">'+
               '<button class="btn out" id="regen" style="width:auto;flex:0 0 auto">New</button></div>'+
             '<div class="hint">Generated. Give this to the user at first sign-in.</div></div>')+
      '</div>'+
      '<div class="grid g2">'+
        '<div class="fld"><label class="f" for="eDept">Department</label>'+
          '<select class="in" id="eDept">'+
          opts(['Campus Safety Office','University Clinic','MIS Office'],e.dept||'Campus Safety Office')+
          '</select></div>'+
        '<div class="fld"><label class="f" for="eStat">Account status</label>'+
          '<select class="in" id="eStat">'+opts(['Active','Inactive'],e.status||'Active')+'</select></div>'+
      '</div>'+
      '<div class="note warn" style="margin-top:2px">'+icon('alert',18)+'<span><b>Changing the role changes '+
        'what this person can do.</b>SQRT reads records and files reports. Clinic maintains records and writes '+
        'assessments.</span></div>'+
      '<div id="eErr"></div></div>';
  }

  function viewUser(){
    var u=CARE.db.byId(S.uid);
    if(!u) return shell('Account','','<div class="empty"><h3>Account not found.</h3></div>');
    if(S.editing) return shell('Edit account',full(u)+' · '+u.user,
      userForm(u)+'<div class="row"><button class="btn" id="save">'+icon('check',17,'#fff')+'Save changes</button>'+
      '<button class="btn out" data-open="'+u.id+'">Cancel</button></div>');
    var mine=LG().filter(function(l){ return l.who===u.name; }).slice(0,6);
    var act=mine.length? mine.map(function(l){
        return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line2)">'+
          '<div style="flex-grow:1;min-width:0"><div style="font-weight:600">'+esc(l.act)+'</div>'+
          '<div class="sm muted">'+esc(l.rec)+'</div></div>'+
          (l.ok?'<span class="bdg ok">Success</span>':'<span class="bdg red">Failed</span>')+
          '<span class="sm muted mono" style="white-space:nowrap">'+esc(l.when)+'</span></div>';
      }).join('') : '<p class="muted sm">No entries yet.</p>';
    return shell(full(u),u.role==='SQRT'?'SQRT responder':(u.role==='CLINIC'?'Clinic staff':'Administrator'),
      '<div class="card">'+
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">'+
          '<span class="av" style="width:54px;height:54px;border-radius:14px;font-size:19px">'+initials(u)+'</span>'+
          '<div><h2 style="font-size:21px;font-weight:600">'+esc(full(u))+'</h2>'+
          '<div class="row" style="gap:8px;margin-top:6px">'+roleTag(u.role)+
          '<span class="bdg '+(u.status==='Active'?'ok':'off')+'">'+esc(u.status)+'</span></div></div></div>'+
        '<div style="height:1px;background:var(--line2);margin:16px 0"></div>'+
        '<div class="grid g3">'+kv('Username',u.user,true)+kv('Email',u.email||'—')+kv('Department',u.dept)+
          kv('Department ID',u.idno||'—',true)+kv('Universal ID',u.id,true)+kv('Last sign-in',u.last_in,true)+
          kv('Created',u.made,true)+kv('Status',u.status)+'</div>'+
        '<div class="row" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line2)">'+
          '<button class="btn" data-edit="'+u.id+'">'+icon('edit',17,'#fff')+'Edit account</button>'+
          (u.id===S.me.id ? '' : u.status==='Active'
            ? '<button class="btn out" data-deact="'+u.id+'">'+icon('x',17)+'Deactivate</button>'
            : '<button class="btn ok" data-react="'+u.id+'">'+icon('check',17,'#fff')+'Reactivate</button>')+
          (u.id===S.me.id ? '' : '<button class="btn dan" data-del="'+u.id+'">'+icon('x',17,'#fff')+'Delete</button>')+
          '<button class="btn out" data-go="users">'+icon('back',17)+'Back to accounts</button></div></div>'+
      '<div class="card"><div class="ct"><div><h2>Account activity</h2>'+
        '<p>Newest first</p></div>'+
        '<button class="btn out sm" data-go="logs">Open full log</button></div>'+act+'</div>');
  }

  function viewAdd(){
    return shell('Add account','New sign-in',
      userForm(null)+'<div class="row"><button class="btn" id="create">'+icon('check',17,'#fff')+
      'Create account</button><button class="btn out" data-go="users">Cancel</button></div>');
  }

  function confirmModal(){
    var c=S.confirm, u=CARE.db.byId(c.uid);
    var red=c.kind!=='react', del=c.kind==='del';
    return '<div class="scrim"><div class="modal">'+
      '<span style="width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;'+
        'background:'+(red?'var(--redb)':'#E6F3EC')+'">'+
        icon(red?'alert':'check',22,'var(--'+(red?'red':'ok')+')')+'</span>'+
      '<h2>'+(del?'Delete this account permanently?':(c.kind==='deact'?'Deactivate this account?':'Reactivate this account?'))+'</h2>'+
      '<p class="muted" style="margin:10px 0 0">'+
        (del
          ? esc(full(u))+' will be removed for good, along with any of their password requests. This cannot be undone. Log entries are kept.'
          : c.kind==='deact'
          ? esc(full(u))+' will be signed out and cannot sign in again until reactivated. Log entries are kept.'
          : esc(full(u))+' will be able to sign in again as '+u.role+'.')+'</p>'+
      '<div class="card" style="margin-top:16px;box-shadow:none;background:var(--bg);padding:14px">'+
        '<div class="row" style="gap:20px">'+kv('Username',u.user,true)+kv('Role',u.role)+
        kv('Current status',u.status)+'</div></div>'+
      '<div class="row" style="justify-content:flex-end;margin-top:20px">'+
        '<button class="btn out" id="cNo">Cancel</button>'+
        '<button class="btn '+(red?'dan':'ok')+'" id="cYes">'+
        (del?'Delete account':(c.kind==='deact'?'Deactivate account':'Reactivate account'))+'</button></div></div></div>';
  }

  /* ----- mga button ug filter (gi-wire human ma-render ang screen) */
  function wireUsers() {
    document.querySelectorAll('[data-open]').forEach(function(el){
      el.onclick=function(){ go('user',{uid:el.getAttribute('data-open')}); }; });
    document.querySelectorAll('[data-edit]').forEach(function(el){
      el.onclick=function(){ go('user',{uid:el.getAttribute('data-edit'),editing:true}); }; });
    document.querySelectorAll('[data-deact]').forEach(function(el){
      el.onclick=function(){ go('user',{uid:el.getAttribute('data-deact'),
        confirm:{kind:'deact',uid:el.getAttribute('data-deact')}}); }; });
    document.querySelectorAll('[data-del]').forEach(function(el){
      el.onclick=function(){ go('user',{uid:el.getAttribute('data-del'),
        confirm:{kind:'del',uid:el.getAttribute('data-del')}}); }; });
    document.querySelectorAll('[data-react]').forEach(function(el){
      el.onclick=function(){ go('user',{uid:el.getAttribute('data-react'),
        confirm:{kind:'react',uid:el.getAttribute('data-react')}}); }; });

    var cn=document.getElementById('cNo');
    if(cn) cn.onclick=function(){ go('user',{uid:S.confirm.uid}); };
    var cy=document.getElementById('cYes');
    if(cy) cy.onclick=function(){
      var u=CARE.db.byId(S.confirm.uid), kind=S.confirm.kind, nm=full(u), lock='acct-'+kind+'-'+u.id;
      if(kind==='del' && u.id===S.me.id) return;   // an admin cannot delete their own account
      // one click = one action, however many times the button is pressed
      CARE.once(lock, cy, function(){
        var req = kind==='del'
          ? CARE.api('DELETE','/api/admin/accounts/'+u.id, undefined, {key:CARE.key(lock)})
          : CARE.api('POST','/api/admin/accounts/'+u.id+'/status', {status:kind==='deact'?'Inactive':'Active'}, {key:CARE.key(lock)});
        return req.then(function(r){
          CARE.keyDone(lock);
          return CARE.db.reload().then(function(){
            if(kind==='del') go('users',{uid:null, flash:nm+"'s account was deleted."});
            else go('user',{uid:u.id, flash:nm+"'s account is now "+r.account.status.toLowerCase()+'.'});
          });
        }).catch(function(e){ S.confirm=null; go('user',{uid:u.id, flash:null}); alert(e.message); });
      });
    };

    /* account filters */
    var q=document.getElementById('q');
    if(q) q.oninput=function(){ S.q=q.value; document.getElementById('rows').innerHTML=userRows(); CARE.admin.wire(); };
    ['fr','fs'].forEach(function(id){
      var e=document.getElementById(id);
      if(e) e.onchange=function(){ if(id==='fr')S.role=e.value; else S.status=e.value;
        document.getElementById('rows').innerHTML=userRows(); CARE.admin.wire(); };
    });


    /* save + create */
    function readForm(){
      return {first:val('eFirst'), last:val('eLast'), user:val('eUser'),
              role:val('eRole'), dept:val('eDept'), status:val('eStat'),
              email:val('eEmail').toLowerCase()};
    }
    function missing(f){
      var m=[]; if(!f.first)m.push('First name'); if(!f.last)m.push('Last name');
      if(!f.user)m.push('Username'); if(!f.email)m.push('Gmail'); return m;
    }
    function bad(t){ document.getElementById('eErr').innerHTML='<div class="note red" style="margin-top:4px">'+
      icon('alert',18)+'<span><b>'+esc(t)+'</b></span></div>'; }
    function emailTaken(mail,id){ return U().some(function(x){ return x.id!==id && (x.email||'').toLowerCase()===mail; }); }

    // Generate a new password for the user (it is e-mailed to their Gmail when you save)
    var gp=document.getElementById('genpw');
    if(gp) gp.onclick=function(){
      var p=newPassword(), e=document.getElementById('ePass');
      e.value=p; e.setAttribute('data-new',p);
      e.style.cssText='letter-spacing:.1em;font-weight:600;background:var(--goldb);border-color:var(--ambl)';
      document.getElementById('gpHint').textContent="The new password will be emailed to the user's Gmail when you save.";
    };

    var sv=document.getElementById('save');
    if(sv) sv.onclick=function(){
      var u=CARE.db.byId(S.uid), f=readForm(), m=missing(f);
      if(m.length){ document.getElementById('eErr').innerHTML='<div class="note red" style="margin-top:4px">'+
        icon('alert',18)+'<span><b>Missing:</b> '+m.join(', ')+'</span></div>';
        return; }
      if(f.email!==(u.email||'').toLowerCase()){
        var gpb=CARE.mail.gmailProblem(f.email);
        if(gpb){ bad(gpb); return; }
      }
      var np=document.getElementById('ePass').getAttribute('data-new')||'';
      var lock='acct-edit-'+u.id;
      // Same new password = same attempt (retries cannot e-mail twice). A freshly generated password is a new, deliberate send.
      CARE.once(lock, sv, function(){
        var body=f; if(np) body.password=np;
        return CARE.api('PATCH','/api/admin/accounts/'+u.id, body, {key:CARE.key(lock+':'+np)}).then(function(r){
          CARE.keyDone(lock+':'+np);
          return CARE.db.reload().then(function(){
            var a=r.account;
            go('user',{uid:a.id, flash:'Account updated'+(r.was===a.role?'.':' — role changed from '+r.was+' to '+a.role+'.')+
              (r.reset?(r.sent?' New password sent to '+CARE.mail.mask(a.email)+'.':' Email is not set up yet. Give '+a.first+' this password: '+np):'')});
          });
        }).catch(function(e){ bad(e.message); });
      });
    };
    var cr=document.getElementById('create');
    if(cr) cr.onclick=function(){
      var f=readForm(), m=missing(f);
      if(m.length){ document.getElementById('eErr').innerHTML='<div class="note red" style="margin-top:4px">'+
        icon('alert',18)+'<span><b>Missing:</b> '+m.join(', ')+'</span></div>';
        return; }
      var gpc=CARE.mail.gmailProblem(f.email);
      if(gpc){ bad(gpc); return; }
      var pw=val('ePass');
      // ONE click = ONE account: repeated clicks are ignored while saving, and the server also refuses duplicates
      CARE.once('acct-create', cr, function(){
        f.password=pw;
        return CARE.api('POST','/api/admin/accounts', f, {key:CARE.key('acct-create')}).then(function(r){
          CARE.keyDone('acct-create');
          S.newpw=newPassword(); S.q='';
          return CARE.db.reload().then(function(){
            var a=r.account;
            go('user',{uid:a.id, flash:'Account created for '+full(a)+'.'+
              (r.sent?' Login details sent to '+CARE.mail.mask(a.email)+'.':' Email is not set up yet. Give the user this password: '+pw)});
          });
        }).catch(function(e){ bad(e.message); });
      });
    };
  }

  CARE.admin.views.users = viewUsers;
  CARE.admin.views.user = viewUser;
  CARE.admin.views.add = viewAdd;
  CARE.admin.confirmModal = confirmModal;
  CARE.admin.wirers.push(wireUsers);
})();
