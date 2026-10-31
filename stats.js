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
  const spikeProb = (N, k) => 1 - Math.pow(1 - 1 / N, k);
  const api = { normCdf, chiSqP, digitStats, runsTest, autocorr, wilson, beta, truthTest, riskSim, spikeProb };
  if (typeof module !== 'undefined') module.exports = api; return api;
})();
