"""
Bane of Extinction — owner-beta API.

- POST /api/wildlife-identify  — Gemini + Claude vision ID (photo not stored)
- POST /api/callouts           — Claude helper facts for whatever species was identified
- GET  /api/health

Binds 127.0.0.1 only. Keys from env / shared kids-sites files.
No Wikipedia / no open-web scrape for facts.
"""
from __future__ import annotations

import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

BIND = os.environ.get("BANE_API_BIND", "127.0.0.1")
PORT = int(os.environ.get("BANE_API_PORT", "8086"))
CLAUDE_MODEL = os.environ.get("BANE_ANTHROPIC_MODEL", "claude-sonnet-4-6")
GEMINI_MODEL = os.environ.get(
    "BANE_GEMINI_MODEL",
    os.environ.get("HALALIT_GEMINI_MODEL", "gemini-2.0-flash"),
)
MAX_CALLOUTS = 5
MAX_IMAGE_B64 = 4_500_000

POPPY_DEFAULT = {
    "common": "California poppy",
    "latin": "Eschscholzia californica",
    "cultivar": "Watermelon Heaven",
    "organismType": "flower",
    "anchors": ["petals", "center", "foliage", "habit", "seed_pod"],
}

FALLBACK_CALLOUTS_POPPY = [
    {
        "anchor": "petals",
        "label": "Petals",
        "fact": "California poppy petals look like soft crepe paper. Classic wild blooms are often bright orange-gold; garden forms vary.",
    },
    {
        "anchor": "center",
        "label": "Flower center",
        "fact": "Many forms show a lighter center that stands out in full sun.",
    },
    {
        "anchor": "foliage",
        "label": "Feathery leaves",
        "fact": "Blue-green, finely cut leaves help the plant handle dry, sunny spots.",
    },
    {
        "anchor": "habit",
        "label": "Sun & soil",
        "fact": "Prefers full sun and well-drained or even poor soil. Rich soil or overwatering can mean more leaves, fewer flowers.",
    },
]

FALLBACK_CALLOUTS_SUNFLOWER = [
    {
        "anchor": "head",
        "label": "Flower head",
        "fact": "What looks like one big flower is a head of many tiny flowers. The bright outer ring are ray florets; the center is packed disk florets.",
    },
    {
        "anchor": "disk",
        "label": "Center disk",
        "fact": "The disk turns from greenish buds to brown as seeds form. Bees and other pollinators work this busy middle zone.",
    },
    {
        "anchor": "leaves",
        "label": "Leaves & stem",
        "fact": "Common sunflower leaves are broad and rough. Stems are sturdy and often hairy — built for tall growth in open sun.",
    },
    {
        "anchor": "habit",
        "label": "Sun follower",
        "fact": "Young plants often track the sun across the day (heliotropism). Mature heads usually face a fixed direction, often east.",
    },
]

# Back-compat alias used nowhere new, but keep name for any external refs
FALLBACK_CALLOUTS = FALLBACK_CALLOUTS_POPPY

IDENTIFY_PROMPT = (
    "You identify wildlife, plants, fungi, or clear evidence of them "
    "(tracks, nests, seed pods, chewed plants, bloom patches) for a family-friendly "
    "conservation learning game. Return ONLY JSON.\n"
    "Focus on the organism (or evidence), not people, hands, faces, or private property details.\n"
    "Be as accurate as you reasonably can. Prefer the species (or best clear taxon) you think it is. "
    "If cultivar is unclear, use the species (e.g. California poppy / Eschscholzia californica, "
    "or common sunflower / Helianthus annuus) rather than guessing a garden variety.\n"
    "For sunflowers: prefer Helianthus species when clear (often Helianthus annuus for garden/"
    "field common sunflower). If you only know genus, use Helianthus and say so in shortNote. "
    "Do not invent cultivar names (e.g. Teddy Bear) unless clearly labeled in the photo.\n"
    "For poppies in California-style orange blooms: prefer Eschscholzia californica when that "
    "is the best match; do not invent cultivar names unless clearly labeled.\n"
    "JSON shape:\n"
    "{"
    '"commonName":"...",'
    '"latinName":"...",'
    '"cultivar":"" ,'
    '"organismType":"bird|mammal|flower|plant|fungus|insect|reptile|evidence|other",'
    '"evidence":false,'
    '"confidence":"high|medium|low",'
    '"shortNote":"one short plain sentence",'
    '"alternatives":[{"commonName":"...","latinName":"..."}]'
    "}"
)


