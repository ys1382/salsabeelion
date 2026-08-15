# LoreKeeper Ask — quality playbook

**Planning doc only** — not deployed. Owner’s Office keeps a short question cheat sheet (no daily checkboxes). This file is the repo reference for you and Cursor.

**Goal:** Ask answers summary questions at least as well as a careful reader of the same saved notes — librarian only, no invented canon.

---

## What “pass” means

| Pass | Fail |
|------|------|
| Fact is in a **saved** note or doc → Ask finds it | “Nothing saved” when you know it’s there |
| “Who is X?” → short **cast card** | Full plot dump or wrong question type |
| “What is X?” / “What kind of person is X?” → **portrait summary** | Cast-card blurb instead |
| Narrow question → **narrow answer** | Infodump on unrelated characters |
| Notes too thin → **honest gap** | Invented psychology or plot |

**Not in scope:** open-ended “discuss my novel” chat, auto-training on your corrections, unconstrained general LLM.

---

## Pinning a gold Ask sample (owner rule — 2026-08-12)

When you say a live answer is the **gold / baseline / never-worse** bar:

1. **Raise the floor** when a later answer is even better — update the fixture + roadmap.
2. **Don’t drop entry-reason beats that were already good** — if a prior gold already had why they’re in this place, who brought them, offer/premise, why they can’t leave yet, antagonist softer side, or **how the antagonist would see her (asset vs threat)**, and notes still support it, the next gold and the next fix must keep those slots. Voice upgrades must not trade away completeness that already passed.
3. “Never worse” = strong planning-brief voice **and** prior good completeness slots still covered when sources have them.
4. Never invent unwritten transport (or other) mechanics; still restate saved reason-for-being-there and can’t-leave-yet.
5. Prefer mining **stakes classes** from notes (entry, softer side, antagonist’s read of her, can’t-leave) over waiting for the owner to report each miss.

Same spirit for leave-off / who-is / writing-next golds: raising voice must not erase locked must-keeps.

**Writing-next golds:** Etherei cast list — `tests/fixtures/etherei_writing_next_gold.txt`. Capture→arrival stretch — `tests/fixtures/capture_to_arrival_writing_next_gold.txt` (locked 2026-08-13; in-window journey beats + unspecified rest; no Ask echo). Do not edit either fixture without owner OK.

**Catch-up gold (premise / thin draft — locked 2026-08-12 evening):** Owner checked **fine — keep it** for *Get me caught up with this story* on premise-heavy early drafts (e.g. *The Waking Dream*). Fixture: `tests/fixtures/catchup_waking_dream_gold.txt`. Bar is orientation for what exists / why here / why can’t leave / how antagonist would see her — not a full plotted novel recap.

---

## Phase 0 — Everyday reliability (no checklist)

Tier A checkboxes are retired. You do not need a two-week checkbox run.

**Still matters for good Ask:** wait for **Saved** · **name the work** (or use doc Ask) · log failures with **It got this wrong**.

Optional: work tags on notes, one facet per question, coverage wording only when you want breadth.

**Question cheat sheet**

| You ask | You should get | Intent |
|---------|----------------|--------|
| Who is Ella? | Short cast card | who_is |
| What is Ella? / What kind of person is Ella? | Portrait paragraphs | character_portrait |
| What is Ella’s role? | One role line | narrow facet |
| How are A and B related? | Relationship only | relationship |
| What does Elara know about …? | POV knowledge | knowledge |
| Where did I leave off? | Latest draft state | story_resume |
| What have I got so far? / Catch me up | Orientation brief: cast, beats, open Qs, planned scraps | catchup_gather |
| What happens in the prologue? | Prologue-scoped summary | summarize_story |
| What’s in my notes but not in the main document? | Note lines not clearly in the draft | notes_not_in_draft |
| Task list / what should I write next? | Short bullets: notes not yet in draft (capped; topic filter) | writing_next |
| Task list for chase / Court / reveals | Same, filtered to that topic | writing_next |

---

## Phase 1 — Corrections loop (main path)

1. **It got this wrong** on home or doc Ask — one sentence on what failed.
2. Review **Owner’s Office → Ask recall corrections** before a Cursor session.
3. Tell Cursor: *Fix Ask from Owner’s Office corrections* (or paste specific failures).
4. Cursor adds **synthetic** cases to `tests/fixtures/ask_regression_cases.json` — never real canon in git.
5. Deploy owner-only → hard refresh → re-ask the same question on Ask to confirm.

**Optional:** Download regression stubs in Owner’s Office → merge into the fixture file.

---

## Phase 2 — Note structure

Ask only summarizes what retrieval can **find**.

- Character note per major cast (role, look, ties, one trait)
- Relationship entries for non-obvious ties
- Work tag on every note and doc
- Draft prose for scenes you care about in Ask
- **Loose-end labels** — `planned:` / `fix:` / `TODO fix` for intentional gaps vs things to fix; Ask *what's not written yet* / *what's flagged to fix*

If a portrait fails but the name is hard to find in your own account in 30 seconds, fix notes first.

---

## Phase 3 — Cursor fix priorities

| Failure type | Likely fix area |
|--------------|-----------------|
| Wrong type (what → who) | `lorekeeper_question_routes.py`, `lorekeeper_ask_router.py` |
| Miss despite saved notes | `lorekeeper_recall.py` retrieval / section scope |
| Thin/wrong summary | local vs RAG in `lorekeeper_recall.py`, `lorekeeper_character_summary.py` |
| Infodump | `lorekeeper_answer_focus.py` |
| Wrong work | work disambiguation |
| Prologue/section wrong | `lorekeeper_section_scope.py` |

---

## Deferred (not in Owner’s Office yet)

**Spot-check set (10 questions + Run)** — pinned for later. Use real Ask + **It got this wrong** until then. Stub code: `lk-spot-check-runner.js`.

**Phase 6 — public launch readiness** is pinned for later. Loose-ends Layer 2 ships owner-only; Layer 3 after launch (#25). Embeddings / Phase 5 Tier D taken down 2026-08-14 — do not build.

---

## Repeat rhythm

- **When Ask fails:** Log correction → Cursor fix session.
- **After each recall deploy:** Re-ask a few questions you care about; log anything still wrong.
- **Before public launch:** Ask feels trustworthy on your usual scoped questions.

**Cursor commands:** *Fix Ask from Owner’s Office corrections* · *Add regression case for [failure type]*
