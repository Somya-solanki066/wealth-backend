export type JambSubjectId =
  | "mathematics"
  | "english"
  | "physics"
  | "chemistry"
  | "biology"
  | "economics"
  | "government";

export type JambOptionKey = "A" | "B" | "C" | "D";

export type JambQuestion = {
  id: string;
  subject: JambSubjectId;
  questionNumber: number;
  questionText: string;
  options: Record<JambOptionKey, string>;
  correctAnswer: JambOptionKey;
  topic: string;
  examYear: number;
};

export const JAMB_SUBJECTS: {
  id: JambSubjectId;
  label: string;
  durationMinutes: number;
  questionCount: number;
}[] = [
  { id: "mathematics", label: "Mathematics", durationMinutes: 60, questionCount: 40 },
  { id: "english", label: "English", durationMinutes: 60, questionCount: 40 },
  { id: "physics", label: "Physics", durationMinutes: 60, questionCount: 40 },
  { id: "chemistry", label: "Chemistry", durationMinutes: 60, questionCount: 40 },
  { id: "biology", label: "Biology", durationMinutes: 60, questionCount: 40 },
  { id: "economics", label: "Economics", durationMinutes: 60, questionCount: 40 },
  { id: "government", label: "Government", durationMinutes: 60, questionCount: 40 },
];

function q(
  subject: JambSubjectId,
  n: number,
  text: string,
  options: Record<JambOptionKey, string>,
  correct: JambOptionKey,
  topic: string,
  year: number
): JambQuestion {
  return {
    id: `${subject}-${n}`,
    subject,
    questionNumber: n,
    questionText: text,
    options,
    correctAnswer: correct,
    topic,
    examYear: year,
  };
}

function buildSubjectSet(
  subject: JambSubjectId,
  starters: JambQuestion[],
  template: (n: number) => JambQuestion,
  count = 40
): JambQuestion[] {
  const items = [...starters];
  for (let n = starters.length + 1; n <= count; n += 1) {
    items.push(template(n));
  }
  return items;
}

