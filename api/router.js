const aliases = {'binance-coin':'binancecoin','avalanche':'avalanche-2','near-protocol':'near','pax-dollar':'paxos-standard','polygon':'matic-network'};
const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const capabilities = {emailPassword:false, google:false, passwordReset:false, emailVerification:false};

function json(data, status = 200, ttl = 0) {
  return Response.json(data, {status, headers:{
    'Cache-Control':ttl ? `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=300` : 'no-store',
    'X-Content-Type-Options':'nosniff',
  }});
}
function envelope(data, key, ttl) {
  const now = Date.now();
  return {data, meta:{key, cache:'MISS', fetchedAt:new Date(now).toISOString(), expiresAt:new Date(now + ttl * 1000).toISOString(), ageSeconds:0}};
}
async function upstream(url) {
  const response = await fetch(url, {headers:{Accept:'application/json'}, signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error(`The data provider returned ${response.status}. Please try again shortly.`);
  return response.json();
}
async function markets() {
  const result = await upstream('https://api.coinlore.net/api/tickers/?start=0&limit=30');
  if (!Array.isArray(result.data) || !result.data.length || !Number.isFinite(Number(result.info?.time))) throw new Error('The market feed is temporarily incomplete.');
  return result.data.map(t => ({
    id:aliases[t.nameid] ?? t.nameid, symbol:t.symbol.toLowerCase(), name:t.name, market_cap_rank:t.rank,
    current_price:number(t.price_usd), market_cap:number(t.market_cap_usd), total_volume:number(t.volume24),
    high_24h:null, low_24h:null, circulating_supply:number(t.csupply), total_supply:number(t.tsupply), max_supply:number(t.msupply), ath:null,
    price_change_percentage_24h:number(t.percent_change_24h), price_change_percentage_1h_in_currency:number(t.percent_change_1h),
    price_change_percentage_24h_in_currency:number(t.percent_change_24h), price_change_percentage_7d_in_currency:number(t.percent_change_7d),
    last_updated:new Date(Number(result.info.time) * 1000).toISOString(), source:'CoinLore', provider_id:t.id,
  }));
}
async function rates() {
  const rows = await upstream('https://api.frankfurter.dev/v2/rates?base=USD');
  if (!Array.isArray(rows) || !rows.length) throw new Error('The currency feed is temporarily incomplete.');
  const result = {base:'USD', rates:{USD:1}, dates:{USD:new Date().toISOString().slice(0,10)}, source:'Frankfurter'};
  for (const row of rows) if (/^[A-Z]{3}$/.test(row.quote) && row.rate > 0 && Number.isFinite(row.rate)) {
    result.rates[row.quote] = row.rate;
    result.dates[row.quote] = row.date;
  }
  return result;
}
async function chart(id, days) {
  const coin = (await markets()).find(item => item.id === id);
  if (!coin) return json({error:'This asset is not in the current top 30.'},404);
  const history = await upstream(`https://api.coinlore.net/api/coin/ohlcv/?coin=${encodeURIComponent(coin.provider_id)}`);
  const candles = Object.values(history).filter(row => Array.isArray(row) && row.length >= 5 && row.slice(0,5).every(Number.isFinite) && row[4] > 0).sort((a,b) => a[0] - b[0]);
  if (candles.length < 2) throw new Error('Daily history is unavailable for this asset.');
  const prices = candles.map(row => [(row[0] + 86400) * 1000, row[4]]);
  const time = Date.parse(coin.last_updated);
  if (coin.current_price > 0 && time > prices.at(-1)[0]) prices.push([time, coin.current_price]);
  const cutoff = prices.at(-1)[0] - Number(days) * 86400000;
  const start = prices.findIndex(point => point[0] >= cutoff);
  const last = candles.at(-1);
  return json(envelope({prices:prices.slice(Math.max(0,start - 1)), source:'CoinLore', granularity:'daily', dailyRange:{low:last[3], high:last[2], date:new Date(last[0] * 1000).toISOString().slice(0,10)}}, `chart:${id}:${days}`,300),200,300);
}

export async function GET(request) {
  const url = new URL(request.url);
  const route = '/' + (url.searchParams.get('path') ?? url.pathname.replace(/^\/api\//,'')).replace(/^\/+|\/+$/g,'');
  try {
    if (route === '/account') return json({user:null, ids:[], auth:capabilities});
    if (route === '/markets') return json(envelope(await markets(),'cl:markets:usd:30',600),200,600);
    if (route === '/fx') return json(envelope(await rates(),'fx:usd',21600),200,21600);
    const match = route.match(/^\/coins\/([a-z0-9-]{1,80})\/chart$/);
    if (match) {
      const days = url.searchParams.get('days') ?? '7';
      if (!['1','7','30','365'].includes(days)) return json({error:'Choose a supported chart period.'},400);
      return await chart(match[1],days);
    }
    if (route === '/watchlist' || route.startsWith('/auth/')) return json({error:'Account access is not available on this deployment yet.'},503);
    return json({error:'Not found.'},404);
  } catch (error) {
    console.error('Pulse market request failed:',error instanceof Error ? error.message : 'Unknown error');
    return json({error:error instanceof Error ? error.message : 'Market data is temporarily unavailable.'},503);
  }
}
export async function POST() {
  return json({error:'Account access is not available on this deployment yet.'},503);
}
