export type PlatformUser={userId:string;displayName:string;email:string;fullName:string|null};
export function platformUser(headers:Pick<Headers,'get'>):PlatformUser|null{
 const userId=headers.get('x-authenticated-user-id'),email=headers.get('x-authenticated-user-email');
 if(!userId||!email)return null;
 let fullName:string|null=null;const encoded=headers.get('x-authenticated-user-full-name');
 if(encoded&&headers.get('x-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{fullName=decodeURIComponent(encoded);}catch{}}
 return {userId,email,fullName,displayName:fullName??email};
}
