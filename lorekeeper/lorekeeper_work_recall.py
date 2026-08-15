"""LoreKeeper — shared work-scoped recall pipeline (#15)."""
from __future__ import annotations

import re
from typing import Any, Callable, Literal

from lorekeeper_character_compose import is_audit_question, is_coverage_question
from lorekeeper_loose_ends import (
    answer_flagged_fixes,
    answer_planned_gaps,
    is_flagged_fix_question,
    is_planned_gap_question,
)
from lorekeeper_notes_vs_draft import (
    answer_notes_not_in_draft,
    is_notes_not_in_draft_question,
)
from lorekeeper_writing_next import (
    answer_writing_next_task_list,
    is_writing_next_task_list_question,
)
from lorekeeper_catchup_gather import (
    answer_catchup_gather,
    is_catchup_gather_question,
)
from lorekeeper_knowledge_pov import build_knowledge_pov_answer, is_knowledge_pov_question
from lorekeeper_question_routes import is_story_position_question, is_what_question
from lorekeeper_story_position import build_story_position_answer
from lorekeeper_character_summary import (
    _wants_gather,
    build_gathered_answer,
    character_summary_sources,
    character_targets,
    is_who_is_question,
)
from lorekeeper_relations import (
    answer_relationship_between,
    answer_story_arc_relationship,
    is_relationship_between_question,
    is_story_arc_relationship_question,
)
from lorekeeper_shaped_recall import answer_shaped_recall, shaped_question_kind
from lorekeeper_reliability import (
    MaterialState,
    classify_material,
    entries_mentioning_targets,
    sources_from_ranked,
)

RECALL_VERSION = "15.0.0"

QuestionKind = Literal[
    "who",
    "topic",
    "coverage",
    "relationship",
    "where",
    "when",
    "list",
    "knowledge",
    "resume",
    "planned_gaps",
    "flagged_fix",
    "notes_not_in_draft",
    "writing_next",
    "catchup_gather",
    "fallback",
]
RecallMode = Literal["full", "brief"]

PIPELINE_KINDS = frozenset(
    {
        "who",
        "topic",
        "coverage",
        "relationship",
        "where",
        "when",
        "list",
        "knowledge",
        "resume",
        "planned_gaps",
        "flagged_fix",
        "notes_not_in_draft",
        "writing_next",
        "catchup_gather",
    }
)


def route_question(question: str) -> QuestionKind:
    if is_writing_next_task_list_question(question):
        return "writing_next"
    if is_planned_gap_question(question):
        return "planned_gaps"
    if is_flagged_fix_question(question):
        return "flagged_fix"
    if is_notes_not_in_draft_question(question):
        return "notes_not_in_draft"
    if is_catchup_gather_question(question):
        return "catchup_gather"
    if is_knowledge_pov_question(question):
        return "knowledge"
    if is_relationship_between_question(question):
        return "relationship"
    if is_audit_question(question) or is_coverage_question(question):
        return "coverage"
    if is_story_position_question(question):
        return "resume"
    shaped = shaped_question_kind(question)
    if shaped:
        return shaped
    if is_what_question(question):
        return "topic"
    if is_who_is_question(question):
        return "who"
    if _wants_gather(question):
        return "topic"
    return "fallback"


def _brief_answer(answer: str, kind: QuestionKind) -> str:
    text = (answer or "").strip()
    if not text:
        return text
    if kind == "who":
        chunks = re.split(r"\n\s*\n", text, maxsplit=2)
        if len(chunks) >= 2:
            title = chunks[0].strip()
            body = chunks[1].strip()
            first = re.split(r"(?<=[.!?])\s+", body, maxsplit=1)[0].strip()
            if first:
                return f"{title}\n\n{first}"
    if kind == "coverage":
        lines = text.splitlines()
        head: list[str] = []
        for line in lines:
            head.append(line)
            if line.strip().startswith("•"):
                break
            if len(head) >= 5:
                break
        return "\n".join(head).strip()
    if "•" in text:
        intro, _, rest = text.partition("\n\n")
        bullet_match = re.search(r"•\s*(.+)", rest)
        if bullet_match:
            line = bullet_match.group(1).split("\n")[0].strip()
            return f"{intro}\n\n• {line}"
    if len(text) > 320:
        trimmed = text[:319].rsplit(" ", 1)[0]
        return trimmed + "…"
    return text


def _fallback_source_ids(
    question: str, scoped: list[dict[str, Any]], source_ids: list[str]
) -> list[str]:
    if source_ids:
        return source_ids
    targets = character_targets(question)
    if targets:
        return [
            str(e.get("id") or "")
            for e in entries_mentioning_targets(scoped, targets)
            if e.get("id")
        ][:6]
    return source_ids


