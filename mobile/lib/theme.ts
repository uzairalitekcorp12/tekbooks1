import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {TextStyle, useColorScheme} from 'react-native';
import Constants from 'expo-constants';
import {isRunningInExpoGo} from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP_CONFIG} from '@/config/app';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AppColors = {[K in keyof typeof APP_CONFIG.theme.light]: string};
const KEY = 'tekbooks_theme_mode';

const ThemeContext = createContext<{
  mode: ThemeMode;
  resolved: 'light'|'dark';
  colors: AppColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
}>({mode:'light',resolved:'light',colors:APP_CONFIG.theme.light,setMode:async()=>{},toggle:async()=>{}});

export function ThemeProvider({children}:{children:React.ReactNode}){
  const system=useColorScheme();
  const[mode,setModeState]=useState<ThemeMode>('light');
  useEffect(()=>{AsyncStorage.getItem(KEY).then(v=>{if(v==='light'||v==='dark'||v==='system')setModeState(v)}).catch(()=>{})},[]);
  const resolved:'light'|'dark'=mode==='system'?(system==='dark'?'dark':'light'):mode;
  const colors=APP_CONFIG.theme[resolved] as AppColors;
  const setMode=async(next:ThemeMode)=>{setModeState(next);await AsyncStorage.setItem(KEY,next)};
  const toggle=async()=>setMode(resolved==='dark'?'light':'dark');
  const value=useMemo(()=>({mode,resolved,colors,setMode,toggle}),[mode,resolved,colors]);
  return React.createElement(ThemeContext.Provider,{value},children);
}
export const useTheme=()=>useContext(ThemeContext);

const t=APP_CONFIG.typography;
// Lufga is embedded only when the licensed files exist at build time. Expo Go
// intentionally uses the platform fallback because native config plugins are not applied there.
const hasEmbeddedLufga=Boolean((Constants.expoConfig?.extra as any)?.hasEmbeddedLufga)&&!isRunningInExpoGo();
const regularFamily=hasEmbeddedLufga?'Lufga':t.regularFamily;
const mediumFamily=hasEmbeddedLufga?'Lufga':t.mediumFamily;
export const typography={
  regular:{fontFamily:regularFamily,fontWeight:t.regularWeight} as TextStyle,
  medium:{fontFamily:mediumFamily,fontWeight:t.mediumWeight} as TextStyle,
  semibold:{fontFamily:mediumFamily,fontWeight:t.semiboldWeight} as TextStyle,
};
export const C={green:APP_CONFIG.theme.light.primary,green2:APP_CONFIG.theme.light.primary2,mint:APP_CONFIG.theme.light.accentSoft,ink:APP_CONFIG.theme.light.text,muted:APP_CONFIG.theme.light.textMuted,line:APP_CONFIG.theme.light.border,white:APP_CONFIG.theme.light.surfaceStrong,bg:APP_CONFIG.theme.light.background,danger:APP_CONFIG.theme.light.danger,warning:APP_CONFIG.theme.light.warning,success:APP_CONFIG.theme.light.success};
export const radius={sm:12,md:18,lg:26,xl:34};
