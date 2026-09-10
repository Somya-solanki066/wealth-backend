import fs from "fs";
import path from "path";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getUploadsDir } from "../utils/paths";

const ROOMS = "communityRooms";
const MEMBERS = "communityRoomMembers";
const POSTS = "communityPosts";
const COMMENTS = "communityComments";
const LIKES = "communityLikes";
const REPORTS = "communityReports";
const FEEDBACK = "communityFeedbackSubmissions";
const FEEDBACK_COMMENTS = "communityFeedbackComments";
const MENTORS = "communityMentors";
const MENTOR_REQS = "communityMentorshipRequests";
const NOTIFS = "communityNotifications";

export type RoomType = "public" | "genre" | "feedback" | "mentorship";

const DEFAULT_ROOMS = [
  {
    id: "public-reading-room",
    name: "Public Reading Room",
    description: "General discussion for screenwriters — openings, craft, wins, and questions.",
    type: "public" as RoomType,
    category: "General",
    visibility: "public",
    status: "active",
    memberCount: 312,
    onlineHint: 312,
    sortOrder: 1,
  },
  {
    id: "thriller-writers",
    name: "Thriller Writers",
    description: "A community for writers working on thriller and suspense screenplays.",
    type: "genre" as RoomType,
    category: "Thriller",
    visibility: "public",
    status: "active",
    memberCount: 84,
    onlineHint: 84,
    sortOrder: 2,
  },
  {
    id: "weekly-feedback",
    name: "Weekly Feedback Thread",
    description: "Submit pages for community review. Thread closes Sunday; history stays readable.",
    type: "feedback" as RoomType,
    category: "Feedback",
    visibility: "public",
    status: "active",
    memberCount: 0,
    onlineHint: 0,
    sortOrder: 3,
  },
  {
    id: "mentorship-matching",
    name: "Mentorship Matching",
    description: "Find a mentor for story, character, dialogue, industry, or pitching help.",
    type: "mentorship" as RoomType,
    category: "Mentorship",
    visibility: "public",
    status: "active",
    memberCount: 0,
    onlineHint: 0,
    sortOrder: 4,
  },
];

function nowIso() {
  return new Date().toISOString();
}

/** ISO week number */
export function currentWeekLabel(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo, label: `Week ${weekNo}` };
}

/** Feedback open Mon 00:00 – Sun 23:59 local; closed once Sunday ends → treat Sunday evening close as: submissions allowed until end of Sunday. Spec: "Closes Sunday" — allow submit until Sunday 23:59, block Monday+. Simpler: closed when day === 0 (Sunday) after noon? Spec says closes Sunday, new submissions not allowed when closed. We'll close at start of Sunday (day 0) so "Closes Sunday" means Sunday is closed day. Actually: "Closes Sunday" and "new submissions not allowed" when closed — I'll close on Sunday (day===0). */
export function isFeedbackThreadOpen(d = new Date()) {
  return d.getDay() !== 0; // closed on Sunday
}

