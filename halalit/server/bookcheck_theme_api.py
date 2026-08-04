#!/usr/bin/env python3
"""
Halalit Bookcheck — theme detection API (server-side only).
Gemini theme scan on /api/theme-scan (Claude dual-scan retired). Successful scans are
shared via disk cache so later readers of the same book skip AI.
Optional web review snippets via DuckDuckGo lite (default) or Brave when BRAVE_SEARCH_API_KEY is set.
Reads HALALIT_GEMINI_API_KEY / GEMINI_API_KEY and ANTHROPIC_API_KEY (or anthropic.key).

POST /api/theme-scan       JSON: { "title": "...", "author": "...", "isGraphicFormat": bool }
POST /api/cover-identify   removed (410) — barcode / type title instead
POST /api/owner/shelf-identify  removed (410) — parked on Halalit roadmap; not live
POST /api/library/check    JSON: { "title": "...", "author": "...", "isbn?": "...", "placeId?": "..." }
                               → library branch borrowable check (Central Park / Cupertino practice)
GET/POST /api/bookstore/inventory  → bookstore availability (cached listings; not a checkout)
GET /api/bookstore/places
GET /api/owner/bookstore/dashboard (+ owner POST run/flags/match-review)
GET  /health  and  /api/health

Does not assess fanservice or panel art — client shows "not checked yet" for comics.
"""
from __future__ import annotations

import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from halalit_accounts import handle_get as accounts_handle_get
from halalit_accounts import handle_post as accounts_handle_post
from halalit_accounts import log_scanner_alert
from halalit_accounts import session_user
from halalit_lookup_log import record_bookcheck_lookup
from halalit_lookup_quality import is_garbage_lookup
from bookcheck_web_search import fetch_review_snippets, format_review_snippets_for_prompt
from library_catalog_check import check_title as library_check_title
from theme_scan_cache import get_cached_theme_scan, put_cached_theme_scan

try:
    import bookstore_api as bookstore_api_handlers
except ImportError:
    bookstore_api_handlers = None  # type: ignore

try:
    ThreadingHTTPServer  # noqa: F401
except NameError:
    from http.server import HTTPServer as ThreadingHTTPServer

PORT = int(os.environ.get("HALALIT_BOOKCHECK_API_PORT", "8075"))
BIND = os.environ.get("HALALIT_BOOKCHECK_API_BIND", "0.0.0.0")
KEY = os.environ.get("HALALIT_GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") or ""
MODEL = os.environ.get("HALALIT_GEMINI_MODEL", "gemini-2.0-flash")
CLAUDE_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = os.environ.get("HALALIT_ANTHROPIC_MODEL", "claude-sonnet-4-6")
LOG_PATH = os.environ.get("HALALIT_LOOKUP_LOG", "")

CONFIDENCE_RANK = {"high": 3, "medium": 2, "low": 1, "unknown": 0}


def anthropic_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    path = os.environ.get("KIDS_SITES_ANTHROPIC_KEY_PATH", "").strip()
    if not path:
        here = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(os.path.dirname(here), "anthropic.key")
    if path and os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    return ""


ANTHROPIC_KEY = anthropic_api_key()

# Halalit shelf theme ids (no fanservice / sexual_content / graphic_format — not for AI)
THEME_SPECS = [
    (
        "lgbtq",
        "ANY LGBTQ+ identity or relationship in the story (main plot OR supporting cast): gay, lesbian, "
        "bisexual, pansexual, queer, transgender, non-binary, gender-fluid, gender-nonconforming, "
        "same-sex parents/couples, same-sex or same-gender romance/crush/dating (including gentle MG/YA graphic novels "
        "that never use the word LGBTQ), they/them representation, or LGBTQ advocacy. "
        "Do NOT mark present for forced/magic gender-change alone when there is no affirming LGBTQ identity arc "
        "(use forced_gender_magic instead).",
    ),
    ("adult_romance", "Adult or mature-rated romance as a major plot thread (college/new adult, explicit relationship focus—not middle-grade crushes)"),
    ("illegitimate_children", "Plot centered on children born out of wedlock"),
    ("romantic_tension", "Light romantic tension, crushes, or clean dating (middle-grade / all-ages level—not college or mature-rated romance)"),
    (
        "forced_gender_magic",
        "Forced or magic gender-change / body-theft beat that is NOT affirming LGBTQ identity advocacy "
        "(e.g. a villain cursed or magically turned into another sex with no 'I feel free as my true gender' arc). "
        "Mark present TRUE for that soft caution; keep lgbtq.present FALSE unless there is separate affirming LGBTQ content.",
    ),
    ("romanticized_crime", "Romanticized crime, cruelty, or vigilante harm"),
    ("teen_ya_age", "Teen or young-adult audience (not all-ages)"),
    ("violence_intense", "Strong violence, horror, or intense scary content"),
    ("family_portrayed_negatively", "Parents/guardians unfair, hostile, or villainized"),
    ("cultural_stereotype", "Cultural stereotyping or shallow/false representation"),
    ("group_demonization", "Demonizes an entire race, religion, ethnicity, or people group"),
    ("pro_colonial_narrative", "Pro-colonial or imperial framing treated as natural or good"),
    ("crude_profanity", "Harsh swearing, slurs, or crude profanity"),
    ("deity_mythology", "Deity, spirits, or mythology treated as real in the story"),
    ("substance", "Alcohol, smoking, or drug-related content"),
    ("magic", "Fantasy magic (spells, wizards, magical creatures as fantasy device)"),
]

THEME_IDS = [t[0] for t in THEME_SPECS]

# Post-check: if model prose mentions LGBTQ but marked present false, correct it.
LGBTQ_EVIDENCE_RE = re.compile(
    r"\b(?:lgbtq\+?|lesbian|gay\b|homosexual|queer\b|bisexual|pansexual|asexual|aromantic|"
    r"transgender|non[- ]?binary|gender[- ]fluid|gender[- ]nonconforming|gender[- ]queer|"
    r"two[- ]moms?|two[- ]dads?|two[- ]fathers?|two[- ]mothers?|same[- ]sex|same[- ]gender|"
    r"they/them|enby|sapphic|mlm\b|wlw\b)\b",
    re.IGNORECASE,
)

