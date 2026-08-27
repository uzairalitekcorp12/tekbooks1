import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { User, VerificationToken } from '../models/index.js';
import { authLimiter, sensitiveLimiter } from '../middleware/security.js';
import { comparePassword, consumeOtp, createOtp, hashPassword, signToken } from '../utils/auth.js';
import { env } from '../config/env.js';
import { sendExpoPush } from '../services/push.js';
import { requireAuth } from '../middleware/auth.js';
import { refreshedOwnedStorageUrl } from '../services/storage.js';

const r = Router();
r.use(authLimiter);

r.post('/signup', async (req, res) => {
  const p = z.object({ name:z.string().min(2).max(80), email:z.string().email(), password:z.string().min(8).max(128), businessName:z.string().min(2).max(120) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message:'Invalid signup details', issues:p.error.flatten() });
  const email = p.data.email.toLowerCase();
  if (await User.exists({ email })) return res.status(409).json({ message:'Email already registered' });
  const user = await User.create({ name:p.data.name, email, passwordHash:await hashPassword(p.data.password), business:{ name:p.data.businessName, email } });
  await createOtp(user, 'SIGNUP');
  res.status(201).json({ message:'Verification code sent', email });
});

r.post('/verify-email', sensitiveLimiter, async (req,res) => {
  const p = z.object({ email:z.string().email(), code:z.string().length(6) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message:'Invalid code' });
  const rec = await consumeOtp(p.data.email, 'SIGNUP', p.data.code);
  if (!rec) return res.status(400).json({ message:'Invalid or expired code' });
  await User.findByIdAndUpdate(rec.userId, { emailVerified:true });
  res.json({ message:'Email verified. Your workspace is now pending approval.', approvalStatus:'PENDING' });
});

r.post('/resend-verification', sensitiveLimiter, async (req,res) => {
  const email = String(req.body?.email || '').toLowerCase();
  const user = await User.findOne({ email });
  if (user && !user.emailVerified) await createOtp(user,'SIGNUP');
  res.json({ message:'If the account is eligible, a code was sent.' });
});

r.post('/login', async (req,res) => {
  const p = z.object({ email:z.string().email(), password:z.string(), deviceId:z.string().min(1), deviceLabel:z.string().optional(), expoGo:z.boolean().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message:'Invalid login request' });
  const user = await User.findOne({ email:p.data.email.toLowerCase() });
  if (!user) return res.status(401).json({ message:'Invalid email or password' });
  if (user.lockedUntil && user.lockedUntil > new Date()) return res.status(429).json({ message:'Account temporarily locked. Try later.' });
  if (!(await comparePassword(p.data.password,user.passwordHash))) {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= 8) user.lockedUntil = new Date(Date.now()+15*60*1000);
    await user.save();
    return res.status(401).json({ message:'Invalid email or password' });
  }
  user.failedLoginCount=0; user.lockedUntil=null;
  if (!user.emailVerified) return res.status(403).json({ code:'EMAIL_NOT_VERIFIED', message:'Verify your email first' });
  if (user.approvalStatus !== 'APPROVED') return res.status(403).json({ code:'PENDING_APPROVAL', message:'Your workspace is pending approval', approvalStatus:user.approvalStatus });

  if (env.NODE_ENV === 'production' && p.data.expoGo) return res.status(403).json({ code:'NATIVE_APP_REQUIRED', message:'For security, this account can only sign in from the installed TekBooks app.' });
  const bypass = env.NODE_ENV !== 'production' && env.ALLOW_EXPO_GO_DEVICE_BYPASS && p.data.expoGo;
  if (!bypass) {
    if (!user.deviceId) {
      user.deviceId=p.data.deviceId; user.deviceLabel=p.data.deviceLabel || 'Android device';
    } else if (user.deviceId !== p.data.deviceId) {
      const challengeSecret = crypto.randomUUID();
      const challenge = await createOtp(user,'DEVICE_CHANGE',{ newDeviceId:p.data.deviceId, newDeviceLabel:p.data.deviceLabel || 'New device', challengeSecret });
      if (user.expoPushToken) await sendExpoPush(user.expoPushToken,'TekBooks login request',`Approve ${p.data.deviceLabel || 'a new device'} or use the email verification code.`,{ challengeId:String(challenge._id), url:'tekbooks://device-requests' });
      return res.status(409).json({ code:'DEVICE_VERIFICATION_REQUIRED', message:'This email is already bound to another device. Approve it on the current phone or use the email code.', challengeId:String(challenge._id), challengeSecret });
    }
  }
  user.lastLoginAt=new Date(); await user.save();
  res.json({ token:signToken(user,bypass), user:safeUser(user), deviceBypassed:bypass });
});

