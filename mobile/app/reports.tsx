import {useEffect,useMemo,useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import {api} from '@/lib/api';
import {downloadProtectedFile} from '@/lib/files';
import {APP_CONFIG,REPORT_SECTIONS} from '@/config/app';
import {typography,useTheme} from '@/lib/theme';
import {SmartImage} from '@/components/Media';
import {AppBackground,Button,GlassCard,IconButton,InfoRow,Money,ScreenHeader,SectionTitle,SelectField,useResponsivePage} from '@/components/UI';
import {useSession} from '@/lib/session';

export default function Reports(){
  const[d,setD]=useState<any>({}),[period,setPeriod]=useState('ALL'),[loading,setLoading]=useState(false),[exporting,setExporting]=useState('');
  const[selected,setSelected]=useState<string[]>(REPORT_SECTIONS.map(x=>x.key));
  const{user}=useSession();const{colors}=useTheme();const page=useResponsivePage(false);
  const query=useMemo(()=>{const now=new Date();if(period==='MONTH'){const from=new Date(now.getFullYear(),now.getMonth(),1).toISOString();return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(now.toISOString())}`}if(period==='YEAR'){const from=new Date(now.getFullYear(),0,1).toISOString();return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(now.toISOString())}`}return ''},[period]);
  const exportQuery=useMemo(()=>`${query}${query?'&':'?'}sections=${encodeURIComponent(selected.join(','))}`,[query,selected]);
  async function load(){setLoading(true);try{setD(await api(`/reports/summary${query}`))}catch(e:any){Alert.alert('Reports unavailable',e.message)}finally{setLoading(false)}}useEffect(()=>{load()},[query]);
  function toggle(key:string){setSelected(v=>v.includes(key)?v.filter(x=>x!==key):[...v,key])}
  async function download(kind:'pdf'|'xlsx'){
    if(!selected.length)return Alert.alert('Choose report sections','Select at least one section before exporting.');
    setExporting(kind);try{const name=`${(user?.business?.name||'Business').replace(/[^a-z0-9]+/gi,'-')}-${APP_CONFIG.name}-Report.${kind}`;const out=await downloadProtectedFile(`/reports/export.${kind}${exportQuery}`,name);if(await Sharing.isAvailableAsync())await Sharing.shareAsync(out,{mimeType:kind==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',dialogTitle:`Share ${name}`});else Alert.alert('Report saved',out)}catch(e:any){Alert.alert('Export unavailable',e.message)}finally{setExporting('')}
  }
  const currency=user?.business?.currency||APP_CONFIG.businessDefaults.currency;const logo=user?.business?.logoUrl;const allSelected=selected.length===REPORT_SECTIONS.length;
  return <AppBackground><ScrollView style={{flex:1}} contentContainerStyle={[s.content,page]}>
    <View style={{marginBottom:18}}><IconButton icon="arrow-back" onPress={()=>router.back()}/></View>
    <ScreenHeader title={APP_CONFIG.copy.reportsTitle} subtitle={APP_CONFIG.copy.reportsSubtitle}/>
    <SelectField label="Reporting period" value={period} options={[{key:'ALL',label:'All time'},{key:'MONTH',label:'This month'},{key:'YEAR',label:'This year'}]} onChange={setPeriod}/>

    <View style={s.grid}><Metric title="Net profit" value={d.profit} currency={currency} icon="trending-up-outline"/><Metric title="Income" value={d.income} currency={currency} icon="arrow-down-outline" tone="income"/><Metric title="Expenses" value={d.expenses} currency={currency} icon="arrow-up-outline" tone="expense"/><Metric title="Receivables" value={d.receivables} currency={currency} icon="hourglass-outline"/></View>
    <SectionTitle title="VAT position" subtitle="Basic input and output VAT summary"/><GlassCard><InfoRow label="Output VAT" value={<Money value={d.outputVat||0} currency={currency} size="sm"/>}/><InfoRow label="Input VAT" value={<Money value={d.inputVat||0} currency={currency} size="sm"/>}/><InfoRow label="VAT payable / recoverable" value={<Money value={d.vatPayable||0} currency={currency} size="sm" tone={(d.vatPayable||0)>0?'expense':'income'}/>} strong/></GlassCard>

    <SectionTitle title="Choose report sections" subtitle={`${selected.length} of ${REPORT_SECTIONS.length} sections selected`} right={<TouchableOpacity onPress={()=>setSelected(allSelected?[]:REPORT_SECTIONS.map(x=>x.key))} style={[s.allButton,{borderColor:colors.borderStrong,backgroundColor:colors.accentSoft}]}><Text style={[typography.medium,{fontSize:10.5,color:colors.primary}]}>{allSelected?'Clear all':'Select all'}</Text></TouchableOpacity>}/>
    <GlassCard style={{padding:8}}>{REPORT_SECTIONS.map((x,i)=>{const active=selected.includes(x.key);return <TouchableOpacity key={x.key} activeOpacity={.78} onPress={()=>toggle(x.key)} style={[s.report,i>0?{borderTopWidth:1,borderTopColor:colors.border}:undefined,{backgroundColor:active?colors.accentSoft:'transparent'}]}><View style={[s.check,{backgroundColor:active?colors.primary:colors.surfaceStrong,borderColor:active?colors.primary:colors.borderStrong}]}>{active?<Ionicons name="checkmark" size={16} color={colors.onPrimary}/>:null}</View><View style={{flex:1,minWidth:0}}><Text style={[s.reportText,typography.medium,{color:colors.text}]}>{x.label}</Text><Text style={[s.reportSub,typography.regular,{color:colors.textMuted}]}>{x.description}</Text></View></TouchableOpacity>})}</GlassCard>

    <SectionTitle title="Export & share" subtitle="Only the sections selected above will be generated"/><GlassCard style={{gap:10}}><View style={[s.preview,{backgroundColor:colors.surfaceMuted,borderColor:colors.borderStrong}]}><View style={[s.previewMark,{backgroundColor:colors.surfaceStrong,borderColor:colors.border}]}>{logo?<SmartImage kind="logo" uri={logo} size={52} bordered={false}/>:<Text style={[s.tb,typography.medium,{color:colors.primary}]}>{APP_CONFIG.shortMark}</Text>}</View><View style={{flex:1}}><Text style={[s.previewTitle,typography.medium,{color:colors.text}]}>{user?.business?.name||'Your company'}</Text><Text style={[s.previewSub,typography.regular,{color:colors.textMuted}]}>{selected.length} selected section{selected.length===1?'':'s'} • {APP_CONFIG.poweredBy}</Text></View></View><Button icon="document-outline" title={exporting==='pdf'?'Preparing PDF…':'Export selected PDF'} onPress={()=>download('pdf')} loading={exporting==='pdf'} disabled={!selected.length}/><Button secondary icon="grid-outline" title={exporting==='xlsx'?'Preparing workbook…':'Export selected Excel'} onPress={()=>download('xlsx')} loading={exporting==='xlsx'} disabled={!selected.length}/></GlassCard>
    <Text style={[s.note,typography.regular,{color:colors.textSoft}]}>Select only the management reports or statements you need. PDF pages and Excel worksheets are created only for those selections.</Text>
  </ScrollView></AppBackground>
}
function Metric({title,value,currency,icon,tone}:{title:string;value:number;currency:string;icon:any;tone?:'income'|'expense'}){const{colors}=useTheme();return <GlassCard style={s.metric}><View style={[s.metricIcon,{backgroundColor:tone==='expense'?colors.dangerSoft:colors.accentSoft}]}><Ionicons name={icon} size={19} color={tone==='expense'?colors.danger:colors.primary}/></View><Text style={[s.metricTitle,typography.regular,{color:colors.textMuted}]}>{title}</Text><Money value={value||0} currency={currency} tone={tone}/></GlassCard>}
const s=StyleSheet.create({content:{padding:20,paddingTop:54,paddingBottom:70},grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:16},metric:{width:'48%',minHeight:116,justifyContent:'space-between'},metricIcon:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center'},metricTitle:{fontSize:11},allButton:{borderWidth:1,borderRadius:999,paddingHorizontal:11,paddingVertical:7},report:{flexDirection:'row',alignItems:'center',gap:11,padding:12,borderRadius:14},check:{width:30,height:30,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'},reportText:{fontSize:13},reportSub:{fontSize:10,lineHeight:15,marginTop:3},preview:{borderWidth:1,borderRadius:18,padding:13,flexDirection:'row',alignItems:'center',gap:11},previewMark:{width:56,height:56,borderRadius:15,alignItems:'center',justifyContent:'center',borderWidth:1,padding:5},logo:{width:'100%',height:'100%'},tb:{fontSize:16},previewTitle:{fontSize:14},previewSub:{fontSize:10,marginTop:3,lineHeight:15},note:{fontSize:10,lineHeight:16,textAlign:'center',paddingHorizontal:18,marginTop:14}});
