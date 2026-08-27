// Cloudflare Workers adapter. Use STORAGE_DRIVER=s3/R2 in Workers; local disk is not persistent.
// This adapter follows Cloudflare's current Express-on-Workers httpServerHandler pattern.
import { httpServerHandler } from 'cloudflare:node';
import { app } from './app.js';
import { connectDb } from './config/db.js';
await connectDb();
app.listen(3000);
export default httpServerHandler({ port: 3000 });
