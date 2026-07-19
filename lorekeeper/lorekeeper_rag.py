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

RAG_VERSION = "20.0.0-rag"

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
This asks where the draft currently stands — summarize the LATEST beat only (highest page / last source).

- One short paragraph in reference voice — a situational summary, NOT a quote dump from the draft
- State who is doing, weighing, or about to do what, regarding whom, and what pressure or deadline is live
  (e.g. "Etherei is now considering whether to confront Mira and Cassian before they catch on.")
- When the latest draft or the cast-names list names people by proper name, use those names —
  do not replace them with "they", "the others", "two characters", or role-only labels
- Do not treat worldbuilding concepts, note titles, factions, or places as character names —
  keep those as concepts (e.g. "the Predator-Prey situation", "the Gate"), separate from cast
- Synthesize only what the latest draft tail sources support — do not invent motives, plans, or events
- Do not recap earlier chapters or the prologue unless one short phrase orients the reader
- No bullet lists
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
This is a WHO-IS question — answer as a CAST CARD, not a story summary.

Include (only what the sources support):
- Cast role in this work (protagonist, POV, villain, side character, etc.) — if sources say protagonist, never downgrade to side character
- Status and key ties (married to X, sister of Y, queen of Z, species/look if stated as fact)
- At most ONE short prior-story hook if the sources explicitly say it (e.g. "Previously, in the events of [fairytale]…") — orientation only, not a recap
- Where the reader first meets them, if the sources name a scene or chapter — one phrase, not a scene retelling
- Alternate names when sources link them (also known as, aka) — one short line only

When notes are thin but draft/document sources dominate:
- Distill cast role, status, and fixed traits clearly shown in draft prose (voice, rank, look, how others treat them).
- One or two factual sentences — not a scene retelling or plot walkthrough.

Alternate names and identity (direction matters — do not flip):
- "A is known by B as X" means B knows A by the name X — never reverse to "B is known by A".
- "B has shared A's name with people B trusts" means B disclosed A's identity — not an alias of B.
- If pre-parsed linked-name lines appear below the question, use them verbatim; do not rewrite their direction.

Supported inference (only when pre-parsed lines appear below — use verbatim; never invent):
- Sibling ties from vocative dialogue when the speaker context is clear in sources
- Viewpoint / main-character lean from draft prose when no explicit cast role is stated
- Species or world traits only when sources tie this character to that group
- When main draft (document) sources and note sources disagree: do NOT pick a winner and do NOT omit — use this exact layout:
  1. First line exactly: This is what the main draft says:
  2. Blank line, then a short summary from draft/document sources only
  3. Blank line, then exactly: This is what your notes say:
  4. Blank line, then a short summary from note sources only
  Never scold; never invent a merged fact.

OMIT from the lead paragraph:
- Plot walkthrough, life story, or "everything they go through"
- Arc language ("by the events of the series", "caught between realities", "emotional/narrative center", "forms the heart of the story")
- Scene-by-scene beats, dialogue retelling, or synthesizing what happens across chapters
- Author planning notes, TODOs, discrepancies, "you're worried/concerned about", or contradictions between notes

Format: reference voice only ("Ella is…"). 2–4 short factual sentences in the lead paragraph. Do NOT say "you wrote" or coach the writer.

If sources are thin, add a final paragraph headed "What isn't spelled out yet in your notes:" — honest gaps from sources only; never invent missing details. Do not mix gap language into the lead."""

_AUDIT_META = """
This is an AUDIT question — meta voice is OK.

Surface gaps, discrepancies, contradictions, planning notes, and things the writer flagged to fix — only if present in the sources. Do not invent problems."""

_COVERAGE_META = """
This is a COVERAGE question — meta voice is OK ("You have…", "You haven't…").

