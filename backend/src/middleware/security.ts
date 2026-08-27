import rateLimit from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import { IdempotencyRecord } from '../models/index.js';

export const globalLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false });
export const authLimiter = rateLimit({ windowMs: 15*60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
export const sensitiveLimiter = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false });

export async function idempotency(req: Request, res: Response, next: NextFunction) {
  if (!['POST','PUT','PATCH'].includes(req.method)) return next();
  const key = req.header('Idempotency-Key');
  if (!key || !req.user) return next();
  if (key.length > 160) return res.status(400).json({ message:'Idempotency-Key is too long' });
  const userId=String(req.user._id), route=`${req.method}:${req.baseUrl}${req.path}`;
  try {
    await IdempotencyRecord.create({ userId,key,route,statusCode:0,responseBody:{pending:true},expiresAt:new Date(Date.now()+24*60*60*1000) });
  } catch (e:any) {
    if(e?.code!==11000) throw e;
    const existing:any=await IdempotencyRecord.findOne({userId,key,route});
    if(existing?.statusCode===0) return res.status(409).json({ code:'REQUEST_IN_PROGRESS', message:'The same request is already being processed.' });
    if(existing) return res.status(existing.statusCode).json(existing.responseBody);
  }
  const originalJson=res.json.bind(res);
  res.json=((body:any)=>{
    if(res.statusCode<500){IdempotencyRecord.updateOne({userId,key,route},{$set:{statusCode:res.statusCode,responseBody:body}}).catch(()=>{});}
    else {IdempotencyRecord.deleteOne({userId,key,route}).catch(()=>{});}
    return originalJson(body);
  }) as any;
  next();
}
