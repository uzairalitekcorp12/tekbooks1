import {Linking,Platform} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {API_URL,API_ORIGIN,getAuthToken,TekBooksApiError,absoluteAssetUrl} from './api';

function safeName(name:string,fallback='tekbooks-file'){
  const cleaned=String(name||fallback).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim();
  return cleaned||fallback;
}
function extensionFromMime(mime?:string){const m=String(mime||'').toLowerCase();if(m.includes('pdf'))return'.pdf';if(m.includes('png'))return'.png';if(m.includes('jpeg')||m.includes('jpg'))return'.jpg';if(m.includes('webp'))return'.webp';if(m.includes('spreadsheet')||m.includes('excel'))return'.xlsx';return''}
async function errorFromDownloadedBody(uri:string,status:number){
  try{const text=await FileSystem.readAsStringAsync(uri);const body=JSON.parse(text);return body?.message||`File service returned HTTP ${status}`}catch{return `File service returned HTTP ${status}`}
}
export async function downloadProtectedFile(path:string,fileName:string){
  const token=await getAuthToken();if(!token)throw new TekBooksApiError('Authentication required. Sign in again and retry.',{status:401});
  const dir=FileSystem.cacheDirectory||FileSystem.documentDirectory;if(!dir)throw new Error('No writable file cache is available on this device.');
  const uri=`${dir}${Date.now()}-${safeName(fileName)}`;
  try{await FileSystem.deleteAsync(uri,{idempotent:true})}catch{}
  let result:any;
  try{result=await FileSystem.downloadAsync(`${API_URL}${path}`,uri,{headers:{Accept:'*/*',Authorization:`Bearer ${token}`}})}catch(e:any){throw new TekBooksApiError(`Cannot reach the file service (${API_ORIGIN}). ${e?.message||'Check the API connection and try again.'}`,{isNetwork:true})}
  if(result.status<200||result.status>=300){const message=await errorFromDownloadedBody(result.uri,result.status);try{await FileSystem.deleteAsync(result.uri,{idempotent:true})}catch{}throw new TekBooksApiError(message,{status:result.status})}
  return result.uri;
}
export async function downloadStoredAttachment(asset:any){
  if(!asset)throw new Error('Attachment is unavailable.');
  const name=safeName(asset.name||`attachment${extensionFromMime(asset.mimeType)}`);
  const raw=String(asset.url||'');
  try{
    if(asset.key)return await downloadProtectedFile(`/uploads/content?key=${encodeURIComponent(String(asset.key))}&name=${encodeURIComponent(name)}`,name);
    if(raw)return await downloadProtectedFile(`/uploads/content?url=${encodeURIComponent(raw)}&name=${encodeURIComponent(name)}`,name);
  }catch(e:any){
    // Only legacy development URLs fall back to direct access. Current owner-scoped
    // S3/R2 objects always stay behind the authenticated attachment endpoint.
    if(!raw||!(e?.status===403||e?.status===404))throw e;
  }
  const dir=FileSystem.cacheDirectory||FileSystem.documentDirectory;if(!dir)throw new Error('No writable file cache is available on this device.');
  const out=`${dir}${Date.now()}-${name}`;const result=await FileSystem.downloadAsync(absoluteAssetUrl(raw),out);if(result.status<200||result.status>=300)throw new Error(`Attachment service returned HTTP ${result.status}`);return result.uri;
}
export async function openStoredAttachment(asset:any){
  const uri=await downloadStoredAttachment(asset);
  if(Platform.OS==='android'){
    try{const contentUri=await FileSystem.getContentUriAsync(uri);await Linking.openURL(contentUri);return uri}catch{}
  }
  if(await Sharing.isAvailableAsync()){await Sharing.shareAsync(uri,{mimeType:asset?.mimeType||undefined,dialogTitle:asset?.name?`Open ${asset.name}`:'Open attachment'});return uri}
  await Linking.openURL(uri);return uri;
}
