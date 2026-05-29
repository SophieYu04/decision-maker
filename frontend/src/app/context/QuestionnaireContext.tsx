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
  leftOptionId: string;    // option that scores 10 at value=1, 0 at value=10
  rightOptionId: string;   // option that scores 0 at value=1, 10 at value=10
  leftLabel: string;       // e.g. "Strongly favors iPhone"
  rightLabel: string;      // e.g. "Strongly favors Galaxy"
  // Optional third option that peaks in the middle (inverted-V curve)
  middleOptionId?: string;
  middleRange?: [number, number]; // e.g. [4, 6] — the value range where middle peaks
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

/** Linear interpolation: value 1→ left=10/right=0,  value 10→ left=0/right=10
 *  If middleOptionId + middleRange are set, the middle option scores with
 *  an inverted-V curve: peaks at 10 at the centre of middleRange, falls to 0
 *  at the slider extremes (value=1 or value=10).
 */
export function getSliderScores(mapping: SliderMapping, value: number): Record<string, number> {
  const t = (value - 1) / 9;          // 0..1
  const leftScore  = parseFloat(((1 - t) * 10).toFixed(2));
  const rightScore = parseFloat((t * 10).toFixed(2));
  const result: Record<string, number> = {};
  result[mapping.leftOptionId]  = leftScore;
  if (mapping.rightOptionId !== mapping.leftOptionId) {
    result[mapping.rightOptionId] = rightScore;
  }
  if (mapping.middleOptionId && mapping.middleRange) {
    const [lo, hi] = mapping.middleRange;   // e.g. [4, 6] on a 1–10 scale
    const mid      = (lo + hi) / 2;
    const maxDist  = Math.max(mid - 1, 10 - mid);
    const dist     = Math.abs(value - mid);
    const middleScore = parseFloat((Math.max(0, (1 - dist / maxDist) * 10)).toFixed(2));
    result[mapping.middleOptionId] = middleScore;
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
  title: '2026 台灣政黨傾向問卷',
  description: '回答問題，設定你在乎的政策權重，找出最接近你理念的政黨',
  purpose: '根據你的政策偏好，客觀計算出最符合你理念的台灣政黨。',
  options: [
    { id: 'tpp', name: '民眾黨', color: '#06B6D4', initials: '眾' },
    { id: 'dpp', name: '民進黨', color: '#10B981', initials: '進' },
    { id: 'kmt', name: '國民黨', color: '#6366F1', initials: '國' },
  ],
  categories: [
    {
      id: 'cross_strait_security', name: '兩岸／國家安全', color: '#2563eb', icon: '🛡️',
      questions: [
        {
          id: 'q1', categoryId: 'cross_strait_security', text: '你認為台灣目前最重要的兩岸策略應該是？', type: 'multiple_choice',
          choices: [
            { id: 'q1_a', label: '維持對等務實交流', optionScores: { tpp: 5 } },
            { id: 'q1_b', label: '強化民主同盟與國際合作', optionScores: { dpp: 5 } },
            { id: 'q1_c', label: '恢復九二共識與深化交流', optionScores: { kmt: 5 } },
          ],
        },
        {
          id: 'q2', categoryId: 'cross_strait_security', text: '你是否支持增加兩岸民間交流？', type: 'multiple_choice',
          choices: [
            { id: 'q2_a', label: '應大幅開放陸客與陸生', optionScores: { kmt: 5 } },
            { id: 'q2_b', label: '可逐步恢復交流', optionScores: { tpp: 5 } },
            { id: 'q2_c', label: '應謹慎控管', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q3', categoryId: 'cross_strait_security', text: '面對中國威脅，台灣應優先？', type: 'multiple_choice',
          choices: [
            { id: 'q3_a', label: '提升國際聯盟與嚇阻能力', optionScores: { dpp: 5 } },
            { id: 'q3_b', label: '降低衝突風險與增加對話', optionScores: { kmt: 5 } },
            { id: 'q3_c', label: '備戰但維持溝通', optionScores: { tpp: 5 } },
          ],
        },
      ],
    },
    {
      id: 'defense_diplomacy', name: '國防／外交', color: '#7c3aed', icon: '🌐',
      questions: [
        {
          id: 'q4', categoryId: 'defense_diplomacy', text: '對於國防預算，你的看法是？', type: 'multiple_choice',
          choices: [
            { id: 'q4_a', label: '支持提升至 GDP 3% 左右', optionScores: { tpp: 5 } },
            { id: 'q4_b', label: '支持提升軍力但避免刺激衝突', optionScores: { kmt: 5 } },
            { id: 'q4_c', label: '支持強化國防與供應鏈安全', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q5', categoryId: 'defense_diplomacy', text: '台灣外交應該偏向？', type: 'multiple_choice',
          choices: [
            { id: 'q5_a', label: '以經貿與和平為優先', optionScores: { kmt: 5 } },
            { id: 'q5_b', label: '民主國家合作聯盟', optionScores: { dpp: 5 } },
            { id: 'q5_c', label: '務實多邊平衡外交', optionScores: { tpp: 5 } },
          ],
        },
        {
          id: 'q6', categoryId: 'defense_diplomacy', text: '你認為台灣應該優先加入哪些國際合作？', type: 'multiple_choice',
          choices: [
            { id: 'q6_a', label: '多邊區域合作', optionScores: { tpp: 5 } },
            { id: 'q6_b', label: '以經貿整合為優先', optionScores: { kmt: 5 } },
            { id: 'q6_c', label: '民主與印太聯盟', optionScores: { dpp: 5 } },
          ],
        },
      ],
    },
    {
      id: 'energy_environment', name: '能源／環境', color: '#16a34a', icon: '🌿',
      questions: [
        {
          id: 'q7', categoryId: 'energy_environment', text: '你認為核能應該？', type: 'multiple_choice',
          choices: [
            { id: 'q7_a', label: '逐步減少依賴', optionScores: { dpp: 5 } },
            { id: 'q7_b', label: '延役並重新啟用核電', optionScores: { kmt: 5 } },
            { id: 'q7_c', label: '作為過渡能源', optionScores: { tpp: 5 } },
          ],
        },
        {
          id: 'q8', categoryId: 'energy_environment', text: '政府應如何推動淨零轉型？', type: 'multiple_choice',
          choices: [
            { id: 'q8_a', label: '核能與低碳並行', optionScores: { kmt: 5 } },
            { id: 'q8_b', label: '碳定價與能源多元化', optionScores: { tpp: 5 } },
            { id: 'q8_c', label: '綠能與產業轉型', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q9', categoryId: 'energy_environment', text: '你是否支持碳費／碳定價？', type: 'multiple_choice',
          choices: [
            { id: 'q9_a', label: '支持但應平衡產業負擔', optionScores: { tpp: 5 } },
            { id: 'q9_b', label: '強烈支持', optionScores: { dpp: 5 } },
            { id: 'q9_c', label: '不應增加企業負擔', optionScores: { kmt: 5 } },
          ],
        },
        {
          id: 'q10', categoryId: 'energy_environment', text: '台灣能源政策應優先考量？', type: 'multiple_choice',
          choices: [
            { id: 'q10_a', label: '電價與供電安全', optionScores: { kmt: 5 } },
            { id: 'q10_b', label: '減碳與綠能發展', optionScores: { dpp: 5 } },
            { id: 'q10_c', label: '能源穩定與多元配置', optionScores: { tpp: 5 } },
          ],
        },
      ],
    },
    {
      id: 'housing_justice', name: '居住正義', color: '#ea580c', icon: '🏠',
      questions: [
        {
          id: 'q11', categoryId: 'housing_justice', text: '你認為解決高房價最有效的方法是？', type: 'multiple_choice',
          choices: [
            { id: 'q11_a', label: '青年低利貸款', optionScores: { kmt: 5 } },
            { id: 'q11_b', label: '稅制改革與社宅並行', optionScores: { tpp: 5 } },
            { id: 'q11_c', label: '社宅與租金補貼', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q12', categoryId: 'housing_justice', text: '政府住宅政策應優先？', type: 'multiple_choice',
          choices: [
            { id: 'q12_a', label: '擴大租屋保障', optionScores: { dpp: 5 } },
            { id: 'q12_b', label: '協助青年買房', optionScores: { kmt: 5 } },
            { id: 'q12_c', label: '提供多元居住補助', optionScores: { tpp: 5 } },
          ],
        },
      ],
    },
    {
      id: 'education', name: '教育', color: '#0891b2', icon: '📚',
      questions: [
        {
          id: 'q13', categoryId: 'education', text: '教育改革應優先推動？', type: 'multiple_choice',
          choices: [
            { id: 'q13_a', label: 'AI 與雙語教育', optionScores: { tpp: 5 } },
            { id: 'q13_b', label: '檢討 108 課綱與教育補助', optionScores: { kmt: 5 } },
            { id: 'q13_c', label: '高教國際化與技職', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q14', categoryId: 'education', text: '你是否支持延長義務教育？', type: 'multiple_choice',
          choices: [
            { id: 'q14_a', label: '應先改善現行制度', optionScores: { kmt: 5 } },
            { id: 'q14_b', label: '支持 13 年一貫教育', optionScores: { tpp: 5 } },
            { id: 'q14_c', label: '應提升教育品質為主', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q15', categoryId: 'education', text: '政府應如何提升學生競爭力？', type: 'multiple_choice',
          choices: [
            { id: 'q15_a', label: '強化國際化與創新能力', optionScores: { dpp: 5 } },
            { id: 'q15_b', label: '增加教育資源與補助', optionScores: { kmt: 5 } },
            { id: 'q15_c', label: '導入 AI 與智慧教育', optionScores: { tpp: 5 } },
          ],
        },
      ],
    },
    {
      id: 'welfare_health_aging', name: '社會福利／醫療／高齡化', color: '#dc2626', icon: '❤️',
      questions: [
        {
          id: 'q16', categoryId: 'welfare_health_aging', text: '少子化政策應優先？', type: 'multiple_choice',
          choices: [
            { id: 'q16_a', label: '提高生育與育兒補助', optionScores: { tpp: 5 } },
            { id: 'q16_b', label: '擴大公共托育', optionScores: { dpp: 5 } },
            { id: 'q16_c', label: '提供家庭購屋支持', optionScores: { kmt: 5 } },
          ],
        },
        {
          id: 'q17', categoryId: 'welfare_health_aging', text: '你認為長照政策應該？', type: 'multiple_choice',
          choices: [
            { id: 'q17_a', label: '針對高齡者直接補助', optionScores: { kmt: 5 } },
            { id: 'q17_b', label: '成立專責保險制度', optionScores: { tpp: 5 } },
            { id: 'q17_c', label: '擴大社會照護網', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q18', categoryId: 'welfare_health_aging', text: '健保與醫療政策應優先？', type: 'multiple_choice',
          choices: [
            { id: 'q18_a', label: '提升醫療支出與市場彈性', optionScores: { tpp: 5 } },
            { id: 'q18_b', label: '增加老人福利與癌症補助', optionScores: { kmt: 5 } },
            { id: 'q18_c', label: '強化醫護環境與健保永續', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q19', categoryId: 'welfare_health_aging', text: '政府應如何改善高齡社會問題？', type: 'multiple_choice',
          choices: [
            { id: 'q19_a', label: '強化照護與社福系統', optionScores: { dpp: 5 } },
            { id: 'q19_b', label: '發展高齡經濟產業', optionScores: { tpp: 5 } },
            { id: 'q19_c', label: '增加長者補助與福利', optionScores: { kmt: 5 } },
          ],
        },
      ],
    },
    {
      id: 'economy_labor_tech', name: '經濟／勞工／科技', color: '#4f46e5', icon: '💻',
      questions: [
        {
          id: 'q20', categoryId: 'economy_labor_tech', text: '政府應如何促進經濟發展？', type: 'multiple_choice',
          choices: [
            { id: 'q20_a', label: '減稅鼓勵企業投資', optionScores: { kmt: 5 } },
            { id: 'q20_b', label: '發展高科技與數位轉型', optionScores: { dpp: 5 } },
            { id: 'q20_c', label: '鬆綁法規刺激產業', optionScores: { tpp: 5 } },
          ],
        },
        {
          id: 'q21', categoryId: 'economy_labor_tech', text: '你認為勞工政策應偏向？', type: 'multiple_choice',
          choices: [
            { id: 'q21_a', label: '強化勞權與最低工資', optionScores: { dpp: 5 } },
            { id: 'q21_b', label: '增加薪資誘因與休假', optionScores: { kmt: 5 } },
            { id: 'q21_c', label: '平衡勞資與產業活化', optionScores: { tpp: 5 } },
          ],
        },
        {
          id: 'q22', categoryId: 'economy_labor_tech', text: 'AI 與科技政策應該？', type: 'multiple_choice',
          choices: [
            { id: 'q22_a', label: '發展戰略 AI 產業', optionScores: { kmt: 5 } },
            { id: 'q22_b', label: '建立智慧城市與 AI 校園', optionScores: { tpp: 5 } },
            { id: 'q22_c', label: '推動 AI 產業化', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q23', categoryId: 'economy_labor_tech', text: '你認為政府應如何協助企業？', type: 'multiple_choice',
          choices: [
            { id: 'q23_a', label: '鬆綁法規與活化市場', optionScores: { tpp: 5 } },
            { id: 'q23_b', label: '提供減稅與投資誘因', optionScores: { kmt: 5 } },
            { id: 'q23_c', label: '協助產業轉型', optionScores: { dpp: 5 } },
          ],
        },
      ],
    },
    {
      id: 'diversity_culture_ethnicity', name: '多元／文化／族群', color: '#db2777', icon: '👥',
      questions: [
        {
          id: 'q24', categoryId: 'diversity_culture_ethnicity', text: '政府應如何推動性別與多元政策？', type: 'multiple_choice',
          choices: [
            { id: 'q24_a', label: '著重族群制度保障', optionScores: { kmt: 5 } },
            { id: 'q24_b', label: '強化性平與同志權益', optionScores: { dpp: 5 } },
            { id: 'q24_c', label: '去標籤化與多元共融', optionScores: { tpp: 5 } },
          ],
        },
        {
          id: 'q25', categoryId: 'diversity_culture_ethnicity', text: '文化政策應優先？', type: 'multiple_choice',
          choices: [
            { id: 'q25_a', label: '推動世代共融文化', optionScores: { tpp: 5 } },
            { id: 'q25_b', label: '補助青年與地方藝文', optionScores: { kmt: 5 } },
            { id: 'q25_c', label: '發展台灣文化產業', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q26', categoryId: 'diversity_culture_ethnicity', text: '政府應如何推動族群政策？', type: 'multiple_choice',
          choices: [
            { id: 'q26_a', label: '建立多元共榮社會', optionScores: { dpp: 5 } },
            { id: 'q26_b', label: '強化原民與客家制度保障', optionScores: { kmt: 5 } },
            { id: 'q26_c', label: '推動族群平等與正名', optionScores: { tpp: 5 } },
          ],
        },
      ],
    },
    {
      id: 'governance_security_local', name: '政府治理／治安／地方治理', color: '#64748b', icon: '🏛️',
      questions: [
        {
          id: 'q27', categoryId: 'governance_security_local', text: '你認為政府應優先改善？', type: 'multiple_choice',
          choices: [
            { id: 'q27_a', label: '政治制度改革與監督', optionScores: { tpp: 5 } },
            { id: 'q27_b', label: '打詐與掃黑犯罪', optionScores: { kmt: 5 } },
            { id: 'q27_c', label: '社會安全網與制度透明', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q28', categoryId: 'governance_security_local', text: '你支持哪種政府治理方向？', type: 'multiple_choice',
          choices: [
            { id: 'q28_a', label: '強化執法與行政效率', optionScores: { kmt: 5 } },
            { id: 'q28_b', label: '公開透明與公民參與', optionScores: { dpp: 5 } },
            { id: 'q28_c', label: '憲政改革與權力制衡', optionScores: { tpp: 5 } },
          ],
        },
        {
          id: 'q29', categoryId: 'governance_security_local', text: '你認為地方治理應優先？', type: 'multiple_choice',
          choices: [
            { id: 'q29_a', label: '地方財政自主', optionScores: { tpp: 5 } },
            { id: 'q29_b', label: '區域均衡與地方創生', optionScores: { dpp: 5 } },
            { id: 'q29_c', label: '中央整合與資源分配', optionScores: { kmt: 5 } },
          ],
        },
      ],
    },
    {
      id: 'core_values', name: '核心價值總結', color: '#111827', icon: '🚩',
      questions: [
        {
          id: 'q30', categoryId: 'core_values', text: '你認為台灣未來最重要的核心價值是？', type: 'multiple_choice',
          choices: [
            { id: 'q30_a', label: '穩定和平與經濟發展', optionScores: { kmt: 5 } },
            { id: 'q30_b', label: '務實治理與制度改革', optionScores: { tpp: 5 } },
            { id: 'q30_c', label: '民主與國際連結', optionScores: { dpp: 5 } },
          ],
        },
        {
          id: 'q34', categoryId: 'core_values',
          text: '當外部環境不穩定時，你認為政府最應該優先保護什麼？',
          type: 'slider', choices: [],
          sliderMapping: {
            leftOptionId:   'dpp',
            rightOptionId:  'kmt',
            leftLabel:  '優先降低長期風險，即使短期內部分產業、交流或成本會受到影響。',
            rightLabel: '優先維持日常生活、產業活動與市場信心，避免讓社會承受過多變動。',
            middleOptionId: 'tpp',
            middleRange:    [4, 6] as [number, number],
          },
        },
        {
          id: 'q35', categoryId: 'core_values',
          text: '面對重要公共決策時，你認為政府應該如何在「現實利益」與「長期原則」之間取捨？',
          type: 'slider', choices: [],
          sliderMapping: {
            leftOptionId:   'tpp',
            rightOptionId:  'dpp',
            leftLabel:  '優先用成效、資料與可執行性判斷，不讓單一立場綁住政策選擇。',
            rightLabel: '即使短期利益受影響，也應維持清楚的長期方向，並尋求理念相近者合作。',
            middleOptionId: 'kmt',
            middleRange:    [4, 6] as [number, number],
          },
        },
        {
          id: 'q36', categoryId: 'core_values',
          text: '如果政府長期做事效率不佳，你認為最根本的問題通常在哪裡？',
          type: 'slider', choices: [],
          sliderMapping: {
            leftOptionId:   'kmt',
            rightOptionId:  'tpp',
            leftLabel:  '問題多半來自執行不夠確實，應強化行政效率、資源分配與政策落實。',
            rightLabel: '問題多半來自制度設計不良，應重新檢討規則、監督機制與權力配置。',
            middleOptionId: 'dpp',
            middleRange:    [4, 6] as [number, number],
          },
        },
      ],
    },
  ],
  defaultWeights: [
    { categoryId: 'cross_strait_security', weight: 10 },
    { categoryId: 'defense_diplomacy', weight: 10 },
    { categoryId: 'energy_environment', weight: 10 },
    { categoryId: 'housing_justice', weight: 10 },
    { categoryId: 'education', weight: 10 },
    { categoryId: 'welfare_health_aging', weight: 10 },
    { categoryId: 'economy_labor_tech', weight: 10 },
    { categoryId: 'diversity_culture_ethnicity', weight: 10 },
    { categoryId: 'governance_security_local', weight: 10 },
    { categoryId: 'core_values', weight: 10 },
  ],
};

const DEMO_ANSWERS: Answer[] = [];

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
