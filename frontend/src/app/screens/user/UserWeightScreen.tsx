import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, RotateCcw, Layers, PieChart, SlidersHorizontal, AlertCircle, Check, X } from 'lucide-react';
import { DraggablePieChart } from '../../components/DraggablePieChart';
import { useQuestionnaire, UserWeight } from '../../context/QuestionnaireContext';

const MIN_W = 5;

function round1(n: number) { return Math.round(n * 10) / 10; }

function proportionalAdjust(weights: number[], changedIdx: number, newVal: number): number[] {
  const clamped = Math.max(MIN_W, Math.min(100 - (weights.length - 1) * MIN_W, newVal));
  const delta = clamped - weights[changedIdx];
  const others = weights.map((w, i) => i === changedIdx ? 0 : w);
  const otherTotal = others.reduce((s, w) => s + w, 0);
  const result = weights.map((w, i) => {
    if (i === changedIdx) return round1(clamped);
    if (otherTotal === 0) return round1(w);
    return round1(Math.max(MIN_W, w - (w / otherTotal) * delta));
  });
  // Fix sum drift
  const total = result.reduce((s, w) => s + w, 0);
  const drift = total - 100;
  if (Math.abs(drift) > 0.05) {
    const adj = result.findIndex((_, i) => i !== changedIdx);
    if (adj >= 0) result[adj] = round1(result[adj] - drift);
  }
  return result;
}

