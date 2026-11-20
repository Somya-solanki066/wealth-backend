import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getFirestore } from "firebase-admin/firestore";
import {
  DEFAULT_EMAIL_BRAND,
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_COPY_VERSION,
  EMAIL_TEMPLATE_IDS,
  EmailTemplateDoc,
  EmailTemplateId,
  getSampleVars,
  mergeEmailTemplate,
} from "../utils/emailTemplatesDefaults";

const COLLECTION = "email_templates";
const LOGS = "email_logs";
const BRAND_DOC = "email_brand";

let transporter: Transporter | null = null;

function frontendUrl(): string {
  return (process.env.FRONTEND_URL || "https://ink2wealth.co").replace(/\/$/, "");
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export function firstNameFrom(name?: string | null, email?: string | null): string {
  const fromName = String(name || "").trim().split(/\s+/)[0];
  if (fromName && fromName.toLowerCase() !== "user" && fromName.toLowerCase() !== "writer") {
    return fromName;
  }
  const local = String(email || "").split("@")[0];
  if (local) return local;
  return "there";
}

export function renderTemplate(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const val = vars[key];
    if (val === undefined || val === null) return "";
    return String(val);
  });
}

export function wrapInBrandLayout(
  innerHtml: string,
  opts?: { preheader?: string; logoUrl?: string; brand?: Record<string, string> }
): string {
  const year = new Date().getFullYear();
  const brand = { ...DEFAULT_EMAIL_BRAND, ...(opts?.brand || {}) };
  const logo = opts?.logoUrl || brand.logoUrl;
  const preheader = opts?.preheader || "";
  const social = [
    ["TikTok", brand.tiktok],
    ["Instagram", brand.instagram],
    ["YouTube", brand.youtube],
    ["LinkedIn", brand.linkedin],
    ["Facebook", brand.facebook],
  ]
    .filter(([, href]) => href)
    .map(
      ([label, href]) =>
        `<a href="${href}" style="color:#0B1D36;text-decoration:none;margin-right:10px;">${label}</a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ink2Wealth</title>
</head>
<body style="margin:0;padding:0;background:#F4F5F7;color:#15171C;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F5F7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E7E9EE;">
          <tr>
            <td style="padding:24px 20px 16px;border-bottom:3px solid #C9A84C;text-align:center;">
              <img src="${logo}" alt="Ink2Wealth" width="160" style="display:inline-block;max-width:160px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:24px 20px;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px;border-top:1px solid #E7E9EE;font-size:12px;line-height:1.7;color:#5B616D;text-align:center;">
              ${social}<br/>
              Need help? <a href="mailto:${brand.supportEmail}" style="color:#0B1D36;">${brand.supportEmail}</a><br/>
              Ink to Wealth Media Limited | Registered in Nigeria<br/>
              <a href="${brand.unsubscribe_link}" style="color:#5B616D;">Unsubscribe / preferences</a>
              · © ${year} Ink2Wealth
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function htmlToRoughText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function loadTemplate(id: EmailTemplateId): Promise<EmailTemplateDoc> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return mergeEmailTemplate(id, snap.exists ? (snap.data() as Partial<EmailTemplateDoc>) : null);
}

export async function listTemplates(): Promise<EmailTemplateDoc[]> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).get();
  const byId = new Map<string, Partial<EmailTemplateDoc>>();
  snap.docs.forEach((d) => byId.set(d.id, d.data() as Partial<EmailTemplateDoc>));
  return EMAIL_TEMPLATE_IDS.map((id) => mergeEmailTemplate(id, byId.get(id)));
}

export async function loadEmailBrand(): Promise<Record<string, string>> {
  const db = getFirestore();
  const snap = await db.collection("settings").doc(BRAND_DOC).get();
  const stored = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const out: Record<string, string> = { ...DEFAULT_EMAIL_BRAND };
  for (const [key, value] of Object.entries(stored || {})) {
    if (typeof value === "string") out[key] = value;
  }
  if (!out.app_link) out.app_link = frontendUrl();
  if (!out.unsubscribe_link) out.unsubscribe_link = `${frontendUrl()}/dashboard`;
  return out;
}

export async function saveEmailBrand(patch: Record<string, string>): Promise<Record<string, string>> {
  const db = getFirestore();
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (typeof value === "string") clean[key] = value.trim();
  }
  await db.collection("settings").doc(BRAND_DOC).set(clean, { merge: true });
  return loadEmailBrand();
}

export async function ensureEmailTemplatesSeeded(): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();
  let writes = 0;
  for (const id of EMAIL_TEMPLATE_IDS) {
    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    const storedVersion = Number(snap.exists ? (snap.data() as any)?.copyVersion || 0 : 0);
    if (!snap.exists || storedVersion < EMAIL_COPY_VERSION) {
      const enabled = snap.exists ? Boolean((snap.data() as any)?.enabled !== false) : true;
      batch.set(ref, {
        ...DEFAULT_EMAIL_TEMPLATES[id],
        enabled,
        copyVersion: EMAIL_COPY_VERSION,
        updatedAt: new Date().toISOString(),
      });
      writes += 1;
    }
  }
  if (writes > 0) await batch.commit();
}

export async function saveTemplate(
  id: EmailTemplateId,
  patch: Partial<Pick<EmailTemplateDoc, "subject" | "htmlBody" | "textBody" | "enabled" | "name" | "description">>
): Promise<EmailTemplateDoc> {
  const db = getFirestore();
  const current = await loadTemplate(id);
  const next: EmailTemplateDoc = {
    ...current,
    ...patch,
    id,
    copyVersion: EMAIL_COPY_VERSION,
  };
  await db.collection(COLLECTION).doc(id).set(
    {
      ...next,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return loadTemplate(id);
}

export type SendTransactionalInput = {
  templateId: EmailTemplateId;
  to: string;
  vars?: Record<string, string | number | undefined | null>;
  dedupeKey?: string;
};

export type SendResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
};

async function wasAlreadySent(dedupeKey: string): Promise<boolean> {
  const db = getFirestore();
  const snap = await db.collection(LOGS).doc(dedupeKey).get();
  return snap.exists;
}

async function markSent(dedupeKey: string, meta: Record<string, unknown>): Promise<void> {
  const db = getFirestore();
  await db.collection(LOGS).doc(dedupeKey).set({
    ...meta,
    sentAt: new Date().toISOString(),
  });
}

export async function sendTransactional(input: SendTransactionalInput): Promise<SendResult> {
  const { templateId, to, vars = {}, dedupeKey } = input;
  if (!to || !to.includes("@")) {
    return { ok: false, reason: "invalid_recipient" };
  }

  if (dedupeKey && (await wasAlreadySent(dedupeKey))) {
    return { ok: true, skipped: true, reason: "deduped" };
  }

  const template = await loadTemplate(templateId);
  if (!template.enabled) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  if (!smtpConfigured()) {
    console.warn(`[email] SMTP not configured — skip ${templateId} → ${to}`);
    return { ok: false, reason: "smtp_not_configured" };
  }

  const brand = await loadEmailBrand();
  const mergedVars: Record<string, string | number | undefined | null> = {
    ...brand,
    ...vars,
  };
  if (!mergedVars.first_name) {
    mergedVars.first_name = firstNameFrom(String(mergedVars.name || ""), to);
  }
  if (!mergedVars.name) mergedVars.name = mergedVars.first_name;
  if (!mergedVars.verification_link && mergedVars.verifyUrl) {
    mergedVars.verification_link = mergedVars.verifyUrl;
  }
  if (!mergedVars.verifyUrl && mergedVars.verification_link) {
    mergedVars.verifyUrl = mergedVars.verification_link;
  }
  if (!mergedVars.reset_link && mergedVars.resetUrl) mergedVars.reset_link = mergedVars.resetUrl;
  if (!mergedVars.resetUrl && mergedVars.reset_link) mergedVars.resetUrl = mergedVars.reset_link;
  if (!mergedVars.tier_name && mergedVars.planName) mergedVars.tier_name = mergedVars.planName;
  if (!mergedVars.planName && mergedVars.tier_name) mergedVars.planName = mergedVars.tier_name;
  if (!mergedVars.tier_features_list && mergedVars.featuresList) {
    mergedVars.tier_features_list = mergedVars.featuresList;
  }
  if (!mergedVars.next_billing_date && mergedVars.expiryDate) {
    mergedVars.next_billing_date = mergedVars.expiryDate;
  }
  if (!mergedVars.renewal_date && mergedVars.expiryDate) mergedVars.renewal_date = mergedVars.expiryDate;
  if (!mergedVars.billing_link && mergedVars.updatePaymentUrl) {
    mergedVars.billing_link = mergedVars.updatePaymentUrl;
  }
  if (!mergedVars.project_title && mergedVars.projectTitle) {
    mergedVars.project_title = mergedVars.projectTitle;
  }
  if (!mergedVars.project_link && mergedVars.resultUrl) mergedVars.project_link = mergedVars.resultUrl;
  if (!mergedVars.app_link && mergedVars.dashboardUrl) mergedVars.app_link = mergedVars.dashboardUrl;
  if (!mergedVars.session_link && mergedVars.joinUrl) mergedVars.session_link = mergedVars.joinUrl;
  if (!mergedVars.session_title && mergedVars.sessionDate) {
    mergedVars.session_title = String(mergedVars.sessionDate);
  }
  if (!mergedVars.session_datetime && (mergedVars.sessionDate || mergedVars.sessionTime)) {
    mergedVars.session_datetime = [mergedVars.sessionDate, mergedVars.sessionTime]
      .filter(Boolean)
      .join(" · ");
  }

  const subject = renderTemplate(template.subject, mergedVars);
  let inner = renderTemplate(template.htmlBody, mergedVars);
  inner = inner.replace(/<img[^>]*src=["']\s*["'][^>]*>/gi, "");
  const html = wrapInBrandLayout(inner, {
    preheader: template.preheader ? renderTemplate(template.preheader, mergedVars) : "",
    brand,
  });
  const text = template.textBody?.trim()
    ? renderTemplate(template.textBody, mergedVars)
    : htmlToRoughText(inner);

  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || "Ink2Wealth <victor@ink2wealth.co>",
      replyTo: process.env.SMTP_REPLY_TO || "support@ink2wealth.co",
      to,
      subject,
      html,
      text,
    });
    if (dedupeKey) {
      await markSent(dedupeKey, { templateId, to, subject, messageId: info.messageId });
    }
    return { ok: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[email] send failed ${templateId} → ${to}:`, err?.message || err);
    return { ok: false, reason: err?.message || "send_failed" };
  }
}

