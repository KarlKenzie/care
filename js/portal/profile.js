/* PROFILE — detalye sa user ug Change password */

function viewProfile(){
  var u=me();
  var msg = S.pwMsg
    ? '<div class="note '+(S.pwMsg.ok?'ok':'red')+'" style="margin-bottom:14px">'+
      icon(S.pwMsg.ok?'check':'alert',18)+'<span>'+esc(S.pwMsg.text)+'</span></div>'
    : '';
  var det = '<div class="card">'+
    '<div style="display:flex;align-items:center;gap:15px">'+
      '<span class="av" style="width:56px;height:56px;border-radius:15px;font-size:19px;background:var(--navy)">'+
      u.init+'</span>'+
      '<div><h2 style="font-size:21px;font-weight:600">'+esc(u.name)+'</h2>'+
      '<p class="sm muted" style="margin:4px 0 0">'+esc(u.role)+'</p></div></div>'+
    '<div style="height:1px;background:var(--line2);margin:18px 0"></div>'+
    '<div class="grid g3">'+
      kv('Username',u.user,true)+kv('ID number',u.idno,true)+
      kv('Role',S.role==='qrt'?'SQRT Responder':'Clinic Staff')+
      kv('Department',u.dept)+
      kv('Account status','Active')+kv('Issued by','University Clinic')+
    '</div>'+
    '<div class="note info" style="margin-top:18px">'+icon('lock',18)+
      '<span>Your details are maintained by the University Clinic. '+
      'You can change your password here.</span></div></div>';

  // Ang button nga mo-open sa pop-up
  var pw = '<div class="card"><div class="ct"><div><h2>Password</h2>'+
    '<p>Choose your own password</p></div>'+
    '<button class="btn" id="pwopen">'+icon('lock',17,'#fff')+'Change password</button></div></div>';

  return shell('Profile',u.name, msg+det+pw);
}
