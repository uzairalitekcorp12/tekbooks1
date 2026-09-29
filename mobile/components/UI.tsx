import React,{useMemo,useState} from 'react';
import {ActivityIndicator,FlatList,Modal,Platform,Pressable,ScrollView,StyleProp,StyleSheet,Text,TextInput,TextInputProps,TextStyle,TouchableOpacity,useWindowDimensions,View,ViewStyle} from 'react-native';
import {BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import {radius,typography,useTheme} from '@/lib/theme';
import {APP_CONFIG} from '@/config/app';
import {ActivityStatus} from './ActivityStatus';

export function AppBackground({children}:{children:React.ReactNode}){
  const{colors,resolved}=useTheme();
  return <LinearGradient colors={[colors.background,colors.gradientMid,colors.backgroundAlt] as any} style={{flex:1,overflow:'hidden'}}>
    <View style={[s.glow,s.glowOne,{backgroundColor:colors.glow,pointerEvents:'none'}]}/>
    <View style={[s.glow,s.glowTwo,{backgroundColor:colors.glow,opacity:resolved==='dark'?.42:.28,pointerEvents:'none'}]}/>
    <SafeAreaView edges={['left','right']} style={{flex:1}}>{children}</SafeAreaView>
    <ActivityStatus/>
  </LinearGradient>;
}

/** Responsive content padding shared by phone screens. */
export function useResponsivePage(tabbed=true){
  const insets=useSafeAreaInsets();const{width}=useWindowDimensions();const l=APP_CONFIG.layout;
  const horizontal=width<l.compactPhoneWidth?l.compactHorizontalPadding:width>=600?l.largeHorizontalPadding:l.regularHorizontalPadding;
  const webWidth=Math.max(0,Math.min(width,l.phoneContentMaxWidth)-horizontal*2);
  return {paddingHorizontal:Platform.OS==='web'?0:horizontal,paddingTop:Math.max(insets.top+16,38),paddingBottom:(tabbed?78:28)+insets.bottom,width:Platform.OS==='web'?webWidth:'100%' as const,maxWidth:l.phoneContentMaxWidth,alignSelf:'center' as const};
}

export function ScreenHeader({title,subtitle,right}:{title:string;subtitle?:string;right?:React.ReactNode}){
  const{colors}=useTheme();
  return <View style={s.head}><View style={{flex:1,minWidth:0}}>
    <Text style={[s.title,typography.medium,{color:colors.text}]}>{title}</Text>
    {subtitle?<Text style={[s.sub,typography.regular,{color:colors.textMuted}]}>{subtitle}</Text>:null}
  </View>{right}</View>;
}

export function SectionTitle({title,subtitle,right}:{title:string;subtitle?:string;right?:React.ReactNode}){
  const{colors}=useTheme();
  return <View style={s.sectionHead}><View style={{flex:1,minWidth:0}}>
    <Text style={[s.sectionTitle,typography.medium,{color:colors.text}]}>{title}</Text>
    {subtitle?<Text style={[s.sectionSub,typography.regular,{color:colors.textMuted}]}>{subtitle}</Text>:null}
  </View>{right}</View>;
}

export function GlassCard({children,style,intensity=22}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;intensity?:number}){
  const{colors,resolved}=useTheme();
  // Border is intentionally removed from the BlurView itself. Android blur + a
  // one-pixel border could render as a visible double outline in light/dark mode.
  return <BlurView intensity={intensity} tint={resolved==='dark'?'dark':'light'} style={[s.card,{backgroundColor:colors.surface},style]}>{children}</BlurView>;
}

export function Field({label,helper,...p}:TextInputProps&{label?:string;helper?:string}){
  const{colors}=useTheme();
  return <View style={{gap:7,minWidth:0}}>
    {label?<Text style={[s.label,typography.medium,{color:colors.text}]}>{label}</Text>:null}
    <TextInput placeholderTextColor={colors.textSoft} {...p} style={[s.input,typography.regular,{borderColor:colors.border,backgroundColor:colors.surfaceStrong,color:colors.text},p.style]}/>
    {helper?<Text style={[typography.regular,{fontSize:10,color:colors.textMuted,lineHeight:15}]}>{helper}</Text>:null}
  </View>;
}

