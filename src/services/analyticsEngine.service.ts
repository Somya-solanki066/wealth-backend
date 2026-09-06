import { getFirestore } from "firebase-admin/firestore";
import {
  EXAM_TOOLS,
  LEARNING_TOOLS,
  PRODUCTIVITY_TOOLS,
  SESSION_COLLECTIONS,
  TOOL_ROUTE_MAP,
  buildTopicStat,
  buildWeekActivity,
  classifyPerformance,
  computeStudyStreak,
  getFocusTopics,
  getWeekStart,
  normalizeSession,
  recommendedQuestionCount,
  type NormalizedAttempt,
  type TopicStat,
} from "../data/analyticsHelpers";

async function fetchAttempts(userId: string): Promise<NormalizedAttempt[]> {
  const db = getFirestore();
  const batches = await Promise.all(
    SESSION_COLLECTIONS.map(async ({ source, name }) => {
      const snap = await db.collection(name).where("userId", "==", userId).get();
      return snap.docs
        .map((d) => normalizeSession(d.id, source, d.data() as Record<string, unknown>))
        .filter((a): a is NormalizedAttempt => Boolean(a));
    })
  );
  return batches.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function fetchTopicPerformance(userId: string): Promise<TopicStat[]> {
  const db = getFirestore();
  const stats: TopicStat[] = [];

  const jambSnap = await db.collection("jambTopicPerformance").where("userId", "==", userId).get();
  for (const doc of jambSnap.docs) {
    const d = doc.data();
    stats.push(
      buildTopicStat(
        String(d.subjectLabel || d.subject || "JAMB"),
        String(d.topic || "General"),
        "jamb",
        Number(d.attempted || 0),
        Number(d.correct || 0),
        String(d.lastPracticed || "")
      )
    );
  }

  const uniSnap = await db.collection("universityTopicPerformance").where("userId", "==", userId).get();
  for (const doc of uniSnap.docs) {
    const d = doc.data();
    stats.push(
      buildTopicStat(
        String(d.courseCode || d.courseTitle || "University"),
        String(d.topic || "General"),
        "university",
        Number(d.attempted || 0),
        Number(d.correct || 0),
        String(d.lastPracticed || "")
      )
    );
  }

  const nursingSnap = await db.collection("nursingCoursePerformance").where("userId", "==", userId).get();
  for (const doc of nursingSnap.docs) {
    const d = doc.data();
    const courseId = String(d.courseId || "course");
    stats.push(
      buildTopicStat(
        courseId.replace(/-/g, " "),
        "Overall",
        "nursing",
        Number(d.attempted || 0),
        Number(d.correct || 0),
        String(d.lastPracticed || "")
      )
    );
  }

  const mbbsSubjectSnap = await db.collection("mbbsSubjectPerformance").where("userId", "==", userId).get();
  for (const doc of mbbsSubjectSnap.docs) {
    const d = doc.data();
    stats.push(
      buildTopicStat(
        String(d.subjectId || "MBBS").replace(/-/g, " "),
        "Overall",
        "mbbs",
        Number(d.attempted || 0),
        Number(d.correct || 0),
        String(d.lastPracticed || "")
      )
    );
  }

  const mbbsTopicSnap = await db.collection("mbbsTopicPerformance").where("userId", "==", userId).get();
  for (const doc of mbbsTopicSnap.docs) {
    const d = doc.data();
    stats.push(
      buildTopicStat(
        "MBBS",
        String(d.topicId || "topic").replace(/-/g, " "),
        "mbbs",
        Number(d.attempted || 0),
        Number(d.correct || 0),
        String(d.lastPracticed || "")
      )
    );
  }

  const proSnap = await db.collection("professionalSubjectPerformance").where("userId", "==", userId).get();
  for (const doc of proSnap.docs) {
    const d = doc.data();
    stats.push(
      buildTopicStat(
        String(d.subjectId || "Professional").replace(/-/g, " "),
        "Overall",
        "professional",
        Number(d.attempted || 0),
        Number(d.correct || 0),
        String(d.lastPracticed || "")
      )
    );
  }

  return stats;
}

async function fetchActivityLogs(userId: string, since?: string) {
  const db = getFirestore();
  let q = db.collection("ai_usage_logs").where("userId", "==", userId);
  const snap = await q.get();
  const logs = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      tool: String(data.tool || ""),
      createdAt: data.createdAt,
      wordsAnalyzed: Number(data.wordsAnalyzed || 0),
      inputPreview: String(data.inputPreview || ""),
    };
  });
  const filtered = since
    ? logs.filter((l) => {
        const raw = l.createdAt;
        const date =
          typeof raw === "string"
            ? raw
            : raw && typeof raw === "object" && "toDate" in raw
              ? (raw as { toDate: () => Date }).toDate().toISOString()
              : "";
        return date >= since;
      })
    : logs;
  return filtered;
}

