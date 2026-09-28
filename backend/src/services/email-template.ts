const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function emailTemplate(title:string,body:string,preview:string,eyebrow='ACCOUNT SECURITY'){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
  <style>body{margin:0!important}table{border-collapse:collapse}a{color:#087e6d}@media screen and (max-width:600px){.outer{padding:16px 8px!important}.content{padding:28px 22px!important}.headline{font-size:28px!important}.code{font-size:30px!important;letter-spacing:7px!important}}@keyframes email-arrive{from{transform:translateY(6px)}to{transform:translateY(0)}}.email-card{animation:email-arrive .6s ease-out}@media (prefers-reduced-motion:reduce){.email-card{animation:none!important}}</style></head>
  <body style="margin:0;background:#eef4f3;font-family:Arial,Helvetica,sans-serif;color:#142b2b">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escape(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f3"><tr><td class="outer" align="center" style="padding:40px 16px">
  <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dce7e4;border-radius:20px;overflow:hidden">
  <tr><td style="padding:28px 32px;background:#082c2b;border-bottom:4px solid #23d5b5;border-radius:20px 20px 0 0"><table role="presentation" width="100%"><tr><td style="font-size:24px;font-weight:700;letter-spacing:-1px;color:#ffffff">Tek<span style="color:#54e0c7">Books</span></td><td align="right" style="font-size:10px;letter-spacing:1px;color:#b6d4cf">YOUR BUSINESS, CLEARER</td></tr></table></td></tr>
  <tr><td class="content" style="padding:36px 34px 32px"><p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:2px;color:#087e6d">${escape(eyebrow)}</p><h1 class="headline" style="margin:0 0 18px;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:-1px;color:#102c2b">${escape(title)}</h1>${body}</td></tr>
  <tr><td style="padding:20px 34px;background:#f7faf9;border-top:1px solid #e3ece9;border-radius:0 0 20px 20px"><p style="margin:0;font-size:11px;line-height:18px;color:#607a74">Sent by TekBooks for your account. Keep security codes private; our team will never ask you to share one.</p></td></tr></table>
  <p style="margin:22px 0 0;font-size:11px;line-height:18px;color:#6c807a">Powered by TekBooks &nbsp;·&nbsp; Built by Tekcorp<br>Business bookkeeping, beautifully clear.</p>
  </td></tr></table></body></html>`;
}
export function codeEmailContent(code:string,purpose:string){
  const descriptions:Record<string,string>={PASSWORD_RESET:'Enter this code in TekBooks to choose a new password for your account.',DEVICE_CHANGE:'Enter this code on your new device to authorize the sign-in. You can also approve the request in Device requests on your registered phone.',SIGNUP:'Welcome to TekBooks. Enter this code in the app to verify your email and continue setting up your workspace.'};
  const description=descriptions[purpose]||descriptions.SIGNUP;
  const html=`<p style="margin:0 0 24px;font-size:14px;line-height:23px;color:#536c66">${description}</p>
  <table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px;background:#f0faf6;border:1px solid #cce9de;border-radius:14px"><p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;font-weight:700;color:#52796a">YOUR VERIFICATION CODE</p><div class="code" style="font-family:Consolas,'Courier New',monospace;font-size:38px;font-weight:700;letter-spacing:10px;color:#103f36;line-height:48px">${escape(code)}</div><p style="margin:10px 0 0;font-size:11px;color:#58796d">Expires in 10 minutes &nbsp;·&nbsp; One-time use</p></td></tr></table>
  <p style="margin:24px 0 8px;font-size:12px;font-weight:700;color:#213e36">Didn’t request this?</p><p style="margin:0;font-size:12px;line-height:20px;color:#627a71">You can ignore this email. Do not share this code or approve a device you do not recognize.</p>`;
  return{html,text:`${description}\n\nYour verification code: ${code}\nExpires in 10 minutes. One-time use.\n\nIf you did not request this, ignore this email. Never share your code.`};
}
