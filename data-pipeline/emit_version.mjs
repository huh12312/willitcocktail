#!/usr/bin/env node
// Emit public/db-version.json alongside the pre-built cocktails.db.
// The client uses this to decide whether to pull a newer snapshot from the
// sync endpoint. `version` matches the integer unix timestamp written into
// the db_meta table by build_db.py, which ensures the file and the SQLite
// metadata never drift.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(here, '..', 'public', 'cocktails.db');
const outPath = resolve(here, '..', 'public', 'db-version.json');

async function readDbVersion(buffer) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(buffer));
  try {
    const res = db.exec("SELECT value FROM db_meta WHERE key='version'");
    if (!res.length || !res[0].values.length) {
      throw new Error('db_meta.version not found — rebuild cocktails.db');
    }
    return String(res[0].values[0][0]);
  } finally {
    db.close();
  }
}

async function main() {
  const buffer = readFileSync(dbPath);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const version = await readDbVersion(buffer);

  const payload = {
    version,
    sha256,
    size: buffer.length,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(`  version=${version} size=${buffer.length} sha256=${sha256.slice(0, 12)}…`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
