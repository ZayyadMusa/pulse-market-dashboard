import {getFx} from '@/lib/data';
import {dataResponse,errorResponse} from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(){try{return dataResponse(await getFx());}catch(e){return errorResponse(e);}}
