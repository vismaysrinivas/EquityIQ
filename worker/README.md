# EquityIQ secure market-data backend

The public GitHub Pages app cannot safely store a Finnhub API key. This Cloudflare Worker holds the key as a **server-side secret**, forwards only five allowlisted read-only Finnhub endpoints, and enforces **15 requests per minute per client IP** with a Cloudflare Rate Limiting binding. The key is never committed to GitHub or returned to the browser.

## One-time setup (requires your Cloudflare account)

1. Rotate the Finnhub key that was pasted into chat. Use the newly issued key, **not the old one**.
2. Install Node.js, then in the `worker` directory run `npx wrangler login`.
3. Run `npx wrangler secret put FINNHUB_API_KEY --name equityiq-finnhub-api` and paste the **new** Finnhub key when prompted. Do not add it to source code or GitHub Secrets.
4. Run `npx wrangler deploy` from the `worker` directory. Save the resulting HTTPS `*.workers.dev` URL.
5. Open https://vismaysrinivas.github.io/EquityIQ/ → **Settings → Market Data Backend**. Paste the Worker URL (not the Finnhub key) and save it. The URL is public and safe to share.
6. Check Company Analysis or Global Search. If the API returns an error, check Cloudflare Worker logs and the Finnhub plan.

**Important:** The Worker must be deployed from your Cloudflare account. Committing these files does not deploy it or install the secret. Cloudflare Rate Limiting limits abuse but is not an absolute quota guarantee. The `Origin` restriction only limits browsers; non-browser clients can call the public endpoint. For production-grade budget protection, configure Cloudflare WAF rules, usage alerts and account-level limits.

The login in the static site remains browser-local and **is not secure multi-user authentication**. Do not store real financial credentials or sensitive information in it.

## Allowed API endpoints

- `GET /api/search?q=AAPL`
- `GET /api/quote?symbol=AAPL`
- `GET /api/stock/profile2?symbol=AAPL`
- `GET /api/stock/metric?symbol=AAPL&metric=all`
- `GET /api/company-news?symbol=AAPL&from=2026-11-01&to=2026-11-23`

No arbitrary proxying or key-reading endpoint is available.
