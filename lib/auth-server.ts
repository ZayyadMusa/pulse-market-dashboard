import {env} from 'cloudflare:workers';
import {drizzle} from 'drizzle-orm/d1';
import {createPulseAuth} from './auth-options';
import {isAdministrator} from './admin-core';
import {SITE_URL} from './site-config';
const settings=()=>env as unknown as Record<string,string>;
let instance:ReturnType<typeof createPulseAuth>|undefined;
export function authCapabilities(){const e=settings();return {emailPassword:!!e.BETTER_AUTH_SECRET,google:!!(e.GOOGLE_CLIENT_ID&&e.GOOGLE_CLIENT_SECRET),passwordReset:!!(e.RESEND_API_KEY&&e.AUTH_EMAIL_FROM),emailVerification:!!(e.RESEND_API_KEY&&e.AUTH_EMAIL_FROM)};}
export function pulseAuth(){
 if(instance)return instance;
 const e=settings();if(!e.BETTER_AUTH_SECRET||e.BETTER_AUTH_SECRET.length<32||!env.DB)throw new Error('Account sign-in is unavailable.');
 const google=e.GOOGLE_CLIENT_ID&&e.GOOGLE_CLIENT_SECRET?{clientId:e.GOOGLE_CLIENT_ID,clientSecret:e.GOOGLE_CLIENT_SECRET}:undefined;
 const mail=e.RESEND_API_KEY&&e.AUTH_EMAIL_FROM?{apiKey:e.RESEND_API_KEY,from:e.AUTH_EMAIL_FROM}:undefined;
 instance=createPulseAuth({database:drizzle(env.DB),secret:e.BETTER_AUTH_SECRET,origin:e.BETTER_AUTH_URL||SITE_URL,google,mail});return instance;
}
export async function pulseSession(headers:Headers){return pulseAuth().api.getSession({headers});}
export async function canInspectSystem(headers:Headers){try{const session=await pulseSession(headers);if(!session?.user.emailVerified)return false;return isAdministrator(new Headers({'x-authenticated-user-id':session.user.id,'x-authenticated-user-email':session.user.email}),settings().PULSE_ADMIN_EMAILS);}catch{return false;}}
