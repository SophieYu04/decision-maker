import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QuestionnaireProvider, useQuestionnaire } from './context/QuestionnaireContext';
import { HomeScreen } from './screens/HomeScreen';
// Creator screens
import { CreatorSetupScreen } from './screens/creator/CreatorSetupScreen';
import { CreatorOptionsScreen } from './screens/creator/CreatorOptionsScreen';
import { CreatorCategoriesScreen } from './screens/creator/CreatorCategoriesScreen';
import { CreatorQuestionsScreen } from './screens/creator/CreatorQuestionsScreen';
import { CreatorReadyScreen } from './screens/creator/CreatorReadyScreen';
// User screens
import { UserIntroScreen } from './screens/user/UserIntroScreen';
import { UserWeightScreen } from './screens/user/UserWeightScreen';
import { UserAnswerScreen } from './screens/user/UserAnswerScreen';
import { UserResultsScreen } from './screens/user/UserResultsScreen';

const CREATOR_SCREENS = [
  CreatorSetupScreen,
  CreatorOptionsScreen,
  CreatorCategoriesScreen,
  CreatorQuestionsScreen,
  CreatorReadyScreen,
];

const USER_SCREENS = [
  UserIntroScreen,
  UserWeightScreen,
  UserAnswerScreen,
  UserResultsScreen,
];

function AppContent() {
  const { mode, creatorStep, userStep, loadDecision, startUserFlow, isLoading, error } = useQuestionnaire();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    const search = new URLSearchParams(window.location.search);
    const did = search.get('decision_id');
    if (did) {
      const idNum = parseInt(did);
      if (!isNaN(idNum)) {
        loadDecision(idNum).then(() => {
          startUserFlow(false);
        });
      }
    }
  }, [loadDecision, startUserFlow]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="mt-4 text-indigo-900 font-medium">Loading decision...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-red-500 mb-2">⚠️</div>
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={() => window.location.href = '/'} className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-semibold">
          Go Home
        </button>
      </div>
    );
  }

  let Screen: React.ComponentType;
  let stepKey: string;

  if (mode === 'creator') {
    Screen = CREATOR_SCREENS[creatorStep] ?? CREATOR_SCREENS[0];
    stepKey = `creator-${creatorStep}`;
  } else if (mode === 'user') {
    Screen = USER_SCREENS[userStep] ?? USER_SCREENS[0];
    stepKey = `user-${userStep}`;
  } else {
    Screen = HomeScreen;
    stepKey = 'home';
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -28 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex flex-col min-h-full"
      >
        <Screen />
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <QuestionnaireProvider>
      <div
        className="min-h-screen sm:flex sm:items-center sm:justify-center sm:p-6"
        style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 50%, #FDF4FF 100%)' }}
      >
        {/* Phone frame */}
        <div
          className="relative w-full sm:w-[390px] min-h-screen sm:min-h-0 sm:h-[844px] bg-white sm:rounded-[44px] overflow-hidden flex flex-col"
          style={{ boxShadow: '0 40px 80px rgba(99,102,241,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        >
          {/* Status bar (desktop only) */}
          <div
            className="hidden sm:flex items-center justify-between px-7 pt-3 pb-1 flex-shrink-0 bg-white"
            style={{ height: '44px' }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E1B4B' }}>9:41</span>
            <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-[90px] h-[22px] bg-black rounded-full" />
            <div className="flex items-center gap-1">
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                {[2, 4, 6, 8].map((h, i) => (
                  <rect key={i} x={i * 3.5} y={10 - h} width="2.5" height={h} rx="1"
                    fill={i < 3 ? '#1E1B4B' : '#D1D5DB'} />
                ))}
              </svg>
              <svg width="22" height="11" viewBox="0 0 22 11">
                <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="#1E1B4B" />
                <rect x="19.5" y="3.5" width="2" height="4" rx="1" fill="#1E1B4B" />
                <rect x="2" y="2" width="13" height="7" rx="1.5" fill="#1E1B4B" />
              </svg>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            <AppContent />
          </div>

          {/* Home indicator (desktop only) */}
          <div className="hidden sm:flex items-center justify-center pb-2 pt-1 flex-shrink-0 bg-white">
            <div className="w-28 h-1 bg-gray-200 rounded-full" />
          </div>
        </div>

        <div className="hidden sm:block absolute bottom-4 left-0 right-0 text-center pointer-events-none">
          <p style={{ fontSize: '12px', color: '#A5B4FC' }}>DecideIQ · Personalized Decision Scoring</p>
        </div>
      </div>
    </QuestionnaireProvider>
  );
}
