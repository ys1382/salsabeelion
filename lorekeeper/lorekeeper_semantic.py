"""Meaning match for Ask — same fact, different words.

Runs a small local model. This step does not send notes to an outside service.
The answer still has to be a saved line. The score only decides which line.
"""

from __future__ import annotations

import math
import threading
from typing import Sequence

# Tuned on stand-in lines: a real understanding sentence sits above ~0.68.
# A nearby but wrong line (war dump, tea, wrong person) sits at or below ~0.64.
MIN_MEANING_SCORE = 0.66

_lock = threading.Lock()
_model = None
_unavailable = False


def _load_model():
    global _model, _unavailable
    if _model is not None or _unavailable:
        return _model
    with _lock:
        if _model is not None or _unavailable:
            return _model
        try:
            from fastembed import TextEmbedding

            _model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        except Exception:
            _unavailable = True
            _model = None
    return _model


def meaning_available() -> bool:
    return _load_model() is not None


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += float(x) * float(y)
        na += float(x) * float(x)
        nb += float(y) * float(y)
    if na <= 0 or nb <= 0:
        return 0.0
    return dot / math.sqrt(na * nb)


def meaning_scores(question: str, sentences: list[str]) -> list[float] | None:
    """How close each sentence is to the question. None if the model cannot run."""
    clean = [s.strip() for s in sentences]
    if not question.strip() or not clean:
        return []
    model = _load_model()
    if model is None:
        return None
    try:
        vectors = list(model.embed([question.strip(), *clean]))
    except Exception:
        return None
    if len(vectors) != len(clean) + 1:
        return None
    query = list(vectors[0])
    return [_cosine(query, list(vec)) for vec in vectors[1:]]
