import {
  completePresignedUpload,
  createPresignedDownloadUrl,
  createPresignedUpload,
  removeStoredFile
} from '../services/storage.js';

// A 1x1 transparent PNG. The object is owner-scoped, verified through the
// production upload path, downloaded for a byte comparison, and always removed.
const contents = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const ownerId = 'storage-roundtrip-check';
let uploadedKey = '';

try {
  const upload = await createPresignedUpload({
    ownerId,
    name: 'storage-roundtrip.png',
    mimeType: 'image/png',
    size: contents.length
  });
  if (!upload) throw new Error('S3 direct uploads are not enabled.');
  uploadedKey = upload.attachment.key;

  const put = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.headers,
    body: contents
  });
  if (!put.ok) throw new Error(`S3 upload failed with HTTP ${put.status}.`);

  const attachment = await completePresignedUpload(upload.attachment, ownerId);
  const downloadUrl = await createPresignedDownloadUrl(attachment, attachment.name, true);
  if (!downloadUrl) throw new Error('S3 download URL was not created.');

  const download = await fetch(downloadUrl);
  if (!download.ok) throw new Error(`S3 download failed with HTTP ${download.status}.`);
  const downloaded = Buffer.from(await download.arrayBuffer());
  if (!downloaded.equals(contents)) throw new Error('Downloaded attachment bytes do not match the upload.');

  console.log('Storage upload, verification, download, and cleanup check passed.');
} catch (error: any) {
  console.error('Storage round-trip check failed:', error?.message || error);
  process.exitCode = 1;
} finally {
  if (uploadedKey) {
    const removed = await removeStoredFile(uploadedKey).catch(() => false);
    if (!removed) {
      console.error('Storage round-trip cleanup failed.');
      process.exitCode = 1;
    }
  }
}
