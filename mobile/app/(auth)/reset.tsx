import {useState} from 'react';
import {Alert,StyleSheet} from 'react-native';
import {FormScrollView} from '@/components/FormScrollView';
import {router,useLocalSearchParams} from 'expo-router';
import {AuthBackButton,AuthBrandHeader,AuthFormHeading} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,PasswordField,useResponsivePage} from '@/components/UI';
import {api} from '@/lib/api';

export default function Reset(){
  const p=useLocalSearchParams<{email:string}>();
  const[code,setCode]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
  const page=useResponsivePage(false);

  async function go(){
    if(loading)return;
    setLoading(true);
    try{
      await api('/auth/reset-password',{method:'POST',body:JSON.stringify({email:p.email,code,password})});
      Alert.alert('Password updated','You can now sign in.');
      router.replace('/(auth)/login');
    }catch(e:any){
      Alert.alert('Reset failed',e.message);
    }finally{setLoading(false)}
  }

  return <AppBackground>
    <FormScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton/>
      <AuthBrandHeader/>
      <GlassCard style={s.card}>
        <AuthFormHeading title="Set a new password" subtitle="Enter the code we sent and choose a new password."/>
        <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}/>
        <PasswordField label="New password" helper="Minimum 8 characters" value={password} onChangeText={setPassword} autoCapitalize="none"/>
        <Button title="Update password" onPress={go} loading={loading} loadingTitle="Updating password…"/>
      </GlassCard>
    </FormScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:22,paddingTop:22,paddingBottom:40},
  card:{gap:14,padding:18},
});
