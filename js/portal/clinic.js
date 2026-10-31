/* CLINIC — dashboard, student records, add/edit, rescue reports ug review */

function clinicDashboard(){
  var pending=RP().filter(function(r){return r.status==='Pending Clinic Review';});
  var rows=sortReports(RP().filter(function(r){return r.status!=='Resolved';})).map(function(r){
    var s=byId(r.sid);
    return '<div class="click" data-rid="'+r.id+'" style="display:flex;align-items:center;gap:12px;padding:12px 0;'+
      'border-bottom:1px solid var(--line2);cursor:pointer">'+
      '<div style="flex-grow:1;min-width:0"><div style="font-weight:600">'+esc(r.id)+' · '+esc(full(s))+'</div>'+
      '<div class="sm muted">'+esc(r.when)+' · '+esc(r.by)+'</div></div>'+
      '<span class="bdg '+statusClass(r.status)+'">'+esc(r.status)+'</span></div>';
  }).join('');
  return shell('Dashboard','University Clinic',
    (pending.length? '<div class="note warn">'+icon('alert',18)+'<span><b>'+pending.length+' rescue report'+
      (pending.length>1?'s':'')+' awaiting your review</b>Open it to add your assessment.</span>'+
      (pending.length===1
        ? '<button class="btn sm right" data-rid="'+pending[0].id+'">Review '+pending[0].id+'</button>'
        : '<button class="btn sm right" data-go="clinic-reports">Review reports</button>')+
      '</div>' : '<div class="note ok">'+icon('check',18)+
      '<span><b>No reports awaiting review.</b></span>'+
      '<button class="btn out sm right" data-go="clinic-reports">View all reports</button></div>')+
    '<div class="grid g2">'+
      '<div class="card"><div class="ct"><div><h2>Student records</h2>'+
        '<p>'+ST().length+' records</p></div></div>'+
        '<div class="row"><button class="btn" data-go="clinic-records">'+icon('search',17,'#fff')+
          'Search records</button>'+
        '<button class="btn out" data-go="clinic-add">'+icon('plus',17)+'Add student record</button></div></div>'+
      '<div class="card"><div class="ct"><div><h2>Find a student</h2><p>Last name or student ID</p></div></div>'+
        '<div class="row"><input class="in" id="qq" placeholder="Last name or student ID" style="flex:1 1 200px">'+
        '<button class="btn sec" id="qgo">Search</button></div></div>'+
    '</div>'+
    '<div class="card"><div class="ct"><div><h2>Rescue reports</h2><p>Open items</p></div>'+
      '<button class="btn out sm" data-go="clinic-reports">View all</button></div>'+
      (rows||'<p class="muted sm">Nothing open right now.</p>')+'</div>');
}

function clinicRecords(){
  return shell('Student records','Maintained by the Clinic',
    '<div class="card">'+filterBar()+'</div><div id="results">'+resultsHTML()+'</div>',
    '<button class="btn" data-go="clinic-add">'+icon('plus',17,'#fff')+'Add student record</button>');
}

function recordForm(s){
  var e=s||{};
  return '<div class="card"><div class="ct"><div><h2>'+(s?'Edit student record':'New student record')+'</h2>'+
    '<p>The SQRT can read this record but cannot change it.</p></div>'+
    '<span class="prov v">'+icon('shield',14)+'Official Clinic-Maintained Information</span></div>'+
    '<div class="grid g2">'+
      '<div class="fld"><label class="f" for="eFirst">First name</label>'+
        '<input class="in" id="eFirst" value="'+esc(e.first||'')+'"></div>'+
      '<div class="fld"><label class="f" for="eLast">Last name</label>'+
        '<input class="in" id="eLast" value="'+esc(e.last||'')+'"></div>'+
    '</div>'+
    '<div class="grid g4">'+
      '<div class="fld"><label class="f" for="eId">Student ID</label>'+
        '<input class="in mono" id="eId" value="'+esc(e.id||'')+'" placeholder="2026-00001"'+(s?' disabled':'')+'></div>'+
      '<div class="fld"><label class="f" for="eProg">Program</label>'+
        '<select class="in" id="eProg">'+PROGRAMS.map(function(p){
          return '<option value="'+p.code+'"'+(e.prog===p.code?' selected':'')+'>'+p.code+' — '+p.name+'</option>';
        }).join('')+'</select></div>'+
      '<div class="fld"><label class="f" for="eBlock">Block</label>'+
        '<select class="in" id="eBlock">'+BLOCKS.slice(1).map(function(b){
          return '<option'+(e.block===b?' selected':'')+'>'+b+'</option>';}).join('')+'</select></div>'+
      '<div class="fld"><label class="f" for="eYear">Year level</label>'+
        '<select class="in" id="eYear">'+YEARS.slice(1).map(function(y){
          return '<option'+(e.year===y?' selected':'')+'>'+y+'</option>';}).join('')+'</select></div>'+
    '</div>'+
    '<div class="grid g2">'+
      '<div class="fld"><label class="f" for="eAll">Allergies</label>'+
        '<textarea class="in" id="eAll" placeholder="None recorded">'+esc(e.allergies||'')+'</textarea></div>'+
      '<div class="fld"><label class="f" for="eCon">Existing medical conditions</label>'+
        '<textarea class="in" id="eCon" placeholder="None recorded">'+esc(e.conditions||'')+'</textarea></div>'+
    '</div>'+
    '<div class="fld"><label class="f" for="eTre">Past treatments</label>'+
      '<textarea class="in" id="eTre">'+esc(e.treatments||'')+'</textarea></div>'+
    '<div class="fld" style="margin-bottom:0"><label class="f" for="eCont">Emergency contact number</label>'+
      '<input class="in mono" id="eCont" value="'+esc(e.contact&&/^[0-9]+$/.test(e.contact)?e.contact:'')+'" placeholder="09XXXXXXXXX">'+
      '<div class="hint">Numbers only. 11-digit mobile number starting with 09.</div></div>'+
    '<div id="eErr"></div></div>';
}

