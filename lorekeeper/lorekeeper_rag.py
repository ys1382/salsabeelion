"""LoreKeeper — RAG recall: local retrieval + Anthropic composition (librarian only)."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Callable

from lorekeeper_character_compose import is_audit_question, is_coverage_question
from lorekeeper_character_summary import character_targets, is_who_is_question
from lorekeeper_question_routes import is_character_portrait_question, is_story_position_question, is_what_question
from lorekeeper_knowledge_pov import is_awareness_question
from lorekeeper_aliases import alias_reference_lines_for
from lorekeeper_inference import (
    audit_contradiction_lines_for,
    inference_reference_lines_for,
)
from lorekeeper_situation import is_situation_question, situation_blocks_for_prompt
from lorekeeper_story_position import draft_tail_prompt_block
from lorekeeper_catchup_gather import catchup_prompt_block, is_catchup_gather_question
from lorekeeper_allusion import allusion_lines_for_prompt, is_allusion_question
from lorekeeper_reliability import (
    MaterialState,
    classify_material,
    extract_work_hints,
    filter_entries_by_work,
    format_nothing_saved,
    primary_work_hints,
    sources_from_ranked,
    work_named_in_question,
)

from lorekeeper_ask_plan import AskPlan

RAG_VERSION = "21.3.0-rag"

# Override with LOREKEEPER_ANTHROPIC_MODEL on the server if needed.
DEFAULT_MODEL = os.environ.get(
    "LOREKEEPER_ANTHROPIC_MODEL", "claude-sonnet-4-6"
)
MAX_RETRIEVAL_CHUNKS = int(os.environ.get("LOREKEEPER_RAG_TOP_K", "12"))
MIN_RETRIEVAL_SCORE = int(os.environ.get("LOREKEEPER_RAG_MIN_SCORE", "3"))
MAX_CHUNK_CHARS = int(os.environ.get("LOREKEEPER_RAG_CHUNK_CHARS", "1800"))
MAX_CONTEXT_CHARS = int(os.environ.get("LOREKEEPER_RAG_CONTEXT_CHARS", "14000"))

_SYSTEM_BASE = """You are LoreKeeper — a librarian for one writer's private notes and drafts.

Rules (non-negotiable):
- Answer ONLY from the numbered SOURCE blocks provided. Never use outside knowledge.
- Never write labels like "SOURCE 3", "[SOURCE 9]", or source ids in the answer — those tags are for retrieval only. Restate facts in plain librarian prose (e.g. "notes make clear…" / "the draft shows…").
- When a Work scope or story silo is named, stay inside that ONE story's draft and notes. Do not mix in other stories or the Random ideas pile.
- When the scope is Random ideas (floating / unassigned notes), answer ONLY from those unassigned notes — never from story-tagged drafts.
- Answer ONLY what the question asks — omit unrelated characters, plot, and lore not needed for this answer.
- Prefer the names and time window the writer asked about (e.g. a later name + pre/post war). Do not replace them with earlier personas or a different era unless the question asks for that.
- Never invent story, lore, motives, relationships, or facts not supported by the sources.
- Never equate two characters as a "human counterpart", "version of", or "alternate form of" another unless a source states that explicitly.
- Never add causal twists like "despite their biological relation" unless the sources say that tension exists.
- Connect dots the sources support (e.g. dialogue calling someone "brother" → sibling tie) but never upgrade into unstated backstory.
- Do not dump every source — pick the minimum needed for a direct answer.
- Never write meta lines like "the sources establish/indicate/show that…" — just state the supported facts.
- End with a blank line then exactly: — From your notes only. Nothing invented."""

_STORY_POSITION = """
This asks where the writer left off in the MAIN DRAFT — answer as a short PLANNING BRIEF so they can decide what to write next.

VOICE (required):
- Formal, professional, engaging librarian — like a calm story-position memo
- NOT the novel's narrative voice, NOT close-third immersion, NOT prose imitation
- Prefer "Character A is being taken to …" / "A believes …" over sensory scene painting
- Skip decorative or bodily-detail beats (e.g. paws/feet not touching the ground, grit of the path) unless that detail is the only way a fact is stated

LENGTH: one tight paragraph (occasionally two short ones). Never a bullet list. Never an infodump or chapter recap.

WHAT TO INCLUDE (only if sources support it — invent nothing):
1. NOW — who is acting on whom, where they are headed, and what the active pressure is
2. STAKES / BELIEF — what the focal character thinks awaits them; when notes correct that belief, mirror the notes' framing exactly:
   - say **incorrect** / wrong when notes say the belief is wrong
   - say **incomplete** / partly right when notes say they are right to fear something but wrong about the form (e.g. right to fear predators, wrong that it means a return to darker ages)
   Never soften "incorrect" into "incomplete" or the reverse — follow the saved wording
3. JUST BEFORE — one or two sentences of immediate lead-in only: capture, who caught whom, why they outran or sacrificed for others, escape attempts still in play
4. Destination / building names exactly as the draft or notes name them

