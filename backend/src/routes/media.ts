import { Router } from 'express';
import { readStoredFile, verifyMediaSignature } from '../services/storage.js';
const r=Router();
r.get('/',async(req,res)=>{
  const key=String(req.query.key||''),sig=String(req.query.sig||'');
  if(!verifyMediaSignature(key,sig))return res.status(403).json({message:'Invalid media link'});
  try{
    const file=await readStoredFile(key);if(!file)return res.status(404).json({message:'Media not found'});
    res.setHeader('Content-Type',file.contentType);res.setHeader('Content-Length',String(file.buffer.length));res.setHeader('Cache-Control','public, max-age=86400, immutable');res.send(file.buffer);
  }catch{return res.status(404).json({message:'Media not found'})}
});
export default r;
