// Controlled regression checks: real HTTP routes and email/auth libraries, isolated
// in-memory records and mocked external delivery. Never changes the configured DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'backend/package.json'));
const ts=require('typescript'),express=require('express'),bcrypt=require('bcryptjs');

function load(relative,mocks={},globals={}){
  const filename=path.join(root,relative),module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const scope={module,exports:module.exports,require:name=>name in mocks?mocks[name]:require(name),console,Buffer,URL,Blob,FormData,Response,AbortController,AbortSignal,setTimeout,clearTimeout,process,...globals};
  // Use the host realm: ExcelJS recognizes arrays and dates with instanceof.
  vm.compileFunction(code,Object.keys(scope),{filename})(...Object.values(scope));
  return module.exports;
}
function fakeClock(){
  let now=0,id=0;const timers=new Map();
  return{setTimeout(fn,ms){timers.set(++id,{fn,at:now+ms});return id},clearTimeout(id){timers.delete(id)},advance(ms){const end=now+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn()}now=end},get count(){return timers.size}};
}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
function mobile(fetchImpl,expoFetch=fetchImpl){
  const clock=fakeClock(),activity=load('mobile/lib/activity.ts',{},clock);
  const api=load('mobile/lib/api.ts',{
    'expo-constants':{},'expo/fetch':{fetch:expoFetch},'expo-file-system':{File:class{}},
    'react-native':{Platform:{OS:'web'}},'@/config/app':{APP_CONFIG:{name:'TekBooks'}},
    './private-storage':{getPrivateItem:async()=>null},'./activity':activity,
  },{...clock,fetch:fetchImpl,__DEV__:false});
  api.setRuntimeAuthToken('session-a');return{clock,activity,api};
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('Loading feedback handles fast, slow, concurrent and completed actions',()=>{
  const clock=fakeClock(),a=load('mobile/lib/activity.ts',{},clock);
  const fast=a.beginActivity('Fast');fast.end();clock.advance(300);assert.equal(a.getActivitySnapshot().count,0);
  const fetch=a.beginActivity('Fetching'),upload=a.beginActivity('Uploading',2);clock.advance(250);
  assert.equal(a.getActivitySnapshot().current.label,'Uploading');assert.equal(a.getActivitySnapshot().count,2);
  clock.advance(10000);assert.equal(a.getActivitySnapshot().current.slow,true);
  upload.update('Finishing');assert.equal(a.getActivitySnapshot().current.label,'Finishing');upload.end();upload.end();
  assert.equal(a.getActivitySnapshot().current.label,'Fetching');fetch.end();assert.equal(a.getActivitySnapshot().count,0);assert.equal(clock.count,0);
});
test('Identical fetches share work, refresh after completion and isolate sessions',async()=>{
  const waiting=[];let calls=0;const m=mobile((url,options)=>{calls++;return new Promise(resolve=>waiting.push({resolve,options}))});
  const first=m.api.api('/dashboard'),second=m.api.api('/dashboard');await flush();assert.equal(calls,1);
  waiting[0].resolve(json({income:42}));assert.equal((await first).income,42);await second;
  const refresh=m.api.api('/dashboard');await flush();assert.equal(calls,2);
  m.api.setRuntimeAuthToken('session-b');const other=m.api.api('/dashboard');await flush();assert.equal(calls,3);
  assert.equal(waiting[2].options.headers.Authorization,'Bearer session-b');waiting[1].resolve(json({income:50}));waiting[2].resolve(json({income:70}));await refresh;await other;
  assert.equal(m.clock.count,0);
});
test('Fetch failures retry once; writes never retry and all statuses clear',async()=>{
  let calls=0;const m=mobile(async()=>{if(++calls===1)throw new Error('offline');return json({ok:true})});
  const request=m.api.api('/profile');await flush();m.clock.advance(450);await flush();assert.equal((await request).ok,true);assert.equal(calls,2);
  const failed=mobile(async()=>{throw new Error('offline')});
  await assert.rejects(failed.api.api('/transactions',{method:'POST',body:'{}'}),/cannot reach/);assert.equal(failed.clock.count,0);
});
test('Custom fetches stay separate and revoked-device errors only sign out their own session',async()=>{
  const waiting=[];const m=mobile(()=>new Promise(resolve=>waiting.push(resolve)));let revoked=0;m.api.setSessionRevokedHandler(()=>{revoked++});
  const a=m.api.api('/profile',{headers:{'X-Test':'one'}}),b=m.api.api('/profile',{headers:{'X-Test':'two'}});await flush();assert.equal(waiting.length,2);
  m.api.setRuntimeAuthToken('new-session');waiting[0](json({code:'DEVICE_SESSION_REVOKED',message:'Revoked'},401));waiting[1](json({ok:true}));await assert.rejects(a,/Revoked/);await b;assert.equal(revoked,0);
  const current=m.api.api('/profile');await flush();waiting[2](json({code:'DEVICE_SESSION_REVOKED',message:'Revoked'},401));await assert.rejects(current,/Revoked/);assert.equal(revoked,1);assert.equal(m.clock.count,0);
});
test('Protected file fetching shows status until bytes arrive and clears it on failure',async()=>{
  let finish;const fetchFile=()=>new Promise(resolve=>{finish=resolve});const m=mobile(fetchFile);
  const files=load('mobile/lib/files.ts',{'react-native':{Platform:{OS:'web'},Linking:{}},'expo-file-system/legacy':{},'expo-intent-launcher':{},'expo-sharing':{},'./api':m.api,'./activity':m.activity},{...m.clock,fetch:fetchFile});
  const downloading=files.downloadProtectedFile('/invoices/example/pdf','Invoice.pdf',false);await flush();m.clock.advance(250);assert.equal(m.activity.getActivitySnapshot().current.label,'Fetching Invoice.pdf…');
  finish(new Response('sample-pdf'));const url=await downloading;URL.revokeObjectURL(url);assert.equal(m.clock.count,0);
  const failed=files.downloadProtectedFile('/invoices/example/pdf','Invoice.pdf',false);await flush();finish(json({message:'Access denied'},403));await assert.rejects(failed,/Access denied/);assert.equal(m.clock.count,0);
});
test('Development configuration requires device approval by default',()=>{
  const config=load('backend/src/config/env.ts',{'dotenv/config':{}},{process:{env:{NODE_ENV:'development'}}});assert.equal(config.env.ALLOW_EXPO_GO_DEVICE_BYPASS,false);
});
test('Uploads retain status until confirmation and clean up on storage failure',async()=>{
  let complete;const paths=[];
  const m=mobile(async url=>{paths.push(url);if(url.endsWith('/presign'))return json({direct:true,uploadUrl:'https://storage.test/file',attachment:{key:'file'}});return new Promise(resolve=>{complete=resolve})},async()=>new Response('',{status:200}));
  const uploading=m.api.uploadAsset({uri:'blob:test',name:'receipt.pdf',mimeType:'application/pdf',file:new Blob(['receipt'])});
  await flush();m.clock.advance(250);assert.equal(m.activity.getActivitySnapshot().current.label,'Finishing upload…');
  assert.equal(paths.some(url=>url.endsWith('/ready')),false);complete(json({key:'file'}));await uploading;assert.equal(m.clock.count,0);
  const failed=mobile(async()=>json({direct:true,uploadUrl:'https://storage.test/file',attachment:{key:'file'}}),async()=>new Response('<Code>AccessDenied</Code>',{status:403}));
  await assert.rejects(failed.api.uploadAsset({uri:'blob:test',name:'receipt.pdf',file:new Blob(['receipt'])}),/AccessDenied/);assert.equal(failed.clock.count,0);
});

function records(initial=[]){
  const rows=[...initial];let seq=100;
  const get=(o,k)=>k.split('.').reduce((v,key)=>v?.[key],o);
  const matches=(o,q)=>Object.entries(q).every(([k,w])=>{const v=get(o,k);if(w&&typeof w==='object'&&!(w instanceof Date)){return Object.entries(w).every(([op,n])=>op==='$exists'?(v!==undefined)===n:op==='$gt'?v>n:op==='$gte'?v>=n:op==='$lte'?v<=n:op==='$lt'?v<n:false)}return String(v)===String(w)});
  const set=(o,k,v)=>{const keys=k.split('.'),last=keys.pop();let t=o;for(const key of keys)t=t[key]??={};t[last]=v};
  const doc=o=>Object.assign(o,{save:async()=>o,markModified:()=>{}});
  const query=fn=>({sort(){return this},lean(){return this},then(resolve,reject){return Promise.resolve().then(fn).then(resolve,reject)}});
  return{rows,find:q=>query(()=>rows.filter(o=>matches(o,q))),findOne:q=>query(()=>rows.find(o=>matches(o,q))||null),findById:id=>query(()=>rows.find(o=>String(o._id)===String(id))||null),exists:q=>query(()=>rows.some(o=>matches(o,q))),
    create:async o=>{const d=doc({_id:(++seq).toString(16).padStart(24,'0'),attempts:0,createdAt:new Date(),...o});rows.push(d);return d},
    deleteMany:async q=>{for(let i=rows.length-1;i>=0;i--)if(matches(rows[i],q))rows.splice(i,1)},
    findOneAndUpdate:async(q,u)=>{const o=rows.find(o=>matches(o,q));if(!o)return null;for(const[k,v]of Object.entries(u.$set||{}))set(o,k,v);return o},
    updateOne:async(q,u)=>{const o=rows.find(o=>matches(o,q));if(o)for(const[k,v]of Object.entries(u.$inc||{}))set(o,k,get(o,k)+v)},
    findByIdAndUpdate:async(id,u)=>{const o=rows.find(o=>String(o._id)===String(id));if(o)Object.assign(o,u.$set||u);return o},
  };
}
async function backend(){
  const User=records(),VerificationToken=records(),outbox=[],pushes=[];
  const env={NODE_ENV:'test',JWT_SECRET:'isolated-feature-check-secret',ALLOW_EXPO_GO_DEVICE_BYPASS:false,ALLOW_EXPO_GO_LOGIN:true,LOGIN_USERNAME:'owner@tekbooks',LOGIN_USER_EMAIL:'owner@example.test',LOGIN_NOTIFICATION_EMAIL:'configured-inbox@example.test',RESEND_TEST_MODE:true,RESEND_TEST_RECIPIENT:'configured-inbox@example.test',RESEND_API_KEY:'re_test',RESEND_FROM:'TekBooks <onboarding@resend.dev>',EMAIL_DEV_LOG_CODES:false};
  let failEmail=false;
  class TestResend{
    emails={send:async message=>{
      if(failEmail)return{error:{message:'delivery unavailable'}};
      outbox.push(message);return{data:{id:'test-message'}};
    }};
  }
  const template=load('backend/src/services/email-template.ts');
  const email=load('backend/src/services/email.ts',{'../config/env.js':{env},resend:{Resend:TestResend},'./email-template.js':template});
  const models={User,VerificationToken,IdempotencyRecord:{}};
  const auth=load('backend/src/utils/auth.ts',{'../config/env.js':{env},'../models/index.js':models,'../services/email.js':email});
  const middleware=load('backend/src/middleware/auth.ts',{'../config/env.js':{env},'../models/index.js':models,'../utils/auth.js':auth});
  const security=load('backend/src/middleware/security.ts',{'../models/index.js':models});
  const routes=load('backend/src/routes/auth.ts',{'../models/index.js':models,'../config/env.js':{env},'../utils/auth.js':auth,'../middleware/auth.js':middleware,'../middleware/security.js':security,'../services/email.js':email,'../services/push.js':{sendExpoPush:async(...args)=>pushes.push(args)},'../services/storage.js':{refreshedOwnedStorageUrl:()=>''}}).default;
  const user=await User.create({name:'Owner',email:env.LOGIN_USER_EMAIL,username:env.LOGIN_USERNAME,passwordHash:await bcrypt.hash('Password123',4),emailVerified:true,approvalStatus:'APPROVED',deviceId:'old-phone',deviceLabel:'Registered phone',expoPushToken:'ExponentPushToken[test]',failedLoginCount:0,business:{name:'Example business',currency:'AED'}});
  const app=express();app.use(express.json());app.use('/auth',routes);app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
  const call=async(route,body,token)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/auth${route}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,body:await response.json()}};
  const code=()=>outbox.at(-1).html.match(/>(\d{6})<\/div>/)[1];
  return{User,VerificationToken,user,auth,email,outbox,pushes,code,call,failEmail:()=>{failEmail=true},close:()=>new Promise(resolve=>server.close(resolve))};
}
test('Registered-device panel approves a new phone, polling stays available and old session is revoked',async()=>{
  const b=await backend();try{
    const oldToken=b.auth.signToken(b.user);
    const login=await b.call('/login',{email:'owner@tekbooks',password:'Password123',deviceId:'new-phone',deviceLabel:'New phone',expoGo:true});
    assert.equal(login.status,409);assert.equal(login.body.emailSent,true);assert.equal(b.outbox[0].to,'configured-inbox@example.test');assert.equal(b.pushes.length,1);
    const challenge=login.body;
    const other=await b.User.create({email:'other@example.test',approvalStatus:'APPROVED',deviceId:'other-phone'});
    assert.equal((await b.call('/device/approve',{challengeId:challenge.challengeId},b.auth.signToken(other))).status,404);
    const panel=await b.call('/device/requests',undefined,oldToken);assert.equal(panel.body.length,1);
    const payload={challengeId:challenge.challengeId,challengeSecret:challenge.challengeSecret,deviceId:'new-phone'};
    for(let i=0;i<22;i++)assert.equal((await b.call('/device/status',payload)).status,202);
    assert.equal((await b.call('/device/status',{...payload,challengeSecret:'wrong'})).status,400);
    assert.equal((await b.call('/device/approve',{challengeId:challenge.challengeId},oldToken)).status,200);
    assert.equal((await b.call('/device/requests',undefined,oldToken)).body.length,0);
    const results=await Promise.all([b.call('/device/status',payload),b.call('/device/status',payload)]);
    assert.equal(results.filter(x=>x.status===200).length,1);assert.equal(b.user.deviceId,'new-phone');assert.equal(b.user.expoPushToken,'');
    assert.equal((await b.call('/device/requests',undefined,oldToken)).status,401);
    const token=results.find(x=>x.status===200).body.token;assert.equal((await b.call('/device/requests',undefined,token)).status,200);
  }finally{await b.close()}
});
test('Email device code is bound to the requesting phone, expires and cannot be replayed',async()=>{
  const b=await backend();try{
    await b.call('/login',{email:'owner@tekbooks',password:'Password123',deviceId:'new-phone'});const code=b.code();
    assert.equal((await b.call('/device/verify',{email:'owner@tekbooks',code,deviceId:'wrong-phone'})).status,400);
    assert.equal(b.VerificationToken.rows[0].consumedAt,undefined);
    assert.equal((await b.call('/device/verify',{email:'owner@tekbooks',code,deviceId:'new-phone'})).status,200);
    assert.equal((await b.call('/device/verify',{email:'owner@tekbooks',code,deviceId:'new-phone'})).status,400);
    await b.call('/login',{email:'owner@tekbooks',password:'Password123',deviceId:'third-phone'});const expiredCode=b.code();b.VerificationToken.rows.at(-1).expiresAt=new Date(0);
    assert.equal((await b.call('/device/verify',{email:'owner@tekbooks',code:expiredCode,deviceId:'third-phone'})).status,400);
  }finally{await b.close()}
});
test('Failed email delivery leaves registered-phone approval usable',async()=>{
  const b=await backend();try{
    const token=b.auth.signToken(b.user);b.failEmail();
    const login=await b.call('/login',{email:'owner@tekbooks',password:'Password123',deviceId:'new-phone'});
    assert.equal(login.status,409);assert.equal(login.body.emailSent,false);assert.equal((await b.call('/device/requests',undefined,token)).body.length,1);
  }finally{await b.close()}
});
test('Forgot-password mail reaches configured inbox, resets password and rejects reused code',async()=>{
  const b=await backend();try{
    assert.equal((await b.call('/forgot-password',{email:'owner@tekbooks'})).status,200);
    assert.equal(b.outbox[0].to,'configured-inbox@example.test');const code=b.code();
    assert.equal((await b.call('/reset-password',{email:'owner@tekbooks',code,password:'NewPassword123'})).status,200);
    assert.equal(await bcrypt.compare('NewPassword123',b.user.passwordHash),true);
    assert.equal((await b.call('/reset-password',{email:'owner@tekbooks',code,password:'AgainPassword123'})).status,400);
    assert.equal(b.email.resolveEmailRecipient('owner@example.test'),'configured-inbox@example.test');
    assert.throws(()=>b.email.assertEmailRecipientAllowed('another@example.test'),/configured/);
  }finally{await b.close()}
});
test('Signup verification and resend reach the configured inbox; wrong-code attempts are limited',async()=>{
  const b=await backend();try{
    const email='configured-inbox@example.test';
    assert.equal((await b.call('/signup',{name:'New owner',businessName:'New business',email,password:'Password123'})).status,201);
    const first=b.code();assert.equal((await b.call('/resend-verification',{email})).status,200);const latest=b.code();
    if(first!==latest)assert.equal((await b.call('/verify-email',{email,code:first})).status,400);
    assert.equal((await b.call('/verify-email',{email,code:latest})).status,200);
    assert.equal(b.User.rows.find(x=>x.email===email).emailVerified,true);
    assert.equal((await b.call('/verify-email',{email,code:latest})).status,400);
    assert.ok(b.outbox.every(x=>x.to===email&&x.text&&x.html.includes('viewport')));
    await b.call('/forgot-password',{email:'owner@tekbooks'});const correct=b.code();
    for(let i=0;i<5;i++)assert.equal(await b.auth.consumeOtp(b.user.email,'PASSWORD_RESET',correct==='000000'?'111111':'000000'),null);
    assert.equal(await b.auth.consumeOtp(b.user.email,'PASSWORD_RESET',correct),null);
  }finally{await b.close()}
});
test('Report exports retain totals, selected sections, table headings and pagination',async()=>{
  const user={_id:'workspace',name:'Example owner',business:{name:'Example business — sample data',currency:'AED'}};
  const tx=Array.from({length:50},(_,i)=>({_id:String(i),userId:'workspace',date:new Date('2026-09-01'),type:i%2?'EXPENSE':'INCOME',amount:100,vatAmount:5,category:'Sample business category with a long descriptive label',partyName:'Example customer',paymentMethod:'BANK',notes:'Supporting reference and notes for a sample report entry. '.repeat(3)}));
  const empty=records(),models={Transaction:records(tx),Invoice:empty,Party:empty,mongoose:{isObjectIdOrHexString:()=>true}};
  const brand=load('backend/src/config/brand.ts');
  const router=load('backend/src/routes/reports.ts',{'../middleware/auth.js':{requireAuth:(req,res,next)=>{req.user=user;next()}},'../models/index.js':models,'../config/brand.js':brand,'../utils/assets.js':{pdfImageBuffer:async()=>null,pdfImageType:()=>null},'../utils/accounting.js':{roundMoney:x=>Math.round(x*100)/100},'../utils/download.js':{sendDownload:(res,body,type)=>res.type(type).send(body)}}).default;
  const app=express();app.use('/reports',router);app.use((e,req,res,next)=>res.status(500).send(e.message));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
  try{
    const base=`http://127.0.0.1:${server.address().port}/reports`;
    const summary=await(await fetch(`${base}/summary`)).json();assert.equal(summary.income,2500);assert.equal(summary.expenses,2500);assert.equal(summary.profit,0);
    const workbookResponse=await fetch(`${base}/export.xlsx?sections=summary,income,expenses`);assert.equal(workbookResponse.status,200);const xlsx=Buffer.from(await workbookResponse.arrayBuffer());
    const ExcelJS=require('exceljs'),wb=new ExcelJS.Workbook();await wb.xlsx.load(xlsx);assert.equal(wb.worksheets.length,3);assert.equal(wb.worksheets[0].getCell('B5').value,2500,JSON.stringify(wb.worksheets[0].getRows(1,12).map(row=>row.values)));
    const income=wb.getWorksheet('Income Report');assert.equal(income.getCell('A3').value,'Date');assert.equal(income.rowCount,28);assert.ok(income.autoFilter);assert.equal(income.views[0].ySplit,3);
    const pdfResponse=await fetch(`${base}/export.pdf?sections=summary,income,expenses`);assert.equal(pdfResponse.status,200);const pdf=Buffer.from(await pdfResponse.arrayBuffer());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>=5);
    assert.equal((await fetch(`${base}/export.pdf?sections=unknown`)).status,400);assert.equal((await fetch(`${base}/summary?from=invalid`)).status,400);
    if(process.env.FEATURE_CHECK_ARTIFACTS==='1'){
      const dir=path.join(root,'mobile/.expo/verification');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'sample-report.pdf'),pdf);fs.writeFileSync(path.join(dir,'sample-report.xlsx'),xlsx);
      const template=load('backend/src/services/email-template.ts');fs.writeFileSync(path.join(dir,'sample-email.html'),template.emailTemplate('Authorize a new device',template.codeEmailContent('123456','DEVICE_CHANGE').html,'Sample email preview'));
    }
  }finally{await new Promise(resolve=>server.close(resolve))}
});
