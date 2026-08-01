"""HalalFlicks — Google Gemini plot/synopsis scan (classification only)."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

THEME_IDS = (
    "non_married_romance",
    "lgbtq",
    "violence_fright",
    "profanity_substance",
    "adult_sexual",
    "sacred_or_other_faith",
)

SCAN_PROMPT = """Conservative family movie vet for HalalFlicks. Same content lines as Halalit / HalaLyrics: modesty, no LGBTQ, no non-married romance push, no profanity/substance promo. Analyze ONLY the plot/synopsis/notes provided. Strict JSON only:
{"ok":true,"themes":[{"id":"non_married_romance","present":false,"confidence":"low|medium|high","brief":""}, ...all 6 ids...],
"summary":"one short parent paragraph","problem_notes":["plain problems"],
"rec_hint":"likely_ok|caution|likely_no_recommend"}

Do not invent plot details not in the text. If the synopsis is thin, say so and lean caution.

Themes (ids must match exactly):
- non_married_romance: dating/crush/breakup/kissing/partner intimacy for non-spouses; teen romance as a plot driver. OK: married couples, brief family affection, platonic friendship.
- lgbtq: FLAG any LGBTQ identity, romance, pairing, pride framing, or dialogue that affirms LGBTQ as normal/celebrated. Same bar as Halalit Bookcheck. Not excused by "brief" or "background character."
- violence_fright: graphic gore, prolonged torture, intense horror scare aimed at kids, or heavy combat bloodshed as a focus. OK: mild cartoon scuffles, peril without gore, adventure stakes.
- profanity_substance: strong language/slurs; drug or alcohol promotion as cool/central. OK: brief educational "don't do drugs" framing.
- adult_sexual: sexual content, fanservice, immodesty/private-parts focus, suggestive body display, adult romance heat. Includes poster-relevant fanservice in the described film marketing/tone when the text mentions it. OK: fade-to-black marriage context without detail; modest clothed characters.
- sacred_or_other_faith: Christian/gospel worship as central, or casual/mocking use of God/hell/devil in a secular story. Muslim faith content is NOT automatically a flag.

Kids/family films: wedding or "true love" wording alone is OK if not dating-focused; still flag clear teen romance plots.

rec_hint: likely_ok = no flags; caution = thin synopsis or borderline only; likely_no_recommend = ANY clear theme flag above (including lgbtq or adult_sexual/fanservice).
"""


def _gemini_key() -> str:
    return (
        os.environ.get("HALALFLICKS_GEMINI_API_KEY", "").strip()
        or os.environ.get("HALALYRICS_GEMINI_API_KEY", "").strip()
        or os.environ.get("HALALIT_GEMINI_API_KEY", "").strip()
        or os.environ.get("GEMINI_API_KEY", "").strip()
    )


def _gemini_model() -> str:
    return os.environ.get("HALALFLICKS_GEMINI_MODEL", "").strip() or "gemini-2.5-flash-lite"


def _scan_text_limit() -> int:
    raw = os.environ.get("HALALFLICKS_SCAN_TEXT_LIMIT", "4500").strip()
    try:
        return max(800, min(int(raw), 8000))
    except ValueError:
        return 4500


def _extract_json(text: str) -> dict[str, Any] | None:
    text = (text or "").strip()
    if not text:
        return None
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            data = json.loads(text[start : end + 1])
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _string_list(value: Any, cap: int, max_len: int) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = str(item or "").strip()
        if not text:
            continue
        out.append(text[:max_len])
        if len(out) >= cap:
            break
    return out


def _clip_text(text: str, limit: int | None = None) -> str:
    if limit is None:
        limit = _scan_text_limit()
    clipped = (text or "").strip()
    if len(clipped) <= limit:
        return clipped
    return clipped[:limit] + "\n…[truncated]…"


def _build_scan_prompt(title: str, year: str, synopsis: str) -> str:
    return (
        SCAN_PROMPT
        + "\n\nMovie: "
        + (title or "Unknown")
        + ((" (" + year + ")") if year else "")
        + "\nPlot / synopsis / notes:\n"
        + synopsis
    )


def _generation_config() -> dict[str, Any]:
    return {
        "temperature": 0.2,
        "responseMimeType": "application/json",
        "maxOutputTokens": 700,
    }


def _normalize_scan(parsed: dict[str, Any], model: str) -> dict[str, Any]:
    themes = parsed.get("themes")
    if not isinstance(themes, list):
        themes = []

    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in themes:
        if not isinstance(row, dict):
            continue
        tid = str(row.get("id") or "")
        if tid not in THEME_IDS or tid in seen:
            continue
        seen.add(tid)
        normalized.append(
            {
                "id": tid,
                "present": bool(row.get("present")),
                "confidence": str(row.get("confidence") or "unknown"),
                "brief": str(row.get("brief") or "")[:400],
            }
        )
    for tid in THEME_IDS:
        if tid not in seen:
            normalized.append({"id": tid, "present": False, "confidence": "unknown", "brief": ""})

    hint = str(parsed.get("rec_hint") or "caution")
    if hint not in ("likely_ok", "caution", "likely_no_recommend"):
        hint = "caution"

    return {
        "ok": True,
        "model": model,
        "themes": normalized,
        "summary": str(parsed.get("summary") or "")[:1200],
        "problem_notes": _string_list(parsed.get("problem_notes"), 8, 200),
        "rec_hint": hint,
    }


def scan_synopsis(title: str, year: str, synopsis: str) -> dict[str, Any]:
    key = _gemini_key()
    if not key:
        return {"ok": False, "error": "gemini_key_missing"}
    if not (synopsis or "").strip():
        return {"ok": False, "error": "no_synopsis"}

    clipped = _clip_text(synopsis.strip())
    prompt = _build_scan_prompt(title or "Unknown", year or "", clipped)
    model = _gemini_model()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(model, safe='')}:generateContent?key={key}"
    )
    body = json.dumps(
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": _generation_config(),
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        return {"ok": False, "error": "gemini_http_error", "httpStatus": exc.code, "detail": detail}
    except (urllib.error.URLError, TimeoutError, OSError):
        return {"ok": False, "error": "gemini_network_error"}

    candidates = payload.get("candidates") or []
    text = ""
    if candidates:
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(str(p.get("text") or "") for p in parts if isinstance(p, dict))

    parsed = _extract_json(text)
    if not parsed:
        return {"ok": False, "error": "gemini_parse_error", "raw": text[:500]}

    return _normalize_scan(parsed, model)
