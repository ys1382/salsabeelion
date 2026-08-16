"""
Logic-grid compiler for Bane of Extinction.

Claude (or a hand board) supplies comparable attributes. This module shuffles
labels, writes clues, and keeps only sets with exactly one solution.
Never uses camera photos — names and short facts only.
"""
from __future__ import annotations

import random
import re
from itertools import permutations
from typing import Any

N_DEFAULT = 4
PAIR_ORDER = (
    ("species", "where"),
    ("species", "trait"),
    ("species", "origin"),
    ("where", "trait"),
    ("where", "origin"),
    ("trait", "origin"),
)

FAR_NEIGHBOR_ID = "far:snow-leopard-v1"

FAR_NEIGHBOR_CATS = (
    {
        "id": "where",
        "title": "Where they live",
        "eq": "The {species} lives among {item}.",
        "neq": "The {species} does not live among {item}.",
        "short": ["Mountains", "Kelp coast", "Vents", "Sea ice"],
    },
    {
        "id": "trait",
        "title": "What threatens them",
        "eq": "The {species} is threatened by {item}.",
        "neq": "The {species} is not threatened by {item}.",
        "short": ["Poaching", "Oil spills", "Mining", "Ice loss"],
    },
    {
        "id": "origin",
        "title": "What they eat",
        "eq": "The {species} eats {item}.",
        "neq": "The {species} does not eat {item}.",
        "short": ["Blue sheep", "Urchins", "Vent bacteria", "Seals"],
    },
)

FAR_NEIGHBOR_ROWS = (
    {
        "speciesKey": "far:snow-leopard",
        "commonName": "Snow leopard",
        "latinName": "Panthera uncia",
        "values": {
            "where": "High mountains",
            "trait": "Poaching",
            "origin": "Blue sheep",
        },
        "newFact": {
            "fact": "Snow leopards hunt blue sheep on high rocky slopes — a far neighbor whose food web still ties into mountain grasslands people share.",
            "kind": "wonder",
            "label": "Blue sheep",
        },
    },
    {
        "speciesKey": "far:sea-otter",
        "commonName": "Sea otter",
        "latinName": "Enhydra lutris",
        "values": {
            "where": "Kelp coast",
            "trait": "Oil spills",
            "origin": "Sea urchins",
        },
        "newFact": {
            "fact": "Sea otters keep kelp forests in check by eating sea urchins — a coast you may never visit still buffers storms and carbon.",
            "kind": "help",
            "label": "Kelp helpers",
        },
    },
    {
        "speciesKey": "far:tube-worm",
        "commonName": "Tube worm",
        "latinName": "Riftia pachyptila",
        "values": {
            "where": "Deep-sea vents",
            "trait": "Seafloor mining",
            "origin": "Vent bacteria",
        },
        "newFact": {
            "fact": "Giant tube worms live off vent bacteria, not sunlight — seafloor mining would scrape a world most people never see.",
            "kind": "notice",
            "label": "No sunlight",
        },
    },
    {
        "speciesKey": "far:polar-bear",
        "commonName": "Polar bear",
        "latinName": "Ursus maritimus",
        "values": {
            "where": "Arctic sea ice",
            "trait": "Sea-ice loss",
            "origin": "Seals",
        },
        "newFact": {
            "fact": "Polar bears hunt seals from sea ice; when that ice thins, a far-north food web that still shapes climate you live with starts to slip.",
            "kind": "notice",
            "label": "Sea ice",
        },
    },
)

FAR_WIN = (
    "That’s the set. Snow leopard, sea otter, vent tube worm, polar bear — "
    "far from a garden path, still holding up food webs, coasts, and ice you live with."
)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def _shorten(text: str, limit: int = 18) -> str:
    s = re.sub(r"\s+", " ", str(text or "").strip())
    if len(s) <= limit:
        return s
    cut = s[: limit - 1]
    sp = cut.rfind(" ")
    if sp >= 8:
        cut = cut[:sp]
    return cut.rstrip(" ,;:—-") + "…"


def _fill(template: str, **kwargs: str) -> str:
    out = template
    for key, val in kwargs.items():
        out = out.replace("{" + key + "}", val)
    return out


def _pair_key(a: str, b: str) -> str:
    return a + "|" + b if a < b else b + "|" + a