def _load_dotenv_file(path: str) -> None:
    try:
        if not path or not os.path.isfile(path):
            return
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'").strip('"')
                if k and k not in os.environ:
                    os.environ[k] = v
    except OSError:
        return


def _bootstrap_env() -> None:
    home = os.path.expanduser("~")
    for path in (
        os.environ.get("BANE_ENV_PATH", "").strip(),
        os.path.join(home, "kids-sites", "bane-server", ".env"),
        os.path.join(home, "kids-sites", "halalit-server", ".env"),
    ):
        _load_dotenv_file(path)


_bootstrap_env()


def _key_paths() -> list[str]:
    paths: list[str] = []
    for env_name in ("BANE_ANTHROPIC_KEY_PATH", "KIDS_SITES_ANTHROPIC_KEY_PATH"):
        p = os.environ.get(env_name, "").strip()
        if p:
            paths.append(p)
    home = os.path.expanduser("~")
    paths.append(os.path.join(home, "kids-sites", "anthropic.key"))
    here = os.path.dirname(os.path.abspath(__file__))
    paths.append(os.path.join(here, "anthropic.key"))
    paths.append(os.path.join(os.path.dirname(here), "anthropic.key"))
    return paths


def anthropic_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    for path in _key_paths():
        try:
            if path and os.path.isfile(path):
                with open(path, encoding="utf-8") as f:
                    k = f.read().strip()
                if k:
                    return k
        except OSError:
            continue
    return ""


def gemini_api_key() -> str:
    for name in (
        "BANE_GEMINI_API_KEY",
        "HALALIT_GEMINI_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
    ):
        k = os.environ.get(name, "").strip()
        if k:
            return k
    return ""


def _cors(handler: BaseHTTPRequestHandler) -> None:
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def _json(handler: BaseHTTPRequestHandler, code: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    _cors(handler)
    handler.end_headers()
    handler.wfile.write(body)


def _extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise RuntimeError("No JSON object in model reply")
    obj = json.loads(m.group(0))
    if not isinstance(obj, dict):
        raise RuntimeError("Model JSON was not an object")
    return obj


def _call_claude_text(system: str, user: str, max_tokens: int = 900) -> str:
    api_key = anthropic_api_key()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    blocks = data.get("content") or []
    text = "".join(
        b.get("text", "")
        for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    ).strip()
    if not text:
        raise RuntimeError("Claude returned empty content")
    return text


def _call_claude_vision(image_b64: str, mime: str) -> dict[str, Any]:
    api_key = anthropic_api_key()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    mime = (mime or "image/jpeg").split(";")[0].strip() or "image/jpeg"
    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 700,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": IDENTIFY_PROMPT},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime,
                            "data": image_b64,
                        },
                    },
                ],
            }
        ],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=75) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    blocks = data.get("content") or []
    text = "".join(
        b.get("text", "")
        for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    ).strip()
    return _extract_json_object(text)


def _call_gemini_vision(image_b64: str, mime: str) -> dict[str, Any]:
    key = gemini_api_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    mime = (mime or "image/jpeg").split(";")[0].strip() or "image/jpeg"
    if not mime.startswith("image/"):
        mime = "image/jpeg"
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(GEMINI_MODEL, safe='')}:generateContent"
        f"?key={urllib.parse.quote(key, safe='')}"
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": IDENTIFY_PROMPT},
                    {"inline_data": {"mime_type": mime, "data": image_b64}},
                ]
            }
        ],
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
    with urllib.request.urlopen(req, timeout=75, context=ssl.create_default_context()) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    text = ""
    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini returned no text") from exc
    return _extract_json_object(text)


def _norm_id(parsed: dict[str, Any]) -> dict[str, Any]:
    conf = str(parsed.get("confidence") or "low").lower()
    if conf not in ("high", "medium", "low"):
        conf = "low"
    alts: list[dict[str, str]] = []
    for item in (parsed.get("alternatives") or [])[:3]:
        if not isinstance(item, dict):
            continue
        c = str(item.get("commonName") or "").strip()[:120]
        if not c:
            continue
        alts.append(
            {
                "commonName": c,
                "latinName": str(item.get("latinName") or "").strip()[:160],
            }
        )
    return {
        "commonName": str(parsed.get("commonName") or "").strip()[:120],
        "latinName": str(parsed.get("latinName") or "").strip()[:160],
        "cultivar": str(parsed.get("cultivar") or "").strip()[:80],
        "organismType": str(parsed.get("organismType") or "other").strip()[:40],
        "evidence": bool(parsed.get("evidence")),
        "confidence": conf,
        "shortNote": str(parsed.get("shortNote") or "").strip()[:240],
        "alternatives": alts,
    }


