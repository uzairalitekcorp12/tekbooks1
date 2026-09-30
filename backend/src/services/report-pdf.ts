import PDFDocument from 'pdfkit';
import {REPORT_BRAND as B} from '../config/brand.js';
import {pdfImageDimensions} from '../utils/assets.js';

const LEFT=40,RIGHT=555,WIDTH=RIGHT-LEFT,CONTENT_BOTTOM=752;
const DARK='#103B38',INK='#17332F',MUTED='#5E726E',LINE='#D9E6E2',PALE='#F3F8F6',TEAL='#087E6D';
type Column={label:string;width:number;align?:'left'|'right'};
type Row={cells:string[];detail?:string;emphasis?:boolean;tone?:string};
type ReportContext={doc:PDFKit.PDFDocument;business:any;logo:Buffer|null;period:string;currency:string;generated:string};

function label(value:unknown){return String(value??'').trim()}
function date(value:unknown){const parsed=new Date(value as any);return Number.isFinite(parsed.getTime())?parsed.toLocaleDateString('en-GB',{timeZone:'UTC'}):'—'}
function money(value:unknown,currency:string){return `${currency} ${Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function pageHeader(ctx:ReportContext){
  const {doc,business,logo}=ctx;
  doc.rect(0,0,doc.page.width,8).fill(TEAL);
  const dimensions=logo?pdfImageDimensions(logo):null;
  const landscape=!!dimensions&&dimensions.width/dimensions.height>1.45;
  if(logo){
    const box=landscape?{x:40,y:36,w:112,h:60}:{x:40,y:25,w:84,h:84};
    doc.roundedRect(box.x,box.y,box.w,box.h,7).fill('#FFFFFF');
    try{doc.image(logo,box.x+3,box.y+3,{fit:[box.w-6,box.h-6],align:'center',valign:'center'})}catch{}
  }
  const nameX=logo?(landscape?167:137):40;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK)
    .text(label(business.name||business.legalName||'Business'),nameX,35,{width:330-nameX+40,height:35,ellipsis:true});
  const identity=[business.legalName&&business.legalName!==business.name?business.legalName:null,business.trn?`TRN ${business.trn}`:null].filter(Boolean).join('  |  ');
  if(identity)doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(identity,nameX,68,{width:280,height:27,ellipsis:true});
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEAL).text('TEKBOOKS',435,37,{width:120,align:'right'});
  doc.font('Helvetica').fontSize(7).fillColor(MUTED).text('MANAGEMENT REPORT',410,52,{width:145,align:'right'});
  doc.moveTo(LEFT,115).lineTo(RIGHT,115).strokeColor(LINE).lineWidth(1).stroke();
  doc.font('Helvetica-Bold').fontSize(20).fillColor(DARK).text('Business report',LEFT,128,{width:WIDTH,height:29});
  doc.font('Helvetica').fontSize(8.3).fillColor(MUTED).text(ctx.period,LEFT,158,{width:WIDTH,height:16});
  doc.y=185;
}
function nextPage(ctx:ReportContext){ctx.doc.addPage();pageHeader(ctx)}
function space(ctx:ReportContext,height:number){if(ctx.doc.y+height>CONTENT_BOTTOM){nextPage(ctx);return true}return false}
function section(ctx:ReportContext,title:string,description?:string){
  space(ctx,140);
  const {doc}=ctx,y=doc.y+7;
  doc.rect(LEFT,y+1,3,20).fill(TEAL);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK).text(title,LEFT+14,y,{width:WIDTH-14,height:18,ellipsis:true});
  if(description)doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(description,LEFT+14,y+22,{width:WIDTH-14,height:15,ellipsis:true});
  doc.y=y+(description?47:34);
}
function empty(ctx:ReportContext,message:string){const {doc}=ctx;space(ctx,42);const y=doc.y;doc.roundedRect(LEFT,y,WIDTH,34,5).fill(PALE);doc.font('Helvetica').fontSize(8.3).fillColor(MUTED).text(message,LEFT+11,y+11,{width:WIDTH-22,height:14});doc.y=y+43}
function tableHeader(ctx:ReportContext,columns:Column[]){
  const {doc}=ctx,y=doc.y;
  doc.roundedRect(LEFT,y,WIDTH,27,5).fill(DARK);
  let x=LEFT;
  for(const column of columns){doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF').text(column.label.toUpperCase(),x+9,y+9,{width:column.width-18,height:10,align:column.align||'left',ellipsis:true});x+=column.width}
  doc.y=y+27;
}
function table(ctx:ReportContext,title:string,columns:Column[],rows:Row[],emptyMessage:string){
  if(!rows.length){empty(ctx,emptyMessage);return}
  if(space(ctx,80)){
    ctx.doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(`${title}  |  continued`,LEFT,ctx.doc.y,{width:WIDTH,height:14});
    ctx.doc.y+=23;
  }
  tableHeader(ctx,columns);
  rows.forEach((row,index)=>{
    const height=row.detail?46:34;
    if(ctx.doc.y+height>CONTENT_BOTTOM){nextPage(ctx);ctx.doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(`${title}  |  continued`,LEFT,ctx.doc.y,{width:WIDTH,height:14});ctx.doc.y+=23;tableHeader(ctx,columns)}
    const {doc}=ctx,y=doc.y;
    if(row.emphasis)doc.rect(LEFT,y,WIDTH,height).fill('#E6F4EF');
    else if(index%2===0)doc.rect(LEFT,y,WIDTH,height).fill('#F8FBFA');
    let x=LEFT;
    columns.forEach((column,col)=>{
      doc.font(row.emphasis?'Helvetica-Bold':col===0?'Helvetica-Bold':'Helvetica').fontSize(row.emphasis?8.5:8)
        .fillColor(row.tone&&col===columns.length-1?row.tone:INK)
        .text(label(row.cells[col]),x+9,y+9,{width:column.width-18,height:row.detail?16:20,align:column.align||'left',ellipsis:true});
      x+=column.width;
    });
    if(row.detail)doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(row.detail,LEFT+9,y+27,{width:WIDTH-18,height:12,ellipsis:true});
    doc.moveTo(LEFT,y+height).lineTo(RIGHT,y+height).strokeColor(LINE).lineWidth(.6).stroke();
    doc.y=y+height;
  });
  ctx.doc.y+=13;
}
function summary(ctx:ReportContext,data:any){
  const {doc,currency}=ctx,s=data.summary;
  section(ctx,'At a glance','Key figures for the selected reporting period');space(ctx,110);
  const cards=[{name:'TOTAL INCOME',value:s.income,tone:TEAL},{name:'TOTAL EXPENSES',value:s.expenses,tone:B.danger},{name:'NET RESULT',value:s.profit,tone:s.profit<0?B.danger:TEAL}];
  const y=doc.y;
  cards.forEach((card,index)=>{
    const x=LEFT+index*175;
    doc.roundedRect(x,y,165,87,7).fill(index===2?DARK:PALE);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(index===2?'#B8D8D0':MUTED).text(card.name,x+11,y+15,{width:143,height:12});
    let font=13;const value=money(card.value,currency);doc.font('Helvetica-Bold');while(font>8&&doc.fontSize(font).widthOfString(value)>143)font--;
    doc.fillColor(index===2?'#FFFFFF':card.tone).text(value,x+11,y+43,{width:143,height:22,ellipsis:true});
  });
  doc.y=y+101;
  table(ctx,'At a glance',[{label:'Additional indicator',width:320},{label:'Amount',width:195,align:'right'}],[
    {cells:['Outstanding receivables',money(s.receivables,currency)]},
    {cells:['VAT payable / (recoverable)',money(s.vatPayable,currency)]}
  ],'');
}
function footer(ctx:ReportContext,page:number,total:number){
  const {doc,business}=ctx,y=doc.page.height-53;
  doc.moveTo(LEFT,y-8).lineTo(RIGHT,y-8).strokeColor(LINE).lineWidth(.7).stroke();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(TEAL).text('TekBooks',LEFT,y,{width:80,height:11,lineBreak:false});
  doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(label(business.name||business.legalName||'Business'),120,y,{width:330,height:11,ellipsis:true,lineBreak:false});
  doc.text(`${page} / ${total}`,490,y,{width:65,height:11,align:'right',lineBreak:false});
}

export async function renderReportPdf(data:any,business:any,currency:string,period:string,logo:Buffer|null,sections:Set<string>):Promise<Buffer>{
  const doc=new PDFDocument({margin:40,size:'A4',bufferPages:true,autoFirstPage:true});
  const chunks:Buffer[]=[];
  const completed=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(chunk:Buffer)=>chunks.push(chunk));doc.once('end',()=>resolve(Buffer.concat(chunks)));doc.once('error',reject)});
  try{
    const ctx:ReportContext={doc,business,logo,period,currency,generated:new Date().toLocaleString('en-GB')};
    pageHeader(ctx);
    const metaY=doc.y;doc.roundedRect(LEFT,metaY,WIDTH,54,7).fill(PALE);
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor(MUTED).text('REPORTING PERIOD',LEFT+12,metaY+10,{width:280});
    doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text(period,LEFT+12,metaY+25,{width:310,height:18,ellipsis:true});
    doc.font('Helvetica').fontSize(7.1).fillColor(MUTED).text(`Currency  ${currency}`,LEFT+350,metaY+12,{width:150,align:'right'});
    doc.text(`Prepared  ${ctx.generated}`,LEFT+320,metaY+27,{width:180,align:'right'});doc.y=metaY+71;

    if(sections.has('summary'))summary(ctx,data);
    if(sections.has('profit-loss')){
      section(ctx,'Profit and loss','Income and expenses grouped by category');
      table(ctx,'Income by category',[{label:'Income category',width:325},{label:'Amount',width:190,align:'right'}],
        data.incomeCategories.map((x:any)=>({cells:[x.name,money(x.total,currency)]})), 'No income recorded in this period.');
      table(ctx,'Expenses by category',[{label:'Expense category',width:325},{label:'Amount',width:190,align:'right'}],
        data.expenseCategories.map((x:any)=>({cells:[x.name,money(x.total,currency)]})), 'No expenses recorded in this period.');
      table(ctx,'Profit and loss',[{label:'Result',width:325},{label:'Amount',width:190,align:'right'}],[
        {cells:['Total income',money(data.summary.income,currency)],emphasis:true},
        {cells:['Total expenses',money(data.summary.expenses,currency)],emphasis:true},
        {cells:['Net profit / (loss)',money(data.summary.profit,currency)],emphasis:true,tone:data.summary.profit<0?B.danger:TEAL}
      ],'');
    }
    if(sections.has('income')){
      section(ctx,'Income',`${data.incomeTx.length} recorded transaction${data.incomeTx.length===1?'':'s'}`);
      table(ctx,'Income',[{label:'Date / category',width:180},{label:'Payment / party',width:205},{label:'Amount',width:130,align:'right'}],
        data.incomeTx.map((x:any)=>({cells:[`${date(x.date)}  ${label(x.category)}`,label(x.partyName||x.paymentMethod||'—'),money(x.amount,currency)],detail:[x.partyName?x.paymentMethod:null,x.vatAmount?`VAT ${money(x.vatAmount,currency)}`:null,x.notes].filter(Boolean).join('  |  ')||undefined})),
        'No income transactions in this period.');
    }
    if(sections.has('expenses')){
      section(ctx,'Expenses',`${data.expenseTx.length} recorded transaction${data.expenseTx.length===1?'':'s'}`);
      table(ctx,'Expenses',[{label:'Date / category',width:180},{label:'Payment / party',width:205},{label:'Amount',width:130,align:'right'}],
        data.expenseTx.map((x:any)=>({cells:[`${date(x.date)}  ${label(x.category)}`,label(x.partyName||x.paymentMethod||'—'),money(x.amount,currency)],detail:[x.partyName?x.paymentMethod:null,x.vatAmount?`VAT ${money(x.vatAmount,currency)}`:null,x.notes].filter(Boolean).join('  |  ')||undefined})),
        'No expense transactions in this period.');
    }
    if(sections.has('receivables')){
      section(ctx,'Outstanding receivables','Open customer balances, ordered by due date');
      table(ctx,'Outstanding receivables',[{label:'Invoice',width:133},{label:'Customer / due date',width:245},{label:'Outstanding',width:137,align:'right'}],
        data.receivables.map((x:any)=>({cells:[label(x.invoiceNumber),`${label(x.customerSnapshot?.name||'Customer')}  |  ${date(x.dueDate)}`,money(x.balance,currency)],detail:`Total ${money(x.total,currency)}  |  Paid ${money(x.paidAmount,currency)}`,tone:new Date(x.dueDate)<new Date()?B.danger:TEAL})),
        'No outstanding receivables.');
    }
    if(sections.has('customers')){
      section(ctx,'Customer statements','Billed, paid and outstanding balances by customer');
      table(ctx,'Customer statements',[{label:'Customer',width:205},{label:'Billed / paid',width:175},{label:'Outstanding',width:135,align:'right'}],
        data.customerStatements.map((x:any)=>({cells:[label(x.party.name),`${money(x.totalBilled,currency)} / ${money(x.paid,currency)}`,money(x.outstanding,currency)],detail:[x.party.trn?`TRN ${x.party.trn}`:null,`${x.transactions} linked transaction${x.transactions===1?'':'s'}`].filter(Boolean).join('  |  ')})),
        'No customers in this workspace.');
    }
    if(sections.has('suppliers')){
      section(ctx,'Supplier statements','Recorded expenses and transaction count by supplier');
      table(ctx,'Supplier statements',[{label:'Supplier',width:260},{label:'Transactions',width:95,align:'right'},{label:'Recorded business',width:160,align:'right'}],
        data.supplierStatements.map((x:any)=>({cells:[label(x.party.name),String(x.transactions),money(x.totalBusiness,currency)],detail:x.party.trn?`TRN ${x.party.trn}`:undefined})),
        'No suppliers in this workspace.');
    }
    if(sections.has('vat')){
      section(ctx,'VAT position','Recorded VAT summary; confirm filing treatment before submission');
      table(ctx,'VAT position',[{label:'VAT measure',width:325},{label:'Amount',width:190,align:'right'}],[
        {cells:['Output VAT on invoices',money(data.summary.outputVat,currency)]},
        {cells:['Input VAT on expenses',money(data.summary.inputVat,currency)]},
        {cells:['VAT payable / (recoverable)',money(data.summary.vatPayable,currency)],emphasis:true,tone:data.summary.vatPayable<0?B.danger:TEAL}
      ],'');
    }
    const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);footer(ctx,i+1,pages.count)}
    doc.end();return completed;
  }catch(error){doc.destroy();throw error}
}
