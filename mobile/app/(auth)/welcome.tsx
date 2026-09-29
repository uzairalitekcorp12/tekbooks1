import AsyncStorage from '@react-native-async-storage/async-storage';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {ScrollView,StyleSheet,Text,View} from 'react-native';
import {AuthBrand} from '@/components/Auth';
import {AppBackground,Button,useResponsivePage} from '@/components/UI';
import {APP_CONFIG} from '@/config/app';
import {WELCOME_SEEN_KEY} from '@/lib/onboarding';
import {typography,useTheme} from '@/lib/theme';

const benefits=[
  {icon:'receipt-outline' as const,title:'Invoices made simple',body:'Create polished invoices and keep receivables in view.'},
  {icon:'stats-chart-outline' as const,title:'Know your numbers',body:'See income, expenses, VAT and reports in one clear workspace.'},
  {icon:'shield-checkmark-outline' as const,title:'Private by design',body:'Your business records stay protected behind secure account access.'},
];

export default function Welcome(){
  const{colors}=useTheme();
  const page=useResponsivePage(false);
  async function continueToLogin(){
    await AsyncStorage.setItem(WELCOME_SEEN_KEY,'true').catch(()=>{});
    router.replace('/(auth)/login');
  }

  return <AppBackground>
    <ScrollView contentContainerStyle={[s.wrap,page]} showsVerticalScrollIndicator={false}>
      <View style={s.brand}><AuthBrand/></View>
      <View style={s.copy}>
        <Text style={[s.eyebrow,typography.medium,{color:colors.primary}]}>{APP_CONFIG.copy.welcomeEyebrow}</Text>
        <Text style={[s.title,typography.medium,{color:colors.text}]}>{APP_CONFIG.copy.welcomeTitle}</Text>
        <Text style={[s.body,typography.regular,{color:colors.textMuted}]}>{APP_CONFIG.copy.welcomeBody}</Text>
      </View>
      <View style={[s.benefits,{backgroundColor:colors.surface,borderColor:colors.borderStrong}]}>
        {benefits.map((item,index)=><View key={item.title} style={[s.benefit,index>0&&{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border}]}>
          <View style={[s.icon,{backgroundColor:colors.accentSoft}]}><Ionicons name={item.icon} size={21} color={colors.primary}/></View>
          <View style={{flex:1,minWidth:0}}>
            <Text style={[s.benefitTitle,typography.medium,{color:colors.text}]}>{item.title}</Text>
            <Text style={[s.benefitBody,typography.regular,{color:colors.textMuted}]}>{item.body}</Text>
          </View>
        </View>)}
      </View>
      <View style={s.action}>
        <Button title="Get started" icon="arrow-forward" onPress={continueToLogin}/>
        <Text style={[s.note,typography.regular,{color:colors.textSoft}]}>A Tekcorp product for clearer business decisions.</Text>
      </View>
    </ScrollView>
  </AppBackground>;
}

const s=StyleSheet.create({
  wrap:{flexGrow:1,justifyContent:'center',paddingTop:38,paddingBottom:34},
  brand:{width:'100%',alignItems:'center',marginBottom:30},
  copy:{alignItems:'center',paddingHorizontal:4},
  eyebrow:{fontSize:10,letterSpacing:2.1,marginBottom:12},
  title:{fontSize:34,lineHeight:41,letterSpacing:-1.2,textAlign:'center',maxWidth:520},
  body:{fontSize:14,lineHeight:22,textAlign:'center',maxWidth:500,marginTop:13},
  benefits:{borderRadius:26,borderWidth:StyleSheet.hairlineWidth,overflow:'hidden',marginTop:28,paddingHorizontal:18},
  benefit:{flexDirection:'row',gap:13,alignItems:'center',paddingVertical:16},
  icon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},
  benefitTitle:{fontSize:14},
  benefitBody:{fontSize:11.5,lineHeight:17,marginTop:3},
  action:{marginTop:24,gap:14},
  note:{fontSize:10.5,textAlign:'center'},
});
