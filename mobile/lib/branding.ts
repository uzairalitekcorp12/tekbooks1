import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP_CONFIG} from '@/config/app';
const KEY='tekbooks_last_branding';
export type CachedBranding={companyName:string;legalName?:string;logoUrl?:string};
export function brandingFromUser(user:any):CachedBranding{return{companyName:user?.business?.name||user?.business?.legalName||APP_CONFIG.brand.neutralWorkspaceName,legalName:user?.business?.legalName||'',logoUrl:user?.business?.logoUrl||''}}
export async function saveBranding(user:any){try{await AsyncStorage.setItem(KEY,JSON.stringify(brandingFromUser(user)))}catch{}}
export async function loadBranding():Promise<CachedBranding|null>{try{const raw=await AsyncStorage.getItem(KEY);return raw?JSON.parse(raw):null}catch{return null}}
