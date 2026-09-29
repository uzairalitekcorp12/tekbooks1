import 'dotenv/config';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

const sourceUri=process.env.MONGODB_URI?.trim();
const targetUri=process.env.MONGO_NEW_URI?.trim();
const databaseName=(process.env.MONGODB_DB_NAME||'tekbooks').trim();
const activate=process.argv.includes('--activate');

if(!sourceUri)throw new Error('MONGODB_URI is required.');
if(!targetUri)throw new Error('MONGO_NEW_URI is required.');
if(sourceUri===targetUri)throw new Error('Source and destination MongoDB URIs must be different.');

const source=mongoose.createConnection(sourceUri,{dbName:databaseName,serverSelectionTimeoutMS:15_000});
const target=mongoose.createConnection(targetUri,{dbName:databaseName,serverSelectionTimeoutMS:15_000});

type IndexDefinition={name?:string;key?:Record<string,unknown>;[key:string]:unknown};

function indexOptions(index:IndexDefinition){
  const ignored=new Set(['v','key','ns']);
  return Object.fromEntries(Object.entries(index).filter(([key])=>!ignored.has(key)));
}

async function activateTarget(){
  const envPath=path.resolve(process.cwd(),'.env');
  const text=await readFile(envPath,'utf8');
  const newline=text.includes('\r\n')?'\r\n':'\n';
  const lines=text.split(/\r?\n/);
  let replaced=false;
  const next:string[]=[];
  for(const line of lines){
    if(/^\s*MONGODB_URI\s*=/.test(line)){
      next.push(`MONGODB_URI=${targetUri}`);
      replaced=true;
      continue;
    }
    if(/^\s*MONGO_NEW_URI\s*=/.test(line))continue;
    next.push(line);
  }
  if(!replaced)next.unshift(`MONGODB_URI=${targetUri}`);
  await writeFile(envPath,next.join(newline),'utf8');
}

try{
  await Promise.all([source.asPromise(),target.asPromise()]);
  if(!source.db||!target.db)throw new Error('MongoDB connections did not expose a database handle.');

  const collections=(await source.db.listCollections({}, {nameOnly:true}).toArray())
    .map(item=>item.name)
    .filter(name=>!name.startsWith('system.'));

  let totalDocuments=0;
  for(const name of collections){
    const sourceCollection=source.db.collection(name);
    const targetCollection=target.db.collection(name);
    const existingCollections=await target.db.listCollections({name},{nameOnly:true}).toArray();
    if(!existingCollections.length)await target.db.createCollection(name);

    const indexes=await sourceCollection.indexes() as IndexDefinition[];
    const targetIndexNames=new Set((await targetCollection.indexes()).map(index=>index.name));
    for(const index of indexes){
      if(index.name==='_id_'||!index.key||targetIndexNames.has(index.name))continue;
      await targetCollection.createIndex(index.key as any,indexOptions(index) as any);
    }

    let copied=0;
    let batch:any[]=[];
    for await(const document of sourceCollection.find({})){
      batch.push({replaceOne:{filter:{_id:document._id},replacement:document,upsert:true}});
      if(batch.length===500){
        await targetCollection.bulkWrite(batch,{ordered:false});
        copied+=batch.length;
        batch=[];
      }
    }
    if(batch.length){
      await targetCollection.bulkWrite(batch,{ordered:false});
      copied+=batch.length;
    }

    const [sourceCount,targetCount]=await Promise.all([
      sourceCollection.countDocuments(),
      targetCollection.countDocuments(),
    ]);
    if(copied!==sourceCount||targetCount<sourceCount){
      throw new Error(`Verification failed for ${name}: expected ${sourceCount}, copied ${copied}, destination has ${targetCount}.`);
    }
    totalDocuments+=copied;
    console.log(`Migrated ${name}: ${copied} document${copied===1?'':'s'}.`);
  }

  if(activate)await activateTarget();
  console.log(`MongoDB migration verified: ${collections.length} collections, ${totalDocuments} documents.${activate?' New URI activated in backend/.env.':''}`);
}finally{
  await Promise.allSettled([source.close(),target.close()]);
}
