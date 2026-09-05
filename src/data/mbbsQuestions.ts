import type { MbbsPhaseId, MbbsSubjectId } from "./mbbsCatalog";

export type MbbsOptionKey = "A" | "B" | "C";

export type MbbsScenarioQuestion = {
  id: string;
  phaseId: MbbsPhaseId;
  subjectId: MbbsSubjectId;
  questionNumber: number;
  scenario: string;
  question: string;
  options: Record<MbbsOptionKey, string>;
  correctAnswer: MbbsOptionKey;
  rationale: string;
};

function sq(
  phaseId: MbbsPhaseId,
  subjectId: MbbsSubjectId,
  n: number,
  scenario: string,
  question: string,
  options: Record<MbbsOptionKey, string>,
  correct: MbbsOptionKey,
  rationale: string
): MbbsScenarioQuestion {
  return {
    id: `${phaseId}-${subjectId}-q${n}`,
    phaseId,
    subjectId,
    questionNumber: n,
    scenario,
    question,
    options,
    correctAnswer: correct,
    rationale,
  };
}

const SCENARIO_BANK: Partial<Record<MbbsSubjectId, MbbsScenarioQuestion[]>> = {
  "internal-medicine": [
    sq(
      "clinical",
      "internal-medicine",
      1,
      "A 54-year-old man presents with sudden crushing central chest pain radiating to the left arm, sweating, and nausea. ECG shows ST elevation in leads II, III, and aVF.",
      "What is the most likely diagnosis, and what is the immediate next step in management?",
      {
        A: "Anterior STEMI — start heparin infusion",
        B: "Inferior STEMI — activate cath lab / thrombolysis",
        C: "Unstable angina — start beta-blocker only",
      },
      "B",
      "ST elevation in II, III, aVF indicates inferior STEMI. Immediate reperfusion (PCI or thrombolysis) is indicated."
    ),
    sq(
      "clinical",
      "internal-medicine",
      2,
      "A 32-year-old woman with known sickle cell disease presents with fever, left-sided chest pain, and tachypnoea. SpO₂ is 88% on room air.",
      "What is the most likely complication, and what is the priority management?",
      {
        A: "Acute chest syndrome — oxygen, antibiotics, and exchange transfusion if severe",
        B: "Pulmonary embolism — immediate anticoagulation only",
        C: "Community-acquired pneumonia — discharge with oral amoxicillin",
      },
      "A",
      "Fever + chest pain + hypoxia in HbSS is acute chest syndrome until proven otherwise. Oxygen and urgent treatment are essential."
    ),
    sq(
      "clinical",
      "internal-medicine",
      3,
      "A 60-year-old diabetic man has polyuria, polydipsia, confusion, and a blood glucose of 38 mmol/L. He is dehydrated with Kussmaul breathing.",
      "What is the diagnosis and first-line management?",
      {
        A: "Hyperosmolar hyperglycaemic state — cautious IV fluids and insulin",
        B: "Diabetic ketoacidosis — IV fluids, insulin, and potassium monitoring",
        C: "Hypoglycaemia — give oral glucose immediately",
      },
      "B",
      "Kussmaul breathing with very high glucose suggests DKA. IV fluids, insulin, and careful K⁺ monitoring are first-line."
    ),
  ],
  surgery: [
    sq(
      "clinical",
      "surgery",
      1,
      "A 28-year-old man is brought in after a road traffic accident. He is hypotensive, has distended neck veins, and muffled heart sounds.",
      "What is the most likely diagnosis and immediate management?",
      {
        A: "Tension pneumothorax — needle decompression",
        B: "Cardiac tamponade — urgent pericardiocentesis / thoracotomy",
        C: "Massive haemothorax — chest tube insertion only",
      },
      "B",
      "Beck's triad (hypotension, JVP, muffled heart sounds) suggests tamponade. Urgent decompression is life-saving."
    ),
    sq(
      "clinical",
      "surgery",
      2,
      "A 45-year-old woman presents with sudden severe epigastric pain radiating to the back, vomiting, and tenderness. Amylase is markedly elevated.",
      "What is the most likely diagnosis and initial management priority?",
      {
        A: "Acute pancreatitis — aggressive IV fluids and pain control",
        B: "Perforated peptic ulcer — immediate laparotomy without resuscitation",
        C: "Acute cholecystitis — schedule elective cholecystectomy only",
      },
      "A",
      "Epigastric pain + elevated amylase = acute pancreatitis. Early aggressive fluid resuscitation reduces mortality."
    ),
  ],
  obg: [
    sq(
      "clinical",
      "obg",
      1,
      "A 26-year-old primigravida at 38 weeks has heavy vaginal bleeding, a tense tender uterus, and fetal heart rate of 80 bpm.",
      "What is the most likely diagnosis and immediate action?",
      {
        A: "Placenta praevia — expectant management at home",
        B: "Placental abruption — emergency caesarean section",
        C: "Normal labour — observe for 12 hours",
      },
      "B",
      "Painful bleeding + tense uterus + fetal bradycardia = abruption with fetal compromise. Emergency delivery is required."
    ),
    sq(
      "clinical",
      "obg",
      2,
      "A pregnant woman at 34 weeks has BP 170/110 mmHg, headache, and 3+ proteinuria.",
      "What is the diagnosis and most appropriate immediate management?",
      {
        A: "Gestational hypertension — bed rest only",
        B: "Pre-eclampsia — IV labetalol/hydralazine and magnesium sulphate",
        C: "Chronic hypertension — continue home medication",
      },
      "B",
      "BP ≥140/90 with proteinuria and symptoms = pre-eclampsia. Antihypertensives and MgSO₄ for seizure prophylaxis."
    ),
  ],
  paediatrics: [
    sq(
      "clinical",
      "paediatrics",
      1,
      "A 2-year-old child presents with high fever, neck stiffness, and a non-blanching purpuric rash.",
      "What is the most likely diagnosis and immediate management?",
      {
        A: "Meningococcal sepsis — IV ceftriaxone immediately",
        B: "Viral meningitis — oral paracetamol and discharge",
        C: "Febrile convulsion — no antibiotics needed",
      },
      "A",
      "Fever + meningism + purpuric rash = meningococcal disease until proven otherwise. Immediate IV antibiotics save lives."
    ),
    sq(
      "clinical",
      "paediatrics",
      2,
      "A 6-month-old infant has watery diarrhoea for 3 days, sunken eyes, and poor skin turgor.",
      "What is the dehydration severity and correct management?",
      {
        A: "No dehydration — increase breastfeeding only",
        B: "Some dehydration — ORS in health facility",
        C: "Severe dehydration — IV fluids (Plan C)",
      },
      "C",
      "Sunken eyes and poor skin turgor indicate severe dehydration. IV fluids per WHO Plan C are required."
    ),
  ],
  psychiatry: [
    sq(
      "clinical",
      "psychiatry",
      1,
      "A 22-year-old man is brought in agitated, hearing voices telling him to harm others, and has not slept for 4 days.",
      "What is the priority nursing and medical management?",
      {
        A: "Discharge with outpatient follow-up in 2 weeks",
        B: "Assess risk, ensure safety, and consider rapid tranquillisation if needed",
        C: "Ignore auditory hallucinations and focus on sleep hygiene only",
      },
      "B",
      "Acute psychosis with command hallucinations and risk to others requires urgent risk assessment and safe management."
    ),
  ],
  pathology: [
    sq(
      "para-clinical",
      "pathology",
      1,
      "A biopsy shows disordered cell growth with invasion through the basement membrane and lymphovascular spread.",
      "How do you classify this lesion, and what feature confirms malignancy?",
      {
        A: "Benign hyperplasia — increased cell number only",
        B: "Carcinoma in situ — no invasion required for malignancy",
        C: "Invasive carcinoma — invasion through basement membrane defines malignancy",
      },
      "C",
      "Invasion through the basement membrane is the hallmark distinguishing invasive malignancy from in situ disease."
    ),
    sq(
      "para-clinical",
      "pathology",
      2,
      "A 40-year-old man has Hb 7 g/dL, MCV 68 fL, and microcytic hypochromic red cells on film.",
      "What is the most likely cause in a Nigerian adult male?",
      {
        A: "Iron-deficiency anaemia — investigate for chronic blood loss",
        B: "Vitamin B₁₂ deficiency — give IM hydroxocobalamin",
        C: "Aplastic anaemia — bone marrow transplant immediately",
      },
      "A",
      "Microcytic hypochromic anaemia in an adult male is most commonly iron deficiency — often GI blood loss."
    ),
  ],
  pharmacology: [
    sq(
      "para-clinical",
      "pharmacology",
      1,
      "A patient on warfarin starts co-trimoxazole for a UTI. INR rises to 6.5 with gum bleeding.",
      "What is the drug interaction mechanism and management?",
      {
        A: "Co-trimoxazole inhibits warfarin metabolism — withhold warfarin, consider vitamin K",
        B: "No interaction — continue both drugs",
        C: "Warfarin induces co-trimoxazole clearance — increase warfarin dose",
      },
      "A",
      "Sulphonamides inhibit CYP2C9, raising warfarin levels. Hold warfarin and give vitamin K if bleeding."
    ),
    sq(
      "para-clinical",
      "pharmacology",
      2,
      "A 55-year-old hypertensive patient develops a dry cough after starting an ACE inhibitor.",
      "What is the mechanism and best alternative class?",
      {
        A: "Bradykinin accumulation — switch to ARB",
        B: "Sodium retention — add a thiazide diuretic only",
        C: "Reflex tachycardia — add beta-blocker only",
      },
      "A",
      "ACE inhibitor cough is due to bradykinin accumulation. ARBs are the usual alternative without this side effect."
    ),
  ],
  microbiology: [
    sq(
      "para-clinical",
      "microbiology",
      1,
      "A farmer presents with a painless papule on the hand that ulcerates and forms a black eschar.",
      "What is the most likely organism and first-line treatment?",
      {
        A: "Bacillus anthracis — ciprofloxacin or doxycycline",
        B: "Staphylococcus aureus — flucloxacillin only",
        C: "Plasmodium falciparum — artemether-lumefantrine",
      },
      "A",
      "Cutaneous anthrax presents with painless ulcer and black eschar. Ciprofloxacin or doxycycline is first-line."
    ),
  ],
  "community-medicine": [
    sq(
      "para-clinical",
      "community-medicine",
      1,
      "During a cholera outbreak in a community, several cases present with rice-water stools and severe dehydration.",
      "What is the priority public health intervention?",
      {
        A: "Mass ORS distribution, safe water, and case isolation",
        B: "Routine vaccination against cholera only",
        C: "Antibiotics for all asymptomatic contacts only",
      },
      "A",
      "Cholera outbreak control requires ORS, safe water, sanitation, and case management. Vaccination is supplementary."
    ),
  ],
  anatomy: [
    sq(
      "pre-clinical",
      "anatomy",
      1,
      "A patient cannot dorsiflex the foot or extend the toes after a fracture of the neck of the fibula.",
      "Which nerve is most likely injured, and what clinical sign would you expect?",
      {
        A: "Tibial nerve — loss of plantarflexion",
        B: "Common peroneal nerve — foot drop",
        C: "Femoral nerve — loss of knee extension",
      },
      "B",
      "The common peroneal nerve wraps around the fibular neck and is vulnerable in fibular neck fractures, causing foot drop."
    ),
  ],
  physiology: [
    sq(
      "pre-clinical",
      "physiology",
      1,
      "A patient loses 2 litres of blood rapidly. Heart rate rises to 120 bpm and blood pressure falls to 90/60 mmHg.",
      "Which cardiovascular response is primarily compensating at this stage?",
      {
        A: "Increased sympathetic tone — tachycardia and vasoconstriction",
        B: "Decreased ADH — massive diuresis",
        C: "Bradycardia from vagal stimulation",
      },
      "A",
      "Early hypovolaemia triggers sympathetic activation: tachycardia and peripheral vasoconstriction maintain perfusion."
    ),
  ],
  biochemistry: [
    sq(
      "pre-clinical",
      "biochemistry",
      1,
      "A neonate becomes lethargic and hypoglycaemic after feeds containing galactose. Reducing substances are found in urine.",
      "What enzyme deficiency is most likely?",
      {
        A: "Galactose-1-phosphate uridyltransferase deficiency",
        B: "Phenylalanine hydroxylase deficiency",
        C: "Glucose-6-phosphate dehydrogenase deficiency",
      },
      "A",
      "Galactosaemia presents with hypoglycaemia after galactose-containing feeds. GALT deficiency is classic."
    ),
  ],
  histology: [
    sq(
      "pre-clinical",
      "histology",
      1,
      "A tissue section shows stratified squamous epithelium with keratin on the surface and no blood vessels in the epithelial layer.",
      "Which type of epithelium is this, and where is it typically found?",
      {
        A: "Simple columnar — stomach lining",
        B: "Keratinised stratified squamous — skin epidermis",
        C: "Transitional — renal pelvis",
      },
      "B",
      "Keratinised stratified squamous epithelium with avascular surface layers is characteristic of skin epidermis."
    ),
  ],
};

