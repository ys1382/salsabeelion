"""
Bane of Extinction — owner-beta API.

- POST /api/wildlife-identify  — Gemini + Claude vision ID (photo not stored)
- POST /api/codex-still        — Gemini image: field-guide still matching this ID + crop
                                  (one shared still per species+life-stage; rescans reuse)
- POST /api/callouts           — Claude helper facts + native range / conservation status
                                  (optional looking-at place lens; focus modes; no GPS)
- GET  /api/auth/me            — Odd Trove Google SSO identity (for learned sync)
- GET/PUT /api/learned         — wildlife learns + fact book synced to signed-in Google account
- GET  /api/health

Binds 127.0.0.1 only. Keys from env / shared kids-sites files.
Facts: Claude helper knowledge + curated fallbacks. Status/range: NatureServe Explorer
(CC BY) when a scientific name matches — never IUCN site/API, never Wikipedia as sole source.
Introduced/invasive caption: USGS US-RIIS (CC0) when latin name matches AK/HI/L48 lists;
else NatureServe exotic flags + Claude soft caution. Caption fields: conservation status
when possible; native range; elsewhere (no compare-place required). Raw scan photos are
never written to disk. Fact levels (notice → help → wonder) are separate from mission levels.
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
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
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
POOL_REFILL_CALLOUTS = 8
MAX_FACT_CHARS = 480
MAX_SHORT_NOTE_CHARS = 240
# Keep identify responsive: art may skip if Gemini is slow (ID still returns).
CODEX_STILL_BUDGET_SEC = int(os.environ.get("BANE_STILL_BUDGET_SEC", "55"))
MAX_IMAGE_B64 = 4_500_000
MAX_LEARNED_ENTRIES = 48
MAX_LEARNED_FACTS = 400
MAX_LEARNED_BODY = 3_500_000
MAX_SHELF_HINTS = 48

# Fact levels (separate from mission L1/L2/L3). Commitment unlocks fact kinds.
FACT_LEVEL_THRESHOLDS = (
    (1, 0, ("notice",)),
    (2, 8, ("notice", "help")),
    (3, 20, ("notice", "help", "wonder")),
    (4, 40, ("notice", "help", "wonder")),
)
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
# Permanent shared library: one field-guide still per species (+ cultivar) + life stage.
STAGE_STILL_DIR = os.environ.get(
    "BANE_STAGE_STILL_DIR",
    os.path.join(os.path.expanduser("~"), "kids-sites", "bane-server", "stage-stills"),
)
US_RIIS_PATH = os.environ.get(
    "BANE_US_RIIS_PATH",
    os.path.join(_HERE, "data", "us_riis_lookup.json"),
)
_US_RIIS_CACHE: dict[str, Any] | None = None
_US_RIIS_BY: dict[str, dict[str, str]] | None = None
_US_RIIS_ATTR = ""

POPPY_DEFAULT = {
    "common": "California poppy",
    "latin": "Eschscholzia californica",
    "cultivar": "Watermelon Heaven",
    "organismType": "flower",
    "anchors": ["petals", "center", "foliage", "habit", "seed_pod"],
}

# Walk / wildlife eco focus (garden focus OFF)
FALLBACK_CALLOUTS_POPPY_WALK = [
    {
        "anchor": "petals",
        "label": "Petals",
        "fact": "Those soft, crepe-paper petals are what make a roadside or hillside pop of orange catch your eye on a sunny walk.",
    },
    {
        "anchor": "center",
        "label": "Flower center",
        "fact": "A lighter center helps you tell one bloom from the next in bright sun — useful when you’re matching what you see outdoors.",
    },
    {
        "anchor": "help",
        "label": "Small help",
        "fact": "If a sunny wild patch already holds them near a path you use, leaving that lean soil alone (skip dumping rich mulch or extra water there) helps them keep their own rhythm.",
    },
    {
        "anchor": "foliage",
        "label": "Feathery leaves",
        "fact": "Blue-green, finely cut leaves help the plant itself handle heat and thin soil — a quiet drought trick of its own.",
    },
]

# Garden eco focus (garden focus ON) — includes seed dispersal / grower noticing
FALLBACK_CALLOUTS_POPPY_GARDEN = [
    {
        "anchor": "petals",
        "label": "Petals",
        "fact": "Those soft, crepe-paper petals are what make a bed or border pop of orange catch your eye when you’re tending plants.",
    },
    {
        "anchor": "seed_pod",
        "label": "Seed pods",
        "fact": "Dry pods can fling seeds a short way when they split — a small dispersal trick that helps seedlings show up near last year’s plants.",
    },
    {
        "anchor": "help",
        "label": "Small help",
        "fact": "If they already self-sow in a sunny lean corner, leave that dry soil alone (skip heavy water and rich fertilizer there) so they keep blooming without you fighting their habits.",
    },
    {
        "anchor": "foliage",
        "label": "Feathery leaves",
        "fact": "Blue-green, finely cut leaves help the plant itself handle heat and thin soil — a quiet drought trick of its own.",
    },
]

FALLBACK_CALLOUTS_SUNFLOWER_WALK = [
    {
        "anchor": "disk",
        "label": "Center disk",
        "fact": "That busy middle feeds bees and other pollinators you also meet on neighborhood walks and shared green edges.",
    },
    {
        "anchor": "petals",
        "label": "Ray color",
        "fact": "Ray colors range from classic yellow-gold to red, burgundy, and near-black — match the shade you actually see, not a textbook yellow.",
    },
    {
        "anchor": "help",
        "label": "Small help",
        "fact": "Where spent heads stand along a fence or field edge you pass, leaving a few upright for a while offers birds an easy snack — a small local kindness.",
    },
    {
        "anchor": "head",
        "label": "Flower head",
        "fact": "What looks like one big flower is really a head of many tiny florets — ray florets outside, packed disk florets in the middle.",
    },
]

FALLBACK_CALLOUTS_SUNFLOWER_GARDEN = [
    {
        "anchor": "disk",
        "label": "Center disk",
        "fact": "That busy middle feeds bees and other pollinators that also visit the flowers you grow nearby.",
    },
    {
        "anchor": "seeds",
        "label": "Seed heads",
        "fact": "Heavy seed heads drop and spill seeds close by, while birds carry some farther — two quiet dispersal paths from one plant.",
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

FALLBACK_CALLOUTS_PHILODENDRON_WALK = [
    {
        "anchor": "leaves",
        "label": "Heart-shaped leaves",
        "fact": "Those glossy heart-shaped leaves are why this plant shows up on so many shelves and windowsills — easy to recognize once you know the shape.",
    },
    {
        "anchor": "habit",
        "label": "Tropical roots",
        "fact": "Outdoors it belongs in warm, humid forest edges — not temperate wildlands — which is why a dumped houseplant can struggle or crowd the wrong neighbors.",
    },
    {
        "anchor": "help",
        "label": "Small help",
        "fact": "If you find one left outdoors where it doesn’t belong, bagging it for trash or proper compost (not a creek edge) is a quiet kindness to local plants.",
    },
    {
        "anchor": "stems",
        "label": "Climbing habit",
        "fact": "In the tropics those same flexible stems scramble and climb — a plant trick of its own, not only a shelf decoration.",
    },
]

FALLBACK_CALLOUTS_PHILODENDRON_GARDEN = [
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

# Back-compat aliases (walk / non-garden defaults)
FALLBACK_CALLOUTS_POPPY = FALLBACK_CALLOUTS_POPPY_WALK
FALLBACK_CALLOUTS_SUNFLOWER = FALLBACK_CALLOUTS_SUNFLOWER_WALK
FALLBACK_CALLOUTS_PHILODENDRON = FALLBACK_CALLOUTS_PHILODENDRON_WALK
FALLBACK_CALLOUTS = FALLBACK_CALLOUTS_POPPY


def _fallback_callouts_for(
    display: str,
    latin: str,
    note: str,
    color: str,
    garden_focus: bool = False,
    focus_mode: str = "walk",
    organism_type: str = "",
) -> list[dict[str, str]]:
    mode = _normalize_focus_mode(
        focus_mode, garden_focus=garden_focus if focus_mode in ("", "walk") else None
    )
    # Curated packs today cover walk vs garden; other modes fall back to walk wording.
    use_garden = mode == "garden"
    if _is_natural_nonliving(organism_type):
        callouts = list(FALLBACK_CALLOUTS_GEOLOGY)
        callouts[0] = {
            "anchor": "overview",
            "label": "Overview",
            "fact": (
                f"Best geology guess right now: {display}. "
                "Facts service had a hiccup — try Load again for fresher earth-science notes."
            ),
            "kind": "notice",
        }
        return callouts[:MAX_CALLOUTS]
    blob = (display + " " + latin + " " + note + " " + color).lower()
    if "poppy" in blob or "eschscholzia" in blob:
        callouts = list(
            FALLBACK_CALLOUTS_POPPY_GARDEN if use_garden else FALLBACK_CALLOUTS_POPPY_WALK
        )
    elif "sunflower" in blob or "helianthus" in blob:
        callouts = list(
            FALLBACK_CALLOUTS_SUNFLOWER_GARDEN
            if use_garden
            else FALLBACK_CALLOUTS_SUNFLOWER_WALK
        )
        if any(c in blob for c in ("red", "burgundy", "crimson", "dark", "black")):
            color_fact = (
                "This form shows dark or red ray florets instead of classic yellow — "
                "garden sunflowers come in many petal colors."
                if use_garden
                else "This form shows dark or red ray florets instead of classic yellow — "
                "match the shade you see on the walk, not a textbook yellow."
            )
            callouts = [
                {
                    "anchor": "petals",
                    "label": "Ray color",
                    "fact": color_fact,
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
        callouts = list(
            FALLBACK_CALLOUTS_PHILODENDRON_GARDEN
            if use_garden
            else FALLBACK_CALLOUTS_PHILODENDRON_WALK
        )
    else:
        callouts = [
            {
                "anchor": "overview",
                "label": "Overview",
                "fact": f"Best guess right now: {display}. Facts service had a hiccup — try Load again.",
            }
        ]
    if mode == "seashore" and callouts:
        callouts = [
            {
                "anchor": "shore",
                "label": "Seashore lens",
                "fact": (
                    f"Seashore focus is on for {display} — beachgoer-shaped noticing: "
                    "how people meet shores, and how that touches this organism "
                    "(not a claim you are standing on sand)."
                ),
                "kind": "notice",
            },
            *callouts[: max(0, MAX_CALLOUTS - 1)],
        ][:MAX_CALLOUTS]
    elif mode == "hiking" and callouts:
        callouts = [
            {
                "anchor": "trail",
                "label": "Hiking lens",
                "fact": (
                    f"Hiking focus is on for {display} — trail/forest-walker noticing: "
                    "how hikers and forest edges relate to this organism "
                    "(not a claim you are on a trail right now)."
                ),
                "kind": "notice",
            },
            *callouts[: max(0, MAX_CALLOUTS - 1)],
        ][:MAX_CALLOUTS]
    elif mode == "food" and callouts:
        callouts = [
            {
                "anchor": "food",
                "label": "Crops & domestics",
                "fact": (
                    f"Crops & Domestic Animals focus is on for {display} — crop story, "
                    "domestication, or farm/companion history (gentle stub; not a cookbook)."
                ),
                "kind": "notice",
            },
            *callouts[: max(0, MAX_CALLOUTS - 1)],
        ][:MAX_CALLOUTS]
    return callouts


FOCUS_MODES = ("walk", "garden", "hiking", "seashore", "food")


def _normalize_focus_mode(
    raw: Any, *, garden_focus: bool | None = None
) -> str:
    """Map API input to walk | garden | hiking | seashore | food (crops & domestic animals)."""
    text = str(raw or "").strip().lower().replace("_", " ").replace("-", " ")
    text = re.sub(r"\s+", " ", text).strip()
    aliases = {
        "walk": "walk",
        "wild": "walk",
        "wildlife": "walk",
        "trail": "walk",
        "neighbor": "walk",
        "garden": "garden",
        "gardening": "garden",
        "grow": "garden",
        "hiking": "hiking",
        "hike": "hiking",
        "forest": "hiking",
        "forests": "hiking",
        "woods": "hiking",
        "woodland": "hiking",
        "trail hike": "hiking",
        "seashore": "seashore",
        "shore": "seashore",
        "beach": "seashore",
        "coast": "seashore",
        "tide": "seashore",
        "food": "food",
        "food history": "food",
        "foodhistory": "food",
        "kitchen": "food",
        "crop": "food",
        "crops": "food",
        "cuisine": "food",
        "domestic": "food",
        "domestics": "food",
        "domestic animals": "food",
        "crops domestic": "food",
        "crops and domestic": "food",
        "crops and domestic animals": "food",
        "crops & domestic animals": "food",
        "herd": "food",
        "farm": "food",
        "agriculture": "food",
        "ag": "food",
    }
    if text in aliases:
        return aliases[text]
    # Legacy boolean gardenFocus when focusMode omitted.
    if garden_focus is True:
        return "garden"
    if garden_focus is False and not text:
        return "walk"
    return "walk"


def _food_depth_block(fact_level: int | None) -> str:
    """Richer crop/domestication noticing unlocks with fact level — split env vs injustice vs deep practices."""
    level = 1
    if fact_level is not None:
        try:
            level = max(1, min(4, int(fact_level)))
        except (TypeError, ValueError):
            level = 1
    # Shared bans / lanes for every level.
    lanes = (
        "LANES — "
        "(A) CLAUDE OK: light noticing + small everyday kindness the player can choose "
        "(reuse a bottle, buy durable goods, waste less of food already bought, give "
        "a pet space). Also OK: “not your fault” notes about big systems/companies "
        "(plastic packaging waste, chemical dumping by firms with money and influence) "
        "without turning into a practice manual. "
        "(B) OWNER-CURATED LATER (do NOT invent): human-injustice history — famines "
        "as policy, colonial oppression, slavery, genocide, Native American / "
        "Indigenous vs settler conflict, land theft framed as justice history. "
        "(C) OWNER MUST CHECK (do NOT invent): deeper environmental practices beyond "
        "simple reuse/durable-goods tips — regenerative agriculture, soil-carbon "
        "doctrine, complex farm systems, specialized conservation protocols, "
        "“how to redesign agriculture” essays, miracle numbers. Regenerative ag is "
        "one example of this lane, not the only one. "
        "If tempted by B or C, pivot to traits, domestication timeline, or lane A. "
    )
    if level <= 1:
        return (
            "DEPTH (fact level 1 — Curious notice): keep it light — noticing traits, "
            "litter size / herd size / bloom season, simple “about when dogs (or this "
            "crop) were domesticated” style timelines when well-established. "
            "OK: “poppies were noted in North America around …” when it is a plain "
            "discovery/introduction date — NOT settlement conflict narratives. "
            "Skip heavy environmental essays at this level. "
            + lanes
        )
    if level == 2:
        return (
            "DEPTH (fact level 2 — Neighbor kindness): warm noticing plus gentle "
            "farm/companion kindness. Short trade routes or planting timelines OK if "
            "neutral (where a crop spread, roughly when). Light lane-A system notes "
            "OK once (plastic/packaging/company pollution — not player guilt). "
            + lanes
        )
    if level == 3:
        return (
            "DEPTH (fact level 3 — Species wonder): richer domestication or crop "
            "timelines and one species-own quirk are welcome. Lane-A environmental "
            "complications OK (corporate pollution, monoculture risk, invasive escape, "
            "feral pets and wildlife) — calm, not panic, not blame-the-player. "
            "Still no lane B (injustice history) or lane C (deeper environmental practices). "
            + lanes
        )
    return (
        "DEPTH (fact level 4 — Field learner): prefer richer crop/domestication "
        "timelines plus calm lane-A environmental facts when true (overgrazing, "
        "soil exhaustion from industrial patterns, packaging waste, company "
        "pollution). Not doom lectures; not player guilt. Still no lane B or C. "
        + lanes
    )


def _focus_prompt_block(
    focus_mode: str, *, allow_help: bool, fact_level: int | None = None
) -> str:
    mode = _normalize_focus_mode(focus_mode)
    if mode == "garden":
        block = (
            "FOCUS MODE: GARDEN — eco-minded facts for GARDEN life: beds, plantings, "
            "seed heads, seed dispersal, grower noticing, pollinators in plantings, "
            "houseplant care when relevant. Prefer garden-shaped angles over wild-trail "
            "ones. For animals: how they use or help a garden (visitors, helpers, signs) "
            "— never fake “how to plant” an animal. "
        )
        if allow_help:
            block += (
                "Help tip must be garden-shaped kindness. Seed dispersal is welcome here "
                "(pods that fling, birds carrying seed, self-sowing near last year’s plants). "
            )
        block += (
            "Do NOT fill the set with only chores — keep noticing (and wonder if allowed) in the mix. "
            "Do NOT write seashore, hiking/forest, or crops/domestication essays unless they "
            "truly fit a garden bed. "
        )
        return block
    if mode == "hiking":
        block = (
            "FOCUS MODE: HIKING — engaged forest / trail-walker stance (not GPS). "
            "The player chose Hiking because they want how forest/trail life RELATES TO "
            "PEOPLE who hike and spend time in woods — what hikers do in that kind of "
            "place, habits that help or harm the living neighborhood, why a species is "
            "pressured or thriving near trails — not a stack of fun trivia alone. "
            "Other focus modes may also mention people–nature links; THIS mode leans into "
            "that on purpose for more engaged players. "
            "Prefer: trail/forest human relationship (wasp/yellowjacket traps that harm "
            "the woods you’re walking through; leaving snags for cavity nesters; packing "
            "out trash; quiet near nests; why a forest neighbor is scarce). "
            "Cool biology is OK when it supports that stance — not the whole set. "
            "Do NOT claim the player is on a trail right now. Do NOT invent fake forest "
            "species. If the organism is mainly a houseplant, crop, or aquarium/shore "
            "animal, say gently how a hiker might still meet it (or not) and give one "
            "honest adjacent note. "
            "Do NOT dump garden how-tos, seashore essays, or crop/domestication history. "
            "No guilt lectures; no doom sermons; family-friendly. "
        )
        if allow_help:
            block += (
                "Help tip must be trail/forest kindness a hiker can choose (skip a spray "
                "trap that kills non-target insects, stay on path through sensitive habitat, "
                "leave a nest alone, pack out litter) — gentle, choosable. "
            )
        return block
    if mode == "seashore":
        block = (
            "FOCUS MODE: SEASHORE — engaged beachgoer stance (not GPS). "
            "The player chose Seashore because they want how shore life RELATES TO PEOPLE "
            "who visit beaches, dunes, tide pools, and rocky edges — what beachgoers and "
            "coastal communities do in that kind of place, habits that help or harm, why "
            "a species is at risk or recovering — not a stack of fun trivia alone. "
            "Other focus modes may also mention people–nature links; THIS mode leans into "
            "that on purpose for more engaged players. "
            "Prefer: beachgoer-shaped relationship facts (egg collecting as a major "
            "pressure on leatherbacks; leaving wrack for habitat; giving nesting dunes "
            "space; why a shorebird fails when dogs run free on nesting beaches). "
            "Cool biology (shells, salt spray, tide pools) is OK when it supports that "
            "stance — not the whole set. "
            "Do NOT claim the player is standing on a beach. An aquarium turtle, a museum "
            "shell, or a coastal plant in a pot still gets beachgoer-shaped interest — "
            "frame facts the way a shore-minded person would care. "
            "Never invent a fake beach species; if it is not coastal, say gently how it "
            "relates (or doesn’t) to seashore life. "
            "Do NOT give inland garden how-tos, hiking/forest essays, or kitchen/crop "
            "history essays. No guilt lectures; no doom sermons; family-friendly. "
        )
        if allow_help:
            block += (
                "Help tip must be shore kindness a beachgoer can choose (give tide-pool "
                "creatures space, leave shells/wrack for habitat, stay off nesting dunes, "
                "keep dogs leashed near nesting birds) — gentle, choosable. "
            )
        return block
    if mode == "food":
        block = (
            "FOCUS MODE: CROPS & DOMESTIC ANIMALS — agriculture, crop story, "
            "domestication timelines, and companion-animal noticing for edible plants "
            "and domestic animals (cows, sheep, goats, chickens, horses, cats, dogs, "
            "pigs, etc.). Warm farm/companion story — not a cookbook, not nutrition "
            "medical advice, not “superfood” hype. "
            "CLAUDE MAY: well-established domestication eras (“dogs domesticated "
            "roughly …”), litter/herd facts, plain crop discovery or introduction "
            "dates when they are not framed as Native American / Indigenous vs "
            "settler conflict; light everyday kindness (reuse bottles, durable goods); "
            "and “not your fault” system/company pollution notes when depth allows. "
            "CLAUDE MUST NOT: history of human injustices (famines as policy, "
            "colonial oppression, slavery, genocide, settler–Indigenous conflict) — "
            "owner-curated real sources later. "
            "CLAUDE MUST NOT invent deeper environmental practices beyond simple "
            "reuse/durable-goods tips — regenerative agriculture is one example; "
            "also skip soil-carbon doctrine, complex farm-system redesign, "
            "specialized conservation protocols, miracle numbers. Those need owner "
            "notes before they ship. "
            "Cats and dogs: domestication eras, breed origins, roles with people; "
            "simple environmental noticing only when depth rules allow — never guilt "
            "the player for loving a pet. "
            "PIGS — NEVER encourage eating pigs or “pork as dinner” framing. Prefer "
            "ancestry (wild boar / Sus), litter size, social behavior, farm husbandry "
            "noticing. Do NOT write health/disease “why pork is unhealthy” claims yet "
            "(reserved for a later update). "
            "Other food animals/crops: grow/trade/cook noticing is fine; never push "
            "the player to eat anything. "
            "If it is not a crop or domestic/companion animal, say so gently and share "
            "one honest adjacent note (forage caution, “not edible,” wild relative of "
            "a crop) or why walkers meet it near farms/markets. "
            "Do NOT invent unsafe foraging advice. Do NOT dump garden chore lists, "
            "hiking/forest essays, or seashore ecology unless they support the "
            "crop/domestication story. "
        )
        block += _food_depth_block(fact_level)
        if allow_help:
            block += (
                "Help tip must stay in the light everyday lane (waste less of edible "
                "parts you already buy, reuse/durable goods, respect farm/field edges, "
                "don’t dig wild roots without knowing rules, give companion animals "
                "space/enrichment — gentle, choosable). Never “eat more of X” or "
                "“eat less pig” lectures. Never invent deeper farm/conservation "
                "practice manuals. "
            )
        return block
    # walk (default)
    block = (
        "FOCUS MODE: WALK / WILD — eco-minded focus for walks and wild neighbors: "
        "shared air/water/food webs, seasons you meet them, place-aware noticing. "
        "People–nature links are fine when they fit; leave deep beachgoer or "
        "trail-hiker relationship essays for Seashore / Hiking modes. "
        "Do NOT give gardening how-tos, “if you grow one…,” bed/soil recipes, "
        "seed-dispersal-as-grower tips, seashore-only essays, hiking/forest-only "
        "essays, or crop/domestication history essays unless the player clearly "
        "needs a tiny bridge. Leave those for other modes. "
    )
    if allow_help:
        block += (
            "Help tip must be walk/neighbor kindness (leave a nest alone, skip a spray "
            "on a wild patch, keep distance, etc.) — still eco-leaning, not garden advice. "
        )
    return block


def _focus_disclaimer(focus_mode: str) -> str:
    mode = _normalize_focus_mode(focus_mode)
    if mode == "garden":
        return " Focus mode: Garden — eco-minded garden-world facts."
    if mode == "hiking":
        return (
            " Focus mode: Hiking — trail/forest-walker relationship facts "
            "(engaged stance, not GPS)."
        )
    if mode == "seashore":
        return (
            " Focus mode: Seashore — beachgoer relationship facts "
            "(engaged stance, not GPS)."
        )
    if mode == "food":
        return (
            " Focus mode: Crops & Domestic Animals — crop, farm, and "
            "domestication noticing (Claude skips human-injustice history)."
        )
    return " Focus mode: Walk / wild — neighbor eco facts (not gardening how-tos)."


# Natural nonliving finds EcoLens may ID (not furniture, plastic, cars, etc.).
NATURAL_NONLIVING_TYPES = frozenset(
    {"rock", "mineral", "shell", "fossil", "stone", "geology"}
)


def _is_natural_nonliving(organism_type: str) -> bool:
    t = (organism_type or "").strip().lower()
    if not t:
        return False
    if t in NATURAL_NONLIVING_TYPES:
        return True
    return t.startswith("rock") or t.startswith("mineral") or t.startswith("fossil")


def _normalize_organism_type(raw: str) -> str:
    t = (raw or "").strip().lower()[:40]
    if t in ("stone", "pebble", "cobble", "boulder"):
        return "rock"
    if t in ("empty_shell", "seashell", "shell_empty"):
        return "shell"
    if t in ("geology", "geologic", "geological"):
        return "rock"
    return t or "other"


IDENTIFY_PROMPT = (
    "You identify nature finds for a family-friendly conservation learning game: "
    "wildlife, plants, fungi, clear evidence of them "
    "(tracks, nests, seed pods, chewed plants, bloom patches), AND natural nonliving "
    "matter found outdoors (rocks, minerals, empty shells with no living creature inside, "
    "fossils). Return ONLY JSON.\n"
    "Focus on the nature subject (living or natural nonliving), not people, hands, faces, "
    "or private property details.\n"
    "NATURAL NONLIVING — when the clear subject is a rock, mineral, empty shell, or fossil "
    "(not a living plant/animal/fungus), identify it. Set organismType to rock, mineral, "
    "shell, or fossil. Prefer a real common name (e.g. Quartz, Granite, Obsidian, "
    "Empty mussel shell). Put mineral/rock scientific name in latinName when known "
    "(e.g. SiO2 for quartz, or the mineral species name); else empty. "
    "lifeStage should be specimen (or empty). bloomColor empty. evidence false. "
    "EMPTY SHELL RULE — if a shell has NO living animal inside (no snail, clam flesh, "
    "hermit crab, etc.), use organismType shell and name it as an empty shell of that "
    "kind when you can. If a living mollusk or hermit crab is clearly present, treat it "
    "as a living organism (not shell). "
    "Do NOT invent fake mineral names; if unsure, give the best rock/mineral class "
    "(e.g. \"Igneous rock\", \"Sedimentary rock\", \"Beach sand\") and list alternatives.\n"
    "REFUSAL — if there is no clear living organism, no clear evidence, AND no clear "
    "natural nonliving find "
    "(empty ground with nothing identifiable, wall, sky, furniture, shelf wood, plastic, "
    "metal tools, cars, pavement alone, blur, mostly hands/faces, or only background), "
    "do NOT invent a species or mineral. Return:\n"
    '{"commonName":"","latinName":"","cultivar":"","bloomColor":"","organismType":"none",'
    '"lifeStage":"","evidence":false,"confidence":"low",'
    '"shortNote":"No clear nature find in frame.",'
    '"alternatives":[],"noOrganism":true}\n'
    "Refuse manufactured / indoor-only objects that are not nature finds. "
    "Be as accurate as you reasonably can. Prefer the species, mineral, or best clear "
    "taxon you think it is.\n"
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
    "LIFE STAGE — for living organisms, set lifeStage to what is actually visible "
    "(not a different stage of the same species). Examples: seed, seedling, sprout, bud, "
    "flowering, fruiting, adult, juvenile, egg, larva, nestling, fledgling, evidence. "
    "If the photo is a blossom/bloom, use flowering (not seed). If only a seed pod or "
    "seed, say so. For natural nonliving (rock/mineral/shell/fossil), use specimen.\n"
    "JSON shape (success):\n"
    "{"
    '"commonName":"...",'
    '"latinName":"...",'
    '"cultivar":"" ,'
    '"bloomColor":"red|yellow|orange|burgundy|bicolor|other|",'
    '"organismType":"bird|mammal|flower|plant|fungus|insect|reptile|evidence|rock|mineral|shell|fossil|other",'
    '"lifeStage":"flowering|fruiting|seedling|adult|juvenile|evidence|specimen|...",'
    '"evidence":false,'
    '"confidence":"high|medium|low",'
    '"shortNote":"one short plain sentence naming a visible trait that supports the ID (include color)",'
    '"alternatives":[{"commonName":"...","latinName":"..."}],'
    '"noOrganism":false'
    "}"
)

FALLBACK_CALLOUTS_GEOLOGY = [
    {
        "anchor": "texture",
        "label": "What you see",
        "fact": "Color, grain, and texture are the first clues walkers use to tell one rock or mineral from another.",
        "kind": "notice",
    },
    {
        "anchor": "form",
        "label": "How it forms",
        "fact": "Rocks and minerals form through heat, pressure, water, or time — each leave different fingerprints in the stone.",
        "kind": "notice",
    },
    {
        "anchor": "help",
        "label": "Small help",
        "fact": "On trails and shores, leave interesting rocks and empty shells where you found them when you can — other walkers and tiny shore life often need that scatter.",
        "kind": "help",
    },
    {
        "anchor": "wonder",
        "label": "Earth story",
        "fact": "Every pebble is a tiny chapter of Earth history you can hold without needing a lab.",
        "kind": "wonder",
    },
]


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
    key = str(raw.get("key") or "").strip()[:120]
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
        "shortNote": _clip_plain(str(raw.get("shortNote") or ""), MAX_SHORT_NOTE_CHARS),
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


def _fact_id(fact: str) -> str:
    digest = hashlib.sha256(fact.strip().lower().encode("utf-8")).hexdigest()[:16]
    return f"f:{digest}"


def _sanitize_learned_fact(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    fact = _clip_plain(str(raw.get("fact") or ""), MAX_FACT_CHARS)
    if not fact:
        return None
    fid = str(raw.get("id") or "").strip()[:48] or _fact_id(fact)
    kind = str(raw.get("kind") or "notice").strip().lower()
    if kind not in ("notice", "help", "wonder"):
        kind = "notice"
    try:
        learned_at = int(raw.get("learnedAt") or 0)
    except (TypeError, ValueError):
        learned_at = 0
    return {
        "id": fid,
        "fact": fact,
        "label": str(raw.get("label") or "").strip()[:60],
        "kind": kind,
        "speciesKey": str(raw.get("speciesKey") or "").strip()[:100],
        "commonName": str(raw.get("commonName") or "").strip()[:120],
        "latinName": str(raw.get("latinName") or "").strip()[:160],
        "gardenFocus": bool(raw.get("gardenFocus")),
        "learnedAt": learned_at or int(time.time() * 1000),
    }


def _normalize_learned_facts(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        entry = _sanitize_learned_fact(item)
        if not entry or entry["id"] in seen:
            continue
        seen.add(entry["id"])
        out.append(entry)
        if len(out) >= MAX_LEARNED_FACTS:
            break
    out.sort(key=lambda e: int(e.get("learnedAt") or 0), reverse=True)
    return out[:MAX_LEARNED_FACTS]


def _read_learned_blob(email: str) -> dict[str, Any]:
    path = _learned_path(email)
    if not os.path.isfile(path):
        return {"entries": [], "facts": []}
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError, TypeError):
        return {"entries": [], "facts": []}
    if isinstance(raw, dict):
        return {
            "entries": _normalize_learned_list(raw.get("entries")),
            "facts": _normalize_learned_facts(raw.get("facts")),
        }
    return {"entries": _normalize_learned_list(raw), "facts": []}


def load_learned(email: str) -> list[dict[str, Any]]:
    return _read_learned_blob(email)["entries"]


def load_learned_facts(email: str) -> list[dict[str, Any]]:
    return _read_learned_blob(email)["facts"]


def save_learned(
    email: str,
    entries: list[dict[str, Any]],
    facts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    cleaned = _normalize_learned_list(entries)
    if facts is None:
        facts = load_learned_facts(email)
    cleaned_facts = _normalize_learned_facts(facts)
    _ensure_learned_dir()
    path = _learned_path(email)
    tmp = path + ".tmp"
    payload = {
        "version": 2,
        "email": email.strip().lower(),
        "updatedAt": int(time.time() * 1000),
        "entries": cleaned,
        "facts": cleaned_facts,
    }
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)
    return {"entries": cleaned, "facts": cleaned_facts}


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


def merge_learned_facts(
    local: list[dict[str, Any]], remote: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for src in (remote or []) + (local or []):
        entry = _sanitize_learned_fact(src)
        if not entry:
            continue
        fid = entry["id"]
        prev = by_id.get(fid)
        if not prev:
            by_id[fid] = entry
            continue
        newer = (
            entry if int(entry["learnedAt"]) <= int(prev["learnedAt"]) else prev
        )
        older = prev if newer is entry else entry
        merged = dict(newer)
        for field in ("label", "speciesKey", "commonName", "latinName"):
            if not merged.get(field) and older.get(field):
                merged[field] = older[field]
        merged["learnedAt"] = min(
            int(merged.get("learnedAt") or 0) or int(time.time() * 1000),
            int(older.get("learnedAt") or 0) or int(time.time() * 1000),
        )
        by_id[fid] = merged
    out = list(by_id.values())
    out.sort(key=lambda e: int(e.get("learnedAt") or 0), reverse=True)
    return out[:MAX_LEARNED_FACTS]


def _allowed_kinds_for_fact_level(fact_level: int | None, fact_count: int | None) -> list[str]:
    level = 1
    if fact_level is not None:
        try:
            level = max(1, min(4, int(fact_level)))
        except (TypeError, ValueError):
            level = 1
    elif fact_count is not None:
        try:
            count = max(0, int(fact_count))
        except (TypeError, ValueError):
            count = 0
        for lvl, need, _kinds in FACT_LEVEL_THRESHOLDS:
            if count >= need:
                level = lvl
    for lvl, _need, kinds in FACT_LEVEL_THRESHOLDS:
        if lvl == level:
            return list(kinds)
    return ["notice"]


def _guess_callout_kind(item: dict[str, Any], index: int, total: int) -> str:
    raw = str(item.get("kind") or "").strip().lower()
    if raw in ("help", "kindness", "tip"):
        return "help"
    if raw in ("wonder", "species"):
        return "wonder"
    if raw in ("notice", "everyday", "noticing"):
        return "notice"
    blob = (
        str(item.get("label") or "") + " " + str(item.get("fact") or "")
    ).lower()
    if re.search(
        r"\b(kindness|leave (it|them|a)|skip |bagging|don.?t spray|small help)\b",
        blob,
    ):
        return "help"
    if re.search(
        r"\b(trick of its own|species.?own|wonder|on its own)\b",
        blob,
    ):
        return "wonder"
    if total > 1 and index == total - 1:
        return "wonder"
    if total >= 3 and index == total // 2:
        return "help"
    return "notice"


def _clip_plain(text: str, max_len: int) -> str:
    """Hard length cap that prefers a sentence end (avoids mid-sentence chops)."""
    s = (text or "").strip()
    if max_len <= 0 or len(s) <= max_len:
        return s
    window = s[:max_len]
    # Prefer the last complete sentence that fits (min length avoids "Ok." stubs).
    min_keep = 8
    best_end = -1
    for i, ch in enumerate(window):
        if ch in ".!?" and i + 1 >= min_keep:
            nxt = window[i + 1] if i + 1 < len(window) else " "
            if nxt.isspace() or nxt in "\"'”’)":
                best_end = i
    if best_end >= 0:
        return window[: best_end + 1].strip()
    # No sentence end in window — also accept end-of-window terminator.
    if window[-1] in ".!?":
        return window.strip()
    # Fall back to a word boundary + ellipsis (never a silent mid-word chop).
    sp = window.rfind(" ")
    if sp >= min_keep:
        return window[:sp].rstrip(",;:—- ") + "…"
    return window.rstrip() + "…"


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


def _parse_rejected_names(raw: Any) -> list[str]:
    """Player said these guesses were wrong — never reuse as the primary ID."""
    out: list[str] = []
    seen: set[str] = set()
    if not isinstance(raw, list):
        return out
    for item in raw[:16]:
        if isinstance(item, dict):
            text = str(item.get("commonName") or item.get("name") or "").strip()
        else:
            text = str(item or "").strip()
        text = text[:120]
        key = re.sub(r"\s+", " ", text.lower()).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def _reject_prompt_suffix(rejected: list[str]) -> str:
    if not rejected:
        return ""
    names = "; ".join(rejected[:12])
    return (
        "\nREJECTED BY PLAYER — these guesses were WRONG for this photo. "
        "Do NOT return them (or near-duplicates) as commonName. "
        "Pick a different best match and list fresh alternatives that are also "
        f"not on this list: {names}\n"
    )


def _norm_name_key(name: str) -> str:
    return re.sub(r"\s+", " ", str(name or "").lower()).strip()


def _id_is_rejected(parsed: dict[str, Any] | None, rejected: list[str]) -> bool:
    if not parsed or not rejected:
        return False
    keys = {_norm_name_key(x) for x in rejected if _norm_name_key(x)}
    if not keys:
        return False
    for field in ("commonName", "displayName"):
        k = _norm_name_key(str(parsed.get(field) or ""))
        if k and k in keys:
            return True
    return False


def _pick_non_rejected(
    chosen: dict[str, Any] | None, rejected: list[str]
) -> dict[str, Any] | None:
    """Prefer chosen; else first alternative not on the reject list."""
    if not chosen:
        return None
    if not _id_is_rejected(chosen, rejected):
        return chosen
    for item in chosen.get("alternatives") or []:
        if not isinstance(item, dict):
            continue
        alt = {
            "commonName": str(item.get("commonName") or "").strip()[:120],
            "latinName": str(item.get("latinName") or "").strip()[:160],
            "cultivar": "",
            "bloomColor": chosen.get("bloomColor") or "",
            "organismType": chosen.get("organismType") or "other",
            "lifeStage": chosen.get("lifeStage") or "",
            "evidence": bool(chosen.get("evidence")),
            "confidence": "low",
            "shortNote": "Another possible match after the player rejected prior guesses.",
            "alternatives": [],
            "noOrganism": False,
        }
        if alt["commonName"] and not _id_is_rejected(alt, rejected):
            # Keep remaining siblings as further alternatives.
            rest = [
                a
                for a in (chosen.get("alternatives") or [])
                if isinstance(a, dict)
                and _norm_name_key(str(a.get("commonName") or ""))
                != _norm_name_key(alt["commonName"])
                and not _id_is_rejected(a, rejected)
            ]
            alt["alternatives"] = rest[:3]
            return alt
    return None


def _call_claude_vision(
    image_b64: str, mime: str, *, rejected: list[str] | None = None
) -> dict[str, Any]:
    api_key = anthropic_api_key()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    mime = (mime or "image/jpeg").split(";")[0].strip() or "image/jpeg"
    prompt = IDENTIFY_PROMPT + _reject_prompt_suffix(rejected or [])
    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 700,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
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


def _call_gemini_vision(
    image_b64: str, mime: str, *, rejected: list[str] | None = None
) -> dict[str, Any]:
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
    prompt = IDENTIFY_PROMPT + _reject_prompt_suffix(rejected or [])
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
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
    bits = [common.strip() or "this nature find"]
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
    if _is_natural_nonliving(organism_type):
        return (
            "Create ONE brand-new nature-codex portrait for a family-friendly nature game.\n"
            f"Identified subject: {subject}.\n"
            "PRIVACY — the attached photo is a private reference for traits only. "
            "Invent a fresh semi-realistic field-guide portrait of the SAME rock, mineral, "
            "empty shell, or fossil. "
            "Do NOT copy, redraw, or recreate that photo’s pixels, background, angle, "
            "crop, lighting, or scene. Different angle and plain soft background.\n"
            "Match color, texture, crystal form, grain, banding, and shell shape traits.\n"
            "Show a clear specimen portrait (not a landscape quarry scene). "
            "Empty shells must stay empty — no living animal inside.\n"
            "Do NOT invent a different mineral or shell. Do NOT substitute a stock generic look.\n"
            "Style: calm semi-realistic field-guide art — believable nature illustration. "
            "Avoid heavy cartoon, anime, chibi, glossy CGI, or uncanny hyper-detail. "
            "Soft plain muted background. Specimen only — no people, no hands, no phone, "
            "no text, no watermark, no logo.\n"
            "Square composition, subject filling most of the frame. Return an image."
        )
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


def _slug_part(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")[:80]


def stage_still_cache_key(
    common: str,
    latin: str = "",
    cultivar: str = "",
    life_stage: str = "",
) -> str:
    """Stable key: one shared still per species (+ cultivar) + life stage."""
    latin_s = _slug_part(latin)
    common_s = _slug_part(common)
    if latin_s:
        base = f"lat:{latin_s}"
    elif common_s:
        base = f"com:{common_s}"
    else:
        return ""
    cult = _slug_part(cultivar)
    if cult:
        base = f"{base}|cult:{cult}"
    stage = _slug_part(life_stage) or "unspecified"
    return f"{base}|st:{stage}"


def _stage_still_paths(cache_key: str) -> tuple[str, str]:
    digest = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()[:40]
    folder = STAGE_STILL_DIR
    return (
        os.path.join(folder, f"{digest}.jpg"),
        os.path.join(folder, f"{digest}.json"),
    )


def _ensure_stage_still_dir() -> str:
    os.makedirs(STAGE_STILL_DIR, exist_ok=True)
    return STAGE_STILL_DIR


def load_stage_still(
    common: str,
    latin: str = "",
    cultivar: str = "",
    life_stage: str = "",
) -> dict[str, Any] | None:
    """Return a shared library still if this species+stage was generated before."""
    import base64

    cache_key = stage_still_cache_key(common, latin, cultivar, life_stage)
    if not cache_key:
        return None
    jpg_path, meta_path = _stage_still_paths(cache_key)
    if not os.path.isfile(jpg_path):
        return None
    try:
        with open(jpg_path, "rb") as f:
            raw = f.read()
        if not raw:
            return None
        meta: dict[str, Any] = {}
        if os.path.isfile(meta_path):
            with open(meta_path, encoding="utf-8") as mf:
                loaded = json.load(mf)
            if isinstance(loaded, dict):
                meta = loaded
        b64 = base64.b64encode(raw).decode("ascii")
        print(
            f"bane_stage_still hit key={cache_key!r} bytes={len(raw)}",
            flush=True,
        )
        return {
            "ok": True,
            "mimeType": "image/jpeg",
            "imageBase64": b64,
            "matched": True,
            "fromPhoto": False,
            "fromCache": True,
            "cacheKey": cache_key,
            "commonName": (common or "").strip() or meta.get("commonName"),
            "latinName": (latin or "").strip() or meta.get("latinName") or "",
            "cultivar": (cultivar or "").strip() or meta.get("cultivar") or None,
            "lifeStage": (life_stage or "").strip() or meta.get("lifeStage") or None,
            "model": meta.get("model") or "stage-library",
            "disclaimer": (
                "Codex art from the shared stage library — one portrait per "
                "species and life stage (not your raw photo)."
            ),
        }
    except Exception as exc:  # noqa: BLE001
        print(f"bane_stage_still load_fail key={cache_key!r}: {exc}", flush=True)
        return None


def save_stage_still(
    *,
    common: str,
    latin: str,
    cultivar: str,
    life_stage: str,
    mime: str,
    data_b64: str,
    model: str | None = None,
) -> str | None:
    """Persist a newly generated still into the shared species+stage library."""
    import base64
    from io import BytesIO

    cache_key = stage_still_cache_key(common, latin, cultivar, life_stage)
    if not cache_key or not data_b64:
        return None
    jpg_path, meta_path = _stage_still_paths(cache_key)
    if os.path.isfile(jpg_path):
        return cache_key
    try:
        _ensure_stage_still_dir()
        raw = base64.b64decode(data_b64, validate=False)
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
        tmp = jpg_path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(out)
        os.replace(tmp, jpg_path)
        meta = {
            "cacheKey": cache_key,
            "commonName": (common or "").strip(),
            "latinName": (latin or "").strip(),
            "cultivar": (cultivar or "").strip(),
            "lifeStage": (life_stage or "").strip() or "unspecified",
            "model": model or "",
            "savedAt": int(time.time()),
        }
        with open(meta_path, "w", encoding="utf-8") as mf:
            json.dump(meta, mf, indent=0)
        print(
            f"bane_stage_still save key={cache_key!r} bytes={len(out)}",
            flush=True,
        )
        return cache_key
    except Exception as exc:  # noqa: BLE001
        print(f"bane_stage_still save_fail key={cache_key!r}: {exc}", flush=True)
        return None


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
    lookup_only: bool = False,
) -> dict[str, Any]:
    if not (common or "").strip():
        return {
            "ok": False,
            "error": "missing_organism",
            "message": "commonName is required so the still matches the ID.",
        }

    cached = load_stage_still(common, latin, cultivar, life_stage)
    if cached:
        return cached

    if lookup_only:
        return {
            "ok": False,
            "error": "cache_miss",
            "message": "No shared stage still yet — need a photo to generate one.",
            "fromCache": False,
        }

    if image_b64 is not None and (not image_b64 or len(image_b64) > MAX_IMAGE_B64):
        return {
            "ok": False,
            "error": "image_invalid",
            "message": "Image missing or too large.",
        }
    if not image_b64:
        return {
            "ok": False,
            "error": "image_required",
            "message": "Photo needed to generate the first still for this stage.",
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
        result["fromCache"] = False
        result["disclaimer"] = (
            "Codex art is a new semi-realistic portrait of this species at the "
            "same life stage — not your raw photo, and not a mismatched stage. "
            "This stage is saved so later scans reuse the same picture."
        )
        if result.get("ok") and result.get("imageBase64"):
            save_stage_still(
                common=common.strip(),
                latin=(latin or "").strip(),
                cultivar=(cultivar or "").strip(),
                life_stage=(life_stage or "").strip(),
                mime=str(result.get("mimeType") or "image/jpeg"),
                data_b64=str(result["imageBase64"]),
                model=str(result.get("model") or "") or None,
            )
            result["cacheKey"] = stage_still_cache_key(
                common, latin, cultivar, life_stage
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
    organism_type = _normalize_organism_type(
        str(parsed.get("organismType") or "other")
    )
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
    if _is_natural_nonliving(organism_type) and not life_stage:
        life_stage = "specimen"
    return {
        "commonName": common,
        "latinName": str(parsed.get("latinName") or "").strip()[:160],
        "cultivar": str(parsed.get("cultivar") or "").strip()[:80],
        "bloomColor": str(parsed.get("bloomColor") or "").strip()[:40],
        "organismType": organism_type,
        "lifeStage": life_stage,
        "evidence": bool(parsed.get("evidence")),
        "confidence": conf,
        "shortNote": _clip_plain(str(parsed.get("shortNote") or ""), MAX_SHORT_NOTE_CHARS),
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


def _slug_compare(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def _parse_shelf_hints(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw[:MAX_SHELF_HINTS]:
        if not isinstance(item, dict):
            continue
        common = str(item.get("commonName") or item.get("common") or "").strip()[:120]
        latin = str(item.get("latinName") or item.get("latin") or "").strip()[:160]
        if not common and not latin:
            continue
        out.append({"commonName": common, "latinName": latin})
    return out


def _id_matches_hint(parsed: dict[str, Any], hint: dict[str, str]) -> bool:
    p_latin = _slug_compare(str(parsed.get("latinName") or ""))
    h_latin = _slug_compare(hint.get("latinName") or "")
    if p_latin and h_latin and p_latin == h_latin:
        return True
    p_common = _slug_compare(str(parsed.get("commonName") or ""))
    h_common = _slug_compare(hint.get("commonName") or "")
    if p_common and h_common and p_common == h_common:
        return True
    return False


def _id_matches_any_shelf(
    parsed: dict[str, Any] | None, shelf_hints: list[dict[str, str]]
) -> bool:
    if not parsed or not shelf_hints:
        return False
    for hint in shelf_hints:
        if _id_matches_hint(parsed, hint):
            return True
    return False


def _alternatives_overlap_shelf(
    parsed: dict[str, Any] | None, shelf_hints: list[dict[str, str]]
) -> bool:
    """True when Gemini's runner-up names collide with the player's shelf (lookalike risk)."""
    if not parsed or not shelf_hints:
        return False
    alts = parsed.get("alternatives") or []
    if not isinstance(alts, list):
        return False
    for alt in alts[:5]:
        if not isinstance(alt, dict):
            continue
        if _id_matches_any_shelf(alt, shelf_hints):
            # Chosen name may differ from shelf alt — verify with second model.
            if not _id_matches_any_shelf(parsed, shelf_hints):
                return True
    return False


def _should_run_claude_vision(
    gemini_id: dict[str, Any] | None,
    shelf_hints: list[dict[str, str]],
) -> tuple[bool, str]:
    """
    Gemini-first: skip Claude when Gemini is high-confidence and safe.
    Always verify with Claude when confidence is not high, Gemini failed,
    shelf lookalike risk, or high-conf ID conflicts with a known shelf entry
    without matching it via alternatives.
    """
    if not gemini_id or _is_refusal(gemini_id):
        return True, "gemini_weak"
    conf = str(gemini_id.get("confidence") or "low").lower()
    if conf != "high":
        return True, "confidence_not_high"
    if _id_matches_any_shelf(gemini_id, shelf_hints):
        return False, "shelf_match_high"
    if _alternatives_overlap_shelf(gemini_id, shelf_hints):
        return True, "shelf_lookalike_risk"
    return False, "gemini_high_alone"


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
    image_b64: str,
    mime: str,
    *,
    want_codex_still: bool = False,
    shelf_hints: list[dict[str, str]] | None = None,
    rejected_names: list[str] | None = None,
) -> dict[str, Any]:
    if not image_b64 or len(image_b64) > MAX_IMAGE_B64:
        return {"ok": False, "error": "image_invalid", "message": "Image missing or too large."}

    hints = shelf_hints or []
    rejected = rejected_names or []
    gemini_err = ""
    claude_err = ""
    gemini_id: dict[str, Any] | None = None
    claude_id: dict[str, Any] | None = None
    claude_skipped = False
    claude_skip_reason = ""

    def _gemini_job() -> tuple[dict[str, Any] | None, str]:
        try:
            return _norm_id(_call_gemini_vision(image_b64, mime, rejected=rejected)), ""
        except Exception as exc:  # noqa: BLE001
            return None, f"{type(exc).__name__}: {exc}"

    def _claude_job() -> tuple[dict[str, Any] | None, str]:
        try:
            return _norm_id(_call_claude_vision(image_b64, mime, rejected=rejected)), ""
        except Exception as exc:  # noqa: BLE001
            return None, f"{type(exc).__name__}: {exc}"

    # Gemini first — Claude only when needed (cost + lookalike safety).
    gemini_id, gemini_err = _gemini_job()
    need_claude, claude_skip_reason = _should_run_claude_vision(gemini_id, hints)
    if need_claude:
        claude_id, claude_err = _claude_job()
    else:
        claude_skipped = True
        print(
            f"bane_identify skip_claude reason={claude_skip_reason!r} "
            f"gemini={(gemini_id or {}).get('commonName')!r}",
            flush=True,
        )

    chosen = _prefer_id(gemini_id, claude_id)
    chosen = _pick_non_rejected(chosen, rejected)
    if rejected and chosen is None and (gemini_id or claude_id):
        print(
            "bane_identify exhausted_rejects "
            f"rejected={rejected!r} "
            f"gemini={(gemini_id or {}).get('commonName')!r} "
            f"claude={(claude_id or {}).get('commonName')!r}",
            flush=True,
        )
        return {
            "ok": False,
            "error": "guesses_exhausted",
            "message": (
                "Ran out of different guesses for this photo. "
                "Try a clearer frame, or Scan again."
            ),
            "rejectedNames": rejected,
            "geminiConfigured": bool(gemini_api_key()),
            "claudeConfigured": bool(anthropic_api_key()),
            "sources": {
                "gemini": gemini_id,
                "claude": claude_id,
            },
        }
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
                "No clear nature find in this photo (living neighbor, evidence, "
                "or natural rock / mineral / empty shell). "
                "Fill the dashed box and try again."
            ),
            "geminiError": gemini_err or None,
            "claudeError": claude_err or None,
            "claudeSkipped": claude_skipped,
            "claudeSkipReason": claude_skip_reason or None,
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
            "claudeSkipped": claude_skipped,
            "claudeSkipReason": claude_skip_reason or None,
            "geminiConfigured": bool(gemini_api_key()),
            "claudeConfigured": bool(anthropic_api_key()),
        }

    display = chosen["commonName"]
    if chosen.get("cultivar"):
        display = f"{chosen['commonName']} ({chosen['cultivar']})"

    shelf_matched = _id_matches_any_shelf(chosen, hints)
    print(
        "bane_identify ok "
        f"chosen={chosen.get('commonName')!r} "
        f"latin={chosen.get('latinName')!r} "
        f"gemini={(gemini_id or {}).get('commonName')!r} "
        f"claude={(claude_id or {}).get('commonName')!r} "
        f"skip_claude={claude_skipped} shelf_match={shelf_matched}",
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
        "alreadyLearned": shelf_matched,
        "claudeSkipped": claude_skipped,
        "claudeSkipReason": claude_skip_reason or None,
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
        still: dict[str, Any] = {
            "ok": False,
            "error": "still_skipped",
            "message": "Codex art skipped — identification kept.",
        }
        try:
            with ThreadPoolExecutor(max_workers=1) as still_pool:
                fut_still = still_pool.submit(
                    generate_codex_still,
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
                still = fut_still.result(timeout=CODEX_STILL_BUDGET_SEC)
        except FuturesTimeoutError:
            still = {
                "ok": False,
                "error": "still_timeout",
                "message": (
                    "Codex art took too long — identification kept. "
                    "Open the codex; you can rescan for art later."
                ),
            }
            print(
                f"bane_codex_still timeout common={result['commonName']!r} "
                f"budget={CODEX_STILL_BUDGET_SEC}s",
                flush=True,
            )
        except Exception as exc:  # noqa: BLE001
            still = {
                "ok": False,
                "error": "still_failed",
                "message": f"Could not build matching codex still: {exc}",
            }
            print(
                f"bane_codex_still exception common={result['commonName']!r}: {exc}",
                flush=True,
            )

        if still.get("ok") and still.get("imageBase64"):
            token = save_still_token(
                str(still.get("mimeType") or "image/jpeg"),
                str(still["imageBase64"]),
            )
            if token:
                result["stillToken"] = token
                result["stillUrl"] = f"/bane-of-extinction/api/still/{token}"
                # Prefer URL over embedding huge base64 in the identify JSON
                # (smaller response → fewer phone timeouts after a slow ID).
                result["codexStill"] = {
                    "token": token,
                    "url": result["stillUrl"],
                    "mimeType": still.get("mimeType") or "image/jpeg",
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


def _normalize_callouts(
    raw: Any,
    allowed_kinds: list[str] | None = None,
    *,
    max_callouts: int | None = None,
    require_builds_on: bool = False,
) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    allowed = set(allowed_kinds or ("notice", "help", "wonder"))
    limit = max_callouts if max_callouts is not None else MAX_CALLOUTS
    out: list[dict[str, Any]] = []
    total = len([x for x in raw if isinstance(x, dict)])
    index = 0
    builds_on_count = 0
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
        kind = _guess_callout_kind(item, index, total)
        index += 1
        if kind not in allowed:
            # Downgrade locked kinds to noticing so early levels stay useful.
            if "notice" in allowed:
                kind = "notice"
            else:
                continue
        builds_on = bool(
            item.get("buildsOn")
            or item.get("builds_on")
            or item.get("buildOn")
        )
        entry: dict[str, Any] = {
            "anchor": anchor[:40],
            "label": label[:60],
            "fact": _clip_plain(fact, MAX_FACT_CHARS),
            "kind": kind,
        }
        if builds_on:
            builds_on_count += 1
            # Keep exactly one builds-on marker when the prompt asked for it.
            if require_builds_on and builds_on_count == 1:
                entry["buildsOn"] = True
            elif not require_builds_on:
                entry["buildsOn"] = True
        out.append(entry)
        if len(out) >= limit:
            break
    if require_builds_on and out and not any(c.get("buildsOn") for c in out):
        # Model forgot the flag — mark the first notice (or first callout) so the
        # client can still surface one deepen-line for this set.
        for c in out:
            if c.get("kind") == "notice":
                c["buildsOn"] = True
                break
        else:
            out[0]["buildsOn"] = True
    elif require_builds_on:
        seen = False
        for c in out:
            if c.get("buildsOn"):
                if seen:
                    c.pop("buildsOn", None)
                else:
                    seen = True
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


def _norm_binomial(latin: str) -> str:
    s = re.sub(r"\s+", " ", (latin or "").strip().lower())
    parts = s.split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[1]}"
    return s


def _load_us_riis() -> None:
    """Load USGS US-RIIS compact lookup once (CC0)."""
    global _US_RIIS_CACHE, _US_RIIS_BY, _US_RIIS_ATTR
    if _US_RIIS_BY is not None:
        return
    _US_RIIS_BY = {}
    path = US_RIIS_PATH
    if not path or not os.path.isfile(path):
        return
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(data, dict):
        return
    _US_RIIS_CACHE = data
    _US_RIIS_ATTR = str(data.get("attr") or "")[:280]
    by = data.get("by")
    if isinstance(by, dict):
        _US_RIIS_BY = {str(k).lower(): v for k, v in by.items() if isinstance(v, dict)}


def _us_riis_entry(latin: str) -> dict[str, str] | None:
    _load_us_riis()
    if not _US_RIIS_BY:
        return None
    key = _norm_binomial(latin)
    hit = _US_RIIS_BY.get(key)
    return hit if isinstance(hit, dict) else None


def _caption_from_us_riis(latin: str) -> tuple[str, str]:
    """Return (rangeElsewhere caption, attribution) from US-RIIS when matched."""
    hit = _us_riis_entry(latin)
    if not hit:
        return "", ""
    labels = {
        "L48": "the contiguous U.S.",
        "AK": "Alaska",
        "HI": "Hawaii",
    }
    inv: list[str] = []
    intro: list[str] = []
    for loc in ("L48", "AK", "HI"):
        deg = str(hit.get(loc) or "").strip()
        if not deg:
            continue
        place = labels[loc]
        if deg == "widespread_invasive":
            inv.append(f"widespread invasive in {place}")
        elif deg == "invasive":
            inv.append(f"invasive in {place}")
        else:
            intro.append(f"introduced in {place}")
    if inv:
        text = "Caution: US-RIIS lists this as " + "; ".join(inv)
    elif intro:
        text = "Caution: US-RIIS lists this as " + "; ".join(intro)
    else:
        return "", ""
    return text[:180], (_US_RIIS_ATTR or "USGS US-RIIS (CC0).")


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
    *,
    latin: str = "",
) -> dict[str, str]:
    ns = ns or {}
    claude_meta = claude_meta or {}
    native = str(ns.get("nativeRange") or "").strip()
    elsewhere = str(ns.get("rangeElsewhere") or "").strip()
    status = str(ns.get("conservationStatus") or "").strip()
    range_src = str(ns.get("rangeSource") or "")
    status_src = str(ns.get("statusSource") or "")
    attribution = str(ns.get("attribution") or "").strip()

    # USGS US-RIIS (CC0) wins for introduced/invasive-elsewhere when latin matches.
    riis_caption, riis_attr = _caption_from_us_riis(latin)
    if riis_caption:
        elsewhere = riis_caption
        range_src = "us-riis"
        if riis_attr and riis_attr not in attribution:
            attribution = (attribution + " " + riis_attr).strip() if attribution else riis_attr

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
            if "claude" not in range_src:
                range_src = (
                    (range_src + "+claude").strip("+") if range_src else "claude"
                )
        elif not native:
            native = refine
            if not range_src:
                range_src = "claude"

    claude_elsewhere = str(
        claude_meta.get("rangeElsewhere") or claude_meta.get("invasiveElsewhere") or ""
    ).strip()
    # Only use Claude elsewhere when US-RIIS did not already set it.
    if not riis_caption and claude_elsewhere and len(claude_elsewhere) <= 180:
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
        if native and not range_src:
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
        "attribution": attribution[:420],
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
    build_on_fact: str = "",
    place_id: str = "",
    place_label: str = "",
    region: str = "",
    habitat: str = "",
    habitat_only: bool = False,
    compare_place_id: str = "",
    compare_place_label: str = "",
    season: str = "",
    garden_focus: bool = False,
    focus_mode: str = "",
    fact_level: int | None = None,
    fact_count: int | None = None,
    pool_refill: bool = False,
) -> dict[str, Any]:
    display = common.strip()
    if not display:
        raise ValueError("commonName required")
    latin_n = latin.strip()
    cultivar_n = cultivar.strip()
    note_n = short_note.strip()
    color_n = bloom_color.strip()
    org_type = _normalize_organism_type(
        organism_type or ("evidence" if evidence else "organism")
    )
    is_geology = _is_natural_nonliving(org_type)
    avoid = [
        _clip_plain(str(x), MAX_FACT_CHARS)
        for x in (avoid_facts or [])
        if str(x).strip()
    ][:40]
    build_on = _clip_plain(str(build_on_fact or ""), MAX_FACT_CHARS)
    place_id_n = place_id.strip()[:64]
    place_label_n = place_label.strip()[:120]
    region_n = region.strip()[:40]
    habitat_n = habitat.strip()[:40]
    compare_id_n = compare_place_id.strip()[:64]
    compare_label_n = compare_place_label.strip()[:120]
    season_n = season.strip()[:20] or ""
    focus = _normalize_focus_mode(
        focus_mode or "",
        garden_focus=garden_focus if not str(focus_mode or "").strip() else None,
    )
    garden_focus = focus == "garden"
    allowed_kinds = _allowed_kinds_for_fact_level(fact_level, fact_count)
    allow_help = "help" in allowed_kinds
    allow_wonder = "wonder" in allowed_kinds
    callout_limit = POOL_REFILL_CALLOUTS if pool_refill else MAX_CALLOUTS

    ns_meta = (
        None
        if is_geology
        else (_fetch_natureserve_meta(latin_n) if latin_n else None)
    )
    fallback_meta = (
        {
            "nativeRange": "",
            "rangeElsewhere": "",
            "conservationStatus": "Geological specimen — not a living species",
            "statusSource": "geology",
            "rangeSource": "",
        }
        if is_geology
        else _fallback_species_meta(display, latin_n)
    )

    # Shared eco lean (bane of extinction): care for the living world without making
    # every line a chore or “work.” Fact kinds unlock with fact-level commitment.
    if is_geology:
        if allow_help and allow_wonder:
            mix_rules = (
                "Most callouts are noticing (kind=notice) about texture, formation, "
                "hardness, crystal habit, or where walkers meet this find. "
                "EXACTLY ONE callout must be a SMALL HELP tip (kind=help) — gentle "
                "leave-it / trail-or-shore kindness for rocks, minerals, or empty shells "
                "(never guilt; never tell kids to smash or pocket protected sites). "
                "EXACTLY ONE callout (separate from the help tip) should be a wonder fact "
                "(kind=wonder) about Earth history or how this material forms — less "
                "direct human impact. "
            )
        elif allow_help:
            mix_rules = (
                "Most callouts are noticing (kind=notice). "
                "EXACTLY ONE callout must be a SMALL HELP tip (kind=help) — gentle "
                "leave-it / trail-or-shore kindness. "
                "Do NOT include wonder callouts yet (kind=wonder locked). "
            )
        else:
            mix_rules = (
                "ALL callouts are everyday noticing (kind=notice) — color, grain, "
                "crystal shape, shell form, where it shows up outdoors. "
                "Do NOT include help tips (kind=help) or wonder (kind=wonder) yet. "
            )
        eco_tone = (
            "GEOLOGY LANE — this find is natural nonliving matter (rock, mineral, "
            "empty shell, or fossil), not a living wildlife species. "
            "Write calm earth-science facts for walkers: how it forms, hardness clues, "
            "texture, crystal habit, beach/trail noticing. "
            "Do NOT invent wildlife ecology, pollinators, diet, or IUCN status. "
            "Do NOT treat empty shells as living animals. "
            "Warm and concrete — not lecturey, not guilt. "
            + mix_rules
        )
        focus_block = (
            "FOCUS for geology finds: keep tips place-aware when a looking-at place is "
            "set (coast pebbles, trail outcrops, garden gravel) but stay geology-shaped. "
            "Hiking/Seashore modes may mention trail or beach etiquette for collecting. "
            "Garden mode may note decorative rock vs wild outcrop. "
            "Crops mode: say gently this is not a crop and share one honest adjacent note. "
        )
        system = (
            "You write short, family-friendly geology and earth-science callouts for "
            "Bane of Extinction nature finds (rocks, minerals, empty shells, fossils). "
            "Return ONLY valid JSON. No Wikipedia, no URLs, no scraping. "
            "Use well-established general knowledge about the NAMED find below. "
            "If unsure, say so gently. No medical claims. No treasure-hunting hype. "
            "Visible traits / formation / hardness / occurrence — not lab chemistry dumps. "
            "TONE — help a walker feel this earth find belongs in THEIR world. "
            + eco_tone
            + focus_block
            + "PLACE LENS — the player chose a place they are LOOKING AT (not GPS). "
            "Personalize tips to that lens when helpful. Never claim you know where "
            "the player is standing. "
            "Also fill nativeRangeRefine, rangeElsewhere, and conservationStatus as SHORT "
            "caption fields (not extra callouts). "
            "nativeRangeRefine: where this rock/mineral/shell commonly occurs or forms "
            "(e.g. 'Common in granite outcrops', 'Beach shell of cool temperate coasts'). "
            "rangeElsewhere: other places it is often found, or empty if not useful. "
            "Do NOT use invasive-species wording for minerals. "
            "conservationStatus: ALWAYS fill — e.g. 'Geological specimen — not a living "
            "species', 'Common rock type', 'Empty shell — leave wrack for habitat when "
            "you can'. Do NOT cite IUCN. "
            "Also fill localStatus for the LOOKING-AT place when useful "
            "(e.g. 'Common beach pebble here'), else empty. "
            "If a compare place is given, fill compareNote with one short contrast — else empty."
        )
    else:
        if allow_help and allow_wonder:
            mix_rules = (
                "Most callouts are noticing (kind=notice). "
                "EXACTLY ONE callout must be a SMALL HELP tip (kind=help) — gentle, choosable "
                "kindness — never guilt-trip; never blame staple foods, housing, transit, or "
                "systems people don’t control; never panic about extinction. "
                "EXACTLY ONE callout (separate from the help tip) should be a wonder fact "
                "(kind=wonder) about the species itself with less direct human impact. "
            )
        elif allow_help:
            mix_rules = (
                "Most callouts are noticing (kind=notice). "
                "EXACTLY ONE callout must be a SMALL HELP tip (kind=help) — gentle, choosable "
                "kindness — never guilt-trip; never blame staple foods, housing, transit, or "
                "systems people don’t control; never panic about extinction. "
                "Do NOT include species-wonder callouts yet (kind=wonder locked). "
            )
        else:
            mix_rules = (
                "ALL callouts are everyday noticing (kind=notice) — what you’d spot on a walk "
                "or in a bed. Warm and concrete. "
                "Do NOT include help tips (kind=help) or species-wonder (kind=wonder) yet — "
                "those unlock as the player’s fact level grows. "
            )

        eco_tone = (
            "ECO LEAN — this game is Bane of Extinction: lean toward helping the living "
            "world, but do NOT make every fact a save-the-planet assignment or homework. "
            "Warm and concrete — not lecturey, not guilt. "
            + mix_rules
        )

        focus_block = _focus_prompt_block(
            focus, allow_help=allow_help, fact_level=fact_level
        )

        system = (
            "You write short, family-friendly wildlife and plant education callouts for "
            "Bane of Extinction. Return ONLY valid JSON. No Wikipedia, no URLs, no scraping. "
            "Use well-established general knowledge about the NAMED organism below "
            "(the game's best guess). If unsure, say so gently. No medical claims. "
            "Visible traits / ecology / diet / habitat / pollinators — not internal anatomy. "
            "CRITICAL: match petal/ray COLOR from the identification and scan note. "
            "A red or dark sunflower must NOT get yellow-only petal facts. "
            "TONE — help a walker feel this organism belongs in THEIR world, not a textbook dump. "
            + eco_tone
            + focus_block
            + "PLACE LENS — the player chose a place they are LOOKING AT (not GPS). "
            "Personalize tips to that lens: native vs introduced vs invasive THERE, "
            "whether advice makes sense THERE, and what fits THAT kind of place "
            "(urban, suburban, city, coast, woodland, etc.). If only a habitat "
            "was chosen (no region), keep advice "
            "habitat-shaped and say status may differ by region. Never claim you know where "
            "the player is standing. "
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
        + ("Focus mode: " + focus + ". ")
        + (
            "Write geology-style callouts accurate for THIS natural nonliving find. "
            if is_geology
            else "Write callouts accurate for THIS identification and visible color. "
            "If red/dark sunflower rays, describe those — not classic yellow-only petals. "
        )
        + (
            "Put the help tip near the middle when possible; put the wonder fact last."
            if is_geology
            else "Put the help tip near the middle when possible; put the species-wonder fact last."
        )
    )
    if place_label_n or place_id_n:
        scope += (
            f" LOOKING-AT place (chosen, not GPS): {place_label_n or place_id_n}"
            + (f" [id={place_id_n}]" if place_id_n and place_label_n else "")
            + (f"; region={region_n}" if region_n else "")
            + (f"; habitat={habitat_n}" if habitat_n else "")
            + ("; habitat-only lens (no named region)" if habitat_only else "")
            + (
                ". Personalize occurrence / leave-it tips for THIS lens."
                if is_geology
                else ". Personalize native/invasive/help tips for THIS lens."
            )
        )
    else:
        scope += (
            " No place lens chosen — keep facts generally accurate; "
            + (
                "prefer occurrence-aware geology wording."
                if is_geology
                else (
                    "avoid claiming a planted-bed tip is always good everywhere; "
                    "prefer range-aware wording."
                )
            )
        )
    if compare_label_n or compare_id_n:
        scope += (
            f" COMPARE place (also chosen, not GPS): "
            f"{compare_label_n or compare_id_n}. "
            "Fill compareNote with one short contrast vs the looking-at place."
        )
    if season_n:
        scope += f" Season cue from device date: {season_n}."
    if is_geology:
        scope += (
            " Skip NatureServe / invasive-species framing. "
            "Fill occurrence captions and a geology-shaped status line."
        )
    elif ns_meta:
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
    riis_preview = ""
    _riis_attr = ""
    if not is_geology and latin_n:
        riis_preview, _riis_attr = _caption_from_us_riis(latin_n)
    if riis_preview:
        scope += (
            f" USGS US-RIIS already provides the elsewhere caution caption "
            f"(do not contradict; leave rangeElsewhere empty): {riis_preview}."
        )
    if evidence and not is_geology:
        scope += " Frame as evidence/clues the player noticed."
    if avoid:
        scope += (
            " FRESHNESS — the player already saw these facts for this find recently. "
            "Do NOT repeat or closely paraphrase them. Pick new angles, parts, seasons, "
            "neighbors, help tips, or wonder: "
            + " | ".join(avoid[:24])
        )
    if build_on:
        scope += (
            " BUILD-ON (required) — the player already learned this about THIS find: "
            f"«{build_on}». "
            "EXACTLY ONE callout in this set must deepen or focus that prior learning "
            "(e.g. who/what depends on it, what follows from it, a neighbor link) — "
            "true for THIS named find, not a generic lecture. "
            "Do NOT repeat or closely paraphrase that prior fact. "
            "Set buildsOn:true on that ONE callout only; all other callouts stay a free "
            "mix of allowed kinds (notice / help / wonder as unlocked). "
            "Build-on does NOT replace the help tip or wonder rules — it is one extra "
            "focus among the set, usually as a notice unless help/wonder truly fits."
        )

    caption_hints = (
        {
            "organismType": org_type or "rock",
            "nativeRangeRefine": "short occurrence / where it forms caption or empty",
            "rangeElsewhere": "other places it is often found, or empty",
            "conservationStatus": (
                "short geology status (e.g. Geological specimen — not a living species)"
            ),
            "localStatus": "short status for looking-at place or empty",
            "compareNote": "short contrast vs compare place or empty",
            "callouts": [
                {
                    "anchor": "part_or_clue",
                    "label": "Short label",
                    "kind": "notice",
                    "buildsOn": False,
                    "fact": "1–2 complete short sentences (finish every sentence)",
                }
            ],
        }
        if is_geology
        else {
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
                    "kind": "notice",
                    "buildsOn": False,
                    "fact": "1–2 complete short sentences (finish every sentence)",
                }
            ],
        }
    )

    user = (
        scope
        + "\n\nReturn JSON:\n"
        + json.dumps(caption_hints)
        + f"\nUse 3 to {callout_limit} callouts"
        + (" (pool refill — more fresh angles)" if pool_refill else "")
        + ". "
        "Tag each callout with kind: notice, help, or wonder. "
        f"Allowed kinds for this player right now: {', '.join(allowed_kinds)}. "
        + (
            "Mix: geology noticing for rocks, minerals, empty shells, and fossils. "
            if is_geology
            else (
                "Mix: everyday player-world facts for the ACTIVE focus "
                "(walk / garden / hiking / seashore / crops&domestics). "
                "Hiking and Seashore lean into people–place relationship for engaged players; "
                "other modes may still mention relationship when it fits. "
            )
        )
        + (
            "Include EXACTLY ONE small-help tip (kind=help). "
            if allow_help
            else "No help tips in this set. "
        )
        + (
            (
                "Include EXACTLY ONE earth-story wonder (kind=wonder). "
                if is_geology
                else "Include EXACTLY ONE species-own wonder (kind=wonder). "
            )
            if allow_wonder
            else "No wonder callouts in this set. "
        )
        + (
            (
                "EXACTLY ONE callout must set buildsOn:true and deepen the BUILD-ON prior "
                "fact above; every other callout must set buildsOn:false. "
            )
            if build_on
            else "Do not set buildsOn:true on any callout. "
        )
        + "Fresh angles if avoid-list given. "
        "Keep nativeRangeRefine, rangeElsewhere, conservationStatus, localStatus, and "
        "compareNote out of the callout list. "
        f"Each fact must be a complete thought under ~{MAX_FACT_CHARS} characters — "
        "never stop mid-sentence."
    )

    claude_meta: dict[str, Any] = {}
    local_status = ""
    compare_note = ""
    try:
        # Place-lens callouts need headroom so Claude does not stop mid-sentence.
        raw_text = _call_claude_text(
            system, user, max_tokens=2000 if pool_refill else 1600
        )
        parsed = _extract_json_object(raw_text)
        callouts = _normalize_callouts(
            parsed.get("callouts"),
            allowed_kinds,
            max_callouts=callout_limit,
            require_builds_on=bool(build_on),
        )
        if len(callouts) < 2:
            raise RuntimeError("Too few callouts")
        source = "claude"
        if not organism_type and parsed.get("organismType"):
            org_type = _normalize_organism_type(str(parsed.get("organismType")))
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
        callouts = _normalize_callouts(
            _fallback_callouts_for(
                display,
                latin_n,
                note_n,
                color_n,
                garden_focus=garden_focus,
                focus_mode=focus,
                organism_type=org_type,
            ),
            allowed_kinds,
            max_callouts=callout_limit,
        )
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

    meta = _merge_species_meta(
        ns_meta, claude_meta, fallback_meta, latin=latin_n
    )

    title = display
    if cultivar_n and cultivar_n.lower() not in display.lower():
        title = f"{display} ({cultivar_n})"

    disclaimer = (
        "Helper facts for what the game thinks it saw — useful for learning, "
        "not a guaranteed field guide."
    )
    disclaimer += _focus_disclaimer(focus)
    if is_geology:
        disclaimer += " Geology-style facts for a natural nonliving find."
    if place_label_n:
        disclaimer += (
            " Place tips follow the looking-at place you chose — not GPS or where you stand."
        )
    if meta.get("attribution"):
        disclaimer += " " + meta["attribution"]

    open_credits: list[str] = []
    status_src = str(meta.get("statusSource") or "")
    range_src = str(meta.get("rangeSource") or "")
    if not is_geology and (
        "natureserve" in status_src
        or "natureserve" in range_src
        or (
            meta.get("attribution") and "NatureServe" in str(meta.get("attribution"))
        )
    ):
        open_credits.append(
            "NatureServe Explorer (https://explorer.natureserve.org/) — CC BY"
        )
    if not is_geology and (
        "us-riis" in range_src
        or (meta.get("attribution") and "US-RIIS" in str(meta.get("attribution")))
    ):
        open_credits.append("USGS US-RIIS — CC0 public domain")
    if not is_geology and not open_credits and latin_n:
        open_credits.append(
            "Range/status when available: NatureServe Explorer (CC BY); "
            "U.S. introduced/invasive captions: USGS US-RIIS (CC0)"
        )

    fact_level_out = 1
    for lvl, need, _kinds in FACT_LEVEL_THRESHOLDS:
        if fact_level is not None:
            try:
                if int(fact_level) == lvl:
                    fact_level_out = lvl
                    break
            except (TypeError, ValueError):
                pass
        elif fact_count is not None:
            try:
                if int(fact_count) >= need:
                    fact_level_out = lvl
            except (TypeError, ValueError):
                pass

    return {
        "ok": True,
        "source": source,
        "organismType": org_type,
        "commonName": display,
        "latinName": latin_n,
        "cultivar": cultivar_n or None,
        "displayName": title,
        "callouts": callouts,
        "poolRefill": bool(pool_refill),
        "buildOnFact": build_on or "",
        "nativeRange": meta.get("nativeRange") or "",
        "rangeElsewhere": meta.get("rangeElsewhere") or "",
        "conservationStatus": meta.get("conservationStatus") or "",
        "statusSource": meta.get("statusSource") or "",
        "rangeSource": meta.get("rangeSource") or "",
        "attribution": meta.get("attribution") or "",
        "openCredits": open_credits,
        "placeId": place_id_n,
        "placeLabel": place_label_n,
        "localStatus": local_status,
        "comparePlaceId": compare_id_n,
        "comparePlaceLabel": compare_label_n,
        "compareNote": compare_note,
        "season": season_n,
        "gardenFocus": bool(garden_focus),
        "focusMode": focus,
        "factLevel": fact_level_out,
        "allowedKinds": allowed_kinds,
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
        if habitat in ("suburban", "urban", "city") or "suburban" in pid:
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
                    "usRiis": bool(_us_riis_entry("lythrum salicaria")),
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
            blob = _read_learned_blob(str(identity["email"]))
            _json(
                self,
                200,
                {
                    "ok": True,
                    "signedIn": True,
                    "email": identity["email"],
                    "entries": blob["entries"],
                    "facts": blob["facts"],
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
            shelf_hints = _parse_shelf_hints(
                body.get("shelfHints")
                or body.get("learnedHints")
                or body.get("learnedShelf")
            )
            rejected_names = _parse_rejected_names(
                body.get("rejectedNames")
                or body.get("excludeNames")
                or body.get("wrongGuesses")
            )
            result = identify_wildlife(
                image_b64,
                mime,
                want_codex_still=want_still,
                shelf_hints=shelf_hints,
                rejected_names=rejected_names,
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
            lookup_only = bool(
                body.get("lookupOnly")
                or body.get("cacheOnly")
                or body.get("reuseOnly")
            )
            result = generate_codex_still(
                image_b64 or None,
                mime,
                common=common,
                latin=latin,
                cultivar=cultivar,
                organism_type=organism_type,
                short_note=short_note,
                life_stage=life_stage,
                lookup_only=lookup_only,
            )
            if result.get("ok"):
                code = 200
            elif result.get("error") == "cache_miss":
                code = 404
            else:
                code = 503 if not gemini_api_key() else 502
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
                _clip_plain(str(x), MAX_FACT_CHARS) for x in avoid_raw if str(x).strip()
            ][:40]
            build_on_fact = _clip_plain(
                str(
                    body.get("buildOnFact")
                    or body.get("build_on_fact")
                    or body.get("buildOn")
                    or ""
                ),
                MAX_FACT_CHARS,
            )
            place_id = str(body.get("placeId") or "").strip()
            place_label = str(body.get("placeLabel") or "").strip()
            region = str(body.get("region") or "").strip()
            habitat = str(body.get("habitat") or "").strip()
            habitat_only = bool(body.get("habitatOnly"))
            compare_place_id = str(body.get("comparePlaceId") or "").strip()
            compare_place_label = str(body.get("comparePlaceLabel") or "").strip()
            season = str(body.get("season") or "").strip()
            garden_focus = bool(
                body.get("gardenFocus")
                or body.get("garden_focus")
                or body.get("gardenMode")
            )
            focus_mode = str(
                body.get("focusMode")
                or body.get("focus")
                or body.get("mode")
                or ""
            ).strip()
            fact_level_raw = body.get("factLevel")
            fact_count_raw = body.get("factCount")
            try:
                fact_level = (
                    int(fact_level_raw) if fact_level_raw is not None else None
                )
            except (TypeError, ValueError):
                fact_level = None
            try:
                fact_count = (
                    int(fact_count_raw) if fact_count_raw is not None else None
                )
            except (TypeError, ValueError):
                fact_count = None
            pool_refill = bool(
                body.get("poolRefill")
                or body.get("refillPool")
                or body.get("fillFactPool")
            )
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
                build_on_fact=build_on_fact,
                place_id=place_id,
                place_label=place_label,
                region=region,
                habitat=habitat,
                habitat_only=habitat_only,
                compare_place_id=compare_place_id,
                compare_place_label=compare_place_label,
                season=season,
                garden_focus=garden_focus,
                focus_mode=focus_mode,
                fact_level=fact_level,
                fact_count=fact_count,
                pool_refill=pool_refill,
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
            remote_blob = _read_learned_blob(email)
            remote = remote_blob["entries"]
            remote_facts = remote_blob["facts"]
            incoming = body.get("entries")
            if incoming is None and isinstance(body.get("entry"), dict):
                incoming = [body["entry"]]
            local = _normalize_learned_list(incoming if incoming is not None else [])
            incoming_facts = body.get("facts")
            local_facts = (
                _normalize_learned_facts(incoming_facts)
                if incoming_facts is not None
                else None
            )
            mode = str(body.get("mode") or "merge").strip().lower()
            if mode == "replace":
                saved = save_learned(
                    email,
                    local,
                    local_facts if local_facts is not None else [],
                )
            else:
                merged_entries = merge_learned(local, remote)
                merged_facts = merge_learned_facts(
                    local_facts if local_facts is not None else [],
                    remote_facts,
                )
                saved = save_learned(email, merged_entries, merged_facts)
            _json(
                self,
                200,
                {
                    "ok": True,
                    "signedIn": True,
                    "email": email,
                    "entries": saved["entries"],
                    "facts": saved["facts"],
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
