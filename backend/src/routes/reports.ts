import {Router} from 'express';
import ExcelJS from 'exceljs';
import {requireAuth} from '../middleware/auth.js';
import {Transaction,Invoice,Party,mongoose} from '../models/index.js';
import {REPORT_BRAND as B} from '../config/brand.js';
import {pdfImageBuffer,pdfImageDimensions,pdfImageType} from '../utils/assets.js';
import {renderReportPdf} from '../services/report-pdf.js';
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
function periodLabel(q:any){if(!q.from&&!q.to)return'All recorded activity';const from=q.from?new Date(String(q.from)).toLocaleDateString('en-GB',{timeZone:'UTC'}):'Beginning';const to=q.to?new Date(String(q.to)).toLocaleDateString('en-GB',{timeZone:'UTC'}):'Today';return `${from} to ${to}`}
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
function addWorkbookLogo(wb:any,logo:Buffer|null){if(!logo)return;try{const extension=pdfImageType(logo),dimensions=pdfImageDimensions(logo);if(!extension||!dimensions)return;const id=wb.addImage({buffer:logo as any,extension:extension as any});const scale=Math.min(104/dimensions.width,67/dimensions.height);const width=Math.round(dimensions.width*scale),height=Math.round(dimensions.height*scale);wb.eachSheet((ws:any)=>{ws.getCell('G1').value='';ws.addImage(id,{tl:{col:6.15,row:.12},ext:{width,height}})})}catch{}}
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
  const sections=selectedSections(req.query);
  if(!sections.size)return res.status(400).json({message:'Select at least one report section.'});
  const d=await data(req.user._id,req.query),business=req.user.business||{};
  const logo=await pdfImageBuffer(business.logoUrl);
  const pdf=await renderReportPdf(d,business,business.currency||'AED',periodLabel(req.query),logo,sections);
  return sendDownload(res,pdf,'application/pdf','TekBooks-Business-Report.pdf',req.user._id);
});
export default r;
