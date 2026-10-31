/* Pillar manifest and error boundary. Each pillar is its own page; if one fails it shows a notice and the rest keep working. */
TW.PILLARS = [
  { id: 'rise-fall', name: 'Rise/Fall', href: 'rise-fall.html' }, { id: 'over-under', name: 'Over/Under', href: 'over-under.html' },
  { id: 'even-odd', name: 'Even/Odd', href: 'even-odd.html' }, { id: 'matches-differs', name: 'Matches/Differs', href: 'matches-differs.html' },
  { id: 'analyzer', name: 'Analyzer', href: 'analyzer.html' }, { id: 'playbook', name: 'Playbook', href: 'playbook.html' },
  { id: 'insight', name: 'Insight Lab', href: 'insight.html' }, { id: 'bots', name: 'Bots', href: 'bots-library.html' }, { id: 'diagnostics', name: 'Diagnostics', href: 'diagnostics.html' }
];
TW.guard = function (name, fn) {
  const fail = e => { console.error(name, e); const d = document.createElement('div'); d.setAttribute('role', 'alert');
    d.style.cssText = 'margin:14px auto;max-width:1100px;padding:14px;border:1px solid #ff3b69;border-radius:12px;background:rgba(255,59,105,.08);color:#d7e0f2;font:14px system-ui';
    d.textContent = name + ' hit a problem and stopped: ' + ((e && e.message) || e) + '. The rest of the site still works.'; (document.getElementById('app') || document.body).prepend(d); };
  try { const r = fn(); if (r && r.catch) r.catch(fail); } catch (e) { fail(e); }
};
