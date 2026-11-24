# Deploy EquityIQ with Vercel

1. Sign in to https://vercel.com/new with GitHub, and import `vismaysrinivas/EquityIQ`.
2. Choose **Other** framework, project root `./`, and deploy.
3. In Vercel **Project → Settings → Environment Variables**, add `FINNHUB_API_KEY` with a **newly rotated** Finnhub key. Never paste it in GitHub source or client-side settings.
4. Redeploy the project after adding the variable.
5. Open your Vercel `*.vercel.app` URL. Search, analysis and comparisons will use same-origin `/api` automatically. The old GitHub Pages URL is not the Vercel app and will not have the API.

The serverless function only supports five allowlisted read-only Finnhub routes. It includes best-effort in-memory throttling (15 requests/minute per IP per warm function instance), **not guaranteed global rate limiting**. For production use, configure Vercel Firewall rate limiting or an external persistent rate-limit store, and set usage alerts. The function does not expose the Finnhub token.

The app's browser-local sign-in is not secure multi-user authentication. Do not use real financial credentials or sensitive information.

The `worker/` folder is a previous Cloudflare option and is not used by the Vercel deployment.
