import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { getOpenAiModel } from "../utils/catalog";
import { isUserPremium } from "../utils/plans";
import { countWords, recordAiUsage } from "../utils/aiUsage";

dotenv.config();

const router = express.Router();

async function callJsonOpenAi(system: string, user: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content?.trim() || "{}";
  return {
    data: JSON.parse(raw),
    usage: completion.usage,
    model: completion.model || model,
  };
}

async function callTextOpenAi(system: string, user: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.75,
  });
  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("No content returned from OpenAI.");
  return {
    content,
    usage: completion.usage,
    model: completion.model || model,
  };
}

async function logStudentUsage(
  req: AuthenticatedRequest,
  tool: "study-planner" | "flashcards" | "citation" | "video-finder" | "essay-writer",
  preview: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  model?: string,
  wordsAnalyzed = 0
) {
  if (!req.user) return;
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(req.user.uid).get();
  await recordAiUsage({
    userId: req.user.uid,
    userEmail: userSnap.data()?.email || req.user.email || null,
    field: "studentHubCount",
    tool,
    wordsAnalyzed,
    tokensUsed: usage?.total_tokens || 0,
    promptTokens: usage?.prompt_tokens || 0,
    completionTokens: usage?.completion_tokens || 0,
    model: model || "",
    inputPreview: preview,
  });
}

function buildStudyPlannerPrompt(profile: any) {
  const subjects = Array.isArray(profile?.subjects) ? profile.subjects : [];
  const subjectLines = subjects
    .map((s: string) => {
      const topics = profile?.subjectTopics?.[s];
      const conf = profile?.confidence?.[s] || "Average";
      const date = profile?.subjectExamDates?.[s] || "";
      const topicList = Array.isArray(topics) && topics.length ? topics.join(", ") : "general revision";
      return `- ${s} | confidence: ${conf}${date ? ` | exam: ${date}` : ""} | topics: ${topicList}`;
    })
    .join("\n");

  return `Student profile (Nigeria-focused study planner):
Preparing for: ${profile?.preparingFor || "N/A"}
Education level: ${profile?.educationLevel || "N/A"}
Class/Year: ${profile?.classYear || "N/A"}
Exam board/session: ${profile?.examBoard || ""} ${profile?.examSession || ""}
Target university: ${profile?.targetUniversity || "N/A"}
Target course: ${profile?.targetCourse || "N/A"}
UTME subjects: ${(profile?.utmeSubjects || []).join(", ") || "N/A"}
Primary exam date: ${profile?.examDate || "N/A"}
Target WAEC/NECO grade: ${profile?.targetGrade || "N/A"}
Target UTME score: ${profile?.targetUtmeScore || "N/A"}
Daily study hours: ${profile?.dailyHours || 2}
Available days: ${(profile?.availableDays || []).join(", ") || "all weekdays"}
Preferred study times: ${(profile?.preferredTimes || []).join(", ") || "flexible"}
Available time notes: ${profile?.availableTimeNotes || "N/A"}
Other commitments: ${(profile?.commitments || []).join(", ") || "none"}
Study time after school (hours): ${profile?.studyAfterSchoolHours || "N/A"}
Learning methods: ${(profile?.learningMethods || []).join(", ") || "mixed"}
Weak topics: ${(profile?.weakTopics || []).join(", ") || profile?.weakTopicsNotes || "not specified"}
Extra weak-topic notes: ${profile?.weakTopicsNotes || ""}
Pasted syllabus notes: ${profile?.syllabusPaste || "none"}

Subjects detail:
${subjectLines || "- (none listed)"}

Today (UTC): ${new Date().toISOString().slice(0, 10)}

Rules:
- Prioritize weak confidence subjects and weak topics with more hours.
- Strong subjects get lighter revision + past questions.
- Only schedule on available days.
- Prefer the student's preferred study times in timeBlocks.
- If multiple subject exam dates exist, ramp intensity before each date.
- Include past-question practice when learning methods include Past Questions.
- Keep the plan realistic around school/coaching/work commitments.`;
}

