import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';
import { useQuestionnaire, OPTION_COLORS } from '../../context/QuestionnaireContext';
import { CreatorStepDots } from './CreatorSetupScreen';

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function CreatorOptionsScreen() {
  const { questionnaire, addOption, removeOption, nextCreatorStep, prevCreatorStep } = useQuestionnaire();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) { setError('Enter an option name'); return; }
    if (questionnaire.options.some(o => o.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError('Option already exists'); return;
    }
    const color = OPTION_COLORS[questionnaire.options.length % OPTION_COLORS.length];
    addOption({ id: `opt_${Date.now()}`, name: newName.trim(), color, initials: getInitials(newName.trim()) });
    setNewName(''); setError('');
  };

  const canContinue = questionnaire.options.length >= 2;

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevCreatorStep} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <CreatorStepDots current={2} />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' }}>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '18px', color: '#1E1B4B' }}>Add Options</h2>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>Step 2 of 5 · What to compare</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500" style={{ fontSize: '13px' }}>
            {questionnaire.options.length} option{questionnaire.options.length !== 1 ? 's' : ''}
          </span>
          {canContinue && (
            <span className="text-green-500 flex items-center gap-1" style={{ fontSize: '12px', fontWeight: 600 }}>
              ✓ Ready
            </span>
          )}
        </div>

        <div className="space-y-2.5 mb-5">
          <AnimatePresence>
            {questionnaire.options.map((opt, i) => (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                  style={{ background: opt.color, fontSize: '12px', fontWeight: 700 }}>
                  {opt.initials}
                </div>
                <div className="flex-1">
                  <p style={{ fontWeight: 600, fontSize: '14px', color: '#1E1B4B' }}>{opt.name}</p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF' }}>Option {i + 1}</p>
                </div>
                <button onClick={() => removeOption(opt.id)}
                  className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {questionnaire.options.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-gray-400" style={{ fontSize: '13px' }}>Add at least 2 options</p>
            </div>
          )}
        </div>

        <div className="bg-indigo-50 rounded-2xl p-4">
          <p className="text-indigo-600 mb-3" style={{ fontSize: '13px', fontWeight: 600 }}>+ Add Option</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g., iPhone 15 Pro"
              className={`flex-1 px-3.5 py-3 rounded-xl bg-white outline-none border-2 ${error ? 'border-red-200' : 'border-transparent focus:border-indigo-200'}`}
              style={{ fontSize: '14px', color: '#1E1B4B' }}
            />
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleAdd}
              className="w-12 h-12 rounded-xl text-white flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              <Plus className="w-5 h-5" />
            </motion.button>
          </div>
          {error && <p className="text-red-400 mt-1.5" style={{ fontSize: '11px' }}>{error}</p>}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-gray-400" style={{ fontSize: '11px' }}>Next color:</span>
            <div className="w-4 h-4 rounded-full"
              style={{ background: OPTION_COLORS[questionnaire.options.length % OPTION_COLORS.length] }} />
          </div>
        </div>
      </div>

      <div className="px-5 pb-8 pt-4 border-t border-gray-100">
        <motion.button whileTap={{ scale: 0.97 }} onClick={nextCreatorStep} disabled={!canContinue}
          className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2"
          style={{
            background: canContinue ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#E5E7EB',
            color: canContinue ? 'white' : '#9CA3AF',
            boxShadow: canContinue ? '0 8px 24px rgba(245,158,11,0.25)' : 'none',
          }}>
          <span style={{ fontWeight: 700 }}>
            {canContinue ? 'Add Categories →' : `Need ${2 - questionnaire.options.length} more option${2 - questionnaire.options.length !== 1 ? 's' : ''}`}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
