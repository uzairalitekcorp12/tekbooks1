import {Router} from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {requireAuth} from '../middleware/auth.js';
import {Transaction,Invoice,Party,mongoose} from '../models/index.js';
import {REPORT_BRAND as B} from '../config/brand.js';
import {pdfImageBuffer,pdfImageType} from '../utils/assets.js';
import {roundMoney} from '../utils/accounting.js';
import {sendDownload} from '../utils/download.js';

const r=Router();r.use(requireAuth);
const SECTION_IDS=['summary','profit-loss','income','expenses','receivables','customers','suppliers','vat'] as const;
type SectionId=typeof SECTION_IDS[number];

function reportDate(value:unknown,endOfDay=false){
  const raw=String(value||'').trim();if(!raw)return null;
  const date=/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(`${raw}T${endOfDay?'23:59:59.999':'00:00:00.000'}Z`):new Date(raw);
  return Number.isFinite(date.getTime())?date:null;
}
function range(q:any){
  if(!q.from&&!q.to)return{ok:true,value:{}} as const;
  const from=q.from?reportDate(q.from,false):new Date(0),to=q.to?reportDate(q.to,true):new Date();
  if(!from||!to)return{ok:false,message:'Report dates are invalid. Use ISO dates or YYYY-MM-DD.'} as const;
  if(from.getTime()>to.getTime())return{ok:false,message:'Report start date cannot be later than the end date.'} as const;
  return{ok:true,value:{$gte:from,$lte:to}} as const;
}
r.use((req,res,next)=>{const parsed=range(req.query);if(!parsed.ok)return res.status(400).json({message:parsed.message,code:'INVALID_REPORT_RANGE'});next()});
const sum=(xs:any[],key='amount')=>roundMoney(xs.reduce((s,x)=>s+Number(x[key]||0),0));
function grouped(xs:any[],field:string,key='amount'){const m=new Map<string,number>();xs.forEach(x=>m.set(String(x[field]||'Uncategorized'),(m.get(String(x[field]||'Uncategorized'))||0)+Number(x[key]||0)));return [...m.entries()].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total)}
function selectedSections(q:any){const raw=String(q.sections||'').trim();if(!raw)return new Set<SectionId>(SECTION_IDS);const wanted=new Set(raw.split(',').map((x:string)=>x.trim()).filter(Boolean) as SectionId[]);return new Set<SectionId>(SECTION_IDS.filter(x=>wanted.has(x)))}

