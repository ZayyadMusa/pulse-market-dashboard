export function convertAmount(amount:number, fromUSD:number, toUSD:number):number|null {
  if(!Number.isFinite(amount)||amount<0||!Number.isFinite(fromUSD)||!Number.isFinite(toUSD)||fromUSD<=0||toUSD<=0) return null;
  const result=amount*fromUSD/toUSD;
  return Number.isFinite(result)?result:null;
}
export function priceText(value:number|null|undefined,currency='USD', compact=false):string {
  if(value==null||!Number.isFinite(value)) return '—';
  try { return new Intl.NumberFormat('en-US',{style:'currency',currency,currencyDisplay:currency==='NGN'?'narrowSymbol':'symbol',notation:compact?'compact':'standard',maximumFractionDigits:compact?2:value===0?2:Math.abs(value)<0.01?8:Math.abs(value)<1?4:2}).format(value); }
  catch{return `${currency} ${value.toLocaleString('en-US',{maximumFractionDigits:4})}`;}
}
export function compactNumber(value:number|null|undefined):string {
  return value==null||!Number.isFinite(value)?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(value);
}
export function percentText(value:number|null|undefined):string {
  return value==null||!Number.isFinite(value)?'—':`${value>0?'+':''}${value.toFixed(2)}%`;
}
export function sortCoins<T extends {id:string;name:string}>(coins:T[],query:string,key:keyof T,ascending:boolean):T[] {
  const needle=query.trim().toLowerCase();
  return coins.filter(c=>`${c.name} ${c.id} ${'symbol' in c?c.symbol:''}`.toLowerCase().includes(needle)).sort((a,b)=>{
    const av=a[key],bv=b[key];
    if(av==null) return bv==null?0:1;
    if(bv==null) return -1;
    const delta=typeof av==='string'?av.localeCompare(String(bv)):Number(av)-Number(bv);
    return ascending?delta:-delta;
  });
}
