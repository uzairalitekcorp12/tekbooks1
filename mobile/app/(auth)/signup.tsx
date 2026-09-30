import {useState} from 'react';
import {Alert,StyleSheet} from 'react-native';
import {FormScrollView} from '@/components/FormScrollView';
import {router} from 'expo-router';
import {AuthBackButton,AuthBrandHeader,AuthFormHeading} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,PasswordField,useResponsivePage} from '@/components/UI';
import {api} from '@/lib/api';
import {APP_CONFIG} from '@/config/app';

export default function Signup(){
  const[name,setName]=useState('');
  const[businessName,setBusiness]=useState<string>(APP_CONFIG.businessDefaults.companyName);
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
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
    <FormScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton label="Back to sign in"/>
      <AuthBrandHeader/>
      <GlassCard style={s.card}>
        <AuthFormHeading title="Create your workspace" subtitle="Set up your business details and verify your email. Access is reviewed before your first sign-in."/>
        <Field label="Your name" value={name} onChangeText={setName}/>
        <Field label="Company name" value={businessName} onChangeText={setBusiness}/>
        <Field label="Business email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"/>
        <PasswordField label="Password" helper="Minimum 8 characters" value={password} onChangeText={setPassword} autoCapitalize="none"/>
        <Button title="Create workspace" onPress={go} loading={loading} loadingTitle="Creating workspace…"/>
      </GlassCard>
    </FormScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:22,paddingTop:22,paddingBottom:40},
  card:{gap:14,padding:18},
});
