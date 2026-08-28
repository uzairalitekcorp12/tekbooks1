import { env } from '../config/env.js';

console.log(`Environment configuration is valid (${env.NODE_ENV}, ${env.STORAGE_DRIVER} storage).`);
