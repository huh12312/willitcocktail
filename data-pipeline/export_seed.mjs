#!/usr/bin/env node
// Exports TS seed data to JSON so the Python pipeline has a stable input
// without needing to parse TypeScript. Run via `npm run pipeline:export`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Use esbuild (installed transitively via vite) to transpile the TS modules
// on-the-fly into an importable JS module.
const esbuild = require('esbuild');

async function loadTsModule(relPath) {
  const abs = resolve(here, '..', relPath);
  const result = await esbuild.build({
    entryPoints: [abs],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    write: false,
    external: [],
  });
  const tmp = resolve(here, `.tmp-${Date.now()}.mjs`);
  writeFileSync(tmp, result.outputFiles[0].text);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    // leave the tmp file; .gitignore excludes it
  }
}

async function main() {
  const ingredientsMod = await loadTsModule('src/data/ingredients.ts');
  const recipesMod = await loadTsModule('src/data/recipes.ts');

  const payload = {
    ingredients: ingredientsMod.INGREDIENTS,
    aliases: ingredientsMod.INGREDIENT_ALIASES,
    substitutes: ingredientsMod.SUBSTITUTES,
    recipes: recipesMod.RECIPES,
    exportedAt: new Date().toISOString(),
  };

  const outDir = resolve(here);
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'seed.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(
    `  ${payload.ingredients.length} ingredients, ${payload.aliases.length} aliases, ${payload.substitutes.length} substitutes, ${payload.recipes.length} recipes`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
