import {writeWatchlist} from '@/lib/watchlist-core';
import {pulseSession} from '@/lib/auth-server';
import {watchlistOwner} from '@/lib/account-policy';
import {database,getSaved,getMarkets} from '@/lib/data';
import {errorResponse} from '@/lib/http';
export const dynamic='force-dynamic';
const unauthorized=()=>Response.json({error:'Sign in to save your watchlist.'},{status:401,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{const session=await pulseSession(request.headers);if(!session)return unauthorized();return Response.json({ids:await getSaved(watchlistOwner(session.user.id))},{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){
 try{
  const session=await pulseSession(request.headers);if(!session)return unauthorized();
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'This request is not allowed.'},{status:403});
  const body=await request.json() as {coinId?:unknown;saved?:unknown};
  if(typeof body.coinId!=='string'||!/^[a-z0-9-]{1,80}$/.test(body.coinId)||typeof body.saved!=='boolean')return Response.json({error:'Choose a valid asset.'},{status:400});
  const allowed=body.saved?(await getMarkets()).data.map(c=>c.id):[];
  const ids=await writeWatchlist(database(),watchlistOwner(session.user.id),body.coinId,body.saved,allowed);
  return Response.json({ids},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}
}