LGBTQ_ABSENT_RE = re.compile(
    r"\bno (?:explicit )?(?:mention of )?lgbtq|no lgbtq|without (?:explicit )?lgbtq|"
    r"(?:do|does) not (?:contain|include|feature|indicate|show|depict)|not indicate any lgbtq|"
    r"does not (?:contain|include|feature)|no (?:gay|lesbian|queer|transgender|non[- ]binary)\b|"
    r"(?:no|not) confirmed on[- ]page(?:\s+(?:lgbtq|representation|lgbtq\+?\s*representation))?|"
    r"reader speculation or subtext only|not confirmed on[- ]page lgbtq|"
    r"(?:does|do) not feature confirmed on[- ]page|not feature confirmed on[- ]page",
    re.IGNORECASE,
)

PROJECTION_ONLY_RE = re.compile(
    r"\b(?:could be read as|read as queer|some readers?|fans? speculate|fan theor(?:y|ies)|shipping|"
    r"subtext only|not explicitly|no explicit|may be queer|hope (?:for|they)|projecting|queer coding|"
    r"wlw subtext|sapphic subtext|ambiguous friendship|close friendship between girls|fangirl(?:ing)? over|"
    r"not openly lgbtq|none of the characters is openly)\b",
    re.IGNORECASE,
)

EXPLICIT_LGBTQ_IN_STORY_RE = re.compile(
    r"\b(?:wouldn['’]t matter if (?:she|he|they) were attracted|attracted to (?:her|his|their) (?:female|male|same[- ]sex)|"
    r"same[- ]sex (?:crush|attraction|couple|relationship|parents|marriage|romance|dating)|"
    r"same[- ]gender (?:crush|attraction|couple|relationship|romance|dating)|"
    r"two moms?|two dads?|two mothers?|two fathers?|"
    r"(?:openly )?(?:gay|lesbian|bisexual|queer|transgender|non[- ]?binary) character|"
    r"(?:lesbian|gay|queer|sapphic|wlw|mlm)\s+(?:romance|relationship|couple|crush|subplot)|"
    r"two (?:girls|boys|women|men).{0,72}(?:romance|romantic|crush|dating|couple|relationship)|"
    r"(?:romance|romantic(?: relationship)?|crush|dating|couple).{0,48}(?:between|with) (?:two )?(?:girls|boys|women|men)|"
    r"(?:girl|girls|women|woman|female).{0,40}(?:romance|romantic|crush|dating|couple).{0,40}(?:girl|girls|women|woman|female)|"
    r"(?:boy|boys|men|man|male).{0,40}(?:romance|romantic|crush|dating|couple).{0,40}(?:boy|boys|men|man|male)|"
    r"don['’]t assume (?:she|he|they)['’]?s straight)\b",
    re.IGNORECASE,
)

ADULT_ROMANCE_ABSENT_RE = re.compile(
    r"\b(?:not|no)\s+(?:a\s+)?(?:mature[- ]rated|explicit|adult romance)|"
    r"not mature[- ]rated or explicit|"
    r"not a mature[- ]rated or explicit|"
    r"clean and age[- ]appropriate|"
    r"typical for a ya|would be clean|age[- ]appropriate, not|"
    r"age[- ]appropriate romantic subplot|not a major plot thread|"
    r"ya[- ]level clean|clean romantic subplot|"
    r"young adult.{0,40}(?:not|without).{0,30}(?:mature|explicit|adult romance)",
    re.IGNORECASE,
)

CLEAN_YA_AUDIENCE_RE = re.compile(
    r"\b(?:published (?:and marketed )?as (?:a )?(?:young adult|ya)|"
    r"(?:young adult|ya) fantasy with a teenage protagonist|teenage protagonist|typical for a ya)\b",
    re.IGNORECASE,
)

SENSITIVE_MERGE_IDS = frozenset(
    {
        "lgbtq",
        "adult_romance",
        "illegitimate_children",
        "group_demonization",
        "pro_colonial_narrative",
        "crude_profanity",
    }
)

CRUDE_PROFANITY_ABSENT_RE = re.compile(
    r"no (?:information to suggest|evidence of).{0,48}(?:harsh swearing|crude profanity|profan)|"
    r"no harsh swearing|does not contain.{0,48}profan|without harsh swearing|no crude profanity",
    re.IGNORECASE,
)

FAMILY_NEGATIVE_ABSENT_RE = re.compile(
    r"(?:are|is) not portrayed as (?:unfair|hostile|villain)|"
    r"family members themselves are not portrayed|"
    r"not portrayed as unfair, hostile, or villainized",
    re.IGNORECASE,
)


def is_clean_ya_only_brief(tid: str, brief: str) -> bool:
    b = str(brief or "").strip()
    if not b:
        return False
    if tid == "romantic_tension" and ADULT_ROMANCE_ABSENT_RE.search(b):
        return True
    if tid in ("romantic_tension", "teen_ya_age") and CLEAN_YA_AUDIENCE_RE.search(b):
        return True
    return False


def lgbtq_affirmative_evidence(text: str) -> bool:
    t = str(text or "")
    if not t.strip():
        return False
    if EXPLICIT_LGBTQ_IN_STORY_RE.search(t):
        return True
    if not LGBTQ_EVIDENCE_RE.search(t):
        return False
    if theme_brief_is_projection_only(t) and not EXPLICIT_LGBTQ_IN_STORY_RE.search(t):
        return False
    stripped = t
    for pat in (
        r"\bno[^.!?]{0,120}lgbtq[^.!?]*",
        r"\b(?:not|no)\s+confirmed\s+on[- ]page[^.!?]*",
        r"\bperceived subtext is reader projection[^.!?]*",
        r"\breader (?:speculation|projection)[^.!?]*",
        r"\b(?:does|do) not (?:contain|include|feature|indicate)[^.!?]{0,96}lgbtq[^.!?]*",
    ):
        stripped = re.sub(pat, " ", stripped, flags=re.I)
    stripped = re.sub(r"\s+", " ", stripped).strip()
    if not stripped or LGBTQ_ABSENT_RE.search(stripped):
        return False
    return bool(LGBTQ_EVIDENCE_RE.search(stripped))


def theme_brief_denies_presence(tid: str, brief: str) -> bool:
    b = str(brief or "").strip()
    if not b:
        return False
    if tid == "lgbtq" and LGBTQ_ABSENT_RE.search(b):
        return True
    if tid == "adult_romance" and ADULT_ROMANCE_ABSENT_RE.search(b):
        return True
    if tid == "romantic_tension" and is_clean_ya_only_brief(tid, b):
        return True
    if tid == "crude_profanity" and CRUDE_PROFANITY_ABSENT_RE.search(b):
        return True
    if tid == "family_portrayed_negatively" and FAMILY_NEGATIVE_ABSENT_RE.search(b):
        return True
    if re.search(
        r"there is no (?:information|evidence|confirmed)|does not (?:contain|include|feature|center)|the plot does not|"
        r"no indication that|reader (?:speculation|projection)|perceived subtext is reader projection|not identified in reviews",
        b,
        re.I,
    ):
        return True
    return False


