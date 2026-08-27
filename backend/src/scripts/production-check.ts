import mongoose from 'mongoose';
import {env} from '../config/env.js';
import {connectDb} from '../config/db.js';
import {ensureStorageReady} from '../services/storage.js';
const warnings:string[]=[];
if(env.NODE_ENV!=='production')warnings.push('NODE_ENV is not production');
if(env.ALLOW_EXPO_GO_DEVICE_BYPASS)warnings.push('ALLOW_EXPO_GO_DEVICE_BYPASS should be false in production');
if(env.JWT_SECRET.includes('dev-only'))warnings.push('JWT_SECRET still uses the development value');
if(!env.RESEND_API_KEY)warnings.push('RESEND_API_KEY is empty');
try{await connectDb();await mongoose.connection.db?.admin().ping();console.log('✓ MongoDB ready')}catch(error:any){console.error('✗ MongoDB:',error?.message||error);process.exitCode=1}
try{const result=await ensureStorageReady(false);console.log(`✓ Storage ready (${result.driver})`)}catch(error:any){console.error('✗ Storage:',error?.message||error);process.exitCode=1}
for(const warning of warnings)console.warn(`! ${warning}`);
await mongoose.disconnect().catch(()=>{});
if(process.exitCode)process.exit(process.exitCode);
console.log(warnings.length?'Production infrastructure is reachable, but review warnings above.':'Production check passed.');
