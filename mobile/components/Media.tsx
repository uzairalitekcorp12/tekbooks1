import React,{useEffect,useState} from 'react';
import {DimensionValue,Image,ImageSourcePropType,StyleProp,StyleSheet,Text,View,ViewStyle} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {APP_CONFIG} from '@/config/app';
import {absoluteAssetUrl} from '@/lib/api';
import {typography,useTheme} from '@/lib/theme';

type SmartImageProps={
  uri?:string;
  source?:ImageSourcePropType;
  kind:'logo'|'avatar';
  size?:number;
  height?:number;
  width?:DimensionValue;
  fallbackText?:string;
  style?:StyleProp<ViewStyle>;
  bordered?:boolean;
  onLoadError?:()=>void;
};

/**
 * Responsive media wrapper used everywhere TekBooks displays a product/company
 * logo or profile photo.
 *
 * - Logos always use `contain`, so wide/tall/square artwork is never cropped.
 * - Avatars use `cover`, so photos fill their frame consistently.
 * - Local bundled assets and uploaded URLs are both supported.
 * - Old LAN upload URLs are normalized through absoluteAssetUrl().
 * - Broken images fall back without collapsing the layout.
 */
export function SmartImage({uri,source:localSource,kind,size,height,width,fallbackText,style,bordered=false,onLoadError}:SmartImageProps){
  const{colors}=useTheme();const[failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[uri,localSource]);
  const isLogo=kind==='logo';
  const resolvedSize=size||(isLogo?APP_CONFIG.assets.logo.compactSize:APP_CONFIG.assets.avatar.compactSize);
  const frame:any={
    width:width??resolvedSize,
    height:height??resolvedSize,
    borderRadius:isLogo?Math.max(12,Math.round(resolvedSize*.22)):Math.max(12,Math.round(resolvedSize*APP_CONFIG.assets.avatar.radiusRatio)),
    borderColor:colors.borderStrong,
    backgroundColor:isLogo?'transparent':colors.surfaceStrong,
    padding:isLogo?Math.min(APP_CONFIG.assets.logo.backgroundPadding,Math.max(4,resolvedSize*.09)):0,
  };
  const remote=uri&&!failed?absoluteAssetUrl(uri):'';
  const imageSource=!failed?(localSource||(remote?{uri:remote}:undefined)):undefined;
  const resizeMode=isLogo?APP_CONFIG.assets.logo.fit:APP_CONFIG.assets.avatar.fit;
  return <View style={[s.frame,frame,bordered?{borderWidth:StyleSheet.hairlineWidth}:undefined,style]}>
    {imageSource?<Image source={imageSource} resizeMode={resizeMode} style={s.image} onError={()=>{setFailed(true);onLoadError?.()}}/>:isLogo?
      <View style={s.fallback}>{fallbackText?<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.7} style={[typography.medium,{fontSize:Math.max(16,resolvedSize*.28),color:colors.primary,letterSpacing:-.4}]}>{fallbackText.slice(0,3).toUpperCase()}</Text>:<Ionicons name="business-outline" size={Math.max(20,resolvedSize*.34)} color={colors.primary}/>}</View>:
      <View style={[s.fallback,{backgroundColor:colors.accentSoft}]}><Text numberOfLines={1} style={[typography.medium,{fontSize:Math.max(14,resolvedSize*.34),color:colors.primary}]}>{(fallbackText||'U').trim().charAt(0).toUpperCase()}</Text></View>}
  </View>;
}

const s=StyleSheet.create({frame:{overflow:'hidden',alignItems:'center',justifyContent:'center'},image:{width:'100%',height:'100%'},fallback:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'}});
