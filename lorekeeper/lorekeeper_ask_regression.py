"""Run Ask regression cases from JSON fixtures (#33)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from lorekeeper_recall import recall_from_user_data

_FIXTURE_DIR = Path(__file__).resolve().parent / "tests" / "fixtures"
FIXTURE_PATH = _FIXTURE_DIR / "ask_regression_cases.json"


def load_regression_cases() -> list[dict[str, Any]]:
    if not FIXTURE_PATH.is_file():
        return []
    data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [c for c in data if isinstance(c, dict)]
    if isinstance(data, dict) and isinstance(data.get("cases"), list):
        return [c for c in data["cases"] if isinstance(c, dict)]
    return []


def _entries_payload(case: dict[str, Any]) -> str:
    entries = case.get("entries")
    if isinstance(entries, list):
        return json.dumps(entries)
    ref = case.get("corpusFixture")
    if ref:
        path = _FIXTURE_DIR / str(ref)
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            return json.dumps(data.get("entries") or [])
    return "[]"


def run_regression_case(case: dict[str, Any], *, rag_off: bool = True) -> dict[str, Any]:
    import os

    if rag_off:
        os.environ["LOREKEEPER_RAG"] = "0"
    question = str(case.get("question") or "")
    user_data = {"lorekeeper_entries_v1": _entries_payload(case)}
    docs = case.get("documents")
    if isinstance(docs, list) and docs:
        user_data["lorekeeper_documents_v1"] = json.dumps(docs)
    scope = case.get("scope") if isinstance(case.get("scope"), dict) else None
    res = recall_from_user_data(
        question,
        user_data,
        mode=str(case.get("mode") or "full"),
        scope=scope,
        spot_check=bool(case.get("spotCheck")),
    )
    return res if isinstance(res, dict) else {"ok": False, "error": "bad_response"}


def assert_regression_case(case: dict[str, Any], res: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    case_id = str(case.get("id") or case.get("label") or "case")
    if case.get("expectOk") is not False and not res.get("ok"):
        errors.append(f"{case_id}: expected ok, got {res.get('error')}")
        return errors
    assertions = case.get("assert") if isinstance(case.get("assert"), dict) else {}
    answer = str(res.get("answer") or "")
    answer_low = answer.lower()

    if "questionKind" in assertions:
        if res.get("questionKind") != assertions["questionKind"]:
            errors.append(
                f"{case_id}: questionKind expected {assertions['questionKind']!r}, "
                f"got {res.get('questionKind')!r}"
            )
    if "materialState" in assertions:
        if res.get("materialState") != assertions["materialState"]:
            errors.append(
                f"{case_id}: materialState expected {assertions['materialState']!r}, "
                f"got {res.get('materialState')!r}"
            )
    if "materialStateNot" in assertions:
        if res.get("materialState") == assertions["materialStateNot"]:
            errors.append(
                f"{case_id}: materialState must not be {assertions['materialStateNot']!r}, "
                f"got {res.get('materialState')!r}"
            )
    if "recallEngine" in assertions:
        if res.get("recallEngine") != assertions["recallEngine"]:
            errors.append(
                f"{case_id}: recallEngine expected {assertions['recallEngine']!r}, "
                f"got {res.get('recallEngine')!r}"
            )
    for needle in assertions.get("answerContains") or []:
        if str(needle).lower() not in answer_low:
            errors.append(f"{case_id}: answer missing {needle!r}")
    any_needles = assertions.get("answerContainsAny") or []
    if any_needles and not any(str(n).lower() in answer_low for n in any_needles):
        errors.append(
            f"{case_id}: answer missing any of {[str(n) for n in any_needles]!r}"
        )
    for needle in assertions.get("answerNotContains") or []:
        if str(needle).lower() in answer_low:
            errors.append(f"{case_id}: answer must not contain {needle!r}")
    max_len = assertions.get("answerMaxChars")
    if max_len is not None and len(answer) > int(max_len):
        errors.append(f"{case_id}: answer too long ({len(answer)} > {max_len})")
    return errors


def correction_to_regression_stub(row: dict[str, Any]) -> dict[str, Any]:
    """Turn one Owner's Office correction into a fixture stub (no auto-corpus)."""
    meta = row.get("meta") if isinstance(row.get("meta"), dict) else {}
    note = str(row.get("message") or "").strip()
    question = str(meta.get("question") or "").strip()
    stub_id = "from_correction_" + str(row.get("createdAt") or "0")
    return {
        "id": stub_id,
        "label": "From Owner correction — add synthetic entries before enabling",
        "source": "ask_recall_wrong",
        "ownerNote": note,
        "question": question,
        "wrongAnswer": str(meta.get("answer") or ""),
        "page": meta.get("page"),
        "scope": meta.get("scope"),
        "disabled": True,
        "entries": [],
        "assert": {
            "answerContains": [],
            "answerNotContains": [],
            "_comment": "Fill entries with fake names; set assert from ownerNote",
        },
    }