/** POST /api/student/study-planner — generate + save plan */
router.post("/study-planner", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    const profile = req.body?.profile && typeof req.body.profile === "object" ? req.body.profile : null;
    const legacySubject = String(req.body?.subject || "").trim();
    const legacyExamDate = String(req.body?.examDate || "").trim();
    const legacyHours = Number(req.body?.dailyHours || 2);

    const effectiveProfile =
      profile ||
      ({
        preparingFor: "OTHER",
        educationLevel: "OTHER",
        classYear: "",
        subjects: legacySubject ? [legacySubject] : [],
        examDate: legacyExamDate,
        dailyHours: legacyHours,
        availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        preferredTimes: ["Evening"],
        learningMethods: ["Mixed"],
        subjectTopics: {},
        confidence: {},
        weakTopics: [],
        subjectExamDates: {},
        commitments: [],
        utmeSubjects: [],
      } as Record<string, unknown>);

    const subjects = Array.isArray(effectiveProfile.subjects)
      ? (effectiveProfile.subjects as string[]).filter(Boolean)
      : [];
    const examDate = String(effectiveProfile.examDate || "").trim();

    if (!subjects.length) {
      return res.status(400).json({ error: "Select at least one subject." });
    }
    if (!examDate && !Object.values((effectiveProfile.subjectExamDates as object) || {}).some(Boolean)) {
      return res.status(400).json({ error: "Set a primary exam date or subject exam dates." });
    }

    const result = await callJsonOpenAi(
      `You are an expert Nigerian academic study coach (WAEC, NECO, JAMB/UTME, school and university exams).
Return JSON only:
{
  "title": string,
  "summary": string,
  "days": [{ "day": string, "date": string, "topics": string, "timeBlocks": string, "focus": string }]
}
Create a realistic personalized day-by-day study schedule from today until the nearest/primary exam date.
Cap the days array to a useful length (prefer up to 45 days; if longer horizon, use weekly blocks labeled clearly).
Allocate more time to weak subjects/topics. Match available days and preferred times.`,
      buildStudyPlannerPrompt(effectiveProfile)
    );

    const days = Array.isArray(result.data?.days) ? result.data.days : [];
    const summary = String(result.data?.summary || "");
    const title =
      String(result.data?.title || "").trim() ||
      `${effectiveProfile.preparingFor || "Study"} Plan — ${subjects.slice(0, 3).join(", ")}`;

    const db = getFirestore();
    const ref = db.collection("studyPlans").doc();
    const now = new Date().toISOString();
    const doc = {
      userId: req.user.uid,
      title,
      summary,
      days,
      profile: effectiveProfile,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(doc);

    await logStudentUsage(
      req,
      "study-planner",
      subjects.join(", ").slice(0, 120),
      result.usage,
      result.model
    );

    return res.json({
      id: ref.id,
      title,
      summary,
      days,
      profile: effectiveProfile,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error("Study planner error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate study plan." });
  }
});

/** GET /api/student/study-plans */
router.get("/study-plans", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const snap = await db
      .collection("studyPlans")
      .where("userId", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const plans = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || "Study Plan",
        summary: data.summary || "",
        days: Array.isArray(data.days) ? data.days : [],
        profile: data.profile || {},
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        dayCount: Array.isArray(data.days) ? data.days.length : 0,
        subjects: Array.isArray(data.profile?.subjects) ? data.profile.subjects : [],
        preparingFor: data.profile?.preparingFor || "",
        examDate: data.profile?.examDate || "",
      };
    });

    return res.json({ plans });
  } catch (error: any) {
    console.error("List study plans error:", error);
    // Fallback without composite index
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      const db = getFirestore();
      const snap = await db.collection("studyPlans").where("userId", "==", req.user.uid).get();
      const plans = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || "Study Plan",
            summary: data.summary || "",
            days: Array.isArray(data.days) ? data.days : [],
            profile: data.profile || {},
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            dayCount: Array.isArray(data.days) ? data.days.length : 0,
            subjects: Array.isArray(data.profile?.subjects) ? data.profile.subjects : [],
            preparingFor: data.profile?.preparingFor || "",
            examDate: data.profile?.examDate || "",
          };
        })
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, 50);
      return res.json({ plans });
    } catch (fallbackErr: any) {
      return res.status(500).json({ error: fallbackErr.message || "Failed to load study plans." });
    }
  }
});

/** GET /api/student/study-plans/:id */
router.get("/study-plans/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const doc = await db.collection("studyPlans").doc(String(req.params.id)).get();
    if (!doc.exists) return res.status(404).json({ error: "Plan not found." });
    const data = doc.data()!;
    if (data.userId !== req.user.uid) return res.status(403).json({ error: "Forbidden." });
    return res.json({
      id: doc.id,
      title: data.title || "Study Plan",
      summary: data.summary || "",
      days: Array.isArray(data.days) ? data.days : [],
      profile: data.profile || {},
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    });
  } catch (error: any) {
    console.error("Get study plan error:", error);
    return res.status(500).json({ error: error.message || "Failed to load study plan." });
  }
});

