"""
Bane of Extinction — owner-beta API.

- POST /api/wildlife-identify  — Gemini + Claude vision ID (photo not stored)
- POST /api/codex-still        — Gemini image: field-guide still matching this ID + crop
- POST /api/callouts           — Claude helper facts + native range / conservation status
                                  (optional looking-at place lens; no GPS)
- GET  /api/auth/me            — Odd Trove Google SSO identity (for learned sync)
- GET/PUT /api/learned         — wildlife learns synced to signed-in Google account
- GET  /api/health

Binds 127.0.0.1 only. Keys from env / shared kids-sites files.
Facts: Claude helper knowledge + curated fallbacks. Status/range: NatureServe Explorer
(CC BY) when a scientific name matches — never IUCN site/API, never Wikipedia as sole source.
Caption fields: conservation status when possible; native range; where introduced/often
invasive elsewhere (no compare-place required). Soft wording — NatureServe marks exotic,
not always invasive. Raw scan photos are never written to disk.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

# Shared Odd Trove SSO (oddtrove_sso.py) — kids-sites/_shared or repo top/_shared.
_HERE = os.path.dirname(os.path.abspath(__file__))
for _shared in (
    os.environ.get("BANE_SHARED_PATH", "").strip(),
    os.path.join(os.path.expanduser("~"), "kids-sites", "_shared"),
    os.path.join(_HERE, "..", "top", "_shared"),
    os.path.join(_HERE, "_shared"),
):
    if _shared and os.path.isdir(_shared) and _shared not in sys.path:
        sys.path.insert(0, _shared)

try:
    from oddtrove_sso import identity_from_cookie_header  # type: ignore
except ImportError:  # pragma: no cover
    identity_from_cookie_header = None  # type: ignore

BIND = os.environ.get("BANE_API_BIND", "127.0.0.1")
PORT = int(os.environ.get("BANE_API_PORT", "8086"))
CLAUDE_MODEL = os.environ.get("BANE_ANTHROPIC_MODEL", "claude-sonnet-4-6")
GEMINI_MODEL = os.environ.get(
    "BANE_GEMINI_MODEL",
    os.environ.get("HALALIT_GEMINI_MODEL", "gemini-2.0-flash"),
)
# Image models tried in order until one returns an image.
_DEFAULT_IMAGE_MODELS = (
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "gemini-2.0-flash-preview-image-generation",
)
GEMINI_IMAGE_MODEL = os.environ.get("BANE_GEMINI_IMAGE_MODEL", "").strip()
MAX_CALLOUTS = 5
MAX_IMAGE_B64 = 4_500_000
MAX_LEARNED_ENTRIES = 48
MAX_LEARNED_BODY = 3_500_000
LEARNED_DIR = os.environ.get(
    "BANE_LEARNED_DIR",
    os.path.join(os.path.expanduser("~"), "kids-sites", "bane-server", "learned"),
)
STILL_DIR = os.environ.get(
    "BANE_STILL_DIR",
    os.path.join(os.path.expanduser("~"), "kids-sites", "bane-still-cache"),
)
STILL_TTL_SEC = int(os.environ.get("BANE_STILL_TTL_SEC", "1200"))  # 20 min
_STILL_META: dict[str, float] = {}  # token -> expires_at

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
        "fact": "Those soft, crepe-paper petals are what make a roadside or yard pop of orange catch your eye on a sunny walk.",
    },
    {
        "anchor": "center",
        "label": "Flower center",
        "fact": "A lighter center helps you tell one bloom from the next in bright sun — useful when you’re matching what you see to a garden form.",
    },
    {
        "anchor": "help",
        "label": "Small help",
        "fact": "If they already grow in a sunny patch near you, leaving that dry, lean soil alone (skip heavy water and rich fertilizer there) helps them keep blooming without you fighting their habits.",
    },
    {
        "anchor": "foliage",
        "label": "Feathery leaves",
        "fact": "Blue-green, finely cut leaves help the plant itself handle heat and thin soil — a quiet drought trick of its own.",
    },
]

FALLBACK_CALLOUTS_SUNFLOWER = [
    {
        "anchor": "disk",
        "label": "Center disk",
        "fact": "That busy middle feeds bees and other pollinators that also visit the flowers you grow or pass on a walk.",
    },
    {
        "anchor": "petals",
        "label": "Ray color",
        "fact": "Ray colors range from classic yellow-gold to red, burgundy, and near-black — match the shade you actually see, not a textbook yellow.",
    },
    {
        "anchor": "help",
        "label": "Small help",
        "fact": "If you grow one, leaving a spent seed head standing for a while offers birds an easy snack — a small, local kindness that doesn’t require fixing the whole food system.",
    },
    {
        "anchor": "head",
        "label": "Flower head",
        "fact": "What looks like one big flower is really a head of many tiny florets — ray florets outside, packed disk florets in the middle.",
    },
]

FALLBACK_CALLOUTS_PHILODENDRON = [
    {
        "anchor": "leaves",
        "label": "Heart-shaped leaves",
        "fact": "Those glossy heart-shaped leaves are why this plant shows up on so many shelves and windowsills — easy to recognize once you know the shape.",
    },
    {
        "anchor": "habit",
        "label": "Light & home life",
        "fact": "Bright, indirect light and evenly moist soil keep it happy at home; too little light and you’ll see long, sparse stems with smaller leaves.",
    },
    {
        "anchor": "help",
        "label": "Small help",
        "fact": "Keep houseplant prunings and old pots in the bin or compost meant for them — don’t “free” tropical houseplants outdoors where they can struggle or crowd local plants.",
    },
    {
        "anchor": "stems",
        "label": "Climbing habit",
        "fact": "In the tropics those same flexible stems scramble and climb — a plant trick of its own, not only a shelf decoration.",
    },
]

# Back-compat alias used nowhere new, but keep name for any external refs
FALLBACK_CALLOUTS = FALLBACK_CALLOUTS_POPPY

IDENTIFY_PROMPT = (
    "You identify wildlife, plants, fungi, or clear evidence of them "
    "(tracks, nests, seed pods, chewed plants, bloom patches) for a family-friendly "
    "conservation learning game. Return ONLY JSON.\n"
    "Focus on the organism (or evidence), not people, hands, faces, or private property details.\n"
    "REFUSAL — if there is no clear organism and no clear evidence "
    "(empty ground, wall, sky, furniture, shelf wood, blur with nothing identifiable, "
    "mostly hands/faces, or a frame that is only background), do NOT invent a species. Return:\n"
    '{"commonName":"","latinName":"","cultivar":"","bloomColor":"","organismType":"none",'
    '"lifeStage":"","evidence":false,"confidence":"low",'
    '"shortNote":"No clear organism or evidence in frame.",'
    '"alternatives":[],"noOrganism":true}\n'
    "Be as accurate as you reasonably can. Prefer the species (or best clear taxon) you think it is.\n"
    "COLOR MATTERS — for flowers, set bloomColor to the dominant petal/ray color you see "
    "(e.g. red, yellow, orange, burgundy, bicolor, near-black). "
    "If rays are clearly red/burgundy/dark, do NOT describe a generic yellow sunflower in shortNote. "
    "Put the color in commonName when helpful (e.g. \"Red sunflower\") and/or cultivar when known.\n"
    "CRITICAL — do NOT default to California poppy. Identify what is actually in the photo.\n"
    "Disambiguation for blooms:\n"
    "- Common sunflower (Helianthus annuus): ONE large head that looks like many tiny flowers — "
    "outer ray florets (any color) + a big textured disk of packed disk florets. "
    "Broad rough leaves; thick often-hairy stem. A tight close-up of the face is still a sunflower.\n"
    "- California poppy (Eschscholzia californica): usually FOUR silky crepe-paper petals, "
    "cup/bowl shape, feathery blue-green foliage — NOT a big composite disk of hundreds of florets.\n"
    "For heart-shaped trailing houseplant philodendrons (glossy green cordate leaves; also called "
    "heartleaf or sweetheart plant): prefer commonName \"Sweetheart philodendron\" and "
    "latinName \"Philodendron hederaceum\" (synonym Philodendron scandens is OK in shortNote). "
    "Do not invent cultivar names (Brasil, Micans, Lemon Lime, etc.) unless clearly labeled or "
    "unmistakable from leaf pattern/color in the photo.\n"
    "Other plants: name the best real match. If unsure between species, pick the best guess and "
    "list alternatives; never fall back to California poppy just because this game also uses that stub.\n"
    "Do not invent sunflower or philodendron cultivar names unless clearly labeled in the photo.\n"
    "LIFE STAGE — set lifeStage to what is actually visible (not a different stage of the "
    "same species). Examples: seed, seedling, sprout, bud, flowering, fruiting, adult, "
    "juvenile, egg, larva, nestling, fledgling, evidence. If the photo is a blossom/bloom, "
    "use flowering (not seed). If only a seed pod or seed, say so.\n"
    "JSON shape (success):\n"
    "{"
    '"commonName":"...",'
    '"latinName":"...",'
    '"cultivar":"" ,'
    '"bloomColor":"red|yellow|orange|burgundy|bicolor|other|",'
    '"organismType":"bird|mammal|flower|plant|fungus|insect|reptile|evidence|other",'
    '"lifeStage":"flowering|fruiting|seedling|adult|juvenile|evidence|...",'
    '"evidence":false,'
    '"confidence":"high|medium|low",'
    '"shortNote":"one short plain sentence naming a visible trait that supports the ID (include color)",'
    '"alternatives":[{"commonName":"...","latinName":"..."}],'
    '"noOrganism":false'
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
        os.path.join(home, "kids-sites", "oddtrove-server", ".env"),
    ):
        _load_dotenv_file(path)


_bootstrap_env()


def _ensure_still_dir() -> str:
    os.makedirs(STILL_DIR, exist_ok=True)
    return STILL_DIR


def _purge_expired_stills() -> None:
    now = time.time()
    dead = [t for t, exp in _STILL_META.items() if exp <= now]
    for token in dead:
        _STILL_META.pop(token, None)
        path = os.path.join(STILL_DIR, f"{token}.jpg")
        try:
            if os.path.isfile(path):
                os.remove(path)
        except OSError:
            pass


def save_still_token(mime: str, data_b64: str) -> str | None:
    """Persist a shrunk still; return opaque token for GET /api/still/<token>."""
    import base64
    from io import BytesIO

    if not data_b64:
        return None
    _ensure_still_dir()
    _purge_expired_stills()
    raw = base64.b64decode(data_b64, validate=False)
    # Prefer JPEG bytes; if PNG, try Pillow convert.
    out = raw
    if not (mime or "").lower().startswith("image/jpeg"):
        try:
            from PIL import Image  # type: ignore

            img = Image.open(BytesIO(raw)).convert("RGB")
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=82, optimize=True)
            out = buf.getvalue()
        except Exception:
            out = raw
    token = secrets.token_urlsafe(16)
    path = os.path.join(STILL_DIR, f"{token}.jpg")
    with open(path, "wb") as f:
        f.write(out)
    _STILL_META[token] = time.time() + STILL_TTL_SEC
    return token


def load_still_bytes(token: str) -> tuple[str, bytes] | None:
    token = (token or "").strip()
    if not token or not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", token):
        return None
    _purge_expired_stills()
    exp = _STILL_META.get(token)
    path = os.path.join(STILL_DIR, f"{token}.jpg")
    if exp is not None and exp <= time.time():
        _STILL_META.pop(token, None)
        try:
            os.remove(path)
        except OSError:
            pass
        return None
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "rb") as f:
            return "image/jpeg", f.read()
    except OSError:
        return None


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
    origin = (handler.headers.get("Origin") or "").strip()
    if origin.endswith("oddtrove.art") or origin in (
        "https://oddtrove.art",
        "http://oddtrove.art",
    ):
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Access-Control-Allow-Credentials", "true")
    else:
        handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def _json(handler: BaseHTTPRequestHandler, code: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    _cors(handler)
    handler.end_headers()
    handler.wfile.write(body)


def _sso_identity(handler: BaseHTTPRequestHandler) -> dict[str, str] | None:
    if identity_from_cookie_header is None:
        return None
    try:
        return identity_from_cookie_header(handler.headers.get("Cookie"))
    except Exception:  # noqa: BLE001
        return None


def _learned_path(email: str) -> str:
    digest = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:40]
    return os.path.join(LEARNED_DIR, f"{digest}.json")


def _ensure_learned_dir() -> None:
    os.makedirs(LEARNED_DIR, exist_ok=True)


def _sanitize_learned_entry(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    key = str(raw.get("key") or "").strip()[:100]
    common = str(raw.get("commonName") or "").strip()[:120]
    display = str(raw.get("displayName") or common).strip()[:160]
    if not key or not (common or display):
        return None
    still_b64 = str(raw.get("stillBase64") or "").strip()
    if len(still_b64) > 900_000:
        still_b64 = ""
    mime = str(raw.get("stillMime") or "").split(";")[0].strip()[:40]
    if still_b64 and not mime.startswith("image/"):
        mime = "image/jpeg"
    try:
        learned_at = int(raw.get("learnedAt") or 0)
    except (TypeError, ValueError):
        learned_at = 0
    try:
        last_seen = int(raw.get("lastSeenAt") or 0)
    except (TypeError, ValueError):
        last_seen = 0
    try:
        encounters = int(raw.get("encounterCount") or 1)
    except (TypeError, ValueError):
        encounters = 1
    return {
        "key": key,
        "displayName": display or common,
        "commonName": common or display,
        "latinName": str(raw.get("latinName") or "").strip()[:160],
        "cultivar": str(raw.get("cultivar") or "").strip()[:80],
        "bloomColor": str(raw.get("bloomColor") or "").strip()[:40],
        "organismType": str(raw.get("organismType") or "other").strip()[:40],
        "lifeStage": str(raw.get("lifeStage") or "").strip()[:40],
        "shortNote": str(raw.get("shortNote") or "").strip()[:240],
        "evidence": bool(raw.get("evidence")),
        "stillMime": mime if still_b64 else "",
        "stillBase64": still_b64,
        "learnedAt": learned_at or int(time.time() * 1000),
        "lastSeenAt": last_seen or learned_at or int(time.time() * 1000),
        "encounterCount": max(1, min(encounters, 9999)),
    }


def _normalize_learned_list(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        entry = _sanitize_learned_entry(item)
        if not entry or entry["key"] in seen:
            continue
        seen.add(entry["key"])
        out.append(entry)
        if len(out) >= MAX_LEARNED_ENTRIES:
            break
    out.sort(key=lambda e: int(e.get("lastSeenAt") or 0), reverse=True)
    return out[:MAX_LEARNED_ENTRIES]


def load_learned(email: str) -> list[dict[str, Any]]:
    path = _learned_path(email)
    if not os.path.isfile(path):
        return []
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError, TypeError):
        return []
    if isinstance(raw, dict) and isinstance(raw.get("entries"), list):
        return _normalize_learned_list(raw["entries"])
    return _normalize_learned_list(raw)


def save_learned(email: str, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned = _normalize_learned_list(entries)
    _ensure_learned_dir()
    path = _learned_path(email)
    tmp = path + ".tmp"
    payload = {
        "version": 1,
        "email": email.strip().lower(),
        "updatedAt": int(time.time() * 1000),
        "entries": cleaned,
    }
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)
    return cleaned


def merge_learned(
    local: list[dict[str, Any]], remote: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Prefer newer lastSeenAt; keep still art if only one side has it."""
    by_key: dict[str, dict[str, Any]] = {}
    for src in (remote or []) + (local or []):
        entry = _sanitize_learned_entry(src)
        if not entry:
            continue
        key = entry["key"]
        prev = by_key.get(key)
        if not prev:
            by_key[key] = entry
            continue
        newer = entry if int(entry["lastSeenAt"]) >= int(prev["lastSeenAt"]) else prev
        older = prev if newer is entry else entry
        merged = dict(newer)
        if not merged.get("stillBase64") and older.get("stillBase64"):
            merged["stillBase64"] = older["stillBase64"]
            merged["stillMime"] = older.get("stillMime") or "image/jpeg"
        for field in (
            "latinName",
            "cultivar",
            "bloomColor",
            "lifeStage",
            "shortNote",
            "organismType",
        ):
            if not merged.get(field) and older.get(field):
                merged[field] = older[field]
        merged["learnedAt"] = min(
            int(merged.get("learnedAt") or 0) or int(time.time() * 1000),
            int(older.get("learnedAt") or 0) or int(time.time() * 1000),
        )
        merged["encounterCount"] = max(
            int(merged.get("encounterCount") or 1),
            int(older.get("encounterCount") or 1),
        )
        by_key[key] = merged
    out = list(by_key.values())
    out.sort(key=lambda e: int(e.get("lastSeenAt") or 0), reverse=True)
    return out[:MAX_LEARNED_ENTRIES]


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


