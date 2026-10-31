/* HELPERS — gagmay nga function, navigation (go/back) ug sort */

function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function byId(id){ return ST().filter(function(s){return s.id===id;})[0]; }
function rep(id){ return RP().filter(function(r){return r.id===id;})[0]; }
function full(s){ return s.first+' '+s.last; }
function sortReports(list){
  var out=list.slice();
  if(S.rsort==='Pending first')
    out.sort(function(a,b){ return (SRANK[a.status]-SRANK[b.status]) || (b.t-a.t); });
  else if(S.rsort==='Resolved first')
    out.sort(function(a,b){ return (SRANK[b.status]-SRANK[a.status]) || (b.t-a.t); });
  else if(S.rsort==='Oldest first') out.sort(function(a,b){ return a.t-b.t; });
  else out.sort(function(a,b){ return b.t-a.t; });
  return out;
}

function sortBar(){
  return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
    '<label class="f" for="rs" style="margin:0">Sort by</label>'+
    '<select class="in" id="rs" style="width:auto;min-width:190px;height:38px">'+
    RSORTS.map(function(o){ return '<option'+(o===S.rsort?' selected':'')+'>'+o+'</option>'; }).join('')+
    '</select></div>';
}

function statusClass(st){ return st==='Pending Clinic Review'?'pend':(st==='Reviewed'?'rev':'ok'); }
function kv(k,v,mono){ return '<div class="kv"><div class="k">'+esc(k)+'</div><div class="v'+(mono?' mono':'')+'">'+
  esc(v)+'</div></div>'; }
function applyTheme(){
  if(S.dark) document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
}

function snap(){ return {view:S.view, sid:S.sid, rid:S.rid, editing:S.editing, quick:S.quick}; }
function same(a,b){ return a.view===b.view && a.sid===b.sid && a.rid===b.rid && a.editing===b.editing; }

function go(v,o){
  o=o||{};
  var from=snap();
  if(v!=='profile') S.pwMsg=null;
  S.pwModal=false;
  S.view=v; if('sid' in o)S.sid=o.sid; if('rid' in o)S.rid=o.rid;
  if('editing' in o)S.editing=o.editing; S.flash=o.flash||null;
  if(!same(from,snap())) S.hist.push(from);
  if(S.hist.length>25) S.hist.shift();
  draw();
}
// Screens with a form are drawn at once (so typed text is never lost); other screens fetch the newest data first.
var navSeq=0;
function draw(){
  var formView = S.view==='qrt-report' || S.view==='clinic-add' || (S.view==='clinic-record' && S.editing);
  if(formView){ navSeq++; render(); CARE.scrollTop(); return; }
  var my=++navSeq;
  CARE.db.reload().then(function(){ if(my===navSeq){ render(); CARE.scrollTop(); } });
}

function back(){
  var prev=S.hist.pop();
  if(!prev) return;
  S.view=prev.view; S.sid=prev.sid; S.rid=prev.rid; S.editing=prev.editing; S.quick=prev.quick;
  S.flash=null; draw();
}
function nowStamp(){
  var d=new Date(), M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h=d.getHours(), ap=h<12?'AM':'PM'; h=h%12||12;
  return d.getDate()+' '+M[d.getMonth()]+' '+d.getFullYear()+', '+h+':'+String(d.getMinutes()).padStart(2,'0')+' '+ap;
}
function val(id){ var e=document.getElementById(id); return e?e.value.trim():''; }
