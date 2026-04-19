#!/usr/bin/env python3
"""Build cocktails.db from seed.json (and optionally external sources).

Design mirrors the schema in approach.md §5. Pipeline is idempotent: it
always re-creates the database from scratch so the artifact is fully
determined by the input sources.

Usage:
    python3 build_db.py                       # seed only (fast, offline)
    python3 build_db.py --enrich-iba          # also pull IBA GitHub JSON
    python3 build_db.py --out ../public/cocktails.db
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sqlite3
import sys
import time
from typing import Any, Iterable

HERE = pathlib.Path(__file__).parent
DEFAULT_SEED = HERE / "seed.json"
DEFAULT_OUT = HERE.parent / "public" / "cocktails.db"

SCHEMA = """
CREATE TABLE ingredients (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    category  TEXT NOT NULL,
    parent_id TEXT REFERENCES ingredients(id)
);

CREATE TABLE ingredient_aliases (
    alias         TEXT PRIMARY KEY,
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id)
);

CREATE TABLE substitutes (
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
    substitute_id TEXT NOT NULL REFERENCES ingredients(id),
    strength      REAL NOT NULL,
    notes         TEXT,
    PRIMARY KEY (ingredient_id, substitute_id)
);

CREATE TABLE recipes (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    family        TEXT NOT NULL,
    method        TEXT NOT NULL,
    glass         TEXT NOT NULL,
    garnish       TEXT,
    instructions  TEXT NOT NULL,
    abv           REAL,
    calories      INTEGER,
    source        TEXT NOT NULL,
    iba_official  INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL
);

CREATE TABLE recipe_ingredients (
    recipe_id      TEXT NOT NULL REFERENCES recipes(id),
    ingredient_id  TEXT NOT NULL REFERENCES ingredients(id),
    amount_ml      REAL,
    amount_display TEXT NOT NULL,
    optional       INTEGER NOT NULL DEFAULT 0,
    position       INTEGER NOT NULL,
    notes          TEXT,
    PRIMARY KEY (recipe_id, ingredient_id, position)
);

CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_aliases_ingredient ON ingredient_aliases(ingredient_id);
CREATE INDEX idx_substitutes_ingredient ON substitutes(ingredient_id);

