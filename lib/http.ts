import {DataUnavailable} from './cache-core';
import type {Envelope} from './types';
export function dataResponse<T>(result:Envelope<T>){return Response.json(result,{headers:{'Cache-Control':'no-store','X-Pulse-Cache':result.meta.cache,'X-Pulse-Fetched-At':result.meta.fetchedAt,'X-Content-Type-Options':'nosniff'}});}
export function errorResponse(error:unknown){return Response.json({error:error instanceof DataUnavailable?error.message:'This request could not be completed. Please try again.'},{status:error instanceof DataUnavailable?error.status:500,headers:{'Cache-Control':'no-store'}});}
