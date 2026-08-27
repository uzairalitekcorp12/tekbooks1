import {ensureStorageReady} from '../services/storage.js';
try{const result=await ensureStorageReady(false);console.log('Storage check passed:',result)}catch(error:any){console.error('Storage check failed:',error?.message||error);process.exit(1)}
