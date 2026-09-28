import {useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {AuthBackButton} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,useResponsivePage} from '@/components/UI';
import {Logo} from '@/components/Logo';
import {api} from '@/lib/api';
import {typography,useTheme} from '@/lib/theme';

export default function Forgot(){
  const[email,setEmail]=useState('');
  const[loading,setLoading]=useState(false);
  const{colors}=useTheme();
  const page=useResponsivePage(false);

  async function go(){
    if(loading)return;
    setLoading(true);
    try{
      await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email})});
      router.push({pathname:'/(auth)/reset',params:{email}});
    }catch(e:any){
      Alert.alert('Error',e.message);
    }finally{setLoading(false)}
  }

  return <AppBackground>
    <ScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton label="Back to sign in"/>
      <View style={s.logo}><Logo/></View>
      <Text style={[s.h1,typography.medium,{color:colors.text}]}>Reset password</Text>
      <Text style={[s.p,typography.regular,{color:colors.textMuted}]}>We’ll send a one-time reset code to your registered email.</Text>
      <GlassCard style={s.card}>
        <Field label="Username" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} placeholder="admin@tekbooks"/>
        <Button title="Send reset code" onPress={go} loading={loading} loadingTitle="Sending reset code…"/>
      </GlassCard>
    </ScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:24,paddingBottom:40},
  logo:{marginTop:24},
  h1:{fontSize:32,marginTop:34},
  p:{marginTop:10,lineHeight:21},
  card:{gap:14,marginTop:24},
});
