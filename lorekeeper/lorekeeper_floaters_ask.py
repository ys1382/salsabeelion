"""LoreKeeper — floaters Ask: clarify, topic gather, non-clash threads.

Librarian only: gather the writer's floating notes. Never invent lore or
narrate "what you meant."
"""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_work_membership import (
    FLOATERS_DIGEST_CAP,
    compose_floaters_digest,
    filter_entries_floaters_only,
    is_floaters_inventory_question,
    is_floaters_question,
)

FLOATERS_CLARIFY_MIN = 8

_NO_CLASH_Q = re.compile(
    r"\b("
    r"don'?t\s+contradict|do\s+not\s+contradict|without\s+contradict|"
    r"no\s+contradict|doesn'?t\s+clash|don'?t\s+clash|non[- ]?clash|"
    r"consistent(?:\s+with\s+each\s+other)?|agree\s+with\s+each\s+other|"
    r"don'?t\s+disagree|no\s+conflicts?"
    r")\b",
    re.I,
)

_EVERYTHING_Q = re.compile(
    r"\b(everything|all\s+of\s+them|the\s+whole\s+pile|full\s+list|all\s+floaters?)\b",
    re.I,
)

_TOPIC_STRIP = re.compile(
    r"\b("
    r"random\s+ideas?|floating(?:\s+ideas?)?|floaters?|unspecified(?:\s+(?:ideas?|notes?))?|"
    r"unassigned(?:\s+(?:ideas?|notes?))?|jumbled(?:\s+(?:ideas?|notes?))?|"
    r"idk(?:\s+(?:which\s+work|notes?|ideas?))?|inbox(?:\s+(?:ideas?|notes?))?|"
    r"notes?|ideas?|give\s+me|show\s+me|list|summarize|summary|dump|rundown|"
    r"digest|overview|what\s+are|i\s+want|regarding|about|concerning|"
    r"everything|all|my|the|a|an|and|or|of|in|on|for|with|from|to|please|"
    r"clear(?:ly)?|concise(?:ly)?|manner|stuff|things|that|which|don'?t|"
    r"belong|anywhere|without|a\s+work|work\s+yet|here"
    r")\b",
    re.I,
)

_TOPIC_STOP = frozenset(
    """
    and or the a an my me i you your we our of in on for with from to
    please clear concise manner stuff things that which this those these
    want wants wanted need needs needed
    """.split()
)

_PROTAG_MALE = re.compile(
    r"(?:"
    r"\b(?:protagonist|main\s+character|hero|lead)\b.{0,48}\b(?:boy|male|man|he|him)\b|"
    r"\b(?:boy|male|man)\b.{0,48}\b(?:protagonist|main\s+character|hero|lead)\b|"
    r"\bprotagonist\s+is\s+a\s+(?:boy|male|man)\b"
    r")",
    re.I,
)
_PROTAG_FEMALE = re.compile(
    r"(?:"
    r"\b(?:protagonist|main\s+character|hero|heroine|lead)\b.{0,48}\b(?:girl|female|woman|she|her)\b|"
    r"\b(?:girl|female|woman)\b.{0,48}\b(?:protagonist|main\s+character|hero|heroine|lead)\b|"
    r"\bprotagonist\s+is\s+a\s+(?:girl|female|woman)\b"
    r")",
    re.I,
)


def wants_no_clash(question: str) -> bool:
    return bool(_NO_CLASH_Q.search(question or ""))


def wants_everything(question: str) -> bool:
    return bool(_EVERYTHING_Q.search(question or ""))


def extract_floaters_topic(question: str) -> str:
    """Leftover content words after stripping floater/inventory chatter."""
    q = question or ""
    cleaned = _TOPIC_STRIP.sub(" ", q)
    cleaned = re.sub(r"[^\w\s'-]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    tokens = [
        t
        for t in cleaned.split()
        if len(t) >= 3 and t.lower() not in _TOPIC_STOP
    ]
    if not tokens:
        return ""
    topic = " ".join(tokens)
    if wants_no_clash(topic) and len(tokens) <= 4:
        return ""
    return topic[:80]


def is_floaters_followup_context(ask_continue: dict[str, Any] | None) -> bool:
    if not isinstance(ask_continue, dict):
        return False
    return (
        str(ask_continue.get("scope") or "").strip().lower() == "floaters"
        and str(ask_continue.get("stage") or "").strip().lower() == "awaiting_narrow"
    )


def compose_floaters_clarify(count: int) -> tuple[str, dict[str, str]]:
    n = max(0, int(count))
    answer = (
        f"You have {n} floating / unspecified note"
        + ("s" if n != 1 else "")
        + ". What should Ask gather?\n\n"
        "• A topic (e.g. princesses, cactus with eyes)\n"
        "• Everything\n"
        "• Only notes that don’t clash — when scraps disagree, "
        "they’ll show as separate piles, not one mixed list\n\n"
        "Type your choice in Ask next (same box).\n\n"
        "— From your notes only. Nothing invented."
    )
    cont = {"scope": "floaters", "stage": "awaiting_narrow"}
    return answer, cont


