#!/usr/bin/env python3
"""Import recipes from the erwanlc/cocktails_recipe Hugging Face dataset.

Reads the dataset via the public datasets-server JSON API (stdlib-only — no
pyarrow/datasets dependency). Each row is normalized against the canonical
ingredient list in seed.json, and the result is written to a staging JSON
file for human review before being merged into src/data/recipes.ts.

Usage:
    npm run pipeline:export            # refresh seed.json
    python3 data-pipeline/import_huggingface.py
    python3 data-pipeline/import_huggingface.py --limit 200    # quick sample
    python3 data-pipeline/import_huggingface.py --out hf_candidates.json
"""
from __future__ import annotations

import argparse
import ast
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
from typing import Any

HERE = pathlib.Path(__file__).parent
DEFAULT_SEED = HERE / "seed.json"
DEFAULT_OUT = HERE / "hf_candidates.json"

DATASET = "erwanlc/cocktails_recipe"
API = "https://datasets-server.huggingface.co/rows"
PAGE_SIZE = 100  # max allowed by the API

# ---------- quantity parsing ----------

_QTY_RE = re.compile(
    r"^\s*(\d+(?:\.\d+)?|\d+\s*/\s*\d+|\d+\s+\d+/\d+)\s*(cl|ml|oz|ounce|ounces|dash|dashes|drop|drops|tsp|teaspoon|teaspoons|tbsp|tablespoon|tablespoons|splash|splashes|bsp|barspoon|barspoons|top|fill|wedge|wedges|slice|slices|sprig|sprigs|leaf|leaves|cube|cubes|pinch|pinches)?\s*(.*)$",
    re.IGNORECASE,
)


def _to_float(num: str) -> float | None:
    num = num.strip()
    try:
        if " " in num:  # "1 1/2"
            whole, frac = num.split(" ", 1)
            a, b = frac.split("/")
            return float(whole) + float(a) / float(b)
        if "/" in num:
            a, b = num.split("/")
            return float(a) / float(b)
        return float(num)
    except (ValueError, ZeroDivisionError):
        return None


def parse_qty(raw: str) -> tuple[float | None, str]:
    """Return (amount_ml, amount_display). ml may be None for non-volume units."""
    if not raw:
        return None, ""
    display = raw.strip()
    m = _QTY_RE.match(display)
    if not m:
        return None, display
    num, unit, _tail = m.groups()
    value = _to_float(num)
    if value is None:
        return None, display
    unit = (unit or "").lower()
    if unit in ("cl",):
        return value * 10.0, display
    if unit in ("ml",):
        return value, display
    if unit in ("oz", "ounce", "ounces"):
        return value * 29.5735, display
    if unit in ("tsp", "teaspoon", "teaspoons", "bsp", "barspoon", "barspoons"):
        return value * 5.0, display
    if unit in ("tbsp", "tablespoon", "tablespoons"):
        return value * 15.0, display
    # dashes, drops, wedges, leaves, sprigs, slices, cubes, pinches, top, splash: keep display only
    return None, display


# ---------- ingredient normalization ----------

_PAREN_RE = re.compile(r"\s*\([^)]*\)")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9 ]+")

# The source dataset strips non-ASCII accents which splits accented words like
# "crème" into "cr me". These substitutions rejoin the known fragments.
_ACCENT_FIXES = [
    (re.compile(r"\bcr me\b"), "creme"),
    (re.compile(r"\bm re\b"), "mure"),
    (re.compile(r"\bmyr tille\b"), "myrtille"),
    (re.compile(r"\bbr sil\b"), "bresil"),
    (re.compile(r"\bj germeister\b"), "jagermeister"),
    (re.compile(r"\bp che\b"), "peche"),
    (re.compile(r"\bp ch\b"), "peche"),
    (re.compile(r"\bg ant\b"), "geant"),
    (re.compile(r"\bkahl a\b"), "kahlua"),
    (re.compile(r"\bb n dictine\b"), "benedictine"),
    (re.compile(r"\bb n dict\b"), "benedictine"),
    (re.compile(r"\bk mmel\b"), "kummel"),
    (re.compile(r"\bnapol on\b"), "napoleon"),
    (re.compile(r"\bcuara ao\b"), "curacao"),
    (re.compile(r"\bcura ao\b"), "curacao"),
    (re.compile(r"\bpur e\b"), "puree"),
]

