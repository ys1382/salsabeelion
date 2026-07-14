"""LoreKeeper — knowledge-from-POV questions (what does A know about …)."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_character_summary import (
    _dedupe_lines,
    _entries_for_work,
    _name_in_text,
    _record_source_id,
    _split_sentences,
    _display_name,
    _strip_work_scope,
)
from lorekeeper_character_compose import work_title_from_hints
from lorekeeper_reliability import extract_work_hints

_KNOWLEDGE_POV_RE = re.compile(
    r"what\s+does\s+(.+?)\s+know\s+about\s+(.+?)(?:\?|$)",
    re.I,
)

_AWARENESS_RE = re.compile(
    r"\bhow\s+(?:aware|conscious|knowledgeable|informed)\s+(?:is|are)\s+(.+?)\s+of\s+(.+?)(?:\s+right\s+now)?\s*\??\s*$",
    re.I,
)


def _strip_trailing_work_scope(question: str) -> str:
    """Drop trailing 'in Smoke and Mirrors' so awareness patterns still match."""
    q = (question or "").strip()
    q = re.sub(r"\s+in\s+[^?]+\??\s*$", "", q, flags=re.I).strip()
    return q

_KNOWLEDGE_HINT_RE = re.compile(
    r"\b(knows|knew|learned|heard|discovered|realizes|realised|aware|"
    r"finds out|found out|suspects|believes|thinks|understands|"
    r"realizes|realises|grasps|recognizes|recognises)\b",
    re.I,
)

_AWARENESS_LEVEL_RE = re.compile(
    r"\b(barely|partly|fully|not yet|little|no idea|suspects?|believes?|knows?|"
    r"aware|unaware|understands?|incomplete|identified|political hunt|unspoken rules)\b",
    re.I,
)

_AWARENESS_SCENE_NOISE_RE = re.compile(
    r"\b(blood|fangs|glittered|kick|jaw|meadow|agitated|open in shock)\b",
    re.I,
)

_AWARENESS_AUTHOR_RE = re.compile(
    r"\b(I wrote|I've|I have|Initially,\s*I|I say that|I decided|doesn't make sense)\b",
    re.I,
)

_AWARENESS_FUTURE_PLAN_RE = re.compile(
    r"\b("
    r"will\s+|going\s+to\s+|plans?\s+to\s+|planned\s+to\s+|intends?\s+to\s+|"
    r"about\s+to\s+|deliberately\s+planning|rather\s+than\s+warn|"
    r"believing\s+this\s+will|in\s+order\s+to\s+|so\s+that\s+he\s+|"
    r"draws?\s+.{0,40}\s+attention\s+to\s+himself"
    r")\b",
    re.I,
)

_AWARENESS_PRESENT_STATE_RE = re.compile(
    r"\b("
    r"right\s+now|currently|so\s+far|at\s+this\s+point|not\s+yet|"
    r"hasn't|has\s+not|doesn't\s+know|does\s+not\s+know|"
    r"remains\s+incomplete|barely|partly|only\s+partly|"
    r"suspects?|believes?|is\s+aware|are\s+aware|knows?\s+that|knows?\s+the"
    r")\b",
    re.I,
)


def is_awareness_question(question: str) -> bool:
    return bool(_AWARENESS_RE.search(_strip_trailing_work_scope(question)))


def awareness_parts(question: str) -> tuple[str, str] | None:
    m = _AWARENESS_RE.search(_strip_trailing_work_scope(question))
    if not m:
        return None
    subject = _display_name(_strip_work_scope(m.group(1).strip().rstrip("?.!")))
    topic = m.group(2).strip().rstrip("?.!")
    if not subject or not topic:
        return None
    return subject, topic


def is_knowledge_pov_question(question: str) -> bool:
    if is_awareness_question(question):
        return True
    return bool(_KNOWLEDGE_POV_RE.search(question or ""))


def knowledge_pov_parts(question: str) -> tuple[str, str] | None:
    m = _KNOWLEDGE_POV_RE.search(question or "")
    if not m:
        return None
    knower = _display_name(_strip_work_scope(m.group(1).strip().rstrip("?.!")))
    topic = m.group(2).strip().rstrip("?.!")
    if not knower or not topic:
        return None
    return knower, topic


def names_in_knowledge_topic(topic: str) -> list[str]:
    """Extract cast names from a topic phrase — not the whole phrase as one label."""
    names: list[str] = []
    seen: set[str] = set()

    def add(raw: str) -> None:
        name = _display_name(raw.strip())
        key = name.lower()
        if key and key not in seen:
            seen.add(key)
            names.append(name)

    for m in re.finditer(r"\b([A-Z][a-z]+)'s\b", topic):
        add(m.group(1))
    for m in re.finditer(r"character\s+([a-z0-9]+)", topic, re.I):
        add(f"Character {m.group(1).upper()}")
    for m in re.finditer(r"\b([A-Z][a-z]+)\b", topic):
        word = m.group(1)
        if word.lower() in {"interest", "the", "and", "about", "what", "does", "know"}:
            continue
        add(word)
    return names


def _question_asks_right_now(question: str) -> bool:
    return bool(re.search(r"\bright\s+now\b", question or "", re.I))


def _is_awareness_future_plan(sentence: str) -> bool:
    """Plans and later beats — not what the character knows at the current story moment."""
    s = (sentence or "").strip()
    if not s:
        return False
    if _AWARENESS_FUTURE_PLAN_RE.search(s):
        return True
    if re.search(r"\b(reflects?\s+on\s+this\s+threat|planning\s+to)\b", s, re.I):
        return True
    return False


def _topic_matches_awareness(low: str, topic: str, topic_terms: list[str]) -> bool:
    topic_low = topic.lower()
    if topic_low in low:
        return True
    if "predator" in topic_low and "prey" in topic_low:
        if "predator-prey" in low or ("predator" in low and "prey" in low):
            return True
        if "political hunt" in low or "unspoken rules" in low:
            return True
        return False
    return any(t in low for t in topic_terms)


def _score_awareness_sentence(
    sentence: str,
    subject: str,
    topic: str,
    topic_terms: list[str],
    *,
    right_now: bool = False,
) -> int:
    s = (sentence or "").strip()
    if not s or not _name_in_text(subject, s):
        return -999
    if _AWARENESS_AUTHOR_RE.search(s):
        return -999
    if _AWARENESS_SCENE_NOISE_RE.search(s) and not _AWARENESS_LEVEL_RE.search(s):
        return -999
    if re.search(r"--\s*[\"']", s) or s.count('"') >= 2:
        return -999
    if right_now and _is_awareness_future_plan(s):
        return -999
    low = s.lower()
    if not _KNOWLEDGE_HINT_RE.search(s) and not _AWARENESS_LEVEL_RE.search(s):
        return -999
    if not _topic_matches_awareness(low, topic, topic_terms):
        return -999
    score = 10
    if _AWARENESS_LEVEL_RE.search(s):
        score += 25
    if _AWARENESS_PRESENT_STATE_RE.search(s):
        score += 20
    if right_now and _is_awareness_future_plan(s):
        score -= 80
    elif _is_awareness_future_plan(s):
        score -= 35
    if "predator-prey" in low or ("predator" in low and "prey" in low):
        score += 15
    if "political hunt" in low or "unspoken rules" in low:
        score += 10
    if right_now and re.search(r"\bnot\s+yet\b", low):
        score += 12
    score -= len(s) // 80
    return score


def _trim_awareness_sentence(sentence: str, *, max_chars: int = 320) -> str:
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if len(s) <= max_chars:
        return s
    parts = re.split(r"(?<=[.!?])\s+", s)
    if parts and len(parts[0]) <= max_chars:
        return parts[0].strip()
    return s[: max_chars - 1].rsplit(" ", 1)[0].strip() + "."


def build_awareness_answer(
    question: str, entries: list[dict[str, Any]], *, fast_recall: bool = False
) -> tuple[str | None, list[str]]:
    parts = awareness_parts(question)
    if not parts:
        return None, []
    subject, topic = parts
    topic_terms = [t.lower() for t in re.findall(r"[a-z0-9']+", topic.lower()) if len(t) > 3]
    topic_terms = [t for t in topic_terms if t not in {"situation", "right", "about", "their"}]

    scope = _entries_for_work(entries, question)
    work_hints = extract_work_hints(question, entries)
    work_title = work_title_from_hints(work_hints)
    where = f" in {work_title}" if work_title else ""

    right_now = _question_asks_right_now(question)

    scan = scope
    scan_cap = 90 if fast_recall else 180
    if len(scan) > scan_cap:
        subj_low = subject.lower()
        prioritized = [
            e
            for e in scan
            if isinstance(e, dict)
            and (
                subj_low in str(e.get("title") or "").lower()
                or subj_low in str(e.get("body") or "")[:4000].lower()
            )
        ]
        scan = (prioritized or scan)[:scan_cap]

    ranked: list[tuple[int, str, str]] = []

    for entry in scan:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        body = str(entry.get("body") or "")
        for sentence in _split_sentences(body):
            score = _score_awareness_sentence(
                sentence, subject, topic, topic_terms, right_now=right_now
            )
            if score < 0:
                continue
            ranked.append((score, sentence.strip(), eid))
            if fast_recall and score >= 40:
                break
        if fast_recall and ranked and ranked[-1][0] >= 40:
            break

    if not ranked:
        return None, []

    ranked.sort(key=lambda row: row[0], reverse=True)
    best_score, best_sentence, best_eid = ranked[0]
    ids: list[str] = []
    _record_source_id(ids, best_eid)

    body = _trim_awareness_sentence(best_sentence)
    if (
        right_now
        and len(ranked) > 1
        and best_score < 35
        and ranked[1][0] >= best_score - 5
    ):
        second = _trim_awareness_sentence(ranked[1][1], max_chars=220)
        if second and second != body:
            body = f"{body} {second}".strip()
            _record_source_id(ids, ranked[1][2])

    when = " right now" if right_now else ""
    lead = (
        f"From what you've saved{where}, {subject}'s awareness of {topic}{when}: "
    )
    answer = f"{lead}{body}\n\n— From your notes only. Nothing invented."
    return answer, ids[:8]


def build_knowledge_pov_answer(
    question: str, entries: list[dict[str, Any]], *, fast_recall: bool = False
) -> tuple[str | None, list[str]]:
    awareness = build_awareness_answer(question, entries, fast_recall=fast_recall)
    if awareness[0]:
        return awareness

    parts = knowledge_pov_parts(question)
    if not parts:
        return None, []
    knower, topic = parts
    topic_names = names_in_knowledge_topic(topic)
    if not topic_names:
        topic_names = [_display_name(n) for n in re.findall(r"[A-Z][a-z]+", topic)]

    scope = _entries_for_work(entries, question)
    work_hints = extract_work_hints(question, entries)
    work_title = work_title_from_hints(work_hints)
    where = f" in {work_title}" if work_title else ""

    bits: list[str] = []
    ids: list[str] = []

    scan = scope
    if fast_recall and len(scan) > 90:
        knower_low = knower.lower()
        prioritized = [
            e
            for e in scan
            if isinstance(e, dict)
            and knower_low in str(e.get("body") or "")[:4000].lower()
        ]
        scan = (prioritized or scan)[:90]

    for entry in scan:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        body = str(entry.get("body") or "")
        title = str(entry.get("title") or "")
        blob = f"{title} {body}"
        for sentence in _split_sentences(body):
            if not _name_in_text(knower, sentence):
                continue
            if topic_names:
                if not any(
                    _name_in_text(name, sentence) or _name_in_text(name, topic)
                    for name in topic_names
                    if name.lower() != knower.lower()
                ):
                    if not _name_in_text(knower, topic) and topic.lower() not in sentence.lower():
                        continue
            elif topic.lower() not in sentence.lower():
                continue
            if _KNOWLEDGE_HINT_RE.search(sentence) or _name_in_text(knower, sentence):
                bits.append(sentence.strip())
                _record_source_id(ids, eid)
                if fast_recall and len(bits) >= 4:
                    break
        if fast_recall and len(bits) >= 4:
            break

    bits = _dedupe_lines(bits)[:6]
    if not bits:
        return None, []

    lead = f"From what you've saved{where}, {knower}'s knowledge about {topic} includes:\n\n"
    body = "\n\n".join(bits[:4])
    answer = f"{lead}{body}\n\n— From your notes only. Nothing invented."
    return answer, ids[:8]