async function data(uid:any,q:any){
  const parsedRange=range(q);if(!parsedRange.ok)throw Object.assign(new Error(parsedRange.message),{status:400,code:'INVALID_REPORT_RANGE'});
  const dr=parsedRange.value,txQ:any={userId:uid},invQ:any={userId:uid};if(Object.keys(dr).length){txQ.date=dr;invQ.issueDate=dr}
  const[tx,invoices,parties]=await Promise.all([Transaction.find(txQ).sort({date:-1}).lean(),Invoice.find(invQ).sort({issueDate:-1}).lean(),Party.find({userId:uid}).sort({name:1}).lean()]);
  const incomeTx=tx.filter((x:any)=>x.type==='INCOME'),expenseTx=tx.filter((x:any)=>x.type==='EXPENSE');
  const income=sum(incomeTx),expenses=sum(expenseTx),inputVat=sum(expenseTx,'vatAmount'),outputVat=sum(invoices,'vatAmount');
  const customers=parties.filter((x:any)=>x.type==='CUSTOMER'),suppliers=parties.filter((x:any)=>x.type==='SUPPLIER');
  const receivables=invoices.filter((x:any)=>Number(x.balance)>0).sort((a:any,b:any)=>new Date(a.dueDate).getTime()-new Date(b.dueDate).getTime());
  const customerStatements=customers.map((p:any)=>{const inv=invoices.filter((x:any)=>String(x.customerId)===String(p._id));const ptx=tx.filter((x:any)=>String(x.partyId||'')===String(p._id));return{party:p,totalBilled:sum(inv,'total'),paid:sum(inv,'paidAmount'),outstanding:sum(inv,'balance'),transactions:ptx.length}});
  const supplierStatements=suppliers.map((p:any)=>{const ptx=tx.filter((x:any)=>String(x.partyId||'')===String(p._id));return{party:p,totalBusiness:sum(ptx),transactions:ptx.length}});
  return{tx,invoices,parties,incomeTx,expenseTx,receivables,customerStatements,supplierStatements,incomeCategories:grouped(incomeTx,'category'),expenseCategories:grouped(expenseTx,'category'),summary:{income,expenses,profit:income-expenses,receivables:sum(receivables,'balance'),inputVat,outputVat,vatPayable:outputVat-inputVat}}
}
function periodLabel(q:any){const from=q.from?new Date(String(q.from)).toLocaleDateString():'Beginning';const to=q.to?new Date(String(q.to)).toLocaleDateString():'Today';return `${from} to ${to}`}
function money(v:any,c='AED'){return `${c} ${Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function safe(v:any){return String(v??'').trim()}

function excelHeader(ws:any,title:string,subtitle:string){
  ws.mergeCells('A1:F1');ws.mergeCells('A2:F2');ws.mergeCells('G1:H2');
  ws.getCell('A1').value=title;ws.getCell('A1').font={name:'Calibri',size:20,bold:true,color:{argb:'FFFFFFFF'}};
  ws.getCell('A2').value=subtitle;ws.getCell('A2').font={name:'Calibri',size:10,color:{argb:'FFB6D4CF'}};
  ws.getCell('G1').value='TEKBOOKS';ws.getCell('G1').font={name:'Calibri',size:12,bold:true,color:{argb:'FF54E0C7'}};
  for(const address of ['A1','A2','G1']){ws.getCell(address).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF082C2B'}};ws.getCell(address).alignment={vertical:'middle',horizontal:address==='G1'?'center':'left',indent:1}}
  ws.getRow(1).height=36;ws.getRow(2).height=26;
}
function styleTable(ws:any,row:number,cols:number){
  ws._reportHeaders??=new Set();ws._reportHeaders.add(row);
  for(let c=1;c<=cols;c++){const cell=ws.getRow(row).getCell(c);cell.font={name:'Calibri',bold:true,size:10,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF087E6D'}};cell.alignment={vertical:'middle',wrapText:true}}
  ws.getRow(row).height=28;if(!ws._reportTable)ws._reportTable={row,cols};ws.views=[{state:'frozen',ySplit:ws._reportTable.row,showGridLines:false}];
}
function addWorkbookLogo(wb:any,logo:Buffer|null){if(!logo)return;try{const extension=pdfImageType(logo);if(!extension)return;const id=wb.addImage({buffer:logo as any,extension:extension as any});wb.eachSheet((ws:any)=>{ws.getCell('G1').value='';ws.addImage(id,{tl:{col:6.15,row:.2},ext:{width:105,height:42}})})}catch{}}
function workbookFinish(wb:any){wb.eachSheet((ws:any)=>{
  ws.eachRow((row:any,index:number)=>{
    if(index<=2)return;
    const header=ws._reportHeaders?.has(index);
    if(!header)row.height=Math.max(row.height||0,26);
    const total=/^(TOTAL|NET PROFIT|VAT Payable)/i.test(String(row.getCell(1).value||''));
    row.eachCell((cell:any)=>{
      cell.alignment={...cell.alignment,vertical:'middle',wrapText:typeof cell.value==='string'};
      cell.border={bottom:{style:'hair',color:{argb:'FFDCEAE8'}}};
      if(!header&&typeof cell.value==='string'){const width=Math.max(8,(ws.getColumn(cell.col).width||16)-2);const lines=cell.value.split('\n').reduce((n:number,line:string)=>n+Math.max(1,Math.ceil(line.length/width)),0);row.height=Math.max(row.height,Math.min(96,lines*13+10))}
      if(!header){cell.font={name:'Calibri',size:10,bold:total,color:{argb:total?'FF087E6D':'FF203D37'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:total?'FFE1F5ED':index%2?'FFF1F7F4':'FFFFFFFF'}}}
    });
  });
  const table=ws._reportTable;if(table?.cols>2)ws.autoFilter={from:{row:table.row,column:1},to:{row:Math.max(table.row,ws.rowCount),column:table.cols}};
  ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:`1:${table?.row||2}`,margins:{left:.3,right:.3,top:.5,bottom:.5,header:.2,footer:.2}};
  ws.headerFooter={oddFooter:`&L${B.poweredBy}&RPage &P of &N`};
})}

function pdfFooter(doc:any,b:any){const y=doc.page.height-55;doc.moveTo(36,y-8).lineTo(doc.page.width-36,y-8).strokeColor(B.line).stroke();doc.font('Helvetica').fontSize(6.5).fillColor(B.muted).text(`${B.poweredBy}  •  ${safe(b.name||b.legalName||'Business')}`,36,y,{width:doc.page.width-72,align:'center',lineBreak:false});doc.fontSize(6.2).text(B.builtBy,36,y+9,{width:doc.page.width-72,align:'center',lineBreak:false})}
function pdfPageHeader(doc:any,b:any,logo:Buffer|null,title:string){
  doc._reportContext={b,logo,title};doc.rect(0,0,doc.page.width,112).fill('#082C2B');doc.rect(0,112,doc.page.width,3).fill(B.accent);
  if(logo){doc.roundedRect(36,23,94,39,6).fill('#FFFFFF');try{doc.image(logo,41,27,{fit:[84,31],align:'center',valign:'center'})}catch{}}
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF').text(safe(b.name||b.legalName||'Business'),logo?145:36,28,{width:logo?280:385,height:32,ellipsis:true});
  doc.font('Helvetica').fontSize(7).fillColor('#9DBDB5').text('TEKBOOKS / REPORTS',425,29,{width:134,align:'right'});
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text(title,36,77,{width:523,height:25,ellipsis:true});doc.x=36;doc.y=134;
}
function addReportPage(doc:any,b:any,logo:Buffer|null,title:string){doc.addPage();pdfPageHeader(doc,b,logo,title)}
function ensure(doc:any,height:number,b:any,logo:Buffer|null,title:string){doc._reportContext={b,logo,title};if(doc.y+height>755)addReportPage(doc,b,logo,title)}
function section(doc:any,title:string,subtitle?:string){doc.moveDown(.5);doc.font('Helvetica-Bold').fontSize(11.5).fillColor(B.primary2).text(title);if(subtitle)doc.font('Helvetica').fontSize(7.3).fillColor(B.muted).text(subtitle);doc.moveDown(.35)}
function metricRows(doc:any,rows:{label:string;value:string;strong?:boolean}[]){rows.forEach(x=>{
  const ctx=doc._reportContext;if(ctx)ensure(doc,34,ctx.b,ctx.logo,ctx.title);const y=doc.y;
  if(x.strong)doc.roundedRect(36,y-4,523,30,5).fill(B.soft);
  doc.font(x.strong?'Helvetica-Bold':'Helvetica').fontSize(x.strong?9.5:8.5).fillColor(x.strong?B.ink:B.muted).text(x.label,44,y+4,{width:295,height:16,ellipsis:true});
  doc.fillColor(x.strong?B.primary2:B.ink).text(x.value,348,y+4,{align:'right',width:203,height:16,ellipsis:true});
  if(!x.strong)doc.moveTo(44,y+25).lineTo(551,y+25).strokeColor(B.line).stroke();doc.x=36;doc.y=y+34;
})}
function summaryCards(doc:any,summary:any,currency:string){
  const y=doc.y,items=[{label:'TOTAL INCOME',value:summary.income,fill:B.soft,color:B.success},{label:'TOTAL EXPENSES',value:summary.expenses,fill:'#FFF2F1',color:B.danger},{label:'NET PROFIT / (LOSS)',value:summary.profit,fill:'#082C2B',color:B.accent}];
  items.forEach((item,i)=>{const x=36+i*178;doc.roundedRect(x,y,167,72,9).fill(item.fill);doc.font('Helvetica').fontSize(7).fillColor(i===2?'#B6D4CF':B.muted).text(item.label,x+12,y+16,{width:143});let fontSize=13;doc.font('Helvetica-Bold').fontSize(fontSize);const value=money(item.value,currency);while(doc.widthOfString(value)>143&&fontSize>8)doc.fontSize(--fontSize);doc.fillColor(item.color).text(value,x+12,y+36,{width:143,height:20,ellipsis:true})});doc.x=36;doc.y=y+88;
}
function ledgerRow(doc:any,x:any,currency:string,tone:string){
  const y=doc.y;doc.font('Helvetica-Bold').fontSize(8.5).fillColor(B.ink).text(safe(x.category),44,y,{width:315,height:22,ellipsis:true});doc.fillColor(tone).text(money(x.amount,currency),366,y,{align:'right',width:185,height:20,ellipsis:true});
  doc.font('Helvetica').fontSize(7).fillColor(B.muted).text([new Date(x.date).toLocaleDateString(),x.paymentMethod,x.vatAmount?`VAT ${money(x.vatAmount,currency)}`:''].filter(Boolean).join('  •  '),44,y+24,{width:507,height:12,ellipsis:true});
  doc.fontSize(7).text([x.partyName,x.notes].filter(Boolean).join('  •  '),44,y+38,{width:507,height:16,ellipsis:true});doc.moveTo(44,y+57).lineTo(551,y+57).strokeColor(B.line).stroke();doc.x=36;doc.y=y+64;
}

r.get('/summary',async(req,res)=>res.json((await data(req.user._id,req.query)).summary));
r.get('/customer/:id/statement',async(req,res)=>{if(!mongoose.isObjectIdOrHexString(req.params.id))return res.status(400).json({message:'Invalid customer identifier.'});const[party,invoices,tx]=await Promise.all([Party.findOne({_id:req.params.id,userId:req.user._id}),Invoice.find({userId:req.user._id,customerId:req.params.id}).sort({issueDate:-1}),Transaction.find({userId:req.user._id,partyId:req.params.id}).sort({date:-1})]);if(!party)return res.status(404).json({message:'Party not found'});res.json({party,invoices,transactions:tx})});

r.get('/export.xlsx',async(req,res)=>{
  const sections=selectedSections(req.query);if(!sections.size)return res.status(400).json({message:'Select at least one report section.'});
  const d=await data(req.user._id,req.query),currency=req.user.business?.currency||'AED',business=req.user.business?.name||req.user.name,period=periodLabel(req.query),logo=await pdfImageBuffer(req.user.business?.logoUrl);const wb=new ExcelJS.Workbook();wb.creator='TekBooks';wb.created=new Date();
  if(sections.has('summary')){const s=wb.addWorksheet('Executive Summary',{properties:{tabColor:{argb:'FF10C8A9'}}});s.columns=[{width:30},{width:22},{width:18},{width:18},{width:18},{width:18},{width:18},{width:18}];excelHeader(s,'Executive Summary',`${business} • ${period} • ${B.poweredBy}`);s.addRow([]);s.addRow(['Key Metric','Amount']);s.addRows([['Total Income',d.summary.income],['Total Expenses',d.summary.expenses],['Net Profit / (Loss)',d.summary.profit],['Outstanding Receivables',d.summary.receivables],['Output VAT',d.summary.outputVat],['Input VAT',d.summary.inputVat],['VAT Payable / (Recoverable)',d.summary.vatPayable]]);styleTable(s,4,2);s.getColumn(2).numFmt=`"${currency}" #,##0.00;[Red]-"${currency}" #,##0.00`}
  if(sections.has('profit-loss')){const pl=wb.addWorksheet('Profit & Loss');pl.columns=[{width:34},{width:20}];excelHeader(pl,'Profit & Loss',`${business} • ${period}`);pl.addRow([]);pl.addRow(['Income','Amount']);styleTable(pl,4,2);d.incomeCategories.forEach((x:any)=>pl.addRow([x.name,x.total]));pl.addRow(['Total Income',d.summary.income]);pl.addRow([]);const erow=pl.rowCount+1;pl.addRow(['Expenses','Amount']);styleTable(pl,erow,2);d.expenseCategories.forEach((x:any)=>pl.addRow([x.name,x.total]));pl.addRow(['Total Expenses',d.summary.expenses]);pl.addRow([]);pl.addRow(['NET PROFIT / (LOSS)',d.summary.profit]);pl.getColumn(2).numFmt=`"${currency}" #,##0.00;[Red]-"${currency}" #,##0.00`}
  const makeTx=(name:string,items:any[])=>{const ws=wb.addWorksheet(name);ws.columns=[{header:'Date',key:'date',width:14},{header:'Category',key:'category',width:22},{header:'Customer / Supplier',key:'partyName',width:26},{header:'Payment Method',key:'paymentMethod',width:20},{header:'VAT Treatment',key:'vatTreatment',width:16},{header:'VAT',key:'vatAmount',width:14},{header:'Amount',key:'amount',width:16},{header:'Notes',key:'notes',width:34}];ws.spliceRows(1,0,[],[]);excelHeader(ws,name,`${business} • ${period}`);styleTable(ws,3,8);items.forEach(x=>ws.addRow({date:new Date(x.date).toISOString().slice(0,10),category:x.category,partyName:x.partyName||'',paymentMethod:x.paymentMethod,vatTreatment:x.vatTreatment,vatAmount:x.vatAmount||0,amount:x.amount,notes:x.notes||''}));ws.getColumn('vatAmount').numFmt=`"${currency}" #,##0.00`;ws.getColumn('amount').numFmt=`"${currency}" #,##0.00`;return ws};
  if(sections.has('income'))makeTx('Income Report',d.incomeTx);if(sections.has('expenses'))makeTx('Expense Report',d.expenseTx);
  if(sections.has('receivables')){const rec=wb.addWorksheet('Receivables');rec.columns=[{header:'Invoice',key:'invoice',width:16},{header:'Customer',key:'customer',width:28},{header:'Issue Date',key:'issue',width:14},{header:'Due Date',key:'due',width:14},{header:'Total',key:'total',width:16},{header:'Paid',key:'paid',width:16},{header:'Outstanding',key:'balance',width:16},{header:'Status',key:'status',width:14}];rec.spliceRows(1,0,[],[]);excelHeader(rec,'Outstanding Receivables',`${business} • ${period}`);styleTable(rec,3,8);d.receivables.forEach((x:any)=>rec.addRow({invoice:x.invoiceNumber,customer:x.customerSnapshot?.name,issue:new Date(x.issueDate).toISOString().slice(0,10),due:new Date(x.dueDate).toISOString().slice(0,10),total:x.total,paid:x.paidAmount,balance:x.balance,status:new Date(x.dueDate)<new Date()?'OVERDUE':x.status}));['total','paid','balance'].forEach(k=>rec.getColumn(k).numFmt=`"${currency}" #,##0.00`)}
  if(sections.has('customers')){const cust=wb.addWorksheet('Customer Statements');cust.columns=[{header:'Customer',key:'name',width:30},{header:'Email',key:'email',width:28},{header:'TRN',key:'trn',width:18},{header:'Total Billed',key:'billed',width:16},{header:'Paid',key:'paid',width:16},{header:'Outstanding',key:'outstanding',width:16},{header:'Transactions',key:'transactions',width:14},{width:12}];cust.spliceRows(1,0,[],[]);excelHeader(cust,'Customer Statement Summary',`${business} • ${period}`);styleTable(cust,3,7);d.customerStatements.forEach((x:any)=>cust.addRow({name:x.party.name,email:x.party.email||'',trn:x.party.trn||'',billed:x.totalBilled,paid:x.paid,outstanding:x.outstanding,transactions:x.transactions}));['billed','paid','outstanding'].forEach(k=>cust.getColumn(k).numFmt=`"${currency}" #,##0.00`)}
  if(sections.has('suppliers')){const sup=wb.addWorksheet('Supplier Statements');sup.columns=[{header:'Supplier',key:'name',width:30},{header:'Email',key:'email',width:28},{header:'TRN',key:'trn',width:18},{header:'Recorded Business',key:'total',width:18},{header:'Transactions',key:'transactions',width:14},{width:12},{width:12},{width:12}];sup.spliceRows(1,0,[],[]);excelHeader(sup,'Supplier Statement Summary',`${business} • ${period}`);styleTable(sup,3,5);d.supplierStatements.forEach((x:any)=>sup.addRow({name:x.party.name,email:x.party.email||'',trn:x.party.trn||'',total:x.totalBusiness,transactions:x.transactions}));sup.getColumn('total').numFmt=`"${currency}" #,##0.00`}
  if(sections.has('vat')){const vat=wb.addWorksheet('VAT Summary');vat.columns=[{width:32},{width:20},{width:16},{width:16},{width:16},{width:16},{width:16},{width:16}];excelHeader(vat,'VAT Summary',`${business} • ${period}`);vat.addRow([]);vat.addRow(['VAT Metric','Amount']);styleTable(vat,4,2);vat.addRows([['Output VAT on invoices',d.summary.outputVat],['Input VAT on expenses',d.summary.inputVat],['VAT Payable / (Recoverable)',d.summary.vatPayable]]);vat.getColumn(2).numFmt=`"${currency}" #,##0.00`}
  addWorkbookLogo(wb,logo);workbookFinish(wb);const workbook=Buffer.from(await wb.xlsx.writeBuffer());return sendDownload(res,workbook,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','TekBooks-Business-Report.xlsx',req.user._id);
});

