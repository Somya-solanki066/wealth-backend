import express from "express";
import multer from "multer";
import * as fs from "fs";
import OpenAI from "openai";
import mammoth from "mammoth";
import dotenv from "dotenv";
import { getUploadsDir } from "../utils/paths";

dotenv.config();

const router = express.Router();
const upload = multer({ dest: getUploadsDir() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROMPT_INSTRUCTIONS = `
Analyze the provided text and evaluate it strictly against these 8 editing checks:
1. Grammar
2. Passive Voice
3. Filler Words
4. Stronger Verbs
5. Repetition
6. Pacing & Flow
7. Dialogue Quality (if applicable)
8. Plagiarism Check (flag potential unoriginal phrasing based on your knowledge)

Format the response as a JSON object with the following exact structure:
{
  "overallScore": <number between 0-100>,
  "checks": [
    {
      "name": "Grammar",
      "original": "<original text snippet>",
      "suggested": "<suggested rewrite>",
      "feedback": "<brief explanation>"
    },
    ... (include all 8 checks)
  ]
}
Ensure the output is ONLY valid JSON.
`;

import { getFirestore } from "firebase-admin/firestore";

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
    const isPremium = userSnap.data()?.isPremium || false;

    // 3. Enforce Limits for Free users
    if (!isPremium) {
      const aiUsageRef = db.collection("ai_usage").doc(userId);
      const aiUsageSnap = await aiUsageRef.get();
      const usageCount = aiUsageSnap.exists ? (aiUsageSnap.data()?.smartEditCount || 0) : 0;

      if (usageCount >= freeLimit) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: "Free limit exceeded", limitExceeded: true });
      }

      // Increment usage
      await aiUsageRef.set({ smartEditCount: usageCount + 1, lastUsed: new Date() }, { merge: true });
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using gpt-4o-mini for cost efficiency while maintaining good parsing
      messages: [
        { role: "system", content: PROMPT_INSTRUCTIONS },
        { role: "user", content: textToAnalyze }
      ],
      response_format: { type: "json_object" }
    });

    const aiResponse = completion.choices[0].message.content;
    if (!aiResponse) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(aiResponse);
    return res.json(result);

  } catch (error: any) {
    console.error("Smart Edit Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred during analysis." });
  }
});

export default router;