def _entity_maps_hold(maps: dict[str, tuple[int, ...]], clues: list[dict[str, Any]]) -> bool:
    """maps[cat][entity] = display index for that category (species is identity)."""
    for clue in clues:
        a = clue["a"]
        b = clue["b"]
        ia = int(clue["ia"])
        ib = int(clue["ib"])
        want_eq = clue["type"] == "eq"

        def pos(cat: str, entity: int) -> int:
            if cat == "species":
                return entity
            return maps[cat][entity]

        if a == "species":
            ok = pos(b, ia) == ib
        elif b == "species":
            ok = pos(a, ib) == ia
        else:
            entity = None
            for e, p in enumerate(maps[a]):
                if p == ia:
                    entity = e
                    break
            if entity is None:
                return False
            ok = maps[b][entity] == ib
        if want_eq and not ok:
            return False
        if (not want_eq) and ok:
            return False
    return True


def count_solutions(
    n: int, clues: list[dict[str, Any]], cat_ids: tuple[str, ...]
) -> int:
    found = 0
    ranges = [tuple(range(n)) for _ in cat_ids]
    if len(cat_ids) != 3:
        return 0
    for p0 in permutations(ranges[0]):
        for p1 in permutations(ranges[1]):
            for p2 in permutations(ranges[2]):
                maps = {cat_ids[0]: p0, cat_ids[1]: p1, cat_ids[2]: p2}
                if _entity_maps_hold(maps, clues):
                    found += 1
    return found


def _solution_pairs(
    n: int, display: dict[str, list[str]], entity_values: list[dict[str, str]]
) -> dict[str, list[int]]:
    """species entity i matches display index of each other category."""
    out: dict[str, list[int]] = {}
    species_idx = list(range(n))
    for cat in ("where", "trait", "origin"):
        labels = display[cat]
        mapping = []
        for i in species_idx:
            val = entity_values[i][cat]
            mapping.append(labels.index(val))
        out["species|" + cat] = mapping
    for a, b in (("where", "trait"), ("where", "origin"), ("trait", "origin")):
        mapping = []
        for i in range(n):
            # display index i in cat a belongs to which entity?
            val_a = display[a][i]
            entity = next(
                e for e, row in enumerate(entity_values) if row[a] == val_a
            )
            mapping.append(display[b].index(entity_values[entity][b]))
        out[a + "|" + b] = mapping
    return out


def _clue_text(
    clue: dict[str, Any],
    names: list[str],
    display: dict[str, list[str]],
    phrases: dict[str, dict[str, str]],
) -> str:
    a = clue["a"]
    b = clue["b"]
    ia = int(clue["ia"])
    ib = int(clue["ib"])
    if a == "species":
        species = names[ia]
        item = display[b][ib]
        key = "eq" if clue["type"] == "eq" else "neq"
        return _fill(phrases[b][key], species=species, item=item)
    if b == "species":
        species = names[ib]
        item = display[a][ia]
        key = "eq" if clue["type"] == "eq" else "neq"
        return _fill(phrases[a][key], species=species, item=item)
    # Cross: two non-species labels
    item_a = display[a][ia]
    item_b = display[b][ib]
    if clue["type"] == "eq":
        return f"The {item_a} neighbor is the one tied to {item_b}."
    return f"The {item_a} neighbor is not the one tied to {item_b}."


def _neither_text(
    names: list[str], i: int, j: int, cat: str, item: str, phrases: dict[str, dict[str, str]]
) -> str:
    eq = _fill(phrases[cat]["eq"], species="PLACEHOLDER", item=item)
    tail = re.sub(r"^The PLACEHOLDER\s+", "", eq, flags=re.I)
    return f"Neither the {names[i]} nor the {names[j]} {tail}"


