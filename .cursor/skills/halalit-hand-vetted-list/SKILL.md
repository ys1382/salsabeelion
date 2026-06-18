---
name: halalit-hand-vetted-list
description: Logs owner-typed hand-vetted book titles into Halalit roster and live Bookcheck code. Use when the owner types titles to hand-vet, promotes clean books, flags or parks titles, or opens a hand-vetted list agent chat—not plot-vet yes/no/idk batches.
---

# Halalit hand-vetted list

## Start

Read `halalit/HALALIT-HAND-VETTED-CLEAN-LIST.md` and skim existing entries in `halalit/www/halalit-curated-shelf-warnings.js` for the title before adding duplicates.

## Parse owner input

| Field | Required | Examples |
|-------|----------|----------|
| Title | yes | *Fablehaven*, *Secret of the Old Clock* |
| Author | usually | Brandon Mull, Carolyn Keene |
| Verdict | infer or ask once | clean, flagged, no, parked, fanservice, deity comfort |
| Age band | if clean | Kids · Older kids · Teens/Adults |
| Notes | optional | magic opt-in, book 1 only, preview panels |

**Verdict → code tier**

- **clean / verified** → `VERIFIED_CLEAN` + roster age section
- **flagged / no recommend** → `FLAG_REVIEW`; remove from `VERIFIED_CLEAN` if present
- **parked / idk / re-checking** → roster **Parked**; off `VERIFIED_CLEAN`
- **removed / owner no** → roster **Removed**; off `VERIFIED_CLEAN`
- **known fanservice (heavy)** → `NO_RECOMMEND_KNOWN_FANSERVICE`
- **comic caution (lighter)** → `FANSERVICE_CAUTION_GRAPHIC`
- **deity/mythology comfort (hand-vetted clean)** → `VERIFIED_CLEAN` with `requiresDeityMythologyOptIn: true` (Book Quest includes when reader hasn’t excluded deity/mythology)
- **deity/mythology (not hand-vetted / catalog-only)** → `DEITY_COMFORT` (comfort note; Book Quest only when reader allows deity/mythology)

## Code patterns

- Match style in `halalit-curated-shelf-warnings.js`: `titleRe`, optional `authorRe`, `bookNote(...)`, optional `requiresMagicOptIn`.
- Wire all known pen names into `authorRe` (`halalit-vet-pen-names.mdc`).
- Age sync: `halalit-bookquest-age-ratings.js` — `TITLE_BAND_RULES`, `TITLE_INTEREST_THROUGH_RULES`, or `VARIANT_BAND` when tied to Book Quest picks.
- Family shelf blocks: `halalit-family-shelf-policy.js` only when a title needs a hard block beyond curated warnings.

## Examples

**Input:** `Heidi — Spyri — clean, Kids`

→ Add to Kids table in roster; `VERIFIED_CLEAN` entry; age rules; deploy; confirm in plain English.

**Input:** `Squished — Lloyd — no`

→ Move to Removed; `FLAG_REVIEW` or remove verified; deploy; confirm.

**Input:** `Pokemon Adventures manga — flagged fanservice`

→ `NO_RECOMMEND_KNOWN_FANSERVICE`; not `VERIFIED_CLEAN`.

## After logging

One short confirmation per title. Do **not** suggest a new plot-vet batch unless the owner asks.
