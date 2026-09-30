import {ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {AuthBrandHeader} from '@/components/Auth';
import {AppBackground,Button,GlassCard,useResponsivePage} from '@/components/UI';
import {typography,useTheme} from '@/lib/theme';

export default function Pending(){
  const{colors}=useTheme();
  const page=useResponsivePage(false);
  return <AppBackground>
    <ScrollView contentContainerStyle={[s.wrap,page]}>
      <AuthBrandHeader/>
      <GlassCard style={s.card}>
        <View style={[s.icon,{backgroundColor:colors.accentSoft}]}>
          <Ionicons name="shield-checkmark" size={34} color={colors.primary}/>
        </View>
        <Text style={[s.title,typography.medium,{color:colors.text}]}>Your workspace is being reviewed</Text>
        <Text style={[s.description,typography.regular,{color:colors.textMuted}]}>Your email is verified. We'll email you when your workspace is ready to use.</Text>
        <Button title="Return to sign in" onPress={()=>router.replace('/(auth)/login')}/>
      </GlassCard>
    </ScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{padding:22,paddingTop:38,paddingBottom:40},
  card:{alignItems:'center',gap:16,padding:24},
  icon:{width:72,height:72,borderRadius:24,alignItems:'center',justifyContent:'center'},
  title:{fontSize:22,textAlign:'center'},
  description:{fontSize:13,lineHeight:20,textAlign:'center',marginBottom:6},
});