def _entry_blob(entry: dict[str, Any]) -> str:
    return f"{entry.get('title') or ''}\n{entry.get('body') or ''}"


def _token_matches_blob(tok: str, blob: str) -> bool:
    t = (tok or "").lower()
    if len(t) < 2:
        return False
    if t in blob:
        return True
    if t.endswith("ies") and len(t) > 4 and (t[:-3] + "y") in blob:
        return True
    if t.endswith("es") and len(t) > 3 and t[:-2] in blob:
        return True
    if t.endswith("s") and len(t) > 3 and t[:-1] in blob:
        return True
    return False


def filter_floaters_by_topic(
    floaters: list[dict[str, Any]], topic: str
) -> list[dict[str, Any]]:
    raw = (topic or "").strip().lower()
    if not raw:
        return []
    tokens = [t for t in re.split(r"\s+", raw) if len(t) >= 2]
    if not tokens:
        return []
    phrase = " ".join(tokens)
    hits: list[dict[str, Any]] = []
    for entry in floaters:
        blob = _entry_blob(entry).lower()
        if phrase and phrase in blob:
            hits.append(entry)
            continue
        if all(_token_matches_blob(tok, blob) for tok in tokens):
            hits.append(entry)
    return hits


def _protag_gender_signal(entry: dict[str, Any]) -> str | None:
    blob = _entry_blob(entry)
    male = bool(_PROTAG_MALE.search(blob))
    female = bool(_PROTAG_FEMALE.search(blob))
    if male and female:
        return "mixed"
    if male:
        return "male"
    if female:
        return "female"
    return None


