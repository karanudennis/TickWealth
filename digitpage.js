/* Shared page builder for the digit-contract pages (Over/Under, Even/Odd, Matches/Differs).
 * Features:
 * 1. Dedicated Advance AI Market Scanner providing suggestions for EVERY market (1000-tick Deep Scan)
 * 2. #1 Top Highlight Suggestion with live decay timer and 1-click execution
 * 3. Individual suggestion cards for all 11 volatility indices with 85% confidence gating
 * 4. Advanced AI Auto-Trader with Adaptive Consecutive Loss Shield
 */
TW.digitPage = function (cfg) {
  TW.ready(function () {
    const $ = TW.$;
    const q = TW.qs();
    let tab = cfg.tabs.some(t => t.id === q.type) ? q.type : cfg.tabs[0].id;
    let pick = cfg.picker ? (q.barrier != null && q.barrier !== '' && +q.barrier >= 0 && +q.barrier <= 9 ? +q.barrier : cfg.picker.def) : null;
    let dur = Math.min(10, Math.max(1, +q.dur || cfg.dur || (cfg.active === 'matches-differs' ? 1 : 5)));
    let durUnit = 't';
    document.body.classList.add('t-' + cfg.theme);

    $('#app').innerHTML = `
    <div class="layout">
      <section class="left">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;">
          <div class="h" id="hdr"></div>
          <div class="dim" id="liveTxt" style="font-size:11px"></div>
        </div>
        <div class="sub">${cfg.hint}</div>
        <div class="d-grid" id="dGrid"></div>

        <div class="scanbar">
          <div class="t" id="scanTxt">Waiting for live ticks…</div>
          <button class="btn" id="scanBtn">✦ PATTERN SCAN</button>
          <button class="btn ghost" id="askAi">✦ Ask AI</button>
        </div>

        <!-- DEDICATED PILLAR ADVANCE AI MARKET SCANNER -->
        <div class="panel" style="margin:16px 0 0;background:#090d18;border:1px solid rgba(0,255,163,0.3);border-radius:14px;padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-size:13.5px;font-weight:900;color:#00ffa3;letter-spacing:0.4px;">
                ⚡ ADVANCE AI MARKET SCANNER · ${cfg.title}
              </div>
              <div style="font-size:11px;color:#9fb0cc;margin-top:2px;">
                Calculates real-data Markov transition probabilities & suggestions across all 11 volatilities for ${cfg.title}.
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <button class="btn" id="btnPillarScan" style="background:#0d1627;border:1px solid #00b2ff;color:#00b2ff;font-weight:800;font-size:11px;padding:8px 12px;border-radius:8px;cursor:pointer;">
                ⚡ RAPID SCAN (300t)
              </button>
              <button class="btn" id="btnPillarDeepScan" style="background:linear-gradient(90deg,#00ffa3,#00b2ff);color:#04101c;font-weight:900;font-size:11px;padding:8px 14px;border-radius:8px;border:0;cursor:pointer;">
                ⚛ QUANTUM DEEP SCAN (1000t)
              </button>
            </div>
          </div>

          <!-- #1 Single Best Result Card (Neat, Non-Overcrowded, Fully Actionable) -->
          <div id="aiTopSuggestionBox" style="margin-top:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;transition:all 0.3s ease;">
            <div style="display:flex;align-items:center;justify-content:center;height:85px;color:#7d8aa5;font-size:12px;gap:8px;">
              <span class="dot live" style="width:10px;height:10px;"></span>
              <span>Click <b>Rapid Scan (300t)</b> or <b>Deep Scan (1000t)</b> for the single best suggestion…</span>
            </div>
          </div>
          <div id="scanStatusTxt" style="font-size:11px;color:#00b2ff;margin-top:8px;text-align:right;">Ready</div>
        </div>

        <div class="notice" style="margin-top:14px;">${TW.esc(TW.DISCLAIMER)}</div>
      </section>

      <aside class="side">
        <div class="panel">
          <div class="h">${cfg.title}</div>
          <div class="seg" id="tabs">${cfg.tabs.map((t, i) => `<button data-t="${t.id}" class="${t.cls || ''}">${t.label}</button>`).join('')}</div>
          ${cfg.picker ? `<div class="lbl">${cfg.picker.label}</div><div class="bgrid" id="bGrid"></div>` : ''}
          <div class="lbl">DURATION</div>
          <div class="ctrl"><button data-for="dur" data-step="-1">−</button><input id="dur" type="number" min="1" max="10" step="1" value="${dur}"><button data-for="dur" data-step="1">+</button><span class="u" id="durUnitTxt">ticks</span></div>
          <div class="lbl">STAKE</div>
          <div class="ctrl"><button data-for="stake" data-step="-1">−</button><input id="stake" type="number" min="0.35" step="0.5" value="1.00"><button data-for="stake" data-step="1">+</button><span class="u">USD</span></div>
          <div class="quote"><span id="qTxt">Payout …</span><span id="qProfit"></span></div>
          <button class="buy" id="buyBtn">Buy<small id="buySub">&nbsp;</small></button>
        </div>

        <!-- ADVANCED AI AUTO-TRADER PANEL -->
        <div class="panel" style="margin:10px;background:#0d1424;border:1px solid rgba(0,178,255,0.3);border-radius:14px;padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:12px;font-weight:800;color:#00b2ff;letter-spacing:0.4px;">🤖 ADVANCED AI AUTO-TRADER</div>
            <span id="aiAutoBadge" style="font-size:10px;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.06);color:#9fb0cc;font-weight:700;">OFF</span>
          </div>
          <label class="switch" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11.5px;font-weight:700;">Enable AI Auto-Trading</span>
            <input type="checkbox" id="aiAutoOn">
          </label>
          <div style="margin-top:10px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#9fb0cc;margin-bottom:4px;">
              <span>AI Confidence Gate:</span>
              <b id="gateValTxt" style="color:#00ffa3;">85% min</b>
            </div>
            <input type="range" id="aiGateSlider" min="70" max="95" step="5" value="85" style="width:100%;accent-color:#00ffa3;">
          </div>
          <div style="margin-top:8px;font-size:10.5px;color:#7d8aa5;line-height:1.45;">
            🛡️ <b>Adaptive Loss Shield:</b> Increases gate requirement by +5% after any loss to filter noise traps. Requires minimum 5s cooldown.
          </div>
          <div id="aiSentryStatus" style="margin-top:8px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;font-size:11px;color:#cbd5e1;line-height:1.4;">
            Status: <span style="color:#9fb0cc;">Auto-trading idle. Check switch to arm AI sentry.</span>
          </div>
        </div>

        <div class="panel" id="logPanel"></div>
      </aside>
    </div>
    <div class="foot">TickWealth is an independent tool and is not affiliated with Deriv.</div>`;

    let feed = null, busy = false;
    const top = TW.mountTop({ active: cfg.active, symbols: 'digits', defaultSymbol: q.vol || 'R_100', onSymbol: () => restart() });
    TW.mountLog($('#logPanel'));
    const pb = cfg.picker ? TW.digitButtons($('#bGrid'), d => { pick = d; refresh(); }, d => cfg.picker.off && cfg.picker.off(d, tab)) : null;

    function params() {
      const p = {
        contract_type: cfg.contract(tab, pick),
        symbol: top.symbol,
        amount: +$('#stake').value || 1,
        duration: +$('#dur').value || 1,
        duration_unit: durUnit,
        label: cfg.label(tab, pick)
      };
      if (cfg.picker) p.barrier = pick;
      return p;
    }

    const refreshQuote = TW.watchQuote(params, (qt, msg) => {
      if (qt) {
        const st = +$('#stake').value || 1;
        $('#qTxt').innerHTML = 'Payout <b>' + TW.money(qt.payout) + '</b>';
        $('#qProfit').innerHTML = 'Profit <b>' + TW.money(qt.payout - st) + '</b>';
        $('#buySub').textContent = 'Payout ' + TW.money(qt.payout);
      } else {
        $('#qTxt').textContent = msg === 'loading' ? 'Getting price…' : msg;
        $('#qProfit').textContent = '';
        if (msg !== 'loading') $('#buySub').innerHTML = '&nbsp;';
      }
    });

    function refresh(quote) {
      if (cfg.picker && cfg.picker.off && cfg.picker.off(pick, tab)) pick = cfg.picker.fix(tab, pick);
      document.querySelectorAll('#tabs button').forEach(b => {
        const on = b.dataset.t === tab;
        b.classList.toggle('active', on);
      });
      const bb = $('#buyBtn');
      bb.firstChild.textContent = 'Buy ' + cfg.label(tab, pick);
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
        onHistory: () => { refresh(false); maybeAutoTrade(); },
        onTick: () => { refresh(false); maybeAutoTrade(); }
      });
      refresh();
    }

    $('#tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; refresh(); } };
    ['stake', 'dur'].forEach(i => $('#' + i).addEventListener('input', refreshQuote));

    $('#scanBtn').onclick = () => {
      if (!feed || feed.digits.length < 30) { TW.toast('Need at least 30 live ticks first.'); return; }
      const r = cfg.scan(TW.analyze(feed.digits), tab, pick);
      tab = r.tab; if (r.pick != null) pick = r.pick;
      $('#scanTxt').innerHTML = r.text + ` ${TW.sigHtml(r.strength)} <span class="dim">(recent frequency vs normal odds)</span>`;
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

    /* =========================================================================
     * ADVANCED AI AUTO-TRADER WITH ADAPTIVE LOSS SHIELD
     * ========================================================================= */
    let autoTradeInProgress = null;
    let lastAutoTradeTime = 0;
    let consecutiveLosses = 0;
    let baseGate = 85;

    const aiAutoOn = $('#aiAutoOn');
    const aiGateSlider = $('#aiGateSlider');
    const gateValTxt = $('#gateValTxt');
    const aiAutoBadge = $('#aiAutoBadge');
    const aiSentryStatus = $('#aiSentryStatus');

    aiGateSlider.oninput = () => {
      baseGate = +aiGateSlider.value;
      gateValTxt.textContent = baseGate + '% min';
      updateSentryUI();
    };

    aiAutoOn.onchange = async () => {
      if (aiAutoOn.checked) {
        if (TW.mode() === 'live') {
          const ok = await TW.modal({
            title: TW.account.virtual ? 'Enable Auto-Trading on DEMO Account' : '⚠ WARNING: Real-Money Auto-Trading',
            html: `<div class="sub">AI Auto-Trading executes orders automatically when statistical conviction exceeds ${baseGate}%.</div>${TW.account.virtual ? '' : '<div class="warn">Real money will be used. Settings max-stake and session stop-loss apply.</div>'}`,
            buttons: [{ label: 'Cancel', cls: 'ghost', value: false }, { label: 'Enable Auto-Trader', cls: TW.account.virtual ? '' : 'red', value: true }]
          });
          if (!ok) {
            aiAutoOn.checked = false;
            updateSentryUI();
            return;
          }
        }
        consecutiveLosses = 0;
        TW.toast(`AI Auto-Trader Armed (Gate: ${baseGate}% min)`, 'ok');
      } else {
        TW.toast('AI Auto-Trader Disarmed', 'warn');
      }
      updateSentryUI();
    };

    function updateSentryUI(msg) {
      const active = aiAutoOn.checked;
      const effectiveGate = baseGate + consecutiveLosses * 5;
      aiAutoBadge.textContent = active ? 'ARMED' : 'OFF';
      aiAutoBadge.style.background = active ? 'rgba(0,255,163,0.15)' : 'rgba(255,255,255,0.06)';
      aiAutoBadge.style.color = active ? '#00ffa3' : '#9fb0cc';

      if (!active) {
        aiSentryStatus.innerHTML = `Status: <span style="color:#9fb0cc;">Auto-trading idle. Check switch to arm AI sentry.</span>`;
        return;
      }
      if (msg) {
        aiSentryStatus.innerHTML = msg;
        return;
      }
      aiSentryStatus.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#00ffa3;font-weight:700;">🟢 AI SENTRY ARMED</span>
          <span style="color:#ffd600;">Gate: <b>${effectiveGate}%</b> ${consecutiveLosses > 0 ? `(+${consecutiveLosses * 5}% shield)` : ''}</span>
        </div>
        <div style="font-size:10.5px;color:#9fb0cc;margin-top:3px;">
          Evaluating incoming ticks against strict ${effectiveGate}% gate…
        </div>`;
    }

    async function maybeAutoTrade() {
      if (!aiAutoOn.checked || busy) return;
      if (autoTradeInProgress && autoTradeInProgress.status === 'open') return;
      if (!feed || feed.digits.length < 25) return;

      const now = Date.now();
      const cooldownMs = consecutiveLosses > 0 ? 8000 : 3500;
      if (now - lastAutoTradeTime < cooldownMs) return;

      const effectiveGate = baseGate + consecutiveLosses * 5;

      let signal = null;
      if (cfg.active === 'over-under') {
        signal = (window.TWS && TWS.decideOverUnder) ? TWS.decideOverUnder(feed.digits, feed.prices) : null;
      } else if (cfg.active === 'matches-differs') {
        signal = (window.TWS && TWS.decideMatchesDiffers) ? TWS.decideMatchesDiffers(feed.digits) : null;
      } else if (cfg.active === 'even-odd') {
        signal = (window.TWS && TWS.decideEvenOdd) ? TWS.decideEvenOdd(feed.digits) : null;
      }
      if (!signal) return;

      const conviction = signal.conviction || 50;

      if (conviction < effectiveGate) {
        updateSentryUI(`
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#ff3b69;font-weight:700;">🛡️ VETOED (LOSS SHIELD)</span>
            <span style="color:#9fb0cc;">Conviction: <b>${conviction}%</b> < Gate: <b>${effectiveGate}%</b></span>
          </div>
          <div style="font-size:10.5px;color:#cbd5e1;margin-top:2px;">
            Setup: <b>${signal.decision}</b> — Insufficient edge in current regime. Capital preserved.
          </div>`);
        return;
      }

      lastAutoTradeTime = now;
      if (cfg.active === 'over-under') {
        tab = signal.action; pick = signal.barrier;
      } else if (cfg.active === 'matches-differs') {
        tab = signal.action; pick = signal.digit;
      } else if (cfg.active === 'even-odd') {
        tab = signal.action;
      }
      refresh(false);

      const tradeParams = Object.assign(params(), { bot: 'Advance AI Auto' });

      updateSentryUI(`
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#00ffa3;font-weight:800;">⚡ ORDER EXECUTING</span>
          <span style="color:#00ffa3;">Conviction: <b>${conviction}%</b> ≥ Gate: <b>${effectiveGate}%</b></span>
        </div>
        <div style="font-size:10.5px;color:#cbd5e1;margin-top:2px;">
          Firing <b>${tradeParams.label}</b> on ${TW.volName(top.symbol)}…
        </div>`);

      try {
        autoTradeInProgress = await TW.trade(tradeParams, { silent: true });
        TW.toast(`Auto-Trade: Bought ${tradeParams.label} (${conviction}% Conviction)`, 'ok');

        autoTradeInProgress.done.then(r => {
          lastAutoTradeTime = Date.now();
          if (r.profit > 0) {
            consecutiveLosses = 0;
            TW.toast(`Auto-Trade WON: +${TW.money(r.profit)}`, 'ok');
            updateSentryUI(`
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#00ffa3;font-weight:800;">🎉 WON +${TW.money(r.profit)}</span>
                <span style="color:#00ffa3;">Loss Shield: Reset</span>
              </div>
              <div style="font-size:10.5px;color:#cbd5e1;margin-top:2px;">
                Successfully completed ${tradeParams.label}. Listening for next high-probability setup…
              </div>`);
          } else {
            consecutiveLosses++;
            const elevatedGate = baseGate + consecutiveLosses * 5;
            TW.toast(`Auto-Trade LOST: ${TW.money(r.profit)} (Loss shield elevated gate to ${elevatedGate}%)`, 'err');
            updateSentryUI(`
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#ff3b69;font-weight:800;">⚠ LOSS SHIELD ELEVATED GATE</span>
                <span style="color:#ffd600;">New Gate: <b>${elevatedGate}%</b> (+${consecutiveLosses * 5}%)</span>
              </div>
              <div style="font-size:10.5px;color:#cbd5e1;margin-top:2px;">
                Trade closed with loss. AI Loss Shield activated 8s cooldown and tightened entry criteria to protect capital.
              </div>`);
          }
        });
      } catch (err) {
        if (!err.quiet) TW.toast('Auto-Trader: ' + err.message, 'err');
        updateSentryUI(`
          <div style="color:#ff3b69;font-weight:700;">Trade Error: ${TW.esc(err.message)}</div>
          <div style="font-size:10.5px;color:#9fb0cc;margin-top:2px;">AI Sentry paused.</div>`);
      }
    }

    /* =========================================================================
     * ADVANCE AI SCANNER: SUGGESTIONS FOR EVERY MARKET + #1 HIGHLIGHT + 1000t DEEP SCAN
     * ========================================================================= */
    let computedPillarCandidates = [];
    let timerCountdown = 30;
    let timerInterval = null;

    const btnPillarScan = $('#btnPillarScan');
    const btnPillarDeepScan = $('#btnPillarDeepScan');
    const aiTopSuggestionBox = $('#aiTopSuggestionBox');
    const scanStatusTxt = $('#scanStatusTxt');

    if (btnPillarScan) btnPillarScan.onclick = () => runPillarAiScan(50, false);
    if (btnPillarDeepScan) btnPillarDeepScan.onclick = () => runPillarAiScan(1000, true);

    function runPillarAiScan(tickCount, isDeep) {
      if (btnPillarScan) btnPillarScan.disabled = true;
      if (btnPillarDeepScan) btnPillarDeepScan.disabled = true;
      clearInterval(timerInterval);
      if (scanStatusTxt) scanStatusTxt.textContent = `Scanning 11 markets (${tickCount}t)…`;

      aiTopSuggestionBox.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 8px;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#00ffa3;font-weight:700;">
            <span class="dot live" style="width:10px;height:10px;background:#00ffa3;"></span>
            <span>${isDeep ? '⚛ INGESTING 1000 TICKS ACROSS ALL 11 MARKETS (QUANTUM DEEP SCAN)…' : '⚡ LIGHTNING RAPID SCAN ACROSS ALL 11 MARKETS (50 TICKS)…'}</span>
          </div>
          <div style="font-size:11px;color:#9fb0cc;">
            Calculating empirical distributions, 1st-order Markov matrices, and selecting the single most suitable market…
          </div>
        </div>`;

      const syms = TW.VOLS.filter(v => v.digits);
      let rawResults = [];
      let received = 0;
      let isDone = false;
      let idleTimer = null;

      const sock = new TW.Socket({
        url: TW.tickUrl(),
        onOpen: s => {
          syms.forEach((v, i) => s.send({ ticks_history: v.id, end: 'latest', count: tickCount, style: 'ticks', req_id: i + 1 }));
        },
        onMessage: d => {
          if (!d.req_id) return;
          const v = syms[d.req_id - 1];
          if (!v) return;
          received++;

          if (d.history && d.history.prices) {
            const prices = d.history.prices;
            const pip = v.pip || d.pip_size || TW.volPip(v.id) || 2;
            const dg = prices.map(p => TW.digitOf(p, pip));
            rawResults.push({ v, prices, dg });
          }

          if (scanStatusTxt) scanStatusTxt.textContent = `Received ${received}/${syms.length}…`;

          clearTimeout(idleTimer);
          if (received >= 6 && rawResults.length >= 4) {
            idleTimer = setTimeout(finish, 320);
          }
          if (received >= syms.length) finish();
        }
      });

      const timer = setTimeout(finish, 10000);

      function finish() {
        if (isDone) return;
        isDone = true;
        clearTimeout(timer);
        clearTimeout(idleTimer);
        sock.close();
        if (btnPillarScan) btnPillarScan.disabled = false;
        if (btnPillarDeepScan) btnPillarDeepScan.disabled = false;

        if (!rawResults.length && feed && feed.digits && feed.digits.length >= 15) {
          rawResults.push({
            v: { id: top.symbol, name: TW.volName(top.symbol) },
            prices: feed.prices,
            dg: feed.digits
          });
        }

        if (!rawResults.length) {
          aiTopSuggestionBox.innerHTML = `
            <div style="padding:16px;color:#ff3b69;font-size:12px;text-align:center;background:rgba(255,59,105,0.06);border:1px solid rgba(255,59,105,0.25);border-radius:10px;">
              Scan timed out — Deriv public tick node was unreachable.
              <button class="btn" onclick="document.getElementById('btnPillarScan').click()" style="margin-top:8px;font-size:11px;padding:6px 14px;background:#00ffa3;color:#04101c;font-weight:800;border:0;border-radius:6px;cursor:pointer;">⚡ Retry Rapid Scan</button>
            </div>`;
          return;
        }
        processPillarResults(rawResults, isDeep, tickCount);
      }
    }

    function processPillarResults(rawResults, isDeep, tickCount) {
      const candidates = [];

      rawResults.forEach(item => {
        const { v, prices, dg } = item;
        let dec = null;

        if (cfg.active === 'over-under') {
          dec = (window.TWS && TWS.decideOverUnder) ? TWS.decideOverUnder(dg, prices) : null;
        } else if (cfg.active === 'matches-differs') {
          dec = (window.TWS && TWS.decideMatchesDiffers) ? TWS.decideMatchesDiffers(dg, prices) : null;
        } else if (cfg.active === 'even-odd') {
          dec = (window.TWS && TWS.decideEvenOdd) ? TWS.decideEvenOdd(dg, prices) : null;
        }

        if (dec) {
          const score = (dec.edgePts * 2.0) + (dec.projectedWinPct * 0.8) + (dec.conviction * 1.2);
          candidates.push({ v, dec, score, dg, prices });
        }
      });

      if (!candidates.length) {
        if (feed && feed.digits && feed.digits.length >= 10) {
          let dec = null;
          if (cfg.active === 'over-under') dec = (window.TWS && TWS.decideOverUnder) ? TWS.decideOverUnder(feed.digits, feed.prices) : null;
          else if (cfg.active === 'matches-differs') dec = (window.TWS && TWS.decideMatchesDiffers) ? TWS.decideMatchesDiffers(feed.digits, feed.prices) : null;
          else if (cfg.active === 'even-odd') dec = (window.TWS && TWS.decideEvenOdd) ? TWS.decideEvenOdd(feed.digits, feed.prices) : null;
          if (dec) {
            candidates.push({ v: { id: top.symbol, name: TW.volName(top.symbol) }, dec, score: 85, dg: feed.digits, prices: feed.prices });
          }
        }
      }

      if (!candidates.length) {
        aiTopSuggestionBox.innerHTML = `
          <div style="padding:16px;color:#ff3b69;font-size:12px;text-align:center;">
            Insufficient market signals received. Click below to retry.
            <button class="btn" onclick="document.getElementById('btnPillarScan').click()" style="margin-top:8px;font-size:11px;padding:6px 12px;background:#00ffa3;color:#04101c;font-weight:800;border:0;border-radius:6px;cursor:pointer;">⚡ Retry Rapid Scan</button>
          </div>`;
        return;
      }

      // Sort by edge and conviction to choose the SINGLE MOST SUITABLE result
      candidates.sort((a, b) => b.score - a.score);
      computedPillarCandidates = candidates;
      if (scanStatusTxt) scanStatusTxt.textContent = `Completed (${tickCount}t calibration)`;

      // Render the Single Most Suitable Result Card
      renderTopHighlightCard(candidates[0], isDeep, tickCount);
    }

    function renderTopHighlightCard(topBest, isDeep, tickCount) {
      const dec = topBest.dec;
      const isHighConfidence = dec.conviction >= 85;

      timerCountdown = isDeep ? 45 : 30;
      clearInterval(timerInterval);

      let selectedDur = 5;
      let selectedUnit = 't';

      aiTopSuggestionBox.innerHTML = `
        <div style="border-left:4px solid ${isHighConfidence?'#00ffa3':'#ffd600'};background:linear-gradient(135deg,${isHighConfidence?'rgba(0,255,163,0.12),rgba(0,178,255,0.06)':'rgba(255,214,0,0.08),rgba(255,59,105,0.05)'});border:1.5px solid ${isHighConfidence?'rgba(0,255,163,0.45)':'rgba(255,214,0,0.4)'};padding:16px;border-radius:12px;box-shadow:0 0 20px ${isHighConfidence?'rgba(0,255,163,0.15)':'rgba(255,214,0,0.1)'};">
          
          <!-- Top Badges & Dynamic 3-Color Blinking Validity Timer Badge -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:10px;font-weight:900;color:#04101c;background:${isHighConfidence?'#00ffa3':'#ffd600'};padding:3px 8px;border-radius:4px;letter-spacing:0.4px;">
                👑 #1 SINGLE MOST SUITABLE RECOMMENDATION IN ${cfg.title.toUpperCase()}
              </span>
              <span style="font-size:11px;color:#00b2ff;font-weight:700;">${isDeep ? '1000t Quantum Deep Calibrated' : '50t Lightning Rapid Calibrated'}</span>
            </div>

            <!-- Dynamic Blinking Timer Badge -->
            <div id="topTimerBadge" class="blink-green" style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:0.3px;transition:all 0.3s ease;">
              🟢 <b>${timerCountdown}s</b> · HIGH ALPHA — OK TO PROCEED
            </div>
          </div>

          ${!isHighConfidence ? `
          <!-- Caution notice if conviction < 85% -->
          <div style="margin-top:10px;background:rgba(255,214,0,0.1);border:1px solid rgba(255,214,0,0.3);border-radius:8px;padding:8px 12px;font-size:11.5px;color:#ffd600;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <span>🛡️ <b>AI SAFETY NOTICE:</b> Conviction is <b>${dec.conviction}%</b> (<85% Gate). Suggestion is displayed below. Run 1000t Quantum Deep Scan to verify regime.</span>
            <button type="button" id="btnNoticeDeepPillar" class="btn" style="padding:4px 10px;background:#ffd600;color:#04101c;font-weight:900;font-size:10.5px;border:0;border-radius:5px;cursor:pointer;">⚛ Deep Scan (1000t)</button>
          </div>` : ''}

          <!-- Headline Recommendation -->
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:10px;flex-wrap:wrap;gap:6px;">
            <div>
              <span style="font-size:11.5px;color:#9fb0cc;">Selected Market:</span>
              <h3 style="margin:2px 0 0 0;font-size:19px;font-weight:900;color:#fff;">
                ${topBest.v.name} ➔ <span style="color:#00ffa3;font-size:20px;">${dec.decision}</span>
              </h3>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10.5px;color:#8e9ab3;font-weight:700;">CONVICTION:</div>
              <div style="font-size:17px;font-weight:900;color:${isHighConfidence?'#00ffa3':'#ffd600'};">${dec.conviction}%</div>
            </div>
          </div>

          <!-- Statistical Metrics Grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;font-size:11.5px;color:#cbd5e1;margin-top:10px;background:rgba(0,0,0,0.35);padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
            <div>
              <span style="font-size:10px;color:#8e9ab3;font-weight:700;display:block;">WIN PROB</span>
              <b style="color:#00ffa3;font-size:15px;">${dec.projectedWinPct}%</b>
            </div>
            <div>
              <span style="font-size:10px;color:#8e9ab3;font-weight:700;display:block;">PAST HIT (${topBest.dg.length}t)</span>
              <b style="color:#fff;font-size:15px;">${dec.pastHitPct}%</b>
            </div>
            <div>
              <span style="font-size:10px;color:#8e9ab3;font-weight:700;display:block;">NET STAT EDGE</span>
              <b style="color:#00b2ff;font-size:15px;">+${dec.edgePts} pts</b>
            </div>
            <div>
              <span style="font-size:10px;color:#8e9ab3;font-weight:700;display:block;">BROKER ODDS</span>
              <b style="color:#7d8aa5;font-size:15px;">${dec.nullPct}%</b>
            </div>
          </div>

          <!-- DEDICATED CARD: PERFECT ENTRY SIGNAL & EXACT TIMING DIRECTIVE -->
          <div style="margin-top:12px;background:rgba(0,0,0,0.35);border:1px solid rgba(0,255,163,0.35);border-radius:10px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
              <span style="font-size:11.5px;font-weight:900;color:#00ffa3;letter-spacing:0.3px;">🎯 PERFECT ENTRY &amp; TIMING DIRECTIVE</span>
              <span style="font-size:10.5px;color:#00b2ff;font-weight:700;">PROVEN MARKOV PERSISTENCE</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
              <div style="background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);">
                <span style="color:#8e9ab3;font-weight:700;display:block;">ENTRY TRIGGER:</span>
                <b style="color:#fff;">Enter immediately on live signal (${dec.decision})</b>
              </div>
              <div style="background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);">
                <span style="color:#8e9ab3;font-weight:700;display:block;">TIMING DIRECTIVE:</span>
                <b style="color:#00ffa3;">USE 5 TICKS (~5s) or 15 SECONDS</b>
              </div>
            </div>

            <!-- Suggested Duration Chips -->
            <div style="margin-top:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:10.5px;color:#8e9ab3;font-weight:700;">SELECT DURATION:</span>
              <button type="button" class="top-sug-dur active" data-d="5" data-u="t" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:800;border:1px solid #00ffa3;background:#00ffa3;color:#04101c;cursor:pointer;">5 Ticks (Optimal)</button>
              <button type="button" class="top-sug-dur" data-d="1" data-u="t" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;">1 Tick (Fast)</button>
              <button type="button" class="top-sug-dur" data-d="10" data-u="t" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;">10 Ticks</button>
              <button type="button" class="top-sug-dur" data-d="15" data-u="s" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;">15 Seconds</button>
            </div>
          </div>

          <!-- Real Working Action Buttons with on-card Rescan -->
          <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button type="button" id="btnPlaceTopBet" class="btn" style="flex:1.4;min-width:180px;padding:11px 14px;font-size:12px;font-weight:900;background:linear-gradient(90deg,#00ffa3,#00b2ff);color:#04101c;border:0;border-radius:8px;cursor:pointer;box-shadow:0 0 16px rgba(0,255,163,0.3);">
              ⚡ 1-CLICK BET (${dec.decision} · USE 5 TICKS)
            </button>
            <button type="button" id="btnApplyTopControls" class="btn" style="flex:1.1;min-width:150px;padding:11px 12px;font-size:11.5px;font-weight:800;background:#141e33;border:1px solid rgba(0,255,163,0.4);color:#00ffa3;border-radius:8px;cursor:pointer;">
              🎯 APPLY TO PANEL
            </button>
            <button type="button" id="btnPillarRescanCard" class="btn" style="flex:0.9;min-width:110px;padding:11px 12px;font-size:11px;font-weight:800;background:#1e293b;border:1px solid #00b2ff;color:#00b2ff;border-radius:8px;cursor:pointer;">
              ⚡ RESCAN (50t)
            </button>
            <button type="button" id="btnPillarDeepScanCard" class="btn" style="flex:1;min-width:140px;padding:11px 12px;font-size:11px;font-weight:800;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.2);color:#cbd5e1;border-radius:8px;cursor:pointer;">
              ⚛ DEEP SCAN (1000t)
            </button>
          </div>
        </div>`;

      function updateTimerBadge(secs) {
        const badge = document.getElementById('topTimerBadge');
        if (!badge) return;
        badge.classList.remove('blink-green', 'blink-amber', 'blink-red');
        if (secs > 10) {
          badge.classList.add('blink-green');
          badge.style.background = 'rgba(0,255,163,0.15)';
          badge.style.color = '#00ffa3';
          badge.style.border = '1px solid #00ffa3';
          badge.innerHTML = `🟢 <b>${secs}s</b> · HIGH ALPHA — OK TO PROCEED`;
        } else if (secs > 0) {
          badge.classList.add('blink-amber');
          badge.style.background = 'rgba(255,214,0,0.15)';
          badge.style.color = '#ffd600';
          badge.style.border = '1px solid #ffd600';
          badge.innerHTML = `🟡 <b>${secs}s</b> · EXPIRING SOON — PROCEED WITH CAUTION`;
        } else {
          badge.classList.add('blink-red');
          badge.style.background = 'rgba(255,59,105,0.18)';
          badge.style.color = '#ff3b69';
          badge.style.border = '1px solid #ff3b69';
          badge.innerHTML = `🔴 <b>EXPIRED</b> · RESCAN REQUIRED — DO NOT TRADE`;
        }
      }

      updateTimerBadge(timerCountdown);

      timerInterval = setInterval(() => {
        timerCountdown--;
        updateTimerBadge(timerCountdown);
        if (timerCountdown <= 0) {
          clearInterval(timerInterval);
        }
      }, 1000);

      function updateBetButtonLabel() {
        const btn = document.getElementById('btnPlaceTopBet');
        if (btn) {
          const uLabel = selectedUnit === 't' ? 'TICKS' : selectedUnit === 's' ? 'SEC' : 'MIN';
          btn.textContent = `⚡ 1-CLICK BET (${dec.decision} · USE ${selectedDur} ${uLabel})`;
        }
      }

      document.querySelectorAll('.top-sug-dur').forEach(b => {
        b.onclick = () => {
          document.querySelectorAll('.top-sug-dur').forEach(x => {
            x.classList.remove('active');
            x.style.background = 'rgba(255,255,255,0.06)';
            x.style.color = '#cbd5e1';
            x.style.borderColor = 'rgba(255,255,255,0.12)';
          });
          b.classList.add('active');
          b.style.background = '#00ffa3';
          b.style.color = '#04101c';
          b.style.borderColor = '#00ffa3';
          selectedDur = +b.dataset.d;
          selectedUnit = b.dataset.u;
          updateBetButtonLabel();
        };
      });

      $('#btnPlaceTopBet').onclick = async () => {
        applySuggestionToState(topBest.v.id, dec, selectedDur, selectedUnit);
        const stake = +$('#stake').value || 1;
        const p = {
          contract_type: cfg.contract(tab, pick),
          symbol: top.symbol,
          amount: stake,
          duration: selectedDur,
          duration_unit: selectedUnit,
          label: cfg.label(tab, pick)
        };
        if (cfg.picker) p.barrier = pick;

        try {
          TW.toast(`Placing 1-Click Bet: ${p.label} (${selectedDur}${selectedUnit}) on ${TW.volName(p.symbol)}…`, 'ok');
          const t = await TW.trade(p);
          t.done.then(r => {
            TW.toast((r.profit > 0 ? 'WON +' : 'LOST ') + TW.money(r.profit), r.profit > 0 ? 'ok' : 'err');
          });
        } catch (err) {
          if (!err.quiet) TW.toast(err.message, 'err', 5000);
        }
      };

      $('#btnApplyTopControls').onclick = () => {
        applySuggestionToState(topBest.v.id, dec, selectedDur, selectedUnit);
        TW.toast(`Applied ${dec.decision} on ${TW.volName(topBest.v.id)} to panel!`, 'ok');
      };

      // On-card Rescan & Deep Scan
      $('#btnPillarRescanCard').onclick = () => runPillarAiScan(50, false);
      $('#btnPillarDeepScanCard').onclick = () => runPillarAiScan(1000, true);
      const btnNoticeDeep = $('#btnNoticeDeepPillar');
      if (btnNoticeDeep) btnNoticeDeep.onclick = () => runPillarAiScan(1000, true);
    }

    function applySuggestionToState(symbol, dec, durationVal, durationUnitVal) {
      top.symbol = symbol;
      const sel = $('#twSym');
      if (sel) sel.value = symbol;

      if (cfg.active === 'over-under') {
        tab = dec.action;
        pick = dec.barrier;
      } else if (cfg.active === 'matches-differs') {
        tab = dec.action;
        pick = dec.digit;
      } else if (cfg.active === 'even-odd') {
        tab = dec.action;
      }

      if (durationVal) {
        dur = durationVal;
        $('#dur').value = dur;
      }
      if (durationUnitVal) {
        durUnit = durationUnitVal;
        const uEl = $('#durUnitTxt');
        if (uEl) uEl.textContent = durUnit === 't' ? 'ticks' : 'seconds';
      }

      restart();
      refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Initialize market feed
    restart();

    // Automatically trigger lightning 50-tick Rapid Scan on load for instant best recommendation
    setTimeout(() => {
      runPillarAiScan(50, false);
    }, 350);
  });
};
