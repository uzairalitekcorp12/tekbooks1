import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../utils/auth.js';
import { User } from '../models/index.js';
import { env } from '../config/env.js';

declare global { namespace Express { interface Request { user?: any } } }
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = verifyJwt(token);
    const user = await User.findById(payload.sub);
    if (!user || user.approvalStatus !== 'APPROVED') return res.status(401).json({ message: 'Account unavailable' });
    const bypassAllowed = env.NODE_ENV !== 'production' && env.ALLOW_EXPO_GO_DEVICE_BYPASS && payload.deviceBypass === true;
    if (!bypassAllowed && (payload.deviceId || '') !== (user.deviceId || '')) return res.status(401).json({ code:'DEVICE_SESSION_REVOKED', message:'This session is no longer authorized for the active device' });
    req.user = user; next();
  } catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
}
