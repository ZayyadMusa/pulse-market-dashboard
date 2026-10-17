import {platformUser} from './identity-core.ts';
export function isAdministrator(headers:Pick<Headers,'get'>,allowedEmails:string|undefined){
 const visitor=platformUser(headers);
 if(!visitor||!allowedEmails)return false;
 return allowedEmails.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(visitor.email.toLowerCase());
}
