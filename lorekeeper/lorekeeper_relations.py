"""LoreKeeper — restate relationships explicitly written in notes (no AI, no invention)."""
from __future__ import annotations

import re
from typing import Any

SPOUSE_WORDS = frozenset({"husband", "wife", "spouse"})
PARENT_WORDS = frozenset({"mother", "father", "parent"})
CHILD_WORDS = frozenset({"son", "daughter", "child"})
SIBLING_WORDS = frozenset({"brother", "sister"})
COUSIN_WORDS = frozenset({"cousin"})

CHILD_LABEL = {"son": "son", "daughter": "daughter", "child": "child"}

# Character-style names (primary for messy drafts). Proper names optional below.
CHAR = r"(?i:character\s+[a-z0-9]+)"
PROPER = r"[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?"
NAME = rf"(?:{CHAR}|{PROPER})"
REL = r"(?i:(husband|wife|spouse|mother|father|parent|son|daughter|child|brother|sister|cousin))"

NAME_STOP = frozenset(
    """
    but and their the was also such room who when where while with from for not yet
    """.split()
)


def _clean_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip(" \t.,;:!?\"'"))
    if not name:
        return ""
    if any(part in NAME_STOP for part in _name_key(name).split()):
        return ""
    m = re.fullmatch(r"character\s+([a-z0-9]+)", name, re.I)
    if m:
        return f"Character {m.group(1).upper()}"
    return name


