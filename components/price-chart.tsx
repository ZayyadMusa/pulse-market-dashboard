'use client';
import {useId,useMemo,useState} from 'react';
import {priceText} from '@/lib/market-math';
export function Sparkline({values,positive}:{values:number[];positive:boolean}){
 const valid=values.filter(Number.isFinite);if(valid.length<2)return <span className="muted">—</span>;
 const sample=valid.filter((_,i)=>i%Math.max(1,Math.floor(valid.length/45))===0);const low=Math.min(...sample),high=Math.max(...sample);const range=high-low||1;
 const points=sample.map((n,i)=>`${(i/(sample.length-1))*100},${28-((n-low)/range)*23}`).join(' ');
 return <svg className={`sparkline ${positive?'positive':'negative'}`} viewBox="0 0 100 32" role="img" aria-label="Price trend over the past seven days"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/></svg>;
}
export function PriceChart({prices,currency='USD',factor=1,loading=false}:{prices:[number,number][];currency?:string;factor?:number;loading?:boolean}){
 const id=useId().replace(/:/g,'');const [hover,setHover]=useState<number|null>(null);
 const data=useMemo(()=>{
  const clean=prices.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));const values=clean.map(p=>p[1]*factor);
  const min=Math.min(...values),max=Math.max(...values);const pad=(max-min)*.13||max*.015||1;
  return {clean,values,low:min-pad,high:max+pad};
 },[prices,factor]);
 if(data.clean.length<2)return <div className="chart-empty" role="status">{loading?<><span className="loading-line"/>Loading price history…</>:'Price history is temporarily unavailable.'}</div>;
 const w=760,h=238,left=4,right=686,top=20,bottom=199;
 const px=(i:number)=>left+i/(data.values.length-1)*(right-left);const py=(v:number)=>bottom-(v-data.low)/(data.high-data.low)*(bottom-top);
 const line=data.values.map((n,i)=>`${i===0?'M':'L'}${px(i).toFixed(2)} ${py(n).toFixed(2)}`).join(' ');
 const index=hover===null?null:Math.min(data.clean.length-1,Math.max(0,hover));
 const date=(t:number)=>new Date(t).toLocaleDateString('en-GB',{month:'short',day:'numeric',timeZone:'UTC'});
 const isDay=(data.clean.at(-1)![0]-data.clean[0][0])<172800000;
 const tick=(t:number)=>isDay?new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'}):date(t);
 return <div className={`price-chart ${loading?'chart-loading':''}`}>
  {index!==null&&<output className="chart-tooltip" style={{left:`${Math.min(76,Math.max(10,(px(index)/w)*100))}%`}}>{priceText(data.values[index],currency)}<small>{new Date(data.clean[index][0]).toLocaleString('en-GB',{timeZone:'UTC',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} UTC</small></output>}
  <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Price history from ${date(data.clean[0][0])} to ${date(data.clean.at(-1)![0])} in ${currency}. Open the chart data below for a text table.`} onMouseLeave={()=>setHover(null)} onMouseMove={e=>{const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width*w;setHover(Math.round((x-left)/(right-left)*(data.values.length-1)));}}>
   <defs><linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e97850" stopOpacity=".18"/><stop offset="100%" stopColor="#e97850" stopOpacity="0"/></linearGradient></defs>
   {[0,1,2,3].map(i=>{const y=top+i/3*(bottom-top);const value=data.high-i/3*(data.high-data.low);return <g key={i}><line x1={left} y1={y} x2={right} y2={y} stroke="#edf0f2" strokeDasharray="3 4"/><text x="703" y={y+4} className="axis-label">{new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:value<1?4:1}).format(value)}</text></g>;})}
   <path d={`${line} L${right} ${bottom} L${left} ${bottom}Z`} fill={`url(#fill-${id})`}/><path d={line} fill="none" stroke="#e75b32" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round"/>
   <circle cx={right} cy={py(data.values.at(-1)!)} r="4" fill="#e75b32" stroke="white" strokeWidth="2"/>
   {[0,.25,.5,.75,1].map((n,i)=>{const j=Math.round(n*(data.clean.length-1));return <text key={i} x={px(j)} y="230" textAnchor={i===0?'start':i===4?'end':'middle'} className="axis-label">{tick(data.clean[j][0])}</text>;})}
   {index!==null&&<g><line x1={px(index)} y1={top} x2={px(index)} y2={bottom} stroke="#d4a897" strokeDasharray="4 4"/><circle cx={px(index)} cy={py(data.values[index])} r="4.5" fill="#e75b32" stroke="white" strokeWidth="2"/></g>}
  </svg>
  <details className="chart-data"><summary>Chart data</summary><div className="chart-data-scroll"><table><caption>Sampled price history; every {Math.max(1,Math.ceil(data.clean.length/12))} observations. Full detail remains in the chart.</caption><thead><tr><th>Date (UTC)</th><th>Price ({currency})</th></tr></thead><tbody>{data.clean.filter((_,i)=>i%Math.max(1,Math.ceil(data.clean.length/12))===0||i===data.clean.length-1).map(p=><tr key={p[0]}><td>{new Date(p[0]).toLocaleString('en-GB',{timeZone:'UTC'})}</td><td>{priceText(p[1]*factor,currency)}</td></tr>)}</tbody></table></div></details>
 </div>;
}
