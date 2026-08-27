import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

const supportedMimeExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
} as const;

export type SupportedUploadMime = keyof typeof supportedMimeExtensions;
export type StoredFileInfo = { key: string; contentType: string; size: number; modifiedAt?: Date };
export type StoredAttachment = StoredFileInfo & { url: string; name: string; mimeType: string };

export class StorageReferenceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'INVALID_STORAGE_REFERENCE') {
    super(message);
    this.name = 'StorageReferenceError';
    this.status = status;
    this.code = code;
  }
}

const s3 = env.STORAGE_DRIVER === 's3' ? new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: env.S3_ACCESS_KEY_ID
    ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
    : undefined
}) : null;

function storagePrefix() {
  return env.STORAGE_KEY_PREFIX.replace(/^\/+|\/+$/g, '') || 'users';
}

function ownerSegment(ownerId: unknown) {
  return String(ownerId || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function attachmentValue(value: unknown) {
  if (value && typeof value === 'object') {
    const item = value as { key?: unknown; url?: unknown };
    return item.key || item.url || '';
  }
  return value;
}

function normalizedKey(rawValue: string) {
  const raw = rawValue.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/^uploads\//, '');
  if (!raw || raw.includes('\0') || /[\u0000-\u001f\u007f]/.test(raw)) return '';
  const parts = raw.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return '';
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) return '';
  return normalized;
}

function localPathForKey(key: string) {
  const root = path.resolve(env.UPLOAD_DIR);
  const full = path.resolve(root, key);
  if (full === root || !full.startsWith(root + path.sep)) return null;
  return { root, full };
}

function isMissingObject(error: any) {
  return error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404 || error?.code === 'ENOENT';
}

function safeDisplayName(value: unknown, fallback: string) {
  const base = path.basename(String(value || '').replace(/[\u0000-\u001f\u007f]/g, '')).trim();
  return (base || fallback).slice(0, 180);
}

function detectedMime(buffer: Buffer): SupportedUploadMime | '' {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, Math.min(buffer.length, 1024)).indexOf(Buffer.from('%PDF-')) >= 0) return 'application/pdf';
  return '';
}

