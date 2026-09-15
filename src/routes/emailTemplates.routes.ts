import { Router, Response } from "express";
import { verifyAdmin, AdminRequest } from "../middleware/admin.middleware";
import {
  EMAIL_TEMPLATE_IDS,
  EmailTemplateId,
  ensureEmailTemplatesSeeded,
  listTemplates,
  loadTemplate,
  saveTemplate,
  sendTestEmail,
} from "../services/email.service";

const router = Router();

function isTemplateId(id: string): id is EmailTemplateId {
  return (EMAIL_TEMPLATE_IDS as string[]).includes(id);
}

router.get("/", verifyAdmin, async (_req, res: Response) => {
  try {
    await ensureEmailTemplatesSeeded();
    const templates = await listTemplates();
    return res.json({ templates });
  } catch (error: any) {
    console.error("List email templates error:", error);
    return res.status(500).json({ error: error.message || "Failed to list templates" });
  }
});

router.get("/:id", verifyAdmin, async (req, res: Response) => {
  try {
    const id = String(req.params.id || "");
    if (!isTemplateId(id)) {
      return res.status(404).json({ error: "Unknown template id" });
    }
    await ensureEmailTemplatesSeeded();
    const template = await loadTemplate(id);
    return res.json({ template });
  } catch (error: any) {
    console.error("Get email template error:", error);
    return res.status(500).json({ error: error.message || "Failed to load template" });
  }
});

router.put("/:id", verifyAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const id = String(req.params.id || "");
    if (!isTemplateId(id)) {
      return res.status(404).json({ error: "Unknown template id" });
    }
    const { subject, htmlBody, textBody, enabled, name, description } = req.body || {};
    const patch: Record<string, unknown> = {};
    if (typeof subject === "string") patch.subject = subject;
    if (typeof htmlBody === "string") patch.htmlBody = htmlBody;
    if (typeof textBody === "string") patch.textBody = textBody;
    if (typeof enabled === "boolean") patch.enabled = enabled;
    if (typeof name === "string") patch.name = name;
    if (typeof description === "string") patch.description = description;

    const template = await saveTemplate(id, patch as any);
    return res.json({ template });
  } catch (error: any) {
    console.error("Update email template error:", error);
    return res.status(500).json({ error: error.message || "Failed to update template" });
  }
});

router.post("/:id/test-send", verifyAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const id = String(req.params.id || "");
    if (!isTemplateId(id)) {
      return res.status(404).json({ error: "Unknown template id" });
    }
    const to =
      String(req.body?.to || "").trim() ||
      String(req.admin?.email || "").trim();
    if (!to) {
      return res.status(400).json({ error: "Recipient email (to) is required" });
    }
    const result = await sendTestEmail(id, to);
    if (!result.ok) {
      return res.status(500).json({ error: result.reason || "Send failed", result });
    }
    return res.json({ success: true, result });
  } catch (error: any) {
    console.error("Test send email error:", error);
    return res.status(500).json({ error: error.message || "Failed to send test email" });
  }
});

export default router;