def _image_model_candidates() -> list[str]:
    models: list[str] = []
    if GEMINI_IMAGE_MODEL:
        models.append(GEMINI_IMAGE_MODEL)
    for name in _DEFAULT_IMAGE_MODELS:
        if name not in models:
            models.append(name)
    return models


def _codex_still_prompt(
    *,
    common: str,
    latin: str,
    cultivar: str,
    organism_type: str,
    short_note: str,
    life_stage: str = "",
) -> str:
    bits = [common.strip() or "this organism"]
    if latin.strip():
        bits.append(f"({latin.strip()})")
    if cultivar.strip():
        bits.append(f"cultivar/form: {cultivar.strip()}")
    if organism_type.strip():
        bits.append(f"type: {organism_type.strip()}")
    if life_stage.strip():
        bits.append(f"life stage in photo: {life_stage.strip()}")
    if short_note.strip():
        bits.append(f"scan note: {short_note.strip()[:180]}")
    subject = "; ".join(bits)
    stage_line = (
        f"Show the complete organism at THIS life stage only: {life_stage.strip()}. "
        if life_stage.strip()
        else "Match the life stage visible in the reference (e.g. flowering blossom → "
        "flowering plant, not a seed or seedling; chick → juvenile, not adult).\n"
    )
    return (
        "Create ONE brand-new wildlife-codex portrait for a family-friendly nature game.\n"
        f"Identified subject: {subject}.\n"
        "PRIVACY — the attached photo is a private reference for traits only. "
        "Invent a fresh semi-realistic field-guide portrait of the SAME species. "
        "Do NOT copy, redraw, or recreate that photo’s pixels, background, angle, "
        "crop, lighting, or scene. Different pose and plain soft background.\n"
        "Match species, color, markings, bloom/leaf/body form, and cultivar traits "
        "(example: a red sunflower must stay red, not turn generic yellow).\n"
        f"{stage_line}"
        "If the reference shows a blossom or bloom, depict a complete flowering plant "
        "(or clear flowering head) at that stage — never a seed, seedling, or unrelated stage. "
        "If it shows a seed or seedling, stay at that stage. For animals, match age class.\n"
        "Do NOT invent a different species. Do NOT substitute a stock generic look.\n"
        "Style: calm semi-realistic field-guide art — believable nature illustration. "
        "Avoid heavy cartoon, anime, chibi, glossy CGI, or uncanny hyper-detail. "
        "Soft plain muted background. Organism only — no people, no hands, no phone, "
        "no text, no watermark, no logo.\n"
        "Square composition, subject filling most of the frame. Return an image."
    )


