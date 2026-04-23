import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { Ingredient, IngredientAlias, Recipe, Substitute } from '../types';
import { buildDataIndex, type DataIndex } from './index';

const DB_NAME = 'cocktails';
// cocktails.db ships in android/app/src/main/assets/databases/ and is copied
// to the app's database directory on first launch via copyFromAssets().

let connectionCache: SQLiteDBConnection | null = null;

async function openNativeDb(): Promise<SQLiteDBConnection> {
  if (connectionCache) return connectionCache;

  const sqlite = new SQLiteConnection(CapacitorSQLite);

  // Copies bundled DBs from assets/databases/ into the app's DB dir on first
  // launch. No-op on subsequent launches when the DB is already installed.
  await sqlite.copyFromAssets(false);

  const ret = await sqlite.checkConnectionsConsistency();
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

  let db: SQLiteDBConnection;
  if (ret.result && isConn) {
    db = await sqlite.retrieveConnection(DB_NAME, false);
  } else {
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  }
  await db.open();
  connectionCache = db;
  return db;
}

async function queryAll<T>(db: SQLiteDBConnection, sql: string): Promise<T[]> {
  const res = await db.query(sql);
  return (res.values ?? []) as T[];
}

export async function loadDataIndexFromNativeSqlite(): Promise<DataIndex> {
  const db = await openNativeDb();

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

  const ingredientRows = await queryAll<IngRow>(
    db,
    'SELECT id, name, category, parent_id FROM ingredients',
  );
  const ingredients: Ingredient[] = ingredientRows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as Ingredient['category'],
    parentId: r.parent_id ?? undefined,
  }));

  const aliasRows = await queryAll<AliasRow>(
    db,
    'SELECT alias, ingredient_id FROM ingredient_aliases',
  );
  const aliases: IngredientAlias[] = aliasRows.map((r) => ({
    alias: r.alias,
    ingredientId: r.ingredient_id,
  }));

  const subRows = await queryAll<SubRow>(
    db,
    'SELECT ingredient_id, substitute_id, strength, notes FROM substitutes',
  );
  const substitutes: Substitute[] = subRows.map((r) => ({
    ingredientId: r.ingredient_id,
    substituteId: r.substitute_id,
    strength: r.strength,
    notes: r.notes ?? undefined,
  }));

  const recipeRows = await queryAll<RecipeRow>(
    db,
    'SELECT id, name, family, method, glass, garnish, instructions, abv, iba_official, source FROM recipes',
  );
  const riRows = await queryAll<RecipeIngRow>(
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

export async function getDbMeta(): Promise<Record<string, string>> {
  const db = await openNativeDb();
  const rows = await queryAll<{ key: string; value: string }>(
    db,
    'SELECT key, value FROM db_meta',
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