r.post('/device/verify', sensitiveLimiter, async (req,res) => {
  const p = z.object({ email:z.string().email(), code:z.string().length(6), deviceId:z.string().min(1), deviceLabel:z.string().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message:'Invalid request' });
  const user = await User.findOne({ email:p.data.email.toLowerCase(), approvalStatus:'APPROVED' });
  if (!user) return res.status(404).json({ message:'Account not found' });
  const rec = await consumeOtp(user.email,'DEVICE_CHANGE',p.data.code);
  if (!rec || rec.metadata?.newDeviceId !== p.data.deviceId) return res.status(400).json({ message:'Invalid or expired device code' });
  user.deviceId=p.data.deviceId; user.deviceLabel=p.data.deviceLabel || rec.metadata?.newDeviceLabel || 'Android device'; user.lastLoginAt=new Date(); await user.save();
  res.json({ token:signToken(user), user:safeUser(user) });
});


r.get('/device/requests', requireAuth, async (req,res) => {
  const items = await VerificationToken.find({ userId:req.user._id, purpose:'DEVICE_CHANGE', consumedAt:{ $exists:false }, expiresAt:{ $gt:new Date() } }).sort({createdAt:-1}).lean();
  res.json(items.map((x:any)=>({ id:String(x._id), deviceLabel:x.metadata?.newDeviceLabel||'New device', createdAt:x.createdAt })));
});

r.post('/device/approve', requireAuth, sensitiveLimiter, async (req,res) => {
  const rec:any = await VerificationToken.findOne({ _id:req.body?.challengeId, userId:req.user._id, purpose:'DEVICE_CHANGE', consumedAt:{ $exists:false }, expiresAt:{ $gt:new Date() } });
  if(!rec) return res.status(404).json({message:'Device request not found or expired'});
  rec.metadata = { ...(rec.metadata||{}), approvedAt:new Date().toISOString() }; rec.markModified('metadata'); await rec.save();
  res.json({message:'Device approved. The new phone can complete sign-in.'});
});

r.post('/device/status', sensitiveLimiter, async (req,res) => {
  const p=z.object({challengeId:z.string(),challengeSecret:z.string(),deviceId:z.string(),deviceLabel:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({message:'Invalid device request'});
  const rec:any=await VerificationToken.findOne({_id:p.data.challengeId,purpose:'DEVICE_CHANGE',consumedAt:{$exists:false},expiresAt:{$gt:new Date()}});
  if(!rec || rec.metadata?.challengeSecret!==p.data.challengeSecret || rec.metadata?.newDeviceId!==p.data.deviceId) return res.status(400).json({message:'Invalid or expired device request'});
  if(!rec.metadata?.approvedAt) return res.status(202).json({approved:false,message:'Still waiting for approval on the current device'});
  const user=await User.findById(rec.userId);if(!user||user.approvalStatus!=='APPROVED')return res.status(404).json({message:'Account not found'});
  user.deviceId=p.data.deviceId;user.deviceLabel=p.data.deviceLabel||rec.metadata?.newDeviceLabel||'Android device';user.lastLoginAt=new Date();await user.save();rec.consumedAt=new Date();await rec.save();
  res.json({approved:true,token:signToken(user),user:safeUser(user)});
});

r.post('/forgot-password', sensitiveLimiter, async (req,res) => {
  const email=String(req.body?.email || '').toLowerCase(); const user=await User.findOne({email});
  if (user) await createOtp(user,'PASSWORD_RESET');
  res.json({ message:'If that email exists, a reset code was sent.' });
});

r.post('/reset-password', sensitiveLimiter, async (req,res) => {
  const p=z.object({email:z.string().email(),code:z.string().length(6),password:z.string().min(8).max(128)}).safeParse(req.body);
  if(!p.success) return res.status(400).json({message:'Invalid reset request'});
  const rec=await consumeOtp(p.data.email,'PASSWORD_RESET',p.data.code); if(!rec) return res.status(400).json({message:'Invalid or expired reset code'});
  await User.findByIdAndUpdate(rec.userId,{passwordHash:await hashPassword(p.data.password),failedLoginCount:0,lockedUntil:null});
  res.json({message:'Password updated'});
});

function responseAssetUrl(value:any,ownerId:any){const refreshed=refreshedOwnedStorageUrl(value,ownerId);const legacy=String(value||'');return refreshed||(/^https:\/\//i.test(legacy)?legacy:'')}
function safeUser(u:any){const business=u.business?.toObject?.()||u.business||{};return { id:String(u._id), name:u.name,email:u.email,profilePictureUrl:responseAssetUrl(u.profilePictureUrl,u._id),business:{...business,logoUrl:responseAssetUrl(business.logoUrl,u._id)},deviceLabel:u.deviceLabel,approvalStatus:u.approvalStatus }; }
export default r;
