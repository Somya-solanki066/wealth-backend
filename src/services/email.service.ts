import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getFirestore } from "firebase-admin/firestore";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_IDS,
  EmailTemplateDoc,
  EmailTemplateId,
  getSampleVars,
  mergeEmailTemplate,
} from "../utils/emailTemplatesDefaults";

const COLLECTION = "email_templates";
const LOGS = "email_logs";

let transporter: Transporter | null = null;

function frontendUrl(): string {
  return (process.env.FRONTEND_URL || "https://ink2wealth.co").replace(/\/$/, "");
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.zoho.com",
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export function renderTemplate(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const val = vars[key];
    if (val === undefined || val === null) return "";
    return String(val);
  });
}

export function wrapInBrandLayout(innerHtml: string): string {
  const year = new Date().getFullYear();
  const site = frontendUrl();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ink2Wealth</title>
</head>
<body style="margin:0;padding:0;background:#080808;color:#D4D4D4;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080808;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#161616;border:1px solid #2A2A2A;">
          <tr>
            <td style="padding:28px 28px 12px;border-bottom:1px solid #2A2A2A;">
              <div style="font-size:20px;letter-spacing:0.08em;color:#C9A84C;font-weight:700;font-family:Georgia,serif;">
                INK<span style="color:#F5F5F5;">2</span>WEALTH
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #2A2A2A;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8A8A8A;">
              Need help? <a href="mailto:support@ink2wealth.co" style="color:#C9A84C;text-decoration:none;">support@ink2wealth.co</a><br/>
              <a href="${site}" style="color:#8A8A8A;text-decoration:none;">ink2wealth.co</a> · © ${year} Ink2Wealth
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

export async function ensureEmailTemplatesSeeded(): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();
  let writes = 0;
  for (const id of EMAIL_TEMPLATE_IDS) {
    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      batch.set(ref, { ...DEFAULT_EMAIL_TEMPLATES[id], updatedAt: new Date().toISOString() });
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

  const subject = renderTemplate(template.subject, vars);
  const inner = renderTemplate(template.htmlBody, vars);
  const html = wrapInBrandLayout(inner);
  const text = template.textBody?.trim()
    ? renderTemplate(template.textBody, vars)
    : htmlToRoughText(inner);

  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
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
  return sendTransactional({
    templateId: "welcome",
    to,
    vars: { name: name || "Writer", dashboardUrl: `${frontendUrl()}/dashboard` },
    dedupeKey: `welcome:${to.toLowerCase()}`,
  });
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string): Promise<SendResult> {
  return sendTransactional({
    templateId: "email_verification",
    to,
    vars: { name: name || "Writer", verifyUrl },
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<SendResult> {
  return sendTransactional({
    templateId: "password_reset",
    to,
    vars: { name: name || "Writer", resetUrl },
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
      planName: opts.planName,
      amount: opts.amount,
      expiryDate: opts.expiryDate,
      dashboardUrl: `${frontendUrl()}/dashboard`,
      featuresList: opts.featuresList || "",
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
      projectTitle: opts.projectTitle,
      resultUrl: opts.resultUrl || `${frontendUrl()}/dashboard`,
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
      sessionDate: opts.sessionDate,
      sessionTime: opts.sessionTime,
      coachName: opts.coachName || "Your Coach",
      joinUrl: opts.joinUrl || `${frontendUrl()}/coach`,
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
      planName: opts.planName,
      amount: opts.amount,
      updatePaymentUrl: opts.updatePaymentUrl || `${frontendUrl()}/pricing`,
    },
  });
}

export {
  frontendUrl,
  EMAIL_TEMPLATE_IDS,
  getSampleVars,
};
export type { EmailTemplateId, EmailTemplateDoc };
