import { getFirestore, FieldValue } from "firebase-admin/firestore";

export interface SubjectVideo {
  id: string;
  title: string;
  videoUrl: string;
  duration?: string;
  summary?: string;
}

export interface SubjectNote {
  id: string;
  title: string;
  content: string;
  keyPoints?: string[];
}

export interface SubjectQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface SubjectModule {
  id: string;
  title: string;
  description?: string;
  videos: SubjectVideo[];
  notes: SubjectNote[];
  questions?: SubjectQuestion[];
}

export interface SubjectHubItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  imageUrl: string;
  description: string;
  featured: boolean;
  order: number;
  status: "active" | "draft";
  modules: SubjectModule[];
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SUBJECT_HUBS: Omit<SubjectHubItem, "id">[] = [
  {
    title: "Human Physiology",
    subtitle: "MBBS and Nursing",
    category: "MBBS & Nursing",
    imageUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
    description: "Master the cellular, cardiovascular, neurophysiological, and renal systems. High-yield core lectures, organ system interactions, and clinical correlations designed for medical and nursing licensing examinations.",
    featured: true,
    order: 1,
    status: "active",
    modules: [
      {
        id: "m1",
        title: "Module 1: Cellular & Membrane Physiology",
        description: "Action potentials, transport mechanisms, and resting membrane equilibrium.",
        videos: [
          {
            id: "v1",
            title: "Cell Membrane Transport & Ion Channels",
            videoUrl: "https://www.youtube.com/watch?v=dPKvHrD1eS4",
            duration: "14:20",
            summary: "Primary vs secondary active transport, sodium-potassium ATPase, and Nernst equation.",
          },
          {
            id: "v2",
            title: "Action Potential Generation in Nerve & Muscle",
            videoUrl: "https://www.youtube.com/watch?v=FEHNIELPb0s",
            duration: "18:45",
            summary: "Depolarization, repolarization, refractory periods, and saltatory conduction.",
          },
        ],
        notes: [
          {
            id: "n1",
            title: "Resting Membrane Potential & Goldman Equation",
            content: "The resting membrane potential (RMP) of an excitable cell is largely determined by the potassium equilibrium potential (-90 mV) and resting permeability to K+ ions via leak channels.\n\nKey Concepts:\n1. Na+/K+ ATPase pumps 3 Na+ out for every 2 K+ pumped in (electrogenic pump).\n2. Equilibrium potentials are calculated using the Nernst Equation: E = (61.5/z) * log([ion]out / [ion]in).\n3. Threshold potential is typically around -55 mV for nerve axons.",
            keyPoints: [
              "RMP for skeletal muscle: -90 mV, for neurons: -70 mV",
              "Voltage-gated Na+ channels have m (activation) and h (inactivation) gates",
              "Tetrodotoxin blocks voltage-gated sodium channels",
            ],
          },
        ],
        questions: [
          {
            id: "q1",
            question: "Which pump directly maintains the resting intracellular concentration of Na+ and K+?",
            options: [
              "Ca2+-ATPase pump",
              "Na+/K+ ATPase electrogenic pump",
              "H+/K+ ATPase proton pump",
              "Glucose-sodium cotransporter",
            ],
            correctIndex: 1,
            explanation: "The Na+/K+ ATPase maintains high intracellular K+ and low intracellular Na+ by moving 3 Na+ out and 2 K+ in per ATP molecule hydrolyzed.",
          },
        ],
      },
      {
        id: "m2",
        title: "Module 2: Cardiovascular Dynamics & ECG",
        description: "Cardiac cycle, Wiggers diagram, conduction system, and arterial pressure regulation.",
        videos: [
          {
            id: "v3",
            title: "Cardiac Cycle & Heart Sounds Breakdown",
            videoUrl: "https://www.youtube.com/watch?v=IS9TD9fHFv0",
            duration: "21:10",
            summary: "Systole, diastole, isovolumetric contraction, and murmur auscultation timings.",
          },
        ],
        notes: [
          {
            id: "n2",
            title: "ECG Vectors & Normal Waveforms",
            content: "ECG reflects electrical dipole vectors across atrial and ventricular myocytes.\n- P wave: Atrial depolarization (normal duration < 0.12s)\n- PR interval: AV node conduction delay (0.12 - 0.20s)\n- QRS complex: Ventricular depolarization (< 0.10s)\n- T wave: Ventricular repolarization",
            keyPoints: [
              "SA node fires at 60-100 bpm intrinsic rate",
              "AV node is the slowest conducting tissue to allow ventricular filling",
              "Purkinje fibers have the fastest conduction velocity (4 m/s)",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Anatomy",
    subtitle: "MBBS and Nursing",
    category: "MBBS & Nursing",
    imageUrl: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80",
    description: "Regional and gross anatomy with cadaveric landmarks, neuroanatomy, musculoskeletal origins, and clinical incisions required for medical students and operating theatre nurses.",
    featured: true,
    order: 2,
    status: "active",
    modules: [
      {
        id: "m1",
        title: "Module 1: Upper Limb Anatomy & Brachial Plexus",
        description: "Roots, trunks, divisions, cords, and peripheral nerve distributions.",
        videos: [
          {
            id: "v1",
            title: "Brachial Plexus Made Simple (C5-T1)",
            videoUrl: "https://www.youtube.com/watch?v=0k5qjW2g-J8",
            duration: "16:30",
            summary: "Remember: 'Robert Taylor Drinks Cold Beer' (Roots, Trunks, Divisions, Cords, Branches).",
          },
        ],
        notes: [
          {
            id: "n1",
            title: "Brachial Plexus Lesions & Clinical Deficits",
            content: "Erb-Duchenne Palsy (Upper trunk injury C5-C6):\n- Mechanism: Traction during birth or shoulder trauma\n- Position: Waiter's tip deformity (adducted arm, medially rotated, extended elbow)\n\nKlumpke Palsy (Lower trunk injury C8-T1):\n- Mechanism: Sudden upward jerk of arm\n- Presentation: Claw hand (loss of intrinsic hand muscles)",
            keyPoints: [
              "Axillary nerve innervates deltoid and teres minor",
              "Radial nerve injury causes wrist drop",
              "Median nerve passes through the carpal tunnel",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Nursing Exams",
    subtitle: "Nursing Hub",
    category: "MBBS & Nursing",
    imageUrl: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80",
    description: "Comprehensive NCLEX, NMCN, and General Nursing past questions, OSCE procedures, pharmacology dosage calculations, and critical care patient management.",
    featured: true,
    order: 3,
    status: "active",
    modules: [
      {
        id: "m1",
        title: "Module 1: Medication Dosage Calculations & IV Rates",
        description: "Pediatric formulas, drip rates, and safe administration protocols.",
        videos: [
          {
            id: "v1",
            title: "IV Flow Rate & Drop Factor Calculations",
            videoUrl: "https://www.youtube.com/watch?v=P_sE9W7z3dM",
            duration: "12:15",
            summary: "Formula: (Total Volume in mL * Drop Factor) / (Time in minutes) = drops/min.",
          },
        ],
        notes: [
          {
            id: "n1",
            title: "The 10 Rights of Drug Administration",
            content: "1. Right Patient\n2. Right Medication\n3. Right Dose\n4. Right Route\n5. Right Time\n6. Right Documentation\n7. Right Reason\n8. Right Response\n9. Right to Refuse\n10. Right Patient Education",
            keyPoints: [
              "Always check medication 3 times before administering",
              "Verify patient with two identifiers (Name and DOB/Hospital ID)",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Optometry",
    subtitle: "Professional courses",
    category: "Professional Courses",
    imageUrl: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=800&q=80",
    description: "Clinical refraction, ophthalmic optics, binocular vision, retinal pathology, and contact lens fitting for OD university students and interns.",
    featured: true,
    order: 4,
    status: "active",
    modules: [
      {
        id: "m1",
        title: "Module 1: Geometric Optics & Refraction",
        description: "Snell's law, spherical lenses, astigmatic correction, and cross cylinders.",
        videos: [
          {
            id: "v1",
            title: "Jackson Cross Cylinder Technique Explained",
            videoUrl: "https://www.youtube.com/watch?v=kYv9d7eF6Bw",
            duration: "15:40",
            summary: "Refining cylinder axis and power in subjective refraction.",
          },
        ],
        notes: [
          {
            id: "n1",
            title: "Transposition of Ophthalmic Prescriptions",
            content: "Converting plus cylinder to minus cylinder format:\n1. Algebraic sum of sphere and cylinder gives the new sphere.\n2. Change the sign of the cylinder.\n3. Rotate the axis by 90 degrees.",
            keyPoints: [
              "+2.00 / +1.00 x 90 transposed becomes +3.00 / -1.00 x 180",
              "Prentice Rule for induced prism: P = c * F (where c is decentration in cm)",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Law",
    subtitle: "Professional courses",
    category: "Professional Courses",
    imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
    description: "Constitutional law, Law of Contract, Torts, Criminal Code, Evidence Law, and Nigerian Legal System case digests for LLB students and Law School Bar finalists.",
    featured: true,
    order: 5,
    status: "active",
    modules: [
      {
        id: "m1",
        title: "Module 1: Law of Contract Essentials",
        description: "Offer, acceptance, consideration, intention to create legal relations, and privity.",
        videos: [
          {
            id: "v1",
            title: "Offer vs Invitation to Treat (Leading Cases)",
            videoUrl: "https://www.youtube.com/watch?v=F3vX8y7G_fA",
            duration: "19:00",
            summary: "Carlill v Carbolic Smoke Ball Co, Fisher v Bell, and Pharmaceutical Society v Boots.",
          },
        ],
        notes: [
          {
            id: "n1",
            title: "Elements of a Valid Contract",
            content: "1. Offer: A clear, unequivocal statement of terms by the offeror.\n2. Acceptance: Absolute and unqualified assent to the terms of the offer.\n3. Consideration: The price for which the promise of the other is bought (Currie v Misa).\n4. Intention to create legal relations (Balfour v Balfour vs Merritt v Merritt).\n5. Capacity to contract.",
            keyPoints: [
              "Postal Rule applies only to acceptance (Adams v Lindsell)",
              "Past consideration is no consideration (Roscorla v Thomas)",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Accounting",
    subtitle: "Professional courses",
    category: "Professional Courses",
    imageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
    description: "Financial accounting standards (IFRS), corporate reporting, cost accounting, auditing, and tax computations for ICAN, ACCA, and university undergraduates.",
    featured: true,
    order: 6,
    status: "active",
    modules: [
      {
        id: "m1",
        title: "Module 1: Double Entry & Balance Sheet Reconciliations",
        description: "Trial balance adjustments, depreciation methods, and bank reconciliation statements.",
        videos: [
          {
            id: "v1",
            title: "Bank Reconciliation Statement Step-by-Step",
            videoUrl: "https://www.youtube.com/watch?v=8qW1t5hZ7kA",
            duration: "17:15",
            summary: "Uncredited lodgements, unpresented cheques, standing orders, and bank charges.",
          },
        ],
        notes: [
          {
            id: "n1",
            title: "Accounting Concepts & Principles",
            content: "1. Going Concern: Entity will continue operating for the foreseeable future.\n2. Accrual Basis: Transactions are recognized when they occur, not when cash is received.\n3. Prudence: Do not overestimate revenue or underestimate liabilities.\n4. Consistency: Same accounting policies applied across periods.",
            keyPoints: [
              "Accounting Equation: Assets = Capital + Liabilities",
              "Depreciation is an allocation of cost, not a valuation process",
            ],
          },
        ],
      },
    ],
  },
];

export async function getSubjectHubs(featuredOnly = false, category?: string) {
  const db = getFirestore();
  let query: FirebaseFirestore.Query = db.collection("subjectHubs");

  if (featuredOnly) {
    query = query.where("featured", "==", true);
  }

  const snap = await query.get();

  if (snap.empty) {
    // Seed defaults if collection doesn't exist yet
    await seedDefaultSubjectHubs();
    return DEFAULT_SUBJECT_HUBS.map((s, idx) => ({
      id: `default-${idx + 1}`,
      ...s,
    }));
  }

  let list = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // Filter out drafts for student view
  list = list.filter((s: any) => s.status !== "draft");

  if (category && category !== "All") {
    list = list.filter((s: any) => s.category?.toLowerCase() === category.toLowerCase());
  }

  list.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99));
  return list;
}

export async function getSubjectHubById(id: string) {
  const db = getFirestore();
  const doc = await db.collection("subjectHubs").doc(id).get();
  if (!doc.exists) {
    // Check in defaults
    const def = DEFAULT_SUBJECT_HUBS.find(
      (d, i) => `default-${i + 1}` === id || d.title.toLowerCase() === id.toLowerCase()
    );
    if (def) return { id, ...def };
    return null;
  }
  return { id: doc.id, ...(doc.data() as any) };
}

export async function seedDefaultSubjectHubs() {
  const db = getFirestore();
  const batch = db.batch();
  const col = db.collection("subjectHubs");

  for (const item of DEFAULT_SUBJECT_HUBS) {
    const docRef = col.doc();
    batch.set(docRef, {
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
}
