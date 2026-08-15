"""LoreKeeper — Haiku Ask router (intent, pipeline, model — not rules-based)."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Any

from lorekeeper_ask_plan import (
    ROUTER_MODEL,
    AskPlan,
)
from lorekeeper_cast_roles import labels_for_cast_role
from lorekeeper_rag import anthropic_api_key

_ROUTER_SYSTEM = """You route LoreKeeper Ask — a librarian on the writer's own notes only. You do NOT answer the question.

Return a single JSON object (no markdown fences) with exactly these keys:
- intent: one of summarize_story, character_portrait, story_resume, who_is, relationship, coverage, audit, narrow_fact, writing_next, catchup_gather, notes_not_in_draft
- pipeline: one of rag_summarize, rag_cast_card, rag_resume
- answer_model: sonnet or haiku
- role_terms: array of cast roles mentioned (e.g. protagonist, antagonist) — empty if none
- character_names: array of proper names or "Character X" labels explicitly in the question — empty if none
- section: null, prologue, or chapter_N (e.g. chapter_3) if the question scopes to one section
- question_kind: one of who, topic, resume, relationship, coverage, fallback, writing_next, catchup_gather, notes_not_in_draft

Pick the closest GOLD FAMILY by whether the writer's question *sounds like* that family. If none sound like it, do not force a gold. Compare to the gold *question* and the kind of answer it produces — not shared keywords alone.

