import {useCallback,useRef,useState} from 'react';
import {Alert,AppState,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {api} from '@/lib/api';
import {AppBackground,Button,EmptyState,GlassCard,IconButton,Notice,ScreenHeader,useResponsivePage} from '@/components/UI';
import {typography,useTheme} from '@/lib/theme';

export default function DeviceRequests(){
  const[list,setList]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[approving,setApproving]=useState('');
  const fetching=useRef(false),approvalBusy=useRef(false),active=useRef(false);
  const{colors}=useTheme();const page=useResponsivePage(false);
  const load=useCallback(async(quiet=false)=>{
    if(fetching.current)return;
    fetching.current=true;if(!quiet)setLoading(true);
    try{const items=await api('/auth/device/requests',{activityLabel:quiet?false:'Fetching device requests…'});if(active.current){setList(items);setError('')}}
    catch(e:any){if(active.current)setError(e.message||'Device requests could not be loaded.')}
    finally{fetching.current=false;if(active.current)setLoading(false)}
  },[]);
  useFocusEffect(useCallback(()=>{
    active.current=true;void load();
    const timer=setInterval(()=>{if(AppState.currentState==='active')void load(true)},15000);
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void load(true)});
    return()=>{active.current=false;clearInterval(timer);listener.remove()};
  },[load]));
  async function approve(id:string){
    if(approvalBusy.current)return;
    approvalBusy.current=true;setApproving(id);
    try{
      await api('/auth/device/approve',{method:'POST',body:JSON.stringify({challengeId:id})});
      if(active.current){setList(items=>items.filter(x=>x.id!==id));Alert.alert('Device approved','The new phone will finish sign-in automatically. This phone will be signed out when the device changes.');await load(true)}
    }catch(e:any){if(active.current)Alert.alert('Could not approve',e.message)}
    finally{approvalBusy.current=false;if(active.current)setApproving('')}
  }
  return <AppBackground><ScrollView style={{flex:1}} contentContainerStyle={[s.content,page]} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()} tintColor={colors.primary}/>}>
    <View style={{marginBottom:18}}><IconButton icon="arrow-back" onPress={()=>router.back()}/></View>
    <ScreenHeader title="Device requests" subtitle="Approve a login on a replacement phone" right={<IconButton icon="refresh" label="Refresh device requests" onPress={()=>void load()}/>}/>
    {error?<View style={{marginBottom:14}}><Notice tone="danger" title="Device requests unavailable" body={error}/></View>:null}
    <GlassCard>{list.length?list.map((x,i)=><View key={x.id} style={[s.item,i>0?{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border}:undefined]}>
      <View style={[s.icon,{backgroundColor:colors.accentSoft}]}><Ionicons name="phone-portrait-outline" size={22} color={colors.primary}/></View>
      <View style={{flex:1}}><Text style={[typography.medium,{color:colors.text}]}>{x.deviceLabel}</Text><Text style={[s.meta,{color:colors.textMuted}]}>Requested {new Date(x.createdAt).toLocaleString()}</Text>{x.expiresAt?<Text style={[s.meta,{color:colors.textMuted}]}>Expires {new Date(x.expiresAt).toLocaleTimeString()}</Text>:null}</View>
      <View style={{width:110}}><Button title="Approve" onPress={()=>approve(x.id)} loading={approving===x.id} loadingTitle="Approving…" disabled={!!approving} compact/></View>
    </View>):<EmptyState icon="phone-portrait-outline" title={loading?'Fetching device requests…':error?'Try refreshing again':'No pending device requests'} body={loading?'Checking for new-device sign-ins.':error?'Use the refresh button or pull down to retry.':'New-device sign-in requests will appear here.'}/>}</GlassCard>
    <Text style={[s.note,{color:colors.textMuted}]}>Requests refresh automatically while this screen is open. Only approve a device you recognize. Email-code verification is also available.</Text>
  </ScrollView></AppBackground>;
}
const s=StyleSheet.create({content:{padding:20,paddingTop:54,paddingBottom:60},item:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14},icon:{width:46,height:46,borderRadius:16,alignItems:'center',justifyContent:'center'},meta:{fontSize:11,marginTop:4},note:{fontSize:10,lineHeight:17,textAlign:'center',padding:18}});
