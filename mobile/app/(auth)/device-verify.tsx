import {useCallback,useRef,useState} from 'react';
import {Alert,AppState,StyleSheet,Text} from 'react-native';
import {FormScrollView} from '@/components/FormScrollView';
import {router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import {AuthBackButton,AuthBrandHeader,AuthFormHeading} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,Notice,useResponsivePage} from '@/components/UI';
import {api} from '@/lib/api';
import {getDeviceIdentity} from '@/lib/device';
import {useSession} from '@/lib/session';
import {typography,useTheme} from '@/lib/theme';

export default function DeviceVerify(){
  const p=useLocalSearchParams<{email:string;challengeId?:string;challengeSecret?:string;emailSent?:string;expiresAt?:string}>();
  const[code,setCode]=useState(''),[busy,setBusy]=useState<''|'verify'|'check'>(''),[status,setStatus]=useState('Waiting for approval on your registered phone.'),[error,setError]=useState('');
  const working=useRef(false),active=useRef(false),stopped=useRef(false);
  const{signIn}=useSession();const{colors}=useTheme();const page=useResponsivePage(false);
  async function go(){
    if(working.current)return;
    if(!/^\d{6}$/.test(code))return Alert.alert('Enter the email code','Use the six-digit code sent to your registered inbox.');
    working.current=true;setBusy('verify');
    try{
      const device=await getDeviceIdentity();
      const d=await api('/auth/device/verify',{method:'POST',body:JSON.stringify({email:p.email,code,...device})});
      if(active.current){stopped.current=true;await signIn(d.token,d.user);router.replace('/(tabs)')}
    }catch(e:any){if(active.current)setError(e.message)}
    finally{working.current=false;if(active.current)setBusy('')}
  }
  const check=useCallback(async(automatic=false)=>{
    if(working.current||stopped.current||!p.challengeId||!p.challengeSecret)return;
    working.current=true;if(!automatic)setBusy('check');
    try{
      const device=await getDeviceIdentity();
      const d=await api('/auth/device/status',{method:'POST',body:JSON.stringify({challengeId:p.challengeId,challengeSecret:p.challengeSecret,...device}),activityLabel:automatic?false:'Checking device approval…'});
      if(!active.current)return;
      setError('');
      if(d.approved){stopped.current=true;setStatus('Approved. Opening your workspace…');await signIn(d.token,d.user);router.replace('/(tabs)')}
      else setStatus(d.message||'Still waiting for approval on your registered phone.');
    }catch(e:any){if(active.current){setError(e.message);if(e.status===400||e.status===404)stopped.current=true}}
    finally{working.current=false;if(active.current)setBusy('')}
  },[p.challengeId,p.challengeSecret,signIn]);
  const latestCheck=useRef(check);latestCheck.current=check;
  useFocusEffect(useCallback(()=>{
    active.current=true;stopped.current=false;void latestCheck.current(true);
    const timer=setInterval(()=>{if(AppState.currentState==='active')void latestCheck.current(true)},15000);
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void latestCheck.current(true)});
    return()=>{active.current=false;clearInterval(timer);listener.remove()};
  },[]));
  return <AppBackground><FormScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
    <AuthBackButton label="Cancel sign in"/>
    <AuthBrandHeader/>
    <GlassCard style={s.card}>
      <AuthFormHeading title="Approve your new device" subtitle="Approve this sign-in in Workspace → Device requests on your registered phone, or enter the code sent to your email."/>
      <Notice title={error?'Approval check unavailable':'Waiting for device approval'} body={error||status} tone={error?'warning':'info'}/>
      {p.emailSent==='false'?<Notice tone="warning" title="Email code could not be sent" body="You can still approve this request in Device requests on your registered phone. To request another email code, return to sign in and try again."/>:null}
      <Field label="Email approval code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} helper={p.emailSent==='true'?'A code was sent to your registered inbox. Check spam too.':'Enter the code if you received one.'}/>
      <Button title="Continue with email code" onPress={go} loading={busy==='verify'} loadingTitle="Verifying device…" disabled={!!busy}/>
      {p.challengeId?<Button secondary title="Check approval now" onPress={()=>void check()} loading={busy==='check'} loadingTitle="Checking approval…" disabled={!!busy}/>:null}
      <Text style={[s.hint,typography.regular,{color:colors.textMuted}]}>Approval is checked automatically every 15 seconds. Requests expire after 10 minutes. This replaces the registered device.</Text>
    </GlassCard>
  </FormScrollView></AppBackground>;
}
const s=StyleSheet.create({wrap:{padding:22,paddingTop:22,paddingBottom:40},card:{gap:14,padding:18},hint:{fontSize:11,lineHeight:17}});