def _extract_gemini_inline_image(raw: dict[str, Any]) -> tuple[str, str]:
    """Return (mime, base64) from a Gemini generateContent response."""
    try:
        parts = raw["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini image response missing parts") from exc
    if not isinstance(parts, list):
        raise RuntimeError("Gemini image response parts invalid")
    for part in parts:
        if not isinstance(part, dict):
            continue
        inline = part.get("inlineData") or part.get("inline_data")
        if not isinstance(inline, dict):
            continue
        data = str(inline.get("data") or "").strip()
        if not data:
            continue
        mime = str(
            inline.get("mimeType") or inline.get("mime_type") or "image/png"
        ).split(";")[0].strip() or "image/png"
        if not mime.startswith("image/"):
            mime = "image/png"
        return mime, data
    raise RuntimeError("Gemini returned no image data")


def _shrink_still_b64(mime: str, data_b64: str, max_edge: int = 640, quality: int = 82) -> tuple[str, str]:
    """Downscale codex still so phones can store/show it (Pillow if available)."""
    try:
        import base64
        from io import BytesIO

        from PIL import Image  # type: ignore
    except Exception:
        return mime, data_b64
    try:
        raw = base64.b64decode(data_b64, validate=False)
        img = Image.open(BytesIO(raw))
        img = img.convert("RGB")
        w, h = img.size
        scale = min(1.0, float(max_edge) / float(max(w, h) or 1))
        if scale < 0.999:
            img = img.resize(
                (max(1, int(w * scale)), max(1, int(h * scale))),
                Image.Resampling.LANCZOS,
            )
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        out = base64.b64encode(buf.getvalue()).decode("ascii")
        return "image/jpeg", out
    except Exception as exc:  # noqa: BLE001
        __import__("sys").stderr.write(f"bane_still_shrink skip: {exc}\n")
        return mime, data_b64