function nextSundayLabel(d = new Date()) {
  const day = d.getDay();
  const daysUntil = day === 0 ? 0 : 7 - day;
  const sun = new Date(d);
  sun.setDate(d.getDate() + daysUntil);
  return sun.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function getCommunityMeta() {
  const week = currentWeekLabel();
  const open = isFeedbackThreadOpen();
  return {
    postTypes: ["Discussion", "Question", "Announcement", "Writing Advice", "Collaboration"],
    genres: ["Drama", "Thriller", "Romance", "Comedy", "Horror", "Action", "Sci-Fi"],
    feedbackAreas: ["Story", "Characters", "Dialogue", "Pacing", "Ending"],
    mentorshipNeeds: ["Story structure", "Character", "Dialogue", "Industry", "Career", "Pitching"],
    reportReasons: ["Spam", "Harassment", "Inappropriate content", "Copyright issue", "Other"],
    feedbackOpen: open,
    feedbackClosesLabel: open ? `Closes Sunday (${nextSundayLabel()})` : "Closed — opens Monday",
    weekLabel: week.label,
    weekYear: week.year,
    weekNumber: week.week,
  };
}

export async function ensureDefaultRooms() {
  const db = getFirestore();
  const created: any[] = [];
  for (const room of DEFAULT_ROOMS) {
    const ref = db.collection(ROOMS).doc(room.id);
    const snap = await ref.get();
    if (!snap.exists) {
      const { id, ...rest } = room;
      const doc = { ...rest, createdAt: nowIso(), updatedAt: nowIso() };
      await ref.set({ id, ...doc });
      created.push({ id, ...doc });
    }
  }
  return created;
}

async function displayName(uid: string) {
  const snap = await getFirestore().collection("users").doc(uid).get();
  const d = snap.data() || {};
  return d.displayName || d.name || d.email || "Writer";
}

function memberDocId(roomId: string, userId: string) {
  return `${roomId}_${userId}`;
}

export async function listRooms(userId?: string) {
  await ensureDefaultRooms();
  const db = getFirestore();
  const snap = await db.collection(ROOMS).where("status", "==", "active").get();
  let rooms = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (a.sortOrder || 99) - (b.sortOrder || 99));

  const meta = getCommunityMeta();
  rooms = rooms.map((r: any) => {
    if (r.type === "feedback") {
      return {
        ...r,
        subtitle: meta.feedbackOpen ? meta.feedbackClosesLabel : "Closed — history readable",
        feedbackOpen: meta.feedbackOpen,
        weekLabel: meta.weekLabel,
      };
    }
    if (r.type === "mentorship") {
      return { ...r, subtitle: "Find a mentor this week" };
    }
    if (r.type === "public") {
      return { ...r, subtitle: `${r.onlineHint || r.memberCount || 0} online` };
    }
    return { ...r, subtitle: `${r.memberCount || 0} members` };
  });

  if (userId) {
    const memSnap = await db.collection(MEMBERS).where("userId", "==", userId).get();
    const joined = new Set(memSnap.docs.map((d) => d.data().roomId));
    rooms = rooms.map((r: any) => ({ ...r, isMember: joined.has(r.id) }));
  }

  // Mentorship available count
  const mentorSnap = await db.collection(MENTORS).where("status", "==", "active").get();
  const freeSlots = mentorSnap.docs.reduce((n, d) => n + Number(d.data().slotsAvailable || 0), 0);
  rooms = rooms.map((r: any) =>
    r.type === "mentorship"
      ? { ...r, subtitle: `${freeSlots || mentorSnap.size} mentors free this week`, mentorsAvailable: freeSlots || mentorSnap.size }
      : r
  );

  return rooms;
}

export async function getRoom(roomId: string, userId?: string) {
  await ensureDefaultRooms();
  const snap = await getFirestore().collection(ROOMS).doc(roomId).get();
  if (!snap.exists) {
    const err: any = new Error("Room not found");
    err.status = 404;
    throw err;
  }
  const room: any = { id: snap.id, ...snap.data() };
  if (userId) {
    const mem = await getFirestore().collection(MEMBERS).doc(memberDocId(roomId, userId)).get();
    room.isMember = mem.exists;
  }
  if (room.type === "feedback") {
    const meta = getCommunityMeta();
    room.feedbackOpen = meta.feedbackOpen;
    room.weekLabel = meta.weekLabel;
    room.subtitle = meta.feedbackClosesLabel;
  }
  return room;
}

export async function joinRoom(userId: string, roomId: string) {
  const room = await getRoom(roomId);
  const db = getFirestore();
  const id = memberDocId(roomId, userId);
  const ref = db.collection(MEMBERS).doc(id);
  const existing = await ref.get();
  if (existing.exists) return { joined: true, room };
  await ref.set({ roomId, userId, joinedAt: nowIso() });
  await db.collection(ROOMS).doc(roomId).set({ memberCount: FieldValue.increment(1), updatedAt: nowIso() }, { merge: true });
  return { joined: true, room: await getRoom(roomId, userId) };
}

export async function leaveRoom(userId: string, roomId: string) {
  const db = getFirestore();
  const id = memberDocId(roomId, userId);
  const ref = db.collection(MEMBERS).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return { joined: false };
  await ref.delete();
  await db.collection(ROOMS).doc(roomId).set({ memberCount: FieldValue.increment(-1), updatedAt: nowIso() }, { merge: true });
  return { joined: false };
}

export async function listMyRooms(userId: string) {
  const db = getFirestore();
  const memSnap = await db.collection(MEMBERS).where("userId", "==", userId).get();
  const roomIds = memSnap.docs.map((d) => d.data().roomId);
  if (!roomIds.length) return [];
  const rooms = await listRooms(userId);
  return rooms.filter((r: any) => roomIds.includes(r.id));
}

