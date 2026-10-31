/* SHELL — sidebar, topbar ug mobile nav */

function shell(title,sub,body,actions){
  var u=me(), root=rootOf(S.view);
  var nav=NAV[S.role].map(function(n){
    return '<a data-go="'+n[0]+'" class="'+(root===n[0]?'on':'')+'">'+icon(n[2],18,root===n[0]?'#C8A02E':'rgba(255,255,255,.72)')+
           '<span>'+n[1]+'</span></a>'; }).join('');
  var mnav=MNAV[S.role].map(function(n){
    return '<a data-go="'+n[0]+'" class="'+(root===n[0]?'on':'')+'">'+icon(n[2],21)+'<span>'+n[1]+'</span><i></i></a>';
  }).join('')+'<a data-go="logout">'+icon('out',21)+'<span>Sign out</span><i></i></a>';
  var flash = S.flash ? '<div class="note ok">'+icon('check',18)+'<span>'+esc(S.flash)+'</span></div>' : '';
  return '<div class="shell"><aside class="side">'+
    '<div class="brand"><div><div class="w">CARE</div>'+
      '<div class="s">Campus Assistance &amp; Response Environment</div>'+
      '<div class="c">CTU – Consolacion Campus</div></div></div>'+
    '<span class="chip '+S.role+'">'+icon('shield',14)+(S.role==='qrt'?'SQRT RESPONDER':'CLINIC STAFF')+'</span>'+
    '<nav class="nav">'+nav+'</nav>'+
    '<div class="foot"></div><div class="tswitch" id="themeswitch"><span>'+(S.dark?'Dark mode':'Light mode')+'</span>'+
      '<span class="tr"><i></i></span></div>'+
    '<div class="who whoclick" data-go="profile"><span class="av">'+u.init+'</span>'+
      '<div><div class="n">'+esc(u.name)+'</div>'+
      '<div class="r">'+esc(u.role)+' · '+esc(u.idno)+'</div></div>'+
      icon('chev',16,'rgba(255,255,255,.45)')+'</div>'+
    '<div class="sout" data-go="logout">'+icon('out',18,'rgba(255,255,255,.66)')+'<span>Sign Out</span></div>'+
    '</aside><div class="main">'+
    '<header class="top"><div style="display:flex;align-items:center;gap:12px;min-width:0">'+
      (S.hist.length ? '<button class="iback" id="back" aria-label="Go back">'+icon('back',19)+'</button>' : '')+
      '<div><h1>'+esc(title)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div></div>'+
      '<div class="row">'+(actions||'')+'</div></header>'+
    '<div class="body">'+flash+body+'</div></div>'+
    '<nav class="mnav">'+mnav+'</nav>'+(S.pwModal?CARE.pwUI.modal():'')+'</div>';
}