function mimeFromKey(key: string) {
  const ext = path.extname(key).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

/** Resolve a TekBooks storage key from a key, legacy URL, direct URL, or signed media URL. */
export function storedKey(value: unknown) {
  let raw = String(attachmentValue(value) || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw, 'http://tekbooks.local');
    if (parsed.pathname === '/media') return normalizedKey(parsed.searchParams.get('key') || '');
    if (parsed.pathname.startsWith('/uploads/')) return normalizedKey(decodeURIComponent(parsed.pathname.slice('/uploads/'.length)));
  } catch {}

  const directBase = env.S3_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (directBase && raw.startsWith(`${directBase}/`)) raw = decodeURIComponent(raw.slice(directBase.length + 1));
  if (/^https?:\/\//i.test(raw)) return '';
  return normalizedKey(raw);
}

function signatureFor(key: string, expiresAt?: number) {
  const payload = expiresAt ? `${key}\n${expiresAt}` : key;
  return crypto.createHmac('sha256', env.MEDIA_SIGNING_SECRET).update(payload).digest('hex');
}

export function isOwnedStorageKey(value: unknown, ownerId: unknown) {
  const key = storedKey(value);
  const owner = ownerSegment(ownerId);
  return !!key && !!owner && key.startsWith(`${storagePrefix()}/${owner}/`);
}

export function storageOwnerId(value: unknown) {
  const key = storedKey(value);
  const prefix = `${storagePrefix()}/`;
  if (!key.startsWith(prefix)) return '';
  return key.slice(prefix.length).split('/')[0] || '';
}

export function signedMediaUrl(key: string, expiresAt = Math.floor(Date.now() / 1000) + env.MEDIA_URL_TTL_SECONDS) {
  const safe = normalizedKey(key);
  if (!safe) return '';
  return `/media?key=${encodeURIComponent(safe)}&exp=${expiresAt}&sig=${signatureFor(safe, expiresAt)}`;
}

export function storageUrl(key: string) {
  const safe = normalizedKey(key);
  if (!safe) return '';
  const directBase = env.S3_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (env.STORAGE_DRIVER === 's3' && env.STORAGE_PUBLIC_MODE === 'direct' && directBase) {
    const encoded = safe.split('/').map(encodeURIComponent).join('/');
    return `${directBase}/${encoded}`;
  }
  return signedMediaUrl(safe);
}

export function verifyMediaSignature(key: string, signature: string, rawExpiresAt?: unknown) {
  const safe = normalizedKey(key);
  if (!safe || !signature) return false;
  let expectedSignature = '';
  if (rawExpiresAt !== undefined && rawExpiresAt !== null && String(rawExpiresAt) !== '') {
    const expiresAt = Number(rawExpiresAt);
    if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
    expectedSignature = signatureFor(safe, expiresAt);
  } else {
    if (!env.MEDIA_ALLOW_LEGACY_SIGNATURES) return false;
    expectedSignature = signatureFor(safe);
  }
  const expected = Buffer.from(expectedSignature, 'utf8');
  const actual = Buffer.from(String(signature), 'utf8');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Renew a persisted owned URL without trusting the URL or signature supplied by the client/database. */
export function refreshedOwnedStorageUrl(value: unknown, ownerId: unknown) {
  if (!value) return '';
  const key = storedKey(value);
  return key && isOwnedStorageKey(key, ownerId) ? storageUrl(key) : '';
}

export function refreshedOwnedAttachment(value: any, ownerId: unknown) {
  if (!value) return value;
  const key = storedKey(value);
  if (!key || !isOwnedStorageKey(key, ownerId)) return undefined;
  return { ...value, key, url: storageUrl(key) };
}

function storageKey(ownerId: unknown, mimeType: SupportedUploadMime) {
  const owner = ownerSegment(ownerId);
  if (!owner) throw new StorageReferenceError('The upload has no valid workspace owner.');
  return `${storagePrefix()}/${owner}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${supportedMimeExtensions[mimeType]}`;
}

export async function storeFile(file: Express.Multer.File, ownerId: unknown): Promise<StoredAttachment> {
  const mimeType = detectedMime(file.buffer);
  if (!mimeType) {
    throw new StorageReferenceError('The selected file is not a valid JPEG, PNG, WebP, or PDF document.', 415, 'UNSUPPORTED_UPLOAD');
  }
  const key = storageKey(ownerId, mimeType);
  const name = safeDisplayName(file.originalname, `attachment${supportedMimeExtensions[mimeType]}`);
  if (env.STORAGE_DRIVER === 's3') {
    if (!s3) throw new Error('S3 client is not configured');
    await s3.send(new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: mimeType,
      Metadata: { owner: ownerSegment(ownerId) }
    }));
    return { key, url: storageUrl(key), name, mimeType, contentType: mimeType, size: file.buffer.length };
  }
  const target = localPathForKey(key);
  if (!target) throw new Error('Invalid local upload path');
  await fs.mkdir(path.dirname(target.full), { recursive: true, mode: 0o700 });
  await fs.writeFile(target.full, file.buffer, { flag: 'wx', mode: 0o600 });
  return { key, url: storageUrl(key), name, mimeType, contentType: mimeType, size: file.buffer.length };
}

export async function statStoredFile(value: unknown): Promise<StoredFileInfo | null> {
  const key = storedKey(value);
  if (!key) return null;
  if (env.STORAGE_DRIVER === 's3') {
    if (!s3) return null;
    try {
      const out = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return { key, contentType: out.ContentType || mimeFromKey(key), size: Number(out.ContentLength || 0), modifiedAt: out.LastModified };
    } catch (error: any) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }
  const target = localPathForKey(key);
  if (!target) return null;
  try {
    const stat = await fs.stat(target.full);
    if (!stat.isFile()) return null;
    return { key, contentType: mimeFromKey(key), size: stat.size, modifiedAt: stat.mtime };
  } catch (error: any) {
    if (isMissingObject(error)) return null;
    throw error;
  }
}

export async function readStoredFile(value: unknown) {
  const key = storedKey(value);
  if (!key) return null;
  if (env.STORAGE_DRIVER === 's3') {
    if (!s3) return null;
    try {
      const out = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      return { key, buffer: Buffer.from(bytes), contentType: out.ContentType || mimeFromKey(key), size: Number(out.ContentLength || bytes.length) };
    } catch (error: any) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }
  const target = localPathForKey(key);
  if (!target) return null;
  try {
    const [realRoot, realFile] = await Promise.all([fs.realpath(target.root), fs.realpath(target.full)]);
    if (!realFile.startsWith(realRoot + path.sep)) return null;
    const buffer = await fs.readFile(realFile);
    return { key, buffer, contentType: mimeFromKey(key), size: buffer.length };
  } catch (error: any) {
    if (isMissingObject(error)) return null;
    throw error;
  }
}

