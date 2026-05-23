import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getDecision } from '../api';

export type QuestionType = 'multiple_choice' | 'slider';
export type AppMode = 'home' | 'creator' | 'user';
export type WeightMode = 'pie' | 'sliders';

// ─── Core Types ────────────────────────────────────────────────────────────

/** Each answer choice maps scores to SPECIFIC options */
export interface Choice {
  id: string;
  label: string;
  optionScores: Record<string, number>; // optionId → score (0–10)
}

/** Slider endpoints: linear interpolation between two options */
export interface SliderMapping {
  leftOptionId: string;   // option that scores 10 at value=1, 0 at value=10
  rightOptionId: string;  // option that scores 0 at value=1, 10 at value=10
  leftLabel: string;      // e.g. "Strongly favors iPhone"
  rightLabel: string;     // e.g. "Strongly favors Galaxy"
}

export interface Question {
  id: string;
  categoryId: string;
  text: string;
  type: QuestionType;
  choices: Choice[];             // used for multiple_choice
  sliderMapping?: SliderMapping; // used for slider
}

export interface Category {
  id: string; name: string; color: string; icon: string; questions: Question[];
}

export interface QOption {
  id: string; name: string; color: string; initials: string;
}

export interface UserWeight { categoryId: string; weight: number; }

export interface Questionnaire {
  title: string;
  description: string;
  purpose: string;
  options: QOption[];
  categories: Category[];
  defaultWeights: UserWeight[]; // creator-set suggested weights
}

/** One answer per question — value is choiceId (MC) or number 1–10 (slider) */
export interface Answer {
  questionId: string;
  value: string | number;
}

export interface UserSession {
  weights: UserWeight[];
  weightMode: WeightMode;
  answers: Answer[];
}

export const OPTION_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
export const CAT_COLORS    = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#8B5CF6', '#EF4444'];
export const CAT_ICONS     = ['💼','💰','🏥','📈','⚖️','🎯','🌟','🔬','👥','🌍','🎨','🧠','📷','🔋','💅'];

// ─── Scoring logic ─────────────────────────────────────────────────────────

/** Linear interpolation: value 1→ left=10/right=0,  value 10→ left=0/right=10 */
export function getSliderScores(mapping: SliderMapping, value: number): Record<string, number> {
  const t = (value - 1) / 9;          // 0..1
  const leftScore  = parseFloat(((1 - t) * 10).toFixed(2));
  const rightScore = parseFloat((t * 10).toFixed(2));
  const result: Record<string, number> = {};
  result[mapping.leftOptionId]  = leftScore;
  if (mapping.rightOptionId !== mapping.leftOptionId) {
    result[mapping.rightOptionId] = rightScore;
  }
  return result;
}

export function getQuestionOptionScores(question: Question, answer: Answer): Record<string, number> {
  if (question.type === 'multiple_choice') {
    const choice = question.choices.find(c => c.id === answer.value);
    return choice?.optionScores ?? {};
  }
  const val = typeof answer.value === 'number' ? answer.value : parseFloat(answer.value as string);
  return question.sliderMapping ? getSliderScores(question.sliderMapping, val) : {};
}

// ─── Score result types ─────────────────────────────────────────────────────

export interface CategoryContribution {
  categoryId: string; name: string; color: string; icon: string;
  weight: number; avgScore: number; weightedScore: number; shareOfTotal: number;
}

export interface AnswerBreakdown {
  questionId: string; questionText: string; type: QuestionType;
  categoryId: string; categoryName: string; categoryColor: string;
  optionScores: Record<string, number>;  // optionId → raw score this answer gave
  answerLabel: string;                   // human-readable (choice label or "slider → X")
}

export interface OptionScore {
  option: QOption;
  finalScore: number;
  contributions: CategoryContribution[];
  rank: number;
}

export interface ScoringResult {
  scores: OptionScore[];
  answerBreakdowns: AnswerBreakdown[];
}

