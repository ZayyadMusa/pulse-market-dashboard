export type PulseIdentity={id:string;name:string;email:string;emailVerified?:boolean};
export function accountView(visitor:PulseIdentity|null){
 if(!visitor)return null;
 // Navigation never inherits a platform owner or exposes an email address.
 const name=visitor.name.trim();
 return {displayName:name&&!name.includes('@')?name:'Pulse member'};
}
export function watchlistOwner(id:string){return `pulse:${id}`;}
export function safeReturnPath(value:string|null,defaultPath='/watchlist'){
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return defaultPath;
 try{const parsed=new URL(value,'https://pulse.invalid');return parsed.origin==='https://pulse.invalid'?parsed.pathname+parsed.search:defaultPath;}catch{return defaultPath;}
}
