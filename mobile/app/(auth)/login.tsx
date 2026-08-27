import {useEffect,useState} from 'react';
import {Alert,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {AppBackground,Button,Field,GlassCard,PasswordField,useResponsivePage} from '@/components/UI';
import {SmartImage} from '@/components/Media';
import {api} from '@/lib/api';
import {APP_ASSETS,APP_CONFIG} from '@/config/app';
import {getDeviceIdentity} from '@/lib/device';
import {useSession} from '@/lib/session';
import {CachedBranding,loadBranding} from '@/lib/branding';
import {typography,useTheme} from '@/lib/theme';

export default function Login(){
  const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[loading,setLoading]=useState(false),[branding,setBranding]=useState<CachedBranding|null>(null);
  const{signIn}=useSession();const{colors,resolved}=useTheme();const page=useResponsivePage(false);
  useEffect(()=>{loadBranding().then(setBranding)},[]);

  async function submit(){
    if(!email.trim()||!password)return Alert.alert('Enter your sign-in details','Your business email and password are required.');
    setLoading(true);
    try{
      const device=await getDeviceIdentity();
      const d=await api('/auth/login',{method:'POST',body:JSON.stringify({email:email.trim(),password,...device})});
      await signIn(d.token,d.user);router.replace('/(tabs)');
    }catch(e:any){
      if(e.code==='DEVICE_VERIFICATION_REQUIRED')router.push({pathname:'/(auth)/device-verify',params:{email,challengeId:e.body?.challengeId||'',challengeSecret:e.body?.challengeSecret||''}});
      else if(e.code==='EMAIL_NOT_VERIFIED')router.push({pathname:'/(auth)/verify',params:{email}});
      else if(e.code==='PENDING_APPROVAL')router.push('/(auth)/pending');
      else Alert.alert('Sign in unavailable',e.message);
    }finally{setLoading(false)}
  }

  const isCompany=!!(branding?.companyName&&branding.companyName!==APP_CONFIG.name);
  const companyName=isCompany?branding!.companyName:APP_CONFIG.brand.neutralWorkspaceName;
  const brandCopy=isCompany?APP_CONFIG.brand.loginCompanyText:APP_CONFIG.brand.loginFallbackText;

  return <AppBackground><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
    <View style={s.brandArea}>
      <SmartImage kind="logo" uri={isCompany?branding?.logoUrl:''} source={!isCompany?(resolved==='dark'?APP_ASSETS.tekbooksLogoDark:APP_ASSETS.tekbooksLogo):undefined} width={isCompany?APP_CONFIG.assets.productLogo.companyLoginWidth:APP_CONFIG.assets.productLogo.loginWidth} height={isCompany?APP_CONFIG.assets.productLogo.companyLoginHeight:APP_CONFIG.assets.productLogo.loginHeight} fallbackText={isCompany?companyName:APP_CONFIG.shortMark}/>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={.78} style={[s.company,typography.medium,{color:colors.text}]}>{companyName}</Text>
      <Text style={[s.powered,typography.medium,{color:colors.primary}]}>{APP_CONFIG.poweredBy}</Text>
      <Text style={[s.brandCopy,typography.regular,{color:colors.textMuted}]}>{brandCopy}</Text>
    </View>

    <GlassCard style={s.formCard}>
      <View style={{gap:5,marginBottom:4}}><Text style={[s.signTitle,typography.medium,{color:colors.text}]}>{APP_CONFIG.copy.loginSignInTitle}</Text><Text style={[s.signSub,typography.regular,{color:colors.textMuted}]}>{APP_CONFIG.copy.loginSignInSubtitle}</Text></View>
      <Field label={APP_CONFIG.copy.loginEmailLabel} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="name@company.com"/>
      <PasswordField label={APP_CONFIG.copy.loginPasswordLabel} value={password} onChangeText={setPassword} placeholder="Enter your password" autoCapitalize="none"/>
      <Button title={APP_CONFIG.copy.loginButton} onPress={submit} loading={loading}/>
      <TouchableOpacity onPress={()=>router.push('/(auth)/forgot')} style={s.forgot}><Text style={[typography.medium,{fontSize:12,color:colors.primary}]}>{APP_CONFIG.copy.loginForgot}</Text></TouchableOpacity>
    </GlassCard>

    <View style={s.bottom}><Text style={[typography.regular,{fontSize:12,color:colors.textMuted}]}>{APP_CONFIG.copy.loginCreatePrompt}</Text><TouchableOpacity onPress={()=>router.push('/(auth)/signup')}><Text style={[typography.medium,{fontSize:12,color:colors.primary}]}> {APP_CONFIG.copy.loginCreateAction}</Text></TouchableOpacity></View>
    <View style={s.security}><Ionicons name="shield-checkmark-outline" size={15} color={colors.textSoft}/><Text style={[typography.regular,{fontSize:10,color:colors.textSoft}]}>{APP_CONFIG.copy.loginSecurity}</Text></View>
  </ScrollView></KeyboardAvoidingView></AppBackground>;
}

const s=StyleSheet.create({wrap:{padding:22,paddingTop:54,paddingBottom:42,flexGrow:1,justifyContent:'center'},brandArea:{alignItems:'center',paddingHorizontal:18,marginBottom:26},company:{fontSize:28,letterSpacing:-.8,textAlign:'center',marginTop:16,maxWidth:330},powered:{fontSize:10.5,letterSpacing:1.5,textTransform:'uppercase',marginTop:7},brandCopy:{fontSize:11.5,lineHeight:18,textAlign:'center',marginTop:10,maxWidth:310},formCard:{gap:14,padding:18},signTitle:{fontSize:20},signSub:{fontSize:11.5,lineHeight:17},forgot:{alignSelf:'center',paddingVertical:3},bottom:{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop:20},security:{flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',marginTop:18}});
