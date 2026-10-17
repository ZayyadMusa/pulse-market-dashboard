import type {Coin,ChartData,Period} from './types';
export type LoreTicker={id:string;symbol:string;name:string;nameid:string;rank:number;price_usd:string;market_cap_usd:string;volume24:number;csupply:string;tsupply:string;msupply:string;percent_change_1h:string;percent_change_24h:string;percent_change_7d:string};
export type LoreHistory=Record<string,number[]>;
const aliases:Record<string,string>={'binance-coin':'binancecoin','avalanche':'avalanche-2','near-protocol':'near','usd-coin':'usd-coin','bitcoin-cash':'bitcoin-cash','leo-token':'leo-token','ethena-usde':'ethena-usde','pax-dollar':'paxos-standard','polygon':'matic-network'};
export function loreNumber(value:unknown):number|null{if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
export function normalizeLore(tickers:LoreTicker[],timestamp:number):Coin[]{return tickers.map(t=>({
 id:aliases[t.nameid]??t.nameid,symbol:t.symbol.toLowerCase(),name:t.name,market_cap_rank:t.rank,current_price:loreNumber(t.price_usd),market_cap:loreNumber(t.market_cap_usd),total_volume:loreNumber(t.volume24),high_24h:null,low_24h:null,circulating_supply:loreNumber(t.csupply),total_supply:loreNumber(t.tsupply),max_supply:loreNumber(t.msupply),ath:null,price_change_percentage_24h:loreNumber(t.percent_change_24h),price_change_percentage_1h_in_currency:loreNumber(t.percent_change_1h),price_change_percentage_24h_in_currency:loreNumber(t.percent_change_24h),price_change_percentage_7d_in_currency:loreNumber(t.percent_change_7d),last_updated:new Date(timestamp*1000).toISOString(),source:'CoinLore',provider_id:t.id
}));}
export function loreChart(history:LoreHistory,coin:Coin,days:Period):ChartData{
 const candles=Object.values(history).filter(r=>r.length>=5&&r.slice(0,5).every(Number.isFinite)&&r[4]>0).sort((a,b)=>a[0]-b[0]);
 if(candles.length<2)throw new Error('Daily history is unavailable.');
 // Daily candle timestamps mark the start of the UTC day. Plot its close at the end of that day.
 const all=candles.map(r=>[(r[0]+86400)*1000,r[4]] as [number,number]);
 const quoteTime=Date.parse(coin.last_updated);
 if(coin.current_price!=null&&coin.current_price>0&&quoteTime>all.at(-1)![0])all.push([quoteTime,coin.current_price]);
 const end=all.at(-1)![0],cutoff=end-Number(days)*86400000;
 let start=all.findIndex(p=>p[0]>=cutoff);start=Math.max(0,start-1);
 const last=candles.at(-1)!;
 return {prices:all.slice(start),source:'CoinLore',granularity:'daily',dailyRange:{low:last[3],high:last[2],date:new Date(last[0]*1000).toISOString().slice(0,10)}};
}
