import { getFirestore } from "firebase-admin/firestore";

export type AiUsageField =
  | "aiAnalyzerCount"
  | "smartEditCount"
  | "ghostWriterCount"
  | "studentHubCount"
  | "wealthEngineCount";

export type AiUsageLogInput = {
  userId: string;
  userEmail?: string | null;
  field: AiUsageField;
  tool:
    | "chapter-analyzer"
    | "smart-edit"
    | "ghost-writer"
    | "study-planner"
    | "flashcards"
    | "citation"
    | "video-finder"
    | "essay-writer"
    | "book-blurb"
    | "author-bio"
    | "press-release"
    | "pitch-deck"
    | "booktok-hook"
    | "medium-outline"
    | "query-letter"
    | "social-kit";
  wordsAnalyzed?: number;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  projectId?: string;
  projectName?: string;
  chapterId?: string;
  chapterTitle?: string;
  platform?: string;
  genre?: string;
  inputPreview?: string;
  fileName?: string;
  score?: number | null;
};

function countWords(text: string): number {
  if (!text) return 0;
  return text.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export async function getAiUsageCount(userId: string, field: AiUsageField): Promise<number> {
  const db = getFirestore();
  const snap = await db.collection("ai_usage").doc(userId).get();
  if (!snap.exists) return 0;
  return Number(snap.data()?.[field] || 0);
}

export async function incrementAiUsage(userId: string, field: AiUsageField): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("ai_usage").doc(userId);
  const snap = await ref.get();
  const current = snap.exists ? Number(snap.data()?.[field] || 0) : 0;
  await ref.set({ [field]: current + 1, lastUsed: new Date() }, { merge: true });
}

export async function recordAiUsage(input: AiUsageLogInput): Promise<void> {
  const db = getFirestore();
  const {
    userId,
    userEmail,
    field,
    tool,
    wordsAnalyzed = 0,
    tokensUsed = 0,
    promptTokens = 0,
    completionTokens = 0,
    model = "",
    projectId = "",
    projectName = "",
    chapterId = "",
    chapterTitle = "",
    platform = "",
    genre = "",
    inputPreview = "",
    fileName = "",
    score = null,
  } = input;

  await incrementAiUsage(userId, field);

  const usageRef = db.collection("ai_usage").doc(userId);
  const usageSnap = await usageRef.get();
  const usageData = usageSnap.data() || {};
  await usageRef.set(
    {
      totalTokensUsed: Number(usageData.totalTokensUsed || 0) + Number(tokensUsed || 0),
      totalWordsAnalyzed: Number(usageData.totalWordsAnalyzed || 0) + Number(wordsAnalyzed || 0),
      lastTool: tool,
      lastUsed: new Date(),
    },
    { merge: true }
  );

  await db.collection("ai_usage_logs").add({
    userId,
    userEmail: userEmail || null,
    tool,
    wordsAnalyzed: Number(wordsAnalyzed || 0),
    tokensUsed: Number(tokensUsed || 0),
    promptTokens: Number(promptTokens || 0),
    completionTokens: Number(completionTokens || 0),
    model: model || null,
    projectId: projectId || null,
    projectName: projectName || null,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || null,
    platform: platform || null,
    genre: genre || null,
    fileName: fileName || null,
    score: score ?? null,
    inputPreview: String(inputPreview || "").slice(0, 280),
    createdAt: new Date(),
  });
}

export { countWords };