def _name_key(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def _split_sentences(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p.strip()]


def _couple_key(a: str, b: str) -> tuple[str, str]:
    ak, bk = _name_key(a), _name_key(b)
    return (ak, bk) if ak <= bk else (bk, ak)


def _add_spouse_fact(
    facts: list[dict[str, Any]],
    owner: str,
    other: str,
    rel_word: str,
    source: str,
    entry_title: str,
) -> None:
    owner = _clean_name(owner)
    other = _clean_name(other)
    if not owner or not other or _name_key(owner) == _name_key(other):
        return
    rel = rel_word.lower()
    if rel in SPOUSE_WORDS:
        facts.append(
            {
                "kind": "spouse",
                "a": owner,
                "b": other,
                "b_role": rel,
                "source": source,
                "entryTitle": entry_title,
            }
        )
    elif rel in CHILD_WORDS:
        facts.append(
            {
                "kind": "parent",
                "parent": owner,
                "child": other,
                "label": CHILD_LABEL.get(rel, "child"),
                "source": source,
                "entryTitle": entry_title,
            }
        )
    elif rel in PARENT_WORDS:
        facts.append(
            {
                "kind": "parent",
                "parent": other,
                "child": owner,
                "label": "child",
                "source": source,
                "entryTitle": entry_title,
            }
        )
    elif rel in SIBLING_WORDS:
        facts.append(
            {
                "kind": "sibling",
                "a": owner,
                "b": other,
                "label": rel,
                "source": source,
                "entryTitle": entry_title,
            }
        )
    elif rel in COUSIN_WORDS:
        facts.append(
            {
                "kind": "cousin",
                "a": owner,
                "b": other,
                "source": source,
                "entryTitle": entry_title,
            }
        )


def _extract_from_sentence(sentence: str, entry_title: str) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    couples: list[tuple[str, str]] = []

    was_pat = re.compile(rf"({NAME})\s+was\s+({NAME})'s\s+{REL}\b")
    for m in was_pat.finditer(sentence):
        subj, owner, rel = m.group(1), m.group(2), m.group(3)
        _add_spouse_fact(facts, owner, subj, rel, sentence, entry_title)
        if rel.lower() in SPOUSE_WORDS:
            a, b = _clean_name(owner), _clean_name(subj)
            if a and b:
                couples.append((a, b))

    poss_pat = re.compile(rf"({NAME})'s\s+{REL}\s+({NAME})\b")
    for m in poss_pat.finditer(sentence):
        owner, rel, other = m.group(1), m.group(2), m.group(3)
        _add_spouse_fact(facts, owner, other, rel, sentence, entry_title)
        if rel.lower() in SPOUSE_WORDS:
            a, b = _clean_name(owner), _clean_name(other)
            if a and b:
                couples.append((a, b))

    married_pat = re.compile(rf"({NAME})\s+is\s+married\s+to\s+({NAME})\b", re.I)
    for m in married_pat.finditer(sentence):
        a, b = _clean_name(m.group(1)), _clean_name(m.group(2))
        if a and b:
            facts.append(
                {
                    "kind": "spouse",
                    "a": a,
                    "b": b,
                    "b_role": "spouse",
                    "source": sentence,
                    "entryTitle": entry_title,
                }
            )
            couples.append((a, b))

    and_child = re.compile(rf"({NAME})\s+and\s+({NAME})'s\s+(?i:(daughter|son|child))\s+({NAME})\b")
    for m in and_child.finditer(sentence):
        p1, p2, rel, child = m.group(1), m.group(2), m.group(3), m.group(4)
        child_name = _clean_name(child)
        for parent in (_clean_name(p1), _clean_name(p2)):
            if parent and child_name:
                facts.append(
                    {
                        "kind": "parent",
                        "parent": parent,
                        "child": child_name,
                        "label": CHILD_LABEL.get(rel.lower(), "child"),
                        "source": sentence,
                        "entryTitle": entry_title,
                    }
                )
        couples.append((_clean_name(p1), _clean_name(p2)))

    their_child = re.compile(rf"\b(?i:their)\s+(?i:(daughter|son|child))\s+({NAME})\b")
    for m in their_child.finditer(sentence):
        rel, child = m.group(1), _clean_name(m.group(2))
        if not child:
            continue
        parents: set[str] = set()
        for a, b in couples:
            if a:
                parents.add(a)
            if b:
                parents.add(b)
        if not parents:
            continue
        for parent in sorted(parents, key=_name_key):
            facts.append(
                {
                    "kind": "parent",
                    "parent": parent,
                    "child": child,
                    "label": CHILD_LABEL.get(rel.lower(), "child"),
                    "source": sentence,
                    "entryTitle": entry_title,
                }
            )

    return facts


def extract_relationships(text: str, entry_title: str = "") -> list[dict[str, Any]]:
    all_facts: list[dict[str, Any]] = []
    last_subject = _clean_name(entry_title) if entry_title else ""
    for sentence in _split_sentences(text):
        subj_match = re.search(rf"^({NAME})\s+is\b", sentence, re.I)
        if subj_match:
            last_subject = _clean_name(subj_match.group(1)) or last_subject
        implicit = re.match(rf"^(?i:(brother|sister))\s+to\s+({NAME})\b", sentence.strip())
        if implicit and last_subject:
            other = _clean_name(implicit.group(2))
            rel = implicit.group(1).lower()
            if other and _name_key(last_subject) != _name_key(other):
                all_facts.append(
                    {
                        "kind": "sibling",
                        "a": last_subject,
                        "b": other,
                        "label": rel,
                        "source": sentence,
                        "entryTitle": entry_title,
                    }
                )
        all_facts.extend(_extract_from_sentence(sentence, entry_title))
    return _dedupe_facts(all_facts)


def _dedupe_facts(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for fact in facts:
        if fact["kind"] == "spouse":
            key = "spouse|" + "|".join(_couple_key(fact["a"], fact["b"]))
        elif fact["kind"] == "parent":
            key = f"parent|{_name_key(fact['parent'])}|{_name_key(fact['child'])}|{fact.get('label','')}"
        elif fact["kind"] == "sibling":
            key = "sibling|" + "|".join(_couple_key(fact["a"], fact["b"]))
        elif fact["kind"] == "cousin":
            key = "cousin|" + "|".join(_couple_key(fact["a"], fact["b"]))
        else:
            key = str(fact)
        if key in seen:
            continue
        seen.add(key)
        out.append(fact)
    return out


def _question_name_keys(question: str) -> set[str]:
    keys: set[str] = set()
    for m in re.finditer(r"character\s+([a-z0-9]+)", question, re.I):
        keys.add(f"character {m.group(1).lower()}")
    for token in re.findall(r"[a-z0-9']+", question.lower()):
        if len(token) > 2:
            keys.add(token)
    return keys


def _fact_matches_question(fact: dict[str, Any], q_keys: set[str]) -> bool:
    if not q_keys:
        return True
    names: list[str] = []
    if fact["kind"] == "spouse":
        names = [fact["a"], fact["b"]]
    elif fact["kind"] == "parent":
        names = [fact["parent"], fact["child"]]
    elif fact["kind"] == "sibling":
        names = [fact["a"], fact["b"]]
    elif fact["kind"] == "cousin":
        names = [fact["a"], fact["b"]]
    for name in names:
        nk = _name_key(name)
        for q in q_keys:
            if q in nk or nk in q:
                return True
        for part in nk.split():
            if part in q_keys:
                return True
    return False


def _spouse_line(fact: dict[str, Any]) -> str:
    a, b = fact["a"], fact["b"]
    role = (fact.get("b_role") or "spouse").lower()
    if role == "husband":
        return f"{a} is married to {b}. {b} is {a}'s husband ({a} is {b}'s wife)."
    if role == "wife":
        return f"{a} is married to {b}. {b} is {a}'s wife ({a} is {b}'s husband)."
    return f"{a} is married to {b}."


def _parent_line(fact: dict[str, Any]) -> str:
    label = fact.get("label") or "child"
    if label == "daughter":
        return f"{fact['child']} is {fact['parent']}'s daughter."
    if label == "son":
        return f"{fact['child']} is {fact['parent']}'s son."
    return f"{fact['child']} is {fact['parent']}'s child."


def _group_parents(facts: list[dict[str, Any]]) -> list[str]:
    by_child: dict[str, dict[str, Any]] = {}
    for fact in facts:
        if fact["kind"] != "parent":
            continue
        ck = _name_key(fact["child"])
        slot = by_child.setdefault(
            ck,
            {"child": fact["child"], "parents": set(), "label": fact.get("label") or "child"},
        )
        slot["parents"].add(fact["parent"])
        if fact.get("label") in ("daughter", "son"):
            slot["label"] = fact["label"]

    lines: list[str] = []
    for slot in by_child.values():
        parents = sorted(slot["parents"], key=_name_key)
        child = slot["child"]
        label = slot["label"]
        if len(parents) >= 2:
            joined = " and ".join(parents[:2])
            if label == "daughter":
                lines.append(f"{child} is the daughter of {joined}.")
            elif label == "son":
                lines.append(f"{child} is the son of {joined}.")
            else:
                lines.append(f"{child} is the child of {joined}.")
        elif len(parents) == 1:
            lines.append(_parent_line({"parent": parents[0], "child": child, "label": label}))
    return lines


def _fact_matches_character(fact: dict[str, Any], label: str) -> bool:
    keys: set[str] = set()
    for part in _name_key(label).split():
        if len(part) > 2:
            keys.add(part)
    keys.add(_name_key(label))
    return _fact_matches_question(fact, keys)


def plain_relationship_lines_for(
    label: str, entries: list[dict[str, Any]]
) -> list[str]:
    """Plain-English relationship lines for one character (no bullets, no header)."""
    all_facts: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        body = str(entry.get("body") or "")
        if not body.strip():
            continue
        title = str(entry.get("title") or "Untitled")
        for fact in extract_relationships(body, title):
            if _fact_matches_character(fact, label):
                all_facts.append(fact)
    all_facts = _dedupe_facts(all_facts)
    if not all_facts:
        return []

    lines: list[str] = []
    emitted_spouse: set[tuple[str, str]] = set()
    parent_facts: list[dict[str, Any]] = []

    for fact in all_facts:
        if fact["kind"] == "spouse":
            ck = _couple_key(fact["a"], fact["b"])
            if ck in emitted_spouse:
                continue
            emitted_spouse.add(ck)
            lines.append(_spouse_line(fact))
        elif fact["kind"] == "parent":
            parent_facts.append(fact)
        elif fact["kind"] == "sibling":
            lines.append(f"{fact['a']} is {fact['b']}'s {fact.get('label', 'sibling')}.")
        elif fact["kind"] == "cousin":
            lines.append(f"{fact['a']} is {fact['b']}'s cousin.")

    lines.extend(_group_parents(parent_facts))
    return lines[:8]


def restate_relationships(
    question: str,
    entries: list[dict[str, Any]],
    ranked_ids: set[str] | None = None,
) -> str | None:
    q_keys = _question_name_keys(question)
    all_facts: list[dict[str, Any]] = []

    pool = entries
    if ranked_ids:
        pool = [e for e in entries if str(e.get("id") or "") in ranked_ids]
        if not pool:
            pool = entries

    for entry in pool:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "Untitled")
        body = str(entry.get("body") or "")
        if not body.strip():
            continue
        facts = extract_relationships(body, title)
        for fact in facts:
            if _fact_matches_question(fact, q_keys):
                all_facts.append(fact)

    all_facts = _dedupe_facts(all_facts)
    if not all_facts:
        return None

    spouse_lines: list[str] = []
    sibling_lines: list[str] = []
    cousin_lines: list[str] = []
    parent_facts: list[dict[str, Any]] = []
    emitted_spouse: set[tuple[str, str]] = set()

    for fact in all_facts:
        if fact["kind"] == "spouse":
            ck = _couple_key(fact["a"], fact["b"])
            if ck in emitted_spouse:
                continue
            emitted_spouse.add(ck)
            spouse_lines.append(_spouse_line(fact))
        elif fact["kind"] == "parent":
            parent_facts.append(fact)
        elif fact["kind"] == "sibling":
            sibling_lines.append(f"{fact['a']} is {fact['b']}'s {fact.get('label', 'sibling')}.")
        elif fact["kind"] == "cousin":
            cousin_lines.append(f"{fact['a']} is {fact['b']}'s cousin.")

    parent_lines = _group_parents(parent_facts)
    lines = ["From your notes, stated plainly:\n"]
    for group in (spouse_lines, parent_lines, sibling_lines, cousin_lines):
        for line in group:
            lines.append(f"• {line}")

    lines.append("\n— Restated from what you wrote. Nothing added.")
    return "\n".join(lines)


_REL_BETWEEN_RE = re.compile(
    r"(?i)\b(?:"
    r"how are (.+?) and (.+?) related|"
    r"relationship\s+(?:that\s+\w+\s+|developing\s+)?between\s+(.+?)\s+and\s+(.+?)|"
    r"what is the relationship\s+(?:that\s+\w+\s+)?between\s+(.+?)\s+and\s+(.+?)|"
    r"how (?:is|are) (.+?) related to (.+?)"
    r")(?=\s*(?:$|\?|,|pre\b|post\b|before\b|after\b|during\b|in\s+[A-Z]|for\s+[A-Z]))"
)

_PAIR_TRAILING_JUNK = re.compile(
    r"(?i)\s+(?:"
    r"pre(?:\s+and\s+post)?(?:\s+beginning)?(?:\s+of)?(?:\s+the)?(?:\s+war)?|"
    r"post(?:\s+beginning)?(?:\s+of)?(?:\s+the)?(?:\s+war)?|"
    r"before(?:\s+the)?(?:\s+war)?|"
    r"after(?:\s+the)?(?:\s+war)?|"
    r"during(?:\s+the)?(?:\s+war)?|"
    r"in\s+.+"
    r")\s*$"
)


def is_relationship_between_question(question: str) -> bool:
    if relationship_between_pair(question) is not None:
        return True
    q = (question or "").strip()
    return bool(
        re.search(
            r"(?i)\b(?:how are .+ and .+ related|"
            r"relationship\s+(?:that\s+\w+\s+|developing\s+)?between|"
            r"related to)\b",
            q,
        )
    )


def _clean_pair_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip(" \t.,;:!?\"'"))
    name = _PAIR_TRAILING_JUNK.sub("", name).strip()
    name = re.sub(r"^(?:in|for|from|about)\s+.+?(?:,\s*|\s+who\s+)", "", name, flags=re.I)
    m = re.fullmatch(r"character\s+([a-z0-9]+)", name, re.I)
    if m:
        return f"Character {m.group(1).upper()}"
    # Role labels asked as one side of a relationship.
    role = re.fullmatch(
        r"(?:the\s+)?(protagonist|antagonist|hero|heroine|villain)\b",
        name,
        re.I,
    )
    if role:
        return role.group(1).lower()
    cleaned = _clean_name(name)
    if cleaned:
        # Preserve asked casing for multi-word; title-case lone lowercase names.
        if " " not in cleaned and cleaned == cleaned.lower():
            return cleaned[:1].upper() + cleaned[1:]
        return cleaned
    # Lowercase proper names typed without capitals (e.g. galloxidor).
    if name and re.fullmatch(r"[A-Za-z][A-Za-z'-]{2,}", name):
        return name[:1].upper() + name[1:]
    return name


