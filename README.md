# Will It Cocktail

Offline-first cocktail app. Capacitor + React + Vite + SQLite, with an
LLM layer for fuzzy pantry intent and grammar-constrained recipe
generation.

## Development

```
npm install
npm run dev            # vite web server
npm run test           # vitest
npm run typecheck
npm run build
```

## Data pipeline

The `public/cocktails.db` snapshot and `public/db-version.json`
manifest are both generated from `src/data/{ingredients,recipes}.ts`
via the pipeline:

```
npm run pipeline        # export → build db → emit version
npm run pipeline:export # only re-dump seed.json
npm run pipeline:build  # only rebuild cocktails.db from seed.json
npm run pipeline:version # only refresh db-version.json
```

The `db_meta.version` column (unix seconds) and `db-version.json` are
written from the same pipeline run and always agree — the version
string is a content hash key, not a human version.

## Phase 5 — snapshot sync

The app ships with a bundled `cocktails.db` (zero-network fallback).
When `VITE_SNAPSHOT_URL` is set at build time, the web client also
checks that URL on cold start for a newer `db-version.json`, verifies
the `.db` sha256, stashes it in IndexedDB, and uses it on the next
cold start (a chip in settings prompts the user to reload).

### Publisher: GitHub Pages

The `publish-db.yml` workflow runs weekly (and on manual dispatch),
rebuilds the DB, and deploys `cocktails.db` + `db-version.json` as a
Pages site.

To activate:

1. **Repo visibility.** Pages on private repos requires a GitHub Team
   or Enterprise plan. Either flip this repo public, or swap the
   `actions/deploy-pages` step for an rsync/R2/S3 uploader.
2. **Enable Pages.** In GitHub → Settings → Pages → **Source: GitHub
   Actions**.
3. **Set the client URL.** When building the web app:
   ```
   VITE_SNAPSHOT_URL=https://<user>.github.io/<repo> npm run build
   ```
   The client will hit `${URL}/db-version.json` and
   `${URL}/cocktails.db`.

### Alternative publishers

`src/data/snapshot.ts` only needs two files served at a known base URL:

- `db-version.json` — `{ version, sha256, size, builtAt }`
- `cocktails.db` — raw SQLite bytes, must match the manifest

So any static host (Cloudflare R2, S3 + CloudFront, Netlify) works.
Replace the `deploy` job in `.github/workflows/publish-db.yml` with
the publisher of your choice — the `build` job's artifact is a
ready-to-upload directory.

### Native (Android) behaviour

V1 of the snapshot sync is **web-only**. Capacitor native builds
keep using the DB asset baked into the APK. Recipe updates reach
Android users via a Play Store update; the pipeline that produces
the APK also rebuilds the snapshot so bundled and published stay in
step.
