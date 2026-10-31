/* TickWealth coach: browser client for TW.ai.
   Default: an on-device explainer that uses the numbers on your screen. Optional: set aiEndpoint in config.js to the
   proxy in server/ai-proxy.js for full AI answers (the API key stays on that server). It never predicts ticks and never trades. */
(function () {
  'use strict';
  if (!window.TW || TW.embed) return;
  const st = document.createElement('style');
  st.textContent = '.tc-btn{position:fixed;right:14px;bottom:14px;z-index:60;padding:10px 14px;border-radius:99px;border:1px solid #00ffa3;background:#0a0f1d;color:#00ffa3;font:600 13px system-ui;cursor:pointer}' +
    '.tc-box{position:fixed;right:14px;bottom:60px;z-index:60;width:min(380px,calc(100vw - 28px));height:min(460px,70vh);display:flex;flex-direction:column;background:rgba(10,15,29,.97);border:1px solid rgba(255,255,255,.14);border-radius:14px;color:#d7e0f2;font:13px/1.5 system-ui}' +
    '.tc-box[hidden]{display:none}.tc-log{flex:1;overflow:auto;padding:12px}.tc-m{margin:0 0 10px;padding:8px 10px;border-radius:10px;white-space:pre-wrap}.tc-u{background:rgba(0,178,255,.15);margin-left:30px}.tc-a{background:rgba(255,255,255,.06);margin-right:30px}' +
    '.tc-in{display:flex;gap:6px;padding:8px;border-top:1px solid rgba(255,255,255,.1)}.tc-in input{flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.4);color:#d7e0f2}.tc-in button{padding:8px 12px;border-radius:8px;border:1px solid #00ffa3;background:transparent;color:#00ffa3;cursor:pointer}' +
    '.tc-q{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 8px}.tc-q button{padding:4px 9px;border-radius:99px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#9fb0cc;font-size:11px;cursor:pointer}';
  document.head.appendChild(st);
  const btn = document.createElement('button'); btn.className = 'tc-btn'; btn.textContent = 'Coach'; btn.setAttribute('aria-expanded', 'false');
  const box = document.createElement('div'); box.className = 'tc-box'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'TickWealth coach');
  const log = document.createElement('div'); log.className = 'tc-log'; log.setAttribute('aria-live', 'polite');
  const qs = document.createElement('div'); qs.className = 'tc-q';
  const form = document.createElement('div'); form.className = 'tc-in'; const inp = document.createElement('input'); inp.placeholder = 'Ask about the numbers, contracts or risk'; inp.setAttribute('aria-label', 'Question'); const go = document.createElement('button'); go.textContent = 'Ask'; form.append(inp, go);
  box.append(log, qs, form); document.body.append(btn, box);
  const hist = [];
  const add = (cls, t) => { const m = document.createElement('div'); m.className = 'tc-m ' + cls; m.textContent = t; log.appendChild(m); log.scrollTop = log.scrollHeight; };
  function ctx() { const f = TW.lastFeed, o = { page: location.pathname.split('/').pop() || 'index.html', mode: TW.mode ? TW.mode() : 'paper' };
    if (f && f.digits && f.digits.length) { const c = Array(10).fill(0); f.digits.forEach(d => c[d]++); o.market = f.symbol; o.ticks = f.digits.length; o.digitSharesPct = c.map(v => +(v / f.digits.length * 100).toFixed(1)); o.lastDigit = f.digits[f.digits.length - 1]; } return o; }
  function local(q) {
    q = q.toLowerCase(); const c = ctx(), has = (...w) => w.some(x => q.includes(x)), tail = '\n\nThese numbers describe the past. They do not predict the next tick.';
    if (has('predict', 'next tick', 'will it', 'guarantee', 'sure win', 'profit')) return 'No tool can predict the next tick on Deriv synthetic indices. Each tick is random and independent, and payouts include a margin, so trading is expected to lose money over time. Use paper mode, keep stakes small and set a stop-loss.';
    if (has('martingale', 'double')) return 'Martingale multiplies the stake after each loss. A short losing run can use up the balance, and the Risk simulator in Insight Lab shows how often that happens. If you use it, cap the steps and test on paper first.';
    if (has('lose', 'loss', 'chasing', 'recover', 'stressed', 'gambl')) return 'Losses are part of this, and chasing them makes things worse. This is a good moment to stop for today and keep your daily loss cap. If trading is affecting your money or mood, talk to someone you trust. Kenya Red Cross counselling (1199) is free if you need to talk.';
    if (has('over', 'under', 'barrier')) return 'Over/Under compares the last digit with a barrier. Under 7 wins on 0 to 6 (70% true chance); Over 2 wins on 3 to 9 (70%). Higher chance means lower payout, so one loss erases several wins.' + tail;
    if (has('even', 'odd')) return 'Even/Odd wins when the last digit is even (0,2,4,6,8) or odd (1,3,5,7,9). The true chance is 50% after any streak, because digits have no memory.' + tail;
    if (has('match', 'differ')) return 'Matches wins if the last digit equals your digit (10% chance, big payout). Differs wins if it does not (90% chance, small payout, so one loss erases about 10 wins).' + tail;
    if (has('rise', 'fall', 'momentum', 'chart', 'rsi', 'macd', 'average', 'bollinger')) return 'Rise/Fall wins if the exit price is above (Rise) or below (Fall) the entry. Indicators such as MA, RSI and MACD summarise past prices. On a random walk they do not change the 50/50 chance of the next move.' + tail;
    if (c.ticks) { const s = c.digitSharesPct, hot = s.indexOf(Math.max(...s)), cold = s.indexOf(Math.min(...s)); return 'On ' + c.market + ', over the last ' + c.ticks + ' ticks the most frequent digit is ' + hot + ' (' + s[hot] + '%) and the rarest is ' + cold + ' (' + s[cold] + '%). The true chance of every digit is 10%, so gaps like this are normal random variation.' + tail; }
    return 'Open a market first and I can explain its numbers. I can also explain contract types, risk, Martingale and what statistics can and cannot tell you.';
  }
  async function answer(q) { const ep = (TW.settings && TW.settings.aiEndpoint) || (window.TW_CONFIG && window.TW_CONFIG.aiEndpoint) || '';
    if (ep) { try { const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: hist.slice(-8), context: ctx() }) }); const j = await r.json(); if (r.ok && j.reply) return j.reply; } catch (e) { /* fall back */ } }
    return local(q); }
  async function send(q) { q = (q || '').trim(); if (!q) return; add('tc-u', q); hist.push({ role: 'user', content: q }); inp.value = ''; const a = await answer(q); hist.push({ role: 'assistant', content: a }); add('tc-a', a); }
  ['Explain these numbers', 'What is Under 7?', 'Why can nothing predict ticks?', 'Is Martingale safe?'].forEach(t => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => send(t); qs.appendChild(b); });
  const open = () => { document.dispatchEvent(new CustomEvent('tw-panel', { detail: 'coach' })); box.hidden = false; btn.setAttribute('aria-expanded', 'true'); if (!log.children.length) add('tc-a', 'Hi, I am the TickWealth coach. I explain the numbers on your screen, the contract types and the risks. I cannot predict ticks or place trades.'); inp.focus(); };
  btn.onclick = () => { if (box.hidden) open(); else { box.hidden = true; btn.setAttribute('aria-expanded', 'false'); } };
  go.onclick = () => send(inp.value); inp.onkeydown = e => { if (e.key === 'Enter') send(inp.value); };
  document.addEventListener('tw-panel', e => { if (e.detail !== 'coach') { box.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  TW.ai = { ask: q => { open(); send(q); }, open };
})();
