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
  await sendCodeEmail(user.email, code, purpose);
  return rec;
}
export async function consumeOtp(email: string, purpose: string, code: string) {
  const rec = await VerificationToken.findOne({ email: email.toLowerCase(), purpose, consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!rec) return null;
  if (rec.attempts >= 5) return null;
  const ok = await bcrypt.compare(code, rec.codeHash);
  if (!ok) { rec.attempts += 1; await rec.save(); return null; }
  rec.consumedAt = new Date(); await rec.save();
  return rec;
}
