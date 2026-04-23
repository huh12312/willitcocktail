import { useState } from 'react';
import { PantryPanel } from './components/PantryPanel';
import { MatchesPanel } from './components/MatchesPanel';
import { AskPanel } from './components/AskPanel';
import { RecipesPanel } from './components/RecipesPanel';
import { RecipeModal } from './components/RecipeModal';
import { LlmSettings } from './components/LlmSettings';
import { DataProvider } from './data/DataProvider';
import { usePantry } from './store/pantry';
import { activeProviderId } from './llm';

type Tab = 'matches' | 'pantry' | 'ask' | 'recipes';

export default function App() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

function AppShell() {
  const [tab, setTab] = useState<Tab>('pantry');
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pantryCount = usePantry((s) => s.ingredients.length);

  return (
    <div className="min-h-full max-w-4xl mx-auto p-4 sm:p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-100">
              Will It Cocktail
            </h1>
            <MartiniIcon className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400/75 flex-shrink-0" />
          </div>
          <p className="text-xs text-amber-400/70 mt-0.5">
            What can you make right now?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-amber-400/60">
            {pantryCount} ingredient{pantryCount === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-amber-700/40 px-2.5 py-1.5 text-xs text-amber-300/80 hover:border-amber-500 hover:text-amber-200 transition"
            aria-label="LLM settings"
            title={`LLM: ${activeProviderId()}`}
          >
            ⚙ {{ 'litert-lm': 'On Device', 'cloud': 'Cloud', 'heuristic': 'Heuristic' }[activeProviderId()]}
          </button>
        </div>
      </header>

      <nav className="flex gap-1 mb-6 bg-amber-900/30 rounded-lg p-1">
        <TabButton active={tab === 'pantry'} onClick={() => setTab('pantry')}>
          Pantry
        </TabButton>
        <TabButton active={tab === 'matches'} onClick={() => setTab('matches')}>
          Matches
        </TabButton>
        <TabButton active={tab === 'ask'} onClick={() => setTab('ask')}>
          Ask
        </TabButton>
        <TabButton active={tab === 'recipes'} onClick={() => setTab('recipes')}>
          Recipes
        </TabButton>
      </nav>

      <main>
        {tab === 'pantry' && <PantryPanel />}
        {tab === 'matches' && <MatchesPanel onSelect={setSelectedRecipe} />}
        {tab === 'ask' && <AskPanel onSelect={setSelectedRecipe} />}
        {tab === 'recipes' && <RecipesPanel onSelect={setSelectedRecipe} />}
      </main>

      <RecipeModal recipeId={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      <LlmSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <footer className="mt-12 pt-6 border-t border-amber-800/30 text-xs text-amber-400/50 text-center">
        Know your bar. Own every pour.
      </footer>
    </div>
  );
}

function MartiniIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Rim — slight arch */}
      <path d="M2 7 Q16 5 30 7" />
      {/* Bowl sides */}
      <line x1="2" y1="7" x2="16" y2="22" />
      <line x1="30" y1="7" x2="16" y2="22" />
      {/* Stem — gentle curve */}
      <path d="M16 22 C15.5 25 16.5 26 16 29" />
      {/* Base — slight curve */}
      <path d="M9 29 Q16 30.5 23 29" />
      {/* Pick — diagonal, exits above rim */}
      <line x1="12" y1="16" x2="23" y2="5" />
      {/* Curl at tip of pick */}
      <path d="M23 5 C25 2 28 3 26 6" />
      {/* Two olive rings on the pick */}
      <circle cx="14" cy="14" r="2.5" />
      <circle cx="17" cy="11" r="2.5" />
    </svg>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 px-4 py-2 text-sm font-medium rounded-md transition',
        active
          ? 'bg-amber-500 text-amber-950'
          : 'text-amber-200 hover:bg-amber-800/40',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
