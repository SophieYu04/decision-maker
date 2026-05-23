import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Plus, Trash2, HelpCircle, SlidersHorizontal,
  CheckSquare, ChevronDown, Eye
} from 'lucide-react';
import {
  useQuestionnaire, QuestionType, Choice, SliderMapping,
  getSliderScores,
} from '../../context/QuestionnaireContext';
import { CreatorStepDots } from './CreatorSetupScreen';

// ─── Types ─────────────────────────────────────────────────────────────────
interface NewChoice {
  id: string;
  label: string;
  optionScores: Record<string, number>;
}

interface NewQ {
  text: string;
  type: QuestionType;
  choices: NewChoice[];
  sliderMapping: SliderMapping;
}

function buildEmpty(options: { id: string; name: string }[]): NewQ {
  const defaultScores: Record<string, number> = {};
  options.forEach(o => { defaultScores[o.id] = 5; });
  return {
    text: '',
    type: 'multiple_choice',
    choices: [
      { id: `c_${Date.now()}_0`, label: '', optionScores: { ...defaultScores } },
      { id: `c_${Date.now()}_1`, label: '', optionScores: { ...defaultScores } },
      { id: `c_${Date.now()}_2`, label: '', optionScores: { ...defaultScores } },
    ],
    sliderMapping: {
      leftOptionId:  options[0]?.id ?? '',
      rightOptionId: options[1]?.id ?? options[0]?.id ?? '',
      leftLabel:  options[0] ? `← Strongly favors ${options[0].name}` : '← Left',
      rightLabel: options[1] ? `Strongly favors ${options[1].name} →` : 'Right →',
    },
  };
}

// ─── Score chip ─────────────────────────────────────────────────────────────
function ScoreInput({
  value, color, onChange,
}: { value: number; color: string; onChange: (v: number) => void }) {
  return (
    <input
      type="number" min={0} max={10} step={0.5}
      value={value}
      onChange={e => {
        const v = Math.min(10, Math.max(0, parseFloat(e.target.value) || 0));
        onChange(parseFloat(v.toFixed(1)));
      }}
      className="w-10 text-center rounded-lg border-2 outline-none py-1"
      style={{ fontSize: '12px', fontWeight: 700, color, borderColor: color + '40', background: color + '08' }}
    />
  );
}