def cluster_floaters_no_clash(
    floaters: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Split clear protagonist-gender clashes; leave others uncommitted."""
    buckets: dict[str, list[dict[str, Any]]] = {
        "female": [],
        "male": [],
        "mixed": [],
        "uncommitted": [],
    }
    for entry in floaters:
        signal = _protag_gender_signal(entry)
        if signal == "female":
            buckets["female"].append(entry)
        elif signal == "male":
            buckets["male"].append(entry)
        elif signal == "mixed":
            buckets["mixed"].append(entry)
        else:
            buckets["uncommitted"].append(entry)
    return buckets


def _floater_excerpt(body: str, limit: int = 160) -> str:
    text = re.sub(r"\s+", " ", (body or "").strip())
    if not text:
        return ""
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return (cut or text[: limit - 1]).rstrip(".,;:") + "…"


def _format_note_bullets(
    entries: list[dict[str, Any]], *, cap: int
) -> tuple[list[str], list[str]]:
    ordered = sorted(
        entries,
        key=lambda e: (str(e.get("title") or "").lower(), str(e.get("id") or "")),
    )
    lines: list[str] = []
    ids: list[str] = []
    for entry in ordered[: max(1, cap)]:
        title = str(entry.get("title") or "Untitled").strip() or "Untitled"
        excerpt = _floater_excerpt(str(entry.get("body") or ""))
        if excerpt:
            lines.append(f"• {title} — {excerpt}")
        else:
            lines.append(f"• {title} — (title only; no body saved yet)")
        eid = str(entry.get("id") or "")
        if eid:
            ids.append(eid)
    return lines, ids


def compose_floaters_topic_gather(
    floaters: list[dict[str, Any]], topic: str, *, cap: int = FLOATERS_DIGEST_CAP
) -> tuple[str, list[str]]:
    hits = filter_floaters_by_topic(floaters, topic)
    label = (topic or "").strip() or "that topic"
    if not hits:
        return (
            f"No floating notes matched “{label}.” "
            "Try different words, or ask for everything / notes that don’t clash.\n\n"
            "— From your notes only. Nothing invented.",
            [],
        )
    lines = [
        f"Floating notes matching “{label}” "
        f"({len(hits)} note" + ("s" if len(hits) != 1 else "") + "):\n"
    ]
    bullets, ids = _format_note_bullets(hits, cap=cap)
    lines.extend(bullets)
    if len(hits) > len(bullets):
        rest = len(hits) - len(bullets)
        lines.append(f"\n…and {rest} more matching note" + ("s" if rest != 1 else "") + ".")
    lines.append("\n— From your notes only. Nothing invented.")
    return "\n".join(lines), ids


def compose_floaters_no_clash(
    floaters: list[dict[str, Any]], *, cap: int = FLOATERS_DIGEST_CAP
) -> tuple[str, list[str]]:
    buckets = cluster_floaters_no_clash(floaters)
    female = buckets["female"]
    male = buckets["male"]
    mixed = buckets["mixed"]
    uncommitted = buckets["uncommitted"]
    source_ids: list[str] = []
    lines: list[str] = [
        "Floating notes grouped so clear clashes aren’t mixed together.\n"
        "(Right now: protagonist boy vs girl when your scraps say so.)\n"
    ]

    clash = bool(female and male)
    if clash:
        lines.append(
            "These piles disagree on the protagonist’s gender — shown separately:\n"
        )
        lines.append(f"Pile A — girl / woman protagonist ({len(female)}):\n")
        bullets, ids = _format_note_bullets(female, cap=cap)
        lines.extend(bullets)
        source_ids.extend(ids)
        lines.append(f"\nPile B — boy / man protagonist ({len(male)}):\n")
        bullets, ids = _format_note_bullets(male, cap=cap)
        lines.extend(bullets)
        source_ids.extend(ids)
    elif female:
        lines.append(f"Girl / woman protagonist scraps ({len(female)}):\n")
        bullets, ids = _format_note_bullets(female, cap=cap)
        lines.extend(bullets)
        source_ids.extend(ids)
    elif male:
        lines.append(f"Boy / man protagonist scraps ({len(male)}):\n")
        bullets, ids = _format_note_bullets(male, cap=cap)
        lines.extend(bullets)
        source_ids.extend(ids)
    else:
        lines.append(
            "No clear boy-vs-girl protagonist clash in your floaters yet.\n"
        )

    if mixed:
        lines.append(
            f"\nNotes that mention both signals ({len(mixed)}) — kept apart:\n"
        )
        bullets, ids = _format_note_bullets(mixed, cap=min(cap, 10))
        lines.extend(bullets)
        source_ids.extend(ids)

    if uncommitted:
        lines.append(
            f"\nNo gender clash signal ({len(uncommitted)}) — safe to read with either pile:\n"
        )
        bullets, ids = _format_note_bullets(uncommitted, cap=cap)
        lines.extend(bullets)
        source_ids.extend(ids)

    if not female and not male and not mixed and not uncommitted:
        return (
            "You don’t have any floating notes yet.\n\n"
            "— From your notes only. Nothing invented.",
            [],
        )

    lines.append("\n— From your notes only. Nothing invented.")
    # Dedupe ids preserving order
    seen: set[str] = set()
    ordered_ids: list[str] = []
    for eid in source_ids:
        if eid and eid not in seen:
            seen.add(eid)
            ordered_ids.append(eid)
    return "\n".join(lines), ordered_ids


def answer_floaters_ask(
    question: str,
    entries: list[dict[str, Any]],
    *,
    ask_continue: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """
    Handle floaters Ask (including follow-up after clarify).

    Returns a recall-shaped partial dict, or None if this isn't a floaters turn
    that should short-circuit (caller may still filter to floaters for normal recall).
    """
    q = (question or "").strip()
    followup = is_floaters_followup_context(ask_continue)
    floater_q = is_floaters_question(q)

    if not floater_q and not followup:
        return None

    floaters = filter_entries_floaters_only(entries)
    topic = extract_floaters_topic(q)
    no_clash = wants_no_clash(q)

    # Follow-up after clarify: treat the reply as the narrow choice.
    if followup:
        if no_clash:
            answer, ids = compose_floaters_no_clash(floaters)
            return _pack(answer, ids, continue_clear=True)
        if wants_everything(q) and not topic:
            answer, ids = compose_floaters_digest(floaters)
            return _pack(answer, ids, continue_clear=True)
        if topic:
            answer, ids = compose_floaters_topic_gather(floaters, topic)
            return _pack(answer, ids, continue_clear=True)
        if floater_q and is_floaters_inventory_question(q) and not topic:
            # They asked floaters again — re-clarify or dump if small
            if len(floaters) >= FLOATERS_CLARIFY_MIN:
                answer, cont = compose_floaters_clarify(len(floaters))
                return _pack(answer, [], ask_continue=cont, material="fragments_only")
            answer, ids = compose_floaters_digest(floaters)
            return _pack(answer, ids, continue_clear=True)
        answer, cont = compose_floaters_clarify(len(floaters))
        return _pack(answer, [], ask_continue=cont, material="fragments_only")

    # Direct: no-clash
    if floater_q and no_clash:
        answer, ids = compose_floaters_no_clash(floaters)
        return _pack(answer, ids, continue_clear=True)

    # Direct: topic + gather intent
    if floater_q and topic and is_floaters_inventory_question(q):
        answer, ids = compose_floaters_topic_gather(floaters, topic)
        return _pack(answer, ids, continue_clear=True)

    # Vague inventory — clarify when pile is large
    if floater_q and is_floaters_inventory_question(q) and not topic:
        if len(floaters) >= FLOATERS_CLARIFY_MIN:
            answer, cont = compose_floaters_clarify(len(floaters))
            return _pack(answer, [], ask_continue=cont, material="fragments_only")
        answer, ids = compose_floaters_digest(floaters)
        return _pack(answer, ids, continue_clear=True)

    # Floaters + topic without list words → let normal recall run on floater corpus
    return None


def _pack(
    answer: str,
    source_ids: list[str],
    *,
    ask_continue: dict[str, str] | None = None,
    continue_clear: bool = False,
    material: str = "summarizable",
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "ok": True,
        "answer": answer,
        "sourceIds": source_ids,
        "materialState": material if source_ids or ask_continue else "nothing_saved",
        "questionKind": "list",
        "recallScope": "floaters",
        "recallEngine": "local",
    }
    if ask_continue:
        out["askContinue"] = ask_continue
        out["materialState"] = material
    if continue_clear:
        out["askContinue"] = None
    if not source_ids and not ask_continue:
        out["materialState"] = "nothing_saved"
    return out
