'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="not-found"><img src="/favicon.svg" alt="Pulse" width="48" height="48"/><h1>The market desk couldn’t load.</h1><p>Try again to reconnect.</p><button className="primary-button" onClick={reset}>Try again</button></main>;}
