import { app } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import {ensureStorageReady} from './services/storage.js';
await connectDb();
if(env.STORAGE_VALIDATE_ON_STARTUP){const storage=await ensureStorageReady(env.STORAGE_AUTO_CREATE_BUCKET);console.log(`Storage ready (${storage.driver}${'bucket' in storage?`: ${storage.bucket}`:''})`)}
app.listen(env.PORT,'0.0.0.0',()=>console.log(`TekBooks API running on http://localhost:${env.PORT}`));
