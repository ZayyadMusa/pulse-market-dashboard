'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowUpRight,Check,ChevronRight,Eye,EyeOff,LockKeyhole,LogOut,Mail,ShieldCheck,Star,UserRound} from 'lucide-react';
import {safeReturnPath} from '../lib/account-policy';
import {workspaceHref} from '../lib/site-config';
import type {User} from '../lib/types';
type Capabilities={emailPassword:boolean;google:boolean;passwordReset:boolean;emailVerification:boolean};
type Mode='signin'|'signup'|'forgot'|'reset';
type AuthReply={message?:string;error?:string;token?:string|null;url?:string;status?:boolean};
const initialCapabilities:Capabilities={emailPassword:false,google:false,passwordReset:false,emailVerification:false};
export function GoogleMark(){return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.58-4.1H3.08v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.42 13.94a6 6 0 0 1 0-3.88V7.47H3.08a10 10 0 0 0 0 9.06l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.92 5.47l3.34 2.59c.78-2.35 2.98-4.1 5.58-4.1Z"/></svg>;}
export async function accountRequest(path:string,body:Record<string,unknown>){
 const response=await fetch(`/api/auth/${path}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json() as AuthReply;
 if(!response.ok)throw new Error(response.status===429?'Too many attempts. Wait a minute and try again.':data.message??data.error??'Your request could not be completed. Please try again.');
 return data;
}
export function AccountPanel({user,savedCount,onSignedOut,onAuthenticated}:{user:User;savedCount:number;onSignedOut:()=>void;onAuthenticated?:(path:string)=>void}){
 const [mode,setMode]=useState<Mode>('signin'),[capabilities,setCapabilities]=useState(initialCapabilities),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[showPassword,setShowPassword]=useState(false),[embedded,setEmbedded]=useState(false);
 useEffect(()=>{
  setEmbedded(window.self!==window.top);const url=new URL(window.location.href);if(url.searchParams.get('mode')==='reset'&&url.searchParams.has('token'))setMode('reset');
  if(url.searchParams.get('error'))setError('Sign-in was not completed. Please try again.');
  const controller=new AbortController();fetch('/api/account',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<{auth?:Capabilities}>;}).then(data=>{if(!controller.signal.aborted){setCapabilities(data.auth??initialCapabilities);setReady(true);}}).catch(()=>{if(!controller.signal.aborted){setReady(true);setError('Account services could not be reached. Refresh this page to try again.');}});
  return()=>controller.abort();
 },[]);
 const changeMode=(next:Mode)=>{setMode(next);setError('');setMessage('');setPassword('');};
 const go=(path:string)=>onAuthenticated?onAuthenticated(path):window.location.assign(path);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');setMessage('');setBusy(true);
  try{
   const url=new URL(window.location.href),returnTo=safeReturnPath(url.searchParams.get('return_to'));
   if(mode==='forgot'){await accountRequest('request-password-reset',{email:email.trim(),redirectTo:`${window.location.origin}/signin?mode=reset`});setMessage('If an account exists for this address, a reset link is on its way.');}
   else if(mode==='reset'){await accountRequest('reset-password',{newPassword:password,token:url.searchParams.get('token')});setPassword('');setMode('signin');setMessage('Password updated. You can now sign in.');}
   else{
    const data=await accountRequest(mode==='signup'?'sign-up/email':'sign-in/email',{email:email.trim(),password,...(mode==='signup'?{name:name.trim()}:{}),callbackURL:returnTo});
    setPassword('');
    if(mode==='signup'&&capabilities.emailVerification&&!data.token)setMessage('Check your inbox to confirm your email, then return to Pulse.');
    else go(returnTo);
   }
  }catch(e){setError(e instanceof Error?e.message:'Sign-in could not be completed.');}finally{setBusy(false);}
 }
 async function google(){setError('');setBusy(true);try{const data=await accountRequest('sign-in/social',{provider:'google',callbackURL:safeReturnPath(new URL(window.location.href).searchParams.get('return_to')),errorCallbackURL:'/signin?error=google'});if(!data.url)throw Error('Google sign-in could not start.');window.location.assign(data.url);}catch(e){setError(e instanceof Error?e.message:'Google sign-in could not start.');setBusy(false);}}
 async function signOut(){setBusy(true);setError('');try{await accountRequest('sign-out',{});onSignedOut();setMessage('You have signed out. Your watchlist is saved.');}catch(e){setError(e instanceof Error?e.message:'Sign-out could not be completed.');}finally{setBusy(false);}}
 return <section className={`account-layout ${user?'is-member':''}`} aria-label="Pulse account">
  <div className="account-art"><img src="/art/market-wave.webp" alt="Original sculptural copper market waves"/><div className="account-art-shade"/><div className="account-art-content"><span className="account-art-wordmark">pulse<span>.</span></span><h2>Your perspective.<br/>Your market.</h2><p>Keep the assets you follow in one place.<br/>Come back to a desk that feels like yours.</p></div><div className="account-art-foot"><span><Star size={14}/> Your personal watchlist</span><span><ShieldCheck size={14}/> Private to your account</span></div></div>
  <div className="account-content">{user?<>
   <span className="account-emblem"><UserRound size={25}/></span><h2>Your Pulse account</h2><p className="account-intro">Your watchlist is saved and ready whenever you return.</p><div className="member-summary"><div><span>Watchlist</span><strong>{savedCount} {savedCount===1?'asset':'assets'}</strong></div><Star size={22}/></div><a className="primary-button account-submit" href="/watchlist">Open watchlist <ChevronRight size={16}/></a><button className="account-signout" disabled={busy} onClick={()=>void signOut()}><LogOut size={15}/>{busy?'Signing out…':'Sign out'}</button>
   </>:<>
   <div className="account-mode-tabs" role="group" aria-label="Account access"><button type="button" className={mode==='signin'?'active':''} aria-pressed={mode==='signin'} onClick={()=>changeMode('signin')}>Sign in</button><button type="button" className={mode==='signup'?'active':''} aria-pressed={mode==='signup'} onClick={()=>changeMode('signup')}>Create account</button></div>
   <h2>{mode==='signup'?'A market desk of your own.':mode==='forgot'?'Reset your password.':mode==='reset'?'Choose a new password.':'Welcome to Pulse.'}</h2><p className="account-intro">{mode==='signup'?'Save the assets you follow. Pick up where you left off.':mode==='forgot'?'Enter the email address you use for Pulse.':mode==='reset'?'Use at least 12 characters for your new password.':'Sign in to keep your watchlist with you.'}</p>
   {embedded?<div className="account-embedded"><LockKeyhole size={23}/><p>Open Pulse in its own tab to sign in securely.</p><a className="primary-button account-submit" href={workspaceHref('/signin')} target="_blank" rel="noopener noreferrer">Open Pulse <ArrowUpRight size={16}/></a></div>:<>
    {capabilities.google&&(mode==='signin'||mode==='signup')&&<><button type="button" className="google-signin" disabled={busy} onClick={()=>void google()}><GoogleMark/>Continue with Google</button><div className="account-divider"><span>or use your email</span></div></>}
    <form onSubmit={event=>void submit(event)} className="account-form" aria-label="Account form">
     {mode==='signup'&&<label>Your name<div className="account-input"><UserRound size={17}/><input name="name" autoComplete="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="What should we call you?"/></div></label>}
     {mode!=='reset'&&<label>Email address<div className="account-input"><Mail size={17}/><input name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div></label>}
     {mode!=='forgot'&&<div className="account-field"><div className="password-label"><label htmlFor="pulse-password">Password</label>{mode==='signin'&&capabilities.passwordReset&&<button type="button" onClick={()=>changeMode('forgot')}>Forgot password?</button>}</div><div className="account-input"><LockKeyhole size={17}/><input id="pulse-password" name="password" type={showPassword?'text':'password'} autoComplete={mode==='signin'?'current-password':'new-password'} required minLength={mode==='signin'?1:12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signin'?'Enter your password':'At least 12 characters'}/><button type="button" className="password-reveal" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div>}
     {error&&<div className="account-feedback error" role="alert">{error}</div>}{message&&<div className="account-feedback" role="status"><Check size={16}/>{message}</div>}
     <button className="primary-button account-submit" type="submit" disabled={busy||!ready||!capabilities.emailPassword}>{busy?'Please wait…':!ready?'Connecting…':mode==='signup'?'Create account':mode==='forgot'?'Send reset link':mode==='reset'?'Update password':'Sign in'}<ChevronRight size={16}/></button>
    </form>
    <p className="account-form-note">{mode==='signup'?'Gmail and other email addresses are welcome. Use a unique password.':'Your watchlist stays private to your account.'}</p>
   </>}
   </>}
   {user&&error&&<div className="account-feedback error" role="alert">{error}</div>}<a href="/" className="account-browse">Continue browsing markets <ChevronRight size={13}/></a>
  </div>
 </section>;
}
