import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, Target } from 'lucide-react';
import { useQuestionnaire } from '../../context/QuestionnaireContext';

export function UserIntroScreen() {
  const { questionnaire, nextUserStep, resetAll } = useQuestionnaire();
  const { title, description, purpose, options, categories } = questionnaire;

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-10 pb-8"
        style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
        <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-white/10 -translate-y-12 translate-x-12" />
        <button onClick={resetAll} className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center mb-5">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
          <Target className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-white mb-1" style={{ fontSize: '21px', fontWeight: 800, lineHeight: 1.25 }}>{title}</h1>
        <p className="text-indigo-200" style={{ fontSize: '12px' }}>{description}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {/* Purpose */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="bg-indigo-50 rounded-2xl p-4 border-l-4 border-indigo-400">
          <p className="text-indigo-700" style={{ fontSize: '13px', lineHeight: 1.6 }}>{purpose}</p>
        </motion.div>

        {/* Options */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <p className="text-gray-500 mb-3" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Comparing {options.length} options
          </p>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: opt.color, fontSize: '11px', fontWeight: 700 }}>
                  {opt.initials}
                </div>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#1E1B4B' }}>{opt.name}</span>
                <span className="ml-auto" style={{ fontSize: '11px', color: '#9CA3AF' }}>Option {i + 1}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Categories preview */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <p className="text-gray-500 mb-3" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {categories.length} scoring categories
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-100"
                style={{ background: cat.color + '12' }}>
                <span className="text-sm">{cat.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: cat.color }}>{cat.name}</span>
                <span className="text-gray-400" style={{ fontSize: '10px' }}>
                  ({cat.questions.length}q)
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Your steps */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
          className="bg-gray-50 rounded-2xl p-4">
          <p className="text-gray-500 mb-3" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Your 3 steps
          </p>
          <div className="space-y-3">
            {[
              { icon: '🥧', label: 'Assign weights', desc: 'Drag pie chart segments to set category importance' },
              { icon: '✍️', label: 'Answer questions', desc: 'Rate each option per category' },
              { icon: '🏆', label: 'See results', desc: 'Get your personalized ranking with explanations' },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-lg shadow-sm flex-shrink-0">{s.icon}</div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '13px', color: '#1E1B4B' }}>{s.label}</p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-8 pt-4 border-t border-gray-100">
        <motion.button whileTap={{ scale: 0.97 }} onClick={nextUserStep}
          className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
          <span style={{ fontWeight: 700 }}>Assign My Weights</span>
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