r.get('/export.pdf',async(req,res)=>{
  const sections=selectedSections(req.query);if(!sections.size)return res.status(400).json({message:'Select at least one report section.'});
  const d=await data(req.user._id,req.query),b=req.user.business||{},currency=b.currency||'AED',period=periodLabel(req.query),logo=await pdfImageBuffer(b.logoUrl);const chunks:Buffer[]=[];const doc=new PDFDocument({margin:36,size:'A4',bufferPages:true});const completed=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(chunk:Buffer)=>chunks.push(chunk));doc.once('end',()=>resolve(Buffer.concat(chunks)));doc.once('error',reject)});
  pdfPageHeader(doc,b,logo,'Business Management Report');doc.roundedRect(36,122,523,64,14).fill(B.soft);doc.font('Helvetica').fontSize(7).fillColor(B.muted).text('REPORTING PERIOD',54,139);doc.font('Helvetica-Bold').fontSize(13).fillColor(B.primary2).text(period,54,154,{width:330});doc.font('Helvetica').fontSize(7).fillColor(B.muted).text(`Currency: ${currency}${b.trn?` • TRN: ${b.trn}`:''}`,390,143,{width:150,align:'right'});doc.font('Helvetica').fontSize(6.8).fillColor(B.muted).text(`Generated ${new Date().toLocaleString()}`,390,158,{width:150,align:'right'});doc.y=205;
  if(sections.has('summary')){section(doc,'Executive Summary','A concise view of the selected period');summaryCards(doc,d.summary,currency);metricRows(doc,[{label:'Outstanding receivables',value:money(d.summary.receivables,currency)},{label:'VAT payable / (recoverable)',value:money(d.summary.vatPayable,currency)}])}
  if(sections.has('profit-loss')){ensure(doc,150,b,logo,'Profit & Loss');section(doc,'Profit & Loss','Income and expense categories');doc.font('Helvetica-Bold').fontSize(8).fillColor(B.success).text('Income');for(const x of d.incomeCategories){ensure(doc,18,b,logo,'Profit & Loss');doc.font('Helvetica').fontSize(7.5).fillColor(B.ink).text(x.name,46,doc.y,{continued:true,width:315}).text(money(x.total,currency),{align:'right',width:180});doc.moveDown(.2)}doc.moveDown(.35);doc.font('Helvetica-Bold').fontSize(8).fillColor(B.danger).text('Expenses');for(const x of d.expenseCategories){ensure(doc,18,b,logo,'Profit & Loss');doc.font('Helvetica').fontSize(7.5).fillColor(B.ink).text(x.name,46,doc.y,{continued:true,width:315}).text(money(x.total,currency),{align:'right',width:180});doc.moveDown(.2)}doc.moveDown(.4);metricRows(doc,[{label:'TOTAL INCOME',value:money(d.summary.income,currency),strong:true},{label:'TOTAL EXPENSES',value:money(d.summary.expenses,currency),strong:true},{label:'NET PROFIT / (LOSS)',value:money(d.summary.profit,currency),strong:true}])}
  if(sections.has('income')){ensure(doc,95,b,logo,'Income Report');section(doc,'Income Report',`${d.incomeTx.length} recorded income transaction${d.incomeTx.length===1?'':'s'}`);if(d.incomeTx.length)for(const x of d.incomeTx){ensure(doc,64,b,logo,'Income Report');ledgerRow(doc,x,currency,B.success)}else doc.font('Helvetica').fontSize(8).fillColor(B.muted).text('No income transactions in this period.')}
  if(sections.has('expenses')){ensure(doc,95,b,logo,'Expense Report');section(doc,'Expense Report',`${d.expenseTx.length} recorded expense transaction${d.expenseTx.length===1?'':'s'}`);if(d.expenseTx.length)for(const x of d.expenseTx){ensure(doc,64,b,logo,'Expense Report');ledgerRow(doc,x,currency,B.danger)}else doc.font('Helvetica').fontSize(8).fillColor(B.muted).text('No expense transactions in this period.')}
  if(sections.has('receivables')){ensure(doc,95,b,logo,'Outstanding Receivables');section(doc,'Outstanding Receivables','Open and overdue customer balances');if(d.receivables.length)for(const x of d.receivables){ensure(doc,34,b,logo,'Outstanding Receivables');const overdue=new Date(x.dueDate)<new Date();doc.font('Helvetica-Bold').fontSize(7.8).fillColor(B.ink).text(`${x.invoiceNumber} • ${safe(x.customerSnapshot?.name||'Customer')}`,44,doc.y,{continued:true,width:320});doc.fillColor(overdue?B.danger:B.primary2).text(money(x.balance,currency),{align:'right',width:180});doc.font('Helvetica').fontSize(6.5).fillColor(B.muted).text(`Due ${new Date(x.dueDate).toLocaleDateString()} • ${overdue?'OVERDUE':x.status} • Total ${money(x.total,currency)} • Paid ${money(x.paidAmount,currency)}`,44,doc.y,{width:490});doc.moveDown(.45)}else doc.font('Helvetica').fontSize(8).fillColor(B.success).text('No outstanding receivables.')}
  if(sections.has('customers')){ensure(doc,90,b,logo,'Customer Statement Summary');section(doc,'Customer Statement Summary','Billed, paid and outstanding balances by customer');if(d.customerStatements.length)for(const x of d.customerStatements){ensure(doc,32,b,logo,'Customer Statement Summary');doc.font('Helvetica-Bold').fontSize(7.8).fillColor(B.ink).text(x.party.name,44,doc.y,{continued:true,width:245});doc.fillColor(B.primary2).text(`Outstanding ${money(x.outstanding,currency)}`,{align:'right',width:250});doc.font('Helvetica').fontSize(6.5).fillColor(B.muted).text(`Billed ${money(x.totalBilled,currency)} • Paid ${money(x.paid,currency)} • ${x.transactions} linked transactions${x.party.trn?` • TRN ${x.party.trn}`:''}`,44,doc.y,{width:490});doc.moveDown(.45)}else doc.font('Helvetica').fontSize(8).fillColor(B.muted).text('No customers in this workspace.')}
  if(sections.has('suppliers')){ensure(doc,90,b,logo,'Supplier Statement Summary');section(doc,'Supplier Statement Summary','Recorded business and transaction count by supplier');if(d.supplierStatements.length)for(const x of d.supplierStatements){ensure(doc,30,b,logo,'Supplier Statement Summary');doc.font('Helvetica-Bold').fontSize(7.8).fillColor(B.ink).text(x.party.name,44,doc.y,{continued:true,width:300});doc.fillColor(B.primary2).text(money(x.totalBusiness,currency),{align:'right',width:190});doc.font('Helvetica').fontSize(6.5).fillColor(B.muted).text(`${x.transactions} linked transactions${x.party.trn?` • TRN ${x.party.trn}`:''}`,44,doc.y,{width:490});doc.moveDown(.45)}else doc.font('Helvetica').fontSize(8).fillColor(B.muted).text('No suppliers in this workspace.')}
  if(sections.has('vat')){ensure(doc,120,b,logo,'VAT Summary');section(doc,'VAT Summary','Basic input and output VAT position');metricRows(doc,[{label:'Output VAT on invoices',value:money(d.summary.outputVat,currency)},{label:'Input VAT on expenses',value:money(d.summary.inputVat,currency)},{label:'VAT payable / (recoverable)',value:money(d.summary.vatPayable,currency),strong:true}]);doc.moveDown(.3);doc.font('Helvetica').fontSize(6.8).fillColor(B.muted).text('VAT figures are book keeping summaries based on entries recorded in TekBooks. Confirm filing treatment with your tax adviser where required.',{lineGap:2})}
  const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);pdfFooter(doc,b);doc.font('Helvetica').fontSize(6.2).fillColor(B.muted).text(`Page ${i+1} of ${pages.count}`,500,doc.page.height-55,{width:60,align:'right',lineBreak:false})}doc.end();const pdf=await completed;return sendDownload(res,pdf,'application/pdf','TekBooks-Business-Report.pdf',req.user._id);
});
export default r;