export function PasswordField({label='Password',helper,...p}:Omit<TextInputProps,'secureTextEntry'>&{label?:string;helper?:string}){
  const{colors}=useTheme();const[visible,setVisible]=useState(false);
  return <View style={{gap:7,minWidth:0}}>
    {label?<Text style={[s.label,typography.medium,{color:colors.text}]}>{label}</Text>:null}
    <View style={[s.passwordWrap,{borderColor:colors.border,backgroundColor:colors.surfaceStrong}]}>
      <TextInput placeholderTextColor={colors.textSoft} {...p} secureTextEntry={!visible} style={[s.passwordInput,typography.regular,{color:colors.text},p.style]}/>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={visible?'Hide password':'Show password'} onPress={()=>setVisible(v=>!v)} style={s.passwordToggle}>
        <Ionicons name={visible?'eye-off-outline':'eye-outline'} size={20} color={colors.textMuted}/>
      </TouchableOpacity>
    </View>
    {helper?<Text style={[typography.regular,{fontSize:10,color:colors.textMuted,lineHeight:15}]}>{helper}</Text>:null}
  </View>;
}

export function Button({title,onPress,loading,loadingTitle='Please wait…',secondary,icon,disabled,danger,compact}:{title:string;onPress:()=>void;loading?:boolean;loadingTitle?:string;secondary?:boolean;icon?:any;disabled?:boolean;danger?:boolean;compact?:boolean}){
  const{colors}=useTheme();const h=compact?44:54;const fg=danger?colors.danger:colors.primary;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={loading?loadingTitle:title} accessibilityState={{disabled:!!(disabled||loading),busy:!!loading}} disabled={disabled||loading} onPress={onPress} activeOpacity={.84} style={{opacity:disabled?0.5:1}}>
    {secondary||danger?<View style={[s.secondary,{height:h,borderColor:danger?colors.danger:colors.borderStrong,backgroundColor:danger?colors.dangerSoft:colors.surfaceStrong}]}>
      {loading?<ActivityIndicator color={fg}/>:icon?<Ionicons name={icon} size={18} color={fg}/>:null}<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.82} style={[s.secondaryText,typography.medium,{color:fg}]}>{loading?loadingTitle:title}</Text>
    </View>:<LinearGradient colors={[colors.primary,colors.primary2] as any} start={{x:0,y:0}} end={{x:1,y:1}} style={[s.button,{height:h}]}>
      {loading?<ActivityIndicator color={colors.onPrimary}/>:icon?<Ionicons name={icon} size={18} color={colors.onPrimary}/>:null}<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.82} style={[s.buttonText,typography.medium,{color:colors.onPrimary}]}>{loading?loadingTitle:title}</Text>
    </LinearGradient>}
  </TouchableOpacity>;
}

export function Money({value,currency=APP_CONFIG.businessDefaults.currency,size='md',tone='default',style}:{value:number;currency?:string;size?:'sm'|'md'|'lg';tone?:'default'|'income'|'expense';style?:StyleProp<TextStyle>}){
  const{colors}=useTheme();const color=tone==='income'?colors.success:tone==='expense'?colors.danger:colors.text;
  return <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.68} style={[s.money,typography.medium,{color,fontSize:size==='lg'?24:size==='sm'?13:16},style]}>{currency} {Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</Text>;
}

export function Pill({text,tone='green'}:{text:string;tone?:'green'|'amber'|'red'|'blue'|'neutral'}){
  const{colors}=useTheme();const bg=tone==='red'?colors.dangerSoft:tone==='amber'?colors.warningSoft:tone==='blue'?colors.infoSoft:tone==='neutral'?colors.surfaceMuted:colors.successSoft;const fg=tone==='red'?colors.danger:tone==='amber'?colors.warning:tone==='blue'?colors.info:tone==='neutral'?colors.textMuted:colors.success;
  return <View style={[s.pill,{backgroundColor:bg,borderColor:colors.border}]}><Text numberOfLines={1} style={[typography.medium,{color:fg,fontSize:10.5}]}>{text}</Text></View>;
}