async function likedByUser(postId: string, userId: string) {
  const snap = await getFirestore().collection(LIKES).doc(`${postId}_${userId}`).get();
  return snap.exists;
}

export async function listPosts(opts: {
  roomId?: string;
  userId?: string;
  authorId?: string;
  search?: string;
  limit?: number;
}) {
  const db = getFirestore();
  let snap;
  if (opts.roomId) {
    snap = await db.collection(POSTS).where("roomId", "==", opts.roomId).limit(120).get();
  } else if (opts.authorId) {
    snap = await db.collection(POSTS).where("userId", "==", opts.authorId).limit(120).get();
  } else {
    snap = await db.collection(POSTS).limit(120).get();
  }

  let posts = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p: any) => p.status !== "removed")
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  if (opts.search) {
    const q = opts.search.toLowerCase();
    posts = posts.filter(
      (p: any) =>
        String(p.title || "").toLowerCase().includes(q) ||
        String(p.content || "").toLowerCase().includes(q)
    );
  }

  const limit = opts.limit || 50;
  posts = posts.slice(0, limit);

  if (opts.userId) {
    posts = await Promise.all(
      posts.map(async (p: any) => ({
        ...p,
        liked: await likedByUser(p.id, opts.userId!),
      }))
    );
  }

  return posts;
}

