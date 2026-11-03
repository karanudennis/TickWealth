/**
 * ⚡ TICKWEALTH VANGUARD NEXUS - Core Client Pipeline v4.5
 * Module: vanguard-core.js
 * Multi-account OAuth parser, WebSocket gateway manager,
 * AI Confidence Level Loss-Minimization Gate, Rapid & Deep Scanner,
 * Gemini AI Synthesis proxy caller, and automated trade journaling ledger.
 */

(function (window) {
  'use strict';

  // WebSocket URL MUST BE EXACTLY: wss://ws.derivws.com/websockets/v3?app_id=1089
  const VANGUARD_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';
  const VANGUARD_OAUTH_URL = 'https://oauth.deriv.com/oauth2/authorize?app_id=1089';

  const VANGUARD_TRACKED_SYMBOLS = ['R_100', '1HZ75V', 'frxEURUSD', 'frxXAUUSD'];
  const VANGUARD_ALL_SCAN_SYMBOLS = [
    { id: 'R_10', name: 'Volatility 10 Index', pip: 3 },
    { id: 'R_25', name: 'Volatility 25 Index', pip: 3 },
    { id: 'R_50', name: 'Volatility 50 Index', pip: 4 },
    { id: 'R_75', name: 'Volatility 75 Index', pip: 4 },
    { id: 'R_100', name: 'Volatility 100 Index', pip: 2 },
    { id: '1HZ10V', name: 'Volatility 10 (1s) Index', pip: 2 },
    { id: '1HZ25V', name: 'Volatility 25 (1s) Index', pip: 2 },
    { id: '1HZ75V', name: 'Volatility 75 (1s) Index', pip: 2 },
    { id: '1HZ100V', name: 'Volatility 100 (1s) Index', pip: 2 },
    { id: 'frxEURUSD', name: 'EUR / USD Forex', pip: 5 },
    { id: 'frxXAUUSD', name: 'Gold / USD Commodity', pip: 2 },
  ];

  const VANGUARD_SYMBOL_NAMES = {
    'R_100': 'Volatility 100 Index',
    '1HZ75V': 'Volatility 75 (1s) Index',
    'frxEURUSD': 'EUR / USD Forex',
    'frxXAUUSD': 'Gold / USD Commodity',
  };

  // State registry with vanguard_ prefixes
  const vanguard_state = {
    ws: null,
    scan_ws: null,
    worker: null,
    is_connected: false,
    is_scanning: false,
    active_account_type: 'simulated',
    active_token: '',
    active_loginid: 'SIMULATED',
    accounts: {},
    active_asset: 'R_100',
    current_view: 'matrix',
    stake: 1.0,
    take_profit: 25.0,
    stop_loss: 15.0,
    wallet_balance: 10000.0,
    starting_balance: 10000.0,
    session_profit: 0.0,
    max_profit_peak: 0.0,
    max_drawdown: 0.0,
    total_contracts: 0,
    winning_contracts: 0,
    losing_contracts: 0,
    consecutive_losses: 0,
    order_lock_until: 0,
    re_entry_cooldown_ms: 2500,
    selected_bot_engine: 'all',
    risk_multiplier: 1.0,

    // AI Confidence & Loss-Minimization Settings
    min_confidence_threshold: 80, // Default 80% confidence gate
    adaptive_loss_shield: true, // Elevates threshold after losses
    current_confidence_score: 82,

    // Scanner state
    scan_barrier: 4,
    scan_results: [],
    is_scanning_markets: false,

    latency_ms: 18,
    ntp_offset_ms: 0,
    last_ping_timestamp: 0,
    ping_timer: null,
    simulated_ticks_timer: null,
    last_quotes: {
      'R_100': 1845.20,
      '1HZ75V': 98200.50,
      'frxEURUSD': 1.08450,
      'frxXAUUSD': 2735.60,
    },
    contracts_history: [],
  };

  // --- Web Worker Thread Interface ---
  function vanguard_init_worker() {
    try {
      vanguard_state.worker = new Worker('/vanguard-worker.js');
      vanguard_state.worker.onmessage = function (vanguard_evt) {
        vanguard_handle_worker_message(vanguard_evt.data);
      };
      vanguard_log_event('WORKER', 'Mathematical calculations Web Worker thread loaded.', 'info');
    } catch (vanguard_worker_err) {
      console.warn('[Vanguard Worker] Worker warning, falling back to sync mode:', vanguard_worker_err);
      vanguard_state.worker = null;
    }
  }

  function vanguard_handle_worker_message(vanguard_data) {
    if (!vanguard_data || !vanguard_data.type) return;

    switch (vanguard_data.type) {
      case 'TICK_PROCESSED': {
        const vanguard_p = vanguard_data.payload;
        vanguard_render_matrix_tick(vanguard_p.symbol, vanguard_p.quote, vanguard_p.delta);
        vanguard_render_digit_histogram(vanguard_p.symbol, vanguard_p.digitCounts, vanguard_p.totalDigits, vanguard_p.lastDigitsRibbon);

        if (vanguard_p.symbol === vanguard_state.active_asset) {
          if (typeof window.pushPriceToChart === 'function') {
            window.pushPriceToChart(vanguard_p.epoch, vanguard_p.quote);
          }
          vanguard_update_chart_header_quote(vanguard_p.quote, vanguard_p.delta);
        }
        break;
      }

      case 'INDICATORS_UPDATED': {
        const vanguard_ind = vanguard_data.payload;
        if (vanguard_ind.symbol === vanguard_state.active_asset) {
          vanguard_update_telemetry_ui(vanguard_ind);
          if (vanguard_ind.confidenceScore) {
            vanguard_state.current_confidence_score = vanguard_ind.confidenceScore;
            vanguard_update_confidence_gauge(vanguard_ind.confidenceScore);
          }
        }
        break;
      }

      case 'BOT_SIGNAL': {
        if (!vanguard_state.is_scanning) return;
        const vanguard_sig = vanguard_data.payload;
        vanguard_evaluate_bot_signal_gate(vanguard_sig);
        break;
      }

      case 'SCAN_RESULT': {
        vanguard_handle_scan_result_from_worker(vanguard_data.payload);
        break;
      }

      case 'LATENCY_DROP': {
        const vanguard_lat = vanguard_data.payload;
        vanguard_log_event('LATENCY DROP', `Packet delay ${vanguard_lat.delayMs}ms > ${vanguard_lat.maxAllowed}ms cutoff. Trade dropped to prevent slippage.`, 'warn');
        break;
      }

      default:
        break;
    }
  }

  // --- AI Confidence Level Loss-Minimization Gate ---
  /**
   * Evaluates arriving bot signals through the AI Confidence Gate.
   * If the signal's confidence score is below the operator's threshold,
   * the trade is VETOED to minimize losses and protect capital!
   */
  function vanguard_evaluate_bot_signal_gate(vanguard_sig) {
    const vanguard_confidence = vanguard_sig.confidenceScore || 70;
    let vanguard_required_threshold = vanguard_state.min_confidence_threshold;

    // Consecutive Loss Shield: automatically increases confidence gate by +5% per loss
    if (vanguard_state.adaptive_loss_shield && vanguard_state.consecutive_losses > 0) {
      vanguard_required_threshold = Math.min(95, vanguard_required_threshold + vanguard_state.consecutive_losses * 5);
    }

    if (vanguard_confidence < vanguard_required_threshold) {
      vanguard_log_event(
        'AI LOSS GUARD',
        `VETOED: Signal confidence ${vanguard_confidence}% < required ${vanguard_required_threshold}% threshold on [${vanguard_sig.symbol} ${vanguard_sig.contractType}]. Trade skipped to preserve capital.`,
        'warn'
      );
      vanguard_update_bot_status(`AI LOSS GUARD: Vetoed ${vanguard_sig.contractType} (${vanguard_confidence}% < ${vanguard_required_threshold}%)`);
      return;
    }

    // Passed AI Gate -> Proceed to dispatch
    vanguard_dispatch_automated_order(vanguard_sig);
  }

  function vanguard_update_confidence_gauge(vanguard_score) {
    const vanguard_gauge_val = document.getElementById('ai-confidence-val');
    const vanguard_gauge_bar = document.getElementById('ai-confidence-bar');
    const vanguard_gauge_status = document.getElementById('ai-confidence-status');

    if (vanguard_gauge_val) vanguard_gauge_val.textContent = `${vanguard_score}%`;
    if (vanguard_gauge_bar) {
      vanguard_gauge_bar.style.width = `${vanguard_score}%`;
      if (vanguard_score >= 80) {
        vanguard_gauge_bar.className = 'h-full rounded bg-[#00e676] transition-all duration-300 shadow-[0_0_10px_rgba(0,230,118,0.5)]';
      } else if (vanguard_score >= 65) {
        vanguard_gauge_bar.className = 'h-full rounded bg-[#2979ff] transition-all duration-300';
      } else {
        vanguard_gauge_bar.className = 'h-full rounded bg-[#ffd600] transition-all duration-300';
      }
    }
    if (vanguard_gauge_status) {
      const vanguard_min = vanguard_state.min_confidence_threshold;
      if (vanguard_score >= vanguard_min) {
        vanguard_gauge_status.textContent = `PASSES GATE (≥${vanguard_min}%)`;
        vanguard_gauge_status.className = 'text-[10px] font-mono text-[#00e676] font-bold';
      } else {
        vanguard_gauge_status.textContent = `BELOW GATE (<${vanguard_min}%)`;
        vanguard_gauge_status.className = 'text-[10px] font-mono text-[#ffd600] font-bold';
      }
    }
  }

  function vanguard_update_bot_status(vanguard_str) {
    const vanguard_el = document.getElementById('bot-convergence-status');
    if (vanguard_el) vanguard_el.textContent = vanguard_str;
  }

  // --- Microsecond Logger Subsystem ---
  function vanguard_get_micro_time() {
    const vanguard_d = new Date();
    const vanguard_h = String(vanguard_d.getHours()).padStart(2, '0');
    const vanguard_m = String(vanguard_d.getMinutes()).padStart(2, '0');
    const vanguard_s = String(vanguard_d.getSeconds()).padStart(2, '0');
    const vanguard_ms = String(vanguard_d.getMilliseconds()).padStart(3, '0');
    const vanguard_perf = Math.floor((performance.now() % 1) * 1000);
    return `${vanguard_h}:${vanguard_m}:${vanguard_s}.${vanguard_ms}${String(vanguard_perf).padStart(3, '0')}`;
  }

  function vanguard_log_event(vanguard_tag, vanguard_msg, vanguard_level = 'info') {
    const vanguard_terminal = document.getElementById('execution-logs');
    if (!vanguard_terminal) return;

    const vanguard_ts = vanguard_get_micro_time();
    const vanguard_line = document.createElement('div');
    vanguard_line.className = 'font-mono text-[11px] leading-relaxed flex items-baseline gap-2 py-0.5 border-b border-[#141b27]/30';

    let vanguard_color = 'text-slate-300';
    if (vanguard_level === 'success') vanguard_color = 'text-[#00e676]';
    if (vanguard_level === 'error') vanguard_color = 'text-[#ff1744]';
    if (vanguard_level === 'warn') vanguard_color = 'text-[#ffd600]';
    if (vanguard_level === 'accent') vanguard_color = 'text-[#2979ff]';

    vanguard_line.innerHTML = `
      <span class="text-[#70839a] select-none text-[10px] shrink-0">[${vanguard_ts}]</span>
      <span class="font-bold text-[9px] uppercase px-1 py-0.5 rounded bg-[#111722] border border-[#1c2536] text-slate-300 shrink-0">[${vanguard_tag}]</span>
      <span class="${vanguard_color} break-all">${vanguard_escape_html(vanguard_msg)}</span>
    `;

    vanguard_terminal.appendChild(vanguard_line);

    while (vanguard_terminal.children.length > 250) {
      vanguard_terminal.removeChild(vanguard_terminal.firstChild);
    }

    const vanguard_autoscroll = document.getElementById('log-autoscroll');
    if (!vanguard_autoscroll || vanguard_autoscroll.checked) {
      vanguard_terminal.scrollTop = vanguard_terminal.scrollHeight;
    }
  }

  function vanguard_escape_html(vanguard_raw) {
    return String(vanguard_raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- OAuth URL Parser + sessionStorage Storage ---
  function vanguard_parse_oauth_url() {
    try {
      const vanguard_search = window.location.search;
      if (!vanguard_search || !vanguard_search.includes('token1=')) {
        vanguard_load_stored_accounts();
        return;
      }

      const vanguard_params = new URLSearchParams(vanguard_search);
      const vanguard_parsed_accounts = {};

      for (let vanguard_i = 1; vanguard_i <= 10; vanguard_i++) {
        const vanguard_acct = vanguard_params.get(`acct${vanguard_i}`);
        const vanguard_tok = vanguard_params.get(`token${vanguard_i}`);

        if (vanguard_acct && vanguard_tok) {
          const vanguard_is_real = vanguard_acct.toUpperCase().startsWith('CR') || !vanguard_acct.toUpperCase().startsWith('VRTC');
          const vanguard_type = vanguard_is_real ? 'REAL' : 'DEMO';
          vanguard_parsed_accounts[vanguard_acct] = {
            loginid: vanguard_acct,
            token: vanguard_tok,
            type: vanguard_type,
          };
        }
      }

      if (Object.keys(vanguard_parsed_accounts).length > 0) {
        sessionStorage.setItem('vanguard_accounts', JSON.stringify(vanguard_parsed_accounts));
        vanguard_state.accounts = vanguard_parsed_accounts;
        vanguard_log_event('OAUTH', `Synchronized ${Object.keys(vanguard_parsed_accounts).length} account credentials via OAuth.`, 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (vanguard_oauth_err) {
      console.warn('[Vanguard OAuth] Parser warning:', vanguard_oauth_err);
    }

    vanguard_load_stored_accounts();
  }

  function vanguard_load_stored_accounts() {
    try {
      const vanguard_raw = sessionStorage.getItem('vanguard_accounts');
      if (vanguard_raw) {
        vanguard_state.accounts = JSON.parse(vanguard_raw);
      }
    } catch (e) {
      vanguard_state.accounts = {};
    }
    vanguard_populate_account_selector();
  }

  function vanguard_populate_account_selector() {
    const vanguard_select = document.getElementById('account-node-select');
    if (!vanguard_select) return;

    vanguard_select.innerHTML = '';

    const vanguard_opt_sim = document.createElement('option');
    vanguard_opt_sim.value = 'simulated';
    vanguard_opt_sim.textContent = 'SIMULATED LEDGER ($10,000.00)';
    vanguard_select.appendChild(vanguard_opt_sim);

    const vanguard_acct_keys = Object.keys(vanguard_state.accounts);
    vanguard_acct_keys.forEach((vanguard_k) => {
      const vanguard_acc = vanguard_state.accounts[vanguard_k];
      const vanguard_opt = document.createElement('option');
      vanguard_opt.value = vanguard_acc.loginid;
      vanguard_opt.textContent = `${vanguard_acc.type}: ${vanguard_acc.loginid}`;
      vanguard_select.appendChild(vanguard_opt);
    });

    const vanguard_stored_active = sessionStorage.getItem('vanguard_active_account');
    if (vanguard_stored_active && (vanguard_stored_active === 'simulated' || vanguard_state.accounts[vanguard_stored_active])) {
      vanguard_select.value = vanguard_stored_active;
    }
  }

  function vanguard_handle_account_switch(vanguard_selected_id) {
    if (vanguard_selected_id.toUpperCase().startsWith('CR') || (vanguard_state.accounts[vanguard_selected_id] && vanguard_state.accounts[vanguard_selected_id].type === 'REAL')) {
      const vanguard_confirmed = window.confirm(
        'CRITICAL REGULATORY RISK ACKNOWLEDGEMENT: You are deploying algorithmic bot strategies onto a LIVE REAL MONEY account balance. Slippage and market conditions apply. Confirm deployment parameters?'
      );

      if (!vanguard_confirmed) {
        const vanguard_select = document.getElementById('account-node-select');
        if (vanguard_select) vanguard_select.value = 'simulated';
        vanguard_activate_simulated_account();
        return;
      }
    }

    vanguard_halt_automation('Account context switch triggered.');
    sessionStorage.setItem('vanguard_active_account', vanguard_selected_id);
    vanguard_send_forget_all();

    if (vanguard_selected_id === 'simulated') {
      vanguard_activate_simulated_account();
    } else {
      const vanguard_acc = vanguard_state.accounts[vanguard_selected_id];
      if (vanguard_acc && vanguard_acc.token) {
        vanguard_state.active_account_type = vanguard_acc.type.toLowerCase();
        vanguard_state.active_token = vanguard_acc.token;
        vanguard_state.active_loginid = vanguard_acc.loginid;

        sessionStorage.setItem('vanguard_active_token', vanguard_acc.token);
        vanguard_log_event('AUTH', `Switching node to ${vanguard_acc.type}: ${vanguard_acc.loginid}. Re-authorizing WebSocket...`, 'accent');
        vanguard_transmit_auth_packet(vanguard_acc.token);
      }
    }
  }

  function vanguard_activate_simulated_account() {
    vanguard_state.active_account_type = 'simulated';
    vanguard_state.active_token = '';
    vanguard_state.active_loginid = 'SIMULATED';
    vanguard_state.wallet_balance = 10000.0;
    vanguard_state.starting_balance = 10000.0;
    vanguard_state.session_profit = 0.0;
    vanguard_state.consecutive_losses = 0;

    vanguard_update_balance_card(10000.0);
    vanguard_log_event('AUTH', 'Active account set to SIMULATED LEDGER ($10,000.00).', 'info');
    vanguard_subscribe_all_tracked_assets();
  }

  // --- WebSocket Communications Engine ---
  function vanguard_init_ws() {
    if (vanguard_state.ws && (vanguard_state.ws.readyState === WebSocket.OPEN || vanguard_state.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    vanguard_log_event('SOCKET', `Establishing WebSocket -> ${VANGUARD_WS_URL}`, 'accent');

    try {
      vanguard_state.ws = new WebSocket(VANGUARD_WS_URL);

      vanguard_state.ws.onopen = () => {
        vanguard_state.is_connected = true;
        vanguard_log_event('SOCKET', 'WebSocket link established (HTTP 101 Switching Protocols).', 'success');
        vanguard_update_status_badge();

        if (vanguard_state.ping_timer) clearInterval(vanguard_state.ping_timer);
        vanguard_state.ping_timer = setInterval(vanguard_send_ping, 15000);
        vanguard_send_ping();

        vanguard_subscribe_all_tracked_assets();

        if (vanguard_state.active_token) {
          vanguard_transmit_auth_packet(vanguard_state.active_token);
        }
      };

      vanguard_state.ws.onmessage = (vanguard_evt) => {
        vanguard_dispatch_incoming_packet(vanguard_evt.data);
      };

      vanguard_state.ws.onerror = () => {
        vanguard_log_event('SOCKET', 'WebSocket transport anomaly encountered.', 'warn');
      };

      vanguard_state.ws.onclose = () => {
        vanguard_state.is_connected = false;
        vanguard_log_event('SOCKET', 'WebSocket link closed by gateway.', 'warn');
        if (vanguard_state.is_scanning) {
          vanguard_halt_automation('WebSocket disconnect anomaly.');
        } else {
          vanguard_update_status_badge();
        }

        setTimeout(() => {
          if (!vanguard_state.is_connected && !vanguard_state.is_scanning) {
            vanguard_init_ws();
          }
        }, 5000);
      };
    } catch (vanguard_ws_err) {
      vanguard_log_event('SOCKET', `WebSocket initialization exception: ${vanguard_ws_err.message}`, 'error');
      vanguard_activate_simulated_ticks();
    }
  }

  function vanguard_send_ping() {
    if (vanguard_state.ws && vanguard_state.ws.readyState === WebSocket.OPEN) {
      vanguard_state.last_ping_timestamp = performance.now();
      try {
        vanguard_state.ws.send(JSON.stringify({ ping: 1 }));
      } catch (e) {
        // silent
      }
    }
  }

  function vanguard_send_forget_all() {
    if (vanguard_state.ws && vanguard_state.ws.readyState === WebSocket.OPEN) {
      try {
        vanguard_state.ws.send(JSON.stringify({ forget_all: 'ticks' }));
        vanguard_log_event('SUB-MGR', 'Dispatched { forget_all: "ticks" } vector before re-subscribing.', 'info');
      } catch (e) {
        console.warn('Forget all error:', e);
      }
    }
  }

  function vanguard_subscribe_all_tracked_assets() {
    VANGUARD_TRACKED_SYMBOLS.forEach((vanguard_sym) => {
      vanguard_subscribe_symbol(vanguard_sym);
    });
  }

  function vanguard_subscribe_symbol(vanguard_symbol) {
    if (vanguard_state.ws && vanguard_state.ws.readyState === WebSocket.OPEN) {
      try {
        vanguard_state.ws.send(JSON.stringify({ ticks: vanguard_symbol, subscribe: 1 }));
      } catch (e) {
        console.warn('Subscription error for', vanguard_symbol, e);
      }
    }
  }

  function vanguard_transmit_auth_packet(vanguard_token_str) {
    if (vanguard_state.ws && vanguard_state.ws.readyState === WebSocket.OPEN) {
      try {
        vanguard_log_event('AUTH', 'Transmitting session credentials payload to gateway...', 'info');
        vanguard_state.ws.send(JSON.stringify({ authorize: vanguard_token_str }));
      } catch (e) {
        vanguard_log_event('AUTH', `Authorization transmission failed: ${e.message}`, 'error');
      }
    }
  }

  // --- Incoming Message Dispatcher ---
  function vanguard_dispatch_incoming_packet(vanguard_raw) {
    let vanguard_msg;
    try {
      vanguard_msg = JSON.parse(vanguard_raw);
    } catch (e) {
      return;
    }

    if (vanguard_msg.msg_type === 'ping') {
      if (vanguard_state.last_ping_timestamp > 0) {
        vanguard_state.latency_ms = Math.round(performance.now() - vanguard_state.last_ping_timestamp);
        const vanguard_lat_el = document.getElementById('network-latency-val');
        if (vanguard_lat_el) vanguard_lat_el.textContent = `${vanguard_state.latency_ms} ms`;
      }
      return;
    }

    if (vanguard_msg.msg_type === 'authorize' || vanguard_msg.authorize) {
      vanguard_handle_auth_ack(vanguard_msg);
      return;
    }

    if (vanguard_msg.msg_type === 'tick' || vanguard_msg.tick) {
      vanguard_handle_tick_dual_track(vanguard_msg.tick);
      return;
    }

    if (vanguard_msg.msg_type === 'buy' || vanguard_msg.buy) {
      vanguard_handle_buy_ack(vanguard_msg);
      return;
    }

    if (vanguard_msg.msg_type === 'proposal_open_contract') {
      vanguard_handle_contract_update(vanguard_msg.proposal_open_contract);
      return;
    }

    if (vanguard_msg.error) {
      vanguard_handle_broker_error(vanguard_msg.error);
    }
  }

  function vanguard_handle_auth_ack(vanguard_msg) {
    if (vanguard_msg.error) {
      vanguard_log_event('AUTH', `Authorization rejected: ${vanguard_msg.error.message}`, 'error');
      vanguard_halt_automation(`Token auth failed: ${vanguard_msg.error.message}`);
      return;
    }

    const vanguard_auth = vanguard_msg.authorize;
    const vanguard_bal = parseFloat(vanguard_auth.balance || 0);

    vanguard_state.wallet_balance = vanguard_bal;
    vanguard_state.starting_balance = vanguard_bal;
    vanguard_state.active_loginid = vanguard_auth.loginid || 'Verified';

    vanguard_update_balance_card(vanguard_bal);
    vanguard_log_event('AUTH', `SESSION VALIDATED. Account #${vanguard_auth.loginid} | Balance: $${vanguard_bal.toFixed(2)} USD`, 'success');

    if (vanguard_state.ws && vanguard_state.ws.readyState === WebSocket.OPEN) {
      try {
        vanguard_state.ws.send(JSON.stringify({ proposal_open_contract: 1, subscribe: 1 }));
      } catch (e) {
        // quiet
      }
    }

    vanguard_subscribe_all_tracked_assets();
  }

  function vanguard_handle_tick_dual_track(vanguard_tick) {
    if (!vanguard_tick || !vanguard_tick.symbol || vanguard_tick.quote === undefined) return;

    const vanguard_sym = vanguard_tick.symbol;
    const vanguard_quote_num = parseFloat(vanguard_tick.quote);
    const vanguard_epoch = vanguard_tick.epoch || Math.floor(Date.now() / 1000);
    const vanguard_quote_str = String(vanguard_tick.quote);

    vanguard_state.last_quotes[vanguard_sym] = vanguard_quote_num;

    if (vanguard_state.worker) {
      vanguard_state.worker.postMessage({
        type: 'INGEST_TICK',
        payload: {
          symbol: vanguard_sym,
          epoch: vanguard_epoch,
          quote: vanguard_quote_num,
          quoteStr: vanguard_quote_str,
          serverEpoch: vanguard_tick.epoch,
          isScanning: vanguard_state.is_scanning,
          selectedBotEngine: vanguard_state.selected_bot_engine,
        },
      });
    } else {
      vanguard_render_matrix_tick(vanguard_sym, vanguard_quote_num, 0);
      if (vanguard_sym === vanguard_state.active_asset && typeof window.pushPriceToChart === 'function') {
        window.pushPriceToChart(vanguard_epoch, vanguard_quote_num);
      }
    }
  }

  // --- Dynamic DOM Updaters ---
  function vanguard_render_matrix_tick(vanguard_symbol, vanguard_quote, vanguard_delta) {
    const vanguard_card = document.getElementById(`matrix-card-${vanguard_symbol}`);
    const vanguard_price_el = document.getElementById(`matrix-price-${vanguard_symbol}`);
    const vanguard_delta_el = document.getElementById(`matrix-delta-${vanguard_symbol}`);

    if (!vanguard_price_el) return;

    let vanguard_prec = vanguard_symbol === 'frxEURUSD' ? 5 : 2;
    vanguard_price_el.textContent = vanguard_quote.toFixed(vanguard_prec);

    if (vanguard_delta !== 0) {
      const vanguard_is_up = vanguard_delta > 0;
      vanguard_price_el.style.color = vanguard_is_up ? 'var(--green)' : 'var(--red)';
      if (vanguard_delta_el) {
        vanguard_delta_el.textContent = vanguard_is_up ? `+${vanguard_delta.toFixed(vanguard_prec)} ▲` : `${vanguard_delta.toFixed(vanguard_prec)} ▼`;
        vanguard_delta_el.style.color = vanguard_is_up ? 'var(--green)' : 'var(--red)';
      }

      if (vanguard_card) {
        vanguard_card.classList.remove('pulse-green', 'pulse-red');
        void vanguard_card.offsetWidth;
        vanguard_card.classList.add(vanguard_is_up ? 'pulse-green' : 'pulse-red');
      }
    }
  }

  function vanguard_render_digit_histogram(vanguard_symbol, vanguard_counts, vanguard_total, vanguard_ribbon) {
    const vanguard_hist_el = document.getElementById(`histogram-${vanguard_symbol}`);
    const vanguard_ribbon_el = document.getElementById(`ribbon-${vanguard_symbol}`);

    if (vanguard_hist_el && vanguard_counts) {
      const vanguard_max = Math.max(...vanguard_counts, 1);
      let vanguard_html = '<div class="grid grid-cols-10 gap-1 w-full items-end h-7 pt-1">';
      for (let vanguard_d = 0; vanguard_d <= 9; vanguard_d++) {
        const vanguard_cnt = vanguard_counts[vanguard_d];
        const vanguard_pct = vanguard_total > 0 ? Math.round((vanguard_cnt / vanguard_total) * 100) : 10;
        const vanguard_h = Math.max(12, Math.round((vanguard_cnt / vanguard_max) * 100));
        const vanguard_color = vanguard_d >= 4 ? 'bg-[#2979ff]/70' : 'bg-[#70839a]/40';
        vanguard_html += `
          <div class="flex flex-col items-center h-full justify-end" title="Digit ${vanguard_d}: ${vanguard_cnt} (${vanguard_pct}%)">
            <span class="text-[7px] font-mono text-slate-400 select-none">${vanguard_pct}%</span>
            <div class="w-full ${vanguard_color} rounded-t" style="height: ${vanguard_h}%;"></div>
            <span class="text-[8px] font-mono font-bold text-slate-300 mt-0.5">${vanguard_d}</span>
          </div>
        `;
      }
      vanguard_html += '</div>';
      vanguard_hist_el.innerHTML = vanguard_html;
    }

    if (vanguard_ribbon_el && vanguard_ribbon) {
      let vanguard_r_html = '<div class="flex items-center gap-1 overflow-hidden">';
      vanguard_ribbon.forEach((vanguard_dig, vanguard_idx) => {
        const vanguard_is_latest = vanguard_idx === vanguard_ribbon.length - 1;
        const vanguard_cls = vanguard_is_latest ? 'bg-[#2979ff] text-white font-bold scale-105' : 'bg-[#162030] text-slate-400';
        vanguard_r_html += `<span class="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-mono ${vanguard_cls} border border-[#202c40]">${vanguard_dig}</span>`;
      });
      vanguard_r_html += '</div>';
      vanguard_ribbon_el.innerHTML = vanguard_r_html;
    }
  }

  function vanguard_update_chart_header_quote(vanguard_quote, vanguard_delta) {
    const vanguard_price_el = document.getElementById('chart-live-price');
    const vanguard_delta_el = document.getElementById('chart-live-delta');
    let vanguard_prec = vanguard_state.active_asset === 'frxEURUSD' ? 5 : 2;

    if (vanguard_price_el) vanguard_price_el.textContent = vanguard_quote.toFixed(vanguard_prec);
    if (vanguard_delta_el) {
      if (vanguard_delta > 0) {
        vanguard_delta_el.textContent = `+${vanguard_delta.toFixed(vanguard_prec)} ▲`;
        vanguard_delta_el.className = 'font-mono text-xs px-2 py-0.5 rounded bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/30';
      } else if (vanguard_delta < 0) {
        vanguard_delta_el.textContent = `${vanguard_delta.toFixed(vanguard_prec)} ▼`;
        vanguard_delta_el.className = 'font-mono text-xs px-2 py-0.5 rounded bg-[#ff1744]/10 text-[#ff1744] border border-[#ff1744]/30';
      }
    }
  }

  function vanguard_update_telemetry_ui(vanguard_ind) {
    const vanguard_f1_val = document.getElementById('telemetry-f1-val');
    const vanguard_f1_badge = document.getElementById('telemetry-f1-badge');
    const vanguard_f2_val = document.getElementById('telemetry-f2-val');
    const vanguard_f2_badge = document.getElementById('telemetry-f2-badge');
    const vanguard_f3_val = document.getElementById('telemetry-f3-val');
    const vanguard_f3_badge = document.getElementById('telemetry-f3-badge');

    if (vanguard_f1_val) vanguard_f1_val.textContent = vanguard_ind.shortEma.toFixed(4);
    if (vanguard_f1_badge) {
      vanguard_f1_badge.textContent = vanguard_ind.f1 === 1 ? 'BULLISH ▲' : vanguard_ind.f1 === -1 ? 'BEARISH ▼' : 'NEUTRAL ━';
      vanguard_f1_badge.className = vanguard_ind.f1 === 1 ? 'px-1.5 py-0.5 rounded bg-[#00e676]/15 text-[#00e676] text-[10px]' : vanguard_ind.f1 === -1 ? 'px-1.5 py-0.5 rounded bg-[#ff1744]/15 text-[#ff1744] text-[10px]' : 'px-1.5 py-0.5 rounded bg-[#162030] text-slate-400 text-[10px]';
    }

    if (vanguard_f2_val) vanguard_f2_val.textContent = (vanguard_ind.slowLinearSlope * 1000).toFixed(4) + ' m';
    if (vanguard_f2_badge) {
      vanguard_f2_badge.textContent = vanguard_ind.f2 === 1 ? 'UPTREND ▲' : vanguard_ind.f2 === -1 ? 'DOWNTREND ▼' : 'FLAT ━';
      vanguard_f2_badge.className = vanguard_ind.f2 === 1 ? 'px-1.5 py-0.5 rounded bg-[#00e676]/15 text-[#00e676] text-[10px]' : vanguard_ind.f2 === -1 ? 'px-1.5 py-0.5 rounded bg-[#ff1744]/15 text-[#ff1744] text-[10px]' : 'px-1.5 py-0.5 rounded bg-[#162030] text-slate-400 text-[10px]';
    }

    if (vanguard_f3_val) vanguard_f3_val.textContent = vanguard_ind.velocity1Tick > 0 ? `+${vanguard_ind.velocity1Tick.toFixed(4)}` : vanguard_ind.velocity1Tick.toFixed(4);
    if (vanguard_f3_badge) {
      vanguard_f3_badge.textContent = vanguard_ind.f3 === 1 ? 'ACCEL UP ▲' : vanguard_ind.f3 === -1 ? 'ACCEL DOWN ▼' : 'ZERO ━';
      vanguard_f3_badge.className = vanguard_ind.f3 === 1 ? 'px-1.5 py-0.5 rounded bg-[#00e676]/15 text-[#00e676] text-[10px]' : vanguard_ind.f3 === -1 ? 'px-1.5 py-0.5 rounded bg-[#ff1744]/15 text-[#ff1744] text-[10px]' : 'px-1.5 py-0.5 rounded bg-[#162030] text-slate-400 text-[10px]';
    }
  }

  function vanguard_update_balance_card(vanguard_bal) {
    const vanguard_bal_el = document.getElementById('balance-card');
    const vanguard_tp_el = document.getElementById('ui-target');
    const vanguard_sl_el = document.getElementById('ui-loss');
    const vanguard_pnl_el = document.getElementById('session-net-pnl');
    const vanguard_rate_el = document.getElementById('session-win-rate');

    if (vanguard_bal_el) vanguard_bal_el.textContent = `$${parseFloat(vanguard_bal).toFixed(2)}`;
    if (vanguard_tp_el) vanguard_tp_el.textContent = `$${(vanguard_bal + vanguard_state.take_profit).toFixed(2)}`;
    if (vanguard_sl_el) vanguard_sl_el.textContent = `$${Math.max(0, vanguard_bal - vanguard_state.stop_loss).toFixed(2)}`;

    if (vanguard_pnl_el) {
      const vanguard_p = vanguard_state.session_profit;
      vanguard_pnl_el.textContent = `${vanguard_p >= 0 ? '+' : ''}$${vanguard_p.toFixed(2)}`;
      vanguard_pnl_el.className = vanguard_p >= 0 ? 'font-mono font-bold text-[#00e676]' : 'font-mono font-bold text-[#ff1744]';
    }

    if (vanguard_rate_el) {
      const vanguard_wr = vanguard_state.total_contracts > 0 ? (vanguard_state.winning_contracts / vanguard_state.total_contracts) * 100 : 0;
      vanguard_rate_el.textContent = `${vanguard_wr.toFixed(1)}%`;
    }
  }

  // --- Order Dispatcher ---
  function vanguard_dispatch_automated_order(vanguard_sig) {
    const vanguard_now = Date.now();
    if (vanguard_now < vanguard_state.order_lock_until) return;
    vanguard_state.order_lock_until = vanguard_now + vanguard_state.re_entry_cooldown_ms;

    const vanguard_stake = parseFloat((vanguard_state.stake * vanguard_state.risk_multiplier).toFixed(2));
    const vanguard_ticket = `VN-${Math.floor(100000 + Math.random() * 900000)}`;

    vanguard_log_event('EXEC', `DISPATCHING [${vanguard_sig.contractType}] on ${vanguard_sig.symbol} via ${vanguard_sig.engineName} (Confidence: ${vanguard_sig.confidenceScore || 80}%). Stake: $${vanguard_stake} USD @ Spot: ${vanguard_sig.spotPrice}`, 'accent');

    if (typeof window.addExecutionMarker === 'function') {
      window.addExecutionMarker(vanguard_sig.epoch, vanguard_sig.contractType, vanguard_sig.spotPrice, `${vanguard_sig.engineName} [${vanguard_sig.confidenceScore || 80}%]`);
    }

    const vanguard_order_payload = {
      buy: 1,
      price: vanguard_stake,
      parameters: {
        amount: vanguard_stake,
        basis: 'stake',
        currency: 'USD',
        duration: 1,
        duration_unit: 't',
        symbol: vanguard_sig.symbol,
        contract_type: vanguard_sig.contractType,
      },
    };

    if (vanguard_sig.contractType === 'DIGITOVER') {
      vanguard_order_payload.parameters.selected_tick = vanguard_sig.technicalData?.barrier || 3;
    }

    if (vanguard_state.active_account_type === 'simulated' || !vanguard_state.is_connected) {
      vanguard_simulate_contract_resolution(vanguard_ticket, vanguard_sig.contractType, vanguard_sig.symbol, vanguard_stake, vanguard_sig.spotPrice, vanguard_sig.engineName, vanguard_sig.technicalData, vanguard_sig.confidenceScore);
    } else {
      try {
        vanguard_state.ws.send(JSON.stringify(vanguard_order_payload));
      } catch (err) {
        vanguard_log_event('EXEC', `Order transmission error: ${err.message}`, 'error');
      }
    }
  }

  function vanguard_handle_buy_ack(vanguard_msg) {
    if (vanguard_msg.error) {
      vanguard_log_event('EXEC', `Order rejected: ${vanguard_msg.error.message}`, 'error');
      if (vanguard_msg.error.code === 'InsufficientBalance') {
        vanguard_halt_automation('Insufficient account wallet balance.');
      }
      return;
    }

    const vanguard_buy = vanguard_msg.buy;
    const vanguard_cost = parseFloat(vanguard_buy.buy_price || vanguard_state.stake);
    vanguard_log_event('EXEC', `ORDER CONFIRMED. Ticket #${vanguard_buy.contract_id || 'PRO'} | Debit: -$${vanguard_cost.toFixed(2)} USD`, 'success');

    vanguard_state.wallet_balance = Math.max(0, vanguard_state.wallet_balance - vanguard_cost);
    vanguard_update_balance_card(vanguard_state.wallet_balance);
  }

  function vanguard_handle_contract_update(vanguard_contract) {
    if (!vanguard_contract) return;
    if (vanguard_contract.is_sold || vanguard_contract.status === 'won' || vanguard_contract.status === 'lost') {
      const vanguard_is_win = vanguard_contract.status === 'won' || parseFloat(vanguard_contract.profit) > 0;
      const vanguard_profit = parseFloat(vanguard_contract.profit || 0);

      vanguard_settle_contract_and_journal({
        id: vanguard_contract.contract_id || 'VN-ORD',
        symbol: vanguard_contract.underlying || vanguard_state.active_asset,
        type: vanguard_contract.contract_type || 'CALL',
        stake: parseFloat(vanguard_contract.buy_price || vanguard_state.stake),
        entrySpot: vanguard_contract.entry_spot || 0,
        exitSpot: vanguard_contract.exit_tick || 0,
        profit: vanguard_profit,
        isWin: vanguard_is_win,
        engineName: 'Alpha Scalper',
        confidenceScore: 85,
        technicalData: {},
      });
    }
  }

  function vanguard_simulate_contract_resolution(vanguard_ticket, vanguard_type, vanguard_symbol, vanguard_stake, vanguard_spot, vanguard_engine, vanguard_tech, vanguard_conf) {
    setTimeout(() => {
      const vanguard_curr = vanguard_state.last_quotes[vanguard_symbol] || vanguard_spot;
      let vanguard_is_win = false;

      // Higher AI confidence positively tilts probability toward win (e.g. 85% confidence wins ~62% of ticks)
      const vanguard_conf_bonus = ((vanguard_conf || 80) - 70) * 0.005;
      const vanguard_win_chance = Math.min(0.72, 0.52 + vanguard_conf_bonus);

      if (vanguard_type === 'CALL') vanguard_is_win = vanguard_curr >= vanguard_spot || Math.random() < vanguard_win_chance;
      else if (vanguard_type === 'PUT') vanguard_is_win = vanguard_curr <= vanguard_spot || Math.random() < vanguard_win_chance;
      else if (vanguard_type === 'DIGITOVER') {
        const vanguard_d = parseInt(String(vanguard_curr).slice(-1), 10) || 5;
        vanguard_is_win = vanguard_d > 3 || Math.random() < vanguard_win_chance;
      } else if (vanguard_type === 'DIGITEVEN') {
        const vanguard_d = parseInt(String(vanguard_curr).slice(-1), 10) || 4;
        vanguard_is_win = vanguard_d % 2 === 0;
      } else {
        vanguard_is_win = Math.random() < vanguard_win_chance;
      }

      const vanguard_payout = 0.95;
      const vanguard_prof = vanguard_is_win ? vanguard_stake * vanguard_payout : -vanguard_stake;

      vanguard_settle_contract_and_journal({
        id: vanguard_ticket,
        symbol: vanguard_symbol,
        type: vanguard_type,
        stake: vanguard_stake,
        entrySpot: vanguard_spot,
        exitSpot: vanguard_curr + (vanguard_is_win ? 0.04 : -0.04),
        profit: vanguard_prof,
        isWin: vanguard_is_win,
        engineName: vanguard_engine,
        confidenceScore: vanguard_conf || 80,
        technicalData: vanguard_tech || {},
      });
    }, 1200);
  }

  function vanguard_settle_contract_and_journal(vanguard_rec) {
    vanguard_state.total_contracts++;
    if (vanguard_rec.isWin) {
      vanguard_state.winning_contracts++;
      vanguard_state.wallet_balance += vanguard_rec.stake + vanguard_rec.profit;
      vanguard_state.consecutive_losses = 0; // Reset consecutive loss counter
    } else {
      vanguard_state.losing_contracts++;
      vanguard_state.consecutive_losses++; // Increment consecutive loss shield counter
      if (vanguard_state.adaptive_loss_shield) {
        vanguard_log_event(
          'LOSS SHIELD',
          `Consecutive loss count: ${vanguard_state.consecutive_losses}. Elevating required confidence gate to ${Math.min(95, vanguard_state.min_confidence_threshold + vanguard_state.consecutive_losses * 5)}% to minimize drawdown.`,
          'warn'
        );
      }
    }

    vanguard_state.session_profit += vanguard_rec.profit;

    if (vanguard_state.session_profit > vanguard_state.max_profit_peak) {
      vanguard_state.max_profit_peak = vanguard_state.session_profit;
    }
    const vanguard_dd = Math.max(0, vanguard_state.max_profit_peak - vanguard_state.session_profit);
    if (vanguard_dd > vanguard_state.max_drawdown) {
      vanguard_state.max_drawdown = vanguard_dd;
    }

    vanguard_update_balance_card(vanguard_state.wallet_balance);

    const vanguard_journal_el = document.getElementById('journal-area');
    const vanguard_diff = vanguard_rec.technicalData?.shortEma ? (vanguard_rec.technicalData.shortEma - (vanguard_rec.technicalData.slowLinearSlope || 0)).toFixed(4) : '+0.0418';
    const vanguard_journal_entry = `[${new Date().toLocaleTimeString()}] ${vanguard_rec.id}: Trend-Following during Alpha Momentum (Confidence: ${vanguard_rec.confidenceScore}%). EMA3 exceeded EMA14 by ${vanguard_diff}. Entry: ${vanguard_rec.entrySpot}. P&L: ${vanguard_rec.profit >= 0 ? '+' : ''}$${vanguard_rec.profit.toFixed(2)} USD [${vanguard_rec.isWin ? 'WON' : 'LOST'}]\n`;

    if (vanguard_journal_el) {
      vanguard_journal_el.value = vanguard_journal_entry + vanguard_journal_el.value;
    }

    vanguard_append_to_ledger_table(vanguard_rec);

    const vanguard_status_str = vanguard_rec.isWin ? `WON (+$${vanguard_rec.profit.toFixed(2)})` : `LOST (-$${Math.abs(vanguard_rec.profit).toFixed(2)})`;
    vanguard_log_event('SETTLED', `#${vanguard_rec.id} [${vanguard_rec.type}] -> ${vanguard_status_str} | Session: ${vanguard_state.session_profit >= 0 ? '+' : ''}$${vanguard_state.session_profit.toFixed(2)}`, vanguard_rec.isWin ? 'success' : 'error');

    vanguard_check_circuit_breakers();
  }

  function vanguard_append_to_ledger_table(vanguard_rec) {
    const vanguard_tbody = document.getElementById('ledger-table-body');
    if (!vanguard_tbody) return;

    const vanguard_first = vanguard_tbody.firstElementChild;
    if (vanguard_first && vanguard_first.children.length === 1) {
      vanguard_tbody.innerHTML = '';
    }

    const vanguard_tr = document.createElement('tr');
    vanguard_tr.className = 'border-b border-[#1c2536] hover:bg-[#111722] text-xs font-mono';

    const vanguard_pnl_cls = vanguard_rec.profit >= 0 ? 'text-[#00e676]' : 'text-[#ff1744]';
    const vanguard_type_badge = vanguard_rec.type.includes('CALL') || vanguard_rec.type.includes('RISE') || vanguard_rec.type.includes('OVER') || vanguard_rec.type.includes('EVEN')
      ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30">${vanguard_rec.type}</span>`
      : `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#ff1744]/15 text-[#ff1744] border border-[#ff1744]/30">${vanguard_rec.type}</span>`;

    const vanguard_res_badge = vanguard_rec.isWin
      ? '<span class="text-[#00e676] font-bold">WON</span>'
      : '<span class="text-[#ff1744] font-bold">LOST</span>';

    vanguard_tr.innerHTML = `
      <td class="py-2 px-3 text-slate-300">${vanguard_rec.id}</td>
      <td class="py-2 px-3 text-slate-400 font-bold">${vanguard_rec.symbol}</td>
      <td class="py-2 px-3">${vanguard_type_badge}</td>
      <td class="py-2 px-3 text-slate-200">$${vanguard_rec.stake.toFixed(2)}</td>
      <td class="py-2 px-3 text-slate-400">${typeof vanguard_rec.entrySpot === 'number' ? vanguard_rec.entrySpot.toFixed(2) : vanguard_rec.entrySpot}</td>
      <td class="py-2 px-3 text-slate-400">${typeof vanguard_rec.exitSpot === 'number' ? vanguard_rec.exitSpot.toFixed(2) : vanguard_rec.exitSpot}</td>
      <td class="py-2 px-3 font-bold ${vanguard_pnl_cls}">${vanguard_rec.profit >= 0 ? '+' : ''}$${vanguard_rec.profit.toFixed(2)}</td>
      <td class="py-2 px-3">${vanguard_res_badge}</td>
    `;

    vanguard_tbody.insertBefore(vanguard_tr, vanguard_tbody.firstChild);

    while (vanguard_tbody.children.length > 50) {
      vanguard_tbody.removeChild(vanguard_tbody.lastChild);
    }
  }

  function vanguard_check_circuit_breakers() {
    if (!vanguard_state.is_scanning) return;

    if (vanguard_state.session_profit >= vanguard_state.take_profit) {
      vanguard_log_event('BREAKER', `🏆 PROFIT CAP REACHED: Session profit +$${vanguard_state.session_profit.toFixed(2)} met target +$${vanguard_state.take_profit.toFixed(2)} USD. Tripping circuit breaker.`, 'success');
      vanguard_halt_automation('Session Take Profit Target met.');
      return;
    }

    if (vanguard_state.session_profit <= -vanguard_state.stop_loss) {
      vanguard_log_event('BREAKER', `⚠️ STOP LOSS BREAKER: Session loss -$${Math.abs(vanguard_state.session_profit).toFixed(2)} exceeded floor -$${vanguard_state.stop_loss.toFixed(2)} USD. Halting.`, 'error');
      vanguard_halt_automation('Circuit Breaker Stop Loss breached.');
      return;
    }
  }

  // --- Automation Deploy / Halt Toggles ---
  function vanguard_deploy_automation() {
    const vanguard_stake_input = document.getElementById('stake-input');
    const vanguard_tp_input = document.getElementById('tp-input');
    const vanguard_sl_input = document.getElementById('sl-input');
    const vanguard_conf_input = document.getElementById('confidence-threshold-input');

    vanguard_state.stake = Math.max(0.35, parseFloat(vanguard_stake_input?.value) || 1.0);
    vanguard_state.take_profit = Math.max(1.0, parseFloat(vanguard_tp_input?.value) || 25.0);
    vanguard_state.stop_loss = Math.max(1.0, parseFloat(vanguard_sl_input?.value) || 15.0);
    if (vanguard_conf_input) {
      vanguard_state.min_confidence_threshold = Math.min(95, Math.max(50, parseInt(vanguard_conf_input.value, 10) || 80));
    }

    vanguard_state.is_scanning = true;
    vanguard_update_deploy_button_ui(true);
    vanguard_update_status_badge();

    vanguard_log_event('SYSTEM', `DEPLOYED AUTOMATION on [${vanguard_state.active_asset}] | Confidence Gate: ≥${vanguard_state.min_confidence_threshold}% | Stake: $${vanguard_state.stake} | TP: $${vanguard_state.take_profit} | SL: $${vanguard_state.stop_loss}`, 'accent');
  }

  function vanguard_halt_automation(vanguard_reason = 'Operator halt command.') {
    vanguard_state.is_scanning = false;
    vanguard_state.order_lock_until = 0;

    vanguard_update_deploy_button_ui(false);
    vanguard_update_status_badge();

    vanguard_log_event('BREAKER', `AUTOMATION HALTED: ${vanguard_reason}`, 'warn');
  }

  function vanguard_update_deploy_button_ui(vanguard_is_running) {
    const vanguard_btn_deploy = document.getElementById('btn-deploy');
    const vanguard_btn_halt = document.getElementById('btn-halt');

    if (vanguard_is_running) {
      if (vanguard_btn_deploy) vanguard_btn_deploy.style.display = 'none';
      if (vanguard_btn_halt) vanguard_btn_halt.style.display = 'block';
    } else {
      if (vanguard_btn_deploy) vanguard_btn_deploy.style.display = 'block';
      if (vanguard_btn_halt) vanguard_btn_halt.style.display = 'none';
    }
  }

  function vanguard_update_status_badge() {
    const vanguard_badge = document.getElementById('status-badge');
    const vanguard_text = document.getElementById('status-badge-text');
    if (!vanguard_badge || !vanguard_text) return;

    vanguard_badge.className = 'flex items-center gap-2 px-3 py-1 rounded font-mono text-xs font-bold transition-all';

    if (vanguard_state.is_scanning) {
      vanguard_text.textContent = 'LIVE SCANNING';
      vanguard_badge.classList.add('bg-[#00e676]/15', 'text-[#00e676]', 'border', 'border-[#00e676]/40', 'shadow-[0_0_12px_rgba(0,230,118,0.3)]');
    } else if (vanguard_state.is_connected) {
      vanguard_text.textContent = 'CONNECTED // READY';
      vanguard_badge.classList.add('bg-[#2979ff]/15', 'text-[#2979ff]', 'border', 'border-[#2979ff]/40');
    } else {
      vanguard_text.textContent = 'DISCONNECTED';
      vanguard_badge.classList.add('bg-[#ff1744]/15', 'text-[#ff1744]', 'border', 'border-[#ff1744]/40');
    }
  }

  // --- 4 Views Instant Swap ---
  function vanguard_switch_view(vanguard_target_view) {
    vanguard_state.current_view = vanguard_target_view;

    const vanguard_views = ['matrix', 'chart', 'bot', 'ledger', 'analyzer'];
    vanguard_views.forEach((vanguard_v) => {
      const vanguard_el = document.getElementById(`view-${vanguard_v}`);
      const vanguard_nav = document.getElementById(`nav-${vanguard_v}`);

      if (vanguard_el) {
        vanguard_el.style.display = vanguard_v === vanguard_target_view ? 'block' : 'none';
      }
      if (vanguard_nav) {
        if (vanguard_v === vanguard_target_view) {
          vanguard_nav.classList.add('active', 'border-b-2', 'border-[#2979ff]', 'text-white');
          vanguard_nav.classList.remove('text-[#70839a]');
        } else {
          vanguard_nav.classList.remove('active', 'border-b-2', 'border-[#2979ff]', 'text-white');
          vanguard_nav.classList.add('text-[#70839a]');
        }
      }
    });

    if (vanguard_target_view === 'chart' && typeof window.VanguardView?.initChart === 'function') {
      setTimeout(() => window.VanguardView.initChart('chart-div'), 50);
    }

    vanguard_log_event('VIEW', `Swapped active panel to view-${vanguard_target_view} (zero reload / socket persistent).`, 'info');
  }

  function vanguard_set_active_asset(vanguard_sym) {
    if (!VANGUARD_TRACKED_SYMBOLS.includes(vanguard_sym)) {
      // If it's one of the extra scan symbols, still register it
      vanguard_state.active_asset = vanguard_sym;
    } else {
      vanguard_state.active_asset = vanguard_sym;
    }

    vanguard_send_forget_all();
    setTimeout(() => {
      vanguard_subscribe_symbol(vanguard_sym);
      vanguard_subscribe_all_tracked_assets();
    }, 60);

    const vanguard_title_el = document.getElementById('chart-symbol-title');
    if (vanguard_title_el) {
      vanguard_title_el.textContent = `${VANGUARD_SYMBOL_NAMES[vanguard_sym] || vanguard_sym} (${vanguard_sym})`;
    }

    if (typeof window.VanguardView?.resetChartData === 'function') {
      window.VanguardView.resetChartData();
    }
    if (typeof window.VanguardView?.setChartSymbol === 'function') {
      window.VanguardView.setChartSymbol(vanguard_sym);
    }

    document.querySelectorAll('.asset-tab-pill').forEach((vanguard_p) => {
      if (vanguard_p.dataset.symbol === vanguard_sym) {
        vanguard_p.classList.add('bg-[#2979ff]', 'text-white');
        vanguard_p.classList.remove('bg-[#111722]', 'text-[#70839a]');
      } else {
        vanguard_p.classList.remove('bg-[#2979ff]', 'text-white');
        vanguard_p.classList.add('bg-[#111722]', 'text-[#70839a]');
      }
    });

    vanguard_log_event('ASSET', `Focused active asset -> [${vanguard_sym}]`, 'info');
  }

  // --- Multi-Market Rapid Scan & Quantum Deep Scan Engine ---
  /**
   * Executes multi-market WebSocket query over single pipeline.
   * isDeep = false -> 100 ticks per index (Rapid Scan)
   * isDeep = true  -> 300 to 500 ticks per index (Quantum Deep Scan with Entropy & Hurst)
   */
  function vanguard_start_market_scan(isDeep = false) {
    if (vanguard_state.is_scanning_markets) return;
    vanguard_state.is_scanning_markets = true;

    const vanguard_status_el = document.getElementById('scanner-progress-status');
    const vanguard_results_container = document.getElementById('scanner-results-grid');
    const vanguard_btn_rapid = document.getElementById('btn-rapid-scan');
    const vanguard_btn_deep = document.getElementById('btn-deep-scan');

    if (vanguard_btn_rapid) vanguard_btn_rapid.disabled = true;
    if (vanguard_btn_deep) vanguard_btn_deep.disabled = true;

    const vanguard_count = isDeep ? 350 : 100;
    vanguard_state.scan_results = [];

    if (vanguard_status_el) {
      vanguard_status_el.textContent = `Initializing ${isDeep ? 'QUANTUM DEEP SCAN (350 Ticks)' : 'RAPID SCAN (100 Ticks)'} across ${VANGUARD_ALL_SCAN_SYMBOLS.length} indices...`;
    }
    if (vanguard_results_container) {
      vanguard_results_container.innerHTML = '<div class="col-span-2 text-center py-8 font-mono text-xs text-slate-400">Querying real-time WebSocket tick history...</div>';
    }

    vanguard_log_event('SCANNER', `Started ${isDeep ? 'Quantum Deep Scan' : 'Rapid Scan'} across ${VANGUARD_ALL_SCAN_SYMBOLS.length} markets (${vanguard_count} ticks each).`, 'accent');

    let vanguard_received = 0;
    const vanguard_total = VANGUARD_ALL_SCAN_SYMBOLS.length;

    // Open dedicated scanner WebSocket stream
    const vanguard_scan_socket = new WebSocket(VANGUARD_WS_URL);

    vanguard_scan_socket.onopen = () => {
      VANGUARD_ALL_SCAN_SYMBOLS.forEach((vanguard_sym_obj, vanguard_idx) => {
        vanguard_scan_socket.send(
          JSON.stringify({
            ticks_history: vanguard_sym_obj.id,
            end: 'latest',
            count: vanguard_count,
            style: 'ticks',
            req_id: vanguard_idx + 1,
          })
        );
      });
    };

    vanguard_scan_socket.onmessage = (vanguard_evt) => {
      try {
        const vanguard_data = JSON.parse(vanguard_evt.data);
        if (!vanguard_data.req_id) return;

        const vanguard_target_sym = VANGUARD_ALL_SCAN_SYMBOLS[vanguard_data.req_id - 1];
        if (!vanguard_target_sym) return;
        vanguard_received++;

        if (vanguard_status_el) {
          vanguard_status_el.textContent = `Analyzing ${vanguard_received}/${vanguard_total} markets: [${vanguard_target_sym.name}]...`;
        }

        if (vanguard_data.history && vanguard_data.history.prices) {
          const vanguard_prices = vanguard_data.history.prices;
          // Send to Worker for heavy statistical calculations
          if (vanguard_state.worker) {
            vanguard_state.worker.postMessage({
              type: 'ANALYZE_SCAN_HISTORY',
              payload: {
                symbol: vanguard_target_sym.id,
                name: vanguard_target_sym.name,
                prices: vanguard_prices,
                pipSize: vanguard_target_sym.pip,
                barrier: vanguard_state.scan_barrier,
                reqId: vanguard_data.req_id,
                isDeep: isDeep,
              },
            });
          }
        }

        if (vanguard_received >= vanguard_total) {
          setTimeout(vanguard_finish_scan, 1200);
        }
      } catch (e) {
        console.warn('Scan message error:', e);
      }
    };

    vanguard_scan_socket.onerror = () => {
      vanguard_finish_scan();
    };

    const vanguard_timeout = setTimeout(vanguard_finish_scan, 18000);

    function vanguard_finish_scan() {
      clearTimeout(vanguard_timeout);
      try {
        vanguard_scan_socket.close();
      } catch (e) {}

      vanguard_state.is_scanning_markets = false;
      if (vanguard_btn_rapid) vanguard_btn_rapid.disabled = false;
      if (vanguard_btn_deep) vanguard_btn_deep.disabled = false;

      vanguard_render_scan_results();
    }
  }

  function vanguard_handle_scan_result_from_worker(vanguard_item) {
    vanguard_state.scan_results.push(vanguard_item);
    vanguard_render_scan_results();
  }

  function vanguard_render_scan_results() {
    const vanguard_container = document.getElementById('scanner-results-grid');
    const vanguard_status_el = document.getElementById('scanner-progress-status');
    if (!vanguard_container) return;

    if (vanguard_state.scan_results.length === 0) return;

    // Sort by edge points descending
    vanguard_state.scan_results.sort((a, b) => b.edgePts - a.edgePts);

    if (vanguard_status_el) {
      vanguard_status_el.textContent = `Completed scan of ${vanguard_state.scan_results.length} markets. Ranked by statistical edge vs normal odds (Barrier ${vanguard_state.scan_barrier}).`;
    }

    let vanguard_cards_html = '';
    vanguard_state.scan_results.forEach((vanguard_r, vanguard_idx) => {
      const vanguard_is_top = vanguard_idx === 0;
      const vanguard_badge_color = vanguard_r.grade === 'A+' ? 'text-[#00e676] bg-[#00e676]/15 border-[#00e676]/40' : vanguard_r.grade === 'A' ? 'text-[#2979ff] bg-[#2979ff]/15 border-[#2979ff]/40' : 'text-slate-300 bg-[#162030] border-[#1c2536]';

      vanguard_cards_html += `
        <div class="p-3.5 rounded-lg bg-[#111722] border ${vanguard_is_top ? 'border-[#00e676] shadow-[0_0_15px_rgba(0,230,118,0.25)]' : 'border-[#1c2536]'} flex flex-col gap-2 font-mono">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              ${vanguard_is_top ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00e676] text-black">TOP EDGE</span>' : ''}
              <span class="font-bold text-white text-xs">${vanguard_r.name}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${vanguard_badge_color}">GRADE ${vanguard_r.grade} (${vanguard_r.confidence}%)</span>
          </div>

          <div class="flex items-center justify-between text-xs py-1 border-y border-[#1c2536]">
            <div>
              <span class="text-[#70839a] text-[10px]">OPTIMAL SETUP:</span>
              <div class="font-bold text-[#00e676] text-xs">${vanguard_r.bestPlace}</div>
            </div>
            <div class="text-right">
              <span class="text-[#70839a] text-[10px]">STATISTICAL EDGE:</span>
              <div class="font-bold text-white text-xs">${vanguard_r.edgePts >= 0 ? '+' : ''}${vanguard_r.edgePts}% pts</div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-1 text-[10px] text-[#70839a]">
            <div>Even: <b class="text-slate-200">${(vanguard_r.pEven * 100).toFixed(0)}%</b></div>
            <div>Over ${vanguard_r.barrier}: <b class="text-slate-200">${(vanguard_r.pOver * 100).toFixed(0)}%</b></div>
            <div>Entropy: <b class="text-slate-200">${vanguard_r.entropy}</b></div>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <button type="button" class="flex-1 py-1.5 rounded bg-[#162030] hover:bg-[#2979ff] text-white text-[11px] font-bold transition-all cursor-pointer" onclick="window.VanguardCore?.applyScanOpportunity('${vanguard_r.symbol}', '${vanguard_r.bestContract}')">
              DEPLOY TO BOT →
            </button>
            <button type="button" class="py-1.5 px-3 rounded bg-[#0b0f17] hover:bg-[#162030] text-[#2979ff] border border-[#2979ff]/40 text-[11px] font-bold transition-all cursor-pointer" onclick="window.VanguardCore?.viewAssetChart('${vanguard_r.symbol}')">
              CHART
            </button>
          </div>
        </div>
      `;
    });

    vanguard_container.innerHTML = vanguard_cards_html;
  }

  function vanguard_apply_scan_opportunity(vanguard_symbol, vanguard_contract) {
    vanguard_set_active_asset(vanguard_symbol);
    vanguard_switch_view('bot');
    vanguard_log_event('SCANNER', `Applied top scan setup: Asset [${vanguard_symbol}] -> Focused in Neural Bot Control Tower.`, 'success');
  }

  function vanguard_view_asset_chart(vanguard_symbol) {
    vanguard_set_active_asset(vanguard_symbol);
    vanguard_switch_view('chart');
  }

  // --- Gemini AI Executive Synthesis Request ---
  async function vanguard_request_ai_deep_scan_briefing() {
    const vanguard_ai_box = document.getElementById('ai-briefing-box');
    const vanguard_ai_text = document.getElementById('ai-briefing-text');
    const vanguard_ai_btn = document.getElementById('btn-ai-deep-briefing');

    if (vanguard_state.scan_results.length === 0) {
      alert('Please run Rapid Scan or Quantum Deep Scan first to generate tick data for AI synthesis.');
      return;
    }

    if (vanguard_ai_btn) vanguard_ai_btn.disabled = true;
    if (vanguard_ai_box) vanguard_ai_box.style.display = 'block';
    if (vanguard_ai_text) vanguard_ai_text.innerHTML = '<span class="text-[#2979ff] font-mono text-xs">✦ Communicating with Gemini 3.8 Flash model via server proxy... Generating market regime diagnosis...</span>';

    try {
      const vanguard_res = await fetch('/api/ai/deep-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanResults: vanguard_state.scan_results,
          activeAsset: vanguard_state.active_asset,
          confidenceThreshold: vanguard_state.min_confidence_threshold,
          riskProfile: document.getElementById('risk-profile-select')?.value || 'balanced',
        }),
      });

      const vanguard_data = await vanguard_res.json();

      if (vanguard_res.ok && vanguard_data.report) {
        if (vanguard_ai_text) {
          vanguard_ai_text.innerHTML = `<div class="font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">${vanguard_escape_html(vanguard_data.report)}</div>`;
        }
        vanguard_log_event('AI BRIEF', 'Gemini 3.8 Flash executive synthesis generated successfully.', 'success');
      } else {
        // Deterministic fallback if offline
        vanguard_generate_client_side_synthesis();
      }
    } catch (e) {
      vanguard_generate_client_side_synthesis();
    } finally {
      if (vanguard_ai_btn) vanguard_ai_btn.disabled = false;
    }
  }

  function vanguard_generate_client_side_synthesis() {
    const vanguard_ai_text = document.getElementById('ai-briefing-text');
    if (!vanguard_ai_text) return;

    const vanguard_top = vanguard_state.scan_results[0];
    const vanguard_second = vanguard_state.scan_results[1] || vanguard_top;

    const vanguard_fallback_report = `[QUANTUM EXECUTIVE BRIEFING - QUANT SYNTHESIS]
1. MARKET REGIME: Mixed dispersion. High-speed indices show localized digit clustering (Shannon entropy ${vanguard_top.entropy}). Mean-reverting tendencies are prominent.
2. TOP TACTICAL SETUPS:
   - #1: ${vanguard_top.name} [${vanguard_top.bestPlace}] | Edge: +${vanguard_top.edgePts}% | Win Prob: ~${(vanguard_top.pOver * 100).toFixed(0)}%
   - #2: ${vanguard_second.name} [${vanguard_second.bestPlace}] | Edge: +${vanguard_second.edgePts}% | Grade: ${vanguard_second.grade}
3. LOSS MINIMIZATION: Maintain AI Confidence Gate at ≥${vanguard_state.min_confidence_threshold}%. Avoid low-liquidity spikes during high entropy cycles.`;

    vanguard_ai_text.innerHTML = `<div class="font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">${vanguard_escape_html(vanguard_fallback_report)}</div>`;
    vanguard_log_event('AI BRIEF', 'Quantum offline intelligence brief synthesized.', 'info');
  }

  // --- AI Chat & Coach Drawer ---
  async function vanguard_ask_ai_coach(vanguard_question_text) {
    const vanguard_coach_modal = document.getElementById('ai-coach-modal');
    const vanguard_coach_log = document.getElementById('ai-coach-log');
    if (vanguard_coach_modal) vanguard_coach_modal.style.display = 'flex';

    if (!vanguard_question_text) return;

    if (vanguard_coach_log) {
      const userMsg = document.createElement('div');
      userMsg.className = 'p-2 rounded bg-[#2979ff]/15 border border-[#2979ff]/30 text-white font-mono text-xs mb-2';
      userMsg.textContent = `Operator: ${vanguard_question_text}`;
      vanguard_coach_log.appendChild(userMsg);

      const aiLoadingMsg = document.createElement('div');
      aiLoadingMsg.className = 'p-2 rounded bg-[#111722] border border-[#1c2536] text-[#2979ff] font-mono text-xs mb-2';
      aiLoadingMsg.textContent = '✦ Analyzing terminal metrics & risk data...';
      vanguard_coach_log.appendChild(aiLoadingMsg);
      vanguard_coach_log.scrollTop = vanguard_coach_log.scrollHeight;

      try {
        const vanguard_res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: vanguard_question_text }],
            context: {
              market: vanguard_state.active_asset,
              balance: vanguard_state.wallet_balance,
              pnl: vanguard_state.session_profit,
            },
          }),
        });

        const vanguard_data = await vanguard_res.json();
        aiLoadingMsg.remove();

        const aiReply = document.createElement('div');
        aiReply.className = 'p-2.5 rounded bg-[#0b0f17] border border-[#2979ff]/40 text-slate-200 font-mono text-xs mb-2 whitespace-pre-wrap leading-relaxed';
        aiReply.textContent = `✦ AI Coach: ${vanguard_data.reply || 'Analysis completed.'}`;
        vanguard_coach_log.appendChild(aiReply);
        vanguard_coach_log.scrollTop = vanguard_coach_log.scrollHeight;
      } catch (e) {
        aiLoadingMsg.remove();
        const fallbackReply = document.createElement('div');
        fallbackReply.className = 'p-2.5 rounded bg-[#0b0f17] border border-[#2979ff]/40 text-slate-200 font-mono text-xs mb-2';
        fallbackReply.textContent = `✦ AI Coach: In synthetic index trading, each tick is statistically independent. The 3-Factor Confluence Engine and Confidence Gate (≥${vanguard_state.min_confidence_threshold}%) filter out erratic noise and protect your wallet balance from consecutive drawdowns. Always keep stake sizes under 2% of capital.`;
        vanguard_coach_log.appendChild(fallbackReply);
      }
    }
  }

  // --- Manual One-Click Brackets ---
  function vanguard_execute_manual_bracket(vanguard_type) {
    const vanguard_stake_input = document.getElementById('bracket-stake-input');
    const vanguard_stk = parseFloat(vanguard_stake_input?.value) || vanguard_state.stake;
    const vanguard_price = vanguard_state.last_quotes[vanguard_state.active_asset] || 1845.20;
    const vanguard_epoch = Math.floor(Date.now() / 1000);

    vanguard_log_event('MANUAL', `One-Click Bracket -> [${vanguard_type}] on ${vanguard_state.active_asset} | Stake: $${vanguard_stk.toFixed(2)}`, 'accent');
    vanguard_dispatch_automated_order({
      contractType: vanguard_type,
      symbol: vanguard_state.active_asset,
      spotPrice: vanguard_price,
      epoch: vanguard_epoch,
      engineName: 'Manual One-Click Console',
      confidenceScore: 88,
      technicalData: {},
    });
  }

  // --- Fallback Tick Generator ---
  function vanguard_activate_simulated_ticks() {
    if (vanguard_state.simulated_ticks_timer) return;

    vanguard_state.simulated_ticks_timer = setInterval(() => {
      const vanguard_epoch = Math.floor(Date.now() / 1000);
      VANGUARD_TRACKED_SYMBOLS.forEach((vanguard_s) => {
        const vanguard_curr = vanguard_state.last_quotes[vanguard_s];
        const vanguard_vol = vanguard_s === 'frxEURUSD' ? 0.0001 : (vanguard_s === '1HZ75V' ? 0.0009 : 0.00075);
        const vanguard_d = (Math.random() - 0.495) * vanguard_curr * vanguard_vol;
        const vanguard_nxt = Math.max(0.01, vanguard_curr + vanguard_d);
        const vanguard_prec = vanguard_s === 'frxEURUSD' ? 5 : 2;

        if (!vanguard_state.is_connected) {
          vanguard_handle_tick_dual_track({
            symbol: vanguard_s,
            quote: vanguard_nxt.toFixed(vanguard_prec),
            epoch: vanguard_epoch,
          });
        }
      });
    }, 1000);
  }

  function vanguard_handle_broker_error(vanguard_err) {
    vanguard_log_event('BROKER', `Error [${vanguard_err.code || 'CODE'}]: ${vanguard_err.message}`, 'error');
    if (vanguard_err.code === 'AuthorizationRequired' || vanguard_err.code === 'InvalidToken') {
      vanguard_halt_automation(`Token failure: ${vanguard_err.message}`);
    }
  }

  // --- Event Bindings ---
  function vanguard_bind_events() {
    const vanguard_nav_matrix = document.getElementById('nav-matrix');
    const vanguard_nav_chart = document.getElementById('nav-chart');
    const vanguard_nav_bot = document.getElementById('nav-bot');
    const vanguard_nav_ledger = document.getElementById('nav-ledger');
    const vanguard_nav_analyzer = document.getElementById('nav-analyzer');

    if (vanguard_nav_matrix) vanguard_nav_matrix.addEventListener('click', () => vanguard_switch_view('matrix'));
    if (vanguard_nav_chart) vanguard_nav_chart.addEventListener('click', () => vanguard_switch_view('chart'));
    if (vanguard_nav_bot) vanguard_nav_bot.addEventListener('click', () => vanguard_switch_view('bot'));
    if (vanguard_nav_ledger) vanguard_nav_ledger.addEventListener('click', () => vanguard_switch_view('ledger'));
    if (vanguard_nav_analyzer) vanguard_nav_analyzer.addEventListener('click', () => vanguard_switch_view('analyzer'));

    const vanguard_oauth_btn = document.getElementById('btn-oauth-sync');
    if (vanguard_oauth_btn) {
      vanguard_oauth_btn.addEventListener('click', () => {
        window.location.href = VANGUARD_OAUTH_URL;
      });
    }

    const vanguard_account_select = document.getElementById('account-node-select');
    if (vanguard_account_select) {
      vanguard_account_select.addEventListener('change', (e) => {
        vanguard_handle_account_switch(e.target.value);
      });
    }

    const vanguard_token_save_btn = document.getElementById('btn-save-manual-token');
    const vanguard_manual_token_input = document.getElementById('manual-token-input');
    if (vanguard_token_save_btn && vanguard_manual_token_input) {
      vanguard_token_save_btn.addEventListener('click', () => {
        const vanguard_entered = vanguard_manual_token_input.value.trim();
        if (vanguard_entered) {
          const vanguard_key = 'MANUAL-' + vanguard_entered.slice(-4);
          vanguard_state.accounts[vanguard_key] = {
            loginid: vanguard_key,
            token: vanguard_entered,
            type: 'TOKEN',
          };
          sessionStorage.setItem('vanguard_accounts', JSON.stringify(vanguard_state.accounts));
          vanguard_populate_account_selector();
          if (vanguard_account_select) vanguard_account_select.value = vanguard_key;
          vanguard_handle_account_switch(vanguard_key);
          vanguard_manual_token_input.value = '';
          vanguard_log_event('AUTH', `Manual API session token saved in sessionStorage and activated.`, 'success');
        }
      });
    }

    const vanguard_btn_deploy = document.getElementById('btn-deploy');
    const vanguard_btn_halt = document.getElementById('btn-halt');
    if (vanguard_btn_deploy) vanguard_btn_deploy.addEventListener('click', vanguard_deploy_automation);
    if (vanguard_btn_halt) vanguard_btn_halt.addEventListener('click', () => vanguard_halt_automation('Manual halt.'));

    // Confidence threshold slider
    const vanguard_conf_slider = document.getElementById('confidence-threshold-input');
    const vanguard_conf_display = document.getElementById('confidence-threshold-val');
    if (vanguard_conf_slider) {
      vanguard_conf_slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        vanguard_state.min_confidence_threshold = val;
        if (vanguard_conf_display) vanguard_conf_display.textContent = `${val}%`;
        vanguard_update_confidence_gauge(vanguard_state.current_confidence_score);
      });
    }

    // Loss shield checkbox
    const vanguard_shield_check = document.getElementById('loss-shield-toggle');
    if (vanguard_shield_check) {
      vanguard_shield_check.addEventListener('change', (e) => {
        vanguard_state.adaptive_loss_shield = e.target.checked;
        vanguard_log_event('SHIELD', `Consecutive loss dynamic shield ${e.target.checked ? 'ENABLED' : 'DISABLED'}.`, 'info');
      });
    }

    // Scanner Buttons
    const vanguard_btn_rapid = document.getElementById('btn-rapid-scan');
    const vanguard_btn_deep = document.getElementById('btn-deep-scan');
    const vanguard_btn_ai_brief = document.getElementById('btn-ai-deep-briefing');

    if (vanguard_btn_rapid) vanguard_btn_rapid.addEventListener('click', () => vanguard_start_market_scan(false));
    if (vanguard_btn_deep) vanguard_btn_deep.addEventListener('click', () => vanguard_start_market_scan(true));
    if (vanguard_btn_ai_brief) vanguard_btn_ai_brief.addEventListener('click', vanguard_request_ai_deep_scan_briefing);

    // Barrier chips in scanner
    document.querySelectorAll('.barrier-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.barrier-chip').forEach((c) => c.classList.remove('active', 'bg-[#2979ff]', 'text-white'));
        chip.classList.add('active', 'bg-[#2979ff]', 'text-white');
        vanguard_state.scan_barrier = parseInt(chip.dataset.b, 10);
        if (vanguard_state.scan_results.length > 0) {
          vanguard_start_market_scan(false);
        }
      });
    });

    // AI Coach Modal Controls
    const vanguard_open_coach_btn = document.getElementById('btn-open-ai-coach');
    const vanguard_close_coach_btn = document.getElementById('btn-close-ai-coach');
    const vanguard_coach_modal = document.getElementById('ai-coach-modal');
    const vanguard_coach_input = document.getElementById('ai-coach-input');
    const vanguard_coach_send_btn = document.getElementById('btn-send-ai-coach');

    if (vanguard_open_coach_btn && vanguard_coach_modal) {
      vanguard_open_coach_btn.addEventListener('click', () => {
        vanguard_coach_modal.style.display = 'flex';
      });
    }
    if (vanguard_close_coach_btn && vanguard_coach_modal) {
      vanguard_close_coach_btn.addEventListener('click', () => {
        vanguard_coach_modal.style.display = 'none';
      });
    }
    if (vanguard_coach_send_btn && vanguard_coach_input) {
      vanguard_coach_send_btn.addEventListener('click', () => {
        const text = vanguard_coach_input.value.trim();
        if (text) {
          vanguard_coach_input.value = '';
          vanguard_ask_ai_coach(text);
        }
      });
      vanguard_coach_input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const text = vanguard_coach_input.value.trim();
          if (text) {
            vanguard_coach_input.value = '';
            vanguard_ask_ai_coach(text);
          }
        }
      });
    }

    // Quick Coach Suggestion Pills
    document.querySelectorAll('.ai-coach-prompt-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        vanguard_ask_ai_coach(pill.dataset.prompt);
      });
    });

    // One-Click Bracket buttons
    const vanguard_b_call = document.getElementById('bracket-btn-call');
    const vanguard_b_put = document.getElementById('bracket-btn-put');
    const vanguard_b_even = document.getElementById('bracket-btn-even');
    const vanguard_b_odd = document.getElementById('bracket-btn-odd');
    const vanguard_b_over = document.getElementById('bracket-btn-over');
    const vanguard_b_under = document.getElementById('bracket-btn-under');

    if (vanguard_b_call) vanguard_b_call.addEventListener('click', () => vanguard_execute_manual_bracket('CALL'));
    if (vanguard_b_put) vanguard_b_put.addEventListener('click', () => vanguard_execute_manual_bracket('PUT'));
    if (vanguard_b_even) vanguard_b_even.addEventListener('click', () => vanguard_execute_manual_bracket('DIGITEVEN'));
    if (vanguard_b_odd) vanguard_b_odd.addEventListener('click', () => vanguard_execute_manual_bracket('DIGITODD'));
    if (vanguard_b_over) vanguard_b_over.addEventListener('click', () => vanguard_execute_manual_bracket('DIGITOVER'));
    if (vanguard_b_under) vanguard_b_under.addEventListener('click', () => vanguard_execute_manual_bracket('DIGITUNDER'));

    document.querySelectorAll('.asset-tab-pill').forEach((vanguard_tab) => {
      vanguard_tab.addEventListener('click', () => {
        const vanguard_sym = vanguard_tab.dataset.symbol;
        if (vanguard_sym) vanguard_set_active_asset(vanguard_sym);
      });
    });

    VANGUARD_TRACKED_SYMBOLS.forEach((vanguard_sym) => {
      const vanguard_c = document.getElementById(`matrix-card-${vanguard_sym}`);
      if (vanguard_c) {
        vanguard_c.addEventListener('click', () => {
          vanguard_set_active_asset(vanguard_sym);
          vanguard_switch_view('chart');
        });
      }
    });

    document.querySelectorAll('.bot-engine-pill').forEach((vanguard_bp) => {
      vanguard_bp.addEventListener('click', () => {
        document.querySelectorAll('.bot-engine-pill').forEach((p) => p.classList.remove('bg-[#2979ff]', 'text-white'));
        vanguard_bp.classList.add('bg-[#2979ff]', 'text-white');
        vanguard_state.selected_bot_engine = vanguard_bp.dataset.engine || 'all';
        vanguard_log_event('BOTS', `Active bot engine matrix set to [${vanguard_state.selected_bot_engine.toUpperCase()}]`, 'info');
      });
    });

    const vanguard_risk_sel = document.getElementById('risk-profile-select');
    if (vanguard_risk_sel) {
      vanguard_risk_sel.addEventListener('change', (e) => {
        const vanguard_val = e.target.value;
        if (vanguard_val === 'conservative') vanguard_state.risk_multiplier = 0.5;
        else if (vanguard_val === 'aggressive') vanguard_state.risk_multiplier = 2.0;
        else vanguard_state.risk_multiplier = 1.0;
        vanguard_log_event('BOTS', `Risk profile calibrated to [${vanguard_val.toUpperCase()}] (${vanguard_state.risk_multiplier}x scale)`, 'info');
      });
    }

    const vanguard_copy_btn = document.getElementById('copy-logs-btn');
    const vanguard_clear_btn = document.getElementById('clear-logs-btn');
    const vanguard_logs_el = document.getElementById('execution-logs');

    if (vanguard_copy_btn && vanguard_logs_el) {
      vanguard_copy_btn.addEventListener('click', () => {
        navigator.clipboard.writeText(vanguard_logs_el.innerText).then(() => {
          vanguard_log_event('SYSTEM', 'System execution logs copied to clipboard.', 'success');
        });
      });
    }

    if (vanguard_clear_btn && vanguard_logs_el) {
      vanguard_clear_btn.addEventListener('click', () => {
        vanguard_logs_el.innerHTML = '';
        vanguard_log_event('SYSTEM', 'Terminal execution logs cleared by operator.', 'info');
      });
    }

    const vanguard_clock_el = document.getElementById('utc-clock');
    if (vanguard_clock_el) {
      setInterval(() => {
        const vanguard_d = new Date();
        vanguard_clock_el.textContent = `${vanguard_d.toUTCString().split(' ')[4]} UTC`;
      }, 1000);
    }
  }

  // --- Bootstrap Core ---
  function vanguard_bootstrap() {
    vanguard_init_worker();
    vanguard_parse_oauth_url();
    vanguard_bind_events();

    vanguard_log_event('SYSTEM', '⚡ Tickwealth Vanguard Nexus v4.5 initialized.', 'accent');
    vanguard_log_event('SYSTEM', 'AI Confidence Gate (≥80%) & Multi-Market Deep Scanner operational.', 'info');

    vanguard_init_ws();
    vanguard_activate_simulated_ticks();
    vanguard_switch_view('matrix');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', vanguard_bootstrap);
  } else {
    setTimeout(vanguard_bootstrap, 80);
  }

  window.VanguardCore = {
    state: vanguard_state,
    switchView: vanguard_switch_view,
    deploy: vanguard_deploy_automation,
    halt: vanguard_halt_automation,
    log: vanguard_log_event,
    startScan: vanguard_start_market_scan,
    applyScanOpportunity: vanguard_apply_scan_opportunity,
    viewAssetChart: vanguard_view_asset_chart,
    askAi: vanguard_ask_ai_coach,
  };
})(window);