def _ranked_from_source_ids(
    entries: list[dict[str, Any]],
    source_ids: list[str],
    question: str,
    *,
    tokenize: Callable[[str], list[str]],
    best_excerpt: Callable[[str, list[str], int], str],
    kind_label: Callable[[str], str],
) -> list[dict[str, Any]]:
    by_id = {str(e.get("id") or ""): e for e in entries if isinstance(e, dict)}
    order = {sid: i for i, sid in enumerate(source_ids)}
    ranked: list[dict[str, Any]] = []
    seen: set[str] = set()
    q_tokens = tokenize(question)

    for sid in source_ids:
        entry = by_id.get(sid)
        if not entry and "#" in sid:
            entry = by_id.get(sid.split("#")[0])
        if not entry:
            continue
        eid = str(entry.get("id") or sid)
        if eid in seen:
            continue
        seen.add(eid)
        ranked.append(
            {
                "id": eid,
                "title": str(entry.get("title") or "Untitled"),
                "kind": str(entry.get("kind") or "note"),
                "kindLabel": kind_label(str(entry.get("kind") or "note")),
                "score": max(90, 100 - order.get(sid, 99)),
                "excerpt": best_excerpt(str(entry.get("body") or ""), q_tokens, 360),
                "body": str(entry.get("body") or "")[:8000],
            }
        )
    return ranked


def classify_pipeline_answer(
    question: str,
    answer: str,
    scoped: list[dict[str, Any]],
    source_ids: list[str],
    *,
    strict_work: bool,
    work_hints: set[str],
    tokenize: Callable[[str], list[str]],
    best_excerpt: Callable[[str, list[str], int], str],
    kind_label: Callable[[str], str],
) -> MaterialState:
    ranked = _ranked_from_source_ids(
        scoped,
        source_ids,
        question,
        tokenize=tokenize,
        best_excerpt=best_excerpt,
        kind_label=kind_label,
    )
    return classify_material(
        question,
        scoped,
        ranked,
        answer,
        strict_work=strict_work,
        work_hints=work_hints,
    )


