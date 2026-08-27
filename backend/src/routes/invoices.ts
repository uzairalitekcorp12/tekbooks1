import {Router} from 'express';
import {z} from 'zod';
import PDFDocument from 'pdfkit';
import {Invoice,Party,Counter} from '../models/index.js';
import {requireAuth} from '../middleware/auth.js';
import {idempotency} from '../middleware/security.js';
import {REPORT_BRAND as B} from '../config/brand.js';
import {pdfImageBuffer} from '../utils/assets.js';
import {removeStoredFile} from '../services/storage.js';

const r=Router();r.use(requireAuth);r.use(idempotency);
const line=z.object({description:z.string().min(1),qty:z.coerce.number().positive(),unitPrice:z.coerce.number().min(0),vatPercent:z.coerce.number().min(0).max(100).default(5)});
const attachment=z.object({name:z.string().optional(),url:z.string().optional(),key:z.string().optional(),mimeType:z.string().optional(),size:z.number().optional()}).passthrough().optional();
const schema=z.object({customerId:z.string(),issueDate:z.coerce.date(),dueDate:z.coerce.date(),lines:z.array(line).min(1),discountPercent:z.coerce.number().min(0).max(100).default(0),notes:z.string().optional(),attachment,openingStatus:z.enum(['UNPAID','PARTIAL','PAID']).default('UNPAID'),openingPaidAmount:z.coerce.number().min(0).default(0),openingPaymentMethod:z.string().min(1).default('Bank Transfer'),openingPaymentNotes:z.string().optional()});

