# Cursor task template (paste at start of a chat)

Copy one block below. Fill in the `[brackets]`. Use **Phase 1** first; send **Phase 2** only after you agree with the verdict.

---

## Phase 1 — Verdict only (default)

```
Read ODDTROVE-CAPABILITIES.md and any site rule that applies.

Task: [one sentence — what you want]

Verdict only — no file edits yet.
Use labels: Feasible now / Feasible with tradeoffs / Not yet / Not feasible / Needs you.
Name blockers in plain English.

Do NOT touch:
- [files, features, or approaches to leave alone — e.g. "unpack camera / close-up swap", "Halalit vet lists"]

If the same approach already failed twice in past work, say so and stop — do not retry.
```

---

## Phase 2 — Build (after you approve the verdict)

```
Approved. Proceed with the verdict you gave.

Do exactly:
- [numbered list of allowed changes]

Do NOT:
- [rewrite systems, deploy, delete content, etc. unless listed above]

When done:
- Summarize what changed in plain English (no code unless I ask)
- Say whether deploy is needed; do not deploy unless I said deploy / ship it / yes
- If it looks right and I said commit, commit with a clear message
```

---

## Short one-liner (quick tasks)

```
Verdict first (read ODDTROVE-CAPABILITIES.md). Task: [X]. Touch only [Y]. Do not rewrite [Z]. No deploy unless I say deploy.
```

---

## Examples

**Climatic Mysteries unpack**

```
Verdict only. Tune keys close-up crop in build-unpack-closeups.py only.
Do not bring back CSS camera math. Do not change focusUnpackItem logic.
Read climatic-mysteries-unpack-camera rule.
```

**Halalit**

```
Verdict only. [Book Quest / import / copy change].
Read halalit roadmap if planning. No live site changes to vet lists unless I say ship.
```

**Deploy**

```
Deploy check first, then deploy only if I already said deploy now.
Site: [Halalit / Crocheter / Climatic Mysteries / all kids sites].
```

---

## When something finally works

```
This works. Commit with message: [short description]. Stop — no refactors, no "while I'm here" fixes.
```
