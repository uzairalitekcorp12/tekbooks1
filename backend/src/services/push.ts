import { env } from '../config/env.js';
export async function sendExpoPush(token: string, title: string, body: string, data: Record<string, any> = {}) {
  if (!token?.startsWith('ExponentPushToken') && !token?.startsWith('ExpoPushToken')) return;
  try {
    const response=await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.EXPO_PUSH_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` } : {})
      },
      body: JSON.stringify({ to: token, title, body, sound: 'default', data: { type: 'DEVICE_CHANGE', ...data } }),
      signal:AbortSignal.timeout(5000),
    });
    const result:any=await response.json();
    if(!response.ok||result?.data?.status==='error'||result?.errors?.length)console.warn('Device approval push was not accepted by Expo');
  } catch (e) { console.warn('Push notification failed', e); }
}
