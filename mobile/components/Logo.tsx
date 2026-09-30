import {StyleSheet,Text,View} from 'react-native';
import {APP_ASSETS,APP_CONFIG} from '@/config/app';
import {SmartImage} from '@/components/Media';
import {typography,useTheme} from '@/lib/theme';

/** Product/company identity lockup. Product fallback is an actual image, never a generated TB block. */
export function Logo({compact=false,companyName,logoUrl,powered=false}:{compact?:boolean;companyName?:string;logoUrl?:string;powered?:boolean}){
  const{colors,resolved}=useTheme();const name=companyName||APP_CONFIG.name;const isCompany=Boolean(companyName);
  const productSource=compact?APP_ASSETS.appIcon:(resolved==='dark'?APP_ASSETS.tekbooksLogoDark:APP_ASSETS.tekbooksLogo);
  const productWidth=compact?APP_CONFIG.assets.logo.compactSize:164;
  const productHeight=compact?APP_CONFIG.assets.logo.compactSize:48;
  return <View style={s.row}>
    {!compact&&!isCompany&&!logoUrl&&resolved==='dark'?<View style={s.darkBrand}><SmartImage kind="logo" source={APP_ASSETS.adaptiveIcon} plain width={43} height={43}/><View><Text style={[s.darkWord,typography.medium,{color:colors.text}]}>Tek<Text style={{color:colors.primary}}>Books</Text></Text><Text style={[s.darkBy,typography.medium,{color:colors.textMuted}]}>BY TEKCORP</Text></View></View>:<SmartImage kind="logo" uri={logoUrl} source={!logoUrl&&!isCompany?productSource:undefined} width={isCompany?58:productWidth} height={isCompany?58:productHeight} fallbackText={isCompany?companyName:APP_CONFIG.shortMark}/>}
    {!compact&&isCompany&&<View style={{flex:1,minWidth:0}}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.82} style={[s.name,typography.medium,{color:colors.text}]}>{name}</Text><Text numberOfLines={1} style={[s.by,typography.medium,{color:colors.textMuted}]}>{powered||companyName?APP_CONFIG.poweredBy.toUpperCase():APP_CONFIG.tagline.toUpperCase()}</Text></View>}
  </View>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:12},name:{fontSize:21,letterSpacing:-.35,maxWidth:260},by:{fontSize:8.5,letterSpacing:1.25,marginTop:3},darkBrand:{flexDirection:'row',alignItems:'center',gap:6},darkWord:{fontSize:21,letterSpacing:-.5},darkBy:{fontSize:6.5,letterSpacing:1.5}});
