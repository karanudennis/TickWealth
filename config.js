/* Site configuration — edit this file, not the pages. */
window.TW_CONFIG = {
  // Premium bots / M-Pesa. Leave false until you have a real backend (see README.md).
  // While false, every bot is free and no payment UI is shown.
  paymentsEnabled: false,
  mpesaApi: '',            // e.g. 'https://api.yoursite.com'  (must implement POST /stkpush and GET /status — see README)
  priceKES: 1500,
  // AI coach backed by Gemini 3.8 Flash via full-stack /api/ai/chat
  aiEndpoint: '/api/ai/chat',
  freeBots: ['phantom', 'raptor']
};