def _prefer_id(a: dict[str, Any] | None, b: dict[str, Any] | None) -> dict[str, Any]:
    """Prefer higher confidence; if tie, prefer Gemini when names agree else Claude."""
    rank = {"high": 3, "medium": 2, "low": 1}
    if a and not b:
        return a
    if b and not a:
        return b
    if not a and not b:
        return {}
    assert a and b
    ra = rank.get(a.get("confidence") or "low", 1)
    rb = rank.get(b.get("confidence") or "low", 1)
    if ra > rb:
        return a
    if rb > ra:
        return b
    # same confidence — if common names roughly match, keep richer latin
    ca = (a.get("commonName") or "").lower()
    cb = (b.get("commonName") or "").lower()
    if ca and cb and (ca in cb or cb in ca):
        if len(a.get("latinName") or "") >= len(b.get("latinName") or ""):
            return a
        return b
    # Prefer Gemini (a) as primary when tied and disagree
    return a if a.get("commonName") else b


def identify_wildlife(image_b64: str, mime: str) -> dict[str, Any]:
    if not image_b64 or len(image_b64) > MAX_IMAGE_B64:
        return {"ok": False, "error": "image_invalid", "message": "Image missing or too large."}

    gemini_err = ""
    claude_err = ""
    gemini_id: dict[str, Any] | None = None
    claude_id: dict[str, Any] | None = None

    try:
        gemini_id = _norm_id(_call_gemini_vision(image_b64, mime))
    except Exception as exc:  # noqa: BLE001
        gemini_err = f"{type(exc).__name__}: {exc}"

    try:
        claude_id = _norm_id(_call_claude_vision(image_b64, mime))
    except Exception as exc:  # noqa: BLE001
        claude_err = f"{type(exc).__name__}: {exc}"

    chosen = _prefer_id(gemini_id, claude_id)
    if not chosen or not chosen.get("commonName"):
        return {
            "ok": False,
            "error": "identify_failed",
            "message": "Could not identify the organism from this photo.",
            "geminiError": gemini_err or None,
            "claudeError": claude_err or None,
            "geminiConfigured": bool(gemini_api_key()),
            "claudeConfigured": bool(anthropic_api_key()),
        }

    display = chosen["commonName"]
    if chosen.get("cultivar"):
        display = f"{chosen['commonName']} ({chosen['cultivar']})"

    return {
        "ok": True,
        "privacy": "Photo used for this request only — not stored by Bane.",
        "displayName": display,
        "commonName": chosen["commonName"],
        "latinName": chosen.get("latinName") or "",
        "cultivar": chosen.get("cultivar") or "",
        "organismType": chosen.get("organismType") or "other",
        "evidence": bool(chosen.get("evidence")),
        "confidence": chosen.get("confidence") or "low",
        "shortNote": chosen.get("shortNote") or "",
        "alternatives": chosen.get("alternatives") or [],
        "sources": {
            "gemini": gemini_id,
            "claude": claude_id,
            "geminiError": gemini_err or None,
            "claudeError": claude_err or None,
        },
        "rule": (
            "Facts and callouts should match what the game thinks it saw "
            "(e.g. golden California poppy), even if the cultivar guess is wrong."
        ),
    }


