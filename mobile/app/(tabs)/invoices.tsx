import {useCallback,useMemo,useState} from 'react';
import {Alert,Linking,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import * as Print from 'expo-print';
import {api,API_URL,uploadAsset,deleteUploadedAsset,absoluteAssetUrl} from '@/lib/api';
import {APP_CONFIG,PAYMENT_METHODS} from '@/config/app';
import {useSession} from '@/lib/session';
import {typography,useTheme} from '@/lib/theme';
import {AppBackground,Button,DetailModal,EmptyState,Field,GlassCard,InfoRow,Money,Notice,Pill,ScreenHeader,SectionTitle,SelectField,useResponsivePage} from '@/components/UI';

type Line={id:string;description:string;qty:string;unitPrice:string;vatPercent:string};
const newLine=(vat=String(APP_CONFIG.businessDefaults.vatPercent)):Line=>({id:`${Date.now()}-${Math.random()}`,description:'',qty:'1',unitPrice:'',vatPercent:vat});
const dueOptions=[7,15,30,45,60].map(x=>({key:String(x),label:`${x} days`,meta:`Due ${x} days after issue date`}));
const openingStatusOptions=[
  {key:'UNPAID',label:'Unpaid',meta:'Nothing has been received yet'},
  {key:'PARTIAL',label:'Partially paid',meta:'Record an amount already received'},
  {key:'PAID',label:'Paid in full',meta:'The complete invoice value has already been received'},
];

export default function Invoices(){
  const[list,setList]=useState<any[]>([]),[customers,setCustomers]=useState<any[]>([]),[show,setShow]=useState(false),[selected,setSelected]=useState<any>(null),[filter,setFilter]=useState('ALL');
  const[lines,setLines]=useState<Line[]>([newLine()]),[discountPercent,setDiscountPercent]=useState('0'),[customerId,setCustomerId]=useState(''),[dueDays,setDueDays]=useState(String(APP_CONFIG.businessDefaults.invoiceDueDays)),[notes,setNotes]=useState('Thank you for your business.'),[attachment,setAttachment]=useState<any>(null),[saving,setSaving]=useState(false);
  const[openingStatus,setOpeningStatus]=useState('UNPAID'),[openingPaidAmount,setOpeningPaidAmount]=useState(''),[openingPaymentMethod,setOpeningPaymentMethod]=useState<string>(PAYMENT_METHODS[1]),[openingPaymentNotes,setOpeningPaymentNotes]=useState('');
  const[paymentAmount,setPaymentAmount]=useState(''),[paymentMethod,setPaymentMethod]=useState<string>(PAYMENT_METHODS[1]),[paymentNotes,setPaymentNotes]=useState(''),[paying,setPaying]=useState(false);
  const[showCustomer,setShowCustomer]=useState(false),[customerName,setCustomerName]=useState(''),[customerEmail,setCustomerEmail]=useState(''),[customerPhone,setCustomerPhone]=useState(''),[customerAddress,setCustomerAddress]=useState(''),[customerTrn,setCustomerTrn]=useState(''),[savingCustomer,setSavingCustomer]=useState(false);
  const{user}=useSession();const{colors}=useTheme();const page=useResponsivePage(true);

  async function load(){
    const[a,b]=await Promise.all([api('/invoices'),api('/parties?type=CUSTOMER')]);
    setList(a);setCustomers(b);
    if(!customerId&&b[0])setCustomerId(b[0]._id);
  }
  useFocusEffect(useCallback(()=>{load().catch(()=>{})},[]));

  function patchLine(id:string,key:keyof Line,value:string){setLines(v=>v.map(x=>x.id===id?{...x,[key]:value}:x))}
  async function pick(){try{const x=await DocumentPicker.getDocumentAsync({type:['image/*','application/pdf'],copyToCacheDirectory:true});if(!x.canceled){const next=await uploadAsset(x.assets[0] as any);if(attachment)await deleteUploadedAsset(attachment);setAttachment(next)}}catch(e:any){Alert.alert('Attachment unavailable',e.message)}}
  function reset(){const vat=String(user?.business?.vatPercent??APP_CONFIG.businessDefaults.vatPercent);setLines([newLine(vat)]);setDiscountPercent('0');setAttachment(null);setNotes('Thank you for your business.');setDueDays(String(APP_CONFIG.businessDefaults.invoiceDueDays));setOpeningStatus('UNPAID');setOpeningPaidAmount('');setOpeningPaymentMethod(PAYMENT_METHODS[1]);setOpeningPaymentNotes('')}

  async function createCustomer(){
    if(!customerName.trim())return Alert.alert('Customer name required','Enter the customer or business name.');
    if(customerEmail.trim()&&!/^\S+@\S+\.\S+$/.test(customerEmail.trim()))return Alert.alert('Check email address','Enter a valid email address or leave it blank.');
    setSavingCustomer(true);
    try{
      const created=await api('/parties',{method:'POST',headers:{'Idempotency-Key':`${Date.now()}-${Math.random()}`},body:JSON.stringify({type:'CUSTOMER',name:customerName.trim(),email:customerEmail.trim(),phone:customerPhone.trim(),address:customerAddress.trim(),trn:customerTrn.trim()})});
      setCustomers(v=>[...v,created].sort((a,b)=>String(a.name).localeCompare(String(b.name))));setCustomerId(created._id);setShowCustomer(false);setCustomerName('');setCustomerEmail('');setCustomerPhone('');setCustomerAddress('');setCustomerTrn('');
      Alert.alert('Customer ready',`${created.name} is selected for this invoice.`);
    }catch(e:any){Alert.alert('Customer not added',e.message)}finally{setSavingCustomer(false)}
  }

  async function create(){
    if(!customerId)return Alert.alert('Customer required','Select a customer or use “Add new customer” without leaving this invoice.');
    if(lines.some(l=>!l.description.trim()||Number(l.qty)<=0||Number(l.unitPrice)<0||l.unitPrice===''))return Alert.alert('Check line items','Every line needs a description, quantity and valid unit price.');
    if(Number(discountPercent||0)<0||Number(discountPercent||0)>100)return Alert.alert('Check discount','Discount percentage must be between 0% and 100%.');
    if(openingStatus==='PARTIAL'&&Number(openingPaidAmount)<=0)return Alert.alert('Opening payment required','Enter the amount already received for a partially paid invoice.');
    if(openingStatus==='PARTIAL'&&draftTotal>0&&Number(openingPaidAmount)>=draftTotal)return Alert.alert('Partial payment is too high','The opening payment must be lower than the invoice total. Choose Paid in full when the whole invoice has been received.');
    setSaving(true);
    try{
      const now=new Date(),due=new Date(Date.now()+Math.max(0,Number(dueDays)||0)*86400000);
      await api('/invoices',{method:'POST',headers:{'Idempotency-Key':`${Date.now()}-${Math.random()}`},body:JSON.stringify({customerId,issueDate:now,dueDate:due,discountPercent:Number(discountPercent||0),notes:notes.trim()||undefined,attachment:attachment||undefined,openingStatus,openingPaidAmount:Number(openingPaidAmount||0),openingPaymentMethod,openingPaymentNotes,lines:lines.map(l=>({description:l.description.trim(),qty:Number(l.qty),unitPrice:Number(l.unitPrice),vatPercent:Number(l.vatPercent||user?.business?.vatPercent||APP_CONFIG.businessDefaults.vatPercent)}))})});
      setShow(false);reset();await load();Alert.alert('Invoice created','The invoice is ready to open, print, share or receive payment.');
    }catch(e:any){Alert.alert('Invoice not created',e.message)}finally{setSaving(false)}
  }

  async function pdfReady(inv:any){
    const check=await api(`/invoices/${inv._id}/pdf-check`);
    if(!check?.ok){const reasons=(check?.issues||['The invoice is not ready for PDF generation.']).map((x:string)=>`• ${x}`).join('\n');throw new Error(reasons)}
    return check;
  }
  async function downloadPdf(inv:any){
    const check=await pdfReady(inv);
    const token=await SecureStore.getItemAsync('tekbooks_token');const dir=FileSystem.cacheDirectory||FileSystem.documentDirectory||'';const out=`${dir}${inv.invoiceNumber}.pdf`;
    const result=await FileSystem.downloadAsync(`${API_URL}/invoices/${inv._id}/pdf`,out,{headers:{Authorization:`Bearer ${token}`}});
    if(result.status!==200)throw new Error(`The PDF service returned HTTP ${result.status}. ${check?.warnings?.length?check.warnings.join(' '):'Open the invoice and check its company/customer information.'}`);
    return out;
  }
  async function sharePdf(inv:any){try{const out=await downloadPdf(inv);if(await Sharing.isAvailableAsync())await Sharing.shareAsync(out,{mimeType:'application/pdf',dialogTitle:`Share ${inv.invoiceNumber}`});else Alert.alert('Invoice saved',out)}catch(e:any){Alert.alert('Invoice PDF could not be generated',e.message||'Unknown PDF error')}}
  async function printPdf(inv:any){try{const out=await downloadPdf(inv);await Print.printAsync({uri:out})}catch(e:any){Alert.alert('Invoice could not be printed',e.message||'Unknown PDF error')}}

  async function recordPayment(){
    if(!selected||Number(paymentAmount)<=0)return Alert.alert('Payment amount required','Enter the amount received.');
    if(Number(paymentAmount)>Number(selected.balance||0)+0.001)return Alert.alert('Payment exceeds balance',`The current outstanding balance is ${currency} ${Number(selected.balance||0).toFixed(2)}.`);
    setPaying(true);
    try{const x=await api(`/invoices/${selected._id}/payments`,{method:'POST',headers:{'Idempotency-Key':`${Date.now()}-${Math.random()}`},body:JSON.stringify({amount:Number(paymentAmount),date:new Date(),method:paymentMethod,notes:paymentNotes})});setSelected(x);setPaymentAmount('');setPaymentNotes('');await load();Alert.alert('Payment recorded','The outstanding balance and invoice status are now up to date.')}catch(e:any){Alert.alert('Payment not recorded',e.message)}finally{setPaying(false)}
  }
  function deleteInvoice(){if(!selected)return;const invoice=selected;Alert.alert('Delete invoice?',`Delete ${invoice.invoiceNumber}? This permanently removes the invoice and payment history. The invoice number will not be reused.`,[{text:'Cancel',style:'cancel'},{text:'Delete invoice',style:'destructive',onPress:async()=>{try{await api(`/invoices/${invoice._id}`,{method:'DELETE'});setSelected(null);await load();Alert.alert('Invoice deleted',`${invoice.invoiceNumber} has been removed.`)}catch(e:any){Alert.alert('Invoice not deleted',e.message)}}}])}

  const currency=user?.business?.currency||APP_CONFIG.businessDefaults.currency;const shown=filter==='ALL'?list:list.filter(x=>x.status===filter);
  const totals=useMemo(()=>({billed:list.reduce((s,x)=>s+Number(x.total||0),0),outstanding:list.reduce((s,x)=>s+Number(x.balance||0),0),paid:list.reduce((s,x)=>s+Number(x.paidAmount||0),0)}),[list]);
  const draft=useMemo(()=>{const mapped=lines.map(l=>({amount:Math.max(0,Number(l.qty)||0)*Math.max(0,Number(l.unitPrice)||0),vatPercent:Math.max(0,Number(l.vatPercent)||0)}));const subtotal=mapped.reduce((sum,l)=>sum+l.amount,0),pct=Math.min(100,Math.max(0,Number(discountPercent)||0)),discountAmount=subtotal*(pct/100),taxable=Math.max(0,subtotal-discountAmount),weightedVat=mapped.reduce((sum,l)=>sum+l.amount*(l.vatPercent/100),0),vat=subtotal?weightedVat*(taxable/subtotal):0;return{subtotal,discountAmount,vat,total:taxable+vat}},[lines,discountPercent]);
  const draftTotal=draft.total;const customerOptions=customers.map(c=>({key:c._id,label:c.name,meta:[c.email,c.phone,c.trn?`TRN ${c.trn}`:''].filter(Boolean).join(' • ')}));

  return <AppBackground><ScrollView style={{flex:1}} contentContainerStyle={[s.content,page]} keyboardShouldPersistTaps="handled">
    <ScreenHeader title={APP_CONFIG.copy.invoicesTitle} subtitle={APP_CONFIG.copy.invoicesSubtitle} right={<TouchableOpacity style={[s.add,{backgroundColor:colors.primary,borderColor:colors.borderStrong}]} onPress={()=>setShow(!show)}><Ionicons name={show?'close':'add'} size={24} color={colors.onPrimary}/></TouchableOpacity>}/>

    <View style={s.summaryGrid}><SummaryMetric label="Billed" value={totals.billed} currency={currency}/><SummaryMetric label="Collected" value={totals.paid} currency={currency} tone="income"/><SummaryMetric label="Outstanding" value={totals.outstanding} currency={currency} tone={totals.outstanding>0?'expense':'default'}/></View>

    {show?<GlassCard style={s.formCard}>
      <SectionTitle title="Bill to" subtitle="Choose a saved customer or create one here" right={<TouchableOpacity onPress={()=>setShowCustomer(true)} style={[s.inlineAction,{borderColor:colors.borderStrong,backgroundColor:colors.accentSoft}]}><Ionicons name="person-add-outline" size={15} color={colors.primary}/><Text style={[typography.medium,{fontSize:10.5,color:colors.primary}]}>New customer</Text></TouchableOpacity>}/>
      {customerOptions.length?<SelectField label="Customer" value={customerId} options={customerOptions} onChange={setCustomerId} placeholder="Choose customer"/>:<Notice tone="info" title={APP_CONFIG.copy.noCustomersTitle} body={APP_CONFIG.copy.noCustomersBody}/>}
      {!customerOptions.length?<Button secondary icon="person-add-outline" title="Add first customer" onPress={()=>setShowCustomer(true)}/>:null}

      <SectionTitle title="Invoice terms" subtitle="Set due period, discount and opening payment status"/>
      <SelectField label="Payment due" value={dueDays} options={dueOptions} onChange={setDueDays}/>
      <View style={{height:10}}/><Field label="Discount % (optional)" value={discountPercent} onChangeText={setDiscountPercent} keyboardType="decimal-pad" placeholder="0" helper="Percentage discount applied before VAT • 0 to 100%"/>

      <SectionTitle title="Line items" subtitle="Products or services being billed"/>
      <View style={{gap:10}}>{lines.map((l,i)=><View key={l.id} style={[s.lineBox,{borderColor:colors.border,backgroundColor:colors.surfaceMuted}]}>
        <View style={s.lineHead}><Text style={[typography.medium,{fontSize:12,color:colors.text}]}>Item {i+1}</Text>{lines.length>1?<TouchableOpacity onPress={()=>setLines(v=>v.filter(x=>x.id!==l.id))} style={[s.smallIcon,{backgroundColor:colors.dangerSoft}]}><Ionicons name="trash-outline" size={16} color={colors.danger}/></TouchableOpacity>:null}</View>
        <Field label="Description" value={l.description} onChangeText={v=>patchLine(l.id,'description',v)} placeholder="Product or service"/>
        <View style={s.twoCol}><View style={{flex:1,minWidth:0}}><Field label="Quantity" value={l.qty} onChangeText={v=>patchLine(l.id,'qty',v)} keyboardType="decimal-pad"/></View><View style={{flex:1.45,minWidth:0}}><Field label={`Price (${currency})`} value={l.unitPrice} onChangeText={v=>patchLine(l.id,'unitPrice',v)} keyboardType="decimal-pad" placeholder="0.00"/></View></View>
        <Field label="VAT % (optional)" helper="Leave blank to use the company default VAT rate" value={l.vatPercent} onChangeText={v=>patchLine(l.id,'vatPercent',v)} keyboardType="decimal-pad"/>
      </View>)}</View>
      <View style={{marginTop:10}}><Button secondary icon="add-circle-outline" title="Add another line" onPress={()=>setLines(v=>[...v,newLine(String(user?.business?.vatPercent??APP_CONFIG.businessDefaults.vatPercent))])}/></View>
      <View style={[s.draftBox,{backgroundColor:colors.accentSoft,borderColor:colors.borderStrong}]}><View style={{flex:1,minWidth:0}}><Text style={[typography.medium,{fontSize:12,color:colors.text}]}>Invoice preview</Text><Text style={[typography.regular,{fontSize:10,color:colors.textMuted,marginTop:3}]}>Subtotal {currency} {draft.subtotal.toFixed(2)} • Discount {discountPercent||'0'}% • VAT {currency} {draft.vat.toFixed(2)}</Text></View><Money value={draft.total} currency={currency}/></View>

      <SectionTitle title="Payment status" subtitle="Only use opening payment when money was already received"/>
      <SelectField label="Status at creation" value={openingStatus} options={openingStatusOptions} onChange={v=>{setOpeningStatus(v);if(v==='UNPAID')setOpeningPaidAmount('')}}/>
      {openingStatus==='PARTIAL'?<View style={{marginTop:10}}><Field label={`Amount already received (${currency})`} value={openingPaidAmount} onChangeText={setOpeningPaidAmount} keyboardType="decimal-pad" placeholder="0.00" helper={draftTotal>0?`Must be below ${currency} ${draftTotal.toFixed(2)}`:undefined}/></View>:null}
      {openingStatus!=='UNPAID'?<View style={{gap:10,marginTop:10}}><SelectField label="Opening payment method" value={openingPaymentMethod} options={PAYMENT_METHODS.map(x=>({key:x,label:x}))} onChange={setOpeningPaymentMethod}/><Field label="Opening payment note (optional)" value={openingPaymentNotes} onChangeText={setOpeningPaymentNotes} placeholder="Optional receipt or reference"/></View>:null}

      <SectionTitle title="Notes & attachment" subtitle="Both are optional"/>
      <Field label="Notes / payment terms (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Optional payment terms or message"/>
      <View style={{marginTop:10}}><Button secondary icon="attach" title={attachment?`Replace: ${attachment.name}`:'Add supporting document (optional)'} onPress={pick}/></View>
      {attachment?<View style={[s.attachmentRow,{borderColor:colors.border,backgroundColor:colors.surfaceMuted}]}><Ionicons name="document-attach-outline" size={18} color={colors.primary}/><Text numberOfLines={1} style={[typography.medium,{fontSize:11.5,color:colors.text,flex:1}]}>{attachment.name||'Supporting document'}</Text><TouchableOpacity onPress={async()=>{await deleteUploadedAsset(attachment);setAttachment(null)}}><Ionicons name="close-circle" size={21} color={colors.textMuted}/></TouchableOpacity></View>:null}
      <View style={{marginTop:10}}><Button title="Create invoice" onPress={create} loading={saving}/></View>
    </GlassCard>:null}

    <View style={s.filters}>{['ALL','UNPAID','PARTIAL','PAID'].map(x=><Filter key={x} text={x==='ALL'?'All':x[0]+x.slice(1).toLowerCase()} active={filter===x} onPress={()=>setFilter(x)}/>)}</View>
    {shown.length?<View style={{gap:10}}>{shown.map(x=><InvoiceCard key={x._id} invoice={x} currency={currency} onPress={()=>{setSelected(x);setPaymentAmount(String(Number(x.balance||0).toFixed(2)))}}/>)}</View>:<GlassCard><EmptyState icon="document-text-outline" title="No invoices in this view" body={filter==='ALL'?'Create your first customer invoice when you are ready to bill.':`No ${filter.toLowerCase()} invoices right now.`}/></GlassCard>}
  </ScrollView>

  <DetailModal visible={!!selected} onClose={()=>setSelected(null)} title={selected?.invoiceNumber||'Invoice'} subtitle={selected?.customerSnapshot?.name} footer={selected?<View style={{gap:8}}>{selected.balance>0?<Button icon="card-outline" title="Record payment" onPress={recordPayment} loading={paying} compact/>:null}<Button secondary icon="share-social-outline" title="Share PDF" onPress={()=>sharePdf(selected)} compact/><Button secondary icon="print-outline" title="Print invoice" onPress={()=>printPdf(selected)} compact/><Button danger icon="trash-outline" title="Delete invoice" onPress={deleteInvoice} compact/></View>:undefined}>
    {selected?<>
      <View style={[s.invoiceHero,{backgroundColor:selected.status==='PAID'?colors.successSoft:selected.status==='PARTIAL'?colors.warningSoft:colors.dangerSoft,borderColor:colors.border}]}><View style={{flex:1,minWidth:0}}><Text style={[s.detailKicker,typography.medium,{color:colors.textMuted}]}>INVOICE TOTAL</Text><Money value={selected.total} currency={currency} size="lg"/></View><Pill text={selected.status} tone={selected.status==='PAID'?'green':selected.status==='PARTIAL'?'amber':'red'}/></View>
      <InfoRow label="Customer" value={selected.customerSnapshot?.name||'—'}/><InfoRow label="Issue date" value={new Date(selected.issueDate).toLocaleDateString()}/><InfoRow label="Due date" value={new Date(selected.dueDate).toLocaleDateString()}/><InfoRow label="Subtotal" value={<Money value={selected.subtotal} currency={currency} size="sm"/>}/><InfoRow label={`Discount (${Number(selected.discountPercent??(selected.subtotal?Number(selected.discount||0)/Number(selected.subtotal)*100:0)).toFixed(2).replace(/\.00$/,'')}%)`} value={<Money value={selected.discount} currency={currency} size="sm"/>}/><InfoRow label="VAT" value={<Money value={selected.vatAmount} currency={currency} size="sm"/>}/><InfoRow label="Paid" value={<Money value={selected.paidAmount} currency={currency} size="sm" tone="income"/>}/><InfoRow label="Balance" value={<Money value={selected.balance} currency={currency} size="sm" tone={selected.balance>0?'expense':'default'}/>} strong/>
      {selected.attachment?<View style={{marginTop:12}}><Button secondary icon="document-attach-outline" title={`Open ${selected.attachment.name||'invoice attachment'}`} onPress={()=>Linking.openURL(absoluteAssetUrl(selected.attachment.url))}/></View>:null}
      <Text style={[s.detailSection,typography.medium,{color:colors.text}]}>Line items</Text>{(selected.lines||[]).map((l:any,i:number)=><View key={`${l.description}-${i}`} style={[s.detailLine,{borderBottomColor:colors.border}]}><View style={{flex:1,minWidth:0}}><Text style={[typography.medium,{fontSize:12,color:colors.text}]}>{l.description}</Text><Text style={[typography.regular,{fontSize:10,color:colors.textMuted,marginTop:3,lineHeight:15}]}>{l.qty} × {currency} {Number(l.unitPrice).toFixed(2)} • VAT {l.vatPercent}%</Text></View><Money value={l.amount} currency={currency} size="sm" style={{maxWidth:125}}/></View>)}
      {selected.payments?.length?<><Text style={[s.detailSection,typography.medium,{color:colors.text}]}>Payment history</Text>{selected.payments.map((p:any,i:number)=><View key={p._id||i} style={[s.detailLine,{borderBottomColor:colors.border}]}><View style={{flex:1,minWidth:0}}><Text style={[typography.medium,{fontSize:12,color:colors.text}]}>{p.method}</Text><Text style={[typography.regular,{fontSize:10,color:colors.textMuted,marginTop:3,lineHeight:15}]}>{new Date(p.date).toLocaleDateString()}{p.notes?` • ${p.notes}`:''}</Text></View><Money value={p.amount} currency={currency} size="sm" tone="income" style={{maxWidth:125}}/></View>)}</>:null}
      {selected.notes?<><Text style={[s.detailSection,typography.medium,{color:colors.text}]}>Notes / terms</Text><Notice title="Invoice note" body={selected.notes}/></>:null}
      {selected.balance>0?<><Text style={[s.detailSection,typography.medium,{color:colors.text}]}>Record payment</Text><Field label={`Amount (${currency})`} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" helper={`Outstanding: ${currency} ${Number(selected.balance||0).toFixed(2)}`}/><View style={{height:10}}/><SelectField label="Payment method" value={paymentMethod} options={PAYMENT_METHODS.map(x=>({key:x,label:x}))} onChange={setPaymentMethod}/><View style={{height:10}}/><Field label="Payment note (optional)" value={paymentNotes} onChangeText={setPaymentNotes} placeholder="Optional reference"/></>:null}
    </>:null}
  </DetailModal>

  <DetailModal visible={showCustomer} onClose={()=>setShowCustomer(false)} title="Add customer" subtitle="Save and select the customer for this invoice" footer={<Button title="Save & use customer" onPress={createCustomer} loading={savingCustomer}/>}>
    <View style={{gap:11}}><Field label="Customer / business name" value={customerName} onChangeText={setCustomerName} placeholder="Required"/><Field label="Email (optional)" value={customerEmail} onChangeText={setCustomerEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Optional"/><Field label="Phone (optional)" value={customerPhone} onChangeText={setCustomerPhone} placeholder="Optional"/><Field label="Address (optional)" value={customerAddress} onChangeText={setCustomerAddress} multiline placeholder="Optional"/><Field label="TRN (optional)" value={customerTrn} onChangeText={setCustomerTrn} placeholder="Optional"/></View>
  </DetailModal>
  </AppBackground>;
}

function SummaryMetric({label,value,currency,tone='default'}:{label:string;value:number;currency:string;tone?:'default'|'income'|'expense'}){const{colors}=useTheme();return <GlassCard style={s.sum}><Text style={[s.sumLabel,typography.regular,{color:colors.textMuted}]}>{label}</Text><Money value={value} currency={currency} tone={tone} size="sm"/></GlassCard>}
function InvoiceCard({invoice,currency,onPress}:{invoice:any;currency:string;onPress:()=>void}){const{colors}=useTheme();const overdue=Number(invoice.balance)>0&&new Date(invoice.dueDate)<new Date();return <TouchableOpacity activeOpacity={.78} onPress={onPress} style={[s.invoiceCard,{borderColor:overdue?colors.danger:colors.border,backgroundColor:colors.surfaceStrong}]}>
  <View style={s.cardTop}><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={[s.inv,typography.medium,{color:colors.text}]}>{invoice.invoiceNumber}</Text><Text numberOfLines={1} style={[s.customer,typography.medium,{color:colors.text}]}>{invoice.customerSnapshot?.name||'Customer'}</Text></View><Pill text={overdue?'OVERDUE':invoice.status} tone={overdue?'red':invoice.status==='PAID'?'green':invoice.status==='PARTIAL'?'amber':'red'}/></View>
  <View style={s.cardMeta}><Ionicons name="calendar-outline" size={14} color={colors.textSoft}/><Text style={[typography.regular,{fontSize:10.5,color:colors.textMuted,flex:1}]}>Issued {new Date(invoice.issueDate).toLocaleDateString()} • Due {new Date(invoice.dueDate).toLocaleDateString()}</Text></View>
  <View style={[s.amountStrip,{borderTopColor:colors.border}]}><View style={{flex:1,minWidth:0}}><Text style={[s.amountLabel,typography.regular,{color:colors.textMuted}]}>Invoice total</Text><Money value={invoice.total} currency={currency} size="sm"/></View><View style={{width:1,height:34,backgroundColor:colors.border}}/><View style={{flex:1,minWidth:0,alignItems:'flex-end'}}><Text style={[s.amountLabel,typography.regular,{color:colors.textMuted}]}>Balance due</Text><Money value={invoice.balance} currency={currency} size="sm" tone={invoice.balance>0?'expense':'default'} style={{textAlign:'right'}}/></View><Ionicons name="chevron-forward" size={17} color={colors.textSoft}/></View>
</TouchableOpacity>}
function Filter({text,active,onPress}:{text:string;active:boolean;onPress:()=>void}){const{colors}=useTheme();return <TouchableOpacity onPress={onPress} style={[s.filter,{backgroundColor:active?colors.primary:colors.surfaceStrong,borderColor:active?colors.primary:colors.border}]}><Text style={[typography.medium,{fontSize:10,color:active?colors.onPrimary:colors.textMuted}]}>{text}</Text></TouchableOpacity>}

const s=StyleSheet.create({
  content:{padding:20,paddingTop:58,paddingBottom:118},add:{width:46,height:46,borderRadius:16,alignItems:'center',justifyContent:'center',borderWidth:1},
  summaryGrid:{flexDirection:'row',gap:8,marginBottom:14},sum:{flex:1,minWidth:0,padding:13,minHeight:74,justifyContent:'space-between'},sumLabel:{fontSize:10.5},formCard:{gap:0,marginBottom:16},
  inlineAction:{borderWidth:1,borderRadius:999,paddingHorizontal:10,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:5},attachmentRow:{borderWidth:1,borderRadius:13,padding:10,flexDirection:'row',alignItems:'center',gap:9,marginTop:8},lineBox:{borderWidth:1,borderRadius:18,padding:12,gap:10},lineHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},smallIcon:{width:32,height:32,borderRadius:11,alignItems:'center',justifyContent:'center'},twoCol:{flexDirection:'row',gap:9},draftBox:{marginTop:12,borderWidth:1,borderRadius:17,padding:13,flexDirection:'row',alignItems:'center',gap:10},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:14,marginBottom:12},filter:{borderWidth:1,borderRadius:999,paddingHorizontal:12,paddingVertical:8},invoiceCard:{borderWidth:StyleSheet.hairlineWidth,borderRadius:22,padding:15},cardTop:{flexDirection:'row',alignItems:'flex-start',gap:10},inv:{fontSize:13},customer:{fontSize:15,marginTop:4},cardMeta:{flexDirection:'row',alignItems:'center',gap:6,marginTop:11},amountStrip:{borderTopWidth:1,marginTop:13,paddingTop:12,flexDirection:'row',alignItems:'center',gap:11},amountLabel:{fontSize:9.5,marginBottom:4},
  invoiceHero:{borderRadius:20,padding:16,flexDirection:'row',alignItems:'center',gap:12,marginBottom:10,borderWidth:1},detailKicker:{fontSize:9,letterSpacing:1.3,marginBottom:4},detailSection:{fontSize:14,marginTop:20,marginBottom:7},detailLine:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:11,borderBottomWidth:1}
});
