import {useEffect,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Redirect} from 'expo-router';
import {useSession} from '@/lib/session';
import {WELCOME_SEEN_KEY} from '@/lib/onboarding';
import {typography,useTheme} from '@/lib/theme';

export default function Index(){
  const{token,loading}=useSession();
  const{colors}=useTheme();
  const[welcomeSeen,setWelcomeSeen]=useState<boolean|null>(null);

  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then(value=>{if(active)setWelcomeSeen(value==='true')})
      .catch(()=>{if(active)setWelcomeSeen(false)});
    return()=>{active=false};
  },[]);

  if(loading||welcomeSeen===null)return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background}}>
    <ActivityIndicator color={colors.primary}/>
    <Text accessibilityLiveRegion="polite" style={[typography.regular,{color:colors.textMuted,marginTop:12}]}>Opening TekBooks...</Text>
  </View>;
  if(token)return <Redirect href="/(tabs)"/>;
  return <Redirect href={welcomeSeen?'/(auth)/login':'/(auth)/welcome'}/>;
}
