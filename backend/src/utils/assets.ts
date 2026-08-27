import {env} from '../config/env.js';
import {readStoredFile,storedKey} from '../services/storage.js';
function supportedImage(value:string,contentType=''){const v=value.toLowerCase();return contentType.includes('png')||contentType.includes('jpeg')||contentType.includes('jpg')||v.endsWith('.png')||v.endsWith('.jpg')||v.endsWith('.jpeg')}
export async function pdfImageBuffer(url?:string){
  if(!url)return null;
  const ownedKey=storedKey(url);
  if(ownedKey){
    try{const file=await readStoredFile(ownedKey);if(!file||!supportedImage(ownedKey,file.contentType))return null;return file.buffer}catch{return null}
  }
  if(!/^https?:\/\//i.test(url))return null;
  try{const res=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!res.ok)return null;const type=res.headers.get('content-type')||'';if(!supportedImage(url,type))return null;return Buffer.from(await res.arrayBuffer())}catch{return null}
}
