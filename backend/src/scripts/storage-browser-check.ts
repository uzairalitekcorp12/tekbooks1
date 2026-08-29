import {createPresignedUpload} from '../services/storage.js';

const origin = process.argv.find(value => value.startsWith('--origin='))?.slice('--origin='.length) || 'http://localhost:8081';
const upload = await createPresignedUpload({
  ownerId: 'browser-cors-check',
  name: 'cors-check.png',
  mimeType: 'image/png',
  size: 68
});

if (!upload) {
  console.log('Browser storage CORS check is not required for local storage.');
  process.exit(0);
}

try {
  const response = await fetch(upload.uploadUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  const allowedOrigin = response.headers.get('access-control-allow-origin') || '';
  const allowedMethods = response.headers.get('access-control-allow-methods') || '';
  if (!response.ok || !['*', origin].includes(allowedOrigin) || !allowedMethods.split(',').map(value => value.trim()).includes('PUT')) {
    throw new Error(`S3 browser preflight failed (HTTP ${response.status}, origin=${allowedOrigin || 'missing'}, methods=${allowedMethods || 'missing'}).`);
  }
  console.log(`PASS S3 browser upload preflight (${origin} -> HTTP ${response.status}, origin ${allowedOrigin})`);
} catch (error: any) {
  console.error('FAIL S3 browser upload preflight:', error?.message || error);
  process.exit(1);
}