export function IconButton({icon,onPress,label,danger}:{icon:any;onPress:()=>void;label?:string;danger?:boolean}){
  const{colors}=useTheme();return <TouchableOpacity accessibilityLabel={label} onPress={onPress} activeOpacity={.8} style={[s.iconButton,{backgroundColor:danger?colors.dangerSoft:colors.accentSoft,borderColor:colors.border}]}><Ionicons name={icon} size={20} color={danger?colors.danger:colors.primary}/></TouchableOpacity>;
}

export function ChoiceChips({options,value,onChange,wrap=false}:{options:{key:string;label:string}[];value:string;onChange:(key:string)=>void;wrap?:boolean}){
  const{colors}=useTheme();const body=options.map(o=>{const active=o.key===value;return <TouchableOpacity key={o.key} onPress={()=>onChange(o.key)} style={[s.choice,{backgroundColor:active?colors.primary:colors.surfaceStrong,borderColor:active?colors.primary:colors.border}]}><Text style={[typography.medium,{fontSize:12,color:active?colors.onPrimary:colors.textMuted}]}>{o.label}</Text></TouchableOpacity>});
  return wrap?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{body}</View>:<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{body}</ScrollView>;
}

export function SelectField({label,value,options,onChange,placeholder='Select an option',helper}:{label?:string;value?:string;options:{key:string;label:string;meta?:string}[];onChange:(key:string)=>void;placeholder?:string;helper?:string}){
  const{colors}=useTheme();const[open,setOpen]=useState(false),[query,setQuery]=useState('');const selected=options.find(o=>o.key===value);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?options.filter(o=>`${o.label} ${o.meta||''}`.toLowerCase().includes(q)):options},[options,query]);
  return <View style={{gap:7,minWidth:0}}>{label?<Text style={[s.label,typography.medium,{color:colors.text}]}>{label}</Text>:null}
    <TouchableOpacity activeOpacity={.82} onPress={()=>setOpen(true)} style={[s.select,{borderColor:colors.border,backgroundColor:colors.surfaceStrong}]}>
      <Text numberOfLines={1} style={[typography.regular,{fontSize:14,color:selected?colors.text:colors.textSoft,flex:1,minWidth:0}]}>{selected?.label||placeholder}</Text><Ionicons name="chevron-down" size={17} color={colors.textMuted}/>
    </TouchableOpacity>
    {helper?<Text style={[typography.regular,{fontSize:10,color:colors.textMuted,lineHeight:15}]}>{helper}</Text>:null}
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><View style={[s.selectOverlay,{backgroundColor:colors.overlay}]}><Pressable style={StyleSheet.absoluteFill} onPress={()=>setOpen(false)}/><View style={[s.selectPanel,{backgroundColor:colors.surfaceStrong,borderColor:colors.border}]}>
      <View style={s.selectHead}><View style={{flex:1,minWidth:0}}><Text style={[s.selectTitle,typography.medium,{color:colors.text}]}>{label||'Choose option'}</Text><Text style={[typography.regular,{fontSize:11,color:colors.textMuted,marginTop:3}]}>{options.length} available</Text></View><IconButton icon="close" onPress={()=>setOpen(false)}/></View>
      {options.length>8?<TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.textSoft} style={[s.search,typography.regular,{color:colors.text,borderColor:colors.border,backgroundColor:colors.surfaceMuted}]}/>:null}
      <FlatList data={filtered} keyExtractor={x=>x.key||'none'} style={{maxHeight:420}} keyboardShouldPersistTaps="handled" renderItem={({item})=>{const active=item.key===value;return <TouchableOpacity onPress={()=>{onChange(item.key);setOpen(false);setQuery('')}} style={[s.selectRow,{borderBottomColor:colors.border,backgroundColor:active?colors.accentSoft:'transparent'}]}><View style={{flex:1,minWidth:0}}><Text numberOfLines={2} style={[typography.medium,{fontSize:14,color:colors.text}]}>{item.label}</Text>{item.meta?<Text numberOfLines={2} style={[typography.regular,{fontSize:10,color:colors.textMuted,marginTop:3}]}>{item.meta}</Text>:null}</View>{active?<Ionicons name="checkmark-circle" size={20} color={colors.primary}/>:null}</TouchableOpacity>}} ListEmptyComponent={<Text style={[typography.regular,{padding:18,color:colors.textMuted,textAlign:'center'}]}>No matching options</Text>}/>
    </View></View></Modal>
  </View>;
}