async function fetchStudyPlans(userId: string) {
  const snap = await getFirestore().collection("studyPlans").where("userId", "==", userId).get();
  return snap.docs.map((d) => d.data());
}

function toolPerformanceFromAttempts(attempts: NormalizedAttempt[]) {
  return EXAM_TOOLS.map((tool) => {
    const toolAttempts = attempts.filter((a) => a.source === tool.id);
    if (!toolAttempts.length) {
      return { id: tool.id, label: tool.label, route: tool.route, average: null, sessions: 0, status: "no_data" as const };
    }
    const avg = Math.round(
      toolAttempts.reduce((s, a) => s + a.percentageScore, 0) / toolAttempts.length
    );
    return { id: tool.id, label: tool.label, route: tool.route, average: avg, sessions: toolAttempts.length, status: "active" as const };
  });
}

function buildTodayPriorities(topicStats: TopicStat[]) {
  const candidates = topicStats
    .filter((t) => t.status !== "not_started" && t.weaknessScore > 0)
    .sort((a, b) => b.weaknessScore - a.weaknessScore)
    .slice(0, 4);

  if (!candidates.length) {
    return topicStats
      .filter((t) => t.status === "not_started")
      .slice(0, 2)
      .map((t, i) => ({
        priority: i + 1,
        level: "moderate" as const,
        subject: t.subject,
        topic: t.topic,
        accuracy: null,
        status: t.status,
        recommendedAction: `Start practicing ${t.topic}`,
        recommendedCount: 20,
        tool: t.source,
        toolRoute: TOOL_ROUTE_MAP[t.source] || "jamb-practice",
        estimatedMinutes: 25,
      }));
  }

  return candidates.map((t, i) => ({
    priority: i + 1,
    level: t.weaknessLevel === "none" ? "moderate" : t.weaknessLevel,
    subject: t.subject,
    topic: t.topic,
    accuracy: t.accuracy,
    status: t.status,
    recommendedAction:
      t.status === "insufficient_data"
        ? `Complete at least 5 more questions on ${t.topic}`
        : t.accuracy !== null && t.accuracy < 50
          ? `Review + ${recommendedQuestionCount(t.accuracy, t.status)} MCQs`
          : `${recommendedQuestionCount(t.accuracy, t.status)} questions recommended`,
    recommendedCount: recommendedQuestionCount(t.accuracy, t.status),
    tool: t.source,
    toolRoute: TOOL_ROUTE_MAP[t.source] || "jamb-practice",
    estimatedMinutes: Math.round(recommendedQuestionCount(t.accuracy, t.status) * 1.2),
  }));
}