// ─── Slider preview panel ────────────────────────────────────────────────────
function SliderPreview({
  mapping,
  options,
}: { mapping: SliderMapping; options: { id: string; name: string; color: string }[] }) {
  const [previewVal, setPreviewVal] = useState(5);
  const scores = getSliderScores(mapping, previewVal);
  const leftOpt  = options.find(o => o.id === mapping.leftOptionId);
  const rightOpt = options.find(o => o.id === mapping.rightOptionId);

  return (
    <div className="bg-gray-50 rounded-xl p-3 mt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Eye className="w-3 h-3 text-gray-400" />
        <span className="text-gray-400" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Live Score Preview
        </span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500" style={{ fontSize: '10px' }}>{mapping.leftLabel || '← Left'}</span>
        <span className="text-gray-500" style={{ fontSize: '10px' }}>{mapping.rightLabel || 'Right →'}</span>
      </div>
      <input
        type="range" min={1} max={10} step={0.5}
        value={previewVal}
        onChange={e => setPreviewVal(parseFloat(e.target.value))}
        className="w-full mb-3 accent-indigo-500"
      />
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const s = scores[opt.id] ?? 0;
          return (
            <div key={opt.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: opt.color + '18' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: opt.color }}>{opt.name.split(' ')[0]}</span>
              <span className="px-1.5 py-0.5 rounded-md text-white"
                style={{ fontSize: '10px', fontWeight: 700, background: opt.color }}>
                {s.toFixed(1)}/10
              </span>
            </div>
          );
        })}
        {options.filter(o => scores[o.id] === undefined || scores[o.id] === 0).filter(o =>
          o.id !== mapping.leftOptionId && o.id !== mapping.rightOptionId
        ).map(opt => (
          <div key={opt.id + '_zero'} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100">
            <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{opt.name.split(' ')[0]}: 0</span>
          </div>
        ))}
      </div>
      <p className="text-gray-400 mt-2" style={{ fontSize: '10px', lineHeight: 1.4 }}>
        Options not assigned to an endpoint score 0. Use MC questions for 3+ option comparisons.
      </p>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export function CreatorQuestionsScreen() {
  const { questionnaire, addQuestion, removeQuestion, nextCreatorStep, prevCreatorStep } = useQuestionnaire();
  const { options, categories } = questionnaire;

  const [activeTab, setActiveTab] = useState(categories[0]?.id ?? '');
  const [showForm, setShowForm] = useState(false);
  const [newQ, setNewQ] = useState<NewQ>(() => buildEmpty(options));
  const [error, setError] = useState('');
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  const activeCategory = categories.find(c => c.id === activeTab);
  const totalQ = categories.reduce((s, c) => s + c.questions.length, 0);

  const openForm = () => {
    setNewQ(buildEmpty(options));
    setShowForm(true);
    setError('');
  };

  const handleSave = () => {
    if (!newQ.text.trim()) { setError('Enter a question text'); return; }
    if (newQ.type === 'multiple_choice') {
      const valid = newQ.choices.filter(c => c.label.trim());
      if (valid.length < 2) { setError('Add at least 2 choices with labels'); return; }
    } else {
      if (!newQ.sliderMapping.leftOptionId || !newQ.sliderMapping.rightOptionId) {
        setError('Select both left and right endpoint options'); return;
      }
      if (newQ.sliderMapping.leftOptionId === newQ.sliderMapping.rightOptionId) {
        setError('Left and right endpoints must be different options'); return;
      }
    }

    const validChoices: Choice[] = newQ.choices
      .filter(c => c.label.trim())
      .map(c => ({ id: c.id, label: c.label, optionScores: { ...c.optionScores } }));

    addQuestion(activeTab, {
      id: `q_${Date.now()}`,
      categoryId: activeTab,
      text: newQ.text.trim(),
      type: newQ.type,
      choices: newQ.type === 'multiple_choice' ? validChoices : [],
      sliderMapping: newQ.type === 'slider' ? { ...newQ.sliderMapping } : undefined,
    });
    setShowForm(false); setError(''); setNewQ(buildEmpty(options));
  };

  const updateChoiceLabel = (idx: number, label: string) => {
    const updated = [...newQ.choices];
    updated[idx] = { ...updated[idx], label };
    setNewQ({ ...newQ, choices: updated });
  };
  const updateChoiceScore = (choiceIdx: number, optId: string, score: number) => {
    const updated = [...newQ.choices];
    updated[choiceIdx] = { ...updated[choiceIdx], optionScores: { ...updated[choiceIdx].optionScores, [optId]: score } };
    setNewQ({ ...newQ, choices: updated });
  };
  const addChoice = () => {
    const defaultScores: Record<string, number> = {};
    options.forEach(o => { defaultScores[o.id] = 5; });
    setNewQ(prev => ({
      ...prev,
      choices: [...prev.choices, { id: `c_${Date.now()}`, label: '', optionScores: defaultScores }],
    }));
  };
  const removeChoice = (idx: number) => {
    setNewQ(prev => ({ ...prev, choices: prev.choices.filter((_, i) => i !== idx) }));
  };
  const updateSliderMapping = (patch: Partial<SliderMapping>) => {
    setNewQ(prev => ({ ...prev, sliderMapping: { ...prev.sliderMapping, ...patch } }));
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-0 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevCreatorStep}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <CreatorStepDots current={4} />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FEE2E2, #FECACA)' }}>
            <HelpCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '18px', color: '#1E1B4B' }}>Add Questions</h2>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>
              Step 4 of 5 · {totalQ} total · answers map to option scores
            </p>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-5 px-5">
          {categories.map(cat => (
            <button key={cat.id}
              onClick={() => { setActiveTab(cat.id); setShowForm(false); setError(''); }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
              style={activeTab === cat.id
                ? { background: cat.color + '20', border: `2px solid ${cat.color}` }
                : { background: '#F3F4F6', border: '2px solid transparent' }}>
              <span className="text-sm">{cat.icon}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: activeTab === cat.id ? cat.color : '#6B7280' }}>
                {cat.name}
              </span>
              <span className="flex items-center justify-center w-5 h-5 rounded-full text-white"
                style={{ fontSize: '10px', fontWeight: 700, background: activeTab === cat.id ? cat.color : '#D1D5DB' }}>
                {cat.questions.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeCategory && (
          <>
            {/* Existing questions */}
            <div className="space-y-3 mb-4">
              <AnimatePresence>
                {activeCategory.questions.map((q, i) => (
                  <motion.div key={q.id}
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-2xl overflow-hidden border border-gray-100">
                    <div className="bg-gray-50 px-4 py-3 flex items-start gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full text-white flex-shrink-0 mt-0.5"
                        style={{ fontSize: '10px', fontWeight: 700, background: activeCategory.color }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1E1B4B', lineHeight: 1.4 }}>{q.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {q.type === 'slider' ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 rounded-full text-indigo-600"
                              style={{ fontSize: '10px', fontWeight: 600 }}>
                              <SlidersHorizontal className="w-2.5 h-2.5" /> Slider
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 rounded-full text-amber-600"
                              style={{ fontSize: '10px', fontWeight: 600 }}>
                              <CheckSquare className="w-2.5 h-2.5" /> {q.choices.length} choices
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expandedQ === q.id ? 'rotate-180' : ''}`} />
                        </button>
                        <button onClick={() => removeQuestion(activeCategory.id, q.id)}
                          className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedQ === q.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                          className="overflow-hidden">
                          <div className="px-4 py-3 border-t border-gray-100">
                            {q.type === 'multiple_choice' ? (
                              <div className="space-y-2">
                                {q.choices.map(choice => (
                                  <div key={choice.id}>
                                    <p className="text-gray-500 mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                                      "{choice.label}"
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {options.map(opt => (
                                        <div key={opt.id} className="flex items-center gap-1 px-2 py-1 rounded-lg"
                                          style={{ background: opt.color + '12' }}>
                                          <span style={{ fontSize: '10px', color: opt.color, fontWeight: 600 }}>
                                            {opt.name.split(' ')[0]}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded text-white"
                                            style={{ fontSize: '10px', fontWeight: 700, background: opt.color }}>
                                            +{choice.optionScores[opt.id] ?? 0}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : q.sliderMapping ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span style={{ fontSize: '11px', color: '#6B7280' }}>
                                    ← {q.sliderMapping.leftLabel}
                                  </span>
                                </div>
                                <div className="h-2 rounded-full"
                                  style={{ background: `linear-gradient(90deg, ${options.find(o => o.id === q.sliderMapping!.leftOptionId)?.color ?? '#6366F1'}, ${options.find(o => o.id === q.sliderMapping!.rightOptionId)?.color ?? '#F59E0B'})` }} />
                                <div className="flex items-center justify-between">
                                  <span style={{ fontSize: '11px', color: '#6B7280' }}>
                                    {q.sliderMapping.rightLabel} →
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
              {activeCategory.questions.length === 0 && !showForm && (
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="text-4xl mb-2">❓</span>
                  <p className="text-gray-400" style={{ fontSize: '13px' }}>No questions yet in {activeCategory.name}</p>
                </div>
              )}
            </div>

            {/* Add question form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border-2 overflow-hidden mb-4"
                  style={{ borderColor: activeCategory.color + '50' }}>
                  {/* Form header */}
                  <div className="px-4 py-3" style={{ background: activeCategory.color + '10' }}>
                    <p style={{ fontWeight: 700, fontSize: '13px', color: activeCategory.color }}>
                      ✦ New Question for {activeCategory.name}
                    </p>
                  </div>

                  <div className="px-4 py-4 space-y-4">
                    {/* Question text */}
                    <div>
                      <label className="block text-gray-500 mb-1.5"
                        style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Question text
                      </label>
                      <textarea
                        value={newQ.text}
                        onChange={e => { setNewQ(p => ({ ...p, text: e.target.value })); setError(''); }}
                        placeholder="e.g., How do you use your phone most?"
                        rows={2}
                        className="w-full px-3.5 py-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none resize-none"
                        style={{ fontSize: '14px', color: '#1E1B4B' }}
                      />
                    </div>

                    {/* Question type */}
                    <div>
                      <label className="block text-gray-500 mb-2"
                        style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Question type
                      </label>
                      <div className="flex gap-2">
                        {([
                          { type: 'multiple_choice' as const, icon: <CheckSquare className="w-4 h-4" />, label: 'Multiple Choice', sub: 'Choices → option scores' },
                          { type: 'slider' as const,          icon: <SlidersHorizontal className="w-4 h-4" />, label: 'Slider 1–10',    sub: '2-endpoint interpolation' },
                        ]).map(opt => (
                          <button key={opt.type}
                            onClick={() => setNewQ(p => ({ ...p, type: opt.type }))}
                            className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all text-center"
                            style={newQ.type === opt.type
                              ? { background: activeCategory.color + '15', borderColor: activeCategory.color, color: activeCategory.color }
                              : { background: 'white', borderColor: '#E5E7EB', color: '#9CA3AF' }}>
                            {opt.icon}
                            <span style={{ fontSize: '12px', fontWeight: 700 }}>{opt.label}</span>
                            <span style={{ fontSize: '10px', opacity: 0.75 }}>{opt.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── MULTIPLE CHOICE ── */}
                    {newQ.type === 'multiple_choice' && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-gray-500"
                            style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Choices & Option Scores
                          </label>
                          <div className="flex gap-1">
                            {options.map(opt => (
                              <span key={opt.id} className="px-2 py-0.5 rounded-full text-white"
                                style={{ fontSize: '9px', fontWeight: 700, background: opt.color }}>
                                {opt.name.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          {newQ.choices.map((choice, idx) => (
                            <div key={choice.id} className="bg-gray-50 rounded-xl p-3">
                              <div className="flex gap-2 mb-2">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full text-white flex-shrink-0 mt-2.5"
                                  style={{ fontSize: '10px', fontWeight: 700, background: activeCategory.color }}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <input
                                  type="text"
                                  value={choice.label}
                                  onChange={e => updateChoiceLabel(idx, e.target.value)}
                                  placeholder={`Choice ${String.fromCharCode(65 + idx)} label...`}
                                  className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-200 outline-none"
                                  style={{ fontSize: '13px', color: '#1E1B4B' }}
                                />
                                <button onClick={() => removeChoice(idx)}
                                  className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center mt-1 flex-shrink-0">
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                </button>
                              </div>
                              {/* Option scores row */}
                              <div className="flex items-center gap-2 pl-7">
                                <span className="text-gray-400" style={{ fontSize: '10px', fontWeight: 600 }}>→ Scores:</span>
                                {options.map(opt => (
                                  <div key={opt.id} className="flex flex-col items-center gap-0.5">
                                    <ScoreInput
                                      value={choice.optionScores[opt.id] ?? 5}
                                      color={opt.color}
                                      onChange={v => updateChoiceScore(idx, opt.id, v)}
                                    />
                                    <span style={{ fontSize: '9px', color: opt.color, fontWeight: 600 }}>
                                      {opt.name.split(' ')[0]}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button onClick={addChoice}
                          className="flex items-center gap-1.5 mt-2 text-indigo-500"
                          style={{ fontSize: '12px', fontWeight: 600 }}>
                          <Plus className="w-3.5 h-3.5" /> Add choice
                        </button>
                      </div>
                    )}

                    {/* ── SLIDER ── */}
                    {newQ.type === 'slider' && (
                      <div className="space-y-3">
                        <label className="block text-gray-500"
                          style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Endpoint Mapping
                        </label>

                        {/* Gradient bar */}
                        <div className="h-3 rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${options.find(o => o.id === newQ.sliderMapping.leftOptionId)?.color ?? '#6366F1'} 0%, #E5E7EB 50%, ${options.find(o => o.id === newQ.sliderMapping.rightOptionId)?.color ?? '#F59E0B'} 100%)`
                          }} />

                        {/* Left endpoint */}
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-gray-400 mb-1.5" style={{ fontSize: '10px', fontWeight: 600 }}>
                            ← LEFT ENDPOINT  (slider value = 1 → this option scores 10)
                          </p>
                          <select
                            value={newQ.sliderMapping.leftOptionId}
                            onChange={e => updateSliderMapping({ leftOptionId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 outline-none mb-2"
                            style={{ fontSize: '13px', color: '#1E1B4B' }}>
                            {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                          <input
                            type="text"
                            value={newQ.sliderMapping.leftLabel}
                            onChange={e => updateSliderMapping({ leftLabel: e.target.value })}
                            placeholder="e.g., ← Strongly favors iPhone"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 outline-none"
                            style={{ fontSize: '12px', color: '#6B7280' }}
                          />
                        </div>

                        {/* Right endpoint */}
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-gray-400 mb-1.5" style={{ fontSize: '10px', fontWeight: 600 }}>
                            → RIGHT ENDPOINT  (slider value = 10 → this option scores 10)
                          </p>
                          <select
                            value={newQ.sliderMapping.rightOptionId}
                            onChange={e => updateSliderMapping({ rightOptionId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 outline-none mb-2"
                            style={{ fontSize: '13px', color: '#1E1B4B' }}>
                            {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                          <input
                            type="text"
                            value={newQ.sliderMapping.rightLabel}
                            onChange={e => updateSliderMapping({ rightLabel: e.target.value })}
                            placeholder="e.g., Strongly favors Galaxy →"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 outline-none"
                            style={{ fontSize: '12px', color: '#6B7280' }}
                          />
                        </div>

                        {/* Preview */}
                        <SliderPreview
                          mapping={newQ.sliderMapping}
                          options={options.map(o => ({ id: o.id, name: o.name, color: o.color }))}
                        />
                      </div>
                    )}

                    {error && (
                      <p className="text-red-400" style={{ fontSize: '12px', fontWeight: 500 }}>⚠ {error}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setShowForm(false); setError(''); }}
                        className="flex-1 py-3 rounded-xl border-2 border-gray-200 bg-white"
                        style={{ fontSize: '13px', fontWeight: 600, color: '#9CA3AF' }}>
                        Cancel
                      </button>
                      <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
                        className="flex-1 py-3 rounded-xl text-white"
                        style={{ background: activeCategory.color, fontSize: '13px', fontWeight: 700 }}>
                        Save Question
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add button */}
            {!showForm && (
              <button onClick={openForm}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2"
                style={{ borderColor: activeCategory.color + '60', color: activeCategory.color, fontSize: '13px', fontWeight: 600 }}>
                <Plus className="w-4 h-4" /> Add Question to {activeCategory.name}
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-5 pb-8 pt-4 border-t border-gray-100">
        <motion.button whileTap={{ scale: 0.97 }} onClick={nextCreatorStep} disabled={totalQ === 0}
          className="w-full py-4 rounded-2xl text-white flex items-center justify-center"
          style={{
            background: totalQ > 0 ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#E5E7EB',
            color: totalQ > 0 ? 'white' : '#9CA3AF',
            boxShadow: totalQ > 0 ? '0 8px 24px rgba(245,158,11,0.25)' : 'none',
          }}>
          <span style={{ fontWeight: 700 }}>
            {totalQ > 0 ? `Preview & Publish (${totalQ} Qs) →` : 'Add at least one question'}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
