import Constants from 'expo-constants';
import {fetch as expoFetch} from 'expo/fetch';
import {File as ExpoFile} from 'expo-file-system';
import {Platform} from 'react-native';
import {APP_CONFIG} from '@/config/app';
import {getPrivateItem} from './private-storage';
import {beginActivity,requestActivityLabel} from './activity';

// This public URL is intentionally safe to embed in APK/AAB bundles. `npm run dev`
// overrides it with the current LAN backend for a local full-stack session.
export const DEFAULT_PUBLIC_API_URL='https://tekbooks-apzv.vercel.app/api';
const RAW_CONFIGURED_API=(process.env.EXPO_PUBLIC_API_URL||DEFAULT_PUBLIC_API_URL).trim().replace(/\/$/,'');
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
const resolvedApi=runtimeIsDev&&proxyThroughMetro&&isLocalConfiguredHost&&metroOrigin
  ?`${metroOrigin}/api`
  :detectedLan
    ?`http://${detectedLan}:4000/api`
    :RAW_CONFIGURED_API;
export const API_URL=resolvedApi.replace(/\/$/,'');
export const API_ORIGIN=API_URL.replace(/\/api$/,'');
const DEFAULT_TIMEOUT_MS=15000;
const UPLOAD_TIMEOUT_MS=60000;

type ApiOptions=RequestInit&{timeoutMs?:number;activityLabel?:string|false};
const pendingGets=new Map<string,Promise<any>>();

// Runtime token is required for Expo Go when persistent session storage is disabled.
// `undefined` means "not initialized yet"; null means "explicitly signed out".
let runtimeAuthToken:string|null|undefined=undefined;
let sessionRevokedHandler:(()=>void)|null=null;
export function setSessionRevokedHandler(handler:(()=>void)|null){sessionRevokedHandler=handler}
export function setRuntimeAuthToken(token:string|null){runtimeAuthToken=token;pendingGets.clear()}
export async function getAuthToken(){return runtimeAuthToken===undefined?await getPrivateItem('tekbooks_token'):runtimeAuthToken}

