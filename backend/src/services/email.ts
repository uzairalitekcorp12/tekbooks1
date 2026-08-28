import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const shell = (title: string, body: string) => `<div style="background:#F9FFFE;padding:32px 18px;font-family:Arial,sans-serif;color:#000E11"><div style="max-width:520px;margin:auto;background:#fff;border:1px solid #DCEAE8;border-radius:20px;padding:28px"><div style="font-size:22px;font-weight:700;color:#10C8A9">TekBooks</div><div style="font-size:11px;color:#52696C;margin-top:3px">Business book keeping, beautifully clear</div><h2 style="font-size:22px;margin:28px 0 10px">${title}</h2>${body}<div style="border-top:1px solid #DCEAE8;margin-top:28px;padding-top:16px;color:#789093;font-size:11px">Powered by TekBooks</div></div></div>`;

/** Resend's shared testing sender can deliver only to the Resend account email. */
export function assertEmailRecipientAllowed(email: string) {
  if (!env.RESEND_TEST_MODE) return;
  if (email.trim().toLowerCase() === env.RESEND_TEST_RECIPIENT.trim().toLowerCase()) return;
  const failure: any = new Error('Email delivery is temporarily limited to the configured TekBooks test account. Use that email until a custom sending domain is connected.');
  failure.status = 403;
  failure.code = 'EMAIL_TEST_RECIPIENT_ONLY';
  throw failure;
}

async function send(message: { to: string; subject: string; html: string }) {
  if (!resend) return null;
  assertEmailRecipientAllowed(message.to);
  const { data, error } = await resend.emails.send({ from: env.RESEND_FROM, ...message });
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
  return send({
    to: email,
    subject: `TekBooks - ${title}`,
    html: shell(title, `<p style="color:#52696C;line-height:1.6">Use the secure code below to continue.</p><div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:17px;background:#F2FBF9;border:1px solid rgba(16,200,169,.2);border-radius:14px;text-align:center;color:#000E11">${code}</div><p style="color:#789093;font-size:12px;line-height:1.5">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`)
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
    html: shell(
      approved ? 'Your workspace is ready' : 'Workspace access update',
      `<p style="color:#52696C;line-height:1.6">Your TekBooks workspace has been <strong>${approved ? 'approved' : 'not approved'}</strong>. ${approved ? 'You can now sign in securely from your approved phone.' : 'Please contact support if you believe this needs review.'}</p>`
    )
  });
}

export async function sendSystemTestEmail(email: string) {
  if (!resend) throw new Error('RESEND_API_KEY is not configured.');
  return send({
    to: email,
    subject: 'TekBooks setup test',
    html: shell('Your email setup works', '<p style="color:#52696C;line-height:1.6">TekBooks successfully connected to Resend. Signup, password-reset, device-change, and approval messages use this same delivery service.</p>')
  });
}
