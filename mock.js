/* Simulated Deriv WebSocket for testing: ticks, history, candles, symbols, quotes, trades. */
(() => {
  const SYMS = [['R_10','Volatility 10 Index','Derived','Volatility Indices'],['R_25','Volatility 25 Index','Derived','Volatility Indices'],['R_50','Volatility 50 Index','Derived','Volatility Indices'],['R_75','Volatility 75 Index','Derived','Volatility Indices'],['R_100','Volatility 100 Index','Derived','Volatility Indices'],
    ['1HZ10V','Volatility 10 (1s) Index','Derived','Volatility Indices'],['1HZ100V','Volatility 100 (1s) Index','Derived','Volatility Indices'],['BOOM500','Boom 500 Index','Derived','Crash/Boom Indices'],['CRASH500','Crash 500 Index','Derived','Crash/Boom Indices'],['RDBULL','Bull Market Index','Derived','Step Indices']];
  const base = s => 500 + (s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 50) * 40, state = {};
  const next = s => { const st = state[s] || (state[s] = { p: base(s) }); st.p += (Math.random() - .5) * 2; return +st.p.toFixed(2); };
  window.__wsLog = [];
  class MockWS {
    constructor(url) { this.url = url; this.readyState = 0; this._l = {}; this.t = []; window.__wsLog.push('open ' + url); setTimeout(() => { this.readyState = 1; this._emit('open', {}); }, 20); }
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); } removeEventListener(t, f) { this._l[t] = (this._l[t] || []).filter(x => x !== f); }
    _emit(t, e) { (this._l[t] || []).forEach(f => f(e)); const h = this['on' + t]; if (h) h(e); }
    close() { this.readyState = 3; this.t.forEach(clearInterval); this._emit('close', {}); }
    _r(o, m) { if (m.req_id) o.req_id = m.req_id; o.echo_req = m; setTimeout(() => { if (this.readyState === 1) this._emit('message', { data: JSON.stringify(o) }); }, 5); }
    send(raw) {
      const m = JSON.parse(raw); window.__wsLog.push('send ' + Object.keys(m).filter(k => k !== 'req_id')[0]);
      if (m.ping) return this._r({ msg_type: 'ping', ping: 'pong' }, m);
      if (m.active_symbols) return this._r({ msg_type: 'active_symbols', active_symbols: SYMS.map(x => ({ symbol: x[0], display_name: x[1], market: 'synthetic_index', market_display_name: x[2], submarket_display_name: x[3], exchange_is_open: 1, is_trading_suspended: 0 })) }, m);
      if (m.forget_all) return this._r({ msg_type: 'forget_all', forget_all: [] }, m);
      if (m.balance) return this._r({ msg_type: 'balance', balance: { balance: 10000, currency: 'USD' } }, m);
      if (m.ticks_history) { const s = m.ticks_history, n = m.count || 100;
        if (m.style === 'candles') { const g = m.granularity || 60, now = Math.floor(Date.now() / 1000), cs = []; let p = base(s); for (let i = n; i > 0; i--) { const o = p; p += (Math.random() - .5) * 6; cs.push({ epoch: now - i * g, open: o, high: Math.max(o, p) + 1, low: Math.min(o, p) - 1, close: p }); }
          this._r({ msg_type: 'candles', candles: cs, pip_size: 2 }, m); if (m.subscribe) this.t.push(setInterval(() => this._r({ msg_type: 'ohlc', ohlc: { open_time: Math.floor(Date.now() / 1000 / g) * g, open: state[s].p, high: state[s].p + 1, low: state[s].p - 1, close: next(s) } }, m), 500)); return; }
        const now = Math.floor(Date.now() / 1000), pr = [], tm = []; for (let i = n; i > 0; i--) { pr.push(next(s)); tm.push(now - i); }
        this._r({ msg_type: 'history', history: { prices: pr, times: tm }, pip_size: 2 }, m);
        if (m.subscribe) this.t.push(setInterval(() => this._r({ msg_type: 'tick', tick: { symbol: s, quote: next(s), epoch: Math.floor(Date.now() / 1000), pip_size: 2, id: 'sub' } }, m), 250)); return; }
      if (m.ticks) { const s = m.ticks; this._r({ msg_type: 'tick', tick: { symbol: s, quote: next(s), epoch: Math.floor(Date.now() / 1000), pip_size: 2, id: 'sub' } }, m); if (m.subscribe) this.t.push(setInterval(() => this._r({ msg_type: 'tick', tick: { symbol: s, quote: next(s), epoch: Math.floor(Date.now() / 1000), pip_size: 2, id: 'sub' } }, m), 250)); return; }
      if (m.proposal) return this._r({ msg_type: 'proposal', proposal: { id: 'p' + Math.random(), ask_price: m.amount || 1, payout: +((m.amount || 1) * 1.95).toFixed(2), longcode: 'test contract', spot: 1 } }, m);
      if (m.buy) return this._r({ msg_type: 'buy', buy: { contract_id: 777, buy_price: m.price, balance_after: 9999, longcode: 'test' } }, m);
      if (m.proposal_open_contract) { this._r({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: m.contract_id, is_sold: 0, profit: 0 } }, m); setTimeout(() => this._r({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: m.contract_id, is_sold: 1, profit: -1, buy_price: 1, underlying: 'R_100', contract_type: 'CALL' } }, m), 1200); return; }
      if (m.authorize) return this._r({ msg_type: 'authorize', authorize: { loginid: 'VRTC1', is_virtual: 1, balance: 10000, currency: 'USD' } }, m);
    }
  }
  window.WebSocket = MockWS;
})();