export function computeScores(q: Questionnaire, session: UserSession): ScoringResult {
  const answerBreakdowns: AnswerBreakdown[] = [];
  for (const cat of q.categories) {
    for (const question of cat.questions) {
      const ans = session.answers.find(a => a.questionId === question.id);
      if (!ans) continue;
      let answerLabel = '';
      if (question.type === 'multiple_choice') {
        const choice = question.choices.find(c => c.id === ans.value);
        answerLabel = choice?.label ?? String(ans.value);
      } else {
        const val = typeof ans.value === 'number' ? ans.value : parseFloat(ans.value as string);
        answerLabel = `Slider → ${val.toFixed(1)}/10`;
      }
      answerBreakdowns.push({
        questionId: question.id,
        questionText: question.text,
        type: question.type,
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        optionScores: getQuestionOptionScores(question, ans),
        answerLabel,
      });
    }
  }

  const rawScores = q.options.map(opt => {
    let totalWeightedScore = 0;
    let totalUsedWeight   = 0;
    const contributions: CategoryContribution[] = [];

    for (const cat of q.categories) {
      const uw     = session.weights.find(w => w.categoryId === cat.id);
      const weight = uw?.weight ?? 0;
      if (weight === 0 || cat.questions.length === 0) continue;

      let catTotal  = 0;
      let answered  = 0;
      for (const qItem of cat.questions) {
        const bd = answerBreakdowns.find(a => a.questionId === qItem.id);
        if (bd) { catTotal += bd.optionScores[opt.id] ?? 0; answered++; }
      }
      if (answered === 0) continue;

      const avgScore       = catTotal / answered;
      const weightedScore  = (weight / 100) * avgScore;
      totalWeightedScore  += weightedScore;
      totalUsedWeight     += weight;
      contributions.push({
        categoryId: cat.id, name: cat.name, color: cat.color, icon: cat.icon,
        weight, avgScore, weightedScore, shareOfTotal: 0,
      });
    }

    const finalScore = totalUsedWeight > 0 ? (totalWeightedScore / (totalUsedWeight / 100)) : 0;
    contributions.forEach(c => {
      c.shareOfTotal = totalWeightedScore > 0 ? (c.weightedScore / totalWeightedScore) * 100 : 0;
    });
    return { option: opt, finalScore, contributions, rank: 0 };
  });

  rawScores.sort((a, b) => b.finalScore - a.finalScore);
  rawScores.forEach((s, i) => { s.rank = i + 1; });
  return { scores: rawScores, answerBreakdowns };
}

export function getTotalAnswered(q: Questionnaire, session: UserSession): number {
  const allQIds = q.categories.flatMap(c => c.questions.map(qi => qi.id));
  return session.answers.filter(a => allQIds.includes(a.questionId)).length;
}

export function getTotalQuestions(q: Questionnaire): number {
  return q.categories.reduce((s, c) => s + c.questions.length, 0);
}

// ─── Demo Questionnaire ────────────────────────────────────────────────────

