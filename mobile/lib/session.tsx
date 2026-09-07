import React,{createContext,useContext,useEffect,useState} from 'react';
import {api,setRuntimeAuthToken} from './api';
import {registerPushToken} from './notifications';
import {saveBranding} from './branding';
import {getDeviceIdentity} from './device';
import {deletePrivateItem,getPrivateItem,setPrivateItem} from './private-storage';
import {APP_CONFIG} from '@/config/app';

type Ctx={user:any;token:string|null;loading:boolean;error:string|null;signIn:(token:string,user:any)=>Promise<void>;signOut:()=>Promise<void>;refresh:()=>Promise<void>};
const Context=createContext<Ctx>({} as Ctx);

export function SessionProvider({children}:{children:React.ReactNode}){
  const[token,setToken]=useState<string|null>(null);const[user,setUser]=useState<any>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);
  useEffect(()=>{let cancelled=false;(async()=>{
    try{
      const identity=await getDeviceIdentity();
      if(identity.expoGo&&!APP_CONFIG.security.persistExpoGoSession){
        await deletePrivateItem('tekbooks_token');setRuntimeAuthToken(null);if(!cancelled){setToken(null);setUser(null)}return;
      }
      const t=await getPrivateItem('tekbooks_token');setRuntimeAuthToken(t);if(!cancelled)setToken(t);
      if(t){try{const u=await api('/profile');if(!cancelled){setUser(u);setError(null)}await saveBranding(u)}catch(error:any){
        // A temporary LAN/tunnel failure must not erase a valid local session.
        if(error?.status===401||error?.status===403){await deletePrivateItem('tekbooks_token');setRuntimeAuthToken(null);if(!cancelled){setToken(null);setUser(null)}}
        else{if(!cancelled)setError(error?.message||'The workspace profile could not be refreshed.');if(__DEV__)console.warn('Session profile refresh deferred:',error?.message||error)}
      }}
    }catch(error:any){setRuntimeAuthToken(null);if(!cancelled){setToken(null);setUser(null);setError(error?.message||'Session storage could not be initialized.')}if(__DEV__)console.warn('Session initialization failed:',error)}finally{if(!cancelled)setLoading(false)}
  })();return()=>{cancelled=true}},[]);
  async function signIn(t:string,u:any){
    const identity=await getDeviceIdentity();
    setRuntimeAuthToken(t);
    setToken(t);setUser(u);setError(null);await saveBranding(u);
    try{if(identity.expoGo&&!APP_CONFIG.security.persistExpoGoSession)await deletePrivateItem('tekbooks_token');else await setPrivateItem('tekbooks_token',t)}catch(error){if(__DEV__)console.warn('Session persistence unavailable:',error)}
    const push=await registerPushToken();if(push){try{await api('/profile',{method:'PUT',body:JSON.stringify({expoPushToken:push})})}catch{}}
  }
  async function signOut(){setRuntimeAuthToken(null);setToken(null);setUser(null);setError(null);try{await deletePrivateItem('tekbooks_token')}catch(error){if(__DEV__)console.warn('Stored session cleanup failed:',error)}}
  async function refresh(){if(token){try{const u=await api('/profile');setUser(u);setError(null);await saveBranding(u)}catch(refreshError:any){setError(refreshError?.message||'The workspace profile could not be refreshed.');throw refreshError}}}
  return <Context.Provider value={{user,token,loading,error,signIn,signOut,refresh}}>{children}</Context.Provider>;
}
export const useSession=()=>useContext(Context);