/** DELETE /api/student/study-plans/:id */
router.delete("/study-plans/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const ref = db.collection("studyPlans").doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Plan not found." });
    if (doc.data()?.userId !== req.user.uid) return res.status(403).json({ error: "Forbidden." });
    await ref.delete();
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Delete study plan error:", error);
    return res.status(500).json({ error: error.message || "Failed to delete study plan." });
  }
});

/** POST /api/student/flashcards */
router.post("/flashcards", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    const mode = String(req.body?.mode || "notes").trim().toLowerCase(); // notes | topic
    const notes = String(req.body?.notes || "").trim();
    const topic = String(req.body?.topic || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const level = String(req.body?.level || "").trim();
    let count = Number(req.body?.count || req.body?.cardCount || 15);
    if (![10, 15, 20].includes(count)) count = 15;

    if (mode === "topic") {
      if (!topic) return res.status(400).json({ error: "Enter a topic to study." });
    } else if (!notes) {
      return res.status(400).json({ error: "Paste your lecture notes." });
    }

    const sourcePreview =
      mode === "topic"
        ? `Topic: ${topic}${subject ? ` | Subject: ${subject}` : ""}${level ? ` | Level: ${level}` : ""}`
        : notes.slice(0, 200);

    const userPrompt =
      mode === "topic"
        ? `Mode: Topic
Topic: ${topic}
Subject: ${subject || "General"}
Level: ${level || "Secondary / University"}
Create exactly ${count} active-recall flashcards for this topic at the given level.`
        : `Mode: Lecture notes
Subject: ${subject || "General"}
Level: ${level || "Secondary / University"}
Create exactly ${count} active-recall flashcards from these notes:

${notes.slice(0, 12000)}`;

    const result = await callJsonOpenAi(
      `You create active-recall flashcards for Nigerian and international students (WAEC, NECO, JAMB, school, university).
Return JSON only:
{
  "title": string,
  "cards": [{ "question": string, "answer": string }]
}
Generate EXACTLY ${count} high-quality Q&A flashcards.
Questions should test understanding, application, and recall — not only definitions.
Keep answers concise and exam-ready (2–4 sentences max unless a short list is needed).
Title should be short, e.g. "Physics — Newton's Laws".`,
      userPrompt
    );

    const cards = (Array.isArray(result.data?.cards) ? result.data.cards : [])
      .slice(0, count)
      .map((c: any) => ({
        question: String(c?.question || c?.q || "").trim(),
        answer: String(c?.answer || c?.a || "").trim(),
      }))
      .filter((c: { question: string; answer: string }) => c.question && c.answer);

    await logStudentUsage(
      req,
      "flashcards",
      sourcePreview,
      result.usage,
      result.model,
      countWords(mode === "topic" ? topic : notes)
    );

    return res.json({
      title: String(result.data?.title || (mode === "topic" ? topic : "Flashcard Set")),
      cards,
      count: cards.length,
      meta: { mode, topic, subject, level, requested: count },
    });
  } catch (error: any) {
    console.error("Flashcards error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate flashcards." });
  }
});

