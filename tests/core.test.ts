import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {cached,reserveCrypto,budgetKeys,MONTHLY_LIMIT,MINUTE_LIMIT,DataUnavailable} from '../lib/cache-core.ts';
import {readWatchlist,writeWatchlist} from '../lib/watchlist-core.ts';
import {convertAmount,sortCoins,priceText} from '../lib/market-math.ts';

function database(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8'));
 function prepare(sql:string){return {bind(...values:unknown[]){const statement=sqlite.prepare(sql);return {async first<T>(){return (statement.get(...values as never[])??null) as T|null;},async run(){const result=statement.run(...values as never[]);return {success:true,meta:{changes:Number(result.changes)},results:[]};},async all<T>(){return {success:true,results:statement.all(...values as never[]) as T[]};}};}};}
 return {db:{prepare} as unknown as D1Database,sqlite};
}
const now=Date.parse('2026-10-16T00:00:00.000Z');
test('shared durable cache: repeat requests and a new caller need one upstream request',async()=>{
 const {db,sqlite}=database();let calls=0;
 const load=()=>cached({db,key:'markets:usd:30',ttl:600000,crypto:true,now:()=>now,loader:async()=>{calls++;return {price:82};}});
 const first=await load(),second=await load();const third=await cached({db,key:'markets:usd:30',ttl:600000,crypto:true,now:()=>now+9000,loader:async()=>{throw Error('must not call');}});
 assert.equal(calls,1);assert.equal(first.meta.cache,'MISS');assert.equal(second.meta.cache,'HIT');assert.equal(third.meta.cache,'HIT');assert.equal(third.meta.ageSeconds,9);assert.equal(first.meta.fetchedAt,second.meta.fetchedAt);
 assert.equal(sqlite.prepare('SELECT calls FROM api_usage WHERE key=?').get(budgetKeys(now).month)?.calls,1);
});
test('lease prevents simultaneous cache misses from duplicating upstream calls',async()=>{
 const {db}=database();let calls=0;let release:(value:{price:number})=>void=()=>{};
 const gate=new Promise<{price:number}>(resolve=>{release=resolve;});
 const first=cached({db,key:'markets',ttl:1000,crypto:true,now:()=>now,loader:async()=>{calls++;return gate;}});
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(cached({db,key:'markets',ttl:1000,crypto:true,now:()=>now,loader:async()=>{calls++;return {price:90};}}),DataUnavailable);
 release({price:80});await first;assert.equal(calls,1);
});
test('expired data refreshes once and failed refresh serves visibly stale last-good data',async()=>{
 const {db}=database();let time=now;let failing=false;let calls=0;
 const load=()=>cached({db,key:'chart:bitcoin:1',ttl:1000,crypto:true,now:()=>time,loader:async()=>{calls++;if(failing)throw Error('provider down');return {price:calls};}});
 await load();time+=1001;const second=await load();assert.equal(second.data.price,2);assert.equal(second.meta.cache,'MISS');
 time+=1001;failing=true;const fallback=await load();assert.equal(fallback.meta.cache,'STALE');assert.equal(fallback.data.price,2);assert.match(fallback.meta.warning??'',/last available/);
 const retry=await load();assert.equal(retry.meta.cache,'STALE');assert.equal(calls,3,'failure backoff prevents hammering the provider');
});
test('hard monthly ceiling includes failed upstream attempts and never permits attempt 9001',async()=>{
 const {db,sqlite}=database();const month=budgetKeys(now).month;sqlite.prepare('INSERT INTO api_usage (key,calls) VALUES (?,?)').run(month,MONTHLY_LIMIT-1);
 await assert.rejects(cached({db,key:'one',ttl:1000,crypto:true,now:()=>now,loader:async()=>{throw Error('failed provider call');}}));
 assert.equal(sqlite.prepare('SELECT calls FROM api_usage WHERE key=?').get(month)?.calls,MONTHLY_LIMIT);
 let called=false;await assert.rejects(cached({db,key:'two',ttl:1000,crypto:true,now:()=>now,loader:async()=>{called=true;return 1;}}));
 assert.equal(called,false);assert.equal(sqlite.prepare('SELECT calls FROM api_usage WHERE key=?').get(month)?.calls,MONTHLY_LIMIT);
});
test('minute cap holds under concurrent callers and UTC month rollover resets safely',async()=>{
 const {db,sqlite}=database();const results=await Promise.allSettled(Array.from({length:MINUTE_LIMIT+10},()=>reserveCrypto(db,now)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,MINUTE_LIMIT);
 const month=budgetKeys(now).month;assert.equal(sqlite.prepare('SELECT calls FROM api_usage WHERE key=?').get(month)?.calls,MINUTE_LIMIT);
 const next=Date.parse('2026-11-01T00:00:01Z');await reserveCrypto(db,next);assert.equal(sqlite.prepare('SELECT calls FROM api_usage WHERE key=?').get(budgetKeys(next).month)?.calls,1);
});
test('fiat requests do not use the crypto budget',async()=>{
 const {db,sqlite}=database();await cached({db,key:'fx:usd',ttl:6000,now:()=>now,loader:async()=>({NGN:1330})});
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM api_usage').get()?.count,0);
});
test('watchlist service persists new sessions, rejects anonymous writes and isolates users',async()=>{
 const {db}=database();const allowed=['bitcoin','ethereum'];
 await writeWatchlist(db,'user-a','bitcoin',true,allowed,now);await writeWatchlist(db,'user-b','ethereum',true,allowed,now);await writeWatchlist(db,'user-a','bitcoin',true,allowed,now+1);
 assert.deepEqual(await readWatchlist(db,'user-a'),['bitcoin']);assert.deepEqual(await readWatchlist(db,'user-b'),['ethereum']);
 await assert.rejects(readWatchlist(db,null),error=>error instanceof DataUnavailable&&error.status===401);
 await assert.rejects(writeWatchlist(db,null,'bitcoin',true,allowed),error=>error instanceof DataUnavailable&&error.status===401);
 await assert.rejects(writeWatchlist(db,'user-a','not-a-supported-asset',true,allowed),error=>error instanceof DataUnavailable&&error.status===400);
 // A new authenticated request/session with the same stable platform id recovers the same records.
 const nextSessionId='user-a';assert.deepEqual(await readWatchlist(db,nextSessionId),['bitcoin']);
 await writeWatchlist(db,'user-b','bitcoin',false,[]);assert.deepEqual(await readWatchlist(db,'user-a'),['bitcoin']);
 await writeWatchlist(db,'user-a','bitcoin',false,[]);assert.deepEqual(await readWatchlist(db,'user-a'),[]);
});
test('conversion is reversible for crypto, fiat and NGN; invalid and missing rates fail closed',()=>{
 const btcUSD=80000,usdNGN=1330;const naira=convertAmount(2,btcUSD,1/usdNGN);assert.equal(naira,212800000);assert.equal(convertAmount(naira!,1/usdNGN,btcUSD),2);
 assert.ok(Math.abs(convertAmount(100,1/0.75,1/0.9)!-120)<1e-10);assert.equal(convertAmount(0,1,2),0);
 for(const amount of [-1,NaN,Infinity])assert.equal(convertAmount(amount,1,2),null);
 assert.equal(convertAmount(1,0,2),null);assert.equal(convertAmount(1,1,0),null);assert.equal(priceText(null),'—');
});
test('table search and sorting preserve unknown prices and do not mutate the input',()=>{
 const original=[{id:'bitcoin',name:'Bitcoin',symbol:'btc',price:8},{id:'ethereum',name:'Ethereum',symbol:'eth',price:3},{id:'unknown',name:'Unknown',symbol:'unk',price:null}];
 assert.deepEqual(sortCoins(original,'','price',true).map(x=>x.id),['ethereum','bitcoin','unknown']);assert.deepEqual(sortCoins(original,'','price',false).map(x=>x.id),['bitcoin','ethereum','unknown']);assert.equal(sortCoins(original,' BTC ','name',true)[0].id,'bitcoin');assert.equal(original[0].id,'bitcoin');
});

test('CoinLore normalization preserves unknown supply instead of inventing zero',async()=>{
 const {normalizeLore}=await import('../lib/coinlore-core.ts');
 const rows=normalizeLore([{id:'90',symbol:'BTC',name:'Bitcoin',nameid:'bitcoin',rank:1,price_usd:'82437',market_cap_usd:'1000000',volume24:200,csupply:'19000000',tsupply:'19000000',msupply:'',percent_change_1h:'0.1',percent_change_24h:'0.9',percent_change_7d:'-0.1'}],now/1000);
 assert.equal(rows[0].current_price,82437);assert.equal(rows[0].max_supply,null);assert.equal(rows[0].source,'CoinLore');assert.equal(rows[0].provider_id,'90');assert.equal(rows[0].last_updated,new Date(now).toISOString());
});
test('daily fallback chart uses real closes, latest quote, and an explicitly dated UTC range',async()=>{
 const {loreChart}=await import('../lib/coinlore-core.ts');
 const coin={id:'bitcoin',current_price:85,last_updated:new Date(now+3600000).toISOString()} as never;
 const history:Record<string,number[]>={};for(let i=0;i<365;i++){const t=(now/1000)-(365-i)*86400;history[String(t)]=[t,70+i,90+i,60+i,80+i,1000];}
 for(const period of ['1','7','30','365'] as const){const data=loreChart(history,coin,period);assert.ok(data.prices.length>=2);assert.equal(data.source,'CoinLore');assert.equal(data.granularity,'daily');assert.deepEqual(data.prices.at(-1),[now+3600000,85]);assert.equal(data.dailyRange?.date,'2026-10-15');assert.equal(data.dailyRange?.high,454);}
});

test('platform identity requires the stable id and decodes names safely',async()=>{
 const {platformUser}=await import('../lib/identity-core.ts');
 assert.equal(platformUser(new Headers({'x-authenticated-user-email':'preview@example.test'})),null);
 const user=platformUser(new Headers({'x-authenticated-user-id':'stable-test-id','x-authenticated-user-email':'test@example.test','x-authenticated-user-full-name':'Test%20User','x-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}));
 assert.equal(user?.userId,'stable-test-id');assert.equal(user?.displayName,'Test User');
 const malformed=platformUser(new Headers({'x-authenticated-user-id':'stable-test-id','x-authenticated-user-email':'test@example.test','x-authenticated-user-full-name':'%malformed','x-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}));assert.equal(malformed?.displayName,'test@example.test');
});

test('customer display removes emails and safe return paths stay on the app',async()=>{
 const {accountView,watchlistOwner,safeReturnPath}=await import('../lib/account-policy.ts');
 assert.equal(accountView(null),null);assert.deepEqual(accountView({id:'a',name:'Person',email:'private@example.com'}),{displayName:'Person'});assert.deepEqual(accountView({id:'a',name:'private@example.com',email:'private@example.com'}),{displayName:'Pulse member'});
 assert.equal(watchlistOwner('a'),'pulse:a');assert.equal(safeReturnPath('//untrusted.example/'),'/watchlist');assert.equal(safeReturnPath('/\\untrusted.example'),'/watchlist');assert.equal(safeReturnPath('/coin/bitcoin?view=price'),'/coin/bitcoin?view=price');
});
test('diagnostics require an allowed platform owner with stable identity',async()=>{
 const {isAdministrator}=await import('../lib/admin-core.ts');
 const owner={'x-authenticated-user-id':'owner-stable-id','x-authenticated-user-email':'owner@example.com'};
 assert.equal(isAdministrator(new Headers(),'owner@example.com'),false);assert.equal(isAdministrator(new Headers({'x-authenticated-user-email':'owner@example.com'}),'owner@example.com'),false);assert.equal(isAdministrator(new Headers(owner),undefined),false);assert.equal(isAdministrator(new Headers(owner),'other@example.com'),false);assert.equal(isAdministrator(new Headers(owner),'owner@example.com'),true);
});
