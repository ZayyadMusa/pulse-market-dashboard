import {readWatchlist} from './watchlist-core';
import {normalizeLore,loreChart,loreNumber} from './coinlore-core';
import type {LoreTicker,LoreHistory} from './coinlore-core';
import {env} from 'cloudflare:workers';
import {cached,DataUnavailable,budgetKeys,MONTHLY_LIMIT,MINUTE_LIMIT} from './cache-core';
import type {Coin,FxRate,FxData,ChartData,Period,StatusData} from './types';
export function database():D1Database{if(!env.DB)throw new DataUnavailable('The market database is not connected.');return env.DB;}
const key=()=>((env as unknown as Record<string,string>).COINGECKO_DEMO_API_KEY||'');
async function fetchJson<T>(url:string,crypto=false):Promise<T>{
 const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'PulsePortfolio/1.0',...(crypto&&key()?{'x-cg-demo-api-key':key()}:{} )},signal:AbortSignal.timeout(14000)});
 if(!response.ok)throw new DataUnavailable(`The ${crypto||url.includes('coinlore')?'crypto':'FX'} provider returned ${response.status}. Please try again shortly.`,response.status===429?429:503);
 return response.json() as Promise<T>;
}
function getLoreMarkets(){return cached<Coin[]>({db:database(),key:'cl:markets:usd:30',ttl:600000,crypto:true,loader:async()=>{
 const result=await fetchJson<{data:LoreTicker[];info:{time:number}}>('https://api.coinlore.net/api/tickers/?start=0&limit=30');
 if(!Array.isArray(result.data)||result.data.length<1||!result.info?.time)throw new DataUnavailable('The crypto feed returned an incomplete response.');
 return normalizeLore(result.data,result.info.time);
}});}
export async function getMarkets(){
 // A dedicated Demo key selects CoinGecko; keyless hosting uses CoinLore to avoid shared-IP throttling.
 if(!key())return getLoreMarkets();
 try{return await cached<Coin[]>({db:database(),key:'cg:markets:usd:30',ttl:600000,crypto:true,loader:async()=>{
  const data=await fetchJson<Coin[]>('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=1h,24h,7d',true);
  if(!Array.isArray(data)||data.length<1||!data[0].id)throw new DataUnavailable('The crypto feed returned an incomplete response.');
  return data.map(c=>({...c,source:'CoinGecko' as const}));
 }});}catch{return getLoreMarkets();}
}
export function getFx(){return cached<FxData>({db:database(),key:'fx:usd',ttl:21600000,loader:async()=>{
 const rows=await fetchJson<FxRate[]>('https://api.frankfurter.dev/v2/rates?base=USD');
 if(!Array.isArray(rows)||!rows.some(r=>r.quote==='NGN'&&r.rate>0))throw new DataUnavailable('The currency feed is temporarily incomplete.');
 const rates:Record<string,number>={USD:1},dates:Record<string,string>={USD:new Date().toISOString().slice(0,10)};
 for(const row of rows)if(row.rate>0&&Number.isFinite(row.rate)){rates[row.quote]=row.rate;dates[row.quote]=row.date;}
 return {base:'USD',rates,dates,source:'Frankfurter'};
}});}
const ttls:Record<Period,number>={'1':900000,'7':7200000,'30':21600000,'365':86400000};
export async function getChart(id:string,days:Period){
 if(!/^[a-z0-9-]{1,80}$/.test(id)||!(days in ttls))throw new DataUnavailable('Choose a supported asset and chart period.',400);
 const markets=await getMarkets();const coin=markets.data.find(c=>c.id===id);if(!coin)throw new DataUnavailable('This asset is not in the current top 30.',404);
 if(coin.source==='CoinLore'&&coin.provider_id){
  const history=await cached<LoreHistory>({db:database(),key:`cl:history:${coin.provider_id}`,ttl:21600000,crypto:true,loader:async()=>{const rows=await fetchJson<LoreHistory>(`https://api.coinlore.net/api/coin/ohlcv/?coin=${coin.provider_id}`);if(!rows||Object.values(rows).filter(r=>Array.isArray(r)&&r.length>=5&&r.slice(0,5).every(Number.isFinite)&&r[4]>0).length<2)throw new DataUnavailable('Daily history is unavailable for this asset.');return rows;}});
  const chart=loreChart(history.data,coin,days);
  try{const info=await cached<{ath:number|null}>({db:database(),key:`cl:info:${coin.provider_id}`,ttl:86400000,crypto:true,loader:async()=>{
   const rows=await fetchJson<{ath:unknown}[]>(`https://api.coinlore.net/api/coin/info/?id=${coin.provider_id}`);return {ath:loreNumber(rows[0]?.ath)};
  }});chart.ath=info.data.ath;}catch{}
  return {data:chart,meta:{...history.meta,key:`chart:${id}:${days}`}};
 }
 return cached<ChartData>({db:database(),key:`chart:${id}:${days}`,ttl:ttls[days],crypto:true,loader:async()=>{
  const data=await fetchJson<ChartData>(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`,true);
  if(!Array.isArray(data.prices)||data.prices.length<2)throw new DataUnavailable('Historical prices are unavailable for this period.');
  return {prices:data.prices.filter(p=>p.length===2&&p.every(Number.isFinite)),source:'CoinGecko',granularity:days==='365'?'daily':'intraday'};
 }});
}
export async function getStatus():Promise<StatusData>{
 const db=database();const month=new Date().toISOString().slice(0,7);
 const [usage,metrics,resources]=await Promise.all([
 db.prepare('SELECT calls FROM api_usage WHERE key=?').bind(budgetKeys(Date.now()).month).first<{calls:number}>(),
 db.prepare('SELECT key,value FROM cache_metrics').all<{key:string;value:number}>(),
 db.prepare('SELECT key,fetched_at AS fetchedAt,expires_at AS expiresAt FROM api_cache WHERE payload IS NOT NULL ORDER BY key').all<{key:string;fetchedAt:number;expiresAt:number}>()
 ]);
 return {month,monthlyUsed:usage?.calls??0,monthlyLimit:MONTHLY_LIMIT,minuteLimit:MINUTE_LIMIT,metrics:Object.fromEntries((metrics.results??[]).map(x=>[x.key,x.value])),resources:resources.results??[],keyConfigured:!!key()};
}
export function getSaved(userId:string){return readWatchlist(database(),userId);}