# Common brand/modifier prefix noise stripped before alias lookup. Some
# brands are multiple words; those are handled below.
_NOISE_TOKENS = {
    "fresh", "freshly", "squeezed", "homemade", "premium", "top-shelf", "chilled",
    "cold", "hot", "warm", "strained",
    # Single-word brand prefixes
    "giffard", "warninks", "pallini", "luxardo", "chambord", "bobs", "bob",
    "stones", "stone", "tuaca", "pernod",
}

# Multi-word brand prefixes: stripped only when they appear at the start.
_NOISE_PREFIXES = [
    "de kuyper",
    "kwai feh",
    "marie brizard",
    "st germain",
    "teichenne schnapps",
]


def _canon(s: str) -> str:
    s = s.lower()
    s = _PAREN_RE.sub("", s)
    s = _NON_ALNUM_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for pat, repl in _ACCENT_FIXES:
        s = pat.sub(repl, s)
    # strip multi-word brand prefixes
    for prefix in _NOISE_PREFIXES:
        if s.startswith(prefix + " "):
            s = s[len(prefix) + 1 :]
    # drop leading single-token noise
    parts = s.split(" ")
    while parts and parts[0] in _NOISE_TOKENS:
        parts.pop(0)
    return " ".join(parts)


class Normalizer:
    def __init__(self, seed: dict[str, Any]) -> None:
        self.ingredients = {i["id"]: i for i in seed["ingredients"]}
        # alias_map maps a canonicalised alias string → ingredient id
        self.alias_map: dict[str, str] = {}
        for ing in seed["ingredients"]:
            key = _canon(ing["name"])
            if key:
                self.alias_map.setdefault(key, ing["id"])
            # Also map the id slug itself for things like "rum_white"
            slug = ing["id"].replace("_", " ")
            self.alias_map.setdefault(slug, ing["id"])
        for a in seed["aliases"]:
            key = _canon(a["alias"])
            if key:
                self.alias_map.setdefault(key, a["ingredientId"])

    def resolve(self, raw_name: str) -> str | None:
        key = _canon(raw_name)
        if not key:
            return None
        # 1. exact
        hit = self.alias_map.get(key)
        if hit:
            return hit
        # 2. drop "juice" suffix and try again ("Lemon juice" → "lemon" already covered but fallback)
        if key.endswith(" juice"):
            hit = self.alias_map.get(key[:-len(" juice")])
            if hit:
                return hit
        # 3. try trailing-word truncations ("angostura aromatic bitters" → "angostura bitters" → "angostura")
        tokens = key.split(" ")
        for end in range(len(tokens), 0, -1):
            prefix = " ".join(tokens[:end])
            hit = self.alias_map.get(prefix)
            if hit:
                return hit
        # 4. leading-word truncations ("rutte dry gin" → "dry gin" → "gin")
        for start in range(1, len(tokens)):
            suffix = " ".join(tokens[start:])
            hit = self.alias_map.get(suffix)
            if hit:
                return hit
        return None


# ---------- glass / method / family inference ----------

GLASS_MAP = [
    ("nick", "nick_and_nora"),
    ("coupe", "coupe"),
    ("martini", "martini"),
    ("rocks", "rocks"),
    ("old-fashioned", "rocks"),
    ("old fashioned", "rocks"),
    ("lowball", "rocks"),
    ("double rocks", "rocks"),
    ("highball", "highball"),
    ("collins", "collins"),
    ("flute", "flute"),
    ("champagne", "flute"),
    ("wine", "wine"),
    ("julep", "julep"),
    ("hurricane", "hurricane"),
    ("tiki", "hurricane"),
    ("mug", "rocks"),
]


def infer_glass(raw: str | None) -> str:
    if not raw:
        return "coupe"
    r = raw.lower()
    for key, val in GLASS_MAP:
        if key in r:
            return val
    return "coupe"


def infer_method(recipe: str | None) -> str:
    if not recipe:
        return "build"
    r = recipe.upper()
    if "SHAKE" in r or "SHAK" in r:
        return "shake"
    if "THROW" in r:
        return "throw"
    if "BLEND" in r:
        return "blend"
    if "STIR" in r:
        return "stir"
    return "build"


