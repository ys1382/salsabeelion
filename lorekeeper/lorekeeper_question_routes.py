"""LoreKeeper — question shape detection (what vs who, story position)."""
from __future__ import annotations

import re

from lorekeeper_character_summary import is_who_is_question
from lorekeeper_knowledge_pov import is_knowledge_pov_question
from lorekeeper_relations import is_relationship_between_question

_WHAT_Q = re.compile(
    r"\bwhat(?:'s|\s+is|\s+are|\s+was|\s+were|\s+does|\s+do|\s+did|"
    r"\s+happens|\s+happened|\s+goes|\s+went|\s+occurs|\s+occurred)\b",
    re.I,
)

_STORY_POSITION_Q = re.compile(
    r"\b("
    r"where (?:have i left|did i leave|i left) off|"
    r"where the story (?:is|stands|left off)|"
    r"what(?:'s|\s+is)\s+going on(?: in the story| where i left off| now)?|"
    r"what is going on where i left off|"
    r"summarize what(?:'s|\s+is)\s+going on|"
    r"what(?:'s|\s+is)\s+the story so far|story so far\b|"
    r"current (?:state|point) (?:of the story|in the story)|"
    r"pick up where i left off|"
    r"left off in the (?:story|main draft|draft)|"
    r"story so far at the end"
    r")\b",
    re.I,
)

# "left off … main draft / plot / chapter" — resume even when phrasing skips older templates.
# Also tolerate common typo "leave of" / "left of".
_STORY_POSITION_LEFT_OFF_META = re.compile(
    r"\b(?:left|leave) off?\b.{0,80}\b("
    r"main draft|the draft|in terms of plot|the plot|story|chapter"
    r")\b",
    re.I | re.S,
)


def is_what_question(question: str) -> bool:
    if not question:
        return False
    if is_who_is_question(question):
        return False
    if is_knowledge_pov_question(question):
        return False
    if is_relationship_between_question(question):
        return False
    return bool(_WHAT_Q.search(question))


def is_story_position_question(question: str) -> bool:
    q = question or ""
    try:
        from lorekeeper_writing_next import is_writing_next_span_question

        # "Between where I leave off and [beat]" is a stretch, not a leave-off recap.
        if is_writing_next_span_question(q):
            return False
    except Exception:
        pass
    if _STORY_POSITION_Q.search(q):
        return True
    return bool(_STORY_POSITION_LEFT_OFF_META.search(q))


_PORTRAIT_HINT = re.compile(
    r"\b("
    r"kind of person|personality|what.+ like|traits|temperament|"
    r"describe|portrait|character sketch|what sort of|what type of"
    r")\b",
    re.I,
)

# "Describe the look on X's face" / "notes on that expression" — narrow beat, not a full portrait.
_LOOK_EXPRESSION_Q = re.compile(
    r"\b("
    r"look on .{0,60}?face|"
    r"facial expression|expression on|"
    r"notes on (?:that |the )?expression|"
    r"all my notes on (?:that |the )?expression|"
    r"describe .{0,80}?(?:expression|look on|face)"
    r")\b",
    re.I,
)

_LOOK_SUBJECT = re.compile(
    r"look on\s+(character\s+[a-z0-9]+|[\w][\w'-]{0,40})(?:'s|’s)?\s+face",
    re.I,
)


def is_look_expression_question(question: str) -> bool:
    """Face / expression beats — surface sparse notes, not a full character sketch."""
    return bool(_LOOK_EXPRESSION_Q.search(question or ""))


def look_expression_subject(question: str) -> str:
    """Who's face/expression the question is about (not every named cast in the beat)."""
    if not question:
        return ""
    m = _LOOK_SUBJECT.search(question)
    if not m:
        return ""
    raw = m.group(1).strip()
    if raw.lower().startswith("character "):
        return re.sub(
            r"character\s+([a-z0-9]+)",
            lambda mm: f"Character {mm.group(1).upper()}",
            raw,
            flags=re.I,
            count=1,
        )
    return raw[:1].upper() + raw[1:] if raw else ""


_KIND_OF_PERSON = re.compile(
    r"\bwhat\s+kind of person(?:\s+is|\s+are)?\s+(?:the\s+)?(.+?)\??\s*$",
    re.I,
)
_WHAT_SUBJECT = re.compile(
    r"\bwhat(?:'s|\s+is|\s+are)\s+(?:the\s+)?(.+?)\??\s*$",
    re.I,
)
_WHAT_LIKE = re.compile(r"\bwhat(?:'s|\s+is|\s+are)\s+(.+?)\s+like\b", re.I)

_NON_PERSON_SUBJECT = re.compile(
    r"\b("
    r"gate|city|kingdom|realm|faction|prologue|chapter|story|plot|theme|setting|"
    r"world|magic|spell|artifact|place|location|alliance|war|peace|motivation|"
    r"event|scene|draft|mirror|north|south|east|west|"
    r"going on|happening|story so far"
    r")\b",
    re.I,
)


def _looks_like_person_subject(subject: str) -> bool:
    if not subject:
        return False
    low = subject.lower().strip()
    if _NON_PERSON_SUBJECT.search(low):
        return False
    if re.search(
        r"\b(protagonist|antagonist|villain|hero|heroine|character\s+[a-z0-9]+)\b",
        low,
    ):
        return True
    if re.match(r"^character\s+[a-z0-9]+$", low, re.I):
        return True
    words = [w for w in subject.split() if w]
    if len(words) == 1 and words[0][0:1].isupper() and len(words[0]) >= 2:
        return True
    if len(words) == 2 and words[0].lower() == "character":
        return True
    if len(words) == 2 and words[0][0:1].isupper() and words[1][0:1].isupper():
        return True
    return False


def extract_what_subject(question: str) -> str:
    """Name or role tail from a what-is question (not who-is)."""
    if not question or is_who_is_question(question):
        return ""
    # Story-state questions — not a cast/topic name.
    if is_story_position_question(question):
        return ""
    for pattern in (_KIND_OF_PERSON, _WHAT_LIKE, _WHAT_SUBJECT):
        m = pattern.search(question.strip())
        if not m:
            continue
        tail = re.sub(r"\s*\([^)]*\)", "", m.group(1).strip()).strip().rstrip("?.!")
        tail = re.sub(r"^(?:the\s+)", "", tail, flags=re.I).strip()
        tail = re.sub(r"\s+in\s+[A-Z].*$", "", tail).strip()
        if re.match(r"^(?:going on|happening|story so far)\b", tail, re.I):
            continue
        if len(tail) >= 2:
            return tail
    return ""


def is_character_portrait_question(question: str) -> bool:
    """What-style questions about a person — summary/portrait, not who-is cast card."""
    if not question or is_who_is_question(question):
        return False
    if is_knowledge_pov_question(question) or is_relationship_between_question(question):
        return False
    if is_look_expression_question(question):
        return False
    if re.search(r"\b(?:'s|’s)\s+role\b", question, re.I) or re.search(
        r"\bwhat(?:'s|\s+is)\s+(?:the\s+)?\w[\w\s'-]{0,40}\s+role\b", question, re.I
    ):
        return False
    if _PORTRAIT_HINT.search(question):
        return True
    if not is_what_question(question):
        return False
    subject = extract_what_subject(question)
    return _looks_like_person_subject(subject)
