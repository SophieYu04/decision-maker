import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Play, Share2, Info } from 'lucide-react';
import { useQuestionnaire, UserWeight } from '../../context/QuestionnaireContext';
import { CreatorStepDots } from './CreatorSetupScreen';
import { DraggablePieChart, PieSegment } from '../../components/DraggablePieChart';
import { createDecision } from '../../api';

function equalWeights(cats: { id: string }[]): number[] {
  const n = cats.length;
  if (n === 0) return [];
  const base = Math.floor(100 / n);
  const rem  = 100 - base * n;
  return cats.map((_, i) => base + (i === 0 ? rem : 0));
}

export function CreatorReadyScreen() {
  const {
    questionnaire, prevCreatorStep, startUserFlow, resetAll, setDefaultWeights, setDecisionId
  } = useQuestionnaire();
  const { categories, options } = questionnaire;
  const totalQ = categories.reduce((s, c) => s + c.questions.length, 0);

  // ── Local weight state (mirrors defaultWeights) ────────────────────────
  const [weights, setWeights] = useState<number[]>(() => {
    const dw = questionnaire.defaultWeights;
    if (dw.length > 0 && dw.length === categories.length) {
      return categories.map(c => dw.find(w => w.categoryId === c.id)?.weight ?? 0);
    }
    return equalWeights(categories);
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Keep weights in sync if categories change
  useEffect(() => {
    setWeights(equalWeights(categories));
  }, [categories.length]);

  // Persist to context whenever weights change
  useEffect(() => {
    if (categories.length === 0) return;
    const ws: UserWeight[] = categories.map((c, i) => ({
      categoryId: c.id,
      weight: weights[i] ?? 0,
    }));
    setDefaultWeights(ws);
  }, [weights, categories]);

  const segments: PieSegment[] = categories.map(c => ({
    id: c.id, name: c.name, color: c.color, icon: c.icon,
  }));

  const selectedCat = selectedId ? categories.find(c => c.id === selectedId) : null;
  const selectedIdx = selectedId ? categories.findIndex(c => c.id === selectedId) : -1;

  const handleManualWeight = (idx: number, val: number) => {
    const clamped = Math.max(5, Math.min(90, val));
    const diff    = clamped - weights[idx];
    const rest    = weights.map((w, i) => i === idx ? w : w);
    const totalRest = rest.reduce((s, w, i) => i !== idx ? s + w : s, 0);
    const updated = weights.map((w, i) => {
      if (i === idx) return clamped;
      if (totalRest === 0) return (100 - clamped) / (weights.length - 1);
      return Math.max(5, w - (diff * w) / totalRest);
    });
    // Normalise to 100
    const sum = updated.reduce((s, v) => s + v, 0);
    setWeights(updated.map(v => parseFloat(((v / sum) * 100).toFixed(2))));
  };

  const canStart = questionnaire.title && options.length >= 2 && categories.length >= 1 && totalQ >= 1;

  const handleSaveAndLaunch = async () => {
    if (!canStart) return;
    setIsSaving(true);
    try {
      const id = await createDecision(questionnaire);
      setDecisionId(id);
      
      const url = new URL(window.location.href);
      url.searchParams.set('decision_id', id.toString());
      window.history.pushState({}, '', url);

      startUserFlow(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save decision.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevCreatorStep}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <CreatorStepDots current={5} />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)' }}>
            <Share2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '18px', color: '#1E1B4B' }}>Set Default Weights</h2>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>Step 5 of 5 · Suggested weights for respondents</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Summary card */}
        <motion.div
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-4"
          style={{ background: 'linear-gradient(135deg, #F5F3FF, #EEF2FF)' }}>
          <p className="text-indigo-400 mb-1"
            style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Your Questionnaire
          </p>
          <h3 style={{ fontWeight: 800, fontSize: '16px', color: '#1E1B4B' }}>📋 {questionnaire.title || 'Untitled'}</h3>
          <div className="flex gap-5 mt-3">
            {[
              { value: options.length,    label: 'Options',    color: '#6366F1' },
              { value: categories.length, label: 'Categories', color: '#F59E0B' },
              { value: totalQ,            label: 'Questions',  color: '#10B981' },
            ].map(({ value, label, color }) => (
              <div key={label} className="text-center">
                <p style={{ fontWeight: 800, fontSize: '20px', color }}>{value}</p>
                <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pie chart weight section */}
        {categories.length > 0 ? (
          <motion.div
            initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            {/* Info banner */}
            <div className="flex items-start gap-2 bg-amber-50 rounded-xl p-3 mb-4">
              <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700" style={{ fontSize: '11px', lineHeight: 1.5 }}>
                Drag the pie to set <strong>suggested default weights</strong>. Respondents see these first but can adjust them freely.
              </p>
            </div>

            <p style={{ fontWeight: 700, fontSize: '13px', color: '#1E1B4B', marginBottom: '12px' }}>
              Category Weights
            </p>

            {/* Pie chart */}
            <div className="flex justify-center">
              <DraggablePieChart
                segments={segments}
                weights={weights}
                onWeightsChange={setWeights}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>

            {/* Selected segment detail */}
            {selectedCat && selectedIdx >= 0 && (
              <motion.div
                key={selectedCat.id}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-2xl p-4 border-2"
                style={{ borderColor: selectedCat.color + '40', background: selectedCat.color + '06' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{selectedCat.icon}</span>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: selectedCat.color }}>
                    {selectedCat.name}
                  </p>
                  <span className="ml-auto px-3 py-1 rounded-full text-white"
                    style={{ background: selectedCat.color, fontSize: '14px', fontWeight: 800 }}>
                    {Math.round(weights[selectedIdx])}%
                  </span>
                </div>
                {/* Manual weight input */}
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={5} max={90} step={1}
                    value={Math.round(weights[selectedIdx])}
                    onChange={e => handleManualWeight(selectedIdx, parseInt(e.target.value))}
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: selectedCat.color }}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={5} max={90}
                      value={Math.round(weights[selectedIdx])}
                      onChange={e => handleManualWeight(selectedIdx, parseInt(e.target.value) || 5)}
                      className="w-12 text-center rounded-lg border-2 outline-none py-1"
                      style={{ fontSize: '13px', fontWeight: 700, color: selectedCat.color, borderColor: selectedCat.color + '40' }}
                    />
                    <span style={{ fontSize: '13px', color: '#9CA3AF' }}>%</span>
                  </div>
                </div>
                <p className="text-gray-400 mt-2" style={{ fontSize: '10px' }}>
                  {selectedCat.questions.length} question{selectedCat.questions.length !== 1 ? 's' : ''} in this category
                </p>
              </motion.div>
            )}

            {/* Weight summary list */}
            <div className="mt-4 space-y-2">
              {categories.map((cat, i) => (
                <button key={cat.id}
                  onClick={() => setSelectedId(selectedId === cat.id ? null : cat.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: selectedId === cat.id ? cat.color + '10' : '#F9FAFB',
                    border: `1.5px solid ${selectedId === cat.id ? cat.color + '40' : 'transparent'}`,
                  }}>
                  <span className="text-base flex-shrink-0">{cat.icon}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#1E1B4B', textAlign: 'left' }}>
                    {cat.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${weights[i]}%`, background: cat.color }} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: cat.color, minWidth: '36px', textAlign: 'right' }}>
                      {Math.round(weights[i])}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="text-4xl mb-2">⚖️</span>
            <p className="text-gray-400" style={{ fontSize: '13px' }}>Add categories first to set weights</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-8 pt-4 border-t border-gray-100 space-y-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSaveAndLaunch}
          disabled={!canStart || isSaving}
          className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2"
          style={{
            background: (canStart && !isSaving) ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#E5E7EB',
            color: (canStart && !isSaving) ? 'white' : '#9CA3AF',
            boxShadow: (canStart && !isSaving) ? '0 8px 24px rgba(99,102,241,0.3)' : 'none',
          }}>
          <Play className="w-4 h-4" />
          <span style={{ fontWeight: 700 }}>
            {isSaving ? 'Saving...' : canStart ? 'Save & Launch' : 'Complete all steps first'}
          </span>
        </motion.button>
        <button onClick={resetAll} className="w-full py-3 text-gray-400"
          style={{ fontSize: '13px', fontWeight: 500 }}>
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
