import {useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {AuthBackButton} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,useResponsivePage} from '@/components/UI';
import {Logo} from '@/components/Logo';
import {api} from '@/lib/api';
import {typography,useTheme} from '@/lib/theme';

export default function Verify(){
  const p=useLocalSearchParams<{email:string}>();
  const[code,setCode]=useState('');
  const[loading,setLoading]=useState(false);
  const[resending,setResending]=useState(false);
  const{colors}=useTheme();
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
    <ScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton/>
      <View style={s.logo}><Logo/></View>
      <Text style={[s.h1,typography.medium,{color:colors.text}]}>Check your email</Text>
      <Text style={[s.p,typography.regular,{color:colors.textMuted}]}>Enter the 6-digit verification code sent to {p.email}. If it does not arrive, request a new code below.</Text>
      <GlassCard style={s.card}>
        <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}/>
        <Button title="Verify email" onPress={go} loading={loading} loadingTitle="Verifying email…" disabled={resending}/>
        <Button secondary title="Resend code" onPress={resend} loading={resending} loadingTitle="Sending code…" disabled={loading}/>
      </GlassCard>
    </ScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:24,paddingBottom:40},
  logo:{marginTop:24},
  h1:{fontSize:32,marginTop:34},
  p:{lineHeight:21,marginTop:10},
  card:{gap:14,marginTop:24},
});