function buildJambAnalytics(attempts: NormalizedAttempt[], topicStats: TopicStat[]) {
  const jambAttempts = attempts.filter((a) => a.source === "jamb");
  if (!jambAttempts.length) return null;

  const mockAttempts = jambAttempts.filter((a) => String(a.metadata?.mode || "").includes("mock") || String(a.subjectLabel).toLowerCase().includes("mock"));
  const allMocks = mockAttempts.length ? mockAttempts : jambAttempts.filter((a) => (a.totalQuestions || 0) >= 30);

  const jambScores = allMocks.map((a) => Number(a.metadata?.jambScore) || Math.round((a.percentageScore / 100) * 400));
  const avgJambScore = jambScores.length ? Math.round(jambScores.reduce((s, v) => s + v, 0) / jambScores.length) : null;
  const prevMock = jambScores.length >= 2 ? jambScores[1] : null;
  const currMock = jambScores.length >= 1 ? jambScores[0] : null;

  const subjectMap = new Map<string, { total: number; count: number }>();
  for (const a of jambAttempts) {
    const scores = a.metadata?.subjectScores as Array<{ subject: string; percentage: number }> | undefined;
    if (scores?.length) {
      for (const s of scores) {
        const cur = subjectMap.get(s.subject) || { total: 0, count: 0 };
        cur.total += s.percentage;
        cur.count += 1;
        subjectMap.set(s.subject, cur);
      }
    }
  }

  const jambTopics = topicStats.filter((t) => t.source === "jamb");
  const subjectPerformance =
    subjectMap.size > 0
      ? [...subjectMap.entries()].map(([subject, s]) => ({
          subject,
          accuracy: Math.round(s.total / s.count),
          status: classifyPerformance(s.count * 10, Math.round(s.total / s.count)),
        }))
      : jambTopics
          .reduce((acc, t) => {
            const existing = acc.find((x) => x.subject === t.subject);
            if (existing) {
              existing.attempted += t.attempted;
              existing.correct += t.correct;
            } else {
              acc.push({ subject: t.subject, attempted: t.attempted, correct: t.correct, accuracy: t.accuracy, status: t.status });
            }
            return acc;
          }, [] as Array<{ subject: string; attempted: number; correct: number; accuracy: number | null; status: string }>)
          .map((s) => ({
            subject: s.subject,
            accuracy: s.attempted ? Math.round((s.correct / s.attempted) * 100) : s.accuracy,
            status: classifyPerformance(s.attempted, s.attempted ? Math.round((s.correct / s.attempted) * 100) : null),
          }));

  return {
    averageScore: avgJambScore,
    averageAccuracy: Math.round(jambAttempts.reduce((s, a) => s + a.percentageScore, 0) / jambAttempts.length),
    mocksCompleted: allMocks.length,
    subjectPerformance,
    trend: prevMock && currMock ? { previous: prevMock, current: currMock, improvement: currMock - prevMock } : null,
  };
}

function buildUniversityAnalytics(attempts: NormalizedAttempt[], topicStats: TopicStat[]) {
  const uniAttempts = attempts.filter((a) => a.source === "university");
  if (!uniAttempts.length) return null;

  const byYear = uniAttempts.map((a) => ({
    year: String(a.metadata?.year || "—"),
    course: String(a.metadata?.courseCode || a.subjectLabel),
    score: a.percentageScore,
  }));

  const uniTopics = topicStats.filter((t) => t.source === "university" && t.attempted >= 5);
  const sorted = [...uniTopics].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));

  return {
    sessions: uniAttempts.length,
    averageAccuracy: Math.round(uniAttempts.reduce((s, a) => s + a.percentageScore, 0) / uniAttempts.length),
    recentExams: byYear.slice(0, 5),
    strongest: sorted.slice(-2).reverse().map((t) => ({ topic: t.topic, accuracy: t.accuracy })),
    weakest: sorted.slice(0, 2).map((t) => ({ topic: t.topic, accuracy: t.accuracy })),
  };
}

function buildHubSubjectAnalytics(source: string, topicStats: TopicStat[]) {
  const items = topicStats.filter((t) => t.source === source);
  if (!items.length) return null;
  return items.map((t) => ({
    name: t.subject === "Overall" || t.subject === "MBBS" ? t.topic : t.subject,
    topic: t.topic,
    accuracy: t.accuracy,
    attempted: t.attempted,
    status: t.status,
    displayAccuracy: t.attempted === 0 ? "Not Started" : t.status === "insufficient_data" ? `${t.accuracy}%*` : `${t.accuracy}%`,
  }));
}

function buildImprovements(attempts: NormalizedAttempt[]) {
  const bySubject = new Map<string, number[]>();
  for (const a of attempts) {
    const key = `${a.source}::${a.subjectLabel}`;
    const list = bySubject.get(key) || [];
    list.push(a.percentageScore);
    bySubject.set(key, list);
  }
  const improvements: Array<{ subject: string; previous: number; current: number; delta: number; source: string }> = [];
  for (const [key, scores] of bySubject) {
    if (scores.length < 2) continue;
    const current = scores[0];
    const previous = scores[1];
    const delta = current - previous;
    if (delta > 0) {
      const [, subject] = key.split("::");
      improvements.push({ subject, previous, current, delta, source: key.split("::")[0] });
    }
  }
  return improvements.sort((a, b) => b.delta - a.delta).slice(0, 5);
}

function computeKnowledgeScore(attempts: NormalizedAttempt[], topicStats: TopicStat[]): number | null {
  const reliable = topicStats.filter((t) => t.status === "reliable" || t.status === "needs_practice");
  if (reliable.length) {
    const withAccuracy = reliable.filter((t) => t.accuracy !== null);
    if (withAccuracy.length) {
      return Math.round(withAccuracy.reduce((s, t) => s + (t.accuracy || 0), 0) / withAccuracy.length);
    }
  }
  if (!attempts.length) return null;
  return Math.round(attempts.reduce((s, a) => s + a.percentageScore, 0) / attempts.length);
}

