#!/usr/bin/env python3
"""
Maestro's Odyssey server.
Serves static www/ files and proxies /api/* calls to Claude.

Usage:
  ANTHROPIC_API_KEY=sk-... python3 serve.py [PORT] [KEY_PEM] [CERT_PEM]

Defaults: PORT=8072, HTTP (no TLS args needed for local dev).
"""
import http.server
import json
import os
import ssl
import sys
import urllib.request
import urllib.error

PORT     = int(sys.argv[1]) if len(sys.argv) > 1 else 8072
KEY_PEM  = sys.argv[2] if len(sys.argv) > 2 else None
CERT_PEM = sys.argv[3] if len(sys.argv) > 3 else None
WWW_DIR  = os.path.abspath(sys.argv[4]) if len(sys.argv) > 4 else os.path.join(os.path.dirname(__file__), "www")
BIND     = sys.argv[5] if len(sys.argv) > 5 else ""
MODEL    = "claude-haiku-4-5-20251001"
CLAUDE_URL = "https://api.anthropic.com/v1/messages"


def _load_anthropic_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    path = os.environ.get("KIDS_SITES_ANTHROPIC_KEY_PATH", "").strip()
    if not path:
        base = os.environ.get("KIDS_SITES_BASE", "").strip()
        if base:
            path = os.path.join(base, "anthropic.key")
        else:
            path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "anthropic.key")
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    return ""


API_KEY = _load_anthropic_key()