export async function sendTestEmail(templateId: EmailTemplateId, to: string): Promise<SendResult> {
  return sendTransactional({
    templateId,
    to,
    vars: getSampleVars(templateId, frontendUrl()),
  });
}

/** Helpers for product triggers */
export async function sendWelcomeEmail(to: string, name: string): Promise<SendResult> {
  const first = firstNameFrom(name, to);
  return sendTransactional({
    templateId: "welcome",
    to,
    vars: {
      name: name || first,
      first_name: first,
      dashboardUrl: `${frontendUrl()}/dashboard`,
      app_link: frontendUrl(),
    },
    dedupeKey: `welcome:${to.toLowerCase()}`,
  });
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string): Promise<SendResult> {
  const first = firstNameFrom(name, to);
  return sendTransactional({
    templateId: "email_verification",
    to,
    vars: { name: name || first, first_name: first, verifyUrl, verification_link: verifyUrl },
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<SendResult> {
  const first = firstNameFrom(name, to);
  return sendTransactional({
    templateId: "password_reset",
    to,
    vars: { name: name || first, first_name: first, resetUrl, reset_link: resetUrl },
  });
}

export async function sendSubscriptionConfirmationEmail(opts: {
  to: string;
  name: string;
  planName: string;
  amount: string;
  expiryDate: string;
  featuresList?: string;
}): Promise<SendResult> {
  return sendTransactional({
    templateId: "subscription_confirmation",
    to: opts.to,
    vars: {
      name: opts.name || "Writer",
      first_name: firstNameFrom(opts.name, opts.to),
      planName: opts.planName,
      tier_name: opts.planName,
      amount: opts.amount,
      expiryDate: opts.expiryDate,
      next_billing_date: opts.expiryDate,
      dashboardUrl: `${frontendUrl()}/dashboard`,
      featuresList: opts.featuresList || "",
      tier_features_list: opts.featuresList || "",
    },
  });
}

export async function sendAiGenerationCompleteEmail(opts: {
  to: string;
  name: string;
  projectTitle: string;
  resultUrl?: string;
  wordCount?: number | string;
}): Promise<SendResult> {
  const wc =
    opts.wordCount === undefined || opts.wordCount === ""
      ? ""
      : ` (about ${opts.wordCount} words)`;
  return sendTransactional({
    templateId: "ai_generation_complete",
    to: opts.to,
    vars: {
      name: opts.name || "Writer",
      first_name: firstNameFrom(opts.name, opts.to),
      projectTitle: opts.projectTitle,
      project_title: opts.projectTitle,
      resultUrl: opts.resultUrl || `${frontendUrl()}/dashboard`,
      project_link: opts.resultUrl || `${frontendUrl()}/dashboard`,
      wordCount: wc,
    },
  });
}

export async function sendCoachingSessionReminder(opts: {
  to: string;
  name: string;
  sessionDate: string;
  sessionTime: string;
  coachName?: string;
  joinUrl?: string;
  notes?: string;
  dedupeKey?: string;
}): Promise<SendResult> {
  return sendTransactional({
    templateId: "coaching_session_reminder",
    to: opts.to,
    vars: {
      name: opts.name || "Writer",
      first_name: firstNameFrom(opts.name, opts.to),
      sessionDate: opts.sessionDate,
      sessionTime: opts.sessionTime,
      session_title: opts.coachName ? `${opts.coachName}` : opts.sessionDate,
      session_datetime: [opts.sessionDate, opts.sessionTime].filter(Boolean).join(" · "),
      coachName: opts.coachName || "Your Coach",
      joinUrl: opts.joinUrl || `${frontendUrl()}/coach`,
      session_link: opts.joinUrl || `${frontendUrl()}/coach`,
      notes: opts.notes || "",
    },
    dedupeKey: opts.dedupeKey,
  });
}

export async function sendPaymentFailedEmail(opts: {
  to: string;
  name: string;
  planName: string;
  amount: string;
  updatePaymentUrl?: string;
}): Promise<SendResult> {
  return sendTransactional({
    templateId: "payment_failed",
    to: opts.to,
    vars: {
      name: opts.name || "Writer",
      first_name: firstNameFrom(opts.name, opts.to),
      planName: opts.planName,
      tier_name: opts.planName,
      amount: opts.amount,
      updatePaymentUrl: opts.updatePaymentUrl || `${frontendUrl()}/pricing`,
      billing_link: opts.updatePaymentUrl || `${frontendUrl()}/pricing`,
    },
  });
}

export {
  frontendUrl,
  EMAIL_TEMPLATE_IDS,
  getSampleVars,
};
export type { EmailTemplateId, EmailTemplateDoc };
