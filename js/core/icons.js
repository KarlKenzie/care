/* ICONS — tanang SVG icon nga gigamit sa sistema. Gamita: CARE.icon('home', 18, '#fff') */
window.CARE = window.CARE || {};
(function () {
  function icon(n, s, c) {
    var p = {
      home:'<path d="M4 10.6 12 4l8 6.6V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19z"/>',
      search:'<circle cx="11" cy="11" r="6.6"/><path d="m20.2 20.2-4.5-4.5"/>',
      file:'<path d="M14 3.2H7.4A1.4 1.4 0 0 0 6 4.6v14.8a1.4 1.4 0 0 0 1.4 1.4h9.2a1.4 1.4 0 0 0 1.4-1.4V7.2z"/><path d="M13.8 3.2v4h4.2"/><path d="M9 12.6h6M9 16.2h4"/>',
      users:'<circle cx="9.2" cy="8.4" r="3.2"/><path d="M3.4 19.8c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4"/><path d="M16.4 5.6a3.1 3.1 0 0 1 .2 6"/><path d="M17.6 19.8c0-2-.6-3.6-1.7-4.7"/>',
      shield:'<path d="M12 3.2 5 6.1v6.2c0 4.4 2.9 7.9 7 9.3 4.1-1.4 7-4.9 7-9.3V6.1z"/><path d="M9.2 12.4h1.9l1.1-2.4 1.6 4.6 1.2-2.5"/>',
      lock:'<rect x="5" y="10.4" width="14" height="10" rx="2"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
      pulse:'<path d="M3 12.2h4l2.2-5.4 3.6 10.4 2.4-5h5.8"/>',
      plus:'<path d="M12 5.4v13.2M5.4 12h13.2"/>',
      edit:'<path d="M4.4 19.6h3.9L19 8.9a2 2 0 0 0-2.9-2.9L5.4 16.7z"/><path d="m15.4 7 2.6 2.6"/>',
      chev:'<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
      back:'<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
      check:'<circle cx="12" cy="12" r="8.4"/><path d="m8.4 12.1 2.5 2.5 4.7-4.9"/>',
      alert:'<path d="M12 4.2 3.1 19.8h17.8z"/><path d="M12 10.2v4"/><circle cx="12" cy="17" r=".95" fill="currentColor" stroke="none"/>',
      clip:'<rect x="6" y="4.6" width="12" height="15.4" rx="1.8"/><path d="M9.4 4.6a2.6 2.6 0 0 1 5.2 0"/><path d="M9.2 12h5.6M9.2 15.4h3.6"/>',
      user:'<circle cx="12" cy="8.2" r="3.5"/><path d="M5.2 20c0-3.5 3-6 6.8-6s6.8 2.5 6.8 6"/>',
      out:'<path d="M14.6 16.4v2.2a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8V5.4a1.8 1.8 0 0 1 1.8-1.8h6.6a1.8 1.8 0 0 1 1.8 1.8v2.2"/><path d="M18.4 12H9.2m9.2 0-3-3m3 3-3 3"/>',
      clock:'<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6v4.8l3.1 1.7"/>',
      x:'<path d="M6.6 6.6 17.4 17.4M17.4 6.6 6.6 17.4"/>',
      eye:'<path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.8"/>'
    }[n];
    return '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="' + (c || 'currentColor') +
           '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  CARE.icon = icon;
})();
