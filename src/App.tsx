import { useState } from 'react';
import { PantryPanel } from './components/PantryPanel';
import { MatchesPanel } from './components/MatchesPanel';
import { AskPanel } from './components/AskPanel';
import { CreatePanel } from './components/CreatePanel';
import { RecipeModal } from './components/RecipeModal';
import { LlmSettings } from './components/LlmSettings';
import { DataProvider } from './data/DataProvider';
import { usePantry } from './store/pantry';
import { activeProviderId } from './llm';

type Tab = 'matches' | 'pantry' | 'ask' | 'create';

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-100">
            Will It Cocktail
          </h1>
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
            ⚙ {activeProviderId()}
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
        <TabButton active={tab === 'create'} onClick={() => setTab('create')}>
          Create
        </TabButton>
      </nav>

      <main>
        {tab === 'pantry' && <PantryPanel />}
        {tab === 'matches' && <MatchesPanel onSelect={setSelectedRecipe} />}
        {tab === 'ask' && <AskPanel onSelect={setSelectedRecipe} />}
        {tab === 'create' && <CreatePanel onSelect={setSelectedRecipe} />}
      </main>

      <RecipeModal recipeId={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      <LlmSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <footer className="mt-12 pt-6 border-t border-amber-800/30 text-xs text-amber-400/50 text-center">
        Phase 4 — SQLite-backed · IBA seed corpus · grammar-based invent mode
      </footer>
    </div>
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