const MATH_STARTERS: JambQuestion[] = [
  q("mathematics", 1, "If 3x - 7 = 2x + 5, find the value of x.", { A: "x = 8", B: "x = 12", C: "x = 5", D: "x = -2" }, "B", "Algebra", 2023),
  q("mathematics", 2, "Simplify: (2³ × 2⁴) ÷ 2²", { A: "32", B: "64", C: "128", D: "16" }, "A", "Indices", 2022),
  q("mathematics", 3, "Find the HCF of 48 and 72.", { A: "12", B: "24", C: "8", D: "16" }, "B", "Number theory", 2021),
  q("mathematics", 4, "If sin θ = 3/5 and θ is acute, find cos θ.", { A: "4/5", B: "3/4", C: "5/4", D: "2/5" }, "A", "Trigonometry", 2023),
  q("mathematics", 5, "The sum of the interior angles of a regular pentagon is:", { A: "360°", B: "540°", C: "720°", D: "900°" }, "B", "Geometry", 2020),
  q("mathematics", 6, "Evaluate: log₁₀ 1000 + log₁₀ 10", { A: "3", B: "4", C: "5", D: "6" }, "B", "Logarithms", 2022),
  q("mathematics", 7, "If y varies directly as x and y = 12 when x = 4, find y when x = 10.", { A: "20", B: "30", C: "24", D: "40" }, "B", "Variation", 2023),
  q("mathematics", 8, "Find the gradient of the line 2y - 4x = 8.", { A: "2", B: "4", C: "-2", D: "1/2" }, "A", "Coordinate geometry", 2021),
  q("mathematics", 9, "A bag contains 5 red and 3 blue balls. One ball is drawn at random. Probability of red is:", { A: "3/8", B: "5/8", C: "1/2", D: "3/5" }, "B", "Probability", 2022),
  q("mathematics", 10, "Solve: x² - 5x + 6 = 0", { A: "x = 2, 3", B: "x = -2, -3", C: "x = 1, 6", D: "x = -1, 6" }, "A", "Quadratic equations", 2023),
  q("mathematics", 11, "Convert 0.375 to a fraction in lowest terms.", { A: "3/8", B: "37/100", C: "3/7", D: "5/12" }, "A", "Fractions", 2020),
  q("mathematics", 12, "Find the area of a circle of radius 7 cm. (Take π = 22/7)", { A: "154 cm²", B: "44 cm²", C: "308 cm²", D: "77 cm²" }, "A", "Mensuration", 2022),
  q("mathematics", 13, "If 2^(x+1) = 16, find x.", { A: "2", B: "3", C: "4", D: "5" }, "B", "Indices", 2021),
  q("mathematics", 14, "The nth term of the sequence 3, 7, 11, 15, ... is:", { A: "4n - 1", B: "4n + 1", C: "3n + 1", D: "4n - 3" }, "A", "Sequences", 2023),
  q("mathematics", 15, "Factorise completely: x² - 9", { A: "(x - 3)²", B: "(x + 3)(x - 3)", C: "(x - 9)(x + 1)", D: "x(x - 9)" }, "B", "Algebra", 2020),
  q("mathematics", 16, "A trader bought an item for ₦4,500 and sold it at 20% profit. Selling price is:", { A: "₦5,000", B: "₦5,400", C: "₦5,200", D: "₦4,800" }, "B", "Commercial math", 2022),
  q("mathematics", 17, "Find the median of: 4, 7, 2, 9, 5, 7, 3", { A: "5", B: "7", C: "4", D: "6" }, "A", "Statistics", 2021),
  q("mathematics", 18, "If tan 45° = 1, then sin 45° =", { A: "1/2", B: "√2/2", C: "√3/2", D: "1" }, "B", "Trigonometry", 2023),
  q("mathematics", 19, "Solve the inequality: 2x - 3 < 7", { A: "x < 5", B: "x > 5", C: "x ≤ 5", D: "x ≥ 5" }, "A", "Inequalities", 2020),
  q("mathematics", 20, "The distance between points (1, 2) and (4, 6) is:", { A: "5", B: "4", C: "6", D: "7" }, "A", "Coordinate geometry", 2022),
];

const ENGLISH_STARTERS: JambQuestion[] = [
  q("english", 1, 'Choose the word nearest in meaning to "ABSTAIN".', { A: "Refuse", B: "Accept", C: "Delay", D: "Argue" }, "A", "Lexis", 2023),
  q("english", 2, 'Select the option that best completes: "Neither the teacher nor the students ___ present."', { A: "was", B: "were", C: "is", D: "has been" }, "B", "Grammar", 2022),
  q("english", 3, 'Identify the figure of speech: "The classroom was a furnace."', { A: "Simile", B: "Metaphor", C: "Personification", D: "Irony" }, "B", "Literature", 2021),
  q("english", 4, "Choose the correct spelling.", { A: "Accomodation", B: "Accommodation", C: "Acommodation", D: "Accomadation" }, "B", "Spelling", 2023),
  q("english", 5, 'Select the antonym of "FRUGAL".', { A: "Thrifty", B: "Wasteful", C: "Careful", D: "Modest" }, "B", "Lexis", 2020),
];

const PHYSICS_STARTERS: JambQuestion[] = [
  q("physics", 1, "The SI unit of force is:", { A: "Joule", B: "Newton", C: "Watt", D: "Pascal" }, "B", "Mechanics", 2023),
  q("physics", 2, "A body moving with constant velocity has acceleration equal to:", { A: "9.8 m/s²", B: "0", C: "1 m/s²", D: "g" }, "B", "Motion", 2022),
  q("physics", 3, "The image formed by a plane mirror is:", { A: "Real and inverted", B: "Virtual and erect", C: "Real and erect", D: "Virtual and inverted" }, "B", "Optics", 2021),
  q("physics", 4, "Ohm's law states that V =", { A: "IR", B: "I/R", C: "R/I", D: "I + R" }, "A", "Electricity", 2023),
  q("physics", 5, "Heat energy required to raise 1 kg of water by 1°C is called:", { A: "Latent heat", B: "Specific heat capacity", C: "Heat flux", D: "Thermal conductivity" }, "B", "Heat", 2020),
];

