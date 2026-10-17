export const SITE_URL='http://localhost:5173';
export function workspaceHref(path='/watchlist'){
  if(!path.startsWith('/')||path.startsWith('//'))return '/watchlist';
  const url=new URL(path,SITE_URL);
  return url.origin===SITE_URL?`${url.pathname}${url.search}${url.hash}`:'/watchlist';
}
