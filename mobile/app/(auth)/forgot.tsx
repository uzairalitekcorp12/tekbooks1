import {useState} from 'react';
import {Alert,StyleSheet} from 'react-native';
import {FormScrollView} from '@/components/FormScrollView';
import {router} from 'expo-router';
import {AuthBackButton,AuthBrandHeader,AuthFormHeading} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,useResponsivePage} from '@/components/UI';
import {api} from '@/lib/api';

export default function Forgot(){
  const[email,setEmail]=useState('');
  const[loading,setLoading]=useState(false);
  const page=useResponsivePage(false);

  async function go(){
    if(loading)return;
    if(!email.trim())return Alert.alert('Enter your email or username','We need your account details to send a reset code.');
    setLoading(true);
    try{
      await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email:email.trim()})});
      router.push({pathname:'/(auth)/reset',params:{email:email.trim()}});
    }catch(e:any){
      Alert.alert('Error',e.message);
    }finally{setLoading(false)}
  }

  return <AppBackground>
    <FormScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton label="Back to sign in"/>
      <AuthBrandHeader/>
      <GlassCard style={s.card}>
        <AuthFormHeading title="Reset your password" subtitle="We'll send a reset code to the email on your account."/>
        <Field label="Email or username" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} placeholder="Email or username"/>
        <Button title="Send reset code" onPress={go} loading={loading} loadingTitle="Sending reset code…"/>
      </GlassCard>
    </FormScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:22,paddingTop:22,paddingBottom:40},
  card:{gap:14,padding:18},
});
