"""LoreKeeper — gather related bits across entries (local, no invention)."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_cast_roles import ROLE_TERMS, cast_role_line_about_label
from lorekeeper_inference import (
    audit_contradiction_lines_for,
    build_character_brief,
    brother_names_from_brief,
    collect_brother_names,
    family_chain_in_body,
)
from lorekeeper_relations import plain_relationship_lines_for
from lorekeeper_character_compose import (
    append_unclear_section,
    character_unclear_body,
    compose_audit_summary,
    compose_character_gap_reference,
    compose_character_reference,
    compose_coverage_gap,
    compose_coverage_summary,
    cast_answer_is_thin,
    is_audit_question,
    is_coverage_question,
    work_title_from_hints,
)
from lorekeeper_corpus_text import normalize_corpus_text
from lorekeeper_aliases import alias_reference_lines_for, expand_name_list
from lorekeeper_reliability import (
    entry_matches_work,
    extract_work_hints,
    filter_entries_by_work,
    work_named_in_question,
)

SUMMARY_HINT = re.compile(
    r"\b("
    r"summary|summarize|who is|tell me about|what do i (?:have|know|written)|"
    r"what about|anything about|notes on|"
    r"everything (?:i (?:have )?)?(?:written|saved)(?:\s+on|\s+about)?|"
    r"everything (?:i wrote|about|on)|character profile|remind me about|"
    r"tell me everything|all i (?:have )?(?:written|saved)|"
    r"what(?:'s| is) .+ (?:like|about)|gather|pull together|collect|show me"
    r")\b",
    re.I,
)

FOCUS_STOP = frozenset(
    """
    in on at for the a an and or but with from who what when where how about into
    summary summarize tell remind everything written have know character my your
    that this those these there here some any all just also only very much many
    regarding across info saved notes me do
    """.split()
)

# When the question names a creature / race / species topic, only keep sentences
# that actually mention that topic — not nearby cast lines sharing a work title.
_TOPIC_CONTENT_TERMS = frozenset(
    """
    bird birds species race races creature creatures beast beasts animal animals
    folk faction factions prey predator preyfolk clan clans tribe tribes
    """.split()
)

KIND_HINTS: dict[str, tuple[str, ...]] = {
    "politics": ("politic", "intrigue", "scheme", "coup", "alliance", "betray", "power"),
    "visual": ("illustr", "draw", "paint", "scene", "picture", "panel", "composition", "shot"),
    "design": ("font", "typography", "letter", "typeface", "dramatic", "caption"),
    "relationship": ("married", "spouse", "parent", "child", "family", "sibling", "love"),
    "dialogue": ("dialogue", "voice", "speech", "monologue", "line"),
    "scene": ("scene", "stage", "beat", "blocking"),
    "plot": ("plot", "arc", "twist", "structure", "act"),
    "theme": ("theme", "motif", "symbol", "meaning"),
}

_DIALOGUE_VERB = re.compile(
    r"\b(said|says|asked|asks|replied|replies|whispered|shouted|murmured|"
    r"exclaimed|muttered|called out|yelled|screamed|laughed|sighed)\b",
    re.I,
)

_BUCKET_RANK = {"role": 0, "identity": 1, "relationship": 2, "detail": 3, "dialogue": 4, "scene": 5}

_SCENE_ACTION = re.compile(
    r"\b("
    r"opening|closing|turning|looking|staring|stared|stare|walked|walking|ran|running|"
    r"takes?|took|grabbed|reached|turned|nodded|shook|hovered|hovering|proffered|"
    r"silently|silence|watched|watching|glanced|glimpsed|stepped|lunged|pulled|pushed"
    r")\b",
    re.I,
)

_AUTHOR_META_RE = re.compile(
    r"\b("
    r"i think|i thought|i feel|i want|i need|maybe|perhaps|not sure|wonder if|"
    r"could start|should start|might start|same time as the|plot note|planning note|"
    r"outline|todo|fix later|rewrite|draft note|needs to|want to|going to|"
    r"might be better|consider whether|idea for|note to self|"
    r"find more ways|ways to mention|need to mention|"
    r"i wrote|i write|i say that|i decided|i've now decided|doesn't make sense|"
    r"initially,\s*i|"
    r"next (?:POV|section)|POV will be|switches? to .{0,40}POV"
    r")\b",
    re.I,
)

_TRAIT_HINT = re.compile(
    r"\b(grey|gray|skin|tall|short|eyes|hair|arcanist|elf|spirit|guardian|"
    r"species|wears|dressed|voice|accent|scar|cloak|armor|"
    r"lynx|rabbit|wolf|fox|cat|dog|bear|eagle|hawk|owl|raven|crow|"
    r"mouse|rat|deer|stag|boar|feline|canine|eurasian|creature|beast)\b",
    re.I,
)

_SPECIES_IDENTITY = re.compile(
    r"\b(?:is|was|are|were)\s+(?:a|an)\s+(?:[\w'-]+\s+){0,4}"
    r"(?:lynx|rabbit|wolf|fox|cat|dog|bear|eagle|hawk|owl|raven|crow|"
    r"mouse|rat|deer|stag|boar|serpent|dragon|bird|feline|canine|"
    r"species|creature|animal|beast)\b",
    re.I,
)

_PROFILE_ROLE_WORDS = (
    f"{ROLE_TERMS}|"
    r"spirit|guardian|"
    r"ruler|king|queen|prince|princess|lord|lady|captain|soldier|wizard|witch"
)


def _normalize_character(raw: str) -> str:
    m = re.fullmatch(r"character\s+([a-z0-9]+)", raw.strip(), re.I)
    if m:
        return f"Character {m.group(1).upper()}"
    return raw.strip()


def _strip_work_scope(tail: str) -> str:
    tail = re.split(r"\s+in\s+", tail, maxsplit=1, flags=re.I)[0].strip()
    tail = re.split(r"\s+from\s+", tail, maxsplit=1, flags=re.I)[0].strip()
    return tail


def _display_name(raw: str) -> str:
    raw = re.sub(r"\s+", " ", (raw or "").strip())
    if not raw:
        return ""
    if re.match(r"character\s+[a-z0-9]+", raw, re.I):
        return _normalize_character(raw)
    return " ".join(part.capitalize() if part.islower() else part for part in raw.split())


def is_who_is_question(question: str) -> bool:
    return bool(re.search(r"\bwho(?:'s|\s+is)\b", question, re.I))


def _who_is_subject(question: str) -> str:
    who_is = re.search(r"who(?:'s|\s+is)\s+(.+?)(?:\?|$)", question, re.I)
    if not who_is:
        return ""
    tail = _strip_work_scope(who_is.group(1).strip().rstrip("?.!"))
    tail = re.sub(r"\s*\([^)]*\)", "", tail).strip()
    tail = re.sub(r"^the\s+", "", tail, flags=re.I).strip()
    return _display_name(tail)


def character_targets(question: str) -> list[str]:
    from lorekeeper_knowledge_pov import is_knowledge_pov_question, knowledge_pov_parts
    from lorekeeper_question_routes import look_expression_subject

    look_subj = look_expression_subject(question)
    if look_subj:
        return [look_subj]

    targets: list[str] = []
    cov_written = re.search(
        r"\b(?:tell\s+me\s+)?everything\s+(?:i\s+)?(?:have\s+)?(?:written|saved)\s+"
        r"(?:on|about|for|regarding)\s+(.+?)(?:\?|$)",
        question,
        re.I,
    )
    if cov_written:
        tail = _strip_work_scope(cov_written.group(1).strip().rstrip("?.!"))
        if tail and len(tail.split()) <= 4:
            targets.append(_display_name(tail))
    what_written = re.search(
        r"\bwhat (?:have )?i (?:written|saved)\s+(?:on|about|for|regarding)\s+(.+?)(?:\?|$)",
        question,
        re.I,
    )
    if what_written:
        tail = _strip_work_scope(what_written.group(1).strip().rstrip("?.!"))
        if tail and len(tail.split()) <= 4:
            name = _display_name(tail)
            if name.lower() not in {t.lower() for t in targets}:
                targets.append(name)
    for m in re.finditer(r"character\s+([a-z0-9]+)", question, re.I):
        targets.append(f"Character {m.group(1).upper()}")
    subject = _who_is_subject(question)
    if subject and subject.lower() not in {t.lower() for t in targets}:
        targets.append(subject)
    if is_knowledge_pov_question(question):
        parts = knowledge_pov_parts(question)
        if parts:
            knower, _topic = parts
            if knower.lower() not in {t.lower() for t in targets}:
                targets.append(knower)
        seen_k: set[str] = set()
        out_k: list[str] = []
        for t in targets:
            key = t.lower()
            if key and key not in seen_k:
                seen_k.add(key)
                out_k.append(t)
        return out_k
    from lorekeeper_question_routes import extract_what_subject, is_what_question

    if is_what_question(question):
        subject = extract_what_subject(question)
        if subject and subject.lower() not in {t.lower() for t in targets}:
            targets.append(subject)
        seen_w: set[str] = set()
        out_w: list[str] = []
        for t in targets:
            key = t.lower()
            if key and key not in seen_w:
                seen_w.add(key)
                out_w.append(t)
        return out_w
    for m in re.finditer(
        r"(?:about|on)\s+(character\s+[a-z0-9]+|[\w][\w\s'-]{1,40})",
        question,
        re.I,
    ):
        raw = _strip_work_scope(m.group(1).strip())
        if raw.lower().startswith("character "):
            targets.append(_normalize_character(raw))
        elif len(raw.split()) <= 4:
            # "notes on that expression" is a topic, not a cast name.
            if re.match(
                r"^(?:that|this|the|my|your|all)\b|"
                r"^(?:expression|face|look|scene|beat|moment)\b",
                raw,
                re.I,
            ):
                continue
            targets.append(_display_name(raw))
    seen: set[str] = set()
    out: list[str] = []
    for t in targets:
        key = t.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out


def _wants_gather(question: str) -> bool:
    from lorekeeper_allusion import is_allusion_question

    if is_coverage_question(question):
        return True
    if is_who_is_question(question):
        return True
    if is_allusion_question(question):
        return True
    if SUMMARY_HINT.search(question):
        return True
    if re.search(r"character\s+[a-z0-9]+", question, re.I) and re.search(
        r"\b(summary|summarize|who|about|tell|remind|everything)\b", question, re.I
    ):
        return True
    return False


def _work_hints_from_question(question: str, entries: list[dict[str, Any]]) -> set[str]:
    return extract_work_hints(question, entries)


def _entry_matches_work(entry: dict[str, Any], work_hints: set[str]) -> bool:
    return entry_matches_work(entry, work_hints)


def _entries_for_work(entries: list[dict[str, Any]], question: str) -> list[dict[str, Any]]:
    work_hints = extract_work_hints(question, entries)
    if not work_hints:
        return entries
    return filter_entries_by_work(entries, work_hints, strict=work_named_in_question(question))


def _group_entries_for_character(scope: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge chapters/pages and draft paragraphs for the same work (#11 draft-aware)."""
    groups: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    full_doc_ids: set[str] = set()

    for entry in scope:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        if eid and "#p" not in eid and str(entry.get("kind") or "") == "document":
            full_doc_ids.add(eid)

    for entry in scope:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        body = str(entry.get("body") or "").strip()
        tags = entry.get("tags") or []
        title = str(entry.get("title") or "Untitled")
        title_base = title.split(" / ")[0].strip()

        if "#p" in eid:
            parent_id = eid.split("#", 1)[0]
            if parent_id in full_doc_ids:
                continue
            key = f"doc:{parent_id}"
            if key not in groups:
                groups[key] = {
                    "id": parent_id,
                    "title": title_base or title,
                    "body": "",
                    "tags": tags,
                    "kind": "document",
                }
                order.append(key)
            if body:
                if groups[key]["body"]:
                    groups[key]["body"] += "\n\n" + body
                else:
                    groups[key]["body"] = body
            continue

        # Keep each note, character sheet, and relationship entry separate — do not
        # merge by work tag (that collapsed dozens of notes into "1 saved place").
        key = f"entry:{eid or title_base or len(order)}"
        groups[key] = {
            "id": eid,
            "title": title_base or title,
            "body": body,
            "tags": tags,
            "kind": entry.get("kind") or "note",
        }
        order.append(key)
    return [groups[k] for k in order]