/** POST /api/student/citation */
router.post("/citation", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    const style = String(req.body?.style || "APA").trim();
    const sourceType = String(req.body?.sourceType || "website").trim().toLowerCase();
    const details =
      req.body?.details && typeof req.body.details === "object" ? req.body.details : null;
    const legacySource = String(req.body?.source || "").trim();

    const allowedTypes = ["website", "book", "journal", "youtube", "newspaper", "thesis", "article"];
    if (!allowedTypes.includes(sourceType)) {
      return res.status(400).json({ error: "Invalid source type." });
    }

    const normalizedType = sourceType === "article" ? "journal" : sourceType;

    const requiredByType: Record<string, string[]> = {
      website: ["url"],
      book: ["title", "author"],
      journal: ["title", "author", "journalName"],
      youtube: ["url"],
      newspaper: ["title", "newspaperName", "publishDate"],
      thesis: ["title", "author", "university", "year"],
    };

    if (details) {
      const required = requiredByType[normalizedType] || [];
      const missing = required.filter((key) => !String(details[key] || "").trim());
      if (missing.length) {
        return res.status(400).json({
          error: `Missing required fields: ${missing.join(", ")}.`,
        });
      }
    } else if (!legacySource) {
      return res.status(400).json({ error: "Source details are required." });
    }

    const detailLines = details
      ? Object.entries(details)
          .filter(([, v]) => String(v || "").trim())
          .map(([k, v]) => `${k}: ${String(v).trim()}`)
          .join("\n")
      : `Free-text source details:\n${legacySource}`;

    const typeLabel: Record<string, string> = {
      website: "Website",
      book: "Book",
      journal: "Journal Article",
      youtube: "YouTube Video",
      newspaper: "Newspaper",
      thesis: "Thesis",
    };

    const result = await callJsonOpenAi(
      `You are an expert citation formatter for academic writing.
Return JSON only:
{
  "citation": string,
  "notes": string
}

Rules:
- Format ONE citation strictly in the requested style (${style}).
- Source type is ${typeLabel[normalizedType] || normalizedType}.
- Use ONLY the provided structured fields. Do not invent authors, titles, years, DOIs, or URLs.
- If a non-required field is missing, omit it correctly per ${style} rules (do not invent it).
- Do not assume you can fetch webpage contents from a URL; cite from the given fields only.
- "notes" may briefly mention missing optional fields or style caveats; keep it short.
- Output "citation" as the final formatted reference string only (no markdown fences).`,
      `Style: ${style}
Source Type: ${typeLabel[normalizedType] || normalizedType}

Structured fields:
${detailLines}`
    );

    const preview =
      (details &&
        (details.title || details.url || details.author || details.journalName || details.newspaperName)) ||
      legacySource;

    await logStudentUsage(req, "citation", String(preview || style), result.usage, result.model);

    return res.json({
      citation: String(result.data?.citation || ""),
      notes: String(result.data?.notes || ""),
      style,
      sourceType: normalizedType,
    });
  } catch (error: any) {
    console.error("Citation error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate citation." });
  }
});

type YoutubeCandidate = {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  thumbnail: string;
  url: string;
  publishedAt?: string;
};

function buildVideoSearchQuery(input: {
  topic: string;
  level: string;
  exam: string;
  language: string;
}) {
  const parts = [input.topic, input.level, input.exam, "tutorial", "explained"];
  if (input.language && input.language.toLowerCase() !== "english") {
    parts.push(input.language);
  } else {
    parts.push("English");
  }
  if (/WAEC|NECO|JAMB/i.test(input.exam)) {
    parts.push("Nigeria");
  }
  return parts.filter(Boolean).join(" ");
}

async function searchYouTubeVideos(query: string, maxResults = 15): Promise<YoutubeCandidate[] | null> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return null;

  const endpoint =
    "https://www.googleapis.com/youtube/v3/search?" +
    new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: String(Math.min(Math.max(maxResults, 5), 25)),
      q: query,
      relevanceLanguage: "en",
      safeSearch: "moderate",
      videoEmbeddable: "true",
      key,
    }).toString();

  const response = await fetch(endpoint);
  if (!response.ok) {
    const text = await response.text();
    console.error("YouTube API error:", response.status, text.slice(0, 400));
    throw new Error("YouTube search failed. Check YOUTUBE_API_KEY quota/permissions.");
  }

  const data = (await response.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };

  return (data.items || [])
    .map((item) => {
      const videoId = item.id?.videoId || "";
      if (!videoId) return null;
      const sn = item.snippet || {};
      const thumb =
        sn.thumbnails?.high?.url ||
        sn.thumbnails?.medium?.url ||
        sn.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      return {
        videoId,
        title: String(sn.title || "YouTube video"),
        channel: String(sn.channelTitle || "YouTube"),
        description: String(sn.description || ""),
        thumbnail: thumb,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: sn.publishedAt,
      } as YoutubeCandidate;
    })
    .filter(Boolean) as YoutubeCandidate[];
}

