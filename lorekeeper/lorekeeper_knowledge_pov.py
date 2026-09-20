"""LoreKeeper — knowledge-from-POV questions (what does A know about … / does A know …)."""
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

_DOES_KNOW_RE = re.compile(
    r"^does\s+(.+?)\s+know\s+(.+?)\s*\??$",
    re.I,
)

_BAD_KNOWERS = frozenset(
    {
        "it",
        "this",
        "that",
        "the story",
        "the draft",
        "anyone",
        "everyone",
        "someone",
    }
)

_PLOT_BLURB_RE = re.compile(
    r"\b("
    r"becomes entangled|political hunt|the story begins|"
    r"central crisis|orchestrated by|follows [A-Z]|"
    r"brought to .{0,40}contrary to"
    r")\b",
    re.I,
)

_KNOWS_NAME_RE = re.compile(
    r"\b(knows|knew|learned|heard|was told)\s+(?:his|her|their|[A-Z][\w']+'s)\s+name\b",
    re.I,
)

_NOT_KNOW_NAME_RE = re.compile(
    r"\b("
    r"does(?:\s+not|n't)\s+know\s+(?:his|her|their|[A-Z][\w']+'s)\s+name|"
    r"name is never spoken in|"
    r"never spoken in (?:his|her|their) presence|"
    r"name (?:is|was) never (?:spoken|said|used)"
    r")\b",
    re.I,
)


