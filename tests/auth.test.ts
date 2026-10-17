import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {drizzle} from 'drizzle-orm/sqlite-proxy';
import {createPulseAuth} from '../lib/auth-options';
import {watchlistOwner,accountView} from '../lib/account-policy';
import {readWatchlist,writeWatchlist} from '../lib/watchlist-core';

function setup(google=false,rateLimit=false){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync(`drizzle/${file}`,'utf8'));
 const db=drizzle(async(sql,params,method)=>{
  const statement=sqlite.prepare(sql);const values=params as SQLInputValue[];
  if(method==='run'){const result=statement.run(...values);return {rows:[],changes:Number(result.changes)};}
  statement.setReturnArrays(true);
  if(method==='get')return {rows:statement.get(...values) as unknown as unknown[]};
  return {rows:statement.all(...values)};
 });
 const auth=createPulseAuth({database:db,secret:'pulse-test-only-secret-at-least-32-characters',origin:'https://pulse.test',test:!rateLimit,...(google?{google:{clientId:'test-google-client',clientSecret:'test-google-secret'}}:{})});
 const d1={prepare(sql:string){let params:SQLInputValue[]=[];return {bind(...values:SQLInputValue[]){params=values;return this;},async all(){return {results:sqlite.prepare(sql).all(...params)};},async first(){return sqlite.prepare(sql).get(...params)??null;},async run(){const result=sqlite.prepare(sql).run(...params);return {success:true,meta:{changes:Number(result.changes)}};}};}} as unknown as D1Database;
 async function post(path:string,body:object,cookie=''){
  const response=await auth.handler(new Request(`https://pulse.test/api/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://pulse.test',Cookie:cookie,'cf-connecting-ip':'192.0.2.9'},body:JSON.stringify(body)}));
  const json=await response.json() as Record<string,unknown>;
  return {response,json};
 }
 const cookie=(response:Response)=>response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 return {sqlite,auth,d1,post,cookie};
}

test('real email accounts use protected cookies and preserve owned watchlists across sign-out/sign-in',async()=>{
 const {sqlite,auth,d1,post,cookie}=setup();const password='A unique test passphrase 763';
 const signup=await post('sign-up/email',{name:'Test Member',email:'member@gmail.com',password});assert.equal(signup.response.status,200,JSON.stringify(signup.json));
 const header=signup.response.headers.get('set-cookie')??'';assert.match(header,/HttpOnly/i);assert.match(header,/Secure/i);assert.match(header,/SameSite=Lax/i);
 const credentials=cookie(signup.response),session=await auth.api.getSession({headers:new Headers({cookie:credentials})});assert.ok(session);
 assert.deepEqual(accountView(session.user),{displayName:'Test Member'});const owner=watchlistOwner(session.user.id);
 const stored=sqlite.prepare('SELECT password FROM auth_account').get() as {password:string};assert.notEqual(stored.password,password);assert.ok(stored.password.length>50);
 await writeWatchlist(d1,owner,'bitcoin',true,['bitcoin']);
 const signout=await post('sign-out',{},credentials);assert.equal(signout.response.status,200);
 assert.equal(await auth.api.getSession({headers:new Headers({cookie:credentials})}),null,'revoked session cannot continue to read the account');
 const incorrect=await post('sign-in/email',{email:'member@gmail.com',password:'An incorrect password 123'});assert.equal(incorrect.response.status,401);
 const login=await post('sign-in/email',{email:'member@gmail.com',password});assert.equal(login.response.status,200,JSON.stringify(login.json));
 const next=await auth.api.getSession({headers:new Headers({cookie:cookie(login.response)})});assert.ok(next);assert.equal(next.user.id,session.user.id);assert.deepEqual(await readWatchlist(d1,watchlistOwner(next.user.id)),['bitcoin']);
 const other=await post('sign-up/email',{name:'Other Member',email:'other@example.com',password});assert.equal(other.response.status,200);
 const otherSession=await auth.api.getSession({headers:new Headers({cookie:cookie(other.response)})});assert.ok(otherSession);assert.deepEqual(await readWatchlist(d1,watchlistOwner(otherSession.user.id)),[]);
 assert.equal(await auth.api.getSession({headers:new Headers({'x-authenticated-user-id':'owner','x-authenticated-user-email':'owner@example.com'})}),null,'platform identity never becomes a customer account');
 sqlite.close();
});

test('auth rejects cross-origin writes, short passwords and unavailable Google sign-in',async()=>{
 const {auth,post,sqlite}=setup();
 const short=await post('sign-up/email',{name:'Test',email:'test@example.com',password:'short'});assert.equal(short.response.status,400);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM auth_user').get()?.n,0);
 const cross=await auth.handler(new Request('https://pulse.test/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({name:'Test',email:'test@example.com',password:'A safe test password 123'})}));assert.equal(cross.status,403);
 const google=await post('sign-in/social',{provider:'google',callbackURL:'/watchlist'});assert.equal(google.response.status,404);
 sqlite.close();
});

test('configured Google sign-in uses a code flow with state and the application callback',async()=>{
 const {post,sqlite}=setup(true);const result=await post('sign-in/social',{provider:'google',callbackURL:'/watchlist'});assert.equal(result.response.status,200,JSON.stringify(result.json));
 const url=new URL(String(result.json.url));assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('client_id'),'test-google-client');assert.equal(url.searchParams.get('response_type'),'code');assert.ok(url.searchParams.get('state'));assert.equal(url.searchParams.get('redirect_uri'),'https://pulse.test/api/auth/callback/google');assert.equal(url.searchParams.get('prompt'),'select_account');
 sqlite.close();
});

test('sign-in rate limits use durable database counters',async()=>{
 const {post,sqlite}=setup(false,true);let status=0;
 for(let i=0;i<9;i++)status=(await post('sign-in/email',{email:'absent@example.com',password:'An incorrect password 123'})).response.status;
 assert.equal(status,429);assert.ok(Number(sqlite.prepare('SELECT COUNT(*) AS n FROM auth_rate_limit').get()?.n)>0);sqlite.close();
});