def _normalize_callouts(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        anchor = str(item.get("anchor") or "").strip().lower().replace(" ", "_")
        label = str(item.get("label") or "").strip()
        fact = str(item.get("fact") or "").strip()
        if not label or not fact:
            continue
        if not anchor:
            anchor = "feature"
        out.append({"anchor": anchor[:40], "label": label[:60], "fact": fact[:320]})
        if len(out) >= MAX_CALLOUTS:
            break
    return out


def build_callouts(
    *,
    common: str,
    latin: str,
    cultivar: str,
    evidence: bool,
    organism_type: str = "",
) -> dict[str, Any]:
    display = common.strip() or POPPY_DEFAULT["common"]
    latin_n = latin.strip()
    cultivar_n = cultivar.strip()
    org_type = (organism_type or ("evidence" if evidence else "organism")).strip()[:40]

    system = (
        "You write short, family-friendly wildlife and plant education callouts for "
        "Bane of Extinction. Return ONLY valid JSON. No Wikipedia, no URLs, no scraping. "
        "Use well-established general knowledge about the NAMED organism below "
        "(the game's best guess). If the guess might be a close relative, still give "
        "accurate facts for that named organism. If unsure, say so gently. "
        "No medical claims. Visible traits / ecology / diet / habitat / pollinators — "
        "not internal anatomy scans."
    )
    scope = (
        f"Identified as: {display}"
        + (f" ({latin_n})" if latin_n else "")
        + (f"; cultivar note: {cultivar_n}" if cultivar_n else "")
        + f"; type: {org_type}. "
        "Write callouts that are accurate for THIS identification. "
        "Example: if this is a golden California poppy (not Watermelon Heaven), "
        "describe golden/orange California poppy traits — do not invent pink cultivar facts. "
        "Example: if this is common sunflower (Helianthus annuus), describe that species — "
        "do not invent named garden cultivars unless the identification includes them."
    )
    if evidence:
        scope += " Frame as evidence/clues the player noticed."

    user = (
        scope
        + "\n\nReturn JSON:\n"
        + json.dumps(
            {
                "organismType": org_type or "organism",
                "callouts": [
                    {
                        "anchor": "part_or_clue",
                        "label": "Short label",
                        "fact": "1–2 short sentences",
                    }
                ],
            }
        )
        + f"\nUse 3 to {MAX_CALLOUTS} callouts."
    )

    try:
        raw_text = _call_claude_text(system, user)
        parsed = _extract_json_object(raw_text)
        callouts = _normalize_callouts(parsed.get("callouts"))
        if len(callouts) < 2:
            raise RuntimeError("Too few callouts")
        source = "claude"
        if not organism_type and parsed.get("organismType"):
            org_type = str(parsed.get("organismType"))[:40]
    except Exception as exc:  # noqa: BLE001
        blob = (display + " " + latin_n).lower()
        if "poppy" in blob or "eschscholzia" in blob:
            callouts = list(FALLBACK_CALLOUTS_POPPY)
        elif "sunflower" in blob or "helianthus" in blob:
            callouts = list(FALLBACK_CALLOUTS_SUNFLOWER)
        else:
            callouts = [
                {
                    "anchor": "overview",
                    "label": "Overview",
                    "fact": f"Best guess right now: {display}. Facts service had a hiccup — try Load again.",
                }
            ]
        source = f"fallback:{type(exc).__name__}"

    title = display
    if cultivar_n and cultivar_n.lower() not in display.lower():
        title = f"{display} ({cultivar_n})"

    return {
        "ok": True,
        "source": source,
        "organismType": org_type,
        "commonName": display,
        "latinName": latin_n,
        "cultivar": cultivar_n or None,
        "displayName": title,
        "callouts": callouts,
        "disclaimer": (
            "Helper facts for what the game thinks it saw — useful for learning, "
            "not a guaranteed field guide."
        ),
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        __import__("sys").stderr.write("bane_api: " + (fmt % args) + "\n")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        _cors(self)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in ("/api/health", "/health"):
            _json(
                self,
                200,
                {
                    "ok": True,
                    "service": "bane-of-extinction",
                    "claudeKey": bool(anthropic_api_key()),
                    "geminiKey": bool(gemini_api_key()),
                },
            )
            return
        _json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length") or 0)
        if length > 6_500_000:
            _json(self, 413, {"ok": False, "error": "payload_too_large"})
            return
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            _json(self, 400, {"ok": False, "error": "invalid_json"})
            return
        if not isinstance(body, dict):
            _json(self, 400, {"ok": False, "error": "invalid_json"})
            return

        if path == "/api/wildlife-identify":
            image_b64 = str(body.get("imageBase64") or "").strip()
            mime = str(body.get("mimeType") or "image/jpeg").strip()
            result = identify_wildlife(image_b64, mime)
            code = 200 if result.get("ok") else (
                503
                if not gemini_api_key() and not anthropic_api_key()
                else 502
            )
            _json(self, code, result)
            return

        if path == "/api/callouts":
            common = str(body.get("commonName") or body.get("common") or "").strip()
            latin = str(body.get("latinName") or body.get("latin") or "").strip()
            cultivar = str(body.get("cultivar") or "").strip()
            evidence = bool(body.get("evidence"))
            organism_type = str(body.get("organismType") or "").strip()
            if not common:
                common = POPPY_DEFAULT["common"]
                latin = latin or POPPY_DEFAULT["latin"]
            result = build_callouts(
                common=common,
                latin=latin,
                cultivar=cultivar,
                evidence=evidence,
                organism_type=organism_type,
            )
            _json(self, 200, result)
            return

        _json(self, 404, {"ok": False, "error": "not_found"})


def main() -> None:
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(
        f"Bane API on http://{BIND}:{PORT} "
        f"(claude={bool(anthropic_api_key())} gemini={bool(gemini_api_key())})",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