CITRUS_IDS = {"lime_juice", "lemon_juice", "grapefruit_juice", "orange_juice"}
SIMPLE_SWEETENERS = {
    "simple_syrup", "gomme_syrup", "demerara_syrup", "cane_syrup", "honey_syrup",
    "agave_syrup", "grenadine", "orgeat", "cinnamon_syrup", "ginger_syrup",
    "vanilla_syrup", "pineapple_syrup", "sugar", "raw_sugar",
}
SPARKLING_IDS = {"prosecco", "champagne", "cava", "sparkling_wine"}
MIXER_IDS = {"soda_water", "tonic_water", "ginger_beer", "ginger_ale", "cola", "lemonade"}
EGG_IDS = {"egg_white", "egg_yolk", "whole_egg", "egg"}
VERMOUTH_IDS = {"vermouth_sweet", "vermouth_dry", "vermouth_bianco", "punt_e_mes", "lillet_blanc"}
BITTERS_IDS_PREFIX = "bitters"  # any ingredient in category 'bitter' counts


def infer_family(
    recipe_ingredient_ids: list[str],
    ingredient_index: dict[str, dict[str, Any]],
) -> str:
    ids = set(recipe_ingredient_ids)
    cats = {ingredient_index[i]["category"] for i in ids if i in ingredient_index}
    has_spirit = "spirit" in cats
    has_citrus = bool(ids & CITRUS_IDS)
    has_sweet = bool(ids & SIMPLE_SWEETENERS)
    has_sparkling = bool(ids & SPARKLING_IDS)
    has_mixer = bool(ids & MIXER_IDS)
    has_egg = bool(ids & EGG_IDS)
    has_vermouth = bool(ids & VERMOUTH_IDS)
    has_bitters = "bitter" in cats
    has_mint = any(i in ids for i in ("mint", "mint_leaves"))

    if has_egg and not has_citrus:
        return "flip"
    if has_mint and has_spirit and has_sweet and not has_citrus and not has_mixer:
        return "julep"
    if has_sparkling and ("liqueur" in cats or has_bitters):
        return "spritz"
    if has_mixer and has_spirit:
        return "highball"
    if has_spirit and has_citrus and has_sweet and has_mixer:
        return "fizz"
    if has_spirit and has_citrus and (has_sweet or "liqueur" in cats):
        return "sour"
    if has_spirit and (has_vermouth or "liqueur" in cats) and not has_citrus:
        return "martini" if has_vermouth else "old_fashioned"
    if has_spirit and has_bitters and not has_citrus:
        return "old_fashioned"
    return "other"


# ---------- id generation ----------

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slug_id(title: str) -> str:
    s = _SLUG_RE.sub("_", title.lower()).strip("_")
    return s


# ---------- HTTP ----------


