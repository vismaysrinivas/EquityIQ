// EquityIQ Finnhub proxy. Never store FINNHUB_API_KEY in this repository.
// Deploy with Cloudflare Workers and bind FINNHUB_API_KEY as a secret.
// Configure RATE_LIMITER in wrangler.jsonc for per-IP throttling.
const ORIGIN = "https://vismaysrinivas.github.io";
const PATHS = {
  "/api/search": ["q"],
  "/api/quote": ["symbol"],
  "/api/stock/profile2": ["symbol"],
  "/api/stock/metric": ["symbol", "metric"],
  "/api/company-news": ["symbol", "from", "to"]
};
const json = (data, status=200, extra={}) => new Response(JSON.stringify(data), {
  status, headers: {"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store", "x-content-type-options":"nosniff",
  "access-control-allow-origin":ORIGIN, "vary":"Origin", ...extra}
});
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      if (origin !== ORIGIN) return new Response(null, {status:403});
      return new Response(null,{status:204,headers:{
        "access-control-allow-origin":ORIGIN,
        "access-control-allow-methods":"GET, OPTIONS",
        "access-control-allow-headers":"content-type",
        "access-control-max-age":"600","vary":"Origin"
      }});
    }
    if (request.method !== "GET") return json({error:"Method not allowed"},405);
    // Origin is a browser access policy, not authentication: non-browser clients can forge it.
    if (origin && origin !== ORIGIN) return json({error:"Origin not allowed"},403);
    const url = new URL(request.url), allowed = PATHS[url.pathname];
    if (!allowed) return json({error:"Unknown endpoint"},404);
    if (!env.FINNHUB_API_KEY) return json({error:"Market data backend not configured"},503);
    if (!env.RATE_LIMITER) return json({error:"Rate limiter not configured"},503);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const rate = await env.RATE_LIMITER.limit({key:ip});
    if (!rate.success) return json({error:"Too many requests. Please retry in a minute."},429,{"retry-after":"60"});
    const incoming = Object.fromEntries(url.searchParams);
    if (Object.keys(incoming).some(k => !allowed.includes(k))) return json({error:"Unsupported parameter"},400);
    const symbol = incoming.symbol;
    if (symbol && !/^[A-Za-z0-9.\-:_]{1,30}$/.test(symbol)) return json({error:"Invalid ticker"},400);
    if (incoming.q && (incoming.q.length>80 || !/^[\p{L}\p{N} .&'\-]{1,80}$/u.test(incoming.q))) return json({error:"Invalid query"},400);
    for (const key of ["from","to"]) if (incoming[key] && !/^\d{4}-\d{2}-\d{2}$/.test(incoming[key])) return json({error:"Invalid date"},400);
    if (incoming.metric && incoming.metric !== "all") return json({error:"Invalid metric"},400);
    if ((url.pathname === "/api/search" && !incoming.q) || (url.pathname !== "/api/search" && !symbol)) return json({error:"Required parameter missing"},400);
    if (url.pathname === "/api/company-news" && (!incoming.from || !incoming.to)) return json({error:"Dates required"},400);
    const upstream = new URL("https://finnhub.io/api/v1"+url.pathname.slice(4));
    for (const k of allowed) if (incoming[k]) upstream.searchParams.set(k,incoming[k]);
    // Finnhub supports X-Finnhub-Token, keeping the key out of URLs and access logs.
    let result;
    try {
      result = await fetch(upstream.toString(),{
        headers:{"X-Finnhub-Token":env.FINNHUB_API_KEY,"accept":"application/json"},
        signal:AbortSignal.timeout(9000)
      });
    } catch {return json({error:"Market data provider unavailable"},502)}
    if (!result.ok) return json({error:result.status===429?"Market data rate limit reached":"Market data provider returned an error"},result.status===429?429:502);
    const contentType = result.headers.get("content-type") || "";
    if (!contentType.includes("json")) return json({error:"Unexpected provider response"},502);
    return new Response(result.body,{status:200,headers:{
      "content-type":"application/json; charset=utf-8",
      "access-control-allow-origin":ORIGIN,
      "vary":"Origin",
      "cache-control":"public, max-age=15",
      "x-content-type-options":"nosniff"
    }});
  }
};
