import { Resend } from 'resend';
import { env } from '../config/env.js';
import {codeEmailContent,emailTemplate} from './email-template.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** Keep the internal TekBooks login separate from its deliverable inbox. */
export function resolveEmailRecipient(email: string) {
  const normalized = email.trim().toLowerCase();
  if (env.LOGIN_NOTIFICATION_EMAIL && (
    normalized===env.LOGIN_USERNAME.toLowerCase() ||
    (env.LOGIN_USER_EMAIL&&normalized===env.LOGIN_USER_EMAIL.toLowerCase())
  )) {
    return env.LOGIN_NOTIFICATION_EMAIL;
  }
  return normalized;
}

/** Resend's shared testing sender can deliver only to the Resend account email. */
export function assertEmailRecipientAllowed(email: string) {
  if (!env.RESEND_TEST_MODE) return;
  if (email.trim().toLowerCase() === env.RESEND_TEST_RECIPIENT.trim().toLowerCase()) return;
  const failure: any = new Error('Email delivery is temporarily limited to the configured TekBooks test account. Use that email until a custom sending domain is connected.');
  failure.status = 403;
  failure.code = 'EMAIL_TEST_RECIPIENT_ONLY';
  throw failure;
}

async function send(message: { to: string; subject: string; html: string; text:string }) {
  if (!resend) return null;
  const to = resolveEmailRecipient(message.to);
  assertEmailRecipientAllowed(to);
  const { data, error } = await resend.emails.send({ from: env.RESEND_FROM, ...message, to });
  if (error) {
    const failure: any = new Error(`Resend rejected the email: ${error.message || error.name || 'unknown error'}`);
    failure.status = 502;
    failure.code = 'EMAIL_DELIVERY_FAILED';
    throw failure;
  }
  return data;
}

export async function sendCodeEmail(email: string, code: string, purpose: string) {
  const title = purpose === 'PASSWORD_RESET'
    ? 'Reset your password'
    : purpose === 'DEVICE_CHANGE'
      ? 'Authorize a new device'
      : 'Verify your business email';
  if (!resend) {
    if (env.NODE_ENV !== 'production' && env.EMAIL_DEV_LOG_CODES) {
      console.log(`[DEV EMAIL] ${purpose} code for ${email}: ${code}`);
    }
    return null;
  }
  const content=codeEmailContent(code,purpose);
  return send({
    to: email,
    subject: `TekBooks - ${title}`,
    html:emailTemplate(title,content.html,'Your TekBooks verification code expires in 10 minutes.'),
    text:`TekBooks — ${title}\n\n${content.text}`,
  });
}

export async function sendApprovalEmail(email: string, approved: boolean) {
  if (!resend) {
    if (env.NODE_ENV !== 'production') console.log(`[DEV EMAIL] Workspace ${approved ? 'approved' : 'rejected'} for ${email}`);
    return null;
  }
  return send({
    to: email,
    subject: `TekBooks workspace ${approved ? 'approved' : 'update'}`,
    html: emailTemplate(
      approved ? 'Your workspace is ready' : 'Workspace access update',
      `<p style="font-size:14px;color:#536c66;line-height:24px">Your TekBooks workspace has been <strong>${approved ? 'approved' : 'not approved'}</strong>. ${approved ? 'Open TekBooks and sign in to start managing your business.' : 'Please contact support if you believe this needs review.'}</p><p style="padding:18px;background:#f0faf6;border:1px solid #cce9de;border-radius:12px;font-size:13px;line-height:22px;color:#245c4e">${approved?'Your invoices, contacts, transactions and reports are ready in your workspace.':'Your workspace access requires a review before you can continue.'}</p>`,
      approved?'Your TekBooks workspace is approved and ready.':'An update on your TekBooks workspace.',
      'WORKSPACE UPDATE'
    ),
    text:`Your TekBooks workspace has been ${approved?'approved. Open the app and sign in.':'not approved. Please contact support if you believe this needs review.'}`,
  });
}

export async function sendSystemTestEmail(email: string) {
  if (!resend) throw new Error('RESEND_API_KEY is not configured.');
  return send({
    to: email,
    subject: 'TekBooks setup test',
    html:emailTemplate('Your email setup works','<p style="font-size:14px;color:#536c66;line-height:24px">TekBooks successfully connected to Resend and routed this message to your configured inbox.</p><p style="padding:18px;background:#f0faf6;border:1px solid #cce9de;border-radius:12px;font-size:13px;line-height:22px;color:#245c4e">Signup verification, password resets, device approvals and workspace updates all use this delivery service.</p>','Your TekBooks email connection and inbox routing are ready.','CONNECTION CONFIRMED'),
    text:'TekBooks successfully connected to Resend and routed this message to your configured inbox. Signup, password-reset, device-change and approval messages use this delivery service.',
  });
}
