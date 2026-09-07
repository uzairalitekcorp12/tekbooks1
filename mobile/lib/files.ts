import {Linking,Platform} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import {API_URL,API_ORIGIN,api,getAuthToken,TekBooksApiError,absoluteAssetUrl} from './api';

function safeName(name:string,fallback='tekbooks-file'){
  const cleaned=String(name||fallback).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim();
  return cleaned||fallback;
}
function extensionFromMime(mime?:string){const m=String(mime||'').toLowerCase();if(m.includes('pdf'))return'.pdf';if(m.includes('png'))return'.png';if(m.includes('jpeg')||m.includes('jpg'))return'.jpg';if(m.includes('webp'))return'.webp';if(m.includes('spreadsheet')||m.includes('excel'))return'.xlsx';return''}
function attachmentMime(asset:any){
  const declared=String(asset?.mimeType||asset?.contentType||'').toLowerCase();
  if(declared)return declared;
  const name=String(asset?.name||asset?.key||asset?.url||'').toLowerCase();
  if(name.endsWith('.pdf'))return'application/pdf';if(name.endsWith('.png'))return'image/png';if(name.endsWith('.jpg')||name.endsWith('.jpeg'))return'image/jpeg';if(name.endsWith('.webp'))return'image/webp';if(name.endsWith('.xlsx'))return'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';return'application/octet-stream';
}
function isLegacyLocalUpload(raw:string){
  try{const url=new URL(absoluteAssetUrl(raw));return url.origin===new URL(API_ORIGIN).origin&&url.pathname.startsWith('/uploads/')}catch{return false}
}
async function errorFromDownloadedBody(uri:string,status:number){
  try{const text=await FileSystem.readAsStringAsync(uri);const body=JSON.parse(text);return body?.message||`File service returned HTTP ${status}`}catch{return `File service returned HTTP ${status}`}
}
async function errorFromResponse(response:Response){
  try{const body=await response.clone().json();return body?.message||`File service returned HTTP ${response.status}`}catch{return `File service returned HTTP ${response.status}`}
}
function activateBrowserFile(uri:string,fileName:string,download:boolean){
  const link=document.createElement('a');link.href=uri;link.rel='noopener noreferrer';
  if(download)link.download=safeName(fileName);else link.target='_blank';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),60000);
}
async function browserFile(url:string,fileName:string,headers:Record<string,string>,download:boolean){
  const response=await fetch(url,{headers,redirect:'follow'});
  if(!response.ok)throw new TekBooksApiError(await errorFromResponse(response),{status:response.status});
  const uri=URL.createObjectURL(await response.blob());
  if(download)activateBrowserFile(uri,fileName,true);
  return uri;
}
async function downloadToDevice(url:string,fileName:string,headers:Record<string,string>={}){
  const dir=FileSystem.cacheDirectory||FileSystem.documentDirectory;if(!dir)throw new Error('No writable file cache is available on this device.');
  const uri=`${dir}${Date.now()}-${safeName(fileName)}`;
  try{await FileSystem.deleteAsync(uri,{idempotent:true})}catch{}
  let result:any;
  try{result=await FileSystem.downloadAsync(url,uri,{headers})}catch(e:any){throw new TekBooksApiError(`Cannot reach the file service (${API_ORIGIN}). ${e?.message||'Check the API connection and try again.'}`,{isNetwork:true})}
  if(result.status<200||result.status>=300){const message=await errorFromDownloadedBody(result.uri,result.status);try{await FileSystem.deleteAsync(result.uri,{idempotent:true})}catch{}throw new TekBooksApiError(message,{status:result.status})}
  const info=await FileSystem.getInfoAsync(result.uri);
  if(!info.exists||!('size'in info)||!Number(info.size)){try{await FileSystem.deleteAsync(result.uri,{idempotent:true})}catch{}throw new TekBooksApiError('The attachment downloaded as an empty file. Upload it again or retry shortly.');}
  return result.uri;
}
export async function downloadProtectedFile(path:string,fileName:string,downloadOnWeb=true){
  const token=await getAuthToken();if(!token)throw new TekBooksApiError('Authentication required. Sign in again and retry.',{status:401});
  if(Platform.OS==='web'){
    try{return await browserFile(`${API_URL}${path}`,fileName,{Accept:'*/*',Authorization:`Bearer ${token}`},downloadOnWeb)}catch(e:any){if(e instanceof TekBooksApiError)throw e;throw new TekBooksApiError(`Cannot reach the file service (${API_ORIGIN}). ${e?.message||'Check the API connection and try again.'}`,{isNetwork:true})}
  }
  return downloadToDevice(`${API_URL}${path}`,fileName,{Accept:'*/*',Authorization:`Bearer ${token}`});
}
export async function downloadStoredAttachment(asset:any){
  if(!asset)throw new Error('Attachment is unavailable.');
  const name=safeName(asset.name||`attachment${extensionFromMime(asset.mimeType)}`);
  const raw=String(asset.url||'');
  const reference=asset.key?`key=${encodeURIComponent(String(asset.key))}`:raw?`url=${encodeURIComponent(raw)}`:'';
  try{
    if(reference){
      const contentPath=`/uploads/content?${reference}&name=${encodeURIComponent(name)}`;
      if(Platform.OS==='web')return await downloadProtectedFile(contentPath,name,false);
      try{
        const access=await api(`/uploads/access?${reference}&name=${encodeURIComponent(name)}`);
        if(access?.direct){
          const directUrl=String(access.url||'');
          if(!/^https?:\/\//i.test(directUrl))throw new TekBooksApiError('The attachment service returned an invalid download address.');
          return await downloadToDevice(directUrl,name);
        }
      }catch(e:any){
        // Allow a rolling deployment to keep using the existing content route
        // until the new access endpoint is live. Other authorization/storage
        // errors must remain visible rather than being bypassed.
        if(e?.status!==404)throw e;
      }
      return await downloadProtectedFile(contentPath,name,false);
    }
  }catch(e:any){
    // Only legacy development URLs fall back to direct access. Current owner-scoped
    // S3/R2 objects always stay behind the authenticated attachment endpoint.
    if(!isLegacyLocalUpload(raw)||!(e?.status===403||e?.status===404))throw e;
  }
  if(Platform.OS==='web')return browserFile(absoluteAssetUrl(raw),name,{},false);
  const dir=FileSystem.cacheDirectory||FileSystem.documentDirectory;if(!dir)throw new Error('No writable file cache is available on this device.');
  const out=`${dir}${Date.now()}-${name}`;const result=await FileSystem.downloadAsync(absoluteAssetUrl(raw),out);if(result.status<200||result.status>=300)throw new Error(`Attachment service returned HTTP ${result.status}`);return result.uri;
}
export async function openStoredAttachment(asset:any){
  const uri=await downloadStoredAttachment(asset);
  if(Platform.OS==='web'){activateBrowserFile(uri,asset?.name||'attachment',false);return uri}
  if(Platform.OS==='android'){
    try{
      const contentUri=await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW',{data:contentUri,type:attachmentMime(asset),flags:1});
      return uri;
    }catch{}
  }
  if(await Sharing.isAvailableAsync()){await Sharing.shareAsync(uri,{mimeType:attachmentMime(asset),dialogTitle:asset?.name?`Open ${asset.name}`:'Open attachment'});return uri}
  await Linking.openURL(uri);return uri;
}
