# TickWealth

Independent Deriv analytics and paper-first trading terminal. Static site: no build step, no backend. Not affiliated with Deriv.

## Deploy on GitHub Pages
1. Upload everything in this folder to the root of your repository (`index.html` must be at the top level).
2. Settings, Pages, Source: Deploy from a branch, `main`, `/ (root)`.
3. Open the site and go to **Diagnostics**, press **Run checks**, then **Copy report** if anything fails.

## Deriv connection
- Market data uses Deriv's public WebSocket and needs no login.
- Trading login: register an app of type PAT at https://developers.deriv.com, put its App ID in `appId` (core.js) or Settings, create a PAT with the `trade` scope only, and paste it in the account window. Demo first.
- "Log in with Deriv" needs your Cloudflare Worker to return an `access_token`; the site then links the account automatically.

## Pages
Landing, Rise/Fall (candles + MA/EMA/Bollinger/RSI/MACD), Over/Under, Even/Odd, Matches/Differs (rank-coloured digit circles with a moving cursor), Analyzer, Playbook (topic > subtopic > variant), Insight Lab (randomness suite, AI Truth Test, risk simulator), Bots (library for every market, scanner, run all/stop all, duplicate, reset, undo delete, download one or all as JSON, experimental Deriv Bot XML download, import JSON or Deriv Bot XML by button or drag and drop), Diagnostics, Settings.

## AI coach
`coach.js` is the browser coach (on-device explainer by default). For full AI answers run `server/ai-proxy.js` (Node 18+, your key stays on that server) and put its URL in `aiEndpoint` in `config.js`. Never load `server/ai-proxy.js` in a page.

## Tests
`node tests/stats.test.js` checks the maths. `tests/` also holds a simulated Deriv server and a browser click-through (Playwright) used to verify every page.

## Safety
Paper mode by default, max stake, stop-loss and take-profit on bots, Martingale off by default and capped. Ticks on synthetic indices are random: nothing here predicts them. Trading can lose your whole stake.

## Bot files
- **Download all (JSON)** saves every bot in one file; **Download JSON** saves one bot. Import accepts a single bot, a list, or a bundle.
- **Deriv XML (experimental)** writes a basic Deriv Bot trade loop (market, contract, stake, duration). Entry rules are not included. Open it in Deriv Bot and check it before running. Volatility indices only.
- **Importing Deriv Bot XML** reads market, contract, stake, duration and prediction only. Custom logic (conditions, indicators, Martingale maths) is not converted, and you get a notice saying so.
- Imported values are checked and limited to safe ranges; files over 200 KB and more than 30 bots are refused.