const DEMO: Questionnaire = {
  title: 'Best Smartphone 2024',
  description: 'Comparing the top flagship phones of the year',
  purpose: 'Find YOUR perfect phone — set what matters most and let the scores decide.',
  options: [
    { id: 'o1', name: 'iPhone 15 Pro',     color: '#6366F1', initials: 'IP' },
    { id: 'o2', name: 'Galaxy S24 Ultra',  color: '#F59E0B', initials: 'GS' },
    { id: 'o3', name: 'Pixel 8 Pro',       color: '#10B981', initials: 'PX' },
  ],
  categories: [
    {
      id: 'c1', name: 'Performance', color: '#6366F1', icon: '⚡', questions: [
        {
          id: 'q1', categoryId: 'c1', text: 'Daily usage pattern', type: 'multiple_choice',
          choices: [
            { id: 'q1c1', label: 'Heavy gaming & multitasking',   optionScores: { o1: 10, o2: 9, o3: 7 } },
            { id: 'q1c2', label: 'Mixed work, media & social',    optionScores: { o1: 7,  o2: 8, o3: 9 } },
            { id: 'q1c3', label: 'Mostly casual & social media',  optionScores: { o1: 6,  o2: 7, o3: 8 } },
          ],
        },
        {
          id: 'q2', categoryId: 'c1', text: 'Processing priority: raw speed vs AI smarts?',
          type: 'slider', choices: [],
          sliderMapping: {
            leftOptionId: 'o1', leftLabel: '← Raw Speed  (A17 Bionic)',
            rightOptionId: 'o3', rightLabel: 'AI Efficiency  (Tensor) →',
          },
        },
      ],
    },
    {
      id: 'c2', name: 'Camera', color: '#EC4899', icon: '📷', questions: [
        {
          id: 'q3', categoryId: 'c2', text: 'Primary photography use case', type: 'multiple_choice',
          choices: [
            { id: 'q3c1', label: 'Professional zoom & detail',   optionScores: { o1: 8,  o2: 10, o3: 9 } },
            { id: 'q3c2', label: 'Natural, true-to-life colors', optionScores: { o1: 10, o2: 7,  o3: 9 } },
            { id: 'q3c3', label: 'Social media & short video',   optionScores: { o1: 9,  o2: 9,  o3: 8 } },
          ],
        },
        {
          id: 'q4', categoryId: 'c2', text: 'Camera processing style preference?',
          type: 'slider', choices: [],
          sliderMapping: {
            leftOptionId: 'o1', leftLabel: '← Natural / True-to-life  (iPhone)',
            rightOptionId: 'o2', rightLabel: 'Processed / Punchy  (Galaxy) →',
          },
        },
      ],
    },
    {
      id: 'c3', name: 'Battery Life', color: '#10B981', icon: '🔋', questions: [
        {
          id: 'q5', categoryId: 'c3', text: 'Battery usage priority', type: 'multiple_choice',
          choices: [
            { id: 'q5c1', label: '2-day endurance is a must',     optionScores: { o1: 4,  o2: 10, o3: 8 } },
            { id: 'q5c2', label: 'All-day battery is enough',     optionScores: { o1: 8,  o2: 8,  o3: 7 } },
            { id: 'q5c3', label: 'Fast wireless charging is key', optionScores: { o1: 10, o2: 7,  o3: 5 } },
          ],
        },
        {
          id: 'q6', categoryId: 'c3', text: 'Wired speed vs wireless convenience?',
          type: 'slider', choices: [],
          sliderMapping: {
            leftOptionId: 'o2', leftLabel: '← Fast wired  (45W Galaxy)',
            rightOptionId: 'o1', rightLabel: 'Wireless ecosystem  (MagSafe) →',
          },
        },
      ],
    },
    {
      id: 'c4', name: 'Value', color: '#F59E0B', icon: '💰', questions: [
        {
          id: 'q7', categoryId: 'c4', text: 'Budget mindset', type: 'multiple_choice',
          choices: [
            { id: 'q7c1', label: 'Best phone regardless of cost', optionScores: { o1: 10, o2: 9, o3: 7 } },
            { id: 'q7c2', label: 'Best value for the dollar',     optionScores: { o1: 5,  o2: 6, o3: 10 } },
            { id: 'q7c3', label: 'Good deal on a flagship',       optionScores: { o1: 6,  o2: 7, o3: 9 } },
          ],
        },
        {
          id: 'q8', categoryId: 'c4', text: 'Open value vs premium ecosystem?',
          type: 'slider', choices: [],
          sliderMapping: {
            leftOptionId: 'o3', leftLabel: '← Best price  (Pixel)',
            rightOptionId: 'o1', rightLabel: 'Apple ecosystem  (iPhone) →',
          },
        },
      ],
    },
    {
      id: 'c5', name: 'Design', color: '#8B5CF6', icon: '💎', questions: [
        {
          id: 'q9', categoryId: 'c5', text: 'Form factor preference', type: 'multiple_choice',
          choices: [
            { id: 'q9c1', label: 'Compact, premium titanium',         optionScores: { o1: 10, o2: 7,  o3: 8 } },
            { id: 'q9c2', label: 'Large screen + S Pen productivity', optionScores: { o1: 5,  o2: 10, o3: 6 } },
            { id: 'q9c3', label: 'Clean minimalist aesthetics',       optionScores: { o1: 9,  o2: 7,  o3: 10 } },
          ],
        },
      ],
    },
  ],
  defaultWeights: [
    { categoryId: 'c1', weight: 20 },
    { categoryId: 'c2', weight: 20 },
    { categoryId: 'c3', weight: 20 },
    { categoryId: 'c4', weight: 20 },
    { categoryId: 'c5', weight: 20 },
  ],
};