export async function createPost(opts: {
  userId: string;
  roomId: string;
  title: string;
  content: string;
  postType?: string;
  attachmentUrl?: string | null;
}) {
  const room = await getRoom(opts.roomId);
  if (room.type === "feedback" || room.type === "mentorship") {
    const err: any = new Error("This room uses a specialized flow — use feedback submit or mentorship request.");
    err.status = 400;
    throw err;
  }
  const name = await displayName(opts.userId);
  const ref = getFirestore().collection(POSTS).doc();
  const doc = {
    roomId: opts.roomId,
    roomName: room.name,
    userId: opts.userId,
    authorName: name,
    title: opts.title.trim(),
    content: opts.content.trim(),
    postType: opts.postType || "Discussion",
    attachmentUrl: opts.attachmentUrl || null,
    likeCount: 0,
    replyCount: 0,
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function getPost(postId: string, userId?: string) {
  const snap = await getFirestore().collection(POSTS).doc(postId).get();
  if (!snap.exists || snap.data()?.status === "removed") {
    const err: any = new Error("Post not found");
    err.status = 404;
    throw err;
  }
  const post: any = { id: snap.id, ...snap.data() };
  if (userId) post.liked = await likedByUser(postId, userId);
  return post;
}

export async function listComments(postId: string) {
  const snap = await getFirestore().collection(COMMENTS).where("postId", "==", postId).limit(200).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c: any) => c.status !== "removed")
    .sort((a: any, b: any) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

export async function addComment(opts: { userId: string; postId: string; content: string }) {
  const post = await getPost(opts.postId);
  const name = await displayName(opts.userId);
  const ref = getFirestore().collection(COMMENTS).doc();
  const doc = {
    postId: opts.postId,
    roomId: post.roomId,
    userId: opts.userId,
    authorName: name,
    content: opts.content.trim(),
    status: "active",
    createdAt: nowIso(),
  };
  await ref.set(doc);
  await getFirestore()
    .collection(POSTS)
    .doc(opts.postId)
    .set({ replyCount: FieldValue.increment(1), updatedAt: nowIso() }, { merge: true });

  if (post.userId && post.userId !== opts.userId) {
    await pushNotif({
      userId: post.userId,
      type: "reply",
      title: "Someone replied to your post",
      body: `${name} replied on “${post.title}”`,
      refId: opts.postId,
    });
  }
  return { id: ref.id, ...doc };
}

export async function togglePostLike(userId: string, postId: string) {
  const post = await getPost(postId);
  const db = getFirestore();
  const likeId = `${postId}_${userId}`;
  const ref = db.collection(LIKES).doc(likeId);
  const existing = await ref.get();
  if (existing.exists) {
    await ref.delete();
    await db.collection(POSTS).doc(postId).set({ likeCount: FieldValue.increment(-1) }, { merge: true });
    return { liked: false };
  }
  await ref.set({ postId, userId, createdAt: nowIso() });
  await db.collection(POSTS).doc(postId).set({ likeCount: FieldValue.increment(1) }, { merge: true });
  if (post.userId && post.userId !== userId) {
    const name = await displayName(userId);
    await pushNotif({
      userId: post.userId,
      type: "like",
      title: "Someone liked your post",
      body: `${name} liked “${post.title}”`,
      refId: postId,
    });
  }
  return { liked: true };
}

export async function reportContent(opts: {
  userId: string;
  targetType: "post" | "comment" | "user" | "feedback";
  targetId: string;
  reason: string;
  details?: string;
}) {
  const ref = getFirestore().collection(REPORTS).doc();
  const doc = {
    reporterId: opts.userId,
    targetType: opts.targetType,
    targetId: opts.targetId,
    reason: opts.reason,
    details: opts.details || "",
    status: "open",
    createdAt: nowIso(),
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

async function pushNotif(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  refId?: string;
}) {
  await getFirestore().collection(NOTIFS).add({
    ...opts,
    read: false,
    createdAt: nowIso(),
  });
}

export async function listNotifications(userId: string) {
  const snap = await getFirestore().collection(NOTIFS).where("userId", "==", userId).limit(80).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function markNotificationsRead(userId: string) {
  const snap = await getFirestore().collection(NOTIFS).where("userId", "==", userId).where("read", "==", false).limit(50).get();
  const batch = getFirestore().batch();
  snap.docs.forEach((d) => batch.set(d.ref, { read: true }, { merge: true }));
  await batch.commit();
  return { ok: true };
}

/** ——— Weekly feedback ——— */
function ensureFeedbackUploadDir(submissionId: string) {
  const dir = path.join(getUploadsDir(), "community-feedback", submissionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function submitFeedback(opts: {
  userId: string;
  roomId: string;
  title: string;
  genre: string;
  requestedAreas: string[];
  previewText: string;
  pageCount?: number;
  originalFilePath?: string | null;
}) {
  if (!isFeedbackThreadOpen()) {
    const err: any = new Error("Weekly feedback thread is closed. Submissions open again Monday.");
    err.status = 403;
    throw err;
  }
  const week = currentWeekLabel();
  const name = await displayName(opts.userId);
  const ref = getFirestore().collection(FEEDBACK).doc();
  const doc = {
    roomId: opts.roomId || "weekly-feedback",
    userId: opts.userId,
    authorName: name,
    title: opts.title.trim(),
    genre: opts.genre,
    requestedAreas: opts.requestedAreas || [],
    previewText: String(opts.previewText || "").slice(0, 8000),
    pageCount: opts.pageCount || 0,
    originalFilePath: opts.originalFilePath || null,
    weekYear: week.year,
    weekNumber: week.week,
    weekLabel: week.label,
    feedbackCount: 0,
    status: "open",
    createdAt: nowIso(),
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function attachFeedbackFile(submissionId: string, file: Express.Multer.File) {
  const dir = ensureFeedbackUploadDir(submissionId);
  const ext = path.extname(file.originalname || "").toLowerCase() || ".pdf";
  const filename = `script${ext}`;
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, file.buffer);
  const rel = `/uploads/community-feedback/${submissionId}/${filename}`;
  // Extract simple preview from txt; PDF stored private — preview from client-provided text or first bytes as note
  let previewExtra = "";
  if (ext === ".txt") {
    previewExtra = file.buffer.toString("utf8").slice(0, 8000);
  }
  await getFirestore()
    .collection(FEEDBACK)
    .doc(submissionId)
    .set(
      {
        originalFilePath: rel,
        ...(previewExtra ? { previewText: previewExtra } : {}),
        updatedAt: nowIso(),
      },
      { merge: true }
    );
  return { originalFilePath: rel };
}

export async function listFeedbackSubmissions(opts: { roomId?: string; weekOnly?: boolean; userId?: string }) {
  const db = getFirestore();
  const snap = await db.collection(FEEDBACK).limit(100).get();
  const week = currentWeekLabel();
  let list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s: any) => s.status !== "removed")
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  if (opts.weekOnly) {
    list = list.filter((s: any) => s.weekYear === week.year && s.weekNumber === week.week);
  }
  // Never expose originalFilePath publicly
  return list.map((s: any) => {
    const { originalFilePath, ...safe } = s;
    return {
      ...safe,
      hasFile: Boolean(originalFilePath),
      isOwner: opts.userId ? s.userId === opts.userId : false,
    };
  });
}

export async function getFeedbackSubmission(id: string, userId?: string) {
  const snap = await getFirestore().collection(FEEDBACK).doc(id).get();
  if (!snap.exists || snap.data()?.status === "removed") {
    const err: any = new Error("Submission not found");
    err.status = 404;
    throw err;
  }
  const data: any = snap.data();
  const { originalFilePath, ...safe } = data;
  const comments = await listFeedbackComments(id);
  return {
    id: snap.id,
    ...safe,
    hasFile: Boolean(originalFilePath),
    isOwner: userId ? data.userId === userId : false,
    comments,
  };
}

export async function listFeedbackComments(submissionId: string) {
  const snap = await getFirestore().collection(FEEDBACK_COMMENTS).where("submissionId", "==", submissionId).limit(200).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c: any) => c.status !== "removed")
    .sort((a: any, b: any) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

export async function addFeedbackComment(opts: { userId: string; submissionId: string; content: string }) {
  const sub = await getFeedbackSubmission(opts.submissionId);
  const name = await displayName(opts.userId);
  const ref = getFirestore().collection(FEEDBACK_COMMENTS).doc();
  const doc = {
    submissionId: opts.submissionId,
    userId: opts.userId,
    authorName: name,
    content: opts.content.trim(),
    status: "active",
    createdAt: nowIso(),
  };
  await ref.set(doc);
  await getFirestore()
    .collection(FEEDBACK)
    .doc(opts.submissionId)
    .set({ feedbackCount: FieldValue.increment(1) }, { merge: true });

  if (sub.userId && sub.userId !== opts.userId) {
    await pushNotif({
      userId: sub.userId,
      type: "feedback",
      title: "Your feedback was received",
      body: `${name} left feedback on “${sub.title}”`,
      refId: opts.submissionId,
    });
  }
  return { id: ref.id, ...doc };
}

/** ——— Mentorship ——— */
export async function ensureDemoMentors() {
  const db = getFirestore();
  const snap = await db.collection(MENTORS).limit(1).get();
  if (!snap.empty) return;
  const demos = [
    {
      id: "mentor-sarah",
      userId: "demo-mentor-sarah",
      name: "Sarah Johnson",
      title: "Screenwriter",
      bio: "Specializes in drama, character development, and story structure.",
      genres: ["Drama", "Thriller"],
      focus: ["Story structure", "Character", "Industry"],
      yearsExperience: 10,
      slotsAvailable: 2,
      languages: ["English"],
      status: "active",
    },
    {
      id: "mentor-james",
      userId: "demo-mentor-james",
      name: "James Okoro",
      title: "Feature Writer",
      bio: "Thriller & suspense specialist. Pitch decks and industry pathways.",
      genres: ["Thriller", "Action"],
      focus: ["Dialogue", "Pitching", "Career"],
      yearsExperience: 8,
      slotsAvailable: 3,
      languages: ["English"],
      status: "active",
    },
    {
      id: "mentor-ada",
      userId: "demo-mentor-ada",
      name: "Ada Mensah",
      title: "TV Writer",
      bio: "Series structure, character arcs, and collaboration notes.",
      genres: ["Drama", "Comedy"],
      focus: ["Story structure", "Character", "Dialogue"],
      yearsExperience: 12,
      slotsAvailable: 1,
      languages: ["English"],
      status: "active",
    },
  ];
  for (const m of demos) {
    await db.collection(MENTORS).doc(m.id).set({ ...m, createdAt: nowIso() });
  }
}

export async function listMentors(filters?: { genre?: string; need?: string }) {
  await ensureDemoMentors();
  const snap = await getFirestore().collection(MENTORS).where("status", "==", "active").get();
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (filters?.genre) {
    const g = filters.genre.toLowerCase();
    list = list.filter((m: any) => (m.genres || []).some((x: string) => x.toLowerCase() === g));
  }
  if (filters?.need) {
    const n = filters.need.toLowerCase();
    list = list.filter((m: any) => (m.focus || []).some((x: string) => x.toLowerCase().includes(n)));
  }
  return list;
}

export async function getMentor(id: string) {
  await ensureDemoMentors();
  const snap = await getFirestore().collection(MENTORS).doc(id).get();
  if (!snap.exists) {
    const err: any = new Error("Mentor not found");
    err.status = 404;
    throw err;
  }
  return { id: snap.id, ...snap.data() };
}

export async function requestMentorship(opts: {
  menteeId: string;
  mentorId: string;
  workingOn: string;
  helpNeeded: string;
  preferredTime?: string;
}) {
  const mentor = await getMentor(opts.mentorId);
  const menteeName = await displayName(opts.menteeId);
  const ref = getFirestore().collection(MENTOR_REQS).doc();
  const doc = {
    mentorId: opts.mentorId,
    mentorUserId: (mentor as any).userId,
    mentorName: (mentor as any).name,
    menteeId: opts.menteeId,
    menteeName,
    workingOn: opts.workingOn.trim(),
    helpNeeded: opts.helpNeeded.trim(),
    preferredTime: opts.preferredTime || "",
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(doc);

  await pushNotif({
    userId: String((mentor as any).userId || opts.mentorId),
    type: "mentorship_request",
    title: "Mentorship request received",
    body: `${menteeName} requested mentorship`,
    refId: ref.id,
  });

  return { id: ref.id, ...doc };
}

export async function listMentorshipRequests(userId: string, role: "mentee" | "mentor") {
  const db = getFirestore();
  // Mentors may be demo IDs — also match mentorUserId or mentor docs owned by user
  let snap;
  if (role === "mentee") {
    snap = await db.collection(MENTOR_REQS).where("menteeId", "==", userId).limit(80).get();
  } else {
    snap = await db.collection(MENTOR_REQS).where("mentorUserId", "==", userId).limit(80).get();
    // Also include if user registered as mentor with matching doc id patterns
    if (snap.empty) {
      const all = await db.collection(MENTOR_REQS).limit(80).get();
      return all.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r: any) => r.mentorUserId === userId || r.mentorId === userId)
        .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    }
  }
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function respondMentorship(opts: {
  userId: string;
  requestId: string;
  action: "accept" | "decline";
}) {
  const ref = getFirestore().collection(MENTOR_REQS).doc(opts.requestId);
  const snap = await ref.get();
  if (!snap.exists) {
    const err: any = new Error("Request not found");
    err.status = 404;
    throw err;
  }
  const data = snap.data()!;
  // Allow demo mentors / matching userId
  if (data.mentorUserId !== opts.userId && data.mentorId !== opts.userId) {
    // Admin-style: if mentee somehow — no; for demo allow if mentorUserId starts with demo
    if (!String(data.mentorUserId || "").startsWith("demo-")) {
      const err: any = new Error("Not authorized to respond to this request");
      err.status = 403;
      throw err;
    }
  }
  const status = opts.action === "accept" ? "accepted" : "declined";
  await ref.set({ status, updatedAt: nowIso() }, { merge: true });

  if (status === "accepted") {
    await getFirestore()
      .collection(MENTORS)
      .doc(String(data.mentorId))
      .set({ slotsAvailable: FieldValue.increment(-1) }, { merge: true });
    await pushNotif({
      userId: data.menteeId,
      type: "mentorship_accepted",
      title: "Mentorship request accepted",
      body: `${data.mentorName} accepted your mentorship request`,
      refId: opts.requestId,
    });
  }
  return { id: opts.requestId, status };
}

export async function registerAsMentor(opts: {
  userId: string;
  name?: string;
  title?: string;
  bio?: string;
  genres?: string[];
  focus?: string[];
  yearsExperience?: number;
  slotsAvailable?: number;
  languages?: string[];
}) {
  const name = opts.name || (await displayName(opts.userId));
  const id = `mentor-${opts.userId}`;
  const doc = {
    userId: opts.userId,
    name,
    title: opts.title || "Screenwriter",
    bio: opts.bio || "",
    genres: opts.genres || [],
    focus: opts.focus || [],
    yearsExperience: opts.yearsExperience || 1,
    slotsAvailable: opts.slotsAvailable ?? 2,
    languages: opts.languages || ["English"],
    status: "active",
    updatedAt: nowIso(),
    createdAt: nowIso(),
  };
  await getFirestore().collection(MENTORS).doc(id).set(doc, { merge: true });
  return { id, ...doc };
}

export async function getCommunityProfile(userId: string) {
  const db = getFirestore();
  const [postsSnap, commentsSnap, feedbackGiven, feedbackRecv, memSnap] = await Promise.all([
    db.collection(POSTS).where("userId", "==", userId).limit(200).get(),
    db.collection(COMMENTS).where("userId", "==", userId).limit(200).get(),
    db.collection(FEEDBACK_COMMENTS).where("userId", "==", userId).limit(200).get(),
    db.collection(FEEDBACK).where("userId", "==", userId).limit(200).get(),
    db.collection(MEMBERS).where("userId", "==", userId).get(),
  ]);
  const name = await displayName(userId);
  const rooms = await listRooms(userId);
  const joinedRooms = rooms.filter((r: any) => r.isMember).map((r: any) => ({ id: r.id, name: r.name }));
  return {
    userId,
    displayName: name,
    posts: postsSnap.size,
    replies: commentsSnap.size,
    feedbackGiven: feedbackGiven.size,
    feedbackReceived: feedbackRecv.size,
    rooms: joinedRooms,
  };
}

/** Admin */
export async function adminListReports(status?: string) {
  const snap = await getFirestore().collection(REPORTS).limit(200).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (status) list = list.filter((r: any) => r.status === status);
  return list.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function adminResolveReport(reportId: string, action: "dismiss" | "remove_content", adminNote?: string) {
  const db = getFirestore();
  const ref = db.collection(REPORTS).doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Report not found"), { status: 404 });
  const report = snap.data()!;
  if (action === "remove_content") {
    if (report.targetType === "post") {
      await db.collection(POSTS).doc(report.targetId).set({ status: "removed", updatedAt: nowIso() }, { merge: true });
    } else if (report.targetType === "comment") {
      await db.collection(COMMENTS).doc(report.targetId).set({ status: "removed" }, { merge: true });
    } else if (report.targetType === "feedback") {
      await db.collection(FEEDBACK).doc(report.targetId).set({ status: "removed" }, { merge: true });
    }
  }
  await ref.set(
    { status: action === "dismiss" ? "dismissed" : "resolved", adminNote: adminNote || "", resolvedAt: nowIso() },
    { merge: true }
  );
  return { ok: true };
}

export async function adminListRooms() {
  await ensureDefaultRooms();
  const snap = await getFirestore().collection(ROOMS).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (a.sortOrder || 99) - (b.sortOrder || 99));
}

export async function adminUpsertRoom(opts: {
  id?: string;
  name: string;
  description: string;
  type: RoomType;
  category?: string;
  visibility?: string;
  status?: string;
}) {
  const db = getFirestore();
  const id =
    opts.id ||
    opts.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const ref = db.collection(ROOMS).doc(id);
  const existing = await ref.get();
  const doc = {
    name: opts.name,
    description: opts.description,
    type: opts.type,
    category: opts.category || "",
    visibility: opts.visibility || "public",
    status: opts.status || "active",
    memberCount: existing.exists ? existing.data()?.memberCount || 0 : 0,
    sortOrder: existing.exists ? existing.data()?.sortOrder || 50 : 50,
    updatedAt: nowIso(),
    ...(existing.exists ? {} : { createdAt: nowIso() }),
  };
  await ref.set(doc, { merge: true });
  return { id, ...doc };
}

export async function adminListPosts(status?: string) {
  const snap = await getFirestore().collection(POSTS).limit(200).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (status) list = list.filter((p: any) => p.status === status);
  return list.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function seedDemoCommunityContent() {
  await ensureDefaultRooms();
  await ensureDemoMentors();
  const db = getFirestore();
  const existing = await db.collection(POSTS).limit(1).get();
  if (!existing.empty) return { seeded: false, message: "Content already exists" };

  const demos = [
    {
      roomId: "public-reading-room",
      userId: "demo-john",
      authorName: "John Writer",
      title: "How do you write a strong opening scene?",
      content: "I am working on a thriller screenplay and keep rewriting page one. What hooks you in the first two pages?",
      postType: "Question",
      likeCount: 18,
      replyCount: 2,
    },
    {
      roomId: "public-reading-room",
      userId: "demo-sarah",
      authorName: "Sarah",
      title: "I finally finished my first screenplay!",
      content: "Feature-length drama, 104 pages. Taking a week off then diving into the rewrite.",
      postType: "Discussion",
      likeCount: 42,
      replyCount: 1,
    },
    {
      roomId: "thriller-writers",
      userId: "demo-mike",
      authorName: "Mike",
      title: "Looking for feedback on my thriller villain",
      content: "How do you keep a villain smart without making them omniscient?",
      postType: "Collaboration",
      likeCount: 12,
      replyCount: 0,
    },
  ];

  for (const p of demos) {
    await db.collection(POSTS).add({
      ...p,
      attachmentUrl: null,
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      roomName: DEFAULT_ROOMS.find((r) => r.id === p.roomId)?.name || "",
    });
  }
  return { seeded: true, message: "Demo posts and mentors ready" };
}
