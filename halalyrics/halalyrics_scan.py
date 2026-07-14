"""HalaLyrics — Google Gemini lyric scan (classification only, no invented facts)."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Iterator

THEME_IDS = (
    "non_married_romance",
    "non_muslim_religious",
    "sacred_language_casual",
    "dark_despair",
    "profanity_substance",
)

SCAN_PROMPT = """Conservative family music vet for HalaLyrics. Analyze ONLY the lyrics. Strict JSON only:
{"ok":true,"themes":[{"id":"non_married_romance","present":false,"confidence":"low|medium|high","brief":""}, ...all 5 ids...],
"summary":"one short parent paragraph","word_refs":["euphemized only"],"problem_notes":["plain problems"],
"rec_hint":"likely_ok|caution|likely_no_recommend"}

No raw profanity or full lyric lines in output. word_refs: indirect only (the f-word).

Themes (ids must match exactly):
- non_married_romance: FLAG dating/crush/breakup/longing for non-spouse AND intimate togetherness aimed at a partner — collide with me, ride with me, last connection, come/be/stay with me, only us/two, lover/boyfriend/girlfriend, kiss/hold/heartbeat for someone. Adventure/anthem/journey framing does NOT excuse partner-intimacy lines. Brief: "Romantic partner intimacy:" when applicable. OK: married love, fake vows/villain deception, kids-TV wedding words; platonic group adventure with no partner-intimacy phrasing.
- non_muslim_religious: Christian/gospel worship, hymns, prayer-as-worship. Muslim nasheed NOT here.
- sacred_language_casual: casual/mocking God, hell, devil, damnation in secular songs.
- dark_despair: FLAG (a) mental-health despair/suicide/self-harm; (b) ambiguous darkness even if later hopeful — leave world, goodbye to pain, lost/alone, darkness as fate (Skillet redemption: still FLAG; note if fights back). Brief: "Ambiguous dark themes:" or "Mental-health despair:". NOT: hunt/thriller, spooky horror, survival vs enemies only. Redemption does NOT cancel dark opening.
- profanity_substance: FLAG (a) profanity/slurs; (b) ANY drug ref real/metaphorical (tongue, breathe in, body burn, pill/powder/high); (c) alcohol promo; (d) suggestive body-heat (so hot, fever, burning up, on fire about body) — metaphor does NOT excuse. Brief: "Drug reference (metaphor)", "Drug/alcohol", or "Suggestive body-heat language".

Disney/kids: wedding/love words alone OK; ban adult/profanity/real despair.

rec_hint: likely_ok = no flags; caution = ambiguous dark_despair/redemption only; likely_no_recommend = ANY profanity_substance, clear despair, romance, religious, or sacred-language issues.

Opening-weighted excerpt — scan for theme flags.
"""


def _gemini_key() -> str:
    return (
        os.environ.get("HALALYRICS_GEMINI_API_KEY", "").strip()
        or os.environ.get("HALALIT_GEMINI_API_KEY", "").strip()
        or os.environ.get("GEMINI_API_KEY", "").strip()
    )


def _gemini_model() -> str:
    return (
        os.environ.get("HALALYRICS_GEMINI_MODEL", "").strip()
        or "gemini-2.5-flash-lite"
    )


def _scan_lyrics_limit() -> int:
    raw = os.environ.get("HALALYRICS_SCAN_LYRICS_LIMIT", "2800").strip()
    try:
        return max(800, min(int(raw), 6000))
    except ValueError:
        return 2800


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


def _extract_summary_partial(text: str) -> str:
    """Best-effort summary text from incomplete JSON stream."""
    if not text:
        return ""
    m = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)', text)
    if m:
        return m.group(1).replace('\\"', '"').replace("\\n", "\n")
    return ""


def _build_scan_prompt(title: str, artist: str, lyrics: str) -> str:
    """Build prompt without str.format — lyrics and JSON examples contain braces."""
    return (
        SCAN_PROMPT
        + "\n\nSong: "
        + (title or "Unknown")
        + " by "
        + (artist or "Unknown")
        + "\nLyrics:\n"
        + lyrics
    )


def _lyrics_for_scan(lyrics: str, limit: int | None = None) -> str:
    if limit is None:
        limit = _scan_lyrics_limit()
    clipped = (lyrics or "").strip()
    if len(clipped) <= limit:
        return clipped
    head = max(400, limit - 700)
    return clipped[:head] + "\n…[middle omitted]…\n" + clipped[-600:]


def _generation_config() -> dict[str, Any]:
    return {
        "temperature": 0.2,
        "responseMimeType": "application/json",
        "maxOutputTokens": 600,
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

    return {
        "ok": True,
        "model": model,
        "themes": normalized,
        "summary": str(parsed.get("summary") or "")[:1200],
        "word_refs": _string_list(parsed.get("word_refs"), 12, 80),
        "problem_notes": _string_list(parsed.get("problem_notes"), 8, 200),
        "rec_hint": str(parsed.get("rec_hint") or "caution"),
    }


def _gemini_request_body(prompt: str) -> bytes:
    return json.dumps(
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": _generation_config(),
        }
    ).encode("utf-8")


def scan_lyrics(title: str, artist: str, lyrics: str) -> dict[str, Any]:
    key = _gemini_key()
    if not key:
        return {"ok": False, "error": "gemini_key_missing"}
    if not (lyrics or "").strip():
        return {"ok": False, "error": "no_lyrics"}

    clipped = _lyrics_for_scan(lyrics.strip())
    prompt = _build_scan_prompt(title or "Unknown", artist or "Unknown", clipped)
    model = _gemini_model()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(model, safe='')}:generateContent?key={key}"
    )
    req = urllib.request.Request(
        url,
        data=_gemini_request_body(prompt),
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


def scan_lyrics_stream(title: str, artist: str, lyrics: str) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield (event_name, payload) tuples for SSE."""
    key = _gemini_key()
    if not key:
        yield "error", {"ok": False, "error": "gemini_key_missing"}
        return
    if not (lyrics or "").strip():
        yield "error", {"ok": False, "error": "no_lyrics"}
        return

    clipped = _lyrics_for_scan(lyrics.strip())
    prompt = _build_scan_prompt(title or "Unknown", artist or "Unknown", clipped)
    model = _gemini_model()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(model, safe='')}:streamGenerateContent?alt=sse&key={key}"
    )
    req = urllib.request.Request(
        url,
        data=_gemini_request_body(prompt),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    accumulated = ""
    last_summary = ""
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            for raw_line in resp:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                chunk_json = line[5:].strip()
                if not chunk_json or chunk_json == "[DONE]":
                    continue
                try:
                    chunk = json.loads(chunk_json)
                except json.JSONDecodeError:
                    continue
                candidates = chunk.get("candidates") or []
                if not candidates:
                    continue
                parts = (candidates[0].get("content") or {}).get("parts") or []
                delta = "".join(str(p.get("text") or "") for p in parts if isinstance(p, dict))
                if not delta:
                    continue
                accumulated += delta
                summary = _extract_summary_partial(accumulated)
                if summary and summary != last_summary:
                    last_summary = summary
                    yield "partial", {"summary": summary}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        yield "error", {"ok": False, "error": "gemini_http_error", "httpStatus": exc.code, "detail": detail}
        return
    except (urllib.error.URLError, TimeoutError, OSError):
        yield "error", {"ok": False, "error": "gemini_network_error"}
        return

    parsed = _extract_json(accumulated)
    if not parsed:
        yield "error", {"ok": False, "error": "gemini_parse_error", "raw": accumulated[:500]}
        return

    yield "done", _normalize_scan(parsed, model)


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
