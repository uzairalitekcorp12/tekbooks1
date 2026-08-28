import Constants from 'expo-constants';
import {fetch as expoFetch} from 'expo/fetch';
import {File} from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import {APP_CONFIG} from '@/config/app';

const RAW_CONFIGURED_API=(process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api').replace(/\/$/,'');
function parsedUrl(url:string){try{return new URL(url)}catch{return null}}
function hostOf(url:string){return parsedUrl(url)?.hostname||''}
function isPrivateLanHost(host:string){return /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)}
function expoHostUri(){const c:any=Constants;return String(c.expoConfig?.hostUri||c.expoGoConfig?.debuggerHost||c.manifest2?.extra?.expoClient?.hostUri||'').trim()}
function metroHttpOrigin(){
  let raw=expoHostUri();if(!raw)return'';
  raw=raw.replace(/^exps:\/\//i,'https://').replace(/^exp:\/\//i,'http://');
  if(!/^https?:\/\//i.test(raw)){
    const host=raw.split('/')[0].split(':')[0];
    raw=`${isPrivateLanHost(host)||host==='localhost'||host==='127.0.0.1'?'http':'https'}://${raw}`;
  }
  const parsed=parsedUrl(raw);return parsed?parsed.origin:'';
}
function metroLanHost(){const host=hostOf(metroHttpOrigin());return isPrivateLanHost(host)?host:''}
const autoLan=process.env.EXPO_PUBLIC_AUTO_LAN!=='false';
const proxyThroughMetro=process.env.EXPO_PUBLIC_PROXY_API_THROUGH_METRO==='true';
const configuredHost=hostOf(RAW_CONFIGURED_API);
const isLocalConfiguredHost=['localhost','127.0.0.1','10.0.2.2'].includes(configuredHost)||isPrivateLanHost(configuredHost);
const runtimeIsDev=typeof __DEV__!=='undefined'&&__DEV__;
const metroOrigin=runtimeIsDev?metroHttpOrigin():'';
const detectedLan=runtimeIsDev&&autoLan&&isLocalConfiguredHost?metroLanHost():'';
// Expo Go can route all backend paths through Metro. That makes tunnel mode work
// across different networks and prevents an old private IP from surviving a Wi-Fi change.
const resolvedApi=runtimeIsDev&&proxyThroughMetro&&metroOrigin
  ?`${metroOrigin}/api`
  :detectedLan
    ?`http://${detectedLan}:4000/api`
    :RAW_CONFIGURED_API;
export const API_URL=resolvedApi.replace(/\/$/,'');
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
function uploadMimeType(asset:{name?:string;mimeType?:string},file:File){
  const declared=String(asset.mimeType||file.type||'').toLowerCase();
  if(declared==='image/jpg')return'image/jpeg';
  if(['image/jpeg','image/png','image/webp','application/pdf'].includes(declared))return declared;
  const name=String(asset.name||file.name||'').toLowerCase();
  if(name.endsWith('.jpg')||name.endsWith('.jpeg'))return'image/jpeg';
  if(name.endsWith('.png'))return'image/png';
  if(name.endsWith('.webp'))return'image/webp';
  if(name.endsWith('.pdf'))return'application/pdf';
  return'application/octet-stream';
}
export async function uploadAsset(asset:{uri:string;name?:string;mimeType?:string}){
  const healthy=await checkApiHealth();if(!healthy)throw new TekBooksApiError(networkMessage(),{isNetwork:true});
  const file=new File(asset.uri);const mimeType=uploadMimeType(asset,file);const name=asset.name||file.name||'attachment';
  const presigned=await api('/uploads/presign',{method:'POST',body:JSON.stringify({name,mimeType,size:file.size})});
  if(presigned?.direct){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),UPLOAD_TIMEOUT_MS);
    try{
      const uploaded=await expoFetch(presigned.uploadUrl,{method:'PUT',headers:presigned.headers||{'Content-Type':mimeType},body:file,signal:controller.signal});
      if(!uploaded.ok)throw new TekBooksApiError(`Storage upload failed (${uploaded.status}). Try again.`,{status:uploaded.status});
      return api('/uploads/complete',{method:'POST',body:JSON.stringify({attachment:presigned.attachment}),timeoutMs:DEFAULT_TIMEOUT_MS});
    }catch(e:any){
      if(e instanceof TekBooksApiError)throw e;
      throw new TekBooksApiError(`The file could not be uploaded to secure storage. ${e?.message||'Try again.'}`,{isNetwork:true});
    }finally{clearTimeout(timer)}
  }
  const form=new FormData();form.append('file',{uri:asset.uri,name,type:mimeType} as any);
  return api('/uploads',{method:'POST',body:form,timeoutMs:UPLOAD_TIMEOUT_MS});
}
export async function deleteUploadedAsset(asset:any){if(!asset)return false;try{await api('/uploads',{method:'DELETE',body:JSON.stringify({key:asset.key,url:asset.url||asset})});return true}catch{return false}}
