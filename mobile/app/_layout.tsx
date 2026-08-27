import {useEffect} from 'react';
import {Stack, router} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SessionProvider} from '@/lib/session';
import {setupNotificationHandling} from '@/lib/notifications';
import {ThemeProvider,useTheme} from '@/lib/theme';

function NavigationRoot(){const{colors,resolved}=useTheme();useEffect(()=>{let disposed=false;let cleanup=()=>{};setupNotificationHandling(url=>{if(url==='tekbooks://device-requests')router.push('/device-requests')}).then(fn=>{if(disposed)fn();else cleanup=fn});return()=>{disposed=true;cleanup()}},[]);return <><StatusBar style={resolved==='dark'?'light':'dark'}/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.background}}}/></>}
export default function Root(){return <ThemeProvider><SessionProvider><NavigationRoot/></SessionProvider></ThemeProvider>}
