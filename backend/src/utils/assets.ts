import {env} from '../config/env.js';
import {readStoredFile,storedKey} from '../services/storage.js';

const MAX_PDF_IMAGE_BYTES=10*1024*1024;

export function pdfImageType(buffer:Buffer):'png'|'jpeg'|null{
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return'png';
  if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return'jpeg';
  return null;
}

function usablePdfImage(buffer:Buffer){return buffer.length<=MAX_PDF_IMAGE_BYTES&&pdfImageType(buffer)!==null}

export async function pdfImageBuffer(url?:string){
  if(!url)return null;
  const ownedKey=storedKey(url);
  if(ownedKey){
    try{const file=await readStoredFile(ownedKey);if(!file||!usablePdfImage(file.buffer))return null;return file.buffer}catch{return null}
  }
  if(!/^https?:\/\//i.test(url))return null;
  try{
    const res=await fetch(url,{signal:AbortSignal.timeout(5000)});
    if(!res.ok)return null;
    const declaredSize=Number(res.headers.get('content-length')||0);
    if(declaredSize>MAX_PDF_IMAGE_BYTES)return null;
    const buffer=Buffer.from(await res.arrayBuffer());
    return usablePdfImage(buffer)?buffer:null;
  }catch{return null}
}