def enforce_absent_briefs(themes_out: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for row in themes_out:
        tid = str(row.get("id") or "")
        brief = str(row.get("brief") or "")
        if theme_brief_denies_presence(tid, brief):
            row["present"] = False
    return themes_out


def theme_brief_is_projection_only(text: str) -> bool:
    t = str(text or "")
    if not t.strip():
        return False
    if EXPLICIT_LGBTQ_IN_STORY_RE.search(t):
        return False
    return bool(PROJECTION_ONLY_RE.search(t))


def downgrade_projection_themes(themes_out: list[dict[str, Any]], series_note: str) -> list[dict[str, Any]]:
    for row in themes_out:
        if not row.get("present"):
            continue
        brief = str(row.get("brief") or "")
        tid = str(row.get("id") or "")
        if tid == "lgbtq" and theme_brief_is_projection_only(brief):
            row["present"] = False
            if not LGBTQ_ABSENT_RE.search(brief):
                row["brief"] = (
                    (brief + " ").strip()
                    + "Reader speculation or subtext only—not confirmed on-page LGBTQ representation."
                ).strip()
        elif tid in ("deity_mythology", "romantic_tension") and theme_brief_is_projection_only(brief):
            row["present"] = False
    return themes_out


def cors_headers(handler: BaseHTTPRequestHandler) -> None:
    origin = handler.headers.get("Origin") or ""
    if origin:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Access-Control-Allow-Credentials", "true")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Vary", "Origin")


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    cors_headers(handler)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


COVER_PROMPT = """You identify children's and young-reader books from a photo of the front cover only.
Return ONLY valid JSON:
{
  "confidence": "high|medium|low|none",
  "title": "book title without series marketing fluff",
  "author": "primary author or empty string",
  "isGraphicFormat": true/false,
  "alternatives": [{"title": "...", "author": "...", "isGraphicFormat": false}],
  "brief": "one short sentence about what you see"
}
Rules:
- If this is not a book cover or text is unreadable, use confidence "none" and empty title.
- Do not guess wildly; prefer "none" over a wrong famous book.
- alternatives: up to 3 other plausible matches when confidence is not high.
- isGraphicFormat true for comics, manga, graphic novels."""

SHELF_PROMPT = """You read book titles from a photo of a real bookshelf (spines and/or front covers facing out).
Return ONLY valid JSON:
{
  "books": [
    {
      "title": "book title without marketing fluff",
      "author": "primary author — required when readable",
      "confidence": "high|medium|low",
      "status": "ok|obstruction|author_unclear|partial"
    }
  ],
  "incomplete": [
    {
      "title": "partial or blocked title if any letters are clear, else empty",
      "author": "",
      "confidence": "low",
      "status": "obstruction|author_unclear|partial"
    }
  ],
  "brief": "one short sentence about the photo"
}
Rules:
- List every distinct book you can reasonably read from the photo (max 40 total across books + incomplete).
- Prefer spine text when books are spine-out; use cover text when face-out.
- Author is NOT optional for a successful read. Many books share the same title (e.g. Dust, Grim). Never invent an author. Never attach a famous author because the title sounds familiar.
- Put a book in "books" only when BOTH title AND author are clearly lettered in the image (status "ok").
- If the title is readable but the author is not, put it in "incomplete" with status "author_unclear" — do not guess the author.
- If part of the book is blocked (finger, another book, shelf lip, glare, shadow covering letters), do NOT invent the missing text. Put it in "incomplete" with status "obstruction" (include any clear partial title; leave author empty if unknown).
- If only a fragment is readable, status "partial" in "incomplete" — never complete it from memory.
- Do NOT invent famous titles that are not clearly visible. Do NOT substitute a similar-sounding popular title (wrong Unicorn book, wrong Dreamers book, etc.). Prefer omit over a wrong guess.
- If no books are readable, return books: [] and incomplete: []."""


def log_lookup(
    title: str,
    author: str,
    *,
    from_scanner: bool = False,
    handler: BaseHTTPRequestHandler | None = None,
    entered_title: str = "",
    entered_author: str = "",
) -> None:
    if is_garbage_lookup(title, author):
        if from_scanner:
            log_scanner_alert(title, author, "bookcheck_attempt")
        return
    user = session_user(handler) if handler else None
    record_bookcheck_lookup(
        LOG_PATH,
        title=title,
        author=author,
        entered_title=entered_title or title,
        entered_author=entered_author if entered_author is not None else author,
        account_id=user["id"] if user else None,
    )


