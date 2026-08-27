import mongoose from 'mongoose';
import { env } from './env.js';
let connected = false;
export async function connectDb() {
  if (connected || mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
  connected = true;
  console.log('MongoDB connected');
}
