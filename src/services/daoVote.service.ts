import { getFirestore } from "firebase-admin/firestore";

export type ResultsVisibility = "after-vote" | "after-close";
export type PollStatus = "open" | "closed";

export type DaoPollOption = {
  id: string;
  label: string;
};

export type DaoPoll = {
  id?: string;
  userId: string;
  projectId: string;
  projectName: string;
  chapterId: string;
  chapterTitle: string;
  question: string;
  options: DaoPollOption[];
  closesAt: string;
  resultsVisibility: ResultsVisibility;
  status: PollStatus;
  totalVotes: number;
  voteCounts: Record<string, number>;
  winnerOptionId?: string | null;
  appliedAt?: string | null;
  appliedNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DaoVote = {
  id?: string;
  pollId: string;
  userId: string;
  optionId: string;
  walletAddress?: string;
  votedAt: string;
};

function pollsCol() {
  return getFirestore().collection("daoPolls");
}

function voteDocId(pollId: string, userId: string) {
  return `${pollId}__${userId}`;
}

function votesCol() {
  return getFirestore().collection("daoVotes");
}

function optionId(index: number) {
  return `opt_${index + 1}`;
}

function normalizeOptions(raw: unknown): DaoPollOption[] {
  const list = Array.isArray(raw) ? raw : [];
  const cleaned = list
    .map((o, i) => {
      const label =
        typeof o === "string"
          ? o.trim()
          : String((o as any)?.label || "").trim();
      if (!label) return null;
      return {
        id: String((o as any)?.id || optionId(i)),
        label,
      } as DaoPollOption;
    })
    .filter(Boolean) as DaoPollOption[];

  if (cleaned.length < 2 || cleaned.length > 5) {
    throw Object.assign(new Error("Provide 2–5 voting options."), { status: 400 });
  }
  return cleaned;
}

function isClosed(poll: DaoPoll, now = new Date()): boolean {
  if (poll.status === "closed") return true;
  const closes = new Date(poll.closesAt).getTime();
  return Number.isFinite(closes) && closes <= now.getTime();
}

function computeWinner(poll: DaoPoll): string | null {
  let bestId: string | null = null;
  let best = -1;
  for (const opt of poll.options) {
    const c = Number(poll.voteCounts?.[opt.id] || 0);
    if (c > best) {
      best = c;
      bestId = opt.id;
    } else if (c === best) {
      // tie — no single winner
      bestId = null;
    }
  }
  return best > 0 ? bestId : null;
}

function computeClosed(data: Record<string, any>, now = new Date()): boolean {
  if (data.status === "closed") return true;
  const closes = new Date(String(data.closesAt || "")).getTime();
  return Number.isFinite(closes) && closes <= now.getTime();
}

async function mapPoll(id: string, data: Record<string, any>): Promise<DaoPoll> {
  const poll: DaoPoll = {
    id,
    userId: String(data.userId || ""),
    projectId: String(data.projectId || ""),
    projectName: String(data.projectName || ""),
    chapterId: String(data.chapterId || ""),
    chapterTitle: String(data.chapterTitle || ""),
    question: String(data.question || ""),
    options: Array.isArray(data.options) ? data.options : [],
    closesAt: String(data.closesAt || ""),
    resultsVisibility: data.resultsVisibility === "after-close" ? "after-close" : "after-vote",
    status: data.status === "closed" ? "closed" : "open",
    totalVotes: Number(data.totalVotes || 0),
    voteCounts: (data.voteCounts && typeof data.voteCounts === "object" ? data.voteCounts : {}) as Record<
      string,
      number
    >,
    winnerOptionId: data.winnerOptionId || null,
    appliedAt: data.appliedAt || null,
    appliedNote: data.appliedNote || null,
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
  };

  if (poll.status === "open" && isClosed(poll)) {
    const winnerOptionId = computeWinner(poll);
    const now = new Date().toISOString();
    await pollsCol().doc(id).set(
      { status: "closed", winnerOptionId, updatedAt: now },
      { merge: true }
    );
    poll.status = "closed";
    poll.winnerOptionId = winnerOptionId;
    poll.updatedAt = now;
  }

  return poll;
}

function publicResults(poll: DaoPoll, opts: { reveal: boolean; myOptionId?: string | null }) {
  const total = poll.totalVotes || 0;
  const options = poll.options.map((o) => {
    const votes = Number(poll.voteCounts?.[o.id] || 0);
    const pct = total > 0 ? Math.round((votes / total) * 1000) / 10 : 0;
    return {
      id: o.id,
      label: o.label,
      votes: opts.reveal ? votes : null,
      percent: opts.reveal ? pct : null,
    };
  });

  const winner =
    opts.reveal && poll.status === "closed" && poll.winnerOptionId
      ? poll.options.find((o) => o.id === poll.winnerOptionId) || null
      : null;

  return {
    id: poll.id,
    projectId: poll.projectId,
    projectName: poll.projectName,
    chapterId: poll.chapterId,
    chapterTitle: poll.chapterTitle,
    question: poll.question,
    options,
    closesAt: poll.closesAt,
    resultsVisibility: poll.resultsVisibility,
    status: poll.status,
    totalVotes: opts.reveal ? total : null,
    winner: winner
      ? {
          id: winner.id,
          label: winner.label,
          votes: Number(poll.voteCounts?.[winner.id] || 0),
          percent:
            total > 0
              ? Math.round((Number(poll.voteCounts?.[winner.id] || 0) / total) * 1000) / 10
              : 0,
        }
      : null,
    myOptionId: opts.myOptionId || null,
    appliedAt: poll.appliedAt || null,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    ownerId: poll.userId,
  };
}

export async function createDaoPoll(input: {
  userId: string;
  projectId: string;
  chapterId: string;
  question: string;
  options: unknown;
  closesAt: string;
  resultsVisibility?: string;
}) {
  const question = String(input.question || "").trim();
  if (question.length < 5) {
    throw Object.assign(new Error("Enter a poll question."), { status: 400 });
  }
  const closesAt = new Date(input.closesAt);
  if (!Number.isFinite(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    throw Object.assign(new Error("Closing date must be in the future."), { status: 400 });
  }

  const db = getFirestore();
  const projectSnap = await db.collection("projects").doc(input.projectId).get();
  if (!projectSnap.exists) throw Object.assign(new Error("Story not found."), { status: 404 });
  const project = projectSnap.data()!;
  if (project.userId !== input.userId) {
    throw Object.assign(new Error("Forbidden."), { status: 403 });
  }

  const chapterSnap = await db
    .collection("projects")
    .doc(input.projectId)
    .collection("chapters")
    .doc(input.chapterId)
    .get();
  if (!chapterSnap.exists) throw Object.assign(new Error("Chapter not found."), { status: 404 });

  const options = normalizeOptions(input.options);
  const voteCounts: Record<string, number> = {};
  for (const o of options) voteCounts[o.id] = 0;

  const now = new Date().toISOString();
  const ref = pollsCol().doc();
  const poll: DaoPoll = {
    userId: input.userId,
    projectId: input.projectId,
    projectName: String(project.name || "Untitled"),
    chapterId: input.chapterId,
    chapterTitle: String(chapterSnap.data()?.title || "Chapter"),
    question,
    options,
    closesAt: closesAt.toISOString(),
    resultsVisibility:
      input.resultsVisibility === "after-close" ? "after-close" : "after-vote",
    status: "open",
    totalVotes: 0,
    voteCounts,
    winnerOptionId: null,
    appliedAt: null,
    appliedNote: null,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(poll);
  return { ...poll, id: ref.id };
}

export async function listPollsForOwner(userId: string) {
  const snap = await pollsCol().where("userId", "==", userId).get();
  const polls = await Promise.all(snap.docs.map((d) => mapPoll(d.id, d.data())));
  polls.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return polls.map((p) =>
    publicResults(p, { reveal: true, myOptionId: null })
  );
}

export async function listActivePolls(userId: string) {
  // Readers see open polls they can vote on + recent closed (history)
  // For MVP: all open polls + owner's project polls + any polls (platform fiction)
  const snap = await pollsCol().limit(80).get();
  const polls = await Promise.all(snap.docs.map((d) => mapPoll(d.id, d.data())));
  polls.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const votesSnap = await votesCol().where("userId", "==", userId).get();
  const myVotes = new Map<string, string>();
  votesSnap.docs.forEach((d) => {
    const data = d.data();
    myVotes.set(String(data.pollId), String(data.optionId));
  });

  return polls.map((p) => {
    const myOptionId = myVotes.get(p.id!) || null;
    const reveal =
      p.status === "closed" ||
      (p.resultsVisibility === "after-vote" && Boolean(myOptionId)) ||
      p.userId === userId;
    return publicResults(p, { reveal, myOptionId });
  });
}

export async function getPollForUser(pollId: string, userId: string) {
  const snap = await pollsCol().doc(pollId).get();
  if (!snap.exists) throw Object.assign(new Error("Poll not found."), { status: 404 });
  const poll = await mapPoll(snap.id, snap.data()!);

  const voteSnap = await votesCol().doc(voteDocId(pollId, userId)).get();
  const myOptionId = voteSnap.exists ? String(voteSnap.data()?.optionId || "") : null;

  const reveal =
    poll.status === "closed" ||
    poll.userId === userId ||
    (poll.resultsVisibility === "after-vote" && Boolean(myOptionId));

  return publicResults(poll, { reveal, myOptionId });
}

export async function castVote(input: {
  pollId: string;
  userId: string;
  optionId: string;
  walletAddress?: string;
}) {
  const pollRef = pollsCol().doc(input.pollId);
  const voteRef = votesCol().doc(voteDocId(input.pollId, input.userId));

  const result = await getFirestore().runTransaction(async (tx) => {
    const pollSnap = await tx.get(pollRef);
    if (!pollSnap.exists) {
      throw Object.assign(new Error("Poll not found."), { status: 404 });
    }
    const data = pollSnap.data()!;
    if (computeClosed(data)) {
      throw Object.assign(new Error("Voting is closed for this poll."), { status: 400 });
    }

    const existingVote = await tx.get(voteRef);
    if (existingVote.exists) {
      throw Object.assign(new Error("You already voted on this poll."), { status: 409 });
    }

    const options = Array.isArray(data.options) ? data.options : [];
    const option = options.find((o: any) => o.id === input.optionId);
    if (!option) {
      throw Object.assign(new Error("Invalid option."), { status: 400 });
    }

    const now = new Date().toISOString();
    const voteCounts = {
      ...((data.voteCounts && typeof data.voteCounts === "object" ? data.voteCounts : {}) as Record<
        string,
        number
      >),
    };
    voteCounts[option.id] = Number(voteCounts[option.id] || 0) + 1;
    const totalVotes = Number(data.totalVotes || 0) + 1;

    tx.set(voteRef, {
      pollId: input.pollId,
      userId: input.userId,
      optionId: option.id,
      walletAddress: input.walletAddress ? String(input.walletAddress) : null,
      votedAt: now,
    });

    tx.set(
      pollRef,
      {
        voteCounts,
        totalVotes,
        updatedAt: now,
      },
      { merge: true }
    );

    const poll: DaoPoll = {
      id: pollSnap.id,
      userId: String(data.userId || ""),
      projectId: String(data.projectId || ""),
      projectName: String(data.projectName || ""),
      chapterId: String(data.chapterId || ""),
      chapterTitle: String(data.chapterTitle || ""),
      question: String(data.question || ""),
      options,
      closesAt: String(data.closesAt || ""),
      resultsVisibility: data.resultsVisibility === "after-close" ? "after-close" : "after-vote",
      status: "open",
      totalVotes,
      voteCounts,
      winnerOptionId: null,
      appliedAt: data.appliedAt || null,
      appliedNote: data.appliedNote || null,
      createdAt: String(data.createdAt || ""),
      updatedAt: now,
    };

    const reveal = poll.resultsVisibility === "after-vote" || poll.userId === input.userId;
    return publicResults(poll, { reveal, myOptionId: option.id });
  });

  return result;
}

export async function closePoll(userId: string, pollId: string) {
  const snap = await pollsCol().doc(pollId).get();
  if (!snap.exists) throw Object.assign(new Error("Poll not found."), { status: 404 });
  const poll = await mapPoll(snap.id, snap.data()!);
  if (poll.userId !== userId) throw Object.assign(new Error("Forbidden."), { status: 403 });

  const winnerOptionId = computeWinner(poll);
  const now = new Date().toISOString();
  await pollsCol().doc(pollId).set(
    { status: "closed", winnerOptionId, updatedAt: now },
    { merge: true }
  );
  return getPollForUser(pollId, userId);
}

export async function applyWinningChoice(input: {
  userId: string;
  pollId: string;
  note?: string;
}) {
  const snap = await pollsCol().doc(input.pollId).get();
  if (!snap.exists) throw Object.assign(new Error("Poll not found."), { status: 404 });
  let poll = await mapPoll(snap.id, snap.data()!);
  if (poll.userId !== input.userId) {
    throw Object.assign(new Error("Forbidden."), { status: 403 });
  }
  if (poll.status !== "closed") {
    throw Object.assign(new Error("Close the poll before applying the winning choice."), {
      status: 400,
    });
  }

  const winner = poll.options.find((o) => o.id === poll.winnerOptionId);
  if (!winner) {
    throw Object.assign(new Error("No clear winner yet (tie or no votes)."), { status: 400 });
  }

  const now = new Date().toISOString();
  const appliedNote =
    String(input.note || "").trim() ||
    `Based on reader voting: ${winner.label}`;

  await pollsCol().doc(input.pollId).set(
    { appliedAt: now, appliedNote, updatedAt: now },
    { merge: true }
  );

  // Create a draft chapter direction note as a new empty chapter outline title suggestion
  // Writer keeps final control — we only create a chapter stub with a direction note in content.
  const db = getFirestore();
  const chaptersRef = db.collection("projects").doc(poll.projectId).collection("chapters");
  const existing = await chaptersRef.get();
  const nextNum = existing.size + 1;
  const chapterRef = chaptersRef.doc();
  const title = `Chapter ${nextNum} Direction — ${winner.label}`;
  const content = `<p><strong>Reader vote direction (not auto-canon):</strong> ${winner.label}</p><p>${appliedNote}</p><p><em>Write the chapter from here. You stay in control of the story.</em></p>`;

  await chapterRef.set({
    title,
    content,
    wordCount: content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length,
    lastSavedAt: now,
    createdAt: now,
    fromDaoPollId: input.pollId,
  });

  await db.collection("projects").doc(poll.projectId).set(
    {
      chapterCount: existing.size + 1,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    poll: await getPollForUser(input.pollId, input.userId),
    chapter: {
      id: chapterRef.id,
      projectId: poll.projectId,
      title,
      direction: winner.label,
    },
    handoff: {
      projectId: poll.projectId,
      projectName: poll.projectName,
      chapterId: chapterRef.id,
      chapterTitle: title,
      direction: winner.label,
      question: poll.question,
      note: appliedNote,
    },
  };
}