const CHEMISTRY_STARTERS: JambQuestion[] = [
  q("chemistry", 1, "The atomic number of an element is equal to the number of:", { A: "Neutrons", B: "Protons", C: "Electrons in ion", D: "Nucleons only" }, "B", "Atomic structure", 2023),
  q("chemistry", 2, "The pH of a neutral solution at 25°C is:", { A: "0", B: "7", C: "14", D: "1" }, "B", "Acids & bases", 2022),
  q("chemistry", 3, "Which gas is produced when metals react with dilute acids?", { A: "Oxygen", B: "Hydrogen", C: "Nitrogen", D: "Chlorine" }, "B", "Reactions", 2021),
  q("chemistry", 4, "Avogadro's number is approximately:", { A: "6.02 × 10²³", B: "3.0 × 10⁸", C: "9.8", D: "1.6 × 10⁻¹⁹" }, "A", "Mole concept", 2023),
  q("chemistry", 5, "The valency of oxygen in water (H₂O) is:", { A: "1", B: "2", C: "3", D: "4" }, "B", "Valency", 2020),
];

const BIOLOGY_STARTERS: JambQuestion[] = [
  q("biology", 1, "The basic unit of life is the:", { A: "Tissue", B: "Cell", C: "Organ", D: "Organism" }, "B", "Cell biology", 2023),
  q("biology", 2, "Photosynthesis occurs mainly in the:", { A: "Roots", B: "Chloroplast", C: "Mitochondria", D: "Nucleus" }, "B", "Plant physiology", 2022),
  q("biology", 3, "The human heart has how many chambers?", { A: "2", B: "3", C: "4", D: "5" }, "C", "Human biology", 2021),
  q("biology", 4, "Mendel's unit of inheritance is called a:", { A: "Chromosome", B: "Gene", C: "Nucleotide", D: "Protein" }, "B", "Genetics", 2023),
  q("biology", 5, "Which blood group is the universal donor?", { A: "A", B: "B", C: "AB", D: "O" }, "D", "Human biology", 2020),
];

const ECONOMICS_STARTERS: JambQuestion[] = [
  q("economics", 1, "Scarcity in economics means:", { A: "Poverty only", B: "Limited resources vs unlimited wants", C: "Low GDP", D: "High inflation" }, "B", "Basic concepts", 2023),
  q("economics", 2, "The law of demand states that, ceteris paribus:", { A: "Price ↑ demand ↑", B: "Price ↑ demand ↓", C: "Income ↑ demand ↓", D: "Supply ↑ price ↑" }, "B", "Demand", 2022),
  q("economics", 3, "GDP stands for:", { A: "Gross Domestic Product", B: "General Domestic Price", C: "Government Development Plan", D: "Gross Demand Product" }, "A", "National income", 2021),
  q("economics", 4, "A progressive tax is one where:", { A: "Everyone pays the same rate", B: "Higher income pays higher rate", C: "Only companies pay", D: "Tax decreases with income" }, "B", "Public finance", 2023),
  q("economics", 5, "Opportunity cost is:", { A: "Money spent", B: "Value of next best forgone alternative", C: "Total cost", D: "Fixed cost" }, "B", "Basic concepts", 2020),
];

const GOVERNMENT_STARTERS: JambQuestion[] = [
  q("government", 1, "Nigeria gained independence in:", { A: "1957", B: "1960", C: "1963", D: "1970" }, "B", "Nigerian history", 2023),
  q("government", 2, "Separation of powers divides government into:", { A: "Two arms", B: "Three arms", C: "Four arms", D: "Five arms" }, "B", "Political theory", 2022),
  q("government", 3, "The upper chamber of Nigeria's National Assembly is the:", { A: "House of Reps", B: "Senate", C: "State Assembly", D: "Council of States" }, "B", "Constitution", 2021),
  q("government", 4, "Universal Adult Suffrage means:", { A: "Only men vote", B: "Qualified adults can vote", C: "Military appoints leaders", D: "Judges elect president" }, "B", "Elections", 2023),
  q("government", 5, "ECOWAS was established primarily to promote:", { A: "Military alliance only", B: "Regional economic integration", C: "Colonial ties", D: "Single currency globally" }, "B", "International relations", 2020),
];

