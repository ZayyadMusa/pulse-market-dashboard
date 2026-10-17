import type {DashboardProps} from '../components/dashboard';
import type {View} from './types';
export function clientSeed(route:{view:View;coinId?:string},text:string|null):DashboardProps{
 const empty:DashboardProps={...route,user:null,initialMarkets:null,initialFx:null,initialChart:null,initialSaved:[],initialStatus:null,initialError:null};
 if(!text)return empty;
 try{const seed=JSON.parse(text);if(seed&&seed.view===route.view&&seed.coinId===route.coinId)return {...empty,...seed,...route};}catch{}
 return empty;
}
export function seedJSON(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c');}
