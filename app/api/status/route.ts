import {getStatus} from '@/lib/data';
import {errorResponse} from '@/lib/http';
import {canInspectSystem} from '@/lib/auth-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){if(!await canInspectSystem(request.headers))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});try{return Response.json(await getStatus(),{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
