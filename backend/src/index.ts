import { app } from './app.js';
import { databaseConnectionMessage } from './config/db.js';
import { ensureRuntimeReady } from './config/runtime.js';
import { env } from './config/env.js';

// Vercel detects this default Express export and owns the HTTP listener there.
// Local/Docker/Render execution still starts the normal long-lived listener.
if (!env.IS_SERVERLESS) {
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`TekBooks API listening on http://0.0.0.0:${env.PORT}`);
  });
  // Keep liveness available while a local MongoDB service starts or a remote
  // dependency recovers. Readiness and API routes retry initialization.
  void ensureRuntimeReady()
    .then(() => console.log('TekBooks API dependencies are ready'))
    .catch(error => {
      console.error(`Startup dependency warning: ${databaseConnectionMessage(error)}`);
      console.error('The API remains online: /health is available and /ready returns 503 until dependencies recover.');
    });
}

export default app;