export function Notice({title,body,tone='info',icon}:{title:string;body?:string;tone?:'info'|'success'|'warning'|'danger';icon?:any}){
  const{colors}=useTheme();const bg=tone==='danger'?colors.dangerSoft:tone==='warning'?colors.warningSoft:tone==='success'?colors.successSoft:colors.infoSoft;const fg=tone==='danger'?colors.danger:tone==='warning'?colors.warning:tone==='success'?colors.success:colors.info;
  return <View style={[s.notice,{backgroundColor:bg,borderColor:colors.border}]}><View style={[s.noticeIcon,{backgroundColor:colors.surfaceStrong}]}><Ionicons name={icon|| (tone==='danger'?'alert-circle-outline':tone==='warning'?'warning-outline':tone==='success'?'checkmark-circle-outline':'information-circle-outline')} size={18} color={fg}/></View><View style={{flex:1,minWidth:0}}><Text style={[typography.medium,{fontSize:12,color:colors.text}]}>{title}</Text>{body?<Text style={[typography.regular,{fontSize:10.5,color:colors.textMuted,lineHeight:16,marginTop:3}]}>{body}</Text>:null}</View></View>;
}

export function DetailModal({visible,onClose,title,subtitle,children,footer}:{visible:boolean;onClose:()=>void;title:string;subtitle?:string;children:React.ReactNode;footer?:React.ReactNode}){
  const{colors,resolved}=useTheme();return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={[s.modalRoot,{backgroundColor:colors.overlay}]}><Pressable style={{flex:1}} onPress={onClose}/><BlurView intensity={34} tint={resolved==='dark'?'dark':'light'} style={[s.sheet,{backgroundColor:colors.surfaceStrong,borderColor:colors.border}]}><View style={[s.handle,{backgroundColor:colors.borderStrong}]}/><View style={s.sheetHead}><View style={{flex:1,minWidth:0}}><Text numberOfLines={2} style={[s.sheetTitle,typography.medium,{color:colors.text}]}>{title}</Text>{subtitle?<Text numberOfLines={2} style={[s.sheetSub,typography.regular,{color:colors.textMuted}]}>{subtitle}</Text>:null}</View><IconButton icon="close" onPress={onClose}/></View><ActivityStatus inline/><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:18}}>{children}</ScrollView>{footer?<View style={[s.sheetFooter,{borderTopColor:colors.border,backgroundColor:colors.surfaceStrong}]}>{footer}</View>:null}</BlurView></View></Modal>;
}

export function InfoRow({label,value,strong}:{label:string;value:React.ReactNode;strong?:boolean}){
  const{colors}=useTheme();return <View style={[s.infoRow,{borderBottomColor:colors.border}]}><Text style={[s.infoLabel,strong?typography.medium:typography.regular,{color:strong?colors.text:colors.textMuted}]}>{label}</Text><View style={{maxWidth:'62%',alignItems:'flex-end',minWidth:0}}>{typeof value==='string'||typeof value==='number'?<Text numberOfLines={3} style={[s.infoValue,strong?typography.medium:typography.regular,{color:colors.text}]}>{String(value)}</Text>:value}</View></View>;
}

export function EmptyState({icon='file-tray-outline',title,body}:{icon?:any;title:string;body?:string}){
  const{colors}=useTheme();return <View style={s.empty}><View style={[s.emptyIcon,{backgroundColor:colors.accentSoft,borderColor:colors.borderStrong}]}><Ionicons name={icon} size={24} color={colors.primary}/></View><Text style={[s.emptyTitle,typography.medium,{color:colors.text}]}>{title}</Text>{body?<Text style={[s.emptyBody,typography.regular,{color:colors.textMuted}]}>{body}</Text>:null}</View>;
}