def relationship_between_pair(question: str) -> tuple[str, str] | None:
    q = (question or "").strip()
    m = _REL_BETWEEN_RE.search(q)
    if m:
        groups = [g for g in m.groups() if g]
        if len(groups) >= 2:
            a = _clean_pair_name(groups[0])
            b = _clean_pair_name(groups[1])
            if a and b and _name_key(a) != _name_key(b):
                return a, b
    m2 = re.search(
        r"(?i)how are (.+?) and (.+?) related",
        q,
    )
    if m2:
        a = _clean_pair_name(m2.group(1))
        b = _clean_pair_name(m2.group(2))
        if a and b and _name_key(a) != _name_key(b):
            return a, b
    m3 = re.search(r"(?i)how (?:is|are) (.+?) related to (.+?)(?:\?|$|,|\s+in\s+)", q)
    if m3:
        a = _clean_pair_name(m3.group(1))
        b = _clean_pair_name(m3.group(2))
        if a and b and _name_key(a) != _name_key(b):
            return a, b
    m4 = re.search(
        r"(?i)relationship\s+(?:that\s+\w+\s+|developing\s+)?between\s+(.+?)\s+and\s+(.+?)"
        r"(?=\s*(?:$|\?|,|pre\b|post\b|before\b|after\b|during\b|in\s+))",
        q,
    )
    if m4:
        a = _clean_pair_name(m4.group(1))
        b = _clean_pair_name(m4.group(2))
        if a and b and _name_key(a) != _name_key(b):
            return a, b
    return None