export const JAMB_QUESTION_BANK: JambQuestion[] = [
  ...buildSubjectSet("mathematics", MATH_STARTERS, (n) => {
    const a = n * 2;
    const b = n + 5;
    return q(
      "mathematics",
      n,
      `If ${a}x + ${n} = ${a * b}, find x.`,
      { A: `x = ${b - 1}`, B: `x = ${b}`, C: `x = ${b + 1}`, D: `x = ${n}` },
      "B",
      "Algebra",
      2019 + (n % 5)
    );
  }),
  ...buildSubjectSet("english", ENGLISH_STARTERS, (n) =>
    q(
      "english",
      n,
      `Choose the option that best completes: "She has been studying hard ___ she wants to pass JAMB."`,
      { A: "because", B: "although", C: "unless", D: "until" },
      "A",
      "Grammar",
      2018 + (n % 6)
    )
  ),
  ...buildSubjectSet("physics", PHYSICS_STARTERS, (n) =>
    q(
      "physics",
      n,
      `A car accelerates uniformly from rest to ${n + 10} m/s in ${n} seconds. Its acceleration is approximately:`,
      { A: `${((n + 10) / n).toFixed(1)} m/s²`, B: `${n} m/s²`, C: `${n + 10} m/s²`, D: "1 m/s²" },
      "A",
      "Motion",
      2018 + (n % 6)
    )
  ),
  ...buildSubjectSet("chemistry", CHEMISTRY_STARTERS, (n) =>
    q(
      "chemistry",
      n,
      `How many moles are in ${n * 2} g of a substance with molar mass ${n} g/mol?`,
      { A: `${n}`, B: "2", C: `${n * 2}`, D: `${n / 2}` },
      "B",
      "Mole concept",
      2018 + (n % 6)
    )
  ),
  ...buildSubjectSet("biology", BIOLOGY_STARTERS, (n) =>
    q(
      "biology",
      n,
      `Which organelle is responsible for energy production in eukaryotic cells? (Past item ${n})`,
      { A: "Ribosome", B: "Mitochondrion", C: "Golgi body", D: "Lysosome" },
      "B",
      "Cell biology",
      2018 + (n % 6)
    )
  ),
  ...buildSubjectSet("economics", ECONOMICS_STARTERS, (n) =>
    q(
      "economics",
      n,
      `Which is a feature of a monopoly market? (Past item ${n})`,
      { A: "Many sellers", B: "Single seller", C: "Perfect information", D: "Homogeneous products only" },
      "B",
      "Market structures",
      2018 + (n % 6)
    )
  ),
  ...buildSubjectSet("government", GOVERNMENT_STARTERS, (n) =>
    q(
      "government",
      n,
      `Fundamental human rights are enshrined in the Nigerian Constitution under Chapter IV (ref ${n}).`,
      { A: "II", B: "IV", C: "VI", D: "VIII" },
      "B",
      "Constitution",
      2018 + (n % 6)
    )
  ),
];

export function getJambQuestions(subject: JambSubjectId): JambQuestion[] {
  return JAMB_QUESTION_BANK.filter((item) => item.subject === subject).sort(
    (a, b) => a.questionNumber - b.questionNumber
  );
}

export function getJambSubjectMeta(subject: JambSubjectId) {
  return JAMB_SUBJECTS.find((s) => s.id === subject);
}

export function stripAnswer(qn: JambQuestion) {
  const { correctAnswer, ...rest } = qn;
  void correctAnswer;
  return rest;
}
