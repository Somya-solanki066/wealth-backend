import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

const COLLECTION = "pitchProjects";

export type PitchProjectStatus = "draft" | "in_progress" | "completed";

export type ProjectDetails = {
  title: string;
  format: string;
  formatFamily: "novel" | "screenplay";
  genre: string;
  subGenre: string;
  targetPlatform: string;
  wordOrPageCount: string;
  authorName: string;
};

export type StoryCharacter = {
  id: string;
  role: string;
  name: string;
  notes: string;
};

export type StoryDetails = {
  logline: string;
  protagonist: string;
  goal: string;
  conflict: string;
  antagonist: string;
  loveInterest: string;
  uniquePremise: string;
  setting: string;
  themes: string;
  characters: StoryCharacter[];
};

export type PitchProjectDoc = {
  userId: string;
  linkedProjectId: string | null;
  currentStep: number;
  status: PitchProjectStatus;
  projectDetails: ProjectDetails;
  storyDetails: StoryDetails;
  synopsis: string;
  queryLetter: string;
  agentName: string;
  personalization: string;
  authorBio: string;
  pitchDeck: string;
  createdAt: string;
  updatedAt: string;
};

export function emptyProjectDetails(): ProjectDetails {
  return {
    title: "",
    format: "Novel",
    formatFamily: "novel",
    genre: "Romance",
    subGenre: "",
    targetPlatform: "",
    wordOrPageCount: "",
    authorName: "",
  };
}

export function emptyStoryDetails(): StoryDetails {
  return {
    logline: "",
    protagonist: "",
    goal: "",
    conflict: "",
    antagonist: "",
    loveInterest: "",
    uniquePremise: "",
    setting: "",
    themes: "",
    characters: [],
  };
}

function nowIso() {
  return new Date().toISOString();
}