def fetch_page(offset: int, length: int, max_attempts: int = 6) -> dict[str, Any]:
    params = urllib.parse.urlencode({
        "dataset": DATASET,
        "config": "default",
        "split": "train",
        "offset": offset,
        "length": length,
    })
    url = f"{API}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "willitcocktail-import/1.0"})
    delay = 2.0
    for attempt in range(1, max_attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == max_attempts:
                raise
            print(f"  [429] offset {offset} — sleeping {delay:.1f}s (attempt {attempt}/{max_attempts})")
            time.sleep(delay)
            delay = min(delay * 2, 60.0)
    raise RuntimeError("unreachable")


# ---------- main ----------


def process_row(row: dict[str, Any], norm: Normalizer, existing_ids: set[str], existing_names: set[str]) -> dict[str, Any]:
    """Returns {status: accepted|rejected|duplicate, ...}"""
    title = (row.get("title") or "").strip()
    if not title:
        return {"status": "rejected", "reason": "empty_title"}

    rid = slug_id(title)
    if rid in existing_ids:
        return {"status": "duplicate", "id": rid, "reason": "duplicate_id"}
    name_key = title.lower()
    if name_key in existing_names:
        return {"status": "duplicate", "id": rid, "reason": "duplicate_name"}

    raw_ings = row.get("ingredients")
    if not raw_ings:
        return {"status": "rejected", "id": rid, "reason": "no_ingredients"}

    try:
        ing_list = ast.literal_eval(raw_ings) if isinstance(raw_ings, str) else raw_ings
    except (ValueError, SyntaxError):
        return {"status": "rejected", "id": rid, "reason": "ingredients_parse_error"}
    if not isinstance(ing_list, list) or not ing_list:
        return {"status": "rejected", "id": rid, "reason": "no_ingredients"}

    resolved: list[dict[str, Any]] = []
    unmapped: list[str] = []
    for position, pair in enumerate(ing_list, start=1):
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            unmapped.append(str(pair))
            continue
        qty_str, name = pair
        ing_id = norm.resolve(name)
        if not ing_id:
            unmapped.append(name)
            continue
        amount_ml, display = parse_qty(qty_str)
        resolved.append({
            "ingredientId": ing_id,
            "amountMl": round(amount_ml, 2) if amount_ml is not None else None,
            "amountDisplay": display or str(qty_str),
            "position": position,
        })

    if unmapped:
        return {"status": "rejected", "id": rid, "reason": "unmapped_ingredient", "unmapped": unmapped}
    if len(resolved) < 2:
        return {"status": "rejected", "id": rid, "reason": "too_few_ingredients"}

    # Reject recipes where the same canonical ingredient appears twice — usually
    # a brand-variant collision (e.g. both "Gin" and "Rutte Dry Gin" resolve to
    # gin_london_dry). A reviewer can merge these by hand later.
    seen_ids = [r["ingredientId"] for r in resolved]
    if len(set(seen_ids)) != len(seen_ids):
        return {"status": "rejected", "id": rid, "reason": "duplicate_ingredient_id", "ids": seen_ids}

    ingredient_index = {i["id"]: i for i in norm.ingredients.values()}
    family = infer_family([r["ingredientId"] for r in resolved], ingredient_index)

    candidate = {
        "id": rid,
        "name": title,
        "family": family,
        "method": infer_method(row.get("recipe")),
        "glass": infer_glass(row.get("glass")),
        "garnish": (row.get("garnish") or "").strip() or None,
        "instructions": (row.get("recipe") or "").strip(),
        "source": "huggingface",
        "ingredients": resolved,
    }
    return {"status": "accepted", "candidate": candidate}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", default=str(DEFAULT_SEED))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--limit", type=int, default=0, help="Stop after N rows (0 = all)")
    ap.add_argument("--resume-from", type=int, default=0)
    ap.add_argument(
        "--filter-quality",
        action="store_true",
        help="Drop candidates with 1 or 7+ ingredients, family='other', or no parsed ml",
    )
    ap.add_argument(
        "--emit-ts",
        default=None,
        help="Also write a TypeScript file exporting the accepted candidates as Recipe[]",
    )
    args = ap.parse_args()

    seed = json.loads(pathlib.Path(args.seed).read_text())
    norm = Normalizer(seed)
    existing_ids = {r["id"] for r in seed["recipes"]}
    existing_names = {r["name"].lower() for r in seed["recipes"]}

    print(f"Seeded with {len(norm.ingredients)} ingredients, {len(norm.alias_map)} aliases.")
    print(f"Skipping {len(existing_ids)} existing recipes by id/name.")

    first = fetch_page(args.resume_from, 1)
    total = first.get("num_rows_total") or first.get("num_rows") or 0
    if args.limit:
        total = min(total, args.resume_from + args.limit)
    print(f"Dataset reports {total} rows. Fetching in pages of {PAGE_SIZE}.")

    accepted: list[dict[str, Any]] = []
    by_reason: dict[str, int] = {}
    unmapped_counter: dict[str, int] = {}
    offset = args.resume_from
    seen = 0

    while offset < total:
        length = min(PAGE_SIZE, total - offset)
        try:
            page = fetch_page(offset, length)
        except Exception as e:  # network hiccup — back off and retry once
            print(f"  [warn] fetch at offset {offset} failed: {e}; retrying in 3s")
            time.sleep(3)
            page = fetch_page(offset, length)
        rows = page.get("rows") or []
        if not rows:
            break
        for entry in rows:
            result = process_row(entry["row"], norm, existing_ids, existing_names)
            status = result["status"]
            if status == "accepted":
                accepted.append(result["candidate"])
                existing_ids.add(result["candidate"]["id"])
                existing_names.add(result["candidate"]["name"].lower())
            else:
                reason = result["reason"]
                by_reason[reason] = by_reason.get(reason, 0) + 1
                if reason == "unmapped_ingredient":
                    for name in result.get("unmapped", []):
                        key = _canon(name) or name
                        unmapped_counter[key] = unmapped_counter.get(key, 0) + 1
            seen += 1
        offset += length
        print(f"  processed {offset}/{total} — accepted so far: {len(accepted)}")
        time.sleep(1.0)  # be polite to the datasets-server rate limiter

    if args.filter_quality:
        before = len(accepted)
        kept: list[dict[str, Any]] = []
        dropped = {"ingredient_count": 0, "family_other": 0, "no_ml": 0}
        for c in accepted:
            n = len(c["ingredients"])
            if n < 2 or n > 6:
                dropped["ingredient_count"] += 1
                continue
            if c["family"] == "other":
                dropped["family_other"] += 1
                continue
            if not any(i.get("amountMl") is not None for i in c["ingredients"]):
                dropped["no_ml"] += 1
                continue
            kept.append(c)
        accepted = kept
        print(f"\nQuality filter: {before} → {len(accepted)}")
        for k, v in dropped.items():
            print(f"  dropped[{k}]: {v}")

    top_unmapped = sorted(unmapped_counter.items(), key=lambda kv: -kv[1])[:50]
    out = {
        "dataset": DATASET,
        "generatedAt": int(time.time()),
        "seen": seen,
        "accepted": len(accepted),
        "rejectedByReason": by_reason,
        "topUnmapped": [{"name": n, "count": c} for n, c in top_unmapped],
        "candidates": accepted,
    }
    pathlib.Path(args.out).write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"\nWrote {args.out}")
    print(f"  seen:     {seen}")
    print(f"  accepted: {len(accepted)}")
    for reason, count in sorted(by_reason.items(), key=lambda kv: -kv[1]):
        print(f"  rejected[{reason}]: {count}")
    if top_unmapped:
        print("\nTop unmapped ingredients (add aliases to grow yield):")
        for name, count in top_unmapped[:15]:
            print(f"  {count:5d}  {name}")

    if args.emit_ts:
        ts = render_ts(accepted)
        pathlib.Path(args.emit_ts).write_text(ts)
        print(f"\nWrote {args.emit_ts} ({len(accepted)} recipes)")
    return 0


