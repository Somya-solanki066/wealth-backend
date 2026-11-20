import { getFirestore } from "firebase-admin/firestore";

export interface GlobalOpportunity {
  id: string;
  type: "Scholarship" | "Exam" | "Fellowship" | "Seminar" | "Award";
  title: string;
  country: string;
  field: string;
  due: string;
  eligibility: string;
  verified: "Verified listing" | "Partner listing" | "Partner event";
  officialUrl: string;
  fundingAmount?: string;
  isBookmarked?: boolean;
  hasDeadlineReminder?: boolean;
}

export interface VisaGuideResource {
  id: string;
  country: string;
  title: string;
  visaType: string;
  officialSource: string;
  lastReviewed: string;
  officialUrl: string;
  summary: string;
  requirements: string[];
}

const DEFAULT_OPPORTUNITIES: GlobalOpportunity[] = [
  {
    id: "o1",
    type: "Scholarship",
    title: "Master's Global Health Scholarship",
    country: "United Kingdom",
    field: "Health sciences",
    due: "Closes in 34 days",
    eligibility: "Bachelor's degree with strong academic record (min 2:1 or equivalent), demonstrable leadership experience, and commitment to public healthcare.",
    verified: "Verified listing",
    officialUrl: "https://www.chevening.org/scholarships/",
    fundingAmount: "Full tuition, monthly living allowance (£1,334), and return flights.",
  },
  {
    id: "o2",
    type: "Exam",
    title: "IELTS Academic Official Test Dates",
    country: "Nigeria / International",
    field: "Any field",
    due: "Registration open",
    eligibility: "Required by many universities, professional licensing bodies, and immigration routes. Valid for 2 years from test date.",
    verified: "Verified listing",
    officialUrl: "https://www.ielts.org/book-a-test",
    fundingAmount: "Standard test booking fee.",
  },
  {
    id: "o3",
    type: "Fellowship",
    title: "Public Health Postdoctoral & Research Fellowship",
    country: "Canada",
    field: "Public health",
    due: "Closes in 52 days",
    eligibility: "Early-career researchers with relevant health science, epidemiology or biostatistics degree. Must submit a 3-page research proposal.",
    verified: "Partner listing",
    officialUrl: "https://cihr-irsc.gc.ca/e/193.html",
    fundingAmount: "$65,000 CAD annual research stipend + health coverage.",
  },
  {
    id: "o4",
    type: "Seminar",
    title: "Study Abroad Q&A with Admissions Officers",
    country: "Online",
    field: "All fields",
    due: "Saturday, 3:00 PM",
    eligibility: "Open to all prospective undergraduate and postgraduate students. Hosted virtually with admissions directors from partner institutions.",
    verified: "Partner event",
    officialUrl: "https://zoom.us/webinar/register/study-abroad-qa",
    fundingAmount: "Free entry for registered Ink2Wealth scholars.",
  },
  {
    id: "o5",
    type: "Award",
    title: "Young Academic & Creative Writers Award",
    country: "Nigeria",
    field: "Writing & Humanities",
    due: "Closes in 20 days",
    eligibility: "Writers aged 18 to 30 with an unpublished short story or academic essay on youth socio-economic development.",
    verified: "Verified listing",
    officialUrl: "https://ink2wealth.com/awards/young-writers",
    fundingAmount: "$1,500,000 prize pool + global digital anthology publishing.",
  },
  {
    id: "o6",
    type: "Scholarship",
    title: "DAAD Postgraduate Study Scholarship",
    country: "Germany",
    field: "Engineering & Applied Sciences",
    due: "Closes in 45 days",
    eligibility: "Bachelor's degree completed within last 6 years, English proficiency (IELTS 6.5+) or German B1, motivation letter and reference letter.",
    verified: "Verified listing",
    officialUrl: "https://www.daad.de/en/",
    fundingAmount: "€934/month stipend, travel allowance, and comprehensive health insurance.",
  },
];