function computeConsistencyScore(streak: number, weekActivity: boolean[], plannerAdherence: number | null): number | null {
  const activeDays = weekActivity.filter(Boolean).length;
  if (streak === 0 && activeDays === 0 && plannerAdherence === null) return null;
  const streakScore = Math.min(streak * 12, 60);
  const weekScore = Math.round((activeDays / 7) * 25);
  const plannerScore = plannerAdherence !== null ? Math.round(plannerAdherence * 0.15) : 0;
  return Math.min(100, streakScore + weekScore + plannerScore);
}

function computeProductivityScore(activityCounts: Record<string, number>): number | null {
  const total = Object.values(activityCounts).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  return Math.min(100, Math.round(total * 8));
}

export async function getAnalyticsOverview(userId: string, userName?: string) {
  const weekStart = getWeekStart();
  const [attempts, topicStats, activityLogs, studyPlans] = await Promise.all([
    fetchAttempts(userId),
    fetchTopicPerformance(userId),
    fetchActivityLogs(userId, weekStart),
    fetchStudyPlans(userId),
  ]);

  const weekAttempts = attempts.filter((a) => a.createdAt >= weekStart);
  const activityDates = [
    ...attempts.map((a) => a.createdAt),
    ...activityLogs.map((l) => {
      const raw = l.createdAt;
      if (typeof raw === "string") return raw;
      if (raw && typeof raw === "object" && "toDate" in raw) {
        return (raw as { toDate: () => Date }).toDate().toISOString();
      }
      return "";
    }),
  ].filter(Boolean);

  const studyStreak = computeStudyStreak(activityDates);
  const weekActivity = buildWeekActivity(activityDates);

  const questionsAttempted = weekAttempts.reduce((s, a) => s + a.totalQuestions, 0);
  const questionsCorrect = weekAttempts.reduce((s, a) => s + a.correctCount, 0);
  const studyTimeMinutes = Math.round(weekAttempts.length * 25 + activityLogs.filter((l) => l.tool === "study-planner").length * 30);

  const weakAreas = topicStats
    .filter((t) => t.weaknessLevel === "critical" || t.weaknessLevel === "warning")
    .sort((a, b) => b.weaknessScore - a.weaknessScore)
    .slice(0, 6)
    .map((t) => ({
      subject: t.subject,
      topic: t.topic,
      accuracy: t.accuracy,
      status: t.status,
      level: t.weaknessLevel,
      tool: t.source,
      toolRoute: TOOL_ROUTE_MAP[t.source] || "jamb-practice",
    }));

  const subjectMap = new Map<string, { total: number; count: number; attempted: number; correct: number }>();
  for (const t of topicStats) {
    const key = t.subject;
    const cur = subjectMap.get(key) || { total: 0, count: 0, attempted: 0, correct: 0 };
    if (t.accuracy !== null && t.attempted >= 5) {
      cur.total += t.accuracy;
      cur.count += 1;
    }
    cur.attempted += t.attempted;
    cur.correct += t.correct;
    subjectMap.set(key, cur);
  }

  const subjectPerformance = [...subjectMap.entries()]
    .map(([subject, s]) => ({
      subject,
      accuracy: s.count ? Math.round(s.total / s.count) : s.attempted ? Math.round((s.correct / s.attempted) * 100) : null,
      attempted: s.attempted,
      status: classifyPerformance(s.attempted, s.attempted ? Math.round((s.correct / s.attempted) * 100) : null),
    }))
    .filter((s) => s.attempted > 0)
    .sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));

  const toolPerformance = toolPerformanceFromAttempts(attempts);
  const todayPriorities = buildTodayPriorities(topicStats);
  const performanceTrend = attempts.slice(0, 10).reverse().map((a, i) => ({
    sessionIndex: i + 1,
    score: a.percentageScore,
    date: a.createdAt.slice(0, 10),
    source: a.source,
  }));

  const activityByTool: Record<string, number> = {};
  for (const log of activityLogs) {
    activityByTool[log.tool] = (activityByTool[log.tool] || 0) + 1;
  }
  for (const a of attempts) {
    const key = a.source === "jamb" ? "jamb-practice" : TOOL_ROUTE_MAP[a.source] || a.source;
    activityByTool[key] = (activityByTool[key] || 0) + 1;
  }

  const citationLogs = activityLogs.filter((l) => l.tool === "citation");
  const essayLogs = activityLogs.filter((l) => l.tool === "essay-writer");
  const videoLogs = activityLogs.filter((l) => l.tool === "video-finder");
  const flashcardLogs = activityLogs.filter((l) => l.tool === "flashcards");
  const plannerLogs = activityLogs.filter((l) => l.tool === "study-planner");

  const plannerAdherence = studyPlans.length
    ? Math.min(100, Math.round((plannerLogs.length / Math.max(studyPlans.length, 1)) * 80 + weekActivity.filter(Boolean).length * 3))
    : null;

  const knowledgePerformance = computeKnowledgeScore(attempts, topicStats);
  const learningConsistency = computeConsistencyScore(studyStreak, weekActivity, plannerAdherence);
  const academicProductivity = computeProductivityScore({
    citations: citationLogs.length,
    essays: essayLogs.length,
    videos: videoLogs.length,
    flashcards: flashcardLogs.length,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return {
    greeting,
    userName: userName || "Student",
    scores: {
      knowledgePerformance,
      learningConsistency,
      academicProductivity,
    },
    thisWeek: {
      questionsAttempted,
      questionsCorrect,
      studyTimeMinutes,
      studyTimeFormatted: `${Math.floor(studyTimeMinutes / 60)}h ${studyTimeMinutes % 60}m`,
      studyStreak,
    },
    todayPriorities,
    weakAreas,
    needsAttention: weakAreas.filter((w) => w.level === "critical" || w.level === "warning"),
    subjectPerformance,
    toolPerformance,
    performanceTrend,
    recentImprovements: buildImprovements(attempts),
    weekActivity,
    toolActivity: [
      ...EXAM_TOOLS.map((t) => ({ tool: t.label, route: t.route, sessions: attempts.filter((a) => a.source === t.id).length, type: "exam" })),
      ...LEARNING_TOOLS.map((t) => ({ tool: t.label, route: t.route, sessions: activityByTool[t.id] || 0, type: "learning" })),
      ...PRODUCTIVITY_TOOLS.map((t) => ({ tool: t.label, route: t.route, sessions: activityByTool[t.id] || 0, type: "productivity" })),
    ].filter((t) => t.sessions > 0),
    examAnalytics: {
      jamb: buildJambAnalytics(attempts, topicStats),
      university: buildUniversityAnalytics(attempts, topicStats),
      nursing: buildHubSubjectAnalytics("nursing", topicStats),
      mbbs: buildHubSubjectAnalytics("mbbs", topicStats),
      professional: buildHubSubjectAnalytics("professional", topicStats),
    },
    learningActivity: {
      flashcards: {
        sessions: flashcardLogs.length,
        decksGenerated: flashcardLogs.length,
        recallRate: null,
        note: "Recall rate available when flashcard review sessions are completed",
      },
      studyPlanner: {
        plansCreated: studyPlans.length,
        sessionsLogged: plannerLogs.length,
        adherence: plannerAdherence,
      },
      videos: {
        topicsSearched: videoLogs.length,
        videosOpened: videoLogs.length,
      },
      examTechniques: {
        explored: 0,
        total: 6,
        note: "Mark techniques as tried to track progress",
      },
    },
    productivity: {
      citations: {
        generated: citationLogs.length,
        note: "Activity metric only — not an academic score",
      },
      essays: {
        documentsCreated: essayLogs.length,
        totalWords: essayLogs.reduce((s, l) => s + Number(l.wordsAnalyzed || 0), 0),
        note: "Productivity metric only — not an academic score",
      },
    },
    totalAttempts: attempts.length,
    hasData: attempts.length > 0 || topicStats.some((t) => t.attempted > 0) || activityLogs.length > 0,
    categories: {
      exam: EXAM_TOOLS,
      learning: LEARNING_TOOLS,
      productivity: PRODUCTIVITY_TOOLS,
    },
  };
}

export async function logAnalyticsEvent(
  userId: string,
  event: {
    tool: string;
    eventType: string;
    subject?: string;
    topic?: string;
    score?: number;
    correct?: number;
    total?: number;
    duration?: number;
    metadata?: Record<string, unknown>;
  }
) {
  await getFirestore().collection("analyticsEvents").add({
    userId,
    ...event,
    timestamp: new Date().toISOString(),
  });
}
