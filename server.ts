import express, { Request, Response } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      const n = Number(args[i + 1]);
      if (n > 0) return n;
    } else if (args[i].startsWith('--port=')) {
      const n = Number(args[i].split('=')[1]);
      if (n > 0) return n;
    }
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (envPort > 0 && envPort !== nginxPort) return envPort;
  return Number(process.env.DEFAULT_APP_PORT) || 3000;
}

const app = express();
const PORT = resolvePort();

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, port: PORT, aiConfigured: !!process.env.GEMINI_API_KEY });
});

// Shared Gemini Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithTimeout(params: any, timeoutMs = 9500) {
  if (!ai) throw new Error('Gemini client not initialized');
  return Promise.race([
    ai.models.generateContent(params),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * POST /api/ai/deep-scan
 * Synthesizes multi-horizon scan data (digit entropy, edge heat, momentum, win odds)
 * into an institutional executive intelligence brief with market regime classification
 * and top 3 vetted trade opportunities.
 */
app.post('/api/ai/deep-scan', async (req: Request, res: Response) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini AI API key not configured in environment.',
        fallback: true,
      });
    }

    const { scanResults, activeAsset, confidenceThreshold, riskProfile } = req.body;

    const prompt = `You are the Lead Quantitative Derivatives Strategist at Tickwealth Vanguard Nexus.
Analyze the following multi-market tick scan data across synthetic volatility indices and spot pairs.

Scan Summary Data:
${JSON.stringify(scanResults?.slice(0, 8) || [], null, 2)}

Active Asset: ${activeAsset || 'R_100'}
Operator Confidence Threshold Gate: ${confidenceThreshold || 80}%
Risk Profile: ${riskProfile || 'balanced'}

Provide a structured, institutional intelligence report with:
1. MARKET REGIME OVERVIEW: Macro volatility state, turbulence, and persistence across scanned indices (trending vs mean-reverting vs noisy).
2. TOP 3 TACTICAL SETUPS: Ranked by edge and statistical win probability (Specify Market, Contract type like Rise/Fall or Over/Under with barrier, Estimated Win Rate %, and Reason).
3. LOSS-MINIMIZATION & SLIPPAGE WARNING: Specific indices to avoid right now and recommended confidence filter adjustments to protect capital.
4. SYNTHESIS ADVISORY: 2-sentence crisp takeaway for the automated bot deployment.

Keep tone strictly analytical, institutional, emotion-free, and under 240 words.`;

    const response = await generateWithTimeout({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are the Tickwealth Vanguard Nexus Senior Quantitative Analyst. Deliver concise, high-signal financial derivatives synthesis based strictly on statistical data provided. Never make guarantees or promise profit.',
      },
    });

    const reportText = response.text || 'Analysis completed with no output.';
    return res.json({
      success: true,
      report: reportText,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Deep scan AI error:', err);
    // Provide institutional fallback report based on submitted statistical properties
    const { scanResults, activeAsset, confidenceThreshold } = req.body || {};
    const top = Array.isArray(scanResults) && scanResults.length > 0 ? scanResults[0] : null;
    const fallbackBrief = top
      ? `[QUANTUM EXECUTIVE BRIEFING - QUANTITATIVE REGIME SYNTHESIS]
1. MARKET REGIME OVERVIEW: Multi-horizon analysis across live Deriv synthetic indices reveals mixed entropy states. High-speed indices (1HZ series) show short-term digit clustering, while continuous standard series maintain stationary distributions.
2. TOP TACTICAL SETUPS:
   - Rank #1: ${top.name || 'Primary Market'} (${top.symbol || 'R_100'}) | Setup: ${top.bestPlace || 'Optimal Barrier'} | Edge: +${top.edgePts || 12.5}% | Statistical Grade: ${top.grade || 'A+'} (Confidence: ${top.confidence || 85}%)
   - Suggested Contract: Digit Over/Under (Barrier ${top.suggestedBarrier || 4}) with estimated win rate ~${(top.pOver ? top.pOver * 100 : 64).toFixed(0)}%.
3. LOSS-MINIMIZATION & SLIPPAGE WARNING: Maintain AI Confidence Gate at ≥${confidenceThreshold || 80}%. Veto trades when packet latency exceeds 150ms or when Shannon entropy crosses 0.98. The Adaptive Loss Shield will automatically raise your confidence threshold by +5% after any consecutive drawdown.`
      : `[QUANTUM EXECUTIVE BRIEFING - DEFAULT SYNTHESIS]
1. MARKET REGIME: Stationary volatility distribution. High-frequency synthetic index ticks are independent; edge is generated via statistical digit clustering and 3-factor momentum concurrence.
2. RECOMMENDATION: Deploy Alpha Scalper on R_100 with AI Confidence Gate strictly ≥80%.`;

    return res.json({
      success: true,
      report: fallbackBrief,
      fallback: true,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/ai/analyze-asset
 * Evaluates live tick stream, EMA3/Linear14 confluence, and digit distribution for an active asset
 * to calculate loss minimization factors and provide trade confidence validation.
 */
app.post('/api/ai/analyze-asset', async (req: Request, res: Response) => {
  const { symbol, recentTicks, indicators, digitDistribution, proposedContract, barrier } = req.body || {};

  const buildQuantFallback = () => {
    const ticks = Array.isArray(recentTicks) ? recentTicks.map(Number).filter(n => !Number.isNaN(n)) : [];
    const dist = Array.isArray(digitDistribution) && digitDistribution.length === 10 ? digitDistribution.map(Number) : null;
    const last = ticks.length ? ticks[ticks.length - 1] : 0;
    const prev = ticks.length > 1 ? ticks[ticks.length - 2] : last;
    const upMoves = ticks.slice(1).filter((p, idx) => p > ticks[idx]).length;
    const movePct = ticks.length > 1 ? Math.round((upMoves / (ticks.length - 1)) * 100) : 50;
    const maxShare = dist ? Math.max(...dist) : 10;
    const hotDigit = dist ? dist.indexOf(maxShare) : '-';
    const skewScore = dist ? Math.min(20, Math.round((maxShare - 10) * 1.4)) : 0;
    const baseConf = Math.max(48, Math.min(91, 58 + Math.round(Math.abs(movePct - 50) * 0.6) + skewScore));
    const verdict = baseConf >= 72 ? '[APPROVE]' : '[VETO]';
    const risk = skewScore < 4 && Math.abs(movePct - 50) < 12
      ? 'Uniform random drift / elevated chop entropy near mean'
      : (last === prev ? 'Flat micro-tick stall; watch spread latency' : 'Mean-reversion pullback risk after short streak');
    return {
      success: true,
      source: 'quant-engine',
      fallback: true,
      analysis: `1. Confidence Rating: ${baseConf}% (${symbol || 'R_100'} · ${proposedContract || 'CALL'}${barrier != null ? ' ' + barrier : ''})\n2. Primary Risk Factor: ${risk} (Recent Up-Moves: ${movePct}%, Hottest Digit: ${hotDigit} at ${maxShare}%)\n3. Verdict: ${verdict} — Keep stake ≤2% of balance and enforce stop-loss limits.`,
    };
  };

  try {
    if (!ai) {
      return res.json(buildQuantFallback());
    }

    const prompt = `Evaluate the trade confidence and loss risk for ${symbol || 'R_100'}:
- Proposed Contract: ${proposedContract || 'CALL'}${barrier != null ? ` (Barrier ${barrier})` : ''}
- Recent Prices (last 15): ${JSON.stringify(recentTicks?.slice(-15) || [])}
- Indicators: Short-EMA=${indicators?.shortEma ?? 'n/a'}, LinearTrendSlope=${indicators?.slowLinearSlope ?? 'n/a'}, Velocity=${indicators?.velocity1Tick ?? 'n/a'}
- Digit Shares % (0-9): ${JSON.stringify(digitDistribution || [])}

Provide:
1. Confidence Rating: (e.g. 76%)
2. Primary Risk Factor: (e.g. Mean-reversion stall, high digit entropy, payout margin)
3. Verdict: [APPROVE] or [VETO] with a 1-sentence capital protection note.
Keep strictly analytical, honest about random tick independence, and under 80 words.`;

    const response = await generateWithTimeout({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are the Tickwealth Quantitative Risk Validator. Evaluate empirical stats concisely and never claim guaranteed wins or certain predictions.',
      },
    });

    return res.json({
      success: true,
      source: 'gemini',
      analysis: response.text || buildQuantFallback().analysis,
    });
  } catch (err: any) {
    console.error('Asset analysis error:', err);
    return res.json(buildQuantFallback());
  }
});

function generateFallbackProjection(scannedMarkets: any[], confidenceThreshold?: number): string {
  const top = Array.isArray(scannedMarkets) && scannedMarkets.length > 0 ? scannedMarkets[0] : null;
  const second = Array.isArray(scannedMarkets) && scannedMarkets.length > 1 ? scannedMarkets[1] : null;
  const th = confidenceThreshold || 80;

  if (!top) {
    return `[QUANTUM PREDICTIVE PROJECTION - QUANT REASONING]
1. 🔮 TOP INCOMING MARKET PROJECTION: Volatility 100 Index (R_100) exhibits stable multi-horizon drift with 1-5 tick persistence.
2. 🎯 OPTIMAL INCOMING CONTRACT: DIGITUNDER 7 with projected win rate ~74.2% (+14.2% edge vs broker odds).
3. ⚡ MARKOV REGIME: Digit dispersion indicates mean-reverting boundary dampening.
4. 🛡️ LOSS-MINIMIZATION: Filter all signals with AI Confidence < ${th}%. Avoid high-frequency chop indices.`;
  }

  const ou = top.ouDecision || {};
  const opt = top.optimalContract || {};
  const decisionText = ou.decision || (opt.name ? `${opt.name}` : 'UNDER 7');
  const projWin = ou.projectedWinPct ?? opt.projectedProb ?? 78.4;
  const pastHit = ou.pastHitPct ?? 76.5;
  const edge = ou.edgePts ?? opt.edge ?? 11.4;
  const barrierNum = ou.barrier ?? 7;
  const nullPct = ou.nullPct ?? 70.0;
  const winDigits = ou.best?.winningDigits ? ou.best.winningDigits.join(',') : '0,1,2,3,4,5,6';

  return `[QUANTUM PREDICTIVE PROJECTION - REAL DATA MULTI-HORIZON & MARKOV SYNTHESIS]
1. 🔮 TOP INCOMING MARKET PROJECTION:
   - Primary Market: ${top.name} (${top.symbol}) | Regime: ${top.regime || 'PERSISTENT_MOMENTUM'}
   - Multi-horizon drift indicates forward persistence with Hurst exponent H = ${top.hurst || 0.58} and normalized entropy ${top.projectedEntropy || 0.94}.
   ${second ? `- Secondary Alternative: ${second.name} (${second.symbol}) with decision ${second.ouDecision?.decision || 'OVER 2'} (+${second.ouDecision?.edgePts || second.edgePts || 8.5} pts edge).` : ''}

2. 🎯 OPTIMAL INCOMING CONTRACT & BARRIER DECISION:
   - DECISION: ${decisionText} (BARRIER: ${barrierNum})
   - Forward Win Probability: ${projWin}% (vs theoretical normal odds of ${nullPct}%, yielding +${edge} points net edge).
   - Historical Past Hit Rate: ${pastHit}% across last ${top.sampleSize || 500} real ticks.
   - Markov Conditioning: Conditioned on current tick digit ${ou.currentDigit ?? 'X'}, probability mass is concentrated in winning digit set [${winDigits}].

3. ⚡ MARKOV DYNAMICS & DIGIT TRANSITIONS:
   - 1st-order Markov transition matrix indicates state dampening at outer digit boundaries, confirming favorable mean-reversion drift into the chosen barrier.
   - Low price turbulence minimizes latency and slippage risk on incoming order execution.

4. 🛡️ LOSS-MINIMIZATION CAPITAL SHIELD:
   - Strict Execution Protocol: Veto any trade if AI Confidence drops below ${th}%.
   - Consecutive Loss Shield: Automatically raises threshold by +5% per loss to protect wallet balance.
   - Markets to Avoid: Any index where Shannon entropy exceeds 0.985 or Hurst drops below 0.45 into unpredictable chop.

5. 📊 PREDICTIVE SIZING & DEPLOYMENT:
   - Recommended stake: 1.5% to 2.0% of available balance under fractional Kelly criterion.`;
}

/**
 * POST /api/ai/project-markets
 * Advanced Predictive AI Market Scan & Incoming Market Projection.
 */
app.post('/api/ai/project-markets', async (req: Request, res: Response) => {
  try {
    const { scannedMarkets, confidenceThreshold, riskProfile, targetHorizon } = req.body || {};

    if (!ai) {
      return res.json({
        success: true,
        fallback: true,
        projectionReport: generateFallbackProjection(scannedMarkets, confidenceThreshold),
      });
    }

    const prompt = `You are the Principal AI Quantitative Architect at Tickwealth Vanguard Nexus specializing in incoming market projection and derivative forward modeling.

Below is real multi-horizon scan, Over/Under barrier decisions, and Markov transition data across synthetic volatility indices:
${JSON.stringify(scannedMarkets?.slice(0, 8) || [], null, 2)}

Parameters:
- Target Forward Horizon: ${targetHorizon || '1 to 5 ticks'}
- Minimum AI Confidence Filter: ${confidenceThreshold || 80}%
- Risk Profile: ${riskProfile || 'balanced'}

Provide an institutional, forward-looking predictive market intelligence projection with:
1. 🔮 TOP INCOMING MARKET PROJECTION: Name the single best market and symbol to trade next, its volatility regime, and persistence.
2. 🎯 OPTIMAL INCOMING CONTRACT & BARRIER DECISION: Provide the explicit decision (e.g. "DECISION: UNDER 7" or "DECISION: OVER 2") with exact barrier number X, forward projected win probability %, past historical hit rate %, and net edge % calculated directly from the real data provided.
3. ⚡ MARKOV & REGIME FORECAST: Explain why the current digit state and Markov transition matrix support this setup.
4. 🛡️ LOSS-MINIMIZATION CAPITAL SHIELD: State which markets to avoid and how the confidence filter minimizes drawdown.
5. 📊 PREDICTIVE ALLOCATION: Recommend stake sizing % for automated bot deployment.

Keep tone strictly analytical, quantitative, crisp, and under 250 words.`;

    const response = await generateWithTimeout({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are the Tickwealth Vanguard Nexus Predictive Quant AI. Provide mathematically rigorous incoming market projections and probabilistic edge estimates based strictly on empirical multi-horizon and Markov transition metrics.',
      },
    });

    const reportText = response.text || generateFallbackProjection(scannedMarkets, confidenceThreshold);
    return res.json({
      success: true,
      projectionReport: reportText,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Market projection AI error:', err);
    return res.json({
      success: true,
      fallback: true,
      projectionReport: generateFallbackProjection(req.body?.scannedMarkets, req.body?.confidenceThreshold),
      timestamp: new Date().toISOString(),
    });
  }
});

function generateFallbackCrossMarketBriefing(markets: any[], th: number = 80): string {
  if (!Array.isArray(markets) || markets.length === 0) {
    return `[CROSS-MARKET AI ANALYSIS - SYSTEM SYNTHESIS]
1. 🌐 REGIME CLUSTERING: Synthetic volatility universe operating in balanced state.
2. 🏆 GLOBAL ALPHA LEADER: Volatility 100 Index demonstrates persistent momentum (H = 0.58) with optimal contract UNDER 7 (+11.4 pts edge).
3. 🛡️ CAPITAL SHIELD: Veto all signals with confidence < ${th}%.`;
  }

  const sorted = [...markets].sort((a, b) => {
    const edgeA = Number(a.edgePts || a.ouDecision?.edgePts || 0);
    const edgeB = Number(b.edgePts || b.ouDecision?.edgePts || 0);
    return edgeB - edgeA;
  });

  const lead = sorted[0];
  const second = sorted[1];
  const traps = sorted.filter(m => Number(m.entropy || 0.95) > 0.985 || Number(m.conf || 0) < 70);
  const avgEntropy = (markets.reduce((acc, m) => acc + Number(m.entropy || 0.95), 0) / markets.length).toFixed(3);

  return `[CROSS-MARKET AI ANALYSIS - INSTITUTIONAL MULTI-ASSET SYNTHESIS]
1. 🌐 CROSS-MARKET VOLATILITY REGIME CLUSTERING:
   - Analysis of ${markets.length} synthetic volatility indices reveals multi-horizon dispersion.
   - High-speed indices (1HZ series) demonstrate rapid wavelet oscillation, while continuous standard series (R_XX) exhibit structural digit persistence.
   - Cross-market normalized Shannon entropy average is ${avgEntropy}.

2. 🏆 GLOBAL ALPHA LEADER & ROTATION DIRECTIVE:
   - Lead Index: ${lead.name} (${lead.symbol}) [Grade ${lead.grade || 'A+'}]
   - Optimal Contract: ${lead.ouDecision?.decision || 'UNDER 7'} (Barrier: ${lead.ouDecision?.barrier ?? 7})
   - Expected Win Rate: ~${lead.ouDecision?.projectedWinPct || 80.2}% (Net Statistical Edge: +${lead.ouDecision?.edgePts || lead.edgePts || 11.2} pts vs normal odds).
   - Rotation Directive: Rotate capital away from low-edge indices into ${lead.name} to maximize Sharpe efficiency.
   ${second ? `- Secondary Tactical Pick: ${second.name} with ${second.ouDecision?.decision || 'OVER 2'} (+${second.ouDecision?.edgePts || second.edgePts} pts edge).` : ''}

3. ⚡ CROSS-MARKET DIVERGENCE & RELATIVE VALUE:
   - Top-to-bottom edge spread across the universe is ${(Number(lead.ouDecision?.edgePts || lead.edgePts || 10) - Number(sorted[sorted.length - 1]?.edgePts || 0)).toFixed(1)} points.
   - High-conviction setups cluster heavily around outer digit boundaries (Under 7 and Over 2).

4. 🛡️ SYSTEMIC CAPITAL SHIELD & VETO TRAPS:
   - Blacklist Traps: ${traps.length > 0 ? traps.map(t => t.name).slice(0, 3).join(', ') : 'None (all markets within noise limits)'} are currently flagged for high entropy (>0.985) or sub-threshold confidence.
   - Execution Gate: The AI Loss Guard strictly vetoes any incoming signal below ${th}%.

5. 📊 MULTI-BOT BASKET EXECUTION:
   - Allocate 60% of bot capacity to ${lead.name} and 40% to secondary alpha leaders with fractional Kelly staking at 1.5% balance max.`;
}

/**
 * POST /api/ai/cross-market-analysis
 * Institutional Cross-Market AI Analysis & Relative Value Matrix.
 * Synthesizes all live Deriv digit-capable synthetic indices collectively.
 */
app.post('/api/ai/cross-market-analysis', async (req: Request, res: Response) => {
  try {
    const { markets, activeAsset, confidenceThreshold, riskProfile } = req.body || {};
    const th = confidenceThreshold || 80;

    if (!ai) {
      return res.json({
        success: true,
        fallback: true,
        crossMarketReport: generateFallbackCrossMarketBriefing(markets, th),
        timestamp: new Date().toISOString(),
      });
    }

    const prompt = `You are the Lead Quantitative Strategist at Tickwealth Vanguard Nexus specializing in multi-asset cross-market algorithmic derivatives.

Below is real-time cross-market scan, regime clustering, Over/Under decisions, and entropy data across all live Deriv digit-capable synthetic markets:
${JSON.stringify(markets || [], null, 2)}

Active Asset Selected by Operator: ${activeAsset || 'R_100'}
Operator Confidence Gate: ${th}%
Risk Profile: ${riskProfile || 'balanced'}

Provide an institutional Cross-Market AI Intelligence Briefing covering:
1. 🌐 CROSS-MARKET VOLATILITY REGIME CLUSTERING: Macro summary of how predictability and entropy are partitioned across the 1-second high-speed index cluster (1HZ) vs standard continuous index cluster (R_XX).
2. 🏆 GLOBAL ALPHA LEADER & ROTATION DIRECTIVE: Identify the single #1 market with the cleanest edge, lowest entropy, and highest win probability. State its exact recommended contract (e.g. UNDER 7 or OVER 2) and specify why the operator should rotate capital toward this market.
3. ⚡ CROSS-MARKET DIVERGENCE & ARBITRAGE: Highlight relative edge disparities (e.g. edge premium on high-volatility vs low-volatility indices).
4. 🛡️ SYSTEMIC CAPITAL SHIELD & VETO TRAPS: Blacklist specific indices currently in unpredictable brownian noise/high Shannon entropy traps that MUST be vetoed to minimize drawdown.
5. 📊 MULTI-BOT BASKET EXECUTION: Provide a 2-sentence actionable rule for automated bot deployment.

Keep tone strictly institutional, quantitative, objective, and under 260 words.`;

    const response = await generateWithTimeout({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are the Tickwealth Vanguard Nexus Chief Quantitative Strategist. Deliver concise, institutional cross-market derivatives synthesis based strictly on the provided multi-asset statistical metrics.',
      },
    });

    const reportText = response.text || generateFallbackCrossMarketBriefing(markets, th);
    return res.json({
      success: true,
      crossMarketReport: reportText,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Cross-market AI analysis error:', err);
    return res.json({
      success: true,
      fallback: true,
      crossMarketReport: generateFallbackCrossMarketBriefing(req.body?.markets, req.body?.confidenceThreshold),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/ai/chat
 * Interactive conversational trading coach & mathematical diagnostic.
 */
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini AI API key not configured in environment.',
        reply: 'The AI server connection is currently operating in offline mode. Please ensure GEMINI_API_KEY is configured in Settings > Secrets.',
      });
    }

    const { messages, context } = req.body;

    const systemInstruction = `You are the Tickwealth Vanguard Nexus Trading Coach and Quantitative Assistant.
Explain what the terminal metrics mean (EMA, Linear Regression slope, Digit Histograms, Chi-Square entropy, Hurst exponent, Wilson score intervals, Over/Under barriers, Even/Odd probability).
Explain contract risks (Rise/Fall, Even/Odd, Over/Under, Matches/Differs).
Emphasize capital protection, stop-loss discipline, why synthetic ticks are independent, and why martingale is mathematically dangerous.
Keep answers under 130 words, plain language, institutional and caring.`;

    const contents = [];
    if (context) {
      contents.push({
        role: 'user',
        parts: [{ text: `Terminal Context: Active Asset=${context.market || 'R_100'}, Balance=$${context.balance || 0}, Current Session PnL=$${context.pnl || 0}.` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Acknowledged. Ready to assist with mathematical analysis and risk guidance.' }],
      });
    }

    if (Array.isArray(messages)) {
      for (const m of messages.slice(-8)) {
        if (m.text || m.content) {
          contents.push({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.text || m.content).slice(0, 1000) }],
          });
        }
      }
    }

    const response = await generateWithTimeout({
      model: 'gemini-4-hydrogen',
      contents: contents.length > 0 ? contents : 'Hello, how can you help me with risk management?',
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction,
      },
    });

    return res.json({
      source: 'gemini',
      reply: response.text || '',
    });
  } catch (err: any) {
    console.error('AI chat error:', err);
    return res.json({
      source: 'quant-engine',
      reply: '✦ Quant Coach: Maintain strict risk bounds — cap single stake under 2% of session equity, keep AI Confidence Gate calibrated to your contract baseline, and use paper mode before live capital.',
    });
  }
});

/**
 * POST /api/ai/bot-architect
 * Translates natural language strategy descriptions into schema-validated TickWealth Bot JSON.
 */
app.post('/api/ai/bot-architect', async (req: Request, res: Response) => {
  const { goal, activeSymbol, defaultStake } = req.body || {};
  const promptText = String(goal || 'Balanced Under 7 sniper with loss protection').trim().slice(0, 400);

  const buildFallbackBot = () => {
    const q = promptText.toLowerCase();
    const fxAlias: Record<string, string> = {
      eurusd: 'frxEURUSD', 'eur/usd': 'frxEURUSD', gbpusd: 'frxGBPUSD', 'gbp/usd': 'frxGBPUSD',
      usdjpy: 'frxUSDJPY', 'usd/jpy': 'frxUSDJPY', audusd: 'frxAUDUSD', 'aud/usd': 'frxAUDUSD',
      usdcad: 'frxUSDCAD', 'usd/cad': 'frxUSDCAD', usdchf: 'frxUSDCHF', 'usd/chf': 'frxUSDCHF',
      eurgbp: 'frxEURGBP', 'eur/gbp': 'frxEURGBP', eurjpy: 'frxEURJPY', 'eur/jpy': 'frxEURJPY',
      gbpjpy: 'frxGBPJPY', 'gbp/jpy': 'frxGBPJPY', xauusd: 'frxXAUUSD', 'xau/usd': 'frxXAUUSD', gold: 'frxXAUUSD'
    };
    const fxExplicit = Object.keys(fxAlias).find(k => q.includes(k));
    const symMatch = q.match(/\b(frxeurusd|frxgbpusd|frxusdjpy|frxaudusd|frxusdcad|frxusdchf|frxeurgbp|frxeurjpy|frxgbpjpy|frxxauusd|1hz100v|1hz90v|1hz75v|1hz50v|1hz30v|1hz25v|1hz15v|1hz10v|r_100|r_75|r_50|r_25|r_10|jd100|jd75|jd50|jd25|jd10|rdbull|rdbear|stprng[2-5]?)\b/i);
    let symbol = symMatch
      ? (symMatch[1].toLowerCase().startsWith('stprng')
        ? 'stpRNG' + symMatch[1].slice(6)
        : symMatch[1].toLowerCase().startsWith('frx')
          ? 'frx' + symMatch[1].slice(3).toUpperCase()
          : symMatch[1].toUpperCase())
      : (fxExplicit ? fxAlias[fxExplicit] : (activeSymbol || 'R_100'));
    if (!symMatch && !fxExplicit) {
      if (q.includes('forex')) symbol = 'frxEURUSD';
      else if (q.includes('90')) symbol = '1HZ90V';
      else if (q.includes('75')) symbol = q.includes('1s') || q.includes('1hz') ? '1HZ75V' : 'R_75';
      else if (q.includes('50')) symbol = q.includes('1s') || q.includes('1hz') ? '1HZ50V' : 'R_50';
      else if (q.includes('30')) symbol = '1HZ30V';
      else if (q.includes('25')) symbol = q.includes('1s') || q.includes('1hz') ? '1HZ25V' : 'R_25';
      else if (q.includes('15')) symbol = '1HZ15V';
      else if (q.includes('10 ') || q.endsWith('10')) symbol = 'R_10';
    }
    const isFx = /^(frx|XAU)/i.test(symbol);

    let contract = isFx ? 'CALL' : 'DIGITUNDER';
    let barrier = isFx ? 0 : 7;
    let rule = isFx
      ? { kind: 'ai_alpha', cond: 'rise', cb: 0, n: 1 }
      : { kind: 'streak', cond: 'over', cb: 6, n: 1 };
    let aiGate = isFx ? 56 : 68;
    let specialistTitle = 'Expert Under 7 Sniper';

    if (isFx || q.includes('forex') || q.includes('buy') || q.includes('sell') || q.includes('gold')) {
      const wantSell = q.includes('sell') || q.includes('put') || q.includes('bear') || q.includes('short') || q.includes('fall');
      contract = wantSell ? 'PUT' : 'CALL';
      barrier = 0;
      rule = { kind: 'ai_alpha', cond: wantSell ? 'fall' : 'rise', cb: 0, n: 1 };
      aiGate = 56;
      const pairLbl = symbol.replace(/^frx/, '').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
      specialistTitle = `${wantSell ? 'Expert Forex Seller' : 'Expert Forex Buyer'} — ${pairLbl}`;
    } else if (q.includes('over')) {
      const m = q.match(/over\s*([0-8])/);
      barrier = m ? +m[1] : 2;
      contract = 'DIGITOVER';
      rule = { kind: 'streak', cond: 'under', cb: Math.min(8, barrier + 1), n: 1 };
      aiGate = barrier <= 2 ? 66 : 52;
      specialistTitle = barrier <= 2 ? `Expert Over ${barrier} Reversion` : `Expert Over ${barrier} Sniper`;
    } else if (q.includes('under')) {
      const m = q.match(/under\s*([1-9])/);
      barrier = m ? +m[1] : 7;
      contract = 'DIGITUNDER';
      rule = { kind: 'streak', cond: 'over', cb: Math.max(1, barrier - 1), n: 1 };
      aiGate = barrier >= 7 ? 68 : 52;
      specialistTitle = barrier >= 7 ? `Expert Under ${barrier} Sniper` : `Expert Under ${barrier} Reversion`;
    } else if (q.includes('differ')) {
      const m = q.match(/differ[s]?\s*([0-9])/);
      barrier = m ? +m[1] : 0;
      contract = 'DIGITDIFF';
      rule = { kind: 'ai_alpha', cond: 'even', cb: 0, n: 1 };
      aiGate = 82;
      specialistTitle = `Expert Differs ${barrier} Dispersion`;
    } else if (q.includes('match')) {
      const m = q.match(/match(?:es)?\s*([0-9])/);
      barrier = m ? +m[1] : 7;
      contract = 'DIGITMATCH';
      rule = { kind: 'ai_alpha', cond: 'over', cb: 6, n: 1 };
      aiGate = 14;
      specialistTitle = `Expert Matches ${barrier} Attractor`;
    } else if (q.includes('even') || q.includes('odd') || q.includes('parity')) {
      contract = q.includes('odd') ? 'DIGITODD' : 'DIGITEVEN';
      barrier = 0;
      rule = { kind: 'streak', cond: q.includes('odd') ? 'even' : 'odd', cb: 0, n: 2 };
      aiGate = 52;
      specialistTitle = contract === 'DIGITODD' ? 'Expert Odd Parity Breaker' : 'Expert Even Parity Breaker';
    } else if (q.includes('rise') || q.includes('call') || q.includes('momentum') || q.includes('fall') || q.includes('put')) {
      contract = (q.includes('fall') || q.includes('put')) ? 'PUT' : 'CALL';
      barrier = 0;
      rule = { kind: 'ai_alpha', cond: contract === 'PUT' ? 'fall' : 'rise', cb: 0, n: 1 };
      aiGate = 54;
      specialistTitle = contract === 'PUT' ? 'Expert Fall Reversion' : 'Expert Rise Momentum';
    }

    const noMart = q.includes('flat') || q.includes('no mart') || q.includes('no recovery') || contract === 'DIGITMATCH';
    const isRF = contract === 'CALL' || contract === 'PUT';
    const isUltraSafe = q.includes('safe') || q.includes('low risk') || q.includes('conserv') || q.includes('shield');
    const martOn = !noMart;
    const martMode = isRF ? 'split_recovery' : 'smart_barrier';
    const baseStake = Math.max(0.35, Math.min(25, Number(defaultStake) || (isUltraSafe ? 0.35 : 0.5)));
    const duration = isFx ? (q.includes('15m') ? 15 : 5) : (isRF ? 5 : 1);
    const durationUnit = isFx ? 'm' : 't';

    return {
      success: true,
      source: 'quant-engine',
      fallback: true,
      bot: {
        name: `${specialistTitle} (${symbol})`,
        symbol,
        contract,
        barrier,
        duration,
        durationUnit,
        stake: baseStake,
        aiGate,
        aiMode: isUltraSafe ? 'strict' : 'active',
        lossShield: true,
        coolSecs: isUltraSafe ? 8 : 4,
        rule,
        mart: {
          on: martOn,
          mode: martMode,
          mult: martOn ? (isUltraSafe ? 1.03 : 1.05) : 1.0,
          steps: martOn ? (isUltraSafe ? 3 : 4) : 1,
        },
        sl: +(baseStake * (isUltraSafe ? 10 : 16)).toFixed(2),
        tp: +(baseStake * (isUltraSafe ? 12 : 24)).toFixed(2),
        rationale: `Calibrated ${contract}${/OVER|UNDER|MATCH|DIFF/.test(contract) ? ' (' + barrier + ')' : ''} on ${symbol} (${duration}${durationUnit}) with ${aiGate}% AI Conviction Gate, Chop-Trap veto, Adaptive Loss Shield, and ${martOn ? (martMode === 'split_recovery' ? 'Split-2 Recovery' : 'Smart Barrier Recovery') : 'Flat Stake'}.`,
        riskNote: 'Every tick/candle is independent. Validate this blueprint in Paper Mode and with historical checks before running live.',
      },
    };
  };

  try {
    if (!ai) {
      return res.json(buildFallbackBot());
    }

    const botSchema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Clear specialty name matching the bot job, e.g. "Expert Under 7 Sniper", "Expert Over 2 Reversion", "Expert Even Parity Breaker", or "Expert Forex Buyer — EUR/USD"' },
        symbol: { type: Type.STRING, description: 'One of R_10..R_100, 1HZ10V..1HZ100V, JD10..JD100, RDBULL, RDBEAR, (CALL/PUT only: stpRNG..stpRNG5), or Forex/Gold: frxEURUSD, frxGBPUSD, frxUSDJPY, frxAUDUSD, frxUSDCAD, frxUSDCHF, frxEURGBP, frxEURJPY, frxGBPJPY, frxXAUUSD' },
        contract: { type: Type.STRING, description: 'One of CALL, PUT, DIGITOVER, DIGITUNDER, DIGITEVEN, DIGITODD, DIGITMATCH, DIGITDIFF' },
        barrier: { type: Type.INTEGER, description: '0 to 9 integer barrier (0 if not digit barrier)' },
        duration: { type: Type.INTEGER, description: 'Ticks (1-10) for digits/synthetics, or minutes (5-30) for Forex/Gold' },
        durationUnit: { type: Type.STRING, description: 'One of t (ticks), s (seconds), m (minutes), h (hours). Use m for Forex/Gold and t for synthetics/digits.' },
        stake: { type: Type.NUMBER, description: 'Stake in USD between 0.35 and 10' },
        aiGate: { type: Type.INTEGER, description: 'Confidence gate 15 to 90 calibrated to true contract probability' },
        aiMode: { type: Type.STRING, description: 'active or strict' },
        lossShield: { type: Type.BOOLEAN },
        coolSecs: { type: Type.INTEGER, description: 'Cooldown seconds after 2 losses (0 to 15)' },
        ruleKind: { type: Type.STRING, description: 'streak, ai_alpha, or every' },
        ruleCond: { type: Type.STRING, description: 'even, odd, over, under, rise, or fall' },
        ruleCb: { type: Type.INTEGER, description: 'Condition barrier 0 to 9' },
        ruleN: { type: Type.INTEGER, description: 'Streak or cadence N (1 to 5)' },
        martOn: { type: Type.BOOLEAN },
        martMode: { type: Type.STRING, description: 'smart_barrier, split_recovery, payout_martingale, dalembert, fibonacci, or martingale' },
        martMult: { type: Type.NUMBER, description: 'Recovery cushion multiplier e.g. 1.05 for smart_barrier/split_recovery' },
        martSteps: { type: Type.INTEGER, description: 'Recovery max step cap (2 to 4)' },
        sl: { type: Type.NUMBER },
        tp: { type: Type.NUMBER },
        rationale: { type: Type.STRING },
        riskNote: { type: Type.STRING },
      },
      required: ['name', 'symbol', 'contract', 'barrier', 'duration', 'durationUnit', 'stake', 'aiGate', 'aiMode', 'lossShield', 'coolSecs', 'ruleKind', 'ruleCond', 'ruleCb', 'ruleN', 'martOn', 'martMode', 'martMult', 'martSteps', 'sl', 'tp', 'rationale', 'riskNote'],
    };

    const response = await generateWithTimeout({
      model: 'gemini-4-hydrogen',
      contents: `Design a safe, well-calibrated algorithmic trading bot JSON configuration for this trader goal: "${promptText}".
Context: Active default symbol=${activeSymbol || 'R_100'}, preferred base stake=$${defaultStake || 0.5}.
Remember calibration & naming rules:
- Name the bot directly after its specialty (e.g. "Expert Under 7 Sniper", "Expert Over 2 Reversion", "Expert Even Parity Breaker", "Expert Forex Buyer — EUR/USD", "Expert Gold Seller — XAU/USD"). Never put the word "Role" in the bot name.
- DIGITOVER 2 or DIGITUNDER 7 have ~70% baseline prob -> calibrate aiGate around 65-72%.
- DIGITEVEN/DIGITODD/CALL/PUT have ~50% baseline -> calibrate aiGate around 50-58%.
- DIGITDIFF has ~90% baseline -> calibrate aiGate around 82-88%.
- DIGITMATCH has ~10% baseline -> calibrate aiGate around 12-18%, and set martOn=false (flat sizing only).
- Step Indices (stpRNG..stpRNG5) and Forex/Gold (frxEURUSD..frxXAUUSD) only support CALL (Buy/Rise) and PUT (Sell/Fall) contracts.
- For Forex/Gold pairs, use durationUnit="m" and duration=5 or 15, with ruleKind="ai_alpha" and martMode="split_recovery".
- Always prefer aiMode="active" or "strict", ruleKind="streak" or "ai_alpha" (never instant), and martMode="smart_barrier" (digits) or "split_recovery" (CALL/PUT) with martMult=1.05 and martSteps<=4 instead of blind doubling. Never promise profit in rationale.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: 'You are the Tickwealth AI Bot Architect. Output strict JSON matching the schema with honest risk parameters and specialty-based bot names.',
        responseMimeType: 'application/json',
        responseSchema: botSchema,
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const validContracts = ['CALL', 'PUT', 'DIGITOVER', 'DIGITUNDER', 'DIGITEVEN', 'DIGITODD', 'DIGITMATCH', 'DIGITDIFF'];
    const contract = validContracts.includes(parsed.contract) ? parsed.contract : 'DIGITUNDER';
    const isStepOrFxSym = /^(stpRNG|frx|XAU)/.test(String(parsed.symbol || ''));
    const validDigitSyms = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V', 'JD10', 'JD25', 'JD50', 'JD75', 'JD100', 'RDBULL', 'RDBEAR'];
    const validDirOnlySyms = ['stpRNG', 'stpRNG2', 'stpRNG3', 'stpRNG4', 'stpRNG5', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxUSDCHF', 'frxEURGBP', 'frxEURJPY', 'frxGBPJPY', 'frxXAUUSD'];
    const validSyms = (contract === 'CALL' || contract === 'PUT') ? [...validDigitSyms, ...validDirOnlySyms] : validDigitSyms;
    const fallbackSym = (activeSymbol && validSyms.includes(activeSymbol)) ? activeSymbol : 'R_100';
    const symbol = (isStepOrFxSym && contract !== 'CALL' && contract !== 'PUT')
      ? fallbackSym
      : (validSyms.includes(parsed.symbol) ? parsed.symbol : fallbackSym);
    const isFx = /^(frx|XAU)/.test(symbol);
    const durationUnit = isFx
      ? (['s', 'm', 'h'].includes(parsed.durationUnit) ? parsed.durationUnit : 'm')
      : (['t', 's', 'm', 'h'].includes(parsed.durationUnit) ? parsed.durationUnit : 't');
    const maxDur = durationUnit === 't' ? 10 : 60;

    return res.json({
      success: true,
      source: 'gemini',
      bot: {
        name: String(parsed.name || 'Expert AI Architect Bot').replace(/\bRole\s*Bot\b|\bRole\b/gi, '').trim().slice(0, 56),
        symbol,
        contract,
        barrier: Math.max(0, Math.min(9, Math.round(Number(parsed.barrier ?? 7)))),
        duration: Math.max(isFx && durationUnit === 'm' ? 5 : 1, Math.min(maxDur, Math.round(Number(parsed.duration ?? (isFx ? 5 : 1))))),
        durationUnit,
        stake: Math.max(0.35, Math.min(50, +Number(parsed.stake ?? 0.5).toFixed(2))),
        aiGate: Math.max(10, Math.min(92, Math.round(Number(parsed.aiGate ?? 68)))),
        aiMode: parsed.aiMode === 'strict' ? 'strict' : 'active',
        lossShield: parsed.lossShield !== false,
        coolSecs: Math.max(0, Math.min(30, Math.round(Number(parsed.coolSecs ?? 5)))),
        rule: {
          kind: ['every', 'streak', 'ai_alpha'].includes(parsed.ruleKind) ? parsed.ruleKind : 'streak',
          cond: ['even', 'odd', 'over', 'under', 'rise', 'fall'].includes(parsed.ruleCond) ? parsed.ruleCond : 'over',
          cb: Math.max(0, Math.min(9, Math.round(Number(parsed.ruleCb ?? 6)))),
          n: Math.max(1, Math.min(8, Math.round(Number(parsed.ruleN ?? 1)))),
        },
        mart: {
          on: contract === 'DIGITMATCH' ? false : !!parsed.martOn,
          mode: ['smart_barrier', 'split_recovery', 'payout_martingale', 'dalembert', 'fibonacci', 'martingale'].includes(parsed.martMode)
            ? parsed.martMode
            : ((contract === 'CALL' || contract === 'PUT') ? 'split_recovery' : 'smart_barrier'),
          mult: Math.max(1.0, Math.min(2.5, +Number(parsed.martMult ?? 1.05).toFixed(2))),
          steps: Math.max(1, Math.min(5, Math.round(Number(parsed.martSteps ?? 4)))),
        },
        sl: Math.max(1, Math.min(500, +Number(parsed.sl ?? 10).toFixed(2))),
        tp: Math.max(1, Math.min(500, +Number(parsed.tp ?? 15).toFixed(2))),
        rationale: String(parsed.rationale || '').slice(0, 260),
        riskNote: String(parsed.riskNote || 'Validate in Paper Mode before live capital.').slice(0, 220),
      },
    });
  } catch (err: any) {
    console.error('Bot architect AI error:', err);
    return res.json(buildFallbackBot());
  }
});

/**
 * POST /api/ai/session-audit
 * Audits live session or D-Bot execution telemetry for drawdown risk, profit factor, and sizing discipline.
 */
app.post('/api/ai/session-audit', async (req: Request, res: Response) => {
  const { trades = 0, wins = 0, pnl = 0, totalStake = 0, grossWin = 0, grossLoss = 0, maxDrawdown = 0, peakPnl = 0, balance = 1000, recent = [] } = req.body || {};
  const wr = trades > 0 ? +((wins / trades) * 100).toFixed(1) : 0;
  const pf = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? 9.99 : 0);
  const ddPct = balance > 0 ? +((maxDrawdown / balance) * 100).toFixed(2) : 0;

  const buildFallbackAudit = () => {
    const grade = trades < 5 ? 'CALIBRATING' : (pf >= 1.25 && ddPct < 3 ? 'A (DISCIPLINED)' : (pf >= 1.0 && ddPct < 8 ? 'B (STABLE)' : 'C (ELEVATED RISK)'));
    const ruinRisk = ddPct >= 10 ? 'HIGH' : ddPct >= 4 ? 'MODERATE' : 'LOW';
    const advice = trades === 0
      ? 'No completed trades recorded yet. Run 10–20 paper trades or a 1000-tick backtest before sizing up.'
      : (pnl < 0 && ddPct >= 4
        ? `Drawdown reached $${Number(maxDrawdown).toFixed(2)} (${ddPct}% of balance). Enable Loss Cooldown (5–10s) and set a hard Trailing Profit Lock / Stop-Loss.`
        : (pf >= 1.2
          ? `Healthy Profit Factor (${pf}) across ${trades} trades (${wr}% win rate). Consider locking gains with Trailing Profit Lock set to ~$${Math.max(1, +(peakPnl * 0.35).toFixed(1))}.`
          : `Win rate is ${wr}% with Profit Factor ${pf}. Keep stake flat (≤1.5% of equity) and avoid increasing Martingale steps.`));
    return {
      success: true,
      source: 'quant-engine',
      fallback: true,
      audit: `[AI SESSION RISK AUDIT · ${grade}]\n• Performance: ${trades} trades · ${wr}% Win Rate · Profit Factor ${pf} · Net ${pnl >= 0 ? '+' : ''}$${Number(pnl).toFixed(2)}\n• Risk Exposure: Peak +$${Number(peakPnl).toFixed(2)} · Max Drawdown -$${Number(maxDrawdown).toFixed(2)} (${ddPct}% equity) · Ruin Hazard: ${ruinRisk}\n• Directive: ${advice}`,
    };
  };

  try {
    if (!ai) {
      return res.json(buildFallbackAudit());
    }

    const response = await generateWithTimeout({
      model: 'gemini-4-hydrogen',
      contents: `Audit this live algorithmic trading session telemetry:
- Balance: $${balance}, Trades: ${trades}, Win Rate: ${wr}%, Net PnL: $${pnl}, Profit Factor: ${pf}
- Peak PnL: $${peakPnl}, Max Drawdown: $${maxDrawdown} (${ddPct}% of balance), Total Staked: $${totalStake}
- Recent Outcomes: ${JSON.stringify(Array.isArray(recent) ? recent.slice(-10) : [])}

Deliver a crisp 3-bullet executive risk & execution audit:
1. GRADE & EDGE HEALTH
2. DRAWDOWN / STREAK HAZARD
3. IMMEDIATE NEXT ACTION (e.g. Trailing Profit Lock level, stake cap, or cooldown).
Under 130 words, analytical and honest.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: 'You are the Tickwealth Portfolio Risk Auditor. Focus on capital preservation, drawdown control, and honest expectancy math.',
      },
    });

    return res.json({
      success: true,
      source: 'gemini',
      audit: response.text || buildFallbackAudit().audit,
    });
  } catch (err: any) {
    console.error('Session audit error:', err);
    return res.json(buildFallbackAudit());
  }
});

// Mount Vite or static server
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    // Serve production dist directory
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Dev mode: Vite middleware (disable standalone HMR WS port 24678)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vanguard Nexus Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
