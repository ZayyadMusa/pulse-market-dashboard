import {getMarkets,getFx,getChart,getSaved,getStatus} from './data';
import {pulseSession} from './auth-server';
import {accountView,watchlistOwner} from './account-policy';
import type {DashboardProps} from '../components/dashboard';
import type {View} from './types';
export async function pageSnapshot(route:{view:View;coinId?:string},headers:Headers):Promise<DashboardProps>{
 const session=await pulseSession(headers);const visitor=session?.user??null;const result:DashboardProps={...route,user:accountView(visitor),initialMarkets:null,initialFx:null,initialChart:null,initialSaved:[],initialStatus:null,initialError:null};
 const work:Promise<void>[]=[];
 if(route.view!=='signin'&&route.view!=='status'){
  work.push(getMarkets().then(data=>{result.initialMarkets=data;}).catch(error=>{result.initialError=error.message;}));
  work.push(getFx().then(data=>{result.initialFx=data;}).catch(error=>{result.initialError??=error.message;}));
 }
 if(visitor)work.push(getSaved(watchlistOwner(visitor.id)).then(ids=>{result.initialSaved=ids;}).catch(()=>{result.initialError??='Your watchlist could not be loaded. Please retry.';}));
 if(route.view==='status')work.push(getStatus().then(data=>{result.initialStatus=data;}).catch(()=>{}));
 await Promise.all(work);
 if((route.view==='markets'||route.view==='coin')&&result.initialMarkets){try{result.initialChart=await getChart(route.coinId??'bitcoin','7');}catch{}}
 return result;
}
