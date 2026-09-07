import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {SmartImage} from '@/components/Media';
import {APP_ASSETS,APP_CONFIG} from '@/config/app';
import {typography,useTheme} from '@/lib/theme';

/** Return through the current auth flow, or safely land on sign-in for deep links. */
export function goBackToSignIn(){
  if(router.canGoBack()){
    router.back();
    return;
  }
  router.replace('/(auth)/login');
}

export function AuthBackButton({label='Back'}:{label?:string}){
  const{colors}=useTheme();
  return <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    activeOpacity={.72}
    hitSlop={8}
    onPress={goBackToSignIn}
    style={s.button}
  >
    <Ionicons name="arrow-back" size={20} color={colors.primary}/>
    <Text style={[s.label,typography.medium,{color:colors.primary}]}>{label}</Text>
  </TouchableOpacity>;
}

/** Large, unframed auth artwork for either TekBooks or the remembered workspace. */
export function AuthBrand({companyName,logoUrl}:{companyName?:string;logoUrl?:string}){
  const{resolved}=useTheme();
  const namedCompany=Boolean(companyName&&companyName!==APP_CONFIG.name&&companyName!==APP_CONFIG.brand.neutralWorkspaceName);
  const companyBrand=Boolean(logoUrl)||namedCompany;
  const displayName=namedCompany?companyName!:APP_CONFIG.name;
  const height=companyBrand?APP_CONFIG.assets.productLogo.companyLoginHeight:APP_CONFIG.assets.productLogo.loginHeight;
  const maxWidth=companyBrand?APP_CONFIG.assets.productLogo.companyLoginMaxWidth:APP_CONFIG.assets.productLogo.loginMaxWidth;
  return <View style={s.brand}>
    <SmartImage
      accessibilityLabel={`${displayName} logo`}
      fallbackText={displayName}
      height={height}
      kind="logo"
      plain
      source={logoUrl?undefined:(resolved==='dark'?APP_ASSETS.logoBigDark:APP_ASSETS.logoBig)}
      style={{maxWidth}}
      uri={logoUrl}
      width="100%"
    />
  </View>;
}

const s=StyleSheet.create({
  button:{alignSelf:'flex-start',minHeight:44,flexDirection:'row',alignItems:'center',gap:7,paddingRight:14},
  label:{fontSize:13},
  brand:{width:'100%',alignItems:'center',justifyContent:'center'},
});