export async function normalizeOwnedAttachment(value: any, ownerId: unknown, allowedTypes?: readonly string[]): Promise<StoredAttachment> {
  if (!isOwnedStorageKey(value, ownerId)) {
    throw new StorageReferenceError('This uploaded file does not belong to the current workspace.', 403, 'UPLOAD_OWNER_MISMATCH');
  }
  const file = await statStoredFile(value);
  if (!file) throw new StorageReferenceError('The uploaded file is missing. Choose the file again.', 400, 'UPLOAD_MISSING');
  if (allowedTypes && !allowedTypes.includes(file.contentType)) {
    throw new StorageReferenceError('Choose a supported file type for this field.', 415, 'UNSUPPORTED_UPLOAD');
  }
  const fallback = `attachment${supportedMimeExtensions[file.contentType as SupportedUploadMime] || ''}`;
  return {
    ...file,
    url: storageUrl(file.key),
    name: safeDisplayName(value?.name, fallback),
    mimeType: file.contentType
  };
}

export async function normalizeOwnedAssetUrl(value: unknown, ownerId: unknown, allowedTypes: readonly string[]) {
  if (!value) return '';
  const normalized = await normalizeOwnedAttachment({ url: value }, ownerId, allowedTypes);
  return normalized.url;
}

export function sameStoredFile(a: unknown, b: unknown) {
  const first = storedKey(a);
  const second = storedKey(b);
  return !!first && first === second;
}

/** Raw deletion primitive. HTTP routes must first verify ownership and references. */
export async function removeStoredFile(value: unknown) {
  const key = storedKey(value);
  if (!key) return false;

  if (env.STORAGE_DRIVER === 's3') {
    if (!s3) return false;
    await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return true;
  }

  const target = localPathForKey(key);
  if (!target) return false;
  try {
    await fs.unlink(target.full);
    let directory = path.dirname(target.full);
    while (directory.startsWith(target.root + path.sep)) {
      try { await fs.rmdir(directory); } catch { break; }
      directory = path.dirname(directory);
    }
    return true;
  } catch (error: any) {
    if (isMissingObject(error)) return false;
    throw error;
  }
}

export async function listStoredFiles(): Promise<StoredFileInfo[]> {
  if (env.STORAGE_DRIVER === 's3') {
    if (!s3) return [];
    const files: StoredFileInfo[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await s3.send(new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: `${storagePrefix()}/`,
        ContinuationToken: continuationToken
      }));
      for (const item of page.Contents || []) {
        if (item.Key) files.push({ key: item.Key, contentType: mimeFromKey(item.Key), size: Number(item.Size || 0), modifiedAt: item.LastModified });
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return files;
  }

  const root = path.resolve(env.UPLOAD_DIR);
  const files: StoredFileInfo[] = [];
  async function walk(directory: string) {
    let entries: any[];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch (error: any) { if (isMissingObject(error)) return; throw error; }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        const stat = await fs.stat(full);
        const key = path.relative(root, full).split(path.sep).join('/');
        files.push({ key, contentType: mimeFromKey(key), size: stat.size, modifiedAt: stat.mtime });
      }
    }
  }
  await walk(root);
  return files;
}

export async function ensureStorageReady(createIfMissing = env.STORAGE_AUTO_CREATE_BUCKET) {
  if (env.STORAGE_DRIVER === 'local') {
    const location = path.resolve(env.UPLOAD_DIR);
    await fs.mkdir(location, { recursive: true, mode: 0o700 });
    return { driver: 'local', ready: true, location, created: false } as const;
  }
  if (!s3) throw new Error('S3 client is not configured');
  if (!env.S3_BUCKET) throw new Error('S3 storage requires S3_BUCKET');
  if (!!env.S3_ACCESS_KEY_ID !== !!env.S3_SECRET_ACCESS_KEY) throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together');
  if (env.S3_ENDPOINT && (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) throw new Error('S3-compatible custom endpoints require S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
  if (env.STORAGE_PUBLIC_MODE === 'direct' && !env.S3_PUBLIC_BASE_URL) throw new Error('Direct storage mode requires S3_PUBLIC_BASE_URL');
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return { driver: 's3', ready: true, bucket: env.S3_BUCKET, created: false } as const;
  } catch (error: any) {
    if (!createIfMissing) throw new Error(`Storage bucket "${env.S3_BUCKET}" is unavailable. Check the bucket name, endpoint, region and IAM/R2 permissions. (${error?.name || 'storage error'})`);
    const create: any = { Bucket: env.S3_BUCKET };
    const customEndpoint = !!env.S3_ENDPOINT;
    if (!customEndpoint && env.S3_REGION && env.S3_REGION !== 'us-east-1' && env.S3_REGION !== 'auto') create.CreateBucketConfiguration = { LocationConstraint: env.S3_REGION };
    await s3.send(new CreateBucketCommand(create));
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return { driver: 's3', ready: true, bucket: env.S3_BUCKET, created: true } as const;
  }
}