WHAT TO OMIT:
- Earlier chapters, prologue, and unrelated subplot
- Quote dumps and dialogue mash
- Full cast cards or relationship essays
- Invented next beats or advice about what to write
- Fake work titles from phrasing like "main draft" or "in terms of plot"
- Any "SOURCE N" / "[SOURCE N]" citation labels in the prose

Use proper names from the cast list and sources. Concepts/places stay concepts — not people.
"""

_CATCHUP_ORIENTATION = """
This is a CATCH-UP / ORIENTATION brief for a thin or early draft — the writer is reorienting after time away.

VOICE (required — never worse than a strong leave-off planning brief):
- Formal, professional, engaging librarian — continuous prose paragraphs
- NOT bullet sections (no Cast / Draft so far / Open questions headers)
- NOT who-is cast cards, NOT a write-next task list, NOT novel prose imitation
- Dense, readable orientation — like a calm memo of what is already saved

LENGTH: one or two tight paragraphs. Never a bullet farm. Never an encyclopedia dump.

WHAT TO INCLUDE when sources support it (invent nothing; omit a slot only if truly absent):
1. NOW — where the focal character is, active pressure, and the stakes of the current situation
2. NAMED ANTAGONIST / BOSS — if notes or draft name the main antagonist, mafia-esque boss, or domain leader even sparsely, use that proper name and the little that is written; do not leave them as a role-only label when a name or concrete detail exists
3. ANTAGONIST SOFTER SIDE (must-keep when saved) — if notes say he is not without a soul / has a softer side / inner dimension / not publicly irredeemable, state that plainly. Do not drop it when packing Capricorn / domain / unearned-knowledge stakes — those stakes often *depend* on that beat.
4. ANTAGONIST STAKES ABOUT HER (must-keep when saved — mine notes for this class) — how he would see / use / fear her: valuable asset vs dangerous threat, unearned knowledge as violation or tool, why her knowing his softer side is precarious in *his* eyes. Scan notes for these stakes even when not labeled "plot" — do not wait for the writer to report the miss.
5. ORIGIN — where the focal character started before this adventure, when saved
6. ENTRY REASON (must-keep when saved) — why they are in the antagonist's domain / this adventure: who brought them (e.g. a named right hand / Sparrow), the offer or premise, acceptance vs refusal danger. Prefer this over only saying that person "operates nearby." Do NOT invent physical transport mechanics if unwritten — restate the saved reason for being there.
7. CAN'T LEAVE YET (must-keep when saved) — why they cannot leave too quickly / must stay for now (suspicion, registration, exposure risk, unfinished cover). Only from sources.
8. Belief corrections when notes frame paranoia vs real threat — mirror the notes exactly

NOTE-READING RULE: Prefer completeness of *stakes classes* already in the sources (entry reason, softer side, antagonist's read of her, can't-leave) over packing only the latest vivid sentence. If a note states he would see her as asset or threat, that line must appear in the brief.

HARD RULE when upgrading density: never drop entry-reason, can't-leave-yet, antagonist softer-side / soul, or antagonist-stakes-about-her beats that the sources still support just to make room for newer origin/world lore. Add depth without erasing those slots.

WHAT TO OMIT:
- Invented flesh for thin notes
- Invented transport / how-the-body-moved details when sources only give reason-for-being-there
- Full cast-card rosters and relationship essays
- Write-next task lists and advice about what to write
- Any "SOURCE N" citation labels
- Mixing other story silos

If material is thin, still cover the slots you can and stay honest — never invent to fill gaps.
"""

_SUMMARIZE = """
This needs a SUMMARY from the writer's saved notes — not a cast card and not bullet scraps.

- One or two coherent paragraphs in reference voice about the work
- Synthesize what the sources support; connect related lines when clearly about the same subject
- For character questions: role, traits, relationships, and behavior the sources state
- For story / motivation questions: what the sources say about events, pressures, and choices
- Do not invent psychology, plot, or traits not grounded in the sources
- No bullet lists unless the question explicitly asks for a list

Structure:
1. Lead with what sources clearly support.
2. If material is thin or incomplete, add a final short paragraph headed "What isn't spelled out yet in your notes:" — honest gaps from sources only; do not invent missing details.
3. Do not mix gap language into the factual lead."""

_CHARACTER_PORTRAIT = """
This is a WHAT / CHARACTER PORTRAIT question — NOT a who-is cast card.

Write one to three coherent paragraphs synthesizing what the sources say about this person:
- Personality, temperament, motives, habits, and how they act toward others (only if sources support it)
- Species, type, or physical kind when the sources state it (e.g. lynx, rabbit) — include early, not only relationships
- Relationships and cast role when relevant — but do not stop at "X is the protagonist"
- Use draft scenes and character notes together when both mention this person
- Reference voice ("Etherei is…" / "She is…") — not "you wrote"

