import { Questionnaire, Answer, UserWeight, ScoringResult } from './context/QuestionnaireContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function createDecision(questionnaire: Questionnaire): Promise<number> {
  const response = await fetch(`${API_URL}/decisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: questionnaire.title || 'Untitled Decision',
      data: questionnaire,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create decision');
  }

  const result = await response.json();
  return result.decision_id;
}

export async function getDecision(decisionId: number): Promise<Questionnaire> {
  const response = await fetch(`${API_URL}/decisions/${decisionId}`);
  if (!response.ok) {
    throw new Error('Failed to load decision');
  }
  const result = await response.json();
  return result.data as Questionnaire;
}

export interface SubmitResult {
  session_id: number;
  result: ScoringResult;
}

export async function submitAnswers(
  decisionId: number, 
  answers: Answer[], 
  weights: UserWeight[]
): Promise<SubmitResult> {
  const response = await fetch(`${API_URL}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      decision_id: decisionId,
      answers: answers,
      weights: weights,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit answers');
  }

  return response.json();
}
