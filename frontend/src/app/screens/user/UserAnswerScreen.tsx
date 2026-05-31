import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, CheckCircle2, SlidersHorizontal, ChevronRight } from 'lucide-react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import {
  useQuestionnaire,
  computeScores,
  getTotalAnswered,
  getTotalQuestions,
  Question,
  Answer,
} from '../../context/QuestionnaireContext';
import { UserStepDots } from './UserWeightScreen';
import { submitAnswers } from '../../api';

// ─── Multiple-choice question ──────────────────────────────────────────────
function MultiChoiceQuestion({
  question, answer, options, onSelect,
}: {
  question: Question;
  answer: Answer | undefined;
  options: { id: string; name: string; color: string }[];
  onSelect: (choiceId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {question.choices.map(choice => {
        const selected = answer?.value === choice.id;
        // Show score preview for selected choice
        return (
          <motion.button
            key={choice.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(choice.id)}
            className="w-full rounded-xl border-2 text-left transition-all overflow-hidden"
            style={selected
              ? { borderColor: '#6366F1', background: '#EEF2FF' }
              : { borderColor: '#E5E7EB', background: '#FAFAFA' }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={selected ? { borderColor: '#6366F1', background: '#6366F1' } : { borderColor: '#D1D5DB' }}>
                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span style={{ flex: 1, fontSize: '13px', fontWeight: selected ? 600 : 400, color: selected ? '#1E1B4B' : '#6B7280' }}>
                {choice.label}
              </span>
              {selected && <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
            </div>


          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Slider question ─────────────────────────────────────────────────────────
function SliderQuestion({
  question, answer, options, onValueChange,
}: {
  question: Question;
  answer: Answer | undefined;
  options: { id: string; name: string; color: string }[];
  onValueChange: (value: number) => void;
}) {
  const mapping = question.sliderMapping;
  const currentValue = typeof answer?.value === 'number' ? answer.value : (answer?.value ? parseFloat(answer.value as string) : null);
  const [localValue, setLocalValue] = useState<number>(currentValue ?? 5);
  const [hasInteracted, setHasInteracted] = useState(currentValue !== null);

  const leftOpt = mapping ? options.find(o => o.id === mapping.leftOptionId) : null;
  const rightOpt = mapping ? options.find(o => o.id === mapping.rightOptionId) : null;
  const leftColor = leftOpt?.color ?? '#6366F1';
  const rightColor = rightOpt?.color ?? '#F59E0B';

  const handleChange = useCallback((vals: number[]) => {
    const v = vals[0];
    setLocalValue(v);
    setHasInteracted(true);
    onValueChange(v);
  }, [onValueChange]);

  if (!mapping) return null;

  return (
    <div className="space-y-4">
      {/* Endpoint labels */}
      <div className="flex gap-3 justify-between">
        <span style={{ fontSize: '11px', fontWeight: 600, color: leftColor, flex: 1 }}>
          ← {mapping.leftLabel}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: rightColor, flex: 1, textAlign: 'right' }}>
          {mapping.rightLabel} →
        </span>
      </div>

      {/* Gradient track + Radix slider */}
      <div className="relative pt-1">
        <div className="absolute inset-x-0 top-3.5 h-2 rounded-full overflow-hidden pointer-events-none"
          style={{ background: `linear-gradient(90deg, ${leftColor}, ${rightColor})`, opacity: 0.25 }} />
        <SliderPrimitive.Root
          value={[localValue]}
          onValueChange={handleChange}
          min={1} max={10} step={0.5}
          className="relative flex items-center w-full h-5 cursor-pointer select-none"
        >
          <SliderPrimitive.Track className="relative h-2 flex-grow rounded-full overflow-hidden"
            style={{ background: `linear-gradient(90deg, ${leftColor}40, ${rightColor}40)` }}>
            <SliderPrimitive.Range className="absolute h-full" style={{
              background: `linear-gradient(90deg, ${leftColor}, ${rightColor})`
            }} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className="block w-6 h-6 rounded-full bg-white shadow-lg outline-none cursor-grab active:cursor-grabbing border-2 transition-transform active:scale-110"
            style={{ borderColor: localValue < 5.5 ? leftColor : rightColor }}
          />
        </SliderPrimitive.Root>

        {/* Tick marks */}
        <div className="flex justify-between mt-1.5 px-0.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
            <span key={v} style={{ fontSize: '9px', color: '#D1D5DB' }}>{v}</span>
          ))}
        </div>
      </div>

      {/* Answered confirmation — no scores shown */}
      {hasInteracted ? (
        <div className="text-center py-2 rounded-xl bg-gray-50">
          <p className="text-gray-400" style={{ fontSize: '12px' }}>
            ✓ Answered — position {localValue.toFixed(1)}
          </p>
        </div>
      ) : (
        <div className="text-center py-3 rounded-xl bg-gray-50">
          <SlidersHorizontal className="w-4 h-4 text-gray-300 mx-auto mb-1" />
          <p className="text-gray-400" style={{ fontSize: '12px' }}>Drag the slider to answer</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export function UserAnswerScreen() {
  const { questionnaire, userSession, setAnswer, nextUserStep, prevUserStep, decisionId, setScoringResult } = useQuestionnaire();
  const [expandedCat, setExpandedCat] = useState<string | null>(questionnaire.categories[0]?.id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalQ = getTotalQuestions(questionnaire);
  const answered = getTotalAnswered(questionnaire, userSession);
  const allDone = answered === totalQ && totalQ > 0;
  const progress = totalQ > 0 ? answered / totalQ : 0;

  const handleMCAnswer = useCallback((questionId: string, choiceId: string) => {
    setAnswer({ questionId, value: choiceId });
  }, [setAnswer]);

  const handleSliderAnswer = useCallback((questionId: string, value: number) => {
    setAnswer({ questionId, value });
  }, [setAnswer]);

  const handleSubmit = async () => {
    if (decisionId) {
      setIsSubmitting(true);
      try {
        const res = await submitAnswers(decisionId, userSession.answers, userSession.weights);
        setScoringResult(res.result);
        nextUserStep();
      } catch (err) {
        console.error(err);
        alert('Failed to calculate results. Please check your connection.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Fallback: compute scores locally (demo mode or backend unavailable)
      const localResult = computeScores(questionnaire, userSession);
      setScoringResult(localResult);
      nextUserStep();
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevUserStep}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <UserStepDots current={2} />
        </div>
        <h2 style={{ fontWeight: 700, fontSize: '18px', color: '#1E1B4B' }}>Answer Questions</h2>
        <p className="text-gray-400 mt-0.5" style={{ fontSize: '12px' }}>
          One answer per question → scores all options simultaneously
        </p>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between mb-1.5">
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6366F1' }}>
              {answered} / {totalQ} answered
            </span>
            {allDone && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="text-green-500 flex items-center gap-1"
                style={{ fontSize: '12px', fontWeight: 700 }}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete!
              </motion.span>
            )}
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ background: allDone ? '#10B981' : 'linear-gradient(90deg, #6366F1, #8B5CF6)' }}
            />
          </div>
        </div>
      </div>

      {/* Categories + Questions */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {questionnaire.categories.map(category => {
          const catAnswered = category.questions.filter(q =>
            userSession.answers.some(a => a.questionId === q.id)
          ).length;
          const catDone = catAnswered === category.questions.length && category.questions.length > 0;
          const isOpen = expandedCat === category.id;
          const catWeight = userSession.weights.find(w => w.categoryId === category.id)?.weight ?? 0;

          return (
            <div key={category.id} className="rounded-2xl overflow-hidden border-2 transition-all"
              style={{ borderColor: isOpen ? category.color + '60' : '#F3F4F6' }}>
              {/* Category header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                style={{ background: isOpen ? category.color + '08' : 'white' }}
                onClick={() => setExpandedCat(isOpen ? null : category.id)}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: category.color + '20' }}>
                  {category.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1E1B4B' }}>{category.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-white"
                      style={{ fontSize: '10px', fontWeight: 600, background: category.color }}>
                      {Math.round(catWeight)}% weight
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      {catAnswered}/{category.questions.length} answered
                    </span>
                    {catDone && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  </div>
                </div>
                <motion.div animate={{ rotate: isOpen ? 90 : 0 }}>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </motion.div>
              </button>

              {/* Questions */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-5">
                      {category.questions.map((q, qIdx) => {
                        const existing = userSession.answers.find(a => a.questionId === q.id);
                        const isAnswered = !!existing;

                        return (
                          <motion.div key={q.id}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: qIdx * 0.06 }}>
                            {/* Q header */}
                            <div className="flex items-start gap-2 mb-3">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 mt-0.5 text-white"
                                style={{ fontSize: '10px', fontWeight: 700, background: isAnswered ? '#10B981' : category.color }}>
                                {isAnswered ? '✓' : qIdx + 1}
                              </span>
                              <div className="flex-1">
                                <p style={{ fontSize: '13px', fontWeight: 600, color: '#1E1B4B', lineHeight: 1.4 }}>
                                  {q.text}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  {q.type === 'slider' ? (
                                    <span className="flex items-center gap-1 text-indigo-500"
                                      style={{ fontSize: '10px', fontWeight: 600 }}>
                                      <SlidersHorizontal className="w-2.5 h-2.5" /> Slider 1–10
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-amber-500"
                                      style={{ fontSize: '10px', fontWeight: 600 }}>
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Multiple choice
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Question input */}
                            <div className="ml-7">
                              {q.type === 'multiple_choice' ? (
                                <MultiChoiceQuestion
                                  question={q}
                                  answer={existing}
                                  options={questionnaire.options}
                                  onSelect={choiceId => handleMCAnswer(q.id, choiceId)}
                                />
                              ) : (
                                <SliderQuestion
                                  question={q}
                                  answer={existing}
                                  options={questionnaire.options}
                                  onValueChange={value => handleSliderAnswer(q.id, value)}
                                />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        <div className="h-2" />
      </div>

      {/* CTA */}
      <div className="px-5 pb-8 pt-4 border-t border-gray-100">
        {!allDone && totalQ > 0 && (
          <p className="text-center text-gray-400 mb-3" style={{ fontSize: '12px' }}>
            {totalQ - answered} question{totalQ - answered !== 1 ? 's' : ''} remaining
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={!allDone || isSubmitting}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: (allDone && !isSubmitting) ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#E5E7EB',
            color: (allDone && !isSubmitting) ? 'white' : '#9CA3AF',
            boxShadow: (allDone && !isSubmitting) ? '0 8px 24px rgba(99,102,241,0.3)' : 'none',
          }}>
          <span style={{ fontWeight: 700 }}>
            {isSubmitting ? 'Computing...' : allDone ? '🏆 See My Results' : `Answer all ${totalQ} questions first`}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