export function UserWeightScreen() {
  const { questionnaire, userSession, setWeights, setWeightMode, nextUserStep, prevUserStep, isEditingWeights } = useQuestionnaire();
  const { categories } = questionnaire;
  const { weights: userWeights, weightMode } = userSession;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [autoBalance, setAutoBalance] = useState(false);

  const wArr = categories.map(c => userWeights.find(w => w.categoryId === c.id)?.weight ?? (100 / categories.length));
  const total = round1(wArr.reduce((s, w) => s + w, 0));
  const isValid = Math.abs(total - 100) < 0.5;

  const updateWeights = useCallback((newArr: number[]) => {
    const newWeights: UserWeight[] = categories.map((c, i) => ({ categoryId: c.id, weight: newArr[i] }));
    setWeights(newWeights);
  }, [categories, setWeights]);

  // Pie chart callback
  const handlePieChange = useCallback((newArr: number[]) => {
    updateWeights(newArr);
    if (selectedId) {
      const idx = categories.findIndex(c => c.id === selectedId);
      if (idx >= 0) setInputVal(String(Math.round(newArr[idx])));
    }
  }, [categories, selectedId, updateWeights]);

  const handleSegmentSelect = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      const idx = categories.findIndex(c => c.id === id);
      setInputVal(String(Math.round(wArr[idx])));
    }
  };

  // Manual input for selected segment
  const handleInputChange = (val: string) => {
    setInputVal(val);
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const idx = categories.findIndex(c => c.id === selectedId);
    if (idx < 0) return;
    if (autoBalance) {
      updateWeights(proportionalAdjust(wArr, idx, num));
    } else {
      const newArr = [...wArr];
      newArr[idx] = round1(Math.max(0, Math.min(100, num)));
      updateWeights(newArr);
    }
  };

  // Slider mode individual change
  const handleSliderChange = (idx: number, val: number) => {
    if (autoBalance) {
      updateWeights(proportionalAdjust(wArr, idx, val));
    } else {
      const newArr = [...wArr];
      newArr[idx] = val;
      updateWeights(newArr);
    }
  };

  const resetEqual = () => {
    const n = categories.length;
    const base = Math.floor(100 / n);
    const rem = 100 - base * n;
    updateWeights(categories.map((_, i) => i === 0 ? base + rem : base));
    setInputVal('');
  };

  const autoNormalize = () => {
    if (total === 0) return;
    updateWeights(wArr.map(w => round1((w / total) * 100)));
  };

  const selectedIdx = selectedId ? categories.findIndex(c => c.id === selectedId) : -1;
  const selectedCat = selectedIdx >= 0 ? categories[selectedIdx] : null;

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevUserStep} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            {isEditingWeights && (
              <span className="px-2.5 py-1 bg-amber-100 rounded-full text-amber-600" style={{ fontSize: '11px', fontWeight: 600 }}>
                Editing Weights
              </span>
            )}
            <UserStepDots current={1} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)' }}>
            <Layers className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '18px', color: '#1E1B4B' }}>Assign Weights</h2>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>What matters most to you?</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-5 p-1 bg-gray-100 rounded-2xl">
          {[{ mode: 'pie' as const, icon: <PieChart className="w-3.5 h-3.5" />, label: 'Pie Chart' },
            { mode: 'sliders' as const, icon: <SlidersHorizontal className="w-3.5 h-3.5" />, label: 'Sliders' }].map(opt => (
            <button key={opt.mode}
              onClick={() => setWeightMode(opt.mode)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all"
              style={weightMode === opt.mode ? {
                background: 'white',
                color: '#6366F1',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              } : { color: '#9CA3AF' }}>
              {opt.icon}
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* ── PIE CHART MODE ── */}
        {weightMode === 'pie' && (
          <div>
            {/* Pie chart */}
            <div className="flex justify-center mb-3">
              <DraggablePieChart
                segments={categories.map(c => ({ id: c.id, name: c.name, color: c.color, icon: c.icon }))}
                weights={wArr}
                onWeightsChange={handlePieChange}
                selectedId={selectedId}
                onSelect={handleSegmentSelect}
              />
            </div>

            {/* Selected segment input panel */}
            <AnimatePresence>
              {selectedCat && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl p-4 mb-4 border-2"
                  style={{ borderColor: selectedCat.color + '40', background: selectedCat.color + '08' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{selectedCat.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#1E1B4B' }}>{selectedCat.name}</span>
                    </div>
                    <button onClick={() => setSelectedId(null)}>
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-2 border border-gray-200 flex-shrink-0">
                      <input
                        type="number"
                        value={inputVal}
                        onChange={e => handleInputChange(e.target.value)}
                        min={MIN_W}
                        max={100}
                        className="w-12 text-center bg-transparent outline-none"
                        style={{ fontSize: '16px', fontWeight: 700, color: selectedCat.color }}
                      />
                      <span style={{ fontSize: '13px', color: '#9CA3AF' }}>%</span>
                    </div>
                    <input
                      type="range"
                      min={MIN_W}
                      max={100 - (categories.length - 1) * MIN_W}
                      step={1}
                      value={wArr[selectedIdx] ?? 0}
                      onChange={e => handleInputChange(e.target.value)}
                      className="flex-1 accent-indigo-500"
                      style={{ accentColor: selectedCat.color }}
                    />
                  </div>
                  {autoBalance && (
                    <p className="text-gray-400 mt-2" style={{ fontSize: '10px' }}>
                      Auto-balance: other segments adjust proportionally
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Legend */}
            <div className="space-y-2 mb-4">
              {categories.map((cat, i) => (
                <motion.div
                  key={cat.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSegmentSelect(cat.id === selectedId ? null : cat.id)}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  style={cat.id === selectedId ? {
                    background: cat.color + '12',
                    border: `1.5px solid ${cat.color}50`,
                  } : { background: '#F9FAFB', border: '1.5px solid transparent' }}
                >
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: cat.color }} />
                  <span className="text-sm">{cat.icon}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#1E1B4B' }}>{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        animate={{ width: `${wArr[i]}%` }}
                        style={{ background: cat.color }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: cat.color, minWidth: '36px', textAlign: 'right' }}>
                      {Math.round(wArr[i])}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── SLIDER MODE ── */}
        {weightMode === 'sliders' && (
          <div className="space-y-4 mb-4">
            {categories.map((cat, i) => (
              <div key={cat.id} className="bg-gray-50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                      style={{ background: cat.color + '20' }}>{cat.icon}</div>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#1E1B4B' }}>{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-gray-200">
                    <input
                      type="number"
                      value={Math.round(wArr[i])}
                      onChange={e => handleSliderChange(i, parseInt(e.target.value) || 0)}
                      min={0} max={100}
                      className="w-10 text-center bg-transparent outline-none"
                      style={{ fontSize: '13px', fontWeight: 700, color: cat.color }}
                    />
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={Math.round(wArr[i])}
                  onChange={e => handleSliderChange(i, parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: cat.color }}
                />
                <div className="flex justify-between mt-1">
                  <span style={{ fontSize: '9px', color: '#D1D5DB' }}>Not important</span>
                  <span style={{ fontSize: '9px', color: '#D1D5DB' }}>Very important</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 mb-4">
          <button onClick={resetEqual}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 text-gray-600"
            style={{ fontSize: '12px', fontWeight: 600 }}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Equal
          </button>
          <button onClick={autoNormalize}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white"
            style={{ background: '#6366F1', fontSize: '12px', fontWeight: 600 }}>
            <Check className="w-3.5 h-3.5" />
            Auto-balance
          </button>
        </div>

        {/* Auto-balance toggle */}
        <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-2xl mb-4">
          <div>
            <p style={{ fontWeight: 600, fontSize: '13px', color: '#4338CA' }}>Live Auto-balance</p>
            <p style={{ fontSize: '11px', color: '#818CF8' }}>Others adjust proportionally as you change values</p>
          </div>
          <button
            onClick={() => setAutoBalance(p => !p)}
            className="w-12 h-6 rounded-full transition-all relative"
            style={{ background: autoBalance ? '#6366F1' : '#D1D5DB' }}
          >
            <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
              style={{ left: autoBalance ? '26px' : '2px' }} />
          </button>
        </div>

        {/* Total indicator */}
        <div className={`flex items-center gap-3 rounded-2xl p-3 ${isValid ? 'bg-green-50' : 'bg-red-50'}`}>
          {isValid
            ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: '12px', fontWeight: 600, color: isValid ? '#059669' : '#DC2626' }}>
                Total: {total}%
              </span>
              {!isValid && (
                <span style={{ fontSize: '11px', color: '#EF4444' }}>
                  {total > 100 ? `${round1(total - 100)}% over` : `${round1(100 - total)}% remaining`}
                </span>
              )}
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${Math.min(total, 100)}%` }}
                style={{ background: isValid ? '#10B981' : total > 100 ? '#EF4444' : '#F59E0B' }}
              />
            </div>
          </div>
          {isValid && <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>✓</span>}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-8 pt-4 border-t border-gray-100">
        {!isValid && (
          <p className="text-center text-red-400 mb-3" style={{ fontSize: '12px' }}>
            Weights must total exactly 100% to continue
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={nextUserStep}
          disabled={!isValid}
          className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2"
          style={{
            background: isValid ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#E5E7EB',
            color: isValid ? 'white' : '#9CA3AF',
            boxShadow: isValid ? '0 8px 24px rgba(99,102,241,0.3)' : 'none',
          }}
        >
          <span style={{ fontWeight: 700 }}>
            {isEditingWeights ? '✨ Update Results' : 'Answer Questions →'}
          </span>
        </motion.button>
      </div>
    </div>
  );
}

function UserStepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-full transition-all"
          style={{
            width: i === current ? '20px' : '6px',
            height: '6px',
            background: i <= current ? '#6366F1' : '#E5E7EB'
          }} />
      ))}
    </div>
  );
}

export { UserStepDots };
