/* Shared page builder for the three digit-contract pages (Over/Under, Even/Odd, Matches/Differs). */
TW.digitPage = function (cfg) {
  TW.ready(function () {
    const $ = TW.$;
    const q = TW.qs();
    let tab = cfg.tabs.some(t => t.id === q.type) ? q.type : cfg.tabs[0].id;
    let pick = cfg.picker ? (q.barrier != null && q.barrier !== '' && +q.barrier >= 0 && +q.barrier <= 9 ? +q.barrier : cfg.picker.def) : null;
    document.body.classList.add('t-' + cfg.theme);
    $('#app').innerHTML = `
    <div class="layout">
      <section class="left">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="h" id="hdr"></div><div class="dim" id="liveTxt" style="font-size:11px"></div></div>
        <div class="sub">${cfg.hint}</div>
        <div class="d-grid" id="dGrid"></div>
        <div class="scanbar"><div class="t" id="scanTxt">Waiting for live ticks…</div><button class="btn" id="scanBtn">✦ PATTERN SCAN</button><button class="btn ghost" id="askAi">✦ Ask AI</button></div>
        <div class="notice">${TW.esc(TW.DISCLAIMER)}</div>
      </section>
      <aside class="side">
        <div class="panel">
          <div class="h">${cfg.title}</div>
          <div class="seg" id="tabs">${cfg.tabs.map((t, i) => `<button data-t="${t.id}" class="${t.cls || ''}">${t.label}</button>`).join('')}</div>
          ${cfg.picker ? `<div class="lbl">${cfg.picker.label}</div><div class="bgrid" id="bGrid"></div>` : ''}
          <div class="lbl">DURATION</div>
          <div class="ctrl"><button data-for="dur" data-step="-1">−</button><input id="dur" type="number" min="1" max="10" step="1" value="${Math.min(10, Math.max(1, +q.dur || cfg.dur || 5))}"><button data-for="dur" data-step="1">+</button><span class="u">ticks</span></div>
          <div class="lbl">STAKE</div>
          <div class="ctrl"><button data-for="stake" data-step="-1">−</button><input id="stake" type="number" min="0.35" step="0.5" value="1.00"><button data-for="stake" data-step="1">+</button><span class="u">USD</span></div>
          <div class="quote"><span id="qTxt">Payout …</span><span id="qProfit"></span></div>
          <button class="buy" id="buyBtn">Buy<small id="buySub">&nbsp;</small></button>
        </div>
        <div class="panel" id="logPanel"></div>
      </aside>
    </div>
    <div class="foot">TickWealth is an independent tool and is not affiliated with Deriv. ${TW.esc(TW.DISCLAIMER)}</div>`;

    let feed = null, busy = false;
    const top = TW.mountTop({ active: cfg.active, symbols: 'digits', defaultSymbol: 'R_25', onSymbol: () => restart() });
    TW.mountLog($('#logPanel'));
    const pb = cfg.picker ? TW.digitButtons($('#bGrid'), d => { pick = d; refresh(); }, d => cfg.picker.off && cfg.picker.off(d, tab)) : null;

    function params() {
      const p = { contract_type: cfg.contract(tab, pick), symbol: top.symbol, amount: +$('#stake').value || 1, duration: +$('#dur').value || 1, label: cfg.label(tab, pick) };
      if (cfg.picker) p.barrier = pick;
      return p;
    }
    const refreshQuote = TW.watchQuote(params, (qt, msg) => {
      if (qt) { const st = +$('#stake').value || 1; $('#qTxt').innerHTML = 'Payout <b>' + TW.money(qt.payout) + '</b>'; $('#qProfit').innerHTML = 'Profit <b>' + TW.money(qt.payout - st) + '</b>'; $('#buySub').textContent = 'Payout ' + TW.money(qt.payout); }
      else { $('#qTxt').textContent = msg === 'loading' ? 'Getting price…' : msg; $('#qProfit').textContent = ''; if (msg !== 'loading') $('#buySub').innerHTML = '&nbsp;'; }
    });
    function refresh(quote) {
      if (cfg.picker && cfg.picker.off && cfg.picker.off(pick, tab)) pick = cfg.picker.fix(tab, pick);
      document.querySelectorAll('#tabs button').forEach(b => { const on = b.dataset.t === tab; b.classList.toggle('active', on); });
      const bb = $('#buyBtn'); bb.firstChild.textContent = 'Buy ' + cfg.label(tab, pick);
      bb.className = 'buy ' + ((cfg.tabs.find(t => t.id === tab) || {}).cls || '');
      if (pb) pb.mark(pick);
      const d = feed ? feed.digits : [];
      TW.renderCircles($('#dGrid'), d, { state: x => cfg.state(x, tab, pick), tag: x => cfg.tag(x, tab, pick) });
      $('#hdr').textContent = cfg.header(tab, pick) + ' · ' + d.length + ' TICKS';
      if (d.length) $('#liveTxt').textContent = 'LIVE ' + TW.volName(top.symbol); else $('#liveTxt').textContent = '';
      if (quote !== false) refreshQuote();
    }
    function restart() {
      if (feed) feed.close();
      $('#scanTxt').textContent = 'Waiting for live ticks…';
      feed = TW.tickFeed(top.symbol, {
        count: 1000,
        onStatus: s => TW.setStatus(s),
        onError: m => { TW.setStatus('error', m); $('#scanTxt').textContent = 'Market error: ' + m; },
        onHistory: () => refresh(false), onTick: () => refresh(false)
      });
      refresh();
    }
    $('#tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; refresh(); } };
    ['stake', 'dur'].forEach(i => $('#' + i).addEventListener('input', refreshQuote));
    $('#scanBtn').onclick = () => {
      if (!feed || feed.digits.length < 30) { TW.toast('Need at least 30 live ticks first.'); return; }
      const r = cfg.scan(TW.analyze(feed.digits), tab, pick);
      tab = r.tab; if (r.pick != null) pick = r.pick;
      $('#scanTxt').innerHTML = r.text + ` ${TW.sigHtml(r.strength)} <span class="dim">(recent frequency vs normal odds — not a prediction)</span>`;
      refresh();
    };
    $('#askAi').onclick = () => TW.ai && TW.ai.ask('Explain what this market is showing right now and what the current signal does and does not mean.');
    $('#buyBtn').onclick = async () => {
      if (busy) return; busy = true; $('#buyBtn').disabled = true;
      try {
        const p = params(), t = await TW.trade(p);
        TW.toast('Bought ' + p.label + ' — waiting for result', 'ok');
        t.done.then(r => TW.toast((r.profit > 0 ? 'WON +' : 'LOST ') + TW.money(r.profit), r.profit > 0 ? 'ok' : 'err'));
      } catch (e) { if (!e.quiet) TW.toast(e.message, 'err', 5000); }
      finally { busy = false; $('#buyBtn').disabled = false; }
    };
    restart();
  });
};
