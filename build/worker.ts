import handler from 'vinext/server/fetch-handler';
import {pulseRoute} from '../lib/page-routes';
import {pageSnapshot} from '../lib/page-snapshot';
import {pulseDocument} from '../lib/app-document';
import {pulseAuth,canInspectSystem} from '../lib/auth-server';

export default {
  async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
    const path=new URL(request.url).pathname;
    if(path.startsWith('/api/auth/')){
      try {const response=await pulseAuth().handler(request);const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,headers});}
      catch {return Response.json({error:'Account access is temporarily unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});}
    }
    const page=pulseRoute(path);
    if(request.method==='GET'&&page){
      if(page.view==='status'&&!await canInspectSystem(request.headers))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
      return new Response(pulseDocument(await pageSnapshot(page,request.headers)),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    }
    return handler.fetch(request,env,ctx);
  }
};
