const T = require('../stats.js'); let f = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) f++; };
ok(Math.abs(T.normCdf(1.96) - 0.975) < 0.001, 'normCdf(1.96) is about 0.975');
ok(Math.abs(T.chiSqP(16.92, 9) - 0.05) < 0.005, 'chi-square p for 16.92 with 9 df is about 0.05');
ok(T.runsTest(Array.from({ length: 200 }, (_, i) => i % 2 === 0)).p < 0.001, 'runs test flags a perfectly alternating sequence');
ok(T.runsTest(Array.from({ length: 4000 }, () => Math.random() < .5)).p > 0.0005, 'runs test accepts random');
const w = T.wilson(50, 100); ok(w[0] > .39 && w[0] < .41 && w[1] > .59 && w[1] < .61, 'Wilson 50/100 is about 0.40 to 0.60');
const D = Array.from({ length: 6000 }, () => Math.floor(Math.random() * 10)), tt = T.truthTest(D, null);
ok(tt.length === 4 && tt.every(r => Math.abs(r.rate - .1) < .02), 'truth-test models score about 10% on random digits');
let acc = 100; const P = Array.from({ length: 6000 }, () => (acc += Math.random() - .5)), // random walk, like real ticks
   mt = T.truthTest(D, P).filter(r => r.p0 === .5); ok(mt.length === 2 && mt.every(r => Math.abs(r.rate - .5) < .03), 'move models score about 50% on a random walk');
const flat = T.riskSim({ bal: 100, stake: 1, pWin: .5, payout: .92, limit: 20, trades: 300, runs: 2000, mart: { on: false, mult: 2, steps: 4 } });
ok(flat.median < 100 && flat.pHit >= 0 && flat.pHit <= 1, 'risk sim: median ends below the start when the payout is below fair');
ok(Math.abs(T.spikeProb(500, 500) - 0.632) < 0.01, 'spike probability within N ticks is about 63%');
console.log(f ? f + ' test(s) failed' : 'all tests passed'); process.exit(f ? 1 : 0);
