import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, RotateCcw, Edit3, ChevronDown, ChevronUp,
  Info, SlidersHorizontal, CheckSquare,
} from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import {
  useQuestionnaire, computeScores, ScoringResult,
} from '../../context/QuestionnaireContext';
import { UserStepDots } from './UserWeightScreen';

const MEDALS = ['🥇', '🥈', '🥉'];

// ─── Score badge ─────────────────────────────────────────────────────────────
function ScorePill({ score, color, size = 'md' }: { score: number; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const pct = (score * 10).toFixed(0);
  const s = size === 'lg' ? { fontSize: '22px', px: '10px', py: '4px' }
           : size === 'sm' ? { fontSize: '11px', px: '8px', py: '2px' }
           : { fontSize: '14px', px: '10px', py: '3px' };
  return (
    <span className="inline-block rounded-full text-white font-bold"
      style={{ background: color, fontSize: s.fontSize, padding: `${s.py} ${s.px}` }}>
      {pct}%
    </span>
  );
}

// ─── Answer explanation row ───────────────────────────────────────────────────
function AnswerRow({
  bd, options,
}: { bd: ScoringResult['answerBreakdowns'][number]; options: { id: string; name: string; color: string }[] }) {
  const [open, setOpen] = useState(false);
  const sortedOpts = [...options].sort((a, b) => (bd.optionScores[b.id] ?? 0) - (bd.optionScores[a.id] ?? 0));

  return (
    <div className="rounded-xl overflow-hidden border border-gray-100">
      <button
        className="w-full flex items-start gap-3 px-3 py-3 bg-gray-50 text-left"
        onClick={() => setOpen(p => !p)}>
        <div className="flex-shrink-0 mt-0.5">
          {bd.type === 'slider'
            ? <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            : <CheckSquare className="w-3.5 h-3.5 text-amber-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#1E1B4B', lineHeight: 1.4 }}>
            {bd.questionText}
          </p>
          <p className="text-gray-400 mt-0.5" style={{ fontSize: '11px' }}>
            Your answer: <span style={{ color: bd.categoryColor, fontWeight: 600 }}>"{bd.answerLabel}"</span>
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {sortedOpts.slice(0, 2).map(opt => {
            const s = bd.optionScores[opt.id] ?? 0;
            return s > 0 ? (
              <span key={opt.id} className="px-1.5 py-0.5 rounded text-white"
                style={{ fontSize: '9px', fontWeight: 700, background: opt.color }}>
                {opt.name.split(' ')[0]}: +{s.toFixed(1)}
              </span>
            ) : null;
          })}
          <motion.div animate={{ rotate: open ? 180 : 0 }} className="ml-1">
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-3 py-3 space-y-2">
              {options.map(opt => {
                const s = bd.optionScores[opt.id] ?? 0;
                return (
                  <div key={opt.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                    <span style={{ flex: 1, fontSize: '12px', color: '#4B5563', fontWeight: 500 }}>
                      {opt.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${s * 10}%`, background: opt.color }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: opt.color, minWidth: '32px', textAlign: 'right' }}>
                        {s > 0 ? `+${s.toFixed(1)}` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export function UserResultsScreen() {
  const { questionnaire, userSession, goEditWeights, resetAll, scoringResult } = useQuestionnaire();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAnswerExplain, setShowAnswerExplain] = useState(false);
  const [activeScoreOpt, setActiveScoreOpt] = useState<string | null>(null);

  const result: ScoringResult = useMemo(
    () => scoringResult || computeScores(questionnaire, userSession),
    [scoringResult, questionnaire, userSession],
  );

  const { scores, answerBreakdowns } = result;
  const winner = scores[0];

  // ─── Charts data ──────────────────────────────────────────────────────────
  const barData = scores.map(s => ({
    name: s.option.name.split(' ')[0],
    fullName: s.option.name,
    score: parseFloat(s.finalScore.toFixed(2)),
    color: s.option.color,
  }));

  const radarData = questionnaire.categories.map(cat => {
    const entry: Record<string, string | number> = {
      subject: cat.name.length > 9 ? cat.name.slice(0, 9) + '…' : cat.name,
    };
    scores.forEach(s => {
      const c = s.contributions.find(ct => ct.categoryId === cat.id);
      entry[s.option.name] = c ? parseFloat(c.avgScore.toFixed(1)) : 0;
    });
    return entry;
  });

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Hero */}
      <div className="relative overflow-hidden px-5 pt-10 pb-8"
        style={{ background: 'linear-gradient(140deg, #312E81 0%, #4F46E5 50%, #7C3AED 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 -translate-y-14 translate-x-14" />
        <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/10 translate-y-10 -translate-x-8" />

        <div className="flex items-center justify-between relative z-10 mb-5">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
            className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center shadow-lg">
            <Trophy className="w-6 h-6 text-yellow-800" />
          </motion.div>
          <UserStepDots current={3} />
        </div>

        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <h1 className="text-white mb-0.5" style={{ fontSize: '22px', fontWeight: 800 }}>Your Results</h1>
          <p className="text-indigo-300" style={{ fontSize: '12px' }}>{questionnaire.title}</p>
        </motion.div>

        {winner && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
            className="mt-4 bg-white/15 backdrop-blur rounded-2xl px-4 py-3 flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{ background: winner.option.color, fontSize: '12px', fontWeight: 700 }}>
              {winner.option.initials}
            </div>
            <div className="flex-1">
              <p className="text-indigo-200" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Top Match
              </p>
              <p className="text-white" style={{ fontWeight: 700, fontSize: '15px' }}>
                {winner.option.name}
              </p>
            </div>
            <div className="text-right">
              <p style={{ fontSize: '28px', fontWeight: 800, color: '#FCD34D', lineHeight: 1 }}>
                {(winner.finalScore * 10).toFixed(0)}%
              </p>
              <p className="text-indigo-300" style={{ fontSize: '10px' }}>your weighted score</p>
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Rankings */}
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-400" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Ranking
            </p>
            <button onClick={goEditWeights}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-500 border border-indigo-100"
              style={{ fontSize: '11px', fontWeight: 600 }}>
              <Edit3 className="w-3 h-3" /> Adjust Weights
            </button>
          </div>

          <div className="space-y-3">
            {scores.map((s, i) => {
              const pct = (s.finalScore * 10).toFixed(0);
              const isActive = activeScoreOpt === s.option.id;
              return (
                <motion.div key={s.option.id}
                  initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}
                  className="rounded-2xl overflow-hidden border-2 cursor-pointer transition-all"
                  style={{ borderColor: isActive ? s.option.color : '#F3F4F6' }}
                  onClick={() => setActiveScoreOpt(isActive ? null : s.option.id)}>
                  <div className="p-4" style={{ background: isActive ? s.option.color + '06' : 'white' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl flex-shrink-0">{MEDALS[i] ?? '🏅'}</span>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                        style={{ background: s.option.color, fontSize: '11px', fontWeight: 700 }}>
                        {s.option.initials}
                      </div>
                      <div className="flex-1">
                        <p style={{ fontWeight: 700, fontSize: '14px', color: '#1E1B4B' }}>{s.option.name}</p>
                        <p style={{ fontSize: '11px', color: '#9CA3AF' }}>Rank #{i + 1}</p>
                      </div>
                      <div className="text-right">
                        <p style={{ fontWeight: 800, fontSize: '20px', color: s.option.color, lineHeight: 1 }}>
                          {pct}%
                        </p>
                        <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{s.finalScore.toFixed(2)}/10</p>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${parseFloat(pct)}%` }}
                        transition={{ duration: 0.8, delay: 0.4 + i * 0.15, ease: 'easeOut' }}
                        style={{ background: s.option.color }} />
                    </div>

                    {/* Category contributions (collapsed by default) */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="mt-3 space-y-2">
                            <p className="text-gray-400" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                              Category Breakdown
                            </p>
                            {s.contributions.length === 0 && (
                              <p className="text-gray-400" style={{ fontSize: '12px' }}>No categories answered yet</p>
                            )}
                            {s.contributions.map(c => (
                              <div key={c.categoryId}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <span style={{ fontSize: '12px' }}>{c.icon}</span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563' }}>{c.name}</span>
                                    <span className="px-1.5 py-0.5 rounded-full text-white"
                                      style={{ fontSize: '9px', background: c.color }}>
                                      {Math.round(c.weight)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                                      avg {c.avgScore.toFixed(1)}/10
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: c.color }}>
                                      {c.shareOfTotal.toFixed(0)}% of score
                                    </span>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${c.avgScore * 10}%`, background: c.color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bar chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="mx-5 my-4 bg-gray-50 rounded-2xl p-4">
          <h3 style={{ fontWeight: 700, fontSize: '14px', color: '#1E1B4B', marginBottom: '12px' }}>
            📊 Score Comparison
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false} tickLine={false} width={18} />
              <Tooltip
                cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                formatter={(value: number, _: string, props: any) => [
                  `${(value * 10).toFixed(0)}%  (${value.toFixed(2)}/10)`,
                  props.payload?.fullName,
                ]}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
              />
              <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={64}>
                {barData.map((entry, idx) => <Cell key={`c-${idx}`} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Category breakdown (radar + table) */}
        <div className="mx-5 mb-4">
          <button onClick={() => setShowBreakdown(p => !p)}
            className="w-full flex items-center justify-between py-3.5 px-4 bg-indigo-50 rounded-2xl">
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#6366F1' }}>🕸 Category Breakdown</span>
            <motion.div animate={{ rotate: showBreakdown ? 180 : 0 }}>
              <ChevronDown className="w-4 h-4 text-indigo-400" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showBreakdown && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="bg-gray-50 rounded-2xl mt-2 p-4">
                <ResponsiveContainer width="100%" height={230}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                    {questionnaire.options.map(opt => (
                      <Radar key={opt.id} name={opt.name} dataKey={opt.name}
                        stroke={opt.color} fill={opt.color} fillOpacity={0.15} strokeWidth={2} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                    <Tooltip
                      formatter={(v: number) => [`${(v * 10).toFixed(0)}% (avg ${v.toFixed(1)}/10)`]}
                      contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>

                {/* Score table */}
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-3 sticky left-0 bg-gray-50"
                          style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                          Category
                        </th>
                        {questionnaire.options.map(opt => (
                          <th key={opt.id} className="text-center py-2 px-1"
                            style={{ fontSize: '10px', color: opt.color, fontWeight: 700 }}>
                            {opt.name.split(' ')[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {questionnaire.categories.map(cat => (
                        <tr key={cat.id} className="border-t border-gray-100">
                          <td className="py-2 pr-3 sticky left-0 bg-gray-50">
                            <div className="flex items-center gap-1.5">
                              <span style={{ fontSize: '11px' }}>{cat.icon}</span>
                              <span style={{ fontSize: '11px', color: '#4B5563', fontWeight: 500 }}>{cat.name}</span>
                            </div>
                          </td>
                          {scores.map(s => {
                            const c = s.contributions.find(ct => ct.categoryId === cat.id);
                            return (
                              <td key={s.option.id} className="text-center py-2 px-1">
                                {c ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-white"
                                    style={{ background: s.option.color, fontSize: '10px', fontWeight: 700 }}>
                                    {(c.avgScore * 10).toFixed(0)}%
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10px', color: '#D1D5DB' }}>—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Weight summary */}
        <div className="mx-5 mb-4 bg-indigo-50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#4338CA' }}>Your Weights Used</p>
            </div>
            <button onClick={goEditWeights}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-500"
              style={{ fontSize: '11px', fontWeight: 600 }}>
              <Edit3 className="w-3 h-3" /> Edit
            </button>
          </div>
          <div className="space-y-2">
            {questionnaire.categories.map(cat => {
              const w = userSession.weights.find(wt => wt.categoryId === cat.id)?.weight ?? 0;
              return (
                <div key={cat.id} className="flex items-center gap-2">
                  <span style={{ fontSize: '12px' }}>{cat.icon}</span>
                  <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: '#1E1B4B' }}>{cat.name}</span>
                  <div className="h-1.5 w-24 bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: cat.color }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: cat.color, minWidth: '36px', textAlign: 'right' }}>
                    {Math.round(w)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 🔍 Answer Explanation */}
        <div className="mx-5 mb-4">
          <button onClick={() => setShowAnswerExplain(p => !p)}
            className="w-full flex items-center justify-between py-3.5 px-4 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' }}>
            <div className="flex items-center gap-2">
              <span>🔍</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#92400E' }}>Explain My Scores</span>
            </div>
            <motion.div animate={{ rotate: showAnswerExplain ? 180 : 0 }}>
              <ChevronDown className="w-4 h-4 text-amber-400" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showAnswerExplain && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="mt-2 space-y-3">
                {/* Group by category */}
                {questionnaire.categories.map(cat => {
                  const catBds = answerBreakdowns.filter(bd => bd.categoryId === cat.id);
                  if (catBds.length === 0) return null;
                  const catWeight = userSession.weights.find(w => w.categoryId === cat.id)?.weight ?? 0;
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span style={{ fontSize: '14px' }}>{cat.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: cat.color }}>{cat.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-white"
                          style={{ fontSize: '10px', background: cat.color }}>
                          {Math.round(catWeight)}% weight
                        </span>
                        {/* Category contribution for winner */}
                        {winner && (() => {
                          const contrib = winner.contributions.find(c => c.categoryId === cat.id);
                          return contrib ? (
                            <span className="text-gray-400 ml-auto" style={{ fontSize: '10px' }}>
                              → {contrib.shareOfTotal.toFixed(0)}% of {winner.option.name.split(' ')[0]}'s score
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="space-y-2">
                        {catBds.map(bd => (
                          <AnswerRow key={bd.questionId} bd={bd} options={questionnaire.options} />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Scoring formula note */}
                <div className="bg-gray-50 rounded-xl p-3 flex gap-2">
                  <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-500" style={{ fontSize: '11px', lineHeight: 1.5 }}>
                    Each question's raw scores are averaged per category, then multiplied by your category weight.
                    Scores are normalized so the final percentage = weighted average / max possible × 100.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Verdict */}
        {winner && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
            className="mx-5 mb-5 rounded-2xl p-4"
            style={{ background: 'linear-gradient(135deg, #F5F3FF, #EEF2FF)' }}>
            <p className="text-indigo-400 mb-1"
              style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Verdict (based on your weights)
            </p>
            <p style={{ fontWeight: 700, fontSize: '15px', color: '#1E1B4B' }}>
              🏆 <span style={{ color: winner.option.color }}>{winner.option.name}</span> fits your priorities
            </p>
            {winner.contributions.length > 0 && (
              <p className="text-gray-500 mt-1" style={{ fontSize: '12px', lineHeight: 1.5 }}>
                Led by{' '}
                {winner.contributions
                  .sort((a, b) => b.shareOfTotal - a.shareOfTotal)
                  .slice(0, 2)
                  .map((c, i) => (
                    <span key={c.categoryId}>
                      {i > 0 && ' & '}
                      <span style={{ color: c.color, fontWeight: 600 }}>
                        {c.name} ({c.shareOfTotal.toFixed(0)}%)
                      </span>
                    </span>
                  ))}
                {scores.length > 1 && ` — ${((winner.finalScore - scores[1].finalScore) * 10).toFixed(0)}pts ahead of ${scores[1].option.name.split(' ')[0]}.`}
              </p>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <div className="px-5 pb-10 space-y-3">
          <motion.button whileTap={{ scale: 0.97 }} onClick={goEditWeights}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 border-2 border-indigo-200 bg-white text-indigo-500"
            style={{ fontSize: '14px', fontWeight: 700 }}>
            <Edit3 className="w-4 h-4" /> Adjust Weights & Recompute
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={resetAll}
            className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-gray-400"
            style={{ fontSize: '13px', fontWeight: 600 }}>
            <RotateCcw className="w-3.5 h-3.5" /> Back to Home
          </motion.button>
        </div>
      </div>
    </div>
  );
}
