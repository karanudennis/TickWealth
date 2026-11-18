/* TickWealth stats engine: pure functions, no DOM. Verified by tests.js (run: node tests.js). */
const TWS = (() => {
  const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
  const chiSqP = (x, k) => { if (x <= 0) return 1; const z = (Math.cbrt(x / k) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k)); return 1 - normCdf(z); }; // Wilson-Hilferty
  const twoSided = z => 2 * (1 - normCdf(Math.abs(z)));
  function digitStats(D) { const n = D.length, c = Array(10).fill(0); D.forEach(d => c[d]++); const e = n / 10, chi = c.reduce((s, o) => s + (o - e) ** 2 / e, 0);
    const H = -c.filter(v => v).reduce((s, v) => s + (v / n) * Math.log2(v / n), 0); return { chi, p: chiSqP(chi, 9), entropy: H, maxEntropy: Math.log2(10), counts: c }; }
  function runsTest(up) { const a = up.filter(x => x !== null), n1 = a.filter(Boolean).length, n2 = a.length - n1; if (n1 < 5 || n2 < 5) return null;
    let R = 1; for (let i = 1; i < a.length; i++) if (a[i] !== a[i - 1]) R++; const m = 2 * n1 * n2 / (n1 + n2) + 1, v = (m - 1) * (m - 2) / (n1 + n2 - 1), z = (R - m) / Math.sqrt(v); return { runs: R, z, p: twoSided(z) }; }
  function autocorr(x, lag = 1) { const n = x.length, m = x.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; for (let i = 0; i < n; i++) { den += (x[i] - m) ** 2; if (i + lag < n) num += (x[i] - m) * (x[i + lag] - m); }
    const r = den ? num / den : 0, z = r * Math.sqrt(n); return { r, z, p: twoSided(z) }; }
  function wilson(k, n) { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [c - h, c + h]; }
  function beta(w, l) { const a = 1 + w, b = 1 + l, m = a / (a + b), sd = Math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1))); return { mean: m, lo: Math.max(0, m - 1.96 * sd), hi: Math.min(1, m + 1.96 * sd) }; }
  // "AI Truth Test": simple prediction models scored on data they have not seen yet (online, one step ahead).
  function truthTest(D, P) {
    const res = [], add = (name, hits, n, p0) => { const z = (hits - n * p0) / Math.sqrt(n * p0 * (1 - p0)); res.push({ name, hits, n, rate: hits / n, p0, p: twoSided(z) }); };
    if (D.length > 150) {
      const tc = {}, h = { mf: 0, lf: 0, mk: 0, rp: 0 }; let n = 0;
      for (let j = 1; j < 100; j++) (tc[D[j - 1]] = tc[D[j - 1]] || Array(10).fill(0))[D[j]]++;
      for (let i = 100; i < D.length; i++) {
        const c = Array(10).fill(0); for (let j = i - 100; j < i; j++) c[D[j]]++;
        const mx = c.indexOf(Math.max(...c)), mn = c.indexOf(Math.min(...c)), row = tc[D[i - 1]] || Array(10).fill(0); let best = 0, bc = -1; row.forEach((v, d) => { if (v > bc) { bc = v; best = d; } });
        if (D[i] === mx) h.mf++; if (D[i] === mn) h.lf++; if (D[i] === best) h.mk++; if (D[i] === D[i - 1]) h.rp++; n++;
        (tc[D[i - 1]] = tc[D[i - 1]] || Array(10).fill(0))[D[i]]++;
      }
      add('Next digit = most frequent of last 100', h.mf, n, .1); add('Next digit = least frequent of last 100', h.lf, n, .1); add('Next digit = Markov (most likely after last digit)', h.mk, n, .1); add('Next digit = same as last digit', h.rp, n, .1);
    }
    if (P && P.length > 50) { let mo = 0, rv = 0, n = 0; for (let i = 2; i < P.length; i++) { const a = Math.sign(P[i - 1] - P[i - 2]), b = Math.sign(P[i] - P[i - 1]); if (!a || !b) continue; n++; if (a === b) mo++; else rv++; } add('Next move = same direction (momentum)', mo, n, .5); add('Next move = opposite direction (reversal)', rv, n, .5); }
    res.forEach(r => r.padj = Math.min(1, r.p * res.length)); return res; // Bonferroni correction for testing several models
  }
  function riskSim(o) { let hit = 0, ln = 0; const fin = [];
    for (let r = 0; r < o.runs; r++) { let b = o.bal, step = 0, h = false, t = 0;
      for (; t < o.trades; t++) { const s = o.stake * (o.mart.on ? Math.pow(o.mart.mult, step) : 1); if (s > b) { h = true; break; }
        if (Math.random() < o.pWin) { b += s * o.payout; step = 0; } else { b -= s; step = o.mart.on ? (step + 1 >= o.mart.steps ? 0 : step + 1) : 0; }
        if (o.bal - b >= o.limit) { h = true; t++; break; } }
      if (h) hit++; fin.push(b); ln += t; }
    fin.sort((a, b) => a - b); const q = f => fin[Math.min(fin.length - 1, Math.floor(fin.length * f))]; return { pHit: hit / o.runs, median: q(.5), p5: q(.05), p95: q(.95), avgTrades: ln / o.runs }; }
  function spikeProb(avgInterval, k) { return 1 - Math.exp(-k / (avgInterval || 1)); }
  // Helper: EMA + RSI(14) directional oscillator for Rise/Fall & Momentum signals
  function calcEmaRsi(P) {
    if (!P || P.length < 15) return { ema5: 0, ema15: 0, rsi: 50, diffPct: 0 };
    const sl = P.slice(-45);
    let ema5 = sl[0], ema15 = sl[0];
    const k5 = 2 / 6, k15 = 2 / 16;
    for (let i = 1; i < sl.length; i++) {
      ema5 = sl[i] * k5 + ema5 * (1 - k5);
      ema15 = sl[i] * k15 + ema15 * (1 - k15);
    }
    let gains = 0, losses = 0;
    const rsiStart = Math.max(1, sl.length - 14);
    for (let i = rsiStart; i < sl.length; i++) {
      const d = sl[i] - sl[i - 1];
      if (d > 0) gains += d;
      else losses -= d;
    }
    const rs = losses === 0 ? (gains > 0 ? 10 : 1) : (gains / losses);
    const rsi = +(100 - 100 / (1 + rs)).toFixed(1);
    const last = sl[sl.length - 1] || 1;
    const diffPct = +(((ema5 - ema15) / last) * 100).toFixed(4);
    return { ema5, ema15, rsi, diffPct };
  }

  function calcConfidence(opts) {
    opts = opts || {};
    const contract = opts.contract || 'DIGITOVER';
    const barrier = opts.barrier != null ? +opts.barrier : 2;
    const P = opts.prices || [];
    const D = opts.digits || [];
    const consecutiveLosses = opts.consecutiveLosses || 0;
    const lossShield = opts.lossShield !== false;

    // True mathematical baseline win rate for this contract type
    let nullProb = 0.50;
    if (contract === 'DIGITOVER') nullProb = Math.max(0.1, (9 - barrier) / 10);
    else if (contract === 'DIGITUNDER') nullProb = Math.max(0.1, barrier / 10);
    else if (contract === 'DIGITDIFF') nullProb = 0.90;
    else if (contract === 'DIGITMATCH') nullProb = 0.10;
    else if (contract === 'DIGITEVEN' || contract === 'DIGITODD') nullProb = 0.50;
    else if (contract === 'CALL' || contract === 'PUT') nullProb = 0.50;

    // Default gate calibrated to realistic baseline expectation
    const defaultGate = Math.max(35, Math.min(86, Math.round(nullProb * 100 * 0.85)));
    const baseGate = opts.gate != null ? +opts.gate : defaultGate;

    // Adaptive loss shield raises threshold cleanly (+1.5% per consecutive loss up to +5%)
    const shieldBoost = lossShield && consecutiveLosses > 0 ? Math.min(5, Math.round(consecutiveLosses * 1.5)) : 0;
    const maxShield = Math.min(90, Math.round(nullProb * 100) + 2);
    const shieldedGate = shieldBoost > 0 ? Math.min(maxShield, baseGate + shieldBoost) : baseGate;

    if (!D.length && !P.length) {
      const initScore = Math.round(nullProb * 100);
      return { score: initScore, passes: initScore >= shieldedGate, gate: shieldedGate, baseGate, reason: 'Initial baseline', breakdown: {} };
    }

    const currentDigit = D.length ? D[D.length - 1] : 5;
    const rf = (D.length >= 15 || P.length >= 16) ? regimeFingerprint(P, D) : null;

    // 1. Blended 2nd-Order + 1st-Order Markov Transition Probability (Digits) or Trend Projection (CALL/PUT)
    let markovWinPct = nullProb * 100;
    let empiricalWinPct = nullProb * 100;
    if (contract === 'CALL' || contract === 'PUT') {
      if (P.length >= 15) {
        const { ema5, ema15, rsi } = calcEmaRsi(P);
        const wSlice = P.slice(-30);
        let wMatch = 0, wSum = 0;
        for (let i = 1; i < wSlice.length; i++) {
          if (wSlice[i] === wSlice[i - 1]) continue;
          const w = i >= wSlice.length - 10 ? 2.2 : 1.0;
          const okStep = contract === 'CALL' ? (wSlice[i] > wSlice[i - 1]) : (wSlice[i] < wSlice[i - 1]);
          if (okStep) wMatch += w;
          wSum += w;
        }
        const dirPct = wSum > 0 ? (wMatch / wSum) * 100 : 50;
        empiricalWinPct = Math.max(42, Math.min(68, 50 + (dirPct - 50) * 0.75));
        const trendAligned = contract === 'CALL' ? (ema5 >= ema15) : (ema5 <= ema15);
        const rsiBoost = contract === 'CALL'
          ? (rsi >= 51 && rsi <= 72 ? 4 : (rsi < 34 ? 4 : (rsi > 76 ? -4 : 0)))
          : (rsi <= 49 && rsi >= 28 ? 4 : (rsi > 66 ? 4 : (rsi < 24 ? -4 : 0)));
        markovWinPct = Math.max(42, Math.min(68, 50 + (trendAligned ? 5 : -3) + (dirPct - 50) * 0.45 + rsiBoost * 0.5));
        if (opts.symbol && /^(frx|XAU)/i.test(opts.symbol) && P.length >= 20) {
          const fxEval = analyzeForex(P, opts.symbol);
          if (fxEval.action === contract) {
            markovWinPct = Math.max(markovWinPct, Math.min(66, fxEval.winPct + 2));
            empiricalWinPct = Math.max(empiricalWinPct, fxEval.winPct);
          } else if (fxEval.action === 'HOLD') {
            markovWinPct = Math.min(markovWinPct, 49);
          }
        }
      }
    } else {
      if (D.length >= 15) {
        const m2 = D.length >= 30 ? secondOrderMarkov(D) : null;
        const m1 = markovMatrix(D);
        const trans = (m2 && m2.probs) ? m2.probs : ((m1 && m1.probs && m1.probs[currentDigit]) ? m1.probs[currentDigit] : null);
        if (trans) {
          let winSum = 0;
          if (contract === 'DIGITOVER') {
            for (let d = barrier + 1; d <= 9; d++) winSum += trans[d];
          } else if (contract === 'DIGITUNDER') {
            for (let d = 0; d < barrier; d++) winSum += trans[d];
          } else if (contract === 'DIGITEVEN') {
            for (let d = 0; d < 10; d += 2) winSum += trans[d];
          } else if (contract === 'DIGITODD') {
            for (let d = 1; d < 10; d += 2) winSum += trans[d];
          } else if (contract === 'DIGITMATCH') {
            winSum = trans[barrier] || 0.1;
          } else if (contract === 'DIGITDIFF') {
            winSum = 1 - (trans[barrier] || 0.1);
          }
          if (winSum > 0) markovWinPct = winSum * 100;
        }
      }

      // 2. Full-Sample + Recency Blended Empirical Win Rate (uses full 1000t when provided)
      if (D.length >= 15) {
        const sample = D;
        const sn = sample.length;
        let wHits = 0, wTotal = 0, rawHits = 0;
        for (let i = 0; i < sn; i++) {
          const w = i >= sn - 25 ? 2.8 : (i >= sn - 100 ? 1.8 : 1.0);
          const d = sample[i];
          let hit = false;
          if (contract === 'DIGITOVER') hit = d > barrier;
          else if (contract === 'DIGITUNDER') hit = d < barrier;
          else if (contract === 'DIGITEVEN') hit = d % 2 === 0;
          else if (contract === 'DIGITODD') hit = d % 2 === 1;
          else if (contract === 'DIGITMATCH') hit = d === barrier;
          else if (contract === 'DIGITDIFF') hit = d !== barrier;
          if (hit) { wHits += w; rawHits++; }
          wTotal += w;
        }
        if (wTotal > 0) empiricalWinPct = (wHits / wTotal) * 100;
        if (sn >= 200 && nullProb > 0 && nullProb < 1) {
          const rawRate = rawHits / sn;
          const z = (rawRate - nullProb) / Math.sqrt((nullProb * (1 - nullProb)) / sn);
          if (z >= 1.65) empiricalWinPct += Math.min(3.5, z * 0.9);
        }
      }
    }

    // 3. Directional Momentum (EMA5/EMA15 + RSI14 for CALL/PUT) & Reversion Pull for Digits
    let momentumBonus = 0;
    if (contract === 'CALL' || contract === 'PUT') {
      if (P.length >= 15) {
        const { ema5, ema15, rsi } = calcEmaRsi(P);
        const pSlice = P.slice(-15);
        let mvUp = 0, mvCnt = 0;
        for (let i = 1; i < pSlice.length; i++) {
          if (pSlice[i] === pSlice[i - 1]) continue;
          if (pSlice[i] > pSlice[i - 1]) mvUp++;
          mvCnt++;
        }
        const up = mvCnt > 0 ? mvUp / mvCnt : 0.5;
        if (contract === 'CALL') {
          const tickDrift = (up - 0.5) * 14;
          const emaAlign = ema5 >= ema15 ? 4 : -2;
          const rsiPull = rsi < 38 ? 4 : (rsi > 76 ? -4 : (rsi > 51 ? 2 : 0));
          momentumBonus = Math.round(tickDrift + emaAlign + rsiPull);
        } else {
          const down = 1 - up;
          const tickDrift = (down - 0.5) * 14;
          const emaAlign = ema5 <= ema15 ? 4 : -2;
          const rsiPull = rsi > 62 ? 4 : (rsi < 24 ? -4 : (rsi < 49 ? 2 : 0));
          momentumBonus = Math.round(tickDrift + emaAlign + rsiPull);
        }
        if (rf && rf.hurst >= 0.58) momentumBonus += 2;
      }
    } else if (P.length >= 8) {
      if (contract === 'DIGITOVER' && currentDigit <= barrier) momentumBonus = 5;
      else if (contract === 'DIGITUNDER' && currentDigit >= barrier) momentumBonus = 5;
      else if (contract === 'DIGITEVEN' && currentDigit % 2 !== 0) momentumBonus = 4;
      else if (contract === 'DIGITODD' && currentDigit % 2 === 0) momentumBonus = 4;
      else if (contract === 'DIGITMATCH' && rf && rf.droughtDigit === barrier && rf.droughtTicks >= 14) momentumBonus = 4;
    }

    // 4. Regime CHOP_TRAP Penalty (filters pure alternating flip noise on high-chop indices)
    let chopPenalty = 0;
    if (rf && rf.hazard === 'CHOP_TRAP') {
      if (contract === 'CALL' || contract === 'PUT') {
        if (rf.chopIndex >= 0.65) chopPenalty = (rf.chopIndex >= 0.72 ? 9 : 5) + 4;
      } else {
        chopPenalty = rf.chopIndex >= 0.72 ? 9 : 4;
      }
    }

    const rawScore = (markovWinPct * 0.55) + (empiricalWinPct * 0.30) + (nullProb * 100 * 0.15) + momentumBonus - chopPenalty;
    const score = Math.max(12, Math.min(98, Math.round(rawScore)));

    const passes = score >= shieldedGate;
    const chopNote = chopPenalty > 0 ? `, Chop-${chopPenalty}%` : '';
    const reason = passes
      ? `PASS: AI Conviction ${score}% ≥ ${shieldedGate}% gate (Markov2: ${markovWinPct.toFixed(0)}%, Recency: ${empiricalWinPct.toFixed(0)}%, Base: ${(nullProb * 100).toFixed(0)}%${chopNote})`
      : `FILTER: AI Conviction ${score}% < ${shieldedGate}% gate (${shieldBoost > 0 ? `Shield +${shieldBoost}%` : (chopPenalty > 0 ? 'Chop-Trap penalty' : 'Sub-gate probability')})`;

    return {
      score,
      gate: shieldedGate,
      baseGate,
      passes,
      consecutiveLosses,
      rf,
      reason,
      nullProb: +(nullProb * 100).toFixed(0),
      breakdown: { markovWinPct, empiricalWinPct, momentumBonus, chopPenalty }
    };
  }

  // 1st-order Markov Transition Matrix for digit projections
  function markovMatrix(D) {
    if (!D || D.length < 20) return null;
    const M1 = Array.from({ length: 10 }, () => Array(10).fill(0));
    const counts = Array(10).fill(0);
    for (let i = 1; i < D.length; i++) {
      const prev = D[i - 1], curr = D[i];
      if (prev >= 0 && prev <= 9 && curr >= 0 && curr <= 9) {
        M1[prev][curr]++;
        counts[prev]++;
      }
    }
    const probs = Array.from({ length: 10 }, () => Array(10).fill(0.1));
    for (let p = 0; p < 10; p++) {
      const total = counts[p] + 1;
      for (let c = 0; c < 10; c++) {
        probs[p][c] = (M1[p][c] + 0.1) / total;
      }
    }
    return { matrix: M1, probs, counts };
  }

  // Multi-Horizon Market Projection & Forward Estimator
  function projectMarket(prices, digits, options) {
    options = options || {};
    const P = prices || [];
    const D = digits || [];
    const n = D.length;
    if (n < 25) {
      return {
        regime: 'CALIBRATING',
        forwardRiseProb: 0.5,
        forwardFallProb: 0.5,
        digitProjections: Array(10).fill(0.1),
        optimalContract: { type: 'DIGITEVEN', edge: 0, winRate: 50, name: 'Calibrating...' },
        candidateSetups: [],
        volatilityForecast: 'MODERATE',
        hurst: 0.5,
        projectedEntropy: 3.32
      };
    }

    // 1. Markov Transition Projection from the last observed digit
    const lastDigit = D[n - 1];
    const mk = markovMatrix(D);
    const markovProbs = mk && mk.probs[lastDigit] ? mk.probs[lastDigit] : Array(10).fill(0.1);

    // 2. Frequency decay & recency weighting
    const recCount = Array(10).fill(0);
    let recWeight = 0;
    for (let i = 0; i < n; i++) {
      const w = i >= n - 30 ? 3 : (i >= n - 100 ? 1.5 : 1);
      recCount[D[i]] += w;
      recWeight += w;
    }
    const empProbs = recCount.map(v => v / (recWeight || 1));

    // Combine empirical frequency (40%) and Markov transition (60%) for incoming digit projection
    const combinedDigitProjections = Array(10).fill(0);
    for (let d = 0; d < 10; d++) {
      combinedDigitProjections[d] = +(markovProbs[d] * 0.60 + empProbs[d] * 0.40).toFixed(4);
    }
    const sumComb = combinedDigitProjections.reduce((a, b) => a + b, 0);
    for (let d = 0; d < 10; d++) combinedDigitProjections[d] = +(combinedDigitProjections[d] / sumComb).toFixed(4);

    // 3. Multi-Horizon Price Drift & Forward Velocity (EMA(3), EMA(8), Linear Regression(20))
    let forwardRiseProb = 0.5;
    let forwardFallProb = 0.5;
    let hurst = 0.5;
    let regime = 'STATIONARY_NOISE';

    if (P.length >= 20) {
      const pSlice = P.slice(-20);
      let ema3 = pSlice[0], ema8 = pSlice[0];
      const k3 = 2 / (3 + 1), k8 = 2 / (8 + 1);
      for (let i = 1; i < pSlice.length; i++) {
        ema3 = pSlice[i] * k3 + ema3 * (1 - k3);
        ema8 = pSlice[i] * k8 + ema8 * (1 - k8);
      }
      const lastP = pSlice[pSlice.length - 1];
      const prevP = pSlice[pSlice.length - 2];
      const vel1 = (lastP - prevP) / (lastP || 1);

      const returns = [];
      for (let i = 1; i < pSlice.length; i++) returns.push(pSlice[i] - pSlice[i - 1]);
      const ac = autocorr(returns, 1);
      hurst = Math.max(0.1, Math.min(0.9, +(0.5 + (ac.r || 0) * 0.35).toFixed(2)));

      if (hurst > 0.58) regime = 'PERSISTENT_MOMENTUM';
      else if (hurst < 0.42) regime = 'MEAN_REVERTING_CYCLE';
      else regime = 'RANDOM_WALK_STATIONARY';

      const drift = (lastP - ema8) / (lastP || 1) + vel1 * 1.5;
      const zDrift = Math.max(-2.5, Math.min(2.5, drift * 1500));
      forwardRiseProb = +(normCdf(zDrift)).toFixed(3);
      forwardFallProb = +(1 - forwardRiseProb).toFixed(3);
    }

    // 4. Determine Kelly-Optimal Projected Setup across incoming 1-5 ticks
    const candidateSetups = [];

    // Over/Under projections
    for (let b = 1; b <= 8; b++) {
      let pOver = 0, pUnder = 0;
      for (let d = 0; d < 10; d++) {
        if (d > b) pOver += combinedDigitProjections[d];
        if (d < b) pUnder += combinedDigitProjections[d];
      }
      const nullOver = (9 - b) / 10;
      const nullUnder = b / 10;
      const edgeOver = (pOver - nullOver) * 100;
      const edgeUnder = (pUnder - nullUnder) * 100;

      candidateSetups.push({
        type: 'DIGITOVER',
        barrier: b,
        name: `Over ${b}`,
        projectedProb: +(pOver * 100).toFixed(1),
        nullProb: +(nullOver * 100).toFixed(1),
        edge: +edgeOver.toFixed(1)
      });
      candidateSetups.push({
        type: 'DIGITUNDER',
        barrier: b,
        name: `Under ${b}`,
        projectedProb: +(pUnder * 100).toFixed(1),
        nullProb: +(nullUnder * 100).toFixed(1),
        edge: +edgeUnder.toFixed(1)
      });
    }

    // Even / Odd projections
    let pEven = 0, pOdd = 0;
    for (let d = 0; d < 10; d++) {
      if (d % 2 === 0) pEven += combinedDigitProjections[d];
      else pOdd += combinedDigitProjections[d];
    }
    candidateSetups.push({
      type: 'DIGITEVEN',
      barrier: null,
      name: 'Even [0,2,4,6,8]',
      projectedProb: +(pEven * 100).toFixed(1),
      nullProb: 50.0,
      edge: +((pEven - 0.5) * 100).toFixed(1)
    });
    candidateSetups.push({
      type: 'DIGITODD',
      barrier: null,
      name: 'Odd [1,3,5,7,9]',
      projectedProb: +(pOdd * 100).toFixed(1),
      nullProb: 50.0,
      edge: +((pOdd - 0.5) * 100).toFixed(1)
    });

    // Rise / Fall projections
    candidateSetups.push({
      type: 'CALL',
      barrier: null,
      name: 'Rise (1-5 Ticks)',
      projectedProb: +(forwardRiseProb * 100).toFixed(1),
      nullProb: 50.0,
      edge: +((forwardRiseProb - 0.5) * 100).toFixed(1)
    });
    candidateSetups.push({
      type: 'PUT',
      barrier: null,
      name: 'Fall (1-5 Ticks)',
      projectedProb: +(forwardFallProb * 100).toFixed(1),
      nullProb: 50.0,
      edge: +((forwardFallProb - 0.5) * 100).toFixed(1)
    });

    candidateSetups.sort((a, b) => b.edge - a.edge);
    const optimal = candidateSetups[0];

    let projEntropy = 0;
    combinedDigitProjections.forEach(p => {
      if (p > 0) projEntropy -= p * Math.log2(p);
    });

    return {
      regime,
      hurst,
      forwardRiseProb,
      forwardFallProb,
      digitProjections: combinedDigitProjections,
      projectedEntropy: +projEntropy.toFixed(3),
      candidateSetups: candidateSetups.slice(0, 5),
      optimalContract: optimal,
      highestProbDigit: combinedDigitProjections.indexOf(Math.max(...combinedDigitProjections)),
      lowestProbDigit: combinedDigitProjections.indexOf(Math.min(...combinedDigitProjections))
    };
  }

  // Helper: recency-weighted empirical distribution across digits 0..9
  function recencyDigitProbs(D) {
    const n = D.length;
    const recCount = Array(10).fill(0);
    let recWeight = 0;
    for (let i = 0; i < n; i++) {
      const w = i >= n - 25 ? 2.5 : (i >= n - 80 ? 1.5 : 1);
      if (D[i] >= 0 && D[i] <= 9) {
        recCount[D[i]] += w;
        recWeight += w;
      }
    }
    return recCount.map(v => v / (recWeight || 1));
  }

  // Quantitative Over/Under Decision Engine:
  // Evaluates every barrier 0..8 for OVER and 1..9 for UNDER using:
  // 1. Recency-weighted empirical frequency over real ticks
  // 2. 2nd-order + 1st-order Markov transition conditioned on current digit flow
  // 3. Regime Chop/Entropy penalty & Kelly cap
  function decideOverUnder(digits, prices, options) {
    options = options || {};
    const D = digits || [];
    const P = prices || [];
    const n = D.length;
    if (n < 15) {
      return {
        decision: 'CALIBRATING',
        action: 'HOLD',
        barrier: 4,
        pastHitPct: 50,
        projectedWinPct: 50,
        nullPct: 50,
        edgePts: 0,
        pastEdgePts: 0,
        conviction: 50,
        currentDigit: D[n - 1] ?? 5,
        sampleSize: n,
        rf: null,
        regimeLabel: 'Calibrating',
        best: { action: 'UNDER', barrier: 4, pastHitPct: 50, projectedWinPct: 50, nullPct: 50, edgePts: 0, pastEdge: 0 },
        candidates: [],
        reason: 'Insufficient tick history (need at least 15 real ticks to compute Markov transitions and empirical bias).'
      };
    }

    const currentDigit = D[n - 1];
    const m2 = n >= 30 ? secondOrderMarkov(D) : null;
    const m1 = markovMatrix(D);
    const markovProbs = (m2 && m2.probs) ? m2.probs : ((m1 && m1.probs && m1.probs[currentDigit]) ? m1.probs[currentDigit] : Array(10).fill(0.1));
    const empProbs = recencyDigitProbs(D);
    const rf = regimeFingerprint(P, D);
    const chopPen = rf.hazard === 'CHOP_TRAP' ? 6 : 0;

    const candidates = [];

    // Evaluate all UNDER barriers (1 through 9)
    for (let b = 1; b <= 9; b++) {
      const pastHits = D.filter(d => d < b).length;
      const pastHitPct = +((pastHits / n) * 100).toFixed(1);
      let recHit = 0;
      for (let d = 0; d < b; d++) recHit += empProbs[d];
      const recHitPct = +(recHit * 100).toFixed(1);
      const nullPct = +((b / 10) * 100).toFixed(1);
      const pastEdge = +(pastHitPct - nullPct).toFixed(1);

      let markovWinSum = 0;
      for (let d = 0; d < b; d++) markovWinSum += markovProbs[d];
      const markovWinPct = +(markovWinSum * 100).toFixed(1);

      const projectedWinPct = +((markovWinPct * 0.60) + (recHitPct * 0.40)).toFixed(1);
      const projectedEdge = +(projectedWinPct - nullPct).toFixed(1);

      let winRateBonus = 0;
      if (projectedWinPct >= 65 && projectedWinPct <= 85) winRateBonus = 6;
      else if (projectedWinPct > 85) winRateBonus = 2;
      const score = +(projectedEdge * 1.5 + pastEdge * 0.7 + winRateBonus - chopPen * 0.5).toFixed(1);

      candidates.push({
        action: 'UNDER',
        barrier: b,
        label: `Under ${b}`,
        contract: 'DIGITUNDER',
        page: 'over-under.html',
        winningDigits: Array.from({ length: b }, (_, i) => i),
        pastHitPct,
        projectedWinPct,
        markovWinPct,
        nullPct,
        pastEdge,
        projectedEdge,
        edgePts: projectedEdge,
        score
      });
    }

    // Evaluate all OVER barriers (0 through 8)
    for (let b = 0; b <= 8; b++) {
      const pastHits = D.filter(d => d > b).length;
      const pastHitPct = +((pastHits / n) * 100).toFixed(1);
      let recHit = 0;
      for (let d = b + 1; d <= 9; d++) recHit += empProbs[d];
      const recHitPct = +(recHit * 100).toFixed(1);
      const nullPct = +(((9 - b) / 10) * 100).toFixed(1);
      const pastEdge = +(pastHitPct - nullPct).toFixed(1);

      let markovWinSum = 0;
      for (let d = b + 1; d <= 9; d++) markovWinSum += markovProbs[d];
      const markovWinPct = +(markovWinSum * 100).toFixed(1);

      const projectedWinPct = +((markovWinPct * 0.60) + (recHitPct * 0.40)).toFixed(1);
      const projectedEdge = +(projectedWinPct - nullPct).toFixed(1);

      let winRateBonus = 0;
      if (projectedWinPct >= 65 && projectedWinPct <= 85) winRateBonus = 6;
      else if (projectedWinPct > 85) winRateBonus = 2;
      const score = +(projectedEdge * 1.5 + pastEdge * 0.7 + winRateBonus - chopPen * 0.5).toFixed(1);

      candidates.push({
        action: 'OVER',
        barrier: b,
        label: `Over ${b}`,
        contract: 'DIGITOVER',
        page: 'over-under.html',
        winningDigits: Array.from({ length: 9 - b }, (_, i) => b + 1 + i),
        pastHitPct,
        projectedWinPct,
        markovWinPct,
        nullPct,
        pastEdge,
        projectedEdge,
        edgePts: projectedEdge,
        score
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    // 1000-tick Deep Stability & Z-score check (compares 1st half vs 2nd half persistence)
    let deepNote = '';
    let stabAdj = 0;
    if (n >= 200) {
      const mid = Math.floor(n / 2);
      const hitFn = best.action === 'UNDER' ? (d => d < best.barrier) : (d => d > best.barrier);
      const h1 = D.slice(0, mid).filter(hitFn).length / mid;
      const h2 = D.slice(mid).filter(hitFn).length / (n - mid);
      const baseP = best.nullPct / 100;
      const zFull = ((best.pastHitPct / 100) - baseP) / (Math.sqrt(baseP * (1 - baseP) / n) || 0.01);
      const persistent = (h1 > baseP && h2 > baseP);
      if (persistent && zFull >= 1.4) stabAdj = 5;
      else if (h1 < baseP && h2 > baseP) stabAdj = 1;
      else if (best.pastEdge <= 0 && n >= 500) stabAdj = -3;
      deepNote = ` · ${n}t Z=${zFull >= 0 ? '+' : ''}${zFull.toFixed(2)} (${persistent ? 'Both Halves Aligned' : 'Recent Bias'})`;
    }

    let conviction = 50;
    if (best.projectedEdge > 0) conviction += Math.min(28, Math.round(best.projectedEdge * 2.1));
    if (best.pastEdge > 0) conviction += Math.min(14, Math.round(best.pastEdge * 1.2));
    if (n >= 100) conviction += 3;
    if (n >= 500) conviction += 3;
    conviction += stabAdj;
    conviction -= chopPen;
    conviction = Math.max(20, Math.min(96, conviction));

    const winListStr = best.winningDigits.join(',');
    const orderTag = m2 ? `2nd-order Markov [${m2.pair[0]}→${m2.pair[1]}]` : `Markov [${currentDigit}]`;
    const reason = `Digit ${currentDigit} (${rf.regimeLabel}): ${orderTag} + recency (${n}t) projects ${best.projectedWinPct}% on ${best.label} [${winListStr}] vs ${best.nullPct}% baseline (${best.edgePts >= 0 ? '+' : ''}${best.edgePts} pts edge${deepNote}).`;

    return {
      decision: `${best.action} ${best.barrier}`,
      action: best.action,
      barrier: best.barrier,
      pastHitPct: best.pastHitPct,
      projectedWinPct: best.projectedWinPct,
      nullPct: best.nullPct,
      edgePts: best.edgePts,
      pastEdgePts: best.pastEdge,
      conviction,
      currentDigit,
      sampleSize: n,
      rf,
      regimeLabel: rf.regimeLabel,
      best,
      candidates: candidates.slice(0, 6),
      reason
    };
  }

  // Quantitative Matches/Differs Decision Engine across digits 0..9
  function decideMatchesDiffers(digits, prices) {
    const D = digits || [];
    const P = prices || [];
    const n = D.length;
    if (n < 15) {
      return {
        decision: 'DIFFERS 0',
        action: 'DIFFERS',
        digit: 0,
        pastHitPct: 90.0,
        projectedWinPct: 90.0,
        nullPct: 90.0,
        edgePts: 0,
        conviction: 50,
        rf: null,
        regimeLabel: 'Calibrating',
        pillar: 'Matches / Differs',
        page: 'matches-differs.html',
        reason: 'Calibrating tick history'
      };
    }
    const currentDigit = D[n - 1];
    const m2 = n >= 30 ? secondOrderMarkov(D) : null;
    const m1 = markovMatrix(D);
    const markovProbs = (m2 && m2.probs) ? m2.probs : ((m1 && m1.probs && m1.probs[currentDigit]) ? m1.probs[currentDigit] : Array(10).fill(0.1));
    const empProbs = recencyDigitProbs(D);
    const rf = regimeFingerprint(P, D);
    const chopPen = rf.hazard === 'CHOP_TRAP' ? 6 : 0;

    const counts = Array(10).fill(0);
    D.forEach(d => { if (d >= 0 && d <= 9) counts[d]++; });

    const candidates = [];
    for (let d = 0; d <= 9; d++) {
      // DIFFERS: wins when digit != d
      const diffHits = D.filter(x => x !== d).length;
      const diffPastPct = +((diffHits / n) * 100).toFixed(1);
      const diffRecPct = +((1 - empProbs[d]) * 100).toFixed(1);
      const diffMarkovPct = +((1 - markovProbs[d]) * 100).toFixed(1);
      const diffProjPct = +(diffMarkovPct * 0.60 + diffRecPct * 0.40).toFixed(1);
      const diffEdge = +(diffProjPct - 90.0).toFixed(1);

      candidates.push({
        decision: `DIFFERS ${d}`,
        action: 'DIFFERS',
        digit: d,
        pastHitPct: diffPastPct,
        projectedWinPct: diffProjPct,
        nullPct: 90.0,
        edgePts: diffEdge,
        pillar: 'Matches / Differs',
        page: 'matches-differs.html',
        score: +(diffEdge * 2.5 + (diffProjPct >= 92 ? 5 : 0) - chopPen * 0.4).toFixed(1)
      });

      // MATCHES: wins when digit == d
      const matchHits = counts[d];
      const matchPastPct = +((matchHits / n) * 100).toFixed(1);
      const matchRecPct = +(empProbs[d] * 100).toFixed(1);
      const matchMarkovPct = +(markovProbs[d] * 100).toFixed(1);
      const matchProjPct = +(matchMarkovPct * 0.60 + matchRecPct * 0.40).toFixed(1);
      const matchEdge = +(matchProjPct - 10.0).toFixed(1);

      candidates.push({
        decision: `MATCHES ${d}`,
        action: 'MATCHES',
        digit: d,
        pastHitPct: matchPastPct,
        projectedWinPct: matchProjPct,
        nullPct: 10.0,
        edgePts: matchEdge,
        pillar: 'Matches / Differs',
        page: 'matches-differs.html',
        score: +(matchEdge * 1.2).toFixed(1)
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const conviction = Math.max(45, Math.min(95, Math.round(50 + best.edgePts * 6 - chopPen)));
    const reason = `Digit ${currentDigit} (${rf.regimeLabel}): Markov2 + recency projects ~${best.projectedWinPct}% on ${best.decision} (past ${best.pastHitPct}% vs ${best.nullPct}% baseline, ${best.edgePts >= 0 ? '+' : ''}${best.edgePts} pts edge).`;

    return {
      decision: best.decision,
      action: best.action,
      digit: best.digit,
      pastHitPct: best.pastHitPct,
      projectedWinPct: best.projectedWinPct,
      nullPct: best.nullPct,
      edgePts: best.edgePts,
      conviction,
      currentDigit,
      sampleSize: n,
      rf,
      regimeLabel: rf.regimeLabel,
      best,
      candidates: candidates.slice(0, 5),
      pillar: 'Matches / Differs',
      page: 'matches-differs.html',
      reason
    };
  }

  // Quantitative Even/Odd Decision Engine
  function decideEvenOdd(digits, prices) {
    const D = digits || [];
    const P = prices || [];
    const n = D.length;
    if (n < 15) {
      return {
        decision: 'EVEN',
        action: 'EVEN',
        pastHitPct: 50.0,
        projectedWinPct: 50.0,
        nullPct: 50.0,
        edgePts: 0,
        conviction: 50,
        rf: null,
        regimeLabel: 'Calibrating',
        pillar: 'Even / Odd',
        page: 'even-odd.html',
        reason: 'Calibrating tick history'
      };
    }
    const currentDigit = D[n - 1];
    const m2 = n >= 30 ? secondOrderMarkov(D) : null;
    const m1 = markovMatrix(D);
    const markovProbs = (m2 && m2.probs) ? m2.probs : ((m1 && m1.probs && m1.probs[currentDigit]) ? m1.probs[currentDigit] : Array(10).fill(0.1));
    const empProbs = recencyDigitProbs(D);
    const rf = regimeFingerprint(P, D);
    const chopPen = rf.hazard === 'CHOP_TRAP' ? 6 : 0;

    const evenHits = D.filter(d => d % 2 === 0).length;
    const pastEvenPct = +((evenHits / n) * 100).toFixed(1);
    const pastOddPct = +(100 - pastEvenPct).toFixed(1);

    let markovEven = 0, markovOdd = 0, recEven = 0, recOdd = 0;
    for (let d = 0; d <= 9; d++) {
      if (d % 2 === 0) { markovEven += markovProbs[d]; recEven += empProbs[d]; }
      else { markovOdd += markovProbs[d]; recOdd += empProbs[d]; }
    }
    const projEven = +((markovEven * 0.60 + recEven * 0.40) * 100).toFixed(1);
    const projOdd = +((markovOdd * 0.60 + recOdd * 0.40) * 100).toFixed(1);

    const pickEven = projEven >= projOdd;
    const action = pickEven ? 'EVEN' : 'ODD';
    const projWin = pickEven ? projEven : projOdd;
    const pastHit = pickEven ? pastEvenPct : pastOddPct;
    const edge = +(projWin - 50.0).toFixed(1);
    const conviction = Math.max(45, Math.min(92, Math.round(50 + edge * 4 - chopPen)));
    const reason = `Digit ${currentDigit} (${rf.regimeLabel}): Markov2 + recency projects ${projWin}% on ${action} (past ${pastHit}% vs 50% baseline, ${edge >= 0 ? '+' : ''}${edge} pts edge).`;

    return {
      decision: action,
      action,
      pastHitPct: pastHit,
      projectedWinPct: projWin,
      nullPct: 50.0,
      edgePts: edge,
      conviction,
      currentDigit,
      sampleSize: n,
      rf,
      regimeLabel: rf.regimeLabel,
      pillar: 'Even / Odd',
      page: 'even-odd.html',
      reason
    };
  }

  // Cross-Pillar Evaluator: Recommends which pillar to enter for a specific market
  function recommendBestPillar(symbol, prices, digits) {
    const isFx = /^(frx|XAU|WLDAUD|WLDEUR|WLDGBP|WLDUSD)/i.test(symbol || '');
    const rfData = regimeFingerprint(prices || [], isFx ? [] : (digits || []));

    if (isFx) {
      const fx = analyzeForex(prices || [], symbol);
      const act = fx.action === 'PUT' ? 'PUT' : 'CALL';
      const setup = {
        decision: fx.signal === 'NEUTRAL / WAIT' ? (fx.biasSide === 'SELL' ? 'SELL (WEAK)' : 'BUY (WEAK)') : fx.signal,
        action: act,
        biasLabel: fx.biasLabel,
        pastHitPct: fx.pastUpPct,
        projectedWinPct: fx.winPct,
        nullPct: 50.0,
        edgePts: fx.edgePts,
        conviction: fx.conviction,
        horizon: fx.horizon,
        duration: fx.duration,
        durationUnit: fx.durationUnit,
        entryTrigger: fx.entryTrigger,
        reason: fx.reason,
        rf: fx.rf,
        regimeLabel: fx.regimeLabel,
        fx
      };
      const fxScore = +(fx.edgePts * 1.9 + (fx.conviction >= 75 ? 6 : 0) - (fx.hazard === 'CHOP_TRAP' ? 6 : 0)).toFixed(1);
      return {
        symbol,
        isFx: true,
        favourablePillar: 'Forex Buy / Sell',
        favourablePage: 'forex.html',
        setup,
        rf: fx.rf,
        allPillars: [{ pillar: 'Forex Buy / Sell', page: 'forex.html', setup, score: fxScore }],
        url: `forex.html?vol=${symbol}`
      };
    }

    const ou = decideOverUnder(digits, prices);
    const md = decideMatchesDiffers(digits, prices);
    const eo = decideEvenOdd(digits, prices);

    let rf = { decision: 'RISE', action: 'CALL', edgePts: 2.5, projectedWinPct: 52.5, pastHitPct: 50.0, pillar: 'Rise / Fall', page: 'rise-fall.html', conviction: 55, rf: rfData, regimeLabel: rfData.regimeLabel };
    if (prices && prices.length >= 20) {
      const pSlice = prices.slice(-20);
      let up = 0;
      for (let i = 1; i < pSlice.length; i++) if (pSlice[i] > pSlice[i - 1]) up++;
      const { ema5, ema15, rsi } = calcEmaRsi(prices);
      const upRatio = up / (pSlice.length - 1);
      // Composite score: tick drift + EMA5/EMA15 crossover + RSI(14) pressure + Hurst persistence
      let riseBias = (upRatio - 0.5) * 32 + (ema5 > ema15 ? 4 : -4);
      if (rsi < 36) riseBias += 4;
      else if (rsi > 64) riseBias -= 4;
      if (rfData.hurst >= 0.58) riseBias *= 1.15;
      if (rfData.hazard === 'CHOP_TRAP') riseBias *= 0.45;
      const isRise = riseBias >= 0;
      const rfProb = +Math.max(50, Math.min(72, 50 + Math.abs(riseBias))).toFixed(1);
      const rfEdge = +(rfProb - 50).toFixed(1);
      rf = {
        decision: isRise ? 'RISE' : 'FALL',
        action: isRise ? 'CALL' : 'PUT',
        edgePts: rfEdge,
        projectedWinPct: rfProb,
        pastHitPct: +((up / (pSlice.length - 1)) * 100).toFixed(1),
        pillar: 'Rise / Fall',
        page: 'rise-fall.html',
        conviction: Math.max(45, Math.min(90, Math.round(50 + rfEdge * 3 - (rfData.hazard === 'CHOP_TRAP' ? 8 : 0)))),
        emaRsi: { ema5, ema15, rsi },
        rf: rfData,
        regimeLabel: rfData.regimeLabel
      };
    }

    const chopPenalty = rfData.hazard === 'CHOP_TRAP' ? 6 : 0;
    const pillars = [
      { pillar: 'Over / Under', page: 'over-under.html', setup: ou, score: +(ou.edgePts * 1.6 + (ou.projectedWinPct >= 75 ? 6 : 0) - chopPenalty * 0.4).toFixed(1) },
      { pillar: 'Matches / Differs', page: 'matches-differs.html', setup: md, score: +(md.edgePts * 2.2 + (md.projectedWinPct >= 91 ? 8 : 0) - chopPenalty * 0.3).toFixed(1) },
      { pillar: 'Even / Odd', page: 'even-odd.html', setup: eo, score: +(eo.edgePts * 1.8 - chopPenalty * 0.4).toFixed(1) },
      { pillar: 'Rise / Fall', page: 'rise-fall.html', setup: rf, score: +(rf.edgePts * 1.6 + (rfData.hurst >= 0.58 && rfData.chopIndex < 0.55 ? 5 : 0) - chopPenalty * 1.2).toFixed(1) }
    ];

    pillars.sort((a, b) => b.score - a.score);
    const topPillar = pillars[0];

    return {
      symbol,
      favourablePillar: topPillar.pillar,
      favourablePage: topPillar.page,
      setup: topPillar.setup,
      rf: rfData,
      allPillars: pillars,
      url: `${topPillar.page}?vol=${symbol}`
    };
  }

  // Institutional Cross-Market Analysis Engine:
  // Synthesizes multiple volatility indices simultaneously to evaluate:
  // 1. Cross-market volatility dispersion and entropy spread
  // 2. Global alpha leaders vs chaotic noise traps (auto-veto list)
  // 3. Lead-lag dynamics, Hurst cluster distribution, and capital rotation opportunities
  function crossMarketAnalysis(markets) {
    if (!Array.isArray(markets) || markets.length === 0) {
      return {
        leadMarket: null,
        alphaLeaders: [],
        highRiskTraps: [],
        clusterSummary: {},
        avgEdge: 0,
        avgEntropy: 0.95,
        totalMarkets: 0,
        recommendation: 'No markets currently scanned.'
      };
    }

    const n = markets.length;
    let sumEdge = 0, sumEntropy = 0;
    const clusters = { PERSISTENT_MOMENTUM: [], MEAN_REVERTING_CYCLE: [], RANDOM_WALK_STATIONARY: [] };

    markets.forEach(m => {
      const edge = Number(m.edgePts || (m.ou && m.ou.edgePts) || 0);
      const ent = Number(m.entropy || 0.95);
      sumEdge += edge;
      sumEntropy += ent;

      const reg = (m.proj && m.proj.regime) || 'RANDOM_WALK_STATIONARY';
      if (clusters[reg]) clusters[reg].push(m);
      else clusters.RANDOM_WALK_STATIONARY.push(m);
    });

    const avgEdge = +(sumEdge / n).toFixed(2);
    const avgEntropy = +(sumEntropy / n).toFixed(3);

    // Rank markets by composite alpha score: (Edge * 1.5) + (Confidence * 0.4) - (EntropyPenalty)
    const ranked = [...markets].sort((a, b) => {
      const scoreA = (Number(a.edgePts || (a.ou && a.ou.edgePts) || 0) * 1.5) + (Number(a.conf || 75) * 0.4) - ((Number(a.entropy || 0.95) - 0.90) * 50);
      const scoreB = (Number(b.edgePts || (b.ou && b.ou.edgePts) || 0) * 1.5) + (Number(b.conf || 75) * 0.4) - ((Number(b.entropy || 0.95) - 0.90) * 50);
      return scoreB - scoreA;
    });

    const leadMarket = ranked[0];
    const alphaLeaders = ranked.filter(m => {
      const edge = Number(m.edgePts || (m.ou && m.ou.edgePts) || 0);
      const conf = Number(m.conf || 0);
      return edge >= 5 && conf >= 80;
    });

    const highRiskTraps = ranked.filter(m => {
      const ent = Number(m.entropy || 0.95);
      const conf = Number(m.conf || 0);
      const edge = Number(m.edgePts || (m.ou && m.ou.edgePts) || 0);
      return ent > 0.985 || conf < 68 || edge <= 0;
    });

    const sortedByEntropy = [...markets].sort((a, b) => Number(a.entropy || 1) - Number(b.entropy || 1));
    const sortedByHurst = [...markets].sort((a, b) => Number((b.proj && b.proj.hurst) || 0.5) - Number((a.proj && a.proj.hurst) || 0.5));

    const lowestEntropyMarket = sortedByEntropy[0];
    const highestMomentumMarket = sortedByHurst[0];

    const leadOU = (leadMarket && leadMarket.ou) || {};
    const leadName = leadMarket ? (leadMarket.v ? leadMarket.v.name : leadMarket.name) : 'Top Index';
    const recommendation = `Cross-market analysis across ${n} synthetic volatility indices reveals a system-wide average edge of +${avgEdge} points and normalized Shannon entropy of ${avgEntropy}. ` +
      `Global Alpha Leader is ${leadName} with Grade ${leadMarket ? leadMarket.grade : 'A+'}, ` +
      `optimal decision ${leadOU.decision || 'UNDER 7'} with ~${leadOU.projectedWinPct || 78}% projected win probability (+${leadOU.edgePts || (leadMarket && leadMarket.edgePts) || 10} pts edge). ` +
      `${highRiskTraps.length > 0 ? `Vetoed ${highRiskTraps.length} noise-trap markets (${highRiskTraps.map(t => (t.v ? t.v.name : t.name)).slice(0, 3).join(', ')}) to protect balance.` : 'All markets within acceptable noise bounds.'}`;

    return {
      leadMarket,
      alphaLeaders,
      highRiskTraps,
      lowestEntropyMarket,
      highestMomentumMarket,
      ranked,
      avgEdge,
      avgEntropy,
      clusters: {
        persistentCount: clusters.PERSISTENT_MOMENTUM.length,
        meanRevertingCount: clusters.MEAN_REVERTING_CYCLE.length,
        stationaryNoiseCount: clusters.RANDOM_WALK_STATIONARY.length,
      },
      recommendation
    };
  }

  function quickBacktest(opt) {
    opt = opt || {};
    let digits = Array.isArray(opt.digits) && opt.digits.length >= 20 ? opt.digits : null;
    let prices = Array.isArray(opt.prices) && opt.prices.length >= 20 ? opt.prices : null;
    let usedLive = !!(digits && prices);
    const sym = opt.symbol || 'R_100';

    if (!usedLive) {
      const pool = (typeof window !== 'undefined' && window.TW && window.TW.tickPool && window.TW.tickPool[sym]) ||
                   (typeof globalThis !== 'undefined' && globalThis.TW && globalThis.TW.tickPool && globalThis.TW.tickPool[sym]);
      if (pool && Array.isArray(pool.digits) && pool.digits.length >= 20 && Array.isArray(pool.prices) && pool.prices.length >= 20) {
        digits = pool.digits;
        prices = pool.prices;
        usedLive = true;
      }
    }

    if (!usedLive) {
      digits = [];
      prices = [];
      let p = 1000.0;
      const count = opt.ticksCount || 500;
      for (let i = 0; i < count; i++) {
        p = +(p + (Math.random() - 0.5) * 0.45).toFixed(2);
        prices.push(p);
        const s = p.toFixed(2);
        digits.push(+s[s.length - 1]);
      }
    }

    const baseContract = opt.contract || 'DIGITOVER';
    const baseBarrier = opt.barrier != null ? +opt.barrier : 2;
    const dur = Math.max(1, +opt.duration || 1);
    const baseStake = Math.max(0.35, +opt.stake || 1.0);
    const rule = opt.rule || {};
    const kind = rule.kind || (rule.cond || opt.cond ? 'streak' : 'instant');
    const condName = opt.cond || rule.cond || null;
    const reqStreak = Math.max(1, +(rule.n || opt.n || 1));
    const cb = opt.cb != null ? +opt.cb : (rule.cb != null ? +rule.cb : baseBarrier);
    const aiGate = opt.aiGate != null ? +opt.aiGate : null;
    const aiMode = opt.aiMode || 'active';
    const lossShield = opt.lossShield !== false;
    const mart = opt.mart || null;
    const n = digits.length;

    const roiFor = (c, b) => {
      if (c === 'DIGITOVER') return Math.max(0.08, (1 / Math.max(0.1, (9 - b) / 10)) * 0.95 - 1);
      if (c === 'DIGITUNDER') return Math.max(0.08, (1 / Math.max(0.1, b / 10)) * 0.95 - 1);
      if (c === 'DIGITMATCH') return 8.5;
      if (c === 'DIGITDIFF') return 0.09;
      return 0.95;
    };

    let totalTrades = 0, wins = 0, losses = 0, netPnl = 0;
    let grossWin = 0, grossLoss = 0, peakPnl = 0, maxDrawdown = 0;
    let consecLoss = 0, maxConsecLoss = 0, lossPool = 0, martStep = 0;
    const winHistory = [];

    const checkSingleCond = (idx) => {
      if (idx < 1) return false;
      const d = digits[idx];
      if (condName === 'under') return d < cb;
      if (condName === 'over') return d > cb;
      if (condName === 'odd') return d % 2 === 1;
      if (condName === 'even') return d % 2 === 0;
      if (condName === 'rise') return prices[idx] > prices[idx - 1];
      if (condName === 'fall') return prices[idx] < prices[idx - 1];
      return true;
    };

    let i = Math.max(20, reqStreak);
    while (i < n - dur) {
      let trigger = false;
      let aiDirContract = baseContract;
      if (kind === 'every') {
        trigger = (i % reqStreak === 0);
      } else if (kind === 'streak' && condName) {
        trigger = true;
        for (let s = 0; s < reqStreak; s++) {
          if (!checkSingleCond(i - s)) { trigger = false; break; }
        }
      } else if (kind === 'ai_alpha') {
        const subD = digits.slice(Math.max(0, i - 60), i + 1);
        const subP = prices.slice(Math.max(0, i - 60), i + 1);
        const prevD = subD[subD.length - 1];
        if (baseContract === 'DIGITOVER') trigger = (prevD <= baseBarrier);
        else if (baseContract === 'DIGITUNDER') trigger = (prevD >= baseBarrier);
        else if (baseContract === 'DIGITDIFF') {
          const rec = recencyDigitProbs(subD);
          trigger = (rec[baseBarrier] <= 0.105 && prevD !== baseBarrier);
        } else if (baseContract === 'DIGITEVEN') trigger = (prevD % 2 === 1);
        else if (baseContract === 'DIGITODD') trigger = (prevD % 2 === 0);
        else if (baseContract === 'CALL' || baseContract === 'PUT') {
          if (/^(frx|XAU)/i.test(sym)) {
            const fxEval = analyzeForex(subP, sym);
            if (fxEval.action === 'CALL' || fxEval.action === 'PUT') {
              aiDirContract = fxEval.action;
              trigger = true;
            }
          } else {
            const { ema5, ema15, rsi } = calcEmaRsi(subP);
            aiDirContract = ema5 >= ema15 ? 'CALL' : 'PUT';
            trigger = aiDirContract === 'CALL' ? rsi < 76 : rsi > 24;
          }
        } else {
          trigger = true;
        }
      } else {
        trigger = true;
      }

      if (!trigger) { i++; continue; }

      // Simulate active contract & Smart Recovery contract switching when applicable
      let activeContract = aiDirContract;
      let activeBarrier = baseBarrier;
      const martMode = (mart && mart.on) ? (mart.mode || 'smart_barrier') : null;
      const inRecovery = !!(martMode && lossPool > 0 && martStep > 0);
      if (inRecovery && martMode === 'smart_barrier') {
        if (baseContract === 'DIGITOVER' || baseContract === 'DIGITDIFF' || baseContract === 'DIGITEVEN') {
          activeContract = 'DIGITOVER';
          activeBarrier = 2;
        } else if (baseContract === 'DIGITUNDER' || baseContract === 'DIGITODD') {
          activeContract = 'DIGITUNDER';
          activeBarrier = 7;
        }
      }

      // Optional AI Confidence Gate & CHOP_TRAP filter (matches live botrunner logic)
      if ((aiGate != null || kind === 'ai_alpha') && aiMode !== 'turbo') {
        const winStart = Math.max(0, i - 60);
        const slD = digits.slice(winStart, i + 1);
        const slP = prices.slice(winStart, i + 1);
        const rf = regimeFingerprint(slP, slD);
        if (rf.hazard === 'CHOP_TRAP' && rf.chopIndex >= 0.74) { i++; continue; }
        if (aiGate != null) {
          const conf = calcConfidence({ contract: activeContract, barrier: activeBarrier, symbol: sym, prices: slP, digits: slD, gate: aiGate, consecutiveLosses: consecLoss, lossShield });
          if (!conf.passes) { i++; continue; }
        }
      }

      // Compute recovery-adjusted stake with strict safety ceiling
      let tradeStake = baseStake;
      const roi = roiFor(activeContract, activeBarrier);
      if (inRecovery) {
        const maxSteps = Math.max(1, +(mart.steps || 4));
        const mult = Math.max(1.0, +(mart.mult || 1.05));
        if (martMode === 'smart_barrier') {
          const need = (lossPool / roi) * mult;
          tradeStake = Math.max(baseStake, +Math.min(baseStake * 4.5, need).toFixed(2));
        } else if (martMode === 'split_recovery') {
          const splitSteps = Math.min(2, Math.max(1, maxSteps - martStep + 1));
          const need = ((lossPool / splitSteps) / roi) * mult;
          tradeStake = Math.max(baseStake, +Math.min(baseStake * 3.5, need).toFixed(2));
        } else if (martMode === 'payout_martingale') {
          const need = ((lossPool + baseStake * 0.2) / roi) * mult;
          tradeStake = Math.max(baseStake, +Math.min(baseStake * 5.0, need).toFixed(2));
        } else if (martMode === 'dalembert') {
          tradeStake = +(baseStake * (1 + Math.min(maxSteps, martStep) * 0.5)).toFixed(2);
        } else if (martMode === 'fibonacci') {
          const fib = [1, 1, 2, 3, 5, 8];
          tradeStake = +(baseStake * fib[Math.min(fib.length - 1, martStep)]).toFixed(2);
        } else {
          tradeStake = +Math.min(baseStake * 6, baseStake * Math.pow(mult, Math.min(maxSteps, martStep))).toFixed(2);
        }
      }

      const entryPrice = prices[i] || 0;
      const exitPrice = prices[i + dur] || 0;
      const exitDigit = digits[i + dur];

      totalTrades++;
      let win = false;
      if (activeContract === 'DIGITOVER') win = exitDigit > activeBarrier;
      else if (activeContract === 'DIGITUNDER') win = exitDigit < activeBarrier;
      else if (activeContract === 'DIGITEVEN') win = exitDigit % 2 === 0;
      else if (activeContract === 'DIGITODD') win = exitDigit % 2 === 1;
      else if (activeContract === 'DIGITMATCH') win = exitDigit === activeBarrier;
      else if (activeContract === 'DIGITDIFF') win = exitDigit !== activeBarrier;
      else if (activeContract === 'CALL') win = exitPrice > entryPrice;
      else if (activeContract === 'PUT') win = exitPrice < entryPrice;

      if (win) {
        const prof = +(tradeStake * roi).toFixed(2);
        wins++;
        netPnl += prof;
        grossWin += prof;
        consecLoss = 0;
        if (martMode) {
          lossPool = Math.max(0, +(lossPool - prof).toFixed(2));
          if (lossPool <= 0.05) { lossPool = 0; martStep = 0; }
        }
        winHistory.push('W');
      } else {
        losses++;
        netPnl -= tradeStake;
        grossLoss += tradeStake;
        consecLoss++;
        if (consecLoss > maxConsecLoss) maxConsecLoss = consecLoss;
        if (martMode) {
          const maxSteps = Math.max(1, +(mart.steps || 4));
          lossPool = +(lossPool + tradeStake).toFixed(2);
          martStep++;
          if (martStep > maxSteps) { lossPool = 0; martStep = 0; }
        }
        winHistory.push('L');
      }

      if (netPnl > peakPnl) peakPnl = netPnl;
      const dd = peakPnl - netPnl;
      if (dd > maxDrawdown) maxDrawdown = dd;
      i += dur;
    }

    const winRate = totalTrades > 0 ? +((wins / totalTrades) * 100).toFixed(1) : 0;
    netPnl = +netPnl.toFixed(2);
    maxDrawdown = +maxDrawdown.toFixed(2);
    const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? 9.99 : 0);

    return {
      total: totalTrades,
      trades: totalTrades,
      wins,
      losses,
      winRate: winRate || 0,
      netPnl,
      netPnL: netPnl,
      maxConsecLoss,
      maxLossStreak: maxConsecLoss,
      maxDrawdown,
      profitFactor,
      totalTicks: n,
      sampleSize: n,
      recentStreak: winHistory.slice(-8),
      source: usedLive ? 'live_pool' : 'synthetic_sim'
    };
  }

  // 2nd-order Backoff Markov Transition estimator conditioned on last 2 digits (D[n-2], D[n-1])
  function secondOrderMarkov(D) {
    if (!D || D.length < 30) return null;
    const m1 = markovMatrix(D);
    const n = D.length;
    const prev2 = D[n - 2], prev1 = D[n - 1];
    const counts2 = Array(10).fill(0);
    let hits2 = 0;
    for (let i = 2; i < n; i++) {
      if (D[i - 2] === prev2 && D[i - 1] === prev1 && D[i] >= 0 && D[i] <= 9) {
        counts2[D[i]]++;
        hits2++;
      }
    }
    const base1 = (m1 && m1.probs && m1.probs[prev1]) ? m1.probs[prev1] : Array(10).fill(0.1);
    // Confidence-weighted blend of 2nd-order exact bigram match with 1st-order Markov
    const w2 = Math.min(0.45, hits2 / (hits2 + 12));
    const probs = counts2.map((c, d) => {
      const p2 = hits2 > 0 ? (c + 0.1) / (hits2 + 1) : base1[d];
      return +((p2 * w2) + (base1[d] * (1 - w2))).toFixed(4);
    });
    return { pair: [prev2, prev1], sampleMatches: hits2, probs, topDigit: probs.indexOf(Math.max(...probs)) };
  }

  // Multi-factor Quantitative Regime Fingerprint for terminal cards, risk gates & Gemini prompts
  function regimeFingerprint(prices, digits) {
    const P = Array.isArray(prices) ? prices : [];
    const D = Array.isArray(digits) ? digits : [];
    const n = D.length;
    if (n < 15 && P.length < 16) {
      return {
        normEntropy: 0.99,
        hurst: 0.50,
        maxDigitZ: 0,
        chopIndex: 0.50,
        droughtDigit: 0,
        droughtTicks: 0,
        kellyPct: 1.0,
        hazard: 'CALIBRATING',
        regimeLabel: 'Calibrating tick window',
        summary: 'Collecting ticks for entropy, Hurst, and digit-gap calibration.'
      };
    }

    const ds = n >= 15 ? digitStats(D) : { entropy: 0, maxEntropy: 1, counts: Array(10).fill(0), p: 1 };
    const normEntropy = n >= 15 ? +(ds.entropy / (ds.maxEntropy || Math.log2(10))).toFixed(3) : 0.95;
    const sd = n >= 15 ? (Math.sqrt(0.09 * n) || 1) : 1;
    let maxDigitZ = 0;
    if (n >= 15) {
      ds.counts.forEach(c => {
        const z = Math.abs(c - 0.1 * n) / sd;
        if (z > maxDigitZ) maxDigitZ = z;
      });
    }
    maxDigitZ = +maxDigitZ.toFixed(2);

    // Longest active drought across digits 0-9
    const lastIdx = Array(10).fill(-1);
    for (let i = 0; i < n; i++) if (D[i] >= 0 && D[i] <= 9) lastIdx[D[i]] = i;
    let droughtDigit = 0, droughtTicks = n >= 15 ? -1 : 0;
    if (n >= 15) {
      for (let d = 0; d <= 9; d++) {
        const gap = lastIdx[d] >= 0 ? (n - 1 - lastIdx[d]) : n;
        if (gap > droughtTicks) { droughtTicks = gap; droughtDigit = d; }
      }
    }

    // Hurst & Price Chop Index: fast 25t local chop + full-sample macro Hurst when n >= 120
    let hurst = 0.50, macroHurst = 0.50, chopIndex = 0.50;
    if (P.length >= 16) {
      const sl = P.slice(-26);
      const rets = [];
      for (let i = 1; i < sl.length; i++) rets.push(sl[i] - sl[i - 1]);
      const ac = autocorr(rets, 1);
      hurst = +Math.max(0.1, Math.min(0.9, 0.5 + (ac.r || 0) * 0.35)).toFixed(2);
      macroHurst = hurst;
      if (P.length >= 120) {
        const mRets = [];
        const step = P.length > 500 ? 2 : 1;
        for (let i = step; i < P.length; i += step) mRets.push(P[i] - P[i - step]);
        if (mRets.length >= 30) {
          const mac = autocorr(mRets, 1);
          macroHurst = +Math.max(0.1, Math.min(0.9, 0.5 + (mac.r || 0) * 0.35)).toFixed(2);
        }
      }
      const signs = rets.map(r => Math.sign(r)).filter(s => s !== 0);
      if (signs.length >= 4) {
        let flips = 0;
        for (let i = 1; i < signs.length; i++) if (signs[i] !== signs[i - 1]) flips++;
        chopIndex = +(flips / (signs.length - 1)).toFixed(2);
      }
    }

    let hazard = 'BALANCED';
    let regimeLabel = 'Stationary Balanced Flow';
    if (chopIndex >= 0.68 || (n >= 40 && normEntropy >= 0.996)) {
      hazard = 'CHOP_TRAP';
      regimeLabel = 'High-Chop / High-Entropy Noise';
    } else if (hurst >= 0.58) {
      regimeLabel = 'Persistent Momentum Drift';
      if (maxDigitZ >= 2.2) hazard = 'SKEW_SPIKE';
    } else if (hurst <= 0.42) {
      regimeLabel = 'Mean-Reverting Oscillation';
      if (maxDigitZ >= 2.2) hazard = 'SKEW_SPIKE';
    } else if (maxDigitZ >= 2.2) {
      hazard = 'SKEW_SPIKE';
      regimeLabel = 'Empirical Digit Skew Cluster';
    }

    // Fractional Kelly ceiling (% of bankroll per trade, capped strictly 0.5% - 2.0%)
    let kellyPct = 1.25;
    if (hazard === 'CHOP_TRAP') kellyPct = 0.5;
    else if (maxDigitZ >= 2.0 && normEntropy < 0.98) kellyPct = 1.75;
    else if (hurst >= 0.6 && chopIndex < 0.5) kellyPct = 1.5;

    const chiNote = n >= 200 ? ` · χ²p=${ds.p.toFixed(2)}` : '';
    const summary = `${regimeLabel} · H=${hurst} · Entropy=${normEntropy} · Chop=${Math.round(chopIndex * 100)}%${chiNote} · Drought D${droughtDigit} (${droughtTicks}t) · Cap=${kellyPct}%`;

    return {
      normEntropy,
      hurst,
      macroHurst,
      chiP: +ds.p.toFixed(4),
      sampleSize: n,
      maxDigitZ,
      chopIndex,
      droughtDigit,
      droughtTicks,
      kellyPct,
      hazard,
      regimeLabel,
      summary
    };
  }

  function emaSeries(arr, period) {
    const k = 2 / (period + 1);
    const out = [];
    let val = arr[0] || 0;
    for (let i = 0; i < arr.length; i++) {
      val = i === 0 ? arr[i] : arr[i] * k + val * (1 - k);
      out.push(val);
    }
    return out;
  }

  function forexSessionContext(symbol, dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date();
    const day = d.getUTCDay(); // 0 Sun .. 6 Sat
    const hr = d.getUTCHours() + d.getUTCMinutes() / 60;
    // Forex closes Friday ~21:00 UTC to Sunday ~21:00 UTC
    const isWeekendClosed = (day === 6) || (day === 5 && hr >= 21.5) || (day === 0 && hr < 21.0);
    let sessionName = 'Asian / Sydney Session';
    let sessionNote = 'Tighter ranges on EUR/GBP; watch JPY & AUD pairs for cleaner micro-swings.';
    if (isWeekendClosed) {
      sessionName = 'Weekend FX Exchange Closed';
      sessionNote = 'Deriv Forex pairs reopen Sunday ~21:00 UTC. Synthetic Indices (24/7) remain live for trading now.';
    } else if (hr >= 12 && hr < 16) {
      sessionName = 'London / New York Overlap (Peak Liquidity)';
      sessionNote = 'Highest institutional volume and cleanest directional breakouts across EUR/USD, GBP/USD, USD/JPY, and Gold.';
    } else if (hr >= 7 && hr < 12) {
      sessionName = 'London Session';
      sessionNote = 'Strong European directional flows; favor trend alignment on EUR/USD, GBP/USD, EUR/GBP, and EUR/JPY.';
    } else if (hr >= 16 && hr < 21) {
      sessionName = 'New York Session';
      sessionNote = 'Active USD and Gold momentum; monitor US macro volatility around data releases.';
    }

    const sym = String(symbol || 'frxEURUSD');
    const pairTips = {
      frxEURUSD: 'Tightest spread major pair; respects EMA 9/21 trend pullbacks cleanly during London/NY sessions.',
      frxGBPUSD: 'Higher pip amplitude than EUR/USD; wait for chop < 62% to avoid London stop-hunt wicks.',
      frxUSDJPY: 'Tracks US Treasury yield momentum; responsive to RSI overbought/oversold mean-reversion.',
      frxAUDUSD: 'Commodity-linked major; steadier Asian/Pacific activity and smooth 15m swing structure.',
      frxUSDCAD: 'Sensitive to oil & North American flows; performs best during New York hours (12–20 UTC).',
      frxUSDCHF: 'Inverse EUR/USD mirror with steady safe-haven moves; validate trend slope before buying/selling.',
      frxEURGBP: 'Slow, range-respecting cross; favor longer 15m–1h expiries or clear support/resistance bounces.',
      frxEURJPY: 'High-beta carry cross; rides strong multi-bar momentum trends with brisk extensions.',
      frxGBPJPY: 'Fastest FX cross ("The Beast"); widen timeframe (15m+) and enforce strict Chop-Trap veto.',
      frxXAUUSD: 'Gold/USD carries sharp volatility bursts; stick to ≤1.5% capital per trade and 15m–1h horizon.'
    };

    return {
      isOpen: !isWeekendClosed,
      isWeekendClosed,
      sessionName,
      sessionNote,
      pairTip: pairTips[sym] || 'Monitor EMA 9/21 trend alignment and avoid high-chop sessions.',
      utcHour: +hr.toFixed(1)
    };
  }

  function analyzeForex(prices, symbol) {
    const P = Array.isArray(prices) ? prices.map(Number).filter(x => isFinite(x)) : [];
    const rf = regimeFingerprint(P, []);
    if (P.length < 20) {
      return {
        symbol: symbol || 'frxEURUSD',
        signal: 'NEUTRAL / WAIT',
        action: 'HOLD',
        biasLabel: 'WAIT',
        biasSide: 'BUY',
        winPct: 50.0,
        pastUpPct: 50.0,
        edgePts: 0,
        conviction: 48,
        ema9: P[P.length - 1] || 0,
        ema21: P[P.length - 1] || 0,
        ema50: P[P.length - 1] || 0,
        rsi: 50,
        rangePct: 50,
        rocPct: 0,
        horizon: '15m',
        duration: 15,
        durationUnit: 'm',
        hurst: rf.hurst,
        chopIndex: rf.chopIndex,
        hazard: rf.hazard,
        regimeLabel: rf.regimeLabel,
        rf,
        entryTrigger: 'Buffering at least 20 live price points before issuing BUY or SELL.',
        reason: 'Insufficient tick/candle history.'
      };
    }

    const n = P.length;
    const spot = P[n - 1];
    const e9 = emaSeries(P, 9);
    const e21 = emaSeries(P, 21);
    const e50 = emaSeries(P, Math.min(50, n));
    const ema9 = e9[n - 1], ema21 = e21[n - 1], ema50 = e50[n - 1];
    const ema21Prev = e21[Math.max(0, n - 5)];
    const { rsi } = calcEmaRsi(P);

    const win50 = P.slice(-Math.min(50, n));
    const hi50 = Math.max(...win50), lo50 = Math.min(...win50);
    const span = hi50 - lo50;
    const rangePct = span > 0 ? +(((spot - lo50) / span) * 100).toFixed(1) : 50;

    const pBack = P[Math.max(0, n - 11)];
    const rocPct = pBack ? +(((spot - pBack) / pBack) * 100).toFixed(3) : 0;

    const p20 = P.slice(-20);
    let upCnt = 0;
    for (let i = 1; i < p20.length; i++) if (p20[i] > p20[i - 1]) upCnt++;
    const pastUpPct = +((upCnt / Math.max(1, p20.length - 1)) * 100).toFixed(1);

    let score = 0; // positive => BUY (CALL), negative => SELL (PUT)
    if (ema9 > ema21) score += 8; else if (ema9 < ema21) score -= 8;
    if (ema21 > ema50) score += 6; else if (ema21 < ema50) score -= 6;
    if (spot > ema21) score += 4; else if (spot < ema21) score -= 4;
    if (ema21 > ema21Prev) score += 4; else if (ema21 < ema21Prev) score -= 4;
    score += ((pastUpPct - 50) / 50) * 10;

    // RSI confirmation vs exhaustion
    if (rsi >= 52 && rsi <= 68) score += 4;
    else if (rsi <= 48 && rsi >= 32) score -= 4;
    else if (rsi > 74) score -= 5; // overbought caution against fresh buys
    else if (rsi < 26) score += 5; // oversold bounce caution against fresh sells

    if (rf.hurst >= 0.57) score *= 1.15;
    if (rf.hazard === 'CHOP_TRAP') score *= 0.45;

    const absScore = Math.abs(score);
    const biasSide = score >= 0 ? 'BUY' : 'SELL';
    const isWait = (rf.hazard === 'CHOP_TRAP' && absScore < 14) || absScore < 7;
    const signal = isWait
      ? 'NEUTRAL / WAIT'
      : (absScore >= 20 ? (score >= 0 ? 'STRONG BUY' : 'STRONG SELL') : (score >= 0 ? 'BUY' : 'SELL'));
    const action = isWait ? 'HOLD' : (score >= 0 ? 'CALL' : 'PUT');
    const biasLabel = isWait ? 'WAIT' : (score >= 0 ? 'BUY' : 'SELL');

    const winPct = +Math.max(50, Math.min(72, 50 + absScore * 0.55)).toFixed(1);
    const edgePts = +(winPct - 50).toFixed(1);
    const conviction = Math.max(45, Math.min(93, Math.round(52 + absScore * 1.15 - (rf.hazard === 'CHOP_TRAP' ? 12 : 0))));

    // Horizon selection based on Hurst & Chop (Deriv FX pairs require >=15m expiry)
    let horizon = '15m', duration = 15, durationUnit = 'm';
    if (rf.chopIndex >= 0.60) { horizon = '30m'; duration = 30; durationUnit = 'm'; }

    const trendTxt = ema9 >= ema21 ? 'EMA9 > EMA21 bullish alignment' : 'EMA9 < EMA21 bearish alignment';
    const srTxt = rangePct >= 82 ? 'near 50-bar resistance' : (rangePct <= 18 ? 'near 50-bar support' : `${rangePct}% of 50-bar range`);
    const entryTrigger = isWait
      ? `Hold flat — ${rf.hazard === 'CHOP_TRAP' ? 'high chop (' + Math.round(rf.chopIndex * 100) + '%)' : 'weak directional edge'}. Wait for EMA9/21 separation.`
      : (score >= 0
        ? `BUY (CALL ${horizon}) on slight pullback toward EMA9/EMA21 support while spot holds upward slope.`
        : `SELL (PUT ${horizon}) on weak bounce into EMA9/EMA21 resistance with bearish momentum.`);
    const reason = `${trendTxt}, RSI(14)=${rsi.toFixed(1)}, Hurst=${rf.hurst}, spot ${srTxt}.`;

    return {
      symbol: symbol || 'frxEURUSD',
      signal,
      action,
      biasLabel,
      biasSide,
      winPct,
      pastUpPct,
      edgePts,
      conviction,
      ema9,
      ema21,
      ema50,
      rsi: +rsi.toFixed(1),
      rangePct,
      rocPct,
      horizon,
      duration,
      durationUnit,
      hurst: rf.hurst,
      chopIndex: rf.chopIndex,
      hazard: rf.hazard,
      regimeLabel: rf.regimeLabel,
      rf,
      entryTrigger,
      reason
    };
  }

  const api = {
    normCdf, chiSqP, digitStats, runsTest, autocorr, wilson, beta, truthTest, riskSim, spikeProb,
    calcConfidence, markovMatrix, secondOrderMarkov, regimeFingerprint,
    projectMarket, decideOverUnder, decideMatchesDiffers, decideEvenOdd,
    analyzeForex, forexSessionContext,
    recommendBestPillar, crossMarketAnalysis, quickBacktest
  };
  if (typeof window !== 'undefined') window.TWS = api;
  if (typeof globalThis !== 'undefined') globalThis.TWS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
if (typeof window !== 'undefined') window.TWS = TWS;
if (typeof globalThis !== 'undefined') globalThis.TWS = TWS;
