import {ensureStorageReady} from '../services/storage.js';
try{const result=await ensureStorageReady(true);console.log('Storage setup complete:',result)}catch(error:any){console.error('Storage setup failed:',error?.message||error);process.exit(1)}
