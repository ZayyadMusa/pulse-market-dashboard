import {betterAuth} from 'better-auth';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import * as schema from '../db/auth-schema';

export type AuthConfiguration={database:Parameters<typeof drizzleAdapter>[0];secret:string;origin:string;google?:{clientId:string;clientSecret:string};mail?:{apiKey:string;from:string};test?:boolean};
export function createPulseAuth(config:AuthConfiguration){
 const mail=config.mail;
 async function send(to:string,subject:string,url:string,action:string){
  if(!mail)throw new Error('Email delivery is not configured.');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${mail.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:mail.from,to:[to],subject,text:`${action}\n\n${url}\n\nIf you did not request this, you can ignore this email.\nPulse`})});
  if(!response.ok)throw new Error('Email could not be delivered.');
 }
 return betterAuth({
  appName:'Pulse',baseURL:config.origin,basePath:'/api/auth',secret:config.secret,
  database:drizzleAdapter(config.database,{provider:'sqlite',schema,transaction:false}),
  trustedOrigins:[config.origin],
  emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,requireEmailVerification:!!mail,...(mail?{sendResetPassword:async({user,url}:{user:{email:string};url:string})=>send(user.email,'Reset your Pulse password',url,'Choose a new password for your Pulse account.')}:{})},
  ...(mail?{emailVerification:{sendOnSignUp:true,sendOnSignIn:true,autoSignInAfterVerification:true,sendVerificationEmail:async({user,url}:{user:{email:string};url:string})=>send(user.email,'Confirm your Pulse email',url,'Confirm this email address to finish creating your Pulse account.')}}:{}),
  socialProviders:config.google?{google:{clientId:config.google.clientId,clientSecret:config.google.clientSecret,prompt:'select_account'}}:{},
  account:{accountLinking:{enabled:false}},
  session:{expiresIn:60*60*24*14,updateAge:60*60*24,cookieCache:{enabled:false}},
  rateLimit:{enabled:!config.test,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:60,max:5},'/request-password-reset':{window:300,max:3}}},
  advanced:{cookiePrefix:'pulse',useSecureCookies:config.origin.startsWith('https://'),ipAddress:{ipAddressHeaders:['cf-connecting-ip']},defaultCookieAttributes:{httpOnly:true,sameSite:'lax',path:'/'}},
  telemetry:{enabled:false},
 });
}
