import {copyFileSync,existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const scriptsDirectory=dirname(fileURLToPath(import.meta.url));
const repositoryRoot=resolve(scriptsDirectory,'..');
const templatePath=resolve(repositoryRoot,'mobile','.env.example');
const environmentPath=resolve(repositoryRoot,'mobile','.env');
const force=process.argv.includes('--force');

if(!existsSync(templatePath)){
  console.error('Missing mobile/.env.example template.');
  process.exit(1);
}

if(!existsSync(environmentPath)||force){
  copyFileSync(templatePath,environmentPath);
  console.log(`${force?'Recreated':'Created'} mobile/.env from mobile/.env.example.`);
}else{
  console.log('mobile/.env already exists; it was not overwritten. Use --force to recreate it from the template.');
}

const values=Object.fromEntries(readFileSync(environmentPath,'utf8').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const index=line.indexOf('=');return[line.slice(0,index).trim(),line.slice(index+1).trim()]}));
const apiUrl=values.EXPO_PUBLIC_API_URL||'';
let parsedApi;
try{parsedApi=new URL(apiUrl)}catch{}

const problems=[];
if(!parsedApi||parsedApi.protocol!=='https:'||!parsedApi.pathname.replace(/\/$/,'').endsWith('/api'))problems.push('EXPO_PUBLIC_API_URL must be an HTTPS URL ending in /api.');
if(values.EXPO_PUBLIC_AUTO_LAN!=='false')problems.push('EXPO_PUBLIC_AUTO_LAN must be false for Vercel/APK mode.');
if(values.EXPO_PUBLIC_PROXY_API_THROUGH_METRO!=='false')problems.push('EXPO_PUBLIC_PROXY_API_THROUGH_METRO must be false for Vercel/APK mode.');

if(problems.length){
  console.error(`mobile/.env is incomplete:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

console.log(`Mobile environment is ready (${parsedApi.origin}/api).`);
