import {getChart} from '@/lib/data';
import {dataResponse,errorResponse} from '@/lib/http';
import type {Period} from '@/lib/types';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const {id}=await context.params;const days=new URL(request.url).searchParams.get('days')??'7';return dataResponse(await getChart(id,days as Period));}catch(e){return errorResponse(e);}}
