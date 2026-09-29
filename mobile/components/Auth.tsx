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

/** Large, unframed product artwork shared by welcome and authentication screens. */
export function AuthBrand(){
  const{resolved}=useTheme();
  return <View style={s.brand}>
    <SmartImage
      accessibilityLabel="TekBooks by Tekcorp logo"
      fallbackText={APP_CONFIG.name}
      height={APP_CONFIG.assets.productLogo.loginHeight}
      kind="logo"
      plain
      source={resolved==='dark'?APP_ASSETS.logoBigDark:APP_ASSETS.logoBig}
      style={{maxWidth:APP_CONFIG.assets.productLogo.loginMaxWidth}}
      width="100%"
    />
  </View>;
}

const s=StyleSheet.create({
  button:{alignSelf:'flex-start',minHeight:44,flexDirection:'row',alignItems:'center',gap:7,paddingRight:14},
  label:{fontSize:13},
  brand:{width:'100%',alignItems:'center',justifyContent:'center'},
});
