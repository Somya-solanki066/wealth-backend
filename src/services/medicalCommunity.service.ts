import { FieldValue, getFirestore } from "firebase-admin/firestore";

export interface MedicalRoom {
  id: string;
  name: string;
  description: string;
  restricted: boolean;
  members: string;
  membersCount: number;
  c1: string;
  c2: string;
  art: string;
  activeChannels: string[];
}

export interface MedicalPost {
  id: string;
  roomId: string;
  channel: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorRole: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
  confidentialityConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalComment {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorInitials: string;
  content: string;
  createdAt: string;
}

export interface MedicalVerification {
  userId: string;
  profession: string;
  fullName: string;
  councilNumber: string;
  licenceDocumentUrl?: string;
  isVerified: boolean;
  status: "none" | "pending" | "verified";
  submittedAt: string;
  reviewedAt?: string;
}

const DEFAULT_ROOMS: MedicalRoom[] = [
  {
    id: "doc",
    name: "Doctors and Medical Professionals",
    description: "Case-based learning, exam preparation, research and careers.",
    restricted: true,
    members: "8,420 members",
    membersCount: 8420,
    c1: "#C2303E",
    c2: "#5E1120",
    art: "medical",
    activeChannels: ["Discussion", "Exam prep", "Research", "Careers", "Events"],
  },
  {
    id: "nur",
    name: "Nurses",
    description: "Nursing practice, licensing exams, careers and mentorship.",
    restricted: true,
    members: "12,310 members",
    membersCount: 12310,
    c1: "#1F8F8B",
    c2: "#0B4A55",
    art: "rooms",
    activeChannels: ["Discussion", "Exam prep", "Research", "Careers", "Events"],
  },
  {
    id: "oth",
    name: "Other Health Courses",
    description: "Pharmacy, medical laboratory science, physiotherapy, radiography, optometry, dentistry and public health.",
    restricted: false,
    members: "15,900 members",
    membersCount: 15900,
    c1: "#7A3FC4",
    c2: "#33166F",
    art: "library",
    activeChannels: ["Discussion", "Exam prep", "Research", "Careers", "Events"],
  },
];

const SEED_POSTS: Omit<MedicalPost, "id">[] = [
  // Doctors room
  {
    roomId: "doc",
    channel: "Exam preparation",
    title: "PLAB 1 in 8 Weeks Revision Strategy",
    content: "What is your approach to revising for the PLAB 1 in eight weeks? I am planning question-bank blocks and weekly mock tests.",
    authorId: "seed-doc-1",
    authorName: "Dr. Okafor",
    authorInitials: "DO",
    authorRole: "Doctor",
    likes: 24,
    comments: 9,
    confidentialityConfirmed: true,
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    roomId: "doc",
    channel: "Discussion",
    title: "Pediatric Sepsis Screening in Emergency Departments",
    content: "Guideline update discussion: Pediatric sepsis screening criteria in low-resource emergency departments. How is your centre adapting the quick SOFA protocol?",
    authorId: "seed-doc-2",
    authorName: "Dr. Bello",
    authorInitials: "DB",
    authorRole: "Doctor",
    likes: 31,
    comments: 12,
    confidentialityConfirmed: true,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    roomId: "doc",
    channel: "Careers",
    title: "Surgical Residency Application Insights",
    content: "Tips for matching into postgraduate surgical residency: early logbook documentation and published case reports make a significant difference.",
    authorId: "seed-doc-3",
    authorName: "Dr. Chidinma",
    authorInitials: "DC",
    authorRole: "Doctor",
    likes: 19,
    comments: 7,
    confidentialityConfirmed: true,
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
  },
  // Nurses room
  {
    roomId: "nur",
    channel: "Careers",
    title: "NCLEX-RN Next Gen Case Studies Strategy",
    content: "Sharing my notes on preparing for the NCLEX-RN: start with priority and delegation questions. The Next Gen clinical judgment model requires methodical triage thinking.",
    authorId: "seed-nur-1",
    authorName: "Nurse Amina",
    authorInitials: "NA",
    authorRole: "Nurse",
    likes: 41,
    comments: 14,
    confidentialityConfirmed: true,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    roomId: "nur",
    channel: "Discussion",
    title: "SBAR Shift Handoff in Critical Care",
    content: "Standardized handoff protocols (SBAR) in critical care transitions: reducing missed nursing alerts between day and night shifts.",
    authorId: "seed-nur-2",
    authorName: "Nurse David",
    authorInitials: "ND",
    authorRole: "Nurse",
    likes: 28,
    comments: 8,
    confidentialityConfirmed: true,
    createdAt: new Date(Date.now() - 3600000 * 16).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
  },
  // Other health courses
  {
    roomId: "oth",
    channel: "Discussion",
    title: "Type I vs Type II Errors in Clinical Biostatistics",
    content: "Can someone explain the difference between type I and type II errors with a simple example? Working through biostatistics past papers.",
    authorId: "seed-oth-1",
    authorName: "Chidi E.",
    authorInitials: "CE",
    authorRole: "Student",
    likes: 12,
    comments: 6,
    confidentialityConfirmed: true,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    roomId: "oth",
    channel: "Research",
    title: "Comparative Bioavailability of Amoxicillin-Clavulanic Acid",
    content: "Pharmacokinetics comparison between generic and originator amoxicillin-clavulanic acid oral formulations in hospital outpatient dispensaries.",
    authorId: "seed-oth-2",
    authorName: "Pharm. Joy",
    authorInitials: "PJ",
    authorRole: "Pharmacist",
    likes: 22,
    comments: 5,
    confidentialityConfirmed: true,
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function listMedicalRooms(): Promise<MedicalRoom[]> {
  try {
    const db = getFirestore();
    const snap = await db.collection("medical_rooms").get();
    if (!snap.empty) {
      const rooms: MedicalRoom[] = [];
      snap.forEach((doc) => {
        rooms.push({ id: doc.id, ...(doc.data() as any) });
      });
      return rooms;
    }
  } catch (_) {}
  return DEFAULT_ROOMS;
}

export async function listMedicalPosts(params: {
  roomId?: string;
  channel?: string;
  search?: string;
  userId?: string;
}): Promise<MedicalPost[]> {
  try {
    const db = getFirestore();
    let query: FirebaseFirestore.Query = db.collection("medical_posts");

    if (params.roomId && params.roomId !== "all") {
      query = query.where("roomId", "==", params.roomId);
    }
    if (params.channel && params.channel !== "All") {
      query = query.where("channel", "==", params.channel);
    }

    const snap = await query.get();
    if (!snap.empty) {
      const posts: MedicalPost[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        const likedBy = Array.isArray(d.likedBy) ? d.likedBy : [];
        posts.push({
          id: doc.id,
          roomId: d.roomId || "doc",
          channel: d.channel || "Discussion",
          title: d.title || "",
          content: d.content || "",
          authorId: d.authorId || "",
          authorName: d.authorName || "Medical Scholar",
          authorInitials: d.authorInitials || getInitials(d.authorName || "MS"),
          authorRole: d.authorRole || "Student",
          likes: typeof d.likes === "number" ? d.likes : (d.likesCount || 0),
          comments: typeof d.comments === "number" ? d.comments : (d.commentsCount || 0),
          isLiked: params.userId ? likedBy.includes(params.userId) : false,
          confidentialityConfirmed: d.confidentialityConfirmed ?? true,
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || new Date().toISOString(),
        });
      });

      // Filter search locally if present
      if (params.search) {
        const q = params.search.toLowerCase();
        return posts.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.content.toLowerCase().includes(q) ||
            p.authorName.toLowerCase().includes(q)
        );
      }

      posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return posts;
    }
  } catch (_) {}

  // Fallback to seed posts
  let list = SEED_POSTS.map((p, idx) => ({
    id: `seed_med_${p.roomId}_${idx + 1}`,
    ...p,
    isLiked: false,
  }));

  if (params.roomId && params.roomId !== "all") {
    list = list.filter((p) => p.roomId === params.roomId);
  }
  if (params.channel && params.channel !== "All") {
    list = list.filter((p) => p.channel.toLowerCase() === params.channel?.toLowerCase());
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function createMedicalPost(data: {
  userId: string;
  authorName?: string;
  authorRole?: string;
  roomId: string;
  channel: string;
  title: string;
  content: string;
  confidentialityConfirmed: boolean;
}): Promise<MedicalPost> {
  if (!data.confidentialityConfirmed) {
    throw new Error("You must confirm confidentiality before posting medical cases.");
  }
  if (!data.title?.trim() || !data.content?.trim()) {
    throw new Error("Title and content are required.");
  }

  const name = data.authorName?.trim() || "Colleague";
  const initials = getInitials(name);
  const now = new Date().toISOString();

  const newPostData = {
    roomId: data.roomId,
    channel: data.channel || "Discussion",
    title: data.title.trim(),
    content: data.content.trim(),
    authorId: data.userId,
    authorName: name,
    authorInitials: initials,
    authorRole: data.authorRole || "Student",
    likes: 0,
    comments: 0,
    likedBy: [],
    confidentialityConfirmed: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = getFirestore();
    const docRef = await db.collection("medical_posts").add(newPostData);
    return {
      id: docRef.id,
      ...newPostData,
      isLiked: false,
    };
  } catch (_) {
    // Return with generated ID if offline/demo
    return {
      id: `local_${Date.now()}`,
      ...newPostData,
      isLiked: false,
    };
  }
}

export async function toggleMedicalPostLike(userId: string, postId: string): Promise<{ liked: boolean; likes: number }> {
  try {
    const db = getFirestore();
    const ref = db.collection("medical_posts").doc(postId);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      const likedBy = Array.isArray(data.likedBy) ? [...data.likedBy] : [];
      const hasLiked = likedBy.includes(userId);
      let newLikes = typeof data.likes === "number" ? data.likes : 0;

      if (hasLiked) {
        const idx = likedBy.indexOf(userId);
        if (idx >= 0) likedBy.splice(idx, 1);
        newLikes = Math.max(0, newLikes - 1);
      } else {
        likedBy.push(userId);
        newLikes += 1;
      }

      await ref.update({
        likedBy,
        likes: newLikes,
      });

      return { liked: !hasLiked, likes: newLikes };
    }
  } catch (_) {}

  return { liked: true, likes: 1 };
}

export async function listMedicalPostComments(postId: string): Promise<MedicalComment[]> {
  try {
    const db = getFirestore();
    const snap = await db
      .collection("medical_posts")
      .doc(postId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .get();

    if (!snap.empty) {
      const comments: MedicalComment[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        comments.push({
          id: doc.id,
          postId,
          userId: d.userId || "",
          authorName: d.authorName || "Colleague",
          authorInitials: d.authorInitials || getInitials(d.authorName || "C"),
          content: d.content || "",
          createdAt: d.createdAt || new Date().toISOString(),
        });
      });
      return comments;
    }
  } catch (_) {}

  // Sample default comment
  return [
    {
      id: "comm_sample_1",
      postId,
      userId: "user_colleague",
      authorName: "Dr. Ade",
      authorInitials: "DA",
      content: "Agree completely. Methodical triage and reviewing high-yield question banks is essential.",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];
}

export async function addMedicalPostComment(params: {
  userId: string;
  authorName?: string;
  postId: string;
  content: string;
}): Promise<MedicalComment> {
  const content = params.content?.trim();
  if (!content) throw new Error("Comment content cannot be empty.");

  const name = params.authorName?.trim() || "Colleague";
  const initials = getInitials(name);
  const now = new Date().toISOString();

  const commentData = {
    postId: params.postId,
    userId: params.userId,
    authorName: name,
    authorInitials: initials,
    content,
    createdAt: now,
  };

  try {
    const db = getFirestore();
    const postRef = db.collection("medical_posts").doc(params.postId);
    const commentRef = await postRef.collection("comments").add(commentData);
    await postRef.update({
      comments: FieldValue.increment(1),
    });

    return {
      id: commentRef.id,
      ...commentData,
    };
  } catch (_) {
    return {
      id: `local_comm_${Date.now()}`,
      ...commentData,
    };
  }
}

export async function getMedicalVerification(userId: string): Promise<MedicalVerification> {
  try {
    const db = getFirestore();
    const doc = await db.collection("medical_verifications").doc(userId).get();
    if (doc.exists) {
      return doc.data() as MedicalVerification;
    }
  } catch (_) {}

  return {
    userId,
    profession: "Medical Student",
    fullName: "",
    councilNumber: "",
    isVerified: false,
    status: "none",
    submittedAt: "",
  };
}

export async function submitMedicalVerification(data: {
  userId: string;
  profession: string;
  fullName: string;
  councilNumber: string;
  licenceDocumentUrl?: string;
  confirmIdentity: boolean;
  acceptRules: boolean;
}): Promise<MedicalVerification> {
  if (!data.fullName?.trim()) throw new Error("Full legal name is required.");
  if (!data.confirmIdentity) throw new Error("Please confirm your identity matches your licence.");
  if (!data.acceptRules) throw new Error("Please accept community patient confidentiality rules.");

  const now = new Date().toISOString();
  const record: MedicalVerification = {
    userId: data.userId,
    profession: data.profession || "Doctor",
    fullName: data.fullName.trim(),
    councilNumber: data.councilNumber?.trim() || "MDCN/PENDING",
    licenceDocumentUrl: data.licenceDocumentUrl || "",
    isVerified: true, // For prototype grant instant verified status
    status: "verified",
    submittedAt: now,
    reviewedAt: now,
  };

  try {
    const db = getFirestore();
    await db.collection("medical_verifications").doc(data.userId).set(record, { merge: true });
    // Also update user's profile verified field
    await db.collection("users").doc(data.userId).set(
      {
        medicalVerified: true,
        medicalProfession: record.profession,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (_) {}

  return record;
}

export async function submitMedicalReport(params: {
  userId: string;
  postId: string;
  reason: string;
  details?: string;
}): Promise<{ id: string; success: boolean }> {
  const now = new Date().toISOString();
  const reportData = {
    userId: params.userId,
    postId: params.postId,
    reason: params.reason,
    details: params.details || "",
    status: "pending",
    createdAt: now,
  };

  try {
    const db = getFirestore();
    const ref = await db.collection("medical_reports").add(reportData);
    return { id: ref.id, success: true };
  } catch (_) {
    return { id: `rep_${Date.now()}`, success: true };
  }
}

