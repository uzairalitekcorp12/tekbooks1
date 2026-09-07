import {useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {AuthBackButton} from '@/components/Auth';
import {AppBackground,Button,Field,GlassCard,useResponsivePage} from '@/components/UI';
import {api} from '@/lib/api';
import {getDeviceIdentity} from '@/lib/device';
import {useSession} from '@/lib/session';
import {typography,useTheme} from '@/lib/theme';

export default function DeviceVerify(){
  const p=useLocalSearchParams<{email:string;challengeId?:string;challengeSecret?:string}>();
  const[code,setCode]=useState('');
  const{signIn}=useSession();
  const{colors}=useTheme();
  const page=useResponsivePage(false);

  async function go(){
    try{
      const device=await getDeviceIdentity();
      const d=await api('/auth/device/verify',{method:'POST',body:JSON.stringify({email:p.email,code,...device})});
      await signIn(d.token,d.user);
      router.replace('/(tabs)');
    }catch(e:any){
      Alert.alert('Device verification failed',e.message);
    }
  }

  async function checkCurrent(){
    try{
      const device=await getDeviceIdentity();
      const d=await api('/auth/device/status',{method:'POST',body:JSON.stringify({challengeId:p.challengeId,challengeSecret:p.challengeSecret,...device})});
      if(d.approved){
        await signIn(d.token,d.user);
        router.replace('/(tabs)');
      }else{
        Alert.alert('Waiting',d.message);
      }
    }catch(e:any){
      Alert.alert('Approval check',e.message);
    }
  }

  return <AppBackground>
    <ScrollView contentContainerStyle={[s.wrap,page]} keyboardShouldPersistTaps="handled">
      <AuthBackButton label="Cancel sign in"/>
      <Text style={[s.h1,typography.medium,{color:colors.text}]}>New device detected</Text>
      <Text style={[s.p,typography.regular,{color:colors.textMuted}]}>This account is already bound to another Android device. Enter the email code or approve the request from the current phone.</Text>
      <GlassCard style={s.card}>
        <Field label="Device approval code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}/>
        <Button title="Continue with email code" onPress={go}/>
        {p.challengeId?<Button secondary title="Check approval from current phone" onPress={checkCurrent}/>:null}
      </GlassCard>
    </ScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:24,paddingBottom:40},
  h1:{fontSize:32,marginTop:34},
  p:{lineHeight:21,marginTop:10},
  card:{gap:14,marginTop:24},
});
