/* TickWealth Saved DBot Live Market Runner (botrunner.js)
 * Bridges Bot Studio + AI Analyzer directly into live market pages (Over/Under, Even/Odd, Matches/Differs, Rise/Fall).
 * Features Deriv DBot-style Run / Stop / Reset, Inline Editable Martingale & Strategy Parameters,
 * Live Summary KPIs, Transactions Feed, and Timestamped Execution Journal right alongside live digit circles/charts.
 */
(function () {
  'use strict';
  if (!window.TW || TW.embed) return;

  const BOTKEY = 'tw_bots_v7';
  const LEGACY_BOTKEY = 'tw_bots_v6';
  const CT = ['CALL', 'PUT', 'DIGITOVER', 'DIGITUNDER', 'DIGITEVEN', 'DIGITODD', 'DIGITMATCH', 'DIGITDIFF'];
  const CONDS = ['even', 'odd', 'over', 'under', 'rise', 'fall'];
  const FIB_SEQ = [1, 1, 2, 3, 5, 8, 13, 21];
  const num = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

  function specialistBotName(symbol, contract, barrier) {
    const isFx = /^(frx|XAU)/i.test(String(symbol || ''));
    const market = (TW.volName ? TW.volName(symbol) : String(symbol || 'R_100')).replace(/\s+Index$/i, '');
    if (isFx) {
      const dir = contract === 'PUT' ? 'Seller' : 'Buyer';
      return `Expert Forex ${dir} — ${market}`.slice(0, 56);
    }
    if (contract === 'DIGITUNDER') return `Expert Under ${barrier != null ? barrier : 7} Sniper — ${market}`.slice(0, 56);
    if (contract === 'DIGITOVER') return `Expert Over ${barrier != null ? barrier : 2} Reversion — ${market}`.slice(0, 56);
    if (contract === 'DIGITDIFF') return `Expert Differs ${barrier != null ? barrier : 0} — ${market}`.slice(0, 56);
    if (contract === 'DIGITMATCH') return `Expert Matches ${barrier != null ? barrier : 7} — ${market}`.slice(0, 56);
    if (contract === 'DIGITEVEN') return `Expert Even Parity — ${market}`.slice(0, 56);
    if (contract === 'DIGITODD') return `Expert Odd Parity — ${market}`.slice(0, 56);
    if (contract === 'PUT') return `Expert Fall Momentum — ${market}`.slice(0, 56);
    return `Expert Rise Momentum — ${market}`.slice(0, 56);
  }

  function sanitizeLegacyName(rawName, symbol, contract, barrier) {
    const s = String(rawName || '').trim();
    if (!s || /role\s*bot|^🎯.*\brole$/i.test(s) || /\brole$/i.test(s)) {
      return specialistBotName(symbol, contract, barrier);
    }
    return s.slice(0, 56);
  }

  function defaultGate(contract, barrier) {
    if (contract === 'DIGITOVER') { const b = barrier != null ? +barrier : 2; return b <= 2 ? 55 : b <= 4 ? 48 : 38; }
    if (contract === 'DIGITUNDER') { const b = barrier != null ? +barrier : 7; return b >= 7 ? 55 : b >= 5 ? 48 : 38; }
    if (contract === 'DIGITDIFF') return 80;
    if (contract === 'DIGITMATCH') return 12;
    return 50;
  }

  function cleanBot(b) {
    b = b && typeof b === 'object' ? b : {};
    const r = b.rule || {}, m = b.mart || {};
    const symObj = TW.VOLS.find(v => v.id === b.symbol);
    const sym = symObj ? symObj.id : 'R_100';
    let contract = CT.includes(b.contract) ? b.contract : 'DIGITOVER';
    if (symObj && !symObj.digits && /^DIGIT/.test(contract)) contract = 'CALL';
    const barrier = num(b.barrier, 0, 9, contract === 'DIGITOVER' ? 2 : contract === 'DIGITUNDER' ? 7 : 4);
    const isFx = /^(frx|XAU)/i.test(sym);
    let durationUnit = ['t', 's', 'm', 'h'].includes(b.durationUnit) ? b.durationUnit : (isFx ? 'm' : 't');
    if (isFx && durationUnit === 't') durationUnit = 'm';
    const maxDur = durationUnit === 't' ? 10 : 60;
    let duration = num(b.duration, 1, maxDur, durationUnit === 't' ? 1 : (isFx ? 15 : 5));
    if (/^frx(?!XAU)/i.test(sym) && durationUnit === 'm' && duration < 15) duration = 15;
    const defGate = defaultGate(contract, barrier);
    const martMode = ['smart_barrier', 'split_recovery', 'payout_martingale', 'martingale', 'dalembert', 'fibonacci', 'compounding'].includes(m.mode) ? m.mode : 'smart_barrier';
    return {
      id: b.id || ('b' + Date.now() + Math.floor(Math.random() * 1e5)),
      name: sanitizeLegacyName(b.name, sym, contract, barrier),
      symbol: sym,
      contract,
      barrier,
      duration,
      durationUnit,
      stake: num(b.stake, 0.35, 1000, 0.5),
      rule: {
        kind: ['streak', 'ai_alpha', 'every', 'instant'].includes(r.kind) ? r.kind : 'streak',
        cond: CONDS.includes(r.cond) ? r.cond : (contract === 'DIGITUNDER' ? 'over' : 'under'),
        n: num(r.n, 1, 50, 1),
        cb: num(r.cb, 0, 9, contract === 'DIGITOVER' ? 2 : contract === 'DIGITUNDER' ? 7 : 4)
      },
      mart: { on: m.on !== false, mode: martMode, mult: num(m.mult, 1.0, 5, 1.05), steps: num(m.steps, 1, 8, 4) },
      sl: num(b.sl, 0, 100000, 10),
      tp: num(b.tp, 0, 100000, 20),
      max: num(b.max, 0, 10000, 0),
      coolSecs: num(b.coolSecs, 0, 60, 4),
      notes: String(b.notes || '').replace(/^Role:\s*/i, '').slice(0, 280),
      aiMode: ['active', 'strict', 'turbo'].includes(b.aiMode) ? b.aiMode : 'active',
      speedMode: ['hft', 'balanced', 'guarded'].includes(b.speedMode) ? b.speedMode : 'hft',
      aiGate: (((!b.aiMode || b.aiMode === 'active') && defGate <= 60 && +b.aiGate >= 82) ? defGate : num(b.aiGate, 10, 95, defGate)),
      lossShield: b.lossShield !== false
    };
  }

  const DEFAULT_PRESETS = [
    { id: 'preset_u7_30s', name: 'Expert Under 7 Sniper · Smart Recovery', symbol: '1HZ30V', contract: 'DIGITUNDER', barrier: 7, duration: 1, durationUnit: 't', rule: { kind: 'streak', cond: 'over', cb: 6, n: 1 }, aiGate: 58, aiMode: 'active', lossShield: true, coolSecs: 4, stake: 0.50, mart: { on: true, mode: 'smart_barrier', mult: 1.05, steps: 4 }, sl: 10, tp: 20, notes: 'Best in Under 7: enters after a 7/8/9 pullback + AI check. On loss, shifts recovery to Under 5 / Over 4 (+90% ROI) at exact break-even stake.' },
    { id: 'preset_o2_25s', name: 'Expert Over 2 Reversion · Split Recovery', symbol: '1HZ25V', contract: 'DIGITOVER', barrier: 2, duration: 1, durationUnit: 't', rule: { kind: 'streak', cond: 'under', cb: 3, n: 1 }, aiGate: 58, aiMode: 'active', lossShield: true, coolSecs: 4, stake: 0.50, mart: { on: true, mode: 'split_recovery', mult: 1.0, steps: 5 }, sl: 10, tp: 20, notes: 'Best in Over 2: enters after low-digit flush (0/1/2). Splits recovery across 2 high-ROI (+90%) barrier shots so stake never explodes.' },
    { id: 'preset_md_cold', name: 'Expert Coldest Differs · High-ROI Switch', symbol: '1HZ10V', contract: 'DIGITDIFF', barrier: 0, duration: 1, durationUnit: 't', rule: { kind: 'ai_alpha' }, aiGate: 80, aiMode: 'active', lossShield: true, coolSecs: 5, stake: 1.00, mart: { on: true, mode: 'smart_barrier', mult: 1.05, steps: 4 }, sl: 10, tp: 20, notes: 'Best in Matches/Differs: targets coldest digit over 100 ticks (~90% odds). On rare loss, switches recovery to Under 5 / Over 4 (+90% ROI).' },
    { id: 'preset_ai_ou', name: 'Expert Over/Under Switcher · Payout Recovery', symbol: 'R_100', contract: 'DIGITOVER', barrier: 2, duration: 1, durationUnit: 't', rule: { kind: 'ai_alpha', cond: 'under', cb: 3, n: 1 }, aiGate: 58, aiMode: 'active', lossShield: true, coolSecs: 4, stake: 0.50, mart: { on: true, mode: 'payout_martingale', mult: 1.08, steps: 4 }, sl: 15, tp: 25, notes: 'Dynamic Over/Under specialist: switches between Over 2/3 & Under 6/7 using Markov skew; sizes recovery strictly to exact contract ROI.' },
    { id: 'preset_eo_alt', name: 'Expert Even/Odd Parity · Step-Lock Recovery', symbol: 'R_50', contract: 'DIGITEVEN', barrier: 0, duration: 1, durationUnit: 't', rule: { kind: 'streak', cond: 'odd', cb: 0, n: 2 }, aiGate: 50, aiMode: 'active', lossShield: true, coolSecs: 5, stake: 0.50, mart: { on: true, mode: 'payout_martingale', mult: 1.05, steps: 4 }, sl: 10, tp: 15, notes: 'Best in Even/Odd: enters counter-parity after 2+ streak with runs-test filter & calibrated recovery + 5s cooldown after 2L.' },
    { id: 'preset_rf_ema', name: 'Expert Rise/Fall Momentum · Cooldown Split', symbol: 'R_75', contract: 'CALL', barrier: 0, duration: 5, durationUnit: 't', rule: { kind: 'ai_alpha', cond: 'rise', n: 1 }, aiGate: 52, aiMode: 'active', lossShield: true, coolSecs: 6, stake: 0.50, mart: { on: true, mode: 'split_recovery', mult: 1.05, steps: 4 }, sl: 10, tp: 20, notes: 'Best in Rise/Fall: trades CALL/PUT on EMA5 vs EMA15 trend alignment; splits drawdown over 2 wins with 6s chop-cooldown.' },
    { id: 'preset_fx_eur', name: 'Expert Forex Trend Buyer/Seller (EUR/USD)', symbol: 'frxEURUSD', contract: 'CALL', barrier: 0, duration: 15, durationUnit: 'm', rule: { kind: 'ai_alpha', cond: 'rise', n: 1 }, aiGate: 52, aiMode: 'active', lossShield: true, coolSecs: 8, stake: 1.00, mart: { on: true, mode: 'split_recovery', mult: 1.05, steps: 3 }, sl: 15, tp: 30, notes: 'Best in Forex Buy/Sell: dynamically selects BUY (CALL) or SELL (PUT) on EUR/USD using EMA9/21 trend & RSI(14) with 15m expiry.' }
  ];

  function loadBots() {
    try {
      const a = JSON.parse(localStorage.getItem(BOTKEY));
      if (Array.isArray(a) && a.length) return a.map(x => cleanBot(x));
      for (const oldKey of [LEGACY_BOTKEY, 'tw_bots_v5']) {
        const legacy = JSON.parse(localStorage.getItem(oldKey));
        if (Array.isArray(legacy) && legacy.length) {
          const presetMap = new Map(DEFAULT_PRESETS.map(p => [p.id, cleanBot(p)]));
          const customs = legacy
            .filter(x => x && !presetMap.has(x.id) && !/^preset_/.test(x.id || ''))
            .map(x => cleanBot(x));
          const migrated = [...DEFAULT_PRESETS.map(cleanBot), ...customs];
          saveBots(migrated);
          return migrated;
        }
      }
    } catch (e) {}
    return DEFAULT_PRESETS.map(cleanBot);
  }

  function saveBots(list) {
    try { localStorage.setItem(BOTKEY, JSON.stringify(list)); } catch (e) {}
  }

  function upsertBot(rawBot) {
    const nb = cleanBot(rawBot);
    const list = loadBots();
    const idx = list.findIndex(x => x.id === nb.id);
    if (idx >= 0) list[idx] = nb;
    else list.unshift(nb);
    saveBots(list);
    return nb;
  }

  function marketUrlForBot(b) {
    const c = b.contract || '';
    const enc = encodeURIComponent;
    const isFx = /^(frx|XAU)/i.test(String(b.symbol || ''));
    const unit = b.durationUnit || (isFx ? 'm' : 't');
    if (isFx) {
      return `forex.html?vol=${enc(b.symbol)}&type=${c === 'PUT' ? 'PUT' : 'CALL'}&dur=${b.duration || 15}&unit=${enc(unit)}&bot=${enc(b.id)}`;
    }
    if (/OVER|UNDER/.test(c)) {
      const tp = c === 'DIGITOVER' ? 'OVER' : 'UNDER';
      return `over-under.html?vol=${enc(b.symbol)}&type=${tp}&barrier=${b.barrier != null ? b.barrier : 2}&dur=${b.duration || 1}&bot=${enc(b.id)}`;
    }
    if (/EVEN|ODD/.test(c)) {
      const tp = c === 'DIGITEVEN' ? 'EVEN' : 'ODD';
      return `even-odd.html?vol=${enc(b.symbol)}&type=${tp}&dur=${b.duration || 1}&bot=${enc(b.id)}`;
    }
    if (/MATCH|DIFF/.test(c)) {
      const tp = c === 'DIGITMATCH' ? 'MATCHES' : 'DIFFERS';
      return `matches-differs.html?vol=${enc(b.symbol)}&type=${tp}&digit=${b.barrier != null ? b.barrier : 0}&dur=${b.duration || 1}&bot=${enc(b.id)}`;
    }
    return `rise-fall.html?vol=${enc(b.symbol)}&type=${c === 'PUT' ? 'PUT' : 'CALL'}&dur=${b.duration || 5}&unit=${enc(unit)}&bot=${enc(b.id)}`;
  }

  function contractRoi(c, bar) {
    const pay = TW.estimatePayout ? TW.estimatePayout(c, bar, 1) : 1.95;
    return Math.max(0.08, +(pay - 1).toFixed(4));
  }

  function pickSmartRecoveryBarrier(b, candContract, candBarrier, digits) {
    const roi = contractRoi(candContract, candBarrier);
    if (roi >= 0.72 || !/^DIGIT/.test(candContract)) {
      return { contract: candContract, barrier: candBarrier, switched: false };
    }
    const rec = Array.isArray(digits) && digits.length >= 12 ? digits.slice(-30) : [];
    const u5 = rec.length ? rec.filter(d => d < 5).length / rec.length : 0.5;
    const o4 = rec.length ? rec.filter(d => d > 4).length / rec.length : 0.5;
    if (u5 >= o4) return { contract: 'DIGITUNDER', barrier: 5, switched: true };
    return { contract: 'DIGITOVER', barrier: 4, switched: true };
  }

  function planExecution(b, r, candContract, candBarrier, digits) {
    const maxStk = (TW.settings && TW.settings.maxStake) ? +TW.settings.maxStake : 10;
    const base = Number(b.stake || 0.5);
    const pool = Math.max(0, Number((r && r.recoveryPool) || 0));
    const step = Math.max(0, (r && r.step) || 0);
    const mode = (b.mart && b.mart.mode) || 'smart_barrier';

    if (!b.mart || !b.mart.on || (mode !== 'compounding' && (pool <= 0.01 || step === 0))) {
      return { contract: candContract, barrier: candBarrier, stake: Math.min(maxStk, +base.toFixed(2)), isRecovery: false, switched: false };
    }
    if (mode === 'compounding') {
      const compStake = base * Math.pow(Math.max(1.2, b.mart.mult || 1.8), step);
      return { contract: candContract, barrier: candBarrier, stake: Math.min(maxStk, +compStake.toFixed(2)), isRecovery: false, switched: false };
    }

    const multVal = Number(b.mart.mult || 1.05);
    let recC = candContract, recB = candBarrier, switched = false;
    let raw = base;

    if (mode === 'smart_barrier') {
      const picked = pickSmartRecoveryBarrier(b, candContract, candBarrier, digits);
      recC = picked.contract; recB = picked.barrier; switched = picked.switched;
      const roi = contractRoi(recC, recB);
      const scale = multVal > 1.45 ? 1.06 : Math.max(1.0, multVal);
      const splitFactor = step >= 3 ? 0.55 : 1.0;
      const targetProfit = (pool * splitFactor * scale) + Math.min(0.15, base * 0.25);
      raw = targetProfit / roi;
    } else if (mode === 'split_recovery') {
      const picked = pickSmartRecoveryBarrier(b, candContract, candBarrier, digits);
      recC = picked.contract; recB = picked.barrier; switched = picked.switched;
      const roi = contractRoi(recC, recB);
      const scale = multVal > 1.45 ? 1.04 : Math.max(1.0, multVal);
      const targetProfit = ((pool / 2) + Math.min(0.12, base * 0.20)) * scale;
      raw = targetProfit / roi;
    } else if (mode === 'payout_martingale') {
      const roi = contractRoi(recC, recB);
      const scale = multVal > 1.45 ? 1.08 : Math.max(1.0, multVal);
      raw = ((pool + base * 0.20) * scale) / roi;
    } else if (mode === 'dalembert') {
      raw = base * (1 + step * Math.max(0.25, multVal - 1));
    } else if (mode === 'fibonacci') {
      raw = base * FIB_SEQ[Math.min(FIB_SEQ.length - 1, step)];
    } else {
      raw = base * Math.pow(Math.max(1.1, multVal), step);
    }

    return {
      contract: recC,
      barrier: recB,
      stake: Math.min(maxStk, Math.max(0.35, +raw.toFixed(2))),
      isRecovery: true,
      switched
    };
  }

  function calcNextStake(b, r, digits) {
    return planExecution(b, r, b.contract, b.barrier, digits).stake;
  }

  function condMatch(c, cb, P, D, j) {
    if (j <= 0) return false;
    return c === 'rise' ? P[j] > P[j - 1]
      : c === 'fall' ? P[j] < P[j - 1]
      : c === 'over' ? D[j] > cb
      : c === 'under' ? D[j] < cb
      : c === 'even' ? D[j] % 2 === 0
      : D[j] % 2 === 1;
  }

  function contractMatchesPillar(contract, pillar, symbol) {
    if (pillar === 'forex') return (contract === 'CALL' || contract === 'PUT') && /^(frx|XAU)/i.test(String(symbol || ''));
    if (pillar === 'over-under') return /DIGIT(OVER|UNDER)/.test(contract);
    if (pillar === 'even-odd') return /DIGIT(EVEN|ODD)/.test(contract);
    if (pillar === 'matches-differs') return /DIGIT(MATCH|DIFF)/.test(contract);
    if (pillar === 'rise-fall') return contract === 'CALL' || contract === 'PUT';
    return true;
  }

  function nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }
  function nowStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${nowTime()}`;
  }
  function journalGroup(cls) {
    if (cls === 'win' || cls === 'success') return 'success';
    if (cls === 'loss' || cls === 'error') return 'error';
    return 'notify';
  }

  TW.botStore = { load: loadBots, save: saveBots, upsert: upsertBot, clean: cleanBot, marketUrl: marketUrlForBot, specialistName: specialistBotName, defaults: DEFAULT_PRESETS };

  TW.mountBotRunner = function (opt) {
    opt = opt || {};
    const anchor = typeof opt.anchor === 'string' ? document.querySelector(opt.anchor) : opt.anchor;
    if (!anchor) return null;

    const pillar = opt.pillar || 'over-under';
    const dock = document.createElement('div');
    dock.id = 'twBotRunnerDock';
    dock.className = 'bot-runner-dock';
    dock.innerHTML = `
      <div class="br-head">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="dot" id="brRunDot" style="width:8px;height:8px;background:#7d8aa5;"></span>
          <span class="br-title">Deriv DBot Runner</span>
          <span id="brStateBadge" class="br-badge">IDLE · READY FOR ENTRY</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <a href="bots-library.html" class="br-link" title="Open Full Deriv DBot Studio &amp; Configurator">Open DBot Studio →</a>
        </div>
      </div>

      <div class="br-row">
        <select id="brBotSel" class="br-sel" aria-label="Select saved bot"></select>
        <div class="br-btns">
          <button type="button" id="brRunBtn" class="br-btn run">▶ Run</button>
          <button type="button" id="brResetBtn" class="br-btn reset" title="Stop (if running) & reset bot stats, Transactions & Journal">↺ Reset</button>
          <button type="button" id="brOneShotBtn" class="br-btn shot" title="Execute 1 immediate contract with this bot's stake & settings">⚡ 1-Shot</button>
          <button type="button" id="brEditBtn" class="br-btn ghost" title="Edit bot Volatility, Digit, Stake & Martingale inline">⚙️ Edit Bot</button>
          <button type="button" id="brSyncBtn" class="br-btn ghost" title="Apply current screen Market/Barrier/Stake into selected bot">🎯 Sync View</button>
          <button type="button" id="brSaveNewBtn" class="br-btn ghost" title="Save current screen setup as a new named bot">💾 Save New</button>
        </div>
      </div>

      <div id="brSpecLine" class="br-spec">Select a bot to inspect Trade Parameters, Rule, Editable Martingale &amp; Risk Limits.</div>

      <!-- INLINE EDITABLE BOT & MARTINGALE CONFIGURATOR -->
      <div id="brInlineEdit" class="br-edit-grid" style="display:none;"></div>

      <div id="brLiveTelemetry" class="br-telem" style="display:none;"></div>

      <!-- DERIV DBOT SUMMARY / TRANSACTIONS / JOURNAL DRAWER -->
      <div id="brRunDrawer" class="br-drawer">
        <div class="br-drawer-bar">
          <div class="br-tabs" role="tablist">
            <button type="button" class="br-tab active" data-brtab="summary">Summary</button>
            <button type="button" class="br-tab" data-brtab="tx">Transactions (<span id="brTxCnt">0</span>)</button>
            <button type="button" class="br-tab" data-brtab="journal">Journal (<span id="brJnlCnt">0</span>)</button>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="brMiniPnl" style="font-size:11px;font-weight:900;color:#9fb0cc;">Net: +$0.00</span>
            <button type="button" id="brToggleDrawerBtn" class="br-btn ghost" style="padding:3px 8px;font-size:10px;">▸ Show</button>
          </div>
        </div>
        <div id="brDrawerPane" class="br-pane"></div>
        <div id="brDrawerFooter" class="br-rp-footer" aria-label="Deriv Session Summary">
          <div><span>Total stake</span><b id="brFtStake">$0.00</b></div>
          <div><span>Total payout</span><b id="brFtPayout">$0.00</b></div>
          <div><span>No. of runs</span><b id="brFtRuns">0</b></div>
          <div><span>Contracts lost</span><b id="brFtLost" style="color:#ff444f;">0</b></div>
          <div><span>Contracts won</span><b id="brFtWon" style="color:#00ffa3;">0</b></div>
          <div><span>Profit/Loss</span><b id="brFtPnl" style="color:#00ffa3;">+$0.00</b></div>
        </div>
      </div>
    `;
    anchor.insertAdjacentElement('afterend', dock);

    const $ = id => dock.querySelector('#' + id);
    const sel = $('brBotSel');
    const runBtn = $('brRunBtn');
    const resetBtn = $('brResetBtn');
    const shotBtn = $('brOneShotBtn');
    const editBtn = $('brEditBtn');
    const syncBtn = $('brSyncBtn');
    const saveNewBtn = $('brSaveNewBtn');
    const specEl = $('brSpecLine');
    const editGrid = $('brInlineEdit');
    const telemEl = $('brLiveTelemetry');
    const dotEl = $('brRunDot');
    const badgeEl = $('brStateBadge');
    const drawerPane = $('brDrawerPane');
    const toggleDrawerBtn = $('brToggleDrawerBtn');

    let bots = loadBots();
    let activeId = null;
    let editOpen = false;
    let drawerCollapsed = true;
    let activeTab = 'summary';
    let _feedCheck = null;
    const jFilters = { err: true, not: true, suc: true };

    const runtime = {
      on: false, busy: false, bot: null, feed: null,
      n: 0, w: 0, pnl: 0, recoveryPool: 0, totalStake: 0, totalPayout: 0, step: 0, k: 0,
      consecutiveLosses: 0, vetos: 0, coolUntil: 0, lastEntrySig: '',
      lastMsg: '', convPct: null, history: [], transactions: [], journal: [], _coolTm: null
    };

    function addJournal(msg, cls) {
      runtime.journal.unshift({ time: nowStamp(), msg: String(msg), cls: cls || 'info', grp: journalGroup(cls) });
      if (runtime.journal.length > 100) runtime.journal.pop();
      const jCnt = $('brJnlCnt');
      if (jCnt) jCnt.textContent = runtime.journal.length;
    }

    const q = TW.qs();
    function chooseInitialBot() {
      if (q.bot && bots.some(b => b.id === q.bot)) return q.bot;
      const curSym = opt.getSymbol ? opt.getSymbol() : '';
      const exact = bots.find(b => contractMatchesPillar(b.contract, pillar, b.symbol) && b.symbol === curSym);
      if (exact) return exact.id;
      const samePillar = bots.find(b => contractMatchesPillar(b.contract, pillar, b.symbol));
      return (samePillar || bots[0] || {}).id || '';
    }

    function allAvailableBots() {
      const missing = DEFAULT_PRESETS.filter(p => !bots.some(b => b.id === p.id || b.name === p.name)).map(cleanBot);
      return { saved: bots, presets: missing, all: bots.concat(missing) };
    }

    function currentBot() {
      const { all } = allAvailableBots();
      return all.find(b => b.id === activeId) || all[0] || null;
    }

    function renderSelect(keepId) {
      bots = loadBots();
      const { saved, presets, all } = allAvailableBots();
      const target = keepId || activeId || chooseInitialBot();
      const matching = saved.filter(b => contractMatchesPillar(b.contract, pillar, b.symbol));
      const others = saved.filter(b => !contractMatchesPillar(b.contract, pillar, b.symbol));
      const optRow = b => `<option value="${TW.esc(b.id)}">${TW.esc(b.name)} (${b.symbol} · ${b.contract}${/OVER|UNDER|MATCH|DIFF/.test(b.contract) ? ' ' + b.barrier : ''} · $${b.stake})</option>`;
      let html = '';
      if (matching.length) {
        html += `<optgroup label="Matched for ${pillar.toUpperCase()}">${matching.map(optRow).join('')}</optgroup>`;
      }
      if (others.length) {
        html += `<optgroup label="Other Saved Bots">${others.map(optRow).join('')}</optgroup>`;
      }
      if (presets.length) {
        html += `<optgroup label="Expert Strategy Bots">${presets.map(optRow).join('')}</optgroup>`;
      }
      if (!html) html = '<option value="">No bots saved yet — click 💾 Save New</option>';
      sel.innerHTML = html;
      if (target && all.some(b => b.id === target)) sel.value = target;
      else if (all[0]) sel.value = all[0].id;
      activeId = sel.value;
      renderSpec();
      if (editOpen) renderInlineEditor();
    }

    function renderSpec() {
      const b = currentBot();
      if (!b) {
        specEl.textContent = 'No bot saved yet. Configure controls above or click 💾 Save New.';
        runBtn.disabled = true;
        shotBtn.disabled = true;
        return;
      }
      runBtn.disabled = false;
      shotBtn.disabled = false;
      const bar = /OVER|UNDER|MATCH|DIFF/.test(b.contract) ? ` ${b.barrier}` : '';
      const ruleTxt = b.rule.kind === 'instant' ? '⚡ Instant'
        : b.rule.kind === 'ai_alpha' ? '🧠 AI Alpha Switch'
        : b.rule.kind === 'every' ? `Every ${b.rule.n}t`
        : `Streak ${b.rule.n}× (${b.rule.cond}${/over|under/.test(b.rule.cond) ? ' ' + b.rule.cb : ''})`;
      const martNames = {
        smart_barrier: 'Smart Barrier Recovery (+90% Switch)',
        split_recovery: 'Split-2 Zero-Blowup Recovery',
        payout_martingale: 'Payout-Calibrated Recovery',
        dalembert: "D'Alembert",
        fibonacci: 'Fibonacci',
        compounding: 'Compound Wins',
        martingale: 'Classic Mult'
      };
      const martTxt = b.mart && b.mart.on
        ? `${martNames[b.mart.mode] || b.mart.mode} (${b.mart.mult}× · ${b.mart.steps}s)`
        : 'Recovery OFF (Flat)';
      const curScreenSym = opt.getSymbol ? opt.getSymbol() : b.symbol;
      const symDiff = curScreenSym && curScreenSym !== b.symbol
        ? ` <span style="color:#ffd600;font-weight:800;">(Viewing ${curScreenSym} · Bot runs on ${b.symbol})</span>`
        : '';

      specEl.innerHTML = `
        <span class="br-seg"><strong style="color:#00ffa3;">1. Trade:</strong> ${TW.esc(b.symbol)} · ${TW.esc(b.contract + bar)} · ${b.duration}${b.durationUnit || 't'} · $${Number(b.stake).toFixed(2)}</span>
        <span class="br-sep">·</span>
        <span class="br-seg"><strong style="color:#38bdf8;">2. Entry:</strong> ${TW.esc(ruleTxt)} · Gate ${b.aiGate}% (${TW.esc(b.aiMode)})</span>
        <span class="br-sep">·</span>
        <span class="br-seg"><strong style="color:#ffd600;">3. Recovery:</strong> ${TW.esc(martTxt)}${b.lossShield ? ' · Shield ON' : ''}</span>
        <span class="br-sep">·</span>
        <span class="br-seg"><strong style="color:#fda4af;">4. Limits:</strong> SL $${b.sl || '∞'} · TP $${b.tp || '∞'}</span>${symDiff}
      `;
    }

    function renderInlineEditor() {
      const b = currentBot();
      if (!b || !editOpen) {
        editGrid.style.display = 'none';
        return;
      }
      const mkts = TW.VOLS.filter(v => v.digits || v.rf || v.fx);
      const hasDigit = /OVER|UNDER|MATCH|DIFF/.test(b.contract);
      const uVal = b.durationUnit || (/^(frx|XAU)/i.test(b.symbol) ? 'm' : 't');
      editGrid.style.display = 'grid';
      editGrid.innerHTML = `
        <label>Volatility / Market
          <select id="edSym">${mkts.map(v => `<option value="${TW.esc(v.id)}"${v.id === b.symbol ? ' selected' : ''}>${TW.esc(v.name)} (${v.id})</option>`).join('')}</select>
        </label>
        <label>Contract Type
          <select id="edCt">${CT.map(c => `<option value="${c}"${c === b.contract ? ' selected' : ''}>${c}</option>`).join('')}</select>
        </label>
        <label style="${hasDigit ? '' : 'opacity:0.45;'}">Digit / Barrier
          <input id="edBar" type="number" min="${b.contract === 'DIGITUNDER' ? 1 : 0}" max="${b.contract === 'DIGITOVER' ? 8 : 9}" value="${b.barrier}" ${hasDigit ? '' : 'disabled'}>
        </label>
        <label>Stake ($)
          <input id="edStk" type="number" min="0.35" step="0.05" value="${Number(b.stake).toFixed(2)}">
        </label>
        <label>Duration
          <input id="edDur" type="number" min="1" max="${uVal === 't' ? 10 : 60}" value="${b.duration}">
        </label>
        <label>Unit
          <select id="edUnit">
            <option value="t"${uVal === 't' ? ' selected' : ''}>Ticks</option>
            <option value="s"${uVal === 's' ? ' selected' : ''}>Sec</option>
            <option value="m"${uVal === 'm' ? ' selected' : ''}>Min</option>
            <option value="h"${uVal === 'h' ? ' selected' : ''}>Hr</option>
          </select>
        </label>
        <label>Execution Rule
          <select id="edRule">
            <option value="instant"${b.rule.kind === 'instant' ? ' selected' : ''}>⚡ Instant Loop</option>
            <option value="streak"${b.rule.kind === 'streak' ? ' selected' : ''}>🎯 Streak Trigger</option>
            <option value="every"${b.rule.kind === 'every' ? ' selected' : ''}>⏱ Every N Ticks</option>
            <option value="ai_alpha"${b.rule.kind === 'ai_alpha' ? ' selected' : ''}>🧠 AI Adaptive</option>
          </select>
        </label>
        <label>Execution Speed
          <select id="edSpeed">
            <option value="hft"${(b.speedMode || 'hft') === 'hft' ? ' selected' : ''}>⚡ HFT Zero-Gap Re-Arm</option>
            <option value="balanced"${b.speedMode === 'balanced' ? ' selected' : ''}>🎯 Precision 1-Trip</option>
            <option value="guarded"${b.speedMode === 'guarded' ? ' selected' : ''}>🛡️ Guarded Pace</option>
          </select>
        </label>
        <label>AI Entry Gate
          <select id="edAiMode">
            <option value="active"${(b.aiMode || 'active') === 'active' ? ' selected' : ''}>Smart AI Filtered</option>
            <option value="strict"${b.aiMode === 'strict' ? ' selected' : ''}>Strict Guard</option>
            <option value="turbo"${b.aiMode === 'turbo' ? ' selected' : ''}>Turbo Ungated</option>
          </select>
        </label>
        <label class="br-edit-check"><input id="edMartOn" type="checkbox"${b.mart && b.mart.on ? ' checked' : ''}> Advanced Recovery ON</label>
        <label>Recovery Engine
          <select id="edMartMode">
            <option value="smart_barrier"${(b.mart && b.mart.mode) === 'smart_barrier' ? ' selected' : ''}>Smart Barrier Switch (+90% ROI)</option>
            <option value="split_recovery"${(b.mart && b.mart.mode) === 'split_recovery' ? ' selected' : ''}>Split-2 Zero-Blowup Recovery</option>
            <option value="payout_martingale"${(b.mart && b.mart.mode) === 'payout_martingale' ? ' selected' : ''}>Payout-Calibrated Break-Even</option>
            <option value="martingale"${(b.mart && b.mart.mode) === 'martingale' ? ' selected' : ''}>Classic Multiplier</option>
            <option value="dalembert"${(b.mart && b.mart.mode) === 'dalembert' ? ' selected' : ''}>D'Alembert (Linear)</option>
            <option value="fibonacci"${(b.mart && b.mart.mode) === 'fibonacci' ? ' selected' : ''}>Fibonacci</option>
            <option value="compounding"${(b.mart && b.mart.mode) === 'compounding' ? ' selected' : ''}>Compounding Wins</option>
          </select>
        </label>
        <label>Scale / Mult
          <input id="edMartMult" type="number" step="0.05" min="1.0" max="5" value="${b.mart ? b.mart.mult : 1.05}">
        </label>
        <label>Max Recovery Steps
          <input id="edMartSteps" type="number" min="1" max="8" value="${b.mart ? b.mart.steps : 4}">
        </label>
        <label>Stop-Loss ($)
          <input id="edSl" type="number" min="0" step="1" value="${b.sl}">
        </label>
        <label>Take-Profit ($)
          <input id="edTp" type="number" min="0" step="1" value="${b.tp}">
        </label>
      `;

      const commitEdit = () => {
        const cur = currentBot();
        if (!cur) return;
        const nextSym = editGrid.querySelector('#edSym').value;
        const isNextFx = /^(frx|XAU)/i.test(nextSym);
        let nextCt = editGrid.querySelector('#edCt').value;
        let nextUnit = editGrid.querySelector('#edUnit').value;
        let nextDur = +editGrid.querySelector('#edDur').value;
        if (isNextFx) {
          if (!/^(CALL|PUT)$/.test(nextCt)) nextCt = 'CALL';
          if (nextUnit === 't') { nextUnit = 'm'; nextDur = Math.max(/^frx(?!XAU)/i.test(nextSym) ? 15 : 5, nextDur || 15); }
          else if (/^frx(?!XAU)/i.test(nextSym) && nextUnit === 'm' && nextDur < 15) { nextDur = 15; }
        }
        const updated = upsertBot(Object.assign({}, cur, {
          symbol: nextSym,
          contract: nextCt,
          barrier: +editGrid.querySelector('#edBar').value,
          stake: +editGrid.querySelector('#edStk').value,
          duration: nextDur,
          durationUnit: nextUnit,
          rule: Object.assign({}, cur.rule, { kind: editGrid.querySelector('#edRule').value }),
          speedMode: editGrid.querySelector('#edSpeed').value,
          aiMode: editGrid.querySelector('#edAiMode').value,
          mart: {
            on: !!editGrid.querySelector('#edMartOn').checked,
            mode: editGrid.querySelector('#edMartMode').value,
            mult: +editGrid.querySelector('#edMartMult').value,
            steps: +editGrid.querySelector('#edMartSteps').value
          },
          sl: +editGrid.querySelector('#edSl').value,
          tp: +editGrid.querySelector('#edTp').value
        }));
        renderSelect(updated.id);
        renderInlineEditor();
        if (opt.onSelectBot && !runtime.on) opt.onSelectBot(updated, true);
        addJournal(`Updated "${updated.name}": ${updated.symbol} ${updated.contract}${/OVER|UNDER|MATCH|DIFF/.test(updated.contract) ? ' ' + updated.barrier : ''} · $${updated.stake} · ${updated.speedMode.toUpperCase()} · Recovery ${updated.mart.on ? updated.mart.mode + ' ' + updated.mart.mult + '× (' + updated.mart.steps + 's)' : 'OFF'}`, 'info');
        renderDrawer();
      };

      editGrid.querySelectorAll('input,select').forEach(el => {
        el.addEventListener('change', commitEdit);
      });
    }

    function updateDrawerFooter() {
      const lost = Math.max(0, runtime.n - runtime.w);
      const pnlCol = runtime.pnl >= 0 ? '#00ffa3' : '#ff444f';
      const pnlStr = `${runtime.pnl >= 0 ? '+' : '-'}$${Math.abs(runtime.pnl).toFixed(2)}`;
      const setF = (id, v, c) => { const e = $(id); if (e) { e.textContent = v; if (c) e.style.color = c; } };
      setF('brFtStake', '$' + runtime.totalStake.toFixed(2));
      setF('brFtPayout', '$' + runtime.totalPayout.toFixed(2));
      setF('brFtRuns', String(runtime.n));
      setF('brFtLost', String(lost));
      setF('brFtWon', String(runtime.w));
      setF('brFtPnl', pnlStr, pnlCol);
    }

    function renderDrawer() {
      const txCnt = $('brTxCnt');
      const jCnt = $('brJnlCnt');
      const miniPnl = $('brMiniPnl');
      if (txCnt) txCnt.textContent = runtime.transactions.length;
      if (jCnt) jCnt.textContent = runtime.journal.length;
      if (miniPnl) {
        const pCol = runtime.pnl >= 0 ? '#00ffa3' : '#ff444f';
        miniPnl.textContent = `Net: ${runtime.pnl >= 0 ? '+' : '-'}$${Math.abs(runtime.pnl).toFixed(2)}`;
        miniPnl.style.color = pCol;
      }
      updateDrawerFooter();

      dock.querySelectorAll('[data-brtab]').forEach(t => t.classList.toggle('active', t.dataset.brtab === activeTab));
      drawerPane.style.display = drawerCollapsed ? 'none' : 'block';
      const ft = $('brDrawerFooter');
      if (ft) ft.style.display = drawerCollapsed ? 'none' : 'grid';
      toggleDrawerBtn.textContent = drawerCollapsed ? '▸ Show' : '▾ Hide';
      if (drawerCollapsed) return;

      const losses = Math.max(0, runtime.n - runtime.w);
      const pnlCol = runtime.pnl >= 0 ? '#00ffa3' : '#ff444f';

      if (activeTab === 'summary') {
        const b = runtime.bot || currentBot();
        const plan = b ? planExecution(b, runtime, b.contract, b.barrier, (TW.tickPool[b.symbol] || {}).digits) : { stake: 0, contract: '', barrier: '', isRecovery: false };
        const poolTxt = runtime.recoveryPool > 0.01
          ? `Recovery Pool: $${runtime.recoveryPool.toFixed(2)} → ${plan.contract}${/OVER|UNDER|MATCH|DIFF/.test(plan.contract) ? ' ' + plan.barrier : ''} @ $${plan.stake.toFixed(2)}`
          : `Primary Strategy Armed (${(b && b.speedMode === 'hft') ? '⚡ HFT Zero-Gap' : 'Precision 1-Trip'})`;
        drawerPane.innerHTML = `
          <div class="br-sum-grid">
            <div class="br-sum-cell"><span>Total Stake</span><b>$${runtime.totalStake.toFixed(2)}</b></div>
            <div class="br-sum-cell"><span>Total Payout</span><b>$${runtime.totalPayout.toFixed(2)}</b></div>
            <div class="br-sum-cell"><span>No. of Runs</span><b>${runtime.n}</b></div>
            <div class="br-sum-cell"><span>Won / Lost</span><b><span style="color:#00ffa3;">${runtime.w}</span> / <span style="color:#ff444f;">${losses}</span></b></div>
            <div class="br-sum-cell"><span>Next Stake</span><b style="color:#fbbf24;">$${plan.stake.toFixed(2)}</b></div>
            <div class="br-sum-cell"><span>Profit / Loss</span><b style="color:${pnlCol};">${runtime.pnl >= 0 ? '+' : '-'}$${Math.abs(runtime.pnl).toFixed(2)}</b></div>
          </div>
          <div style="margin-top:7px;font-size:10.5px;color:${runtime.recoveryPool > 0.01 ? '#fbbf24' : '#7d8aa5'};font-weight:${runtime.recoveryPool > 0.01 ? '800' : '500'};">${TW.esc(poolTxt)}</div>
        `;
      } else if (activeTab === 'tx') {
        const barHtml = `
          <div class="br-jbar" style="margin:-9px -10px 8px;border-radius:0;">
            <span style="font-weight:700;color:#94a3b8;">Executed Contracts (${runtime.transactions.length})</span>
            <div style="display:flex;gap:6px;align-items:center;">
              <button type="button" id="brTxCsvBtn" class="br-btn ghost" style="padding:3px 8px;font-size:10px;">📥 CSV</button>
              <button type="button" id="brTxClearBtn" class="br-btn reset" style="padding:3px 8px;font-size:10px;">Clear</button>
            </div>
          </div>`;
        if (!runtime.transactions.length) {
          drawerPane.innerHTML = barHtml + `<div style="padding:12px;text-align:center;color:#7d8aa5;">No transactions yet. Click <b>▶ Run</b> or <b>⚡ 1-Shot</b> to stream live executions.</div>`;
        } else {
          drawerPane.innerHTML = barHtml + `
            <div class="br-tx-list">
              ${runtime.transactions.slice(0, 35).map(tx => `
                <div class="br-tx-card">
                  <div class="br-tx-top">
                    <span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">
                      <b style="color:#38bdf8;">${TW.esc(tx.contract)}${tx.barrier != null ? ' ' + tx.barrier : ''}</b>
                      <span style="color:#e2e8f0;">${TW.esc(tx.market || '')}</span>
                      ${tx.latencyMs != null ? `<span style="color:#94a3b8;font-size:10px;">⚡${tx.latencyMs}ms</span>` : ''}
                    </span>
                    <b style="color:${tx.won ? '#00ffa3' : '#ff444f'};">${tx.won ? '+' : '-'}$${Math.abs(+tx.profit).toFixed(2)}</b>
                  </div>
                  <div class="br-tx-bot">
                    <span>Ref #${TW.esc(String(tx.refId || tx.id))} · ${tx.time}</span>
                    <span style="font-family:monospace;color:#cbd5e1;">${TW.esc(tx.entryExit)} · $${tx.stake}</span>
                  </div>
                </div>`).join('')}
            </div>`;
        }
        const csvBtn = $('brTxCsvBtn'), clrBtn = $('brTxClearBtn');
        if (csvBtn) csvBtn.onclick = () => {
          if (!runtime.transactions.length) { TW.toast('No transactions to export.', 'err', 2000); return; }
          const rows = [['Ref', 'Time', 'Market', 'Contract', 'Barrier', 'EntryExit', 'Stake', 'Profit', 'LatencyMs']].concat(
            runtime.transactions.map(t => [t.refId || t.id, t.time, `"${t.market || ''}"`, `"${t.contract}"`, t.barrier ?? '', `"${t.entryExit}"`, t.stake, t.profit, t.latencyMs ?? ''])
          );
          const u = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })), a = document.createElement('a');
          a.href = u; a.download = 'deriv-dbot-transactions.csv'; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(u), 2000);
        };
        if (clrBtn) clrBtn.onclick = () => { runtime.transactions = []; renderDrawer(); };
      } else {
        const filtered = runtime.journal.filter(j => {
          const g = j.grp || journalGroup(j.cls);
          if (g === 'error') return jFilters.err;
          if (g === 'success') return jFilters.suc;
          return jFilters.not;
        });
        const jBar = `
          <div class="br-jbar" style="margin:-9px -10px 8px;border-radius:0;">
            <div class="br-jfilters">
              <label><input type="checkbox" id="brJfErr"${jFilters.err ? ' checked' : ''}> Errors</label>
              <label><input type="checkbox" id="brJfNot"${jFilters.not ? ' checked' : ''}> Notifications</label>
              <label><input type="checkbox" id="brJfSuc"${jFilters.suc ? ' checked' : ''}> Success</label>
            </div>
            <button type="button" id="brJClearBtn" class="br-btn reset" style="padding:3px 8px;font-size:10px;">Clear</button>
          </div>`;
        if (!filtered.length) {
          drawerPane.innerHTML = jBar + `<div style="padding:12px;text-align:center;color:#7d8aa5;">No journal messages match current filter.</div>`;
        } else {
          drawerPane.innerHTML = jBar + `<div class="br-jlist">${filtered.slice(0, 60).map(j => {
            const g = j.grp || journalGroup(j.cls);
            const tag = g === 'success' ? '[SUCCESS]' : g === 'error' ? '[ERROR]' : (j.cls === 'info' ? '[INFO]' : '[NOTIFY]');
            return `<div class="br-jrow ${g}"><span class="br-jdot"></span><div><span style="opacity:.6;">${j.time}</span> <b style="opacity:.9;">${tag}</b> ${TW.esc(j.msg)}</div></div>`;
          }).join('')}</div>`;
        }
        const fe = $('brJfErr'), fn = $('brJfNot'), fs = $('brJfSuc'), jc = $('brJClearBtn');
        if (fe) fe.onchange = () => { jFilters.err = fe.checked; renderDrawer(); };
        if (fn) fn.onchange = () => { jFilters.not = fn.checked; renderDrawer(); };
        if (fs) fs.onchange = () => { jFilters.suc = fs.checked; renderDrawer(); };
        if (jc) jc.onclick = () => { runtime.journal = []; renderDrawer(); };
      }
    }

    function renderTelemetry() {
      const on = runtime.on;
      dotEl.className = on ? 'dot live' : 'dot';
      dotEl.style.background = on ? '#00ffa3' : '#7d8aa5';
      runBtn.textContent = on ? '⏹ Stop' : '▶ Run';
      runBtn.className = on ? 'br-btn stop' : 'br-btn run';
      sel.disabled = on;
      dock.classList.toggle('armed', !!(on || q.bot));

      if (!on && runtime.n === 0 && !runtime.lastMsg) {
        badgeEl.textContent = q.bot ? '★ BOT LOADED · WATCH ENTRY & CLICK ▶ RUN' : 'IDLE · WATCH ENTRY & CLICK ▶ RUN';
        badgeEl.className = q.bot ? 'br-badge on' : 'br-badge';
        telemEl.style.display = 'none';
        renderDrawer();
        return;
      }

      badgeEl.textContent = on ? '● LIVE RUNNING' : (runtime.lastMsg || 'STOPPED');
      badgeEl.className = on ? 'br-badge on' : 'br-badge';

      const b = runtime.bot || currentBot();
      const wr = runtime.n > 0 ? Math.round((runtime.w / runtime.n) * 100) + '%' : '—';
      const pnlCol = runtime.pnl >= 0 ? '#00ffa3' : '#ff3b69';
      const nextStk = b ? calcNextStake(b, runtime) : 0;
      const coolLeft = runtime.coolUntil > Date.now() ? Math.ceil((runtime.coolUntil - Date.now()) / 1000) : 0;
      const chips = runtime.history.slice(-8).map(x => `<span style="padding:1px 5px;border-radius:4px;font-size:9.5px;font-weight:900;background:${x === 'W' ? 'rgba(0,255,163,0.18)' : 'rgba(255,59,105,0.18)'};color:${x === 'W' ? '#00ffa3' : '#ff3b69'};">${x}</span>`).join(' ');

      telemEl.style.display = 'flex';
      telemEl.innerHTML = `
        <span>Runs: <b>${runtime.n}</b> (<span style="color:#00ffa3;">${runtime.w}W</span>/<span style="color:#ff3b69;">${runtime.n - runtime.w}L</span> · ${wr})</span>
        <span>Net P/L: <b style="color:${pnlCol};">${runtime.pnl >= 0 ? '+' : '-'}$${Math.abs(runtime.pnl).toFixed(2)}</b></span>
        <span>Next Stake: <b style="color:#ffd600;">$${nextStk.toFixed(2)}</b>${b && b.mart && b.mart.on ? ` (Step ${runtime.step}/${b.mart.steps})` : ''}</span>
        ${runtime.convPct != null ? `<span>AI Conv: <b style="color:#00b2ff;">${runtime.convPct}%</b></span>` : ''}
        ${runtime.vetos ? `<span>Vetoes: <b>${runtime.vetos}</b></span>` : ''}
        ${coolLeft > 0 ? `<span style="color:#ff9f43;">🧊 Cool ${coolLeft}s</span>` : ''}
        ${chips ? `<span style="display:inline-flex;gap:3px;align-items:center;">${chips}</span>` : ''}
        <span style="color:#9fb0cc;flex:1;min-width:150px;text-align:right;">${TW.esc(runtime.lastMsg || '')}</span>
      `;
      renderDrawer();
    }

    function stopBot(reason, journalCls) {
      const wasOn = runtime.on;
      runtime.on = false;
      if (_feedCheck) { clearInterval(_feedCheck); _feedCheck = null; }
      if (runtime._coolTm) { clearTimeout(runtime._coolTm); runtime._coolTm = null; }
      if (runtime.feed) { try { runtime.feed.close(); } catch (e) {} runtime.feed = null; }
      if (reason) {
        runtime.lastMsg = reason;
        if (wasOn || journalCls) addJournal(reason, journalCls || 'warn');
      }
      renderTelemetry();
    }

    function resetBotState() {
      if (runtime.on) stopBot('⏹ Stopped for Reset', 'warn');
      runtime.busy = false;
      runtime.n = 0; runtime.w = 0; runtime.pnl = 0; runtime.recoveryPool = 0;
      runtime.totalStake = 0; runtime.totalPayout = 0;
      runtime.step = 0; runtime.k = 0;
      runtime.consecutiveLosses = 0; runtime.vetos = 0; runtime.coolUntil = 0; runtime.lastEntrySig = '';
      runtime.lastMsg = ''; runtime.convPct = null;
      runtime.history = []; runtime.transactions = []; runtime.journal = [];
      addJournal('Deriv DBot Runner stats, recovery pool, transactions & journal reset.', 'info');
      renderTelemetry();
      TW.toast('↺ Bot stats & Journal reset!', 'ok', 2200);
    }

    async function confirmBotStart(b) {
      if (TW.mode() !== 'live') return true;
      const hasMart = b.mart && b.mart.on;
      const lines = [`<div class="warn" style="margin-bottom:8px;">LIVE mode active (${TW.account.virtual ? 'Deriv DEMO' : 'REAL MONEY'}). Bot will auto-trade until SL, TP, or STOP is pressed.</div>`];
      if (hasMart) lines.push(`<div style="font-size:12.5px;color:#cbd5e1;line-height:1.5;">Recovery (${b.mart.mode}, ${b.mart.mult}× up to ${b.mart.steps} steps) is enabled on <b>${TW.esc(b.name)}</b>. Editable anytime via <b>⚙️ Edit Bot</b>.</div>`);
      return !!(await TW.modal({
        title: `⚠ Run "${b.name}" in LIVE mode?`,
        html: lines.join(''),
        buttons: [{ label: 'Cancel', cls: 'ghost', value: false }, { label: 'Start Live Bot', cls: 'red', value: true }]
      }));
    }

    async function fireTrade(b, contractOverride, barrierOverride) {
      if (runtime.busy) return;
      const pool = TW.tickPool[b.symbol] || {};
      runtime.lastEntrySig = `${(pool.prices || []).length}:${(pool.prices || []).slice(-1)[0] || ''}`;
      runtime.busy = true;
      const digitsPool = pool.digits;
      const plan = planExecution(b, runtime, contractOverride || b.contract, barrierOverride != null ? barrierOverride : b.barrier, digitsPool);
      const useContract = plan.contract;
      const useBarrier = /OVER|UNDER|MATCH|DIFF/.test(useContract) ? plan.barrier : undefined;
      const st = plan.stake;
      const maxStk = (TW.settings && TW.settings.maxStake) ? +TW.settings.maxStake : 10;
      const recTag = plan.isRecovery ? (plan.switched ? ` [SMART RECOVERY SWITCH · Pool $${runtime.recoveryPool.toFixed(2)}]` : ` [RECOVERY Step ${runtime.step} · Pool $${runtime.recoveryPool.toFixed(2)}]`) : '';
      runtime.lastMsg = `⚡ Buying ${useContract}${useBarrier != null ? ' ' + useBarrier : ''} ($${st.toFixed(2)})${plan.isRecovery ? ' · Recovery' : ''}…`;
      addJournal(`Purchased ${useContract}${useBarrier != null ? ' ' + useBarrier : ''} on ${b.symbol} · Stake $${st.toFixed(2)}${recTag}`, plan.isRecovery ? 'warn' : 'info');
      renderTelemetry();

      try {
        const isDig = /^DIGIT/.test(useContract);
        let durUnit = isDig ? 't' : (b.durationUnit || 't');
        let durVal = isDig ? Math.min(10, Math.max(1, b.duration || 1)) : Math.max(1, b.duration || 5);
        if (/^frx(?!XAU)/i.test(b.symbol)) {
          if (durUnit === 't') durUnit = 'm';
          if (durUnit === 'm' && durVal < 15) durVal = 15;
        }
        const t = await TW.trade({
          contract_type: useContract,
          symbol: b.symbol,
          amount: st,
          duration: durVal,
          duration_unit: durUnit,
          barrier: useBarrier,
          label: `${b.name}`,
          bot: b.name,
          silent: true
        });
        await t.done;
        const p = Number(t.profit != null ? t.profit : 0);
        const won = p > 0 || t.status === 'won';
        const latTxt = t.latencyMs != null ? ` · ⚡${t.latencyMs}ms` : '';
        runtime.n++;
        runtime.totalStake = +(runtime.totalStake + st).toFixed(2);
        if (won) runtime.totalPayout = +(runtime.totalPayout + st + p).toFixed(2);
        runtime.pnl = +(runtime.pnl + p).toFixed(2);

        const entryExit = t.exitDigit != null
          ? `D:${t.entryDigit != null ? t.entryDigit : '-'} → D:${t.exitDigit}`
          : (t.exit ? `${t.entry || '-'} → ${t.exit}` : '-');

        runtime.transactions.unshift({
          id: runtime.n,
          refId: t.id || t.cid || runtime.n,
          time: nowTime(),
          market: TW.volName ? TW.volName(b.symbol) : b.symbol,
          contract: useContract + (plan.isRecovery ? ' ↺' : ''),
          barrier: useBarrier,
          entryExit,
          stake: st.toFixed(2),
          profit: p.toFixed(2),
          won,
          latencyMs: t.latencyMs != null ? t.latencyMs : null
        });
        if (runtime.transactions.length > 60) runtime.transactions.pop();

        if (won) {
          if (TW.fx && TW.fx.win) TW.fx.win();
          runtime.w++;
          runtime.consecutiveLosses = 0;
          runtime.coolUntil = 0;
          const isComp = b.mart && b.mart.on && b.mart.mode === 'compounding';
          if (isComp) {
            runtime.recoveryPool = 0;
            runtime.step = runtime.step + 1 >= b.mart.steps ? 0 : runtime.step + 1;
          } else {
            runtime.recoveryPool = Math.max(0, +(Number(runtime.recoveryPool || 0) - p).toFixed(2));
            if (runtime.recoveryPool <= 0.01) {
              runtime.recoveryPool = 0;
              runtime.step = 0;
            }
          }
          runtime.history.push('W');
          const recNote = plan.isRecovery && runtime.recoveryPool === 0 ? ' · RECOVERY CLEARED!' : (runtime.recoveryPool > 0 ? ` · Pool left $${runtime.recoveryPool.toFixed(2)}` : '');
          runtime.lastMsg = `🎯 WON +$${p.toFixed(2)}${latTxt}${recNote}`;
          addJournal(`#${runtime.n} WON +$${p.toFixed(2)} (${entryExit}${latTxt})${recNote} · Net P/L: ${runtime.pnl >= 0 ? '+' : '-'}$${Math.abs(runtime.pnl).toFixed(2)}`, 'win');
        } else {
          if (TW.fx && TW.fx.loss) TW.fx.loss();
          const isComp = b.mart && b.mart.on && b.mart.mode === 'compounding';
          runtime.recoveryPool = isComp ? 0 : +(Number(runtime.recoveryPool || 0) + Math.abs(p || st)).toFixed(2);
          runtime.step = (!b.mart || !b.mart.on || isComp) ? 0 : Math.min(b.mart.steps, (runtime.step || 0) + 1);
          runtime.consecutiveLosses++;
          if (runtime.consecutiveLosses >= 2 && b.coolSecs > 0) runtime.coolUntil = Date.now() + b.coolSecs * 1000;
          const nextPlan = planExecution(b, runtime, b.contract, b.barrier, (TW.tickPool[b.symbol] || {}).digits);
          runtime.history.push('L');
          runtime.lastMsg = `✗ Lost -$${st.toFixed(2)}${latTxt} · Pool $${runtime.recoveryPool.toFixed(2)} · Next ${nextPlan.contract}${nextPlan.stake >= maxStk ? ' (Cap)' : ''} $${nextPlan.stake.toFixed(2)}`;
          addJournal(`#${runtime.n} LOST -$${st.toFixed(2)} (${entryExit}${latTxt}) · Recovery Pool $${runtime.recoveryPool.toFixed(2)} · Next: ${nextPlan.contract}${/OVER|UNDER|MATCH|DIFF/.test(nextPlan.contract) ? ' ' + nextPlan.barrier : ''} $${nextPlan.stake.toFixed(2)}`, 'loss');
        }

        if (b.sl > 0 && runtime.pnl <= -b.sl) {
          stopBot(`🛑 Stop-Loss (-$${b.sl}) reached`, 'loss');
          TW.toast(`🛑 [${b.name}] Stop-Loss hit (-$${b.sl.toFixed(2)}). Bot halted.`, 'err', 5000);
        } else if (b.tp > 0 && runtime.pnl >= b.tp) {
          stopBot(`🏆 Take-Profit (+$${b.tp}) hit!`, 'win');
          TW.toast(`🏆 [${b.name}] Take-Profit achieved (+$${b.tp.toFixed(2)})!`, 'ok', 5000);
        } else if (b.max > 0 && runtime.n >= b.max) {
          stopBot(`✅ Max trades (${b.max}) completed`, 'win');
          TW.toast(`✅ [${b.name}] Completed ${b.max} trades.`, 'ok', 4000);
        }
      } catch (e) {
        const msg = e && (e.message || String(e)) || 'Execution error';
        runtime.lastMsg = '⚠️ ' + msg;
        addJournal(`${msg}`, 'error');
        if (runtime.on && /balance|stop-loss|max-stake|minimum stake|cancelled|not enough|unauthorized|authori/i.test(msg)) {
          stopBot('🛑 Halted: ' + msg, 'loss');
          TW.toast(`🛑 [${b.name}] ${msg}`, 'err', 5000);
        }
      } finally {
        runtime.busy = false;
        renderTelemetry();
        if (runtime.on && runtime.bot && (!runtime.coolUntil || runtime.coolUntil <= Date.now()) && runtime.bot.speedMode !== 'guarded') {
          const latestPool = TW.tickPool[runtime.bot.symbol] || {};
          const curSig = `${(latestPool.prices || []).length}:${(latestPool.prices || []).slice(-1)[0] || ''}`;
          if (runtime.bot.rule.kind === 'instant' || runtime.recoveryPool > 0.01 || (runtime.bot.speedMode === 'hft' && curSig !== runtime.lastEntrySig)) {
            queueMicrotask(() => { if (runtime.on && !runtime.busy) evalTick(latestPool); });
          }
        }
      }
    }

    function evalTick(fd) {
      const b = runtime.bot;
      if (!runtime.on || !b || runtime.busy) return;
      runtime.k++;
      const P = (fd && fd.prices && fd.prices.length) ? fd.prices : (TW.tickPool[b.symbol]?.prices || []);
      const D = (fd && fd.digits && fd.digits.length) ? fd.digits : (TW.tickPool[b.symbol]?.digits || []);
      if (P.length < 2) return;
      const i = P.length - 1;

      if (runtime.coolUntil && runtime.coolUntil > Date.now()) {
        renderTelemetry();
        if (!runtime._coolTm) {
          runtime._coolTm = setTimeout(() => { runtime._coolTm = null; if (runtime.on) evalTick(fd); }, 600);
        }
        return;
      }
      runtime.coolUntil = 0;

      const isFxBot = /^(frx|XAU)/i.test(b.symbol);
      const fxSeries = (isFxBot && runtime.fxCandles && runtime.fxCandles.length >= 20)
        ? runtime.fxCandles.slice(-240).concat([P[i]])
        : P;
      let dynContract = b.contract, dynBarrier = b.barrier, go = false;
      if (b.rule.kind === 'instant') {
        go = true;
      } else if (b.rule.kind === 'ai_alpha') {
        go = true;
        if (isFxBot && window.TWS && TWS.analyzeForex && fxSeries.length >= 20) {
          const fxSig = TWS.analyzeForex(fxSeries, b.symbol);
          if (fxSig.action === 'HOLD') {
            if (b.aiMode === 'turbo') {
              dynContract = fxSig.ema9 >= fxSig.ema21 ? 'CALL' : 'PUT';
            } else {
              runtime.convPct = fxSig.conviction;
              runtime.lastMsg = `FX AI Hold (${fxSig.biasLabel} · ${fxSig.conviction}% · ${fxSig.reason || 'Awaiting trend alignment'})`;
              renderTelemetry();
              return;
            }
          } else {
            dynContract = fxSig.action;
          }
        } else if (D.length >= 15 && window.TWS) {
          if (/OVER|UNDER/.test(b.contract) && TWS.decideOverUnder) {
            const ou = TWS.decideOverUnder(D, P);
            if (ou && ou.best) { dynContract = ou.best.contract; dynBarrier = ou.best.barrier; }
          } else if (/EVEN|ODD/.test(b.contract) && TWS.decideEvenOdd) {
            const eo = TWS.decideEvenOdd(D, P);
            if (eo) dynContract = eo.action === 'EVEN' ? 'DIGITEVEN' : 'DIGITODD';
          } else if ((b.contract === 'DIGITDIFF' || b.contract === 'DIGITMATCH') && TWS.decideMatchesDiffers) {
            const counts = Array(10).fill(0); D.slice(-100).forEach(d => counts[d]++);
            dynBarrier = b.contract === 'DIGITDIFF' ? counts.indexOf(Math.min(...counts)) : counts.indexOf(Math.max(...counts));
          } else if ((b.contract === 'CALL' || b.contract === 'PUT') && P.length >= 15) {
            const win = P.slice(-20);
            const e5 = win.slice(-5).reduce((a, x) => a + x, 0) / Math.min(5, win.length);
            const e15 = win.reduce((a, x) => a + x, 0) / win.length;
            dynContract = e5 >= e15 ? 'CALL' : 'PUT';
          }
        }
      } else if (b.rule.kind === 'every') {
        go = runtime.k % Math.max(1, b.rule.n || 1) === 0;
      } else {
        let s = 0; const targetN = Math.max(1, b.rule.n || 1);
        for (let j = i; j >= 1 && s < targetN && condMatch(b.rule.cond, b.rule.cb, P, D, j); j--) s++;
        go = s >= targetN;
      }

      const plan = planExecution(b, runtime, dynContract, dynBarrier, D);
      const evalContract = plan.contract;
      const evalBarrier = plan.barrier;
      const gate = (plan.switched || evalContract !== b.contract || evalBarrier !== b.barrier) ? defaultGate(evalContract, evalBarrier) : (b.aiGate || defaultGate(evalContract, evalBarrier));
      const priceSeries = isFxBot ? fxSeries : P;
      const rf = (window.TWS && TWS.regimeFingerprint && (priceSeries.length >= 20 || D.length >= 20)) ? TWS.regimeFingerprint(priceSeries, D) : null;
      const conf = (window.TWS && TWS.calcConfidence)
        ? TWS.calcConfidence({ contract: evalContract, barrier: evalBarrier, symbol: b.symbol, prices: priceSeries, digits: D, consecutiveLosses: runtime.consecutiveLosses, gate, lossShield: b.lossShield !== false })
        : { score: 75, passes: true, gate };
      runtime.convPct = conf.score;

      if (!go && b.rule.kind === 'streak') {
        let s = 0; const targetN = Math.max(1, b.rule.n || 1);
        for (let j = i; j >= 1 && s < targetN && condMatch(b.rule.cond, b.rule.cb, P, D, j); j--) s++;
        runtime.lastMsg = `Waiting entry signal (${s}/${targetN} ${b.rule.cond}) · Digit ${D[i]} · AI ${conf.score}%${rf ? ` · ${rf.hazard}` : ''}`;
      }

      const isTurbo = b.aiMode === 'turbo';
      const chopVeto = !isTurbo && rf && rf.hazard === 'CHOP_TRAP' && rf.chopIndex >= 0.74;
      const passes = !chopVeto && (isTurbo || conf.passes);

      if (go) {
        if (chopVeto) {
          runtime.vetos++;
          const chopPct = Math.round(rf.chopIndex * 100);
          runtime.lastMsg = `🛡️ AI Chop-Trap Veto (Chop ${chopPct}% · Hurst ${rf.hurst})`;
          if (runtime.vetos === 1 || runtime.vetos % 5 === 0) {
            addJournal(`🛡️ AI Chop-Trap filter paused entry on ${evalContract} (Chop ${chopPct}%, high alternating noise)`, 'warn');
          }
          renderTelemetry();
          return;
        }
        if (!passes) {
          runtime.vetos++;
          runtime.lastMsg = `🛡️ AI Vetoed ${evalContract}${evalBarrier != null ? ' ' + evalBarrier : ''} (${conf.score}% < ${conf.gate}% gate)`;
          addJournal(`🛡️ AI Guard vetoed low-conviction setup on ${evalContract}${evalBarrier != null ? ' ' + evalBarrier : ''} (${conf.score}% < ${conf.gate}% gate)`, 'warn');
          renderTelemetry();
          return;
        }
        fireTrade(b, dynContract, dynBarrier);
      } else {
        renderTelemetry();
      }
    }

    async function startSelectedBot() {
      const b = currentBot();
      if (!b) return;
      if (!(await confirmBotStart(b))) return;
      if (opt.onBeforeStart) opt.onBeforeStart(b);

      if (runtime.on) stopBot();
      runtime.on = true;
      runtime.busy = false;
      runtime.bot = cleanBot(b);
      runtime.coolUntil = 0;
      runtime.k = 0;
      runtime.lastMsg = `▶ Running ${b.name} on ${b.symbol}…`;
      addJournal(`▶ Started "${b.name}" on ${TW.volName(b.symbol)} (${b.contract}${/OVER|UNDER|MATCH|DIFF/.test(b.contract) ? ' ' + b.barrier : ''} · $${b.stake} · Rule: ${b.rule.kind})`, 'win');
      renderTelemetry();
      TW.toast(`▶ Running DBot: ${b.name} on ${TW.volName(b.symbol)}`, 'ok', 3200);

      runtime.fxCandles = null;
      if (/^(frx|XAU)/i.test(b.symbol) && TW.scanMarkets) {
        const fxMeta = TW.VOLS.find(v => v.id === b.symbol) || { id: b.symbol, name: TW.volName(b.symbol), fx: true };
        TW.scanMarkets([fxMeta], {
          count: 240, style: 'candles', granularity: 900, concurrency: 1, timeoutMs: 6500,
          onDone: items => {
            if (runtime.on && runtime.bot && runtime.bot.symbol === b.symbol && items && items[0] && items[0].prices && items[0].prices.length >= 20) {
              runtime.fxCandles = items[0].prices;
              evalTick(TW.tickPool[b.symbol] || { prices: runtime.fxCandles.slice(-80), digits: [] });
            }
          }
        });
      }

      const curSym = opt.getSymbol ? opt.getSymbol() : '';
      const onFeedErr = msg => {
        if (!runtime.on) return;
        runtime.lastMsg = '⚠️ Feed: ' + msg;
        addJournal(`⚠️ Market feed notice (${b.symbol}): ${msg}`, 'error');
        renderTelemetry();
      };
      if (b.symbol !== curSym) {
        runtime.feed = TW.tickFeed(b.symbol, {
          primary: false, count: 80,
          onHistory: fd => { if (runtime.on) evalTick(fd); },
          onTick: fd => { if (runtime.on) evalTick(fd); },
          onError: onFeedErr
        });
      } else {
        const pool = TW.tickPool[b.symbol];
        if (pool && pool.prices && pool.prices.length >= 2) evalTick(pool);
      }
      if (_feedCheck) clearInterval(_feedCheck);
      _feedCheck = setInterval(() => {
        if (!runtime.on || !runtime.bot) { clearInterval(_feedCheck); _feedCheck = null; return; }
        const nowSym = opt.getSymbol ? opt.getSymbol() : '';
        const pool = TW.tickPool[runtime.bot.symbol];
        const stalePool = !pool || !pool.lastUpdated || (Date.now() - pool.lastUpdated > 7000);
        if ((runtime.bot.symbol !== nowSym || stalePool) && !runtime.feed) {
          runtime.feed = TW.tickFeed(runtime.bot.symbol, {
            primary: false, count: 80,
            onHistory: fd => { if (runtime.on) evalTick(fd); },
            onTick: fd => { if (runtime.on) evalTick(fd); },
            onError: onFeedErr
          });
        }
      }, 1500);
    }

    TW.onGlobalTick = (function (prev) {
      return function (sym, tk) {
        if (typeof prev === 'function') try { prev(sym, tk); } catch (e) {}
        const b = runtime.bot || currentBot();
        if (!runtime.on && runtime.n === 0 && !runtime.lastMsg && b && b.symbol === sym && tk) {
          const isFxSym = /^(frx|XAU)/i.test(sym);
          const cue = isFxSym && tk.price != null ? ('SPOT ' + tk.price) : (tk.digit != null ? ('DIGIT ' + tk.digit) : '');
          if (cue) {
            badgeEl.textContent = (q.bot ? '★ BOT LOADED · ' : 'IDLE · ') + cue + ' · CLICK ▶ RUN AT ENTRY';
          }
        }
        if (runtime.on && runtime.bot && runtime.bot.symbol === sym && !runtime.feed) {
          const pool = TW.tickPool[sym];
          if (pool) evalTick(pool);
        }
      };
    })(TW.onGlobalTick);

    runBtn.onclick = () => {
      if (runtime.on) stopBot('⏹ Bot stopped by trader', 'warn');
      else startSelectedBot();
    };

    resetBtn.onclick = resetBotState;

    editBtn.onclick = () => {
      editOpen = !editOpen;
      editBtn.textContent = editOpen ? '▲ Close Edit' : '⚙️ Edit Bot';
      renderInlineEditor();
    };

    shotBtn.onclick = () => {
      const b = currentBot();
      if (!b || runtime.busy) return;
      fireTrade(b);
    };

    sel.onchange = () => {
      activeId = sel.value;
      const b = currentBot();
      renderSpec();
      if (editOpen) renderInlineEditor();
      if (b && opt.onSelectBot && !runtime.on) opt.onSelectBot(b);
    };

    syncBtn.onclick = () => {
      const b = currentBot();
      if (!b || !opt.getCurrentSetup) return;
      const s = opt.getCurrentSetup();
      const updated = upsertBot(Object.assign({}, b, {
        symbol: s.symbol || b.symbol,
        contract: s.contract || b.contract,
        barrier: s.barrier != null ? s.barrier : b.barrier,
        duration: s.duration != null ? s.duration : b.duration,
        durationUnit: s.durationUnit || b.durationUnit || 't',
        stake: s.stake != null ? s.stake : b.stake
      }));
      renderSelect(updated.id);
      addJournal(`🎯 Synced screen view (${updated.symbol} · ${updated.contract}${/OVER|UNDER|MATCH|DIFF/.test(updated.contract) ? ' ' + updated.barrier : ''}) into "${updated.name}"`, '');
      renderDrawer();
      TW.toast(`Synced screen setup (${updated.symbol} · ${updated.contract}) into "${updated.name}"`, 'ok', 3200);
    };

    saveNewBtn.onclick = () => {
      if (!opt.getCurrentSetup) return;
      const s = opt.getCurrentSetup();
      const c = s.contract || 'DIGITUNDER';
      const bar = s.barrier != null ? +s.barrier : (c === 'DIGITUNDER' ? 7 : 2);
      const barStr = /OVER|UNDER|MATCH|DIFF/.test(c) ? ' ' + bar : '';
      let rule = { kind: 'ai_alpha', cond: 'even', cb: 0, n: 1 };
      if (c === 'DIGITOVER') rule = { kind: 'streak', cond: 'under', cb: Math.min(8, bar + 1), n: 1 };
      else if (c === 'DIGITUNDER') rule = { kind: 'streak', cond: 'over', cb: Math.max(1, bar - 1), n: 1 };
      else if (c === 'DIGITEVEN') rule = { kind: 'streak', cond: 'odd', cb: 0, n: 2 };
      else if (c === 'DIGITODD') rule = { kind: 'streak', cond: 'even', cb: 0, n: 2 };
      const isRF = c === 'CALL' || c === 'PUT';
      const martMode = isRF ? 'split_recovery' : 'smart_barrier';
      const martOn = c !== 'DIGITMATCH';
      const stk = Math.max(0.35, +s.stake || 0.5);
      const nb = upsertBot({
        name: specialistBotName(s.symbol, c, bar),
        symbol: s.symbol,
        contract: c,
        barrier: bar,
        duration: s.duration || (/^(frx|XAU)/i.test(String(s.symbol || '')) ? 15 : (isRF ? 5 : 1)),
        durationUnit: s.durationUnit || (/^(frx|XAU)/i.test(String(s.symbol || '')) ? 'm' : 't'),
        stake: stk,
        rule,
        mart: { on: martOn, mode: martMode, mult: 1.05, steps: 4 },
        aiMode: 'active',
        aiGate: defaultGate(c, bar),
        lossShield: true,
        coolSecs: 4,
        sl: Math.max(5, +(stk * 12).toFixed(0)),
        tp: Math.max(10, +(stk * 24).toFixed(0))
      });
      renderSelect(nb.id);
      addJournal(`💾 Saved "${nb.name}" (${nb.symbol} · ${nb.contract}${barStr} · ${martOn ? martMode : 'Flat'})`, 'win');
      renderDrawer();
      TW.toast(`💾 Saved "${nb.name}" with AI Guard & ${martOn ? martMode : 'Flat Stake'}!`, 'ok', 3800);
    };

    dock.querySelectorAll('[data-brtab]').forEach(btn => {
      btn.onclick = () => {
        activeTab = btn.dataset.brtab;
        drawerCollapsed = false;
        renderDrawer();
      };
    });

    toggleDrawerBtn.onclick = () => {
      drawerCollapsed = !drawerCollapsed;
      renderDrawer();
    };

    TW.on('kill', () => { if (runtime.on) stopBot('🚨 Emergency STOP triggered', 'loss'); });
    window.addEventListener('storage', e => { if (e.key === BOTKEY && !runtime.on) renderSelect(activeId); });

    renderSelect();
    if (!q.bot) {
      addJournal('Deriv DBot Runner ready. Select bot or watch circles & click ▶ Run.', 'info');
    }
    renderDrawer();

    if (q.bot) {
      const b = currentBot();
      if (b && opt.onSelectBot) {
        setTimeout(() => opt.onSelectBot(b, true), 50);
      }
      if (b) {
        addJournal(`Loaded "${b.name}" onto ${TW.volName(b.symbol)}. Watch circles/chart & click ▶ Run at entry.`, 'win');
        renderDrawer();
      }
      dock.classList.add('armed');
      badgeEl.textContent = '★ BOT LOADED · WATCH ENTRY & CLICK ▶ RUN';
      badgeEl.className = 'br-badge on';
    }

    return {
      refresh: () => renderSpec(),
      selectBot: id => { renderSelect(id); },
      stop: stopBot,
      reset: resetBotState,
      isRunning: () => runtime.on
    };
  };
})();
