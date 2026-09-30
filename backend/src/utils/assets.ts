import {env} from '../config/env.js';
import {readStoredFile,storedKey} from '../services/storage.js';

const MAX_PDF_IMAGE_BYTES=10*1024*1024;

export function pdfImageType(buffer:Buffer):'png'|'jpeg'|null{
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return'png';
  if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return'jpeg';
  return null;
}

export function pdfImageDimensions(buffer:Buffer):{width:number;height:number}|null{
  if(pdfImageType(buffer)==='png'&&buffer.length>=24){
    const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);
    return width&&height?{width,height}:null;
  }
  if(pdfImageType(buffer)!=='jpeg')return null;
  let offset=2;
  while(offset+9<buffer.length){
    if(buffer[offset]!==0xff){offset++;continue}
    const marker=buffer[offset+1];offset+=2;
    if(marker===0xd9||marker===0xda)break;
    if(marker===0xff||marker===0x00||marker===0xd8)continue;
    if(offset+2>buffer.length)break;
    const length=buffer.readUInt16BE(offset);
    if(length<2||offset+length>buffer.length)break;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      const height=buffer.readUInt16BE(offset+3),width=buffer.readUInt16BE(offset+5);
      return width&&height?{width,height}:null;
    }
    offset+=length;
  }
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
