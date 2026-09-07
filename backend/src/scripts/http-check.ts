import type {AddressInfo} from 'node:net';
import type {Server} from 'node:http';
import {app} from '../app.js';

const server = await new Promise<Server>((resolve, reject) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  instance.once('error', reject);
});

try {
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/health`);
  const healthBody: any = await health.json();
  if (!health.ok || healthBody?.version !== '1.0.11') throw new Error(`Health route failed (HTTP ${health.status}).`);

  const origin = 'http://localhost:8081';
  const preflight = await fetch(`${base}/api/uploads/presign`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type'
    }
  });
  const allowedOrigin = preflight.headers.get('access-control-allow-origin');
  const allowedHeaders = preflight.headers.get('access-control-allow-headers') || '';
  if (!preflight.ok || allowedOrigin !== origin || !allowedHeaders.toLowerCase().includes('authorization')) {
    throw new Error(`API browser preflight failed (HTTP ${preflight.status}, origin=${allowedOrigin || 'missing'}).`);
  }
  console.log(`PASS API health v${healthBody.version} and browser upload preflight`);
} catch (error: any) {
  console.error('FAIL HTTP check:', error?.message || error);
  process.exitCode = 1;
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
