"""LoreKeeper — Ask router plan (shared by router + RAG)."""
from __future__ import annotations

from dataclasses import dataclass, field

ROUTER_VERSION = "1.0.0"
ROUTER_MODEL = "claude-haiku-4-5-20251001"
ANSWER_MODEL_SONNET = "claude-sonnet-4-6"
ANSWER_MODEL_HAIKU = "claude-haiku-4-5-20251001"


@dataclass
class AskPlan:
    intent: str
    pipeline: str
    answer_model: str
    question_kind: str
    role_terms: list[str] = field(default_factory=list)
    character_names: list[str] = field(default_factory=list)
    section: str | None = None
    use_draft_tail: bool = False
    router_engine: str = "haiku"

    def resolve_answer_model_id(self) -> str:
        if self.answer_model == "haiku":
            return ANSWER_MODEL_HAIKU
        return ANSWER_MODEL_SONNET
