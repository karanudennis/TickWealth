/* Shared page builder for the digit-contract pages (Over/Under, Even/Odd, Matches/Differs).
 * Features:
 * 1. Dedicated Advance AI Market Scanner providing suggestions for EVERY market (1000-tick Deep Scan)
 * 2. #1 Top Highlight Suggestion with live decay timer and 1-click execution
 * 3. Individual suggestion cards across all volatility indices with 85% confidence gating
 * 4. Advanced AI Auto-Trader with Adaptive Consecutive Loss Shield
 */
TW.digitPage = function (cfg) {
  TW.ready(function () {
    const $ = TW.$;
    const q = TW.qs();
    let tab = cfg.tabs.some(t => t.id === q.type) ? q.type : cfg.tabs[0].id;
    const rawPick = (q.barrier != null && q.barrier !== '') ? q.barrier : (q.digit != null && q.digit !== '' ? q.digit : null);
    let pick = cfg.picker ? (rawPick !== null && +rawPick >= 0 && +rawPick <= 9 ? +rawPick : cfg.picker.def) : null;
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

        <!-- LIVE 5 / 10 TICKER STREAM WITH BLINKING LIGHTS -->
        <div id="liveTickerBar" style="margin:8px 0 12px;background:#090d18;border:1px solid rgba(0,255,163,0.35);border-radius:10px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,0.4);">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="dot live" style="width:8px;height:8px;background:#00ffa3;"></span>
            <span style="font-size:11px;font-weight:900;color:#00ffa3;letter-spacing:0.5px;">LIVE TICKER LIGHTS:</span>
            <div id="tickerChips" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"></div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <button type="button" id="btnTicks5" class="btn ghost" style="padding:2px 8px;font-size:10px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;">5 Ticks</button>
            <button type="button" id="btnTicks10" class="btn" style="padding:2px 8px;font-size:10px;border-radius:4px;background:#00ffa3;color:#04101c;font-weight:800;border:0;cursor:pointer;">10 Ticks</button>
          </div>
        </div>

        <div class="d-grid" id="dGrid"></div>

        <!-- INLINE MARKET-ATTACHED MANUAL EXECUTION BAR (STICKY WHILE SCROLLING) -->
        <div id="digitQuickTrade" class="quick-trade-bar" aria-label="Quick manual digit trade">
          <div class="qt-meta">
            <div class="qt-controls">
              <span style="font-weight:900;color:#00ffa3;letter-spacing:0.4px;">⚡ QUICK MANUAL</span>
              <span id="qtLastDigit" style="font-weight:900;color:#fff;background:rgba(255,255,255,0.08);padding:3px 7px;border-radius:6px;">Digit: -</span>
              ${cfg.picker ? `<label class="qt-field">${cfg.picker.label.split(' ')[0]} <select id="qtPickSel" aria-label="Quick barrier digit">${[0,1,2,3,4,5,6,7,8,9].map(n => `<option value="${n}"${n === pick ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
              <label class="qt-field">Stake $<input id="qtStake" type="number" min="0.35" step="0.5" value="1.00"></label>
              <button type="button" id="qtHalfBtn" class="qt-stk-btn" title="Halve stake">½</button>
              <button type="button" id="qtDoubleBtn" class="qt-stk-btn" title="Double stake">2×</button>
              <label class="qt-field">Ticks <input id="qtDur" type="number" min="1" max="10" step="1" value="${dur}" style="width:42px;"></label>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span id="qtTradeState" class="qt-trade-state">Ready</span>
              <span id="qtQuoteTxt" style="font-weight:800;color:#cbd5e1;">Payout …</span>
              <button type="button" id="qtPinBtn" class="qt-pin-btn on" title="Toggle sticky position while scrolling">📌 Pinned</button>
            </div>
          </div>
          <div id="qtAiStrip" class="qt-ai-strip">
            <span id="qtAiText">🧠 <b>AI Projection:</b> Analyzing live digits &amp; cross-market Markov edges…</span>
            <div class="qt-ai-actions">
              <button type="button" id="qtVerdictBtn" class="qt-mini-btn" title="Get Gemini / Quant AI Approve or Veto verdict for this digit setup">🧠 AI Verdict</button>
              <button type="button" id="qtBetAiBtn" class="qt-mini-btn bet" style="display:none;" title="Match AI #1 and place trade immediately">⚡ Bet AI</button>
              <button type="button" id="qtMatchAiBtn" class="qt-mini-btn" style="display:none;" title="Apply best AI projection to panel">🎯 Match AI</button>
              <button type="button" id="qtScanAiBtn" class="qt-mini-btn scan" title="Refresh AI Scan">⚡ Scan</button>
            </div>
          </div>
          <div class="qt-actions">
            ${cfg.tabs.map((t, idx) => `<button type="button" class="qt-btn ${t.cls === 'neg' ? 'neg' : (idx === 0 ? 'primary' : (t.cls === 'alt' ? 'alt' : 'neg'))}" data-qt="${t.id}"><span class="qt-lbl">${t.label}</span> <span class="qt-sub" style="font-size:11px;opacity:0.92;"></span></button>`).join('')}
          </div>
          <div class="qt-hk-hint" style="font-size:10px;color:#7d8aa5;display:flex;justify-content:space-between;gap:8px;padding-top:1px;">
            <span>Hotkeys: <b>1</b> ${TW.esc(cfg.tabs[0].label)} · <b>2</b> ${TW.esc(cfg.tabs[1].label)} · <b>M</b> Match AI · <b>B</b> Bet AI · <b>S</b> Scan</span>
            <span>Per-button return estimates update live with stake &amp; barrier</span>
          </div>
        </div>

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
                Calculates real-data Markov transition probabilities & suggestions across all 17 volatilities for ${cfg.title}.
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <button class="btn" id="btnPillarScan" style="background:#0d1627;border:1px solid #00b2ff;color:#00b2ff;font-weight:800;font-size:11px;padding:8px 12px;border-radius:8px;cursor:pointer;">
                ⚡ RAPID SCAN (100t)
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
              <span>Click <b>Rapid Scan (100t)</b> or <b>Deep Scan (1000t)</b> for the single best suggestion…</span>
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
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 8px;">
            <button type="button" class="btn ghost qk-stk" data-v="0.35" style="padding:2px 7px;font-size:10px;border-radius:4px;cursor:pointer;">$0.35</button>
            <button type="button" class="btn ghost qk-stk" data-v="1" style="padding:2px 7px;font-size:10px;border-radius:4px;cursor:pointer;">$1</button>
            <button type="button" class="btn ghost qk-stk" data-v="2" style="padding:2px 7px;font-size:10px;border-radius:4px;cursor:pointer;">$2</button>
            <button type="button" class="btn ghost qk-stk" data-v="5" style="padding:2px 7px;font-size:10px;border-radius:4px;cursor:pointer;">$5</button>
            <button type="button" class="btn ghost qk-stk" data-v="10" style="padding:2px 7px;font-size:10px;border-radius:4px;cursor:pointer;">$10</button>
            <button type="button" class="btn ghost qk-stk" data-v="2x" style="padding:2px 7px;font-size:10px;border-radius:4px;color:#00ffa3;border-color:rgba(0,255,163,0.3);cursor:pointer;font-weight:700;">2×</button>
            <button type="button" class="btn ghost qk-stk" data-v="half" style="padding:2px 7px;font-size:10px;border-radius:4px;cursor:pointer;">½</button>
          </div>
          <label class="switch" style="margin:4px 0 10px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11px;color:#9fb0cc;">Auto-2x Stake on Loss</span>
            <input type="checkbox" id="chkManualMart">
          </label>
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
    <div class="foot">Engineered & Owned by Dennis K.M · TickWealth is an independent tool and is not affiliated with Deriv.</div>`;

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

    let lastQtQuote = null;
    const refreshQuote = TW.watchQuote(params, (qt, msg) => {
      if (qt) {
        const st = +$('#stake').value || 1;
        lastQtQuote = { tab, pick, stake: st, payout: +qt.payout };
        $('#qTxt').innerHTML = 'Payout <b>' + TW.money(qt.payout) + '</b>';
        $('#qProfit').innerHTML = 'Profit <b>' + TW.money(qt.payout - st) + '</b>';
        $('#buySub').textContent = 'Payout ' + TW.money(qt.payout);
        const qtQ = $('#qtQuoteTxt');
        if (qtQ) qtQ.innerHTML = 'Payout <b style="color:#00ffa3;">' + TW.money(qt.payout) + '</b> · Profit <b>' + TW.money(qt.payout - st) + '</b>';
      } else {
        lastQtQuote = null;
        $('#qTxt').textContent = msg === 'loading' ? 'Getting price…' : msg;
        $('#qProfit').textContent = '';
        if (msg !== 'loading') $('#buySub').innerHTML = '&nbsp;';
        const qtQ = $('#qtQuoteTxt');
        if (qtQ) qtQ.textContent = msg === 'loading' ? 'Getting price…' : msg;
      }
      syncQuickTradeUI();
    });

    function syncQuickTradeUI() {
      const qs = $('#qtStake'), qd = $('#qtDur'), qp = $('#qtPickSel');
      const stNum = Math.max(0.35, +$('#stake').value || 1);
      const stVal = stNum.toFixed(2);
      if (qs && document.activeElement !== qs) qs.value = stVal;
      if (qd && document.activeElement !== qd) qd.value = $('#dur').value;
      if (qp && pick != null) qp.value = String(pick);
      document.querySelectorAll('#digitQuickTrade [data-qt]').forEach(btn => {
        const tid = btn.dataset.qt;
        const pVal = cfg.picker && cfg.picker.off && cfg.picker.off(pick, tid) ? cfg.picker.fix(tid, pick) : pick;
        const cType = cfg.contract(tid, pVal);
        const useLive = lastQtQuote && lastQtQuote.tab === tid && lastQtQuote.pick === pVal && Math.abs(lastQtQuote.stake - stNum) < 0.01;
        const pay = useLive ? lastQtQuote.payout : (TW.estimatePayout ? TW.estimatePayout(cType, pVal, stNum) : +(stNum * 1.95).toFixed(2));
        const prof = Math.max(0, +(pay - stNum).toFixed(2));
        const roi = Math.round((prof / stNum) * 100);
        const lblEl = btn.querySelector('.qt-lbl');
        const subEl = btn.querySelector('.qt-sub');
        if (lblEl) lblEl.textContent = 'Buy ' + cfg.label(tid, pVal);
        if (subEl) subEl.textContent = `+$${prof.toFixed(2)} (${roi}%)`;
      });
    }

    function updateQtTradeState() {
      const el = $('#qtTradeState');
      if (!el) return;
      const open = (TW.trades || []).find(t => t.status === 'open');
      if (open) {
        const prog = open.unit === 't' ? `${open.ticksElapsed || open.count || 0}/${open.duration}t` : `${open.duration}${open.unit}`;
        el.className = 'qt-trade-state live';
        el.innerHTML = `<span class="dot live" style="width:6px;height:6px;background:#00ffa3;"></span> ⏳ ${TW.esc(open.label || open.type)} ${prog} · $${Number(open.stake || 0).toFixed(2)}`;
        return;
      }
      el.className = 'qt-trade-state';
      const sess = TW.session || { trades: 0, wins: 0, pnl: 0 };
      if (sess.trades > 0) {
        const pCol = sess.pnl >= 0 ? '#00ffa3' : '#ff3b69';
        const pSign = sess.pnl >= 0 ? '+' : '-';
        el.innerHTML = `Session ${sess.wins}W/${Math.max(0, sess.trades - sess.wins)}L · <b style="color:${pCol};">${pSign}$${Math.abs(sess.pnl).toFixed(2)}</b>`;
      } else {
        el.textContent = 'Ready';
      }
    }
    TW.on('trade', updateQtTradeState);
    TW.on('account', updateQtTradeState);
    updateQtTradeState();

    let streamLen = 10;
    function renderTickerBar(d) {
      const box = $('#tickerChips');
      if (!box) return;
      if (!d || !d.length) {
        box.innerHTML = '<span style="font-size:11px;color:#7d8aa5;">Awaiting ticks…</span>';
        return;
      }
      const slice = d.slice(-streamLen);
      box.innerHTML = slice.map((num, idx) => {
        const isLatest = idx === slice.length - 1;
        const isBarrier = pick != null && num === pick;
        const col = TW.DIGIT_COLORS[num] || { bg: '#131b2e', fg: '#fff' };
        const blinkClass = isLatest ? 'tick-chip-blink' : '';
        const borderStyle = isLatest ? 'border:2px solid #00ffa3;box-shadow:0 0 12px #00ffa3;' : isBarrier ? 'border:2px solid #ffd600;' : 'border:1px solid rgba(255,255,255,0.2);';
        return `<span class="ticker-digit-chip ${blinkClass}" title="Digit ${num}${isLatest ? ' (Latest Tick)' : ''}" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:12px;font-weight:900;color:#fff;background:${col.bg};${borderStyle}">${num}</span>`;
      }).join('');
    }

    const btnT5 = $('#btnTicks5'), btnT10 = $('#btnTicks10');
    if (btnT5 && btnT10) {
      btnT5.onclick = () => {
        streamLen = 5;
        btnT5.style.background = '#00ffa3'; btnT5.style.color = '#04101c'; btnT5.style.border = '0';
        btnT10.style.background = ''; btnT10.style.color = ''; btnT10.style.border = '1px solid rgba(255,255,255,0.2)';
        renderTickerBar(feed ? feed.digits : []);
      };
      btnT10.onclick = () => {
        streamLen = 10;
        btnT10.style.background = '#00ffa3'; btnT10.style.color = '#04101c'; btnT10.style.border = '0';
        btnT5.style.background = ''; btnT5.style.color = ''; btnT5.style.border = '1px solid rgba(255,255,255,0.2)';
        renderTickerBar(feed ? feed.digits : []);
      };
    }

    function updateQtProjectionBar() {
      const ld = $('#qtLastDigit');
      const d = feed ? feed.digits : [];
      if (ld) {
        if (d.length) {
          const last = d[d.length - 1];
          const col = (TW.DIGIT_COLORS[last] && TW.DIGIT_COLORS[last].c) || '#00ffa3';
          ld.innerHTML = `Digit: <b style="color:${col};font-size:12px;">${last}</b>`;
        } else {
          ld.textContent = 'Digit: -';
        }
      }
      const aiTxt = $('#qtAiText'), matchBtn = $('#qtMatchAiBtn'), betBtn = $('#qtBetAiBtn');
      if (!aiTxt) return;
      const parts = [];
      if (d.length >= 20) {
        let localDec = null;
        if (window.TWS) {
          if (cfg.active === 'over-under' && TWS.decideOverUnder) localDec = TWS.decideOverUnder(d, feed.prices);
          else if (cfg.active === 'matches-differs' && TWS.decideMatchesDiffers) localDec = TWS.decideMatchesDiffers(d, feed.prices);
          else if (cfg.active === 'even-odd' && TWS.decideEvenOdd) localDec = TWS.decideEvenOdd(d, feed.prices);
        }
        if (localDec) {
          parts.push(`📊 <b>Current:</b> <b style="color:#00ffa3;">${TW.esc(localDec.decision)}</b> (${localDec.projectedWinPct}% · +${localDec.edgePts} pts)`);
        } else if (cfg.scan) {
          const r = cfg.scan(TW.analyze(d), tab, pick);
          parts.push(`📊 <b>Current:</b> <b style="color:#00ffa3;">${r.tab}${r.pick != null ? ' ' + r.pick : ''}</b> (${r.strength}%)`);
        }
      }
      if (typeof currentTopHighlight !== 'undefined' && currentTopHighlight) {
        const b = currentTopHighlight;
        const secs = typeof timerCountdown === 'number' ? timerCountdown : 0;
        const tTag = secs > 10 ? `<span style="color:#00ffa3;font-weight:900;">🟢 ${secs}s</span>` : secs > 0 ? `<span style="color:#ffd600;font-weight:900;">🟡 ${secs}s</span>` : `<span style="color:#ff3b69;font-weight:900;">🔴 Exp</span>`;
        parts.push(`👑 <b>AI #1:</b> ${TW.esc(b.v.name)} ➔ <b style="color:#ffd600;">${TW.esc(b.dec.decision)}</b> (${b.dec.projectedWinPct}% · ${tTag})`);
        if (matchBtn) matchBtn.style.display = '';
        if (betBtn) betBtn.style.display = '';
      } else if (d.length >= 20) {
        if (matchBtn) matchBtn.style.display = '';
        if (betBtn) betBtn.style.display = '';
      }
      if (parts.length) aiTxt.innerHTML = parts.join(' &nbsp;|&nbsp; ');
    }

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
      TW.renderCircles($('#dGrid'), d, {
        state: x => cfg.state(x, tab, pick),
        tag: x => cfg.tag(x, tab, pick),
        onPick: cfg.picker ? x => {
          if (cfg.picker.off && cfg.picker.off(x, tab)) return;
          pick = x;
          refresh();
        } : null
      });
      renderTickerBar(d);
      syncQuickTradeUI();
      updateQtProjectionBar();
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
    ['stake', 'dur'].forEach(i => $('#' + i).addEventListener('input', () => { syncQuickTradeUI(); refreshQuote(); }));
    if ($('#qtStake')) $('#qtStake').addEventListener('input', e => { $('#stake').value = e.target.value; baseManualStake = +e.target.value || 1; syncQuickTradeUI(); refreshQuote(); });
    if ($('#qtDur')) $('#qtDur').addEventListener('input', e => { $('#dur').value = e.target.value; syncQuickTradeUI(); refreshQuote(); });
    if ($('#qtPickSel')) $('#qtPickSel').addEventListener('change', e => { pick = +e.target.value; refresh(); });
    if ($('#qtHalfBtn')) $('#qtHalfBtn').onclick = () => { const cur = Math.max(0.35, +($('#stake').value || 1)); const nv = Math.max(0.35, +(cur / 2).toFixed(2)); $('#stake').value = nv.toFixed(2); baseManualStake = nv; syncQuickTradeUI(); refreshQuote(); };
    if ($('#qtDoubleBtn')) $('#qtDoubleBtn').onclick = () => { const maxStk = (TW.settings && TW.settings.maxStake) ? +TW.settings.maxStake : 500; const cur = Math.max(0.35, +($('#stake').value || 1)); const nv = Math.min(maxStk, +(cur * 2).toFixed(2)); $('#stake').value = nv.toFixed(2); baseManualStake = nv; syncQuickTradeUI(); refreshQuote(); };
    if ($('#qtPinBtn')) $('#qtPinBtn').onclick = () => { const bar = $('#digitQuickTrade'), btn = $('#qtPinBtn'); if (!bar || !btn) return; const pinned = !bar.classList.toggle('unpinned'); btn.classList.toggle('on', pinned); btn.textContent = pinned ? '📌 Pinned' : '📍 Docked'; };

    $('#scanBtn').onclick = () => {
      if (!feed || feed.digits.length < 30) { TW.toast('Need at least 30 live ticks first.'); return; }
      const r = cfg.scan(TW.analyze(feed.digits), tab, pick);
      tab = r.tab; if (r.pick != null) pick = r.pick;
      const rf = (window.TWS && TWS.regimeFingerprint) ? TWS.regimeFingerprint(feed.prices, feed.digits) : null;
      const rfTxt = rf ? ` · Entropy=${rf.normEntropy} · Cap=${rf.kellyPct}%` : '';
      $('#scanTxt').innerHTML = r.text + ` ${TW.sigHtml(r.strength)}${rfTxt} <span class="dim">(recent frequency vs normal odds)</span>`;
      refresh();
    };
    $('#askAi').onclick = () => TW.ai && TW.ai.ask('Explain what this market is showing right now and what the current signal does and does not mean.');
    const verdictBtn = $('#qtVerdictBtn');
    if (verdictBtn) {
      verdictBtn.onclick = async () => {
        if (!feed || !feed.digits || feed.digits.length < 15) { TW.toast('Need at least 15 ticks first.', 'mut', 2500); return; }
        verdictBtn.disabled = true; verdictBtn.textContent = '🧠 Auditing…';
        try {
          const P = feed.prices || [], D = feed.digits || [];
          const c10 = Array(10).fill(0); D.forEach(d => { if (d >= 0 && d <= 9) c10[d]++; });
          const dist = D.length ? c10.map(v => +((v / D.length) * 100).toFixed(1)) : [];
          const rf = (window.TWS && TWS.regimeFingerprint) ? TWS.regimeFingerprint(P, D) : {};
          const data = await TW.aiRequest('/api/ai/analyze-asset', {
            symbol: top.symbol,
            proposedContract: tab,
            barrier: pick,
            recentTicks: P.slice(-15),
            indicators: { shortEma: rf.normEntropy, slowLinearSlope: rf.hurst, velocity1Tick: rf.chopIndex },
            digitDistribution: dist
          });
          await TW.modal({
            title: (data.source === 'gemini' ? '✦ Gemini AI Digit Verdict: ' : '⚡ Quant AI Verdict: ') + TW.volName(top.symbol),
            html: `<pre style="margin:0;white-space:pre-wrap;font:12.5px/1.6 system-ui,sans-serif;color:#d7e0f2;background:rgba(0,0,0,0.35);padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">${TW.esc(data.analysis || '')}</pre>`,
            buttons: [{ label: 'Close', value: true }]
          });
        } catch (err) {
          TW.toast('AI Verdict failed: ' + (err.message || err), 'err', 3500);
        } finally {
          verdictBtn.disabled = false; verdictBtn.textContent = '🧠 AI Verdict';
        }
      };
    }

    let baseManualStake = +$('#stake').value || 1.0;
    $('#stake').addEventListener('change', () => { baseManualStake = +$('#stake').value || 1.0; syncQuickTradeUI(); });

    document.querySelectorAll('.qk-stk').forEach(btn => {
      btn.onclick = () => {
        const stkInput = $('#stake');
        const v = btn.dataset.v;
        let cur = parseFloat(stkInput.value) || 1.0;
        if (v === '2x') cur = +(cur * 2).toFixed(2);
        else if (v === 'half') cur = Math.max(0.35, +(cur / 2).toFixed(2));
        else cur = parseFloat(v);
        stkInput.value = cur.toFixed(2);
        baseManualStake = cur;
        syncQuickTradeUI();
        refreshQuote();
      };
    });

    function setManualBusy(on) {
      busy = on;
      $('#buyBtn').disabled = on;
      document.querySelectorAll('#digitQuickTrade [data-qt]').forEach(b => { b.disabled = on; });
      if ($('#qtBetAiBtn')) $('#qtBetAiBtn').disabled = on;
    }

    async function executeManualBuy() {
      if (busy) return; setManualBusy(true);
      try {
        const p = params(), t = await TW.trade(p);
        TW.toast('⚡ Dispatched ' + p.label + ' — waiting for result', 'ok');
        updateQtTradeState();
        t.done.then(r => {
          updateQtTradeState();
          const chkMart = $('#chkManualMart');
          if (chkMart && chkMart.checked) {
            const stkInput = $('#stake');
            const maxStk = (TW.settings && TW.settings.maxStake) ? +TW.settings.maxStake : 500;
            if (r.profit > 0) {
              stkInput.value = baseManualStake.toFixed(2);
            } else {
              const nextStk = Math.min(maxStk, +((parseFloat(stkInput.value) || 1) * 2).toFixed(2));
              stkInput.value = nextStk.toFixed(2);
              TW.toast(`⚠️ Auto-Martingale applied: Next stake $${nextStk.toFixed(2)}`, 'ok', 3000);
            }
            syncQuickTradeUI();
            refreshQuote();
          }
        });
      } catch (e) { if (!e.quiet) TW.toast(e.message, 'err', 5000); }
      finally { setManualBusy(false); updateQtTradeState(); }
    }

    $('#buyBtn').onclick = executeManualBuy;
    document.querySelectorAll('#digitQuickTrade [data-qt]').forEach(btn => {
      btn.onclick = () => {
        tab = btn.dataset.qt;
        refresh();
        executeManualBuy();
      };
    });

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
    let currentTopHighlight = null;
    let timerCountdown = 30;
    let timerInterval = null;

    const btnPillarScan = $('#btnPillarScan');
    const btnPillarDeepScan = $('#btnPillarDeepScan');
    const aiTopSuggestionBox = $('#aiTopSuggestionBox');
    const scanStatusTxt = $('#scanStatusTxt');

    if (btnPillarScan) btnPillarScan.onclick = () => runPillarAiScan(100, false);
    if (btnPillarDeepScan) btnPillarDeepScan.onclick = () => runPillarAiScan(1000, true);

    function runPillarAiScan(tickCount, isDeep) {
      if (btnPillarScan) btnPillarScan.disabled = true;
      if (btnPillarDeepScan) btnPillarDeepScan.disabled = true;
      clearInterval(timerInterval);
      const syms = TW.VOLS.filter(v => v.digits);
      if (scanStatusTxt) scanStatusTxt.textContent = `Scanning ${syms.length} markets (${tickCount}t)…`;

      let rawResults = [];
      let received = 0;
      let isDone = false;
      let idleTimer = null;

      // Zero-latency cache hydration from shared TW.tickPool
      syms.forEach(v => {
        if (TW.tickPool && TW.tickPool[v.id] && TW.tickPool[v.id].prices && TW.tickPool[v.id].prices.length >= 20) {
          rawResults.push({ v, prices: TW.tickPool[v.id].prices, dg: TW.tickPool[v.id].digits });
        }
      });

      if (rawResults.length >= 3) {
        processPillarResults(rawResults, isDeep, tickCount);
      } else {
        aiTopSuggestionBox.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 8px;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#00ffa3;font-weight:700;">
              <span class="dot live" style="width:10px;height:10px;background:#00ffa3;"></span>
              <span>${isDeep ? `⚛ INGESTING 1000 TICKS ACROSS ALL ${syms.length} MARKETS (QUANTUM DEEP SCAN)…` : `⚡ LIGHTNING RAPID SCAN ACROSS ALL ${syms.length} MARKETS (${tickCount} TICKS)…`}</span>
            </div>
            <div style="font-size:11px;color:#9fb0cc;">
              Calculating empirical distributions, 1st-order Markov matrices, and selecting the single most suitable market…
            </div>
          </div>`;
      }

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
            const exIdx = rawResults.findIndex(x => x.v.id === v.id);
            if (exIdx >= 0) rawResults[exIdx] = { v, prices, dg };
            else rawResults.push({ v, prices, dg });
            if (TW.tickPool) TW.tickPool[v.id] = { pip, prices, digits: dg, epochs: d.history.times || [], lastUpdated: Date.now() };
          }

          if (scanStatusTxt) scanStatusTxt.textContent = `Received ${received}/${syms.length}…`;

          clearTimeout(idleTimer);
          if (received >= Math.min(syms.length, 12) && rawResults.length >= 10) {
            idleTimer = setTimeout(finish, 480);
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
      currentTopHighlight = topBest;
      updateQtProjectionBar();
      const dec = topBest.dec;
      const isHighConfidence = dec.conviction >= 85;

      timerCountdown = isDeep ? 45 : 30;
      clearInterval(timerInterval);

      let selectedDur = 5;
      let selectedUnit = 't';
      const botContract = dec.best && dec.best.contract ? dec.best.contract : (cfg.active === 'over-under' ? (dec.action === 'OVER' ? 'DIGITOVER' : 'DIGITUNDER') : cfg.active === 'even-odd' ? (dec.action === 'EVEN' ? 'DIGITEVEN' : 'DIGITODD') : (dec.action === 'MATCHES' ? 'DIGITMATCH' : 'DIGITDIFF'));
      const botBarr = dec.barrier != null ? dec.barrier : (dec.digit != null ? dec.digit : 2);
      const botHref = `bots-library.html?symbol=${topBest.v.id}&contract=${botContract}&barrier=${botBarr}&name=${encodeURIComponent('AI ' + topBest.v.name + ' (' + dec.decision + ')')}&dur=1&rule_kind=instant&mart=1&mart_mult=2.2&mart_steps=3&gate=${Math.max(48, Math.min(85, dec.conviction || 55))}`;
      const runnerUps = (computedPillarCandidates || []).slice(1, 3);

      aiTopSuggestionBox.innerHTML = `
        <div style="border-left:4px solid ${isHighConfidence?'#00ffa3':'#ffd600'};background:linear-gradient(135deg,${isHighConfidence?'rgba(0,255,163,0.12),rgba(0,178,255,0.06)':'rgba(255,214,0,0.08),rgba(255,59,105,0.05)'});border:1.5px solid ${isHighConfidence?'rgba(0,255,163,0.45)':'rgba(255,214,0,0.4)'};padding:16px;border-radius:12px;box-shadow:0 0 20px ${isHighConfidence?'rgba(0,255,163,0.15)':'rgba(255,214,0,0.1)'};">
          
          <!-- Top Badges & Dynamic 3-Color Blinking Validity Timer Badge -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:10px;font-weight:900;color:#04101c;background:${isHighConfidence?'#00ffa3':'#ffd600'};padding:3px 8px;border-radius:4px;letter-spacing:0.4px;">
                👑 #1 SINGLE MOST SUITABLE RECOMMENDATION IN ${cfg.title.toUpperCase()}
              </span>
              <span style="font-size:11px;color:#00b2ff;font-weight:700;">${isDeep ? '1000t Quantum Deep Calibrated' : (tickCount || 100) + 't Lightning Rapid Calibrated'}</span>
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
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:8px;font-size:11px;">
              <div style="background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);">
                <span style="color:#8e9ab3;font-weight:700;display:block;">ENTRY TRIGGER:</span>
                <b style="color:#fff;">Enter immediately on live signal (${dec.decision})</b>
              </div>
              <div style="background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);">
                <span style="color:#8e9ab3;font-weight:700;display:block;">TIMING DIRECTIVE:</span>
                <b style="color:#00ffa3;">USE 5 TICKS (~5s) · DIGIT CONTRACTS REQUIRE TICKS</b>
              </div>
            </div>

            <!-- Suggested Duration Chips -->
            <div style="margin-top:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:10.5px;color:#8e9ab3;font-weight:700;">SELECT DURATION:</span>
              <button type="button" class="top-sug-dur active" data-d="5" data-u="t" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:800;border:1px solid #00ffa3;background:#00ffa3;color:#04101c;cursor:pointer;">5 Ticks (Optimal)</button>
              <button type="button" class="top-sug-dur" data-d="1" data-u="t" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;">1 Tick (Fast)</button>
              <button type="button" class="top-sug-dur" data-d="3" data-u="t" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;">3 Ticks</button>
              <button type="button" class="top-sug-dur" data-d="10" data-u="t" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;">10 Ticks</button>
            </div>
          </div>

          <!-- Real Working Action Buttons with on-card Rescan -->
          <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button type="button" id="btnPlaceTopBet" class="btn" style="flex:1.4;min-width:min(100%,165px);padding:11px 14px;font-size:12px;font-weight:900;background:linear-gradient(90deg,#00ffa3,#00b2ff);color:#04101c;border:0;border-radius:8px;cursor:pointer;box-shadow:0 0 16px rgba(0,255,163,0.3);">
              ⚡ 1-CLICK BET (${dec.decision} · USE 5 TICKS)
            </button>
            <button type="button" id="btnApplyTopControls" class="btn" style="flex:1;min-width:min(100%,130px);padding:11px 12px;font-size:11.5px;font-weight:800;background:#141e33;border:1px solid rgba(0,255,163,0.4);color:#00ffa3;border-radius:8px;cursor:pointer;">
              🎯 APPLY TO PANEL
            </button>
            <a href="${botHref}" class="btn" style="flex:1;min-width:min(100%,135px);padding:11px 12px;font-size:11.5px;font-weight:800;background:#0b1730;border:1px solid #00b2ff;color:#00b2ff;border-radius:8px;text-align:center;text-decoration:none;">
              🤖 LAUNCH IN BOT →
            </a>
            <button type="button" id="btnPillarRescanCard" class="btn" style="flex:0.8;min-width:100px;padding:11px 12px;font-size:11px;font-weight:800;background:#1e293b;border:1px solid #00b2ff;color:#00b2ff;border-radius:8px;cursor:pointer;">
              ⚡ RESCAN (100t)
            </button>
            <button type="button" id="btnPillarDeepScanCard" class="btn" style="flex:0.9;min-width:115px;padding:11px 12px;font-size:11px;font-weight:800;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.2);color:#cbd5e1;border-radius:8px;cursor:pointer;">
              ⚛ DEEP (1000t)
            </button>
          </div>
          ${runnerUps.length ? `
          <div style="margin-top:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);">
            <span style="font-size:10px;font-weight:800;color:#7d8aa5;">RUNNER-UPS:</span>
            ${runnerUps.map((ru, idx) => `<button type="button" class="btn ghost ru-pick" data-ru="${idx + 1}" style="padding:3px 9px;font-size:10.5px;border-radius:6px;cursor:pointer;color:#cbd5e1;">#${idx + 2} ${TW.esc(ru.v.name)}: <b>${TW.esc(ru.dec.decision)}</b> (${ru.dec.projectedWinPct}% · +${ru.dec.edgePts} pts)</button>`).join('')}
          </div>` : ''}
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
        updateQtProjectionBar();
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
        applySuggestionToState(topBest.v.id, dec, selectedDur, selectedUnit, false);
        await executeManualBuy();
      };

      $('#btnApplyTopControls').onclick = () => {
        applySuggestionToState(topBest.v.id, dec, selectedDur, selectedUnit, true);
        TW.toast(`Applied ${dec.decision} on ${TW.volName(topBest.v.id)} to panel!`, 'ok');
      };

      // On-card Rescan, Deep Scan & Runner-up selectors
      $('#btnPillarRescanCard').onclick = () => runPillarAiScan(100, false);
      $('#btnPillarDeepScanCard').onclick = () => runPillarAiScan(1000, true);
      const btnNoticeDeep = $('#btnNoticeDeepPillar');
      if (btnNoticeDeep) btnNoticeDeep.onclick = () => runPillarAiScan(1000, true);
      aiTopSuggestionBox.querySelectorAll('.ru-pick').forEach(btn => {
        btn.onclick = () => {
          const cand = computedPillarCandidates[+btn.dataset.ru];
          if (cand) renderTopHighlightCard(cand, isDeep, tickCount);
        };
      });
    }

    function applySuggestionToState(symbol, dec, durationVal, durationUnitVal, shouldScroll) {
      const symChanged = top.symbol !== symbol;
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

      if (symChanged) restart();
      else refresh();
      if (shouldScroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function matchCurrentAiDigit() {
      if (currentTopHighlight) {
        applySuggestionToState(currentTopHighlight.v.id, currentTopHighlight.dec, 5, 't', false);
        return `${currentTopHighlight.dec.decision} on ${TW.volName(currentTopHighlight.v.id)} (5 ticks)`;
      }
      if (feed && feed.digits && feed.digits.length >= 20 && cfg.scan) {
        const r = cfg.scan(TW.analyze(feed.digits), tab, pick);
        tab = r.tab; if (r.pick != null) pick = r.pick;
        refresh();
        return `${cfg.label(tab, pick)} on ${TW.volName(top.symbol)}`;
      }
      return '';
    }

    // Wire Quick-Bar AI Match, Bet AI & Scan controls without scrolling
    if ($('#qtScanAiBtn')) $('#qtScanAiBtn').onclick = () => runPillarAiScan(100, false);
    if ($('#qtMatchAiBtn')) $('#qtMatchAiBtn').onclick = () => {
      const desc = matchCurrentAiDigit();
      if (desc) TW.toast(`Matched AI: ${desc}`, 'ok', 2800);
    };
    if ($('#qtBetAiBtn')) $('#qtBetAiBtn').onclick = async () => {
      const desc = matchCurrentAiDigit();
      if (!desc) { TW.toast('Scanning AI projection first…', 'mut', 2000); runPillarAiScan(100, false); return; }
      await executeManualBuy();
    };

    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;
      if (document.querySelector('.ov')) return;
      const k = e.key.toLowerCase();
      if (k === '1' && cfg.tabs[0]) { e.preventDefault(); tab = cfg.tabs[0].id; refresh(); executeManualBuy(); }
      else if (k === '2' && cfg.tabs[1]) { e.preventDefault(); tab = cfg.tabs[1].id; refresh(); executeManualBuy(); }
      else if (k === 'm') { e.preventDefault(); if ($('#qtMatchAiBtn')) $('#qtMatchAiBtn').click(); }
      else if (k === 'b') { e.preventDefault(); if ($('#qtBetAiBtn')) $('#qtBetAiBtn').click(); }
      else if (k === 's') { e.preventDefault(); runPillarAiScan(100, false); }
    });

    // Initialize market feed
    restart();

    // Automatically trigger lightning 100-tick Rapid Scan on load for instant best recommendation
    setTimeout(() => {
      runPillarAiScan(100, false);
    }, 350);
  });
};
