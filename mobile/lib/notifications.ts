import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import {APP_CONFIG} from '@/config/app';

/**
 * Remote push notifications are not available in Expo Go on Android for SDK 53+.
 * Do not import expo-notifications at module scope: importing it inside Expo Go
 * triggers its native push auto-registration side effect before our guard can run.
 */
export function isExpoGo() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

async function loadNotifications() {
  if (isExpoGo()) return null;
  return import('expo-notifications');
}

export async function setupNotificationHandling(onUrl: (url: string) => void) {
  const Notifications = await loadNotifications();
  if (!Notifications) return () => {};

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const url = (response.notification.request.content.data as any)?.url;
      if (typeof url === 'string' && url) onUrl(url);
    });

    return () => subscription.remove();
  } catch (error) {
    if (__DEV__) console.warn('Notification listener disabled:', error);
    return () => {};
  }
}

export async function registerPushToken() {
  if (!Device.isDevice || isExpoGo()) return '';

  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return '';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: APP_CONFIG.name,
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.status !== 'granted') return '';

    const projectId = Constants.easConfig?.projectId || (Constants.expoConfig?.extra as any)?.eas?.projectId;
    if (!projectId) return '';

    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    if (__DEV__) console.warn('Push registration skipped:', error);
    return '';
  }
}