def build_prompt(title: str, author: str, is_graphic: bool, review_snippets: str = "") -> str:
    theme_lines = "\n".join(f'- "{tid}": {desc}' for tid, desc in THEME_SPECS)
    graphic_note = (
        "This edition may be a comic, manga, or graphic novel. "
        "Do NOT assess fanservice, sexualized art, or panel presentation—only text/plot themes below."
        if is_graphic
        else ""
    )
    review_block = ""
    if review_snippets.strip():
        review_block = f"""
Review snippets (from web search — prefer this evidence over memory when it speaks to a theme):
{review_snippets.strip()}

If snippets mention profanity, LGBTQ content, romance, violence, or teen/YA marketing, reflect that in theme present and brief.
If snippets are silent on a theme, say so—do not mark present true while your brief denies the theme.
"""
    return f"""You help Halalit (a family-oriented book guide) detect whether a book likely contains specific content themes.
You are NOT deciding if the book is appropriate—only whether each theme appears to be present in the story.

Book: "{title}"{f' by {author}' if author else ''}
{graphic_note}
{review_block}
For each theme id below, answer present (true/false) and confidence (high/medium/low/unknown).
Base your answer on known plot summaries, professional reviews, series reputation, and author statements—not only the title.
If review snippets are provided above, weigh them heavily. If unsure for most themes, use present false and confidence unknown.

CRITICAL — theme "lgbtq" (read carefully):
- Mark present TRUE for confirmed on-page representation—not fan speculation alone.
- Counts as present: gay/lesbian/bi/pan/ace/aro/queer characters; transgender or non-binary characters;
  same-sex parents or couples; they/them used as character identity; in-story dialogue naming same-sex
  attraction; AND on-page same-sex / same-gender romance, crush, dating, or couple (including soft all-ages
  graphic novels where two girls or two boys are a romantic pair even if reviewers never say "LGBTQ").
- If romantic_tension is TRUE because two same-gender characters date/crush/pair romantically, lgbtq.present
  MUST also be TRUE—do not file that only under romantic_tension.
- Mark present FALSE for: fan shipping, "could be read as queer," subtext-only Goodreads/review speculation,
  "I hope they make them gay," ambiguous close friendship with no on-page romantic/identity beat named,
  or "not openly LGBTQ" with no explicit in-story beat.
- Mark present FALSE for forced/magic gender-change alone (villain cursed, body-theft, magical sex swap) when there is
  no affirming LGBTQ identity arc—use forced_gender_magic instead.
- Do NOT require the main plot to center on LGBTQ. One supporting character or one explicit line is enough.
- If you mention confirmed on-page LGBTQ or same-sex romance in brief or seriesNote, lgbtq.present MUST be true.
- If only reader projection/subtext is discussed, lgbtq.present MUST be false and say so in brief.

CRITICAL — theme "forced_gender_magic":
- Mark present TRUE when a character is forced or magically changed into another sex/gender (curse, body-theft,
  disastrous spell, villain transformation) WITHOUT an affirming LGBTQ identity/coming-out arc.
- Mark present FALSE when the story is affirming transgender/non-binary identity—that belongs under lgbtq instead.
- In brief, say it is not affirming LGBTQ advocacy but may still feel uncomfortable for LGBTQ-avoiders.

CRITICAL — theme "deity_mythology":
- Mark present TRUE for gods, spirits, religious afterlife, or real-world mythology treated as real.
- Mark present FALSE for invented fantasy species named "demons" or "fairies" in a made-up world when there is
  no worship, hell/heaven theology, or real religious pantheon—library tag "Demonology" alone is not enough.

CRITICAL — theme "romantic_tension":
- Mark present TRUE for on-page crushes, dating, or a clean romantic subplot at a middle-grade / all-ages level—not mere friendship or fan shipping.
- Mark present FALSE for reader speculation that two friends "might" be a couple with no on-page romance beat.
- Mark present FALSE when the romance is college/new-adult, mature-rated, or explicit—that belongs under adult_romance instead.

CRITICAL — theme "adult_romance":
- Mark present TRUE when a mature-rated or explicit romantic relationship is a major plot thread: college/university romance,
  new-adult fiction, open-door/explicit sexual content in the romance, or series reputation as mature romance (e.g. Off-Campus, hockey romance NA lines).
- Mark present FALSE for clean all-ages crush/dating, chaste romance within marriage, or Islamic/clean romance that stays within marriage and avoids explicit detail.
- Mark present FALSE when the book is YA with only age-appropriate crush/dating—even if you mention "mature-rated" in the brief to explain what is NOT in the book.
- In brief, name the ROMANCE LEVEL in plain words (e.g. "mature-rated college romance, explicit adult relationship central to plot")—not just "two characters are in a relationship."
- Do NOT use the word "steamy" in brief or seriesNote—say mature-rated, explicit, or new-adult instead.

CRITICAL — theme "crude_profanity":
- Mark present TRUE only when harsh swearing, slurs, or crude profanity appears in dialogue or narration (e.g. f-word, sh-word, crude insults).
- Mark present FALSE when reviews do not mention swearing or you are unsure—do NOT mark present true while saying there is no profanity.
- If present is false, brief may note absence; if present is true, name the kind of language in plain words.

Theme ids:
{theme_lines}

Return ONLY valid JSON:
{{
  "themes": [
    {{ "id": "lgbtq", "present": false, "confidence": "high", "brief": "one sentence" }}
  ],
  "seriesNote": "optional short note if series-wide vs one volume matters"
}}"""


def _lgbtq_theme_row(themes_out: list[dict[str, Any]]) -> dict[str, Any] | None:
    for row in themes_out:
        if row.get("id") == "lgbtq":
            return row
    return None


def enforce_lgbtq_theme(themes_out: list[dict[str, Any]], series_note: str) -> list[dict[str, Any]]:
    """Correct obvious false negatives when model prose still mentions LGBTQ."""
    themes_out = downgrade_projection_themes(themes_out, series_note)
    row = _lgbtq_theme_row(themes_out)
    if row and row.get("present") and theme_brief_is_projection_only(str(row.get("brief") or "")):
        row["present"] = False
        return themes_out
    if row and not row.get("present"):
        lgbtq_brief = str(row.get("brief") or "")
        other_parts = [series_note or ""]
        for theme_row in themes_out:
            if theme_row.get("id") in ("lgbtq", "forced_gender_magic"):
                continue
            other_parts.append(str(theme_row.get("brief") or ""))
        other_blob = " ".join(other_parts)
        if LGBTQ_ABSENT_RE.search(lgbtq_brief) and not lgbtq_affirmative_evidence(other_blob):
            return themes_out

    blob_parts = [series_note or ""]
    for theme_row in themes_out:
        if theme_row.get("id") == "lgbtq" and row is theme_row and not row.get("present"):
            continue
        if theme_row.get("id") == "forced_gender_magic":
            continue
        blob_parts.append(str(theme_row.get("brief") or ""))
    blob = " ".join(blob_parts)
    if not blob.strip():
        return themes_out
    if LGBTQ_ABSENT_RE.search(blob) and not lgbtq_affirmative_evidence(blob):
        return themes_out
    if theme_brief_is_projection_only(blob) and not EXPLICIT_LGBTQ_IN_STORY_RE.search(blob):
        return themes_out
    if not lgbtq_affirmative_evidence(blob):
        return themes_out
    if row and row.get("present"):
        return themes_out
    if not row:
        row = {"id": "lgbtq", "present": True, "confidence": "medium", "brief": ""}
        themes_out.append(row)
    row["present"] = True
    brief_now = str(row.get("brief") or "")
    if not brief_now or LGBTQ_ABSENT_RE.search(brief_now) or theme_brief_denies_presence("lgbtq", brief_now):
        row["brief"] = "Same-sex or LGBTQ representation noted in scan text."
    if row.get("confidence") in ("unknown", "low", ""):
        row["confidence"] = "medium"
    return themes_out