def _fact_links_pair(fact: dict[str, Any], a: str, b: str) -> bool:
    ak, bk = _name_key(a), _name_key(b)
    if fact["kind"] in ("spouse", "sibling", "cousin"):
        fa, fb = _name_key(fact["a"]), _name_key(fact["b"])
        return {fa, fb} == {ak, bk}
    if fact["kind"] == "parent":
        parents = {_name_key(fact["parent"])}
        children = {_name_key(fact["child"])}
        return (ak in parents and bk in children) or (bk in parents and ak in children)
    return False


def _line_for_pair_fact(fact: dict[str, Any], a: str, b: str) -> str:
    if fact["kind"] == "sibling":
        return f"{fact['a']} is {fact['b']}'s {fact.get('label', 'sibling')}."
    if fact["kind"] == "cousin":
        return f"{fact['a']} is {fact['b']}'s cousin."
    if fact["kind"] == "spouse":
        return _spouse_line(fact)
    if fact["kind"] == "parent":
        return _parent_line(fact)
    return ""


def answer_relationship_between(
    question: str, entries: list[dict[str, Any]]
) -> tuple[str, list[str]] | None:
    """Focused answer for how A and B are related — both names must appear in saved facts."""
    pair = relationship_between_pair(question)
    if not pair:
        return None
    a, b = pair
    matched: list[dict[str, Any]] = []
    source_ids: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        body = str(entry.get("body") or "")
        if not body.strip():
            continue
        eid = str(entry.get("id") or "")
        title = str(entry.get("title") or "Untitled")
        for fact in extract_relationships(body, title):
            if _fact_links_pair(fact, a, b):
                matched.append(fact)
                if eid and eid not in source_ids:
                    source_ids.append(eid)
    matched = _dedupe_facts(matched)
    if not matched:
        return (
            f"Your saved notes mention {a} and {b}, but nothing states how they are related yet.",
            source_ids,
        )
    lines = [_line_for_pair_fact(fact, a, b) for fact in matched]
    lines = [ln for ln in lines if ln]
    if not lines:
        return None
    answer = lines[0]
    if len(lines) > 1:
        answer = lines[0] + "\n\nAlso stated: " + lines[1]
    answer += "\n\n— Restated from what you wrote. Nothing added."
    return answer, source_ids
