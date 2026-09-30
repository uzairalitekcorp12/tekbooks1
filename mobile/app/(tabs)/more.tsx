import {ScrollView,StyleSheet,Switch,Text,TouchableOpacity,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SmartImage} from '@/components/Media';
import {Logo} from '@/components/Logo';
import {AppBackground,GlassCard,ScreenHeader,SectionTitle,useResponsivePage} from '@/components/UI';
import {useSession} from '@/lib/session';
import {APP_CONFIG} from '@/config/app';
import {typography,useTheme} from '@/lib/theme';

export default function More(){
  const{user,signOut}=useSession();const{colors,resolved,toggle}=useTheme();const page=useResponsivePage(true);const copy=APP_CONFIG.copy;
  return <AppBackground><ScrollView style={{flex:1}} contentContainerStyle={[s.content,page]}>
    <ScreenHeader title={copy.moreTitle} subtitle={copy.moreSubtitle}/>
    <TouchableOpacity activeOpacity={.82} onPress={()=>router.push('/profile')}>
      <GlassCard><View style={s.profile}><SmartImage kind="avatar" uri={user?.profilePictureUrl} size={46} fallbackText={user?.name||'T'}/><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={[s.name,typography.medium,{color:colors.text}]}>{user?.name||copy.workspaceOwner}</Text><Text numberOfLines={1} style={[s.meta,typography.regular,{color:colors.textMuted}]}>{user?.business?.name||copy.companyProfileIncomplete}</Text><Text numberOfLines={1} style={[s.meta,typography.regular,{color:colors.textMuted}]}>{user?.email}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textSoft}/></View></GlassCard>
    </TouchableOpacity>

    <SectionTitle title={copy.appearanceTitle}/>
    <GlassCard style={{padding:6}}><View style={s.item}><View style={[s.icon,{backgroundColor:colors.accentSoft}]}><Ionicons name={resolved==='dark'?'moon':'sunny-outline'} size={20} color={colors.primary}/></View><View style={{flex:1,minWidth:0}}><Text style={[s.itemTitle,typography.medium,{color:colors.text}]}>{copy.darkThemeTitle}</Text><Text style={[s.meta,typography.regular,{color:colors.textMuted}]}>{copy.darkThemeSubtitle}</Text></View><Switch value={resolved==='dark'} onValueChange={()=>toggle()} trackColor={{false:colors.border,true:colors.primary}} thumbColor={resolved==='dark'?colors.text:colors.surfaceStrong}/></View></GlassCard>

    <SectionTitle title={copy.businessWorkspaceTitle}/>
    <GlassCard style={{padding:6}}><Item icon="bar-chart-outline" title={copy.reportsMenuTitle} sub={copy.reportsMenuSubtitle} onPress={()=>router.push('/reports')} divider/><Item icon="business-outline" title={copy.profileMenuTitle} sub={copy.profileMenuSubtitle} onPress={()=>router.push('/profile')}/></GlassCard>

    <SectionTitle title={copy.securityTitle}/>
    <GlassCard style={{padding:6}}><Item icon="phone-portrait-outline" title={copy.deviceRequestsTitle} sub={copy.deviceRequestsSubtitle} onPress={()=>router.push('/device-requests')}/></GlassCard>

    <TouchableOpacity onPress={async()=>{await signOut();router.replace('/(auth)/login')}} style={[s.logout,{backgroundColor:colors.dangerSoft,borderColor:colors.border}]}><Ionicons name="log-out-outline" size={20} color={colors.danger}/><Text style={[s.logoutText,typography.medium,{color:colors.danger}]}>{copy.signOut}</Text></TouchableOpacity>
    <View style={s.brand}><Logo/><Text style={[s.brandText,typography.regular,{color:colors.textSoft}]}>v{APP_CONFIG.version} • {APP_CONFIG.tagline}</Text></View>
  </ScrollView></AppBackground>;
}
function Item({icon,title,sub,onPress,divider=false}:{icon:any;title:string;sub:string;onPress:()=>void;divider?:boolean}){const{colors}=useTheme();return <TouchableOpacity onPress={onPress} style={[s.item,divider?{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border}:undefined]}><View style={[s.icon,{backgroundColor:colors.accentSoft}]}><Ionicons name={icon} size={20} color={colors.primary}/></View><View style={{flex:1,minWidth:0}}><Text style={[s.itemTitle,typography.medium,{color:colors.text}]}>{title}</Text><Text style={[s.meta,typography.regular,{color:colors.textMuted}]}>{sub}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textSoft}/></TouchableOpacity>}
const s=StyleSheet.create({content:{padding:20,paddingTop:58,paddingBottom:118},profile:{flexDirection:'row',alignItems:'center',gap:14},name:{fontSize:18},meta:{fontSize:11,marginTop:3,lineHeight:16},item:{flexDirection:'row',alignItems:'center',gap:12,padding:13},icon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},itemTitle:{fontSize:14},logout:{height:54,marginTop:18,borderRadius:17,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,borderWidth:StyleSheet.hairlineWidth},logoutText:{fontSize:14},brand:{alignItems:'center',gap:8,marginTop:28},brandText:{fontSize:10}});
