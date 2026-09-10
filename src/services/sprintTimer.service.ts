import { getFirestore } from "firebase-admin/firestore";

export type SprintSession = {
  id: string;
  userId: string;
  wordGoal: number;
  timeGoalSeconds: number;
  wordsWritten: number;
  durationSeconds: number;
  wordsPerMinute: number;
  goalAchieved: boolean;
  body?: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
};

function sessionsCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("sprintSessions");
}

function calcWpm(words: number, durationSeconds: number) {
  const mins = Math.max(durationSeconds / 60, 1 / 60);
  return Math.round((words / mins) * 10) / 10;
}

export async function saveSprintSession(input: {
  userId: string;
  wordGoal: number;
  timeGoalSeconds: number;
  wordsWritten: number;
  durationSeconds: number;
  body?: string;
  startedAt: string;
  completedAt?: string;
}): Promise<SprintSession> {
  const wordGoal = Math.max(1, Math.floor(Number(input.wordGoal) || 0));
  const timeGoalSeconds = Math.max(60, Math.floor(Number(input.timeGoalSeconds) || 0));
  const wordsWritten = Math.max(0, Math.floor(Number(input.wordsWritten) || 0));
  const durationSeconds = Math.max(0, Math.floor(Number(input.durationSeconds) || 0));
  const completedAt = input.completedAt || new Date().toISOString();
  const startedAt = input.startedAt || completedAt;
  const now = new Date().toISOString();

  const doc: Omit<SprintSession, "id"> = {
    userId: input.userId,
    wordGoal,
    timeGoalSeconds,
    wordsWritten,
    durationSeconds,
    wordsPerMinute: calcWpm(wordsWritten, durationSeconds || 1),
    goalAchieved: wordsWritten >= wordGoal,
    body: String(input.body || "").slice(0, 100000),
    startedAt,
    completedAt,
    createdAt: now,
  };

  const ref = sessionsCol(input.userId).doc();
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function listSprintSessions(userId: string, limit = 50): Promise<SprintSession[]> {
  const snap = await sessionsCol(userId).orderBy("completedAt", "desc").limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: String(data.userId || userId),
      wordGoal: Number(data.wordGoal || 0),
      timeGoalSeconds: Number(data.timeGoalSeconds || 0),
      wordsWritten: Number(data.wordsWritten || 0),
      durationSeconds: Number(data.durationSeconds || 0),
      wordsPerMinute: Number(data.wordsPerMinute || 0),
      goalAchieved: Boolean(data.goalAchieved),
      body: data.body ? String(data.body) : undefined,
      startedAt: String(data.startedAt || ""),
      completedAt: String(data.completedAt || ""),
      createdAt: String(data.createdAt || ""),
    };
  });
}

export async function getSprintAnalytics(userId: string) {
  const sessions = await listSprintSessions(userId, 200);
  const totalWords = sessions.reduce((s, x) => s + x.wordsWritten, 0);
  const totalSessions = sessions.length;
  const goalsAchieved = sessions.filter((s) => s.goalAchieved).length;
  const avgWpm =
    totalSessions === 0
      ? 0
      : Math.round((sessions.reduce((s, x) => s + x.wordsPerMinute, 0) / totalSessions) * 10) / 10;
  const best = sessions.reduce(
    (best, s) => (s.wordsWritten > best.wordsWritten ? s : best),
    sessions[0] || null
  );

  // Simple streak: consecutive UTC days with at least one session ending today backward
  const days = new Set(
    sessions.map((s) => (s.completedAt || "").slice(0, 10)).filter(Boolean)
  );
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    writingStreak: streak,
    totalWords,
    totalSessions,
    averageWordsPerMinute: avgWpm,
    goalsAchieved,
    bestSprint: best
      ? {
          id: best.id,
          wordsWritten: best.wordsWritten,
          wordGoal: best.wordGoal,
          durationSeconds: best.durationSeconds,
          wordsPerMinute: best.wordsPerMinute,
          completedAt: best.completedAt,
        }
      : null,
  };
}

export async function deleteSprintSession(userId: string, sessionId: string) {
  await sessionsCol(userId).doc(sessionId).delete();
  return { ok: true };
}
