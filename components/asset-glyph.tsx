const ids=["bitcoin","ethereum","tether","binancecoin","ripple","usd-coin","solana","tron","hyperliquid","staked-ether","zcash","ethena-usde","dogecoin","wrapped-bitcoin","monero","wrapped-beacon-eth","chainlink","cardano","weth","near","ethena-staked-usde","stellar","bitcoin-cash","dai","uniswap","litecoin","avalanche-2","sui","hedera-hashgraph","toncoin"];
export function AssetGlyph({id,size=36}:{id:string;size?:number}){
 const known=ids.indexOf(id);const hash=[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);const index=known<0?hash%30:known;
 return <img src={`/art/glyphs/${String(index+1).padStart(2,'0')}.svg`} alt="" width={size} height={size} className="asset-glyph"/>;
}