Do NOT give a minimal cast card. Do NOT use bullet lists. Do not invent traits or psychology.

Structure:
1. Lead with what sources clearly support about this person.
2. If notes are thin or incomplete, add a final short paragraph headed "What isn't spelled out yet in your notes:" — honest gaps from sources only; do not invent missing details.
3. Do not mix gap language into the factual lead."""


def _uses_cast_card(
    question: str, question_kind: str, plan: AskPlan | None = None
) -> bool:
    if plan and plan.pipeline == "rag_summarize":
        return False
    if plan and plan.intent in ("character_portrait", "summarize_story"):
        return False
    if is_character_portrait_question(question):
        return False
    return question_kind == "who" or is_who_is_question(question)


_WHO_CAST_CARD = """
This is a WHO-IS question — answer as a short CHARACTER OVERVIEW for the named person only.

TONE: formal but plain — not posh, not chatty, not technical. Prefer 2–4 sentences like:
"Character M is the protagonist of Ashford Saga, the White Rabbit from Alice in Wonderland. He is the son of buck Snow Thistle and doe Ebony, and younger brother to Obsidian and Stygian. Character M is known to Character D as Chroniker. By being discovered in Wonderland by Character D, Character M has already set in motion the Predators' eventual rediscovery that the Preyfolk of their own dimension possess the same level of sentience as themselves, a rediscovery that will gradually but inevitably take place within the span of several months."

Never open with "So Character M," or "Also, aside from…". Prefer "By being discovered…, Character M has already set in motion…" over "just set in motion".

REQUIRED when sources state them (do not stop after role + alias alone):
1. Role — protagonist / POV / antagonist (never "male protagonist")
2. Story significance / upheaval reason — why they matter when notes say it (rediscovery, sentience, chosen one) in formal prose
3. Fairytale / outside-world known-as — only if sources say so
4. Close defining ties ONLY — kin, nemesis, best friend, subject-of-curiosity standing — people who define THIS character
5. Named parents / brothers with standing when stated
6. Optional ONE short formal awareness status only if sources state it (e.g. not yet fully aware of political nuance / an unspoken line crossed) — never a faction roster

HARD LIMIT on ties: at most 2–3 close people. Never dump the whole cast or side friendships.

Prefer companion NOTES (character / relationship / lore notes) for kin and significance — do not stop at draft-only alias lines when notes also name family or stakes.

Gender via buck/doe, son/daughter, brother/sister, or natural he/she — never a lone "X is male."

PREFER overview identity over orphan life summary (father-died / widow / raised-by) when better slots exist.

OMIT completely:
- Scene beats, plot walkthrough, chatty asides ("So …", "Also, aside from…")
- Awareness dumps that list who works with whom (Golden Owl / Lynx / Cheshire Cat roster) or "doesn't know how Predators work"
- Fake kinship stopwords (Especially, Are, …)
- Everyone else in the story who is not a defining tie

Invent nothing. If a slot is missing from sources, omit it.

Footer: — From your notes only. Nothing invented."""

_AUDIT_META = """
This is an AUDIT question — meta voice is OK.

Surface gaps, discrepancies, contradictions, planning notes, and things the writer flagged to fix — only if present in the sources. Do not invent problems."""

_COVERAGE_META = """
This is a COVERAGE question — meta voice is OK ("You have…", "You haven't…").

Summarize what is saved vs missing for the subject. Planning notes and gaps are OK here.
When the question asks what happens after a named beat, prioritize notes and draft lines about that later stretch — do not stop at the beat itself.
Never invent hybrid creatures or roles (e.g. do not fuse a named sentinel with a separate birds note into a "sentinel bird"). Restate only identities the sources actually state."""

_TOPIC_DEFAULT = """
Answer the question directly from the sources in reference voice.
Lead with the sentence that answers what was asked — do not bury it under cast cards, backstory, or profile sections.
Include only facts needed for this question — not the full plot, every character, or every scene beat.
Stay focused on what was asked. One short paragraph unless the question explicitly asks for a summary.
Never invent identities, species, or hybrid roles that sources do not state. If one note names a sentinel and another discusses birds, do not invent a sentinel bird."""

_AWARENESS = """
This asks how aware or informed someone is about a specific topic — NOT a full character profile.

Rules:
- First sentence must state their awareness level or what they know about the topic asked
- No cast-card headers, bullet sections, or "Key Ties" blocks
- No backstory before the current story unless one short phrase is needed
- No prior-story hooks or off-page events unless the question asks for them
- One short paragraph (2–4 sentences max) unless sources require a bit more
"""

_RELATIONSHIP_CARD = """
This is a KINSHIP / FAMILY-TIE question — how these two people are related by family or marriage.

