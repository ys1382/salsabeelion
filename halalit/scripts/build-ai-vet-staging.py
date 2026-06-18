#!/usr/bin/env python3
"""Regenerate halalit/www/halalit-ai-vet-staging.js from the entries JSON source."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "HALALIT-AI-VET-STAGING.json"
OUT = ROOT / "www" / "halalit-ai-vet-staging.js"
LEGACY = OUT

MATCH_FN = r"""
  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleMatches(entryTitle, lookupTitle) {
    var a = norm(lookupTitle);
    var b = norm(entryTitle);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
    var core = b.replace(/\b(the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
    if (core && core.length >= 4 && a.indexOf(core) >= 0) return true;
    return false;
  }

  function authorMatches(entryAuthor, lookupAuthor) {
    var ea = norm(entryAuthor);
    if (!ea) return true;
    var la = norm(lookupAuthor);
    if (!la) return false;
    if (la === ea) return true;
    if (la.indexOf(ea) >= 0 || ea.indexOf(la) >= 0) return true;
    var parts = ea.split(/\s*&\s*|\s*,\s*|\s+and\s+/i);
    for (var i = 0; i < parts.length; i++) {
      var p = norm(parts[i]);
      if (p && p.length >= 2 && la.indexOf(p) >= 0) return true;
    }
    return false;
  }

  function detailFor(entry) {
    var note = entry.note ? String(entry.note).trim() : "";
    if (entry.tier === "ai_likely_pass") {
      return (
        (note || "AI quick pass on its screen (LGBTQ/adult romance/profanity etc.)—Halalit uses more rules than that.") +
        " Not hand-checked by the owner—your call until we vet it cover to cover."
      );
    }
    if (entry.tier === "ai_manual_review") {
      return (
        (note || "AI flagged possible concerns.") +
        " Needs owner hand-read—not a hand reject."
      );
    }
    return (
      (note || "AI likely fails Halalit shelf rules.") +
      " AI rejection only—not manually checked or hand-rejected by the owner."
    );
  }

  function matchOne(title, author) {
    for (var i = 0; i < ENTRIES.length; i++) {
      var e = ENTRIES[i];
      if (titleMatches(e.title, title) && authorMatches(e.author, author)) {
        return {
          tier: e.tier,
          detail: detailFor(e),
          title: e.title,
          author: e.author,
        };
      }
    }
    return null;
  }

  function match(title, author) {
    var direct = matchOne(title, author);
    if (direct) return direct;
    var VS = global.HalalitBookcheckVetSource;
    if (VS && typeof VS.canonicalBarcodeBook === "function") {
      var canon = VS.canonicalBarcodeBook(title, author);
      if (canon) {
        var alt = matchOne(canon.title, canon.author);
        if (alt) return alt;
      }
    }
    if (VS && typeof VS.extractLatinAuthor === "function") {
      var latin = VS.extractLatinAuthor(author);
      if (latin && latin !== author) {
        var lat = matchOne(title, latin);
        if (lat) return lat;
      }
    }
    return null;
  }

  global.HalalitAiVetStaging = {
    entries: ENTRIES,
    match: match,
  };
})(typeof window !== "undefined" ? window : this);
"""


def norm(s: str) -> str:
    import unicodedata

    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).lower().strip()


def title_key(title: str) -> str:
    return norm(title)


def author_key(author: str) -> str:
    return norm(author)


def load_legacy_entries() -> list[dict]:
    text = LEGACY.read_text(encoding="utf-8")
    m = re.search(r"var ENTRIES = (\[.*?\]);", text, re.S)
    if not m:
        raise SystemExit("Could not parse legacy ENTRIES from JS")
    return json.loads(m.group(1))


def merge_entries(base: list[dict], patch: list[dict], remove: list[tuple[str, str]]) -> list[dict]:
    remove_keys = {(title_key(t), author_key(a)) for t, a in remove}
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    patch_by_title: dict[str, dict] = {}
    for p in patch:
        patch_by_title[title_key(p["title"])] = p

    for e in base:
        k = (title_key(e["title"]), author_key(e.get("author", "")))
        if k in remove_keys:
            continue
        tk = title_key(e["title"])
        if tk in patch_by_title:
            e = patch_by_title.pop(tk)
        if k in seen:
            continue
        seen.add(k)
        out.append(e)

    for p in list(patch_by_title.values()):
        k = (title_key(p["title"]), author_key(p.get("author", "")))
        if k not in seen:
            seen.add(k)
            out.append(p)
    return out


def write_js(entries: list[dict]) -> None:
    body = json.dumps(entries, indent=2, ensure_ascii=False)
    body = body.replace("\n", "\n  ")
    content = (
        "/**\n"
        " * Halalit — AI vet staging (live Bookcheck labels; not owner hand-vet).\n"
        " * Generated from HALALIT-AI-VET-STAGING.json — do not edit by hand.\n"
        " * Run: python3 halalit/scripts/build-ai-vet-staging.py\n"
        " */\n"
        "(function (global) {\n"
        "  var ENTRIES = "
        + body
        + ";\n"
        + MATCH_FN
    )
    OUT.write_text(content, encoding="utf-8")


def main() -> None:
    if SRC.exists():
        entries = json.loads(SRC.read_text(encoding="utf-8"))
    else:
        base = load_legacy_entries()
        patch = json.loads((Path(__file__).parent / "ai-vet-staging-patch.json").read_text(encoding="utf-8"))
        entries = merge_entries(base, patch["upsert"], [tuple(x) for x in patch["remove"]])
        SRC.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    write_js(entries)
    print(f"Wrote {len(entries)} entries → {OUT}")


if __name__ == "__main__":
    main()