def _count_mention_places(label: str, entries: list[dict[str, Any]]) -> int:
    """Distinct saved entries (notes, docs, pages) where this character appears by name."""
    seen: set[str] = set()
    count = 0
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        blob = normalize_corpus_text(
            f"{entry.get('title') or ''} {entry.get('body') or ''}"
        )
        if not _name_in_text(label, blob):
            continue
        bucket = eid.split("#p", 1)[0] if "#p" in eid else eid
        if not bucket or bucket in seen:
            continue
        seen.add(bucket)
        count += 1
    return count


def _scope_for_character(
    entries: list[dict[str, Any]], question: str, names: list[str], *, fast: bool = False
) -> list[dict[str, Any]]:
    """Work-scoped search, plus any note/doc that mentions this character by name."""
    work_hints = _work_hints_from_question(question, entries)
    names = expand_name_list(names, entries, work_hints)
    work_scope = _entries_for_work(entries, question)
    picked: list[dict[str, Any]] = list(work_scope)
    seen_ids: set[str] = {str(e.get("id") or "") for e in picked}

    family_note = re.compile(
        r"\b(?:brother|sister|sibling|cousin|parent|mother|father|family|married|spouse|twin)\b",
        re.I,
    )

    for entry in entries:
        if fast and len(picked) >= 90:
            break
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        if eid in seen_ids:
            continue
        kind = str(entry.get("kind") or "")
        body = str(entry.get("body") or "")
        if kind == "relationship" and _entry_matches_work(entry, work_hints):
            picked.append(entry)
            seen_ids.add(eid)
            continue
        if family_note.search(body) and _entry_matches_work(entry, work_hints):
            picked.append(entry)
            seen_ids.add(eid)
            continue
        if _title_matches_character(entry, names):
            picked.append(entry)
            seen_ids.add(eid)
            continue
        blob = f"{entry.get('title') or ''} {body}"
        if any(_name_in_text(name, blob) for name in names):
            picked.append(entry)
            seen_ids.add(eid)

    if not picked and not work_named_in_question(question):
        picked = entries
    grouped = _group_entries_for_character(picked)
    if fast:
        return grouped[:90]
    return _expand_scope_for_family(entries, grouped, names)


