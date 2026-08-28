import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/security.js';
import { Invoice, Transaction } from '../models/index.js';
import {
  completePresignedUpload,
  createPresignedDownloadUrl,
  createPresignedUpload,
  isOwnedStorageKey,
  readStoredFile,
  storeFile,
  storedKey,
  usesS3Storage
} from '../services/storage.js';
import { removeOwnedStoredFileIfUnreferenced } from '../services/storage-records.js';
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
r.post('/presign',requireAuth,uploadLimiter,async(req,res)=>{
  if(!usesS3Storage())return res.json({direct:false});
  const parsed=z.object({name:z.string().trim().min(1).max(180),mimeType:z.enum(['image/jpeg','image/png','image/webp','application/pdf']),size:z.coerce.number().int().positive()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({message:'Upload details are invalid.',issues:parsed.error.flatten()});
  const result=await createPresignedUpload({...parsed.data,ownerId:req.user._id});
  res.json(result);
});
r.post('/complete',requireAuth,uploadLimiter,async(req,res)=>{
  if(!usesS3Storage())return res.status(400).json({message:'Direct upload completion is unavailable for local storage.'});
  const stored=await completePresignedUpload(req.body?.attachment||req.body,req.user._id);
  res.status(201).json(stored);
});
r.post('/',requireAuth,uploadLimiter,(req,res,next)=>{
  if(usesS3Storage())return res.status(409).json({code:'DIRECT_UPLOAD_REQUIRED',message:'Use the direct S3 upload flow for this deployment.'});
  upload.single('file')(req,res,async(error:any)=>{
    if(error){if(error?.code==='LIMIT_FILE_SIZE')return res.status(413).json({message:`Attachment is too large. Maximum size is ${env.MAX_UPLOAD_MB} MB.`});return res.status(400).json({message:error?.message||'Attachment could not be uploaded.'})}
    try{if(!req.file)return res.status(400).json({message:'Attach a JPEG, PNG, WebP or PDF file'});const stored=await storeFile(req.file,req.user._id);res.status(201).json(stored)}catch(e){next(e)}
  });
});
r.get('/content',requireAuth,async(req,res)=>{
  const value=String(req.query.key||req.query.url||'');
  if(!await isReferencedByUser(value,req.user._id))return res.status(403).json({message:'This attachment does not belong to the current workspace.'});
  const name=safeName(req.query.name||storedKey(value).split('/').pop()||'attachment');
  if(usesS3Storage()){
    const url=await createPresignedDownloadUrl(value,name,true);
    if(!url)return res.status(404).json({message:'Attachment file was not found in storage.'});
    res.setHeader('Cache-Control','private, no-store');
    return res.redirect(302,url);
  }
  const file=await readStoredFile(value);if(!file)return res.status(404).json({message:'Attachment file was not found in storage.'});
  res.setHeader('Content-Type',file.contentType||'application/octet-stream');res.setHeader('Content-Length',String(file.buffer.length));res.setHeader('Content-Disposition',`inline; filename="${name}"`);res.setHeader('Cache-Control','private, no-store');res.send(file.buffer);
});
r.delete('/',requireAuth,uploadLimiter,async(req,res)=>{const value=req.body?.key||req.body?.url;if(!isOwnedStorageKey(value,req.user._id))return res.status(403).json({message:'This file does not belong to the current workspace'});const result=await removeOwnedStoredFileIfUnreferenced(value,req.user._id);res.json({ok:result.removed,removed:result.removed,referenced:result.referenced});});
export default r;
