import {DataUnavailable} from './cache-core.ts';
function requireUser(userId:string|null):string{if(!userId)throw new DataUnavailable('Sign in to use your watchlist.',401);return userId;}
export async function readWatchlist(db:D1Database,userId:string|null):Promise<string[]>{
 const owner=requireUser(userId);const result=await db.prepare('SELECT coin_id FROM watchlist WHERE user_id=? ORDER BY created_at').bind(owner).all<{coin_id:string}>();return (result.results??[]).map(r=>r.coin_id);
}
export async function writeWatchlist(db:D1Database,userId:string|null,coinId:string,saved:boolean,allowedIds:string[],now=Date.now()):Promise<string[]>{
 const owner=requireUser(userId);if(!/^[a-z0-9-]{1,80}$/.test(coinId))throw new DataUnavailable('Choose a valid asset.',400);
 if(saved){if(!allowedIds.includes(coinId))throw new DataUnavailable('Choose an asset from the current market list.',400);await db.prepare('INSERT OR IGNORE INTO watchlist (user_id,coin_id,created_at) VALUES (?,?,?)').bind(owner,coinId,now).run();}
 else await db.prepare('DELETE FROM watchlist WHERE user_id=? AND coin_id=?').bind(owner,coinId).run();
 return readWatchlist(db,owner);
}