def _ts_literal(value: Any) -> str:
    if value is None:
        return "undefined"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return json.dumps(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    raise TypeError(f"unsupported literal {type(value)}")


def render_ts(recipes: list[dict[str, Any]]) -> str:
    lines = [
        "// AUTO-GENERATED by data-pipeline/import_huggingface.py — do not edit.",
        "// Re-run `npm run pipeline:hf` to refresh.",
        "import type { Recipe } from '../types';",
        "",
        "export const HF_RECIPES: Recipe[] = [",
    ]
    for r in recipes:
        lines.append("  {")
        lines.append(f"    id: {_ts_literal(r['id'])},")
        lines.append(f"    name: {_ts_literal(r['name'])},")
        lines.append(f"    family: {_ts_literal(r['family'])},")
        lines.append(f"    method: {_ts_literal(r['method'])},")
        lines.append(f"    glass: {_ts_literal(r['glass'])},")
        if r.get("garnish"):
            lines.append(f"    garnish: {_ts_literal(r['garnish'])},")
        lines.append(f"    instructions: {_ts_literal(r['instructions'])},")
        lines.append(f"    source: {_ts_literal(r['source'])},")
        lines.append("    ingredients: [")
        for ing in r["ingredients"]:
            parts = [f"ingredientId: {_ts_literal(ing['ingredientId'])}"]
            if ing.get("amountMl") is not None:
                parts.append(f"amountMl: {_ts_literal(ing['amountMl'])}")
            parts.append(f"amountDisplay: {_ts_literal(ing['amountDisplay'])}")
            parts.append(f"position: {_ts_literal(ing['position'])}")
            lines.append("      { " + ", ".join(parts) + " },")
        lines.append("    ],")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