def _candidate_clues(
    n: int,
    names: list[str],
    display: dict[str, list[str]],
    entity_values: list[dict[str, str]],
    phrases: dict[str, dict[str, str]],
    rng: random.Random,
) -> list[dict[str, Any]]:
    clues: list[dict[str, Any]] = []
    cats = ("where", "trait", "origin")

    def add(kind: str, a: str, ia: int, b: str, ib: int) -> None:
        raw = {"type": kind, "a": a, "b": b, "ia": ia, "ib": ib}
        raw["text"] = _clue_text(raw, names, display, phrases)
        clues.append(raw)

    # Cross-equals (the interesting two-sided clues).
    for a, b in (("where", "trait"), ("where", "origin"), ("trait", "origin")):
        for e, row in enumerate(entity_values):
            ia = display[a].index(row[a])
            ib = display[b].index(row[b])
            add("eq", a, ia, b, ib)

    # Species negatives (not too many direct gives).
    for e, row in enumerate(entity_values):
        for cat in cats:
            for j, label in enumerate(display[cat]):
                if label != row[cat]:
                    add("neq", "species", e, cat, j)

    # Direct equals — last resort so a board can always pin down.
    for e, row in enumerate(entity_values):
        for cat in cats:
            add("eq", "species", e, cat, display[cat].index(row[cat]))

    # Neither-species vs one label they both miss.
    for cat in cats:
        for j, label in enumerate(display[cat]):
            miss = [e for e, row in enumerate(entity_values) if row[cat] != label]
            rng.shuffle(miss)
            for i in range(0, len(miss) - 1, 2):
                e1, e2 = miss[i], miss[i + 1]
                raw = {
                    "type": "neq",
                    "a": "species",
                    "ia": e1,
                    "b": cat,
                    "ib": j,
                    "extraNeq": {"a": "species", "ia": e2, "b": cat, "ib": j},
                    "text": _neither_text(names, e1, e2, cat, label, phrases),
                }
                clues.append(raw)

    rng.shuffle(clues)
    # Prefer cross-eq and neither, then species-neq, then direct species-eq.
    def rank(c: dict[str, Any]) -> int:
        if c["a"] != "species" and c["b"] != "species" and c["type"] == "eq":
            return 0
        if c.get("extraNeq"):
            return 1
        if c["type"] == "neq":
            return 2
        return 3

    clues.sort(key=rank)
    return clues


def _expand(clue: dict[str, Any]) -> list[dict[str, Any]]:
    base = {
        "type": clue["type"],
        "a": clue["a"],
        "b": clue["b"],
        "ia": clue["ia"],
        "ib": clue["ib"],
    }
    extra = clue.get("extraNeq")
    if not extra:
        return [base]
    return [
        base,
        {
            "type": "neq",
            "a": extra["a"],
            "b": extra["b"],
            "ia": extra["ia"],
            "ib": extra["ib"],
        },
    ]


