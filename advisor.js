/* TickWealth Advisor: probability-based decision support. Add <script src="advisor.js"></script> after core.js.
   It shows the TRUE chance of a win, the break-even rate implied by the payout, the expected value, how unusual recent ticks are,
   and an optional rule alert with a countdown. It never predicts the next tick and never places trades. */
(function () {
  'use strict';
  if (!window.TW || TW.embed) return;
  const CT = { RISE: ['Rise', 'CALL'], FALL: ['Fall', 'PUT'], OVER: ['Over', 'DIGITOVER'], UNDER: ['Under', 'DIGITUNDER'], EVEN: ['Even', 'DIGITEVEN'], ODD: ['Odd', 'DIGITODD'], MATCH: ['Matches', 'DIGITMATCH'], DIFF: ['Differs', 'DIGITDIFF'] };
  const st = document.createElement('style');
  st.textContent = `.twa-btn{position:fixed;right:96px;bottom:14px;z-index:60;padding:10px 14px;border-radius:99px;border:1px solid #00b2ff;background:#0a0f1d;color:#00b2ff;font:600 13px system-ui;cursor:pointer}
  .twa-box{position:fixed;right:14px;bottom:60px;z-index:60;width:min(360px,calc(100vw - 28px));max-height:75vh;overflow:auto;background:rgba(10,15,29,.96);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:14px;color:#d7e0f2;font:13px/1.5 system-ui}
  .twa-box label{display:block;color:#7d8aa5;margin:8px 0 3px;font-size:12px}.twa-box select,.twa-box input[type=number]{width:100%;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.4);color:#d7e0f2}
  .twa-box button{padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.35);color:#d7e0f2;cursor:pointer;margin:6px 6px 0 0}
  .twa-row{display:flex;gap:8px}.twa-row>*{flex:1}.twa-line{margin:4px 0}.twa-cd{margin:8px 0;padding:8px;border-radius:8px;border:1px solid #00ffa3;color:#00ffa3;display:none}.twa-note{color:#7d8aa5;font-size:11px;margin-top:8px}`;
  document.head.appendChild(st);
  const btn = document.createElement('button'); btn.className = 'twa-btn'; btn.textContent = 'Advisor'; btn.setAttribute('aria-expanded', 'false');
  const box = document.createElement('div'); box.className = 'twa-box'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Advisor');
  box.innerHTML = `<b>Advisor (probability, not prediction)</b>
  <label for="twaM">Market</label><select id="twaM"></select>
  <div class="twa-row"><div><label for="twaC">Contract</label><select id="twaC"></select></div><div id="twaBw"><label for="twaB">Digit</label><select id="twaB"></select></div></div>
  <div class="twa-row"><div><label for="twaD">Ticks</label><input id="twaD" type="number" min="1" max="10" value="5"></div><div><label for="twaP">Payout % (estimate)</label><input id="twaP" type="number" min="1" value="92"></div></div>
  <button id="twaLive">Get live payout</button>
  <div id="twaOut"></div>
  <label><input id="twaArm" type="checkbox"> Alert me when a streak of </label><input id="twaN" type="number" min="2" max="12" value="3"><span class="twa-note"> matching ticks occurs (your rule)</span>
  <div class="twa-cd" id="twaCd" role="status"></div>
  <button id="twaTrack">Track a paper trade now</button><div class="twa-line" id="twaTally"></div>
  <div class="twa-note">Informational only. Ticks are random, so this panel cannot predict the next tick. A rule that fires is your rule, not a forecast.</div>`;
  document.body.append(btn, box);
  const $ = s => box.querySelector(s);
  btn.onclick = () => { box.hidden = !box.hidden; btn.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) { document.dispatchEvent(new CustomEvent('tw-panel', { detail: 'advisor' })); start(); } };
  document.addEventListener('tw-panel', e => { if (e.detail !== 'advisor') { box.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  const M = $('#twaM'), C = $('#twaC'), B = $('#twaB');
  TW.VOLS.filter(v => v.digits).forEach(v => M.add(new Option(v.name, v.id))); M.value = (TW.lastFeed && TW.lastFeed.symbol) || 'R_100';
  Object.keys(CT).forEach(k => C.add(new Option(CT[k][0], k))); for (let i = 0; i <= 9; i++) B.add(new Option(i, i)); B.value = 4;
  let F = null, streak = 0, cd = 0, cdT = null, track = null, tally = { n: 0, w: 0, net: 0 };
  const num = e => +$(e).value, ct = () => C.value, b = () => num('#twaB');
  const prob = () => ({ RISE: .5, FALL: .5, EVEN: .5, ODD: .5, MATCH: .1, DIFF: .9, OVER: (9 - b()) / 10, UNDER: b() / 10 }[ct()]);
  const cond = (c, bb, pr, pv, d) => c === 'RISE' ? pr > pv : c === 'FALL' ? pr < pv : c === 'OVER' ? d > bb : c === 'UNDER' ? d < bb : c === 'EVEN' ? d % 2 === 0 : c === 'ODD' ? d % 2 === 1 : c === 'MATCH' ? d === bb : d !== bb;
  const winV = (c, bb, p0, p1, d1) => c === 'RISE' ? p1 > p0 : c === 'FALL' ? p1 < p0 : cond(c, bb, 0, 0, d1);
  function wilson(k, n) { const z = 1.96, p = k / n, dn = 1 + z * z / n, cen = (p + z * z / (2 * n)) / dn, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / dn; return [cen - h, cen + h]; }
  function line(t) { const d = document.createElement('div'); d.className = 'twa-line'; d.textContent = t; return d; }
  function render() {
    const out = $('#twaOut'); out.textContent = ''; $('#twaBw').style.display = ['OVER', 'UNDER', 'MATCH', 'DIFF'].includes(ct()) ? '' : 'none';
    if (!F || F.prices.length < 30) { out.appendChild(line('Waiting for ticks...')); return; }
    const P = F.prices, D = F.digits, n = Math.min(200, P.length - 1), p = prob(), pay = num('#twaP') / 100, be = 1 / (1 + pay), ev = p * pay - (1 - p);
    let k = 0; for (let i = P.length - n; i < P.length; i++) if (cond(ct(), b(), P[i], P[i - 1], D[i])) k++;
    const o = k / n, [lo, hi] = wilson(k, n), z = (o - p) / Math.sqrt(p * (1 - p) / n);
    out.appendChild(line(`True chance of a win: ${(p * 100).toFixed(1)}%. Break-even needs: ${(be * 100).toFixed(1)}%.`));
    out.appendChild(line(`Expected result per 1 staked: ${ev >= 0 ? '+' : ''}${ev.toFixed(3)}${ev < 0 ? ' (a loss on average)' : ''}`));
    out.appendChild(line(`Last ${n} ticks: ${(o * 100).toFixed(1)}% matched (95% range ${(lo * 100).toFixed(0)} to ${(hi * 100).toFixed(0)}%).`));
    out.appendChild(line(Math.abs(z) < 2.5 ? 'Verdict: no measurable edge. Recent ticks are within normal random variation.' : 'Verdict: recent ticks are unusual, but ticks are independent, so this does not change the next result. Checking many contracts produces such deviations by chance.'));
    let K = 0, W = 0, s = 0, d = Math.max(1, num('#twaD')), N = num('#twaN'); // how your rule would have done on the loaded history
    for (let i = 1; i < P.length - d; i++) { s = cond(ct(), b(), P[i], P[i - 1], D[i]) ? s + 1 : 0; if (s === N) { K++; if (winV(ct(), b(), P[i], P[i + d], D[i + d])) W++; } }
    out.appendChild(line(K ? `Your rule on the last ${P.length} ticks: fired ${K} times, won ${(W / K * 100).toFixed(0)}% (break-even ${(be * 100).toFixed(0)}%)${K < 30 ? '. Too few to judge.' : '.'}` : `Your rule never fired in the last ${P.length} ticks.`));
  }
  function onTick(f, t) {
    const P = f.prices, i = P.length - 1; streak = cond(ct(), b(), P[i], P[i - 1], f.digits[i]) ? streak + 1 : 0;
    if (track && --track.left <= 0) { const w = winV(track.c, track.b, track.p0, t.price, t.digit), pay = num('#twaP') / 100; tally.n++; if (w) tally.w++; tally.net += w ? pay : -1;
      $('#twaTally').textContent = `Tracked paper trades: ${tally.n}, won ${tally.w}, net ${tally.net.toFixed(2)} units. Last: ${w ? 'win' : 'loss'}.`; track = null; }
    if ($('#twaArm').checked && streak === num('#twaN') && !cd) fire();
    render();
  }
  function fire() {
    const lbl = `${CT[ct()][0]}${['OVER', 'UNDER', 'MATCH', 'DIFF'].includes(ct()) ? ' ' + b() : ''} for ${num('#twaD')} tick(s)`, el = $('#twaCd'); cd = 10; el.style.display = 'block';
    const tick = () => { el.textContent = cd > 0 ? `Your rule fired: ${lbl}. This prompt stays valid for ${cd}s. Chance of a win is still ${(prob() * 100).toFixed(1)}%.` : 'Prompt expired.'; if (cd-- <= 0) { clearInterval(cdT); cd = 0; setTimeout(() => el.style.display = 'none', 1500); } };
    clearInterval(cdT); tick(); cdT = setInterval(tick, 1000);
  }
  function start() {
    if (F && F.symbol === M.value) return; if (F) F.close(); streak = 0;
    F = TW.tickFeed(M.value, { primary: false, count: 500, onHistory: render, onTick });
  }
  ['change', 'input'].forEach(e => box.addEventListener(e, ev => { if (ev.target === M) start(); else if (ev.target.id !== 'twaArm') { streak = 0; render(); } }));
  $('#twaTrack').onclick = () => { if (!F || !F.prices.length) return; track = { c: ct(), b: b(), p0: F.prices[F.prices.length - 1], left: Math.max(1, num('#twaD')) }; TW.toast && TW.toast('Tracking a paper trade for ' + track.left + ' tick(s)', 'ok', 3000); };
  $('#twaLive').onclick = () => {
    const x = CT[ct()][1], hasB = ['OVER', 'UNDER', 'MATCH', 'DIFF'].includes(ct()), q = { proposal: 1, basis: 'stake', amount: 1, currency: TW.account.currency || 'USD', contract_type: x, duration: num('#twaD'), duration_unit: 't', [TW.symKey()]: M.value };
    if (hasB) q.barrier = String(b());
    TW.req(q).then(r => { $('#twaP').value = ((r.proposal.payout / r.proposal.ask_price - 1) * 100).toFixed(1); render(); }).catch(e => TW.toast && TW.toast('Live payout unavailable: ' + e.message, 'err', 5000));
  };
})();
