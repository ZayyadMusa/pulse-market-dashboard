import {getMarkets} from '@/lib/data';
import {dataResponse,errorResponse} from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(){try{return dataResponse(await getMarkets());}catch(e){return errorResponse(e);}}