function clinicRecord(){
  var s=byId(S.sid);
  if(!s) return shell('Student record','','<div class="empty"><h3>No student selected.</h3>'+
    '<p>Open a record from the records list.</p></div>');
  if(S.editing){
    return shell('Edit record',full(s)+' · '+s.id,
      recordForm(s)+
      '<div class="row"><button class="btn" id="eSave">'+icon('check',17,'#fff')+'Save changes</button>'+
      '<button class="btn out" data-go="clinic-record-view">Cancel</button></div>');
  }
  var rel=RP().filter(function(r){return r.sid===s.id;});
  var relHTML = rel.length ? rel.map(function(r){
      return '<div class="click" data-rid="'+r.id+'" style="display:flex;align-items:center;gap:12px;padding:11px 0;'+
        'border-bottom:1px solid var(--line2);cursor:pointer"><div style="flex-grow:1">'+
        '<b class="mono">'+esc(r.id)+'</b> <span class="sm muted">'+esc(r.when)+'</span></div>'+
        '<span class="bdg '+statusClass(r.status)+'">'+esc(r.status)+'</span></div>';
    }).join('') : '<p class="muted sm">No rescue reports for this student.</p>';
  return shell(full(s),'Official record · Clinic-maintained',
    recordCard(s)+
    '<div class="card"><div class="ct"><div><h2>Rescue reports</h2>'+
      '<p>For this student</p></div></div>'+relHTML+'</div>'+
    '<div class="row"><button class="btn" data-go="clinic-record-edit">'+icon('edit',17,'#fff')+
      'Edit record</button>'+
      '<button class="btn out" data-go="clinic-records">'+icon('back',17)+'Back to records</button></div>');
}

function clinicAdd(){
  return shell('Add student record','New record',
    recordForm(null)+
    '<div class="row"><button class="btn" id="aSave">'+icon('check',17,'#fff')+'Create record</button>'+
    '<button class="btn out" data-go="clinic-records">Cancel</button></div>');
}

function clinicReportRows(){
  if(!RP().length) return '<div class="empty"><h3>No rescue reports yet.</h3><p>Reports from the SQRT will appear here.</p></div>';
  var rows=sortReports(RP()).map(function(r){
    var s=byId(r.sid);
    return '<tr class="click" data-rid="'+r.id+'"><td class="mono"><b>'+esc(r.id)+'</b></td>'+
      '<td>'+esc(full(s))+'</td><td class="sm">'+esc(r.when)+'</td><td class="sm">'+esc(r.by)+'</td>'+
      '<td><span class="bdg '+statusClass(r.status)+'">'+esc(r.status)+'</span></td></tr>';
  }).join('');
  return '<div class="tw"><table><thead><tr><th>Report ID</th><th>Student</th><th>Date and time</th>'+
    '<th>Submitted by</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

function clinicReports(){
  return shell('Rescue reports','From the SQRT',
    '<div class="card">'+sortBar()+'</div>'+
    '<div id="rrows">'+clinicReportRows()+'</div>');
}

function clinicReview(){
  var r=rep(S.rid); if(!r) return shell('Rescue report','','<div class="empty"><h3>Report not found.</h3></div>');
  var s=byId(r.sid);
  var actions='';
  if(!r.assessment){
    actions='<div class="card"><div class="ct"><div><h2>Add your assessment</h2>'+
      '<p>Kept separate from the report above</p></div>'+
      '<span class="prov a">'+icon('clip',14)+'Clinic Assessment</span></div>'+
      '<div class="fld"><label class="f" for="aTxt">Assessment</label>'+
        '<textarea class="in" id="aTxt" placeholder="Findings, treatment given, advice"></textarea></div>'+
      '<div id="aErr"></div>'+
      '<div class="row"><button class="btn" id="aSaveRev">'+icon('check',17,'#fff')+
        'Save assessment &amp; mark Resolved</button></div></div>';
  }else if(r.status==='Reviewed'){
    actions='<div class="card"><div class="ct"><div><h2>Close this report</h2>'+
      '<p>No further action needed</p></div></div>'+
      '<div class="row"><button class="btn ok" id="aResolve">'+icon('check',17,'#fff')+
        'Mark as Resolved</button></div></div>';
  }
  var upd='<div class="card"><div class="ct"><div><h2>Medical record</h2>'+
    '<p>Update it only if the report warrants a change</p></div>'+
    '<span class="prov v">'+icon('shield',14)+'Verified Clinic Information</span></div>'+
    '<div class="grid g2">'+kv('Allergies',s.allergies)+kv('Existing conditions',s.conditions)+'</div>'+
    '<div class="grid g2" style="margin-top:14px">'+kv('Past treatments',s.treatments)+
      kv('Last updated',s.updated,true)+'</div>'+
    '<div class="row" style="margin-top:16px"><button class="btn sec" data-go="clinic-record-edit" '+
      'data-sid="'+s.id+'">'+icon('edit',17)+'Update official record</button>'+
    '<button class="btn out" data-sid="'+s.id+'">Open full record</button></div></div>';
  return shell('Review rescue report '+r.id,full(s)+' · '+s.id,
    '<div class="note info">'+icon('clip',18)+'<span><b>A report never overwrites the medical record.</b>'+
      'Update the record yourself if it needs changing.</span></div>'+
    reportBlocks(r,s)+actions+upd+
    '<div class="row"><button class="btn out" data-go="clinic-reports">'+icon('back',17)+
      'Back to reports</button></div>');
}