function buildContextBlob(data: Partial<PitchProjectDoc>) {
  const p = data.projectDetails || emptyProjectDetails();
  const s = data.storyDetails || emptyStoryDetails();
  const extraChars = (s.characters || [])
    .map((c) => `${c.role}: ${c.name}${c.notes ? ` (${c.notes})` : ""}`)
    .join("; ");
  return [
    `Title: ${p.title}`,
    `Format: ${p.format} (${p.formatFamily})`,
    `Genre: ${p.genre}${p.subGenre ? ` / ${p.subGenre}` : ""}`,
    `Target: ${p.targetPlatform || "N/A"}`,
    `Length: ${p.wordOrPageCount || "N/A"}`,
    `Author: ${p.authorName || "N/A"}`,
    `Logline: ${s.logline}`,
    `Protagonist: ${s.protagonist}`,
    `Goal: ${s.goal}`,
    `Conflict: ${s.conflict}`,
    `Antagonist: ${s.antagonist}`,
    `Love interest / supporting: ${s.loveInterest}`,
    `Unique premise: ${s.uniquePremise}`,
    `Setting: ${s.setting}`,
    `Themes: ${s.themes}`,
    `Other characters: ${extraChars || "N/A"}`,
    `Synopsis: ${data.synopsis || ""}`,
    `Author bio notes: ${data.authorBio || ""}`,
  ].join("\n");
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

export async function listPitchProjects(userId: string) {
  const snap = await getFirestore().collection(COLLECTION).where("userId", "==", userId).limit(50).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export async function getPitchProject(userId: string, id: string) {
  const snap = await getFirestore().collection(COLLECTION).doc(id).get();
  if (!snap.exists || snap.data()?.userId !== userId) {
    const err: any = new Error("Pitch project not found");
    err.status = 404;
    throw err;
  }
  return { id: snap.id, ...snap.data() };
}

export async function createPitchProject(userId: string, partial?: Partial<PitchProjectDoc>) {
  const ref = getFirestore().collection(COLLECTION).doc();
  const now = nowIso();
  const doc: PitchProjectDoc = {
    userId,
    linkedProjectId: partial?.linkedProjectId || null,
    currentStep: partial?.currentStep || 1,
    status: "draft",
    projectDetails: { ...emptyProjectDetails(), ...(partial?.projectDetails || {}) },
    storyDetails: { ...emptyStoryDetails(), ...(partial?.storyDetails || {}) },
    synopsis: partial?.synopsis || "",
    queryLetter: partial?.queryLetter || "",
    agentName: partial?.agentName || "",
    personalization: partial?.personalization || "",
    authorBio: partial?.authorBio || "",
    pitchDeck: partial?.pitchDeck || "",
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function updatePitchProject(
  userId: string,
  id: string,
  patch: Partial<PitchProjectDoc> & { currentStep?: number; status?: PitchProjectStatus }
) {
  const existing = await getPitchProject(userId, id);
  const now = nowIso();
  const next: any = {
    ...existing,
    ...patch,
    projectDetails: patch.projectDetails
      ? { ...emptyProjectDetails(), ...(existing as any).projectDetails, ...patch.projectDetails }
      : (existing as any).projectDetails,
    storyDetails: patch.storyDetails
      ? { ...emptyStoryDetails(), ...(existing as any).storyDetails, ...patch.storyDetails }
      : (existing as any).storyDetails,
    updatedAt: now,
  };
  delete next.id;
  // Auto status
  if (next.currentStep >= 4 && next.queryLetter && next.synopsis) {
    next.status = next.status === "completed" ? "completed" : "in_progress";
  } else if (next.currentStep > 1) {
    next.status = "in_progress";
  }
  await getFirestore().collection(COLLECTION).doc(id).set(next, { merge: true });
  return { id, ...next };
}

export async function deletePitchProject(userId: string, id: string) {
  await getPitchProject(userId, id);
  await getFirestore().collection(COLLECTION).doc(id).delete();
  return { ok: true };
}

export async function generateSynopsis(opts: {
  userId: string;
  userEmail?: string | null;
  data: Partial<PitchProjectDoc>;
  mode: "generate" | "improve";
  previous?: string;
}) {
  const ctx = buildContextBlob(opts.data);
  const system =
    "You write one-paragraph synopses for novels and screenplays aimed at agents and producers. Present tense for screenplays, past or present for novels as fits. No spoilers of the ending unless asked. Compelling, clear, professional. Plain text only — just the synopsis paragraph.";
  const user =
    opts.mode === "improve" && opts.previous
      ? `${ctx}\n\nImprove and polish this synopsis. Keep the same story; make it sharper and more marketable:\n\n${opts.previous}`
      : `${ctx}\n\nWrite a one-paragraph synopsis (about 80–150 words) based on this project data.`;
  const result = await callTextOpenAi(system, user);
  await recordAiUsage({
    userId: opts.userId,
    userEmail: opts.userEmail,
    field: "wealthEngineCount",
    tool: "pitch-synopsis",
    wordsAnalyzed: countWords(ctx),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: ctx.slice(0, 200),
  });
  return result.content;
}

export async function generateQueryLetter(opts: {
  userId: string;
  userEmail?: string | null;
  data: Partial<PitchProjectDoc>;
  mode: "generate" | "improve" | "regenerate";
  previous?: string;
}) {
  const ctx = buildContextBlob(opts.data);
  const agent = opts.data.agentName || "Agent/Publisher Name";
  const personal = opts.data.personalization || "";
  const system =
    "You draft literary agent / producer query letters. Structure: greeting, opening hook, story pitch, protagonist + conflict, why this story, brief bio, close. Professional US market tone. Plain text only. Leave placeholders only if data is missing. The letter must be editable and not claim false credits.";
  let user = `${ctx}\n\nAgent/Publisher name: ${agent}\nPersonalization notes: ${personal || "None"}\n\n`;
  if (opts.mode === "improve" && opts.previous) {
    user += `Improve this draft query letter. Keep facts; tighten voice:\n\n${opts.previous}`;
  } else if (opts.mode === "regenerate" && opts.previous) {
    user += `Regenerate a fresh alternative query letter (different angle) using the same facts. Previous draft for contrast:\n\n${opts.previous}`;
  } else {
    user += `Draft a complete query letter addressed to ${agent}.`;
  }
  const result = await callTextOpenAi(system, user);
  await recordAiUsage({
    userId: opts.userId,
    userEmail: opts.userEmail,
    field: "wealthEngineCount",
    tool: "query-letter",
    wordsAnalyzed: countWords(ctx),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: ctx.slice(0, 200),
  });
  return result.content;
}

export async function generatePitchDeck(opts: {
  userId: string;
  userEmail?: string | null;
  data: Partial<PitchProjectDoc>;
  mode?: "generate" | "improve";
  previous?: string;
}) {
  const ctx = buildContextBlob(opts.data);
  const family = opts.data.projectDetails?.formatFamily || "novel";
  const system =
    family === "screenplay"
      ? "You build text pitch decks for screenplays/TV. Use labeled slides: 1 Title Page, 2 Logline, 3 Story Overview, 4 Main Characters, 5 World/Setting, 6 Story Arc, 7 Themes, 8 Target Audience, 9 Comparable Works, 10 Writer Information. Concise bullets per slide. Plain text."
      : "You build text pitch decks for novels. Use labeled slides: 1 Title Page, 2 Logline, 3 Story Overview, 4 Main Characters, 5 World/Setting, 6 Story Arc, 7 Themes, 8 Target Audience, 9 Comparable Works, 10 Author Information. Concise bullets per slide. Plain text.";
  const user =
    opts.mode === "improve" && opts.previous
      ? `${ctx}\n\nImprove this pitch deck:\n\n${opts.previous}`
      : `${ctx}\n\nGenerate the full pitch deck with all 10 slides.`;
  const result = await callTextOpenAi(system, user);
  await recordAiUsage({
    userId: opts.userId,
    userEmail: opts.userEmail,
    field: "wealthEngineCount",
    tool: "pitch-deck",
    wordsAnalyzed: countWords(ctx),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: ctx.slice(0, 200),
  });
  return result.content;
}

export async function savePackageToProject(opts: {
  userId: string;
  pitchId: string;
  projectId: string;
}) {
  const db = getFirestore();
  const pitch = (await getPitchProject(opts.userId, opts.pitchId)) as any;
  const projectSnap = await db.collection("projects").doc(opts.projectId).get();
  if (!projectSnap.exists || projectSnap.data()?.userId !== opts.userId) {
    const err: any = new Error("Project not found");
    err.status = 404;
    throw err;
  }

  const docs = [
    { title: "Logline", content: pitch.storyDetails?.logline || "" },
    { title: "Synopsis", content: pitch.synopsis || "" },
    { title: "Query Letter", content: pitch.queryLetter || "" },
    { title: "Pitch Deck", content: pitch.pitchDeck || "" },
    { title: "Author Bio", content: pitch.authorBio || "" },
  ].filter((d) => d.content.trim());

  const chaptersCol = db.collection("projects").doc(opts.projectId).collection("chapters");
  const created: string[] = [];
  for (const d of docs) {
    const ref = chaptersCol.doc();
    const html = `<p>${String(d.content)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "</p><p>")}</p>`;
    await ref.set({
      title: d.title,
      content: html,
      wordCount: countWords(d.content),
      lastSavedAt: nowIso(),
      source: "pitch-builder",
      pitchProjectId: opts.pitchId,
    });
    created.push(ref.id);
  }

  await db.collection(COLLECTION).doc(opts.pitchId).set(
    {
      linkedProjectId: opts.projectId,
      status: "completed",
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  const chapterCount = (await chaptersCol.get()).size;
  await db.collection("projects").doc(opts.projectId).set(
    { chapterCount, updatedAt: nowIso() },
    { merge: true }
  );

  return { saved: created.length, chapterIds: created, projectId: opts.projectId };
}

export function buildDownloadPackage(pitch: any) {
  const title = pitch.projectDetails?.title || "Submission";
  const safe = String(title).replace(/[^\w\-]+/g, "_").slice(0, 40);
  const files = [
    {
      filename: `${safe}_Query_Letter.txt`,
      content: pitch.queryLetter || "",
    },
    {
      filename: `${safe}_Synopsis.txt`,
      content: [pitch.storyDetails?.logline ? `LOGLINE\n${pitch.storyDetails.logline}\n\n` : "", "SYNOPSIS\n", pitch.synopsis || ""].join(""),
    },
    {
      filename: `${safe}_Pitch_Deck.txt`,
      content: pitch.pitchDeck || "",
    },
    {
      filename: `${safe}_Author_Bio.txt`,
      content: pitch.authorBio || "",
    },
  ].filter((f) => f.content.trim());

  const combined = files.map((f) => `===== ${f.filename} =====\n\n${f.content}`).join("\n\n\n");
  return {
    files,
    combinedFilename: `${safe}_Submission_Package.txt`,
    combined,
  };
}
