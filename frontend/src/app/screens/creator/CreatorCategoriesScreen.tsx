import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, Layers, Info } from 'lucide-react';
import { useQuestionnaire, CAT_COLORS, CAT_ICONS } from '../../context/QuestionnaireContext';
import { CreatorStepDots } from './CreatorSetupScreen';

export function CreatorCategoriesScreen() {
  const { questionnaire, addCategory, removeCategory, nextCreatorStep, prevCreatorStep } = useQuestionnaire();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🎯');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) { setError('Enter a category name'); return; }
    if (questionnaire.categories.some(c => c.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError('Category already exists'); return;
    }
    const color = CAT_COLORS[questionnaire.categories.length % CAT_COLORS.length];
    addCategory({ id: `cat_${Date.now()}`, name: newName.trim(), color, icon: newIcon, questions: [] });
    setNewName(''); setError('');
  };

  const canContinue = questionnaire.categories.length >= 1;

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevCreatorStep} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <CreatorStepDots current={3} />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)' }}>
            <Layers className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '18px', color: '#1E1B4B' }}>Add Categories</h2>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>Step 3 of 5 · Set weights in the next step</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Info banner */}
        <div className="flex items-start gap-2.5 bg-indigo-50 rounded-2xl p-3.5 mb-5">
          <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="text-indigo-600" style={{ fontSize: '12px', lineHeight: 1.5 }}>
            Group your questions into categories. You'll set suggested default weights for each category in Step 5.
          </p>
        </div>

        <div className="space-y-2.5 mb-5">
          <AnimatePresence>
            {questionnaire.categories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: cat.color + '20' }}>
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <p style={{ fontWeight: 600, fontSize: '13px', color: '#1E1B4B' }}>{cat.name}</p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                    {cat.questions.length} question{cat.questions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <button onClick={() => removeCategory(cat.id)}
                  className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {questionnaire.categories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-4xl mb-3">⚖️</div>
              <p className="text-gray-400" style={{ fontSize: '13px' }}>No categories yet</p>
            </div>
          )}
        </div>

        {/* Add form */}
        <div className="bg-emerald-50 rounded-2xl p-4">
          <p className="text-emerald-700 mb-3" style={{ fontSize: '13px', fontWeight: 600 }}>+ Add Category</p>
          <button
            onClick={() => setShowIconPicker(p => !p)}
            className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-emerald-200 mb-3">
            <span className="text-xl">{newIcon}</span>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>Icon ▾</span>
          </button>
          {showIconPicker && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-3 border border-emerald-100 flex flex-wrap gap-2 mb-3">
              {CAT_ICONS.map(icon => (
                <button key={icon} onClick={() => { setNewIcon(icon); setShowIconPicker(false); }}
                  className={`w-9 h-9 rounded-lg text-lg ${newIcon === icon ? 'bg-emerald-100 scale-110' : 'hover:bg-gray-100'}`}>
                  {icon}
                </button>
              ))}
            </motion.div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Category name..."
              className={`flex-1 px-3.5 py-3 rounded-xl bg-white outline-none border-2 ${error ? 'border-red-200' : 'border-transparent focus:border-emerald-200'}`}
              style={{ fontSize: '14px', color: '#1E1B4B' }}
            />
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleAdd}
              className="w-12 h-12 rounded-xl text-white flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <Plus className="w-5 h-5" />
            </motion.button>
          </div>
          {error && <p className="text-red-400 mt-1.5" style={{ fontSize: '11px' }}>{error}</p>}
        </div>
      </div>

      <div className="px-5 pb-8 pt-4 border-t border-gray-100">
        <motion.button whileTap={{ scale: 0.97 }} onClick={nextCreatorStep} disabled={!canContinue}
          className="w-full py-4 rounded-2xl text-white flex items-center justify-center"
          style={{
            background: canContinue ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#E5E7EB',
            color: canContinue ? 'white' : '#9CA3AF',
            boxShadow: canContinue ? '0 8px 24px rgba(245,158,11,0.25)' : 'none',
          }}>
          <span style={{ fontWeight: 700 }}>Add Questions →</span>
        </motion.button>
      </div>
    </div>
  );
}