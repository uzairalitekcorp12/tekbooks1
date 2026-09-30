import {useState} from 'react';
import {Alert,StyleSheet} from 'react-native';
import {FormScrollView} from '@/components/FormScrollView';
import {router,useLocalSearchParams} from 'expo-router';
import {AuthBackButton,AuthBrandHeader,AuthFormHeading} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,useResponsivePage} from '@/components/UI';
import {api} from '@/lib/api';

export default function Verify(){
  const p=useLocalSearchParams<{email:string}>();
  const[code,setCode]=useState('');
  const[loading,setLoading]=useState(false);
  const[resending,setResending]=useState(false);
  const page=useResponsivePage(false);

  async function go(){
    if(loading||resending)return;
    setLoading(true);
    try{
      await api('/auth/verify-email',{method:'POST',body:JSON.stringify({email:p.email,code})});
      router.replace('/(auth)/pending');
    }catch(e:any){
      Alert.alert('Verification failed',e.message);
    }finally{
      setLoading(false);
    }
  }

  async function resend(){
    if(loading||resending)return;
    setResending(true);
    try{
      await api('/auth/resend-verification',{method:'POST',body:JSON.stringify({email:p.email})});
      Alert.alert('Sent','A new code was requested.');
    }catch(e:any){
      Alert.alert('Could not resend',e.message);
    }finally{setResending(false)}
  }

  return <AppBackground>
    <FormScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton/>
      <AuthBrandHeader/>
      <GlassCard style={s.card}>
        <AuthFormHeading title="Check your email" subtitle={`Enter the 6-digit code sent to ${p.email}. You can request a new code below.`}/>
        <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}/>
        <Button title="Verify email" onPress={go} loading={loading} loadingTitle="Verifying email…" disabled={resending}/>
        <Button secondary title="Resend code" onPress={resend} loading={resending} loadingTitle="Sending code…" disabled={loading}/>
      </GlassCard>
    </FormScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:22,paddingTop:22,paddingBottom:40},
  card:{gap:14,padding:18},
});