Rules:
- State sibling / parent / spouse / cousin ties ONLY if sources support them.
- One or two short sentences. Do NOT dump story arcs, wartime dynamics, or full profiles.
- If sources do not state a family tie, say so honestly."""

_RELATIONSHIP_ARC = """
This is a STORY-RELATIONSHIP question — the NATURE of how these people stand toward each other (trust, rivalry, mentorship, fear, uneasy alliance, loyalty, betrayal, use-then-attachment, etc.), and how that stance shifts if the question asks.

Priority (faithful depth from sources — not invention):
1. Lead with the KIND of bond or stance the sources support — name the dynamic in plain words.
2. Then restate the supporting beats the sources actually give. If the question asks pre/post or before/after a war/event, cover each phase the sources support with enough detail to reflect what is saved (usually one short paragraph per phase). Events are evidence for the dynamic — include them when they show how the bond works; do not invent a plot walkthrough beyond the sources.
3. Do NOT invent inner motives or feelings the sources do not support. Synthesize stance ONLY when behavior in the sources clearly supports it.

Rules:
- Prefer a fuller restatement of what IS saved over declaring a gap. When multiple SOURCE blocks describe the pair, use them.
- If only one phase is saved, cover that phase in depth and briefly note the other is not spelled out yet.
- NEVER claim the notes "do not contain story-dynamic material", "only contain one saved draft block", or "cover only their origin" when SOURCE blocks mention either named person interacting, trusting, using, fighting, allying, attaching to, or changing toward the other. Name the dynamic those blocks support.
- NEVER say "No sources spell out…" / "no interaction, alliance, rivalry…" when any SOURCE block names the people or describes scenes with them. Distill the stance from those blocks.
- Answer story dynamics — NOT biological/family ties unless the writer asked about family/blood.
- Use the names the writer used in the question; when role labels (protagonist/antagonist) map to names in the notes, you may use those names.
- Never say "the sources establish/indicate/show" — state the facts in reference voice.
- Invent nothing. Only if sources truly say nothing about either person toward the other may you say that tie is not spelled out yet."""

_WRITER_CONFIRMED = """
The writer already confirmed these SOURCE blocks. You MUST answer from them.
- Do not claim the sources are empty, missing, or silent if any SOURCE text is present below.
- If a name from the question appears in a SOURCE, use that material in the answer.
- Prefer a short faithful summary of what the selected notes say over declaring a gap.
"""

_SYSTEM_BRIEF_SUFFIX = "\n- Keep the answer to 1–2 sentences maximum."

_SITUATION_TOPIC = """
This is a POLITICAL / FACTION situation question — reference voice about the work, not coaching.

Structure (only sections the sources support — omit empty sections):
1. Established — current alliances, control, loyalties stated as fact
2. In flux — changing alliances, former loyalties, uncertainty the sources mention
3. Not written yet — only explicit gaps or TBD lines from sources; never invent missing factions

Never smooth contradictions between sources. No bullet lists. Short paragraphs only."""

_ALLUSION_TOPIC = """
This is a REFERENCE / ALLUSION question — evidence from the writer's notes only.

Rules:
- State tale/source ties ONLY when a source block explicitly says so (based on, inspired by, retelling, in the events of, known tale:, etc.)
- Never attribute roots from character names, plot similarity, or outside literary knowledge
- If pre-parsed tie lines appear below, use them; do not add tales not in the sources
- Reference voice about the work; if no ties exist, say none are stated — do not guess"""


def _system_for_kind(
    question: str,
    question_kind: str,
    *,
    brief: bool,
    plan: AskPlan | None = None,
    writer_confirmed: bool = False,
) -> str:
    parts = [_SYSTEM_BASE]
    if plan and plan.intent == "character_portrait":
        parts.append(_CHARACTER_PORTRAIT)
    elif plan and plan.intent == "narrow_fact" and is_awareness_question(question):
        parts.append(_AWARENESS)
    elif (plan and plan.intent == "relationship") or question_kind == "relationship":
        from lorekeeper_relations import is_story_arc_relationship_question

        if is_story_arc_relationship_question(question):
            parts.append(_RELATIONSHIP_ARC)
        else:
            parts.append(_RELATIONSHIP_CARD)
    elif (
        (plan and plan.intent == "catchup_gather")
        or question_kind == "catchup_gather"
        or is_catchup_gather_question(question)
    ):
        parts.append(_CATCHUP_ORIENTATION)
    elif (plan and plan.pipeline == "rag_resume") or question_kind == "resume" or is_story_position_question(question):
        parts.append(_STORY_POSITION)
    elif plan and plan.pipeline == "rag_summarize":
        parts.append(_SUMMARIZE)
    elif _uses_cast_card(question, question_kind, plan):
        parts.append(_WHO_CAST_CARD)
    elif is_audit_question(question):
        parts.append(_AUDIT_META)
    elif question_kind == "coverage" or is_coverage_question(question):
        parts.append(_COVERAGE_META)
    elif is_situation_question(question):
        parts.append(_SITUATION_TOPIC)
    elif is_allusion_question(question):
        parts.append(_ALLUSION_TOPIC)
    else:
        parts.append(_TOPIC_DEFAULT)
    if writer_confirmed:
        parts.append(_WRITER_CONFIRMED)
    system = "\n".join(parts)
    if brief:
        system += _SYSTEM_BRIEF_SUFFIX
    return system


def _default_key_path() -> str:
    explicit = os.environ.get("LOREKEEPER_ANTHROPIC_KEY_PATH", "").strip()
    if explicit:
        return explicit
    shared = os.environ.get("KIDS_SITES_ANTHROPIC_KEY_PATH", "").strip()
    if shared:
        return shared
    base = os.environ.get("KIDS_SITES_BASE", "").strip()
    if base:
        return os.path.join(base, "anthropic.key")
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(here, "anthropic.key")


def anthropic_api_key() -> str:
    """Same env var as Maestro's Odyssey serve.py; optional shared anthropic.key file."""
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    path = _default_key_path()
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    return ""


