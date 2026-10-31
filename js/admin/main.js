/* MAIN — start the administrator site: ask the server who is signed in, load data, draw the first screen */
(function () {
  CARE.db.init().then(function () {
    CARE.admin.S.me = CARE.auth.current();      // still signed in from before? (cookie on the server)
    CARE.admin.render();
  }).catch(function () {
    document.getElementById('app').innerHTML =
      '<div style="max-width:520px;margin:80px auto;padding:0 20px"><div class="note red">' + CARE.icon('alert', 18) +
      '<span><b>Cannot reach the CARE server</b>Start it with <code>python server.py</code> and open the address it prints. ' +
      'Opening the HTML file directly, or using Live Server / <code>http.server</code>, will not work any more.</span></div></div>';
  });
})();