Summarize what is saved vs missing for the subject. Planning notes and gaps are OK here."""

_TOPIC_DEFAULT = """
Answer the question directly from the sources in reference voice.
Lead with the sentence that answers what was asked — do not bury it under cast cards, backstory, or profile sections.
Include only facts needed for this question — not the full plot, every character, or every scene beat.
Stay focused on what was asked. One short paragraph unless the question explicitly asks for a summary."""

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
This is a RELATIONSHIP-BETWEEN question — answer how these two named people are tied.

Rules:
- Use the names the writer used in the question (e.g. if they said Galloxidor, say Galloxidor — do not swap to an earlier persona or alias unless the question asked about that earlier name).
- If the question asks pre/post, before/after, or during a war/event, structure the answer in those phases (before vs after) from sources only.
- One to three short sentences stating the tie and how it changes across those phases when sources support it.
- Do NOT include full character profiles, unrelated third parties, or a lecture that they are "the same two characters."
- Never say "the sources establish/indicate/show" — state the facts in reference voice.
- If sources do not state a tie between them for a phase, say that phase is not spelled out yet."""

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
    question: str, question_kind: str, *, brief: bool, plan: AskPlan | None = None
) -> str:
    parts = [_SYSTEM_BASE]
    if plan and plan.intent == "character_portrait":
        parts.append(_CHARACTER_PORTRAIT)
    elif plan and plan.intent == "narrow_fact" and is_awareness_question(question):
        parts.append(_AWARENESS)
    elif (plan and plan.intent == "relationship") or question_kind == "relationship":
        parts.append(_RELATIONSHIP_CARD)
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
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in ranked:
        eid = str(row.get("id") or "")
        base = eid.split("#")[0] if "#" in eid else eid
        key = base or eid
        if key in seen:
            continue
        seen.add(key)
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
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], set[str], bool]:
    """Return (scoped_entries, ranked_chunks, work_hints, strict_work)."""
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
        work_line = f"Work scope: {', '.join(sorted(work_hints))}\n"
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
    if plan and plan.intent == "character_portrait":
        kind_hint = _CHARACTER_PORTRAIT + "\n"
    elif plan and plan.intent == "narrow_fact" and is_awareness_question(question):
        kind_hint = _AWARENESS + "\n"
    elif (plan and plan.intent == "relationship") or question_kind == "relationship":
        kind_hint = _RELATIONSHIP_CARD + "\n"
        from lorekeeper_relations import relationship_between_pair

        pair = relationship_between_pair(question)
        if pair:
            kind_hint += (
                f"Pair named in the question: {pair[0]} and {pair[1]}. "
                "Keep those labels; answer pre/post phases if the question asks.\n"
            )
    elif plan and plan.pipeline == "rag_summarize":
        kind_hint = _SUMMARIZE + "\n"
    elif (plan and plan.pipeline == "rag_resume") or is_story_position_question(question) or question_kind == "resume":
        kind_hint = _STORY_POSITION + "\n"
        if scoped_entries:
            draft_tail_block = draft_tail_prompt_block(scoped_entries, question)
    elif _uses_cast_card(question, question_kind, plan):
        kind_hint = (
            "Compose a cast card: role, status, ties, optional one-line prior-story hook. "
            "No plot recap.\n\n"
        )
        doc_sources = sum(
            1
            for row in ranked
            if str(row.get("kind") or "") == "document" or "#p" in str(row.get("id") or "")
        )
        if doc_sources and doc_sources >= max(1, len(ranked) // 2):
            draft_hint = (
                "Retrieval is mostly draft/document — notes may be thin. "
                "State cast role, status, and fixed traits from the draft; do not retell scenes.\n\n"
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
) -> dict[str, Any]:
    """Retrieve locally, compose with Anthropic. Raises on API failure."""
    effective_kind = plan.question_kind if plan else question_kind
    answer_model = plan.resolve_answer_model_id() if plan else DEFAULT_MODEL

    scoped, ranked, work_hints, strict_work = retrieve_for_question(
        question,
        entries,
        rank_entries=rank_entries,
        augment_ranked=augment_ranked,
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
        question, effective_kind, brief=(mode == "brief"), plan=plan
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
        max_tokens = 280 if mode == "brief" else 450
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