def rag_enabled() -> bool:
    if os.environ.get("LOREKEEPER_RAG", "1").strip().lower() in ("0", "false", "no", "off"):
        return False
    return bool(anthropic_api_key())


def _dedupe_ranked(ranked: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Dedupe sources. Long parent docs must not suppress their paragraph chunks.

    Full draft bodies are head-truncated in the prompt; keeping only the parent
    drops later arc material. Prefer up to several #p chunks from the same doc.
    """
    by_base: dict[str, list[dict[str, Any]]] = {}
    for row in ranked:
        eid = str(row.get("id") or "")
        base = eid.split("#")[0] if "#" in eid else eid
        by_base.setdefault(base or eid, []).append(row)

    long_parents_with_chunks: set[str] = set()
    for base, rows in by_base.items():
        has_chunk = any("#" in str(r.get("id") or "") for r in rows)
        parent_long = any(
            "#" not in str(r.get("id") or "")
            and len(str(r.get("body") or "")) > MAX_CHUNK_CHARS
            for r in rows
        )
        if has_chunk and parent_long:
            long_parents_with_chunks.add(base)

    seen_plain: set[str] = set()
    chunk_counts: dict[str, int] = {}
    out: list[dict[str, Any]] = []
    for row in ranked:
        eid = str(row.get("id") or "")
        base = eid.split("#")[0] if "#" in eid else eid
        key = base or eid
        is_chunk = "#" in eid
        if not is_chunk and key in long_parents_with_chunks:
            continue
        if is_chunk:
            n = chunk_counts.get(key, 0)
            if n >= 5:
                continue
            chunk_counts[key] = n + 1
            out.append(row)
        else:
            if key in seen_plain:
                continue
            seen_plain.add(key)
            out.append(row)
        if len(out) >= MAX_RETRIEVAL_CHUNKS:
            break
    return out


def retrieve_for_question(
    question: str,
    entries: list[dict[str, Any]],
    *,
    rank_entries: Callable[[str, list[dict[str, Any]]], list[dict[str, Any]]],
    augment_ranked: Callable[
        [str, list[dict[str, Any]], list[dict[str, Any]]], list[dict[str, Any]]
    ]
    | None = None,
    writer_confirmed: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], set[str], bool]:
    """Return (scoped_entries, ranked_chunks, work_hints, strict_work)."""
    if writer_confirmed:
        # Writer already pinned these notes — do not re-filter by work membership.
        scoped = [e for e in entries if isinstance(e, dict)]
        work_hints = extract_work_hints(question, scoped)
        ranked = rank_entries(question, scoped)
        if augment_ranked:
            ranked = augment_ranked(question, scoped, ranked)
        if not ranked:
            ranked = []
            for entry in scoped:
                body = str(entry.get("body") or "")
                ranked.append(
                    {
                        "id": str(entry.get("id") or ""),
                        "title": str(entry.get("title") or "Untitled"),
                        "kind": str(entry.get("kind") or "note"),
                        "kindLabel": str(entry.get("kindLabel") or "Note"),
                        "score": 40,
                        "excerpt": body[:220],
                        "body": body[:8000],
                    }
                )
        ranked.sort(key=lambda r: r.get("score", 0), reverse=True)
        ranked = _dedupe_ranked(ranked)
        return scoped, ranked, work_hints, False

    work_hints = extract_work_hints(question, entries)
    strict_work = work_named_in_question(question) and bool(primary_work_hints(question))
    if strict_work:
        work_hints = primary_work_hints(question)
    scoped = filter_entries_by_work(entries, work_hints, strict=strict_work)

    ranked = rank_entries(question, scoped)
    if augment_ranked:
        ranked = augment_ranked(question, scoped, ranked)

    ranked = [r for r in ranked if r.get("score", 0) >= MIN_RETRIEVAL_SCORE]
    ranked.sort(key=lambda r: r.get("score", 0), reverse=True)
    ranked = _dedupe_ranked(ranked)

    return scoped, ranked, work_hints, strict_work


def _format_sources_block(ranked: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    total = 0
    for i, row in enumerate(ranked, start=1):
        body = (row.get("body") or row.get("excerpt") or "").strip()
        if len(body) > MAX_CHUNK_CHARS:
            body = body[: MAX_CHUNK_CHARS - 1].rsplit(" ", 1)[0] + "…"
        block = (
            f"[SOURCE {i}] id={row.get('id')} | {row.get('title')} "
            f"({row.get('kindLabel', row.get('kind', 'Note'))})\n{body}"
        )
        if total + len(block) > MAX_CONTEXT_CHARS:
            break
        parts.append(block)
        total += len(block)
    return "\n\n".join(parts)


def _build_user_prompt(
    question: str,
    ranked: list[dict[str, Any]],
    *,
    work_hints: set[str],
    question_kind: str = "fallback",
    scoped_entries: list[dict[str, Any]] | None = None,
    plan: AskPlan | None = None,
) -> str:
    work_line = ""
    if work_hints:
        work_line = (
            "Story silo / work scope (answer ONLY from this story): "
            + ", ".join(sorted(work_hints))
            + "\n"
        )
    sources = _format_sources_block(ranked)
    if not sources:
        sources = "(No matching sources retrieved.)"
    kind_hint = ""
    alias_block = ""
    inference_block = ""
    audit_block = ""
    situation_block = ""
    allusion_block = ""
    draft_hint = ""
    draft_tail_block = ""
    catchup_block = ""
    if plan and plan.intent == "character_portrait":
        kind_hint = _CHARACTER_PORTRAIT + "\n"
    elif plan and plan.intent == "narrow_fact" and is_awareness_question(question):
        kind_hint = _AWARENESS + "\n"
    elif (plan and plan.intent == "relationship") or question_kind == "relationship":
        from lorekeeper_relations import (
            is_story_arc_relationship_question,
            relationship_between_pair,
        )

        if is_story_arc_relationship_question(question):
            kind_hint = _RELATIONSHIP_ARC + "\n"
        else:
            kind_hint = _RELATIONSHIP_CARD + "\n"
        pair = relationship_between_pair(question)
        if pair:
            kind_hint += (
                f"Pair named in the question: {pair[0]} and {pair[1]}. "
                "Keep those labels"
            )
            if is_story_arc_relationship_question(question):
                kind_hint += (
                    "; answer story dynamics / pre-post phases — "
                    "not biological kinship unless asked.\n"
                )
                if scoped_entries:
                    from lorekeeper_relations import resolve_pair_name_sets

                    left, right = resolve_pair_name_sets(
                        pair[0], pair[1], scoped_entries
                    )
                    left_s = ", ".join(left)
                    right_s = ", ".join(right)
                    if left_s or right_s:
                        kind_hint += (
                            f"In these notes, {pair[0]} maps to: {left_s}. "
                            f"{pair[1]} maps to: {right_s}. "
                            "Retrieve and answer using those names when sources use them.\n"
                        )
            else:
                kind_hint += "; answer family/kinship ties only.\n"
    elif (
        (plan and plan.intent == "catchup_gather")
        or question_kind == "catchup_gather"
        or is_catchup_gather_question(question)
    ):
        kind_hint = _CATCHUP_ORIENTATION + "\n"
        if scoped_entries:
            catchup_block = catchup_prompt_block(scoped_entries, question)
    elif plan and plan.pipeline == "rag_summarize":
        kind_hint = _SUMMARIZE + "\n"
        try:
            from lorekeeper_plot_span import plot_span_prompt_hint

            span_hint = plot_span_prompt_hint(question)
            if span_hint:
                kind_hint += span_hint
        except Exception:
            pass
    elif (plan and plan.pipeline == "rag_resume") or is_story_position_question(question) or question_kind == "resume":
        kind_hint = _STORY_POSITION + "\n"
        if scoped_entries:
            draft_tail_block = draft_tail_prompt_block(scoped_entries, question)
    elif _uses_cast_card(question, question_kind, plan):
        kind_hint = (
            "Pinned character overview: role + story significance + close defining "
            "ties (kin/nemesis/best friend) from NOTES as well as draft. "
            "Do not stop after alias alone. Cap ties at 2–3 people — not a cast roster. "
            "No 'male protagonist', no orphan life dump, no scene plot.\n\n"
        )
        doc_sources = sum(
            1
            for row in ranked
            if str(row.get("kind") or "") == "document" or "#p" in str(row.get("id") or "")
        )
        note_sources = sum(
            1
            for row in ranked
            if str(row.get("kind") or "").lower()
            in ("character", "relationship", "note", "species", "politics", "")
            and "#p" not in str(row.get("id") or "")
        )
        if doc_sources and doc_sources >= max(1, len(ranked) // 2):
            draft_hint = (
                "Retrieval is mostly draft/document — still check any character/"
                "relationship/note sources for kin, nemesis, and story significance. "
                "Do not retell scenes.\n\n"
            )
        elif note_sources:
            draft_hint = (
                "Companion notes are available — prefer them for family ties and "
                "story significance; use draft only for fixed identity/alias facts.\n\n"
            )
        targets = character_targets(question)
        if targets and scoped_entries:
            alias_lines = alias_reference_lines_for(targets[0], scoped_entries, work_hints)
            if alias_lines:
                alias_block = (
                    "Linked names (use direction exactly — do not flip):\n"
                    + "\n".join(f"- {line}" for line in alias_lines)
                    + "\n\n"
                )
            inference_lines = inference_reference_lines_for(targets[0], scoped_entries)
            if inference_lines:
                inference_block = (
                    "Supported inference from your notes (use verbatim when relevant; "
                    "do not invent beyond this):\n"
                    + "\n".join(f"- {line}" for line in inference_lines)
                    + "\n\n"
                )
    elif is_what_question(question) and question_kind in ("topic", "fallback", "where", "when"):
        kind_hint = (
            "This is a WHAT question — answer the specific question asked. "
            "One or two short paragraphs max. No cast-card format unless they asked who someone is. "
            "No bullet lists unless they asked for a list.\n\n"
        )
    elif is_situation_question(question) and scoped_entries:
        blocks = situation_blocks_for_prompt(question, scoped_entries)
        parts: list[str] = []
        if blocks.get("settled"):
            parts.append(
                "Established (reference voice):\n"
                + "\n".join(f"- {line}" for line in blocks["settled"])
            )
        if blocks.get("shifting"):
            parts.append(
                "In flux:\n" + "\n".join(f"- {line}" for line in blocks["shifting"])
            )
        if blocks.get("gaps"):
            parts.append(
                "Not written yet:\n"
                + "\n".join(f"- {line}" for line in blocks["gaps"])
            )
        if parts:
            situation_block = (
                "Phased situation from your notes (use structure; do not invent):\n"
                + "\n\n".join(parts)
                + "\n\n"
            )
    elif is_allusion_question(question) and scoped_entries:
        allusion_lines = allusion_lines_for_prompt(question, scoped_entries)
        if allusion_lines:
            allusion_block = (
                "Explicit tale/source ties from your notes (evidence only — "
                "do not add roots not listed here):\n"
                + "\n".join(f"- {line}" for line in allusion_lines)
                + "\n\n"
            )
    elif is_audit_question(question):
        kind_hint = "Compose an audit answer: discrepancies and planning notes only.\n\n"
        targets = character_targets(question)
        if targets and scoped_entries:
            contradiction_lines = audit_contradiction_lines_for(
                targets[0], scoped_entries
            )
            if contradiction_lines:
                audit_block = (
                    "Pre-parsed disagreements in your notes (surface honestly; "
                    "do not pick a winner):\n"
                    + "\n".join(f"- {line}" for line in contradiction_lines)
                    + "\n\n"
                )
    return (
        f"{work_line}"
        f"{kind_hint}"
        f"{catchup_block}"
        f"{draft_tail_block}"
        f"{draft_hint}"
        f"{alias_block}"
        f"{inference_block}"
        f"{situation_block}"
        f"{allusion_block}"
        f"{audit_block}"
        f"Writer's question:\n{question}\n\n"
        f"Retrieved sources from this account only:\n\n{sources}\n\n"
        "Compose the best librarian answer you can from these sources alone."
    )


def _call_anthropic(
    *,
    system: str,
    user_content: str,
    max_tokens: int = 1200,
    model: str | None = None,
) -> tuple[str, str]:
    """Return (answer_text, stop_reason). stop_reason is '' when unknown."""
    api_key = anthropic_api_key()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    payload = {
        "model": model or DEFAULT_MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user_content}],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    last_exc: Exception | None = None
    data: dict[str, Any] | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            last_exc = None
            break
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            last_exc = RuntimeError(f"Anthropic HTTP {exc.code}: {detail}")
            if exc.code in (429, 529) and attempt < 2:
                import time

                time.sleep(1.5 * (attempt + 1))
                continue
            raise last_exc from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Anthropic network error: {exc}") from exc
    if last_exc:
        raise last_exc
    if not data:
        raise RuntimeError("Anthropic request failed")

    blocks = data.get("content") or []
    text_parts = [
        b.get("text", "")
        for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    ]
    answer = "".join(text_parts).strip()
    if not answer:
        raise RuntimeError("Anthropic returned empty content")
    stop_reason = str(data.get("stop_reason") or "").strip()
    return answer, stop_reason


def _compose_with_token_budget(
    *,
    system: str,
    user_content: str,
    max_tokens: int,
    model: str | None,
) -> str:
    """Call Anthropic; if cut off by max_tokens, retry once with a higher budget."""
    from lorekeeper_answer_focus import drop_trailing_unfinished_clause

    answer, stop_reason = _call_anthropic(
        system=system,
        user_content=user_content,
        max_tokens=max_tokens,
        model=model,
    )
    if stop_reason == "max_tokens":
        bump = min(max(max_tokens * 2, max_tokens + 400), 2000)
        if bump > max_tokens:
            answer, stop_reason = _call_anthropic(
                system=system,
                user_content=user_content,
                max_tokens=bump,
                model=model,
            )
    answer = drop_trailing_unfinished_clause(answer)
    return answer


def answer_with_rag(
    question: str,
    entries: list[dict[str, Any]],
    *,
    mode: str,
    rank_entries: Callable[[str, list[dict[str, Any]]], list[dict[str, Any]]],
    augment_ranked: Callable[
        [str, list[dict[str, Any]], list[dict[str, Any]]], list[dict[str, Any]]
    ]
    | None = None,
    question_kind: str = "fallback",
    plan: AskPlan | None = None,
    writer_confirmed: bool = False,
) -> dict[str, Any]:
    """Retrieve locally, compose with Anthropic. Raises on API failure."""
    effective_kind = plan.question_kind if plan else question_kind
    answer_model = plan.resolve_answer_model_id() if plan else DEFAULT_MODEL

    scoped, ranked, work_hints, strict_work = retrieve_for_question(
        question,
        entries,
        rank_entries=rank_entries,
        augment_ranked=augment_ranked,
        writer_confirmed=writer_confirmed,
    )

    if strict_work and not scoped:
        return {
            "answer": format_nothing_saved(
                question, work_hints, corpus_nonempty=bool(entries)
            ),
            "sources": [],
            "materialState": "nothing_saved",
            "questionKind": effective_kind,
            "retrievalCount": 0,
        }

    if not ranked:
        if not scoped:
            return {
                "answer": format_nothing_saved(
                    question, work_hints, corpus_nonempty=bool(entries)
                ),
                "sources": [],
                "materialState": "nothing_saved",
                "questionKind": effective_kind,
                "retrievalCount": 0,
            }
        msg = (
            "I found notes for this work, but nothing clear enough to answer that yet. "
            "Try a narrower question, or add more draft/notes, then ask again."
        )
        if effective_kind == "who" or is_who_is_question(question):
            msg = (
                "I couldn't find clear saved material that answers that. "
                "Try tagging notes with the work title and asking again — "
                "e.g. “In Ashford Saga, who is Character M?”"
            )
        return {
            "answer": msg,
            "sources": [],
            "materialState": "fragments_only",
            "questionKind": effective_kind,
            "retrievalCount": 0,
        }

    system = _system_for_kind(
        question,
        effective_kind,
        brief=(mode == "brief"),
        plan=plan,
        writer_confirmed=writer_confirmed,
    )
    user_prompt = _build_user_prompt(
        question,
        ranked,
        work_hints=work_hints,
        question_kind=effective_kind,
        scoped_entries=scoped,
        plan=plan,
    )
    if effective_kind == "who" or is_who_is_question(question):
        max_tokens = 320 if mode == "brief" else 520
    elif effective_kind == "relationship":
        max_tokens = 200 if mode == "brief" else 320
    elif is_audit_question(question) or effective_kind == "coverage":
        max_tokens = 400 if mode == "brief" else 900
    elif plan and plan.intent == "character_portrait":
        max_tokens = 600 if mode == "brief" else 1200
    elif plan and plan.pipeline == "rag_summarize":
        max_tokens = 500 if mode == "brief" else 1100
    else:
        max_tokens = 320 if mode == "brief" else 700
    answer = _compose_with_token_budget(
        system=system,
        user_content=user_prompt,
        max_tokens=max_tokens,
        model=answer_model,
    )

    if "— From your notes only" not in answer and "From your notes only" not in answer:
        answer = answer.rstrip() + "\n\n— From your notes only. Nothing invented."
    else:
        # Footer present — scrub incomplete body without stripping the librarian line.
        from lorekeeper_answer_focus import drop_trailing_unfinished_clause

        body = answer
        marker = "— From your notes only"
        idx = body.find(marker)
        if idx < 0:
            idx = body.find("From your notes only")
        if idx > 0:
            head = drop_trailing_unfinished_clause(body[:idx].rstrip())
            answer = head + "\n\n" + body[idx:].lstrip()

    material_state: MaterialState = classify_material(
        question,
        scoped,
        ranked,
        answer,
        strict_work=strict_work,
        work_hints=work_hints,
    )
    if material_state == "fragments_only" and ranked[0].get("score", 0) >= 8:
        material_state = "summarizable"

    sources = sources_from_ranked(ranked, material_state)
    return {
        "answer": answer,
        "sources": sources,
        "materialState": material_state,
        "questionKind": effective_kind,
        "retrievalCount": len(ranked),
        "answerModel": answer_model,
        "routerEngine": plan.router_engine if plan else None,
        "askIntent": plan.intent if plan else None,
    }
