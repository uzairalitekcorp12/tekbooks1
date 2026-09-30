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
  const{colors,resolved}=useTheme();
  return <View style={s.brand}>
    {resolved==='dark'?<View style={s.darkBrand}>
      <SmartImage accessibilityLabel="TekBooks logo" source={APP_ASSETS.adaptiveIcon} kind="logo" plain width={72} height={72}/>
      <View><Text style={[s.darkWord,typography.medium,{color:colors.text}]}>Tek<Text style={{color:colors.primary}}>Books</Text></Text><Text style={[s.darkBy,typography.medium,{color:colors.textMuted}]}>BY TEKCORP</Text></View>
    </View>:<SmartImage
      accessibilityLabel="TekBooks by Tekcorp logo"
      fallbackText={APP_CONFIG.name}
      height={APP_CONFIG.assets.productLogo.loginHeight}
      kind="logo"
      plain
      source={APP_ASSETS.logoBig}
      style={{maxWidth:APP_CONFIG.assets.productLogo.loginMaxWidth}}
      width="100%"
    />}
  </View>;
}

export function AuthBrandHeader(){
  return <View style={s.brandHeader}><AuthBrand/></View>;
}

export function AuthFormHeading({title,subtitle}:{title:string;subtitle?:string}){
  const{colors}=useTheme();
  return <View style={s.formHeading}>
    <Text style={[s.formTitle,typography.medium,{color:colors.text}]}>{title}</Text>
    {subtitle?<Text style={[s.formSubtitle,typography.regular,{color:colors.textMuted}]}>{subtitle}</Text>:null}
  </View>;
}

const s=StyleSheet.create({
  button:{alignSelf:'flex-start',minHeight:44,flexDirection:'row',alignItems:'center',gap:7,paddingRight:14},
  label:{fontSize:13},
  brand:{width:'100%',alignItems:'center',justifyContent:'center'},
  brandHeader:{width:'100%',minHeight:132,alignItems:'center',justifyContent:'center',paddingHorizontal:4,marginTop:12,marginBottom:24},
  formHeading:{gap:5,marginBottom:4},
  formTitle:{fontSize:22,letterSpacing:-.4},
  formSubtitle:{fontSize:11.5,lineHeight:17},
  darkBrand:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,width:'100%'},
  darkWord:{fontSize:32,letterSpacing:-1},
  darkBy:{fontSize:9,letterSpacing:3,marginTop:2},
});
