/* APP — render (pili og screen) ug wire (ikonekta ang tanang button) */

/* ---------------------------------------------------------------- render */
function render(){
  if(S.me) S.me=CARE.db.byId(S.me.id);
  var v=S.view, html;
  if(!S.role) html=viewLogin();
  else if(v==='profile') html=viewProfile();
  else if(v==='qrt-dashboard') html=qrtDashboard();
  else if(v==='qrt-search') html=qrtSearch();
  else if(v==='qrt-record') html=qrtRecord();
  else if(v==='qrt-report') html=qrtReportForm();
  else if(v==='qrt-report-confirm') html=qrtConfirm();
  else if(v==='qrt-report-detail') html=qrtReportDetail();
  else if(v==='qrt-history') html=qrtHistory();
  else if(v==='clinic-dashboard') html=clinicDashboard();
  else if(v==='clinic-records') html=clinicRecords();
  else if(v==='clinic-record') html=clinicRecord();
  else if(v==='clinic-add') html=clinicAdd();
  else if(v==='clinic-reports') html=clinicReports();
  else if(v==='clinic-review') html=clinicReview();
  else html=viewLogin();
  applyTheme();
  // Ipabilin ang scroll sa content kung mag-render pag-usab sa parehas nga screen
  var oldMain=document.querySelector('.main'), keep=oldMain?oldMain.scrollTop:0;
  document.getElementById('app').innerHTML=html;
  var newMain=document.querySelector('.main');
  if(newMain) newMain.scrollTop=keep;
  wire();
}

