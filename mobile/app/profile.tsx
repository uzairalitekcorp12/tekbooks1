import {useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {api,uploadAsset} from '@/lib/api';
import {APP_CONFIG} from '@/config/app';
import {typography,useTheme} from '@/lib/theme';
import {SmartImage} from '@/components/Media';
import {AppBackground,Button,Field,GlassCard,IconButton,Notice,ScreenHeader,SectionTitle,useResponsivePage} from '@/components/UI';
import {useSession} from '@/lib/session';

export default function Profile(){
  const{user,refresh}=useSession();const{colors}=useTheme();const page=useResponsivePage(false);const defaults=APP_CONFIG.businessDefaults;
  const[name,setName]=useState(user?.name||''),[businessName,setBusiness]=useState(user?.business?.name||APP_CONFIG.businessDefaults.companyName),[legalName,setLegal]=useState(user?.business?.legalName||APP_CONFIG.businessDefaults.legalName),[trn,setTrn]=useState(user?.business?.trn||APP_CONFIG.businessDefaults.trn),[vat,setVat]=useState(String(user?.business?.vatPercent??defaults.vatPercent)),[email,setEmail]=useState(user?.business?.email||APP_CONFIG.businessDefaults.businessEmail),[phone,setPhone]=useState(user?.business?.phone||APP_CONFIG.businessDefaults.phone),[address,setAddress]=useState(user?.business?.address||APP_CONFIG.businessDefaults.address),[currency,setCurrency]=useState(user?.business?.currency||defaults.currency),[profilePictureUrl,setPic]=useState(user?.profilePictureUrl||''),[logoUrl,setLogo]=useState(user?.business?.logoUrl||''),[saving,setSaving]=useState(false),[logoImageOk,setLogoImageOk]=useState(true);

  async function choose(kind:'profile'|'logo'){
    const perm=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!perm.granted)return Alert.alert('Photo access required','Allow photo access to choose an image.');
    const x=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:kind==='profile',aspect:kind==='profile'?([1,1] as [number,number]):undefined,quality:.95});if(x.canceled)return;
    const asset=x.assets[0];
    if(kind==='logo'&&asset.mimeType&&!APP_CONFIG.assets.upload.preferredLogoTypes.some(t=>t===asset.mimeType!.toLowerCase()))return Alert.alert('Use PNG or JPEG for the company logo','PNG or JPEG gives the most reliable quality on invoices and report PDFs. Wide, tall and square logos are all supported.');
    try{const up=await uploadAsset({uri:asset.uri,name:asset.fileName||`${kind}.jpg`,mimeType:asset.mimeType||'image/jpeg',size:asset.fileSize,file:asset.file});if(kind==='profile')setPic(up.url);else{setLogo(up.url);setLogoImageOk(true)}}catch(e:any){Alert.alert('Upload unavailable',e.message)}
  }
  async function save(){
    if(!name.trim())return Alert.alert('Your name is required');if(!businessName.trim())return Alert.alert('Company name required','This name appears throughout your workspace and documents.');if(Number(vat)<0||Number(vat)>100)return Alert.alert('Check VAT rate','VAT percentage must be between 0 and 100.');
    setSaving(true);try{await api('/profile',{method:'PUT',body:JSON.stringify({name:name.trim(),profilePictureUrl,business:{name:businessName.trim(),legalName:legalName.trim(),logoUrl,trn:trn.trim(),vatPercent:Number(vat),email:email.trim(),phone:phone.trim(),address:address.trim(),currency:currency.trim().toUpperCase()||defaults.currency}})});await refresh();Alert.alert(APP_CONFIG.copy.profileSavedTitle,APP_CONFIG.copy.profileSavedBody)}catch(e:any){Alert.alert('Profile not saved',e.message)}finally{setSaving(false)}
  }

  return <AppBackground><ScrollView style={{flex:1}} contentContainerStyle={[s.content,page]} keyboardShouldPersistTaps="handled">
    <View style={{marginBottom:18}}><IconButton icon="arrow-back" onPress={()=>router.back()}/></View>
    <ScreenHeader title={APP_CONFIG.copy.profileTitle} subtitle={APP_CONFIG.copy.profileSubtitle}/>

    <GlassCard style={s.identityCard}>
      <View style={[s.companyMark,{backgroundColor:colors.surfaceMuted,borderColor:colors.border}]}><SmartImage kind="logo" uri={logoUrl} width="86%" height={APP_CONFIG.assets.logo.profilePreviewHeight} bordered={false} fallbackText={APP_CONFIG.shortMark} onLoadError={()=>setLogoImageOk(false)}/></View>
      <View style={s.profileRow}><TouchableOpacity onPress={()=>choose('profile')}><SmartImage kind="avatar" uri={profilePictureUrl} size={APP_CONFIG.assets.avatar.profileSize} fallbackText={name||'U'}/><View style={[s.edit,{backgroundColor:colors.primary,borderColor:colors.surfaceStrong}]}><Ionicons name="camera" size={13} color={colors.onPrimary}/></View></TouchableOpacity><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={[s.name,typography.medium,{color:colors.text}]}>{name||APP_CONFIG.copy.workspaceOwner}</Text><Text numberOfLines={1} style={[s.companyName,typography.medium,{color:colors.text}]}>{businessName||APP_CONFIG.labels.companyName}</Text><Text numberOfLines={1} style={[s.meta,typography.regular,{color:colors.textMuted}]}>{user?.email}</Text></View></View>
      <Text style={[s.brandNote,typography.regular,{color:colors.textMuted}]}>Your company remains the primary identity. Customer documents carry only a subtle “{APP_CONFIG.poweredBy}” attribution.</Text>
    </GlassCard>

    <SectionTitle title={APP_CONFIG.copy.profilePersonalTitle} subtitle={APP_CONFIG.copy.profilePersonalSubtitle}/>
    <GlassCard style={{gap:12}}><Field label="Your name" value={name} onChangeText={setName}/><Text style={[s.assetHint,typography.regular,{color:colors.textMuted}]}>{APP_CONFIG.assets.upload.profileHint}</Text><View style={s.photoActions}><View style={{flex:1}}><Button secondary icon="camera-outline" title={profilePictureUrl?'Change photo':'Add profile photo'} onPress={()=>choose('profile')} compact/></View>{profilePictureUrl?<TouchableOpacity onPress={()=>setPic('')} style={[s.removeAction,{borderColor:colors.border,backgroundColor:colors.dangerSoft}]}><Ionicons name="close" size={17} color={colors.danger}/></TouchableOpacity>:null}</View></GlassCard>

    <SectionTitle title={APP_CONFIG.copy.companyIdentityTitle} subtitle={APP_CONFIG.copy.companyIdentitySubtitle}/>
    <GlassCard style={{gap:12}}>
      <TouchableOpacity onPress={()=>choose('logo')} style={[s.logoBox,{borderColor:colors.borderStrong,backgroundColor:colors.surfaceMuted}]}><SmartImage kind="logo" uri={logoUrl} width="90%" height={108} bordered={false} fallbackText={APP_CONFIG.shortMark} onLoadError={()=>setLogoImageOk(false)}/><Text style={[s.logoText,typography.medium,{color:colors.text}]}>{logoUrl?'Tap to replace company logo':'Add company logo'}</Text><Text style={[s.logoHint,typography.regular,{color:colors.textMuted}]}>{APP_CONFIG.assets.upload.logoHint}</Text></TouchableOpacity>
      {logoUrl&&!logoImageOk?<Notice tone="warning" title={APP_CONFIG.copy.logoPreviewUnavailableTitle} body={APP_CONFIG.copy.logoPreviewUnavailableBody}/>:null}
      <View style={s.photoActions}><View style={{flex:1}}><Button secondary icon="image-outline" title={logoUrl?'Replace company logo':'Choose company logo'} onPress={()=>choose('logo')} compact/></View>{logoUrl?<TouchableOpacity onPress={()=>{setLogo('');setLogoImageOk(true)}} style={[s.removeAction,{borderColor:colors.border,backgroundColor:colors.dangerSoft}]}><Ionicons name="close" size={17} color={colors.danger}/></TouchableOpacity>:null}</View>
      <Field label={APP_CONFIG.labels.companyName} value={businessName} onChangeText={setBusiness} placeholder="Company name"/><Field label={`${APP_CONFIG.labels.legalName} (${APP_CONFIG.labels.optional})`} value={legalName} onChangeText={setLegal}/><Field label={`${APP_CONFIG.labels.trn} (${APP_CONFIG.labels.optional})`} value={trn} onChangeText={setTrn}/><Field label="Default VAT %" value={vat} onChangeText={setVat} keyboardType="decimal-pad"/><Field label={`Business email (${APP_CONFIG.labels.optional})`} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/><Field label={`${APP_CONFIG.labels.phone} (${APP_CONFIG.labels.optional})`} value={phone} onChangeText={setPhone}/><Field label={`${APP_CONFIG.labels.address} (${APP_CONFIG.labels.optional})`} value={address} onChangeText={setAddress} multiline/><Field label={APP_CONFIG.labels.currency} value={currency} onChangeText={setCurrency} autoCapitalize="characters" helper="Examples: AED, USD, GBP"/>
    </GlassCard>
    <View style={{marginTop:16}}><Button title="Save profile & company identity" onPress={save} loading={saving}/></View>
  </ScrollView></AppBackground>;
}

const s=StyleSheet.create({content:{padding:20,paddingTop:54,paddingBottom:80},identityCard:{padding:0,overflow:'hidden'},companyMark:{minHeight:150,borderBottomWidth:StyleSheet.hairlineWidth,alignItems:'center',justifyContent:'center',paddingHorizontal:18},profileRow:{flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:18,paddingTop:16},edit:{position:'absolute',right:-3,bottom:-3,width:29,height:29,borderRadius:10,alignItems:'center',justifyContent:'center',borderWidth:2},name:{fontSize:18},companyName:{fontSize:13,marginTop:4},meta:{fontSize:11,marginTop:3},brandNote:{fontSize:10,lineHeight:16,padding:18,paddingTop:13},photoActions:{flexDirection:'row',gap:8,alignItems:'center'},removeAction:{width:44,height:44,borderRadius:15,borderWidth:1,alignItems:'center',justifyContent:'center'},logoBox:{minHeight:160,borderWidth:1,borderStyle:'dashed',borderRadius:20,alignItems:'center',justifyContent:'center',gap:7,padding:14},logoText:{fontSize:14},logoHint:{fontSize:9.5,textAlign:'center',lineHeight:14},assetHint:{fontSize:10,lineHeight:15}});
