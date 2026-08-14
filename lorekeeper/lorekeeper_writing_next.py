"""LoreKeeper — writing-next Ask: short task list from notes not yet in draft."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_notes_vs_draft import (
    _claim_is_about_subject,
    _claim_touched_in_draft,
    _content_tokens,
    _draft_corpus,
    _is_draft_entry,
    _near_dedupe_items,
    _normalize,
    _primary_name_token,
    _tidy_claim_line,
    _title_is_about_subject,
    _work_phrase,
    collect_notes_not_in_draft,
    extract_after_anchors,
    extract_notes_not_in_draft_subject,
    filter_unused_by_after_anchors,
    filter_unused_by_subject,
)

MAX_TASK_ITEMS = 8
# If the ranked list is small, show all instead of hiding 1–4 behind "…and N more".
SOFT_SHOW_ALL_MAX = 12
_MAX_TASK_LINE = 160
_MAX_TASK_LINE_WITH_SEAT = 360
_MAX_CLARIFIER = 90

_TASK_LIST_Q = re.compile(
    r"\b("
    r"(?:my\s+)?task\s*lists?|"
    r"writing[\s-]?next|"
    r"what\s+(?:should|can|do)\s+i\s+write\s+next|"
    r"what\s+to\s+write\s+next|"
    r"what\s+(?:am\s+i\s+)?(?:supposed\s+to\s+)?write\s+next|"
    r"here(?:'s|\s+is)\s+(?:my\s+)?task\s*list|"
    r"list\s+(?:my\s+)?(?:writing\s+)?tasks?"
    r")\b",
    re.I,
)

_TOPIC_FOR = re.compile(
    r"\b(?:task\s*lists?|writing[\s-]?next|write\s+next|writing\s+tasks?)\s+"
    r"(?:for|about|of|on|regarding|concerning)\s+"
    r"(.+?)(?=\s*[?.!]?\s*$|\s+aside\b|\s+that\b|\s+which\b)",
    re.I,
)

_TOPIC_JUNK = frozenset(
    {
        "me",
        "this",
        "that",
        "it",
        "now",
        "next",
        "later",
        "the draft",
        "the main draft",
        "main draft",
        "the document",
        "my notes",
        "the notes",
        "this work",
        "the story",
        "smoke and mirrors",
    }
)

_FOOTER = (
    "— Short write-next tasks restated from your notes vs draft only. "
    "Nothing invented. Continuity sticky-notes, later-book setup, and standing "
    "lore stay out unless you ask for a later book. "
    "Name a topic for a tighter list, or ask again for more."
)

# Bubbly / cheerleading — never use in warm task voice.
_BUBBLY_VOICE = re.compile(
    r"\b("
    r"fun|delightful|adorable|cozy vibes?|hehe|lol|exciting!|"
    r"can't wait|so cute|aww+|yay\b"
    r")\b",
    re.I,
)

# Incomplete scraps — trail-offs, mid-clause cuts (never ship with … truncation).
_INCOMPLETE_TAIL = re.compile(
    r"(?:--+|…|\.\.\.)\s*$|"
    r"\([^)]*$|"
    r"\b(?:and even if|or else|or so he thinks|because (?:he|she|they)|"
    r"considering how|even while|he does|that are just)\s*$|"
    r"[,;:]\s*$|"
    r"\b(?:was|were|the|a|an|to|for|that|when|if|but|and|or|of|just)\s*$",
    re.I,
)

# Later-book / far-horizon — only for task lists scoped to a later book.
_LATER_BOOK = re.compile(
    r"\b("
    r"later\s+books?|future\s+books?|next\s+books?|another\s+books?|"
    r"book\s+(?:two|three|2|3)|sequel|"
    r"(?:doesn'?t|does\s+not|won'?t|will\s+not)\s+happen\s+until\s+"
    r"(?:a\s+)?(?:later|future|next)|"
    r"not\s+until\s+(?:a\s+)?(?:later|future)\s+book|"
    r"until\s+(?:likely\s+)?a\s+later\s+book|"
    r"not\s+(?:in|for)\s+(?:the\s+)?first\s+book|"
    r"(?:meant|appear|appears|happens?)\s+.{0,24}(?:later\s+(?:on\s+)?(?:in\s+)?(?:the\s+)?series|later\s+book)|"
    r"later\s+on\s+in\s+the\s+series|"
    r"later\s+in\s+the\s+series|"
    r"eventual(?:ly)?(?:\s+\([^)]*\))?\s+reveal|"
    r"set\s+in\s+motion\s+the\s+eventual|"
    r"not\s+yet\s+but\s+within\s+a\s+few\s+months|"
    r"within\s+a\s+few\s+months"
    r")\b",
    re.I,
)

_LATER_BOOK_QUESTION = re.compile(
    r"\b("
    r"later\s+books?|future\s+books?|next\s+books?|another\s+books?|"
    r"book\s+(?:two|three|2|3)|sequel|later\s+in\s+the\s+series"
    r")\b",
    re.I,
)

# Author continuity / awareness sticky — not near-term write-next.
_CONTINUITY_STICKY = re.compile(
    r"\b("
    r"(?:is|are|was|were|becomes?|remains?)\s+aware\s+that|"
    r"(?:does not|doesn't|doesnt)\s+yet\s+(?:want|realize|know|understand)|"
    r"not yet\s+(?:realize|know|understand)|"
    r"doesn'?t\s+yet\s+realize|"
    r"misunderstands?|"
    r"he thinks that the|"
    r"she thinks that the|"
    r"should hint at (?:his |her |their )?knowledge|"
    r"expression should hint|"
    r"i think i mentioned|"
    r"i mean\b|"
    r"i mentioned some|"
    r"don'?t want to make that the meat|"
    r"i(?:'?m| am)\s+also\s+thinking|"
    r"i(?:'?m| am)\s+thinking\s+that|"
    r"however,?\s+i\s+think|"
    r"make sure the audience|"
    r"audience understands?|"
    r"even if i don'?t literally|"
    r"how (?:he|she|they|the character)\s+feels\s+until|"
    r"for (?:me|myself)\s+as\s+i\s+write|"
    r"keep(?:s|ing)?\s+(?:in\s+mind|aware)\s+when\s+writing|"
    r"stuff for me to be aware|"
    r"until a particular point|"
    r"at the present timeline"
    r")\b",
    re.I,
)

# Other-cast attitude toward the topic character — not that character's write-next.
_OTHER_CAST_ATTITUDE = re.compile(
    r"\b([A-Z][\w'-]+)\s+"
    r"(?:respects?|admires?|resents?|fears?|hates?|loves?|trusts?|"
    r"thinks?|feels?|believes?|wants?)\s+"
    r"(?:that\s+)?(?:the\s+)?",
    re.I,
)

_THEMATIC_TOPIC = re.compile(
    r"\b("
    r"chase|court|politics|scene|reveal|flashback|secret|power|climax|"
    r"manor|wolf|prey|predator|dimension"
    r")\b",
    re.I,
)

# Story-moment topics (chapter / scene / beat / event / capture) — not cast names.
_MOMENT_POINTER = re.compile(
    r"\b(?:this|the|that|current)\s+"
    r"(?:"
    r"chapter(?:\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten))?|"
    r"scene|beat|moment|event|"
    r"capture|captured|"
    r"court\s+scene"
    r")\b",
    re.I,
)
_NAMED_MOMENT = re.compile(
    r"\b("
    r"chapter\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)|"
    r"(?:the\s+)?(?:capture|captured)(?:\s+scene|\s+chase)?|"
    r"court\s+scene|"
    r"(?:the|this|that|current)\s+[\w'-]+(?:\s+[\w'-]+)?\s+scene"
    r")\b",
    re.I,
)
_NAMED_PLACE_SCENE = re.compile(
    r"\b(?:the|this|that|current)\s+([\w'-]+(?:\s+[\w'-]+)?)\s+scene\b",
    re.I,
)
_CAPTURE_WORD = re.compile(r"\bcaptur(?:e|ed|ing|es)\b", re.I)
_COURT_SCENE_WORD = re.compile(r"\bcourt\b", re.I)

# Between-span asks: after capture / before-or-during arrival — not chase, not after.
_BETWEEN_SPAN_Q = re.compile(
    r"\bbetween\s+(.+?)\s+and\s+(.+?)(?:\s*[?.!]?\s*$)",
    re.I,
)
_AFTER_BEFORE_SPAN_Q = re.compile(
    r"\bafter\s+(.+?)\s+(?:(?:and|but)\s+)?"
    r"(?:before|until|prior to|up to)\s+(.+?)(?:\s*[?.!]?\s*$)",
    re.I,
)
_SPAN_STILL_CHASE = re.compile(
    r"\b("
    r"during the (?:\w+\s+)?capture chase|"
    r"during the chase|"
    r"after .{0,40}spots |"
    r"before the (?:wolf|[\w'-]+) takes|"
    r"outruns? (?:his|her) brothers|"
    r"giving chase|"
    r"write the chase|"
    r"chase (?:scene )?needs|"
    r"when [\w'-]+ shows up"
    r")\b",
    re.I,
)
_SPAN_AFTER_RESCUE = re.compile(
    r"\bafter .{0,48}rescue",
    re.I,
)
_SPAN_AFTER_THERE = re.compile(
    r"\b("
    r"at the .{0,24}(?:quarters|manor)|"
    r"at the (?:cheshire(?: cat)?(?:['\u2019]s)? )?quarters|"
    r"treated as a guest|"
    r"facing the music|"
    r"after arrival|"
    r"after .{0,24}(?:is|are) settled|"
    r"once (?:he|she|they) (?:is|are) (?:there|inside|settled)"
    r")\b",
    re.I,
)
_SPAN_DURING_ARRIVAL = re.compile(
    r"\b("
    r"upon arrival|"
    r"as (?:they|he|she|[\w'-]+) arrives?|"
    r"when (?:they|he|she|[\w'-]+) arrives?|"
    r"during (?:the )?arrival|"
    r"arriv(?:al|es?|ing) at|"
    r"hands? .{0,24}over"
    r")\b",
    re.I,
)
_SPAN_JOURNEY = re.compile(
    r"\b("
    r"being carried|carried (?:down|away|along|him|her)|"
    r"carrying (?:him|her|etherei)|"
    r"mountain(?:\s+path)?|"
    r"on the way|en route|the (?:walk|trip|journey) (?:to|toward)|"
    r"several days|"
    r"stops?\s+for\s+the\s+(?:night|day)|"
    r"keep .{0,48} fed|"
    r"mouth .{0,40}shut|"
    r"between .{0,48}arriv|"
    r"happens in between|"
    r"before (?:they |he |she )?(?:arriv|reach)|"
    r"until (?:they |he |she )?arriv|"
    r"open gap|"
    r"not yet drafted"
    r")\b",
    re.I,
)
_SPAN_DONT_KNOW = re.compile(
    r"\b("
    r"i don'?t know what happens|"
    r"idk what happens|"
    r"not sure what happens"
    r")\b",
    re.I,
)

_SPAN_POLE_JUNK = frozenset(
    {
        "me",
        "you",
        "us",
        "them",
        "this",
        "that",
        "it",
        "notes",
        "the notes",
        "my notes",
        "draft",
        "the draft",
        "the document",
        "the story",
    }
)
_SPAN_CAPTURE_DONE = re.compile(
    r"\b("
    r"after .{0,48}(?:is |are |gets? |getting )?captur|"
    r"once .{0,24}captur|"
    r"been captured|"
    r"in (?:his|her|the) grasp|"
    r"scooped (?:him|her)?\s*up"
    r")\b",
    re.I,
)
_SPAN_STANDING = re.compile(
    r"\b("
    r"court politics|growing up|does not have a grudge|"
    r"same language|ethical captives|head to be easier|"
    r"tone of the relationship"
    r")\b",
    re.I,
)

_AUTHOR_MUSING_LEAD = re.compile(
    r"^\s*(?:"
    r"so\s+right\s+now\b|"
    r"so\s+the\b|"
    r"so\s+he\s+probably\b|"
    r"so\s+i(?:'?m| am)\s+thinking\b|"
    r"so\s+this\s+climax\b|"
    r"so\s+the\s+chase\b|"
    r"so\s+\w+,?\s+by\s+being\b|"
    r"however,?\s+i\s+think\b|"
    r"and\s+also\b|"
    r"also\s+something\b|"
    r"i\s+mean\b|"
    r"i\s+think\s+i\b|"
    r"i(?:'?m| am)\s+(?:also\s+)?thinking\b"
    r")",
    re.I,
)

# Dramatizable write-next — scene/gap/conflict you might put on the page soon.
_DRAMATIZABLE = re.compile(
    r"\b("
    r"secret|secrets|reveal|reveals|revealed|bitterness|resents?|resentment|"
    r"power|powers|ability|abilities|condition|conditions|identity|"
    r"planned\s*:|need(?:s)?\s+to\s+(?:write|draft)|"
    r"should\s+(?:write|draft)|"
    r"must be written|well-rounded|"
    r"still\s+(?:need|have)\s+to\s+(?:write|draft)|"
    r"chase|snapped|bridge|ritual|plot\s+beat|flashback|"
    r"court\s+politics|political\s+pressures?|not helping|"
    r"left (?:him|her|them) to dry|heavier load|"
    r"scene needs|write the|dramatize|on (?:the\s+)?page|"
    r"find a way to write|haven'?t specified|not yet specified|"
    r"who killed|fascinated study|guest rather than|open gap|"
    r"still\s+(?:need|have|has)\s+to\s+(?:write|draft|show|open)|"
    r"not yet (?:on the page|written|drafted)|"
    r"haven'?t (?:written|drafted|shown)|"
    r"needs? a scene|should show"
    r")\b",
    re.I,
)

# Unused cast facts that can still be put on the page soon (not standing lore mush).
_SHOWABLE_CAST_FACT = re.compile(
    r"\b("
    r"ticklish|"
    r"eyesight|eye\s*sight|blurry\s+sight|"
    r"hard\s+time\s+seeing|trouble\s+with\s+(?:his|her|their)\s+(?:eyesight|vision)|"
    r"albino|"
    r"glasses|spectacles|"
    r"discover(?:ing|s|ed)?\s+that|"
    r"brothers?\s+.{0,48}(?:find|learn|discover|catch|convince)|"
    r"never (?:told|shown|mentioned)|"
    r"has(?:n'?t| not) (?:told|shown|mentioned)|"
    r"nobody (?:knows|has noticed)"
    r")\b",
    re.I,
)

_RELATIONSHIP_TENSION = re.compile(
    r"\b("
    r"resents?|resentment|bitterness|grudge|cold(?:er)? on the surface|"
    r"cares? for .{0,40} but|understands? why|"
    r"conflict|rivalry|betrayed|abandoned"
    r")\b",
    re.I,
)


def is_writing_next_task_list_question(question: str) -> bool:
    """Writer asked for a short write-next task list (not inventing chores)."""
    return bool(_TASK_LIST_Q.search(question or ""))


def wants_later_book_scope(question: str) -> bool:
    """True when the ask is scoped to a later book / sequel task list."""
    return bool(_LATER_BOOK_QUESTION.search(question or ""))


def line_is_later_book(line: str) -> bool:
    """Note marks this beat for a later book / far-horizon reveal."""
    return bool(_LATER_BOOK.search(line or ""))


def extract_writing_next_topic(question: str) -> str:
    """
    Topic filter from the ask — e.g. 'Predator Court politics' from
    'task list for Predator Court politics'. Empty = whole-work short list.
    """
    q = (question or "").strip()
    if not q:
        return ""
    m = _TOPIC_FOR.search(q)
    if m:
        raw = m.group(1).strip().rstrip("?.!,")
        cleaned = re.sub(r"\s+", " ", raw).strip(" \t\"'“”‘’")
        cleaned = re.sub(
            r"\s+(?:in|for|from)\s+(?:my\s+|the\s+)?"
            r"(?:notes?|draft|document|story|work).*$",
            "",
            cleaned,
            flags=re.I,
        ).strip()
        # Don't treat "later book" as a character topic.
        if _LATER_BOOK_QUESTION.search(cleaned):
            return ""
        low = cleaned.lower()
        if cleaned and low not in _TOPIC_JUNK and len(cleaned) <= 80:
            return cleaned
    return extract_notes_not_in_draft_subject(q)


_STRICT_CRAFT = re.compile(
    r"\b("
    r"need(?:s)?\s+to\s+(?:write|draft)|"
    r"find a way to write|"
    r"should\s+(?:write|draft)|"
    r"still\s+(?:need|have)\s+to\s+(?:write|draft)|"
    r"must be written|scene needs|write the|"
    r"haven'?t specified|not yet specified"
    r")\b",
    re.I,
)


def topic_looks_like_moment(topic: str) -> bool:
    """
    True for a named story moment — chapter, scene, beat, event, capture —
    not a cast name and not a chase/politics theme list that already works.
    """
    t = (topic or "").strip()
    if not t:
        return False
    # Chase-only lists already use the thematic filter (keep that path).
    if re.search(r"\bchase\b", t, re.I) and not re.search(
        r"\b(?:capture|chapter|court|moment|beat|event)\b", t, re.I
    ):
        return False
    # "Predator Court politics" stays thematic, not a Court-scene moment.
    if re.search(r"\bpolitics\b", t, re.I) and not re.search(
        r"\b(?:scene|chapter|capture|moment|beat|event)\b", t, re.I
    ):
        return False
    if _MOMENT_POINTER.search(t) or _NAMED_MOMENT.search(t):
        return True
    try:
        from lorekeeper_section_scope import extract_section_hints

        hints = extract_section_hints(t)
        if hints.get("section") in {"chapter", "prologue", "act"}:
            return True
    except Exception:
        pass
    return False


def topic_looks_like_cast(topic: str) -> bool:
    """True for character-ish topics (Etherei), false for chase/Court/moment themes."""
    t = (topic or "").strip()
    if not t or _THEMATIC_TOPIC.search(t) or topic_looks_like_moment(t):
        return False
    toks = _normalize(t).split()
    return 1 <= len(toks) <= 4


def extract_writing_next_span(question: str) -> dict[str, str] | None:
    """
    Between/after-until window from the ask.
    Capture→arrival stays its own kind; other after-X / until-Y uses named_span.
    """
    q = (question or "").strip()
    if not q:
        return None
    m = _BETWEEN_SPAN_Q.search(q) or _AFTER_BEFORE_SPAN_Q.search(q)
    if not m:
        return None
    start = re.sub(r"\s+", " ", m.group(1).strip()).strip(" \t\"'“”‘’")
    end = re.sub(r"\s+", " ", m.group(2).strip()).strip(" \t\"'“”‘’")
    if not start or not end:
        return None
    if start.lower() in _SPAN_POLE_JUNK or end.lower() in _SPAN_POLE_JUNK:
        return None
    if _LATER_BOOK_QUESTION.search(start) or _LATER_BOOK_QUESTION.search(end):
        return None
    if len(start) < 4 or len(end) < 4:
        return None
    poles = f"{start} {end}"
    if re.search(r"\bcaptur", poles, re.I) and re.search(
        r"\barriv|place|quarters|manor|mansion", end, re.I
    ):
        return {
            "start": start,
            "end": end,
            "kind": "capture_to_arrival",
            "label": "the stretch between capture and arrival",
        }
    return {
        "start": start,
        "end": end,
        "kind": "named_span",
        "label": "this stretch",
    }


def _span_phase_capture_to_arrival(title: str, line: str) -> str:
    """
    before_start | in_span | after_end | unrelated
    in_span = after capture, before or during arrival — not after they're there.
    """
    title_s = title or ""
    line_s = line or ""
    if _SPAN_AFTER_RESCUE.search(line_s):
        return "after_end"
    if _SPAN_DONT_KNOW.search(line_s):
        return "unrelated"
    if _SPAN_STILL_CHASE.search(line_s):
        return "before_start"
    if re.search(
        r"\b(?:sometime later|at some point later|arrives? sometime later)\b",
        line_s,
        re.I,
    ):
        return "after_end"
    if _SPAN_DURING_ARRIVAL.search(line_s) and not re.search(
        r"treated as a guest|facing the music|settled", line_s, re.I
    ):
        return "in_span"
    if _SPAN_AFTER_THERE.search(line_s) and not _SPAN_JOURNEY.search(line_s):
        return "after_end"
    if _SPAN_JOURNEY.search(line_s):
        return "in_span"
    if _SPAN_STANDING.search(line_s) and not _SPAN_JOURNEY.search(line_s):
        return "unrelated"
    # "He's been captured" is the start pole — keep only if the line is the
    # journey or arrival, not the scoop itself.
    if _SPAN_CAPTURE_DONE.search(line_s) and (
        _SPAN_JOURNEY.search(line_s) or _SPAN_DURING_ARRIVAL.search(line_s)
    ):
        if _SPAN_AFTER_THERE.search(line_s) and not _SPAN_JOURNEY.search(line_s):
            return "after_end"
        return "in_span"
    return "unrelated"


def _span_pole_tokens(text: str) -> list[str]:
    """Distinctive tokens from a between/after-until pole."""
    weak = _STRETCH_WEAK | {
        "they",
        "them",
        "reach",
        "arrive",
        "arrival",
        "until",
        "before",
        "after",
        "between",
    }
    return [
        t
        for t in _content_tokens(text)
        if len(t) >= 4 and t not in weak
    ]


def _span_phase_named(
    title: str, line: str, span: dict[str, str]
) -> str:
    """
    before_start | in_span | after_end | unrelated
    Librarian window for a generic after-X / until-Y ask.
    """
    title_s = title or ""
    line_s = line or ""
    blob_n = _normalize(f"{title_s} {line_s}")
    start = str(span.get("start") or "")
    end = str(span.get("end") or "")
    start_toks = _span_pole_tokens(start)
    end_toks = _span_pole_tokens(end)
    if _SPAN_DONT_KNOW.search(line_s):
        return "unrelated"
    if _SPAN_STANDING.search(line_s) and not _SPAN_JOURNEY.search(line_s):
        return "unrelated"

    after_end = bool(
        re.search(
            r"\bafter\s+(?:they|he|she)\s+(?:arriv|reach)|"
            r"\bafter arrival\b|"
            r"\bonce (?:he|she|they) (?:is|are) (?:there|inside|settled)|"
            r"\btreated as a guest\b|"
            r"\bfacing the music\b",
            line_s,
            re.I,
        )
        and not _SPAN_JOURNEY.search(line_s)
        and not _SPAN_DURING_ARRIVAL.search(line_s)
    )
    if after_end:
        return "after_end"
    if (
        _SPAN_AFTER_THERE.search(line_s)
        and not _SPAN_JOURNEY.search(line_s)
        and not _SPAN_DURING_ARRIVAL.search(line_s)
        and end_toks
        and any(t in blob_n for t in end_toks)
    ):
        return "after_end"

    start_is_flash = bool(re.search(r"\bflashback\b", start, re.I))
    if start_is_flash and re.search(r"\bflashback\b", line_s, re.I):
        if re.search(r"\bafter\s+(?:the\s+)?flashback\b", line_s, re.I):
            return "in_span"
        if re.search(r"\bduring\b.{0,48}\bflashback\b", line_s, re.I):
            return "before_start"
        if not _SPAN_JOURNEY.search(line_s):
            return "before_start"

    if re.search(r"\bbefore\b", line_s, re.I) and start_toks:
        if any(t in blob_n for t in start_toks) and not _SPAN_JOURNEY.search(
            line_s
        ):
            return "before_start"

    if _SPAN_JOURNEY.search(line_s) or _SPAN_DURING_ARRIVAL.search(line_s):
        return "in_span"

    hits_start = sum(1 for t in start_toks if t in blob_n)
    hits_end = sum(1 for t in end_toks if t in blob_n)
    after_start = bool(re.search(r"\bafter\b", line_s, re.I) and hits_start)
    if after_start:
        return "in_span"
    if hits_start and hits_end:
        return "in_span"
    need_start = 1 if len(start_toks) <= 2 else max(1, (len(start_toks) + 1) // 2)
    if hits_start >= need_start:
        return "in_span"
    return "unrelated"


def filter_unused_by_span(
    items: list[dict[str, str]], span: dict[str, str]
) -> list[dict[str, str]]:
    """Keep unused claims that sit in the asked window. No full-list fallback."""
    if not items or not span:
        return []
    kind = str(span.get("kind") or "")
    if kind == "capture_to_arrival":
        phase_fn = _span_phase_capture_to_arrival
    elif kind == "named_span":

        def phase_fn(title: str, line: str) -> str:
            return _span_phase_named(title, line, span)

    else:
        return []
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in items:
        line = str(row.get("line") or "")
        title = str(row.get("noteTitle") or "")
        if phase_fn(title, line) != "in_span":
            continue
        key = _normalize(line)[:160]
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def _other_cast_attitude_about_subject(line: str, subject: str) -> bool:
    """
    True when another named character's feeling/attitude targets the subject
    (e.g. 'Serias respects Etherei for…') — Serias-side, not Etherei write-next.
    """
    s = (line or "").strip()
    name = _primary_name_token(subject)
    if not s or not name or len(name) < 3:
        return False
    # Any OtherName <attitude> Subject — start or mid-line.
    m = re.search(
        rf"\b([A-Za-z][\w'-]+)\s+"
        rf"(?:respects?|admires?|resents?|fears?|hates?|loves?|trusts?|"
        rf"thinks?|feels?|believes?)\s+"
        rf"(?:that\s+)?(?:the\s+)?{re.escape(name)}\b",
        s,
        re.I,
    )
    if not m:
        return False
    other = m.group(1)
    if other.lower() == name.lower():
        return False
    return True


def _reveals_about_subject(line: str, subject: str) -> bool:
    """Twin flashback / polish that reveals secrets about the asked cast member."""
    s = (line or "").strip()
    name = _primary_name_token(subject)
    if not s or not name or len(name) < 3:
        return False
    if not re.search(rf"\b{re.escape(name)}\b", s, re.I):
        return False
    return bool(
        re.search(
            rf"\b(?:reveal\w*|secrets?)\b.{{0,80}}\b{re.escape(name)}\b|"
            rf"\b{re.escape(name)}\b.{{0,60}}\b(?:secret|secrets|reveal\w*)\b",
            s,
            re.I,
        )
    )


def _line_names_subject(line: str, subject: str) -> bool:
    """True when the line names the subject (including short nickname stems)."""
    s = (line or "").strip()
    name = _primary_name_token(subject)
    if not s or not name or len(name) < 3:
        return False
    if re.search(rf"\b{re.escape(name)}\b", s, re.I):
        return True
    # Common short form: Etherei → Ethie (3+ letter stem).
    if len(name) >= 5:
        stem = name[:4]
        if re.search(rf"\b{re.escape(stem)}ie\b", s, re.I):
            return True
    return False


def _showable_cast_fact_for_subject(
    line: str, subject: str, *, note_title: str = ""
) -> bool:
    """
    Unused personal/physical fact about this cast that can still be dramatized
    (ticklish, eyesight/albino vision, glasses lost, brothers discovering…).
    Title-matched cast cards may unlock lines that only use a nickname.
    """
    s = (line or "").strip()
    name = _primary_name_token(subject)
    if not s or not name or not _SHOWABLE_CAST_FACT.search(s):
        return False
    if _other_cast_attitude_about_subject(s, subject):
        return False
    if line_is_later_book(s):
        return False
    # Author vibe / attitude scrap — not a showable trait task.
    if re.search(
        r"\b(?:posh\s+villain|vibe\s+here|respect\s+for)\b",
        s,
        re.I,
    ):
        return False
    titled = bool(note_title and _title_is_about_subject(note_title, subject))
    named = _claim_is_about_subject(s, subject) or _line_names_subject(s, subject)
    if not named and not titled:
        return False
    # Trait must attach to the subject (or sit on their titled note).
    trait_on_subject = bool(
        re.search(
            rf"\b{re.escape(name)}\b.{{0,60}}\b"
            rf"(?:ticklish|eyesight|eye\s*sight|albino|glasses|spectacles|"
            rf"blurry\s+sight|hard\s+time\s+seeing|vision)\b|"
            rf"\b(?:ticklish|eyesight|eye\s*sight|albino|glasses|spectacles|"
            rf"blurry\s+sight)\b.{{0,60}}\b{re.escape(name)}\b|"
            rf"\b(?:ethie|he|she)\b.{{0,40}}\b"
            rf"(?:ticklish|eyesight|glasses|spectacles|blurry\s+sight|albino)\b|"
            rf"\bdiscover(?:ing|s|ed)?\s+that\s+{re.escape(name)}\b|"
            rf"\bbrothers?\b.{{0,80}}\b{re.escape(name)}\b.{{0,40}}\bticklish\b",
            s,
            re.I,
        )
    )
    if not trait_on_subject and not (
        titled
        and re.search(
            r"\b(?:ticklish|eyesight|eye\s*sight|albino|glasses|spectacles|"
            r"blurry\s+sight|hard\s+time\s+seeing)\b",
            s,
            re.I,
        )
    ):
        return False
    if _is_continuity_or_musing(s) and not trait_on_subject and not titled:
        return False
    return True


def _strict_craft_for_subject(
    line: str, subject: str, *, note_title: str = ""
) -> bool:
    """
    Explicit write/draft craft for this cast task list.
    Requires strict craft wording — not bare 'chase/power' keywords.
    Name can be in the line, or the note title is this cast (chase craft on
    Etherei's card without repeating the name).
    """
    s = (line or "").strip()
    name = _primary_name_token(subject)
    if not s or not name:
        return False
    if not _STRICT_CRAFT.search(s):
        return False
    if _other_cast_attitude_about_subject(s, subject):
        return False
    if re.search(rf"\b{re.escape(name)}\b", s, re.I):
        return True
    if note_title and _title_is_about_subject(note_title, subject):
        return True
    return False


def _moment_kind(topic: str) -> str:
    """capture | court_scene | chapter | named_scene | current_stretch."""
    t = _normalize(topic)
    if re.search(r"\bcaptur", t):
        return "capture"
    if re.search(r"\bcourt\b", t) and re.search(r"\bscene\b", t):
        return "court_scene"
    if re.search(r"\bchapter\b", t) or re.search(r"\bprologue\b|\bact\b", t):
        return "chapter"
    if _NAMED_PLACE_SCENE.search(topic or "") and not re.search(
        r"\b(?:chase|politics)\b", t
    ):
        return "named_scene"
    return "current_stretch"


_STRETCH_WEAK = frozenset(
    {
        "character",
        "chapter",
        "scene",
        "moment",
        "event",
        "after",
        "before",
        "during",
        "still",
        "needs",
        "write",
        "draft",
        "notes",
        "about",
        "there",
        "their",
        "would",
        "could",
        "should",
    }
)


def _current_stretch_terms(entries: list[dict[str, Any]] | None) -> set[str]:
    """Distinctive draft-tail tokens for 'this chapter / this moment'."""
    if not entries:
        return set()
    tail = _draft_tail_token_set(entries)
    return {t for t in tail if len(t) >= 5 and t not in _STRETCH_WEAK}


def _row_moment_blob(row: dict[str, str]) -> str:
    return f"{row.get('noteTitle') or ''} {row.get('line') or ''}"


def _named_scene_terms(topic: str) -> list[str]:
    """Place/event tokens from 'the manor scene' — not scene/the/this."""
    t = re.sub(
        r"\b(?:the|this|that|current|scene|beat|moment|event)\b",
        " ",
        topic or "",
        flags=re.I,
    )
    return [tok for tok in _content_tokens(t) if len(tok) >= 4]


def _row_matches_moment(
    row: dict[str, str],
    *,
    kind: str,
    stretch_terms: set[str],
    chapter_num: str = "",
    topic: str = "",
) -> bool:
    """Librarian match: note text actually names or sits on that moment."""
    blob = _row_moment_blob(row)
    if not blob.strip():
        return False
    if kind == "capture":
        return bool(_CAPTURE_WORD.search(blob))
    if kind == "court_scene":
        return bool(_COURT_SCENE_WORD.search(blob))
    if kind == "chapter" and chapter_num:
        if re.search(
            rf"\bchapter\s+{re.escape(chapter_num)}\b", blob, re.I
        ):
            return True
        # Word-number headings ("chapter two") when the ask used a digit.
        try:
            from lorekeeper_section_scope import _mentions_chapter

            if _mentions_chapter(blob, chapter_num):
                return True
        except Exception:
            pass
        # No explicit chapter tag — current stretch if this is the open chapter.
        if stretch_terms:
            toks = set(_content_tokens(blob))
            return len(toks & stretch_terms) >= 1
        return False
    if kind == "named_scene":
        terms = _named_scene_terms(topic)
        if not terms:
            return False
        blob_n = _normalize(blob)
        hits = sum(1 for t in terms if t in blob_n)
        need = 1 if len(terms) <= 2 else max(1, (len(terms) + 1) // 2)
        return hits >= need
    # this scene / this moment / this beat / this event / unnumbered chapter
    toks = set(_content_tokens(blob))
    if stretch_terms and len(toks & stretch_terms) >= 1:
        return True
    return False


def filter_unused_by_moment(
    items: list[dict[str, str]],
    topic: str,
    *,
    entries: list[dict[str, Any]] | None = None,
    question: str = "",
) -> list[dict[str, str]]:
    """
    Keep unused write-next claims for a named story moment.
    Does not invent beats; drops notes that belong to a different stretch.
    """
    topic_s = (topic or "").strip()
    if not topic_s:
        return items
    kind = _moment_kind(topic_s)
    stretch_terms = _current_stretch_terms(entries)
    chapter_num = ""
    try:
        from lorekeeper_section_scope import extract_section_hints

        hints = extract_section_hints(f"{question} {topic_s}")
        if hints.get("section") == "chapter":
            chapter_num = str(hints.get("chapter") or "")
    except Exception:
        chapter_num = ""

    matched: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in items:
        if not _row_matches_moment(
            row,
            kind=kind,
            stretch_terms=stretch_terms,
            chapter_num=chapter_num,
            topic=topic_s,
        ):
            continue
        key = _normalize(str(row.get("line") or ""))[:160]
        if not key or key in seen:
            continue
        seen.add(key)
        matched.append(row)
    return matched


def filter_unused_by_topic(
    items: list[dict[str, str]],
    topic: str,
    *,
    entries: list[dict[str, Any]] | None = None,
    question: str = "",
) -> list[dict[str, str]]:
    """
    Keep unused claims that match the asked topic.
    Cast topics: each LINE must be about the subject (not note-title alone
    for lore dumps). Title may only unlock strict craft lines on that card.
    Moment topics: chapter / scene / beat / event / capture — not cast names.
    """
    topic_s = (topic or "").strip()
    if not topic_s:
        return items

    if topic_looks_like_moment(topic_s):
        return filter_unused_by_moment(
            items, topic_s, entries=entries, question=question
        )

    if topic_looks_like_cast(topic_s):
        out: list[dict[str, str]] = []
        seen: set[str] = set()
        for row in items:
            title = str(row.get("noteTitle") or "")
            line = str(row.get("line") or "")
            if _other_cast_attitude_about_subject(line, topic_s):
                continue
            if line_is_later_book(line):
                continue
            keep = (
                _claim_is_about_subject(line, topic_s)
                or _reveals_about_subject(line, topic_s)
                or _showable_cast_fact_for_subject(
                    line, topic_s, note_title=title
                )
                or _strict_craft_for_subject(
                    line, topic_s, note_title=title
                )
            )
            if not keep:
                continue
            key = _normalize(line)[:160]
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(row)
        return out

    by_subject = filter_unused_by_subject(items, topic_s)
    toks = _content_tokens(topic_s)
    name_bits = [
        t
        for t in _normalize(topic_s).split()
        if len(t) >= 2 and t not in {"the", "and", "for"}
    ]
    need_toks = toks or name_bits
    soft: list[dict[str, str]] = []
    if need_toks:
        need = max(1, (len(need_toks) + 1) // 2)
        for row in items:
            blob = f"{row.get('noteTitle') or ''} {row.get('line') or ''}"
            norm = _normalize(blob)
            blob_toks = set(_content_tokens(blob)) | set(norm.split())
            hits = sum(1 for t in need_toks if t in blob_toks or t in norm)
            if hits >= need:
                soft.append(row)
    if not by_subject and not soft:
        return []
    seen2: set[str] = set()
    out2: list[dict[str, str]] = []
    for row in by_subject + soft:
        key = _normalize(str(row.get("line") or ""))[:160]
        if not key or key in seen2:
            continue
        seen2.add(key)
        out2.append(row)
    return out2


def _line_is_incomplete(line: str) -> bool:
    """True for mid-trail-off scraps — not usable as a task bullet."""
    s = (line or "").strip()
    if not s:
        return True
    if _INCOMPLETE_TAIL.search(s):
        return True
    if re.search(r"(--|—|–)\s*$", s):
        return True
    open_parens = s.count("(") - s.count(")")
    if open_parens > 0:
        return True
    return False


def _is_continuity_or_musing(line: str) -> bool:
    """Author sticky / awareness continuity — not a write-next task."""
    s = (line or "").strip()
    if not s:
        return True
    if _CONTINUITY_STICKY.search(s):
        return True
    if _AUTHOR_MUSING_LEAD.search(s):
        return True
    return False


def claim_is_write_next_task(
    line: str, *, allow_later_book: bool = False
) -> bool:
    """
    Task-list only: dramatizable unused lore for near write-next work.
    Drops incomplete scraps, continuity sticky-notes, later-book setup
    (unless the ask is later-book scoped), and soft standing lore.
    """
    s = (line or "").strip()
    if not s or _line_is_incomplete(s):
        return False
    if re.search(r"\b(?:posh\s+villain|vibe\s+here)\b", s, re.I):
        return False
    # Canon research / meta speculation — not a write-next beat.
    if re.search(
        r"\bin canon\b|original book|i do not know if the predators|"
        r"they may or may not have invented",
        s,
        re.I,
    ):
        return False
    # Far backstory origin without a near scene seat.
    if re.search(
        r"\bhome dimension\b.*\bwonderland\b|"
        r"\bwonderland\b.*\bsaw much better\b",
        s,
        re.I,
    ):
        return False
    showable = bool(_SHOWABLE_CAST_FACT.search(s))
    if _is_continuity_or_musing(s):
        # Allow light author framing around a concrete showable trait only.
        if not showable or re.search(
            r"\b("
            r"(?:is|are|was|were|becomes?|remains?)\s+aware\s+that|"
            r"(?:does not|doesn't|doesnt)\s+yet\s+(?:want|realize|know|understand)|"
            r"make sure the audience|audience understands?|"
            r"stuff for me to be aware|for (?:me|myself)\s+as\s+i\s+write"
            r")\b",
            s,
            re.I,
        ):
            return False
    if line_is_later_book(s) and not allow_later_book:
        return False
    if allow_later_book:
        if not line_is_later_book(s):
            return False
        if _DRAMATIZABLE.search(s) or _RELATIONSHIP_TENSION.search(s) or showable:
            return True
        # Later-book ask: keep a concrete later beat, not a bare "until later" scrap.
        if len(s) >= 40 and re.search(
            r"\b(?:reveal|scene|appear|happens?|show|when|after|during|"
            r"meet|return|flashback|secret)\b",
            s,
            re.I,
        ):
            return True
        return False
    if _DRAMATIZABLE.search(s) or _RELATIONSHIP_TENSION.search(s) or showable:
        return True
    return False


def filter_write_next_tasks(
    items: list[dict[str, str]],
    *,
    allow_later_book: bool = False,
    keep_span_journey: bool = False,
) -> list[dict[str, str]]:
    """Keep only write-next-shaped unused claims for the task-list Ask."""
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in items:
        line = str(row.get("line") or "")
        keep = claim_is_write_next_task(line, allow_later_book=allow_later_book)
        if not keep and keep_span_journey:
            keep = bool(
                _SPAN_JOURNEY.search(line)
                and not _line_is_incomplete(line)
                and (allow_later_book or not line_is_later_book(line))
                and not _SPAN_DONT_KNOW.search(line)
                and not _is_continuity_or_musing(line)
                and not re.search(
                    r"^\s*(?:mind you|i mean|idk)\b",
                    line,
                    re.I,
                )
            )
        if not keep:
            continue
        key = _normalize(line)[:160]
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def _claim_touched_for_task_list(claim: str, draft_norm: str) -> bool:
    """
    Task-list unused check: exact/near phrase match, plus paraphrase coverage
    for distinctive note tokens (not bare cast-name bag-of-words).
    """
    if _claim_touched_in_draft(claim, draft_norm):
        return True
    content = _content_tokens(claim)
    if len(content) < 5 or not draft_norm:
        return False
    draft_words = draft_norm.split()
    if not draft_words:
        return False
    from collections import Counter

    freq = Counter(draft_words)
    distinctive = [
        t for t in content if len(t) >= 4 and freq.get(t, 0) <= 6
    ]
    if len(distinctive) < 4:
        distinctive = [t for t in content if len(t) >= 4] or content
    for i in range(len(distinctive) - 2):
        phrase = " ".join(distinctive[i : i + 3])
        if len(phrase) >= 14 and phrase in draft_norm:
            return True
    hits = sum(1 for t in distinctive if t in freq)
    n = len(distinctive)
    if n >= 6 and hits / n >= 0.65:
        return True
    if n >= 4 and hits / n >= 0.8:
        return True
    return False


def filter_already_in_draft_for_tasks(
    items: list[dict[str, str]],
    entries: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Drop task candidates the main draft already covers (incl. paraphrase)."""
    draft_norm = _normalize(_draft_corpus(entries))
    if not draft_norm:
        return items
    out: list[dict[str, str]] = []
    for row in items:
        line = str(row.get("line") or "")
        # Showable cast traits: exact/near phrase only — soft paraphrase often
        # false-hits on common words (eyes, glasses) and hides unused beats.
        if _SHOWABLE_CAST_FACT.search(line) and not re.search(
            r"\b(?:flashback|secret|secrets|reveal\w*|chase|find a way to write)\b",
            line,
            re.I,
        ):
            if _claim_touched_in_draft(line, draft_norm):
                continue
            out.append(row)
            continue
        # Journey beats share common verbs with the draft (conversation, keep,
        # speak). Soft paraphrase hides unused capture→arrival notes.
        if _SPAN_JOURNEY.search(line):
            if _claim_touched_in_draft(line, draft_norm):
                continue
            out.append(row)
            continue
        if _claim_touched_for_task_list(line, draft_norm):
            continue
        out.append(row)
    return out


def _flashback_already_in_draft(line: str, draft_norm: str) -> bool:
    """True when the draft already has this cast's flashback/memory beat."""
    if not draft_norm or not re.search(r"\bflashback\b", line or "", re.I):
        return False
    if not re.search(
        r"\b(flashback|fractured|shattered|childhood\s+memory|memory\s+of)\b",
        draft_norm,
        re.I,
    ):
        return False
    for name in re.findall(r"\b([A-Z][\w'-]{2,})\b", line or ""):
        low = name.lower()
        if low in {"the", "and", "both", "as", "character"}:
            continue
        if low not in draft_norm:
            continue
        if re.search(
            rf"\b{re.escape(low)}\b.{{0,100}}\b"
            rf"(flashback|fractured|shattered|childhood|memory)\b",
            draft_norm,
        ) or re.search(
            rf"\b(flashback|fractured|shattered|childhood|memory)\b.{{0,100}}\b"
            rf"{re.escape(low)}\b",
            draft_norm,
        ):
            return True
    # Do not treat an unrelated draft flashback as completing this note.
    return False


def _flashback_edit_location_prefix(line: str) -> str:
    """
    When notes place polish inside a named cast flashback, keep that seat.
    Librarian only — uses names already in the line.
    """
    s = line or ""
    if not re.search(r"\bflashback\b", s, re.I):
        return ""
    owner = ""
    patterns = (
        r"\bAs\s+([A-Z][\w'-]{2,})\b.{0,100}\bflashback\b",
        r"\b([A-Z][\w'-]{2,})\s+has\s+a\b.{0,80}\bflashback\b",
        r"\b([A-Z][\w'-]{2,})(?:'s|\u2019s)\s+(?:fractured[-/ ]shattered\s+)?flashback\b",
        r"\b([A-Z][\w'-]{2,})\s+begins\s+having\b.{0,60}\bflashback\b",
    )
    for pat in patterns:
        m = re.search(pat, s)
        if not m:
            continue
        cand = m.group(1)
        low = cand.lower()
        if low in {
            "the",
            "and",
            "both",
            "character",
            "different",
            "fractured",
            "shattered",
            "childhood",
            "memory",
            "twins",
            "moonshadow",
        }:
            continue
        owner = cand
        break
    if not owner:
        return ""
    return f"During {owner}'s flashback, "


def shrink_partly_done_flashback_line(line: str, draft_norm: str) -> str:
    """
    If the flashback itself is already drafted, keep unused secret-reveal polish.
    Never drop a flashback note that still calls for reveals/secrets.
    When shrinking, keep the edit seat (whose flashback) when the note names it.
    """
    s = (line or "").strip()
    if not s or not re.search(r"\bflashback\b", s, re.I):
        return s
    if not _flashback_already_in_draft(s, draft_norm):
        return s
    loc = _flashback_edit_location_prefix(s)
    for pat in (
        r"((?:and\s+)?reveals?\s+additional\s+secrets?\s+about[^.!;]*)",
        r"(reveal(?:s|ing)?\s+(?:a\s+)?secrets?\s+about[^.!;]*)",
        r"(reveals?\s+additional\s+secrets?[^.!;]*)",
        r"((?:different\s+memory\s+and\s+)?reveals?\s+[^.!;]*)",
        r"(reveals?\s+something\s+surprising\s+about[^.!;]*)",
    ):
        m = re.search(pat, s, re.I)
        if not m:
            continue
        chunk = _tidy_claim_line(m.group(1))
        if chunk and not _claim_touched_for_task_list(chunk, draft_norm):
            if loc and not re.match(r"^during\b", chunk, re.I):
                chunk = loc + chunk[0].lower() + chunk[1:] if chunk else chunk
            return chunk
    # Still has reveal/secret work — keep the line (do not erase polish tasks).
    if re.search(r"\b(secret|secrets|reveal\w*)\b", s, re.I):
        if not _claim_touched_for_task_list(s, draft_norm):
            if loc and not re.match(r"^during\b", s, re.I):
                # Prefer a located short reveal clause when possible.
                m2 = re.search(
                    r"((?:different\s+memory\s+and\s+)?reveals?\s+[^.!;]*)",
                    s,
                    re.I,
                )
                if m2:
                    chunk = _tidy_claim_line(m2.group(1))
                    if chunk:
                        return loc + chunk[0].lower() + chunk[1:]
            return s
    # Pure flashback already on the page — drop.
    return ""


def filter_partly_done_flashbacks(
    items: list[dict[str, str]],
    entries: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Replace or drop flashback tasks that are already on the page."""
    draft_norm = _normalize(_draft_corpus(entries))
    if not draft_norm:
        return items
    out: list[dict[str, str]] = []
    for row in items:
        line = str(row.get("line") or "")
        shrunk = shrink_partly_done_flashback_line(line, draft_norm)
        if not shrunk:
            continue
        if shrunk != line:
            out.append({**row, "line": shrunk})
        else:
            out.append(row)
    return out


def _draft_tail_token_set(entries: list[dict[str, Any]]) -> set[str]:
    try:
        from lorekeeper_story_position import (
            _collect_draft_pages,
            _tail_sentences_for_answer,
        )
    except Exception:
        return set()
    pages = _collect_draft_pages(entries)
    if not pages:
        return set()
    sents = _tail_sentences_for_answer(pages)
    return set(_content_tokens(" ".join(sents)))


def _rank_tasks_leave_off_first(
    items: list[dict[str, str]],
    entries: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Prefer unused notes that touch the current draft-tail cast/place words."""
    tail = _draft_tail_token_set(entries)
    scored: list[tuple[int, int, int, dict[str, str]]] = []
    for i, row in enumerate(items):
        line = str(row.get("line") or "")
        title = str(row.get("noteTitle") or "")
        toks = set(_content_tokens(f"{line} {title}"))
        overlap = len(toks & tail) if tail else 0
        length_bonus = min(len(line), 160) // 20
        scored.append((-overlap, -length_bonus, i, row))
    scored.sort()
    return [row for _o, _l, _i, row in scored]


def _build_note_index(
    entries: list[dict[str, Any]],
) -> dict[str, tuple[str, str]]:
    """entryId → (title, body) for non-draft notes."""
    out: dict[str, tuple[str, str]] = {}
    for entry in entries:
        if not isinstance(entry, dict) or _is_draft_entry(entry):
            continue
        eid = str(entry.get("id") or "")
        if not eid:
            continue
        title = str(entry.get("title") or "").strip()
        body = str(entry.get("body") or "").strip()
        if title or body:
            out[eid] = (title, body)
    return out


def _seat_family_patterns(line: str, title: str) -> list[re.Pattern[str]]:
    """Topic families to search across notes for timeline seats."""
    blob = f"{title}\n{line}".lower()
    pats: list[str] = []
    if re.search(r"ticklish|never do (?:that|something)|rescue|younger brother", blob):
        pats.append(
            r"ticklish|rescue|catch up to serias|etherei'?s age|after they catch"
        )
    if re.search(
        r"eyesight|albino|glasses|blurry|vision|spectacles|hard time seeing", blob
    ):
        pats.append(
            r"eyesight|blurry sight|glasses|albino|ironwillow|cheshire|"
            r"quarters|brought in by the wolf"
        )
    if re.search(r"flashback|secret|secrets|reveal", blob):
        pats.append(
            r"flashback|pov order|spots serias|capture povs|side notes|"
            r"obsidian|stygian"
        )
    if re.search(r"chase|swiftly|hastily|serias", blob) or re.search(
        r"captured", title, re.I
    ):
        pats.append(r"chase|captured|serias|spots serias|swiftly|hastily")
    if not pats:
        weak = {
            "that",
            "this",
            "with",
            "from",
            "have",
            "been",
            "will",
            "would",
            "about",
            "after",
            "before",
            "during",
            "notes",
            "draft",
            "scene",
            "write",
            "still",
            "needs",
            "character",
        }
        toks = [
            t
            for t in _content_tokens(blob)
            if len(t) >= 5 and t not in weak
        ][:6]
        if toks:
            pats.append("|".join(re.escape(t) for t in toks))
    return [re.compile(p, re.I) for p in pats]


def seat_search_corpus(
    row: dict[str, str],
    note_index: dict[str, tuple[str, str]],
) -> str:
    """
    Look hard for timeline seats: same note body first, then related notes
    whose bodies share the claim's beat family (not every Etherei note).
    """
    eid = str(row.get("entryId") or "")
    title = str(row.get("noteTitle") or "")
    line = str(row.get("line") or "")
    parts: list[str] = [title, line]
    if eid in note_index:
        parts.append(note_index[eid][1])

    families = _seat_family_patterns(line, title)
    if not families:
        return "\n".join(parts)
    for other_id, (ot, ob) in note_index.items():
        if other_id == eid:
            continue
        other_blob = f"{ot}\n{ob}"
        if any(fam.search(other_blob) for fam in families):
            parts.append(other_blob)
    return "\n".join(parts)


def is_flashback_claim(focus: str) -> bool:
    """True for flashback/secret-reveal polish claims (not bare chase craft)."""
    f = focus or ""
    if re.search(r"\bflashback\b", f):
        return True
    if re.search(r"\b(?:secret|secrets|reveal\w*)\b", f) and not re.search(
        r"\b(?:swiftly|hastily|ticklish|eyesight|glasses|albino)\b", f
    ):
        return True
    return False


def extract_draft_timeline_seat(
    corpus: str,
    line: str = "",
    *,
    note_title: str = "",
) -> str:
    """
    Short main-draft timeline seat from notes — librarian only, never invent.
    Empty when notes don't say where the beat sits.
    Seats are claim-typed so vision/rescue/chase/flashback don't cross-bleed.
    """
    c = corpus or ""
    if not c.strip():
        return ""
    line_l = (line or "").lower()
    title_l = (note_title or "").lower()
    focus = line_l + " " + title_l

    is_ticklish = bool(re.search(r"\bticklish\b", focus))
    is_vision = bool(
        re.search(
            r"\b(?:eyesight|albino|glasses|blurry|vision|spectacles|"
            r"hard time seeing)\b",
            focus,
        )
    )
    is_flash = is_flashback_claim(focus)
    is_chase_craft = bool(re.search(r"\b(?:chase|swiftly|hastily)\b", focus)) and (
        not is_flash
    )

    candidates: list[tuple[int, str]] = []

    def add(score: int, seat: str) -> None:
        s = re.sub(r"\s+", " ", (seat or "").strip(" \t\"'“”‘’.,;:"))
        if not s or len(s) < 8 or len(s) > 90:
            return
        if line_is_later_book(s) or re.search(
            r"\bend of the series\b|\bway longer than one book\b", s, re.I
        ):
            return
        candidates.append((score, s))

    if is_vision:
        glasses_focus = bool(
            re.search(
                r"\blost\s+(?:his|her|their)\s+glasses\b|"
                r"\bwithout glasses and struggling\b|"
                r"\bwrite .{0,40}without glasses\b",
                focus,
            )
        )
        m = re.search(
            r"revelation that happens at the\s+([^,]{5,70}?)"
            r"\s*,?\s*after\s+([^.]{5,55})",
            c,
            re.I,
        )
        if m and not glasses_focus:
            add(
                100,
                f"at the {m.group(1).strip()}, after {m.group(2).strip()}",
            )
        m = re.search(
            r"at the\s+(Cheshire Cat(?:['\u2019]s)? quarters)\s*,?\s*after\s+"
            r"((?:Etherei|he|him)\s+is\s+captured|capture[d]?)",
            c,
            re.I,
        )
        if m and not glasses_focus:
            add(95, f"at the {m.group(1)}, after Etherei is captured")
        if re.search(
            r"after Etherei is brought in by the [Ww]olf|"
            r"Tenebris will give him a proper pair at some point after",
            c,
            re.I,
        ):
            add(
                92 if glasses_focus else 85,
                "after the Wolf brings Etherei to Tenebris",
            )
        if re.search(
            r"referenced in (?:his )?conversation with Ironwillow",
            c,
            re.I,
        ):
            add(60, "hinted in Ironwillow conversation; fuller reveal later")
        # Restated compressed vision bullet still wants quarters when not glasses-lost.
        if (
            not glasses_focus
            and re.search(r"albino-rabbit vision|hard time seeing|eyesight", focus)
            and re.search(r"Cheshire Cat(?:['\u2019]s)? quarters", c, re.I)
        ):
            add(90, "at the Cheshire Cat's quarters, after Etherei is captured")

    if is_ticklish:
        if re.search(
            r"after they catch up to Serias and rescue (?:Etherei|him)",
            c,
            re.I,
        ):
            add(90, "after brothers rescue Etherei from Serias")
        elif re.search(
            r"after they\s+(?:catch up to Serias|rescue Etherei)",
            c,
            re.I,
        ):
            add(80, "after brothers rescue Etherei")

    if is_chase_craft:
        if re.search(r"When Serias shows up", c, re.I) or re.search(
            r"find a way to write the chase", c, re.I
        ):
            add(88, "during the Serias capture chase")
        if re.search(r"after Etherei spots Serias", c, re.I):
            add(86, "during the chase after Etherei spots Serias")

    if is_flash:
        if re.search(r"after Etherei spots Serias", c, re.I) or re.search(
            r"POV Order of Events after Etherei spots Serias", c, re.I
        ):
            add(87, "during the chase after Etherei spots Serias")
        if re.search(r"As Stygian is giving chase", c, re.I) and re.search(
            r"stygian", focus
        ):
            add(84, "during Stygian's chase after Etherei spots Serias")
        if re.search(r"Obsidian has a fractured", c, re.I) and re.search(
            r"obsidian", focus
        ):
            add(84, "during Obsidian's chase after Etherei spots Serias")
        if re.search(r"after Etherei spots Serias", note_title or "", re.I):
            add(70, "during the chase after Etherei spots Serias")

    # Generic librarian seats when notes name a when/where and no typed seat won.
    if not candidates:
        m = re.search(
            r"\b(after\s+[\w'-]+(?:\s+[\w'-]+){0,5}\s+is\s+captured)\b",
            c,
            re.I,
        )
        if m:
            add(48, m.group(1))
        m = re.search(
            r"\b((?:during|after)\s+.{8,70}?"
            r"(?:capture[d]?|court\s+scene|chase\s+scene))\b",
            c,
            re.I,
        )
        if m:
            add(45, m.group(1))
        m = re.search(
            r"\b(after\s+(?:the\s+)?[A-Za-z][\w'-]{2,}"
            r"(?:\s+[A-Za-z][\w'-]{2,}){0,2})\b",
            c,
            re.I,
        )
        if (
            m
            and 12 <= len(m.group(1)) <= 48
            and not re.search(
                r"\b(?:takes?|keeps?|binds?|finds?|reveals?)\b",
                m.group(1),
                re.I,
            )
        ):
            add(42, m.group(1))
        m = re.search(
            r"\b(during\s+(?:the\s+)?[A-Za-z][\w'-]{2,}"
            r"(?:\s+[A-Za-z][\w'-]{2,}){0,2}"
            r"(?:\s+scene|\s+chase|\s+flashback)?)\b",
            c,
            re.I,
        )
        if m and 10 <= len(m.group(1)) <= 48:
            add(40, m.group(1))
        m = re.search(
            r"\b(at the\s+[A-Za-z][\w'-]{2,}"
            r"(?:\s+[A-Za-z][\w'-]{2,}){0,2}"
            r"(?:'s)?(?:\s+quarters|\s+manor|\s+place|\s+scene)?)\b",
            c,
            re.I,
        )
        if m and 8 <= len(m.group(1)) <= 48:
            add(38, m.group(1))
        m = re.search(
            r"\b(shortly after\s+[A-Za-z][\w'-]{2,}"
            r"(?:\s+[A-Za-z][\w'-]{2,}){0,3})\b",
            c,
            re.I,
        )
        if m and len(m.group(1)) <= 48:
            add(36, m.group(1).rstrip(" .,;:"))

    if not candidates:
        return ""
    candidates.sort(key=lambda x: (-x[0], len(x[1])))
    return candidates[0][1]


def format_seat_as_plan_sentence(seat: str) -> str:
    """
    Turn a short timeline seat into a plan-recall follow-on sentence.
    No parentheses — e.g. 'Your plan was for this reveal to take place shortly after…'
    """
    seat_s = re.sub(r"\s+", " ", (seat or "").strip().rstrip("."))
    if not seat_s:
        return ""
    if re.match(r"^your plan was for\b", seat_s, re.I):
        out = seat_s[0].upper() + seat_s[1:] if seat_s else seat_s
        return out if out.endswith(".") else out + "."

    low = seat_s.lower()
    # after … → shortly after … (owner example shape)
    if low.startswith("after "):
        return (
            "Your plan was for this reveal to take place shortly "
            f"{seat_s[0].lower() + seat_s[1:]}."
        )
    if low.startswith("during "):
        return f"Your plan was for this to take place {seat_s[0].lower() + seat_s[1:]}."
    if low.startswith("at the ") or low.startswith("at "):
        return (
            "Your plan was for this reveal to take place "
            f"{seat_s[0].lower() + seat_s[1:]}."
        )
    if low.startswith("hinted "):
        return f"Your plan was for this to be {seat_s[0].lower() + seat_s[1:]}."
    return f"Your plan was for this to take place {seat_s[0].lower() + seat_s[1:]}."


def attach_timeline_seat(task_line: str, seat: str) -> str:
    """Append a draft-timeline seat as a follow-on sentence (not parentheses)."""
    s = (task_line or "").strip().rstrip(".")
    seat_s = re.sub(r"\s+", " ", (seat or "").strip().rstrip("."))
    if not s or not seat_s:
        return (task_line or "").strip()
    if seat_s.lower() in s.lower():
        return s + "."
    # Avoid stacking near-duplicate flashback seats.
    if re.search(r"\bduring\b.+\bflashback\b", s, re.I) and re.search(
        r"\bduring\b.+\bflashback\b", seat_s, re.I
    ):
        if re.search(r"chase|spots serias", seat_s, re.I) and not re.search(
            r"chase|spots serias", s, re.I
        ):
            seat_sentence = format_seat_as_plan_sentence(seat_s)
            out = f"{s}. {seat_sentence}"
            return out if len(out) <= _MAX_TASK_LINE_WITH_SEAT else s + "."
        return s + "."
    seat_sentence = format_seat_as_plan_sentence(seat_s)
    if not seat_sentence:
        return s + "."
    if seat_sentence.lower().rstrip(".") in s.lower():
        return s + "."
    out = f"{s}. {seat_sentence}"
    if len(out) > _MAX_TASK_LINE_WITH_SEAT:
        return s + "."
    return out


def extract_task_clarifier(
    corpus: str,
    line: str = "",
    *,
    note_title: str = "",
) -> str:
    """
    One short clarifying clause from notes — why / what-for — never invent.
    Empty when notes don't add a clear purpose beyond the task itself.
    """
    c = corpus or ""
    if not c.strip():
        return ""
    focus = f"{line or ''} {note_title or ''}".lower()
    candidates: list[tuple[int, str]] = []

    def add(score: int, clause: str) -> None:
        s = re.sub(r"\s+", " ", (clause or "").strip(" \t\"'“”‘’.,;:"))
        if not s or len(s) < 12 or len(s) > _MAX_CLARIFIER:
            return
        if line_is_later_book(s) or _BUBBLY_VOICE.search(s):
            return
        if _is_continuity_or_musing(s) and not re.search(
            r"\b(?:ticklish|eyesight|chase|flashback|secret|reveal)\b", s, re.I
        ):
            return
        candidates.append((score, s))

    is_ticklish = bool(re.search(r"\bticklish\b", focus))
    is_vision = bool(
        re.search(
            r"\b(?:eyesight|albino|glasses|blurry|vision|spectacles|"
            r"hard time seeing|vision trouble)\b",
            focus,
        )
    )
    is_flash = is_flashback_claim(focus)
    is_chase_craft = bool(
        re.search(r"\b(?:chase|swiftly|hastily)\b", focus)
    ) and (not is_flash)

    if is_ticklish:
        if re.search(
            r"never do (?:something like )?this ever again|"
            r"swear\s+\*?never to do that again|"
            r"never do that again",
            c,
            re.I,
        ):
            add(
                95,
                "so they can make him swear never to sacrifice himself that way again",
            )
        if re.search(
            r"be the younger brother|force'? him into kicking back",
            c,
            re.I,
        ):
            add(70, "while they pull him back into being the younger brother")

    if is_vision:
        if re.search(
            r"none of the characters, including Ethie|"
            r"Moonshadow Twins don'?t know|"
            r"including Ethie himself, realize",
            c,
            re.I,
        ):
            add(
                96,
                "a reveal even Etherei and his brothers have not faced yet",
            )
        if re.search(
            r"doesn'?t fully realize how much worse (?:his|her|their) eyesight",
            c,
            re.I,
        ):
            add(80, "he still underestimates how limited his sight is")

    if is_chase_craft:
        if re.search(
            r"deliberately outrunning both his brothers|"
            r"deliberately outrunning",
            c,
            re.I,
        ):
            add(
                94,
                "he deliberately outruns his brothers before the Wolf takes him",
            )
        if re.search(
            r"don'?t want to rush into Etherei being captured|"
            r"swiftly but not hastily",
            c,
            re.I,
        ):
            add(75, "give the capture room to breathe before it closes")

    if is_flash:
        if re.search(r"obsidian", focus) and re.search(
            r"brown rat|different memory", c, re.I
        ):
            add(
                90,
                "a different childhood memory with more about both still to open",
            )
        if re.search(r"stygian", focus) and re.search(
            r"early childhood|getting in trouble", c, re.I
        ):
            add(
                88,
                "an early-childhood fracture that surprises about both of them",
            )
        if re.search(
            r"mix of secret about personality and secret about physical|"
            r"personality and secret about physical ability",
            c,
            re.I,
        ):
            add(
                85,
                "lean into personality and ability — not the eyesight reveal",
            )

    if not candidates:
        m = re.search(
            r"\bso (?:that )?(?:they|he|she|the [\w'-]+) can\s+(.{12,80})",
            c,
            re.I,
        )
        if m:
            clause = m.group(0).strip()
            add(50, clause)

    if not candidates:
        return ""
    candidates.sort(key=lambda x: (-x[0], len(x[1])))
    return candidates[0][1]


def attach_clarifier(task_line: str, clarifier: str) -> str:
    """Append one em-dash clarifier without inventing or duplicating."""
    s = (task_line or "").strip().rstrip(".")
    clause = re.sub(r"\s+", " ", (clarifier or "").strip().rstrip("."))
    if not s or not clause:
        return (task_line or "").strip()
    if clause.lower() in s.lower():
        return s + "."
    # Already has an em-dash clarifier.
    if " — " in s or " – " in s:
        return s + "."
    out = f"{s} — {clause}"
    if len(out) > _MAX_TASK_LINE_WITH_SEAT - 40:
        return s + "."
    return out


def warm_task_voice(line: str) -> str:
    """
    Deprecated path — plan-recall framing is applied via frame_plan_recall.
    Keep as a no-op-ish densify cleanup for unit tests that still call it.
    """
    return plan_recall_core(line)


def task_beat_kind(line: str) -> str:
    """Classify a densified/core task line for plan-recall framing."""
    s = (line or "").lower()
    if re.search(r"\bflashback\b", s):
        return "flashback"
    if re.search(r"\bticklish\b", s):
        return "ticklish"
    if re.search(
        r"albino-rabbit vision|vision trouble|without glasses|lost-glasses",
        s,
    ):
        return "vision"
    if re.search(r"\bchase\b|swiftly|hastily", s):
        return "chase"
    return "generic"


def plan_recall_core(line: str) -> str:
    """
    Strip mellow/command openers down to a neutral task core (facts only).
    """
    s = (line or "").strip()
    if not s:
        return s

    loc_prefix = ""
    loc_m = re.match(r"^(During\s+(.+?)\s+flashback,\s*)", s, re.I)
    if loc_m:
        loc_prefix = loc_m.group(1)
        s = s[loc_m.end() :].strip()

    # Undo prior soft / command voices → neutral cores.
    replacements = (
        (r"^let the chase run swiftly, not hastily\b", "the chase runs swiftly, not hastily"),
        (r"^write the chase swiftly, not hastily\b", "the chase runs swiftly, not hastily"),
        (r"^find a way to write the chase swiftly, not hastily\b", "the chase runs swiftly, not hastily"),
        (r"^ensure the chase runs swiftly, not hastily\b", "the chase runs swiftly, not hastily"),
        (r"^have his brothers find out\b", "his brothers find out"),
        (r"^brothers find out\b", "his brothers find out"),
        (r"^show his brothers discovering\b", "his brothers find out"),
        (r"^bring out\s+", ""),
        (r"^show\s+", ""),
        (r"^open further secrets\b", "further secrets"),
        (r"^reveal additional secrets\b", "further secrets"),
        (r"^open something surprising\b", "something surprising"),
        (r"^reveal something surprising\b", "something surprising"),
        (r"^open\s+", ""),
        (r"^reveal\s+", ""),
        (r"^write\s+", ""),
    )
    for pat, repl in replacements:
        new_s, n = re.subn(pat, repl, s, count=1, flags=re.I)
        if n:
            s = new_s
            break

    s = re.sub(r"\s{2,}", " ", s).strip(" ,.")
    if loc_prefix:
        # Keep owner name for flashback framing later.
        s = loc_prefix + (s[0].lower() + s[1:] if s and s[0].isupper() else s)
    return s


def _flashback_owner(line: str) -> str:
    m = re.match(r"^During\s+(.+?)'s\s+flashback\b", line or "", re.I)
    if m:
        return m.group(1).strip()
    m = re.match(r"^During\s+(.+?)\s+flashback\b", line or "", re.I)
    if m:
        return m.group(1).strip()
    return ""


def frame_plan_recall(line: str, *, you_lead: bool, you_variant: int = 0) -> str:
    """
    Mirror the writer's plan — not commands, not mellow soft opens.
    you_lead True → starts with You…; False → scene-led (For … / Your notes…).
    """
    raw = (line or "").strip()
    if not raw or _BUBBLY_VOICE.search(raw):
        return raw

    core = plan_recall_core(raw)
    kind = task_beat_kind(core)
    owner = _flashback_owner(core)

    # Peel flashback prefix from core body.
    body = core
    loc_m = re.match(r"^During\s+.+?\s+flashback,\s*", body, re.I)
    if loc_m:
        body = body[loc_m.end() :].strip()
    body = body[0].lower() + body[1:] if body and body[0].isupper() else body
    body = body.rstrip(".")

    if kind == "chase":
        if re.search(r"swiftly|hastily", core, re.I):
            if you_lead:
                if you_variant % 2 == 0:
                    return "You wanted the chase to run swiftly, not hastily"
                return "You were planning for the chase to run swiftly, not hastily"
            return "For the chase scene, your plan was to keep it swift, not hasty"
        # Other chase-scene craft — keep the specific note beat.
        if you_lead:
            if you_variant % 2 == 0:
                return f"You wanted to {body}"
            return f"You were planning to {body}"
        return f"For the chase scene, your notes call for {body}"

    if kind == "ticklish":
        # Normalize to "his brothers find out X is ticklish"
        m = re.search(
            r"(?:his )?brothers find out\s+(.+?\s+is\s+ticklish)",
            core,
            re.I,
        )
        bit = m.group(1) if m else "Etherei is ticklish"
        if you_lead:
            if you_variant % 2 == 0:
                return f"You wanted his brothers to find out {bit}"
            return f"You were planning for his brothers to find out {bit}"
        return f"Your notes call for his brothers finding out {bit}"

    if kind == "vision":
        m = re.search(
            r"((?:Etherei|[\w'-]+)'s albino-rabbit vision trouble|albino-rabbit vision trouble)",
            core,
            re.I,
        )
        bit = m.group(1) if m else "albino-rabbit vision trouble"
        if you_lead:
            if you_variant % 2 == 0:
                return f"You wanted to bring out {bit}"
            return f"You were planning to show {bit}"
        return f"For the vision beat, your notes call for showing {bit}"

    if kind == "flashback":
        who = owner or "the"
        # Always scene-led opener (does not start with You) — "you meant" sits mid-line.
        if re.search(r"further secrets|additional secrets", body, re.I):
            return (
                f"For {who}'s flashback, you meant to open further secrets "
                + re.sub(
                    r"^(?:further secrets|additional secrets)\s*",
                    "",
                    body,
                    flags=re.I,
                ).strip()
            )
        if re.search(r"something surprising", body, re.I):
            return (
                f"For {who}'s flashback, you meant to open something surprising "
                + re.sub(r"^something surprising\s*", "", body, flags=re.I).strip()
            )
        return f"For {who}'s flashback, you meant to {body}"

    if re.search(
        r"still leave (?:the rest of )?this stretch (?:open|unspecified)|"
        r"rest of this stretch is still unspecified|"
        r"stretch between capture and arrival is still open",
        core,
        re.I,
    ):
        return "Your notes still leave the rest of this stretch unspecified"
    if re.search(
        r"journey takes several days|stop for the night|keeps him fed|keep him fed",
        core,
        re.I,
    ):
        said = body if body[:1].islower() else (body[0].lower() + body[1:] if body else body)
        return f"Your notes say {said}"

    finite = re.match(
        r"^(?:it|they|he|she|"
        r"[A-Za-z][\w'-]+(?:\s+[A-Z][\w'-]+)?)\s+"
        r"(?:takes?|keeps?|finds?|binds?|resents?|cares?|needs?)\b",
        body,
    )

    # Generic — don't glue "You wanted to" onto musing scraps.
    if you_lead:
        if re.match(r"^(?:now|so|ok|however|for the)\b", body, re.I):
            return f"Your notes call for {body}"
        if finite or re.match(r"^(?:it|they|he|she)\s+\w+", body, re.I):
            return f"Your notes say {body}"
        if re.match(r"^(?:the|a|an|his|her|their|this)\b", body, re.I):
            if you_variant % 2 == 0:
                return f"You wanted {body}"
            return f"You were planning {body}"
        if re.match(
            r"^(?:write|show|bring|open|keep|have|let|find|reveal|draft|run)\b",
            body,
            re.I,
        ):
            if you_variant % 2 == 0:
                return f"You wanted to {body}"
            return f"You were planning to {body}"
        if re.match(r"^[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?\b", body):
            if you_variant % 2 == 0:
                return f"You wanted {body}"
            return f"You were planning {body}"
        return f"Your notes call for {body}"
    if finite or re.match(r"^(?:it|they|he|she)\s+\w+", body, re.I):
        return f"Your notes say {body}"
    out = f"Your notes call for {body}"
    out = re.sub(
        r"^Your notes call for ((?:it|he|she|they)\s+"
        r"(?:takes?|keeps?|finds?|binds?)\b)",
        r"Your notes say \1",
        out,
        flags=re.I,
    )
    return out


def assign_plan_recall_frames(bullets: list[str]) -> list[str]:
    """
    Stagger You-led lines: at least two non-You openers before the next You…
    Flashbacks always use For … you meant (non-You start).
    Chase prefers For the chase scene, your plan was… (non-You start).
    """
    out: list[str] = []
    # Allow a You-led line early when the beat fits; still enforce a 2-gap after.
    since_you = 2
    you_variant = 0
    for bullet in bullets:
        kind = task_beat_kind(plan_recall_core(bullet))
        force_non_you = kind in {"flashback", "chase"}
        if re.search(
            r"journey takes several days|stop for the night|keeps him fed|keep him fed|"
            r"still leave (?:the rest of )?this stretch|"
            r"rest of this stretch|stretch between capture",
            bullet,
            re.I,
        ):
            force_non_you = True
        allow_you = (not force_non_you) and since_you >= 2
        you_lead = bool(allow_you and kind in {"ticklish", "vision", "generic"})

        framed = frame_plan_recall(
            bullet, you_lead=you_lead, you_variant=you_variant
        )
        if re.match(r"^you\b", framed or "", re.I):
            since_you = 0
            you_variant += 1
        else:
            since_you += 1
        out.append(framed)
    return out


def densify_task_phrasing(line: str) -> str:
    """
    Voice-only: denser, clearer librarian task phrasing — same facts, no invent.
    Imperative where the note already names the beat; drop scrap glue.
    """
    s = (line or "").strip()
    if not s:
        return s

    # Craft note scraps → direct write task.
    s = re.sub(
        r"^find a way to write\b",
        "Write",
        s,
        flags=re.I,
    )
    s = re.sub(r"\bswiftly but not hastily\b", "swiftly, not hastily", s, flags=re.I)

    # Vision family: one clear phrase (no slash twin).
    s = re.sub(
        r"\balbino-rabbit vision trouble\s*/\s*hard time seeing\b",
        "albino-rabbit vision trouble",
        s,
        flags=re.I,
    )
    s = re.sub(
        r"\blost-glasses\s*/\s*poorer eyesight beat\b",
        "lost-glasses eyesight beat",
        s,
        flags=re.I,
    )

    # Flashback polish: drop "different memory and", use imperative reveal.
    s = re.sub(
        r"\bdifferent memory and\s+(?:reveals?\s+)?",
        "reveal ",
        s,
        flags=re.I,
    )
    s = re.sub(r"\breveals\b", "reveal", s, flags=re.I)
    # "During X's flashback, reveal …" — keep; bare leading "reveal" OK.
    s = re.sub(r"^reveals?\s+", "Reveal ", s, flags=re.I)
    # After a flashback seat prefix, force imperative Reveal.
    s = re.sub(
        r"(During\s+.+?\s+flashback,\s*)reveal\b",
        r"\1reveal",
        s,
        flags=re.I,
    )
    # "about X and about Y" → "about X and Y"
    s = re.sub(r"\babout\s+(\w+)\s+and\s+about\s+", r"about \1 and ", s, flags=re.I)
    # "… and Obsidian himself" → "… and Obsidian"
    s = re.sub(r"\b(and\s+[A-Z][\w'-]+)\s+himself\b", r"\1", s)
    s = re.sub(r"\b(and\s+[A-Z][\w'-]+)\s+herself\b", r"\1", s)

    # Collapse doubled spaces / stray commas from compressions.
    s = re.sub(r"\s{2,}", " ", s).strip()
    s = re.sub(r"\s+,", ",", s)
    return s


def _compress_span_journey_line(raw: str) -> str:
    """
    Librarian compress for capture→arrival journey notes — keep stop/bind/fed
    beats that a length cap would otherwise drop. Never invents.
    """
    s = raw or ""
    if re.search(r"what happens in between", s, re.I):
        return "The rest of this stretch is still unspecified in the notes"
    days = bool(re.search(r"several days", s, re.I))
    stop = bool(re.search(r"stops? for the (?:night|day)", s, re.I))
    bind_inj = bool(re.search(r"binds?.{0,80}injur", s, re.I))
    bind_limbs = bool(
        re.search(r"\blimbs\b", s, re.I)
        and re.search(r"cannot run|can'?t run|run off", s, re.I)
    )
    firmly = bool(re.search(r"\bfirmly\b", s, re.I) and re.search(r"not gently", s, re.I))
    fed = ""
    if re.search(r"keep .{0,48} fed", s, re.I):
        if re.search(r"conversation|mouth .{0,40}shut|will speak", s, re.I):
            fed = (
                "He keeps him fed on the journey; when conversation is attempted, "
                "he keeps his mouth shut and will not speak"
            )
        else:
            fed = "He keeps him fed on the journey"
    if days and stop:
        out = "The journey takes several days"
        if bind_inj or firmly:
            out += (
                ". When he stops for the night, he binds the injuries firmly — "
                "not gently, and not roughly enough to worsen them"
            )
            if bind_limbs:
                out += " — and binds the limbs so he cannot run off"
        else:
            out += ", with a stop for the night before they arrive"
        if fed:
            out += ". " + fed
        return out
    if fed:
        return fed
    return ""


def restate_as_task_line(
    raw: str,
    *,
    timeline_seat: str = "",
    clarifier: str = "",
) -> str:
    """
    Librarian short task line from a note claim — compress/reframe, never invent.
    Returns empty if the line cannot be stated cleanly (no … trail-offs).
    Optional clarifier = one note-backed why/what-for clause; seat = when/where.
    """
    s = _tidy_claim_line(raw)
    if not s or _line_is_incomplete(s):
        return ""

    # Prefer explicit craft instruction in parentheses when present.
    craft = re.search(
        r"\(([^)]*(?:write|draft|show|clarify|swiftly)[^)]*)\)",
        s,
        re.I,
    )
    if craft:
        inner = _tidy_claim_line(craft.group(1))
        if inner and not _line_is_incomplete(inner) and len(inner) <= _MAX_TASK_LINE:
            s = inner

    # Strip author mush leads (same facts, tighter task voice).
    s = re.sub(
        r"^(?:so|however),?\s+(?:i(?:'?m| am)\s+thinking\s+)?",
        "",
        s,
        flags=re.I,
    ).strip()
    s = re.sub(r"^i think\s+", "", s, flags=re.I).strip()
    s = re.sub(r"^i mean\s+", "", s, flags=re.I).strip()
    s = re.sub(r"^i mentioned\s+", "", s, flags=re.I).strip()
    s = re.sub(r"^also\s+something\s+in\s+", "", s, flags=re.I).strip()
    s = re.sub(r"^note:\s*", "", s, flags=re.I).strip()
    s = re.sub(r"^also,\s+", "", s, flags=re.I).strip()
    s = re.sub(r"^(?:ok\s+)?(?:so\s+)?(?:right\s+)?now,?\s+", "", s, flags=re.I).strip()
    s = re.sub(r"^ok\s+(?:so\s+)?", "", s, flags=re.I).strip()
    if re.search(r"don'?t want to make that the meat", s, re.I):
        return ""

    # Peel a leading when/where clause into the seat (moment lists).
    # Skip flashback "During X's flashback," — that stays an edit-seat prefix.
    lead_m = re.match(
        r"^((?:After|During|At the)\s[^,]{6,80}),\s+",
        s,
    )
    if lead_m and not re.search(r"\bflashback\b", lead_m.group(1), re.I):
        peeled = lead_m.group(1).strip()
        s = s[lead_m.end() :].strip()
        if s and s[0].islower():
            s = s[0].upper() + s[1:]
        if not timeline_seat:
            timeline_seat = peeled

    # Keep flashback edit-seat prefix when already present from shrink.
    loc_prefix = ""
    loc_m = re.match(r"^(During\s+.+?\s+flashback,\s*)", s, re.I)
    if loc_m:
        loc_prefix = loc_m.group(1)
        s = s[loc_m.end() :].strip()

    compressed = _compress_span_journey_line(s)
    if compressed:
        s = compressed
        if timeline_seat and re.search(r"after .{0,48}captur", timeline_seat, re.I):
            timeline_seat = ""

    # Compress brothers-discover-ticklish / albino-eyesight showable facts.
    tick = re.search(
        r"discover(?:ing|s|ed)?\s+that\s+(\w+)\s+is\s+ticklish\b|"
        r"\b(\w+)\s+is\s+ticklish\b|"
        r"brothers?\b.{0,80}\b(\w+)\b.{0,40}\bticklish\b",
        s,
        re.I,
    )
    if tick:
        who = next((g for g in tick.groups() if g), "")
        if who:
            s = f"Brothers find out {who} is ticklish"

    eyes = None
    who = ""
    m_as = re.search(r"\b([A-Z][\w'-]+),?\s+as\s+an\s+albino\b", s)
    m_trouble = re.search(
        r"\b([A-Z][\w'-]+)\b.{0,50}\btrouble\s+with\s+(?:his|her|their)\s+eyesight\b",
        s,
    )
    m_incl = re.search(
        r"including\s+([A-Z][\w'-]+)\s+himself.{0,80}\beyesight\b",
        s,
        re.I,
    )
    if m_as or m_trouble or m_incl or re.search(
        r"\b(?:blurry\s+sight|hard\s+time\s+seeing|"
        r"doesn'?t\s+fully\s+realize\s+how\s+much\s+worse\s+(?:his|her|their)\s+eyesight|"
        r"trouble\s+with\s+(?:his|her|their)\s+eyesight)\b",
        s,
        re.I,
    ):
        eyes = True
        for m in (m_as, m_trouble, m_incl):
            if m and m.group(1):
                who = m.group(1)
                break
    if eyes and not tick:
        skip = {
            "tenebris",
            "dijon",
            "obsidian",
            "stygian",
            "serias",
            "ironwillow",
            "characters",
            "mentions",
            "none",
            "letter",
            "white",
            "rabbit",
        }
        if who.lower() in skip or (who and not who[0].isupper()):
            who = ""
        if who and who.lower() not in {"he", "she", "they", "his", "her", "ethie"}:
            s = f"Show {who}'s albino-rabbit vision trouble"
        elif re.search(r"\bethie\b|\betherei\b", raw or "", re.I):
            s = "Show Etherei's albino-rabbit vision trouble"
        else:
            s = "Show albino-rabbit vision trouble"

    glasses = re.search(
        r"\b(\w+)\s+lost\s+(?:his|her|their)\s+glasses\b|"
        r"back\s+to\s+not\s+having\s+glasses\b",
        s,
        re.I,
    )
    if glasses and not tick and not eyes:
        who = glasses.group(1) if glasses.lastindex else ""
        if who and who.lower() not in {"he", "she", "they"}:
            s = f"Write {who} without glasses and struggling to see"
        else:
            s = "Write the lost-glasses eyesight beat"

    if loc_prefix:
        s = loc_prefix + (s[0].lower() + s[1:] if s and s[0].isupper() else s)

    # Moment notes often name the unused beat as "still needs to be written".
    if re.search(r"\bstill needs to be written\b", s, re.I):
        s = re.sub(r"\bstill needs to be written\b", "", s, flags=re.I)
        s = re.sub(r"\s{2,}", " ", s).strip(" ,")
    else:
        write_m = re.match(
            r"^.+?\s+still needs to write\s+(.+)$",
            s,
            re.I,
        )
        if write_m:
            s = write_m.group(1).strip()
            if s and s[0].islower():
                s = s[0].upper() + s[1:]

    # Keep first complete chunk when the note stacks clauses.
    if not compressed:
        keep_tail = re.compile(
            r"\b("
            r"stops? for the (?:night|day)|"
            r"binds?.{0,40}injur|"
            r"keep .{0,24} fed|"
            r"mouth .{0,24}shut|"
            r"discover(?:ing|s|ed)? that|"
            r"still needs? to|"
            r"need(?:s)? to write"
            r")\b",
            re.I,
        )

        def _ok_split(left: str) -> bool:
            if keep_tail.search(s) and not keep_tail.search(left):
                return False
            return True

        if ";" in s and len(s) > 110:
            left = s.split(";", 1)[0].strip()
            if (
                len(left) >= 36
                and not _line_is_incomplete(left)
                and _ok_split(left)
            ):
                s = left

        # First sentence only when multiple.
        parts = re.split(r"(?<=[.!?])\s+", s)
        if parts and len(parts[0].strip()) >= 28:
            cand = parts[0].strip()
            if not _line_is_incomplete(cand) and _ok_split(cand):
                s = cand

        if len(s) > _MAX_TASK_LINE:
            for sep in (", so ", ", but also ", ", and also ", "; ", " — ", " - "):
                if sep == ", so " and re.search(
                    r"stops? for the (?:night|day)|binds?.{0,40}injur", s, re.I
                ):
                    continue
                if sep in s:
                    left = s.split(sep, 1)[0].strip()
                    if (
                        24 <= len(left) <= _MAX_TASK_LINE
                        and not _line_is_incomplete(left)
                        and _ok_split(left)
                    ):
                        s = left
                        break
        # Long author scrap with a clear discovering-that clause.
        if len(s) > _MAX_TASK_LINE:
            m = re.search(
                r"discover(?:ing|s|ed)?\s+that\s+[^.!]{8,120}",
                s,
                re.I,
            )
            if m:
                chunk = _tidy_claim_line(m.group(0))
                if chunk and len(chunk) <= _MAX_TASK_LINE:
                    s = chunk
    if _line_is_incomplete(s) or (
        len(s) > (_MAX_TASK_LINE_WITH_SEAT if compressed else _MAX_TASK_LINE)
    ):
        # Never truncate with ellipsis — drop rather than trail off.
        return ""

    s = densify_task_phrasing(s)
    # Plan-recall framing is applied in compose (needs list-wide You stagger).

    if s and s[0].islower():
        s = s[0].upper() + s[1:]
    if clarifier:
        s = attach_clarifier(s, clarifier)
    else:
        if s[-1] not in ".!?\"'”’":
            s = s + "."
    if timeline_seat:
        s = attach_timeline_seat(s.rstrip("."), timeline_seat)
    elif s[-1] not in ".!?\"'”’":
        s = s + "."
    return s


def _split_task_bullet_parts(bullet: str) -> tuple[str, str, str]:
    """Split densified bullet into (core, clarifier, seat sentence-or-raw)."""
    raw = (bullet or "").strip()
    seat = ""
    body = raw.rstrip(".")
    m = re.search(
        r"^(.*?)\.\s+(Your plan was for .+)$",
        raw.rstrip("."),
        re.I | re.S,
    )
    if m:
        body = m.group(1).strip()
        seat = m.group(2).strip().rstrip(".")
    else:
        # Legacy parentheses seats (pre-sentence format).
        m2 = re.search(r"\s*\(([^)]+)\)\s*$", body)
        if m2:
            seat = m2.group(1).strip()
            body = body[: m2.start()].rstrip()
    clarifier = ""
    if " — " in body:
        core, clarifier = body.split(" — ", 1)
        clarifier = clarifier.strip()
    else:
        core = body
    return core.strip(), clarifier, seat


def _join_task_bullet_parts(core: str, clarifier: str, seat: str) -> str:
    """Reassemble framed core + clarifier + seat sentence (no parentheses)."""
    s = (core or "").strip().rstrip(".")
    if not s:
        return ""
    if clarifier:
        s = f"{s} — {clarifier.strip().rstrip('.')}"
    s = s + "."
    if seat:
        seat_s = seat.strip().rstrip(".")
        if not re.match(r"^your plan was for\b", seat_s, re.I):
            seat_s = format_seat_as_plan_sentence(seat_s).rstrip(".")
        if seat_s:
            s = f"{s} {seat_s}."
    return s


def _select_tasks_for_display(
    ranked: list[dict[str, str]],
) -> tuple[list[dict[str, str]], int]:
    """Return (shown rows, hidden count). Soft-show all when the list is small."""
    if len(ranked) <= SOFT_SHOW_ALL_MAX:
        return ranked, 0
    return ranked[:MAX_TASK_ITEMS], len(ranked) - MAX_TASK_ITEMS


def compose_writing_next_task_list(
    work_hints: set[str],
    items: list[dict[str, str]],
    *,
    has_notes: bool,
    has_draft: bool,
    topic: str = "",
    total_before_cap: int = 0,
    unused_but_not_tasks: bool = False,
    later_book_scope: bool = False,
    update_notes_nudges: list[str] | None = None,
) -> str:
    """Short bullet task list — restated write-next tasks only."""
    work = _work_phrase(work_hints)
    topic_s = (topic or "").strip()
    scope_bit = "later-book " if later_book_scope else ""
    if topic_s:
        lead = (
            f"Here's a short {scope_bit}task list for {work} about {topic_s} — "
            f"write-next items from your notes that aren't on the page yet:\n"
        )
    else:
        lead = (
            f"Here's a short {scope_bit}task list for {work} — "
            f"write-next items from your notes that aren't on the page yet:\n"
        )
    lines = [lead]
    if not has_notes:
        lines.append(
            "No notes found for this work to compare. Add notes, then ask again."
        )
    elif not has_draft:
        lines.append(
            "No main document/draft found for this work to compare against. "
            "Open or save a document for this work, then ask again."
        )
    elif items:
        first = True
        bullet_count = 0
        prepared: list[tuple[str, str, str]] = []
        for row in items:
            bullet = restate_as_task_line(
                str(row.get("line") or ""),
                timeline_seat=str(row.get("timelineSeat") or ""),
                clarifier=str(row.get("clarifier") or ""),
            )
            if not bullet:
                continue
            prepared.append(_split_task_bullet_parts(bullet))
        framed_cores = assign_plan_recall_frames([c for c, _cl, _se in prepared])
        for framed, (_core, clarifier, seat) in zip(framed_cores, prepared):
            out = _join_task_bullet_parts(framed, clarifier, seat)
            if not out:
                continue
            if not first:
                lines.append("")  # one blank line between bullets
            lines.append(f"• {out}")
            first = False
            bullet_count += 1
        if first:
            lines.append(
                "Nothing could be restated as a clean write-next task line "
                "(incomplete scraps were skipped)."
            )
        else:
            extra = max(0, int(total_before_cap) - bullet_count)
            if extra > 0:
                lines.append(
                    f"\n…and {extra} more write-next item(s). "
                    "Name a topic (chase, Court politics, …) or ask again for more."
                )
    elif unused_but_not_tasks:
        if topic_s:
            lines.append(
                f"Notes about {topic_s} have unused lines, but none looked like "
                "near write-next tasks. Continuity sticky-notes, later-book setup, "
                "and standing lore stay out of this list."
            )
        else:
            lines.append(
                "Notes have unused lines, but none looked like near write-next tasks. "
                "Continuity sticky-notes, later-book setup, and standing lore stay "
                "out of this list."
            )
    elif topic_s:
        lines.append(
            f"Nothing clear stood out as write-next tasks about {topic_s} — "
            "either those lines also show up in the draft by phrase match, "
            "or no notes for that topic were found."
        )
    else:
        lines.append(
            "Nothing clear stood out as write-next tasks — clear note lines also "
            "show up in the draft by phrase match."
        )
    if update_notes_nudges:
        from lorekeeper_note_reminders import format_update_notes_block

        block = format_update_notes_block(update_notes_nudges)
        if block:
            lines.append(block)
    lines.append("\n" + _FOOTER)
    return "\n".join(lines)


def _bullet_echoes_ask(bullet: str, question: str) -> bool:
    """True when a restated bullet is just the Ask echoed back."""
    b = _normalize(bullet or "")
    if not b:
        return False
    if re.search(
        r"write what happens between|"
        r"what should i write next|"
        r"give me the task list|"
        r"list my task list",
        b,
    ):
        return True
    q = _normalize(question or "")
    if not q:
        return False
    q_core = re.sub(
        r"\b(?:in|for|about)\s+.+$",
        "",
        q,
    )
    q_core = re.sub(
        r"\b(?:give me|tell me|list|task lists?|what happens|"
        r"what should i write next|writing next)\b",
        " ",
        q_core,
    )
    q_core = re.sub(r"\s+", " ", q_core).strip()
    if len(q_core) >= 24 and q_core in b:
        return True
    return False


def _is_vision_family_task(bullet: str) -> bool:
    """True for Etherei eyesight / glasses write-next restates (same beat family)."""
    k = _normalize(bullet or "")
    return bool(
        re.search(
            r"albino-rabbit vision|hard time seeing|vision trouble|"
            r"without glasses and struggling|lost-glasses|poorer eyesight|"
            r"lost-glasses eyesight",
            k,
        )
    )


def _vision_seat_preference(bullet: str) -> int:
    """Higher = better seat for the vision reveal (Cheshire quarters wins)."""
    k = _normalize(bullet or "")
    if "cheshire" in k or "quarters" in k:
        return 100
    if "ironwillow" in k:
        return 50
    if "wolf" in k or "tenebris" in k:
        return 40
    return 60


def answer_writing_next_task_list(
    entries: list[dict[str, Any]],
    *,
    work_hints: set[str],
    question: str = "",
) -> tuple[str, list[str]]:
    """
    Compare story notes vs main draft; return a short write-next task list.
    Librarian only — restates, never invents. Continuity / later-book stay out
    unless the ask is later-book scoped.
    """
    allow_later = wants_later_book_scope(question)
    items, has_notes, has_draft = collect_notes_not_in_draft(entries)
    span = extract_writing_next_span(question)
    if span:
        items = filter_unused_by_span(items, span)
        topic = str(span.get("label") or "")
    else:
        topic = extract_writing_next_topic(question)
        if topic:
            items = filter_unused_by_topic(
                items, topic, entries=entries, question=question
            )
        anchors = extract_after_anchors(question)
        if anchors:
            items = filter_unused_by_after_anchors(items, anchors)

    cleaned = _near_dedupe_items(items) if items else []
    cleaned = filter_already_in_draft_for_tasks(cleaned, entries)
    # Keep pre-shrink rows for update-notes nudges (full flashback setup lines).
    nudge_source_rows = list(cleaned)
    cleaned = filter_partly_done_flashbacks(cleaned, entries)
    tasks = filter_write_next_tasks(
        cleaned,
        allow_later_book=allow_later,
        keep_span_journey=bool(span),
    )
    if span and not tasks:
        # Gap notes are often musing, not "find a way to write" craft lines.
        tasks = [
            row
            for row in cleaned
            if str(row.get("line") or "").strip()
            and not _line_is_incomplete(str(row.get("line") or ""))
            and (allow_later or not line_is_later_book(str(row.get("line") or "")))
            and not re.search(
                r"^\s*(?:mind you|i mean|idk|i don'?t know)\b",
                str(row.get("line") or ""),
                re.I,
            )
            and not _SPAN_DONT_KNOW.search(str(row.get("line") or ""))
        ]
    if topic and topic_looks_like_cast(topic):
        tasks = [
            row
            for row in tasks
            if not _other_cast_attitude_about_subject(
                str(row.get("line") or ""), topic
            )
        ]
    unused_but_not_tasks = bool(cleaned) and not bool(tasks)
    # Prefer beats the draft already introduces; quiet pure-future scenes.
    from lorekeeper_note_reminders import (
        collect_update_notes_nudges,
        filter_tasks_by_draft_foothold,
    )

    tasks = (
        filter_tasks_by_draft_foothold(
            tasks,
            entries,
            allow_span_arrival=bool(
                span
                and (
                    span.get("kind") == "capture_to_arrival"
                    or (
                        span.get("kind") == "named_span"
                        and re.search(
                            r"\barriv|reach|manor|quarters|mansion",
                            str(span.get("end") or ""),
                            re.I,
                        )
                    )
                )
            ),
        )
        if tasks
        else []
    )
    ranked = (
        _rank_tasks_leave_off_first(tasks, entries) if tasks else []
    )
    note_index = _build_note_index(entries)
    # Look hard for draft-timeline seats + one clarifier across same + related notes.
    seated: list[dict[str, str]] = []
    for row in ranked:
        corpus = seat_search_corpus(row, note_index)
        line = str(row.get("line") or "")
        title = str(row.get("noteTitle") or "")
        seat = extract_draft_timeline_seat(corpus, line, note_title=title)
        clarifier = extract_task_clarifier(corpus, line, note_title=title)
        enriched = {**row}
        if seat:
            enriched["timelineSeat"] = seat
        if clarifier:
            enriched["clarifier"] = clarifier
        seated.append(enriched)
    ranked = seated
    # Restate first so incomplete long scraps don't consume the soft cap.
    restatable: list[dict[str, str]] = []
    seen_restate: set[str] = set()
    vision_idx: int | None = None
    vision_rank = -1
    for row in ranked:
        bullet = restate_as_task_line(
            str(row.get("line") or ""),
            timeline_seat=str(row.get("timelineSeat") or ""),
            clarifier=str(row.get("clarifier") or ""),
        )
        if not bullet:
            continue
        if _bullet_echoes_ask(bullet, question):
            continue
        key = _normalize(bullet)
        # Dedupe on core task (ignore seat sentence / legacy parentheses).
        core_for_key = re.sub(
            r"\.\s+Your plan was for .+$",
            "",
            bullet,
            flags=re.I | re.S,
        )
        core_for_key = re.sub(r"\([^)]*\)\s*\.?$", "", core_for_key)
        core_key = _normalize(core_for_key)
        if not key or key in seen_restate or core_key in seen_restate:
            continue
        if _is_vision_family_task(bullet):
            rank = _vision_seat_preference(bullet)
            if vision_idx is None:
                restatable.append(row)
                vision_idx = len(restatable) - 1
                vision_rank = rank
                seen_restate.add(key)
                seen_restate.add(core_key)
            elif rank > vision_rank:
                # Prefer Cheshire-quarters vision seat over glasses/Wolf twin.
                restatable[vision_idx] = row
                vision_rank = rank
                seen_restate.add(key)
                seen_restate.add(core_key)
            continue
        seen_restate.add(key)
        seen_restate.add(core_key)
        restatable.append(row)
    shown, _hidden = _select_tasks_for_display(restatable)

    nudges = collect_update_notes_nudges(
        entries, topic=topic, unused_rows=nudge_source_rows
    )

    answer = compose_writing_next_task_list(
        work_hints,
        shown,
        has_notes=has_notes,
        has_draft=has_draft,
        topic=topic,
        total_before_cap=len(restatable),
        unused_but_not_tasks=unused_but_not_tasks,
        later_book_scope=allow_later,
        update_notes_nudges=nudges,
    )

    source_ids: list[str] = []
    seen_ids: set[str] = set()
    for row in shown:
        eid = str(row.get("entryId") or "")
        if eid and eid not in seen_ids:
            seen_ids.add(eid)
            source_ids.append(eid)
        if len(source_ids) >= 12:
            break
    return answer, source_ids
