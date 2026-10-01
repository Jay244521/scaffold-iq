(function () {
  document.documentElement.classList.remove('no-js');

  // Mobile navigation
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Optional Turnstile: only loads if a public site key is set in index.html
  var slot = document.getElementById('turnstile-slot');
  var siteKey = slot && slot.getAttribute('data-sitekey');
  if (siteKey) {
    slot.className = 'cf-turnstile';
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  // Inquiry form
  var form = document.getElementById('inquiry-form');
  var status = document.getElementById('form-status');
  var btn = document.getElementById('submit-btn');
  if (!form) return;

  function say(msg, type) {
    status.textContent = msg;
    status.className = 'status ' + (type || '');
    status.focus();
  }

  // Handle no-JS redirect results (?sent=1 / ?error=1)
  var params = new URLSearchParams(location.search);
  if (params.get('sent')) say('Thanks. Your inquiry was sent. We\u2019ll follow up by email.', 'ok');
  if (params.get('error')) say('Something went wrong. Please try again or email us directly.', 'err');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var required = form.querySelectorAll('[required]');
    var firstBad = null;
    required.forEach(function (el) {
      var bad = !el.value.trim() || (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) {
      say('Please complete the highlighted required fields.', 'err');
      firstBad.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending\u2026';
    fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.ok) {
          form.reset();
          if (window.turnstile) window.turnstile.reset();
          say('Thanks. Your inquiry was sent. We\u2019ll follow up by email.', 'ok');
        } else {
          say((res.d && res.d.message) || 'Something went wrong. Please try again.', 'err');
        }
      })
      .catch(function () { say('Network error. Please try again or email us directly.', 'err'); })
      .finally(function () { btn.disabled = false; btn.textContent = 'Send inquiry'; });
  });
})();
