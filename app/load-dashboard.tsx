import Dashboard from '@/components/dashboard';
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {pageSnapshot} from '@/lib/page-snapshot';
import {canInspectSystem} from '@/lib/auth-server';
import type {View} from '@/lib/types';
export async function loadDashboard(view:View,coinId?:string){
 const requestHeaders=new Headers(await headers());
 if(view==='status'&&!await canInspectSystem(requestHeaders))notFound();
 const snapshot=await pageSnapshot({view,coinId},requestHeaders);
 return <Dashboard key={`${view}:${coinId??'default'}`} {...snapshot}/>;
}
