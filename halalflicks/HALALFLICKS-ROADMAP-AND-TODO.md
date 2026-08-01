# HalalFlicks — roadmap & todo

**Planning doc only** — not deployed unless you say deploy (owner-only for now).

**Working title:** HalalFlicks (rename later OK).

**Capabilities:** `ODDTROVE-CAPABILITIES.md`

---

## Product direction (pinned 2026-08-01)

**HalalFlicks is a filter + companion for now — not a movie player or streaming service.**

- Between **HalaLit** (check + shelf) and **HalaLyrics** (screener + curated picks), for **movies**.
- **Does not host or stream video.** Link-out after a title passes (or you override).
- **Hand-vetted notes always win** over automated scan.
- **ForeWarner** stays the future “warn on Netflix/YouTube click” tool — do not merge products.

**One-line pitch:** Check before watch — family-friendly movie filter + shelf + curated picks.

**Access:** **Owner-only** on Odd Trove until you say otherwise.

---

## Shipped (v0)

- [x] Owner-only on Odd Trove (`/halalflicks/` + hub owner list)
- [x] **Flickcheck** — title + optional year + optional synopsis/trailer notes; Wikipedia plot fallback; Gemini theme scan
- [x] Hand-vetted overrides (`config/hand_vetted.json`)
- [x] **Recommend** — owner-curated catalog (`config/rec_catalog.json`), theme search, device prefs, link-out only
- [x] **My shelf** — localStorage only (want / watched / favorite)
- [x] Quiet owner-beta copy

---

## Suggested build order

| Phase | What | Why |
|-------|------|-----|
| **1** | Grow hand-vetted list + tune scan false positives/negatives | Trust layer |
| **2** | Shelf ↔ Flickcheck — saved titles show verdict | Personal companion |
| **3** | Grow curated OK / Recommend catalog | Useful before any extension |
| **4** | Better metadata (OMDb/TMDB if you add keys) | Stronger plots when Wikipedia misses |
| **5** | Public quiet beta (when you say) | Match HalaLyrics access model |
| **6** | Accounts + shelf sync | When shelves matter across devices |

**Avoid for now:** hosting video, in-app streaming, ForeWarner extension scope, public comment walls.

---

## Your additions

*(Owner pins go here.)*
