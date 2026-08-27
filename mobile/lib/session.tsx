import React,{createContext,useContext,useEffect,useState} from 'react';
import * as SecureStore from 'expo-secure-store';
import {api,setRuntimeAuthToken} from './api';
import {registerPushToken} from './notifications';
import {saveBranding} from './branding';
import {getDeviceIdentity} from './device';
import {APP_CONFIG} from '@/config/app';

type Ctx={user:any;token:string|null;loading:boolean;signIn:(token:string,user:any)=>Promise<void>;signOut:()=>Promise<void>;refresh:()=>Promise<void>};
const Context=createContext<Ctx>({} as Ctx);

export function SessionProvider({children}:{children:React.ReactNode}){
  const[token,setToken]=useState<string|null>(null);const[user,setUser]=useState<any>(null);const[loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{
    try{
      const identity=await getDeviceIdentity();
      if(identity.expoGo&&!APP_CONFIG.security.persistExpoGoSession){
        await SecureStore.deleteItemAsync('tekbooks_token');setRuntimeAuthToken(null);setToken(null);setUser(null);return;
      }
      const t=await SecureStore.getItemAsync('tekbooks_token');setRuntimeAuthToken(t);setToken(t);
      if(t){try{const u=await api('/profile');setUser(u);await saveBranding(u)}catch{await SecureStore.deleteItemAsync('tekbooks_token');setRuntimeAuthToken(null);setToken(null);setUser(null)}}
    }finally{setLoading(false)}
  })()},[]);
  async function signIn(t:string,u:any){
    const identity=await getDeviceIdentity();
    // Always keep the current sign-in token in memory. Expo Go may intentionally
    // skip persistent storage, but protected requests still need this token now.
    setRuntimeAuthToken(t);
    if(identity.expoGo&&!APP_CONFIG.security.persistExpoGoSession)await SecureStore.deleteItemAsync('tekbooks_token');else await SecureStore.setItemAsync('tekbooks_token',t);
    setToken(t);setUser(u);await saveBranding(u);
    const push=await registerPushToken();if(push){try{await api('/profile',{method:'PUT',body:JSON.stringify({expoPushToken:push})})}catch{}}
  }
  async function signOut(){await SecureStore.deleteItemAsync('tekbooks_token');setRuntimeAuthToken(null);setToken(null);setUser(null)}
  async function refresh(){if(token){const u=await api('/profile');setUser(u);await saveBranding(u)}}
  return <Context.Provider value={{user,token,loading,signIn,signOut,refresh}}>{children}</Context.Provider>;
}
export const useSession=()=>useContext(Context);
