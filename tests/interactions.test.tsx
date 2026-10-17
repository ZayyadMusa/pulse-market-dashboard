import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const browserWindow=new Window({url:'https://pulse.example/'});
for(const name of ['window','document','navigator','HTMLElement','SVGElement','Node','Element','Event','MouseEvent','EventTarget','MutationObserver','getComputedStyle','localStorage','location','history']){
 const value=name==='window'?browserWindow:(browserWindow as unknown as Record<string,unknown>)[name];
 Object.defineProperty(globalThis,name,{value:typeof value==='function'&&name==='getComputedStyle'?value.bind(browserWindow):value,writable:true,configurable:true});
}
(globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const {render,screen,fireEvent,waitFor,cleanup,within}=await import('@testing-library/react');
const {Converter}=await import('../components/converter');
const {MarketsTable}=await import('../components/markets-table');
const {default:Dashboard}=await import('../components/dashboard');
const {pulseRoute}=await import('../lib/page-routes');
const {workspaceHref}=await import('../lib/site-config');
import type {Coin,Envelope,FxData,ChartData} from '../lib/types';
const meta={key:'markets',cache:'HIT' as const,fetchedAt:'2026-10-16T01:30:00.000Z',expiresAt:'2026-10-16T01:40:00.000Z',ageSeconds:0};
const coins:Coin[]=[{id:'bitcoin',symbol:'btc',name:'Bitcoin',market_cap_rank:1,current_price:80000,market_cap:1000000,total_volume:1000,high_24h:81000,low_24h:79000,circulating_supply:19000000,total_supply:19000000,max_supply:21000000,ath:100000,price_change_percentage_24h:2,price_change_percentage_1h_in_currency:.5,price_change_percentage_7d_in_currency:10,last_updated:meta.fetchedAt,source:'CoinLore'},
{id:'ethereum',symbol:'eth',name:'Ethereum',market_cap_rank:2,current_price:2000,market_cap:100000,total_volume:200,high_24h:2100,low_24h:1900,circulating_supply:120000000,total_supply:120000000,max_supply:null,ath:5000,price_change_percentage_24h:-3,price_change_percentage_1h_in_currency:-.2,price_change_percentage_7d_in_currency:-4,last_updated:meta.fetchedAt,source:'CoinLore'}];
const markets:Envelope<Coin[]>={data:coins,meta};
const fx:Envelope<FxData>={data:{base:'USD',rates:{USD:1,NGN:1500,GBP:.8,EUR:.9},dates:{NGN:'2026-10-15',GBP:'2026-10-15',EUR:'2026-10-15'},source:'Frankfurter'},meta:{...meta,key:'fx'}};
const chart:Envelope<ChartData>={data:{prices:[[1792022400000,79000],[1792108800000,80000]],source:'CoinLore',granularity:'daily'},meta:{...meta,key:'chart:bitcoin:7'}};
afterEach(()=>{cleanup();browserWindow.localStorage.clear();browserWindow.happyDOM.setURL('https://pulse.example/');});

test('converter responds to amount changes, currency selection and swapping',()=>{
 render(<Converter coins={coins} fx={fx}/>);
 assert.ok(screen.getByText('120,000,000'));
 fireEvent.change(screen.getByLabelText('You convert'),{target:{value:'2'}});assert.ok(screen.getByText('240,000,000'));
 fireEvent.change(screen.getByLabelText('Convert from'),{target:{value:'fiat:USD'}});
 fireEvent.change(screen.getByLabelText('Convert to'),{target:{value:'fiat:GBP'}});
 fireEvent.change(screen.getByLabelText('You convert'),{target:{value:'100'}});assert.ok(screen.getByText('80'));
 fireEvent.click(screen.getByRole('button',{name:'Swap conversion currencies'}));
 assert.equal((screen.getByLabelText('Convert from') as unknown as HTMLSelectElement).value,'fiat:GBP');
 assert.equal((screen.getByLabelText('Convert to') as unknown as HTMLSelectElement).value,'fiat:USD');assert.ok(screen.getByText('100'));
});
test('market search, sort, filters and watchlist buttons respond to UI events',()=>{
 const saved:string[]=[];render(<MarketsTable coins={coins} saved={[]} toggle={id=>saved.push(id)} saving={false} currency="USD" factor={1}/>);
 fireEvent.change(screen.getByLabelText('Search assets'),{target:{value:'eth'}});assert.ok(screen.queryByText('Ethereum'));assert.equal(screen.queryByText('Bitcoin'),null);
 fireEvent.change(screen.getByLabelText('Search assets'),{target:{value:''}});
 const price=screen.getByRole('button',{name:'Price'});fireEvent.click(price);fireEvent.click(price);
 assert.match(screen.getAllByRole('row')[1].textContent??'',/Ethereum/);
 fireEvent.click(screen.getByRole('button',{name:'Gainers'}));assert.equal(screen.queryByText('Ethereum'),null);assert.ok(screen.getByText('Bitcoin'));
 fireEvent.click(screen.getByRole('button',{name:'Save Bitcoin to watchlist'}));assert.deepEqual(saved,['bitcoin']);
});
test('dashboard restores account, switches chart periods and assets, refreshes prices and saves an asset',async()=>{
 const requests:string[]=[];let ids:string[]=[];
 globalThis.fetch=async(input,init)=>{
  const path=String(input);requests.push(path);
  let body:unknown;
  if(path==='/api/account')body={user:{displayName:'Test User',email:'test@example.test'},ids};
  else if(path==='/api/markets')body={...markets,data:coins.map(c=>c.id==='bitcoin'?{...c,current_price:81000}:c)};
  else if(path==='/api/fx')body=fx;
  else if(path.startsWith('/api/coins/')){const url=new URL(path,'https://pulse.test');const id=path.split('/')[3],days=url.searchParams.get('days');body={...chart,meta:{...meta,key:`chart:${id}:${days}`}};}
  else if(path==='/api/watchlist'&&init?.method==='POST'){const action=JSON.parse(String(init.body));ids=action.saved?[action.coinId]:[];body={ids};}
  else throw Error(`Unexpected request: ${path}`);
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 };
 render(<Dashboard view="markets" user={null} initialMarkets={markets} initialFx={fx} initialChart={chart} initialSaved={[]} initialStatus={null} initialError={null}/>);
 await waitFor(()=>assert.ok(screen.getByRole('link',{name:'Open account'})));
 fireEvent.click(screen.getByRole('button',{name:'1D'}));await waitFor(()=>assert.ok(requests.includes('/api/coins/bitcoin/chart?days=1')));
 assert.equal(screen.getByRole('button',{name:'1D'}).getAttribute('aria-pressed'),'true');
 fireEvent.change(screen.getByLabelText('Featured asset'),{target:{value:'ethereum'}});await waitFor(()=>assert.ok(requests.includes('/api/coins/ethereum/chart?days=1')));
 fireEvent.change(screen.getByLabelText('Display currency'),{target:{value:'NGN'}});assert.ok(screen.getAllByText('₦3,000,000.00').length>0);
 fireEvent.click(screen.getByRole('button',{name:'Refresh market data'}));await waitFor(()=>assert.ok(screen.getByText('₦121,500,000.00')));
 fireEvent.click(screen.getByRole('button',{name:'Save Bitcoin to watchlist'}));await waitFor(()=>assert.ok(screen.getByText('Added to your watchlist')));
 assert.equal(screen.getByRole('button',{name:'Remove Bitcoin from watchlist'}).getAttribute('aria-pressed'),'true');
 assert.equal(screen.getByRole('link',{name:'Converter'}).getAttribute('href'),'/converter');
 assert.equal(document.documentElement.dataset.pulseInteractive,'true');
});
test('converter links preserve the selected crypto and fiat context',()=>{
 browserWindow.happyDOM.setURL('https://pulse.example/converter?from=coin%3Aethereum&to=fiat%3AGBP');
 render(<Converter coins={coins} fx={fx}/>);assert.equal((screen.getByLabelText('Convert from') as unknown as HTMLSelectElement).value,'coin:ethereum');assert.equal((screen.getByLabelText('Convert to') as unknown as HTMLSelectElement).value,'fiat:GBP');assert.ok(screen.getByText('1,600'));
});
test('all page routes mount a client view, while API and auth paths stay server-owned',()=>{
 for(const path of ['/','/converter','/watchlist','/signin','/status','/coin/bitcoin'])assert.ok(pulseRoute(path));
 assert.equal(pulseRoute('/coin/ethereum')?.coinId,'ethereum');assert.equal(pulseRoute('/api/markets'),null);assert.equal(pulseRoute('/external-signin'),null);assert.equal(pulseRoute('/callback'),null);
 assert.equal(workspaceHref('//malicious.example/'),workspaceHref('/watchlist'));
 assert.equal(workspaceHref('/watchlist'),'/watchlist');
});

test('cache verification button runs its checks and renders the result',async()=>{
 const {DataStatus}=await import('../components/data-status');
 const state={month:'2026-10',monthlyUsed:3,monthlyLimit:9000,minuteLimit:20,metrics:{hits:12,misses:3},resources:[],keyConfigured:false};
 const paths:string[]=[];globalThis.fetch=async(input)=>{const path=String(input);paths.push(path);return new Response(JSON.stringify(path==='/api/status'?state:markets),{status:200,headers:{'Content-Type':'application/json'}});};
 render(<DataStatus initial={state}/>);fireEvent.click(screen.getByRole('button',{name:'Run cache check'}));
 await waitFor(()=>assert.ok(screen.getByText('Shared cache verified')));assert.equal(paths.filter(p=>p==='/api/markets').length,2);assert.ok(screen.getByText('Same cached snapshot'));
});

test('the production client bundle boots and its search and converter navigation respond',async()=>{
 const {readdirSync}=await import('node:fs');const {pathToFileURL}=await import('node:url');const {resolve}=await import('node:path');
 const requests:string[]=[];
 globalThis.fetch=async(input)=>{
  const path=String(input);requests.push(path);let body:unknown;
  if(path==='/api/account')body={user:{displayName:'Production Test',email:'runtime@example.test'},ids:[]};
  else if(path==='/api/markets')body=markets;else if(path==='/api/fx')body=fx;else if(path.startsWith('/api/coins/'))body=chart;else throw Error(`Unexpected request ${path}`);
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const host=browserWindow.document.createElement('div');host.id='pulse-root';browserWindow.document.body.appendChild(host);
 const seed=browserWindow.document.createElement('script');seed.id='pulse-data';seed.type='application/json';seed.textContent=JSON.stringify({view:'markets',user:null,initialMarkets:markets,initialFx:fx,initialChart:chart,initialSaved:[],initialStatus:null,initialError:null});browserWindow.document.body.appendChild(seed);
 const file=readdirSync('public/runtime').find(f=>/^pulse-app-.*\.js$/.test(f));assert.ok(file);
 const module=await import(pathToFileURL(resolve('public/runtime',file!)).href);
 try{
  await waitFor(()=>assert.ok(screen.getByRole('heading',{name:'Market overview'})));
  await waitFor(()=>assert.ok(screen.getByRole('link',{name:'Open account'})));
  fireEvent.change(screen.getByLabelText('Search assets'),{target:{value:'Ethereum'}});
  const marketTable=within(screen.getByRole('region',{name:'Crypto markets'}));
  await waitFor(()=>assert.equal(marketTable.getAllByRole('row').length,2));
  assert.match(marketTable.getAllByRole('row')[1].textContent??'',/Ethereum/);
  fireEvent.click(screen.getByRole('button',{name:'30D'}));await waitFor(()=>assert.ok(requests.includes('/api/coins/bitcoin/chart?days=30')));
  assert.equal(screen.getByRole('link',{name:'Converter'}).getAttribute('href'),'/converter');assert.equal(host.dataset.clientStarted,'true');assert.equal(requests.includes('/api/markets'),false,'first paint uses server-cached market data');
 }finally{module.pulseRoot.unmount();host.remove();seed.remove();}
});


test('initial snapshots reject the wrong route and escape script-closing text',async()=>{
 const {clientSeed,seedJSON}=await import('../lib/client-seed');
 assert.equal(clientSeed({view:'converter'},JSON.stringify({view:'markets',initialSaved:['bitcoin']})).initialSaved.length,0);
 assert.equal(clientSeed({view:'markets'},'{broken').initialMarkets,null);
 const text=seedJSON({name:'</script><script>bad</script>'});assert.equal(text.includes('</script>'),false);assert.equal(JSON.parse(text).name,'</script><script>bad</script>');
});

test('customer navigation has no owner identity or diagnostic links',async()=>{
 globalThis.fetch=async(input)=>new Response(JSON.stringify(String(input).startsWith('/api/coins/')?chart:{user:null,ids:[]}),{status:200,headers:{'Content-Type':'application/json'}});
 render(<Dashboard view="markets" user={{displayName:'Owner Example',email:'owner-private@gmail.com'}} initialMarkets={markets} initialFx={fx} initialChart={chart} initialSaved={[]} initialStatus={null} initialError={null}/>);
 assert.equal(screen.queryByText('Owner'),null);assert.equal(screen.queryByText('owner-private@gmail.com'),null);assert.equal(screen.queryByRole('link',{name:/Data & cache/i}),null);assert.equal(screen.queryByText(/Made by Zayyad/),null);
 assert.equal(screen.getByRole('navigation',{name:'Main navigation'}).querySelectorAll('a').length,3);
 await waitFor(()=>assert.ok(screen.getByRole('link',{name:'Sign in'})));
});

test('email registration accepts Gmail, submits real credentials and exposes no unconfigured provider button',async()=>{
 const {AccountPanel}=await import('../components/account-panel');const posted:{path:string;body:Record<string,string>}[]=[];const destinations:string[]=[];
 globalThis.fetch=async(input,init)=>{const path=String(input);if(init?.method==='POST')posted.push({path,body:JSON.parse(String(init.body))});return new Response(JSON.stringify(init?.method==='POST'?{token:'test-session'}:{auth:{emailPassword:true,google:false,passwordReset:false,emailVerification:false}}),{status:200,headers:{'Content-Type':'application/json'}});};
 render(<AccountPanel user={null} savedCount={0} onSignedOut={()=>{}} onAuthenticated={path=>destinations.push(path)}/>);
 await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Sign in',pressed:true}).getAttribute('aria-pressed'),'true'));
 fireEvent.click(screen.getByRole('button',{name:'Create account'}));
 fireEvent.change(screen.getByLabelText(/Your name/),{target:{value:'Pulse Member'}});fireEvent.change(screen.getByLabelText(/Email address/),{target:{value:'member@gmail.com'}});fireEvent.change(screen.getByLabelText(/^Password/),{target:{value:'A private test passphrase 123'}});
 fireEvent.click(screen.getByRole('button',{name:'Show password'}));assert.equal((screen.getByLabelText(/^Password/) as unknown as HTMLInputElement).type,'text');fireEvent.click(screen.getByRole('button',{name:'Hide password'}));
 await waitFor(()=>assert.equal(screen.getByRole('form',{name:'Account form'}).querySelector('button[type="submit"]')?.hasAttribute('disabled'),false));
 fireEvent.submit(screen.getByRole('form',{name:'Account form'}));await waitFor(()=>assert.deepEqual(destinations,['/watchlist']));
 assert.equal(posted[0].path,'/api/auth/sign-up/email');assert.equal(posted[0].body.email,'member@gmail.com');assert.equal(posted[0].body.name,'Pulse Member');assert.equal(screen.queryByRole('button',{name:'Continue with Google'}),null);assert.equal(screen.queryByRole('button',{name:'Forgot password?'}),null);
});

test('account sign-in errors are actionable and sign-out reaches the session endpoint',async()=>{
 const {AccountPanel}=await import('../components/account-panel');let signouts=0;
 globalThis.fetch=async(input,init)=>{const path=String(input);if(path==='/api/auth/sign-out'){signouts++;return new Response('{}',{status:200});}if(init?.method==='POST')return new Response(JSON.stringify({message:'Invalid email or password'}),{status:401});return new Response(JSON.stringify({auth:{emailPassword:true,google:true,passwordReset:true,emailVerification:false}}),{status:200});};
 const panel=render(<AccountPanel user={null} savedCount={0} onSignedOut={()=>{}}/>);
 await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Continue with Google'})));
 fireEvent.change(screen.getByLabelText(/Email address/),{target:{value:'person@example.com'}});fireEvent.change(screen.getByLabelText(/^Password/),{target:{value:'A private test passphrase 123'}});fireEvent.submit(screen.getByRole('form',{name:'Account form'}));await waitFor(()=>assert.ok(screen.getByRole('alert',{name:''}).textContent?.includes('Invalid email or password')));
 panel.unmount();let signedOut=false;render(<AccountPanel user={{displayName:'Member',email:'never-show@example.com'}} savedCount={2} onSignedOut={()=>{signedOut=true;}}/>);assert.equal(screen.queryByText('never-show@example.com'),null);fireEvent.click(screen.getByRole('button',{name:'Sign out'}));await waitFor(()=>assert.equal(signedOut,true));assert.equal(signouts,1);
});