const DEMO_ANSWERS: Answer[] = [
  { questionId: 'q1', value: 'q1c2' },
  { questionId: 'q2', value: 6 },
  { questionId: 'q3', value: 'q3c2' },
  { questionId: 'q4', value: 3 },
  { questionId: 'q5', value: 'q5c2' },
  { questionId: 'q6', value: 4 },
  { questionId: 'q7', value: 'q7c2' },
  { questionId: 'q8', value: 7 },
  { questionId: 'q9', value: 'q9c3' },
];

// ─── Context ───────────────────────────────────────────────────────────────

interface QCtx {
  mode: AppMode;
  creatorStep: number;
  userStep: number;
  isEditingWeights: boolean;
  questionnaire: Questionnaire;
  userSession: UserSession;
  setMode: (m: AppMode) => void;
  setCreatorStep: (s: number) => void;
  setUserStep: (s: number) => void;
  nextCreatorStep: () => void;
  prevCreatorStep: () => void;
  nextUserStep: () => void;
  prevUserStep: () => void;
  updateQuestionnaire: (u: Partial<Questionnaire>) => void;
  addOption: (o: QOption) => void;
  removeOption: (id: string) => void;
  addCategory: (c: Category) => void;
  removeCategory: (id: string) => void;
  updateCategory: (id: string, u: Partial<Category>) => void;
  addQuestion: (catId: string, q: Question) => void;
  removeQuestion: (catId: string, qId: string) => void;
  setWeights: (ws: UserWeight[]) => void;
  setWeightMode: (m: WeightMode) => void;
  setAnswer: (a: Answer) => void;
  setDefaultWeights: (ws: UserWeight[]) => void;
  startUserFlow: (withDemo?: boolean) => void;
  goEditWeights: () => void;
  resetAll: () => void;
  decisionId: number | null;
  setDecisionId: (id: number | null) => void;
  isLoading: boolean;
  error: string | null;
  scoringResult: ScoringResult | null;
  setScoringResult: (r: ScoringResult | null) => void;
  loadDecision: (id: number) => Promise<void>;
}

const initialQuestionnaire: Questionnaire = {
  title: '', description: '', purpose: '',
  options: [], categories: [], defaultWeights: [],
};
const initialSession: UserSession = { weights: [], weightMode: 'pie', answers: [] };

const Ctx = createContext<QCtx | undefined>(undefined);

function equalWeights(cats: Category[]): UserWeight[] {
  const n = cats.length;
  if (n === 0) return [];
  const base = Math.floor(100 / n);
  const rem  = 100 - base * n;
  return cats.map((c, i) => ({ categoryId: c.id, weight: base + (i === 0 ? rem : 0) }));
}

