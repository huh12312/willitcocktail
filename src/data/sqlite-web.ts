import initSqlJs, { type Database } from 'sql.js';
import type { Ingredient, IngredientAlias, Recipe, Substitute } from '../types';
import { buildDataIndex, type DataIndex } from './index';
import { readInstalledSnapshot, clearInstalledSnapshot, compareVersions } from './snapshot';

export interface SqliteLoadOptions {
  dbUrl?: string;
  wasmUrl?: string;
}

// Promise cache rather than a value cache: a value cache allows two concurrent
// callers to both clear the null-check before either resolves, resulting in
// duplicate fetches and two competing sql.js instances.
let dbPromise: Promise<Database> | null = null;

function openDb(opts: SqliteLoadOptions = {}): Promise<Database> {
  // Bypass the cache for non-default URLs (test paths) so tests stay isolated.
  if (opts.dbUrl || opts.wasmUrl) return _openDb(opts);
  return (dbPromise ??= _openDb(opts));
}

async function _openDb(opts: SqliteLoadOptions = {}): Promise<Database> {
  const wasmUrl = opts.wasmUrl ?? '/sql-wasm.wasm';
  const dbUrl = opts.dbUrl ?? '/cocktails.db';

  const SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });

  // Prefer a user-installed snapshot over the bundled DB, but only when it's
  // not older than the bundled DB. After a local `npm run pipeline` the
  // bundled DB version advances; without this check the stale IDB copy wins.
  const [installed, bundledMeta] = await Promise.all([
    readInstalledSnapshot(),
    fetch('/db-version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ version: string }>) : null))
      .catch(() => null),
  ]);
  if (installed) {
    const bundledVersion = bundledMeta?.version ?? null;
    if (!bundledVersion || compareVersions(installed.version, bundledVersion) >= 0) {
      return new SQL.Database(installed.bytes);
    }
    // Bundled DB is newer — discard the stale IDB snapshot so the next
    // cold-start sync starts from the correct baseline.
    await clearInstalledSnapshot();
  }

  const response = await fetch(dbUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch cocktails DB: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}

function rowsToObjects<T>(db: Database, sql: string): T[] {
  const stmt = db.prepare(sql);
  const out: T[] = [];
  try {
    while (stmt.step()) {
      out.push(stmt.getAsObject() as unknown as T);
    }
  } finally {
    stmt.free();
  }
  return out;
}

export async function loadDataIndexFromSqlite(
  opts: SqliteLoadOptions = {},
): Promise<DataIndex> {
  const db = await openDb(opts);

  type IngRow = { id: string; name: string; category: string; parent_id: string | null };
  type AliasRow = { alias: string; ingredient_id: string };
  type SubRow = { ingredient_id: string; substitute_id: string; strength: number; notes: string | null };
  type RecipeRow = {
    id: string;
    name: string;
    family: string;
    method: string;
    glass: string;
    garnish: string | null;
    instructions: string;
    abv: number | null;
    iba_official: number;
    source: string;
  };
  type RecipeIngRow = {
    recipe_id: string;
    ingredient_id: string;
    amount_ml: number | null;
    amount_display: string;
    optional: number;
    position: number;
    notes: string | null;
  };

  const ingredientRows = rowsToObjects<IngRow>(db, 'SELECT id, name, category, parent_id FROM ingredients');
  const ingredients: Ingredient[] = ingredientRows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as Ingredient['category'],
    parentId: r.parent_id ?? undefined,
  }));

  const aliasRows = rowsToObjects<AliasRow>(db, 'SELECT alias, ingredient_id FROM ingredient_aliases');
  const aliases: IngredientAlias[] = aliasRows.map((r) => ({
    alias: r.alias,
    ingredientId: r.ingredient_id,
  }));

  const subRows = rowsToObjects<SubRow>(
    db,
    'SELECT ingredient_id, substitute_id, strength, notes FROM substitutes',
  );
  const substitutes: Substitute[] = subRows.map((r) => ({
    ingredientId: r.ingredient_id,
    substituteId: r.substitute_id,
    strength: r.strength,
    notes: r.notes ?? undefined,
  }));

  const recipeRows = rowsToObjects<RecipeRow>(
    db,
    'SELECT id, name, family, method, glass, garnish, instructions, abv, iba_official, source FROM recipes',
  );
  const riRows = rowsToObjects<RecipeIngRow>(
    db,
    'SELECT recipe_id, ingredient_id, amount_ml, amount_display, optional, position, notes FROM recipe_ingredients ORDER BY recipe_id, position',
  );
  const byRecipe = new Map<string, RecipeIngRow[]>();
  for (const r of riRows) {
    const arr = byRecipe.get(r.recipe_id) ?? [];
    arr.push(r);
    byRecipe.set(r.recipe_id, arr);
  }

  const recipes: Recipe[] = recipeRows.map((r) => ({
    id: r.id,
    name: r.name,
    family: r.family as Recipe['family'],
    method: r.method as Recipe['method'],
    glass: r.glass as Recipe['glass'],
    garnish: r.garnish ?? undefined,
    instructions: r.instructions,
    abv: r.abv ?? undefined,
    ibaOfficial: r.iba_official === 1,
    source: r.source as Recipe['source'],
    ingredients: (byRecipe.get(r.id) ?? []).map((ri) => ({
      ingredientId: ri.ingredient_id,
      amountMl: ri.amount_ml ?? undefined,
      amountDisplay: ri.amount_display,
      optional: ri.optional === 1,
      position: ri.position,
      notes: ri.notes ?? undefined,
    })),
  }));

  return buildDataIndex(ingredients, aliases, substitutes, recipes);
}

export async function getDbMeta(opts: SqliteLoadOptions = {}): Promise<Record<string, string>> {
  const db = await openDb(opts);
  const rows = rowsToObjects<{ key: string; value: string }>(
    db,
    'SELECT key, value FROM db_meta',
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