/** POST /api/student/videos */
router.post("/videos", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    const topic = String(req.body?.topic || "").trim();
    const level = String(req.body?.level || "SS2").trim();
    const exam = String(req.body?.exam || "General Learning").trim();
    const language = String(req.body?.language || "English").trim();

    if (!topic) return res.status(400).json({ error: "Subject / Topic is required." });

    const searchQuery = buildVideoSearchQuery({ topic, level, exam, language });
    let candidates: YoutubeCandidate[] = [];
    let source: "youtube-api" | "search-fallback" = "search-fallback";

    try {
      const yt = await searchYouTubeVideos(searchQuery, 15);
      if (yt && yt.length) {
        candidates = yt;
        source = "youtube-api";
      }
    } catch (ytErr: any) {
      console.error("YouTube search unavailable:", ytErr?.message || ytErr);
    }

    // Rank / filter with AI when we have real YouTube candidates
    if (source === "youtube-api" && candidates.length) {
      const compact = candidates.map((c, i) => ({
        index: i,
        videoId: c.videoId,
        title: c.title,
        channel: c.channel,
        description: c.description.slice(0, 180),
      }));

      const result = await callJsonOpenAi(
        `You rank educational YouTube videos for Nigerian students.
Return JSON only:
{
  "videos": [{
    "index": number,
    "why": string,
    "suitableForLevel": boolean,
    "examRelevant": boolean
  }]
}
Pick the best EXACTLY 5 videos from the candidate list (by index).
Prefer clear tutorials matching the education level and exam/goal.
Remove duplicates, clickbait, and off-topic results.
Do not invent video IDs or titles — only use candidate indexes.`,
        `Topic: ${topic}
Education level: ${level}
Exam / goal: ${exam}
Language: ${language}
Search query used: ${searchQuery}

Candidates:
${JSON.stringify(compact, null, 2)}`
      );

      const ranked = Array.isArray(result.data?.videos) ? result.data.videos : [];
      const picked = ranked
        .map((r: any) => {
          const idx = Number(r?.index);
          const base = candidates[idx];
          if (!base) return null;
          return {
            title: base.title,
            channel: base.channel,
            why: String(r?.why || `Relevant for ${level} · ${exam}`),
            url: base.url,
            videoId: base.videoId,
            thumbnail: base.thumbnail,
            suitableForLevel: Boolean(r?.suitableForLevel),
            examRelevant: Boolean(r?.examRelevant),
          };
        })
        .filter(Boolean)
        .slice(0, 5);

      // If AI returns fewer than 5, fill from remaining candidates
      const used = new Set(picked.map((p: any) => p.videoId));
      for (const c of candidates) {
        if (picked.length >= 5) break;
        if (used.has(c.videoId)) continue;
        picked.push({
          title: c.title,
          channel: c.channel,
          why: `Matches search for ${topic} (${level} · ${exam}).`,
          url: c.url,
          videoId: c.videoId,
          thumbnail: c.thumbnail,
          suitableForLevel: true,
          examRelevant: /WAEC|NECO|JAMB|Exam/i.test(exam),
        });
      }

      await logStudentUsage(
        req,
        "video-finder",
        `${topic} | ${level} | ${exam}`,
        result.usage,
        result.model
      );

      return res.json({
        topic,
        level,
        exam,
        language,
        searchQuery,
        source,
        videos: picked,
      });
    }

    // Fallback when YOUTUBE_API_KEY is missing: AI builds targeted YouTube search links (not invented watch URLs)
    const fallback = await callJsonOpenAi(
      `You help Nigerian students find educational YouTube tutorials.
Return JSON only:
{
  "videos": [{
    "title": string,
    "channel": string,
    "why": string,
    "searchQuery": string,
    "suitableForLevel": boolean,
    "examRelevant": boolean
  }]
}
Return EXACTLY 5 recommendations.
Do NOT invent youtube.com/watch URLs or video IDs.
Each item must include a precise searchQuery that would find that tutorial on YouTube.
Titles/channels should describe the intended lesson style (e.g. WAEC Biology photosynthesis SS2).`,
      `Topic: ${topic}
Education level: ${level}
Exam / goal: ${exam}
Language: ${language}
Base search query: ${searchQuery}`
    );

    const videos = (Array.isArray(fallback.data?.videos) ? fallback.data.videos : [])
      .slice(0, 5)
      .map((v: any) => {
        const q = String(v?.searchQuery || `${topic} ${level} ${exam} tutorial`).trim();
        return {
          title: String(v?.title || q),
          channel: String(v?.channel || "YouTube Search"),
          why: String(v?.why || `Targeted for ${level} · ${exam}`),
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
          videoId: "",
          thumbnail: "",
          suitableForLevel: Boolean(v?.suitableForLevel ?? true),
          examRelevant: Boolean(v?.examRelevant ?? true),
          searchQuery: q,
        };
      });

    await logStudentUsage(
      req,
      "video-finder",
      `${topic} | ${level} | ${exam}`,
      fallback.usage,
      fallback.model
    );

    return res.json({
      topic,
      level,
      exam,
      language,
      searchQuery,
      source: "search-fallback",
      videos,
      notice:
        "Add YOUTUBE_API_KEY to the backend .env for live video thumbnails and direct watch links. Currently returning ranked YouTube search recommendations.",
    });
  } catch (error: any) {
    console.error("Video finder error:", error);
    return res.status(500).json({ error: error.message || "Failed to find videos." });
  }
});

