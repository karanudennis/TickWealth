/* TickWealth core — NEW Deriv OAuth2 OTP Support - FIXED 10/30/2026
 * Worker: https://tickwealth-auth.karanud96.workers.dev
 * FIXES: Line 21 binaryws + Line 43 tickUrl + Line 83 urlOverride + Line 328 NO CORS */
(function () {
  'use strict';
  const TW = (window.TW = {});

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    sdel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  TW.store = store;

  const DEF = {
    endpoint: 'wss://api.derivws.com/trading/v1/options/ws/public',
    appId: '34OhVj79ZLhfAq3EeoraT',
    oauthAppId: '34OhVj79ZLhfAq3EeoraT',
    mode: 'paper',
    confirm: true,
    maxStake: 10,
    stopLoss: 20,
    martMult: 2, martSteps: 3,
    paperStart: 10000,
    rememberToken: false
  };
  let saved = {};
  try { saved = JSON.parse(store.get('tw_settings') || '{}') || {}; } catch (e) {}
  TW.settings = Object.assign({}, DEF, saved);
  TW.settings.oauthAppId = '34OhVj79ZLhfAq3EeoraT';
  if (!TW.settings.appId || TW.settings.appId === '1089') TW.settings.appId = DEF.appId; // old saved test ID
  TW.settings.endpoint = DEF.endpoint; // old saved endpoints (ws.binaryws.com) must not override the new one
  TW.DEFAULTS = DEF;
  TW.saveSettings = () => store.set('tw_settings', JSON.stringify(TW.settings));
  
  // NEW: wsUrl now supports OTP
  TW.LEGACY = 'wss://ws.binaryws.com/websockets/v3?app_id=1089'; // fallback for public data only
  TW.wsUrl = () => store.sget('tw_ws_url') || TW.settings.endpoint; // authenticated OTP URL when logged in
  TW.tickUrl = () => TW.settings.endpoint;
  TW.symKey = () => store.sget('tw_ws_url') ? 'underlying_symbol' : 'symbol'; // new API renamed symbol

  TW.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TW.qs = () => { const o = {}; new URLSearchParams(location.search).forEach((v, k) => (o[k] = v)); return o; };
  TW.embed = TW.qs().embed === '1';
  if (TW.embed) document.documentElement.classList.add('embed');
  TW.ready = fn => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());
  TW.money = (n, c) => (n < 0 ? '-' : '') + (c ? '' : '$') + Math.abs(+n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (c ? ' ' + c : '');
  const $ = (s, r) => (r || document).querySelector(s);
  TW.$ = $;
  const ev = {};
  TW.on = (n, f) => { (ev[n] = ev[n] || []).push(f); };
  const emit = (n, a) => (ev[n] || []).forEach(f => { try { f(a); } catch (e) { console.error(e); } });

  TW.VOLS = [
    { id: 'R_10', name: 'Volatility 10 Index', digits: true }, { id: 'R_25', name: 'Volatility 25 Index', digits: true },
    { id: 'R_50', name: 'Volatility 50 Index', digits: true }, { id: 'R_75', name: 'Volatility 75 Index', digits: true },
    { id: 'R_100', name: 'Volatility 100 Index', digits: true },
    { id: '1HZ10V', name: 'Volatility 10 (1s) Index', digits: true }, { id: '1HZ25V', name: 'Volatility 25 (1s) Index', digits: true },
    { id: '1HZ50V', name: 'Volatility 50 (1s) Index', digits: true }, { id: '1HZ75V', name: 'Volatility 75 (1s) Index', digits: true },
    { id: '1HZ100V', name: 'Volatility 100 (1s) Index', digits: true },
    { id: '1HZ150V', name: 'Volatility 150 (1s) Index', digits: true },
    { id: '1HZ250V', name: 'Volatility 250 (1s) Index', digits: true },
    { id: 'BOOM500', name: 'Boom 500 Index' }, { id: 'BOOM1000', name: 'Boom 1000 Index' },
    { id: 'CRASH500', name: 'Crash 500 Index' }, { id: 'CRASH1000', name: 'Crash 1000 Index' },
    { id: 'RDBULL', name: 'Bull Market Index' }, { id: 'RDBEAR', name: 'Bear Market Index' }
  ];
  TW.volName = id => (TW.VOLS.find(v => v.id === id) || { name: id }).name;
  TW.DIGIT_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'].map(c => ({ c, bg: `linear-gradient(135deg,${c},${c}bb)` }));
  TW.digitOf = (q, pip) => { const s = Number(q).toFixed(pip == null ? 2 : pip); return +s[s.length - 1]; };

  class Socket {
    constructor(o) { this.o = o; this.closed = false; this.tries = 0; this.ws = null; this.urlOverride = o.url || null; this.open(); }
    status(s, msg) { this.state = s; this.o.onStatus && this.o.onStatus(s, msg); }
    open() {
      if (this.closed) return;
      this.status(this.tries > 2 ? 'offline' : 'connecting');
      let ws;
      let targetUrl = this.urlOverride || TW.wsUrl();
      if (!store.sget('tw_ws_url') && this.tries >= 2 && this.tries % 2 === 0) targetUrl = TW.LEGACY;
      try { ws = new WebSocket(targetUrl); } catch (e) { this.status('error', e.message); return this.retry(); }
      this.ws = ws;
      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.tries = 0; this.status('live');
        clearInterval(this.ping); this.ping = setInterval(() => this.send({ ping: 1 }), 25000);
        this.o.onOpen && this.o.onOpen(this);
      };
      ws.onmessage = e => {
        if (this.ws !== ws) return;
        let d; try { d = JSON.parse(e.data); } catch (_) { return; }
        this.o.onMessage && this.o.onMessage(d, this);
      };
      ws.onclose = () => { if (this.ws !== ws || this.closed) return; clearInterval(this.ping); this.retry(); };
      ws.onerror = () => {};
    }
    retry() {
      if (this.closed) return;
      this.status(this.tries >= 2 ? 'offline' : 'reconnecting');
      const delay = Math.min(15000, 1000 * Math.pow(2, this.tries++));
      clearTimeout(this.timer); this.timer = setTimeout(() => this.open(), delay);
    }
    send(obj) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(obj)); return true; } return false; }
    close() {
      this.closed = true; clearTimeout(this.timer); clearInterval(this.ping);
      const ws = this.ws; this.ws = null;
      if (ws) { ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(); } catch (e) {} }
    }
  }
  TW.Socket = Socket;

  TW.tickFeed = function (symbol, h) {
    h = h || {};
    const st = { symbol, pip: 2, prices: [], digits: [], epochs: [], status: 'connecting', error: '' };
    const max = h.max || 1000;
    st.sock = new Socket({
      url: TW.tickUrl(),
      onStatus: (s, m) => { st.status = s; if ((s === 'live' || s === 'error') && TW.setStatus) TW.setStatus(s, m); h.onStatus && h.onStatus(s, m); },
      onOpen: s => s.send({ ticks_history: symbol, end: 'latest', count: h.count || 500, style: 'ticks', subscribe: 1 }),
      onMessage: d => {
        if (d.error) { st.error = d.error.message || d.error.code; h.onError && h.onError(st.error, d.error); return; }
        if (d.msg_type === 'history' && d.history) {
          if (d.pip_size != null) st.pip = d.pip_size;
          st.prices = d.history.prices.map(Number); st.epochs = d.history.times.map(Number);
          st.digits = st.prices.map(p => TW.digitOf(p, st.pip)); st.error = '';
          h.onHistory && h.onHistory(st);
        } else if (d.msg_type === 'tick' && d.tick) {
          if (d.tick.symbol && d.tick.symbol !== symbol) return;
          if (d.tick.pip_size != null) st.pip = d.tick.pip_size;
          const price = Number(d.tick.quote), digit = TW.digitOf(price, st.pip), epoch = d.tick.epoch;
          st.prices.push(price); st.digits.push(digit); st.epochs.push(epoch);
          if (st.prices.length > max) { st.prices.shift(); st.digits.shift(); st.epochs.shift(); }
          h.onTick && h.onTick(st, { price, digit, epoch });
        }
      }
    });
    st.close = () => st.sock.close();
    if (h.primary !== false) TW.lastFeed = st;
    return st;
  };

  TW.analyze = function (digits) {
    const n = digits.length, cnt = Array(10).fill(0), wc = Array(10).fill(0);
    let W = 0;
    digits.forEach((d, i) => { const w = i >= n - 50 ? 2 : 1; cnt[d]++; wc[d] += w; W += w; });
    const f = wc.map(x => (W ? x / W : 0));
    const sum = fn => f.reduce((a, x, d) => a + (fn(d) ? x : 0), 0);
    return { n, cnt, f, sum,
      hot: f.indexOf(Math.max.apply(null, f)), cold: f.indexOf(Math.min.apply(null, f)),
      pEven: sum(d => d % 2 === 0), pOver: b => sum(d => d > b), pUnder: b => sum(d => d < b) };
  };
  TW.candidates = function (a, barrier) {
    const L = [];
    L.push({ market: 'Even/Odd', place: 'EVEN', type: 'DIGITEVEN', page: 'even-odd.html', heat: a.pEven - 0.5 });
    L.push({ market: 'Even/Odd', place: 'ODD', type: 'DIGITODD', page: 'even-odd.html', heat: 1 - a.pEven - 0.5 });
    if (barrier <= 8) L.push({ market: 'Over/Under', place: 'OVER ' + barrier, type: 'DIGITOVER', barrier, page: 'over-under.html', heat: a.pOver(barrier) - (9 - barrier) / 10 });
    if (barrier >= 1) L.push({ market: 'Over/Under', place: 'UNDER ' + barrier, type: 'DIGITUNDER', barrier, page: 'over-under.html', heat: a.pUnder(barrier) - barrier / 10 });
    L.push({ market: 'Matches', place: 'MATCHES ' + a.hot, type: 'DIGITMATCH', barrier: a.hot, page: 'matches-differs.html', heat: a.f[a.hot] - 0.1 });
    L.push({ market: 'Differs', place: 'DIFFERS ' + a.cold, type: 'DIGITDIFF', barrier: a.cold, page: 'matches-differs.html', heat: 0.1 - a.f[a.cold] });
    return L.sort((x, y) => y.heat - x.heat);
  };
  TW.strength = heat => Math.max(20, Math.min(90, Math.round(50 + heat * 150)));
  TW.sigClass = s => (s >= 70 ? 'g' : s >= 55 ? 'y' : 'r');
  TW.sigHtml = s => `<span class="sig ${TW.sigClass(s)}">${s}%</span>`;
  TW.DISCLAIMER = 'Synthetic-index digits are random. Signals only describe recent frequency — they are not predictions and do not guarantee profit. Trading can lose all of your stake.';
  TW.renderCircles = function (el, digits, opt) {
    opt = opt || {};
    const total = digits.length, cnt = Array(10).fill(0); digits.forEach(d => cnt[d]++);
    const order = [...Array(10).keys()].sort((a, b) => cnt[b] - cnt[a] || a - b), rank = {};
    if (total >= 30) { order.slice(0, 3).forEach((d, i) => rank[d] = ['r1', 'r2', 'r3'][i]); order.slice(-3).reverse().forEach((d, i) => { if (!rank[d]) rank[d] = ['l1', 'l2', 'l3'][i]; }); }
    const LB = { r1: '1st', r2: '2nd', r3: '3rd', l1: 'L1', l2: 'L2', l3: 'L3' }, se = Math.sqrt(0.09 / (total || 1));
    if (!el._ui) { // build once, then only update: no flicker, and the cursor can glide
      el.textContent = ''; const cs = [];
      for (let d = 0; d < 10; d++) { const c = document.createElement('div'), n = document.createElement('div'), p = document.createElement('div'), h = document.createElement('div'), r = document.createElement('div');
        c.className = 'circle'; n.className = 'num'; p.className = 'pct'; h.className = 'hits'; r.className = 'rk'; n.textContent = d; c.append(n, p, h, r); el.appendChild(c); cs.push({ c, p, h, r }); }
      const lg = document.createElement('div'), cur = document.createElement('div'); lg.className = 'lgd'; cur.className = 'dcur'; cur.style.transition = 'none'; el.append(lg, cur);
      el._ui = { cs, lg, cur, last: null, first: true };
      if (window.ResizeObserver) new ResizeObserver(() => { if (el._ui.last != null) place(el, true); }).observe(el);
    }
    const U = el._ui;
    for (let d = 0; d < 10; d++) {
      const rk = rank[d] || '', sig = total >= 100 && Math.abs(cnt[d] / total - 0.1) / se >= 2, st = opt.state ? opt.state(d) : '', tag = opt.tag ? opt.tag(d) : '', o = U.cs[d];
      o.c.className = 'circle rk-' + (rk || 'n') + (rk && !sig ? ' ns' : '') + (st ? ' ' + st : ''); if (tag) o.c.setAttribute('data-tag', tag); else o.c.removeAttribute('data-tag');
      o.p.textContent = (total ? (cnt[d] / total * 100).toFixed(1) : '0.0') + '%'; o.h.textContent = cnt[d] + ' hits'; o.r.textContent = LB[rk] || ''; o.r.style.display = rk ? '' : 'none';
    }
    U.lg.textContent = 'Green = most frequent (1st, 2nd, 3rd). Red, orange, amber = least frequent (L1, L2, L3). Muted = within normal random variation. Based on ' + total + ' ticks. Frequency describes the past; it does not predict the next digit.';
    if (total) { U.last = digits[total - 1]; place(el, U.first); U.first = false; }
  };
  function place(el, instant) { // move the cursor ring to the latest digit's circle
    const U = el._ui, c = U.cs[U.last].c, cur = U.cur; if (!c.offsetWidth) return;
    if (instant) cur.style.transition = 'none';
    cur.style.width = c.offsetWidth + 'px'; cur.style.height = c.offsetHeight + 'px'; cur.style.transform = 'translate(' + c.offsetLeft + 'px,' + c.offsetTop + 'px)';
    if (instant) { void cur.offsetWidth; cur.style.transition = ''; }
  }
  TW.digitButtons = function (el, onPick, off) {
    el.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const b = document.createElement('div');
      b.className = 'b'; b.textContent = i; b.dataset.d = i; b.style.background = TW.DIGIT_COLORS[i].bg;
      b.onclick = () => { if (off && off(i)) return; onPick(i); };
      b.setAttribute('role', 'button'); b.tabIndex = 0; b.setAttribute('aria-label', 'Digit ' + i); b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } };
      el.appendChild(b);
    }
    return { mark(sel) { el.querySelectorAll('.b').forEach(b => { b.classList.toggle('active', +b.dataset.d === sel); b.setAttribute('aria-pressed', +b.dataset.d === sel); b.classList.toggle('off', !!(off && off(+b.dataset.d))); }); } };
  };

  TW.toast = function (msg, type, ms) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), ms || 3500);
  };
  TW.modal = function (o) {
    return new Promise(res => {
      const ov = document.createElement('div'); ov.className = 'ov';
      const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog');
      m.innerHTML = `<h3>${o.title || ''}</h3>${o.html || ''}<div class="row"></div>`;
      const close = v => { ov.remove(); res(v); };
      const row = $('.row', m);
      (o.buttons === undefined ? [{ label: 'OK', value: true }] : o.buttons).forEach(b => {
        const x = document.createElement('button'); x.className = 'btn ' + (b.cls || ''); x.textContent = b.label; x.onclick = () => close(b.value); row.appendChild(x);
      });
      ov.addEventListener('click', e => { if (e.target === ov) close(null); });
      ov.appendChild(m); document.body.appendChild(ov);
      o.init && o.init(m, close);
    });
  };

  TW.account = { authed: false, loginid: '', virtual: false, balance: 0, currency: 'USD', name: '' };
  TW.paper = { balance: +store.get('tw_paper') || TW.settings.paperStart };
  const savePaper = () => store.set('tw_paper', String(TW.paper.balance));
  TW.resetPaper = () => { TW.paper.balance = +TW.settings.paperStart || 10000; savePaper(); emit('account'); };
  TW.session = { trades: 0, wins: 0, pnl: 0 };
  try { Object.assign(TW.session, JSON.parse(store.sget('tw_session') || '{}')); } catch (e) {}
  TW.saveSession = () => store.sset('tw_session', JSON.stringify(TW.session));
  TW.resetSession = () => { TW.session.trades = 0; TW.session.wins = 0; TW.session.pnl = 0; TW.saveSession(); emit('trade'); };
  TW.trades = [];
  TW.mode = () => (!TW.embed && TW.settings.mode === 'live' && TW.account.authed ? 'live' : 'paper');
  const getToken = () => store.sget('tw_token') || store.get('tw_token_saved') || '';

  let tsock = null, rid = 1, wantAuth = false;
  const pend = {}, watch = {};
  function tconnect() {
    if (tsock) return;
    tsock = new Socket({
      onOpen: () => {
        if (store.sget('tw_ws_url')) { tsock && tsock.send({ balance: 1, subscribe: 1 }); } else if (wantAuth && getToken()) authorize(getToken()).catch(() => {});
        Object.keys(watch).forEach(id => tsock.send({ proposal_open_contract: 1, contract_id: +id, subscribe: 1 }));
      },
      onMessage: onT
    });
  }
  function req(obj, ms) {
    tconnect();
    return new Promise((res, rej) => {
      const id = rid++;
      const timer = setTimeout(() => { delete pend[id]; rej(new Error('Request timed out — check your connection.')); }, ms || 15000);
      pend[id] = { res: v => { clearTimeout(timer); res(v); }, rej: e => { clearTimeout(timer); rej(e); } };
      const go = () => { if (!pend[id]) return; if (!tsock.send(Object.assign({}, obj, { req_id: id }))) setTimeout(go, 250); };
      go();
    });
  }
  TW.req = req;
  function onT(d) {
    if (d.req_id && pend[d.req_id]) {
      const p = pend[d.req_id]; delete pend[d.req_id];
      if (d.error) p.rej(new Error(d.error.message || d.error.code)); else p.res(d);
    }
    if (d.msg_type === 'balance' && d.balance) { TW.account.balance = +d.balance.balance; if (d.balance.currency) TW.account.currency = d.balance.currency; emit('account'); }
    if (d.msg_type === 'proposal_open_contract' && d.proposal_open_contract) onPOC(d.proposal_open_contract);
    if (d.msg_type === 'authorize' && d.authorize) {
      const a = d.authorize;
      Object.assign(TW.account, { authed: true, loginid: a.loginid, virtual: !!a.is_virtual, balance: +a.balance, currency: a.currency, name: a.fullname || '' });
      emit('account');
    }
  }
  function authorize(token) {
    return req({ authorize: token }).then(r => {
      const a = r.authorize;
      Object.assign(TW.account, { authed: true, loginid: a.loginid, virtual: !!a.is_virtual, balance: +a.balance, currency: a.currency, name: a.fullname || '' });
      wantAuth = true; tsock.send({ balance: 1, subscribe: 1 }); emit('account'); return a;
    });
  }
  const REST = 'https://api.derivws.com';
  // New Deriv flow: PAT -> REST account list -> REST one-time-password -> authenticated wss URL (demo or real).
  TW.connectAccount = async function (token, remember) {
    token = (token || '').trim();
    if (!token) throw new Error('Paste your Deriv Personal Access Token (PAT) first.');
    const appId = String(TW.settings.appId || '');
    if (!appId || appId === '1089') throw new Error('Register an app (type PAT) at developers.deriv.com and put its App ID in Settings first. Old app IDs do not work.');
    const H = { Authorization: 'Bearer ' + token, 'Deriv-App-ID': appId };
    let r, j;
    try { r = await fetch(REST + '/trading/v1/options/accounts', { headers: H }); j = await r.json().catch(() => ({})); }
    catch (e) { throw new Error('Could not reach Deriv (wrong App ID/PAT, or the browser blocked the request).'); }
    if (!r.ok) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || 'Deriv rejected the login (HTTP ' + r.status + ').');
    const list = Array.isArray(j.data) ? j.data : [], gid = a => a.account_id || a.loginid || a.id;
    const kind = a => String(a.account_type || (/^(VRT|DEM)/i.test(gid(a)) ? 'demo' : 'real')).toLowerCase();
    const acc = list.find(a => kind(a) === 'demo') || list[0]; // demo preferred, as before
    if (!acc) throw new Error('No Options account found for this token. Fields received: ' + Object.keys(j).join(', '));
    const o = await fetch(REST + '/trading/v1/options/accounts/' + encodeURIComponent(gid(acc)) + '/otp', { method: 'POST', headers: H });
    const oj = await o.json().catch(() => ({}));
    if (!o.ok || !oj.data || !oj.data.url) throw new Error((oj.errors && oj.errors[0] && oj.errors[0].message) || 'Could not get a trading connection (HTTP ' + o.status + ').');
    store.sset('tw_ws_url', oj.data.url); store.sset('tw_account_id', gid(acc));
    store.sdel('tw_token'); store.del('tw_token_saved');
    if (remember) store.set('tw_token_saved', token); else store.sset('tw_token', token);
    Object.assign(TW.account, { authed: true, loginid: gid(acc), virtual: kind(acc) === 'demo', balance: +acc.balance || 0, currency: acc.currency || 'USD' });
    if (tsock) { tsock.close(); tsock = null; }
    wantAuth = true; tconnect();
    TW.settings.rememberToken = !!remember; TW.settings.mode = 'live'; TW.saveSettings(); emit('account'); return acc;
  };
  // One-time passwords cannot be reused, so after a page load fetch a fresh one from the saved token.
  setTimeout(() => { const q = TW.qs(); if (q.ws_url || q.otp) return; store.sdel('tw_ws_url'); const t = getToken(); if (t) TW.connectAccount(t, !!store.get('tw_token_saved')).catch(() => {}); }, 0);
  TW.disconnectAccount = function () {
    store.sdel('tw_token'); store.del('tw_token_saved'); store.sdel('tw_otp'); store.sdel('tw_ws_url'); store.sdel('tw_access_token');
    wantAuth = false;
    TW.account = Object.assign(TW.account, { authed: false, loginid: '', virtual: false, balance: 0, name: '' });
    if (tsock) { tsock.close(); tsock = null; }
    TW.settings.mode = 'paper'; TW.saveSettings(); emit('account');
  };

  TW.oauthUrl = () => 'https://tickwealth-auth.karanud96.workers.dev/login';
  TW.accounts = () => { try { return JSON.parse(store.sget('tw_accts') || '[]'); } catch (e) { return []; } };

  TW.handleOAuth = async function () {
    const q = TW.qs();
    const cleanUrl = () => { try { history.replaceState(null, '', location.pathname); } catch(e){} };

    // NEW: Handle OTP flow (Deriv new OAuth) - FIXED NO CORS
    if (q.otp || q.ws_url || q.access_token) {
      if (q.otp) store.sset('tw_otp', q.otp);
      if (q.ws_url) store.sset('tw_ws_url', q.ws_url);
      if (q.access_token) store.sset('tw_access_token', q.access_token);
      if (q.account_id) store.sset('tw_account_id', q.account_id);
      
      cleanUrl();
      
      if (q.ws_url) {
        if (tsock) { tsock.close(); tsock = null; }
        wantAuth = true;
        tconnect();
        TW.settings.mode = 'live'; TW.saveSettings();
        setTimeout(() => {
          tsock && tsock.send({ balance: 1, subscribe: 1 });
        }, 1000);
        TW.toast('Logged in via Deriv OAuth (OTP)', 'ok', 5000);
        return true;
      }
      
      if (q.otp) {
        if (tsock) { tsock.close(); tsock = null; }
        wantAuth = true;
        tconnect();
        TW.settings.mode = 'live'; TW.saveSettings();
        TW.toast('Logged in via Deriv OAuth (OTP)', 'ok', 5000);
        return true;
      }

      if (q.access_token) {
        try {
          await TW.connectAccount(q.access_token, false); // access token -> accounts -> one-time link -> authenticated socket
          TW.toast('Linked Deriv account ' + TW.account.loginid + (TW.account.virtual ? ' (demo)' : ' (REAL)'), 'ok', 6000);
        } catch (e) { TW.toast('Deriv login did not complete: ' + e.message, 'err', 9000); }
        return true;
      }
    }

    // OLD: Handle legacy a1- tokens
    const doAuthorize = async (token) => {
      const a = await authorize(token);
      store.sset('tw_token', token);
      TW.settings.mode = 'live'; TW.saveSettings(); emit('account');
      TW.toast('Logged in: ' + TW.account.loginid + (TW.account.virtual ? ' (demo)' : ' (REAL)'), 'ok', 5000);
      return true;
    };

    if (q.token1) {
      const t1 = q.token1;
      cleanUrl();
      try {
        await doAuthorize(t1);
        return true;
      } catch(e) {
        TW.toast('Login failed: ' + e.message, 'err', 6000);
        return false;
      }
    }

    const list = [];
    for (let i = 1; i < 10 && q['token' + i]; i++) list.push({ loginid: q['acct' + i] || '', token: q['token' + i], cur: q['cur' + i] || '' });
    if (!list.length) return false;
    cleanUrl();
    store.sset('tw_accts', JSON.stringify(list));
    const pick = list.find(a => /^VR/.test(a.loginid)) || list[0];
    try { await doAuthorize(pick.token); } catch (e) { TW.toast('Deriv login failed: ' + e.message, 'err', 6000); }
    return true;
  };

  TW.setMode = m => { TW.settings.mode = m; TW.saveSettings(); emit('account'); };
  TW.quote = function (p) {
    const q = { proposal: 1, basis: 'stake', amount: p.amount, currency: TW.account.currency || 'USD', contract_type: p.contract_type, duration: p.duration, duration_unit: p.duration_unit || 't', [TW.symKey()]: p.symbol };
    if (p.barrier != null && p.barrier !== '') q.barrier = String(p.barrier);
    return req(q, 10000).then(r => r.proposal);
  };
  TW.watchQuote = function (getParams, cb) {
    let tm, seq = 0;
    return function () {
      clearTimeout(tm);
      tm = setTimeout(async () => {
        const my = ++seq; cb(null, 'loading');
        try { const q = await TW.quote(getParams()); if (my === seq) cb(q); } catch (e) { if (my === seq) cb(null, e.message); }
      }, 350);
    };
  };

  const err = (m, quiet) => { const e = new Error(m); e.quiet = !!quiet; return e; };
  const secs = (d, u) => d * ({ s: 1, m: 60, h: 3600, d: 86400 }[u] || 1);
  function newTrade(p, mode, extra) {
    const t = Object.assign({ id: '', mode, label: p.label || p.contract_type, type: p.contract_type, symbol: p.symbol, barrier: p.barrier, duration: p.duration, unit: p.duration_unit || 't', stake: p.amount, payout: 0, status: 'open', profit: 0, time: Date.now(), bot: p.bot || '' }, extra || {});
    t.done = new Promise(r => { t._done = r; });
    TW.trades.unshift(t); if (TW.trades.length > 40) TW.trades.pop();
    return t;
  }
  function settle(t, profit) {
    if (t.status !== 'open') return;
    t.profit = +profit.toFixed(2); t.status = t.profit > 0 ? 'won' : 'lost';
    TW.session.trades++; if (t.profit > 0) TW.session.wins++; TW.session.pnl = +(TW.session.pnl + t.profit).toFixed(2); TW.saveSession();
    if (t.mode === 'paper') { TW.paper.balance = +(TW.paper.balance + t.profit).toFixed(2); savePaper(); emit('account'); }
    emit('trade', t); t._done(t);
  }
  function onPOC(c) {
    const w = watch[c.contract_id]; if (!w) return;
    const t = w.trade; t.spot = c.current_spot;
    if (c.is_sold || c.status === 'won' || c.status === 'lost') {
      t.exit = c.exit_tick || c.sell_spot; delete watch[c.contract_id];
      if (c.id && tsock) tsock.send({ forget: c.id });
      settle(t, +c.profit || 0);
    } else emit('trade', t);
  }

  const paperOpen = [], paperFeeds = {};
  function paperEnsureFeed(sym) {
    if (paperFeeds[sym]) return;
    paperFeeds[sym] = TW.tickFeed(sym, { primary: false, count: 1, max: 5, onTick: (st, tk) => paperTick(sym, tk) });
  }
  function paperCleanup(sym) {
    if (!paperOpen.some(t => t.symbol === sym && t.status === 'open') && paperFeeds[sym]) { paperFeeds[sym].close(); delete paperFeeds[sym]; }
  }
  function paperTick(sym, tk) {
    paperOpen.filter(t => t.symbol === sym && t.status === 'open').forEach(t => {
      t.count++;
      if (t.count === 1) { t.entry = tk.price; t.entryEpoch = tk.epoch; }
      const byTime = t.unit !== 't';
      const finished = byTime ? tk.epoch >= t.entryEpoch + secs(t.duration, t.unit) : t.count >= t.duration;
      if (!finished) { emit('trade', t); return; }
      t.exit = tk.price;
      const b = +t.barrier, d = tk.digit; let win = false;
      switch (t.type) {
        case 'CALL': win = tk.price > t.entry; break; case 'PUT': win = tk.price < t.entry; break;
        case 'DIGITEVEN': win = d % 2 === 0; break; case 'DIGITODD': win = d % 2 === 1; break;
        case 'DIGITOVER': win = d > b; break; case 'DIGITUNDER': win = d < b; break;
        case 'DIGITMATCH': win = d === b; break; case 'DIGITDIFF': win = d !== b; break;
      }
      t.exitDigit = d;
      settle(t, win ? t.payout - t.stake : -t.stake);
      const i = paperOpen.indexOf(t); if (i >= 0) paperOpen.splice(i, 1);
      setTimeout(() => paperCleanup(sym), 500);
    });
  }

  TW.trade = async function (p, o) {
    o = o || {};
    const s = TW.settings, mode = TW.mode(), amount = +(+p.amount).toFixed(2);
    if (!(amount >= 0.35)) throw err('Minimum stake is 0.35.');
    if (amount > s.maxStake) throw err(`Stake ${amount} is above your max-stake limit (${s.maxStake}). Raise it in Settings if you really want this.`);
    if (s.stopLoss > 0 && TW.session.pnl <= -s.stopLoss) throw err(`Session stop-loss reached (-${s.stopLoss}). Trading is paused — reset the session in Settings.`);
    if (mode === 'paper' && amount > TW.paper.balance) throw err('Not enough paper balance. Reset it in Settings.');
    const params = { contract_type: p.contract_type, symbol: p.symbol, duration: +p.duration, duration_unit: p.duration_unit || 't', amount, barrier: p.barrier };
    let q;
    q = await TW.quote(params);
    if (mode === 'live' && !o.silent && s.confirm) {
      const ok = await TW.modal({
        title: TW.account.virtual ? 'Confirm DEMO trade' : '⚠ Confirm REAL-MONEY trade',
        html: `<div class="sub">${TW.esc(q ? q.longcode : p.label || p.contract_type)}</div><div class="stats"><div><b>${TW.money(amount)}</b>Stake</div><div><b>${q ? TW.money(q.payout) : '—'}</b>Payout</div><div><b>${TW.esc(TW.account.loginid)}</b>${TW.account.virtual ? 'Demo' : 'Real'} account</div></div>${TW.account.virtual ? '' : '<div class="warn">This uses real money. You can lose the entire stake.</div>'}`,
        buttons: [{ label: 'Cancel', cls: 'ghost', value: false }, { label: 'Buy now', cls: TW.account.virtual ? '' : 'red', value: true }]
      });
      if (!ok) throw err('Cancelled', true);
    }
    if (mode === 'live') {
      const par = { amount, basis: 'stake', contract_type: params.contract_type, currency: TW.account.currency, duration: params.duration, duration_unit: params.duration_unit, [TW.symKey()]: params.symbol };
      if (params.barrier != null && params.barrier !== '') par.barrier = String(params.barrier);
      const r = await req({ buy: 1, price: amount, parameters: par }, 20000);
      const b = r.buy, t = newTrade(p, 'live', { id: b.contract_id, payout: b.payout, stake: b.buy_price, longcode: b.longcode });
      watch[b.contract_id] = { trade: t };
      tsock.send({ proposal_open_contract: 1, contract_id: b.contract_id, subscribe: 1 });
      emit('trade', t); return t;
    }
    const t = newTrade(p, 'paper', { id: 'P' + Date.now().toString(36), payout: +q.payout, count: 0, longcode: q.longcode });
    paperOpen.push(t); paperEnsureFeed(params.symbol); emit('trade', t); return t;
  };

  TW.mountLog = function (el) {
    const draw = () => {
      const s = TW.session, wr = s.trades ? Math.round(s.wins / s.trades * 100) + '%' : '—';
      el.innerHTML = `<div class="h">SESSION · ${TW.mode() === 'live' ? (TW.account.virtual ? 'DEMO ACCOUNT' : 'REAL ACCOUNT') : 'PAPER (GHOST) TRADING'}</div>
      <div class="stats"><div><b>${s.trades}</b>Trades</div><div><b>${wr}</b>Win rate</div><div><b style="color:${s.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${TW.money(s.pnl)}</b>P/L</div></div>
      <button class="btn ghost" data-ai="review" style="margin-top:8px;padding:7px 10px">✦ Ask AI to review my session</button><div class="tl">${TW.trades.length ? TW.trades.slice(0, 12).map(t => `<div class="row ${t.status}"><span>${TW.esc(t.bot ? t.bot + ' · ' : '')}${TW.esc(t.label)}${t.barrier != null && t.barrier !== '' && !/\\d$/.test(t.label) ? ' ' + t.barrier : ''} · ${TW.money(t.stake)}</span><span class="p ${t.profit > 0 ? 'w' : t.profit < 0 ? 'l' : ''}">${t.status === 'open' ? 'open' + (t.mode === 'paper' && t.unit === 't' ? ` ${t.count || 0}/${t.duration}` : '…') : (t.profit > 0 ? '+' : '') + TW.money(t.profit)}</span></div>`).join('') : '<div class="sub">No trades yet this session.</div>'}</div>`;
    };
    el.addEventListener('click', e => { if (e.target.closest('[data-ai]') && TW.ai) TW.ai.ask('Review my session so far and tell me what stands out about my risk.'); });
    TW.on('trade', draw); TW.on('account', draw); draw();
  };

  const PAGES = [['index.html', 'Home'], ['rise-fall.html', 'Rise/Fall'], ['over-under.html', 'Over/Under'], ['even-odd.html', 'Even/Odd'], ['matches-differs.html', 'Matches/Differs'], ['analyzer.html', 'Analyzer'], ['playbook.html', 'Playbook'], ['insight.html', 'Insight Lab'], ['diagnostics.html', 'Diagnostics'], ['bots-library.html', 'Bots'], ['settings.html', 'Settings']];
  TW.setStatus = function (s, msg) {
    const d = $('#twDot'), t = $('#twStatus'); if (!d) return;
    d.className = 'dot ' + s;
    t.textContent = msg || ({ live: 'LIVE', connecting: 'Connecting…', reconnecting: 'Reconnecting…', offline: 'Offline — retrying', error: 'Error' }[s] || s);
  };
  function drawAcc() {
    const b = $('#twAcc'); if (!b) return;
    if (TW.mode() === 'live') b.innerHTML = `<span class="badge ${TW.account.virtual ? 'demo' : 'live'}">${TW.account.virtual ? 'DEMO' : 'REAL'}</span> ${TW.money(TW.account.balance, TW.account.currency)}`;
    else b.innerHTML = `<span class="badge">PAPER</span> ${TW.money(TW.paper.balance)}`;
  }
  TW.openAccount = function () {
    const render = m => {
      const a = TW.account, live = TW.mode() === 'live';
      m.innerHTML = `<h3>Account & trading mode</h3>
      <div class="seg"><button data-m="paper" class="${!live ? 'active' : ''}">Paper (ghost)</button><button data-m="live" class="${live ? 'active' : ''}">Deriv account</button></div>
      <div class="sub" style="margin-top:10px">${!live ? `Paper trading uses live prices and real payouts with <b>virtual money</b> — nothing is risked. Balance: <b>${TW.money(TW.paper.balance)}</b>.` : `Connected as <b>${TW.esc(a.loginid)}</b> (${a.virtual ? 'demo' : '<span style="color:var(--red)">REAL money</span>'}). Balance <b>${TW.money(a.balance, a.currency)}</b>.`}</div>
      ${a.authed ? `${TW.accounts().length > 1 ? `<div class="lbl">SWITCH ACCOUNT</div><select id="twAccSel" class="sel" style="width:100%;max-width:none">${TW.accounts().map(x => `<option value="${TW.esc(x.token)}" ${x.loginid === a.loginid ? 'selected' : ''}>${TW.esc(x.loginid)} ${/^VR/.test(x.loginid) ? '(demo)' : '(real)'} ${TW.esc(x.cur)}</option>`).join('')}</select>` : ''}<div class="row"><button class="btn ghost" data-act="out">Disconnect</button><button class="btn" data-act="close">Done</button></div>` : `
      <a class="btn full" style="display:block;text-align:center;text-decoration:none;margin-top:12px" href="${TW.oauthUrl()}">Log in with Deriv</a>
      <div class="sub" style="text-align:center">Uses your Verified app 34OhVj79ZLhfAq3EeoraT (OAuth).</div>
      <div class="lbl">DERIV API TOKEN</div>
      <input id="twTok" class="inp" type="password" autocomplete="off" placeholder="Paste your Deriv PAT (trade scope only)">
      <label class="switch"><span>Remember on this device</span><input id="twRem" type="checkbox"></label>
      <div class="sub">Create a Personal Access Token at developers.deriv.com with the <b>trade</b> scope only — never account-management or payments. Start with a <b>Demo</b> account. The token stays in this browser and is only sent to Deriv.</div>
      <div id="twErr" class="warn" style="display:none"></div>
      <div class="row"><button class="btn ghost" data-act="close">Close</button><button class="btn" id="twGo">Connect</button></div>`}
      ${!live ? '<div class="row"><button class="btn ghost" data-act="reset">Reset paper balance</button></div>' : ''}`;
      m.querySelectorAll('[data-m]').forEach(x => x.onclick = () => {
        if (x.dataset.m === 'live' && !TW.account.authed) { TW.toast('Connect a Deriv token first.'); return; }
        TW.setMode(x.dataset.m); render(m);
      });
      m.querySelectorAll('[data-act]').forEach(x => x.onclick = () => {
        const a = x.dataset.act;
        if (a === 'close') m.parentNode.remove(); if (a === 'out') { TW.disconnectAccount(); render(m); } if (a === 'reset') { TW.resetPaper(); render(m); }
      });
      const asel = $('#twAccSel', m);
      if (asel) asel.onchange = async () => { try { await authorize(asel.value); store.sset('tw_token', asel.value); TW.toast('Switched to ' + TW.account.loginid, 'ok'); render(m); } catch (e) { TW.toast(e.message, 'err'); } };
      const go = $('#twGo', m);
      if (go) go.onclick = async () => {
        const e = $('#twErr', m); e.style.display = 'none'; go.disabled = true; go.textContent = 'Connecting…';
        try { await TW.connectAccount($('#twTok', m).value, $('#twRem', m).checked); render(m); TW.toast('Connected: ' + TW.account.loginid, 'ok'); }
        catch (x) { e.textContent = x.message; e.style.display = 'block'; go.disabled = false; go.textContent = 'Connect'; }
      };
    };
    TW.modal({ title: '', html: '', buttons: [], init: m => render(m) });
  };
  TW.mountTop = function (o) {
    o = o || {};
    const el = $('#top'); el.className = 'top';
    el.innerHTML = `<div class="top-row"><a class="brand" href="index.html" aria-label="TickWealth home"><img src="logo-mark.svg" alt="" width="30" height="30"><span>Tick<b style="color:#00ffa3">Wealth</b></span></a>${o.symbols ? '<select class="sel" id="twSym" aria-label="Market"></select>' : ''}<span class="dot" id="twDot"></span><span class="mut" id="twStatus" style="font-size:11px"></span><span class="spacer"></span><button class="pill" id="twAcc" title="Account & mode"></button></div><nav class="nav">${PAGES.map(p => `<a href="${p[0]}" class="${p[0] === o.active ? 'on' : ''}">${p[1]}</a>`).join('')}</nav>`;
    const out = { symbol: o.defaultSymbol || 'R_25' };
    if (o.symbols) {
      const sel = $('#twSym'), list = TW.VOLS.filter(v => o.symbols === 'all' || v.digits);
      sel.innerHTML = list.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
      const q = TW.qs().vol; out.symbol = list.some(v => v.id === q) ? q : (list.some(v => v.id === out.symbol) ? out.symbol : list[0].id);
      sel.value = out.symbol;
      sel.onchange = () => { out.symbol = sel.value; o.onSymbol && o.onSymbol(sel.value); };
    }
    $('#twAcc').onclick = TW.openAccount;
    TW.on('account', drawAcc); drawAcc(); TW.setStatus('connecting');
    if (!TW.embed) TW.handleOAuth();
    if (!TW.embed && TW.settings.mode === 'live' && getToken()) { wantAuth = true; authorize(getToken()).catch(() => { TW.settings.mode = 'paper'; drawAcc(); }); }
    // NEW: Auto-connect with OTP if stored
    if (!TW.embed && store.sget('tw_otp')) { wantAuth = true; tconnect(); TW.settings.mode = 'live'; }
    TW.mountAI && TW.mountAI();
    return out;
  };

  TW.ready(() => {
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-for]'); if (!b) return;
      const i = document.getElementById(b.dataset.for); if (!i) return;
      const step = +(i.step || 1), dir = +b.dataset.step, min = i.min === '' ? -Infinity : +i.min, max = i.max === '' ? Infinity : +i.max;
      let v = (parseFloat(i.value) || 0) + step * dir; v = Math.min(max, Math.max(min, v));
      i.value = step % 1 ? v.toFixed(2) : String(Math.round(v)); i.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  TW.Chart = function (box, opt) {
    opt = opt || {};
    const cv = document.createElement('canvas'); box.appendChild(cv);
    const ctx = cv.getContext('2d');
    let data = [], line = false, bars = 90, off = 0, W = 0, H = 0, pip = 2, mx = null, drag = null, msg = 'Connecting…';
    const AX = 66, AY = 22, UP = opt.up || '#fbbf24', DN = opt.down || '#ef4444';
    let IND = {}; const SUBH = 64;
    const sma = (a, n) => { const o = Array(a.length).fill(null); let t = 0; for (let i = 0; i < a.length; i++) { t += a[i]; if (i >= n) t -= a[i - n]; if (i >= n - 1) o[i] = t / n; } return o; };
    const ema = (a, n) => { const o = [], k = 2 / (n + 1); a.forEach((v, i) => o.push(i ? v * k + o[i - 1] * (1 - k) : v)); return o; };
    const bbands = (a, n) => { const m = sma(a, n), u = [], l = []; a.forEach((_, i) => { if (m[i] == null) { u.push(null); l.push(null); return; } let t = 0; for (let j = i - n + 1; j <= i; j++) t += (a[j] - m[i]) ** 2; const d = 2 * Math.sqrt(t / n); u.push(m[i] + d); l.push(m[i] - d); }); return { u, l }; };
    const rsiF = (a, n) => { const o = Array(a.length).fill(null); if (a.length <= n) return o; let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = a[i] - a[i - 1]; d > 0 ? g += d : l -= d; } g /= n; l /= n; o[n] = l ? 100 - 100 / (1 + g / l) : 100;
      for (let i = n + 1; i < a.length; i++) { const d = a[i] - a[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; o[i] = l ? 100 - 100 / (1 + g / l) : 100; } return o; };
    const macdF = a => { const e1 = ema(a, 12), e2 = ema(a, 26), m = e1.map((v, i) => v - e2[i]), s9 = ema(m, 9); return { m, s: s9, h: m.map((v, i) => v - s9[i]) }; };
    function resize() { const r = box.getBoundingClientRect(), d = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.max(1, W * d); cv.height = Math.max(1, H * d); ctx.setTransform(d, 0, 0, d, 0, 0); draw(); }
    const fmtT = t => { const d = new Date(t * 1000), p = n => String(n).padStart(2, '0'); return line ? `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : `${p(d.getHours())}:${p(d.getMinutes())}`; };
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#070a14'; ctx.fillRect(0, 0, W, H);
      if (!data.length) { ctx.fillStyle = '#64748b'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, H / 2); return; }
      off = Math.max(0, Math.min(off, Math.max(0, data.length - 10)));
      const end = data.length - off, start = Math.max(0, end - bars), vis = data.slice(start, end);
      const subs = (IND.rsi ? 1 : 0) + (IND.macd ? 1 : 0), pw = W - AX, ph = H - AY - subs * SUBH, step = pw / bars;
      let lo = Infinity, hi = -Infinity; vis.forEach(c => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
      if (hi === lo) { hi += 1; lo -= 1; } const pad = (hi - lo) * .08; lo -= pad; hi += pad;
      const y = v => 6 + (hi - v) / (hi - lo) * (ph - 12), x = i => pw - (vis.length - i - .5) * step;
      ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.strokeStyle = '#151a2e'; ctx.fillStyle = '#64748b'; ctx.lineWidth = 1;
      for (let g = 0; g <= 5; g++) { const v = lo + (hi - lo) * g / 5, yy = y(v); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(pw, yy); ctx.stroke(); ctx.fillText(v.toFixed(pip), pw + 6, yy + 3); }
      const every = Math.max(1, Math.round(vis.length / 5)); ctx.textAlign = 'center';
      vis.forEach((c, i) => { if ((vis.length - 1 - i) % every === 0) { ctx.fillText(fmtT(c.t), x(i), H - 7); } });
      if (line) {
        ctx.beginPath(); vis.forEach((c, i) => (i ? ctx.lineTo(x(i), y(c.c)) : ctx.moveTo(x(i), y(c.c)))); ctx.strokeStyle = UP; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.lineTo(x(vis.length - 1), ph); ctx.lineTo(x(0), ph); ctx.closePath(); ctx.fillStyle = UP + '14'; ctx.fill();
      } else vis.forEach((c, i) => {
        const up = c.c >= c.o, col = up ? UP : DN, xx = x(i), bw = Math.max(1, step * .68);
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xx, y(c.h)); ctx.lineTo(xx, y(c.l)); ctx.stroke();
        ctx.fillRect(xx - bw / 2, Math.min(y(c.o), y(c.c)), bw, Math.max(1, Math.abs(y(c.o) - y(c.c))));
      });
      if (IND.ma || IND.ema || IND.bb || IND.rsi || IND.macd) {
        const cl = data.map(c => c.c);
        const ln = (arr, col, dash) => { ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.setLineDash(dash || []); let on = false; vis.forEach((_, i) => { const v = arr[start + i]; if (v == null) { on = false; return; } on ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); on = true; }); ctx.stroke(); ctx.setLineDash([]); };
        if (IND.ma) { ln(sma(cl, 20), '#38bdf8'); ln(sma(cl, 50), '#f472b6'); }
        if (IND.ema) ln(ema(cl, 20), '#fb923c');
        if (IND.bb) { const b = bbands(cl, 20); ln(b.u, '#94a3b8', [3, 3]); ln(b.l, '#94a3b8', [3, 3]); }
        let sy = ph;
        const pane = lab => { ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, sy + 2, pw, SUBH - 4); ctx.strokeStyle = '#151a2e'; ctx.strokeRect(0, sy + 2, pw, SUBH - 4); ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(lab, 6, sy + 14); };
        if (IND.rsi) { const r = rsiF(cl, 14), v = r[end - 1]; pane('RSI 14' + (v != null ? '  ' + v.toFixed(1) : '')); const yy = q => sy + 6 + (100 - q) / 100 * (SUBH - 12);
          ctx.strokeStyle = '#334155'; ctx.setLineDash([3, 3]); [30, 70].forEach(q => { ctx.beginPath(); ctx.moveTo(0, yy(q)); ctx.lineTo(pw, yy(q)); ctx.stroke(); }); ctx.setLineDash([]);
          ctx.beginPath(); ctx.strokeStyle = '#a78bfa'; let on = false; vis.forEach((_, i) => { const q = r[start + i]; if (q == null) { on = false; return; } on ? ctx.lineTo(x(i), yy(q)) : ctx.moveTo(x(i), yy(q)); on = true; }); ctx.stroke(); sy += SUBH; }
        if (IND.macd) { const M = macdF(cl); let a = Infinity, b = -Infinity; for (let i = start; i < end; i++) [M.m[i], M.s[i], M.h[i]].forEach(q => { a = Math.min(a, q); b = Math.max(b, q); }); if (a === b) { a -= 1; b += 1; }
          const yy = q => sy + 6 + (b - q) / (b - a) * (SUBH - 12); pane('MACD 12/26/9'); ctx.strokeStyle = '#334155'; ctx.beginPath(); ctx.moveTo(0, yy(0)); ctx.lineTo(pw, yy(0)); ctx.stroke();
          vis.forEach((_, i) => { const q = M.h[start + i]; ctx.fillStyle = q >= 0 ? '#16a34a99' : '#dc262699'; ctx.fillRect(x(i) - step * .3, Math.min(yy(0), yy(q)), Math.max(1, step * .6), Math.abs(yy(q) - yy(0))); });
          [[M.m, '#38bdf8'], [M.s, '#fb923c']].forEach(([arr, col]) => { ctx.beginPath(); ctx.strokeStyle = col; vis.forEach((_, i) => { const q = arr[start + i]; i ? ctx.lineTo(x(i), yy(q)) : ctx.moveTo(x(i), yy(q)); }); ctx.stroke(); }); sy += SUBH; }
      }
      const last = data[data.length - 1];
      if (off === 0) { const yy = y(last.c); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(pw, yy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = last.c >= last.o ? UP : DN; ctx.fillRect(pw, yy - 8, AX, 16); ctx.fillStyle = '#111827'; ctx.textAlign = 'left'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(last.c.toFixed(pip), pw + 5, yy + 3.5); }
      if (mx != null && mx < pw) {
        const i = Math.round((mx - (pw - vis.length * step)) / step - .5);
        const c = vis[i];
        if (c) { ctx.strokeStyle = '#475569'; ctx.beginPath(); ctx.moveTo(x(i), 0); ctx.lineTo(x(i), ph); ctx.stroke(); ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'left'; ctx.font = '11px sans-serif'; ctx.fillText(line ? `${fmtT(c.t)}  ${c.c.toFixed(pip)}` : `${fmtT(c.t)}  O ${c.o.toFixed(pip)}  H ${c.h.toFixed(pip)}  L ${c.l.toFixed(pip)}  C ${c.c.toFixed(pip)}`, 8, 14); }
      }
    }
    const ro = new ResizeObserver(resize); ro.observe(box);
    cv.addEventListener('wheel', e => { e.preventDefault(); bars = Math.max(15, Math.min(400, Math.round(bars * (1 + Math.sign(e.deltaY) * .12)))); draw(); }, { passive: false });
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, off }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; if (drag) off = drag.off + Math.round((e.clientX - drag.x) / ((W - AX) / bars)); draw(); });
    cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('pointerleave', () => { mx = null; draw(); });
    cv.addEventListener('dblclick', () => { off = 0; draw(); });
    return {
      setData(a, isLine, p) { data = a; line = !!isLine; if (p != null) pip = p; off = 0; draw(); },
      update(c) { const l = data[data.length - 1]; if (l && l.t === c.t) data[data.length - 1] = c; else data.push(c); if (data.length > 5000) data.shift(); draw(); },
      zoom(f) { bars = Math.max(15, Math.min(400, Math.round(bars * f))); draw(); }, latest() { off = 0; draw(); },
      setIndicators(o) { IND = Object.assign({}, o); draw(); }, message(m) { msg = m; draw(); },
      clear() { data = []; draw(); }, setPip(p) { pip = p; }, get length() { return data.length; }
    };
  };
})();
