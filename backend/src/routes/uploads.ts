import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { sensitiveLimiter } from '../middleware/security.js';
import { Invoice, Transaction } from '../models/index.js';
import { isOwnedStorageKey, readStoredFile, removeStoredFile, storeFile, storedKey } from '../services/storage.js';
const r=Router();
const allowed=new Set(['image/jpeg','image/png','image/webp','application/pdf']);
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:env.MAX_UPLOAD_MB*1024*1024},fileFilter(_req,file,cb){cb(null,allowed.has(file.mimetype));}});
function safeName(value:unknown){return String(value||'attachment').replace(/[\\/:*?"<>|\r\n]+/g,'-').slice(0,140)||'attachment'}
async function isReferencedByUser(value:unknown,userId:unknown){
  if(isOwnedStorageKey(value,userId))return true;
  const raw=String(value||'').trim(),key=storedKey(raw);if(!raw&&!key)return false;
  const candidates=[raw,key,`/uploads/${key}`].filter(Boolean);
  const attachmentQuery={$or:[{'attachment.key':{$in:candidates}},{'attachment.url':{$in:candidates}}]};
  return !!(await Transaction.exists({userId,...attachmentQuery})||await Invoice.exists({userId,...attachmentQuery}));
}
r.post('/',requireAuth,sensitiveLimiter,(req,res,next)=>{
  upload.single('file')(req,res,async(error:any)=>{
    if(error){if(error?.code==='LIMIT_FILE_SIZE')return res.status(413).json({message:`Attachment is too large. Maximum size is ${env.MAX_UPLOAD_MB} MB.`});return res.status(400).json({message:error?.message||'Attachment could not be uploaded.'})}
    try{if(!req.file)return res.status(400).json({message:'Attach a JPEG, PNG, WebP or PDF file'});const stored=await storeFile(req.file,req.user._id);res.status(201).json(stored)}catch(e){next(e)}
  });
});
r.get('/content',requireAuth,async(req,res)=>{
  const value=String(req.query.key||req.query.url||'');
  if(!await isReferencedByUser(value,req.user._id))return res.status(403).json({message:'This attachment does not belong to the current workspace.'});
  const file=await readStoredFile(value);if(!file)return res.status(404).json({message:'Attachment file was not found in storage.'});
  const name=safeName(req.query.name||file.key.split('/').pop()||'attachment');
  res.setHeader('Content-Type',file.contentType||'application/octet-stream');res.setHeader('Content-Length',String(file.buffer.length));res.setHeader('Content-Disposition',`inline; filename="${name}"`);res.setHeader('Cache-Control','private, no-store');res.send(file.buffer);
});
r.delete('/',requireAuth,sensitiveLimiter,async(req,res)=>{const value=req.body?.key||req.body?.url;if(!isOwnedStorageKey(value,req.user._id))return res.status(403).json({message:'This file does not belong to the current workspace'});const removed=await removeStoredFile(value);res.json({ok:true,removed});});
export default r;