/** POST /api/student/essay — PREMIUM */
router.post("/essay", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(req.user.uid).get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found." });
    if (!isUserPremium(userSnap.data())) {
      return res.status(403).json({
        error: "Essay & Project Writer requires an active subscription.",
        premiumRequired: true,
      });
    }

    const documentType = String(req.body?.documentType || "Essay").trim();
    const educationBand = String(req.body?.educationBand || "").trim();
    const educationLevel = String(req.body?.educationLevel || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const purpose = String(req.body?.purpose || "General Learning").trim();
    const topic = String(req.body?.topic || "").trim();
    const wordCount = Math.min(4000, Math.max(300, Number(req.body?.wordCount || 1000)));
    const writingStyle = String(req.body?.writingStyle || "Academic").trim();
    const includeReferences = Boolean(req.body?.includeReferences);
    const citationStyle = String(req.body?.citationStyle || "APA").trim();
    const userSources = String(req.body?.userSources || "").trim();
    const instructions = String(req.body?.instructions || "").trim();

    if (!topic) return res.status(400).json({ error: "topic is required." });
    if (includeReferences && !userSources) {
      return res.status(400).json({
        error:
          "Provide real sources to include references. Fake citations are not allowed.",
      });
    }

    const levelLine = [educationBand, educationLevel].filter(Boolean).join(" / ") || "Secondary School";

    const result = await callJsonOpenAi(
      `You are an academic writing assistant for Nigerian students (WAEC, NECO, JAMB, school and university).
Return JSON only:
{
  "title": string,
  "document": string,
  "referenceNote": string
}

Rules:
- Write a complete ${documentType.toLowerCase()} appropriate for ${levelLine} and purpose "${purpose}".
- Match subject context: ${subject || "General"}.
- Target about ${wordCount} words (±10% is fine).
- Writing style: ${writingStyle}.
- Structure clearly (title, introduction, body sections, conclusion) in plain text with line breaks — no markdown fences.
- Use language and depth suitable for the education level (do not write university-level prose for JSS/SS unless requested).
- For WAEC/NECO/JAMB purposes, keep exam-appropriate vocabulary and structure.
- References policy:
  - If includeReferences is false: do NOT invent a bibliography; leave referenceNote empty or a short note that references were not requested.
  - If includeReferences is true: format ONLY the user-provided sources in ${citationStyle}. NEVER invent authors, journals, DOIs, years, or URLs. If sources are incomplete, format best-effort and set referenceNote to warn that references need verification.
- Follow any additional student instructions when they do not conflict with academic honesty.`,
      `Document type: ${documentType}
Education band: ${educationBand || "N/A"}
Education / class level: ${educationLevel || "N/A"}
Subject: ${subject || "N/A"}
Purpose / exam: ${purpose}
Topic / question: ${topic}
Target word count: ${wordCount}
Writing style: ${writingStyle}
Include references: ${includeReferences ? "YES" : "NO"}
Citation style: ${includeReferences ? citationStyle : "N/A"}
User-provided sources (use only these if references enabled):
${includeReferences ? userSources : "(none)"}
Additional instructions:
${instructions || "(none)"}`
    );

    const document = String(result.data?.document || "").trim();
    const title = String(result.data?.title || "").trim();
    const referenceNote = String(result.data?.referenceNote || "").trim();

    if (!document) {
      return res.status(500).json({ error: "No document returned from AI." });
    }

    await logStudentUsage(
      req,
      "essay-writer",
      `${subject || "General"} | ${topic}`.slice(0, 160),
      result.usage,
      result.model,
      countWords(document)
    );

    return res.json({
      title,
      document,
      wordCount: countWords(document),
      documentType,
      educationLevel: levelLine,
      subject,
      purpose,
      referenceNote,
    });
  } catch (error: any) {
    console.error("Essay writer error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate document." });
  }
});

export default router;