def _call_gemini_codex_still(
    image_b64: str | None,
    mime: str,
    *,
    common: str,
    latin: str,
    cultivar: str,
    organism_type: str,
    short_note: str,
    life_stage: str = "",
    allow_text_only: bool = True,
) -> dict[str, Any]:
    key = gemini_api_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    mime = (mime or "image/jpeg").split(";")[0].strip() or "image/jpeg"
    if not mime.startswith("image/"):
        mime = "image/jpeg"
    prompt = _codex_still_prompt(
        common=common,
        latin=latin,
        cultivar=cultivar,
        organism_type=organism_type,
        short_note=short_note,
        life_stage=life_stage,
    )
    parts: list[dict[str, Any]] = [{"text": prompt}]
    if image_b64:
        parts.append({"inline_data": {"mime_type": mime, "data": image_b64}})
    elif not allow_text_only:
        raise RuntimeError("image required for still")
    else:
        stage_bit = (
            f" Stay at life stage: {life_stage}." if life_stage else ""
        )
        parts[0] = {
            "text": prompt
            + "\nNo photo attached — invent a careful semi-realistic field-guide portrait "
            "from the identified name, traits, and life stage only (still match color/form; "
            f"e.g. red sunflower must be red).{stage_bit}"
        }

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.35,
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": {
                "aspectRatio": "1:1",
                "imageSize": "512",
            },
        },
    }
    errors: list[str] = []
    for model in _image_model_candidates():
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{urllib.parse.quote(model, safe='')}:generateContent"
            f"?key={urllib.parse.quote(key, safe='')}"
        )
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(
                req, timeout=100, context=ssl.create_default_context()
            ) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            out_mime, out_b64 = _extract_gemini_inline_image(raw)
            out_mime, out_b64 = _shrink_still_b64(out_mime, out_b64)
            return {
                "ok": True,
                "mimeType": out_mime,
                "imageBase64": out_b64,
                "model": model,
                "matched": True,
                "fromPhoto": bool(image_b64),
            }
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                detail = exc.read().decode("utf-8", errors="replace")[:400]
            except OSError:
                detail = str(exc)
            errors.append(f"{model}: HTTP {exc.code} {detail}")
            # Older image models may reject imageConfig — retry once without it.
            if "imageConfig" in detail or exc.code in (400, 404):
                slim = {
                    "contents": payload["contents"],
                    "generationConfig": {
                        "temperature": 0.35,
                        "responseModalities": ["TEXT", "IMAGE"],
                    },
                }
                req2 = urllib.request.Request(
                    url,
                    data=json.dumps(slim).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(
                        req2, timeout=100, context=ssl.create_default_context()
                    ) as resp2:
                        raw2 = json.loads(resp2.read().decode("utf-8"))
                    out_mime, out_b64 = _extract_gemini_inline_image(raw2)
                    out_mime, out_b64 = _shrink_still_b64(out_mime, out_b64)
                    return {
                        "ok": True,
                        "mimeType": out_mime,
                        "imageBase64": out_b64,
                        "model": model,
                        "matched": True,
                        "fromPhoto": bool(image_b64),
                    }
                except Exception as exc2:  # noqa: BLE001
                    errors.append(f"{model}/slim: {type(exc2).__name__}: {exc2}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{model}: {type(exc).__name__}: {exc}")

    # Last chance: text-only if photo path failed.
    if image_b64 and allow_text_only:
        try:
            return _call_gemini_codex_still(
                None,
                mime,
                common=common,
                latin=latin,
                cultivar=cultivar,
                organism_type=organism_type,
                short_note=short_note,
                life_stage=life_stage,
                allow_text_only=True,
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"text_only: {type(exc).__name__}: {exc}")

    raise RuntimeError("; ".join(errors) or "image_generation_failed")


def generate_codex_still(
    image_b64: str | None,
    mime: str,
    *,
    common: str,
    latin: str = "",
    cultivar: str = "",
    organism_type: str = "",
    short_note: str = "",
    life_stage: str = "",
) -> dict[str, Any]:
    if image_b64 is not None and (not image_b64 or len(image_b64) > MAX_IMAGE_B64):
        return {
            "ok": False,
            "error": "image_invalid",
            "message": "Image missing or too large.",
        }
    if not (common or "").strip():
        return {
            "ok": False,
            "error": "missing_organism",
            "message": "commonName is required so the still matches the ID.",
        }
    try:
        result = _call_gemini_codex_still(
            image_b64,
            mime,
            common=common.strip(),
            latin=(latin or "").strip(),
            cultivar=(cultivar or "").strip(),
            organism_type=(organism_type or "").strip(),
            short_note=(short_note or "").strip(),
            life_stage=(life_stage or "").strip(),
        )
        result["commonName"] = common.strip()
        result["latinName"] = (latin or "").strip()
        result["cultivar"] = (cultivar or "").strip() or None
        result["lifeStage"] = (life_stage or "").strip() or None
        result["disclaimer"] = (
            "Codex art is a new semi-realistic portrait of this species at the "
            "same life stage — not your raw photo, and not a mismatched stage."
        )
        return result
    except Exception as exc:  # noqa: BLE001
        __import__("sys").stderr.write(
            f"bane_codex_still fail common={common!r}: {exc}\n"
        )
        return {
            "ok": False,
            "error": "still_failed",
            "message": f"Could not build matching codex still: {exc}",
            "geminiConfigured": bool(gemini_api_key()),
        }


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
    organism_type = str(parsed.get("organismType") or "other").strip()[:40].lower()
    no_organism = bool(parsed.get("noOrganism")) or organism_type in (
        "none",
        "empty",
        "invalid",
        "background",
    )
    common = str(parsed.get("commonName") or "").strip()[:120]
    if no_organism:
        common = ""
        organism_type = "none"
    life_stage = str(parsed.get("lifeStage") or "").strip()[:40].lower()
    life_stage = re.sub(r"[^a-z0-9_\- ]+", "", life_stage).strip()[:40]
    return {
        "commonName": common,
        "latinName": str(parsed.get("latinName") or "").strip()[:160],
        "cultivar": str(parsed.get("cultivar") or "").strip()[:80],
        "bloomColor": str(parsed.get("bloomColor") or "").strip()[:40],
        "organismType": organism_type,
        "lifeStage": life_stage,
        "evidence": bool(parsed.get("evidence")),
        "confidence": conf,
        "shortNote": str(parsed.get("shortNote") or "").strip()[:240],
        "alternatives": alts,
        "noOrganism": no_organism,
    }


def _is_refusal(parsed: dict[str, Any] | None) -> bool:
    if not parsed:
        return True
    if parsed.get("noOrganism"):
        return True
    if not (parsed.get("commonName") or "").strip():
        return True
    return False


def _name_richness(parsed: dict[str, Any] | None) -> int:
    if not parsed:
        return 0
    blob = " ".join(
        [
            str(parsed.get("commonName") or ""),
            str(parsed.get("cultivar") or ""),
            str(parsed.get("bloomColor") or ""),
            str(parsed.get("shortNote") or ""),
        ]
    ).lower()
    score = len(blob)
    for word in (
        "red",
        "burgundy",
        "crimson",
        "dark",
        "black",
        "bicolor",
        "orange",
        "pink",
        "ring of fire",
        "mahogany",
    ):
        if word in blob:
            score += 40
    if parsed.get("cultivar"):
        score += 25
    if parsed.get("bloomColor"):
        score += 20
    return score


def _merge_id_details(
    chosen: dict[str, Any], other: dict[str, Any] | None
) -> dict[str, Any]:
    """Keep the chosen ID, but borrow cultivar/color/note when the other guess is richer."""
    if not other or _is_refusal(other):
        return chosen
    out = dict(chosen)
    if not out.get("cultivar") and other.get("cultivar"):
        out["cultivar"] = other["cultivar"]
    if not out.get("bloomColor") and other.get("bloomColor"):
        out["bloomColor"] = other["bloomColor"]
    if not out.get("lifeStage") and other.get("lifeStage"):
        out["lifeStage"] = other["lifeStage"]
    # Prefer a more color-specific common name (Red sunflower > Sunflower)
    if _name_richness(other) > _name_richness(out) + 15:
        ca = (out.get("commonName") or "").lower()
        cb = (other.get("commonName") or "").lower()
        if ca and cb and (ca in cb or cb in ca or "sunflower" in ca and "sunflower" in cb):
            out["commonName"] = other["commonName"]
            if other.get("cultivar"):
                out["cultivar"] = other["cultivar"]
            if other.get("bloomColor"):
                out["bloomColor"] = other["bloomColor"]
            if other.get("shortNote") and len(str(other.get("shortNote") or "")) > len(
                str(out.get("shortNote") or "")
            ):
                out["shortNote"] = other["shortNote"]
    elif other.get("shortNote") and (
        not out.get("shortNote")
        or (
            any(
                c in str(other.get("shortNote") or "").lower()
                for c in ("red", "dark", "black", "burgundy", "bicolor")
            )
            and not any(
                c in str(out.get("shortNote") or "").lower()
                for c in ("red", "dark", "black", "burgundy", "bicolor")
            )
        )
    ):
        out["shortNote"] = other["shortNote"]
    return out


def _prefer_id(a: dict[str, Any] | None, b: dict[str, Any] | None) -> dict[str, Any]:
    """Prefer higher confidence; if tie, prefer richer color/cultivar naming."""
    rank = {"high": 3, "medium": 2, "low": 1}
    a_ok = a if a and not _is_refusal(a) else None
    b_ok = b if b and not _is_refusal(b) else None
    if a_ok and not b_ok:
        return a_ok
    if b_ok and not a_ok:
        return b_ok
    if not a_ok and not b_ok:
        return {"noOrganism": True, "commonName": "", "organismType": "none", "confidence": "low"}
    assert a_ok and b_ok
    ra = rank.get(a_ok.get("confidence") or "low", 1)
    rb = rank.get(b_ok.get("confidence") or "low", 1)
    if ra > rb:
        return _merge_id_details(a_ok, b_ok)
    if rb > ra:
        return _merge_id_details(b_ok, a_ok)
    # same confidence — prefer richer color/cultivar naming, then Gemini (a)
    if _name_richness(b_ok) > _name_richness(a_ok):
        return _merge_id_details(b_ok, a_ok)
    return _merge_id_details(a_ok, b_ok)


def identify_wildlife(
    image_b64: str, mime: str, *, want_codex_still: bool = False
) -> dict[str, Any]:
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
    if _is_refusal(chosen):
        print(
            "bane_identify refuse "
            f"gemini={(gemini_id or {}).get('commonName')!r}/"
            f"no={(gemini_id or {}).get('noOrganism')} "
            f"claude={(claude_id or {}).get('commonName')!r}/"
            f"no={(claude_id or {}).get('noOrganism')} "
            f"gemini_err={gemini_err!r} claude_err={claude_err!r}",
            flush=True,
        )
        return {
            "ok": False,
            "error": "no_organism",
            "message": (
                "No clear organism or evidence in this photo. "
                "Fill the dashed box and try again."
            ),
            "geminiError": gemini_err or None,
            "claudeError": claude_err or None,
            "geminiConfigured": bool(gemini_api_key()),
            "claudeConfigured": bool(anthropic_api_key()),
            "sources": {
                "gemini": gemini_id,
                "claude": claude_id,
            },
        }

    if not chosen or not chosen.get("commonName"):
        print(
            f"bane_identify fail gemini={gemini_err!r} claude={claude_err!r}",
            flush=True,
        )
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

    print(
        "bane_identify ok "
        f"chosen={chosen.get('commonName')!r} "
        f"latin={chosen.get('latinName')!r} "
        f"gemini={(gemini_id or {}).get('commonName')!r} "
        f"claude={(claude_id or {}).get('commonName')!r}",
        flush=True,
    )

    result: dict[str, Any] = {
        "ok": True,
        "privacy": "Photo used for this request only — not stored by Bane.",
        "displayName": display,
        "commonName": chosen["commonName"],
        "latinName": chosen.get("latinName") or "",
        "cultivar": chosen.get("cultivar") or "",
        "bloomColor": chosen.get("bloomColor") or "",
        "organismType": chosen.get("organismType") or "other",
        "lifeStage": chosen.get("lifeStage") or "",
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

    if want_codex_still:
        still = generate_codex_still(
            image_b64,
            mime,
            common=str(result["commonName"]),
            latin=str(result.get("latinName") or ""),
            cultivar=str(result.get("cultivar") or ""),
            organism_type=str(result.get("organismType") or ""),
            life_stage=str(result.get("lifeStage") or ""),
            short_note=str(
                (result.get("bloomColor") or "")
                + " "
                + (result.get("shortNote") or "")
            ).strip(),
        )
        if still.get("ok") and still.get("imageBase64"):
            token = save_still_token(
                str(still.get("mimeType") or "image/jpeg"),
                str(still["imageBase64"]),
            )
            if token:
                result["stillToken"] = token
                result["stillUrl"] = f"/bane-of-extinction/api/still/{token}"
                result["codexStill"] = {
                    "token": token,
                    "url": result["stillUrl"],
                    "mimeType": still.get("mimeType") or "image/jpeg",
                    "imageBase64": still["imageBase64"],
                    "matched": True,
                    "fromPhoto": still.get("fromPhoto", True),
                    "lifeStage": result.get("lifeStage") or "",
                    "model": still.get("model"),
                }
                print(
                    f"bane_codex_still ok common={result['commonName']!r} "
                    f"stage={result.get('lifeStage')!r} "
                    f"model={still.get('model')!r} token={token}",
                    flush=True,
                )
            else:
                result["stillToken"] = None
                result["codexStill"] = {
                    "mimeType": still.get("mimeType") or "image/jpeg",
                    "imageBase64": still["imageBase64"],
                    "matched": True,
                    "fromPhoto": still.get("fromPhoto", True),
                    "lifeStage": result.get("lifeStage") or "",
                    "model": still.get("model"),
                }
                result["codexStillError"] = "still_store_failed"
                print(
                    f"bane_codex_still store_fail common={result['commonName']!r}",
                    flush=True,
                )
        else:
            result["stillToken"] = None
            result["codexStill"] = None
            result["codexStillError"] = still.get("message") or still.get("error")
            print(
                f"bane_codex_still miss common={result['commonName']!r} "
                f"err={result['codexStillError']!r}",
                flush=True,
            )

    return result


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


# NatureServe global ranks → plain family-friendly labels (not IUCN categories).
_NS_GRANK_LABELS = {
    "GX": "Extinct",
    "GH": "Possibly extinct",
    "G1": "Critically imperiled",
    "G2": "Imperiled",
    "G3": "Vulnerable",
    "G4": "Apparently secure",
    "G5": "Secure",
    "GNR": "Not ranked yet",
    "GNA": "Not applicable",
    "GU": "Unrankable",
}

_US_STATE_NAMES = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "Washington, D.C.",
}

_CA_PROVINCE_NAMES = {
    "AB": "Alberta",
    "BC": "British Columbia",
    "MB": "Manitoba",
    "NB": "New Brunswick",
    "NL": "Newfoundland and Labrador",
    "NS": "Nova Scotia",
    "NT": "Northwest Territories",
    "NU": "Nunavut",
    "ON": "Ontario",
    "PE": "Prince Edward Island",
    "QC": "Quebec",
    "SK": "Saskatchewan",
    "YT": "Yukon",
}

_WEST_US = {"CA", "OR", "WA", "NV", "AZ", "NM", "UT", "ID", "CO", "WY", "MT", "TX", "OK"}


def _grank_base(code: str) -> str:
    raw = (code or "").strip().upper()
    if not raw:
        return ""
    # Strip qualifiers like G4G5, G5T5 → take leading global rank token
    m = re.match(r"^(GNR|GNA|GU|GX|GH|G[1-5])", raw)
    if m:
        return m.group(1)
    return raw[:3]


def _status_from_grank(grank: str) -> str:
    base = _grank_base(grank)
    label = _NS_GRANK_LABELS.get(base)
    if not label:
        return ""
    return f"{label} (NatureServe {base})"


def _place_label(nation: str, code: str) -> str:
    code_u = (code or "").upper()
    if nation == "US":
        return _US_STATE_NAMES.get(code_u, code_u)
    if nation == "CA":
        return _CA_PROVINCE_NAMES.get(code_u, code_u)
    return code_u


def _summarize_native_places(
    us_native: list[str],
    ca_native: list[str],
) -> str:
    us = sorted({c.upper() for c in us_native if c})
    ca = sorted({c.upper() for c in ca_native if c})
    parts: list[str] = []

    if us:
        names = [_place_label("US", c) for c in us]
        if set(us) <= _WEST_US and "CA" in us and len(us) <= 8:
            others = [n for c, n in zip(us, names) if c != "CA"]
            if others:
                parts.append(
                    "Native to California and nearby West ("
                    + ", ".join(others[:5])
                    + ("…" if len(others) > 5 else "")
                    + ")"
                )
            else:
                parts.append("Native to California")
        elif len(us) >= 20:
            parts.append("Native across much of the United States")
        elif len(us) >= 8:
            sample = ", ".join(names[:4])
            parts.append(f"Native in several U.S. states (incl. {sample})")
        else:
            parts.append("Native in " + ", ".join(names))

    if ca:
        names = [_place_label("CA", c) for c in ca]
        if len(ca) >= 6:
            parts.append("also native in parts of Canada")
        else:
            parts.append("native in " + ", ".join(names) + " (Canada)")

    if not parts:
        return ""
    return "; ".join(parts)[:180]


def _summarize_exotic_places(us_exotic: list[str], ca_exotic: list[str]) -> str:
    """Soft 'elsewhere' line from NatureServe exotic flags (not a legal invasive list)."""
    us = sorted({c.upper() for c in us_exotic if c})
    ca = sorted({c.upper() for c in ca_exotic if c})
    parts: list[str] = []

    if us:
        names = [_place_label("US", c) for c in us]
        # Soft caution — NatureServe marks exotic/introduced, not a legal invasive list.
        if len(us) >= 20:
            parts.append(
                "Caution: often introduced or invasive across much of the United States"
            )
        elif len(us) >= 8:
            sample = ", ".join(names[:5])
            parts.append(
                f"Caution: often introduced or invasive in several U.S. states (e.g. {sample})"
            )
        elif len(us) == 1:
            parts.append(
                f"Caution: often introduced or invasive in U.S. states such as {names[0]}"
            )
        else:
            sample = ", ".join(names[:6])
            more = "…" if len(names) > 6 else ""
            parts.append(
                f"Caution: often introduced or invasive in U.S. states such as {sample}{more}"
            )

    if ca:
        names = [_place_label("CA", c) for c in ca]
        if len(ca) >= 6:
            parts.append("also introduced in parts of Canada")
        else:
            parts.append(
                "also introduced in " + ", ".join(names) + " (Canada)"
            )

    if not parts:
        return ""
    return "; ".join(parts)[:180]


def _fallback_species_meta(common: str, latin: str) -> dict[str, str]:
    blob = (common + " " + latin).lower()
    if "poppy" in blob or "eschscholzia" in blob:
        return {
            "nativeRange": "Native to California and nearby Southwest (NorCal & SoCal)",
            "rangeElsewhere": "Caution: planted ornamentally outside its native Southwest range",
            "conservationStatus": "Apparently secure (NatureServe G4)",
            "statusSource": "curated",
            "rangeSource": "curated",
        }
    if "sunflower" in blob or "helianthus" in blob:
        return {
            "nativeRange": "Native to North America",
            "rangeElsewhere": "Caution: widely planted in gardens far from wild stands",
            "conservationStatus": "Secure (NatureServe G5)",
            "statusSource": "curated",
            "rangeSource": "curated",
        }
    if (
        "philodendron" in blob
        or "hederaceum" in blob
        or "scandens" in blob
        or "sweetheart" in blob
        or "heartleaf" in blob
    ):
        return {
            "nativeRange": "Native to tropical Central & South America",
            "rangeElsewhere": "Caution: houseplant / greenhouse plant elsewhere — not a wild U.S. native",
            "conservationStatus": "Not tracked as a wild U.S. species",
            "statusSource": "curated",
            "rangeSource": "curated",
        }
    return {
        "nativeRange": "",
        "rangeElsewhere": "",
        "conservationStatus": "",
        "statusSource": "",
        "rangeSource": "",
    }


def _fetch_natureserve_meta(latin: str) -> dict[str, Any] | None:
    """Look up NatureServe Explorer (CC BY). Never reads IUCN fields."""
    name = (latin or "").strip()
    if not name or len(name) < 3:
        return None
    # Prefer binomial only
    parts = name.split()
    if len(parts) >= 2:
        name = f"{parts[0]} {parts[1]}"
    payload = {
        "criteriaType": "species",
        "textCriteria": [
            {
                "paramType": "textSearch",
                "searchToken": name,
                "matchAgainst": "allScientificNames",
                "operator": "equals",
            }
        ],
        "statusCriteria": [],
        "locationCriteria": [],
        "pagingOptions": {"page": 0, "recordsPerPage": 5},
        "recordSubtypeCriteria": [],
        "modifiedSince": None,
        "locationOptions": None,
        "classificationOptions": None,
        "speciesTaxonomyCriteria": [],
    }
    req = urllib.request.Request(
        "https://explorer.natureserve.org/api/data/speciesSearch",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "OddTrove-BaneOfExtinction/1.0 (owner-beta conservation education)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError):
        return None

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or not results:
        return None

    target = name.lower()
    hit = None
    for row in results:
        if not isinstance(row, dict):
            continue
        sci = str(row.get("scientificName") or "").strip().lower()
        if sci == target or sci.startswith(target + " "):
            hit = row
            break
    if hit is None and isinstance(results[0], dict):
        hit = results[0]

    grank = str(hit.get("roundedGRank") or hit.get("gRank") or "").strip()
    status = _status_from_grank(grank)
    us_native: list[str] = []
    ca_native: list[str] = []
    us_exotic: list[str] = []
    ca_exotic: list[str] = []
    for nation in hit.get("nations") or []:
        if not isinstance(nation, dict):
            continue
        ncode = str(nation.get("nationCode") or "").upper()
        for sub in nation.get("subnations") or []:
            if not isinstance(sub, dict):
                continue
            scode = str(sub.get("subnationCode") or "").strip().upper()
            if not scode:
                continue
            is_native = bool(sub.get("native"))
            is_exotic = bool(sub.get("exotic")) and not is_native
            if is_native:
                if ncode == "US":
                    us_native.append(scode)
                elif ncode == "CA":
                    ca_native.append(scode)
            elif is_exotic:
                if ncode == "US":
                    us_exotic.append(scode)
                elif ncode == "CA":
                    ca_exotic.append(scode)

    native_range = _summarize_native_places(us_native, ca_native)
    range_elsewhere = _summarize_exotic_places(us_exotic, ca_exotic)
    if not status and not native_range and not range_elsewhere:
        return None
    return {
        "nativeRange": native_range,
        "rangeElsewhere": range_elsewhere,
        "conservationStatus": status,
        "statusSource": "natureserve" if status else "",
        "rangeSource": "natureserve" if (native_range or range_elsewhere) else "",
        "grank": _grank_base(grank),
        "caNative": "CA" in {c.upper() for c in us_native},
        "scientificName": str(hit.get("scientificName") or name),
        "attribution": (
            f"NatureServe. {time.gmtime().tm_year}. NatureServe Explorer "
            "(https://explorer.natureserve.org/). CC BY."
        ),
    }


def _merge_species_meta(
    ns: dict[str, Any] | None,
    claude_meta: dict[str, Any] | None,
    fallback: dict[str, str],
) -> dict[str, str]:
    ns = ns or {}
    claude_meta = claude_meta or {}
    native = str(ns.get("nativeRange") or "").strip()
    elsewhere = str(ns.get("rangeElsewhere") or "").strip()
    status = str(ns.get("conservationStatus") or "").strip()
    range_src = str(ns.get("rangeSource") or "")
    status_src = str(ns.get("statusSource") or "")

    # Claude may refine California to NorCal / SoCal / statewide (not counties).
    refine = str(
        claude_meta.get("nativeRangeRefine")
        or claude_meta.get("nativeRange")
        or ""
    ).strip()
    if refine and len(refine) <= 160:
        low = refine.lower()
        if ns.get("caNative") and any(
            t in low
            for t in (
                "norcal",
                "socal",
                "northern california",
                "southern california",
                "statewide",
            )
        ):
            native = refine
            range_src = "natureserve+claude"
        elif not native:
            native = refine
            range_src = "claude"

    claude_elsewhere = str(
        claude_meta.get("rangeElsewhere") or claude_meta.get("invasiveElsewhere") or ""
    ).strip()
    if claude_elsewhere and len(claude_elsewhere) <= 180:
        if not elsewhere:
            elsewhere = claude_elsewhere
            if "claude" not in range_src:
                range_src = (range_src + "+claude").strip("+") if range_src else "claude"
        elif "invasive" in claude_elsewhere.lower() and "invasive" not in elsewhere.lower():
            # NatureServe only marks exotic; Claude may add soft invasive wording.
            elsewhere = claude_elsewhere
            range_src = "natureserve+claude"

    claude_status = str(claude_meta.get("conservationStatus") or "").strip()
    if not status and claude_status and len(claude_status) <= 100:
        # Plain helper wording only — do not ship IUCN codes as official.
        if not re.search(r"\bIUCN\b", claude_status, re.I):
            status = claude_status
            status_src = "claude"

    if not native:
        native = fallback.get("nativeRange") or ""
        if native:
            range_src = fallback.get("rangeSource") or "curated"
    if not elsewhere:
        elsewhere = fallback.get("rangeElsewhere") or ""
        if elsewhere and not range_src:
            range_src = fallback.get("rangeSource") or "curated"
    if not status:
        status = fallback.get("conservationStatus") or ""
        if status:
            status_src = fallback.get("statusSource") or "curated"

    # Prefer showing a status line whenever we have any range/ID context.
    if not status and (native or elsewhere or ns.get("scientificName")):
        status = "Not listed in NatureServe data we checked"
        status_src = status_src or "fallback"

    return {
        "nativeRange": native[:180],
        "rangeElsewhere": elsewhere[:180],
        "conservationStatus": status[:100],
        "statusSource": status_src[:40],
        "rangeSource": range_src[:40],
        "attribution": str(ns.get("attribution") or "")[:220],
    }


def build_callouts(
    *,
    common: str,
    latin: str,
    cultivar: str,
    evidence: bool,
    organism_type: str = "",
    short_note: str = "",
    bloom_color: str = "",
    avoid_facts: list[str] | None = None,
    place_id: str = "",
    place_label: str = "",
    region: str = "",
    habitat: str = "",
    habitat_only: bool = False,
    compare_place_id: str = "",
    compare_place_label: str = "",
    season: str = "",
) -> dict[str, Any]:
    display = common.strip()
    if not display:
        raise ValueError("commonName required")
    latin_n = latin.strip()
    cultivar_n = cultivar.strip()
    note_n = short_note.strip()
    color_n = bloom_color.strip()
    org_type = (organism_type or ("evidence" if evidence else "organism")).strip()[:40]
    avoid = [
        str(x).strip()[:320]
        for x in (avoid_facts or [])
        if str(x).strip()
    ][:40]
    place_id_n = place_id.strip()[:64]
    place_label_n = place_label.strip()[:120]
    region_n = region.strip()[:40]
    habitat_n = habitat.strip()[:40]
    compare_id_n = compare_place_id.strip()[:64]
    compare_label_n = compare_place_label.strip()[:120]
    season_n = season.strip()[:20] or ""

    ns_meta = _fetch_natureserve_meta(latin_n) if latin_n else None
    fallback_meta = _fallback_species_meta(display, latin_n)

    system = (
        "You write short, family-friendly wildlife and plant education callouts for "
        "Bane of Extinction. Return ONLY valid JSON. No Wikipedia, no URLs, no scraping. "
        "Use well-established general knowledge about the NAMED organism below "
        "(the game's best guess). If unsure, say so gently. No medical claims. "
        "Visible traits / ecology / diet / habitat / pollinators — not internal anatomy. "
        "CRITICAL: match petal/ray COLOR from the identification and scan note. "
        "A red or dark sunflower must NOT get yellow-only petal facts. "
        "TONE — help a walker feel this organism belongs in THEIR world, not a textbook dump. "
        "Most callouts must tie the organism to everyday human life in a gentle way "
        "(what you’d notice on a walk or in a yard, shared air/water/food webs, shade, "
        "pollinators near people, pets/kids safety when relevant, seasons you meet it, "
        "how it shares neighborhoods). Warm and concrete — not lecturey. "
        "PLACE LENS — the player chose a place they are LOOKING AT (not GPS). "
        "Personalize tips to that lens: native vs introduced vs invasive THERE, "
        "whether backyard/bee advice makes sense THERE, and what a neighbor might do "
        "in THAT kind of place. If only a habitat was chosen (no region), keep advice "
        "habitat-shaped and say status may differ by region. Never claim you know where "
        "the player is standing. "
        "EXACTLY ONE of those everyday callouts must be a SMALL HELP tip: something a "
        "walker or neighbor can actually do that supports THIS species’ natural world "
        "or nearby habitat (leave a patch alone, skip a pesticide on that plant, keep a "
        "water dish for pollinators, don’t dig a nest, plant a native companion, etc.). "
        "Help tip rules: practical and local to the place lens; never guilt-trip; never blame everyday "
        "survival needs (staple foods, housing, transit they don’t control); never blame "
        "people for industrial waste or systems they don’t get a say in; never panic about "
        "extinction. Prefer kindness they can choose over blame for what they can’t. "
        "EXACTLY ONE callout (separate from the help tip) should be a wonder fact about "
        "the species itself (its own trick, life cycle, or ecology) with less direct "
        "human impact. Do not invent personal medical advice. "
        "Also fill nativeRangeRefine, rangeElsewhere, and conservationStatus as SHORT "
        "caption fields (not extra callouts). "
        "nativeRangeRefine: where it is native (region/country/state level — e.g. "
        "'Native in Mexico', 'Native to California and nearby Southwest'). Never "
        "county-level unless status truly differs that finely. "
        "rangeElsewhere: where it is introduced or often invasive OUTSIDE that native "
        "range (e.g. 'Caution: often invasive in U.S. states such as Oklahoma, California'). "
        "Do NOT require a compare place for this — always fill when known. Start with "
        "'Caution:' when invasive/introduced — this is a learning heads-up, NOT an official "
        "invasive-species registry. Soft wording ('often invasive', 'introduced') when "
        "unsure of legal lists. Empty only if it is not meaningfully invasive/introduced "
        "elsewhere, or truly unknown. "
        "conservationStatus: ALWAYS fill when possible — plain words like Secure, "
        "Apparently secure, Vulnerable, Imperiled, or 'common garden plant / not tracked "
        "wild in the U.S.' Do NOT cite IUCN or invent Red List codes. Do not paste "
        "Wikipedia lists. "
        "Also fill localStatus (short: e.g. 'Native in SoCal yards', 'Invasive on CA coast', "
        "'Houseplant only — not wild here') for the LOOKING-AT place, or empty if place skipped. "
        "If a compare place is given, fill compareNote with one short contrast "
        "(e.g. 'Native in CA; often invasive on Southeastern dunes') — else empty."
    )
    scope = (
        f"Identified as: {display}"
        + (f" ({latin_n})" if latin_n else "")
        + (f"; cultivar note: {cultivar_n}" if cultivar_n else "")
        + (f"; bloom color: {color_n}" if color_n else "")
        + (f"; scan note: {note_n}" if note_n else "")
        + f"; type: {org_type}. "
        "Write callouts accurate for THIS identification and visible color. "
        "If red/dark sunflower rays, describe those — not classic yellow-only petals. "
        "Put the help tip near the middle when possible; put the species-wonder fact last."
    )
    if place_label_n or place_id_n:
        scope += (
            f" LOOKING-AT place (chosen, not GPS): {place_label_n or place_id_n}"
            + (f" [id={place_id_n}]" if place_id_n and place_label_n else "")
            + (f"; region={region_n}" if region_n else "")
            + (f"; habitat={habitat_n}" if habitat_n else "")
            + ("; habitat-only lens (no named region)" if habitat_only else "")
            + ". Personalize native/invasive/help tips for THIS lens."
        )
    else:
        scope += (
            " No place lens chosen — keep facts generally accurate; avoid claiming "
            "a backyard tip is always good everywhere; prefer range-aware wording."
        )
    if compare_label_n or compare_id_n:
        scope += (
            f" COMPARE place (also chosen, not GPS): "
            f"{compare_label_n or compare_id_n}. "
            "Fill compareNote with one short contrast vs the looking-at place."
        )
    if season_n:
        scope += f" Season cue from device date: {season_n}."
    if ns_meta:
        if ns_meta.get("nativeRange"):
            scope += (
                f" NatureServe native summary (prefer refining CA to NorCal/SoCal/"
                f"statewide when useful): {ns_meta['nativeRange']}."
            )
        if ns_meta.get("rangeElsewhere"):
            scope += (
                f" NatureServe introduced/exotic elsewhere (you may soft-word as "
                f"'often invasive' when that is well known): {ns_meta['rangeElsewhere']}."
            )
        if ns_meta.get("conservationStatus"):
            scope += (
                f" NatureServe status already known — leave conservationStatus empty "
                f"or echo the same idea without IUCN: {ns_meta['conservationStatus']}."
            )
        else:
            scope += (
                " NatureServe had no usable conservation status — fill "
                "conservationStatus with a short plain-words best estimate, or say "
                "common/not tracked if that fits."
            )
        if ns_meta.get("caNative"):
            scope += (
                " This species is marked native in California — nativeRangeRefine may say "
                "NorCal, SoCal, or statewide California when that distinction matters."
            )
        if not ns_meta.get("rangeElsewhere"):
            scope += (
                " No NatureServe exotic-state list — still fill rangeElsewhere from "
                "well-known native vs introduced/invasive regions when you know them "
                "(e.g. native in Mexico; often invasive in some U.S. states)."
            )
    else:
        scope += (
            " No NatureServe hit — still fill nativeRangeRefine, rangeElsewhere, and "
            "conservationStatus from well-established knowledge when you can "
            "(native vs often invasive/introduced elsewhere; plain-words status)."
        )
    if evidence:
        scope += " Frame as evidence/clues the player noticed."
    if avoid:
        scope += (
            " FRESHNESS — the player already saw these facts for this species recently. "
            "Do NOT repeat or closely paraphrase them. Pick new angles, parts, seasons, "
            "neighbors, help tips, or wonder: "
            + " | ".join(avoid[:24])
        )

    user = (
        scope
        + "\n\nReturn JSON:\n"
        + json.dumps(
            {
                "organismType": org_type or "organism",
                "nativeRangeRefine": "short native-range caption or empty",
                "rangeElsewhere": (
                    "short introduced/often-invasive-elsewhere caption or empty"
                ),
                "conservationStatus": "short status caption (prefer always fill)",
                "localStatus": "short status for looking-at place or empty",
                "compareNote": "short contrast vs compare place or empty",
                "callouts": [
                    {
                        "anchor": "part_or_clue",
                        "label": "Short label",
                        "fact": "1–2 short sentences",
                    }
                ],
            }
        )
        + f"\nUse 3 to {MAX_CALLOUTS} callouts. "
        "Mix: everyday player-world facts (including EXACTLY ONE small-help tip for "
        "this species’ world) + EXACTLY ONE species-own wonder. Fresh angles if avoid-list given. "
        "Keep nativeRangeRefine, rangeElsewhere, conservationStatus, localStatus, and "
        "compareNote out of the callout list."
    )

    claude_meta: dict[str, Any] = {}
    local_status = ""
    compare_note = ""
    try:
        raw_text = _call_claude_text(system, user)
        parsed = _extract_json_object(raw_text)
        callouts = _normalize_callouts(parsed.get("callouts"))
        if len(callouts) < 2:
            raise RuntimeError("Too few callouts")
        source = "claude"
        if not organism_type and parsed.get("organismType"):
            org_type = str(parsed.get("organismType"))[:40]
        claude_meta = {
            "nativeRangeRefine": parsed.get("nativeRangeRefine")
            or parsed.get("nativeRange"),
            "rangeElsewhere": parsed.get("rangeElsewhere")
            or parsed.get("invasiveElsewhere"),
            "conservationStatus": parsed.get("conservationStatus"),
        }
        local_status = str(parsed.get("localStatus") or "").strip()[:160]
        compare_note = str(parsed.get("compareNote") or "").strip()[:200]
    except Exception as exc:  # noqa: BLE001
        blob = (display + " " + latin_n + " " + note_n + " " + color_n).lower()
        if "poppy" in blob or "eschscholzia" in blob:
            callouts = list(FALLBACK_CALLOUTS_POPPY)
        elif "sunflower" in blob or "helianthus" in blob:
            callouts = list(FALLBACK_CALLOUTS_SUNFLOWER)
            if any(c in blob for c in ("red", "burgundy", "crimson", "dark", "black")):
                callouts = [
                    {
                        "anchor": "petals",
                        "label": "Ray color",
                        "fact": "This form shows dark or red ray florets instead of classic yellow — garden sunflowers come in many petal colors.",
                    },
                    *callouts[1:3],
                    callouts[-1],
                ][:MAX_CALLOUTS]
        elif (
            "philodendron" in blob
            or "hederaceum" in blob
            or "scandens" in blob
            or "sweetheart" in blob
            or "heartleaf" in blob
        ):
            callouts = list(FALLBACK_CALLOUTS_PHILODENDRON)
        else:
            callouts = [
                {
                    "anchor": "overview",
                    "label": "Overview",
                    "fact": f"Best guess right now: {display}. Facts service had a hiccup — try Load again.",
                }
            ]
        source = f"fallback:{type(exc).__name__}"
        local_status, compare_note = _fallback_place_status(
            display,
            latin_n,
            place_id_n,
            place_label_n,
            region_n,
            habitat_n,
            habitat_only,
            compare_label_n,
        )

    meta = _merge_species_meta(ns_meta, claude_meta, fallback_meta)

    title = display
    if cultivar_n and cultivar_n.lower() not in display.lower():
        title = f"{display} ({cultivar_n})"

    disclaimer = (
        "Helper facts for what the game thinks it saw — useful for learning, "
        "not a guaranteed field guide."
    )
    if place_label_n:
        disclaimer += (
            " Place tips follow the looking-at place you chose — not GPS or where you stand."
        )
    if meta.get("attribution"):
        disclaimer += " " + meta["attribution"]

    return {
        "ok": True,
        "source": source,
        "organismType": org_type,
        "commonName": display,
        "latinName": latin_n,
        "cultivar": cultivar_n or None,
        "displayName": title,
        "callouts": callouts,
        "nativeRange": meta.get("nativeRange") or "",
        "rangeElsewhere": meta.get("rangeElsewhere") or "",
        "conservationStatus": meta.get("conservationStatus") or "",
        "statusSource": meta.get("statusSource") or "",
        "rangeSource": meta.get("rangeSource") or "",
        "placeId": place_id_n,
        "placeLabel": place_label_n,
        "localStatus": local_status,
        "comparePlaceId": compare_id_n,
        "comparePlaceLabel": compare_label_n,
        "compareNote": compare_note,
        "season": season_n,
        "disclaimer": disclaimer,
    }


def _fallback_place_status(
    common: str,
    latin: str,
    place_id: str,
    place_label: str,
    region: str,
    habitat: str,
    habitat_only: bool,
    compare_label: str,
) -> tuple[str, str]:
    """Simple localStatus / compareNote when Claude is unavailable."""
    blob = (common + " " + latin).lower()
    pid = (place_id or "").lower()
    reg = (region or "").lower()
    local = ""
    if "eschscholzia" in blob or "poppy" in blob:
        if "socal" in pid or "norcal" in pid or reg in ("socal", "norcal"):
            local = "Native in California"
        elif habitat_only:
            local = "Native in CA; elsewhere often a planted ornamental"
        else:
            local = "Native range centered on California / Southwest"
    elif "helianthus" in blob or "sunflower" in blob:
        if "backyard" in pid or habitat == "garden":
            local = "Often planted for pollinators; native to North America broadly"
        else:
            local = "Native to North America; widely planted"
    elif "philodendron" in blob or "hederaceum" in blob or "sweetheart" in blob:
        local = "Houseplant here — not a local wild species"
    elif "eucalyptus" in blob:
        if "socal" in pid or "norcal" in pid or reg in ("socal", "norcal"):
            local = "Introduced / planted in California — not native"
        else:
            local = "Australian origin; status depends on the place you pick"
    if not local and place_label:
        local = f"See facts for {place_label}"
    compare = ""
    if compare_label and local:
        compare = f"Vs {compare_label}: status can flip — reload with Claude for a contrast note."
    elif compare_label:
        compare = f"Comparing with {compare_label}"
    return local[:160], compare[:200]



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
                    "geminiImageModels": _image_model_candidates(),
                    "sso": identity_from_cookie_header is not None,
                },
            )
            return
        if path in ("/api/auth/me", "/auth/me"):
            identity = _sso_identity(self)
            if identity:
                _json(
                    self,
                    200,
                    {
                        "ok": True,
                        "signedIn": True,
                        "email": identity.get("email") or "",
                        "googleSub": identity.get("google_sub") or "",
                    },
                )
            else:
                _json(
                    self,
                    200,
                    {
                        "ok": True,
                        "signedIn": False,
                        "ssoAvailable": identity_from_cookie_header is not None,
                    },
                )
            return
        if path == "/api/learned":
            identity = _sso_identity(self)
            if not identity or not identity.get("email"):
                _json(
                    self,
                    401,
                    {
                        "ok": False,
                        "error": "sign_in_required",
                        "message": "Sign in with Google to sync learns across devices.",
                    },
                )
                return
            entries = load_learned(str(identity["email"]))
            _json(
                self,
                200,
                {
                    "ok": True,
                    "signedIn": True,
                    "email": identity["email"],
                    "entries": entries,
                },
            )
            return
        still_m = re.fullmatch(r"/api/still/([A-Za-z0-9_-]{8,64})", path)
        if still_m:
            packed = load_still_bytes(still_m.group(1))
            if not packed:
                _json(self, 404, {"ok": False, "error": "still_not_found"})
                return
            mime, data = packed
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "private, max-age=600")
            _cors(self)
            self.end_headers()
            self.wfile.write(data)
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
            want_still = bool(
                body.get("wantCodexStill")
                or body.get("wantStill")
                or body.get("includeCodexStill")
            )
            result = identify_wildlife(
                image_b64, mime, want_codex_still=want_still
            )
            code = 200 if result.get("ok") else (
                503
                if not gemini_api_key() and not anthropic_api_key()
                else 502
            )
            _json(self, code, result)
            return

        if path == "/api/codex-still":
            image_b64 = str(body.get("imageBase64") or "").strip()
            mime = str(body.get("mimeType") or "image/jpeg").strip()
            common = str(body.get("commonName") or body.get("common") or "").strip()
            latin = str(body.get("latinName") or body.get("latin") or "").strip()
            cultivar = str(body.get("cultivar") or "").strip()
            organism_type = str(body.get("organismType") or "").strip()
            short_note = str(body.get("shortNote") or "").strip()
            life_stage = str(body.get("lifeStage") or "").strip()
            result = generate_codex_still(
                image_b64 or None,
                mime,
                common=common,
                latin=latin,
                cultivar=cultivar,
                organism_type=organism_type,
                short_note=short_note,
                life_stage=life_stage,
            )
            code = 200 if result.get("ok") else (
                503 if not gemini_api_key() else 502
            )
            _json(self, code, result)
            return

        if path == "/api/callouts":
            common = str(body.get("commonName") or body.get("common") or "").strip()
            latin = str(body.get("latinName") or body.get("latin") or "").strip()
            cultivar = str(body.get("cultivar") or "").strip()
            evidence = bool(body.get("evidence"))
            organism_type = str(body.get("organismType") or "").strip()
            short_note = str(body.get("shortNote") or body.get("note") or "").strip()
            bloom_color = str(body.get("bloomColor") or "").strip()
            avoid_raw = body.get("avoidFacts") or body.get("recentFacts") or []
            if not isinstance(avoid_raw, list):
                avoid_raw = []
            avoid_facts = [
                str(x).strip()[:320] for x in avoid_raw if str(x).strip()
            ][:40]
            place_id = str(body.get("placeId") or "").strip()
            place_label = str(body.get("placeLabel") or "").strip()
            region = str(body.get("region") or "").strip()
            habitat = str(body.get("habitat") or "").strip()
            habitat_only = bool(body.get("habitatOnly"))
            compare_place_id = str(body.get("comparePlaceId") or "").strip()
            compare_place_label = str(body.get("comparePlaceLabel") or "").strip()
            season = str(body.get("season") or "").strip()
            if not common:
                _json(
                    self,
                    400,
                    {
                        "ok": False,
                        "error": "missing_organism",
                        "message": "commonName is required — scan first or pick a demo.",
                    },
                )
                return
            result = build_callouts(
                common=common,
                latin=latin,
                cultivar=cultivar,
                evidence=evidence,
                organism_type=organism_type,
                short_note=short_note,
                bloom_color=bloom_color,
                avoid_facts=avoid_facts,
                place_id=place_id,
                place_label=place_label,
                region=region,
                habitat=habitat,
                habitat_only=habitat_only,
                compare_place_id=compare_place_id,
                compare_place_label=compare_place_label,
                season=season,
            )
            _json(self, 200, result)
            return

        if path in ("/api/learned", "/api/learned/sync"):
            identity = _sso_identity(self)
            if not identity or not identity.get("email"):
                _json(
                    self,
                    401,
                    {
                        "ok": False,
                        "error": "sign_in_required",
                        "message": "Sign in with Google to sync learns across devices.",
                    },
                )
                return
            email = str(identity["email"])
            remote = load_learned(email)
            incoming = body.get("entries")
            if incoming is None and isinstance(body.get("entry"), dict):
                incoming = [body["entry"]]
            local = _normalize_learned_list(incoming if incoming is not None else [])
            mode = str(body.get("mode") or "merge").strip().lower()
            if mode == "replace":
                saved = save_learned(email, local)
            else:
                saved = save_learned(email, merge_learned(local, remote))
            _json(
                self,
                200,
                {
                    "ok": True,
                    "signedIn": True,
                    "email": email,
                    "entries": saved,
                    "mode": mode if mode in ("merge", "replace") else "merge",
                },
            )
            return

        _json(self, 404, {"ok": False, "error": "not_found"})

    def do_PUT(self) -> None:  # noqa: N802
        self.do_POST()


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
