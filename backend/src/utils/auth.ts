import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { VerificationToken } from '../models/index.js';
import { sendCodeEmail } from '../services/email.js';

export function signToken(user: any, deviceBypass = false) { return jwt.sign({ sub: String(user._id), email: user.email, deviceId: user.deviceId || '', deviceBypass }, env.JWT_SECRET, { expiresIn: '7d' }); }
export function verifyJwt(token: string) { return jwt.verify(token, env.JWT_SECRET) as { sub: string, email: string, deviceId?: string, deviceBypass?: boolean }; }
export async function hashPassword(p: string) { return bcrypt.hash(p, 12); }
export async function comparePassword(p: string, h: string) { return bcrypt.compare(p, h); }
export async function createOtp(user: any, purpose: 'SIGNUP'|'PASSWORD_RESET'|'DEVICE_CHANGE', metadata: any = {}) {
  await VerificationToken.deleteMany({ email: user.email, purpose, consumedAt: { $exists: false } });
  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = await bcrypt.hash(code, 10);
  const rec = await VerificationToken.create({ userId: user._id, email: user.email, purpose, codeHash, metadata, expiresAt: new Date(Date.now()+10*60*1000) });
  try{
    const sent=await sendCodeEmail(user.email, code, purpose);
    if(purpose==='DEVICE_CHANGE'){rec.metadata={...metadata,emailSent:!!sent};rec.markModified('metadata');await rec.save()}
  }catch(error){
    if(purpose!=='DEVICE_CHANGE')throw error;
    // Keep approval on the registered phone available when email delivery fails.
    console.warn('Device verification email could not be delivered');
    rec.metadata={...metadata,emailSent:false};rec.markModified('metadata');await rec.save();
  }
  return rec;
}
export async function consumeOtp(email: string, purpose: string, code: string, match:Record<string,unknown>={}) {
  const query={...match,email:email.toLowerCase(),purpose,consumedAt:{$exists:false},expiresAt:{$gt:new Date()},attempts:{$lt:5}};
  const rec = await VerificationToken.findOne(query).sort({ createdAt: -1 });
  if (!rec) return null;
  if (rec.attempts >= 5) return null;
  const ok = await bcrypt.compare(code, rec.codeHash);
  if (!ok) { await VerificationToken.updateOne({...query,_id:rec._id},{$inc:{attempts:1}});return null; }
  // A successful code can be claimed once, even when two requests arrive together.
  return VerificationToken.findOneAndUpdate({...query,_id:rec._id},{$set:{consumedAt:new Date()}},{new:true});
}
