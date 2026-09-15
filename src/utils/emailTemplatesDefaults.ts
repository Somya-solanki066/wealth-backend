export type EmailTemplateId =
  | "welcome"
  | "email_verification"
  | "password_reset"
  | "subscription_confirmation"
  | "subscription_renewal_reminder"
  | "payment_failed"
  | "ai_generation_complete"
  | "coaching_session_reminder"
  | "inactivity_come_back";

export type EmailTemplateDoc = {
  id: EmailTemplateId;
  name: string;
  description: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  enabled: boolean;
  placeholders: string[];
};

const p = (label: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#D4D4D4;">${label}</p>`;
const h = (label: string) =>
  `<h2 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#F5F5F5;font-weight:600;">${label}</h2>`;
const cta = (href: string, label: string) =>
  `<p style="margin:28px 0 8px;"><a href="${href}" style="display:inline-block;padding:12px 22px;background:#C9A84C;color:#080808;text-decoration:none;font-weight:700;font-size:14px;border-radius:4px;">${label}</a></p>`;

export const EMAIL_TEMPLATE_IDS: EmailTemplateId[] = [
  "welcome",
  "email_verification",
  "password_reset",
  "subscription_confirmation",
  "subscription_renewal_reminder",
  "payment_failed",
  "ai_generation_complete",
  "coaching_session_reminder",
  "inactivity_come_back",
];

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateId, EmailTemplateDoc> = {
  welcome: {
    id: "welcome",
    name: "Welcome Email",
    description: "Sent when a new user creates an account.",
    subject: "Welcome to Ink2Wealth — Your Writing Journey Starts Now",
    placeholders: ["name", "dashboardUrl"],
    enabled: true,
    htmlBody: [
      h("Welcome to Ink2Wealth, {{name}}"),
      p(
        "You've just joined a community of serious writers who are turning their craft into careers. Whether you're writing your first novel, crafting screenplays, or building your author brand — you're in the right place."
      ),
      p("<strong style=\"color:#F5F5F5;\">Here's what you can do right now:</strong>"),
      `<ul style="margin:0 0 16px;padding-left:20px;color:#D4D4D4;font-size:15px;line-height:1.7;">
        <li>Explore the Writing Vault — prompts, frameworks &amp; craft tools</li>
        <li>Try the AI Analyzer on a chapter or scene</li>
        <li>Browse your world dashboard and set your writing goals</li>
      </ul>`,
      cta("{{dashboardUrl}}", "Go to Your Dashboard"),
      p("Questions? Just reply to this email — we read every one."),
      p("Happy writing,<br/>The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Welcome to Ink2Wealth, {{name}}\n\nYou've just joined a community of serious writers who are turning their craft into careers.\n\nGo to your dashboard: {{dashboardUrl}}\n\nQuestions? Reply to this email.\n\n— The Ink2Wealth Team",
  },
  email_verification: {
    id: "email_verification",
    name: "Email Verification",
    description: "Sent after signup to verify the user's email address.",
    subject: "Verify Your Ink2Wealth Email",
    placeholders: ["name", "verifyUrl"],
    enabled: true,
    htmlBody: [
      h("Confirm your email, {{name}}"),
      p(
        "Thanks for signing up for Ink2Wealth. Please verify your email address so we can keep your account secure and send you important updates."
      ),
      cta("{{verifyUrl}}", "Verify Email Address"),
      p("This link expires in 24 hours. If you didn't create an account, you can ignore this email."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Confirm your email, {{name}}\n\nVerify your email: {{verifyUrl}}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this email.\n\n— The Ink2Wealth Team",
  },
  password_reset: {
    id: "password_reset",
    name: "Password Reset",
    description: "Sent when a user requests a password reset.",
    subject: "Reset Your Ink2Wealth Password",
    placeholders: ["name", "resetUrl"],
    enabled: true,
    htmlBody: [
      h("Reset your password"),
      p("Hi {{name}},"),
      p(
        "We received a request to reset the password for your Ink2Wealth account. Click the button below to choose a new password."
      ),
      cta("{{resetUrl}}", "Reset Password"),
      p("This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{name}},\n\nReset your password: {{resetUrl}}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n— The Ink2Wealth Team",
  },
  subscription_confirmation: {
    id: "subscription_confirmation",
    name: "Subscription Confirmation",
    description: "Sent after a successful plan purchase / checkout.",
    subject: "You're In — {{planName}} is Active",
    placeholders: ["name", "planName", "amount", "expiryDate", "dashboardUrl", "featuresList"],
    enabled: true,
    htmlBody: [
      h("Payment confirmed — welcome aboard"),
      p("Hi {{name}},"),
      p(
        "Your <strong style=\"color:#C9A84C;\">{{planName}}</strong> plan is now active. You're unlocked for the tools that help serious writers ship."
      ),
      p("<strong style=\"color:#F5F5F5;\">Plan details</strong>"),
      `<ul style="margin:0 0 16px;padding-left:20px;color:#D4D4D4;font-size:15px;line-height:1.7;">
        <li>Plan: {{planName}}</li>
        <li>Amount: {{amount}}</li>
        <li>Access until: {{expiryDate}}</li>
      </ul>`,
      p("{{featuresList}}"),
      cta("{{dashboardUrl}}", "Open Dashboard"),
      p("Receipt questions? Email support@ink2wealth.co"),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{name}},\n\nYour {{planName}} plan is active.\nAmount: {{amount}}\nAccess until: {{expiryDate}}\n\n{{featuresList}}\n\nDashboard: {{dashboardUrl}}\n\n— The Ink2Wealth Team",
  },
  subscription_renewal_reminder: {
    id: "subscription_renewal_reminder",
    name: "Subscription Renewal Reminder",
    description: "Sent ~3 days before plan expiry.",
    subject: "Your {{planName}} renews soon",
    placeholders: ["name", "planName", "expiryDate", "renewUrl"],
    enabled: true,
    htmlBody: [
      h("Your plan renews soon"),
      p("Hi {{name}},"),
      p(
        "Just a heads-up — your <strong style=\"color:#C9A84C;\">{{planName}}</strong> access ends on <strong style=\"color:#F5F5F5;\">{{expiryDate}}</strong>."
      ),
      p("Renew now so you don't lose Ghost Writer, Wealth Engine, and your premium workspace."),
      cta("{{renewUrl}}", "Renew Your Plan"),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{name}},\n\nYour {{planName}} access ends on {{expiryDate}.\n\nRenew: {{renewUrl}}\n\n— The Ink2Wealth Team",
  },
  payment_failed: {
    id: "payment_failed",
    name: "Payment Failed",
    description: "Sent when a subscription payment fails (ready for Stripe subscriptions).",
    subject: "Action needed — payment didn't go through",
    placeholders: ["name", "planName", "updatePaymentUrl", "amount"],
    enabled: true,
    htmlBody: [
      h("We couldn't process your payment"),
      p("Hi {{name}},"),
      p(
        "Your payment for <strong style=\"color:#C9A84C;\">{{planName}}</strong> ({{amount}}) didn't go through. Update your payment method to keep uninterrupted access."
      ),
      cta("{{updatePaymentUrl}}", "Update Payment Method"),
      p("Need help? Reply to this email or write support@ink2wealth.co"),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{name}},\n\nPayment for {{planName}} ({{amount}}) failed.\nUpdate payment: {{updatePaymentUrl}}\n\n— The Ink2Wealth Team",
  },
  ai_generation_complete: {
    id: "ai_generation_complete",
    name: "AI Generation Complete",
    description: "Sent when Ghost Writer finishes a long generation.",
    subject: "Your Ghost Writer draft is ready",
    placeholders: ["name", "projectTitle", "resultUrl", "wordCount"],
    enabled: true,
    htmlBody: [
      h("Your draft is ready"),
      p("Hi {{name}},"),
      p(
        "Ghost Writer finished generating <strong style=\"color:#C9A84C;\">{{projectTitle}}</strong>{{wordCount}}."
      ),
      p("Open it in your workspace to review, edit, and keep going."),
      cta("{{resultUrl}}", "Open Your Draft"),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{name}},\n\nGhost Writer finished {{projectTitle}}{{wordCount}}.\n\nOpen: {{resultUrl}}\n\n— The Ink2Wealth Team",
  },
  coaching_session_reminder: {
    id: "coaching_session_reminder",
    name: "Coaching Session Reminder",
    description: "Ready for Coaching Hub bookings (send API available).",
    subject: "Reminder: coaching session {{sessionDate}}",
    placeholders: ["name", "sessionDate", "sessionTime", "coachName", "joinUrl", "notes"],
    enabled: true,
    htmlBody: [
      h("Your coaching session is coming up"),
      p("Hi {{name}},"),
      p(
        "This is a reminder that your session with <strong style=\"color:#C9A84C;\">{{coachName}}</strong> is scheduled for <strong style=\"color:#F5F5F5;\">{{sessionDate}}</strong> at {{sessionTime}}."
      ),
      p("{{notes}}"),
      cta("{{joinUrl}}", "View Session Details"),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{name}},\n\nSession with {{coachName}} on {{sessionDate}} at {{sessionTime}}.\n{{notes}}\n\nDetails: {{joinUrl}}\n\n— The Ink2Wealth Team",
  },
  inactivity_come_back: {
    id: "inactivity_come_back",
    name: "Inactivity / Come Back",
    description: "Sent when a user hasn't written in 14+ days.",
    subject: "Your story is waiting, {{name}}",
    placeholders: ["name", "dashboardUrl", "daysInactive"],
    enabled: true,
    htmlBody: [
      h("It's been a minute"),
      p("Hi {{name}},"),
      p(
        "We noticed you haven't written in about {{daysInactive}} days. No pressure — the best next chapter often starts with one small session."
      ),
      p("Jump back in. Your projects, vault, and tools are exactly where you left them."),
      cta("{{dashboardUrl}}", "Continue Writing"),
      p("We'll be here when you're ready."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{name}},\n\nIt's been about {{daysInactive}} days since you last wrote. Your story is waiting.\n\nContinue: {{dashboardUrl}}\n\n— The Ink2Wealth Team",
  },
};

/** Fix typo in renewal textBody default — keep export clean */
DEFAULT_EMAIL_TEMPLATES.subscription_renewal_reminder.textBody =
  "Hi {{name}},\n\nYour {{planName}} access ends on {{expiryDate}}.\n\nRenew: {{renewUrl}}\n\n— The Ink2Wealth Team";

export function mergeEmailTemplate(
  id: EmailTemplateId,
  stored: Partial<EmailTemplateDoc> | null | undefined
): EmailTemplateDoc {
  const base = DEFAULT_EMAIL_TEMPLATES[id];
  if (!stored) return { ...base };
  return {
    ...base,
    ...stored,
    id,
    name: typeof stored.name === "string" && stored.name.trim() ? stored.name : base.name,
    description:
      typeof stored.description === "string" && stored.description.trim()
        ? stored.description
        : base.description,
    subject:
      typeof stored.subject === "string" && stored.subject.trim() ? stored.subject : base.subject,
    htmlBody:
      typeof stored.htmlBody === "string" && stored.htmlBody.trim()
        ? stored.htmlBody
        : base.htmlBody,
    textBody:
      typeof stored.textBody === "string" ? stored.textBody : base.textBody,
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : base.enabled,
    placeholders: Array.isArray(stored.placeholders) && stored.placeholders.length
      ? stored.placeholders
      : base.placeholders,
  };
}

export function getSampleVars(id: EmailTemplateId, frontendUrl: string): Record<string, string> {
  const dash = `${frontendUrl.replace(/\/$/, "")}/dashboard`;
  const samples: Record<EmailTemplateId, Record<string, string>> = {
    welcome: { name: "Alex", dashboardUrl: dash },
    email_verification: { name: "Alex", verifyUrl: `${frontendUrl}/verify-email?sample=1` },
    password_reset: { name: "Alex", resetUrl: `${frontendUrl}/reset-password?sample=1` },
    subscription_confirmation: {
      name: "Alex",
      planName: "6-MONTH",
      amount: "₦24,900",
      expiryDate: "15 Mar 2027",
      dashboardUrl: dash,
      featuresList: "Includes Ghost Writer, Unlimited Analyzer, and Wealth Engine.",
    },
    subscription_renewal_reminder: {
      name: "Alex",
      planName: "6-MONTH",
      expiryDate: "18 Mar 2026",
      renewUrl: `${frontendUrl}/pricing`,
    },
    payment_failed: {
      name: "Alex",
      planName: "YEARLY",
      amount: "₦49,900",
      updatePaymentUrl: `${frontendUrl}/pricing`,
    },
    ai_generation_complete: {
      name: "Alex",
      projectTitle: "Chapter 4 — The Crossing",
      resultUrl: dash,
      wordCount: " (about 2,400 words)",
    },
    coaching_session_reminder: {
      name: "Alex",
      sessionDate: "Friday, 20 Mar 2026",
      sessionTime: "4:00 PM WAT",
      coachName: "Your Coach",
      joinUrl: `${frontendUrl}/coach`,
      notes: "Bring your latest chapter and 2 questions.",
    },
    inactivity_come_back: {
      name: "Alex",
      dashboardUrl: dash,
      daysInactive: "14",
    },
  };
  return samples[id];
}
