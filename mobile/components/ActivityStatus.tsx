import {useSyncExternalStore} from 'react';
import {ActivityIndicator,StyleSheet,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getActivitySnapshot,subscribeToActivity} from '@/lib/activity';
import {typography,useTheme} from '@/lib/theme';

export function ActivityStatus({inline=false}:{inline?:boolean}){
  const{current,count}=useSyncExternalStore(subscribeToActivity,getActivitySnapshot,getActivitySnapshot);
  const{colors}=useTheme();const insets=useSafeAreaInsets();
  if(!current)return null;
  return <View pointerEvents="none" style={inline?styles.inline:[styles.position,{top:insets.top+8}]}>
    <View accessible accessibilityRole="progressbar" accessibilityLiveRegion="polite" accessibilityLabel={current.label} accessibilityState={{busy:true}} style={[styles.card,{backgroundColor:colors.surfaceStrong,borderColor:colors.borderStrong}]}>
      <ActivityIndicator color={colors.primary}/>
      <View style={{flex:1,minWidth:0}}>
        <Text style={[typography.medium,{color:colors.text,fontSize:12}]}>{current.label}</Text>
        {current.slow?<Text style={[styles.hint,typography.regular,{color:colors.textMuted}]}>This is taking longer than usual. Still working…</Text>:null}
        {count>1?<Text style={[styles.hint,typography.regular,{color:colors.textMuted}]}>{count} operations in progress</Text>:null}
      </View>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  position:{position:'absolute',left:16,right:16,zIndex:100,elevation:10,alignItems:'center'},
  inline:{marginBottom:12},
  card:{width:'100%',maxWidth:560,borderWidth:1,borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',gap:10},
  hint:{fontSize:10.5,lineHeight:16,marginTop:3},
});
