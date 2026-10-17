import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Pulse — Crypto & FX',description:'A clearer view of crypto and currencies. Follow live market prices, explore charts, convert currencies, and save your own watchlist.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
