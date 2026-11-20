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
  preheader?: string;
  htmlBody: string;
  textBody: string;
  enabled: boolean;
  placeholders: string[];
  copyVersion?: number;
};

/** Bump this to push new default copy into Firestore on next seed. */
export const EMAIL_COPY_VERSION = 20261116;

const NAVY = "#0B1D36";
const GOLD = "#C9A84C";
const MUTED = "#5B616D";
const INK = "#15171C";

const p = (label: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${INK};font-family:Arial,Helvetica,sans-serif;">${label}</p>`;
const h = (label: string) =>
  `<h2 style="margin:24px 0 12px;font-size:18px;line-height:1.35;color:${NAVY};font-weight:700;font-family:Arial,Helvetica,sans-serif;">${label}</h2>`;
const cta = (href: string, label: string) =>
  `<p style="margin:22px 0 8px;"><a href="${href}" style="display:inline-block;padding:12px 22px;background:${GOLD};color:${NAVY};text-decoration:none;font-weight:700;font-size:14px;border-radius:6px;font-family:Arial,Helvetica,sans-serif;">${label}</a></p>`;
const shot = (slot: string, alt: string) =>
  `<img src="{{${slot}}}" alt="${alt}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:8px;margin:12px 0 20px;" />`;
const bullets = (items: string[]) =>
  `<ul style="margin:0 0 16px;padding-left:20px;color:${INK};font-size:15px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">${items
    .map((item) => `<li style="margin:0 0 8px;">${item}</li>`)
    .join("")}</ul>`;

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

export const DEFAULT_EMAIL_BRAND = {
  logoUrl: "https://ink2wealth.co/brand/logo.webp",
  app_link: "https://ink2wealth.co",
  app_guide_link: "https://ink2wealth.co/app-guide",
  supportEmail: "support@ink2wealth.co",
  tiktok: "https://www.tiktok.com/@ink2wealth",
  instagram: "https://www.instagram.com/ink2wealth",
  youtube: "https://www.youtube.com/@CoachVictorDaniels",
  linkedin: "https://www.linkedin.com/company/ink2wealth",
  facebook: "https://www.facebook.com/ink2wealth",
  unsubscribe_link: "https://ink2wealth.co/dashboard",
  img_01: "",
  img_02: "",
  img_03: "",
  img_04: "",
  img_05: "",
  img_06: "",
  img_07: "",
  img_08: "",
  img_09: "",
  img_10: "",
};

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateId, EmailTemplateDoc> = {
  welcome: {
    id: "welcome",
    name: "Welcome Email — Complete App Tour",
    description:
      "Sent once after email is verified (or immediately for Google/Apple). Long guided tour with screenshot slots IMG-01 to IMG-10.",
    subject: "Welcome to Ink2Wealth, {{first_name}} — your complete guide inside",
    preheader: "One app, three worlds. Here is everything waiting for you, section by section.",
    placeholders: [
      "first_name",
      "name",
      "app_link",
      "app_guide_link",
      "img_01",
      "img_02",
      "img_03",
      "img_04",
      "img_05",
      "img_06",
      "img_07",
      "img_08",
      "img_09",
      "img_10",
    ],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p("Welcome to Ink2Wealth! You're officially in."),
      p(
        "Ink2Wealth is built on one idea: <strong>Write It. Script It. Study It. Earn From It.</strong> Whether you write web novels, script films, or study for your next big exam, there is a world in this app designed exclusively for you."
      ),
      p("This email is your complete tour. Save it. Come back to it any time you want to know where something lives."),
      h("Part 1: How the app works"),
      p(
        "You have one login for everything. Inside the app there are three worlds: Writer's World, Screenwriter's World and Student's World. Swipe left or right on the home screen to move between them. Each world has its own home screen, its own tools and its own feel, so it never looks like three apps squeezed into one. You can switch worlds as often as you like, and your account, plan and projects follow you."
      ),
      p("You can also switch the app between white mode and dark mode from your profile settings, whichever is easier on your eyes."),
      shot("img_01", "Three-worlds slider on the home screen"),
      h("Part 2: Your home screen"),
      bullets([
        "<strong>Course banner (top).</strong> Swipe through our featured courses: the WIT-WEB Guide (Webnoveling Ink to Wealth Blueprint), the SSG Course (Scriptwriting Screenwriting Guide) and 10x Your Writing. Tap any banner to see what's inside and enrol.",
        "<strong>World tiles.</strong> Every tool in your current world sits on the home screen as a tile. Tap a tile and it opens as its own full screen.",
        "<strong>Testimonials.</strong> Scroll down to watch real video testimonials from writers and students. They play automatically as you scroll to them.",
        "<strong>About section (bottom).</strong> Meet the founder, see our social pages, browse My Bookshelf, and view Ink to Wealth Media Limited's registration details.",
      ]),
      shot("img_02", "Home screen showing course banner, tiles and testimonials"),
      h("Part 3: Writer's World"),
      p("For web novelists, serial writers, ghostwriters, freelancers and nonfiction authors."),
      bullets([
        "<strong>Wealth Engine.</strong> Track your earnings and royalties across the platforms you publish on, including PocketFM, Dreame, GoodNovel, WebNovel and Amazon KDP, so you can see what your writing is actually paying you in one place.",
        "<strong>Other lanes to write in.</strong> Content &amp; Freelance, Short-Form Fiction, Nonfiction &amp; Ghostwriting, and Web3 Writing.",
        "<strong>Writing Vault.</strong> Your creative gym: writing prompts, contests, writing challenges, live writing sprints, story world-building games and more.",
        "<strong>AI Ghostwriter and Chapter Analyzer.</strong> Draft with AI assistance, then run your chapter through the analyzer before you submit it to a platform.",
        "<strong>Smart Edit Suite.</strong> Upload your draft and polish it with smart, line-by-line editing support. (Available in all three worlds.)",
      ]),
      shot("img_03", "Writer's World home screen"),
      shot("img_04", "Wealth Engine or Other Lanes screen"),
      h("Part 4: Screenwriter's World"),
      p("For screenwriters, filmmakers and anyone who wants their script in front of producers. Think of it as a bridge between writers and the film industry."),
      bullets([
        "<strong>Industry Hub &amp; Open Calls.</strong> See open calls, contests, loglines and writer jobs posted by producers, and respond from inside the app.",
        "<strong>Short Film Showcase.</strong> Upload your short film and get it seen by Nollywood and Hollywood filmmakers browsing for talent.",
        "<strong>Script Marketplace.</strong> List your script at a price you set, and browse scripts from other writers.",
        "<strong>Screenwriter Community.</strong> Join script rooms, connect with other writers, and take part in in-app industry calls.",
        "<strong>Script formatting and AI Script Analyzer.</strong> Format to industry standards, then get scene-by-scene feedback measured against Hollywood, Nollywood and audio standards.",
        "<strong>Portfolio.</strong> Build a public portfolio so producers can find you.",
      ]),
      shot("img_05", "Screenwriter's World home screen"),
      shot("img_06", "Script Marketplace or Short Film Showcase"),
      h("Part 5: Student's World"),
      p("For secondary school leavers, university students and professional-course students."),
      bullets([
        "<strong>JAMB UTME Practice.</strong> Practise with real-style questions and track your score as you improve.",
        "<strong>University Past Questions.</strong> Past questions by school, level and course, with slides, PDFs and video links organised topic by topic.",
        "<strong>Nursing Hub and MBBS Hub.</strong> Resources arranged by level, then subject, then topic, built for Nigerian nursing and medical programmes.",
        "<strong>All Professional Courses.</strong> Law, Pharmacy, Dentistry, Physiotherapy, Medical Laboratory Science, Radiography and more.",
        "<strong>Smart Performance Analytics.</strong> See which topics you are strong in and which need more work.",
      ]),
      shot("img_07", "Student's World home screen"),
      shot("img_08", "A Student's World tool such as University Past Questions or JAMB Practice"),
      h("Part 6: Your profile, plan and settings"),
      bullets([
        "Manage your subscription, billing and plan from your profile. You can add extras for any world at any time.",
        "Switch between white and dark mode.",
        "Find our Privacy Policy and Terms in your profile.",
        "Reach support any time from the Help option.",
      ]),
      shot("img_09", "Profile and settings screen"),
      shot("img_10", "Smart Edit Suite screen"),
      h("Part 7: Your first three steps"),
      `<ol style="margin:0 0 16px;padding-left:20px;color:${INK};font-size:15px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
        <li style="margin:0 0 8px;">Open the app and pick the world that fits you best right now. You can switch any time.</li>
        <li style="margin:0 0 8px;">Open one tool and try it. Even a rough draft or a single practice question counts.</li>
        <li style="margin:0 0 8px;">Check the course banner for a course that can take you further.</li>
      </ol>`,
      cta("{{app_link}}", "Open Ink2Wealth"),
      cta("{{app_guide_link}}", "Download the Full App Guide (PDF)"),
      p(
        `Stuck anywhere? Just reply to this email or reach us at <a href="mailto:support@ink2wealth.co" style="color:${NAVY};">support@ink2wealth.co</a>. A real person will help you.`
      ),
      p("Let's get to work."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{first_name}},\n\nWelcome to Ink2Wealth! You're officially in.\n\nWrite It. Script It. Study It. Earn From It.\n\nOpen the app: {{app_link}}\nApp guide: {{app_guide_link}}\n\nStuck? support@ink2wealth.co\n\n— The Ink2Wealth Team",
  },
  email_verification: {
    id: "email_verification",
    name: "Email Verification",
    description: "Sent right after email/password signup. Not sent to Google or Apple sign-ins.",
    subject: "Confirm your email to activate your Ink2Wealth account",
    preheader: "One tap to activate your account. Then the full app tour lands in your inbox.",
    placeholders: ["first_name", "name", "verification_link", "verifyUrl"],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p("Thanks for signing up for Ink2Wealth. Please confirm your email address to activate your account:"),
      cta("{{verification_link}}", "Verify My Email"),
      p("Once confirmed, you will get a full guided tour of the app. This link expires in 24 hours. If you didn't create this account, you can safely ignore this email."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{first_name}},\n\nConfirm your email: {{verification_link}}\n\nThis link expires in 24 hours. If you didn't create this account, ignore this email.\n\n— The Ink2Wealth Team",
  },
  password_reset: {
    id: "password_reset",
    name: "Password Reset",
    description: "Sent when a user requests a password reset.",
    subject: "Reset your Ink2Wealth password",
    placeholders: ["first_name", "name", "reset_link", "resetUrl"],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p("We received a request to reset your Ink2Wealth password. Click below to choose a new one:"),
      cta("{{reset_link}}", "Reset My Password"),
      p("This link expires in 1 hour. If you didn't request this, you can ignore this email. Your password will stay the same."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{first_name}},\n\nReset your password: {{reset_link}}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n— The Ink2Wealth Team",
  },
  subscription_confirmation: {
    id: "subscription_confirmation",
    name: "Subscription Confirmation",
    description: "Sent when a user successfully subscribes to a paid plan or adds a world add-on.",
    subject: "You're subscribed — welcome to Ink2Wealth {{tier_name}}",
    placeholders: [
      "first_name",
      "name",
      "tier_name",
      "planName",
      "tier_features_list",
      "featuresList",
      "next_billing_date",
      "expiryDate",
      "amount",
    ],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p("You're now on the <strong>{{tier_name}}</strong> plan. Thank you for investing in your craft."),
      p("Here's what's unlocked for you:"),
      p("{{tier_features_list}}"),
      p("Your next billing date is {{next_billing_date}}. You can manage your subscription anytime from your profile."),
      p("Let's make it count."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{first_name}},\n\nYou're now on the {{tier_name}} plan.\n\n{{tier_features_list}}\n\nNext billing date: {{next_billing_date}}\n\n— The Ink2Wealth Team",
  },
  subscription_renewal_reminder: {
    id: "subscription_renewal_reminder",
    name: "Subscription Renewal Reminder",
    description: "Sent 3 days before a subscription auto-renews.",
    subject: "Your Ink2Wealth subscription renews in 3 days",
    placeholders: [
      "first_name",
      "name",
      "tier_name",
      "planName",
      "renewal_date",
      "expiryDate",
      "amount",
    ],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p(
        "Just a heads-up: your <strong>{{tier_name}}</strong> subscription will renew on {{renewal_date}} for {{amount}}."
      ),
      p("No action needed if you'd like to continue. If you'd like to make changes, you can update your plan anytime from your profile."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{first_name}},\n\nYour {{tier_name}} subscription will renew on {{renewal_date}} for {{amount}}.\n\nNo action needed to continue. Manage your plan from your profile.\n\n— The Ink2Wealth Team",
  },
  payment_failed: {
    id: "payment_failed",
    name: "Payment Failed",
    description: "Sent when a subscription renewal payment fails.",
    subject: "Action needed: we couldn't process your Ink2Wealth payment",
    placeholders: ["first_name", "name", "tier_name", "planName", "billing_link", "updatePaymentUrl", "amount"],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p("We tried to renew your <strong>{{tier_name}}</strong> subscription, but the payment didn't go through."),
      p("Please update your payment method to keep your account active without interruption:"),
      cta("{{billing_link}}", "Update Payment Method"),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{first_name}},\n\nWe couldn't process your {{tier_name}} payment.\nUpdate payment method: {{billing_link}}\n\n— The Ink2Wealth Team",
  },
  ai_generation_complete: {
    id: "ai_generation_complete",
    name: "AI Generation Complete",
    description:
      "Sent when a longer AI Ghostwriter task, or a long Chapter Analyzer / Script Analyzer run, finishes.",
    subject: "Your draft is ready",
    placeholders: ["first_name", "name", "project_title", "projectTitle", "project_link", "resultUrl"],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p('Your AI-assisted work for "{{project_title}}" is ready to review.'),
      cta("{{project_link}}", "Open My Draft"),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      'Hi {{first_name}},\n\nYour AI-assisted work for "{{project_title}}" is ready.\n\nOpen: {{project_link}}\n\n— The Ink2Wealth Team',
  },
  coaching_session_reminder: {
    id: "coaching_session_reminder",
    name: "Session Reminder",
    description:
      "Sent ahead of a booked coaching session, writing sprint, script room or in-app industry call. Only fire when those bookings exist.",
    subject: "Reminder: your session is coming up",
    placeholders: [
      "first_name",
      "name",
      "session_title",
      "session_datetime",
      "session_link",
      "sessionDate",
      "sessionTime",
      "joinUrl",
    ],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p('Just a reminder: your session "{{session_title}}" is scheduled for {{session_datetime}}.'),
      cta("{{session_link}}", "View Session Details"),
      p("See you there."),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      'Hi {{first_name}},\n\nYour session "{{session_title}}" is scheduled for {{session_datetime}}.\n\nDetails: {{session_link}}\n\n— The Ink2Wealth Team',
  },
  inactivity_come_back: {
    id: "inactivity_come_back",
    name: "Inactivity / Come Back",
    description: "Sent after a defined period of inactivity (default 14 days).",
    subject: "Your story is waiting for you",
    placeholders: ["first_name", "name", "app_link", "dashboardUrl"],
    enabled: true,
    copyVersion: EMAIL_COPY_VERSION,
    htmlBody: [
      p("Hi {{first_name}},"),
      p("It's been a while since you've been in Ink2Wealth. Your projects, drafts and progress are exactly where you left them."),
      cta("{{app_link}}", "Jump Back In"),
      p("— The Ink2Wealth Team"),
    ].join("\n"),
    textBody:
      "Hi {{first_name}},\n\nIt's been a while. Your projects are where you left them.\n\nJump back in: {{app_link}}\n\n— The Ink2Wealth Team",
  },
};

