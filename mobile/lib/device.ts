import {Platform} from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Constants,{ExecutionEnvironment} from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

export async function getDeviceIdentity(){
  const expoGo=Constants.executionEnvironment===ExecutionEnvironment.StoreClient;
  let deviceId='';
  if(Platform.OS==='android'&&!expoGo){
    try{deviceId=Application.getAndroidId()||''}catch{}
  }
  // Expo Go cannot represent the final signed APK identity, so development uses a
  // persistent installation ID. Standalone/development builds use ANDROID_ID.
  if(!deviceId){
    deviceId=await SecureStore.getItemAsync('tekbooks_dev_install_id')||'';
    if(!deviceId){deviceId=Crypto.randomUUID();await SecureStore.setItemAsync('tekbooks_dev_install_id',deviceId)}
  }
  const label=[Device.manufacturer,Device.modelName].filter(Boolean).join(' ')||`${Platform.OS} device`;
  return{deviceId,deviceLabel:label,expoGo};
}
