import express from "express";
import multer from "multer";
import * as fs from "fs";
import OpenAI from "openai";
import mammoth from "mammoth";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { getUploadsDir } from "../utils/paths";
import { isUserPremium } from "../utils/plans";
import { getOpenAiModel, getSmartEditPrompt } from "../utils/catalog";
import { getAiUsageCount, recordAiUsage, countWords } from "../utils/aiUsage";

dotenv.config();

const router = express.Router();
const upload = multer({ dest: getUploadsDir() });

router.post("/smart-edit", upload.single("file"), async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const db = getFirestore();
    
    // 1. Get settings
    const settingsSnap = await db.collection("settings").doc("global").get();
    const settings = settingsSnap.data() || { smartEditFreeLimit: 3 };
    const freeLimit = settings.smartEditFreeLimit || 3;

    // 2. Check user status
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const isPremium = isUserPremium(userSnap.data());

    // 3. Enforce Limits for Free users
    if (!isPremium) {
      const usageCount = await getAiUsageCount(userId, "smartEditCount");
      if (usageCount >= freeLimit) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: "Free limit exceeded", limitExceeded: true });
      }
    }

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
        // Always clean up the uploaded file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      return res.status(400).json({ error: "No text provided for analysis." });
    }

    // Limit text length to prevent massive token usage
    const MAX_LENGTH = 15000; // Roughly 3000-4000 words
    if (textToAnalyze.length > MAX_LENGTH) {
      textToAnalyze = textToAnalyze.substring(0, MAX_LENGTH);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: await getOpenAiModel(),
      messages: [
        { role: "system", content: await getSmartEditPrompt() },
        { role: "user", content: textToAnalyze }
      ],
      response_format: { type: "json_object" }
    });

    const aiResponse = completion.choices[0].message.content;
    if (!aiResponse) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(aiResponse);
    const usage = completion.usage;
    const wordsAnalyzed = countWords(textToAnalyze);
    const userEmail = userSnap.data()?.email || null;

    await recordAiUsage({
      userId,
      userEmail,
      field: "smartEditCount",
      tool: "smart-edit",
      wordsAnalyzed,
      tokensUsed: usage?.total_tokens || 0,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      model: completion.model || "",
      fileName: req.file?.originalname || "",
      inputPreview: textToAnalyze,
      score: result?.overallScore ?? result?.overall_score ?? null,
    });

    return res.json(result);

  } catch (error: any) {
    console.error("Smart Edit Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred during analysis." });
  }
});

export default router;
