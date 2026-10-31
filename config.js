/* Site configuration — edit this file, not the pages. */
window.TW_CONFIG = {
  // Premium bots / M-Pesa. Leave false until you have a real backend (see README.md).
  // While false, every bot is free and no payment UI is shown.
  paymentsEnabled: false,
  mpesaApi: '',            // e.g. 'https://api.yoursite.com'  (must implement POST /stkpush and GET /status — see README)
  priceKES: 1500,
  // AI coach. Leave '' to use the built-in on-device explainer. For full AI answers, run server/ai-proxy.js
  // and put its URL here, e.g. 'https://ai.yoursite.com/ai'. The API key stays on that server.
  aiEndpoint: '',
  freeBots: ['phantom', 'raptor']
};
