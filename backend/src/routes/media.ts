import { Router } from 'express';
import { readStoredFile, verifyMediaSignature } from '../services/storage.js';
const r=Router();
r.get('/',async(req,res)=>{
  const key=String(req.query.key||''),sig=String(req.query.sig||''),expiresAt=req.query.exp;
  if(!verifyMediaSignature(key,sig,expiresAt))return res.status(403).json({message:'This media link is invalid or has expired. Refresh the screen and try again.'});
  try{
    const file=await readStoredFile(key);if(!file)return res.status(404).json({message:'Media not found'});
    const remaining=expiresAt?Math.max(0,Number(expiresAt)-Math.floor(Date.now()/1000)):0;
    res.setHeader('Content-Type',file.contentType);
    res.setHeader('Content-Length',String(file.buffer.length));
    res.setHeader('Content-Disposition',`inline; filename="${file.key.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g,'_')||'attachment'}"`);
    res.setHeader('Cache-Control',remaining?`private, max-age=${Math.min(remaining,3600)}`:'private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.send(file.buffer);
  }catch(error:any){console.error('Media read failed:',error?.message||error);return res.status(503).json({message:'Media storage is temporarily unavailable'})}
});
export default r;