export function QuestionnaireProvider({ children }: { children: ReactNode }) {
  const [mode,             setMode]             = useState<AppMode>('home');
  const [creatorStep,      setCreatorStep]      = useState(0);
  const [userStep,         setUserStep]         = useState(0);
  const [isEditingWeights, setIsEditingWeights] = useState(false);
  const [questionnaire,    setQuestionnaire]    = useState<Questionnaire>(initialQuestionnaire);
  const [userSession,      setUserSession]      = useState<UserSession>(initialSession);
  const [decisionId,       setDecisionId]       = useState<number | null>(null);
  const [isLoading,        setIsLoading]        = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [scoringResult,    setScoringResult]    = useState<ScoringResult | null>(null);

  const loadDecision = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const q = await getDecision(id);
      setQuestionnaire(q);
      setDecisionId(id);
    } catch (err: any) {
      setError(err.message || 'Failed to load decision');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const nextCreatorStep = useCallback(() => setCreatorStep(s => Math.min(s + 1, 4)), []);
  const prevCreatorStep = useCallback(() => setCreatorStep(s => Math.max(s - 1, 0)), []);
  const nextUserStep    = useCallback(() => {
    if (isEditingWeights) { setIsEditingWeights(false); setUserStep(3); return; }
    setUserStep(s => Math.min(s + 1, 3));
  }, [isEditingWeights]);
  const prevUserStep = useCallback(() => setUserStep(s => Math.max(s - 1, 0)), []);

  const updateQuestionnaire = useCallback((u: Partial<Questionnaire>) =>
    setQuestionnaire(prev => ({ ...prev, ...u })), []);

  const addOption    = useCallback((o: QOption) =>
    setQuestionnaire(prev => ({ ...prev, options: [...prev.options, o] })), []);
  const removeOption = useCallback((id: string) =>
    setQuestionnaire(prev => ({ ...prev, options: prev.options.filter(o => o.id !== id) })), []);

  const addCategory    = useCallback((c: Category) =>
    setQuestionnaire(prev => ({ ...prev, categories: [...prev.categories, c] })), []);
  const removeCategory = useCallback((id: string) =>
    setQuestionnaire(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) })), []);
  const updateCategory = useCallback((id: string, u: Partial<Category>) =>
    setQuestionnaire(prev => ({
      ...prev, categories: prev.categories.map(c => c.id === id ? { ...c, ...u } : c),
    })), []);

  const addQuestion    = useCallback((catId: string, q: Question) =>
    setQuestionnaire(prev => ({
      ...prev, categories: prev.categories.map(c =>
        c.id === catId ? { ...c, questions: [...c.questions, q] } : c),
    })), []);
  const removeQuestion = useCallback((catId: string, qId: string) =>
    setQuestionnaire(prev => ({
      ...prev, categories: prev.categories.map(c =>
        c.id === catId ? { ...c, questions: c.questions.filter(q => q.id !== qId) } : c),
    })), []);

  const setWeights    = useCallback((ws: UserWeight[]) =>
    setUserSession(prev => ({ ...prev, weights: ws })), []);
  const setWeightMode = useCallback((m: WeightMode) =>
    setUserSession(prev => ({ ...prev, weightMode: m })), []);
  const setAnswer     = useCallback((a: Answer) =>
    setUserSession(prev => ({
      ...prev,
      answers: [
        ...prev.answers.filter(x => x.questionId !== a.questionId),
        a,
      ],
    })), []);

  const setDefaultWeights = useCallback((ws: UserWeight[]) =>
    setQuestionnaire(prev => ({ ...prev, defaultWeights: ws })), []);

  const startUserFlow = useCallback((withDemo = false) => {
    const q = withDemo ? DEMO : questionnaire;
    if (withDemo) setQuestionnaire(DEMO);
    // Use creator's suggested weights if available, else equal
    const hasDefaults =
      !withDemo &&
      q.defaultWeights.length > 0 &&
      q.categories.every(c => q.defaultWeights.some(w => w.categoryId === c.id));
    const weights: UserWeight[] = hasDefaults ? q.defaultWeights : equalWeights(q.categories);
    const answers: Answer[] = withDemo ? DEMO_ANSWERS : [];
    setUserSession({ weights, weightMode: 'pie', answers });
    setUserStep(withDemo ? 1 : 0);
    setMode('user');
  }, [questionnaire]);

  const goEditWeights = useCallback(() => {
    setIsEditingWeights(true);
    setUserStep(1);
  }, []);

  const resetAll = useCallback(() => {
    setMode('home');
    setCreatorStep(0);
    setUserStep(0);
    setIsEditingWeights(false);
    setQuestionnaire(initialQuestionnaire);
    setUserSession(initialSession);
    setDecisionId(null);
    setScoringResult(null);
    setError(null);
  }, []);

  return (
    <Ctx.Provider value={{
      mode, creatorStep, userStep, isEditingWeights, questionnaire, userSession,
      setMode, setCreatorStep, setUserStep,
      nextCreatorStep, prevCreatorStep, nextUserStep, prevUserStep,
      updateQuestionnaire, addOption, removeOption,
      addCategory, removeCategory, updateCategory,
      addQuestion, removeQuestion,
      setWeights, setWeightMode, setAnswer,
      setDefaultWeights,
      startUserFlow, goEditWeights, resetAll,
      decisionId, setDecisionId,
      isLoading, error,
      scoringResult, setScoringResult,
      loadDecision,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useQuestionnaire() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useQuestionnaire must be used within QuestionnaireProvider');
  return ctx;
}
