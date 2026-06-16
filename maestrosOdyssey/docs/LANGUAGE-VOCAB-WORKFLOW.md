# Language vocab — AI-assisted drafting workflow

## Can Claude (or another API) build the lists?

**Yes — as a draft step**, not as auto-shipped canon.

Use AI to:

- Turn English topic lists into **tiered bilingual entries** (same shape as `mo-civic-vocab.js`: English gloss, target lemma, intro tier, cognate flag).
- Propose **register notes** (café casual vs formal vs civic recognition).
- Split **core** vs **maybe** buckets from owner outlines.

**Always require human review before deploy:**

- **Accuracy** — wrong lemma, false cognate, wrong gender/plural, dialect you didn’t intend.
- **Tone** — family-friendly, no glamorized harm, no sacred mockery, no stereotype garnish (especially Arabic, Turkish, Japanese, Irish contexts).
- **No man-eating** — no cannibalism as **real** history or habit for any people. **OK:** false racist **accusation** quoted so characters **reject it flat** (e.g. smear against dragonfolk / legendary dragons); never narrated as true.
- **Game fit** — recognition / tourist-getting-around / region register; not textbook completeness for its own sake.

## Where API keys live

- **In Cursor:** your Anthropic (or other) key in provider settings — agent drafts in-repo files; you approve edits.
- **Outside Cursor:** a small script can call the API and write `mo-*-vocab.js` — keep keys **out of git** (env vars, `.env` gitignored).

Maestro’s Odyssey does **not** need player-facing API keys for vocab; lists are **static JS** served like today’s civic module.

## Planned modules (owner)

| Module (proposed) | Language | When |
|-------------------|----------|------|
| `mo-civic-vocab.js` | Spanish civic | exists |
| `mo-turkish-vocab.js` | Turkish | manticore / Turkic routes |
| `mo-arabic-vocab.js` | Arabic | desert, trade, signage |
| `mo-japanese-vocab.js` | Japanese | TBD region |
| `mo-irish-vocab.js` | Irish | TBD region |

Wire into scenes and `mo-vocab-progress.js` (or successor) when the **wider world** and **train gate** exist — not required for first draft files.

## Prompt shape that works

Give the model:

1. This file + `docs/LOREBOOK.md` tone gates.
2. Your English bucket list (like the civic/politics list).
3. Output contract: IIFE, `w(en, es, tier, cognate)`, CORE/MAYBE groups, STRONG_STARTER lemmas, no political propaganda, beginner-safe recognition set.

Then **you** skim for wrong cultural notes and missing words before merge.
