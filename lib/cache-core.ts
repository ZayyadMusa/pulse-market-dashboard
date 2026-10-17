import type {CacheMeta,Envelope} from './types';
export const MONTHLY_LIMIT=9000;
export const MINUTE_LIMIT=20;
type CacheRow={key:string;payload:string|null;fetched_at:number;expires_at:number;lease_until:number};
export class DataUnavailable extends Error { constructor(message:string,public status=503){super(message);} }
export function budgetKeys(now:number){const iso=new Date(now).toISOString();return {month:`crypto:month:${iso.slice(0,7)}`,minute:`crypto:minute:${iso.slice(0,16)}`};}
export function envelope<T>(row:CacheRow,cache:CacheMeta['cache'],now:number,warning?:string):Envelope<T>{
 return {data:JSON.parse(row.payload!),meta:{key:row.key,cache,fetchedAt:new Date(row.fetched_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString(),ageSeconds:Math.max(0,Math.floor((now-row.fetched_at)/1000)),...(warning?{warning}:{})}};
}
async function metric(db:D1Database,key:string){await db.prepare('INSERT INTO cache_metrics (key,value) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET value=value+1').bind(key).run();}
export async function reserveCrypto(db:D1Database,now:number){
 const keys=budgetKeys(now);
 const minute=await db.prepare('INSERT INTO api_usage (key,calls) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET calls=calls+1 WHERE calls < ? RETURNING calls').bind(keys.minute,MINUTE_LIMIT).first<{calls:number}>();
 if(!minute)throw new DataUnavailable('Crypto refresh is resting briefly. Please try again in a minute.',429);
 const month=await db.prepare('INSERT INTO api_usage (key,calls) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET calls=calls+1 WHERE calls < ? RETURNING calls').bind(keys.month,MONTHLY_LIMIT).first<{calls:number}>();
 if(!month)throw new DataUnavailable('Monthly refresh budget reached. Last available prices remain visible.',429);
}
export async function cached<T>(options:{db:D1Database;key:string;ttl:number;loader:()=>Promise<T>;crypto?:boolean;now?:()=>number}):Promise<Envelope<T>>{
 const {db,key,ttl,loader,crypto}=options;
 const clock=options.now??Date.now;const now=clock();
 let row=await db.prepare('SELECT * FROM api_cache WHERE key=?').bind(key).first<CacheRow>();
 if(row?.payload&&row.expires_at>now){await metric(db,'hits');return envelope<T>(row,'HIT',now);}
 await db.prepare('INSERT OR IGNORE INTO api_cache (key,payload,fetched_at,expires_at,lease_until) VALUES (?,NULL,0,0,0)').bind(key).run();
 const lease=await db.prepare('UPDATE api_cache SET lease_until=? WHERE key=? AND lease_until<=? RETURNING key').bind(now+30000,key,now).first();
 if(!lease){
   if(row?.payload){await metric(db,'stale');return envelope<T>(row,'STALE',now,'A shared refresh is in progress; showing the last available data.');}
   throw new DataUnavailable('This feed is refreshing. Please try again in a few seconds.',503);
 }
 // Re-read after acquiring the lease: another isolate may have completed since our initial read.
 row=await db.prepare('SELECT * FROM api_cache WHERE key=?').bind(key).first<CacheRow>();
 if(row?.payload&&row.expires_at>now){await db.prepare('UPDATE api_cache SET lease_until=0 WHERE key=?').bind(key).run();await metric(db,'hits');return envelope<T>(row,'HIT',now);}
 try{
   if(crypto)await reserveCrypto(db,now);
   await metric(db,crypto?'crypto_attempts':'fx_attempts');
   const data=await loader();const done=clock();
   const payload=JSON.stringify(data);
   await db.prepare('UPDATE api_cache SET payload=?,fetched_at=?,expires_at=?,lease_until=0 WHERE key=?').bind(payload,done,done+ttl,key).run();
   await metric(db,'misses');
   return envelope<T>({key,payload,fetched_at:done,expires_at:done+ttl,lease_until:0},'MISS',done);
 }catch(error){
   await db.prepare('UPDATE api_cache SET lease_until=? WHERE key=?').bind(clock()+60000,key).run();
   await metric(db,'errors');
   if(row?.payload){await metric(db,'stale');return envelope<T>(row,'STALE',clock(),'The data provider could not refresh. Showing the last available data.');}
   throw error instanceof DataUnavailable?error:new DataUnavailable('The data provider is temporarily unavailable. Please try again shortly.');
 }
}
