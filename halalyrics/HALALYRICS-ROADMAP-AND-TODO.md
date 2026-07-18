# HalaLyrics — roadmap & todo

**Planning doc only** — not deployed unless you say deploy.

**Capabilities:** `ODDTROVE-CAPABILITIES.md`

---

## Product direction (pinned 2026-07-11)

**HalaLyrics is a filter for now — not a song player or streaming service.**

- **Like ForeWarner, but for music:** warn / check **before listen** on Spotify, YouTube Music, Apple Music, etc.
- **Does not host or stream audio.** Link-out to existing services after a song passes (or parent overrides).
- **Hand-vetted notes always win** over automated scan.
- **Streaming platform** (own catalog, in-app playback, radio) → **deferred** until filter + vetted corpus are solid.

**One-line pitch:** Check before play — family-friendly song filter, separate from HalaLit books.

**Audience (when wider than owner beta):** Family on one browser — kid vs parent mode with PIN (borrow ForeWarner pattern when built).

**Relationship to other Odd Trove products:**

| Product | Role |
|---------|------|
| **HalaLyrics** | Lyrics-first song filter / Songcheck |
| **ForeWarner** (`clickWarning/`) | Warn before watch / read (video, pages) |
| **CleanScreen** | Filtered web search — reference for content lines, not shared codebase |

---

## Shipped

- [x] Public on Odd Trove — hub link + no nginx owner gate (`/halalyrics/`)
- [x] **Songcheck** — LRCLIB lyrics lookup + Gemini theme scan (5 themes)
- [x] Hand-vetted overrides (`config/hand_vetted.json`)
- [x] Flagged songs: flags-only; OK / leaning OK can expand lyrics
- [x] **My shelf** — localStorage only (want / heard / favorite)
- [x] Songcheck disk + memory cache; streaming scan API
- [x] **Recommend** — owner-curated catalog (`config/rec_catalog.json`), theme search, device prefs ranking, link-out only
- [x] Quiet **beta** copy on hub + HalaLyrics (work in progress; still check yourself)

---

## Suggested build order (filter path)

| Phase | What | Why |
|-------|------|-----|
| **1** | Grow hand-vetted list + tune scan false positives/negatives | Trust layer for everything else |
| **2** | Shelf ↔ Songcheck — saved songs show verdict | Personal companion without playback |
| **3** | Batch vet — paste playlist / album tracklist | Build vetted corpus fast |
| **4** | Grow curated OK / rec catalog — link out to Spotify / YT Music / Apple | Useful guide before any extension |
| **5** | Instrumentals & nasheeds — rules when no lyrics (or different category) | Close gaps lyrics-only scan misses |
| **6** | Public Songcheck lookup (rate-limited, no social wall) | “Bookcheck for songs” |
| **7** | Accounts + shelf sync (Halalit/Crocheter pattern) | When people actually use shelves |
| **8** | Browser extension — badge / warn on YT Music or Spotify web | ForeWarner-shaped gate at point of play |
| **9** | Kid vs parent mode + PIN | Same family-browser model as ForeWarner |

**Avoid for now:** hosting audio, licensing deals, in-app streaming, algorithmic radio, music-video vetting (ForeWarner territory).

---

## Build todo

### Phase 1 — Filter trust

- [ ] **Grow `hand_vetted.json`** from real Songcheck decisions (edge cases, Disney/fantasy, scan overrides)
- [ ] **Tune scan prompt / themes** when false OK or false warn shows up in use
- [ ] **Verdict history** — note scan rule version when re-checking old songs (optional)

### Phase 2 — Personal companion

- [ ] **Shelf row shows last Songcheck verdict** (OK / caution / no / hand-vetted)
- [ ] **Run Songcheck from shelf** — add or refresh a saved song
- [ ] **Shelf tags** — extend want / heard / favorite with filter tags (OK for rec / ask parent / hard no) if useful

### Phase 3 — Corpus & lists

- [ ] **Batch vet UI or script** — many titles at once; export results
- [x] **Curated OK / Recommend catalog** — owner-vetted list with themes; **link out only** (v0 shipped; grow list)
- [ ] **Artist trust levels** — “usually fine” vs “check new releases” (optional)
- [ ] **Stable external IDs** — map to Spotify / YouTube / ISRC where possible (metadata only)

### Phase 4 — Wider reach

- [x] **Public Songcheck** — nginx owner gate off; hub public link
- [ ] **Accounts + server shelf sync** — sign-in required pattern like Halalit/Crocheter
- [ ] **Export / import shelf** — JSON download
- [ ] **Rate limits** on Songcheck API (Gemini cost guard)

### Phase 5 — ForeWarner-shaped gate (later)

- [ ] **Browser extension** — warn or badge before play on one music web app
- [ ] **Kid vs parent mode + PIN** — align with ForeWarner owner decisions in `clickWarning/CLICK-WARNING-ROADMAP.md`
- [ ] **CleanScreen tie-in** — music-specific vet when search rules loosen for hand-approved content

---

## Deferred (not filter v1)

- [ ] **Music streaming platform** — own catalog, hosted audio, in-app player
- [ ] **Algorithmic radio / autoplay feed**
- [ ] **Music video vetting** — lyrics insufficient; overlaps ForeWarner video work
- [ ] **Shazam-style identify-then-check** — hard; not v1
- [ ] **Edgier-but-clean recs** (e.g. some JT Music) — only after filter trust improves

---

## Your additions

*(Owner pins from chat — not on live site unless you ask to build.)*

- [x] **2026-07-11** — Product is a **filter** (ForeWarner-style check-before-play), **not** a streaming/player service for now.
- [x] **2026-07-17** — Recommend tab + stated prefs; curated catalog only; beta “still check yourself” disclaimer on hub + site.
- [x] **2026-07-17** — Recommend never suggests songs from culturally inaccurate, racist, or sexist sources (e.g. Aladdin). Standing product intent; owner judgment on catalog adds.
