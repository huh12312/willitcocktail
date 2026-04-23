#!/usr/bin/env python3
"""Import recipes from The Cocktail DB (free tier, v1).

Fetches all alcoholic drink IDs via filter.php, then looks up each by ID
(~636 drinks, ~5 min at 0.5 s/request). Mirrors the HF importer workflow:

    npm run pipeline:export                # refresh seed.json first
    python3 data-pipeline/import_cocktaildb.py
    # review cocktaildb_candidates.json — especially topUnmapped
    # add missing aliases to src/data/ingredients.ts, repeat until satisfied
    python3 data-pipeline/import_cocktaildb.py \\
        --emit-ts src/data/recipes_cocktaildb.ts
    # review recipes_cocktaildb.ts, merge wanted recipes into recipes.ts
    npm run pipeline                       # rebuild DB

First run expect 30-60% acceptance — topUnmapped is the primary output.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request
from typing import Any

HERE = pathlib.Path(__file__).parent
DEFAULT_SEED = HERE / "seed.json"
DEFAULT_OUT = HERE / "cocktaildb_candidates.json"

API_BASE = "https://www.thecocktaildb.com/api/json/v1/1"

SKIP_CATEGORIES = frozenset({
    "Shot",
    "Beer",
    "Coffee / Tea",
    "Soft Drink / Soda",
    "Other/Unknown",
})

# Ingredient strings that appear in CDB recipes but aren't meaningful pantry
# items. Silently excluded from the resolved list so a recipe isn't rejected
# on their account. Applied after _canon().
SILENT_DROP = frozenset({
    "ice",
    "food coloring",
    "food colouring",
    "fruit",
    "mixed fruit",
    "fruit juice",
    "orange",       # ambiguous: garnish vs juice; juice spelled out explicitly in CDB
    "licorice root",
})

# ── Quantity parsing (shared logic with import_huggingface.py) ────────────────

_QTY_RE = re.compile(
    r"^\s*(\d+(?:\.\d+)?|\d+\s*/\s*\d+|\d+\s+\d+/\d+)\s*"
    r"(cl|ml|oz|ounce|ounces|dash|dashes|drop|drops|tsp|teaspoon|teaspoons"
    r"|tbsp|tablespoon|tablespoons|splash|splashes|bsp|barspoon|barspoons"
    r"|top|fill|wedge|wedges|slice|slices|sprig|sprigs|leaf|leaves"
    r"|cube|cubes|pinch|pinches)?\s*(.*)$",
    re.IGNORECASE,
)


def _to_float(num: str) -> float | None:
    num = num.strip()
    try:
        if " " in num:
            whole, frac = num.split(" ", 1)
            a, b = frac.split("/")
            return float(whole) + float(a) / float(b)
        if "/" in num:
            a, b = num.split("/")
            return float(a) / float(b)
        return float(num)
    except (ValueError, ZeroDivisionError):
        return None


def _oz_display(ml: float) -> str:
    oz = ml / 29.5735
    rounded = round(oz * 4) / 4
    if rounded == int(rounded):
        return f"{int(rounded)} oz"
    return f"{rounded:.2f}".rstrip("0").rstrip(".") + " oz"


def parse_qty(raw: str) -> tuple[float | None, str]:
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
    if unit == "cl":
        ml = value * 10.0
        return ml, _oz_display(ml)
    if unit == "ml":
        return value, _oz_display(value)
    if unit in ("oz", "ounce", "ounces"):
        return value * 29.5735, display
    if unit in ("tsp", "teaspoon", "teaspoons", "bsp", "barspoon", "barspoons"):
        return value * 5.0, display
    if unit in ("tbsp", "tablespoon", "tablespoons"):
        return value * 15.0, display
    return None, display


# ── Ingredient normalization ──────────────────────────────────────────────────

_PAREN_RE = re.compile(r"\s*\([^)]*\)")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9 ]+")

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

_NOISE_TOKENS = {
    "fresh", "freshly", "squeezed", "homemade", "premium", "top-shelf",
    "chilled", "cold", "hot", "warm", "strained",
    "giffard", "warninks", "pallini", "luxardo", "chambord", "bobs", "bob",
    "stones", "stone", "tuaca", "pernod",
}

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
    for prefix in _NOISE_PREFIXES:
        if s.startswith(prefix + " "):
            s = s[len(prefix) + 1:]
    parts = s.split(" ")
    while parts and parts[0] in _NOISE_TOKENS:
        parts.pop(0)
    return " ".join(parts)


class Normalizer:
    def __init__(self, seed: dict[str, Any]) -> None:
        self.ingredients: dict[str, dict[str, Any]] = {i["id"]: i for i in seed["ingredients"]}
        self.alias_map: dict[str, str] = {}
        for ing in seed["ingredients"]:
            key = _canon(ing["name"])
            if key:
                self.alias_map.setdefault(key, ing["id"])
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
        hit = self.alias_map.get(key)
        if hit:
            return hit
        if key.endswith(" juice"):
            hit = self.alias_map.get(key[: -len(" juice")])
            if hit:
                return hit
        tokens = key.split(" ")
        for end in range(len(tokens), 0, -1):
            hit = self.alias_map.get(" ".join(tokens[:end]))
            if hit:
                return hit
        for start in range(1, len(tokens)):
            hit = self.alias_map.get(" ".join(tokens[start:]))
            if hit:
                return hit
        return None


# ── Glass / method / family inference ─────────────────────────────────────────

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


def infer_method(instructions: str | None) -> str:
    if not instructions:
        return "build"
    r = instructions.upper()
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


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slug_id(title: str) -> str:
    return _SLUG_RE.sub("_", title.lower()).strip("_")


# ── HTTP ──────────────────────────────────────────────────────────────────────


def http_get(url: str, max_attempts: int = 5) -> dict[str, Any]:
    req = urllib.request.Request(
        url, headers={"User-Agent": "willitcocktail-import/1.0"}
    )
    delay = 2.0
    for attempt in range(1, max_attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == max_attempts:
                raise
            print(f"  [429] sleeping {delay:.0f}s (attempt {attempt}/{max_attempts})")
            time.sleep(delay)
            delay = min(delay * 2, 60.0)
    raise RuntimeError("unreachable")


# ── CocktailDB fetch ──────────────────────────────────────────────────────────

# The free-tier filter.php?a=Alcoholic is capped at 100 results. The letter-
# search endpoint (search.php?f={letter}) has no such cap and returns complete
# drink objects, so no second lookup per drink is needed.
_SEARCH_LETTERS = "abcdefghijklmnopqrstuvwxyz0123456789"


def fetch_all_drinks(delay: float = 0.3) -> list[dict[str, Any]]:
    """Fetch all drinks via letter search. Returns full drink objects."""
    seen_ids: set[str] = set()
    drinks: list[dict[str, Any]] = []
    for letter in _SEARCH_LETTERS:
        try:
            data = http_get(f"{API_BASE}/search.php?f={letter}")
        except Exception as e:
            print(f"  [warn] search f={letter} failed: {e} — skipping")
            time.sleep(delay)
            continue
        for d in data.get("drinks") or []:
            if d["idDrink"] not in seen_ids:
                drinks.append(d)
                seen_ids.add(d["idDrink"])
        time.sleep(delay)
    return drinks


def extract_ingredients(drink: dict[str, Any]) -> list[tuple[str, str]]:
    """Return (measure, ingredient_name) pairs from strIngredient1..15 fields."""
    pairs: list[tuple[str, str]] = []
    for i in range(1, 16):
        name = drink.get(f"strIngredient{i}")
        measure = drink.get(f"strMeasure{i}") or ""
        if not name or not name.strip():
            break
        pairs.append((measure.strip(), name.strip()))
    return pairs


# ── Per-drink processing ──────────────────────────────────────────────────────


def process_drink(
    drink: dict[str, Any],
    norm: Normalizer,
    existing_ids: set[str],
    existing_names: set[str],
) -> dict[str, Any]:
    name = (drink.get("strDrink") or "").strip()
    if not name:
        return {"status": "rejected", "reason": "empty_name"}

    category = drink.get("strCategory") or ""
    if category in SKIP_CATEGORIES:
        return {"status": "skipped", "reason": f"category:{category}"}

    if "non" in (drink.get("strAlcoholic") or "").lower():
        return {"status": "skipped", "reason": "non_alcoholic"}

    rid = "cdb_" + slug_id(name)
    if rid in existing_ids:
        return {"status": "duplicate", "id": rid, "reason": "duplicate_id"}
    if name.lower() in existing_names:
        return {"status": "duplicate", "id": rid, "reason": "duplicate_name"}

    raw_pairs = extract_ingredients(drink)
    if not raw_pairs:
        return {"status": "rejected", "id": rid, "reason": "no_ingredients"}

    resolved: list[dict[str, Any]] = []
    unmapped: list[str] = []
    for position, (measure, ing_name) in enumerate(raw_pairs, start=1):
        if _canon(ing_name) in SILENT_DROP:
            continue
        ing_id = norm.resolve(ing_name)
        if not ing_id:
            unmapped.append(ing_name)
            continue
        amount_ml, display = parse_qty(measure)
        resolved.append({
            "ingredientId": ing_id,
            "amountMl": round(amount_ml, 2) if amount_ml is not None else None,
            "amountDisplay": display or measure,
            "position": position,
        })

    if unmapped:
        return {
            "status": "rejected",
            "id": rid,
            "reason": "unmapped_ingredient",
            "unmapped": unmapped,
        }
    if len(resolved) < 2:
        return {"status": "rejected", "id": rid, "reason": "too_few_resolved"}

    seen_ing_ids = [r["ingredientId"] for r in resolved]
    if len(set(seen_ing_ids)) != len(seen_ing_ids):
        return {
            "status": "rejected",
            "id": rid,
            "reason": "duplicate_ingredient_id",
            "ids": seen_ing_ids,
        }

    family = infer_family(seen_ing_ids, norm.ingredients)

    return {
        "status": "accepted",
        "candidate": {
            "id": rid,
            "name": name,
            "family": family,
            "method": infer_method(drink.get("strInstructions")),
            "glass": infer_glass(drink.get("strGlass")),
            "garnish": None,
            "instructions": (drink.get("strInstructions") or "").strip(),
            "source": "cocktaildb",
            "ibaOfficial": bool(drink.get("strIBA")),
            "cocktaildbId": drink.get("idDrink"),  # kept in JSON, not emitted to TS
            "ingredients": resolved,
        },
    }


# ── TypeScript render ─────────────────────────────────────────────────────────


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
        "// AUTO-GENERATED by data-pipeline/import_cocktaildb.py — do not edit.",
        "// Re-run `npm run pipeline:cocktaildb -- --emit-ts src/data/recipes_cocktaildb.ts` to refresh.",
        "import type { Recipe } from '../types';",
        "",
        "export const COCKTAILDB_RECIPES: Recipe[] = [",
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
        lines.append(f"    source: 'cocktaildb',")
        if r.get("ibaOfficial"):
            lines.append(f"    ibaOfficial: true,")
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


# ── main ──────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--seed", type=pathlib.Path, default=DEFAULT_SEED)
    ap.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    ap.add_argument("--limit", type=int, default=0,
                    help="Stop after N drinks (0 = all, ~636)")
    ap.add_argument("--delay", type=float, default=0.5,
                    help="Seconds between per-drink lookup requests (default: 0.5)")
    ap.add_argument("--emit-ts", metavar="PATH", default=None,
                    help="Also write TypeScript exporting accepted recipes as COCKTAILDB_RECIPES")
    args = ap.parse_args()

    if not args.seed.exists():
        print(f"Seed not found: {args.seed}", file=sys.stderr)
        print("Run `npm run pipeline:export` first.", file=sys.stderr)
        return 1

    seed = json.loads(args.seed.read_text())
    norm = Normalizer(seed)
    existing_ids = {r["id"] for r in seed["recipes"]}
    existing_names = {r["name"].lower() for r in seed["recipes"]}

    print(
        f"Seed: {len(norm.ingredients)} ingredients, "
        f"{len(norm.alias_map)} aliases, "
        f"{len(existing_ids)} existing recipes."
    )

    print(f"Fetching all drinks via letter search (a–z + 0–9, {args.delay}s/letter)…")
    all_drinks = fetch_all_drinks(delay=args.delay)
    if args.limit:
        all_drinks = all_drinks[: args.limit]
    total = len(all_drinks)
    print(f"Fetched {total} drinks. Normalizing…")

    accepted: list[dict[str, Any]] = []
    by_reason: dict[str, int] = {}
    unmapped_counter: dict[str, int] = {}
    seen = 0

    for drink in all_drinks:
        result = process_drink(drink, norm, existing_ids, existing_names)
        status = result["status"]
        if status == "accepted":
            c = result["candidate"]
            accepted.append(c)
            existing_ids.add(c["id"])
            existing_names.add(c["name"].lower())
        else:
            reason = result.get("reason", status)
            by_reason[reason] = by_reason.get(reason, 0) + 1
            for ing_name in result.get("unmapped", []):
                key = _canon(ing_name) or ing_name
                unmapped_counter[key] = unmapped_counter.get(key, 0) + 1

        seen += 1
        if seen % 100 == 0:
            pct = 100 * len(accepted) // seen
            print(f"  {seen}/{total} — accepted: {len(accepted)} ({pct}%)")

    top_unmapped = sorted(unmapped_counter.items(), key=lambda kv: -kv[1])[:50]

    out_data = {
        "source": "cocktaildb",
        "apiTier": "free-v1",
        "generatedAt": int(time.time()),
        "seen": seen,
        "accepted": len(accepted),
        "rejectedByReason": by_reason,
        "topUnmapped": [{"name": n, "count": c} for n, c in top_unmapped],
        "candidates": accepted,
    }
    args.out.write_text(json.dumps(out_data, indent=2, ensure_ascii=False))

    acceptance_pct = 100 * len(accepted) // max(seen, 1)
    print(f"\nWrote {args.out}")
    print(f"  seen:     {seen}")
    print(f"  accepted: {len(accepted)} ({acceptance_pct}%)")
    for reason, count in sorted(by_reason.items(), key=lambda kv: -kv[1]):
        print(f"  {reason}: {count}")

    if top_unmapped:
        print("\nTop unmapped — add aliases to src/data/ingredients.ts to grow yield:")
        for name, count in top_unmapped[:20]:
            print(f"  {count:4d}  {name}")

    if args.emit_ts:
        ts_path = pathlib.Path(args.emit_ts)
        ts_path.parent.mkdir(parents=True, exist_ok=True)
        ts_path.write_text(render_ts(accepted))
        print(f"\nWrote {ts_path} ({len(accepted)} recipes)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
