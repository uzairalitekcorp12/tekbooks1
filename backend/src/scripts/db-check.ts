import mongoose from 'mongoose';
import {connectDb,databaseConnectionMessage} from '../config/db.js';
try{await connectDb();await mongoose.connection.db?.admin().ping();console.log('MongoDB check passed');await mongoose.disconnect()}catch(error:any){console.error(`MongoDB check failed: ${databaseConnectionMessage(error)}`);process.exit(1)}
