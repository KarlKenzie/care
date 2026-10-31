/* SQRT — dashboard, student search, record, rescue report form ug history */

function qrtDashboard(){
  var recent=sortReports(RP()).slice(0,3);
  var pending=RP().filter(function(r){return r.status==='Pending Clinic Review';});
  var list=recent.map(function(r,i){
    var s=byId(r.sid);
    return '<div class="click" data-rid="'+r.id+'" style="display:flex;align-items:center;gap:12px;'+
      'padding:14px 0;'+(i===recent.length-1?'':'border-bottom:1px solid var(--line2)')+';cursor:pointer">'+
      '<div style="flex-grow:1;min-width:0">'+
      '<div style="font-size:15px;font-weight:600">'+esc(r.id)+' · '+esc(full(s))+'</div>'+
      '<div class="sm muted" style="margin-top:2px">'+esc(r.when)+' · '+esc(r.place)+'</div></div>'+
      '<span class="bdg '+statusClass(r.status)+'">'+
        esc(r.status==='Pending Clinic Review'?'Pending':r.status)+'</span></div>';
  }).join('');

  return shell('Dashboard','Student Quick Response Team',
    '<div class="card"><div class="ct"><div><h2>Find a student</h2>'+
      '<p>Last name or student ID</p></div></div>'+
      '<div class="row" style="flex-wrap:nowrap"><input class="in" id="qq" '+
      'placeholder="e.g. Santos or 2025-00124" style="flex:1 1 auto">'+
      '<button class="btn" id="qgo" style="flex:0 0 auto">'+icon('search',17,'#fff')+'Search</button></div></div>'+

    '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;background:var(--redb);'+
      'border:1px solid var(--redl);border-radius:12px;padding:18px 20px">'+
      '<div><div style="font-size:15px;font-weight:600">Responding now?</div>'+
      '<div class="sm muted" style="margin-top:2px">File a report quickly.</div></div>'+
      '<button class="btn dan" data-go="qrt-quick" style="flex:0 0 auto">'+icon('pulse',17,'#fff')+
      'Quick report</button></div>'+

    (pending.length
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;'+
        'background:var(--ambb);border:1px solid var(--ambl);border-radius:12px;padding:18px 20px">'+
        '<div><div style="font-size:15px;font-weight:600">'+pending.length+' report'+
          (pending.length>1?'s':'')+' awaiting clinic review</div>'+
        '<div class="sm muted" style="margin-top:2px">'+
          pending.map(function(r){return r.id;}).join(', ')+'</div></div>'+
        '<button class="btn out" data-go="qrt-history" style="flex:0 0 auto">'+icon('alert',17)+
        'View reports</button></div>'
      : '')+

    '<div class="card"><div class="ct"><div><h2>Recent reports</h2><p>Newest first</p></div>'+
      '<button class="btn out sm" data-go="qrt-history">View all</button></div>'+
      (list||'<p class="muted sm">No reports submitted yet.</p>')+'</div>');
}

function qrtSearch(){
  return shell('Student search','Name or student ID',
    '<div class="card">'+filterBar()+'</div><div id="results">'+resultsHTML()+'</div>');
}

function recordCard(s,forClinic){
  return '<div class="card">'+
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">'+
      '<h2 style="font-size:24px;font-weight:600">'+esc(full(s))+'</h2>'+
      '<span class="prov v">'+icon('shield',14)+'Verified Clinic Information</span></div>'+
    '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;'+
      'margin-top:8px">'+
      '<p class="sm muted" style="margin:0"><span class="mono">'+esc(s.id)+'</span> · '+esc(progName(s.prog))+
      ' · Block '+esc(s.block)+' · '+esc(s.year)+'</p>'+
      '<p class="sm muted" style="margin:0"><b style="color:var(--ink)">Last updated:</b> '+
      esc(s.updated)+'</p></div>'+
    '<div style="height:1px;background:var(--line2);margin:18px 0"></div>'+
    '<div class="grid g2">'+
      '<div style="background:var(--redb);border-radius:10px;padding:18px 20px;display:flex;gap:14px">'+
        icon('alert',22,'var(--red)')+
        '<div><div style="font-size:15px;font-weight:600">Allergies</div>'+
        '<div class="muted" style="margin-top:4px">'+esc(s.allergies)+'</div></div></div>'+
      '<div style="background:var(--ambb);border-radius:10px;padding:18px 20px;display:flex;gap:14px">'+
        icon('pulse',22,'var(--gold)')+
        '<div><div style="font-size:15px;font-weight:600">Existing medical conditions</div>'+
        '<div class="muted" style="margin-top:4px">'+esc(s.conditions)+'</div></div></div>'+
    '</div>'+
    '<div class="grid g2" style="margin-top:22px">'+
      kv('Past treatments',s.treatments)+kv('Emergency contact',s.contact)+
    '</div></div>';
}