const s=StyleSheet.create({
  glow:{position:'absolute',width:300,height:300,borderRadius:150},glowOne:{right:-150,top:-70},glowTwo:{left:-190,bottom:70},
  head:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20},title:{fontSize:28,letterSpacing:-.8,lineHeight:35},sub:{fontSize:13,marginTop:5,lineHeight:19},
  sectionHead:{flexDirection:'row',alignItems:'center',gap:10,marginTop:24,marginBottom:10},sectionTitle:{fontSize:17,letterSpacing:-.2},sectionSub:{fontSize:11,marginTop:3,lineHeight:16},
  card:{borderRadius:radius.lg,borderWidth:0,overflow:'hidden',padding:18},label:{fontSize:12},input:{minHeight:52,borderWidth:StyleSheet.hairlineWidth,borderRadius:16,paddingHorizontal:15,paddingVertical:12,fontSize:15},passwordWrap:{minHeight:52,borderWidth:StyleSheet.hairlineWidth,borderRadius:16,flexDirection:'row',alignItems:'center',paddingLeft:15},passwordInput:{flex:1,minHeight:50,fontSize:15,paddingVertical:12,paddingRight:8},passwordToggle:{width:48,minHeight:50,alignItems:'center',justifyContent:'center'},
  button:{borderRadius:17,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,paddingHorizontal:14},buttonText:{fontSize:15},secondary:{borderRadius:17,borderWidth:StyleSheet.hairlineWidth,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,paddingHorizontal:14},secondaryText:{fontSize:14},
  money:{letterSpacing:-.15},pill:{paddingHorizontal:9,paddingVertical:5,borderRadius:999,alignSelf:'flex-start',borderWidth:StyleSheet.hairlineWidth,maxWidth:'100%'},iconButton:{width:44,height:44,borderRadius:15,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth},choice:{paddingHorizontal:13,paddingVertical:9,borderRadius:999,borderWidth:StyleSheet.hairlineWidth},
  select:{minHeight:52,borderWidth:StyleSheet.hairlineWidth,borderRadius:16,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:10},selectOverlay:{flex:1,justifyContent:'center',padding:22},selectPanel:{borderRadius:26,borderWidth:StyleSheet.hairlineWidth,padding:16,maxHeight:'76%'},selectHead:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12},selectTitle:{fontSize:19},search:{height:46,borderWidth:StyleSheet.hairlineWidth,borderRadius:14,paddingHorizontal:14,marginBottom:8},selectRow:{minHeight:56,paddingHorizontal:8,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1},
  notice:{borderWidth:StyleSheet.hairlineWidth,borderRadius:17,padding:12,flexDirection:'row',gap:10,alignItems:'flex-start'},noticeIcon:{width:32,height:32,borderRadius:11,alignItems:'center',justifyContent:'center'},
  modalRoot:{flex:1,justifyContent:'flex-end'},sheet:{maxHeight:'92%',minHeight:'34%',borderTopLeftRadius:30,borderTopRightRadius:30,borderWidth:StyleSheet.hairlineWidth,paddingHorizontal:20,paddingTop:10,overflow:'hidden'},handle:{width:44,height:5,borderRadius:999,alignSelf:'center',marginBottom:14},sheetHead:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12},sheetTitle:{fontSize:22,letterSpacing:-.4},sheetSub:{fontSize:12,marginTop:3,lineHeight:17},sheetFooter:{borderTopWidth:1,paddingVertical:12},
  infoRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:14,paddingVertical:12,borderBottomWidth:1},infoLabel:{fontSize:12,flexShrink:0},infoValue:{fontSize:13,textAlign:'right'},
  empty:{alignItems:'center',paddingVertical:34,paddingHorizontal:20},emptyIcon:{width:52,height:52,borderRadius:18,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth},emptyTitle:{fontSize:15,marginTop:12,textAlign:'center'},emptyBody:{fontSize:12,lineHeight:18,textAlign:'center',marginTop:5,maxWidth:260}
});