-- Metadata about this snapshot. Client uses `version` to decide whether to
-- pull a new snapshot from the sync backend (Phase 5).
CREATE TABLE db_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def load_seed(path: pathlib.Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def create_db(path: pathlib.Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    return conn


def insert_ingredients(conn: sqlite3.Connection, rows: Iterable[dict[str, Any]]) -> int:
    count = 0
    for row in rows:
        conn.execute(
            "INSERT INTO ingredients (id, name, category, parent_id) VALUES (?, ?, ?, ?)",
            (row["id"], row["name"], row["category"], row.get("parentId")),
        )
        count += 1
    return count


def insert_aliases(conn: sqlite3.Connection, rows: Iterable[dict[str, Any]]) -> int:
    count = 0
    for row in rows:
        conn.execute(
            "INSERT OR IGNORE INTO ingredient_aliases (alias, ingredient_id) VALUES (?, ?)",
            (row["alias"].lower(), row["ingredientId"]),
        )
        count += 1
    return count


def insert_substitutes(conn: sqlite3.Connection, rows: Iterable[dict[str, Any]]) -> int:
    count = 0
    for row in rows:
        conn.execute(
            "INSERT INTO substitutes (ingredient_id, substitute_id, strength, notes) VALUES (?, ?, ?, ?)",
            (row["ingredientId"], row["substituteId"], row["strength"], row.get("notes")),
        )
        count += 1
    return count


def insert_recipes(conn: sqlite3.Connection, rows: Iterable[dict[str, Any]]) -> tuple[int, int]:
    now = int(time.time())
    recipes = 0
    ingredients = 0
    for r in rows:
        conn.execute(
            """INSERT INTO recipes
               (id, name, family, method, glass, garnish, instructions, abv, calories, source, iba_official, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                r["id"],
                r["name"],
                r["family"],
                r["method"],
                r["glass"],
                r.get("garnish"),
                r["instructions"],
                r.get("abv"),
                r.get("calories"),
                r["source"],
                1 if r.get("ibaOfficial") else 0,
                now,
            ),
        )
        recipes += 1
        for ri in r["ingredients"]:
            conn.execute(
                """INSERT INTO recipe_ingredients
                   (recipe_id, ingredient_id, amount_ml, amount_display, optional, position, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    r["id"],
                    ri["ingredientId"],
                    ri.get("amountMl"),
                    ri["amountDisplay"],
                    1 if ri.get("optional") else 0,
                    ri["position"],
                    ri.get("notes"),
                ),
            )
            ingredients += 1
    return recipes, ingredients


def set_meta(conn: sqlite3.Connection, seed: dict[str, Any]) -> None:
    version = str(int(time.time()))
    for k, v in (
        ("schema_version", "1"),
        ("version", version),
        ("exported_at", seed.get("exportedAt", "")),
    ):
        conn.execute("INSERT INTO db_meta (key, value) VALUES (?, ?)", (k, v))


def validate(conn: sqlite3.Connection) -> list[str]:
    """Run integrity checks, return list of warnings (empty = clean)."""
    warnings: list[str] = []

    # Every recipe_ingredient references an existing ingredient
    missing = conn.execute(
        """SELECT ri.recipe_id, ri.ingredient_id
           FROM recipe_ingredients ri
           LEFT JOIN ingredients i ON i.id = ri.ingredient_id
           WHERE i.id IS NULL"""
    ).fetchall()
    for recipe_id, ingredient_id in missing:
        warnings.append(f"recipe {recipe_id} references missing ingredient {ingredient_id}")

    # Every parent_id resolves
    orphan = conn.execute(
        """SELECT i.id, i.parent_id FROM ingredients i
           LEFT JOIN ingredients p ON p.id = i.parent_id
           WHERE i.parent_id IS NOT NULL AND p.id IS NULL"""
    ).fetchall()
    for iid, pid in orphan:
        warnings.append(f"ingredient {iid} has missing parent {pid}")

    # Substitute pair strength in range and both endpoints exist
    bad_sub = conn.execute(
        """SELECT s.ingredient_id, s.substitute_id, s.strength FROM substitutes s
           LEFT JOIN ingredients a ON a.id = s.ingredient_id
           LEFT JOIN ingredients b ON b.id = s.substitute_id
           WHERE a.id IS NULL OR b.id IS NULL OR s.strength < 0 OR s.strength > 1"""
    ).fetchall()
    for iid, sid, st in bad_sub:
        warnings.append(f"substitute {iid} -> {sid} strength={st} invalid")

    return warnings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=pathlib.Path, default=DEFAULT_SEED)
    ap.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    ap.add_argument("--enrich-iba", action="store_true",
                    help="(Stub) attempt to pull IBA recipes from GitHub. Implemented in future iteration.")
    args = ap.parse_args()

    if not args.seed.exists():
        print(f"Seed file not found: {args.seed}", file=sys.stderr)
        print("Run `node data-pipeline/export_seed.mjs` first.", file=sys.stderr)
        return 1

    seed = load_seed(args.seed)
    print(f"Loaded seed: {len(seed['ingredients'])} ingredients, {len(seed['recipes'])} recipes")

    conn = create_db(args.out)
    try:
        with conn:
            ing_count = insert_ingredients(conn, seed["ingredients"])
            alias_count = insert_aliases(conn, seed["aliases"])
            sub_count = insert_substitutes(conn, seed["substitutes"])
            rec_count, ri_count = insert_recipes(conn, seed["recipes"])
            set_meta(conn, seed)

        warnings = validate(conn)
        if warnings:
            print("Integrity warnings:", file=sys.stderr)
            for w in warnings:
                print(f"  - {w}", file=sys.stderr)
            return 2
    finally:
        conn.close()

    size_kb = args.out.stat().st_size / 1024
    print(f"Wrote {args.out} ({size_kb:.1f} KB)")
    print(f"  ingredients={ing_count}, aliases={alias_count}, substitutes={sub_count}")
    print(f"  recipes={rec_count}, recipe_ingredients={ri_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
