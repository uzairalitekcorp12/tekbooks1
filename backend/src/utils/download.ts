import type { Response } from 'express';
import {
  cleanupGeneratedDownloads,
  createPresignedDownloadUrl,
  storeGeneratedDownload,
  usesS3Storage
} from '../services/storage.js';

function cleanFilename(value: string) {
  const clean = String(value || 'download')
    .normalize('NFKC')
    .replace(/[\r\n"\\/<>:|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return clean || 'download';
}

function asciiFilename(value: string) {
  return cleanFilename(value)
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/[%']/g, '-') || 'download';
}

export function contentDisposition(filename: string) {
  const clean = cleanFilename(filename);
  const ascii = asciiFilename(clean);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

/**
 * Send locally, or use private S3 + a signed redirect in cloud-backed mode so
 * large PDF/XLSX responses do not cross Vercel's function body limit.
 */
export async function sendDownload(res: Response, buffer: Buffer, contentType: string, filename: string, ownerId?: unknown) {
  if (ownerId && usesS3Storage()) {
    await cleanupGeneratedDownloads(ownerId).catch(error => console.warn('Generated export cleanup failed:', error?.message || error));
    const stored = await storeGeneratedDownload(buffer, ownerId, filename, contentType);
    const url = await createPresignedDownloadUrl(stored, filename, false);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.redirect(302, url);
  }
  res.status(200);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Content-Disposition', contentDisposition(filename));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, no-transform');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(buffer);
}
