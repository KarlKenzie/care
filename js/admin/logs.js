/* LOGS — Access logs: kinsa ang nag-sign in, nag-view, nag-update (dili ipakita ang sulod sa record) */
(function () {
  var S = CARE.admin.S, icon = CARE.icon, esc = CARE.esc, kv = CARE.kv, val = CARE.val, roleTag = CARE.roleTag;
  var shell = CARE.admin.shell;
  function go(v, o) { CARE.admin.go(v, o); }
  function U() { return CARE.db.accounts(); }     // tanang accounts
  function LG() { return CARE.db.logs(); }        // tanang access logs
  function full(u) { return u.first + ' ' + u.last; }
  function initials(u) { return (u.first[0] + u.last[0]).toUpperCase(); }

  /* ----- screen */
  function logFiltered(){
    var q=S.lq.trim().toLowerCase();
    var out=LG().filter(function(l){
      if(q && (l.who+' '+l.act+' '+l.rec).toLowerCase().indexOf(q)===-1) return false;
      if(S.lrole!=='All roles' && l.role!==S.lrole) return false;
      if(S.lact!=='All actions' && l.act!==S.lact) return false;
      if(S.lres==='Success only' && !l.ok) return false;
      if(S.lres==='Failed only' && l.ok) return false;
      return true;
    });
    if(S.lres==='Failed first'){
      var bad=out.filter(function(l){return !l.ok;}), good=out.filter(function(l){return l.ok;});
      out=bad.concat(good);
    }
    return out;
  }
  function logRows(){
    var list=logFiltered();
    if(!list.length) return '<div class="empty"><h3>No activity matches your filters.</h3>'+
      '<p>Clear a filter to see all entries.</p></div>';
    return '<p class="sm muted" style="margin:0 0 10px">Showing '+list.length+' of the latest '+LG().length+' entries ('+CARE.db.stats().logs+' in total)</p>'+
      '<div class="tw"><table><thead><tr><th>Date and time</th><th>User</th><th>Role</th><th>Action</th>'+
      '<th>Student record</th><th>Result</th></tr></thead><tbody>'+
      list.map(function(l){
        return '<tr><td class="mono sm">'+esc(l.when)+'</td><td>'+esc(l.who)+'</td>'+
          '<td>'+roleTag(l.role)+'</td><td>'+esc(l.act)+'</td><td class="sm">'+esc(l.rec)+'</td>'+
          '<td>'+(l.ok?'<span class="bdg ok">Success</span>':'<span class="bdg red">Failed</span>')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  function viewLogs(){
    var acts=['All actions']; LG().forEach(function(l){ if(acts.indexOf(l.act)===-1) acts.push(l.act); });
    function opts(a,c){ return a.map(function(o){return '<option'+(o===c?' selected':'')+'>'+esc(o)+'</option>';}).join(''); }
    return shell('Access logs','All roles',
      '<div class="card"><div class="filters">'+
        '<div class="wide"><label class="f" for="lq">Search by user, action or student</label>'+
          '<input class="in" id="lq" type="search" placeholder="e.g. Maria Santos or Viewed" value="'+esc(S.lq)+'"></div>'+
        '<div><label class="f" for="lr">Role</label><select class="in" id="lr">'+
          opts(['All roles','SQRT','CLINIC','ADMIN'],S.lrole)+'</select></div>'+
        '<div><label class="f" for="la">Action</label>'+
          '<select class="in" id="la">'+opts(acts,S.lact)+'</select></div>'+
        '<div><label class="f" for="lres">Result</label><select class="in" id="lres">'+
          opts(['All results','Failed first','Failed only','Success only'],S.lres)+'</select></div>'+
      '</div></div><div id="rows">'+logRows()+'</div>'+
      '<div class="note info">'+icon('lock',18)+'<span>The log records that a record was opened, never what '+
        'it contained. <b>Logs are permanent:</b> they cannot be edited or deleted by anyone, not even an administrator.</span></div>');
  }

  /* ----- filter */
  function wireLogs() {
    /* log filters */
    var lq=document.getElementById('lq');
    if(lq) lq.oninput=function(){ S.lq=lq.value; document.getElementById('rows').innerHTML=logRows(); };
    ['lr','la','lres'].forEach(function(id){
      var e=document.getElementById(id);
      if(e) e.onchange=function(){
        if(id==='lr')S.lrole=e.value; else if(id==='la')S.lact=e.value; else S.lres=e.value;
        document.getElementById('rows').innerHTML=logRows(); };
    });
  }

  CARE.admin.views.logs = viewLogs;
  CARE.admin.wirers.push(wireLogs);
})();
