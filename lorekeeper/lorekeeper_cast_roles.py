"""LoreKeeper — standard cast roles (#14): writer's words first, weak inference last."""
from __future__ import annotations

import re
from typing import Any

# Recognized cast-role vocabulary (reference voice, not invented).
ROLE_TERMS = (
    r"protagonist|antagonist|main antagonist|deuteragonist|"
    r"hero|heroine|villain|main villain|"
    r"narrator|point of view|pov|viewpoint character|"
    r"mentor|sidekick|foil|"
    r"side character|supporting character|minor character|background character|"
    r"comic relief|love interest|"
    r"main character"
)

ROLE_TERMS_RE = re.compile(rf"\b({ROLE_TERMS})\b", re.I)

# Weak inference only — never substitute for an explicit writer role.
_INFERRED_VIEWPOINT = re.compile(
    r"\b(point of view|pov|narrator|viewpoint character)\b", re.I
)
_PROTAGONIST_PHRASE = re.compile(r"\bthe protagonist\b", re.I)

_THE_ROLE = frozenset(
    """
    protagonist antagonist narrator hero heroine villain deuteragonist mentor foil
    viewpoint character main character main antagonist main villain
    """.split()
)


def _article_for_role(role: str) -> str:
    low = role.lower().strip()
    if low in _THE_ROLE:
        return "the"
    if low in (
        "side character",
        "supporting character",
        "minor character",
        "background character",
        "sidekick",
        "foil",
        "comic relief",
        "love interest",
    ):
        return "a"
    return "the"


def format_cast_role_reference(label: str, role: str) -> str:
    role = re.sub(r"\s+", " ", (role or "").strip().lower())
    if not label or not role:
        return ""
    if role == "pov":
        role = "viewpoint character"
    if role == "point of view":
        role = "viewpoint character"
    article = _article_for_role(role)
    return f"{label} is {article} {role}."


def _name_in_text(name: str, text: str) -> bool:
    if not name or not text:
        return False
    return bool(re.search(rf"\b{re.escape(name)}\b", text, re.I))


def extract_explicit_cast_role(label: str, text: str) -> str | None:
    """Best explicit cast-role line from the writer's own words."""
    if not label or not text:
        return None
    label_pat = re.escape(label)
    patterns = (
        rf"\b{label_pat}\s+(?:is|was|are|were)\s+(?:the\s+|a\s+|an\s+)?({ROLE_TERMS})\b",
        rf"\b{label_pat}\s*,\s*(?:the\s+|a\s+|an\s+)?({ROLE_TERMS})\b",
        rf"\b{label_pat}\s*[—–\-]\s*(?:the\s+|a\s+|an\s+)?({ROLE_TERMS})\b",
        rf"\b(?:the\s+|a\s+|an\s+)?({ROLE_TERMS})\s*,\s*{label_pat}\b",
        rf"\b{label_pat}\s*\(\s*(?:the\s+|a\s+|an\s+)?({ROLE_TERMS})\s*\)",
    )
    for pattern in patterns:
        m = re.search(pattern, text, re.I)
        if m:
            return format_cast_role_reference(label, m.group(1))
    return None


def extract_explicit_cast_role_from_entries(
    label: str, entries: list[dict[str, Any]]
) -> str | None:
    """Prefer character/relationship notes over draft prose for explicit roles."""
    ordered: list[dict[str, Any]] = []
    drafts: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        kind = str(entry.get("kind") or "")
        eid = str(entry.get("id") or "")
        if kind == "document" or "#p" in eid:
            drafts.append(entry)
        else:
            ordered.append(entry)
    for entry in ordered + drafts:
        body = str(entry.get("body") or "")
        title = str(entry.get("title") or "")
        blob = f"{title}\n{body}".strip()
        if not _name_in_text(label, blob):
            continue
        found = extract_explicit_cast_role(label, blob)
        if found:
            return found
    return None


def has_explicit_cast_role(texts: list[str]) -> bool:
    joined = "\n".join(texts or [])
    return bool(ROLE_TERMS_RE.search(joined))


def merge_explicit_and_inferred(
    explicit_lines: list[str],
    inferred: str | None,
    *,
    label: str,
) -> list[str]:
    """Writer-stated roles win; inference only when nothing explicit exists."""
    out = [line.strip() for line in explicit_lines if line and line.strip()]
    if out and has_explicit_cast_role(out):
        return out
    if inferred:
        out.append(inferred.strip())
    return out


def cast_role_line_about_label(line: str, label: str) -> bool:
    """True when a cast-role statement is about this character, not someone else."""
    line = (line or "").strip()
    if not line or not label:
        return False
    label_pat = re.escape(label)
    if re.search(rf"\b{label_pat}\s+(?:is|was|,|—|–|-)", line, re.I):
        return True
    if _name_in_text(label, line) and ROLE_TERMS_RE.search(line):
        return True
    m = re.match(
        rf"^(Character\s+[A-Z0-9]+|[A-Z][a-z]{{2,}}(?:\s+[A-Z][a-z]{{2,}})?)\s+(?:is|was)\s+(?:the|a|an)\s+(?:{ROLE_TERMS})\b",
        line,
        re.I,
    )
    if m:
        return m.group(1).lower() == label.lower()
    return False


