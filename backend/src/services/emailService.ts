/**
 * Email delivery service — Nodemailer with any SMTP provider.
 * Works with SendGrid, Mailgun, AWS SES, Gmail, or any SMTP server.
 * If SMTP credentials are not set in .env, emails are logged to console (dev mode).
 */
import nodemailer from 'nodemailer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: { user, pass },
  });
}

const FROM_NAME  = process.env.EMAIL_FROM_NAME  || 'FALAK Platform';
const FROM_EMAIL = process.env.EMAIL_FROM_EMAIL || 'noreply@example.com';
const APP_URL    = process.env.FRONTEND_URL     || 'http://localhost:5173';

/* ── Core send ────────────────────────────────────────────────────────── */
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!to || !to.includes('@')) return;
  const t = getTransporter();
  if (!t) {
    // Dev mode — log to console instead of sending
    console.log(`\n📧 [EMAIL] To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Preview: ${html.replace(/<[^>]+>/g, '').trim().slice(0, 160)}\n`);
    return;
  }
  try {
    await t.sendMail({ from: `"${FROM_NAME}" <${FROM_EMAIL}>`, to, subject, html });
  } catch (err) {
    console.error('[emailService] Failed to send email:', err);
  }
}

/* ── HTML base template ───────────────────────────────────────────────── */
function layout(body: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0d0d0d;color:#d4d4d4}
.wrap{max-width:600px;margin:32px auto;background:#171717;border:1px solid #262626;border-radius:14px;overflow:hidden}
.hdr{background:linear-gradient(135deg,#1c1c1c 0%,#222 100%);padding:28px 36px;border-bottom:1px solid #262626}
.hdr-logo{font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px}
.hdr-sub{font-size:12px;color:#666;margin-top:4px}
.bdy{padding:32px 36px}
.bdy h2{font-size:20px;font-weight:700;color:#fff;margin-bottom:12px;line-height:1.3}
.bdy p{font-size:14px;color:#999;line-height:1.7;margin-bottom:16px}
.bdy p.light{color:#bbb}
.card{background:#1f1f1f;border:1px solid #2a2a2a;border-radius:10px;padding:20px 24px;margin:20px 0}
.row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #262626;font-size:13px}
.row:last-child{border-bottom:none}
.row .lbl{color:#666}
.row .val{color:#e5e5e5;font-weight:500;text-align:right;max-width:60%}
.badge{display:inline-block;padding:3px 11px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.3px}
.badge-blue{background:#1e3a5f;color:#60a5fa;border:1px solid #2563eb44}
.badge-green{background:#14532d;color:#4ade80;border:1px solid #16a34a44}
.badge-amber{background:#451a03;color:#fbbf24;border:1px solid #d9770644}
.badge-red{background:#450a0a;color:#f87171;border:1px solid #dc262644}
.btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 28px;border-radius:9px;font-size:14px;font-weight:600;margin:6px 0;letter-spacing:0.2px}
.btn:hover{background:#1d4ed8}
.divider{height:1px;background:#262626;margin:24px 0}
.ftr{background:#111;padding:20px 36px;border-top:1px solid #1a1a1a;text-align:center}
.ftr p{font-size:11px;color:#404040}
.ftr a{color:#555;text-decoration:none}
</style>
</head>
<body>
${preheader ? `<span style="display:none;font-size:1px;color:#0d0d0d;max-height:0;overflow:hidden">${preheader}&nbsp;</span>` : ''}
<div class="wrap">
  <div class="hdr">
    <div class="hdr-logo">${FROM_NAME}</div>
    <div class="hdr-sub">Influencer Marketing Platform</div>
  </div>
  <div class="bdy">${body}</div>
  <div class="ftr">
    <p>&copy; ${new Date().getFullYear()} ${FROM_NAME} &mdash; <a href="${APP_URL}">Visit platform</a></p>
    <p style="margin-top:6px">You received this email because you have an account on ${FROM_NAME}.</p>
  </div>
</div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   TEMPLATES
═══════════════════════════════════════════════════════════════════════ */

/** Sent to any new user right after account creation */
export async function sendWelcomeEmail(to: string, name: string, role: string): Promise<void> {
  const labels: AnyObj = { agency: 'Agency', platform_admin: 'Admin', brand: 'Brand', talent_manager: 'Talent Manager', influencer: 'Influencer' };
  const label = labels[role] || role;
  await send(to, `Welcome to ${FROM_NAME}!`, layout(`
    <h2>Welcome, ${name}! 👋</h2>
    <p class="light">Your <span class="badge badge-blue">${label}</span> account is ready. You now have access to the full influencer management platform.</p>
    <div class="card">
      <div class="row"><span class="lbl">Email</span><span class="val">${to}</span></div>
      <div class="row"><span class="lbl">Role</span><span class="val">${label}</span></div>
    </div>
    <a href="${APP_URL}/login" class="btn">Sign in to your account →</a>
    <div class="divider"></div>
    <p style="font-size:12px;color:#444">If you didn't create this account, you can safely ignore this email.</p>
  `, `Your ${FROM_NAME} account is ready to use`));
}

/** Sent to influencer when agency sends them an offer */
export async function sendOfferReceivedEmail(to: string, opts: {
  influencerName: string;
  campaignName?: string;
  offerTitle: string;
  rate?: number;
  currency?: string;
  deadline?: string;
  platform?: string;
}): Promise<void> {
  const rateStr = opts.rate ? `${opts.currency || 'SAR'} ${opts.rate.toLocaleString()}` : 'To be discussed';
  const portalUrl = `${APP_URL}/portal/offers`;
  await send(to, `New collaboration offer: ${opts.offerTitle}`, layout(`
    <h2>You have a new offer! 🎉</h2>
    <p class="light">Hi ${opts.influencerName}, an agency has sent you a collaboration offer. Log in to your portal to review and respond.</p>
    <div class="card">
      <div class="row"><span class="lbl">Offer</span><span class="val">${opts.offerTitle}</span></div>
      ${opts.campaignName ? `<div class="row"><span class="lbl">Campaign</span><span class="val">${opts.campaignName}</span></div>` : ''}
      ${opts.platform ? `<div class="row"><span class="lbl">Platform</span><span class="val">${opts.platform}</span></div>` : ''}
      <div class="row"><span class="lbl">Rate</span><span class="val">${rateStr}</span></div>
      ${opts.deadline ? `<div class="row"><span class="lbl">Deadline</span><span class="val">${new Date(opts.deadline).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span></div>` : ''}
    </div>
    <a href="${portalUrl}" class="btn">Review Offer →</a>
  `, `New offer: ${opts.offerTitle}`));
}

/** Sent to agency when influencer accepts/declines an offer */
export async function sendOfferStatusEmail(to: string, opts: {
  agencyName?: string;
  influencerName: string;
  offerTitle: string;
  status: 'accepted' | 'declined' | 'counter';
  counterRate?: number;
  currency?: string;
  notes?: string;
  offerId: string;
}): Promise<void> {
  const cfg = {
    accepted: { label: 'Accepted ✓', badge: 'badge-green', msg: `accepted your offer` },
    declined: { label: 'Declined ✗',  badge: 'badge-red',   msg: `declined your offer` },
    counter:  { label: 'Counter Offer', badge: 'badge-blue', msg: `sent a counter-offer for` },
  }[opts.status];

  await send(to, `Offer ${cfg.label}: ${opts.offerTitle}`, layout(`
    <h2>${opts.influencerName} ${cfg.msg}</h2>
    <p><span class="badge ${cfg.badge}">${cfg.label}</span></p>
    <div class="card">
      <div class="row"><span class="lbl">Influencer</span><span class="val">${opts.influencerName}</span></div>
      <div class="row"><span class="lbl">Offer</span><span class="val">${opts.offerTitle}</span></div>
      ${opts.counterRate ? `<div class="row"><span class="lbl">Counter Rate</span><span class="val">${opts.currency || 'SAR'} ${opts.counterRate.toLocaleString()}</span></div>` : ''}
      ${opts.notes ? `<div class="row"><span class="lbl">Notes</span><span class="val">${opts.notes}</span></div>` : ''}
    </div>
    <a href="${APP_URL}/offers/${opts.offerId}" class="btn">View Offer →</a>
  `, `${opts.influencerName} ${cfg.msg}: ${opts.offerTitle}`));
}

/** Sent to agency when influencer submits a deliverable */
export async function sendDeliverableSubmittedEmail(to: string, opts: {
  influencerName: string;
  offerTitle: string;
  contentUrl: string;
  caption?: string;
  offerId: string;
}): Promise<void> {
  await send(to, `Content submitted: ${opts.offerTitle}`, layout(`
    <h2>Deliverable submitted for review 📥</h2>
    <p class="light"><strong>${opts.influencerName}</strong> has submitted their content for <strong>${opts.offerTitle}</strong>.</p>
    <div class="card">
      <div class="row"><span class="lbl">Influencer</span><span class="val">${opts.influencerName}</span></div>
      <div class="row"><span class="lbl">Offer</span><span class="val">${opts.offerTitle}</span></div>
      <div class="row"><span class="lbl">Content URL</span><span class="val"><a href="${opts.contentUrl}" style="color:#60a5fa">${opts.contentUrl.slice(0, 50)}${opts.contentUrl.length > 50 ? '…' : ''}</a></span></div>
      ${opts.caption ? `<div class="row"><span class="lbl">Caption</span><span class="val">${String(opts.caption).slice(0, 120)}</span></div>` : ''}
    </div>
    <a href="${APP_URL}/offers/${opts.offerId}" class="btn">Review & Approve →</a>
  `, `${opts.influencerName} submitted content for ${opts.offerTitle}`));
}

/** Sent to influencer after their deliverable is reviewed */
export async function sendDeliverableReviewedEmail(to: string, opts: {
  influencerName: string;
  offerTitle: string;
  approved: boolean;
  feedback?: string;
}): Promise<void> {
  const status = opts.approved ? 'approved' : 'needs revision';
  await send(to, `Content ${opts.approved ? 'approved ✓' : 'needs revision'}: ${opts.offerTitle}`, layout(`
    <h2>Your content has been ${status}</h2>
    <p><span class="badge ${opts.approved ? 'badge-green' : 'badge-amber'}">${opts.approved ? '✓ Approved' : '↺ Revision Requested'}</span></p>
    ${opts.feedback ? `<div class="card"><p style="color:#ccc;font-size:14px;line-height:1.7">"${opts.feedback}"</p></div>` : ''}
    <p>${opts.approved
      ? 'Great work! Your payment will be processed shortly.'
      : 'Please review the feedback above and submit a revised version.'
    }</p>
    <a href="${APP_URL}/portal/offers" class="btn">View in Portal →</a>
  `, `Your submission for ${opts.offerTitle} ${status}`));
}

/** Sent to influencer when agency marks payment as sent */
export async function sendPaymentSentEmail(to: string, opts: {
  influencerName: string;
  offerTitle: string;
  amount: number;
  currency: string;
  reference?: string;
}): Promise<void> {
  await send(to, `Payment sent: ${opts.currency} ${opts.amount.toLocaleString()}`, layout(`
    <h2>Your payment has been sent! 💸</h2>
    <p class="light">Hi ${opts.influencerName}, payment for your campaign work has been processed.</p>
    <div class="card">
      <div class="row"><span class="lbl">Campaign</span><span class="val">${opts.offerTitle}</span></div>
      <div class="row"><span class="lbl">Amount</span><span class="val" style="color:#4ade80;font-size:16px;font-weight:700">${opts.currency} ${opts.amount.toLocaleString()}</span></div>
      ${opts.reference ? `<div class="row"><span class="lbl">Reference</span><span class="val">${opts.reference}</span></div>` : ''}
    </div>
    <p style="font-size:12px;color:#555">Please allow 1–3 business days for funds to arrive depending on your bank.</p>
  `, `Payment of ${opts.currency} ${opts.amount.toLocaleString()} sent`));
}

/** Password reset email */
export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await send(to, 'Reset your password', layout(`
    <h2>Password reset request</h2>
    <p class="light">Hi ${name}, we received a request to reset your password. Click the button below to set a new one.</p>
    <a href="${resetUrl}" class="btn">Reset Password →</a>
    <div class="divider"></div>
    <p style="font-size:12px;color:#444">This link expires in <strong style="color:#888">1 hour</strong>. If you didn't request a reset, you can safely ignore this email — your account is secure.</p>
  `, 'Reset your password — link expires in 1 hour'));
}

/** Agency invitation email */
export async function sendInviteEmail(to: string, opts: {
  name: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}): Promise<void> {
  await send(to, `You're invited to ${FROM_NAME}`, layout(`
    <h2>You've been invited! 🎊</h2>
    <p class="light"><strong>${opts.inviterName}</strong> has invited you to join ${FROM_NAME} as a <span class="badge badge-blue">${opts.role}</span>.</p>
    <a href="${opts.inviteUrl}" class="btn">Accept Invitation →</a>
    <div class="divider"></div>
    <p style="font-size:12px;color:#444">This invitation expires in 7 days. If you weren't expecting this, you can ignore it.</p>
  `, `${opts.inviterName} invited you to ${FROM_NAME}`));
}