function qrtRecord(){
  var s=byId(S.sid);
  if(!s) return shell('Student record','', '<div class="empty"><h3>No student selected.</h3>'+
    '<p>Open a student from the search results.</p></div>');
  return shell(full(s),null,
    '<div class="note info">'+icon('lock',20)+'<span><b>Authorized access only</b>'+
      'Access this record only when needed for emergency response. Your view is recorded.</span></div>'+
    recordCard(s)+
    '<div class="note info">'+icon('eye',20)+'<span><b>Read-only</b>'+
      'To report what you observed, file a rescue report.</span></div>'+
    '<div class="row">'+
      '<button class="btn dan" data-go="qrt-report-go">'+icon('pulse',17,'#fff')+
        'Submit rescue report</button>'+
      '<button class="btn" data-go="qrt-quick-here">'+icon('pulse',17,'#fff')+'Quick report</button>'+
      '<button class="btn out" data-go="qrt-search">'+icon('back',17)+'Back to search</button>'+
    '</div>');
}

function pickHits(q){
  q=(q||'').trim().toLowerCase();
  if(!q) return [];
  return ST().filter(function(s){
    return (s.first+' '+s.last+' '+s.last+' '+s.first+' '+s.id+' '+s.prog+' '+s.block)
             .toLowerCase().indexOf(q)!==-1;
  }).sort(function(a,b){ return a.last.localeCompare(b.last)||a.first.localeCompare(b.first); }).slice(0,6);
}

function hitsHTML(q){
  var list=pickHits(q);
  if(!q.trim()) return '';
  if(!list.length) return '<div class="hint" style="margin-top:8px">No match. Try the student ID.</div>';
  var dupe={};
  ST().forEach(function(s){ dupe[s.last]=(dupe[s.last]||0)+1; });
  return '<div style="margin-top:8px;border:1px solid var(--line);border-radius:10px;overflow:hidden;'+
    'background:var(--card)">'+list.map(function(s,i){
      return '<div class="pickhit" data-pick="'+s.id+'" style="display:flex;align-items:center;gap:12px;'+
        'padding:11px 13px;cursor:pointer;'+(i?'border-top:1px solid var(--line2)':'')+'">'+
        '<div style="flex-grow:1;min-width:0">'+
          '<div style="font-weight:600">'+esc(s.last)+', '+esc(s.first)+
            (dupe[s.last]>1?' <span class="bdg rev" style="font-size:10.5px;padding:2px 8px">same surname</span>':'')+
          '</div>'+
          '<div class="sm muted"><span class="mono">'+esc(s.id)+'</span> · '+esc(s.prog)+
            ' · Block '+esc(s.block)+' · '+esc(s.year)+'</div>'+
        '</div>'+icon('chev',16)+'</div>';
    }).join('')+'</div>';
}

function studentPicker(sel){
  var s=sel?byId(sel):null;
  if(s){
    return '<label class="f">Student</label>'+
      '<div style="display:flex;align-items:center;gap:12px;border:1px solid var(--grnl);background:var(--grnb);'+
        'border-radius:10px;padding:12px 14px">'+
        '<span class="av" style="background:var(--navy)">'+esc(s.first[0]+s.last[0])+'</span>'+
        '<div style="flex-grow:1;min-width:0"><div style="font-weight:600">'+esc(full(s))+'</div>'+
        '<div class="sm muted"><span class="mono">'+esc(s.id)+'</span> · '+esc(s.prog)+' · Block '+
          esc(s.block)+' · '+esc(s.year)+'</div></div>'+
        '<button class="btn out sm" id="rChange" style="width:auto">Change</button></div>';
  }
  return '<label class="f" for="rSearch">Student</label>'+
    '<input class="in" id="rSearch" type="search" autocomplete="off" '+
      'placeholder="Type a last name, first name or student ID">'+
    '<div id="rHits"></div>'+
    '<div class="hint">Matches show student ID, program, block and year.</div>';
}