MATURE_ADULT_ROMANCE_RE = re.compile(
    r"\b(?:college|university|campus|new adult|\bna fiction\b|mature[- ]rated|explicit|open[- ]door|"
    r"sexual content|erotic romance|graphic romance|off[- ]campus|hockey romance)\b",
    re.IGNORECASE,
)

EXPLICIT_ADULT_ROMANCE_RE = re.compile(
    r"\b(?:explicit|open[- ]door|sexual content|sex scenes|erotic romance|graphic romance)\b",
    re.IGNORECASE,
)


def blob_affirms_mature_romance(blob: str) -> bool:
    b = str(blob or "")
    if ADULT_ROMANCE_ABSENT_RE.search(b):
        return False
    for m in MATURE_ADULT_ROMANCE_RE.finditer(b):
        window = b[max(0, m.start() - 42) : m.start()].lower()
        if re.search(r"\b(?:not|no|without|isn't|aren't|doesn't|do not|would be clean)\s*$", window):
            continue
        return True
    return False


def _theme_row(themes_out: list[dict[str, Any]], tid: str) -> dict[str, Any] | None:
    for row in themes_out:
        if row.get("id") == tid:
            return row
    return None


def enforce_adult_romance_theme(themes_out: list[dict[str, Any]], series_note: str) -> list[dict[str, Any]]:
    blob_parts = [series_note or ""]
    for row in themes_out:
        blob_parts.append(str(row.get("brief") or ""))
    blob = " ".join(blob_parts)
    adult = _theme_row(themes_out, "adult_romance")
    if adult and theme_brief_denies_presence("adult_romance", str(adult.get("brief") or "")):
        adult["present"] = False
        return themes_out
    if not blob_affirms_mature_romance(blob):
        return themes_out

    tension = _theme_row(themes_out, "romantic_tension")
    if not adult:
        adult = {"id": "adult_romance", "present": True, "confidence": "medium", "brief": ""}
        themes_out.append(adult)
    else:
        adult["present"] = True

    if tension and tension.get("present") and blob_affirms_mature_romance(
        str(tension.get("brief") or "") + " " + blob
    ):
        tension["present"] = False

    brief = str(adult.get("brief") or "").strip()
    if not brief or not re.search(r"mature|rated|explicit|college|new adult", brief, re.I):
        if EXPLICIT_ADULT_ROMANCE_RE.search(blob) and blob_affirms_mature_romance(blob):
            adult["brief"] = "Explicit mature-rated romance is central to the plot—not all-ages."
        elif re.search(r"college|university|campus", blob, re.I) and blob_affirms_mature_romance(blob):
            adult["brief"] = "Mature-rated college romance is central to the plot—not all-ages."
        elif blob_affirms_mature_romance(blob):
            adult["brief"] = "Mature-rated romantic relationship is a major plot thread—not all-ages."
    if adult.get("confidence") in ("unknown", "low", ""):
        adult["confidence"] = "medium"
    return themes_out



FORCED_GENDER_MAGIC_RE = re.compile(
    r"\b(?:forced|magic(?:al)?|curse(?:d)?|spell|stolen|steal(?:s|ing)?|disastrous|body[- ]swap|"
    r"gender[- ](?:change|swap|transform)|transformed into (?:a )?(?:man|woman|girl|boy)|"
    r"becomes? (?:a )?(?:woman|man|girl|boy) through)\b",
    re.IGNORECASE,
)
NON_AFFIRMING_GENDER_MAGIC_RE = re.compile(
    r"\b(?:not (?:an? )?(?:lgbtq|identity|affirming)|no (?:identity|affirming) arc|villain|antagonist|"
    r"irredeemabl|evil|not treated as|does not promote|forced|curse|stolen magic|body[- ]theft)\b",
    re.IGNORECASE,
)


def brief_looks_like_forced_gender_magic(text: str) -> bool:
    t = str(text or "")
    if not t.strip():
        return False
    return bool(FORCED_GENDER_MAGIC_RE.search(t) and NON_AFFIRMING_GENDER_MAGIC_RE.search(t))


def enforce_forced_gender_magic_theme(
    themes_out: list[dict[str, Any]], series_note: str
) -> list[dict[str, Any]]:
    """Soft caution for forced/magic gender-change; never hard-reject as LGBTQ."""
    forced = None
    lgbtq = None
    blob_parts = [series_note or ""]
    for row in themes_out:
        if row.get("id") == "forced_gender_magic":
            forced = row
        elif row.get("id") == "lgbtq":
            lgbtq = row
        if row.get("id") != "forced_gender_magic":
            blob_parts.append(str(row.get("brief") or ""))
    blob = " ".join(blob_parts)
    forced_brief = str((forced or {}).get("brief") or "")
    if forced and theme_brief_denies_presence("forced_gender_magic", forced_brief):
        forced["present"] = False
        return themes_out
    if (
        (forced and forced.get("present"))
        or brief_looks_like_forced_gender_magic(forced_brief)
        or brief_looks_like_forced_gender_magic(blob)
    ):
        if not forced:
            forced = {
                "id": "forced_gender_magic",
                "present": True,
                "confidence": "medium",
                "brief": (
                    "Forced or magic gender-change beat—not affirming LGBTQ advocacy; "
                    "may still feel uncomfortable for LGBTQ-avoiders."
                ),
            }
            themes_out.append(forced)
        else:
            forced["present"] = True
            if not str(forced.get("brief") or "").strip():
                forced["brief"] = (
                    "Forced or magic gender-change beat—not affirming LGBTQ advocacy; "
                    "may still feel uncomfortable for LGBTQ-avoiders."
                )
        if lgbtq and lgbtq.get("present"):
            other = [series_note or ""]
            for row in themes_out:
                if row.get("id") in ("lgbtq", "forced_gender_magic"):
                    continue
                other.append(str(row.get("brief") or ""))
            if not lgbtq_affirmative_evidence(" ".join(other)):
                lgbtq_brief = str(lgbtq.get("brief") or "")
                if brief_looks_like_forced_gender_magic(lgbtq_brief) or not EXPLICIT_LGBTQ_IN_STORY_RE.search(
                    lgbtq_brief
                ):
                    lgbtq["present"] = False
                    if not LGBTQ_ABSENT_RE.search(lgbtq_brief):
                        lgbtq["brief"] = (
                            (lgbtq_brief.rstrip() + " ") if lgbtq_brief else ""
                        ) + "Not affirming LGBTQ identity—forced/magic gender-change only."
    return themes_out