export class TekBooksApiError extends Error{status?:number;code?:string;body?:any;isNetwork?:boolean;constructor(message:string,extra:any={}){super(message);Object.assign(this,extra)}}
function networkMessage(){return `${APP_CONFIG.name} cannot reach its API (${API_ORIGIN}). Check the configured API URL and your internet or local-network connection.`}
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
async function requestOnce(path:string,options:ApiOptions,token:string|null){
  const {timeoutMs=DEFAULT_TIMEOUT_MS,activityLabel,...fetchOptions}=options;
  const hasJsonBody=fetchOptions.body!==undefined&&fetchOptions.body!==null&&!(fetchOptions.body instanceof FormData);
  const headers:any={Accept:'application/json',...(hasJsonBody?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} : {}),...(fetchOptions.headers||{})};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(`${API_URL}${path}`,{...fetchOptions,headers,signal:controller.signal});
    const type=res.headers.get('content-type')||'';const body=type.includes('application/json')?await res.json():await res.text();
    if(!res.ok){
      if(body?.code==='DEVICE_SESSION_REVOKED'&&token&&runtimeAuthToken===token)sessionRevokedHandler?.();
      throw new TekBooksApiError(responseMessage(body,res.status),{status:res.status,code:body?.code,body});
    }
    return body;
  }catch(e:any){
    if(e instanceof TekBooksApiError)throw e;
    throw new TekBooksApiError(networkMessage(),{isNetwork:true,body:{cause:e?.message||'Network request failed'}});
  }finally{clearTimeout(timer)}
}
export async function api(path:string,options:ApiOptions={}){
  const method=String(options.method||'GET').toUpperCase();
  const activity=options.activityLabel===false?null:beginActivity(options.activityLabel||requestActivityLabel(path,method),method==='GET'?0:1);
  try{
    const token=await getAuthToken();
    // Share only identical default GETs that are currently in flight. No stale data
    // cache, and requests with custom headers, signals or other options stay separate.
    const share=method==='GET'&&Object.keys(options).every(key=>['method','timeoutMs','activityLabel'].includes(key));
    const key=JSON.stringify([token,path,options.timeoutMs??DEFAULT_TIMEOUT_MS]);
    let request=share?pendingGets.get(key):undefined;
    if(!request){
      request=(async()=>{
        try{return await requestOnce(path,options,token)}catch(e:any){
          if(e?.isNetwork&&method==='GET'){
            activity?.update('Connection interrupted. Retrying…');
            await new Promise(resolve=>setTimeout(resolve,450));
            return requestOnce(path,options,token);
          }
          throw e;
        }
      })();
      if(share){
        pendingGets.set(key,request);
        const cleanup=()=>{if(pendingGets.get(key)===request)pendingGets.delete(key)};
        void request.then(cleanup,cleanup);
      }
    }
    return await request;
  }finally{activity?.end()}
}
export async function checkApiHealth(){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);try{const r=await fetch(`${API_ORIGIN}/health`,{headers:{Accept:'application/json'},signal:controller.signal});return r.ok}catch{return false}finally{clearTimeout(timer)}}
export async function checkApiReadiness(){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(`${API_ORIGIN}/ready`,{headers:{Accept:'application/json'},signal:controller.signal});
    let body:any=null;try{body=await response.json()}catch{}
    return{ok:response.ok,reachable:true,status:response.status,message:String(body?.message||'')};
  }catch(e:any){return{ok:false,reachable:false,status:0,message:String(e?.message||'Network request failed')}}
  finally{clearTimeout(timer)}
}
function localUploadPath(url:string){try{const parsed=new URL(url);return parsed.pathname.startsWith('/uploads/')?parsed.pathname:''}catch{return url.startsWith('/uploads/')?url:''}}
export function absoluteAssetUrl(url?:string){if(!url)return '';const local=localUploadPath(url);if(local)return `${API_ORIGIN}${local}`;if(/^https?:\/\//i.test(url))return url;return `${API_ORIGIN}${url.startsWith('/')?'':'/'}${url}`}
type UploadAssetInput={uri:string;name?:string;mimeType?:string;size?:number|null;file?:Blob|null};
type UploadFileBody=Blob|ExpoFile;
function uploadMimeType(asset:UploadAssetInput,file:{type?:string|null;name?:string}){
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
async function uploadBody(asset:UploadAssetInput):Promise<UploadFileBody>{
  if(asset.file&&Number.isFinite(asset.file.size))return asset.file;
  if(Platform.OS!=='web')return new ExpoFile(asset.uri);
  const response=await fetch(asset.uri);if(!response.ok)throw new TekBooksApiError('The selected browser file could not be read. Choose it again.');
  return response.blob();
}
function storageUploadMessage(error:any){
  const corsHint=Platform.OS==='web'?' The S3 bucket must allow browser PUT requests (CORS) from this site.':'';
  return `The file could not be uploaded to secure storage.${corsHint} ${error?.message||'Try again.'}`.trim();
}
export async function uploadAsset(asset:UploadAssetInput){
  const activity=beginActivity(`Preparing ${asset.name||'attachment'}…`,2);
  try{
  // The presign/upload endpoints already validate runtime and storage readiness.
  // Avoid a separate database ping and storage round trip before every upload.
  const file=await uploadBody(asset);const mimeType=uploadMimeType(asset,file);const fileName='name'in file&&typeof file.name==='string'?file.name:'';const name=asset.name||fileName||'attachment';
  const size=Number(asset.size||file.size||0);
  if(!Number.isSafeInteger(size)||size<1)throw new TekBooksApiError('The selected file has no readable size. Choose it again.');
  const presigned=await api('/uploads/presign',{method:'POST',body:JSON.stringify({name,mimeType,size}),activityLabel:false});
  activity.update(`Uploading ${name}…`);
  if(presigned?.direct){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),UPLOAD_TIMEOUT_MS);
    try{
      const uploaded=await expoFetch(presigned.uploadUrl,{method:'PUT',headers:presigned.headers||{'Content-Type':mimeType},body:file,signal:controller.signal});
      if(!uploaded.ok){
        const details=await uploaded.text().catch(()=>'');const storageCode=details.match(/<Code>([^<]+)<\/Code>/)?.[1];
        throw new TekBooksApiError(`Storage upload failed (${uploaded.status}${storageCode?`, ${storageCode}`:''}). Try again.`,{status:uploaded.status});
      }
      activity.update('Finishing upload…');
      return await api('/uploads/complete',{method:'POST',body:JSON.stringify({attachment:presigned.attachment}),timeoutMs:DEFAULT_TIMEOUT_MS,activityLabel:false});
    }catch(e:any){
      if(e instanceof TekBooksApiError)throw e;
      throw new TekBooksApiError(storageUploadMessage(e),{isNetwork:true});
    }finally{clearTimeout(timer)}
  }
  const form=new FormData();
  if(Platform.OS==='web')form.append('file',file as Blob,name);
  else form.append('file',{uri:asset.uri,name,type:mimeType} as any);
  return await api('/uploads',{method:'POST',body:form,timeoutMs:UPLOAD_TIMEOUT_MS,activityLabel:false});
  }finally{activity.end()}
}
export async function deleteUploadedAsset(asset:any){if(!asset)return false;try{await api('/uploads',{method:'DELETE',body:JSON.stringify({key:asset.key,url:asset.url||asset})});return true}catch{return false}}
