import { env } from '../config/env.js';
export async function sendExpoPush(token: string, title: string, body: string, data: Record<string, any> = {}) {
  if (!token?.startsWith('ExponentPushToken') && !token?.startsWith('ExpoPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.EXPO_PUSH_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` } : {})
      },
      body: JSON.stringify({ to: token, title, body, sound: 'default', data: { type: 'DEVICE_CHANGE', ...data } })
    });
  } catch (e) { console.warn('Push notification failed', e); }
}