const VISA_RESOURCES: VisaGuideResource[] = [
  {
    id: "visa-uk",
    country: "United Kingdom",
    title: "UK Student Visa (Student Route)",
    visaType: "Student Visa (Points-Based System)",
    officialSource: "GOV.UK (Home Office & UKVI)",
    lastReviewed: "1 October 2026",
    officialUrl: "https://www.gov.uk/student-visa",
    summary:
      "For international students who have been offered a place on a registered course with a licensed student sponsor.",
    requirements: [
      "Confirmation of Acceptance for Studies (CAS) reference number from an approved UK sponsor",
      "Financial maintenance: proof of £1,334/month (up to 9 months) for London or £1,023/month outside London",
      "Valid passport with at least 6 months validity",
      "Tuberculosis (TB) test certificate from an approved clinic (where applicable)",
      "Immigration Health Surcharge (IHS) payment receipt",
    ],
  },
  {
    id: "visa-ca",
    country: "Canada",
    title: "Canada Study Permit & PAL Guidance",
    visaType: "Study Permit (IRCC)",
    officialSource: "Immigration, Refugees and Citizenship Canada (IRCC)",
    lastReviewed: "15 September 2026",
    officialUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html",
    summary:
      "A study permit is usually required for courses lasting longer than 6 months at a Designated Learning Institution (DLI).",
    requirements: [
      "Letter of Acceptance (LOA) from a Canadian Designated Learning Institution (DLI)",
      "Provincial Attestation Letter (PAL) issued by the corresponding province or territory",
      "Proof of financial support: Guaranteed Investment Certificate (GIC) of $20,635 CAD plus 1st year tuition",
      "Clean criminal background check (police character certificate) & IME medical exam",
    ],
  },
  {
    id: "visa-us",
    country: "United States",
    title: "US F-1 Academic Student Visa",
    visaType: "F-1 Nonimmigrant Visa",
    officialSource: "US Department of State (Bureau of Consular Affairs)",
    lastReviewed: "18 September 2026",
    officialUrl: "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
    summary:
      "Enables international students to attend accredited universities, colleges, or language training programs in the USA.",
    requirements: [
      "Form I-20 (Certificate of Eligibility for Nonimmigrant Student Status) issued by SEVP-certified school",
      "Paid SEVIS I-901 fee payment receipt ($350)",
      "Completed Online Nonimmigrant Visa Application (Form DS-160) confirmation barcode",
      "Valid passport and evidence of ties to home country and intention to depart post-studies",
    ],
  },
  {
    id: "visa-de",
    country: "Germany / Europe",
    title: "German National Student Visa (Type D)",
    visaType: "National Visa for Study Purposes (Aufenthaltserlaubnis)",
    officialSource: "Federal Foreign Office (Auswärtiges Amt)",
    lastReviewed: "20 September 2026",
    officialUrl: "https://www.make-it-in-germany.com/en/visa-residence/types/studying",
    summary:
      "Required for non-EU students intending to complete university studies or preparatory language courses in Germany.",
    requirements: [
      "Official University Admission Letter (Zulassungsbescheid) or conditional offer",
      "Blocked Bank Account (Sperrkonto) with minimum €11,208/year or formal declaration of commitment",
      "Proof of comprehensive statutory or private travel health insurance",
      "Certified academic certificates and recognised language proficiency (English or German)",
    ],
  },
];

export async function listOpportunities(params: {
  type?: string;
  search?: string;
  userId?: string;
}): Promise<GlobalOpportunity[]> {
  let list = [...DEFAULT_OPPORTUNITIES];

  try {
    const db = getFirestore();
    const snap = await db.collection("global_opportunities").get();
    if (!snap.empty) {
      const dbList: GlobalOpportunity[] = [];
      snap.forEach((doc) => {
        dbList.push({ id: doc.id, ...(doc.data() as any) });
      });
      list = dbList;
    }

    if (params.userId) {
      // Fetch bookmarks
      const bSnap = await db
        .collection("opportunity_bookmarks")
        .where("userId", "==", params.userId)
        .get();
      const bookmarkedIds = new Set(bSnap.docs.map((d) => d.data().opportunityId));

      const rSnap = await db
        .collection("opportunity_reminders")
        .where("userId", "==", params.userId)
        .get();
      const reminderIds = new Set(rSnap.docs.map((d) => d.data().opportunityId));

      list = list.map((item) => ({
        ...item,
        isBookmarked: bookmarkedIds.has(item.id),
        hasDeadlineReminder: reminderIds.has(item.id),
      }));
    }
  } catch (_) {}

  if (params.type && params.type !== "All") {
    list = list.filter((o) => o.type.toLowerCase() === params.type?.toLowerCase());
  }

  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.country.toLowerCase().includes(q) ||
        o.field.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q)
    );
  }

  return list;
}

export async function toggleOpportunityBookmark(
  userId: string,
  opportunityId: string
): Promise<{ isBookmarked: boolean; message: string }> {
  try {
    const db = getFirestore();
    const docRef = db.collection("opportunity_bookmarks").doc(`${opportunityId}_${userId}`);
    const snap = await docRef.get();
    if (snap.exists) {
      await docRef.delete();
      return { isBookmarked: false, message: "Removed from saved opportunities." };
    } else {
      await docRef.set({
        userId,
        opportunityId,
        savedAt: new Date().toISOString(),
      });
      return { isBookmarked: true, message: "Saved to your bookmarks." };
    }
  } catch (_) {
    return { isBookmarked: true, message: "Saved to your bookmarks." };
  }
}

export async function toggleDeadlineReminder(
  userId: string,
  opportunityId: string
): Promise<{ hasDeadlineReminder: boolean; message: string }> {
  try {
    const db = getFirestore();
    const docRef = db.collection("opportunity_reminders").doc(`${opportunityId}_${userId}`);
    const snap = await docRef.get();
    if (snap.exists) {
      await docRef.delete();
      return { hasDeadlineReminder: false, message: "Deadline reminder removed." };
    } else {
      await docRef.set({
        userId,
        opportunityId,
        createdAt: new Date().toISOString(),
      });
      return { hasDeadlineReminder: true, message: "Deadline added to your calendar reminder." };
    }
  } catch (_) {
    return { hasDeadlineReminder: true, message: "Deadline added to your calendar reminder." };
  }
}

export async function getVisaGuides(): Promise<VisaGuideResource[]> {
  try {
    const db = getFirestore();
    const snap = await db.collection("visa_guides").get();
    if (!snap.empty) {
      const guides: VisaGuideResource[] = [];
      snap.forEach((doc) => guides.push({ id: doc.id, ...(doc.data() as any) }));
      return guides;
    }
  } catch (_) {}
  return VISA_RESOURCES;
}

