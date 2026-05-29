import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PenLine, Play, ChevronRight, Scale, Link } from 'lucide-react';
import { useQuestionnaire } from '../context/QuestionnaireContext';

export function HomeScreen() {
  const { setMode, startUserFlow, setCreatorStep, loadDecision } = useQuestionnaire();

  const [showIdInput, setShowIdInput] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [idError, setIdError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadById = async () => {
    const id = parseInt(idInput.trim());
    if (isNaN(id)) { setIdError('Please enter a valid number'); return; }
    setIsLoading(true);
    setIdError('');
    try {
      await loadDecision(id);
      await startUserFlow(false);
    } catch {
      setIdError('Questionnaire not found. Check the ID and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Hero */}
      <div className="relative overflow-hidden px-6 pt-12 pb-10"
        style={{ background: 'linear-gradient(160deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10 bg-white -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full opacity-10 bg-white translate-y-16 -translate-x-16" />

        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
          className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-5 backdrop-blur">
          <Scale className="w-7 h-7 text-white" />
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <h1 className="text-white mb-2" style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.15 }}>
            DecideIQ
          </h1>
          <p className="text-indigo-300" style={{ fontSize: '14px', lineHeight: 1.6 }}>
            Personalized decision scoring —<br />
            your weights, your results.
          </p>
        </motion.div>

      </div>

      {/* Role cards */}
      <div className="px-5 py-6 space-y-4">
        <p className="text-gray-400" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Choose your role
        </p>

        {/* User card */}
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="rounded-3xl overflow-hidden shadow-lg shadow-indigo-100 cursor-pointer"
          onClick={() => startUserFlow(true)}
          whileTap={{ scale: 0.98 }}>
          <div className="p-5" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white/70" style={{ fontSize: '11px', fontWeight: 600 }}>RESPONDENT</span>
                </div>
                <h2 className="text-white mb-1" style={{ fontWeight: 700, fontSize: '19px' }}>
                  Take a Questionnaire
                </h2>
              </div>
              <ChevronRight className="w-5 h-5 text-white/50 flex-shrink-0 mt-1" />
            </div>
            <div className="mt-4 flex gap-2">
              {['Set weights', 'Answer Qs', 'See ranking'].map((s, i) => (
                <span key={i} className="px-2.5 py-1 bg-white/15 rounded-full text-white"
                  style={{ fontSize: '10px', fontWeight: 500 }}>
                  {i + 1}. {s}
                </span>
              ))}
            </div>
          </div>
          <div className="px-5 py-3 bg-indigo-50 flex items-center justify-between">
            <span className="text-indigo-500" style={{ fontSize: '12px', fontWeight: 600 }}>
              總統選舉公報2024
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
          </div>
        </motion.div>

        {/* Fill by ID card */}
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.45 }}
          className="rounded-3xl overflow-hidden border border-indigo-100 shadow-sm cursor-pointer"
          onClick={() => { setShowIdInput(p => !p); setIdError(''); }}
          whileTap={{ scale: 0.98 }}>
          <div className="p-5 bg-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Link className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="text-indigo-400" style={{ fontSize: '11px', fontWeight: 600 }}>SHARED LINK</span>
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '19px', color: '#1E1B4B' }}>
                  Fill a shared questionnaire
                </h2>
                <p className="text-gray-400 mt-1" style={{ fontSize: '12px' }}>Enter a questionnaire ID</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
            </div>
          </div>
          <AnimatePresence>
            {showIdInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="px-5 pb-5 space-y-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="number"
                    value={idInput}
                    onChange={e => { setIdInput(e.target.value); setIdError(''); }}
                    placeholder="e.g. 42"
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white outline-none"
                    style={{ fontSize: '15px', color: '#1E1B4B' }}
                    onKeyDown={e => e.key === 'Enter' && handleLoadById()}
                  />
                  {idError && <p className="text-red-400" style={{ fontSize: '12px' }}>{idError}</p>}
                  <button
                    onClick={handleLoadById}
                    disabled={isLoading || !idInput.trim()}
                    className="w-full py-3 rounded-2xl text-white font-semibold"
                    style={{
                      background: (isLoading || !idInput.trim()) ? '#E5E7EB' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      color: (isLoading || !idInput.trim()) ? '#9CA3AF' : 'white',
                      fontSize: '14px',
                    }}>
                    {isLoading ? 'Loading...' : 'Start →'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Creator card */}
        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}
          className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer"
          onClick={() => { setMode('creator'); setCreatorStep(0); }}
          whileTap={{ scale: 0.98 }}>
          <div className="p-5 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
                    <PenLine className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-amber-500" style={{ fontSize: '11px', fontWeight: 600 }}>CREATOR</span>
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '19px', color: '#1E1B4B' }}>
                  Create a Questionnaire
                </h2>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              {['Options', 'Categories', 'Questions'].map(s => (
                <span key={s} className="px-2.5 py-1 bg-gray-100 rounded-full text-gray-500"
                  style={{ fontSize: '10px', fontWeight: 500 }}>
                  {s}
                </span>
              ))}
              <span className="px-2.5 py-1 bg-red-50 rounded-full text-red-400"
                style={{ fontSize: '10px', fontWeight: 500 }}>
                ⚠️ No weights
              </span>
            </div>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
          className="bg-gray-50 rounded-2xl p-4">
          <p className="text-gray-500 mb-3" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            How it works
          </p>
          <div className="space-y-3">
            {[
              { role: 'Creator', color: '#F59E0B', steps: 'Defines options, categories & scoring-mapped questions' },
              { role: 'User', color: '#6366F1', steps: 'Sets weights via pie chart, answers each question once' },
              { role: 'System', color: '#10B981', steps: 'Maps answers → option scores → weights → ranked results' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5"
                  style={{ background: item.color, fontSize: '10px', fontWeight: 700 }}>
                  {i + 1}
                </div>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '12px', color: item.color }}>{item.role}: </span>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>{item.steps}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
