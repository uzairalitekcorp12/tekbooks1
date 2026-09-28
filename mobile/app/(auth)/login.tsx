import {useEffect,useState} from 'react';
import {Alert,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {AuthBrand} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,PasswordField,useResponsivePage} from '@/components/UI';
import {api} from '@/lib/api';
import {APP_CONFIG} from '@/config/app';
import {getDeviceIdentity} from '@/lib/device';
import {useSession} from '@/lib/session';
import {CachedBranding,loadBranding} from '@/lib/branding';
import {typography,useTheme} from '@/lib/theme';

export default function Login(){
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
  const[branding,setBranding]=useState<CachedBranding|null>(null);
  const{signIn}=useSession();
  const{colors}=useTheme();
  const page=useResponsivePage(false);

  useEffect(()=>{
    let active=true;
    loadBranding().then(value=>{if(active)setBranding(value)});
    return()=>{active=false};
  },[]);

  async function submit(){
    if(loading)return;
    if(!email.trim()||!password)return Alert.alert('Enter your sign-in details','Your username and password are required.');
    setLoading(true);
    try{
      const device=await getDeviceIdentity();
      const d=await api('/auth/login',{method:'POST',body:JSON.stringify({email:email.trim(),password,...device})});
      await signIn(d.token,d.user);
      router.replace('/(tabs)');
    }catch(e:any){
      if(e.code==='DEVICE_VERIFICATION_REQUIRED')router.push({pathname:'/(auth)/device-verify',params:{email,challengeId:e.body?.challengeId||'',challengeSecret:e.body?.challengeSecret||'',emailSent:String(e.body?.emailSent??''),expiresAt:e.body?.expiresAt||''}});
      else if(e.code==='EMAIL_NOT_VERIFIED')router.push({pathname:'/(auth)/verify',params:{email}});
      else if(e.code==='PENDING_APPROVAL')router.push('/(auth)/pending');
      else Alert.alert('Sign in unavailable',e.message);
    }finally{
      setLoading(false);
    }
  }

  return <AppBackground>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
        <View style={s.brandArea}>
          <AuthBrand companyName={branding?.companyName} logoUrl={branding?.logoUrl}/>
        </View>

        <GlassCard style={s.formCard}>
          <View style={s.heading}>
            <Text style={[s.signTitle,typography.medium,{color:colors.text}]}>{APP_CONFIG.copy.loginSignInTitle}</Text>
            <Text style={[s.signSub,typography.regular,{color:colors.textMuted}]}>{APP_CONFIG.copy.loginSignInSubtitle}</Text>
          </View>
          <Field label={APP_CONFIG.copy.loginEmailLabel} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} placeholder="admin@tekbooks"/>
          <PasswordField label={APP_CONFIG.copy.loginPasswordLabel} value={password} onChangeText={setPassword} placeholder="Enter your password" autoCapitalize="none"/>
          <Button title={APP_CONFIG.copy.loginButton} onPress={submit} loading={loading} loadingTitle="Signing in…"/>
          <TouchableOpacity accessibilityRole="button" onPress={()=>router.push('/(auth)/forgot')} style={s.forgot}>
            <Text style={[typography.medium,{fontSize:12,color:colors.primary}]}>{APP_CONFIG.copy.loginForgot}</Text>
          </TouchableOpacity>
        </GlassCard>

        <View style={s.bottom}>
          <Text style={[typography.regular,{fontSize:12,color:colors.textMuted}]}>{APP_CONFIG.copy.loginCreatePrompt}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={()=>router.push('/(auth)/signup')}>
            <Text style={[typography.medium,{fontSize:12,color:colors.primary}]}> {APP_CONFIG.copy.loginCreateAction}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.security}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.textSoft}/>
          <Text style={[typography.regular,{fontSize:10,color:colors.textSoft}]}>{APP_CONFIG.copy.loginSecurity}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:22,paddingTop:38,paddingBottom:42,flexGrow:1,justifyContent:'center'},
  brandArea:{width:'100%',alignItems:'center',justifyContent:'center',paddingHorizontal:4,marginBottom:24},
  formCard:{gap:14,padding:18},
  heading:{gap:5,marginBottom:4},
  signTitle:{fontSize:20},
  signSub:{fontSize:11.5,lineHeight:17},
  forgot:{alignSelf:'center',paddingVertical:5,paddingHorizontal:8},
  bottom:{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop:20},
  security:{flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',marginTop:18},
});
