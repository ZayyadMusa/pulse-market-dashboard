import type {View} from './types';
export function pulseRoute(pathname:string):{view:View;coinId?:string}|null{
 const path=pathname==='/'?'/':pathname.replace(/\/$/,'');
 if(path==='/'||path==='/markets')return {view:'markets'};
 if(['/converter','/watchlist','/signin'].includes(path))return {view:path.slice(1) as View};
 if(path==='/admin/system'||path==='/status')return {view:'status'};
 const coin=path.match(/^\/coin\/([a-z0-9-]{1,80})$/);return coin?{view:'coin',coinId:coin[1]}:null;
}