def strip_json_fences(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def themes_from_parsed(parsed: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    themes_out: list[dict[str, Any]] = []
    for item in parsed.get("themes") or []:
        tid = str(item.get("id") or "").strip()
        if tid not in THEME_IDS:
            continue
        themes_out.append(
            {
                "id": tid,
                "present": bool(item.get("present")),
                "confidence": str(item.get("confidence") or "unknown"),
                "brief": str(item.get("brief") or "")[:280],
            }
        )
    series_note = str(parsed.get("seriesNote") or "")[:400]
    themes_out = enforce_lgbtq_theme(themes_out, series_note)
    themes_out = enforce_adult_romance_theme(themes_out, series_note)
    themes_out = enforce_forced_gender_magic_theme(themes_out, series_note)
    themes_out = enforce_absent_briefs(themes_out)
    return themes_out, series_note


def _confidence_at_least(a: str, b: str) -> str:
    return a if CONFIDENCE_RANK.get(a, 0) >= CONFIDENCE_RANK.get(b, 0) else b


def _pick_brief(a: str, b: str) -> str:
    a = (a or "").strip()
    b = (b or "").strip()
    if not a:
        return b
    if not b:
        return a
    if len(b) > len(a) + 12:
        return b
    if len(a) > len(b) + 12:
        return a
    return b if ";" not in b and ";" in a else a


def _merge_sensitive_present(tid: str, prev: dict[str, Any], row: dict[str, Any]) -> bool:
    prev_present = bool(prev.get("present"))
    row_present = bool(row.get("present"))
    prev_brief = str(prev.get("brief") or "")
    row_brief = str(row.get("brief") or "")
    prev_affirm = prev_present and not theme_brief_denies_presence(tid, prev_brief)
    row_affirm = row_present and not theme_brief_denies_presence(tid, row_brief)
    prev_deny = theme_brief_denies_presence(tid, prev_brief) or (
        tid == "lgbtq" and not prev_present and LGBTQ_ABSENT_RE.search(prev_brief)
    )
    row_deny = theme_brief_denies_presence(tid, row_brief) or (
        tid == "lgbtq" and not row_present and LGBTQ_ABSENT_RE.search(row_brief)
    )
    if prev_affirm and row_affirm:
        return True
    if (prev_affirm and row_deny) or (row_affirm and prev_deny):
        return False
    return prev_affirm or row_affirm


def merge_theme_scans(*scans: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    by_id: dict[str, dict[str, Any]] = {}
    notes: list[str] = []
    for scan in scans:
        if not scan or not scan.get("ok"):
            continue
        note = str(scan.get("seriesNote") or "").strip()
        if note and note not in notes:
            notes.append(note)
        for row in scan.get("themes") or []:
            tid = str(row.get("id") or "").strip()
            if not tid:
                continue
            prev = by_id.get(tid)
            if not prev:
                by_id[tid] = dict(row)
                continue
            if tid in SENSITIVE_MERGE_IDS:
                present = _merge_sensitive_present(tid, prev, row)
            else:
                present = bool(prev.get("present")) or bool(row.get("present"))
            brief = _pick_brief(str(prev.get("brief") or ""), str(row.get("brief") or ""))
            conf = _confidence_at_least(str(prev.get("confidence") or "unknown"), str(row.get("confidence") or "unknown"))
            by_id[tid] = {"id": tid, "present": present, "confidence": conf, "brief": brief}
    series_note = " ".join(notes)[:400]
    merged = list(by_id.values())
    merged = enforce_lgbtq_theme(merged, series_note)
    merged = enforce_adult_romance_theme(merged, series_note)
    merged = enforce_forced_gender_magic_theme(merged, series_note)
    merged = enforce_absent_briefs(merged)
    return merged, series_note


def call_claude(title: str, author: str, is_graphic: bool, review_snippets: str = "") -> dict[str, Any]:
    if not ANTHROPIC_KEY:
        return {"ok": False, "error": "claude_unconfigured", "message": "Anthropic API key is not configured on the server."}

    prompt = build_prompt(title, author, is_graphic, review_snippets)
    body = json.dumps(
        {
            "model": CLAUDE_MODEL,
            "max_tokens": 2048,
            "temperature": 0.2,
            "system": "Return only valid JSON matching the requested schema. No markdown fences.",
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        CLAUDE_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=55, context=ssl.create_default_context()) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="replace")[:400]
        except Exception:
            detail = str(e)
        return {"ok": False, "error": "claude_http_error", "message": detail}
    except Exception as e:
        return {"ok": False, "error": "claude_request_failed", "message": str(e)}

    text = ""
    try:
        for block in raw.get("content") or []:
            if block.get("type") == "text":
                text += block.get("text") or ""
    except (TypeError, AttributeError):
        return {"ok": False, "error": "claude_bad_response", "message": "No text from Claude."}
    text = strip_json_fences(text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {"ok": False, "error": "claude_parse_error", "message": text[:300]}

    themes_out, series_note = themes_from_parsed(parsed)
    return {
        "ok": True,
        "themes": themes_out,
        "seriesNote": series_note,
        "fanserviceSkipped": True,
        "model": CLAUDE_MODEL,
        "provider": "claude",
    }


def call_theme_scan(title: str, author: str, is_graphic: bool) -> dict[str, Any]:
    """Run web review lookup, then Gemini theme scan. Shared disk cache skips AI on repeats."""
    if not KEY:
        return {"ok": False, "error": "ai_unconfigured", "message": "No Gemini theme scan key configured on the server."}

    cached = get_cached_theme_scan(title, author, is_graphic)
    if cached is not None:
        return cached

    review = fetch_review_snippets(title, author)
    review_block = ""
    if review.get("ok"):
        review_block = format_review_snippets_for_prompt(review.get("snippets") or [])

    gemini = call_gemini(title, author, is_graphic, review_block)
    if not gemini.get("ok"):
        return {
            "ok": False,
            "error": gemini.get("error") or "ai_failed",
            "message": gemini.get("message") or "Theme scan failed.",
        }

    out: dict[str, Any] = {
        "ok": True,
        "themes": gemini.get("themes") or [],
        "seriesNote": gemini.get("seriesNote") or "",
        "fanserviceSkipped": True,
        "dualScan": False,
        "model": MODEL,
        "geminiModel": MODEL,
        "claudeModel": None,
        "geminiOk": True,
        "claudeOk": False,
        "claudeSkipped": True,
        "claudeSkipReason": "gemini_only_policy",
        "reviewSearchUsed": bool(review.get("ok")),
        "reviewSearchProvider": review.get("provider"),
        "reviewSnippetCount": len(review.get("snippets") or []),
        "reviewSearchError": review.get("error") if not review.get("ok") else None,
    }
    put_cached_theme_scan(title, author, is_graphic, out)
    return out


def call_gemini(title: str, author: str, is_graphic: bool, review_snippets: str = "") -> dict[str, Any]:
    if not KEY:
        return {"ok": False, "error": "ai_unconfigured", "message": "AI theme scan is not configured on the server."}

    prompt = build_prompt(title, author, is_graphic, review_snippets)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={urllib.parse.quote(KEY, safe='')}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45, context=ssl.create_default_context()) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="replace")[:400]
        except Exception:
            detail = str(e)
        return {"ok": False, "error": "ai_http_error", "message": detail}
    except Exception as e:
        return {"ok": False, "error": "ai_request_failed", "message": str(e)}

    text = ""
    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return {"ok": False, "error": "ai_bad_response", "message": "No text from model."}

    text = strip_json_fences(text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {"ok": False, "error": "ai_parse_error", "message": text[:300]}

    themes_out, series_note = themes_from_parsed(parsed)

    return {
        "ok": True,
        "themes": themes_out,
        "seriesNote": series_note,
        "fanserviceSkipped": True,
        "model": MODEL,
        "provider": "gemini",
    }


def call_gemini_cover(image_b64: str, mime: str) -> dict[str, Any]:
    if not KEY:
        return {"ok": False, "error": "ai_unconfigured", "message": "Cover scan is not configured on the server."}
    if not image_b64 or len(image_b64) > 4_500_000:
        return {"ok": False, "error": "image_invalid", "message": "Image missing or too large."}

    mime = (mime or "image/jpeg").split(";")[0].strip() or "image/jpeg"
    if not mime.startswith("image/"):
        mime = "image/jpeg"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={urllib.parse.quote(KEY, safe='')}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": COVER_PROMPT},
                    {"inline_data": {"mime_type": mime, "data": image_b64}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.15,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=55, context=ssl.create_default_context()) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="replace")[:400]
        except Exception:
            detail = str(e)
        return {"ok": False, "error": "ai_http_error", "message": detail}
    except Exception as e:
        return {"ok": False, "error": "ai_request_failed", "message": str(e)}

    text = ""
    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return {"ok": False, "error": "ai_bad_response", "message": "No text from model."}

    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {"ok": False, "error": "ai_parse_error", "message": text[:300]}

    conf = str(parsed.get("confidence") or "none").lower()
    if conf not in ("high", "medium", "low", "none"):
        conf = "none"

    alts_out = []
    for item in (parsed.get("alternatives") or [])[:3]:
        if not isinstance(item, dict):
            continue
        t = str(item.get("title") or "").strip()[:300]
        if not t:
            continue
        alts_out.append(
            {
                "title": t,
                "author": str(item.get("author") or "").strip()[:200],
                "isGraphicFormat": bool(item.get("isGraphicFormat")),
            }
        )

    title = str(parsed.get("title") or "").strip()[:300]
    author = str(parsed.get("author") or "").strip()[:200]

    if conf == "none" or not title:
        return {
            "ok": True,
            "confidence": "none",
            "title": "",
            "author": "",
            "isGraphicFormat": False,
            "alternatives": alts_out,
            "brief": str(parsed.get("brief") or "")[:280],
            "imageDiscarded": True,
            "model": MODEL,
        }

    return {
        "ok": True,
        "confidence": conf,
        "title": title,
        "author": author,
        "isGraphicFormat": bool(parsed.get("isGraphicFormat")),
        "alternatives": alts_out,
        "brief": str(parsed.get("brief") or "")[:280],
        "imageDiscarded": True,
        "model": MODEL,
    }


def call_gemini_shelf(image_b64: str, mime: str) -> dict[str, Any]:
    if not KEY:
        return {"ok": False, "error": "ai_unconfigured", "message": "Shelf scan is not configured on the server."}
    if not image_b64 or len(image_b64) > 4_500_000:
        return {"ok": False, "error": "image_invalid", "message": "Image missing or too large."}

    mime = (mime or "image/jpeg").split(";")[0].strip() or "image/jpeg"
    if not mime.startswith("image/"):
        mime = "image/jpeg"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={urllib.parse.quote(KEY, safe='')}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": SHELF_PROMPT},
                    {"inline_data": {"mime_type": mime, "data": image_b64}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=75, context=ssl.create_default_context()) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="replace")[:400]
        except Exception:
            detail = str(e)
        return {"ok": False, "error": "ai_http_error", "message": detail}
    except Exception as e:
        return {"ok": False, "error": "ai_request_failed", "message": str(e)}

    text = ""
    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return {"ok": False, "error": "ai_bad_response", "message": "No text from model."}

    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {"ok": False, "error": "ai_parse_error", "message": text[:300]}

    books_out: list[dict[str, Any]] = []
    incomplete_out: list[dict[str, Any]] = []
    seen: set[str] = set()

    def _norm_status(raw: str, has_author: bool) -> str:
        s = (raw or "").strip().lower()
        if s in ("ok", "obstruction", "author_unclear", "partial"):
            return s
        if not has_author:
            return "author_unclear"
        return "ok"

    def _append_book(item: dict[str, Any], *, force_incomplete: bool = False) -> None:
        title = str(item.get("title") or "").strip()[:300]
        if not title and not force_incomplete:
            return
        author = str(item.get("author") or "").strip()[:200]
        conf = str(item.get("confidence") or "medium").lower()
        if conf not in ("high", "medium", "low"):
            conf = "medium"
        status = _norm_status(str(item.get("status") or ""), bool(author))
        if force_incomplete and status == "ok":
            status = "partial" if title else "obstruction"
        key = re.sub(r"\s+", " ", title.lower()) + "|" + re.sub(r"\s+", " ", author.lower()) + "|" + status
        if key in seen:
            return
        seen.add(key)
        row = {"title": title, "author": author, "confidence": conf, "status": status}
        if status != "ok" or not author or force_incomplete:
            if not title and status == "obstruction":
                row["title"] = "(obstruction)"
            row["confidence"] = "low"
            if status == "ok":
                row["status"] = "author_unclear"
            incomplete_out.append(row)
            return
        books_out.append(row)

    for item in (parsed.get("books") or [])[:40]:
        if isinstance(item, dict):
            _append_book(item)

    for item in (parsed.get("incomplete") or [])[:40]:
        if isinstance(item, dict):
            _append_book(item, force_incomplete=True)

    # Cap total rows returned
    if len(books_out) + len(incomplete_out) > 40:
        room = max(0, 40 - len(books_out))
        incomplete_out = incomplete_out[:room]

    return {
        "ok": True,
        "books": books_out,
        "incomplete": incomplete_out,
        "brief": str(parsed.get("brief") or "")[:280],
        "imageDiscarded": True,
        "model": MODEL,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        cors_headers(self)
        self.end_headers()

    def do_GET(self) -> None:
        path = self.path.rstrip("/").split("?")[0]
        if accounts_handle_get(path, self, json_response):
            return
        if bookstore_api_handlers and bookstore_api_handlers.handle_get(
            path, self, json_response, session_user
        ):
            return
        if path in ("/health", "/api/health"):
            json_response(
                self,
                200,
                {
                    "ok": True,
                    "aiConfigured": bool(KEY),
                    "claudeConfigured": bool(ANTHROPIC_KEY),
                    "dualScan": False,
                    "themeScanProvider": "gemini",
                    "model": MODEL,
                    "claudeModel": CLAUDE_MODEL,
                    "coverIdentify": False,
                    "shelfIdentify": False,
                    "accounts": True,
                    "reviewSearchConfigured": True,
                    "braveConfigured": bool(os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()),
                    "libraryCheck": True,
                    "libraryCheckPlace": "santa-clara-central-park",
                    "bookstoreInventory": True,
                },
            )
            return
        json_response(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        path = self.path.rstrip("/").split("?")[0]
        length = int(self.headers.get("Content-Length") or 0)

        if path == "/api/owner/shelf-identify":
            json_response(
                self,
                410,
                {
                    "ok": False,
                    "error": "removed",
                    "message": "Owner shelf photo scan was removed from Halalit (parked on the roadmap).",
                },
            )
            return

        if (
            path.startswith("/api/auth/")
            or path.startswith("/api/user/")
            or path.startswith("/api/owner/")
            or path == "/api/site/flags"
            or path == "/api/scanner/malfunction-report"
            or path == "/api/feedback/submit"
            or path == "/api/lookup/record"
            or path == "/api/lookup/signal"
            or path == "/api/owner/notifications/dismiss"
            or path == "/api/owner/notifications/restore"
            or path == "/api/owner/lookups/backfill-signals"
            or path == "/api/owner/vets/save"
            or path == "/api/owner/vets/save-series"
            or path == "/api/owner/vets/delete"
            or path == "/api/library/suggest"
            or path.startswith("/api/bookstore/")
        ):
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            except (json.JSONDecodeError, UnicodeDecodeError):
                json_response(self, 400, {"ok": False, "error": "invalid_json"})
                return
            if not isinstance(body, dict):
                body = {}
            if accounts_handle_post(path, self, body, json_response):
                return
            if bookstore_api_handlers and bookstore_api_handlers.handle_post(
                path, self, body, json_response, session_user
            ):
                return
            json_response(self, 404, {"ok": False, "error": "not_found"})
            return

        if path == "/api/theme-scan":
            if length > 8192:
                json_response(self, 413, {"ok": False, "error": "payload_too_large"})
                return
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                json_response(self, 400, {"ok": False, "error": "invalid_json"})
                return

            title = str(body.get("title") or "").strip()[:300]
            author = str(body.get("author") or "").strip()[:200]
            is_graphic = bool(body.get("isGraphicFormat"))
            from_scanner = bool(body.get("fromScanner"))

            if not title:
                json_response(self, 400, {"ok": False, "error": "title_required"})
                return

            result = call_theme_scan(title, author, is_graphic)
            if result.get("ok") and not bool(body.get("ownerTesting")):
                try:
                    from owner_lookup_signals import signal_from_theme_scan_result

                    signal_from_theme_scan_result(title, author, result)
                except Exception as e:
                    sys.stderr.write("theme-scan signal upsert failed: %s\n" % (e,))
            status = 200 if result.get("ok") else (503 if result.get("error") == "ai_unconfigured" else 502)
            json_response(self, status, result)
            return

        if path == "/api/cover-identify":
            json_response(
                self,
                410,
                {
                    "ok": False,
                    "error": "removed",
                    "message": "Cover photo identify was removed from Halalit (barcode or type the title).",
                },
            )
            return

        if path == "/api/library/check":
            if length > 8192:
                json_response(self, 413, {"ok": False, "error": "payload_too_large"})
                return
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            except (json.JSONDecodeError, UnicodeDecodeError):
                json_response(self, 400, {"ok": False, "error": "invalid_json"})
                return
            if not isinstance(body, dict):
                body = {}
            title = str(body.get("title") or "").strip()[:300]
            author = str(body.get("author") or "").strip()[:200]
            isbn = str(body.get("isbn") or "").strip()[:32]
            series_name = str(body.get("seriesName") or body.get("series") or "").strip()[:200]
            place_id = str(body.get("placeId") or body.get("place") or "").strip()[:80]
            if not title:
                json_response(self, 400, {"ok": False, "error": "title_required", "status": "uncertain"})
                return
            try:
                result = library_check_title(title, author, isbn, series_name, place_id)
            except Exception as e:
                json_response(
                    self,
                    502,
                    {
                        "ok": False,
                        "status": "uncertain",
                        "error": "library_check_failed",
                        "reason": type(e).__name__,
                        "title": title,
                        "author": author,
                        "placeId": place_id or None,
                    },
                )
                return
            if result.get("error") == "unknown_place":
                json_response(self, 400, result)
                return
            status_code = 400 if result.get("error") == "title_required" else 200
            json_response(self, status_code, result)
            return

        json_response(self, 404, {"ok": False, "error": "not_found"})


def main() -> None:
    if os.environ.get("HALALIT_BOOKSTORE_JOBS", "").strip() in ("1", "true", "yes"):
        try:
            from bookstore_inventory.jobs.scheduler import start_scheduler

            start_scheduler()
        except Exception as e:
            print(f"bookstore jobs not started: {e}")
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(
        f"Halalit Bookcheck theme API on http://{BIND}:{PORT} "
        f"(theme-scan=gemini-only, gemini={'yes' if KEY else 'no'}, bookstore={bool(bookstore_api_handlers)})"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
