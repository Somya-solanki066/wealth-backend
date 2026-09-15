import express from "express";
import multer from "multer";
import * as fs from "fs";
import OpenAI from "openai";
import mammoth from "mammoth";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { getUploadsDir } from "../utils/paths";
import { getOpenAiModel, getSmartEditPrompt } from "../utils/catalog";
import { recordAiUsage, countWords } from "../utils/aiUsage";
import { normalizeSmartEditResult } from "../services/smartEdit.service";
import { DEFAULT_SMART_EDIT_PROMPT } from "../utils/smartEditPrompt";
import { creditErrorBody, runMeteredAi } from "../services/aiMeter";

dotenv.config();

const router = express.Router();
const upload = multer({ dest: getUploadsDir() });

const SCORING_CONTRACT = `
CRITICAL SCORING CONTRACT (overrides any conflicting instructions above):
- Score EACH of the 8 checks independently from 0–100 using evidence in the text.
- Do NOT invent a flat overallScore around 80–85.
- Return JSON with "checks" (all 8) and "strategy" as specified.
- Omit overallScore; the server computes it as the equal-weight average of check scores.
`;

router.post("/smart-edit", upload.single("file"), async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(userId).get();
    let textToAnalyze = req.body.text || "";

    if (req.file) {
      const filePath = req.file.path;
      const mimeType = req.file.mimetype;

      try {
        if (mimeType === "application/pdf") {
          const dataBuffer = fs.readFileSync(filePath);
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: dataBuffer });
          try {
            const pdfData = await parser.getText();
            textToAnalyze = pdfData.text;
          } finally {
            await parser.destroy();
          }
        } else if (
          mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          mimeType === "application/msword" ||
          req.file.originalname.endsWith(".docx")
        ) {
          const result = await mammoth.extractRawText({ path: filePath });
          textToAnalyze = result.value;
        } else if (mimeType === "text/plain") {
          textToAnalyze = fs.readFileSync(filePath, "utf8");
        } else {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: "Unsupported file format. Please upload PDF, DOCX, or TXT." });
        }
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      return res.status(400).json({ error: "No text provided for analysis." });
    }

    const MAX_LENGTH = 15000;
    if (textToAnalyze.length > MAX_LENGTH) {
      textToAnalyze = textToAnalyze.substring(0, MAX_LENGTH);
    }

    const metered = await runMeteredAi({
      userId,
      toolId: "smart-edit",
      inputChars: textToAnalyze.length,
      execute: async () => {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const storedPrompt = await getSmartEditPrompt();
        const basePrompt =
          storedPrompt.includes("SCORING RUBRIC") && storedPrompt.includes("strategy")
            ? storedPrompt
            : DEFAULT_SMART_EDIT_PROMPT;

        const completion = await openai.chat.completions.create({
          model: await getOpenAiModel(),
          temperature: 0.35,
          messages: [
            { role: "system", content: `${basePrompt}\n${SCORING_CONTRACT}` },
            {
              role: "user",
              content: `Analyze this draft carefully. Vary check scores based on real evidence — do not cluster around 85.\n\n---\n${textToAnalyze}`,
            },
          ],
          response_format: { type: "json_object" },
        });

        const aiResponse = completion.choices[0].message.content;
        if (!aiResponse) throw new Error("No response from OpenAI");

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(aiResponse);
        } catch {
          throw new Error("Smart Edit returned invalid JSON");
        }

        const result = normalizeSmartEditResult(parsed);
        return {
          data: result,
          provider: "openai",
          model: completion.model || "",
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
        };
      },
    });

    if (!metered.ok) {
      return res.status(metered.failure.status).json(creditErrorBody(metered.failure));
    }

    const result = metered.value.result;
    await recordAiUsage({
      userId,
      userEmail: userSnap.data()?.email || null,
      field: "smartEditCount",
      tool: "smart-edit",
      wordsAnalyzed: countWords(textToAnalyze),
      tokensUsed: 0,
      model: "",
      fileName: req.file?.originalname || "",
      inputPreview: textToAnalyze,
      score: result.overallScore,
    });

    return res.json({
      ...result,
      creditsCharged: metered.value.creditsCharged,
      creditsRemaining: metered.value.reservation.balanceAfter,
    });
  } catch (error: any) {
    console.error("Smart Edit Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred during analysis." });
  }
});

export default router;