def _expand_scope_for_family(
    all_entries: list[dict[str, Any]],
    scope: list[dict[str, Any]],
    names: list[str],
) -> list[dict[str, Any]]:
    """Pull in family notes that name a brother already linked to this character."""
    known = collect_brother_names(names[0], scope)
    if not known:
        known = brother_names_from_brief(build_character_brief(names[0], scope).get("ties") or [])
    if not known:
        return scope

    expanded = list(scope)
    seen_ids = {str(e.get("id") or "") for e in expanded}
    for entry in all_entries:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        if eid in seen_ids:
            continue
        body = str(entry.get("body") or "")
        if not body:
            continue
        if not any(_name_in_text(name, body) for name in known):
            if not family_chain_in_body(body):
                continue
        expanded.append(entry)
        seen_ids.add(eid)

    if len(expanded) == len(scope):
        return scope
    return _group_entries_for_character(expanded)


def _name_in_text(name: str, text: str) -> bool:
    if not name or not text:
        return False
    return bool(re.search(rf"\b{re.escape(name)}\b", text, re.I))


def _is_author_meta_sentence(sentence: str, names: list[str] | None = None) -> bool:
    s = (sentence or "").strip()
    if not s:
        return True
    names = names or []
    if _AUTHOR_META_RE.search(s):
        return True
    if re.match(r"^I\s+(think|thought|feel|felt|want|wanted|should|could|might|need|needed|was thinking)\b", s, re.I):
        return True
    if re.match(r"^Initially,\s*I\b", s, re.I):
        return True
    if re.search(r"\bI\s+(wrote|write|say|said|decided|have decided|now decided)\b", s, re.I):
        return True
    if re.search(r"\bI've\b", s, re.I):
        return True
    bg = re.match(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+Background\s*:", s)
    if bg and names and not any(
        _name_in_text(name, bg.group(1)) for name in names
    ):
        return True
    if re.search(r"\bchapter\s+\d+\b", s, re.I):
        if names and not any(_name_in_text(name, s) for name in names):
            if not _has_profile_copula(s, names):
                return True
    return False


def _segment_is_name_led(segment: str, names: list[str]) -> bool:
    head = (segment or "").strip()
    for name in names:
        if re.match(rf"^{re.escape(name)}\s*[—–\-:,]", head, re.I):
            return True
    return False


def _bits_from_segment(segment: str, names: list[str]) -> list[str]:
    sents = _split_sentences(segment)
    name_led = _segment_is_name_led(segment, names)
    out: list[str] = []
    for i, sentence in enumerate(sents):
        if _is_author_meta_sentence(sentence, names):
            continue
        if any(_name_in_text(name, sentence) for name in names):
            out.append(sentence)
            if i + 1 < len(sents):
                nxt = sents[i + 1]
                if re.match(r"^(He|She|They|It|His|Her|Their)\b", nxt, re.I):
                    if not _is_author_meta_sentence(nxt, names):
                        out.append(nxt)
            continue
        if not name_led:
            continue
        bucket = _classify_sentence(sentence, names)
        if bucket in ("role", "identity", "relationship"):
            out.append(sentence)
        elif bucket == "detail" and (
            _has_profile_copula(sentence, names)
            or _name_led_identity(sentence, names)
            or _TRAIT_HINT.search(sentence)
        ):
            out.append(sentence)
    return out


def _name_led_identity(sentence: str, names: list[str]) -> bool:
    for name in names:
        if re.match(rf"^{re.escape(name)}\s*[—–\-:,]", sentence, re.I):
            return True
        if sentence.lower().startswith(name.lower() + ","):
            return True
    return False


def _split_sentences(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if p.strip()]


def _work_tokens_for_focus(
    question: str, entries: list[dict[str, Any]] | None = None
) -> set[str]:
    """Work-title words are scope, not topic — strip them from focus terms."""
    from lorekeeper_reliability import primary_work_hints

    out: set[str] = set()
    for hint in primary_work_hints(question):
        out.update(re.findall(r"[a-z0-9']+", str(hint).lower()))
    if entries:
        for hint in extract_work_hints(question, entries):
            out.update(re.findall(r"[a-z0-9']+", str(hint).lower()))
    return out


def _focus_terms(
    question: str, entries: list[dict[str, Any]] | None = None
) -> list[str]:
    q = question.lower()
    terms: list[str] = []
    work_tokens = _work_tokens_for_focus(question, entries)
    for bigram in ("political intrigue", "dramatic moment", "illustrated scene"):
        if bigram in q:
            terms.append(bigram)
    tokens = re.findall(r"[a-z0-9']+", q)
    for token in tokens:
        if len(token) <= 2 or token in FOCUS_STOP or token in work_tokens:
            continue
        if token not in terms:
            terms.append(token)
    return terms[:12]


def _content_topic_terms(terms: list[str]) -> list[str]:
    """Creature / race / species words the question actually asked about."""
    out: list[str] = []
    for term in terms:
        t = (term or "").strip().lower()
        if not t:
            continue
        if t in _TOPIC_CONTENT_TERMS or t.endswith("folk"):
            out.append(t)
    return out


def _kind_matches_terms(kind: str, terms: list[str]) -> bool:
    hints = KIND_HINTS.get(kind or "", ())
    for term in terms:
        for hint in hints:
            if hint in term or term in hint:
                return True
    return False


_BIOGRAPHY_RE = re.compile(
    r"\b(?:is|was|were)\s+(?:born|raised|growing up|lived|fled|escaped|sent|brought|"
    r"created|written|introduced|first seen|only)\b",
    re.I,
)


def _title_exact_match(entry: dict[str, Any], names: list[str]) -> bool:
    title = str(entry.get("title") or "").strip().lower()
    return any(title == name.lower() for name in names)


def _title_matches_character(entry: dict[str, Any], names: list[str]) -> bool:
    title = str(entry.get("title") or "").strip()
    if not title:
        return False
    title_low = title.lower()
    kind = str(entry.get("kind") or "")
    for name in names:
        if title_low == name.lower():
            return True
        if re.match(rf"^{re.escape(name)}\s*[—–\-:,]", title, re.I):
            return True
        if kind == "character" and title_low == name.lower():
            return True
    return False


def _has_profile_copula(sentence: str, names: list[str]) -> bool:
    s_low = sentence.lower()
    for name in names:
        n = re.escape(name.lower())
        if re.search(
            rf"\b{n}\s+(?:is|was|are|were)\s+(?:the\s+)?(?:a|an\s+)?(?:{_PROFILE_ROLE_WORDS})\b",
            s_low,
        ):
            return True
        if re.search(rf"\b{n}\s+(?:is|was)\s+(?:married|engaged)\b", s_low):
            return True
        if re.search(rf"\b{n}\s*[—–\-:,]\s*", sentence, re.I):
            return True
        if _TRAIT_HINT.search(sentence) and re.search(rf"\b{n}\b", s_low):
            return True
        # "Duke Dijon is a Eurasian Lynx" / "Dijon is a lynx"
        if re.search(rf"\b{n}\b", s_low) and _SPECIES_IDENTITY.search(sentence):
            return True
    if re.search(r"\b(son|daughter|child|brother|sister)\s+of\b", s_low):
        return True
    if re.search(r"\b(known as|called)\b", s_low):
        return any(_name_in_text(name, sentence) for name in names)
    if re.match(r"^(He|She|They)\s+(?:is|was|are|were)\b", sentence, re.I):
        if re.search(
            r"\b(son|daughter|child|brother|sister|protagonist|antagonist|spirit|villain|hero)\b",
            s_low,
        ):
            return True
    return False


def _is_scene_action_sentence(sentence: str, names: list[str] | None = None) -> bool:
    s = (sentence or "").strip()
    if not s:
        return False
    if names and _has_profile_copula(s, names):
        return False
    if names and _name_led_identity(s, names):
        return False
    if re.match(
        r"^(Opening|Closing|Turning|Looking|Staring|Running|Walking|Standing|Sitting)\b",
        s,
        re.I,
    ):
        return True
    if _SCENE_ACTION.search(s):
        if names and any(_name_in_text(name, s) for name in names):
            return True
    return False


def _is_dialogue_sentence(sentence: str) -> bool:
    s = (sentence or "").strip()
    if not s:
        return False
    if s.startswith(('"', "'", "“", "‘", "—", "-")):
        return True
    if _DIALOGUE_VERB.search(s):
        return True
    quote_chars = sum(s.count(c) for c in ('"', "'", "“", "”", "‘", "’"))
    if quote_chars >= 2 and quote_chars >= len(s) // 8:
        return True
    return False


def _classify_sentence(sentence: str, names: list[str] | None = None) -> str:
    names = names or []
    if _is_dialogue_sentence(sentence):
        return "dialogue"
    if names and _is_scene_action_sentence(sentence, names):
        return "scene"
    if names and _name_led_identity(sentence, names):
        return "identity"
    s_low = sentence.lower()
    if re.search(rf"\b(?:{_PROFILE_ROLE_WORDS})\b", s_low):
        return "role"
    if re.search(
        r"\b(husband|wife|spouse|mother|father|parent|son|daughter|child|brother|sister|"
        r"married|engaged|dating|uncle|aunt|cousin|nephew|niece|grandfather|grandmother|"
        r"subject of|quarry of)\b",
        s_low,
    ):
        return "relationship"
    if names and _has_profile_copula(sentence, names):
        return "identity"
    if re.search(
        r"\b(works as|worked as|plays|played|serves as|looks like|son of|daughter of|"
        r"child of|brother of|sister of)\b",
        s_low,
    ):
        return "identity"
    return "detail"


_ROLE_WORDS = frozenset(
    """
    protagonist antagonist villain hero heroine narrator mentor sidekick
    deuteragonist foil main character side character supporting character
    minor character background character comic relief love interest
    """.split()
)


def _segments_mentioning(body: str, names: list[str]) -> list[str]:
    body = (body or "").strip()
    if not body:
        return []
    segments: list[str] = []
    blocks = [b.strip() for b in re.split(r"\n+", body) if b.strip()] or [body]
    cast_split = re.compile(
        r"(?=\b(?:Character\s+[A-Z0-9]+|[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s*[—–\-:,])"
    )
    for block in blocks:
        pieces = [p.strip() for p in cast_split.split(block) if p.strip()] or [block]
        for piece in pieces:
            if any(_name_in_text(name, piece) for name in names):
                segments.append(piece)
    return segments


def _entry_is_character_sheet(entry: dict[str, Any], names: list[str]) -> bool:
    kind = str(entry.get("kind") or "")
    if kind == "character":
        return True
    if _title_matches_character(entry, names):
        return True
    title = str(entry.get("title") or "").strip().lower()
    for name in names:
        if title == name.lower():
            return True
    return False


def _bits_for_character(entry: dict[str, Any], names: list[str]) -> list[str]:
    title = str(entry.get("title") or "Untitled")
    body = normalize_corpus_text(str(entry.get("body") or ""))
    bits: list[str] = []
    role_terms = [n.lower() for n in names if n.lower() in _ROLE_WORDS]

    if _entry_is_character_sheet(entry, names):
        if body:
            label = names[0] if names else ""
            bits = [s for s in _split_sentences(body) if _who_is_profile_bit(s, label)]
            if not bits and _title_exact_match(entry, names):
                bits = _bits_from_segment(f"{label} — {body}", names)
        elif title:
            bits = [f"(Entry titled “{title}” — no body text yet.)"]
    elif role_terms:
        for sentence in _split_sentences(body):
            s_low = sentence.lower()
            if any(role in s_low for role in role_terms):
                bits.append(sentence)
    else:
        segments = _segments_mentioning(body, names)
        for segment in segments:
            bits.extend(_bits_from_segment(segment, names))
        if not bits:
            sentences = _split_sentences(body)
            for i, sentence in enumerate(sentences):
                if _is_author_meta_sentence(sentence, names):
                    continue
                if not any(_name_in_text(name, sentence) for name in names):
                    continue
                bits.append(sentence)
                if i + 1 < len(sentences):
                    nxt = sentences[i + 1]
                    if re.match(r"^(He|She|They|It|His|Her|Their)\b", nxt, re.I):
                        if not _is_author_meta_sentence(nxt, names):
                            bits.append(nxt)

    bits.sort(key=lambda s: _BUCKET_RANK.get(_classify_sentence(s, names), 3))
    return bits[:12]


def _term_variants(term: str) -> list[str]:
    t = (term or "").strip().lower()
    if not t:
        return []
    out = [t]
    if " " in t:
        return out
    if t.endswith("s") and len(t) > 3:
        out.append(t[:-1])
    else:
        out.append(t + "s")
    # de-dupe preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for v in out:
        if v not in seen:
            seen.add(v)
            uniq.append(v)
    return uniq


def _term_in_text(term: str, text: str) -> bool:
    """Match whole topic words, including simple plural (bird ↔ birds)."""
    t = (term or "").strip().lower()
    if not t or not text:
        return False
    if " " in t:
        return t in text
    return any(
        re.search(rf"\b{re.escape(v)}\b", text) for v in _term_variants(t)
    )


def _bits_for_terms(
    entry: dict[str, Any],
    terms: list[str],
    *,
    require_content: list[str] | None = None,
) -> list[str]:
    title = str(entry.get("title") or "Untitled")
    body = str(entry.get("body") or "").strip()
    kind = str(entry.get("kind") or "note")
    eid = str(entry.get("id") or "")
    bits: list[str] = []
    title_low = title.lower()
    body_low = body.lower()
    # Prefer creature/race topic words when present — never pull on work-title alone.
    match_terms = list(require_content) if require_content else list(terms)
    if not match_terms:
        return []

    kind_hit = _kind_matches_terms(kind, match_terms)
    if kind_hit and body and not require_content:
        return _split_sentences(body)[:8]

    for sentence in _split_sentences(body):
        s_low = sentence.lower()
        if any(_term_in_text(term, s_low) for term in match_terms):
            bits.append(sentence)
    if bits:
        return bits[:6]

    # Title fallback: only when the title itself carries the topic (e.g. note
    # titled "Birds"). Never for draft paragraph slices whose titles are the
    # work/doc name — that mixed sentinel cast lines into bird Asks.
    if "#p" in eid or kind == "document":
        return []
    if any(_term_in_text(term, title_low) for term in match_terms):
        if body:
            bits.append(body[:420] + ("…" if len(body) > 420 else ""))
        else:
            bits.append(f"(Entry titled “{title}” — no body text yet.)")
    elif any(_term_in_text(term, body_low) for term in match_terms):
        if body:
            bits.append(body[:420] + ("…" if len(body) > 420 else ""))
    return bits[:6]


def _dedupe_lines(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        key = re.sub(r"\s+", " ", line.strip().lower())[:120]
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(line.strip())
    return out


def _record_source_id(ids: list[str], eid: str) -> None:
    if not eid:
        return
    if "#p" not in eid:
        if eid not in ids:
            ids.append(eid)
        return
    parent = eid.split("#", 1)[0]
    if parent and parent not in ids:
        ids.append(parent)


def _join_sentences(parts: list[str], limit: int = 3) -> str:
    picked = _dedupe_lines(parts)[:limit]
    if not picked:
        return ""
    text = " ".join(picked)
    if not text.endswith((".", "!", "?", "…")):
        text += "."
    return text


def _unfleshed_message(
    label: str, mention_places: int, dialogue_only: bool, scene_only: bool = False
) -> str:
    lines = [f"{label} — from what you've saved:\n"]
    if mention_places > 0:
        place_word = "place" if mention_places == 1 else "places"
        lines.append(
            f"You mention {label} in your draft ({mention_places} {place_word}), "
            "but you haven't fleshed them out yet — I couldn't find who they are in the story, "
            "their role, or their family ties in your notes."
        )
    else:
        lines.append(
            f"I couldn't find anything about {label} in your saved notes for this work."
        )
    if dialogue_only and scene_only:
        lines.append(
            "What you do have is mostly scenes and dialogue — what they're doing or saying — "
            "not a character sketch."
        )
    elif scene_only:
        lines.append(
            "What you do have is mostly scene beats — what they're doing in the moment — "
            "not who they are in the story."
        )
    elif dialogue_only:
        lines.append(
            "What you do have is mostly lines of dialogue, not a character sketch."
        )
    lines.append(
        "\nThat's a gap you might want to fill — a short character note on who they are, "
        "what they want, and how they connect to the rest of the cast."
    )
    lines.append("\n— Pulled from your notes only. Nothing invented.")
    return "\n".join(lines)


def _clear_profile_line(bit: str, label: str) -> bool:
    bucket = _classify_sentence(bit, [label])
    if bucket == "role":
        return True
    if bucket == "relationship":
        return True
    if bucket == "identity":
        return _has_profile_copula(bit, [label]) or _name_led_identity(bit, [label])
    return False


def _who_is_profile_bit(bit: str, label: str) -> bool:
    if _is_author_meta_sentence(bit, [label]):
        return False
    from lorekeeper_character_compose import (
        _is_plot_arc_clause,
        is_other_character_scene_beat,
        is_story_significance_clause,
    )

    if _is_plot_arc_clause(bit) or is_other_character_scene_beat(bit, label):
        return False
    if is_story_significance_clause(bit, label) and any(
        _name_in_text(name, bit) for name in [label]
    ):
        return True
    bucket = _classify_sentence(bit, [label])
    if bucket in ("role", "identity", "relationship"):
        return True
    if bucket == "detail":
        return bool(
            _has_profile_copula(bit, [label])
            or _name_led_identity(bit, [label])
            or _TRAIT_HINT.search(bit)
        )
    if bucket == "dialogue":
        return bool(
            re.search(
                r"\b(brother|sister|mother|father|married|wife|husband|cousin)\b",
                bit,
                re.I,
            )
        )
    if _BIOGRAPHY_RE.search(bit):
        return False
    return False


def _who_is_cast_bit_from_draft(bit: str, label: str) -> bool:
    """Draft prose: cast facts and fixed traits — not plot walkthrough."""
    from lorekeeper_character_compose import is_other_character_scene_beat

    if is_other_character_scene_beat(bit, label):
        return False
    if _who_is_profile_bit(bit, label):
        return True
    if _is_author_meta_sentence(bit, [label]) or _is_plot_arc_clause(bit):
        return False
    if not any(_name_in_text(name, bit) for name in [label]):
        return False
    if _BIOGRAPHY_RE.search(bit):
        return False
    if _is_scene_action_sentence(bit, [label]) and not _TRAIT_HINT.search(bit):
        if not re.search(
            r"\b(command|defer|obey|fear|loyal|traitor|ruler|captain|guard|servant|"
            r"wizard|knight|soldier|priest|merchant|heir|exile|prisoner)\b",
            bit,
            re.I,
        ):
            return False
    if _TRAIT_HINT.search(bit):
        return True
    if re.search(
        r"\b(guarded|guards|commands|commanded|feared|feared by|loyal to|serves|"
        r"served|rules|ruled|leads|led|protects|protected|wears|dressed|looks like)\b",
        bit,
        re.I,
    ):
        return True
    if _classify_sentence(bit, [label]) == "dialogue" and re.search(
        r"\b(brother|sister|mother|father|married|wife|husband|cousin|my lord|your majesty)\b",
        bit,
        re.I,
    ):
        return True
    return False


def _is_plot_arc_clause(bit: str) -> bool:
    from lorekeeper_character_compose import _is_plot_arc_clause as _arc

    return _arc(bit)


def _format_character_brief(label: str, brief: dict) -> str:
    role = (brief or {}).get("role")
    ties = (brief or {}).get("ties") or []
    lines = [f"{label} — from what you've saved:\n"]
    if role:
        lines.append(str(role))
    if ties:
        if role:
            lines.append("")
        lines.append("Family ties:")
        for tie in ties[:8]:
            lines.append(f"• {tie}")
    lines.append("\n— Read from your draft only. Nothing invented.")
    return "\n".join(lines)


def _brief_has_content(brief: dict | None) -> bool:
    if not brief:
        return False
    return bool(brief.get("role") or brief.get("ties"))


def _synthesize_character_answer(
    label: str,
    hits: list[tuple[str, str, list[str], bool]],
    brief: dict | None = None,
    *,
    work_title: str | None = None,
    coverage: bool = False,
    stated_relationships: list[str] | None = None,
    alias_lines: list[str] | None = None,
    use_draft_cast: bool = False,
    question: str = "",
) -> tuple[str, list[str]]:
    roles: list[str] = []
    identity: list[str] = []
    relationships: list[str] = []
    details: list[str] = []
    dialogue: list[str] = []
    scenes: list[str] = []
    ids: list[str] = []
    source_titles: set[str] = set()

    for eid, entry_title, bits, _is_doc in hits:
        _record_source_id(ids, eid)
        if entry_title:
            source_titles.add(entry_title)
        for bit in bits:
            bit_ok = (
                _who_is_cast_bit_from_draft(bit, label)
                if use_draft_cast
                else _who_is_profile_bit(bit, label)
            )
            if not coverage and not bit_ok:
                continue
            bucket = _classify_sentence(bit, [label])
            if bucket == "role" and not cast_role_line_about_label(bit, label):
                continue
            if bucket == "role":
                roles.append(bit)
            elif bucket == "identity":
                identity.append(bit)
            elif bucket == "relationship":
                relationships.append(bit)
            elif bucket == "dialogue":
                dialogue.append(bit)
            elif bucket == "scene":
                scenes.append(bit)
            else:
                details.append(bit)

    roles = _dedupe_lines(roles)
    identity = _dedupe_lines(identity)
    relationships = _dedupe_lines(relationships)
    details = _dedupe_lines(details)
    dialogue = _dedupe_lines(dialogue)
    scenes = _dedupe_lines(scenes)

    if question and not coverage:
        from lorekeeper_answer_focus import apply_facet_to_compose_buckets, detect_narrow_facet

        facet = detect_narrow_facet(question)
        (
            roles,
            identity,
            relationships,
            details,
            dialogue,
            scenes,
            stated_relationships,
        ) = apply_facet_to_compose_buckets(
            facet,
            roles=roles,
            identity=identity,
            relationships=relationships,
            details=details,
            dialogue=dialogue,
            scenes=scenes,
            stated_relationships=stated_relationships,
        )
        compose_facet = facet
    else:
        compose_facet = None

    if coverage:
        findings: list[str] = []
        for line in roles + identity + relationships + details + dialogue + scenes:
            line = line.strip()
            if line and not line.startswith("(Entry"):
                findings.append(line)
        for tie in (brief or {}).get("ties") or []:
            findings.append(str(tie).strip())
        mention_places = len(source_titles) or len(hits)
        if findings:
            return (
                compose_coverage_summary(
                    label,
                    findings,
                    mention_places=mention_places,
                    dialogue_only=bool(dialogue),
                    scene_only=bool(scenes),
                ),
                ids,
            )
        return (
            compose_coverage_gap(
                label,
                mention_places,
                bool(dialogue),
                bool(scenes),
            ),
            ids,
        )

    composed = compose_character_reference(
        label,
        brief=brief,
        roles=roles,
        identity=identity,
        relationships=relationships,
        details=details,
        dialogue=dialogue,
        scenes=scenes,
        work_title=work_title,
        stated_relationships=stated_relationships,
        alias_lines=alias_lines,
        facet=compose_facet,
    )
    if composed:
        mention_places = len(source_titles) or len(hits)
        if not coverage and (dialogue or scenes):
            unclear = character_unclear_body(
                label,
                mention_places=mention_places,
                dialogue_only=bool(dialogue)
                and not bool(roles + identity + relationships + details),
                scene_only=bool(scenes)
                and not bool(roles + identity + relationships),
                work_title=work_title,
                has_clear_facts=True,
            )
            if unclear:
                composed = append_unclear_section(composed, unclear)
        return composed, ids

    clear_profile = _dedupe_lines(
        [b for b in (roles + identity + relationships) if _clear_profile_line(b, label)]
    )
    has_profile = bool(clear_profile) or _brief_has_content(brief)

    if not has_profile and not details and not dialogue and not scenes:
        return "", ids

    mention_places = len(source_titles) or len(hits)
    if coverage:
        return (
            compose_coverage_gap(
                label,
                mention_places,
                bool(dialogue),
                bool(scenes),
            ),
            ids,
        )
    return (
        compose_character_gap_reference(
            label,
            mention_places=mention_places,
            dialogue_only=bool(dialogue),
            scene_only=bool(scenes),
            work_title=work_title,
        ),
        ids,
    )


def _build_character_summary(
    question: str, entries: list[dict[str, Any]], *, fast_recall: bool = False
) -> tuple[str | None, list[str]]:
    names = character_targets(question)
    if not names:
        return None, []

    coverage = is_coverage_question(question)
    audit = is_audit_question(question)
    work_hints = extract_work_hints(question, entries)
    work_title = work_title_from_hints(work_hints)
    query_names = list(names)
    search_names = expand_name_list(query_names, entries, work_hints)
    alias_lines = (
        alias_reference_lines_for(query_names[0], entries, work_hints)
        if len(query_names) == 1
        else []
    )

    scope = _scope_for_character(entries, question, query_names, fast=fast_recall)
    label = query_names[0] if len(query_names) == 1 else ", ".join(query_names)

    from lorekeeper_character_compose import compose_character_reference
    from lorekeeper_inference import inference_reference_lines_for
    from lorekeeper_question_routes import is_character_portrait_question

    if (
        is_character_portrait_question(question)
        and len(query_names) == 1
        and not coverage
        and not audit
    ):
        inf = [
            line
            for line in inference_reference_lines_for(query_names[0], scope)
            if line and not _is_author_meta_sentence(line, query_names)
        ]
        if inf:
            composed = compose_character_reference(
                label,
                brief={},
                roles=[],
                identity=inf,
                relationships=[],
                details=[],
                dialogue=[],
                scenes=[],
                work_title=work_title,
                stated_relationships=[],
                alias_lines=alias_lines,
            )
            if composed and len(composed.strip()) > 80:
                source_ids = [
                    str(e.get("id"))
                    for e in scope
                    if isinstance(e, dict) and str(e.get("id") or "")
                ]
                return composed, source_ids[:8]

    stated_rels = plain_relationship_lines_for(query_names[0], scope)
    brief = build_character_brief(query_names[0], scope) if not fast_recall else {}

    if not fast_recall:
        for _ in range(2):
            wider = _expand_scope_for_family(entries, scope, query_names)
            if len(wider) <= len(scope):
                break
            scope = wider
            brief = build_character_brief(query_names[0], scope)

    if audit and len(query_names) == 1:
        contradictions = audit_contradiction_lines_for(query_names[0], scope)
        source_ids = [
            str(e.get("id"))
            for e in scope
            if isinstance(e, dict) and str(e.get("id") or "")
        ]
        return compose_audit_summary(label, contradictions), source_ids[:8]

    note_scope = [e for e in scope if not _is_draft_entry(e)]
    hits = _collect_hits(scope, search_names)

    if not hits:
        if coverage:
            return compose_coverage_gap(label, 0, False), []
        draft_roles = _explicit_profile_lines_from_drafts(label, scope, query_names)
        if draft_roles:
            answer, ids = _synthesize_character_answer(
                label,
                [("draft-profile", "Draft", draft_roles, True)],
                brief,
                work_title=work_title,
                coverage=False,
                stated_relationships=stated_rels,
                alias_lines=alias_lines,
                question=question,
            )
            if answer:
                return answer, ids
        composed = _compose_from_brief_only(
            label,
            brief,
            work_title=work_title,
            stated_relationships=stated_rels,
            alias_lines=alias_lines,
        )
        if composed:
            return composed, []
        mention_places = _count_mention_places(label, scope)
        return (
            compose_character_gap_reference(
                label,
                mention_places=mention_places,
                dialogue_only=False,
                scene_only=mention_places > 0,
                work_title=work_title,
            ),
            [],
        )

    return _synthesize_from_notes_first(
        label,
        hits,
        brief,
        scope=scope,
        work_title=work_title,
        coverage=coverage,
        stated_relationships=stated_rels,
        alias_lines=alias_lines,
        question=question,
    )


def _is_draft_entry(entry: dict[str, Any]) -> bool:
    kind = str(entry.get("kind") or "")
    eid = str(entry.get("id") or "")
    return kind == "document" or "#p" in eid


def _collect_hits(
    scope: list[dict[str, Any]], names: list[str]
) -> list[tuple[str, str, list[str], bool]]:
    hits: list[tuple[str, str, list[str], bool]] = []
    seen_bits: set[str] = set()
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        kind = str(entry.get("kind") or "")
        bits = _bits_for_character(entry, names)
        if not bits:
            continue
        deduped_bits: list[str] = []
        for bit in bits:
            key = re.sub(r"\s+", " ", bit.lower())[:100]
            if key in seen_bits:
                continue
            seen_bits.add(key)
            deduped_bits.append(bit)
        if not deduped_bits:
            continue
        hits.append(
            (
                eid,
                str(entry.get("title") or "Untitled"),
                deduped_bits,
                kind == "document",
            )
        )
    return hits


def _explicit_profile_lines_from_drafts(
    label: str, scope: list[dict[str, Any]], names: list[str]
) -> list[str]:
    """Last resort: pull only explicit cast/profile sentences from drafts — never scene beats."""
    # Also try bare name without duke/lord so draft "Dijon is a lynx" hits.
    query_names = list(names)
    for name in list(names):
        parts = str(name or "").split()
        if len(parts) >= 2 and parts[0].lower() in {
            "duke",
            "duchess",
            "lord",
            "lady",
            "sir",
            "dame",
            "king",
            "queen",
            "prince",
            "princess",
            "baron",
            "baroness",
            "count",
            "countess",
        }:
            bare = " ".join(parts[1:])
            if bare and bare not in query_names:
                query_names.append(bare)
    lines: list[str] = []
    seen: set[str] = set()
    for entry in scope:
        if not _is_draft_entry(entry):
            continue
        body = normalize_corpus_text(str(entry.get("body") or ""))
        for sentence in _split_sentences(body):
            if _is_author_meta_sentence(sentence, query_names):
                continue
            if not any(_name_in_text(name, sentence) for name in query_names):
                continue
            if not _has_profile_copula(sentence, query_names) and not _name_led_identity(
                sentence, query_names
            ):
                continue
            if _classify_sentence(sentence, query_names) in ("scene", "dialogue"):
                continue
            key = re.sub(r"\s+", " ", sentence.lower())[:100]
            if key in seen:
                continue
            seen.add(key)
            lines.append(sentence)
    return lines[:8]


def _compose_from_brief_only(
    label: str,
    brief: dict | None,
    *,
    work_title: str | None,
    stated_relationships: list[str] | None,
    alias_lines: list[str] | None = None,
) -> str:
    from lorekeeper_character_compose import compose_character_reference

    return (
        compose_character_reference(
            label,
            brief=brief,
            roles=[],
            identity=[],
            relationships=[],
            details=[],
            dialogue=[],
            scenes=[],
            work_title=work_title,
            stated_relationships=stated_relationships,
            alias_lines=alias_lines,
        )
        or ""
    )


def _merge_hits(
    *groups: list[tuple[str, str, list[str], bool]],
) -> list[tuple[str, str, list[str], bool]]:
    merged: dict[str, tuple[str, str, list[str], bool]] = {}
    for group in groups:
        for eid, title, bits, is_doc in group:
            if eid in merged:
                old = merged[eid]
                seen = {re.sub(r"\s+", " ", b.lower())[:80] for b in old[2]}
                extra = [b for b in bits if re.sub(r"\s+", " ", b.lower())[:80] not in seen]
                merged[eid] = (eid, title, old[2] + extra, is_doc or old[3])
            else:
                merged[eid] = (eid, title, list(bits), is_doc)
    return list(merged.values())


def _synthesize_from_notes_first(
    label: str,
    hits: list[tuple[str, str, list[str], bool]],
    brief: dict | None,
    *,
    scope: list[dict[str, Any]],
    work_title: str | None,
    coverage: bool,
    stated_relationships: list[str] | None,
    alias_lines: list[str] | None = None,
    question: str = "",
) -> tuple[str, list[str]]:
    """Who-is: notes first; if thin, distill cast facts from draft documents."""
    from lorekeeper_character_compose import (
        compose_draft_vs_notes_dual,
        is_composed_reference_answer,
    )
    from lorekeeper_inference import draft_vs_notes_conflict
    from lorekeeper_question_routes import (
        is_character_portrait_question,
        is_look_expression_question,
    )

    portrait = is_character_portrait_question(question)
    look_q = is_look_expression_question(question)

    def answer_good_enough(ans: str) -> bool:
        if not ans:
            return False
        # Sparse face/expression notes are exactly what the question asked for.
        if look_q:
            return "Nothing saved yet" not in ans and "only in your head" not in ans
        if portrait:
            return is_composed_reference_answer(ans) and len(ans.strip()) > 160
        return not cast_answer_is_thin(ans, label)

    if coverage:
        return _synthesize_character_answer(
            label,
            hits,
            brief,
            work_title=work_title,
            coverage=coverage,
            stated_relationships=stated_relationships,
            alias_lines=alias_lines,
        )

    note_hits = [h for h in hits if not h[3]]
    doc_hits = [h for h in hits if h[3]]

    def synthesize(
        hit_list: list[tuple[str, str, list[str], bool]],
        *,
        use_draft_cast: bool = False,
    ) -> tuple[str, list[str]]:
        return _synthesize_character_answer(
            label,
            hit_list,
            brief,
            work_title=work_title,
            coverage=coverage,
            stated_relationships=stated_relationships,
            alias_lines=alias_lines,
            use_draft_cast=use_draft_cast,
            question=question,
        )

    def side_usable(ans: str) -> bool:
        if not ans or not ans.strip():
            return False
        low = ans.lower()
        return "nothing saved yet" not in low and "only in your head" not in low

    # Neutral dual layout when draft and notes disagree — draft first, no winner.
    if note_hits and doc_hits and draft_vs_notes_conflict(label, scope):
        draft_ans, draft_ids = synthesize(doc_hits, use_draft_cast=True)
        notes_ans, notes_ids = synthesize(note_hits)
        if side_usable(draft_ans) and side_usable(notes_ans):
            dual = compose_draft_vs_notes_dual(draft_ans, notes_ans)
            if dual:
                merged_ids = list(dict.fromkeys([*draft_ids, *notes_ids]))
                return dual, merged_ids[:8]

    if note_hits:
        answer, ids = synthesize(note_hits)
        if answer and answer_good_enough(answer):
            # Portrait / what-is: fold clear draft identity (species, role) into notes.
            if portrait or is_who_is_question(question):
                draft_roles = _explicit_profile_lines_from_drafts(
                    label, scope, [label]
                )
                if draft_roles:
                    ans_low = answer.lower()
                    missing = [
                        line
                        for line in draft_roles
                        if _SPECIES_IDENTITY.search(line)
                        and not any(
                            tok in ans_low
                            for tok in re.findall(
                                r"\b(?:lynx|rabbit|wolf|fox|cat|dog|bear|"
                                r"eagle|hawk|owl|species|creature)\b",
                                line.lower(),
                            )
                        )
                    ]
                    if missing:
                        combined = _merge_hits(
                            note_hits,
                            [("draft-profile", "Draft", missing, True)],
                        )
                        merged_ans, merged_ids = synthesize(
                            combined, use_draft_cast=True
                        )
                        if merged_ans and answer_good_enough(merged_ans):
                            return merged_ans, merged_ids
            return answer, ids

    if doc_hits or note_hits:
        combined = _merge_hits(note_hits, doc_hits)
        answer, ids = synthesize(
            combined, use_draft_cast=bool(doc_hits) and not portrait
        )
        if answer and answer_good_enough(answer):
            return answer, ids
        if answer and not note_hits and not portrait:
            return answer, ids

    draft_roles = _explicit_profile_lines_from_drafts(label, scope, [label])
    if draft_roles:
        answer, ids = _synthesize_character_answer(
            label,
            [("draft-profile", "Draft", draft_roles, True)],
            brief,
            work_title=work_title,
            coverage=False,
            stated_relationships=stated_relationships,
            alias_lines=alias_lines,
            question=question,
        )
        if answer:
            return answer, ids

    composed = _compose_from_brief_only(
        label,
        brief,
        work_title=work_title,
        stated_relationships=stated_relationships,
        alias_lines=alias_lines,
    )
    if composed and not cast_answer_is_thin(composed, label):
        return composed, []

    mention_places = _count_mention_places(label, scope)
    return (
        compose_character_gap_reference(
            label,
            mention_places=mention_places,
            dialogue_only=False,
            scene_only=mention_places > 0,
            work_title=work_title,
        ),
        [],
    )


def _topic_scope_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Prefer draft paragraph slices over the full-doc clone (avoids dup + bleed)."""
    ids = {str(e.get("id") or "") for e in entries if isinstance(e, dict)}
    parents_with_slices = {
        eid.split("#", 1)[0]
        for eid in ids
        if "#p" in eid
    }
    out: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        kind = str(entry.get("kind") or "")
        if (
            kind == "document"
            and eid
            and "#p" not in eid
            and eid in parents_with_slices
        ):
            continue
        out.append(entry)
    return out


def _build_topic_summary(question: str, entries: list[dict[str, Any]]) -> tuple[str | None, list[str]]:
    from lorekeeper_allusion import build_allusion_answer, is_allusion_question
    from lorekeeper_situation import build_situation_answer, is_situation_question

    if is_allusion_question(question):
        answer, ids = build_allusion_answer(question, entries)
        if answer:
            return answer, ids

    if is_situation_question(question):
        answer, ids = build_situation_answer(question, entries)
        if answer:
            return answer, ids

    terms = _focus_terms(question, entries)
    if not terms:
        return None, []
    content_terms = _content_topic_terms(terms)
    bit_terms = content_terms or terms

    scope = _topic_scope_entries(_entries_for_work(entries, question))
    hits: list[tuple[str, str, list[str]]] = []
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        bits = _bits_for_terms(
            entry,
            bit_terms,
            require_content=content_terms or None,
        )
        if not bits:
            continue
        # Species asks: skip cast notes that never mention the topic words.
        kind = str(entry.get("kind") or "")
        if content_terms and kind == "character":
            blob = " ".join(
                [
                    str(entry.get("title") or ""),
                    str(entry.get("body") or ""),
                ]
            ).lower()
            if not any(_term_in_text(t, blob) for t in content_terms):
                continue
        hits.append(
            (
                str(entry.get("id") or ""),
                str(entry.get("title") or "Untitled"),
                bits,
            )
        )

    if not hits:
        return None, []

    # Species notes before draft scraps when both match.
    def _hit_rank(item: tuple[str, str, list[str]]) -> tuple[int, int]:
        eid = item[0]
        kind = "note"
        for entry in scope:
            if str(entry.get("id") or "") == eid:
                kind = str(entry.get("kind") or "note")
                break
        kind_rank = 0 if kind in ("species", "world", "worldbuilding", "note") else 1
        return (kind_rank, 0 if "#p" in eid else 1)

    hits.sort(key=_hit_rank)

    label = ", ".join((content_terms or terms)[:4])
    lines: list[str] = []
    ids: list[str] = []

    def _bit_key(bit: str) -> str:
        return re.sub(r"\s+", " ", bit.strip().lower())[:120]

    # Flatten unique bits with source titles (species first via hits sort).
    flat: list[tuple[str, str, str]] = []
    seen_bits: set[str] = set()
    for eid, entry_title, bits in hits[:8]:
        if eid:
            parent = eid.split("#", 1)[0] if "#p" in eid else eid
            if parent and parent not in ids:
                ids.append(parent)
        for bit in bits:
            key = _bit_key(bit)
            if not key or key in seen_bits:
                continue
            seen_bits.add(key)
            flat.append((eid, entry_title, bit))

    if not flat:
        return None, []

    lead = flat[0][2]
    lines.append(lead)
    lines.append("")
    lines.append(f"What you've written about {label} (across your notes):\n")
    # Prefer other distinct bits as bullets; if only one bit, list it once.
    bullet_rows = flat[1:5] if len(flat) > 1 else flat[:1]
    for _eid, entry_title, bit in bullet_rows:
        lines.append(f"• From “{entry_title}”: {bit}")
    lines.append("\n— Combined from your notes only. Nothing invented.")
    return "\n".join(lines), ids


def build_gathered_answer(
    question: str, entries: list[dict[str, Any]], *, fast_recall: bool = False
) -> tuple[str | None, list[str]]:
    from lorekeeper_allusion import build_allusion_answer, is_allusion_question

    if (
        is_allusion_question(question)
        and not is_who_is_question(question)
        and not is_coverage_question(question)
        and not is_audit_question(question)
    ):
        answer, ids = build_allusion_answer(question, entries)
        if answer:
            return answer, ids

    targets = character_targets(question)
    who = is_who_is_question(question)
    if who or targets:
        answer, ids = _build_character_summary(question, entries, fast_recall=fast_recall)
        if answer:
            return answer, ids
        label = targets[0] if targets else _who_is_subject(question) or "that character"
        work_title = work_title_from_hints(extract_work_hints(question, entries))
        if is_coverage_question(question):
            return compose_coverage_gap(label, 0, False), []
        if is_audit_question(question):
            contradictions = audit_contradiction_lines_for(
                label, _scope_for_character(entries, question, [label])
            )
            return compose_audit_summary(label, contradictions), []
        return (
            compose_character_gap_reference(
                label,
                mention_places=0,
                dialogue_only=False,
                scene_only=False,
                work_title=work_title,
            ),
            [],
        )

    if not _wants_gather(question):
        return None, []

    targets = character_targets(question)
    if targets:
        answer, ids = _build_character_summary(question, entries)
        if answer:
            return answer, ids

    return _build_topic_summary(question, entries)


def character_summary_sources(question: str, entries: list[dict[str, Any]]) -> list[str]:
    _answer, ids = build_gathered_answer(question, entries)
    return ids