def strip_fences(text: str) -> str:
    """Remove markdown code fences if Claude wrapped the JSON in them."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]          # drop opening fence line
        text = text.rsplit("```", 1)[0].strip()  # drop closing fence
    return text


def claude(system: str, user: str, max_tokens: int = 300) -> str:
    if not API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    body = json.dumps({
        "model": MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(
        CLAUDE_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read())
    return data["content"][0]["text"].strip()


# ── API handlers ────────────────────────────────────────────────────────────

def handle_dialogue(body: dict) -> dict:
    """Generate narrative NPC dialogue at a given comprehension level."""
    scenario   = body.get("scenario", "contemporary")
    language   = body.get("language", "Spanish")
    comp       = int(body.get("comprehension", 25))   # 0-100
    vocab      = body.get("knownWords", [])

    known_str = ", ".join(vocab[:30]) if vocab else "none yet"

    if comp < 30:
        mix = "Speak almost entirely in English but drop in 1-3 individual target-language words naturally (no translation). Player knows: " + known_str
    elif comp < 55:
        mix = f"Mix roughly half {language} half English. Use simple sentences. Favour words the player knows: {known_str}. Leave key nouns in {language}."
    elif comp < 80:
        mix = f"Speak mostly in {language} with occasional English for plot-critical words the player has never seen. Known: {known_str}."
    else:
        mix = f"Speak entirely in {language}. Use natural, slightly complex sentences."

    scenario_desc = {
        "contemporary": "a bustling river-market at dawn, grounded and warm",
        "awareness":    "a community sharing scarce resources, earnest and collective",
        "dystopian":    "a quiet bureaucratic checkpoint in an authoritarian city, unsettling",
        "surreal":      "an otherworldly realm where language and reality blur, dreamlike",
    }.get(scenario, "a narrative scene")

    system = (
        "You are a narrative designer for a language-learning game called Maestro's Odyssey. "
        "Generate two lines of in-scene dialogue: one from an NPC and one internal thought from the player. "
        "Return ONLY valid JSON: {\"npc\": \"...\", \"npcName\": \"...\", \"player\": \"...\"}. "
        "No markdown, no explanation."
    )
    user = (
        f"Setting: {scenario_desc}.\n"
        f"Target language: {language}.\n"
        f"Player comprehension: {comp}/100.\n"
        f"Language mixing rule: {mix}\n"
        "Write dialogue that fits the setting and mixing rule. "
        "The player line is an internal thought reflecting partial understanding."
    )
    text = claude(system, user, max_tokens=200)
    try:
        result = json.loads(strip_fences(text))
    except json.JSONDecodeError:
        result = {"npc": text, "npcName": "Stranger", "player": "…"}
    return result


def handle_evaluate(body: dict) -> dict:
    """Judge a pronunciation attempt; return {passed, feedback, newWord}."""
    target   = body.get("target", "")
    attempt  = body.get("attempt", "")
    stage    = int(body.get("stage", 1))    # 1=lenient … 5=strict
    language = body.get("language", "Spanish")

    leniency = {
        1: "very lenient — any reasonable approximation passes",
        2: "lenient — close sounds are fine, ignore accents",
        3: "moderate — most sounds should be right",
        4: "strict — correct sounds required, accents matter",
        5: "very strict — near-native accuracy needed",
    }[stage]

    system = (
        "You are a language tutor embedded in a narrative game. "
        "Evaluate the player's spoken attempt and reply ONLY with valid JSON: "
        "{\"passed\": true/false, \"feedback\": \"one sentence in-scene narrative (not teacher voice)\", "
        "\"tip\": \"one short phonetic tip if failed, else empty string\"}. "
        "No markdown."
    )
    user = (
        f"Language: {language}. Target phrase: \"{target}\". Player said: \"{attempt}\".\n"
        f"Strictness: {leniency} (stage {stage}/5).\n"
        "Does it pass? Give narrative feedback as if the NPC is reacting."
    )
    text = claude(system, user, max_tokens=150)
    try:
        result = json.loads(strip_fences(text))
    except json.JSONDecodeError:
        result = {"passed": False, "feedback": text, "tip": ""}
    return result


def handle_blur_words(body: dict) -> dict:
    """Tag each word in a sentence as known/unknown given player vocab."""
    sentence  = body.get("sentence", "")
    vocab     = body.get("knownWords", [])
    language  = body.get("language", "Spanish")
    known_str = ", ".join(vocab[:40]) if vocab else "none"

    system = (
        "You are a vocabulary analyser for a language-learning game. "
        "Given a sentence and a list of words the player knows, tag each token. "
        "Reply ONLY with valid JSON: {\"tokens\": [{\"word\": \"...\", \"known\": true/false}]}. "
        "Punctuation attached to a word stays with it. No markdown."
    )
    user = (
        f"Language: {language}.\n"
        f"Sentence: \"{sentence}\"\n"
        f"Player knows these {language} words: {known_str}.\n"
        "Tag every token. Common function words (articles, prepositions) count as known."
    )
    text = claude(system, user, max_tokens=300)
    try:
        result = json.loads(strip_fences(text))
    except json.JSONDecodeError:
        # fallback: all tokens unknown
        tokens = [{"word": w, "known": False} for w in sentence.split()]
        result = {"tokens": tokens}
    return result


def handle_generate_scene(body: dict) -> dict:
    """Generate a brand-new narrative scenario + a practice phrase."""
    language = body.get("language", "Spanish")
    style    = body.get("style", "")   # optional theme hint

    system = (
        "You are a narrative designer for a language-learning game. "
        "Invent a short scene (2 NPC lines + 1 player thought) and a practice phrase. "
        "Reply ONLY with valid JSON: "
        "{\"title\": \"...\", \"setting\": \"...\", "
        "\"lines\": [{\"speaker\": \"...\", \"text\": \"...\"}, ...], "
        "\"phrase\": {\"easy\": \"...\", \"strict\": \"...\"}}. "
        "No markdown."
    )
    user = (
        f"Target language: {language}.\n"
        f"Theme hint: {style or 'your choice — be creative'}.\n"
        "The scene should use the 'connection through incomplete language' mechanic: "
        "the player character partially understands the NPC. "
        "The practice phrase should be a natural phrase from the scene (easy = rough approximation, strict = correct form)."
    )
    text = claude(system, user, max_tokens=400)
    try:
        result = json.loads(strip_fences(text))
    except json.JSONDecodeError:
        result = {"title": "New Scene", "setting": "", "lines": [], "phrase": {"easy": "", "strict": ""}}
    return result


ROUTES = {
    "/api/dialogue":       handle_dialogue,
    "/api/evaluate":       handle_evaluate,
    "/api/blur-words":     handle_blur_words,
    "/api/generate-scene": handle_generate_scene,
}


# ── HTTP handler ─────────────────────────────────────────────────────────────

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WWW_DIR, **kwargs)

    def log_message(self, fmt, *args):  # quieter logs
        print(f"  {self.command} {self.path} → {args[1] if len(args) > 1 else ''}")

    def end_headers(self):
        if self.command == "GET":
            path = self.path.split("?", 1)[0]
            if not path.startswith("/api"):
                if path in ("/", "/index.html") or path.endswith(".html"):
                    self.send_header("Cache-Control", "no-cache")
                else:
                    self.send_header("Cache-Control", "public, max-age=604800")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        handler = ROUTES.get(self.path)
        if handler is None:
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        raw    = self.rfile.read(length)
        try:
            body   = json.loads(raw) if raw else {}
            result = handler(body)
            payload = json.dumps(result).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as exc:
            print(f"  ERROR: {exc}")
            err = json.dumps({"error": str(exc)}).encode()
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


if __name__ == "__main__":
    server = http.server.HTTPServer((BIND or "", PORT), Handler)
    if KEY_PEM and CERT_PEM and os.path.isfile(KEY_PEM) and os.path.isfile(CERT_PEM):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT_PEM, KEY_PEM)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        scheme = "https"
    else:
        scheme = "http"
    addr = BIND or "0.0.0.0"
    print(f"Maestro's Odyssey → {scheme}://{addr}:{PORT}")
    print(f"API key: {'set ✓' if API_KEY else 'MISSING — set ANTHROPIC_API_KEY'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
