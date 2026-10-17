'use client';
import Link from './app-link';
import {useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowUpDown,ChevronLeft,ChevronRight,Search,Star} from 'lucide-react';
import {AssetGlyph} from './asset-glyph';
import {Sparkline} from './price-chart';
import {priceText,sortCoins} from '@/lib/market-math';
import type {Coin} from '@/lib/types';
export function Change({value}:{value:number|null|undefined}){return <span className={value==null?'muted':value>=0?'positive':'negative'}>{value!=null&&(value>=0?<ArrowUp size={11}/>:<ArrowDown size={11}/>)}{value==null?'—':`${Math.abs(value).toFixed(2)}%`}</span>;}
export function MarketsTable({coins,saved,toggle,saving,currency,factor,watchlist=false}:{coins:Coin[];saved:string[];toggle:(id:string)=>void;saving:boolean;currency:string;factor:number;watchlist?:boolean}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[key,setKey]=useState<keyof Coin>('market_cap_rank'),[asc,setAsc]=useState(true),[page,setPage]=useState(1),[limit,setLimit]=useState(10);
 const rows=useMemo(()=>{
  let data=sortCoins(coins,query,key,asc);
  if(filter==='gainers')data=data.filter(c=>(c.price_change_percentage_24h??0)>0).sort((a,b)=>(b.price_change_percentage_24h??0)-(a.price_change_percentage_24h??0));
  if(filter==='losers')data=data.filter(c=>(c.price_change_percentage_24h??0)<0).sort((a,b)=>(a.price_change_percentage_24h??0)-(b.price_change_percentage_24h??0));
  if(filter==='saved')data=data.filter(c=>saved.includes(c.id));
  return data;
 },[coins,query,key,asc,filter,saved]);
 const hasSparklines=coins.some(c=>(c.sparkline_in_7d?.price.length??0)>1);
 const pageCount=Math.max(1,Math.ceil(rows.length/limit));const current=Math.min(page,pageCount);const visible=rows.slice((current-1)*limit,current*limit);
 function sort(next:keyof Coin){setAsc(key===next?!asc:next==='name'||next==='market_cap_rank');setKey(next);setFilter('all');setPage(1);}
 const header=(name:string,k:keyof Coin,cls='')=><th className={cls} scope="col" aria-sort={key===k?(asc?'ascending':'descending'):'none'}><button onClick={()=>sort(k)}>{name}{key===k?(asc?<ArrowUp size={12}/>:<ArrowDown size={12}/>):<ArrowUpDown size={11}/>}</button></th>;
 return <section className="panel markets-panel" aria-label={watchlist?'Saved markets':'Crypto markets'}>
  <div className="table-tools"><div className="table-tabs" role="group" aria-label="Filter assets">{[['all',watchlist?'Saved assets':'All assets'],['gainers','Gainers'],['losers','Losers'],...(!watchlist?[['saved','My watchlist']]:[])].map(([id,label])=><button key={id} className={filter===id?'active':''} aria-pressed={filter===id} onClick={()=>{setFilter(id);setPage(1);}}>{label}</button>)}</div><label className="table-search"><Search size={15}/><input aria-label="Search assets" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Search name or symbol"/></label></div>
  <div className="table-scroll"><table className="market-table"><thead><tr><th scope="col" className="rank">#</th>{header('Asset','name','asset-col')}{header('Price','current_price')}{header('1h','price_change_percentage_1h_in_currency','one-hour')}{header('24h','price_change_percentage_24h')}{header('7d','price_change_percentage_7d_in_currency')}{header('Market cap','market_cap','cap-col')}{header('Volume (24h)','total_volume','volume-col')}{hasSparklines&&<th scope="col" className="trend-col">Last 7 days</th>}<th scope="col"><span className="sr-only">Watchlist</span></th></tr></thead><tbody>
  {visible.map(coin=><tr key={coin.id}><td className="rank">{coin.market_cap_rank??'—'}</td><td className="asset-col"><Link href={`/coin/${coin.id}`} className="asset-name"><AssetGlyph id={coin.id}/><span><strong>{coin.name}</strong><small>{coin.symbol.toUpperCase()}</small></span></Link></td><td className="price-cell">{coin.current_price==null?'—':priceText(coin.current_price*factor,currency)}</td><td className="one-hour"><Change value={coin.price_change_percentage_1h_in_currency}/></td><td><Change value={coin.price_change_percentage_24h}/></td><td><Change value={coin.price_change_percentage_7d_in_currency}/></td><td className="cap-col">{coin.market_cap==null?'—':priceText(coin.market_cap*factor,currency,true)}</td><td className="volume-col">{coin.total_volume==null?'—':priceText(coin.total_volume*factor,currency,true)}</td>{hasSparklines&&<td className="trend-col"><Sparkline values={coin.sparkline_in_7d?.price??[]} positive={(coin.price_change_percentage_7d_in_currency??0)>=0}/></td>}<td><button className={`star-button ${saved.includes(coin.id)?'is-saved':''}`} onClick={()=>toggle(coin.id)} disabled={saving} aria-label={`${saved.includes(coin.id)?'Remove':'Save'} ${coin.name}${saved.includes(coin.id)?' from':' to'} watchlist`} aria-pressed={saved.includes(coin.id)}><Star size={17} fill={saved.includes(coin.id)?'currentColor':'none'}/></button></td></tr>)}
  </tbody></table></div>
  {!rows.length&&<div className="table-empty"><Search size={25}/><strong>{filter==='saved'?'No saved assets yet':'No assets match this view'}</strong><p>{filter==='saved'?'Use the star beside an asset to save it.':'Try another search or filter.'}</p><button className="text-button" onClick={()=>{setQuery('');setFilter('all');}}>Show all assets</button></div>}
  <div className="table-footer"><span>Showing {rows.length?(current-1)*limit+1:0}–{Math.min(current*limit,rows.length)} of {rows.length} assets</span><div className="pagination"><label><span className="rows-label">Rows</span><select aria-label="Rows per page" value={limit} onChange={e=>{setLimit(Number(e.target.value));setPage(1);}}><option value="10">10</option><option value="20">20</option><option value="30">30</option></select></label><button aria-label="Previous page" disabled={current===1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/></button><span>{current} / {pageCount}</span><button aria-label="Next page" disabled={current===pageCount} onClick={()=>setPage(p=>p+1)}><ChevronRight size={17}/></button></div></div>
 </section>;
}