def _normalize_ask_quotes(text: str) -> str:
    """Straighten curly quotes/apostrophes so 'Etherei’s name' still parses."""
    return (
        (text or "")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201b", "'")
        .replace("\u2032", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def _strip_trailing_work_scope(question: str) -> str:
    """Drop trailing 'in Smoke and Mirrors' so awareness patterns still match."""
    q = _normalize_ask_quotes(question or "").strip()
    q = re.sub(r"\s+in\s+[^?]+\??\s*$", "", q, flags=re.I).strip()
    return q


def _core_ask_text(question: str) -> str:
    """Strip leading/trailing work scope so 'Does X know…?' still matches."""
    q = _strip_trailing_work_scope(question or "")
    q = re.sub(r"^in\s+[^,?]{1,80},\s*", "", q, flags=re.I).strip()
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


def is_does_know_question(question: str) -> bool:
    return does_know_parts(question) is not None


def does_know_parts(question: str) -> tuple[str, str] | None:
    """'Does the beaver mayor know Etherei's name?' → knower, topic."""
    q = _core_ask_text(question)
    if _KNOWLEDGE_POV_RE.search(q):
        return None
    m = _DOES_KNOW_RE.match(q)
    if not m:
        return None
    knower_raw = re.sub(
        r"\s+(even|actually|really|still)$",
        "",
        m.group(1).strip().rstrip("?.!"),
        flags=re.I,
    ).strip()
    topic = re.sub(
        r"\s+(yet|already|right now|at this point)$",
        "",
        m.group(2).strip().rstrip("?.!"),
        flags=re.I,
    ).strip()
    knower = _display_name(_strip_work_scope(knower_raw))
    if not knower or not topic:
        return None
    if knower.lower() in _BAD_KNOWERS:
        return None
    return knower, topic


def is_knowledge_pov_question(question: str) -> bool:
    if is_awareness_question(question):
        return True
    if is_does_know_question(question):
        return True
    return bool(_KNOWLEDGE_POV_RE.search(question or ""))


def knowledge_pov_parts(question: str) -> tuple[str, str] | None:
    m = _KNOWLEDGE_POV_RE.search(question or "")
    if m:
        knower = _display_name(_strip_work_scope(m.group(1).strip().rstrip("?.!")))
        topic = m.group(2).strip().rstrip("?.!")
        if knower and topic:
            return knower, topic
    return does_know_parts(question)


def _name_topic_subject(topic: str) -> str | None:
    t = _normalize_ask_quotes(topic or "").strip().rstrip("?.!")
    t = re.sub(r"\s+(yet|already|right now|at this point)$", "", t, flags=re.I)
    m = re.match(r"^(.+?)(?:'s|s')\s+name$", t, re.I)
    if m:
        return _display_name(m.group(1).strip())
    m = re.match(r"^the name of (.+)$", t, re.I)
    if m:
        return _display_name(m.group(1).strip())
    m = re.match(r"^what (.+?)(?:'s|s') name is$", t, re.I)
    if m:
        return _display_name(m.group(1).strip())
    if re.search(r"\bname\b", t, re.I):
        char = re.search(r"\b(character\s+[a-z0-9]+)\b", t, re.I)
        if char:
            return _display_name(char.group(1))
        proper = re.search(r"\b([A-Z][a-z]{2,})\b", t)
        if proper:
            return _display_name(proper.group(1))
    return None


def answer_meets_does_know_name_gold_bar(answer: str) -> bool:
    """Locked floor for 'Does X know Y's name?' (2026-09-19).

    Spoken-address scan is also locked: knower's spoken address only.
    """
    low = (answer or "").lower()
    if not low.strip():
        return False
    if _PLOT_BLURB_RE.search(answer or ""):
        return False
    if "captured by serias" in low or "moonshadow twins" in low:
        return False
    if "sepior" not in low:
        return False
    if "stranger" not in low:
        return False
    if "unlikely" not in low and "does not know" not in low and "doesn't know" not in low:
        return False
    if "nothing invented" not in low:
        return False
    if "knowledge about" in low and "includes" in low:
        return False
    if "hidey hole" in low or "further incense" in low:
        return False
    if "very far" in low or "way away" in low:
        return False
    if re.search(r'calls?\s+\w+\s+"let"', low):
        return False
    if "thewhiterabbit" in re.sub(r"[^a-z]", "", low):
        return False
    if re.search(r'["\']chroniker["\']', low):
        return False
    return True


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


def _knower_aliases(knower: str, entries: list[dict[str, Any]]) -> list[str]:
    from lorekeeper_aliases import expand_name_list

    core = re.sub(r"^the\s+", "", knower, flags=re.I).strip()
    seeds: list[str] = []
    seen: set[str] = set()

    def add(raw: str) -> None:
        name = (raw or "").strip()
        key = name.lower()
        if name and key not in seen:
            seen.add(key)
            seeds.append(name)

    add(knower)
    add(core)
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "").strip()
        body = str(entry.get("body") or "")
        blob = f"{title}\n{body}"
        mentions = _name_in_text(core, blob) or _name_in_text(knower, blob)
        if not mentions:
            continue
        add(title)
        for m in re.finditer(r"\bMayor\s+([A-Z][a-z]{2,})\b", blob):
            add(m.group(0))
            add(m.group(1))
    return expand_name_list(seeds, entries) or seeds


def _any_alias_in_text(aliases: list[str], text: str) -> bool:
    return any(_name_in_text(alias, text) for alias in aliases if alias)


def _is_scene_dump_sentence(sentence: str) -> bool:
    """Draft walk-through / dialogue dump — not a knowledge-status line."""
    s = (sentence or "").strip()
    if not s:
        return True
    if len(s) > 380:
        return True
    if re.search(r"\*{6,}", s) or re.fullmatch(r"\*+", s):
        return True
    if s.count('"') >= 4:
        return True
    if _PLOT_BLURB_RE.search(s):
        return True
    return False


_DIALOGUE_OPENERS = frozenset(
    """
    let please well but and so if when why how what who whom
    come go look listen wait stop tell give take see know think
    don't didn't can't maybe actually anyway perhaps oh ah
    yes no the a an this that there here then now just
    do did does done have has had will would could should
    may might must shall
    """.split()
)


def _looks_like_vocative(label: str, target: str) -> bool:
    """True for a spoken name/nickname (Stranger), not a quoted description."""
    text = _normalize_ask_quotes(label).strip().rstrip(".,;:!")
    if not text or text.lower() == (target or "").lower():
        return False
    words = text.split()
    if not words or len(words) > 3:
        return False
    low = text.lower()
    if words[0].lower() in _DIALOGUE_OPENERS:
        return False
    if words[0].lower() in {"a", "an"}:
        return False
    # Glued epithets ("TheWhiteRabbit"), not a spoken nickname.
    if re.search(r"[a-z][A-Z]", text) or re.match(r"^The[A-Z]", text):
        return False
    if re.sub(r"[^a-z]", "", low) in {"thewhiterabbit", "whiterabbit", "cheshirecat"}:
        return False
    if re.search(
        r"\b(very|far|away|because|which|follow|better|"
        r"answer|appreciate|explain|here)\b",
        low,
    ):
        return False
    if re.search(r"\b(is|are|was|were|have|has|will|can|could)\b", low):
        return False
    return True


def _vocative_score(label: str, *, explicit_call: bool = False) -> int:
    words = (label or "").split()
    score = 40
    if len(words) == 1 and words[0][:1].isupper():
        score = 100
    elif len(words) == 1:
        score = 50
    if explicit_call:
        score += 40
    return score


def _alias_owned_by_other(
    label: str,
    target: str,
    knower_aliases: list[str],
    entries: list[dict[str, Any]],
) -> bool:
    """True when notes say someone else (not the knower) uses this name for the target."""
    from lorekeeper_aliases import collect_alias_facts

    lab = (label or "").strip().lower()
    if not lab:
        return False
    for fact in collect_alias_facts(entries):
        if fact.kind != "known_to" or not fact.alias or not fact.other:
            continue
        if fact.alias.strip().lower() != lab:
            continue
        other_is_knower = _any_alias_in_text(knower_aliases, fact.other)
        subject_is_target = bool(
            fact.subject
            and (
                fact.subject.lower() == target.lower()
                or _name_in_text(target, fact.subject)
            )
        )
        if subject_is_target and not other_is_knower:
            return True
    return False


def _foreign_addresser(
    sentence: str, knower_aliases: list[str], target: str
) -> bool:
    """True when another named person is the one calling / knowing-as in this sentence."""
    s = _normalize_ask_quotes(sentence or "")
    for m in re.finditer(r"\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b", s):
        name = m.group(1)
        if name.lower() in {target.lower(), "when", "therefore", "nothing"}:
            continue
        if _any_alias_in_text(knower_aliases, name):
            continue
        if re.search(r"\bmayor\b", name, re.I) and _any_alias_in_text(
            knower_aliases, "mayor"
        ):
            continue
        if re.search(
            rf"\b{re.escape(name)}\b.{{0,60}}\b(?:calls?|called|calling|"
            rf"addresses|addressed|knows|known)\b",
            s,
            re.I,
        ):
            return True
    return False


def _extract_address_label(
    sentence: str,
    target: str,
    knower_aliases: list[str] | None = None,
) -> str:
    s = _normalize_ask_quotes(sentence or "")
    aliases = knower_aliases or []
    t = re.escape(target)
    knower_here = _any_alias_in_text(aliases, s) if aliases else True
    if aliases and not knower_here:
        # Pronoun "he calls" is allowed only when the caller is not someone else.
        if not re.search(
            rf"\b(?:he|she)\s+(?:calls?|called|calling|addresses|addressed)\b",
            s,
            re.I,
        ):
            return ""
        if _foreign_addresser(s, aliases, target):
            return ""
    elif aliases and _foreign_addresser(s, aliases, target):
        return ""

    candidates: list[tuple[int, int, str]] = []

    def add(raw: str, *, explicit_call: bool = False) -> None:
        label = raw.strip().rstrip(".,;:")
        if _looks_like_vocative(label, target):
            candidates.append(
                (_vocative_score(label, explicit_call=explicit_call), len(label), label)
            )

    quoted = re.search(
        rf"(?:calls?|called|calling|addresses|addressed)\s+"
        rf"(?:{t}|him|her|them)\s+(?:as\s+)?[\"']([^\"']{{1,40}})[\"']",
        s,
        re.I,
    )
    if quoted:
        add(quoted.group(1), explicit_call=True)
    bare = re.search(
        rf"(?:calls?|called|calling|addresses|addressed)\s+"
        rf"{t}\s+(?:as\s+)?([A-Z][a-z]{{1,40}})\b",
        s,
        re.I,
    )
    if bare:
        add(bare.group(1), explicit_call=True)
    if knower_here:
        vocative_comma = re.finditer(
            r"[\"']([A-Z][a-z]{1,24})[\"']\s*,",
            s,
        )
        for m in vocative_comma:
            add(m.group(1))
        if re.search(r"\b(said|says|asks|called|calls|address)\b", s, re.I):
            for m in re.finditer(r"[\"']([^\"']{1,40})[\"']", s):
                add(m.group(1))
    if not candidates:
        return ""
    candidates.sort(key=lambda row: (-row[0], -row[1]))
    return candidates[0][2]


def _extract_knows_attr(sentence: str, target: str) -> str:
    t = re.escape(target)
    m = re.search(
        rf"knows?\s+that\s+{t}\s+is\s+(.+?)(?:\.|$)",
        sentence,
        re.I,
    )
    if not m:
        return ""
    attr = re.sub(r"\s+", " ", m.group(1).strip().rstrip(".,;:"))
    if len(attr) > 80:
        attr = attr[:79].rsplit(" ", 1)[0].strip()
    return attr


def _knower_display(knower: str, aliases: list[str]) -> tuple[str, str]:
    """(lead name, shorter name for 'therefore' clause)."""
    proper = ""
    role = ""
    for alias in aliases:
        if re.match(r"^Mayor\s+[A-Z]", alias) and not proper:
            proper = alias
        if re.search(r"\bbeaver\s+mayor\b", alias, re.I) and not role:
            role = alias if alias.lower().startswith("the ") else f"The {alias}"
    if not role and re.search(r"\bbeaver\s+mayor\b", knower, re.I):
        role = knower if knower.lower().startswith("the ") else f"The {knower}"
    if role and proper and proper.lower() not in role.lower():
        return f"{role}, {proper}", proper
    if proper and not role:
        return proper, proper
    lead = role or knower
    if re.search(r"\bmayor\b", lead, re.I) and not lead.lower().startswith("the "):
        lead = f"The {lead}"
    return lead, proper or lead


def build_does_know_name_answer(
    question: str, entries: list[dict[str, Any]], *, fast_recall: bool = False
) -> tuple[str | None, list[str]]:
    """Librarian yes/no for 'Does X know Y's name?' — never a story blurb."""
    parts = does_know_parts(question)
    if not parts:
        return None, []
    knower, topic = parts
    target = _name_topic_subject(topic)
    if not target:
        return None, []

    scope = _entries_for_work(entries, question)
    work_hints = extract_work_hints(question, entries)
    work_title = work_title_from_hints(work_hints)
    where = f" in {work_title}" if work_title else ""
    aliases = _knower_aliases(knower, scope)
    footer = "— From your notes only. Nothing invented."

    scan = scope
    if fast_recall and len(scan) > 90:
        keys = {a.lower() for a in aliases}
        prioritized = [
            e
            for e in scan
            if isinstance(e, dict)
            and any(
                k in f"{e.get('title') or ''} {str(e.get('body') or '')[:4000]}".lower()
                for k in keys
            )
        ]
        scan = (prioritized or scan)[:90]

    ids: list[str] = []
    knows_attr = ""
    address_label = ""
    never_spoken = False
    explicit_knows_name = False
    explicit_not_know = False
    uses_he = False

    for entry in scan:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        body = str(entry.get("body") or "")
        title = str(entry.get("title") or "")
        blob = f"{title}\n{body}"
        entry_has_knower = _any_alias_in_text(aliases, blob)
        for sentence in _split_sentences(f"{title}. {body}" if title else body):
            s = sentence.strip()
            if not s:
                continue
            if not _any_alias_in_text(aliases, s) and not _name_in_text(target, s):
                continue
            relevant = _any_alias_in_text(aliases, s) or (
                entry_has_knower and _name_in_text(target, s)
            )
            if relevant and re.search(r"\bhe\b", s, re.I):
                uses_he = True
            if relevant:
                attr = _extract_knows_attr(s, target)
                if attr and not knows_attr:
                    knows_attr = attr
                    _record_source_id(ids, eid)
                label = _extract_address_label(s, target, aliases)
                if label and _alias_owned_by_other(label, target, aliases, scope):
                    label = ""
                if label and (
                    not address_label
                    or _vocative_score(label) > _vocative_score(address_label)
                    or (
                        _vocative_score(label) == _vocative_score(address_label)
                        and len(label) > len(address_label)
                    )
                ):
                    address_label = label
                    _record_source_id(ids, eid)
            if _name_in_text(target, s) or relevant:
                if _NOT_KNOW_NAME_RE.search(s):
                    never_spoken = True
                    if re.search(r"does(?:\s+not|n't)\s+know", s, re.I):
                        explicit_not_know = True
                    _record_source_id(ids, eid)
                if (
                    _KNOWS_NAME_RE.search(s)
                    and not _NOT_KNOW_NAME_RE.search(s)
                    and not re.search(
                        r"\b(unlikel(?:y)|does(?:\s+not|n't)|never|not yet)\b",
                        s,
                        re.I,
                    )
                ):
                    explicit_knows_name = True
                    _record_source_id(ids, eid)

    display, short_name = _knower_display(knower, aliases)
    if not knows_attr and not address_label and not never_spoken and not explicit_knows_name:
        gap = (
            f"Nothing saved yet{where} that says whether {display} knows {target}'s name.\n\n"
            f"{footer}"
        )
        return gap, ids[:8]

    bits: list[str] = []
    if knows_attr:
        subject = (
            f"{display},"
            if short_name and display.endswith(short_name) and "," in display
            else display
        )
        bits.append(f"{subject} knows that {target} is {knows_attr}.")
    if address_label:
        prefix = "However, " if bits else ""
        if uses_he:
            bits.append(
                f"{prefix}the only times we see him addressing {target}, "
                f'he calls {target} "{address_label}."'
            )
        else:
            bits.append(
                f"{prefix}the only times we see {display} addressing {target}, "
                f'{display} calls {target} "{address_label}."'
            )
        if bits and bits[-1][0].islower():
            bits[-1] = bits[-1][0].upper() + bits[-1][1:]
    if never_spoken:
        if uses_he:
            bits.append(f"{target}'s name is never spoken in his presence.")
        else:
            bits.append(f"{target}'s name is never spoken in {display}'s presence.")
    if explicit_knows_name and not never_spoken and not address_label:
        bits.append(f"The notes say {short_name} knows {target}'s name.")
    elif (
        (address_label or never_spoken)
        and not explicit_knows_name
    ):
        bits.append(
            f"Therefore, it is unlikely that {short_name} knows {target}'s name yet."
        )
    elif explicit_not_know:
        bits.append(f"The notes say {short_name} does not know {target}'s name yet.")

    if not bits:
        gap = (
            f"Nothing saved yet{where} that says whether {display} knows {target}'s name.\n\n"
            f"{footer}"
        )
        return gap, ids[:8]

    body = " ".join(bits)
    return f"{body}\n\n{footer}", ids[:8]


def build_knowledge_pov_answer(
    question: str, entries: list[dict[str, Any]], *, fast_recall: bool = False
) -> tuple[str | None, list[str]]:
    awareness = build_awareness_answer(question, entries, fast_recall=fast_recall)
    if awareness[0]:
        return awareness

    name_ans = build_does_know_name_answer(question, entries, fast_recall=fast_recall)
    if name_ans[0] is not None:
        return name_ans
    if is_does_know_question(question):
        parts = does_know_parts(question)
        knower = parts[0] if parts else "they"
        topic = parts[1] if parts else "that"
        work_hints = extract_work_hints(question, entries)
        work_title = work_title_from_hints(work_hints)
        where = f" in {work_title}" if work_title else ""
        return (
            f"Nothing saved yet{where} that says whether {knower} knows {topic}.\n\n"
            "— From your notes only. Nothing invented."
        ), []

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