GOLD FAMILIES (question → answer shape; never copy a gold's story facts):
- who_is — "Who is [name]?" → short identity card. Not a plot dump.
- story_resume — "Where did I leave off in the main draft?" → short recap of NOW in the draft. Only when the whole question is about current draft position.
- catchup_gather — "Get me caught up with this story" → orientation of what exists so far. Not a novel rewrite.
- writing_next — "Give me the task list for [character]" OR "task list for what happens between [beat A] and [beat B]" OR "What do I have planned between where I leave off and [named beat]?" → short planned beats from notes, in that window only. Never the whole draft.
- notes_not_in_draft — "What's in my notes but not in the main document?" → unused note lines.

CRITICAL — story_resume vs writing_next stretch:
- If the question asks what is planned / happens BETWEEN the leave-off point AND another beat (POV, scene, chapter, arrival), it is writing_next. "Leave off" is only the start of the window.
- story_resume is ONLY "where did I leave off?" with no second beat / between-window.
- Never dump the draft for a between-window question.

Routing guide:
- summarize_story: plot, scenes, motivation, "what happens" (not between two beats), "what would make"
- character_portrait: "what kind of person", personality, traits, portrait of a named character or role
- story_resume: leave-off / current draft position only (see gold family above)
- writing_next: planned beats / task list / between-two-points stretch (see gold family above)
- catchup_gather: catch me up / what have I got so far
- who_is: ONLY when the question literally asks "who is [name]" — identity lookup, not personality
- NEVER who_is for: "what is [name]", "what kind of person", "what is X like", "what would motivate"

CRITICAL — what vs who:
- "What is Ella?" / "What is Character M?" / "What kind of person is the antagonist?" → character_portrait + rag_summarize + question_kind topic
- "Who is Ella?" → who_is + rag_cast_card + question_kind who
- If the question uses WHAT (not WHO), never return who_is or rag_cast_card

pipeline:
- rag_summarize: default for summarize_story, character_portrait, writing_next, catchup_gather, motivation, most story questions
- rag_cast_card: who_is only
- rag_resume: story_resume only

answer_model:
- sonnet: summarize_story, character_portrait, story_resume, relationship, coverage, catchup_gather
- haiku: narrow_fact, writing_next, notes_not_in_draft

Prefer rag_summarize over rag_cast_card unless the question is clearly who_is."""

_VALID_INTENTS = frozenset(
    {
        "summarize_story",
        "character_portrait",
        "story_resume",
        "who_is",
        "relationship",
        "coverage",
        "audit",
        "narrow_fact",
        "writing_next",
        "catchup_gather",
        "notes_not_in_draft",
    }
)
_VALID_PIPELINES = frozenset({"rag_summarize", "rag_cast_card", "rag_resume"})
_VALID_KINDS = frozenset(
    {
        "who",
        "topic",
        "resume",
        "relationship",
        "coverage",
        "fallback",
        "knowledge",
        "writing_next",
        "catchup_gather",
        "notes_not_in_draft",
    }
)


def entry_hints_for_router(entries: list[dict[str, Any]]) -> dict[str, list[str]]:
    """Light metadata for the router — titles and tags only, no note bodies."""
    works: set[str] = set()
    names: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        for tag in entry.get("tags") or []:
            t = str(tag).strip()
            if len(t) > 2:
                works.add(t)
        title = str(entry.get("title") or "").strip()
        if title and title.lower() not in ("untitled", "untitled document", "page"):
            if " / " in title:
                names.add(title.split(" / ", 1)[-1].strip())
            elif len(title.split()) <= 4 and not title.lower().startswith("chapter"):
                names.add(title)
    return {
        "works": sorted(works)[:12],
        "character_names": sorted(names)[:24],
    }


def default_ask_plan(question: str = "") -> AskPlan:
    """Safe fallback when the router cannot run — summarize with Sonnet."""
    plan = AskPlan(
        intent="summarize_story",
        pipeline="rag_summarize",
        answer_model="sonnet",
        question_kind="topic",
        router_engine="default",
    )
    if question:
        plan = _apply_gold_family_guard(plan, question)
        plan = _apply_portrait_guard(plan, question)
    return plan


def character_labels_for_plan(plan: AskPlan, entries: list[dict[str, Any]]) -> list[str]:
    labels = list(plan.character_names)
    seen = {x.lower() for x in labels}
    for role in plan.role_terms:
        for name in labels_for_cast_role(role, entries):
            key = name.lower()
            if key not in seen:
                seen.add(key)
                labels.append(name)
    return labels[:8]


def _parse_router_json(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


def _apply_gold_family_guard(plan: AskPlan, question: str) -> AskPlan:
    """Closest gold family wins — stretch/planned-between is not a leave-off recap."""
    from lorekeeper_writing_next import is_writing_next_task_list_question

    if not is_writing_next_task_list_question(question):
        return plan
    return AskPlan(
        intent="writing_next",
        pipeline="rag_summarize",
        answer_model="haiku",
        question_kind="writing_next",
        role_terms=[],
        character_names=[],
        section=plan.section,
        use_draft_tail=False,
        router_engine=plan.router_engine,
    )


def _apply_portrait_guard(plan: AskPlan, question: str) -> AskPlan:
    """Correct Haiku when it misroutes what-is character questions as who_is."""
    from lorekeeper_knowledge_pov import awareness_parts, is_awareness_question
    from lorekeeper_question_routes import extract_what_subject, is_character_portrait_question

    if is_awareness_question(question):
        parts = awareness_parts(question)
        names: list[str] = []
        if parts:
            names.append(parts[0])
        return AskPlan(
            intent="narrow_fact",
            pipeline="rag_summarize",
            answer_model="haiku",
            question_kind="knowledge",
            role_terms=[],
            character_names=names[:6],
            section=plan.section,
            use_draft_tail=False,
            router_engine=plan.router_engine,
        )

    if not is_character_portrait_question(question):
        return plan

    names = list(plan.character_names)
    subject = extract_what_subject(question)
    if subject:
        seen = {n.lower() for n in names}
        if subject.lower() not in seen:
            names.insert(0, subject)

    role_terms = list(plan.role_terms)
    for term in (subject or "",):
        low = term.lower().replace("the ", "").strip()
        if low in ("protagonist", "antagonist", "villain", "hero", "heroine") and low not in role_terms:
            role_terms.append(low)

    return AskPlan(
        intent="character_portrait",
        pipeline="rag_summarize",
        answer_model="sonnet",
        question_kind="topic",
        role_terms=role_terms[:6],
        character_names=names[:6],
        section=plan.section,
        use_draft_tail=False,
        router_engine=plan.router_engine,
    )


def _normalize_plan(data: dict[str, Any], question: str = "") -> AskPlan:
    intent = str(data.get("intent") or "summarize_story").strip().lower()
    if intent not in _VALID_INTENTS:
        intent = "summarize_story"

    pipeline = str(data.get("pipeline") or "rag_summarize").strip().lower()
    if pipeline not in _VALID_PIPELINES:
        if intent == "who_is":
            pipeline = "rag_cast_card"
        elif intent == "story_resume":
            pipeline = "rag_resume"
        else:
            pipeline = "rag_summarize"

    answer_model = str(data.get("answer_model") or "sonnet").strip().lower()
    if answer_model not in ("sonnet", "haiku"):
        answer_model = "sonnet"
    if intent in ("summarize_story", "character_portrait", "story_resume", "relationship", "coverage", "catchup_gather"):
        answer_model = "sonnet"

    kind = str(data.get("question_kind") or "topic").strip().lower()
    if kind not in _VALID_KINDS:
        kind = "topic"
    if intent == "who_is":
        kind = "who"
    elif intent == "story_resume":
        kind = "resume"
    elif intent == "relationship":
        kind = "relationship"
    elif intent == "coverage":
        kind = "coverage"
    elif intent == "writing_next":
        kind = "writing_next"
        pipeline = "rag_summarize"
        answer_model = "haiku"
    elif intent == "catchup_gather":
        kind = "catchup_gather"
        pipeline = "rag_summarize"
        answer_model = "sonnet"
    elif intent == "notes_not_in_draft":
        kind = "notes_not_in_draft"
        pipeline = "rag_summarize"
        answer_model = "haiku"

    role_terms = [str(r).strip().lower() for r in (data.get("role_terms") or []) if str(r).strip()]
    character_names = [
        str(n).strip() for n in (data.get("character_names") or []) if str(n).strip()
    ]

    section_raw = data.get("section")
    section: str | None = None
    if section_raw and str(section_raw).lower() not in ("null", "none", ""):
        section = str(section_raw).strip().lower()

    use_draft_tail = intent == "story_resume" or pipeline == "rag_resume"
    if intent == "writing_next":
        use_draft_tail = False

    plan = AskPlan(
        intent=intent,
        pipeline=pipeline,
        answer_model=answer_model,
        question_kind=kind,
        role_terms=role_terms[:6],
        character_names=character_names[:6],
        section=section,
        use_draft_tail=use_draft_tail,
        router_engine="haiku",
    )
    if question:
        plan = _apply_gold_family_guard(plan, question)
        plan = _apply_portrait_guard(plan, question)
    return plan


def _call_haiku_router(system: str, user_content: str) -> str:
    api_key = anthropic_api_key()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    payload = {
        "model": ROUTER_MODEL,
        "max_tokens": 400,
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
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    blocks = data.get("content") or []
    parts = [
        b.get("text", "")
        for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    ]
    text = "".join(parts).strip()
    if not text:
        raise RuntimeError("Router returned empty content")
    return text


def local_ask_plan(question: str) -> AskPlan | None:
    """Fast local routing — skip Haiku when the question shape is obvious."""
    from lorekeeper_character_compose import is_audit_question, is_coverage_question
    from lorekeeper_character_summary import is_who_is_question
    from lorekeeper_knowledge_pov import awareness_parts, is_awareness_question, is_knowledge_pov_question
    from lorekeeper_loose_ends import is_flagged_fix_question, is_planned_gap_question
    from lorekeeper_notes_vs_draft import is_notes_not_in_draft_question
    from lorekeeper_writing_next import is_writing_next_task_list_question
    from lorekeeper_catchup_gather import is_catchup_gather_question
    from lorekeeper_question_routes import (
        extract_what_subject,
        is_character_portrait_question,
        is_story_position_question,
    )
    from lorekeeper_relations import is_relationship_between_question
    from lorekeeper_section_scope import extract_section_hints

    q = (question or "").strip()
    if not q:
        return None

    section_hints = extract_section_hints(q)
    section_raw = section_hints.get("section") if section_hints else None

    if is_awareness_question(q):
        parts = awareness_parts(q)
        names = [parts[0]] if parts else []
        return AskPlan(
            intent="narrow_fact",
            pipeline="rag_summarize",
            answer_model="haiku",
            question_kind="knowledge",
            character_names=names[:6],
            section=section_raw,
            router_engine="local",
        )

    if is_knowledge_pov_question(q):
        return AskPlan(
            intent="narrow_fact",
            pipeline="rag_summarize",
            answer_model="haiku",
            question_kind="knowledge",
            section=section_raw,
            router_engine="local",
        )

    if is_relationship_between_question(q):
        from lorekeeper_relations import (
            is_story_arc_relationship_question,
            relationship_between_pair,
        )

        pair = relationship_between_pair(q) or ()
        names = [n for n in pair if n and n.lower() not in (
            "protagonist", "antagonist", "hero", "heroine", "villain"
        )]
        roles = [
            n.lower()
            for n in pair
            if n and n.lower() in (
                "protagonist", "antagonist", "hero", "heroine", "villain"
            )
        ]
        return AskPlan(
            intent="relationship",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="relationship",
            character_names=names[:6],
            role_terms=roles[:4],
            section=section_raw,
            router_engine="local",
        )

    # Catch-up before leave-off — "caught up … so far" must not steal to resume.
    if is_catchup_gather_question(q):
        return AskPlan(
            intent="catchup_gather",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="catchup_gather",
            section=section_raw,
            router_engine="local",
        )

    # Stretch / task-list before leave-off — "planned between leave-off and X"
    # is write-next, not a draft recap.
    if is_writing_next_task_list_question(q):
        return AskPlan(
            intent="writing_next",
            pipeline="rag_summarize",
            answer_model="haiku",
            question_kind="writing_next",
            section=section_raw,
            router_engine="local",
        )

    if is_story_position_question(q):
        return AskPlan(
            intent="story_resume",
            pipeline="rag_resume",
            answer_model="sonnet",
            question_kind="resume",
            section=section_raw,
            router_engine="local",
            use_draft_tail=True,
        )

    if is_planned_gap_question(q) or is_flagged_fix_question(q):
        kind = "planned_gaps" if is_planned_gap_question(q) else "flagged_fix"
        return AskPlan(
            intent=kind,
            pipeline="rag_summarize",
            answer_model="haiku",
            question_kind=kind,
            section=section_raw,
            router_engine="local",
        )

    if is_notes_not_in_draft_question(q):
        return AskPlan(
            intent="notes_not_in_draft",
            pipeline="rag_summarize",
            answer_model="haiku",
            question_kind="notes_not_in_draft",
            section=section_raw,
            router_engine="local",
        )

    if is_audit_question(q) or is_coverage_question(q):
        return AskPlan(
            intent="coverage" if is_coverage_question(q) else "audit",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="coverage",
            section=section_raw,
            router_engine="local",
        )

    if is_character_portrait_question(q):
        subject = extract_what_subject(q)
        names = [subject] if subject else []
        return AskPlan(
            intent="character_portrait",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="topic",
            character_names=names[:6],
            section=section_raw,
            router_engine="local",
        )

    if is_who_is_question(q):
        return AskPlan(
            intent="who_is",
            pipeline="rag_cast_card",
            answer_model="haiku",
            question_kind="who",
            section=section_raw,
            router_engine="local",
        )

    if section_hints:
        return AskPlan(
            intent="summarize_story",
            pipeline="rag_summarize",
            answer_model="sonnet",
            question_kind="topic",
            section=section_raw,
            router_engine="local",
        )

    return None


def route_ask_question(
    question: str,
    hints: dict[str, list[str]] | None = None,
) -> AskPlan:
    """Haiku classifies the question — no regex routing."""
    hints = hints or {}
    meta = ""
    if hints.get("works"):
        meta += "Works in this account: " + ", ".join(hints["works"][:12]) + "\n"
    if hints.get("character_names"):
        meta += "Names in titles/tags: " + ", ".join(hints["character_names"][:20]) + "\n"

    user = f"{meta}Writer's question:\n{question}\n\nReturn JSON only."
    try:
        raw = _call_haiku_router(_ROUTER_SYSTEM, user)
        return _normalize_plan(_parse_router_json(raw), question)
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, RuntimeError):
        return default_ask_plan(question)
    except Exception:
        return default_ask_plan(question)


def section_hints_from_plan(plan: AskPlan) -> dict[str, str]:
    if not plan.section:
        return {}
    if plan.section == "prologue":
        return {"section": "prologue", "label": "the prologue"}
    m = re.match(
        r"chapter[_\s]?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)",
        plan.section,
        re.I,
    )
    if m:
        from lorekeeper_section_scope import extract_section_hints

        return extract_section_hints(f"what happens in chapter {m.group(1)}")
    return {}
