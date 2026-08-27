import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {APP_CONFIG} from '@/config/app';

const RAW_CONFIGURED_API=(process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api').replace(/\/$/,'');
function hostOf(url:string){try{return new URL(url).hostname}catch{return''}}
function isPrivateLanHost(host:string){return /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)}
function metroLanHost(){const c:any=Constants;const raw=c.expoConfig?.hostUri||c.expoGoConfig?.debuggerHost||c.manifest2?.extra?.expoClient?.hostUri||'';const host=String(raw).replace(/^https?:\/\//,'').split(':')[0];return isPrivateLanHost(host)?host:''}
const autoLan=process.env.EXPO_PUBLIC_AUTO_LAN!=='false';
const configuredHost=hostOf(RAW_CONFIGURED_API);
// An explicitly configured LAN/HTTPS API is authoritative. Metro auto-detection is
// only used for localhost/emulator-style values so Expo Go cannot accidentally
// replace a working backend host with 127.0.0.1 or another packager address.
const configuredIsAuthoritative=!!configuredHost&&!['localhost','127.0.0.1','10.0.2.2'].includes(configuredHost);
const detectedLan=typeof __DEV__!=='undefined'&&__DEV__&&autoLan&&!configuredIsAuthoritative?metroLanHost():'';
export const API_URL=(detectedLan?`http://${detectedLan}:4000/api`:RAW_CONFIGURED_API).replace(/\/$/,'');
export const API_ORIGIN=API_URL.replace(/\/api$/,'');
const DEFAULT_TIMEOUT_MS=15000;
const UPLOAD_TIMEOUT_MS=60000;

type ApiOptions=RequestInit&{timeoutMs?:number};

// Runtime token is required for Expo Go when persistent session storage is disabled.
// `undefined` means "not initialized yet"; null means "explicitly signed out".
let runtimeAuthToken:string|null|undefined=undefined;
export function setRuntimeAuthToken(token:string|null){runtimeAuthToken=token}
export async function getAuthToken(){return runtimeAuthToken===undefined?await SecureStore.getItemAsync('tekbooks_token'):runtimeAuthToken}

export class TekBooksApiError extends Error{status?:number;code?:string;body?:any;isNetwork?:boolean;constructor(message:string,extra:any={}){super(message);Object.assign(this,extra)}}
function networkMessage(){return `${APP_CONFIG.name} cannot reach the workspace server (${API_ORIGIN}). Confirm the backend is running and this phone can access the same network.`}
function issueDetails(issues:any){
  if(!issues)return'';
  if(Array.isArray(issues))return issues.map(String).filter(Boolean).slice(0,4).join('\n');
  const parts:string[]=[];
  for(const x of issues.formErrors||[])parts.push(String(x));
  const fields=issues.fieldErrors||issues;
  if(fields&&typeof fields==='object'&&!Array.isArray(fields))for(const[key,val]of Object.entries(fields)){const values=Array.isArray(val)?val:[val];for(const v of values)if(v)parts.push(`${key}: ${String(v)}`)}
  return parts.slice(0,4).join('\n');
}
function responseMessage(body:any,status:number){const base=body?.message||`Request failed (${status})`;const detail=issueDetails(body?.issues);return detail?`${base}\n${detail}`:base}
async function requestOnce(path:string,options:ApiOptions={}){
  const token=await getAuthToken();
  const {timeoutMs=DEFAULT_TIMEOUT_MS,...fetchOptions}=options;
  const headers:any={Accept:'application/json',...(fetchOptions.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`} : {}),...(fetchOptions.headers||{})};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(`${API_URL}${path}`,{...fetchOptions,headers,signal:controller.signal});
    const type=res.headers.get('content-type')||'';const body=type.includes('application/json')?await res.json():await res.text();
    if(!res.ok)throw new TekBooksApiError(responseMessage(body,res.status),{status:res.status,code:body?.code,body});
    return body;
  }catch(e:any){
    if(e instanceof TekBooksApiError)throw e;
    throw new TekBooksApiError(networkMessage(),{isNetwork:true,body:{cause:e?.message||'Network request failed'}});
  }finally{clearTimeout(timer)}
}
export async function api(path:string,options:ApiOptions={}){try{return await requestOnce(path,options)}catch(e:any){const method=String(options.method||'GET').toUpperCase();if(e?.isNetwork&&method==='GET'){await new Promise(r=>setTimeout(r,450));return requestOnce(path,options)}throw e}}
export async function checkApiHealth(){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);try{const r=await fetch(`${API_ORIGIN}/health`,{signal:controller.signal});return r.ok}catch{return false}finally{clearTimeout(timer)}}
function localUploadPath(url:string){try{const parsed=new URL(url);return parsed.pathname.startsWith('/uploads/')?parsed.pathname:''}catch{return url.startsWith('/uploads/')?url:''}}
export function absoluteAssetUrl(url?:string){if(!url)return '';const local=localUploadPath(url);if(local)return `${API_ORIGIN}${local}`;if(/^https?:\/\//i.test(url))return url;return `${API_ORIGIN}${url.startsWith('/')?'':'/'}${url}`}
export async function uploadAsset(asset:{uri:string;name?:string;mimeType?:string}){
  const healthy=await checkApiHealth();if(!healthy)throw new TekBooksApiError(networkMessage(),{isNetwork:true});
  const form=new FormData();form.append('file',{uri:asset.uri,name:asset.name||'attachment',type:asset.mimeType||'application/octet-stream'} as any);
  return api('/uploads',{method:'POST',body:form,timeoutMs:UPLOAD_TIMEOUT_MS});
}
export async function deleteUploadedAsset(asset:any){if(!asset)return false;try{await api('/uploads',{method:'DELETE',body:JSON.stringify({key:asset.key,url:asset.url||asset})});return true}catch{return false}}
