import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';

/**
 * SecureStore is native-only. Keep Android/iOS values in encrypted platform
 * storage and use the browser's AsyncStorage adapter when running Expo Web.
 */
export function getPrivateItem(key:string){
  return Platform.OS==='web'?AsyncStorage.getItem(key):SecureStore.getItemAsync(key);
}

export function setPrivateItem(key:string,value:string){
  return Platform.OS==='web'?AsyncStorage.setItem(key,value):SecureStore.setItemAsync(key,value);
}

export function deletePrivateItem(key:string){
  return Platform.OS==='web'?AsyncStorage.removeItem(key):SecureStore.deleteItemAsync(key);
}