def infer_viewpoint_role_only(
    label: str,
    *,
    text: str,
    is_story_center: bool,
) -> str | None:
    """Viewpoint / main-character wording when the writer never named a cast role."""
    if not text or not _name_in_text(label, text):
        return None
    if extract_explicit_cast_role(label, text):
        return None
    if re.search(rf"\b{re.escape(label)}\s+(?:was|is)\s+the protagonist\b", text, re.I):
        return format_cast_role_reference(label, "protagonist")
    if _PROTAGONIST_PHRASE.search(text) and is_story_center:
        return format_cast_role_reference(label, "protagonist")
    if is_story_center and _INFERRED_VIEWPOINT.search(text):
        return format_cast_role_reference(label, "viewpoint character")
    if is_story_center:
        return format_cast_role_reference(label, "main character")
    return None


_ROLE_LABEL_STOP = frozenset(
    """
    one of the twins one of them one of us someone somebody the character
    this character that character the hero the heroine the villain
    """.split()
)
_TITLE_ROLE = re.compile(
    r"(?i)^(protagonist|antagonist|villain|hero|heroine|deuteragonist)\s*[:\-–]\s*(.+)$"
)
_ALIAS_PAIR_TITLE = re.compile(
    r"(?i)^\s*([A-Za-z][A-Za-z'-]{1,30})\s*/\s*([A-Za-z][A-Za-z'-]{1,30})"
    r"\s*,\s*([A-Za-z][A-Za-z'-]{1,30})\s*/\s*([A-Za-z][A-Za-z'-]{1,30})\s*$"
)


def _usable_cast_label(label: str) -> bool:
    cleaned = re.sub(r"\s+", " ", (label or "").strip())
    if len(cleaned) < 2 or len(cleaned) > 40:
        return False
    low = cleaned.lower()
    if low in _ROLE_LABEL_STOP or low.startswith("one of "):
        return False
    if low in _THE_ROLE or low in ("the", "a", "an", "and", "or"):
        return False
    # Prefer proper names / Character X — reject long lowercase phrases.
    if " " in cleaned and cleaned == cleaned.lower() and not cleaned.startswith("Character "):
        return False
    return True


def labels_for_cast_role(role: str, entries: list[dict[str, Any]]) -> list[str]:
    """Character names the writer explicitly tied to this role (notes only)."""
    role = (role or "").strip().lower()
    if not role:
        return []
    role_pat = re.escape(role)
    patterns = (
        rf"\b([\w][\w\s'-]{{1,40}})\s+(?:is|was)\s+(?:the\s+|a\s+|an\s+)?{role_pat}\b",
        rf"\b([\w][\w\s'-]{{1,40}})\s*,\s*(?:the\s+|a\s+|an\s+)?{role_pat}\b",
        rf"\b(?:the\s+|a\s+|an\s+)?{role_pat}\s*,\s*([\w][\w\s'-]{{1,40}})\b",
        rf"\b(Character\s+[A-Z0-9]+)\s+(?:is|was)\s+(?:the\s+|a\s+|an\s+)?{role_pat}\b",
    )
    found: list[str] = []
    seen: set[str] = set()

    def _add(label: str, *, prefer_front: bool = False) -> None:
        label = re.sub(r"\s+", " ", (label or "").strip().rstrip(".,;:"))
        if not _usable_cast_label(label):
            return
        key = label.lower()
        if key in seen:
            return
        seen.add(key)
        if prefer_front:
            found.insert(0, label)
        else:
            found.append(label)

    # Title "Protagonist: Platinus" beats prose false matches in long drafts.
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "").strip()
        m = _TITLE_ROLE.match(title)
        if m and m.group(1).lower() == role:
            _add(m.group(2), prefer_front=str(entry.get("kind") or "") == "character")

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        blob = str(entry.get("body") or "").strip()
        if not blob:
            continue
        prefer = str(entry.get("kind") or "") == "character"
        for pattern in patterns:
            for m in re.finditer(pattern, blob, re.I):
                _add(m.group(1), prefer_front=prefer)
    return found[:4]


def counterpart_labels_from_alias_titles(
    known_labels: list[str], entries: list[dict[str, Any]]
) -> list[str]:
    """From titles like 'Prism/Platinus, Titanem/Galloxidor', return the other pair."""
    known = {re.sub(r"\s+", " ", n.strip().lower()) for n in known_labels if n and n.strip()}
    if not known:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "").strip()
        m = _ALIAS_PAIR_TITLE.match(title)
        if not m:
            continue
        left = [m.group(1), m.group(2)]
        right = [m.group(3), m.group(4)]
        left_hit = any(x.lower() in known for x in left)
        right_hit = any(x.lower() in known for x in right)
        if left_hit == right_hit:
            continue
        side = right if left_hit else left
        for name in side:
            key = name.lower()
            if key in seen or key in known:
                continue
            if not _usable_cast_label(name):
                continue
            seen.add(key)
            out.append(name)
    return out[:4]