function calc(lines:any[],discountPercent:number){const mapped=lines.map(l=>({...l,amount:l.qty*l.unitPrice}));const subtotal=mapped.reduce((s,l)=>s+l.amount,0);const pct=Math.min(100,Math.max(0,Number(discountPercent)||0));const discountAmount=subtotal*(pct/100);const taxable=Math.max(0,subtotal-discountAmount);const weightedVat=mapped.reduce((s,l)=>s+(l.amount*(l.vatPercent/100)),0);const vatAmount=subtotal?weightedVat*(taxable/subtotal):0;const total=taxable+vatAmount;return{mapped,subtotal,discountPercent:pct,discountAmount,vatAmount,total}}
async function nextNumber(userId:any){const c:any=await Counter.findOneAndUpdate({_id:`${String(userId)}:invoice`},{$inc:{seq:1}},{upsert:true,new:true,setDefaultsOnInsert:true});return `INV-${String(c.seq).padStart(5,'0')}`}
function money(v:any,c='AED'){return `${c} ${Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function safeText(v:any){return String(v??'').trim()}
function finite(v:any){return Number.isFinite(Number(v))}

function footer(doc:any,b:any,number:string){const y=doc.page.height-55;doc.moveTo(40,y-9).lineTo(doc.page.width-40,y-9).strokeColor(B.line).stroke();doc.font('Helvetica').fontSize(6.8).fillColor(B.muted).text(`${B.poweredBy}  •  ${safeText(b.name||b.legalName||'Business')}  •  ${number}`,40,y,{width:doc.page.width-80,align:'center',lineBreak:false})}
function invoiceHeader(doc:any,x:any,b:any,logo:Buffer|null,continued=false){
  const right=340;
  if(logo){try{doc.image(logo,40,32,{fit:[132,52],align:'left',valign:'center'})}catch{}}
  const business=safeText(b.name||b.legalName||'Business');
  if(!logo)doc.font('Helvetica-Bold').fontSize(18).fillColor(B.ink).text(business,40,42,{width:260});
  else doc.font('Helvetica-Bold').fontSize(10).fillColor(B.ink).text(business,40,88,{width:260});
  doc.font('Helvetica').fontSize(7.5).fillColor(B.muted).text(B.poweredBy,right,39,{width:215,align:'right'});
  doc.font('Helvetica-Bold').fontSize(continued?18:25).fillColor(B.ink).text(continued?'INVOICE • CONTINUED':'INVOICE',right,55,{width:215,align:'right'});
  doc.font('Helvetica-Bold').fontSize(9).fillColor(B.primary).text(x.invoiceNumber,right,87,{width:215,align:'right'});
  doc.moveTo(40,114).lineTo(555,114).strokeColor(B.line).stroke();
}
function drawTableHeader(doc:any,y:number){doc.roundedRect(40,y,515,27,7).fill(B.primary);doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#FFFFFF').text('DESCRIPTION',51,y+9,{width:224}).text('QTY',282,y+9,{width:34,align:'right'}).text('RATE',322,y+9,{width:70,align:'right'}).text('VAT',398,y+9,{width:38,align:'right'}).text('AMOUNT',442,y+9,{width:103,align:'right'});return y+34}
function lineHeight(doc:any,description:string){doc.font('Helvetica').fontSize(7.8);const h=doc.heightOfString(description,{width:224,lineGap:1});return Math.max(25,Math.min(44,h+12))}
function drawLine(doc:any,l:any,y:number,index:number){const h=lineHeight(doc,safeText(l.description));if(index%2===0)doc.roundedRect(40,y-4,515,h,4).fill('#F7FCFB');doc.font('Helvetica').fontSize(7.8).fillColor(B.ink).text(safeText(l.description),51,y+3,{width:224,lineGap:1}).text(String(l.qty),282,y+3,{width:34,align:'right'}).text(Number(l.unitPrice).toFixed(2),322,y+3,{width:70,align:'right'}).text(`${Number(l.vatPercent||0).toFixed(0)}%`,398,y+3,{width:38,align:'right'}).text(Number(l.amount).toFixed(2),442,y+3,{width:103,align:'right'});return y+h}

async function readiness(x:any,b:any){
  const issues:string[]=[],warnings:string[]=[];
  if(!safeText(x.customerSnapshot?.name))issues.push('Customer name is missing. Open the customer record and add a name.');
  if(!Array.isArray(x.lines)||!x.lines.length)issues.push('The invoice has no line items.');
  (x.lines||[]).forEach((l:any,i:number)=>{if(!safeText(l.description)||!finite(l.qty)||Number(l.qty)<=0||!finite(l.unitPrice)||Number(l.unitPrice)<0||!finite(l.amount))issues.push(`Line item ${i+1} contains invalid quantity, price or amount data.`)});
  if(!finite(x.subtotal)||!finite(x.total)||!finite(x.balance)||Number(x.total)<0)issues.push('Invoice totals are invalid. Recreate the invoice or correct its line items.');
  if(new Date(x.dueDate).getTime()<new Date(x.issueDate).getTime())issues.push('Due date is earlier than the invoice issue date.');
  if(!safeText(b.name||b.legalName))warnings.push('Company display name is not set; the account holder name will be used.');
  let logo:Buffer|null=null;
  if(b.logoUrl){logo=await pdfImageBuffer(b.logoUrl);if(!logo)warnings.push('Company logo could not be loaded. Re-upload it as a PNG or JPEG from Company Profile. The invoice can still be generated without the logo.')}
  else warnings.push('No company logo is set. Add a PNG/JPEG logo in Company Profile for branded invoices.');
  return{ok:issues.length===0,issues,warnings,logo};
}

async function renderPdf(x:any,b:any,currency:string,logo:Buffer|null){
  return await new Promise<Buffer>((resolve,reject)=>{
    const chunks:Buffer[]=[];const doc=new PDFDocument({margin:40,size:'A4',bufferPages:true,autoFirstPage:true});
    doc.on('data',(c:Buffer)=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
    try{
      invoiceHeader(doc,x,b,logo,false);
      const left=40,right=310;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(B.muted).text('FROM',left,134);doc.font('Helvetica-Bold').fontSize(10.5).fillColor(B.ink).text(safeText(b.legalName||b.name||'Business'),left,149,{width:225});let sy=doc.y+3;
      for(const text of [b.address,b.phone,b.email,b.trn?`TRN: ${b.trn}`:''].filter(Boolean)){doc.font('Helvetica').fontSize(7.3).fillColor(B.muted).text(safeText(text),left,sy,{width:225});sy=doc.y+2}
      doc.font('Helvetica-Bold').fontSize(7).fillColor(B.muted).text('BILL TO',right,134);doc.font('Helvetica-Bold').fontSize(10.5).fillColor(B.ink).text(safeText(x.customerSnapshot?.name||'Customer'),right,149,{width:245});let cy=doc.y+3;
      for(const text of [x.customerSnapshot?.address,x.customerSnapshot?.email,x.customerSnapshot?.phone,x.customerSnapshot?.trn?`TRN: ${x.customerSnapshot.trn}`:''].filter(Boolean)){doc.font('Helvetica').fontSize(7.3).fillColor(B.muted).text(safeText(text),right,cy,{width:245});cy=doc.y+2}
      const metaY=Math.max(209,sy+8,cy+8);doc.roundedRect(40,metaY,515,49,12).fill(B.soft);const meta=[['ISSUE DATE',new Date(x.issueDate).toLocaleDateString()],['DUE DATE',new Date(x.dueDate).toLocaleDateString()],['STATUS',x.status]];meta.forEach((m,i)=>{const px=58+i*166;doc.font('Helvetica-Bold').fontSize(6.7).fillColor(B.muted).text(m[0],px,metaY+10,{width:130});doc.font('Helvetica-Bold').fontSize(9.2).fillColor(i===2?(x.status==='PAID'?B.success:x.status==='PARTIAL'?B.warning:B.danger):B.ink).text(m[1],px,metaY+25,{width:130})});
      let rowY=drawTableHeader(doc,metaY+65),pageLineIndex=0;
      for(let i=0;i<(x.lines||[]).length;i++){const l=x.lines[i],h=lineHeight(doc,safeText(l.description));if(rowY+h>555){doc.addPage();invoiceHeader(doc,x,b,logo,true);rowY=drawTableHeader(doc,136);pageLineIndex=0}rowY=drawLine(doc,l,rowY,pageLineIndex++)}
      const noteHeight=x.notes?Math.min(70,doc.heightOfString(safeText(x.notes),{width:270})):0;const blockHeight=155+noteHeight;
      if(rowY+blockHeight>755){doc.addPage();invoiceHeader(doc,x,b,logo,true);rowY=140}
      const totalsY=Math.max(rowY+11,510);
      if(x.notes){doc.font('Helvetica-Bold').fontSize(7).fillColor(B.muted).text('NOTES / TERMS',40,totalsY+3);doc.font('Helvetica').fontSize(7.5).fillColor(B.ink).text(safeText(x.notes),40,totalsY+17,{width:270,lineGap:2,height:72,ellipsis:true})}
      const tx=350,valueX=447;const dp=Number(x.discountPercent??(Number(x.subtotal)>0?Number(x.discount||0)/Number(x.subtotal)*100:0));const rows=[['Subtotal',x.subtotal,B.ink],[`Discount (${dp.toFixed(2).replace(/\.00$/,'')}%)`,x.discount,B.ink],['VAT',x.vatAmount,B.ink]] as any[];rows.forEach((rr,i)=>{doc.font('Helvetica').fontSize(7.5).fillColor(B.muted).text(rr[0],tx,totalsY+i*19,{width:88,align:'right'});doc.font('Helvetica-Bold').fillColor(rr[2]).text(money(rr[1],currency),valueX,totalsY+i*19,{width:108,align:'right'})});
      doc.moveTo(tx,totalsY+59).lineTo(555,totalsY+59).strokeColor(B.line).stroke();doc.font('Helvetica-Bold').fontSize(9.5).fillColor(B.ink).text('TOTAL',tx,totalsY+70,{width:88,align:'right'}).fontSize(11).fillColor(B.primary).text(money(x.total,currency),valueX,totalsY+69,{width:108,align:'right'});doc.font('Helvetica').fontSize(7.5).fillColor(B.muted).text('Paid',tx,totalsY+92,{width:88,align:'right'}).font('Helvetica-Bold').fillColor(B.success).text(money(x.paidAmount,currency),valueX,totalsY+92,{width:108,align:'right'});doc.font('Helvetica-Bold').fontSize(8.3).fillColor(B.ink).text('BALANCE DUE',tx,totalsY+113,{width:88,align:'right'}).fillColor(x.balance>0?B.danger:B.success).text(money(x.balance,currency),valueX,totalsY+113,{width:108,align:'right'});
      let py=totalsY+142;
      if(x.payments?.length){if(py+Math.min(x.payments.length,6)*16>755){doc.addPage();invoiceHeader(doc,x,b,logo,true);py=140}doc.font('Helvetica-Bold').fontSize(7).fillColor(B.muted).text('PAYMENT HISTORY',40,py);py+=14;for(const p of x.payments){if(py>755){doc.addPage();invoiceHeader(doc,x,b,logo,true);py=140}doc.font('Helvetica').fontSize(7.3).fillColor(B.ink).text(`${new Date(p.date).toLocaleDateString()} • ${safeText(p.method)}${p.notes?` • ${safeText(p.notes)}`:''}`,40,py,{width:360,ellipsis:true});doc.font('Helvetica-Bold').fillColor(B.success).text(money(p.amount,currency),430,py,{width:125,align:'right'});py+=15}}
      const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);footer(doc,b,x.invoiceNumber)}doc.end();
    }catch(error){try{doc.end()}catch{}reject(error)}
  });
}

r.get('/',async(req,res)=>{const q:any={userId:req.user._id};if(req.query.status)q.status=req.query.status;res.json(await Invoice.find(q).sort({issueDate:-1,createdAt:-1}).lean())});
r.get('/:id',async(req,res)=>{const x=await Invoice.findOne({_id:req.params.id,userId:req.user._id}).lean();if(!x)return res.status(404).json({message:'Invoice not found'});res.json(x)});
r.get('/:id/pdf-check',async(req,res)=>{const x:any=await Invoice.findOne({_id:req.params.id,userId:req.user._id}).lean();if(!x)return res.status(404).json({message:'Invoice not found'});const rawBusiness=req.user.business?.toObject?.()||req.user.business||{};const check=await readiness(x,rawBusiness);if(!check.ok)return res.json({ok:false,issues:check.issues,warnings:check.warnings});const b={...rawBusiness,name:rawBusiness.name||rawBusiness.legalName||req.user.name};try{await renderPdf(x,b,b.currency||'AED',check.logo);res.json({ok:true,issues:[],warnings:check.warnings})}catch(error:any){res.json({ok:false,issues:[`The PDF renderer could not build this invoice: ${error?.message||'unknown rendering error'}`],warnings:check.warnings})}});

r.post('/',async(req,res)=>{
  const p=schema.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invoice details are invalid',issues:p.error.flatten()});
  const customer=await Party.findOne({_id:p.data.customerId,userId:req.user._id,type:'CUSTOMER'});if(!customer)return res.status(400).json({message:'The selected customer no longer exists. Choose or add a customer again.'});
  if(p.data.dueDate.getTime()<p.data.issueDate.getTime())return res.status(400).json({message:'Due date cannot be earlier than the invoice issue date.'});
  const c=calc(p.data.lines,p.data.discountPercent);
  if(c.subtotal<=0)return res.status(400).json({message:'Invoice value must be greater than zero. Add at least one positive-value line item.'});
    let paidAmount=0;
  if(p.data.openingStatus==='PAID')paidAmount=c.total;
  if(p.data.openingStatus==='PARTIAL'){
    paidAmount=p.data.openingPaidAmount;
    if(c.total<=0||paidAmount<=0||paidAmount>=c.total)return res.status(400).json({message:'Partial payment must be greater than zero and less than the invoice total.'});
  }
  const balance=Math.max(0,c.total-paidAmount),status=p.data.openingStatus==='PAID'?'PAID':paidAmount>0?'PARTIAL':'UNPAID';
  const payments=paidAmount>0?[{amount:paidAmount,date:p.data.issueDate,method:p.data.openingPaymentMethod,notes:p.data.openingPaymentNotes||'Opening payment'}]:[];
  const x=await Invoice.create({userId:req.user._id,invoiceNumber:await nextNumber(req.user._id),customerId:customer._id,customerSnapshot:{name:customer.name,email:customer.email,phone:customer.phone,address:customer.address,trn:customer.trn},issueDate:p.data.issueDate,dueDate:p.data.dueDate,lines:c.mapped,subtotal:c.subtotal,discount:c.discountAmount,discountPercent:c.discountPercent,vatAmount:c.vatAmount,total:c.total,paidAmount,balance,status,payments,notes:p.data.notes,attachment:p.data.attachment});
  res.status(201).json(x);
});

r.post('/:id/payments',async(req,res)=>{
  const p=z.object({amount:z.coerce.number().positive(),date:z.coerce.date(),method:z.string().min(1),notes:z.string().optional()}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Enter a valid positive payment amount and payment method.'});
  const x=await Invoice.findOne({_id:req.params.id,userId:req.user._id});if(!x)return res.status(404).json({message:'Invoice not found'});
  const remaining=Math.max(0,x.total-x.paidAmount);if(remaining<=0.001)return res.status(400).json({message:'This invoice is already fully paid.'});if(p.data.amount>remaining+0.001)return res.status(400).json({message:`Payment exceeds the outstanding balance of ${remaining.toFixed(2)}.`});
  const amount=p.data.amount;x.payments.push({...p.data,amount} as any);x.paidAmount+=amount;x.balance=Math.max(0,x.total-x.paidAmount);x.status=x.balance<=0.001?'PAID':x.paidAmount>0?'PARTIAL':'UNPAID';await x.save();res.json(x);
});

r.delete('/:id',async(req,res)=>{const x:any=await Invoice.findOneAndDelete({_id:req.params.id,userId:req.user._id});if(!x)return res.status(404).json({message:'Invoice not found'});if(x.attachment)removeStoredFile(x.attachment).catch(error=>console.warn('Invoice attachment cleanup failed:',error?.message||error));res.json({ok:true,id:String(x._id),invoiceNumber:x.invoiceNumber})});

r.get('/:id/pdf',async(req,res)=>{
  const x:any=await Invoice.findOne({_id:req.params.id,userId:req.user._id}).lean();if(!x)return res.status(404).json({message:'Invoice not found'});
  const rawBusiness=req.user.business?.toObject?.()||req.user.business||{};const check=await readiness(x,rawBusiness);const b={...rawBusiness,name:rawBusiness.name||rawBusiness.legalName||req.user.name};const currency=b.currency||'AED';
  if(!check.ok)return res.status(422).json({message:'Invoice PDF cannot be generated yet.',code:'INVOICE_PDF_NOT_READY',issues:check.issues,warnings:check.warnings});
  try{const buffer=await renderPdf(x,b,currency,check.logo);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Length',String(buffer.length));res.setHeader('Content-Disposition',`attachment; filename="${x.invoiceNumber}.pdf"`);res.send(buffer)}catch(error:any){console.error('Invoice PDF generation failed',error);res.status(500).json({message:'Invoice PDF generation failed.',code:'INVOICE_PDF_GENERATION_FAILED',reason:error?.message||'The PDF renderer could not complete this document.',suggestion:'Check the company logo is PNG/JPEG and try again. If the problem continues, open the invoice and verify its customer and line-item data.'})}
});

export default r;