def compile_logic_grid_from_rows(
    rows: list[dict[str, Any]] | tuple[dict[str, Any], ...],
    categories: list[dict[str, Any]] | tuple[dict[str, Any], ...],
    *,
    rng: random.Random | None = None,
    n: int = N_DEFAULT,
) -> dict[str, Any]:
    if len(rows) != n:
        raise ValueError("need exactly %s rows" % n)
    if len(categories) != 3:
        raise ValueError("need exactly 3 categories")
    rng = rng or random.Random()
    cat_meta = []
    for i, raw in enumerate(categories):
        cid = str(raw.get("id") or "").strip() or ("where", "trait", "origin")[i]
        if cid not in ("where", "trait", "origin"):
            cid = ("where", "trait", "origin")[i]
        title = str(raw.get("title") or cid).strip()[:48]
        eq = str(raw.get("eq") or "The {species} matches {item}.").strip()[:160]
        neq = str(raw.get("neq") or "The {species} does not match {item}.").strip()[:160]
        cat_meta.append({"id": cid, "title": title, "eq": eq, "neq": neq, "short": raw.get("short")})
    # Force ids where/trait/origin in that order for the L board.
    by_id = {c["id"]: c for c in cat_meta}
    ordered_ids = ("where", "trait", "origin")
    if set(by_id) != set(ordered_ids):
        # Map whatever Claude sent onto the three slots in given order.
        by_id = {}
        for i, cid in enumerate(ordered_ids):
            src = cat_meta[i]
            by_id[cid] = {
                "id": cid,
                "title": src["title"],
                "eq": src["eq"],
                "neq": src["neq"],
                "short": src.get("short"),
            }

    names = []
    entity_values: list[dict[str, str]] = []
    new_facts: list[dict[str, Any]] = []
    species_meta: list[dict[str, str]] = []
    for row in rows:
        name = str(row.get("commonName") or row.get("displayName") or "").strip()
        if not name:
            raise ValueError("row missing commonName")
        values = row.get("values") if isinstance(row.get("values"), dict) else {}
        mapped: dict[str, str] = {}
        # Accept either canonical ids or the three Claude ids in order.
        raw_vals = [str(v).strip() for v in values.values()]
        for i, cid in enumerate(ordered_ids):
            val = str(values.get(cid) or "").strip()
            if not val and i < len(raw_vals):
                val = raw_vals[i]
            if not val:
                raise ValueError("missing value for " + cid)
            mapped[cid] = val[:42]
        names.append(name)
        entity_values.append(mapped)
        species_meta.append(
            {
                "speciesKey": str(row.get("speciesKey") or "")[:100],
                "commonName": name[:120],
                "latinName": str(row.get("latinName") or "").strip()[:160],
            }
        )
        fact = row.get("newFact") if isinstance(row.get("newFact"), dict) else {}
        fact_text = str(fact.get("fact") or "").strip()
        if fact_text:
            kind = str(fact.get("kind") or "notice").strip().lower()
            if kind not in ("help", "wonder"):
                kind = "notice"
            new_facts.append(
                {
                    "speciesKey": str(row.get("speciesKey") or "")[:100],
                    "commonName": name[:120],
                    "latinName": str(row.get("latinName") or "").strip()[:160],
                    "fact": fact_text[:480],
                    "label": str(fact.get("label") or "").strip()[:60],
                    "kind": kind,
                }
            )

    for cid in ordered_ids:
        labels = [row[cid] for row in entity_values]
        if len(set(_norm(x) for x in labels)) != n:
            raise ValueError("category %s values are not unique" % cid)

    display: dict[str, list[str]] = {"species": names[:]}
    shorts: dict[str, list[str]] = {}
    for cid in ordered_ids:
        labels = [row[cid] for row in entity_values]
        rng.shuffle(labels)
        display[cid] = labels
        given_short = by_id[cid].get("short")
        if isinstance(given_short, list) and len(given_short) == n:
            # shorts follow original entity order — remap to shuffled display.
            orig = [row[cid] for row in entity_values]
            remap = []
            for lab in labels:
                remap.append(str(given_short[orig.index(lab)]))
            shorts[cid] = remap
        else:
            shorts[cid] = [_shorten(x) for x in labels]

    phrases = {
        cid: {"eq": by_id[cid]["eq"], "neq": by_id[cid]["neq"]} for cid in ordered_ids
    }
    candidates = _candidate_clues(n, names, display, entity_values, phrases, rng)

    chosen: list[dict[str, Any]] = []
    expanded: list[dict[str, Any]] = []
    unique = False
    prev_nsol = 0
    for cand in candidates:
        trial = expanded + _expand(cand)
        nsol = count_solutions(n, trial, ordered_ids)
        if nsol == 0:
            continue
        if prev_nsol and nsol >= prev_nsol:
            continue
        chosen.append(cand)
        expanded = trial
        prev_nsol = nsol
        if nsol == 1:
            unique = True
            break
    if not unique:
        raise RuntimeError("could not build a unique puzzle")

    # Drop clues that are not needed for uniqueness.
    i = 0
    while i < len(chosen):
        without = []
        for j, c in enumerate(chosen):
            if j == i:
                continue
            without.extend(_expand(c))
        if count_solutions(n, without, ordered_ids) == 1:
            chosen.pop(i)
            continue
        i += 1

    if count_solutions(n, [x for c in chosen for x in _expand(c)], ordered_ids) != 1:
        raise RuntimeError("puzzle lost uniqueness while trimming")

    cats = {
        "species": {"title": "Species", "items": names[:], "short": names[:]},
        "where": {
            "title": by_id["where"]["title"],
            "items": display["where"],
            "short": shorts["where"],
        },
        "trait": {
            "title": by_id["trait"]["title"],
            "items": display["trait"],
            "short": shorts["trait"],
        },
        "origin": {
            "title": by_id["origin"]["title"],
            "items": display["origin"],
            "short": shorts["origin"],
        },
    }
    return {
        "n": n,
        "cats": cats,
        "clues": [c["text"] for c in chosen],
        "solution": _solution_pairs(n, display, entity_values),
        "newFacts": new_facts,
        "species": species_meta,
        "catOrder": ["species", "where", "trait", "origin"],
        "colGroups": ["origin", "trait", "where"],
        "rowGroups": ["species", "where", "trait"],
        "pairIds": [
            "species|where",
            "species|trait",
            "species|origin",
            "where|trait",
            "where|origin",
            "trait|origin",
        ],
    }


def compile_far_neighbor_puzzle(rng: random.Random | None = None) -> dict[str, Any]:
    # Keep the classic identity layout (no shuffle) so the owner example stays
    # the same board people already learned — still unique.
    rng = rng or random.Random(1)
    puzzle = compile_logic_grid_from_rows(
        list(FAR_NEIGHBOR_ROWS), list(FAR_NEIGHBOR_CATS), rng=rng
    )
    puzzle["kind"] = "far"
    puzzle["boardId"] = FAR_NEIGHBOR_ID
    puzzle["winNote"] = FAR_WIN
    return puzzle


def known_fact_hit(fact: str, known: list[str]) -> bool:
    needle = _norm(fact)
    if not needle:
        return True
    for item in known:
        hay = _norm(item)
        if not hay:
            continue
        if needle == hay or needle in hay or hay in needle:
            return True
    return False
