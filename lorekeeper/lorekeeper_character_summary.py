"""LoreKeeper — gather related bits across entries (local, no invention)."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_inference import (
    build_character_brief,
    brother_names_from_brief,
    collect_brother_names,
    family_chain_in_body,
)

SUMMARY_HINT = re.compile(
    r"\b("
    r"summary|summarize|who is|tell me about|what do i (?:have|know|written)|"
    r"what about|anything about|notes on|"
    r"everything (?:i wrote|about|on)|character profile|remind me about|"
    r"what(?:'s| is) .+ (?:like|about)|gather|pull together|collect|show me"
    r")\b",
    re.I,
)

FOCUS_STOP = frozenset(
    """
    in on at for the a an and or but with from who what when where how about into
    summary summarize tell remind everything written have know character my your
    that this those these there here some any all just also only very much many
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

_PROFILE_ROLE_WORDS = (
    r"protagonist|antagonist|main character|point of view|pov|narrator|"
    r"hero|heroine|villain|deuteragonist|foil|mentor|sidekick|spirit|guardian|"
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
    tail = re.sub(r"^the\s+", "", tail, flags=re.I).strip()
    return _display_name(tail)


def character_targets(question: str) -> list[str]:
    targets: list[str] = []
    for m in re.finditer(r"character\s+([a-z0-9]+)", question, re.I):
        targets.append(f"Character {m.group(1).upper()}")
    subject = _who_is_subject(question)
    if subject and subject.lower() not in {t.lower() for t in targets}:
        targets.append(subject)
    for m in re.finditer(
        r"(?:about|on)\s+(character\s+[a-z0-9]+|[\w][\w\s'-]{1,40})",
        question,
        re.I,
    ):
        raw = m.group(1).strip()
        if raw.lower().startswith("character "):
            targets.append(_normalize_character(raw))
        elif len(raw.split()) <= 4:
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
    if SUMMARY_HINT.search(question):
        return True
    if re.search(r"character\s+[a-z0-9]+", question, re.I) and re.search(
        r"\b(summary|summarize|who|about|tell|remind|everything)\b", question, re.I
    ):
        return True
    return False


def _work_hints_from_question(question: str, entries: list[dict[str, Any]]) -> set[str]:
    q = question.lower()
    hints: set[str] = set()
    m = re.search(r"\bin\s+(.+?)(?:\?|$)", question, re.I)
    if m:
        hint = re.sub(r"\s+", " ", m.group(1).strip().lower().rstrip("?.!"))
        if len(hint) > 2:
            hints.add(hint)
    for entry in entries:
        title_base = str(entry.get("title") or "").split(" / ")[0].strip().lower()
        if len(title_base) > 2 and title_base in q:
            hints.add(title_base)
        for tag in entry.get("tags") or []:
            t = str(tag).strip().lower()
            if len(t) > 2 and t in q:
                hints.add(t)
    return hints


def _entry_matches_work(entry: dict[str, Any], work_hints: set[str]) -> bool:
    if not work_hints:
        return True
    title = str(entry.get("title") or "").lower()
    title_base = title.split(" / ")[0].strip()
    tags = [str(t).strip().lower() for t in (entry.get("tags") or [])]
    for hint in work_hints:
        if hint in title or hint in title_base:
            return True
        if any(hint in t or t in hint for t in tags):
            return True
    return False


def _entries_for_work(entries: list[dict[str, Any]], question: str) -> list[dict[str, Any]]:
    work_hints = _work_hints_from_question(question, entries)
    if not work_hints:
        return entries
    filtered = [e for e in entries if _entry_matches_work(e, work_hints)]
    return filtered or entries


def _group_entries_for_character(scope: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge chapters/pages for the same work so profile lines are not scattered."""
    groups: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "")
        if "#p" in eid:
            continue
        tags = entry.get("tags") or []
        title = str(entry.get("title") or "Untitled")
        title_base = title.split(" / ")[0].strip()
        key = (str(tags[0]).strip() if tags else "") or title_base or eid
        if key not in groups:
            groups[key] = {
                "id": eid,
                "title": title_base or title,
                "body": "",
                "tags": tags,
                "kind": entry.get("kind") or "note",
            }
            order.append(key)
        body = str(entry.get("body") or "").strip()
        if body:
            if groups[key]["body"]:
                groups[key]["body"] += "\n\n" + body
            else:
                groups[key]["body"] = body
    return [groups[k] for k in order]


def _scope_for_character(
    entries: list[dict[str, Any]], question: str, names: list[str]
) -> list[dict[str, Any]]:
    """Work-scoped search, plus any note/doc that mentions this character by name."""
    work_hints = _work_hints_from_question(question, entries)
    work_scope = _entries_for_work(entries, question)
    picked: list[dict[str, Any]] = list(work_scope)
    seen_ids: set[str] = {str(e.get("id") or "") for e in picked}

    family_note = re.compile(
        r"\b(?:brother|sister|sibling|cousin|parent|mother|father|family|married|spouse|twin)\b",
        re.I,
    )

    for entry in entries:
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

    if not picked:
        picked = entries
    grouped = _group_entries_for_character(picked)
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


def _focus_terms(question: str) -> list[str]:
    q = question.lower()
    terms: list[str] = []
    for bigram in ("political intrigue", "dramatic moment", "illustrated scene"):
        if bigram in q:
            terms.append(bigram)
    tokens = re.findall(r"[a-z0-9']+", q)
    for token in tokens:
        if len(token) > 2 and token not in FOCUS_STOP and token not in terms:
            terms.append(token)
    return terms[:12]


def _kind_matches_terms(kind: str, terms: list[str]) -> bool:
    hints = KIND_HINTS.get(kind or "", ())
    for term in terms:
        for hint in hints:
            if hint in term or term in hint:
                return True
    return False


def _title_matches_character(entry: dict[str, Any], names: list[str]) -> bool:
    title = str(entry.get("title") or "").strip()
    if not title:
        return False
    title_low = title.lower()
    for name in names:
        if title_low == name.lower():
            return True
        if str(entry.get("kind") or "") == "character" and _name_in_text(name, title):
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
        if re.search(rf"\b{n}\s+(?:is|was|are|were)\s+", s_low):
            if not re.search(r"\b(that|which|what|there)\s+(?:is|was)\b", s_low):
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
        r"married|engaged|dating|uncle|aunt|cousin|nephew|niece|grandfather|grandmother)\b",
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
    deuteragonist foil main character
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


def _bits_for_character(entry: dict[str, Any], names: list[str]) -> list[str]:
    title = str(entry.get("title") or "Untitled")
    body = str(entry.get("body") or "").strip()
    bits: list[str] = []
    role_terms = [n.lower() for n in names if n.lower() in _ROLE_WORDS]

    if _title_matches_character(entry, names):
        if body:
            bits = _split_sentences(body)
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
            block_sents = _split_sentences(segment)
            if block_sents:
                bits.extend(block_sents)
            else:
                bits.append(segment)
        if not bits:
            sentences = _split_sentences(body)
            for i, sentence in enumerate(sentences):
                if not any(_name_in_text(name, sentence) for name in names):
                    continue
                bits.append(sentence)
                if i + 1 < len(sentences):
                    nxt = sentences[i + 1]
                    if re.match(r"^(He|She|They|It|His|Her|Their)\b", nxt, re.I):
                        bits.append(nxt)

    bits.sort(key=lambda s: _BUCKET_RANK.get(_classify_sentence(s, names), 3))
    return bits[:8]


def _bits_for_terms(entry: dict[str, Any], terms: list[str]) -> list[str]:
    title = str(entry.get("title") or "Untitled")
    body = str(entry.get("body") or "").strip()
    kind = str(entry.get("kind") or "note")
    bits: list[str] = []
    title_low = title.lower()
    body_low = body.lower()

    kind_hit = _kind_matches_terms(kind, terms)
    if kind_hit and body:
        return _split_sentences(body)[:8]

    for sentence in _split_sentences(body):
        s_low = sentence.lower()
        if any(term in s_low for term in terms):
            bits.append(sentence)
    if not bits and any(term in title_low or term in body_low for term in terms):
        if body:
            bits.append(body[:420] + ("…" if len(body) > 420 else ""))
        else:
            bits.append(f"(Entry titled “{title}” — no body text yet.)")
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
            bucket = _classify_sentence(bit, [label])
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

    if _brief_has_content(brief):
        return _format_character_brief(label, brief), ids

    clear_profile = _dedupe_lines(
        [b for b in (roles + identity + relationships) if _clear_profile_line(b, label)]
    )
    has_profile = bool(clear_profile)

    if not has_profile and not details and not dialogue and not scenes:
        return "", ids

    if not has_profile:
        mention_places = len(source_titles) or len(hits)
        return (
            _unfleshed_message(
                label,
                mention_places,
                bool(dialogue),
                bool(scenes),
            ),
            ids,
        )

    lines = [f"{label} — from what you've saved:\n"]
    lines.append(_join_sentences(clear_profile, limit=3))
    lines.append("\n— Pulled from your draft only. Nothing invented.")
    return "\n".join(lines), ids


def _build_character_summary(question: str, entries: list[dict[str, Any]]) -> tuple[str | None, list[str]]:
    names = character_targets(question)
    if not names:
        return None, []

    scope = _scope_for_character(entries, question, names)
    label = names[0] if len(names) == 1 else ", ".join(names)
    brief = build_character_brief(names[0], scope)
    for _ in range(2):
        wider = _expand_scope_for_family(entries, scope, names)
        if len(wider) <= len(scope):
            break
        scope = wider
        brief = build_character_brief(names[0], scope)

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

    if not hits:
        if _brief_has_content(brief):
            return _format_character_brief(label, brief), []
        return _unfleshed_message(label, 0, False), []

    return _synthesize_character_answer(label, hits, brief)


def _build_topic_summary(question: str, entries: list[dict[str, Any]]) -> tuple[str | None, list[str]]:
    terms = _focus_terms(question)
    if not terms:
        return None, []

    scope = _entries_for_work(entries, question)
    hits: list[tuple[str, str, list[str]]] = []
    for entry in scope:
        if not isinstance(entry, dict):
            continue
        bits = _bits_for_terms(entry, terms)
        if not bits:
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

    label = ", ".join(terms[:4])
    lines = [f"What you've written about {label} (across your notes):\n"]
    ids: list[str] = []
    for eid, entry_title, bits in hits[:12]:
        if eid:
            ids.append(eid)
        for bit in bits:
            lines.append(f"• From “{entry_title}”: {bit}")
    lines.append("\n— Combined from your notes only. Nothing invented.")
    return "\n".join(lines), ids


def build_gathered_answer(question: str, entries: list[dict[str, Any]]) -> tuple[str | None, list[str]]:
    if not _wants_gather(question):
        return None, []

    targets = character_targets(question)
    if is_who_is_question(question) or targets:
        answer, ids = _build_character_summary(question, entries)
        if answer:
            return answer, ids
        label = targets[0] if targets else _who_is_subject(question) or "that character"
        return _unfleshed_message(label, 0, False), []

    return _build_topic_summary(question, entries)


def character_summary_sources(question: str, entries: list[dict[str, Any]]) -> list[str]:
    _answer, ids = build_gathered_answer(question, entries)
    return ids
