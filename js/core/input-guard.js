/* INPUT GUARD — ang mga field sa ngalan (first/last name) letra ra ang madawat */
window.CARE = window.CARE || {};

(function () {
  // Gitugotan: letra (lakip ang ñ, é), space, hyphen (-), apostrophe (') ug tuldok (.) — pananglitan "Dela Peña", "O'Brien", "Ma. Luisa"
  var NOT_ALLOWED = /[^\p{L}\p{M}\s'.\-]/gu;
  var HAS_BAD = /[^\p{L}\p{M}\s'.\-]/u;

  function names(ids) {
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;

      // Ang warning: tago hangtod naay sayop nga gi-type
      var warn = document.createElement('div');
      warn.className = 'field-warn';
      warn.setAttribute('role', 'alert');
      warn.innerHTML = CARE.icon('alert', 14) + '<span>Letters only. Numbers and symbols are not allowed in names.</span>';
      el.parentNode.appendChild(warn);

      el.addEventListener('input', function (e) {
        if (e.isComposing) return;                       // ayaw samoka ang IME typing
        var bad = HAS_BAD.test(el.value);
        var clean = el.value.replace(NOT_ALLOWED, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
        if (clean !== el.value) {
          var pos = Math.max(0, el.selectionStart - (el.value.length - clean.length));
          el.value = clean;
          el.setSelectionRange(pos, pos);
        }
        warn.classList.toggle('show', bad);              // ipakita ra kung naay gi-block
      });
      el.addEventListener('blur', function () { warn.classList.remove('show'); });
    });
  }


  // Emergency contact: digits only (11 digits, starts with 09). Anything else is removed as the person types or pastes.
  function phone(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('inputmode', 'numeric'); el.setAttribute('maxlength', '11'); el.setAttribute('autocomplete', 'off');
    var warn = document.createElement('div');
    warn.className = 'field-warn'; warn.setAttribute('role', 'alert');
    warn.innerHTML = CARE.icon('alert', 14) + '<span>Numbers only.</span>';
    el.parentNode.appendChild(warn);
    el.addEventListener('input', function () {
      var bad = /[^0-9]/.test(el.value);
      if (bad) el.value = el.value.replace(/[^0-9]/g, '').slice(0, 11);
      warn.classList.toggle('show', bad);
    });
    el.addEventListener('blur', function () { warn.classList.remove('show'); });
  }

  // Same rule as the server (the server always re-checks). Returns an error text or null.
  function phoneProblem(v) {
    v = (v || '').trim();
    if (!v) return 'Enter the emergency contact number.';
    if (!/^[0-9]+$/.test(v)) return 'Emergency contact must contain numbers only (no letters, spaces, dashes or +).';
    if (v.length !== 11 || v.indexOf('09') !== 0) return 'Enter a valid 11-digit mobile number that starts with 09 (example: 09171234567).';
    if (/^(.)\1+$/.test(v.slice(2))) return 'That contact number does not look real. Please check it.';
    return null;
  }

  CARE.guard = { names: names, phone: phone, phoneProblem: phoneProblem };
})();
