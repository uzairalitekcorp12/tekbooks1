import {useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {AuthBackButton} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,PasswordField,useResponsivePage} from '@/components/UI';
import {Logo} from '@/components/Logo';
import {api} from '@/lib/api';
import {typography,useTheme} from '@/lib/theme';

export default function Reset(){
  const p=useLocalSearchParams<{email:string}>();
  const[code,setCode]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
  const{colors}=useTheme();
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
    <ScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton/>
      <View style={s.logo}><Logo/></View>
      <Text style={[s.h1,typography.medium,{color:colors.text}]}>Set a new password</Text>
      <GlassCard style={s.card}>
        <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}/>
        <PasswordField label="New password" helper="Minimum 8 characters" value={password} onChangeText={setPassword} autoCapitalize="none"/>
        <Button title="Update password" onPress={go} loading={loading} loadingTitle="Updating password…"/>
      </GlassCard>
    </ScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:24,paddingBottom:40},
  logo:{marginTop:24},
  h1:{fontSize:32,marginTop:34},
  card:{gap:14,marginTop:24},
});