function qrtReportForm(){
  var quick=S.quick, s=S.sid?byId(S.sid):null;
  if(!quick && !s) return shell('Rescue report','','<div class="empty"><h3>Select a student first.</h3>'+
    '<p>A rescue report is always attached to a student record.</p></div>');

  var studentField = quick
    ? '<div class="fld" id="pickBox">'+studentPicker(S.sid)+'</div>'
    : '<div class="fld"><label class="f">Student</label><input class="in" value="'+
      esc(full(s))+' — '+esc(s.id)+'" disabled></div>';

  var head = quick
    ? '<div class="note red">'+icon('pulse',18)+'<span><b>Quick report</b>Four fields. Date and time are stamped automatically.</span></div>'
    : '<div class="note info">'+icon('clip',18)+'<span><b>This report records observations and actions '+
      'taken by the SQRT responder.</b>It does not replace a clinical assessment.</span></div>';

  var rest = quick ? '' :
    '<div class="grid g2">'+
      '<div class="fld"><label class="f" for="rWhen">Date and time</label>'+
        '<input class="in" id="rWhen" value="'+esc(nowStamp())+'"></div>'+
      '<div class="fld"><label class="f" for="rRef">Referred to Clinic?</label>'+
        '<select class="in" id="rRef"><option>Yes</option><option>No</option></select></div>'+
    '</div>'+
    '<div class="fld"><label class="f" for="rInt">Immediate response / intervention</label>'+
      '<textarea class="in" id="rInt" placeholder="Assistance given and the response"></textarea></div>'+
    '<div class="fld" style="margin-bottom:0"><label class="f" for="rNote">Additional notes</label>'+
      '<textarea class="in" id="rNote" placeholder="Optional"></textarea></div>';

  var toggle = quick
    ? '<button class="btn out" id="rFull">Add full details instead</button>'
    : '<button class="btn out" id="rQuick">'+icon('pulse',17)+'Switch to quick report</button>';

  return shell(quick?'Quick rescue report':'New rescue report',
    quick?'Stamped '+nowStamp():'For '+full(s)+' · '+s.id,
    head+
    '<div class="card"><div class="ct"><div><h2>Incident details</h2>'+
      '<p>'+(quick?'Essentials only':'Submitted to the Clinic for review')+'</p></div>'+
      '<span class="prov q">'+icon('pulse',14)+'SQRT Observation</span></div>'+
      studentField+
      '<div class="fld"><label class="f" for="rPlace">Location</label>'+
        '<input class="in" id="rPlace" placeholder="e.g. Gymnasium Court 2"></div>'+
      '<div class="fld"><label class="f" for="rReason">Reason for rescue</label>'+
        '<input class="in" id="rReason" placeholder="e.g. Difficulty breathing during PE drills"></div>'+
      '<div class="fld"><label class="f" for="rSym">Observed condition / symptoms</label>'+
        '<textarea class="in" id="rSym" placeholder="What you observed"></textarea></div>'+
      '<div class="fld"'+(quick?' style="margin-bottom:0"':'')+'><label class="f" for="rAct">Actions taken</label>'+
        '<textarea class="in" id="rAct" placeholder="What you did"></textarea></div>'+
      rest+
      '<div id="rErr"></div>'+
    '</div>'+
    '<div class="row"><button class="btn dan" id="rSubmit">'+icon('check',17,'#fff')+'Submit report</button>'+
      toggle+
      '<button class="btn out" data-go="'+(S.sid?'qrt-record':'qrt-dashboard')+'">Cancel</button></div>');
}

