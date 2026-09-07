import {useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {AuthBackButton} from '@/components/Auth';
import {Logo} from '@/components/Logo';
import {AppBackground,Button,Field,GlassCard,PasswordField,useResponsivePage} from '@/components/UI';
import {api} from '@/lib/api';
import {typography,useTheme} from '@/lib/theme';
import {APP_CONFIG} from '@/config/app';

export default function Signup(){
  const[name,setName]=useState('');
  const[businessName,setBusiness]=useState<string>(APP_CONFIG.businessDefaults.companyName);
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
  const{colors}=useTheme();
  const page=useResponsivePage(false);

  async function go(){
    if(!name.trim()||!businessName.trim()||!email.trim()||password.length<8)return Alert.alert('Complete your workspace','Enter your name, company name, valid email and a password with at least 8 characters.');
    setLoading(true);
    try{
      await api('/auth/signup',{method:'POST',body:JSON.stringify({name:name.trim(),businessName:businessName.trim(),email:email.trim(),password})});
      router.replace({pathname:'/(auth)/verify',params:{email:email.trim()}});
    }catch(e:any){
      Alert.alert('Workspace not created',e.message);
    }finally{
      setLoading(false);
    }
  }

  return <AppBackground>
    <ScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton label="Back to sign in"/>
      <View style={s.logo}><Logo/></View>
      <Text style={[s.h1,typography.medium,{color:colors.text}]}>Create your business workspace</Text>
      <Text style={[s.p,typography.regular,{color:colors.textMuted}]}>Verify your email, then your organization access is reviewed before the first secure sign-in.</Text>
      <GlassCard style={s.card}>
        <Field label="Your name" value={name} onChangeText={setName}/>
        <Field label="Company name" value={businessName} onChangeText={setBusiness}/>
        <Field label="Business email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"/>
        <PasswordField label="Password" helper="Minimum 8 characters" value={password} onChangeText={setPassword} autoCapitalize="none"/>
        <Button title="Create workspace" onPress={go} loading={loading}/>
      </GlassCard>
    </ScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:24,paddingBottom:40},
  logo:{marginTop:24},
  h1:{fontSize:31,letterSpacing:-1,marginTop:34},
  p:{lineHeight:21,marginTop:10},
  card:{gap:14,marginTop:24},
});
