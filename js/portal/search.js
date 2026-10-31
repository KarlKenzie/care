/* SEARCH — search + filter sa students ug ang lista sa resulta */

function filtered(){
  var q=S.q.trim().toLowerCase();
  var out=ST().filter(function(s){
    if(q){
      var hay=(s.first+' '+s.last+' '+s.last+' '+s.first+' '+s.id).toLowerCase();
      if(hay.indexOf(q)===-1) return false;
    }
    if(S.prog!=='All Programs' && s.prog!==S.prog) return false;
    if(S.block!=='All Blocks' && s.block!==S.block) return false;
    if(S.year!=='All Years' && s.year!==S.year) return false;
    return true;
  });
  out.sort(function(a,b){
    if(S.sort==='Last Name Z–A') return b.last.localeCompare(a.last);
    if(S.sort==='Year Level') return a.year.localeCompare(b.year)|| a.last.localeCompare(b.last);
    if(S.sort==='Program') return a.prog.localeCompare(b.prog)|| a.last.localeCompare(b.last);
    return a.last.localeCompare(b.last);
  });
  return out;
}
function filterBar(){
  function opts(list,cur){ return list.map(function(o){
    return '<option'+(o===cur?' selected':'')+'>'+esc(o)+'</option>'; }).join(''); }
  return '<div class="filters">'+
    '<div class="wide"><label class="f" for="q">Search by name or student ID</label>'+
      '<input class="in" id="q" type="search" placeholder="e.g. Santos, Maria or 2025-00124" value="'+esc(S.q)+'"></div>'+
    '<div><label class="f" for="fp">Program</label><select class="in" id="fp">'+opts(PROGOPTS,S.prog)+'</select></div>'+
    '<div><label class="f" for="fb">Block</label><select class="in" id="fb">'+opts(BLOCKS,S.block)+'</select></div>'+
    '<div><label class="f" for="fy">Year level</label><select class="in" id="fy">'+opts(YEARS,S.year)+'</select></div>'+
    '<div><label class="f" for="fs">Sort</label><select class="in" id="fs">'+opts(SORTS,S.sort)+'</select></div>'+
    '</div>';
}
function wireFilters(){
  var q=document.getElementById('q');
  if(q){ q.oninput=function(){ S.q=q.value; redrawResults(); }; }
  ['fp','fb','fy','fs'].forEach(function(id){
    var e=document.getElementById(id);
    if(!e) return;
    e.onchange=function(){
      if(id==='fp')S.prog=e.value; if(id==='fb')S.block=e.value;
      if(id==='fy')S.year=e.value; if(id==='fs')S.sort=e.value;
      redrawResults();
    };
  });
}
function redrawResults(){
  var box=document.getElementById('results');
  if(!box) return;
  box.innerHTML=resultsHTML();
  wireRows();
}
function resultsHTML(){
  var list=filtered();
  if(!ST().length){
    return '<div class="empty"><h3>No student records yet.</h3><p>'+(S.role==='clinic'
      ? 'Use Add student record to create the first one.' : 'The University Clinic has not added any records yet.')+'</p></div>';
  }
  if(!list.length){
    return '<div class="empty"><h3>No students found.</h3><p>Try a different spelling, '+
      'or clear the filters.</p></div>';
  }
  var clinic=(S.role==='clinic');
  var rows=list.map(function(s){
    return '<tr class="click" data-sid="'+s.id+'">'+
      '<td><b>'+esc(s.last)+', '+esc(s.first)+'</b></td>'+
      '<td class="mono sm">'+esc(s.id)+'</td>'+
      '<td><b class="mono sm">'+esc(s.prog)+'</b><div class="sm muted">'+esc(progName(s.prog))+'</div></td>'+
      '<td class="mono">'+esc(s.block)+'</td>'+
      '<td>'+esc(s.year)+'</td>'+
      '<td style="text-align:right"><button class="btn sm" data-sid="'+s.id+'">'+
        (clinic?'Open record':'View record')+'</button></td></tr>';
  }).join('');
  return '<p class="sm muted" style="margin:0 0 10px">Showing '+list.length+' of '+ST().length+' students</p>'+
    '<div class="tw"><table><thead><tr><th>Student name</th><th>Student ID</th><th>Program</th>'+
    '<th>Block</th><th>Year level</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function wireRows(){
  document.querySelectorAll('[data-sid]').forEach(function(el){
    el.onclick=function(e){ e.stopPropagation();
      var st=byId(el.getAttribute('data-sid'));
      audit('Viewed record', full(st)+' — '+st.id);
      go(S.role==='qrt'?'qrt-record':'clinic-record',{sid:el.getAttribute('data-sid'),editing:false}); };
  });
  document.querySelectorAll('[data-rid]').forEach(function(el){
    el.onclick=function(e){ e.stopPropagation();
      go(S.role==='qrt'?'qrt-report-detail':'clinic-review',{rid:el.getAttribute('data-rid')}); };
  });
}