function genericScenarios(
  phaseId: MbbsPhaseId,
  subjectId: MbbsSubjectId,
  count = 15
): MbbsScenarioQuestion[] {
  const existing = SCENARIO_BANK[subjectId] || [];
  const items = [...existing];
  for (let n = existing.length + 1; n <= count; n += 1) {
    items.push(
      sq(
        phaseId,
        subjectId,
        n,
        `Clinical vignette ${n}: A patient presents with symptoms relevant to ${subjectId.replace(/-/g, " ")}. Examination and investigations are consistent with a common condition seen in Nigerian medical practice.`,
        "What is the most likely diagnosis, and what is the most appropriate next step in management?",
        {
          A: "Assess systematically — take history, examine, and investigate before treating",
          B: "Treat without assessment",
          C: "Discharge without follow-up",
        },
        "A",
        "Systematic assessment before definitive management is the foundation of safe clinical practice."
      )
    );
  }
  return items;
}

export function getMbbsScenarios(
  phaseId: MbbsPhaseId,
  subjectId: MbbsSubjectId
): MbbsScenarioQuestion[] {
  return genericScenarios(phaseId, subjectId, 15);
}

export function stripMbbsAnswer(qn: MbbsScenarioQuestion) {
  const { correctAnswer, rationale, ...rest } = qn;
  void correctAnswer;
  void rationale;
  return rest;
}
