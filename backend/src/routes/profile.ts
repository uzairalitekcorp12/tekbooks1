import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {removeStoredFile} from '../services/storage.js';
const r=Router();r.use(requireAuth);
r.get('/',(req,res)=>res.json({id:String(req.user._id),name:req.user.name,email:req.user.email,profilePictureUrl:req.user.profilePictureUrl,business:req.user.business,deviceLabel:req.user.deviceLabel}));
r.put('/',async(req,res)=>{
  const p=z.object({name:z.string().min(2).max(80).optional(),profilePictureUrl:z.string().optional(),expoPushToken:z.string().optional(),business:z.object({name:z.string().optional(),legalName:z.string().optional(),logoUrl:z.string().optional(),trn:z.string().optional(),vatPercent:z.coerce.number().min(0).max(100).optional(),email:z.string().email().or(z.literal('')).optional(),phone:z.string().optional(),address:z.string().optional(),currency:z.string().max(5).optional()}).optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({message:'Profile details are invalid.',issues:p.error.flatten()});
  const previousProfile=String(req.user.profilePictureUrl||'');const previousLogo=String(req.user.business?.logoUrl||'');
  if(p.data.name)req.user.name=p.data.name;if(p.data.profilePictureUrl!==undefined)req.user.profilePictureUrl=p.data.profilePictureUrl;if(p.data.expoPushToken!==undefined)req.user.expoPushToken=p.data.expoPushToken;if(p.data.business)req.user.business={...req.user.business?.toObject?.(),...p.data.business};
  await req.user.save();
  const currentProfile=String(req.user.profilePictureUrl||''),currentLogo=String(req.user.business?.logoUrl||'');
  if(previousProfile&&previousProfile!==currentProfile)removeStoredFile(previousProfile).catch(error=>console.warn('Old profile image cleanup failed:',error?.message||error));
  if(previousLogo&&previousLogo!==currentLogo)removeStoredFile(previousLogo).catch(error=>console.warn('Old company logo cleanup failed:',error?.message||error));
  res.json({name:req.user.name,email:req.user.email,profilePictureUrl:req.user.profilePictureUrl,business:req.user.business,deviceLabel:req.user.deviceLabel});
});
export default r;
