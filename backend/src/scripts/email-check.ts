import { env } from '../config/env.js';
import { resolveEmailRecipient, sendSystemTestEmail } from '../services/email.js';

const inline = process.argv.find(value => value.startsWith('--recipient='));
const requested = inline?.slice('--recipient='.length).trim() || env.LOGIN_USERNAME;

try {
  if (!requested) throw new Error('Set LOGIN_USERNAME or pass --recipient=<login-or-email>.');
  const delivery = resolveEmailRecipient(requested);
  if (requested.toLowerCase().endsWith('@tekbooks') && delivery.toLowerCase() === requested.toLowerCase()) {
    throw new Error('LOGIN_NOTIFICATION_EMAIL is required for an internal TekBooks login.');
  }
  const result = await sendSystemTestEmail(requested);
  console.log(`Email routing check passed; Resend accepted the configured notification inbox (${result?.id || 'accepted'}).`);
} catch (error: any) {
  console.error('Email routing check failed:', error?.message || error);
  process.exitCode = 1;
}