function qrtConfirm(){
  var r=rep(S.rid), s=byId(r.sid);
  return shell('Report submitted','',
    '<div class="card" style="text-align:center;padding:40px 24px">'+
      '<div style="width:56px;height:56px;border-radius:16px;background:var(--grnb);display:flex;align-items:center;'+
        'justify-content:center;margin:0 auto">'+icon('check',26,'#1B5FA8')+'</div>'+
      '<h2 style="font-size:20px;margin-top:16px">Rescue report submitted</h2>'+
      '<p class="muted" style="max-width:48ch;margin:8px auto 0"><b class="mono">'+esc(r.id)+'</b> for '+
        esc(full(s))+' is now with the Clinic, marked <b>Pending Clinic Review</b>.</p>'+
      '<div class="row" style="justify-content:center;margin-top:22px">'+
        '<button class="btn" data-sid="'+s.id+'">Open student record</button>'+
        '<button class="btn out" data-rid="'+r.id+'">View report</button>'+
        '<button class="btn out" data-go="qrt-dashboard">Back to dashboard</button></div>'+
    '</div>'+
    '<div class="note info">'+icon('lock',18)+'<span><b>The medical record has not changed.</b>Only the Clinic '+
      'can update it.</span></div>');
}

function reportBlocks(r,s){
  var out='<div class="card"><div class="ct"><div><h2>'+esc(r.id)+' — '+esc(full(s))+'</h2>'+
    '<p><span class="mono">'+esc(s.id)+'</span> · '+esc(r.when)+' · '+esc(r.place)+'</p></div>'+
    '<span class="bdg '+statusClass(r.status)+'">'+esc(r.status)+'</span></div>'+
    '<div class="grid g3">'+kv('Submitted by',r.by)+kv('Reason for rescue',r.reason)+
      kv('Referred to Clinic',r.referred)+'</div></div>';
  out+='<div class="card"><div class="ct"><div><h2>Responder&rsquo;s report</h2>'+
    '<p>Observed at the scene</p></div>'+
    '<span class="prov q">'+icon('pulse',14)+'SQRT Observation</span></div>'+
    '<div class="grid g2">'+kv('Observed condition / symptoms',r.symptoms)+kv('Actions taken',r.actions)+'</div>'+
    '<div class="grid g2" style="margin-top:16px">'+kv('Immediate response / intervention',r.response)+
      kv('Additional notes',r.notes||'—')+'</div></div>';
  if(r.assessment){
    out+='<div class="card"><div class="ct"><div><h2>Clinic assessment</h2>'+
      '<p>Written by clinic staff</p></div>'+
      '<span class="prov a">'+icon('clip',14)+'Clinic Assessment</span></div>'+
      '<p style="margin:0 0 14px;line-height:1.65">'+esc(r.assessment)+'</p>'+
      '<div class="grid g2">'+kv('Assessed by',r.assessedBy)+kv('Assessed on',r.assessedAt,true)+'</div></div>';
  }else{
    out+='<div class="card"><div class="ct"><div><h2>Clinic assessment</h2>'+
      '<p>Added by clinic staff</p></div>'+
      '<span class="prov a">'+icon('clip',14)+'Clinic Assessment</span></div>'+
      '<div class="note warn">'+icon('alert',18)+'<span>Not yet assessed.</span></div></div>';
  }
  return out;
}

function qrtReportDetail(){
  var r=rep(S.rid); if(!r) return shell('Rescue report','','<div class="empty"><h3>Report not found.</h3></div>');
  var s=byId(r.sid);
  return shell('Rescue report '+r.id,'Read-only',
    reportBlocks(r,s)+
    '<div class="row"><button class="btn out" data-go="qrt-history">'+icon('back',17)+'Back to reports</button>'+
    '<button class="btn sec" data-sid="'+s.id+'">Open student record</button></div>');
}

function historyRows(){
  if(!RP().length) return '<div class="empty"><h3>No rescue reports yet.</h3><p>Reports you submit will appear here.</p></div>';
  var rows=sortReports(RP()).map(function(r){
    var s=byId(r.sid);
    return '<tr class="click" data-rid="'+r.id+'"><td class="mono"><b>'+esc(r.id)+'</b></td>'+
      '<td>'+esc(full(s))+'</td><td class="sm">'+esc(r.when)+'</td><td class="sm">'+esc(r.place)+'</td>'+
      '<td><span class="bdg '+statusClass(r.status)+'">'+esc(r.status)+'</span></td></tr>';
  }).join('');
  return '<div class="tw"><table><thead><tr><th>Report ID</th><th>Student</th><th>Date and time</th>'+
    '<th>Location</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

function qrtHistory(){
  return shell('Rescue reports','Submitted by the SQRT',
    '<div class="card">'+sortBar()+'</div>'+
    '<div id="rrows">'+historyRows()+'</div>'+
    '<p class="sm muted">Select a report to open it.</p>');
}
