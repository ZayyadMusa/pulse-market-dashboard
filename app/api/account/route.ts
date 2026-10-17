import {pulseSession,authCapabilities} from '@/lib/auth-server';
import {accountView,watchlistOwner} from '@/lib/account-policy';
import {getSaved} from '@/lib/data';
import {errorResponse} from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const session=await pulseSession(request.headers);const visitor=session?.user??null;
  return Response.json({user:accountView(visitor),ids:visitor?await getSaved(watchlistOwner(visitor.id)):[],auth:authCapabilities()},{headers:{'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
 }catch(error){return errorResponse(error);}
}