function wire(){
  /* login */
  var tq=document.getElementById('tq'), tc=document.getElementById('tc');
  if(tq) tq.onclick=function(){ S.loginUser=val('u'); S.loginRole='qrt'; S.loginErr=null; render(); };
  if(tc) tc.onclick=function(){ S.loginUser=val('u'); S.loginRole='clinic'; S.loginErr=null; render(); };
  var si=document.getElementById('signin');
  if(si) si.onclick=function(){
    S.loginUser=val('u');
    var role=S.loginRole==='qrt'?'SQRT':'CLINIC', pass=(document.getElementById('p')||{}).value||'';
    // one click = one sign-in (repeated clicks are ignored while the server is checking)
    CARE.once('signin', si, function(){ return CARE.auth.signIn(S.loginUser,pass,role); }).then(function(r){
      if(!r) return;
      if(!r.ok){ S.loginErr=r.error; render(); return; }
      S.loginErr=null; S.reset=null; S.hist=[]; S.me=r.account; S.role=S.loginRole;
      S.q=''; S.prog='All Programs'; S.block='All Blocks'; S.year='All Years'; S.sort='Last Name A–Z';
      go(S.role==='qrt'?'qrt-dashboard':'clinic-dashboard');
    });
  };
  ['u','p'].forEach(function(id){
    var e=document.getElementById(id);
    if(e) e.onkeydown=function(ev){ if(ev.key==='Enter') si.click(); };
  });

  var fg=document.getElementById('forgot');
  if(fg) fg.onclick=function(){ S.loginUser=val('u'); S.loginErr=null; S.reset={step:'ask', role:S.loginRole}; render(); };
  var sp=document.getElementById('sendreq');
  if(sp) sp.onclick=function(){
    var id=val('rId'), mail=val('rMail');
    CARE.once('reset-request', sp, function(){ return CARE.auth.requestReset(id, mail); }).then(function(err){
      if(err===undefined) return;
      if(err){ document.getElementById('rErr2').innerHTML='<div class="note red">'+icon('alert',18)+'<span>'+esc(err)+'</span></div>'; return; }
      S.reset={step:'sent', role:S.reset.role};
      render();
    });
  };
  var cr=document.getElementById('cancelreset');
  if(cr) cr.onclick=function(){ S.reset=null; render(); };
  var bl=document.getElementById('backtologin');
  if(bl) bl.onclick=function(){ S.loginRole=S.reset.role; S.reset=null; render(); };

  /* navigation */
  document.querySelectorAll('[data-go]').forEach(function(el){
    el.onclick=function(e){
      e.stopPropagation();
      var t=el.getAttribute('data-go');
      if(t==='logout'){ CARE.auth.signOut(); S.me=null; S.role=null; S.view='login'; S.sid=null; S.rid=null; S.hist=[];
        S.reset=null; S.loginErr=null; render(); return; }
      if(t==='clinic-record-edit'){
        var sid=el.getAttribute('data-sid'); if(sid) S.sid=sid;
        go('clinic-record',{editing:true}); return;
      }
      if(t==='clinic-record-view'){ go('clinic-record',{editing:false}); return; }
      if(t==='qrt-report-go'){ S.quick=false; go('qrt-report'); return; }
      if(t==='qrt-quick'){ S.quick=true; S.sid=null; go('qrt-report'); return; }
      if(t==='qrt-quick-here'){ S.quick=true; go('qrt-report'); return; }
      if(t==='qrt-report'){ S.quick=false; go('qrt-report'); return; }
      go(t);
    };
  });

  var bk=document.getElementById('back');
  if(bk) bk.onclick=back;

  var th=document.getElementById('themeswitch');
  if(th) th.onclick=function(){ S.dark=!S.dark; localStorage.setItem('care.theme',S.dark?'dark':'light'); render(); };

  CARE.pwUI.wireLive('np1','np2');
  CARE.pwUI.wireLive('pw1','pw2');

  // Change password: button -> pop-up
  var pwo=document.getElementById('pwopen');
  if(pwo) pwo.onclick=function(){ S.pwModal=true; S.pwMsg=null; render(); };
  CARE.pwUI.wireModal(
    function(){ return S.me; },
    function(text){ S.pwModal=false; S.pwMsg={ok:true,text:text}; render(); },
    function(){ S.pwModal=false; render(); });

  CARE.guard.names(['eFirst','eLast']);   // names: letters only
  CARE.guard.phone('eCont');             // emergency contact: numbers only
  wireFilters(); wireRows();

  /* quick search on either dashboard */
  var qgo=document.getElementById('qgo'), qq=document.getElementById('qq');
  function quick(){ S.q=qq?qq.value:''; audit('Searched students'); go(S.role==='qrt'?'qrt-search':'clinic-records'); }
  if(qgo) qgo.onclick=quick;
  if(qq) qq.onkeydown=function(e){ if(e.key==='Enter') quick(); };

  /* report sort */
  var rs=document.getElementById('rs');
  if(rs) rs.onchange=function(){
    S.rsort=rs.value;
    var box=document.getElementById('rrows');
    if(box){ box.innerHTML = (S.role==='qrt') ? historyRows() : clinicReportRows(); wireRows(); }
  };

  /* student type-ahead on the quick report */
  function wirePicker(){
    var box=document.getElementById('pickBox');
    if(!box) return;
    var inp=document.getElementById('rSearch'), hits=document.getElementById('rHits');
    if(inp&&hits){
      inp.oninput=function(){
        hits.innerHTML=hitsHTML(inp.value);
        hits.querySelectorAll('[data-pick]').forEach(function(h){
          h.onmouseenter=function(){ h.style.background='var(--head)'; };
          h.onmouseleave=function(){ h.style.background=''; };
          h.onclick=function(){ S.sid=h.getAttribute('data-pick');
            box.innerHTML=studentPicker(S.sid); wirePicker(); };
        });
      };
    }
    var ch=document.getElementById('rChange');
    if(ch) ch.onclick=function(){ S.sid=null; box.innerHTML=studentPicker(null); wirePicker();
      var i=document.getElementById('rSearch'); if(i) i.focus(); };
  }
  wirePicker();

  /* switch between quick and full without losing what is typed */
  var draft=function(){ return {place:val('rPlace'), reason:val('rReason'), sym:val('rSym'), act:val('rAct'),
                                sid:S.sid}; };
  var restore=function(d){
    ['rPlace','rReason','rSym','rAct'].forEach(function(id){
      var e=document.getElementById(id), k={rPlace:'place',rReason:'reason',rSym:'sym',rAct:'act'}[id];
      if(e&&d[k]) e.value=d[k];
    });
  };
  var rf=document.getElementById('rFull');
  if(rf) rf.onclick=function(){ var d=draft(); if(d.sid) S.sid=d.sid; S.quick=false; go('qrt-report'); restore(d); };
  var rq=document.getElementById('rQuick');
  if(rq) rq.onclick=function(){ var d=draft(); S.quick=true; go('qrt-report'); restore(d); };

  /* rescue report submit — one click = one report */
  var rs2=document.getElementById('rSubmit');
  if(rs2) rs2.onclick=function(){
    var missing=[];
    if(!S.sid) missing.push('Student');
    if(!val('rPlace')) missing.push('Location');
    if(!val('rReason')) missing.push('Reason for rescue');
    if(!val('rSym')) missing.push('Observed condition / symptoms');
    if(!val('rAct')) missing.push('Actions taken');
    var box=document.getElementById('rErr');
    if(missing.length){
      box.innerHTML='<div class="note red" style="margin-top:4px">'+icon('alert',18)+
        '<span><b>Missing:</b> '+missing.join(', ')+'</span></div>';
      return;
    }
    var body={sid:S.sid, when:val('rWhen')||nowStamp(), place:val('rPlace'), reason:val('rReason'), symptoms:val('rSym'),
              actions:val('rAct'), response:val('rInt')||'—', referred:val('rRef')||'Yes', notes:val('rNote')};
    CARE.once('report-submit', rs2, function(){
      return CARE.api('POST','/api/reports',body,{key:CARE.key('report-submit')}).then(function(r){
        CARE.keyDone('report-submit');
        return CARE.db.reload().then(function(){ S.quick=false; go('qrt-report-confirm',{rid:r.report.id}); });
      }).catch(function(e){ box.innerHTML='<div class="note red" style="margin-top:4px">'+icon('alert',18)+'<span><b>'+esc(e.message)+'</b></span></div>'; });
    });
  };

  function showErr(id,t){
    document.getElementById(id).innerHTML='<div class="note red" style="margin-top:4px">'+icon('alert',18)+'<span><b>'+esc(t)+'</b></span></div>';
  }
  function recordBody(){
    return {first:val('eFirst'), last:val('eLast'), prog:val('eProg'), block:val('eBlock'), year:val('eYear'),
            allergies:val('eAll'), conditions:val('eCon'), treatments:val('eTre'), contact:val('eCont')};
  }

  /* clinic: save edits */
  var es=document.getElementById('eSave');
  if(es) es.onclick=function(){
    var s=byId(S.sid), b=recordBody();
    if(!b.first||!b.last) return showErr('eErr','First and last name are required.');
    var pe=CARE.guard.phoneProblem(b.contact); if(pe) return showErr('eErr',pe);
    CARE.once('student-save', es, function(){
      return CARE.api('PATCH','/api/students/'+encodeURIComponent(s.id),b,{key:CARE.key('student-save-'+s.id)}).then(function(){
        CARE.keyDone('student-save-'+s.id);
        return CARE.db.reload().then(function(){ go('clinic-record',{editing:false, flash:'Record updated.'}); });
      }).catch(function(e){ showErr('eErr',e.message); });
    });
  };

  /* clinic: create record — one click = one record, and the server refuses a repeated student ID */
  var as=document.getElementById('aSave');
  if(as) as.onclick=function(){
    var b=recordBody(), id=val('eId'), miss=[];
    if(!b.first) miss.push('First name');
    if(!b.last) miss.push('Last name');
    if(!id) miss.push('Student ID');
    if(miss.length) return showErr('eErr','Missing: '+miss.join(', '));
    var pe=CARE.guard.phoneProblem(b.contact); if(pe) return showErr('eErr',pe);
    b.id=id;
    CARE.once('student-create', as, function(){
      return CARE.api('POST','/api/students',b,{key:CARE.key('student-create')}).then(function(r){
        CARE.keyDone('student-create');
        S.q='';
        return CARE.db.reload().then(function(){ go('clinic-record',{sid:r.student.id, editing:false, flash:'Student record created.'}); });
      }).catch(function(e){ showErr('eErr',e.message); });
    });
  };

  /* clinic: assessment + status */
  var ar=document.getElementById('aSaveRev');
  if(ar) ar.onclick=function(){
    var r=rep(S.rid), t=val('aTxt');
    if(!t) return showErr('aErr','Assessment is empty. Write your findings first.');
    CARE.once('assess-'+r.id, ar, function(){
      return CARE.api('POST','/api/reports/'+r.id+'/assessment',{text:t},{key:CARE.key('assess-'+r.id)}).then(function(){
        CARE.keyDone('assess-'+r.id);
        return CARE.db.reload().then(function(){ go('clinic-review',{rid:r.id, flash:'Assessment saved. '+r.id+' is resolved.'}); });
      }).catch(function(e){ showErr('aErr',e.message); });
    });
  };
  var arv=document.getElementById('aResolve');
  if(arv) arv.onclick=function(){
    var r=rep(S.rid);
    CARE.once('resolve-'+r.id, arv, function(){
      return CARE.api('POST','/api/reports/'+r.id+'/resolve',{},{key:CARE.key('resolve-'+r.id)}).then(function(){
        CARE.keyDone('resolve-'+r.id);
        return CARE.db.reload().then(function(){ go('clinic-review',{rid:r.id, flash:r.id+' marked as Resolved.'}); });
      }).catch(function(e){ alert(e.message); });
    });
  };
}
