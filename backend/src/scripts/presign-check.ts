// Offline smoke test: signing is local cryptography and makes no AWS network request.
process.env.NODE_ENV = 'development';
process.env.STORAGE_DRIVER = 's3';
process.env.S3_REGION = 'us-east-1';
process.env.S3_BUCKET = 'tekbooks-test-bucket';
process.env.S3_ACCESS_KEY_ID = 'TESTACCESSKEY1234';
process.env.S3_SECRET_ACCESS_KEY = 'TESTSECRETKEY1234567890';

const storage = await import('../services/storage.js');
const ownerId = '507f1f77bcf86cd799439011';
const upload = await storage.createPresignedUpload({
  ownerId,
  name: 'receipt.pdf',
  mimeType: 'application/pdf',
  size: 1024
});
if (!upload) throw new Error('S3 presigned upload was not created.');

const putUrl = new URL(upload.uploadUrl);
const downloadUrl = new URL(await storage.createPresignedDownloadUrl(upload.attachment, 'receipt.pdf', true));
const checks = {
  direct: upload.direct,
  putMethod: upload.method === 'PUT',
  ownerScoped: upload.attachment.key.startsWith(`users/${ownerId}/`),
  putExpires: putUrl.searchParams.has('X-Amz-Expires'),
  metadataBound: putUrl.searchParams.has('x-amz-meta-owner'),
  expectedSizeBound: putUrl.searchParams.get('x-amz-meta-expectedsize') === '1024',
  downloadSigned: downloadUrl.searchParams.has('X-Amz-Signature')
};
if (Object.values(checks).some(value => !value)) throw new Error(`Presigned storage smoke test failed: ${JSON.stringify(checks)}`);
console.log('Presigned S3 upload/download smoke test passed.');
