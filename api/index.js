// Vercel Serverless Function: /api/*
// The FINNHUB_API_KEY must be set in Vercel Environment Variables, never in source.
const routes={
  search:['q'],
  quote:['symbol'],
  'stock/profile2':['symbol'],
  'stock/metric':['symbol','metric'],
  'company-news':['symbol','from','to']
};
const buckets=new Map(); // Best-effort per-instance protection; use Vercel Firewall for global limits.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const route=(Array.isArray(req.query.path)?req.query.path:[req.query.path]).filter(Boolean).join('/');
  const allowed=routes[route];
  if(!allowed)return res.status(404).json({error:'Unknown endpoint'});
  const key=process.env.FINNHUB_API_KEY;
  if(!key)return res.status(503).json({error:'Market data is not configured yet. The site owner must add FINNHUB_API_KEY in Vercel settings.'});
  const ip=(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const now=Date.now(),entry=buckets.get(ip);
  if(!entry||entry.until<=now)buckets.set(ip,{count:1,until:now+60000});
  else if(++entry.count>15){res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many requests. Try again in a minute.'})}
  if(buckets.size>10000){for(const [k,v] of buckets)if(v.until<=now)buckets.delete(k)}
  const url=new URL('https://finnhub.io/api/v1/'+route);
  for(const [k,v] of Object.entries(req.query)){
    if(k==='path')continue;
    if(!allowed.includes(k)||typeof v!=='string')return res.status(400).json({error:'Unsupported parameter'});
    if(k==='symbol'&&!/^[A-Za-z0-9.\-:_]{1,30}$/.test(v))return res.status(400).json({error:'Invalid symbol'});
    if(k==='q'&&(v.length>80||!v.trim()))return res.status(400).json({error:'Invalid search'});
    if((k==='from'||k==='to')&&!/^\d{4}-\d{2}-\d{2}$/.test(v))return res.status(400).json({error:'Invalid date'});
    if(k==='metric'&&v!=='all')return res.status(400).json({error:'Invalid metric'});
    url.searchParams.set(k,v);
  }
  if(route==='search'&&!url.searchParams.has('q'))return res.status(400).json({error:'Search query required'});
  if(route!=='search'&&!url.searchParams.has('symbol'))return res.status(400).json({error:'Symbol required'});
  if(route==='company-news'&&(!url.searchParams.has('from')||!url.searchParams.has('to')))return res.status(400).json({error:'Date range required'});
  try{
    const response=await fetch(url,{headers:{'X-Finnhub-Token':key,'Accept':'application/json'},signal:AbortSignal.timeout(9000)});
    if(!response.ok)return res.status(response.status===429?429:502).json({error:response.status===429?'Finnhub rate limit reached':'Finnhub returned an error'});
    const data=await response.json();
    return res.status(200).json(data);
  }catch{return res.status(502).json({error:'Unable to reach Finnhub right now'})}
}
