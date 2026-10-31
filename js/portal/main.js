/* MAIN — dinhi magsugod ang SQRT/Clinic portal */
CARE.db.init().then(function () {
  var a = CARE.auth.current();                  // still signed in from before? (cookie on the server)
  if (a && a.role !== 'ADMIN') {
    S.me = a;
    S.role = a.role === 'SQRT' ? 'qrt' : 'clinic';
    S.view = S.role === 'qrt' ? 'qrt-dashboard' : 'clinic-dashboard';
  }
  render();
}).catch(function () {
  document.getElementById('app').innerHTML =
    '<div style="max-width:520px;margin:80px auto;padding:0 20px"><div class="note red">' + icon('alert', 18) +
    '<span><b>Cannot reach the CARE server</b>Start it with <code>python server.py</code> and open the address it prints. ' +
    'Opening the HTML file directly, or using Live Server / <code>http.server</code>, will not work any more.</span></div></div>';
});

// If the server says the session ended (expired, deactivated, signed out elsewhere) go back to the sign-in screen
CARE.onSignedOut = function () { S.me = null; S.role = null; S.view = 'login'; S.hist = []; S.loginErr = 'Your session has ended. Please sign in again.'; render(); };
