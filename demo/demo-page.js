/* Shared script for the Hide & Sneak demo pages: on/off bar, activity feed, submit preview. */
(function () {
  const D = window.HNS_DEMO;
  document.getElementById('state').innerHTML = D.on
    ? 'Protection <b class="on">ON</b>: this is what an AI agent would see.'
    : 'Protection <b class="off">OFF</b>: this is the raw page.';
  const t = document.getElementById('toggle');
  t.textContent = D.on ? 'Turn protection off' : 'Turn protection on';
  t.href = location.pathname + (D.on ? '?protect=off' : '');

  const feed = document.getElementById('feed');
  const LABEL = { 'field-locked': ['lock', 'Protected'], 'field-cleared': ['lock', 'Cleared'], 'lock-bypass-cleared': ['block', 'Blocked a write to'], 'redact': ['text', 'Hid'], 'page-blocked': ['block', 'Blocked page'] };
  function addHits(entries) {
    if (feed.firstElementChild && feed.firstElementChild.classList.contains('muted')) feed.innerHTML = '';
    for (const e of entries) {
      const [cls, verb] = LABEL[e.effect] || ['text', e.effect];
      const li = document.createElement('li');
      const what = e.field ? `${e.field}` : (e.token ? `${e.token}` : '');
      li.innerHTML = `<span class="pill ${cls}"></span><span></span>`;
      li.firstChild.textContent = verb;
      li.lastChild.textContent = what + (e.pack ? `  (${e.pack})` : '');
      feed.appendChild(li);
    }
  }
  document.addEventListener('hns-demo-hits', (ev) => addHits(ev.detail));
  if (D.extension) {
    document.getElementById('state').innerHTML =
      'Your <b class="on">Hide &amp; Sneak extension</b> is protecting this page (Agent Mode is on). Turn Agent Mode off in the extension to use this demo\'s toggle.';
    t.style.display = 'none';
    feed.innerHTML = '<li class="muted">Your installed extension is handling this page, so its activity shows in the extension\'s Activity log instead of here.</li>';
  } else if (!D.on) feed.innerHTML = '<li class="muted">Protection is off. Nothing is hidden or locked.</li>';

  const submit = document.getElementById('submit');
  if (submit) submit.addEventListener('click', () => {
    const fd = new FormData(document.getElementById('app'));
    const obj = {};
    for (const [k, v] of fd.entries()) if (v !== '') obj[k] = v;
    document.getElementById('out').textContent = JSON.stringify(obj, null, 2) || '{}';
  });
})();