def answer_for_work(
    question: str,
    scoped: list[dict[str, Any]],
    *,
    work_hints: set[str],
    strict_work: bool,
    mode: RecallMode = "full",
    tokenize: Callable[[str], list[str]],
    best_excerpt: Callable[[str, list[str], int], str],
    kind_label: Callable[[str], str],
    fast_recall: bool = False,
) -> dict[str, Any] | None:
    """Compose a work-scoped answer for who / topic / coverage / relationship questions."""
    kind = route_question(question)

    if kind in (
        "planned_gaps",
        "flagged_fix",
        "notes_not_in_draft",
        "writing_next",
        "catchup_gather",
    ):
        if kind == "planned_gaps":
            answer, source_ids = answer_planned_gaps(scoped, work_hints=work_hints)
        elif kind == "flagged_fix":
            answer, source_ids = answer_flagged_fixes(scoped, work_hints=work_hints)
        elif kind == "writing_next":
            answer, source_ids = answer_writing_next_task_list(
                scoped, work_hints=work_hints, question=question
            )
        elif kind == "catchup_gather":
            answer, source_ids = answer_catchup_gather(
                scoped, work_hints=work_hints, question=question
            )
        else:
            answer, source_ids = answer_notes_not_in_draft(
                scoped, work_hints=work_hints, question=question
            )
        material_state: MaterialState = (
            "summarizable" if source_ids else "nothing_saved"
        )
        # Honest empty compare (no notes / no draft) still counts as answered.
        if kind in ("notes_not_in_draft", "writing_next", "catchup_gather") and answer.strip():
            material_state = "summarizable"
        ranked = _ranked_from_source_ids(
            scoped,
            source_ids,
            question,
            tokenize=tokenize,
            best_excerpt=best_excerpt,
            kind_label=kind_label,
        )
        return {
            "answer": answer,
            "sources": sources_from_ranked(ranked, material_state),
            "materialState": material_state,
            "questionKind": kind,
            "sourceIds": source_ids,
        }

    if kind == "resume":
        answer, source_ids = build_story_position_answer(question, scoped)
        if not answer:
            return None
        source_ids = _fallback_source_ids(question, scoped, source_ids)
        material_state = classify_pipeline_answer(
            question,
            answer,
            scoped,
            source_ids,
            strict_work=strict_work,
            work_hints=work_hints,
            tokenize=tokenize,
            best_excerpt=best_excerpt,
            kind_label=kind_label,
        )
        ranked = _ranked_from_source_ids(
            scoped,
            source_ids,
            question,
            tokenize=tokenize,
            best_excerpt=best_excerpt,
            kind_label=kind_label,
        )
        return {
            "answer": answer,
            "sources": sources_from_ranked(ranked, material_state),
            "materialState": material_state,
            "questionKind": kind,
            "sourceIds": source_ids,
        }

    if kind == "knowledge":
        answer, source_ids = build_knowledge_pov_answer(
            question, scoped, fast_recall=fast_recall
        )
        if not answer:
            return None
        source_ids = _fallback_source_ids(question, scoped, source_ids)
        material_state = classify_pipeline_answer(
            question,
            answer,
            scoped,
            source_ids,
            strict_work=strict_work,
            work_hints=work_hints,
            tokenize=tokenize,
            best_excerpt=best_excerpt,
            kind_label=kind_label,
        )
        ranked = _ranked_from_source_ids(
            scoped,
            source_ids,
            question,
            tokenize=tokenize,
            best_excerpt=best_excerpt,
            kind_label=kind_label,
        )
        return {
            "answer": answer,
            "sources": sources_from_ranked(ranked, material_state),
            "materialState": material_state,
            "questionKind": kind,
            "sourceIds": source_ids,
        }

    if kind == "relationship":
        if is_story_arc_relationship_question(question):
            rel = answer_story_arc_relationship(question, scoped)
        else:
            rel = answer_relationship_between(question, scoped)
        if not rel:
            return None
        answer, source_ids = rel
        source_ids = _fallback_source_ids(question, scoped, source_ids)
        material_state = classify_pipeline_answer(
            question,
            answer or "",
            scoped,
            source_ids,
            strict_work=strict_work,
            work_hints=work_hints,
            tokenize=tokenize,
            best_excerpt=best_excerpt,
            kind_label=kind_label,
        )
        ranked = _ranked_from_source_ids(
            scoped,
            source_ids,
            question,
            tokenize=tokenize,
            best_excerpt=best_excerpt,
            kind_label=kind_label,
        )
        return {
            "answer": answer or "",
            "sources": sources_from_ranked(ranked, material_state),
            "materialState": material_state,
            "questionKind": kind,
            "sourceIds": source_ids,
        }

    if kind == "fallback":
        return None

    if kind in ("where", "when", "list"):
        shaped_answer, shaped_ids = answer_shaped_recall(
            question,
            scoped,
            kind,
            tokenize=tokenize,
            best_excerpt=best_excerpt,
        )
        if shaped_answer and shaped_ids:
            if mode == "brief" and shaped_answer:
                shaped_answer = _brief_answer(shaped_answer, "topic")
            material_state = classify_pipeline_answer(
                question,
                shaped_answer,
                scoped,
                shaped_ids,
                strict_work=strict_work,
                work_hints=work_hints,
                tokenize=tokenize,
                best_excerpt=best_excerpt,
                kind_label=kind_label,
            )
            ranked = _ranked_from_source_ids(
                scoped,
                shaped_ids,
                question,
                tokenize=tokenize,
                best_excerpt=best_excerpt,
                kind_label=kind_label,
            )
            return {
                "answer": shaped_answer,
                "sources": sources_from_ranked(ranked, material_state),
                "materialState": material_state,
                "questionKind": kind,
                "sourceIds": shaped_ids,
            }

    answer, source_ids = build_gathered_answer(
        question, scoped, fast_recall=fast_recall
    )
    source_ids = _fallback_source_ids(question, scoped, source_ids)
    if not source_ids and answer:
        source_ids = character_summary_sources(question, scoped)
        source_ids = _fallback_source_ids(question, scoped, source_ids)

    if mode == "brief" and answer:
        answer = _brief_answer(answer, kind)

    material_state = classify_pipeline_answer(
        question,
        answer or "",
        scoped,
        source_ids,
        strict_work=strict_work,
        work_hints=work_hints,
        tokenize=tokenize,
        best_excerpt=best_excerpt,
        kind_label=kind_label,
    )
    ranked = _ranked_from_source_ids(
        scoped,
        source_ids,
        question,
        tokenize=tokenize,
        best_excerpt=best_excerpt,
        kind_label=kind_label,
    )
    sources = sources_from_ranked(ranked, material_state)

    if not (answer or "").strip() and not source_ids:
        return None

    return {
        "answer": answer or "",
        "sources": sources,
        "materialState": material_state,
        "questionKind": kind,
        "sourceIds": source_ids,
    }
