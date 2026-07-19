"""
Bane of Extinction — small owner-beta API (Claude callout facts).

Binds 127.0.0.1 only. Key from ANTHROPIC_API_KEY or shared kids-sites anthropic.key.
No Wikipedia / no open-web scrape — Claude helper facts only.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

BIND = os.environ.get("BANE_API_BIND", "127.0.0.1")
PORT = int(os.environ.get("BANE_API_PORT", "8086"))
MODEL = os.environ.get("BANE_ANTHROPIC_MODEL", "claude-sonnet-4-6")
MAX_CALLOUTS = 5

# First stub: California poppies (species-wide), optional Watermelon Heaven cultivar.
POPPY_DEFAULT = {
    "common": "California poppy",
    "latin": "Eschscholzia californica",
    "cultivar": "Watermelon Heaven",
    "organismType": "flower",
    "anchors": ["petals", "center", "foliage", "habit", "seed_pod"],
}

FALLBACK_CALLOUTS = [
    {
        "anchor": "petals",
        "label": "Petals",
        "fact": "California poppy petals look like soft crepe paper. Watermelon Heaven leans watermelon-pink; classic wild ones are often bright orange.",
    },
    {
        "anchor": "center",
        "label": "Flower center",
        "fact": "Many garden forms, including Watermelon Heaven, show a creamy lighter center that makes the bloom easy to spot in a sunny bed.",
    },
    {
        "anchor": "foliage",
        "label": "Feathery leaves",
        "fact": "The blue-green, finely cut leaves help the plant handle dry, sunny spots with less water than thirstier garden flowers.",
    },
    {
        "anchor": "habit",
        "label": "Sun & soil",
        "fact": "These poppies prefer full sun and well-drained or even poor soil. Too much rich soil or water can mean more leaves and fewer flowers.",
    },
]


def _key_paths() -> list[str]:
    paths: list[str] = []
    explicit = os.environ.get("BANE_ANTHROPIC_KEY_PATH", "").strip()
    if explicit:
        paths.append(explicit)
    shared = os.environ.get("KIDS_SITES_ANTHROPIC_KEY_PATH", "").strip()
    if shared:
        paths.append(shared)
    home = os.path.expanduser("~")
    paths.append(os.path.join(home, "kids-sites", "anthropic.key"))
    here = os.path.dirname(os.path.abspath(__file__))
    paths.append(os.path.join(here, "anthropic.key"))
    root = os.path.dirname(here)
    paths.append(os.path.join(root, "anthropic.key"))
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


def _call_claude(system: str, user: str, max_tokens: int = 900) -> str:
    api_key = anthropic_api_key()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    payload = {
        "model": MODEL,
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
        raise RuntimeError("No JSON object in Claude reply")
    obj = json.loads(m.group(0))
    if not isinstance(obj, dict):
        raise RuntimeError("Claude JSON was not an object")
    return obj


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
) -> dict[str, Any]:
    display = common.strip() or POPPY_DEFAULT["common"]
    latin_n = latin.strip() or POPPY_DEFAULT["latin"]
    cultivar_n = cultivar.strip()
    org_type = "evidence" if evidence else POPPY_DEFAULT["organismType"]

    system = (
        "You write short, family-friendly wildlife and plant education callouts for "
        "Bane of Extinction, a conservation learning game. "
        "Return ONLY valid JSON. No Wikipedia, no URLs, no scraping language. "
        "Use well-established general knowledge. If unsure, say so gently in the fact. "
        "Do not invent medical claims or rare subspecies trivia. "
        "Facts must fit the named organism or evidence — visible traits, ecology, diet/habitat, "
        "pollinators, drought habits, seed pods — not internal anatomy scans."
    )
    scope = (
        f"Species: {display} ({latin_n}). "
        f"Optional garden cultivar note: {cultivar_n or 'none (speak to the species generally)'}. "
        "This stub must work for California poppies in general; if a cultivar is given, "
        "you may mention its typical color pattern when relevant, but keep facts true for "
        "Eschscholzia californica overall."
    )
    if evidence:
        scope += (
            " The player found evidence of this plant (bloom, seed pod, feathery foliage, "
            "or a clear patch) — frame callouts as clues about what they noticed."
        )

    user = (
        scope
        + "\n\nReturn JSON with this shape:\n"
        + json.dumps(
            {
                "organismType": "flower",
                "callouts": [
                    {
                        "anchor": "petals|center|foliage|habit|seed_pod",
                        "label": "Short part name",
                        "fact": "1–2 short sentences, plain English",
                    }
                ],
            },
            indent=2,
        )
        + f"\nUse 3 to {MAX_CALLOUTS} callouts. Prefer anchors from: "
        + ", ".join(POPPY_DEFAULT["anchors"])
        + "."
    )

    try:
        raw_text = _call_claude(system, user)
        parsed = _extract_json_object(raw_text)
        callouts = _normalize_callouts(parsed.get("callouts"))
        if len(callouts) < 2:
            raise RuntimeError("Too few callouts")
        source = "claude"
    except Exception as exc:  # noqa: BLE001 — stub falls back for owner testing
        callouts = list(FALLBACK_CALLOUTS)
        source = f"fallback:{type(exc).__name__}"

    title = display
    if cultivar_n:
        title = f"{display} ({cultivar_n})"

    return {
        "ok": True,
        "source": source,
        "organismType": org_type if evidence else "flower",
        "commonName": display,
        "latinName": latin_n,
        "cultivar": cultivar_n or None,
        "displayName": title,
        "callouts": callouts,
        "disclaimer": "Helper facts from Claude — useful for learning, not a guaranteed field guide.",
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("bane_api: " + (fmt % args) + "\n")

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
                },
            )
            return
        _json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            _json(self, 400, {"ok": False, "error": "invalid_json"})
            return
        if not isinstance(body, dict):
            _json(self, 400, {"ok": False, "error": "invalid_json"})
            return

        if path == "/api/callouts":
            common = str(body.get("commonName") or body.get("common") or POPPY_DEFAULT["common"])
            latin = str(body.get("latinName") or body.get("latin") or POPPY_DEFAULT["latin"])
            cultivar = str(body.get("cultivar") or "")
            evidence = bool(body.get("evidence"))
            # First stub: only California poppy family for now
            blob = (common + " " + latin + " " + cultivar).lower()
            if "poppy" not in blob and "eschscholzia" not in blob and "eschscholtzia" not in blob:
                _json(
                    self,
                    400,
                    {
                        "ok": False,
                        "error": "stub_species_only",
                        "message": "This stub only builds callouts for California poppies for now.",
                    },
                )
                return
            result = build_callouts(
                common=common or POPPY_DEFAULT["common"],
                latin=latin or POPPY_DEFAULT["latin"],
                cultivar=cultivar or POPPY_DEFAULT["cultivar"],
                evidence=evidence,
            )
            _json(self, 200, result)
            return

        _json(self, 404, {"ok": False, "error": "not_found"})


def main() -> None:
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"Bane API on http://{BIND}:{PORT} (claudeKey={bool(anthropic_api_key())})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
