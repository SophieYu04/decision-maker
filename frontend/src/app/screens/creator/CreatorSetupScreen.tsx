import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, PenLine } from 'lucide-react';
import { useQuestionnaire } from '../../context/QuestionnaireContext';

export function CreatorSetupScreen() {
  const { questionnaire, updateQuestionnaire, nextCreatorStep, resetAll } = useQuestionnaire();
  const [title, setTitle] = useState(questionnaire.title);
  const [description, setDescription] = useState(questionnaire.description);
  const [purpose, setPurpose] = useState(questionnaire.purpose);
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!title.trim()) { setError('Enter a title for your questionnaire'); return; }
    updateQuestionnaire({ title: title.trim(), description: description.trim(), purpose: purpose.trim() });
    nextCreatorStep();
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={resetAll} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <CreatorStepDots current={1} />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
            <PenLine className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '18px', color: '#1E1B4B' }}>Setup Questionnaire</h2>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>Step 1 of 5 · Basic info</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        <div>
          <label className="block text-gray-500 mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setError(''); }}
            placeholder="e.g., Best Smartphone 2024"
            className={`w-full px-4 py-3.5 rounded-2xl bg-gray-50 outline-none transition-all border-2 ${error ? 'border-red-200' : 'border-transparent focus:border-amber-200 focus:bg-white'}`}
            style={{ fontSize: '15px', color: '#1E1B4B' }}
          />
          {error && <p className="text-red-400 mt-1.5" style={{ fontSize: '12px' }}>{error}</p>}
        </div>

        <div>
          <label className="block text-gray-500 mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Short description
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g., Comparing the top flagship phones"
            className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-amber-200 focus:bg-white outline-none"
            style={{ fontSize: '14px', color: '#1E1B4B' }}
          />
        </div>

        <div>
          <label className="block text-gray-500 mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            User purpose prompt
          </label>
          <textarea
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            placeholder="Tell the user how to use this — e.g., 'Find your perfect phone based on what matters most to you.'"
            rows={3}
            className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-amber-200 focus:bg-white outline-none resize-none"
            style={{ fontSize: '14px', color: '#1E1B4B', lineHeight: 1.5 }}
          />
        </div>

        {title && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 border-2 border-amber-100"
            style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' }}
          >
            <p className="text-amber-400 mb-1" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preview</p>
            <p style={{ fontWeight: 700, fontSize: '15px', color: '#1E1B4B' }}>📋 {title}</p>
            {description && <p className="text-gray-500 mt-0.5" style={{ fontSize: '12px' }}>{description}</p>}
          </motion.div>
        )}
      </div>

      <div className="px-5 pb-8 pt-4 border-t border-gray-100">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2 shadow-lg shadow-amber-100"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
        >
          <span style={{ fontWeight: 700 }}>Add Options →</span>
        </motion.button>
      </div>
    </div>
  );
}

export function CreatorStepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="rounded-full transition-all" style={{
          width: i === current ? '20px' : '6px',
          height: '6px',
          background: i <= current ? '#F59E0B' : '#E5E7EB',
        }} />
      ))}
    </div>
  );
}