export function mergeEmailTemplate(
  id: EmailTemplateId,
  stored: Partial<EmailTemplateDoc> | null | undefined
): EmailTemplateDoc {
  const base = DEFAULT_EMAIL_TEMPLATES[id];
  if (!stored) return { ...base };
  const storedVersion = Number(stored.copyVersion || 0);
  if (storedVersion < EMAIL_COPY_VERSION) {
    return {
      ...base,
      enabled: typeof stored.enabled === "boolean" ? stored.enabled : base.enabled,
    };
  }
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
    preheader:
      typeof stored.preheader === "string" ? stored.preheader : base.preheader,
    htmlBody:
      typeof stored.htmlBody === "string" && stored.htmlBody.trim()
        ? stored.htmlBody
        : base.htmlBody,
    textBody: typeof stored.textBody === "string" ? stored.textBody : base.textBody,
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : base.enabled,
    placeholders:
      Array.isArray(stored.placeholders) && stored.placeholders.length
        ? stored.placeholders
        : base.placeholders,
    copyVersion: storedVersion || base.copyVersion,
  };
}

export function getSampleVars(id: EmailTemplateId, frontendUrl: string): Record<string, string> {
  const dash = `${frontendUrl.replace(/\/$/, "")}/dashboard`;
  const samples: Record<EmailTemplateId, Record<string, string>> = {
    welcome: {
      first_name: "Alex",
      name: "Alex",
      app_link: dash,
      app_guide_link: `${frontendUrl}/app-guide`,
    },
    email_verification: {
      first_name: "Alex",
      name: "Alex",
      verification_link: `${frontendUrl}/verify-email?sample=1`,
      verifyUrl: `${frontendUrl}/verify-email?sample=1`,
    },
    password_reset: {
      first_name: "Alex",
      name: "Alex",
      reset_link: `${frontendUrl}/reset-password?sample=1`,
      resetUrl: `${frontendUrl}/reset-password?sample=1`,
    },
    subscription_confirmation: {
      first_name: "Alex",
      name: "Alex",
      tier_name: "Premium",
      planName: "Premium",
      amount: "$24,900",
      next_billing_date: "15 Mar 2027",
      expiryDate: "15 Mar 2027",
      tier_features_list: "• Ghost Writer<br/>• Unlimited Analyzer<br/>• Wealth Engine",
      featuresList: "• Ghost Writer<br/>• Unlimited Analyzer<br/>• Wealth Engine",
    },
    subscription_renewal_reminder: {
      first_name: "Alex",
      name: "Alex",
      tier_name: "Premium",
      planName: "Premium",
      renewal_date: "18 Mar 2026",
      expiryDate: "18 Mar 2026",
      amount: "$24,900",
      renewUrl: `${frontendUrl}/pricing`,
    },
    payment_failed: {
      first_name: "Alex",
      name: "Alex",
      tier_name: "Premium",
      planName: "Premium",
      amount: "$49,900",
      billing_link: `${frontendUrl}/pricing`,
      updatePaymentUrl: `${frontendUrl}/pricing`,
    },
    ai_generation_complete: {
      first_name: "Alex",
      name: "Alex",
      project_title: "Chapter 4 — The Crossing",
      projectTitle: "Chapter 4 — The Crossing",
      project_link: dash,
      resultUrl: dash,
    },
    coaching_session_reminder: {
      first_name: "Alex",
      name: "Alex",
      session_title: "Writer sprint",
      session_datetime: "Friday, 20 Mar 2026 · 4:00 PM WAT",
      session_link: `${frontendUrl}/coach`,
      sessionDate: "Friday, 20 Mar 2026",
      sessionTime: "4:00 PM WAT",
      joinUrl: `${frontendUrl}/coach`,
    },
    inactivity_come_back: {
      first_name: "Alex",
      name: "Alex",
      app_link: dash,
      dashboardUrl: dash,
      daysInactive: "14",
    },
  };
  return samples[id];
}
