import {ensureStorageCors,ensureStorageReady} from '../services/storage.js';
try{const storage=await ensureStorageReady(true);const cors=await ensureStorageCors();console.log('Storage setup complete:',{storage,cors})}catch(error:any){console.error('Storage setup failed:',error?.message||error);process.exit(1)}
