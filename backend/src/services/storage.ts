import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

const s3 = env.STORAGE_DRIVER === 's3' ? new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: env.S3_ACCESS_KEY_ID ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined
}) : null;

function safeExt(name: string) {
  const e = path.extname(name).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(e) ? e : '';
}

function normalizedKey(rawValue: string) {
  const raw = rawValue.replace(/^\/+/, '').replace(/^uploads\//, '');
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) return '';
  return normalized;
}

/** Resolve a TekBooks-owned storage key from a stored key, legacy URL or signed media URL. */
export function storedKey(value: unknown) {
  let raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw, 'http://tekbooks.local');
    if (parsed.pathname === '/media') return normalizedKey(parsed.searchParams.get('key') || '');
    if (parsed.pathname.startsWith('/uploads/')) return normalizedKey(decodeURIComponent(parsed.pathname.slice('/uploads/'.length)));
  } catch {}

  const directBase = env.S3_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (directBase && raw.startsWith(`${directBase}/`)) raw = raw.slice(directBase.length + 1);
  if (/^https?:\/\//i.test(raw)) return '';
  return normalizedKey(raw);
}

function signatureFor(key: string) {
  return crypto.createHmac('sha256', env.MEDIA_SIGNING_SECRET).update(key).digest('hex');
}

export function isOwnedStorageKey(value: unknown, ownerId: unknown) {
  const key = storedKey(value);
  const prefix = env.STORAGE_KEY_PREFIX.replace(/^\/+|\/+$/g, '') || 'users';
  const owner = String(ownerId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return !!key && !!owner && key.startsWith(`${prefix}/${owner}/`);
}

export function signedMediaUrl(key: string) {
  const safe = normalizedKey(key);
  if (!safe) return '';
  return `/media?key=${encodeURIComponent(safe)}&sig=${signatureFor(safe)}`;
}

export function verifyMediaSignature(key: string, signature: string) {
  const safe = normalizedKey(key);
  if (!safe || !signature) return false;
  const expected = signatureFor(safe);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function storageKey(ownerId: unknown, originalName: string) {
  const owner = String(ownerId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  const prefix = env.STORAGE_KEY_PREFIX.replace(/^\/+|\/+$/g, '') || 'users';
  return `${prefix}/${owner}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${safeExt(originalName)}`;
}

export async function storeFile(file: Express.Multer.File, ownerId: unknown) {
  const key = storageKey(ownerId, file.originalname);
  if (env.STORAGE_DRIVER === 's3') {
    if (!s3) throw new Error('S3 client is not configured');
    await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    const directBase = env.S3_PUBLIC_BASE_URL.replace(/\/$/, '');
    const url = env.STORAGE_PUBLIC_MODE === 'direct' && directBase ? `${directBase}/${key}` : signedMediaUrl(key);
    return { key, url, name: file.originalname, mimeType: file.mimetype, size: file.size };
  }
  const root = path.resolve(env.UPLOAD_DIR);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid local upload path');
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, file.buffer);
  return { key, url: signedMediaUrl(key), name: file.originalname, mimeType: file.mimetype, size: file.size };
}

function mimeFromKey(key: string) {
  const ext = path.extname(key).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export async function readStoredFile(value: unknown) {
  const key = storedKey(value);
  if (!key) return null;
  if (env.STORAGE_DRIVER === 's3') {
    if (!s3) return null;
    const out = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!out.Body) return null;
    const bytes = await out.Body.transformToByteArray();
    return { key, buffer: Buffer.from(bytes), contentType: out.ContentType || mimeFromKey(key), size: Number(out.ContentLength || bytes.length) };
  }
  const root = path.resolve(env.UPLOAD_DIR);
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  try {
    const buffer = await fs.readFile(full);
    return { key, buffer, contentType: mimeFromKey(key), size: buffer.length };
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

/** Best-effort cleanup for a TekBooks-owned stored attachment or media URL. */
export async function removeStoredFile(attachment: any) {
  const key = storedKey(attachment?.key || attachment?.url || attachment);
  if (!key) return false;

  if (env.STORAGE_DRIVER === 's3') {
    if (!s3) return false;
    await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return true;
  }

  const root = path.resolve(env.UPLOAD_DIR);
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) return false;
  try {
    await fs.unlink(full);
    return true;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function ensureStorageReady(createIfMissing = env.STORAGE_AUTO_CREATE_BUCKET) {
  if (env.STORAGE_DRIVER === 'local') {
    await fs.mkdir(path.resolve(env.UPLOAD_DIR), { recursive: true });
    return { driver: 'local', ready: true, location: path.resolve(env.UPLOAD_DIR), created: false };
  }
  if (!s3) throw new Error('S3 client is not configured');
  if (!env.S3_BUCKET) throw new Error('S3 storage requires S3_BUCKET');
  if (env.S3_ENDPOINT && (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) throw new Error('S3-compatible custom endpoints require S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return { driver: 's3', ready: true, bucket: env.S3_BUCKET, created: false };
  } catch (error: any) {
    if (!createIfMissing) throw new Error(`Storage bucket "${env.S3_BUCKET}" is unavailable. Check the bucket name, endpoint, region and IAM/R2 permissions.`);
    const create: any = { Bucket: env.S3_BUCKET };
    const customEndpoint = !!env.S3_ENDPOINT;
    if (!customEndpoint && env.S3_REGION && env.S3_REGION !== 'us-east-1' && env.S3_REGION !== 'auto') create.CreateBucketConfiguration = { LocationConstraint: env.S3_REGION };
    await s3.send(new CreateBucketCommand(create));
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return { driver: 's3', ready: true, bucket: env.S3_BUCKET, created: true };
  }
}
