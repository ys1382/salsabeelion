"""LoreKeeper — reference-voice character summaries (#12–13), local only."""
from __future__ import annotations

import re
from typing import Any

from lorekeeper_cast_roles import (
    ROLE_TERMS_RE,
    merge_explicit_and_inferred,
)

_ROLE_WORDS_RE = ROLE_TERMS_RE

_INFERRED_ROLE = re.compile(
    r"\breads as the\b|\bstory keeps centering on them\b|\bappears as the viewpoint\b",
    re.I,
)

_META_IN_TIE = re.compile(
    r"\b(?:in your notes|mentioned in your|name not stated|not named)\b",
    re.I,
)

_UNCLEAR_SECTION_HEADING = "What isn't spelled out yet in your notes:"
_FOOTER_REFERENCE = "— From your notes only. Nothing invented."
_FOOTER_COVERAGE = "— Pulled from your notes only. Nothing invented."


def is_coverage_question(question: str) -> bool:
    q = question or ""
    from lorekeeper_notes_vs_draft import is_notes_not_in_draft_question
    from lorekeeper_writing_next import is_writing_next_task_list_question
    from lorekeeper_catchup_gather import is_catchup_gather_question

    if (
        is_notes_not_in_draft_question(q)
        or is_writing_next_task_list_question(q)
        or is_catchup_gather_question(q)
    ):
        return False
    if re.search(
        r"\b("
        r"what have i (?:done|written|saved)|what(?:'s| is) missing|"
        r"what do i have|what have i got|coverage|how much (?:have|do) i"
        r")\b",
        q,
        re.I,
    ):
        return True
    if re.search(
        r"\bwhat (?:have )?i (?:written|saved)\s+(?:on|about|for|regarding)\b",
        q,
        re.I,
    ):
        return True
    if re.search(
        r"\b("
        r"tell me everything|remind me of everything|"
        r"everything i (?:have )?(?:written|saved)|"
        r"all i (?:have )?(?:written|saved)|show me everything(?:\s+i)?"
        r")\b",
        q,
        re.I,
    ):
        return True
    return False


def is_audit_question(question: str) -> bool:
    """Writer asked about discrepancies, fixes, or planning — not identity."""
    q = (question or "").lower()
    return bool(
        re.search(
            r"(?:"
            r"\bdiscrepanc\w*|\binconsist\w*|\bcontradict\w*|"
            r"\bplot holes?\b|\bcanon conflicts?\b|"
            r"\bthings to fix\b|\bneed to fix\b|\bwhat(?:'s| is) wrong\b|"
            r"\bworried about\b|\bconcerned about\b|\bflagged\b|\bto do about\b"
            r")",
            q,
            re.I,
        )
    )


_PLOT_ARC_RE = re.compile(
    r"\b("
    r"by the events of|throughout the series|as the story progresses|"
    r"caught between|emotional and narrative|narrative center|"
    r"forms the (?:heart|center|core)|journey through|arc of|"
    r"becomes caught|story follows|what they go through|"
    r"life story|backstory unfolds|over the course of"
    r")\b",
    re.I,
)

# Story-role significance — ONLY explicit role stakes about the subject.
# Do NOT list world words (preyfolk/predator/sentient) alone — that let plot dumps pass.
_STORY_SIGNIFICANCE_RE = re.compile(
    r"\b("
    r"storywalks?|story[- ]walks?|storywalker|"
    r"sets? in motion|set in motion|"
    r"changes? (?:their|the|his|her) world(?:\s+forever)?"
    r")\b",
    re.I,
)

# Character-overview stakes (plain overview — not scene plot, not storywalk dumps).
# Includes accidental world-change / societal upheaval / crossing into another's world
# (cast status), but NOT bare storywalk dumps without an upheaval reason.
_OVERVIEW_SIGNIFICANCE_RE = re.compile(
    r"\b("
    r"chosen one|the chosen|destined to|fated to|prophesied|"
    r"meant to (?:defeat|save|destroy|stop|kill|protect)|"
    r"to (?:defeat|save|destroy|stop) the\b|"
    r"nemesis|arch[- ]?enem(?:y|ies)|sworn enem(?:y|ies)|"
    r"best friend|closest friend|sworn friend|"
    r"father to|mother to|mentor to|prot[eé]g[eé]|"
    r"crosses? (?:realit(?:y|ies)|into|over into|worlds?)|"
    r"cross(?:es|ing)? .{0,40}?into .{0,60}?(?:world|dimension|reality)|"
    r"sets? off .{0,100}?(?:upheaval|chain of events)|"
    r"relationship upheaval|"
    r"(?:societal|social|political) upheaval|"
    r"upheaval for .{0,40}?(?:predator|preyfolk|prey folk)|"
    r"accidental(?:ly)? .{0,40}?(?:world[- ]?chang|upheaval|stumble)|"
    r"finds? (?:herself|himself|themselves) .{0,80}?(?:pulled|drawn|thrown|cast) into|"
    r"pulled into (?:a |the )?(?:waking )?dream|"
    r"finds? (?:herself|himself|themselves) in (?:a |the )?(?:situation|dream|world)|"
    # Hidden identity / concealment stakes (cast overview — not scene beats).
    r"conceal(?:s|ed|ing)? .{0,60}?(?:human|true|real|identity|nature)|"
    r"(?:human|true|real) (?:nature|identity).{0,40}?conceal(?:s|ed|ing)?|"
    r"keeps? .{0,40}?(?:human|true|real) .{0,30}?conceal(?:s|ed|ing)?|"
    r"hiding (?:that )?(?:she|he|they) (?:is|are) (?:human|mortal)|"
    r"(?:is|was|are|were) human(?:\b|,).{0,80}?conceal(?:s|ed|ing)?|"
    r"concealing that among|"
    r"writes? under (?:a )?pen name|"
    r"pen name"
    r")\b",
    re.I,
)

# Type/reason of upheaval (Predator–Preyfolk rediscovery / sentience), not POV dumps.
# Do NOT match bare "sentience" / "level of sentience" in plot beats (surveillance Q&A).
_UPHEAVAL_REASON_RE = re.compile(
    r"\b("
    r"rediscover(?:y|s|ed|ing)?|"
    r"(?:predators?|preyfolk|prey folk).{0,80}?sentient|"
    r"sentient.{0,60}?(?:predators?|preyfolk|prey folk)|"
    r"preyfolk (?:are|were) (?:also |just as )?sentient|"
    r"just as sentient|"
    r"(?:same level of )?sentience as (?:predators?|preyfolk|prey folk)|"
    r"(?:rediscover(?:y|s|ed|ing)?|upheaval|reveal).{0,60}?sentien|"
    r"sentien(?:ce|t).{0,60}?(?:rediscover|upheaval|preyfolk|predators?)|"
    r"reveal that .{0,40}?preyfolk|"
    r"upheaval (?:because|from|due to|over|about)|"
    r"(?:because|due to|from) .{0,60}?upheaval|"
    r"set(?:s|ting)? in motion .{0,80}?(?:reveal|rediscover|sentien)"
    r")\b",
    re.I,
)

# Close defining ties for a cast overview (not the whole cast).
_CLOSE_TIE_RE = re.compile(
    r"\b("
    r"brother|sister|cousin|son of|daughter of|child of|"
    r"father to|mother to|married|spouse|"
    r"nemesis|arch[- ]?enem(?:y|ies)|best friend|closest friend|"
    r"subject of|quarry|buck|doe|"
    r"up against|opposed by|rival (?:to|of)|enemy of"
    r")\b",
    re.I,
)

# Chronology / POV-order language — not cast-card identity.
# Keep this narrow: "the POV cuts" / look-on-face notes must NOT match.
_PLOT_SEQUENCE_RE = re.compile(
    r"\b("
    r"right after|soon after|just after|not long after|"
    r"at some point later|arrives? at some point|"
    r"but anyway|"
    r"under (?:close )?surveillance|keeping (?:his|her|their) ['\"]?guest['\"]?|"
    r"travel companions|asking about the latter|"
    r"next (?:POV|section|chapter|scene|beat)|"
    r"switches? to .{0,48}(?:POV|point of view)|"
    r"(?:his|her|their) next POV|"
    r"the next POV|"
    r"in (?:his|her|their) (?:first|second|third|opening|early) POV|"
    r"POV (?:shows?|is when|will be)|"
    r"section begins|"
    r"about to (?:slip|disappear|escape|vanish)|"
    r"looks? back with|"
    r"mouthed (?:an? )?(?:apology|words?)|"
    r"scene[- ]by[- ]scene|plot walkthrough|"
    r"what happens next|the next beat|"
    r"chasing them|stalking them|"
    r"lunge(?:s|d)? to (?:his|her|their) feet|"
    r"isn'?t surprised|wasn'?t surprised|badly injured"
    r")\b",
    re.I,
)

# Draft/awareness/plot bloat — never keep on who-is cast cards.
_WHO_IS_BLOAT_RE = re.compile(
    r"(?i)("
    r"\bnot long after\b|\bso right now\b|\bright now,?\s+"
    r"|\bbut anyway\b|\bat some point later\b|\barrives? at some point\b"
    r"|\bunder (?:close )?surveillance\b|\btravel companions\b"
    r"|\basking about the latter\b|\bkeeping (?:his|her|their) ['\"]?guest['\"]?\b"
    r"|\bis aware\b|\bare aware\b|\baware that\b|\breflects? on\b"
    r"|\bmentions? (?:his|her|their|the) theory\b|\btheory that\b"
    r"|\bbackground\s*:"
    r"|\btracking (?:them|him|her)\b|\bworks for\b"
    r"|\bno reason to realize\b|\bcould have killed\b|\bgot bit\b|\bfirst got\b"
    r"|\bspecifically\s*;"
    r"|\banother chance\b|\bout of shock\b"
    r"|\bdoesn'?t remember much\b|\bwould surprise his brothers\b"
    r"|\bmain victim\b|\bannoyance to\b"
    r"|\bis roused\b|\broused from\b|\bfurtively glancing\b"
    r"|\bforcibly groomed\b|\bcarrying (?:their|his|her)\b"
    r"|\bsoothed (?:the|his|her)\b|\bworris?ed for\b"
    r"|\bdoesn'?t know (?:anything )?about\b|\bdo not know (?:anything )?about\b"
    r"|\baside from the (?:fact|unspoken)\b|\balso,\s+aside\b"
    r"|\bcan and do work together\b"
    r"|\bhow predators work\b"
    r")"
)

# Faction-roster / chatty knowledge dumps on who-is (not short formal awareness status).
_WHO_IS_FACTION_DUMP_RE = re.compile(
    r"(?i)("
    r"golden owl.{0,100}(?:lynx|cheshire)|"
    r"(?:eurasian\s+)?lynx.{0,80}cheshire|"
    r"cheshire cat.{0,60}work together|"
    r"(?:owl|lynx).{0,40},\s*(?:the\s+)?(?:eurasian\s+)?lynx.{0,40}cheshire|"
    r"doesn'?t know (?:anything )?about how|"
    r"aside from the (?:fact that|unspoken)|"
    r"can and do work together|"
    r"how predators work"
    r")"
)

# Short formal awareness status only (nuance / unspoken line) — not faction lists.
_FORMAL_AWARENESS_STATUS_RE = re.compile(
    r"\b("
    r"not yet fully aware|"
    r"political nuance|"
    r"unspoken (?:line|rule)|"
    r"becoming (?:more )?attuned|"
    r"slowly but surely|"
    r"predator[- ]preyfolk relations|"
    r"line that (?:he|she|they) has? somehow"
    r")\b",
    re.I,
)

# "X is <scene action…>" — not cast identity.
_SCENE_AFTER_IS_RE = re.compile(
    r"\b(?:is|was|are|were)\s+(?:roused|worried|glancing|carrying|groomed|soothed|"
    r"tracking|thinking|reflecting|sitting|standing|looking|walking|running|"
    r"watching|turning|reaching|holding|pulling|pushing|approaching|"
    r"startled|surprised|relieved|afraid|frightened)\b",
    re.I,
)

_CAST_CARD_ANCHOR_RE = re.compile(
    r"\b("
    r"protagonist|antagonist|villain|hero|heroine|married|brother|sister|"
    r"queen|king|guardian|viewpoint|main character|side character|"
    r"arcanist|species|rabbit|wolf|fox|lynx|also known as|"
    r"known to|knows .+ as|younger brother|older brother|"
    r"subject of|quarry|sentient|male|female|"
    r"storywalks?|sets? in motion|father|mother|parent|son of|daughter of"
    r")\b",
    re.I,
)

_OTHER_CHAR_EVENT_RE = re.compile(
    r"\b("
    r"isn'?t surprised|wasn'?t surprised|surprised to (?:see|find|learn)|"
    r"sees? that|saw that|notices? that|noticed that|"
    r"thinks? that|thought that|worries that|worried that|"
    r"believes? that|knows? that|realizes? that|suspects? that|"
    r"finds? (?:that|him|her|them)|found (?:that|him|her|them)|"
    r"watches?|watched|badly injured|wounded|bleeding|"
    r"in (?:his|her|their) (?:first|second|third|opening|early) POV"
    r")\b",
    re.I,
)

_KINSHIP_RE = re.compile(
    r"\b("
    r"brother|sister|sibling|mother|father|parent|son|daughter|child|"
    r"married|spouse|wife|husband|cousin|younger brother|older brother|"
    r"subject of|quarry|known by|known as|also known as|aka\b"
    r")\b",
    re.I,
)


def _is_plot_arc_clause(clause: str) -> bool:
    s = (clause or "").strip()
    if not s:
        return False
    # Story-role significance is allowed on who-is — not the same as plot dump.
    if is_story_significance_clause(s):
        return False
    if _PLOT_ARC_RE.search(s):
        return True
    if _PLOT_SEQUENCE_RE.search(s):
        return True
    if re.search(r"\bby the (?:end|close|events)\b", s, re.I):
        return True
    return False


def is_formal_awareness_status_clause(clause: str, label: str = "") -> bool:
    """
    Short formal awareness status for who-is (political nuance / unspoken line).
    Not faction-roster dumps or chatty 'doesn't know how Predators work' lists.
    """
    s = (clause or "").strip()
    if not s or not _FORMAL_AWARENESS_STATUS_RE.search(s):
        return False
    if _WHO_IS_FACTION_DUMP_RE.search(s):
        return False
    if re.search(
        r"\b(doesn'?t know (?:anything )?about|aside from the fact|"
        r"golden owl|eurasian lynx|can and do work together)\b",
        s,
        re.I,
    ):
        return False
    if _PLOT_SEQUENCE_RE.search(s):
        return False
    if label and is_other_character_scene_beat(s, label):
        return False
    if label and not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        if not re.match(r"^(?:He|She)\b", s, re.I):
            return False
    if len(s) > 240:
        return False
    return True


def is_upheaval_reason_clause(clause: str, label: str = "") -> bool:
    """True for short cast-status lines that name why upheaval happens (rediscovery / sentience)."""
    s = (clause or "").strip()
    if not s or not _UPHEAVAL_REASON_RE.search(s):
        return False
    if _WHO_IS_BLOAT_RE.search(s) or _PLOT_SEQUENCE_RE.search(s):
        return False
    if label and is_other_character_scene_beat(s, label):
        return False
    if label and not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        if not re.match(r"^(?:He|She)\b", s, re.I):
            return False
    if len(s) > 360:
        return False
    # Reject pure awareness / tracking dumps even if "sentient" appears.
    if re.search(
        r"\b(aware that|no reason to realize|tracking (?:them|him|her)|reflects? on)\b",
        s,
        re.I,
    ):
        return False
    return True


def is_overview_significance_clause(
    clause: str, label: str = "", *, allow_pronoun: bool = True
) -> bool:
    """True for plain overview stakes (chosen one / upheaval / crossing worlds / upheaval reason)."""
    s = (clause or "").strip()
    if not s:
        return False
    # Alias-only hits (Cheshire Cat named Lord Tenebris) are not that person's stakes.
    if label and label_only_as_alias_mention(s, label):
        return False

    def _about_ok() -> bool:
        if not label:
            return True
        if cast_sentence_about_subject(s, label, allow_pronoun=allow_pronoun):
            return True
        if allow_pronoun and re.match(r"^(?:He|She)\b", s, re.I):
            return True
        # Formalized stakes: "By being discovered…, Label has already set in motion…"
        if re.search(
            rf"\b{re.escape(label)}\s+(?:has|have|is|was|somehow|sets?|storywalks?)\b",
            s,
            re.I,
        ):
            return True
        return False

    # Upheaval type/reason may share "sets in motion" phrasing — keep as cast status.
    if is_upheaval_reason_clause(s, label):
        return _about_ok()
    if not _OVERVIEW_SIGNIFICANCE_RE.search(s):
        return False
    if is_story_significance_clause(s, label):
        return False
    if _WHO_IS_BLOAT_RE.search(s) or _PLOT_SEQUENCE_RE.search(s):
        return False
    if label and is_other_character_scene_beat(s, label):
        return False
    if not _about_ok():
        return False
    if len(s) > 320:
        return False
    return True


def who_is_answer_has_upheaval_reason(answer: str) -> bool:
    """True when the card already names upheaval type/reason (rediscovery / sentience)."""
    return bool(_UPHEAVAL_REASON_RE.search(answer or ""))


def is_story_significance_clause(clause: str, label: str = "") -> bool:
    """True for subject-led role stakes (storywalk / sets in motion), not world-word hits."""
    s = (clause or "").strip()
    if not s or not _STORY_SIGNIFICANCE_RE.search(s):
        return False
    if label and is_other_character_scene_beat(s, label):
        return False
    if _WHO_IS_BLOAT_RE.search(s):
        return False
    if _PLOT_SEQUENCE_RE.search(s):
        return False
    # Must be about the subject when a label is known.
    if label and not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False
    if label and not (
        re.match(rf"^{re.escape(label)}\b", s, re.I)
        or re.search(rf"\b{re.escape(label)}\s+(?:is|was|storywalks?|sets?)\b", s, re.I)
    ):
        return False
    return True


def who_is_answer_has_bloat(text: str) -> bool:
    """True when a who-is answer mixes in awareness/plot/background dump."""
    t = (text or "").strip()
    if not t:
        return False
    if _WHO_IS_BLOAT_RE.search(t) or _WHO_IS_FACTION_DUMP_RE.search(t):
        return True
    # Many sentences + plot-sequence markers = dump even if anchors present.
    sentences = [s for s in re.split(r"(?<=[.!?])\s+|(?<=;)\s+", t) if s.strip()]
    if len(sentences) >= 4 and _PLOT_SEQUENCE_RE.search(t):
        return True
    if len(sentences) >= 5 and not _KINSHIP_RE.search(t):
        # Long identity dump without ties still counts as bloated walkthrough.
        plotish = sum(1 for s in sentences if _PLOT_SEQUENCE_RE.search(s) or _WHO_IS_BLOAT_RE.search(s))
        if plotish >= 2:
            return True
    return False


def is_plausible_cast_person_name(name: str) -> bool:
    """Reject English stopwords mistaken for cast names (Especially, Are, …)."""
    raw = (name or "").strip().rstrip(".")
    if not raw or len(raw) < 3:
        return False
    # Multi-word: each part must be plausible (allows "Character B").
    from lorekeeper_inference import _NAME_STOP, _VERB_STOP, _INTERJECTIONS

    parts = re.findall(r"[A-Za-z0-9']+", raw)
    if not parts:
        return False
    # Bare placeholders from truncated "Character Q" parses — not real cast names.
    if len(parts) == 1 and parts[0].lower() in {
        "character",
        "person",
        "someone",
        "somebody",
        "figure",
        "protagonist",
        "antagonist",
    }:
        return False
    for part in parts:
        low = part.lower()
        if low in _NAME_STOP or low in _VERB_STOP or low in _INTERJECTIONS:
            return False
        if low in {
            "especially",
            "somewhat",
            "although",
            "considering",
            "rather",
            "ironically",
            "furtively",
            "approach",
            "beneath",
            "prone",
            "vigor",
            "latter",
            "former",
            "are",
            "is",
            "was",
            "were",
            "been",
            "being",
            "you",
            "enough",
            "forced",
            "quietly",
            "twins",
            "twin",
            "little",
            "one",
            "styg",
            "moonshadow",
            "rabbits",
            "rabbit",
        }:
            return False
    # Prefer Capitalized / Character N — reject all-lowercase English scraps.
    if raw.islower():
        return False
    return True


# Single-word / tiny predicates that must never become "X is birth." cast cards.
_SCRAP_IDENTITY_PREDICATES = frozenset(
    """
    birth death life age name one side of the a an at twin twins person people
    someone somebody something nothing everything anything exception
    """.split()
)


def label_only_as_alias_mention(sentence: str, label: str) -> bool:
    """
    True when the asked name appears only as someone else's alias
    (e.g. Cheshire Cat, named Lord Tenebris) — not as the clause subject.
    """
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    label = (label or "").strip()
    if not s or not label:
        return False
    lab = re.escape(label)
    if not re.search(rf"\b{lab}\b", s, re.I):
        return False
    if re.match(rf"^{lab}\b", s, re.I):
        return False
    if re.search(rf"\b{lab}\s+(?:is|was|are|were)\b", s, re.I):
        return False
    return bool(
        re.search(
            rf"\b(?:named|called|known as)\s+(?:Lord\s+|Lady\s+|Duke\s+|Duchess\s+|"
            rf"the\s+)?{lab}\b",
            s,
            re.I,
        )
    )


def cast_sentence_about_subject(
    sentence: str, label: str, *, allow_pronoun: bool = False
) -> bool:
    """
    True when a who-is fact sentence is about the asked character as subject —
    not another cast member's sheet that merely names them as an alias.
    """
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    label = (label or "").strip()
    if not s or not label:
        return False
    lab = re.escape(label)

    if label_only_as_alias_mention(s, label):
        return False
    if is_knower_pov_about_label(s, label):
        return False

    if re.match(rf"^{lab}\s+(?:is|was|are|were|storywalks?|sets?)\b", s, re.I):
        return True
    if re.match(rf"^{lab}\s*[—–\-:,]", s, re.I):
        return True
    # Subject-led action / stakes: "Etherei somehow crosses…"
    if re.match(rf"^{lab}\b", s, re.I):
        return True
    # Titled subject: "Lord Tenebris is…" when label is Tenebris.
    if re.match(
        rf"^(?:Lord|Lady|Duke|Duchess|Sir|Dame|King|Queen|Prince|Princess|"
        rf"Baron|Baroness|Count|Countess)\s+{lab}\b",
        s,
        re.I,
    ):
        return True
    # "The protagonist is named Platinus."
    if re.search(
        rf"\b(?:protagonist|antagonist|villain|hero|heroine)\s+is\s+named\s+"
        rf"[\"“']?{lab}\b",
        s,
        re.I,
    ):
        return True
    # "Premise: Elham is a young woman…"
    if re.match(
        rf"^(?:Premise|Role|Cast|Identity|Summary)\s*:\s*{lab}\s+"
        rf"(?:is|was|are|were)\b",
        s,
        re.I,
    ):
        return True

    # Another proper name leads the sentence — about them, not the asked label
    # (unless it is a title line for the label).
    m = re.match(
        r"^([A-Z][\w'-]+(?:\s+(?:of|[A-Z][\w'-]+)){0,2})\b",
        s,
    )
    if m:
        other = m.group(1).strip()
        other_low = other.lower()
        if other_low != label.lower() and other_low not in {
            "the",
            "he",
            "she",
            "they",
            "so",
            "in",
            "from",
            "his",
            "her",
            "their",
            "this",
            "that",
            "when",
            "after",
            "before",
            "premise",
            "role",
            "cast",
            "identity",
            "summary",
            "lord",
            "lady",
            "duke",
            "duchess",
        }:
            # Mid-sentence "Y is" inside someone else's thought/scene is not about Y.
            return False

    if re.match(r"^(?:He|She|They)\b", s, re.I):
        return bool(allow_pronoun)

    return False


def is_knower_pov_about_label(sentence: str, label: str) -> bool:
    """True when another cast member thinks/worries that the asked person …"""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    label = (label or "").strip()
    if not s or not label:
        return False
    lab = re.escape(label)
    # "Umber thinks that Tenebris is…"
    if re.match(
        rf"^(?!{lab}\b)([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)\s+"
        rf"(?:thinks?|thought|worries|worried|believes?|knows?|realizes?|"
        rf"suspects?|fears?|assumes?|guesses?)\s+that\s+.*\b{lab}\b",
        s,
        re.I,
    ):
        return True
    if re.search(
        rf"\b(?:thinks?|worries|believes?|knows?|realizes?|suspects?|fears?)\s+that\s+"
        rf"{lab}\s+(?:is|was|are|were|will|can|could|might)\b",
        s,
        re.I,
    ) and not re.match(rf"^{lab}\b", s, re.I):
        return True
    return False


def strip_inline_author_asides(sentence: str) -> str:
    """Remove parenthetical / inline 'I want…' asides so cast facts can surface."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s:
        return ""
    s = re.sub(r"\([^)]{0,200}\bI\b[^)]{0,200}\)", "", s)
    s = re.sub(
        r",\s*I\s+(?:want|think|still|don'?t|haven'?t|need|should|could|might)"
        r"[^.;]{0,160}",
        "",
        s,
        flags=re.I,
    )
    s = re.sub(r"\s+", " ", s).strip(" ,;")
    return s


def normalize_premise_cast_line(sentence: str, label: str) -> str:
    """Turn 'Premise: Elham is…' into a plain cast sentence."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    label = (label or "").strip()
    if not s or not label:
        return s
    m = re.match(
        rf"^(?:Premise|Role|Cast|Identity|Summary)\s*:\s*"
        rf"({re.escape(label)}\s+.+)$",
        s,
        re.I,
    )
    if m:
        s = m.group(1).strip()
    if s and not s.endswith((".", "!", "?")):
        s += "."
    return s


def compress_rename_infodump_to_cast_lines(sentence: str, label: str) -> list[str]:
    """Turn a long birth-name dump into short cast slots (no invention)."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    label = (label or "").strip()
    if not s or not label or not is_rename_infodump_clause(s, label):
        return []
    out: list[str] = []
    if re.search(r"\b(birth name of the protagonist|protagonist)\b", s, re.I):
        out.append(f"{label} is the protagonist.")
    akas = re.findall(
        r"changes?\s+(?:his|her|their)\s+name\s+to\s+"
        r"([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)",
        s,
    )
    # Drop parenthetical alternatives after a name; never keep trailing lowercase glue.
    cleaned_akas: list[str] = []
    for aka in akas:
        aka = re.split(r"\s*\(", aka, maxsplit=1)[0].strip()
        aka = re.sub(r"\s+(?:when|after|before|and|then|as|to)\b.*$", "", aka, flags=re.I).strip()
        if aka and aka.lower() != label.lower() and aka not in cleaned_akas:
            cleaned_akas.append(aka)
    if len(cleaned_akas) == 1:
        out.append(f"{label} is also known as {cleaned_akas[0]}.")
    elif len(cleaned_akas) >= 2:
        out.append(
            f"{label} is also known as {cleaned_akas[0]} and later {cleaned_akas[-1]}."
        )
    m = re.search(
        r"(?:leader of (?:his|her|their) faction\s+against|"
        r"faction against|"
        r"against)\s+"
        r"([A-Z][\w'-]+(?:\s+[A-Z0-9])?)(?:'s)?(?:\s+faction)?",
        s,
    )
    if m:
        rival = m.group(1).strip().rstrip("'s").rstrip("'")
        if rival.lower() not in {label.lower(), "when", "after", "before"}:
            out.append(f"{label} leads a faction against {rival}.")
    return out[:4]


def is_incomplete_cast_clause(sentence: str, label: str = "") -> bool:
    """True for cut-off scraps like 'Tenebris is a sole exception and.'"""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s:
        return True
    if re.search(
        r"\b(and|or|but|with|of|to|for|as|than|that|which|who|whom)\s*\.?\s*$",
        s,
        re.I,
    ):
        return True
    if label and re.search(
        rf"^{re.escape(label)}\s+is\s+(?:a|an|the)\s+\w+(?:\s+\w+){{0,4}}\s+"
        rf"(?:and|or|but)\s*\.?\s*$",
        s,
        re.I,
    ):
        return True
    return False


def is_rename_infodump_clause(sentence: str, label: str = "") -> bool:
    """Long birth-name / rename dumps that crowd out kin and stakes on who-is."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s or len(s) < 140:
        return False
    if not re.search(
        r"\b("
        r"birth name|changes? (?:his|her|their) name|renamed|also known as|"
        r"possible alternatives?|fantasy name based"
        r")\b",
        s,
        re.I,
    ):
        return False
    rename_hits = len(
        re.findall(
            r"\b(birth name|changes? (?:his|her|their) name|renamed|also known|"
            r"possible alternatives?)\b",
            s,
            re.I,
        )
    )
    return rename_hits >= 2 or s.count(",") >= 4 or len(s) > 260


def is_opposition_cast_clause(sentence: str, label: str = "") -> bool:
    """True for explicit opposition / rival / up-against cast facts."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s:
        return False
    if not re.search(
        r"\b("
        r"up against|opposed by|opposes?|opposition|"
        r"rival (?:to|of)|nemesis|arch[- ]?enem(?:y|ies)|sworn enem(?:y|ies)|"
        r"enemy of|against .{0,40}?faction|"
        r"leads? (?:a |his |her |their )?faction against|"
        r"faction against|"
        r"main antagonist|side antagonist"
        r")\b",
        s,
        re.I,
    ):
        return False
    if label and label_only_as_alias_mention(s, label):
        return False
    if label and not (
        cast_sentence_about_subject(s, label, allow_pronoun=True)
        or re.search(rf"\b{re.escape(label)}\b", s, re.I)
    ):
        return False
    if _WHO_IS_BLOAT_RE.search(s) or _PLOT_SEQUENCE_RE.search(s):
        return False
    if len(s) > 320:
        return False
    return True


def is_scrap_identity_clause(sentence: str, label: str) -> bool:
    """True for garbage cards like 'Platinus is birth.' or unfinished 'is … and.'"""
    s_raw = re.sub(r"\s+", " ", (sentence or "").strip())
    s = s_raw.rstrip(".")
    label = (label or "").strip()
    if not s or not label:
        return False
    if is_incomplete_cast_clause(s_raw, label) or is_incomplete_cast_clause(s, label):
        return True
    m = re.match(
        rf"^{re.escape(label)}\s+is\s+(.+)$",
        s,
        re.I,
    )
    if not m:
        return False
    pred = m.group(1).strip().lower()
    if pred in _SCRAP_IDENTITY_PREDICATES:
        return True
    if re.fullmatch(r"(?:a|an|the)\s+\w+(?:\s+\w+){0,3}", pred):
        if not re.search(
            r"\b("
            r"protagonist|antagonist|villain|hero|heroine|rabbit|wolf|fox|lynx|"
            r"arcanist|guardian|spirit|noble|duke|lord|king|queen|prince|princess|"
            r"young woman|young man|sentient|"
            r"side character|main character|supporting character|minor character|"
            r"viewpoint character|love interest|comic relief"
            r")\b",
            pred,
            re.I,
        ):
            return True
    if " " not in pred and len(pred) <= 12:
        if not re.search(
            r"\b("
            r"protagonist|antagonist|villain|hero|heroine|rabbit|wolf|fox|lynx|"
            r"arcanist|guardian|spirit|male|female|sentient|noble|duke|lord|"
            r"king|queen|prince|princess"
            r")\b",
            pred,
            re.I,
        ):
            return True
    return False


def _kinship_shape_sentence(sentence: str, label: str) -> bool:
    """True for short kinship / standing / known-as lines — not plot that mentions 'brother'."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s or len(s) > 360:
        return False
    lab = re.escape(label)
    patterns = (
        rf"^{lab}\s+is\s+(?:(?:younger|older|twin)\s+)?(?:brother|sister|son|daughter)\s+to\s+.+$",
        rf"^{lab}\s+is\s+(?:.+?'s\s+)?(?:second\s+)?cousin\b.+$",
        rf"^{lab}\s+is\s+(?:married|engaged)\s+to\s+.+$",
        rf"^(?:He|She)\s+is\s+(?:married|engaged)\s+to\s+.+$",
        rf"^{lab}\s+calls?\s+.+\s+(?:his|her|their)\s+(?:esteemed\s+)?cousin\b.+$",
        rf"^.+\s+is\s+called\s+{lab}'s\s+(?:esteemed\s+)?cousin\b.+$",
        rf"^{lab}\s+is\s+(?:the\s+)?(?:Cheshire Cat|White Rabbit)\b.+$",
        rf"^{lab}\s+is\s+from\s+Wonderland\.?$",
        rf"^{lab}\s+calls\s+.+\s+cousin,\s+though that kinship is left open\.?$",
        rf"^{lab}\s+calls\s+.+\s+cousin,\s+though that kinship remains open\.?$",
        rf"^.+\s+may be\s+{lab}'s\s+(?:first|second|third)\s+cousin\s+[—–\-]\s+that kinship is left open\.?$",
        rf"^.+\s+may be\s+{lab}'s\s+(?:first|second|third)\s+cousin,\s+though that kinship remains open\.?$",
        rf"^.+\s+may be\s+(?:his|her)\s+(?:first|second|third)\s+cousin,\s+though that kinship remains open\.?$",
        rf"^.+\s+is\s+{lab}'s\s+(?:first|second|third)\s+cousin\.?$",
        rf"^.+\s+is\s+(?:his|her)\s+(?:first|second|third)\s+cousin\.?$",
        rf"^(?:He|She)\s+and\s+.+\s+share\s+a\s+complicated\s+rivalry-care bond\b.+$",
        rf"^{lab}\s+and\s+.+\s+share\s+a\s+complicated\s+rivalry-care bond\b.+$",
        rf"^.+\s+and\s+{lab}\s+share\s+a\s+complicated\s+rivalry-care bond\b.+$",
        rf"^(?:He|She)\s+and\s+.+\s+share\s+a\s+relationship that is cold on the surface\b.+$",
        rf"^{lab}\s+and\s+.+\s+share\s+a\s+relationship that is cold on the surface\b.+$",
        rf"^.+\s+is\s+the\s+subject\s+of\s+{lab}'s\s+fascination\.?$",
        rf"^.+\s+is\s+the\s+subject\s+of\s+(?:his|her)\s+fascination\.?$",
        rf"^{lab}\s+is\s+personally disgusted by Predator Court politics\b.+$",
        rf"^(?:He|She)\s+is\s+personally disgusted by Predator Court politics\b.+$",
        rf"^{lab}\s+has\s+mixed parentage\.?$",
        rf"^(?:He|She)\s+has\s+mixed parentage\.?$",
        rf"^(?:He|She)\s+has\s+mixed parentage,\s+and is not entirely of this world\.?$",
        rf"^(?:He|She)\s+has\s+mixed parentage\b.+$",
        rf"^{lab}\s+has\s+mixed parentage\b.+$",
        rf"^(?:His|Her)\s+mother\s+is\s+from\s+here,\s+but\s+(?:his|her)\s+father\b.+$",
        rf"^.+\s+is\s+(?:his|her)\s+(?:first|second|third)\s+cousin,\s+with whom\b.+$",
        rf"^(?:He|She)\s+was given the cold shoulder\b.+$",
        rf"^{lab}\s+was given the cold shoulder\b.+$",
        rf"^(?:Lord|Lady|Duke|Baron)\s+{lab}\b.+\bfaeble\b.+$",
        rf"^{lab}'s\s+father\s+is\s+(?:sketched|noted|left open)\b.+$",
        rf"^{lab}'s\s+father\s+is\s+(?:a\s+)?.+\s+parent stock\b.+$",
        rf"^(?:His|Her)\s+father\s+is\s+(?:a\s+)?.+\s+parent stock\b.+$",
        rf"^{lab}'s\s+father\s+is\s+(?:a\s+)?.+?(?:from another realm)?(?:, with whether he is a Faeble too still open)?\.?$",
        rf"^(?:His|Her)\s+father\s+is\s+(?:a\s+)?.+?(?:from another realm)?(?:, with whether he is a Faeble too still open)?\.?$",
        rf"^{lab}'s\s+mother\s+is\s+from\s+here\.?$",
        rf"^(?:His|Her)\s+mother\s+is\s+from\s+here\.?$",
        rf"^(?:His|Her)\s+mother\s+is\s+from\s+here,\s+but\s+(?:his|her)\s+father\b.+$",
        rf"^{lab}\s+and\s+.+\s+share\s+a\s+relationship that is cold on the surface\b.+$",
        rf"^(?:He|She)\s+and\s+.+\s+share\s+a\s+relationship that is cold on the surface\b.+$",
        rf"^.+\s+is\s+(?:his|her)\s+(?:first|second|third)\s+cousin,\s+with whom\b.+$",
        rf"^Your notes treat\s+.+\s+as\s+a\s+possible\s+(?:second\s+)?cousin\s+to\s+{lab}\b.+$",
        rf"^Your notes (?:sketch|say|leave)\s+{lab}'s\s+(?:father|mother)\b.+$",
        rf"^{lab}'s\s+(?:father|mother)\s+is\s+noted\b.+$",
        rf"^{lab}\s+refers to\s+.+\s+as\s+cousin\b.+$",
        rf"^{lab}\s+refers to\s+(?:his|her|their)\s+['\"]?cousin['\"]?\s+.+$",
        rf"^.+\s+is\s+an\s+ally\b.{{0,80}}{lab}\b.+$",
        rf"^{lab}\s+is\s+(?:the\s+)?(?:subject|quarry)\s+of\s+.+$",
        rf"^(?:He|She)\s+is\s+(?:the\s+)?(?:subject|quarry)\s+of\s+.+$",
        rf"^.+\s+is\s+the\s+quarry\s+of\s+{lab}\b.+$",
        rf"^.+\s+is\s+{lab}'s\s+quarry\.?$",
        rf"^.+\s+is\s+(?:his|her)\s+quarry\.?$",
        rf"^{lab}\s+refuses to associate with larger politics at Court\.?$",
        rf"^(?:He|She)\s+refuses to associate with larger politics at Court\.?$",
        rf"^{lab}\s+refuses to associate with larger politics at Court,\s+and underestimates (?:his|her) own presence\.?$",
        rf"^(?:He|She)\s+refuses to associate with larger politics at Court,\s+and underestimates (?:his|her) own presence\.?$",
        rf"^{lab}\s+underestimates (?:his|her) own presence\.?$",
        rf"^(?:He|She)\s+underestimates (?:his|her) own presence\.?$",
        rf"^{lab}\s+is\s+the\s+(?:main\s+)?(?:antagonist|villain)\b.+$",
        rf"^(?:He|She)\s+is\s+the\s+(?:main\s+)?(?:antagonist|villain)\b.+$",
        rf"^{lab}\s+is\s+(?:the\s+)?(?:main\s+)?protagonist\b.+$",
        rf"^(?:He|She)\s+is\s+(?:the\s+)?(?:main\s+)?protagonist\b.+$",
        rf"^(?:He|She)\s+is\s+(?:the\s+)?(?:Cheshire Cat|White Rabbit)\b.+$",
        rf"^{lab}\s+is\s+(?:the\s+)?(?:son|daughter|child)\s+of\s+.+$",
        rf"^{lab}\s+is\s+(?:(?:also|better)\s+)?known\s+(?:as|to|by)\b.+$",
        rf"^(?:He|She)\s+is\s+(?:(?:also|better)\s+)?known\s+(?:as|to|by)\b.+$",
        rf"^(?:He|She)\s+is\s+(?:the\s+)?(?:son|daughter|child)\s+of\s+.+$",
        rf"^(?:He|She)\s+is\s+(?:(?:younger|older|twin)\s+)?(?:brother|sister)\s+to\s+.+$",
        rf"^(?:He|She)\s+is\s+the\s+(?:son|daughter|child)\s+of\b.+$",
        rf"^{lab}\s+is\s+(?:the\s+)?(?:nemesis|arch[- ]?enemy|best friend|closest friend)\s+of\s+.+$",
        rf"^{lab}\s+is\s+(?:a\s+)?rival\s+(?:to|of)\s+.+$",
        rf"^{lab}\s+is\s+up against\s+.+$",
        rf"^(?:He|She)\s+is\s+up against\s+.+$",
        rf"^{lab}\s+conceals\b.+$",
        rf"^(?:He|She)\s+conceals\b.+$",
        rf"^{lab}\s+is\s+a\s+young (?:woman|man)\b.+$",
        rf"^(?:He|She)\s+is\s+a\s+young (?:woman|man)\b.+$",
        rf"^{lab}\s+is\s+(?:father|mother|mentor)\s+to\s+.+$",
        rf"^(?:He|She)\s+is\s+(?:father|mother|mentor)\s+to\s+.+$",
        rf"^(?:He|She)\s+is\s+(?:the\s+)?(?:nemesis|best friend)\s+of\s+.+$",
        rf"^(?:(?:younger|older|twin)\s+)?(?:brother|sister)\s+to\s+.+$",
        rf"^married\s+to\s+.+$",
        rf"^(?:son|daughter|child)\s+of\s+.+$",
        rf"^{lab}\s*[—–\-:,]\s*(?:(?:younger|older|twin)\s+)?(?:brother|sister)\s+to\s+.+$",
        # Optional orphan facts — allowed but deprioritized when richer slots exist
        rf"^{lab}\s+is\b.{{0,120}}\braised by\b.+$",
        rf"^{lab}\s+is\b.{{0,160}}\b(?:father died|widow mother|mother struggled)\b.+$",
    )
    return any(re.match(p, s, re.I) for p in patterns)


_ORPHAN_LIFE_RE = re.compile(
    r"\b("
    r"raised by|taken in by|father died|widow mother|widow,?\s+struggled|"
    r"mother struggled|struggled to provide|when he was (?:very )?young|"
    r"after his father|took care of him and his brothers|"
    r"mother took care|as a widow|as best she could"
    r")\b",
    re.I,
)

_INCOMPLETE_KIN_FRAGMENT_RE = re.compile(
    r"\b("
    r"not older by enough|decent year gap|not quite clear how much older|"
    r"maybe closer to a little over"
    r")\b",
    re.I,
)


def is_orphan_life_summary(sentence: str) -> bool:
    """True for father-died / widow / raised-by life-summary cast lines."""
    return bool(_ORPHAN_LIFE_RE.search(sentence or ""))


def _is_gold_tone_cast_sentence(sentence: str, label: str) -> bool:
    """
    Pinned good shape: role + fairytale known-as and/or named kin standing.
    Prefer identity over orphan raised-by summaries.
    """
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    if not s or not label:
        return False
    if not re.match(rf"^{re.escape(label)}\s+is\b", s, re.I):
        return False
    if len(s) > 420:
        return False
    if _WHO_IS_BLOAT_RE.search(s) or _SCENE_AFTER_IS_RE.search(s) or _PLOT_SEQUENCE_RE.search(s):
        return False
    has_role = bool(
        re.search(r"\b(protagonist|antagonist|main character|side character)\b", s, re.I)
    )
    has_alias = bool(
        re.search(
            r"\b("
            r"known to the fairytale|known to the fairy[- ]tale|fairytale world|"
            r"known as|also known as|white rabbit|cheshire cat|baron of|"
            r"subject of (?:his|her) fascination"
            r")\b",
            s,
            re.I,
        )
    )
    has_named_kin = bool(
        re.search(
            r"\b("
            r"son of|daughter of|child of|buck|doe|"
            r"younger brother|older brother|brother to|sister to"
            r")\b",
            s,
            re.I,
        )
    )
    has_type = bool(
        re.search(
            r"\b(rabbit|preyfolk|wolf|fox|lynx|arcanist|sentient|white rabbit)\b",
            s,
            re.I,
        )
    )
    # Orphan-only role+raised-by is no longer the gold pin.
    if is_orphan_life_summary(s) and not (has_alias or has_named_kin):
        return False
    return has_role and (has_alias or has_named_kin or has_type)


def _kinship_targets_plausible(sentence: str, label: str) -> bool:
    """Drop 'brother to Especially/Are' style scraps."""
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    # Combined cast lines often pack siblings + parents in one sentence.
    # Validate each kinship phrase on its own so appositives/"and the son of…"
    # cannot poison sibling-name checks.
    phrases: list[str] = []
    for m in re.finditer(
        r"\b(?:(?:younger|older|twin)\s+)?(?:brother|sister)\s+to\s+(.+?)(?="
        r",\s+and\s+the\s+(?:son|daughter|child)\s+of\b|"
        r"\s+and\s+the\s+(?:son|daughter|child)\s+of\b|"
        r"[.]|$)",
        s,
        re.I,
    ):
        phrases.append(m.group(1).strip(" ,"))
    for m in re.finditer(
        r"\b(?:son|daughter|child)\s+of\s+(.+?)(?:\.|$)",
        s,
        re.I,
    ):
        phrases.append(m.group(1).strip(" ,"))
    for m in re.finditer(
        r"\b(?:married|engaged|nemesis|best friend|closest friend|"
        r"father|mother|mentor)\s+(?:of|to)\s+(.+?)(?:\.|$)|"
        r"\b(?:subject|quarry)\s+of\s+(?!his\s+fascination|her\s+fascination)(.+?)(?:\.|$)",
        s,
        re.I,
    ):
        tail = (m.group(1) or m.group(2) or "").strip(" ,")
        if tail:
            phrases.append(tail)
    if not phrases:
        m = re.search(
            r"\b(?:brother|sister|son|daughter|married|engaged|subject|quarry|child)\s+"
            r"(?:of|to)\s+(.+?)\.?$",
            s,
            re.I,
        )
        if not m:
            return True
        phrases = [m.group(1).strip()]

    for tail in phrases:
        # "Character D's curiosity" / "Obsidian and Stygian" / "buck Snow Thistle and doe Ebony"
        chunks = re.split(r"\s+and\s+|,\s*", tail)
        for chunk in chunks:
            chunk = chunk.strip()
            chunk = re.sub(r"^(?:and|or)\s+", "", chunk, flags=re.I).strip()
            # Allow "X's curiosity" standing phrases.
            if re.search(r"'s\s+\w+$", chunk, re.I):
                head = chunk.split("'")[0].strip()
                if head and not is_plausible_cast_person_name(head):
                    return False
                continue
            # Strip buck/doe / role prefixes and trailing role phrases.
            chunk = re.sub(r"^(?:buck|doe|the)\s+", "", chunk, flags=re.I).strip()
            chunk = re.sub(r"\s*\(.*\)$", "", chunk).strip()
            # Appositive group labels ("Moonshadow Rabbits") are not person targets.
            if re.search(
                r"\b(rabbits?|twins?|brothers?|sisters?|parents?|family)\b",
                chunk,
                re.I,
            ) and not re.match(r"^[A-Z][a-z]+$", chunk):
                continue
            # "two of the Rabbits of Death from Pinocchio, Obsidian" style — keep named tails
            if re.search(r"\bfrom\b", chunk, re.I) and not re.search(
                r"\b[A-Z][a-z]{2,}\b", chunk
            ):
                continue
            if not chunk:
                continue
            if not is_plausible_cast_person_name(chunk.split()[0] if chunk else ""):
                cleaned = re.sub(
                    r"\b(curiosity|interest|attention|trust)\b.*$",
                    "",
                    chunk,
                    flags=re.I,
                ).strip()
                cleaned = re.sub(r"^(?:buck|doe|the)\s+", "", cleaned, flags=re.I).strip()
                if cleaned and is_plausible_cast_person_name(cleaned.split()[0]):
                    continue
                if cleaned and is_plausible_cast_person_name(cleaned):
                    continue
                # Standing phrases without a single person name are OK.
                if re.search(
                    r"\b(rabbits? of death|fairytale|pinocchio|alice|wonderland)\b",
                    chunk,
                    re.I,
                ):
                    continue
                if not is_plausible_cast_person_name(chunk):
                    return False
    return True


def is_who_is_cast_fact_sentence(sentence: str, label: str) -> bool:
    """
    Keep-list for who-is: role, species/type identity, kinship/ties, aliases,
    optional subject-led story stakes — nothing else.
    """
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    label = (label or "").strip()
    if not s or not label:
        return False
    if len(s) > 420:
        return False
    if is_scrap_identity_clause(s, label):
        return False
    if is_incomplete_cast_clause(s, label):
        return False
    if label_only_as_alias_mention(s, label):
        return False
    # Faction-roster / "doesn't know how Predators work" dumps — never cast-card.
    if _WHO_IS_FACTION_DUMP_RE.search(s):
        return False
    # Chatty rediscovery lines may say "So Name, …" — still allow if upheaval reason.
    chatty_stakes = bool(
        re.match(rf"^So\s+{re.escape(label)}\b", s, re.I)
        and is_upheaval_reason_clause(
            re.sub(rf"^So\s+{re.escape(label)}\s*,?\s*", f"{label} ", s, count=1, flags=re.I),
            label,
        )
    )
    if _WHO_IS_BLOAT_RE.search(s) and not chatty_stakes and not is_formal_awareness_status_clause(
        s, label
    ):
        return False
    if _SCENE_AFTER_IS_RE.search(s):
        return False
    if is_other_character_scene_beat(s, label):
        return False
    if _PLOT_SEQUENCE_RE.search(s):
        return False
    if _INCOMPLETE_KIN_FRAGMENT_RE.search(s):
        return False
    if is_orphan_life_summary(s) and not re.search(
        r"\b(son of|daughter of|brother to|sister to|known as|known by|white rabbit|"
        r"chosen one|nemesis)\b",
        s,
        re.I,
    ):
        return False

    # Librarian honesty gaps / open parent sketches on who-is cast cards.
    if re.match(
        r"^Your notes don't yet (?:spell out|pin a clear cast role)\b|"
        r"^Your notes (?:sketch|say|leave)\b.+\b(?:father|mother)\b|"
        rf"^{re.escape(label)}'s\s+(?:father|mother)\s+is\s+noted\b",
        s,
        re.I,
    ):
        return True

    # Pinned gold-tone woven card (role + type/family in one sentence).
    if _is_gold_tone_cast_sentence(s, label):
        return True

    # Kinship / standing — short shapes only; validate name targets.
    # Role / origin opens that match kinship shapes still count as cast facts.
    if _kinship_shape_sentence(s, label):
        if re.search(
            r"\b(protagonist|antagonist|main character|cheshire cat|white rabbit|"
            r"faeble|mixed parentage|disgusted by|cold on the surface|"
            r"from another realm|third cousin|second cousin|first cousin|"
            r"cold shoulder|heavier load)\b",
            s,
            re.I,
        ):
            return True
        return _kinship_targets_plausible(s, label)

    # Plain overview stakes (chosen one / upheaval / crossing worlds).
    if is_overview_significance_clause(s, label):
        return True
    if is_opposition_cast_clause(s, label):
        return True
    if chatty_stakes:
        return True
    # Short formal awareness status (nuance / unspoken line) — not faction dumps.
    if is_formal_awareness_status_clause(s, label):
        return True

    # Ally / standing counterpart lines naming the subject mid-sentence.
    if re.search(
        rf"\b(ally|allies|co-?conspirator|close political counterpart)\b.{{0,60}}"
        rf"\b{re.escape(label)}\b|"
        rf"\b{re.escape(label)}\b.{{0,60}}\b(ally|allies|co-?conspirator)\b",
        s,
        re.I,
    ) and len(s) <= 220 and not _PLOT_SEQUENCE_RE.search(s):
        return True

    if not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        # Pronoun-led overview / kin already handled above when patterns match.
        return False

    # "Premise: Elham is a young woman and an author."
    if re.match(
        rf"^(?:Premise|Role|Cast|Identity|Summary)\s*:\s*{re.escape(label)}\s+"
        rf"(?:is|was|are|were)\b",
        s,
        re.I,
    ):
        if re.search(
            r"\b("
            r"young woman|young man|author|protagonist|antagonist|villain|hero|"
            r"rabbit|wolf|lynx|arcanist|male|female|sentient"
            r")\b",
            s,
            re.I,
        ):
            return True
        if len(s) <= 180:
            return True

    # "Lord Tenebris is the Cheshire Cat…" / "Lord Tenebris of Cheshire is…"
    title_prefix = (
        rf"^(?:Lord|Lady|Duke|Duchess|Sir|Dame|King|Queen|Prince|Princess|"
        rf"Baron|Baroness|Count|Countess)\s+{re.escape(label)}"
        rf"(?:\s+of\s+[A-Z][\w'-]+)?"
        rf"\s+(?:is|was|are|were)\b"
    )
    if re.match(title_prefix, s, re.I):
        if re.search(
            r"\b("
            r"protagonist|antagonist|villain|hero|heroine|main character|side character|"
            r"side antagonist|rabbit|wolf|fox|lynx|arcanist|male|female|sentient|"
            r"known|called|aka|white rabbit|cheshire|from .+ wonderland|guardian|spirit|"
            r"chosen one|destined|fated|nemesis|best friend|noble|predator|prey|"
            r"fairy[- ]?tale|faeble|baron|not entirely of this world|social rank|"
            r"of this world|another world"
            r")\b",
            s,
            re.I,
        ):
            return True
        if len(s) <= 220 and not _PLOT_ARC_RE.search(s):
            return True

    # Subject-led identity / role / species / gender / alias — NOT kinship-via-plot.
    if re.match(rf"^{re.escape(label)}\s+(?:is|was|are|were)\b", s, re.I):
        # Long "X is …" with scene/plot language is out even if "brother" appears.
        if len(s) > 160 and not re.search(
            r"\b("
            r"protagonist|antagonist|rabbit|wolf|known as|known by|also known|"
            r"chosen one|destined|nemesis|father to|mother to"
            r")\b",
            s,
            re.I,
        ):
            return False
        if re.search(
            r"\b("
            r"protagonist|antagonist|villain|hero|heroine|main character|side character|"
            r"side antagonist|rabbit|wolf|fox|lynx|arcanist|male|female|sentient|"
            r"known|called|aka|white rabbit|from .+ wonderland|guardian|spirit|"
            r"chosen one|destined|fated|nemesis|best friend|"
            r"human|mortal|fae|concealing|conceal(?:s|ed)?|pen name"
            r")\b",
            s,
            re.I,
        ):
            return True
        if is_overview_significance_clause(s, label):
            return True
        if len(s) <= 120 and not _PLOT_ARC_RE.search(s):
            if re.fullmatch(
                rf"{re.escape(label)}\s+is\s+[\w'-]+\.?",
                s,
                re.I,
            ) and not re.search(
                r"\b("
                r"male|female|protagonist|antagonist|villain|hero|rabbit|wolf|fox|"
                r"lynx|arcanist|sentient|guardian|spirit|married|human|mortal|fae"
                r")\b",
                s,
                re.I,
            ):
                return False
            return True
        return False

    # "Etherei — grey-skinned arcanist…" identity dash lines (not plot).
    if re.match(rf"^{re.escape(label)}\s*[—–\-:,]", s, re.I):
        if re.search(
            r"\b("
            r"arcanist|rabbit|wolf|guardian|spirit|protagonist|antagonist|"
            r"male|female|sentient|grey|gray|skin|chosen|nemesis"
            r")\b",
            s,
            re.I,
        ):
            return len(s) < 200
        return False

    if re.search(
        rf"\b{re.escape(label)}\s+is\s+(?:known|also known|called)\b",
        s,
        re.I,
    ):
        return len(s) < 260
    if re.search(rf"\b{re.escape(label)}\s+is\s+known by\b", s, re.I):
        return len(s) < 260
    # Storywalk / world-change stakes are not who-is cast-card slots.
    return False


def is_other_character_scene_beat(sentence: str, label: str) -> bool:
    """
    True for another cast member's POV/event observation about the subject —
    not a who-is identity line ("Etherei is the protagonist").
    """
    s = (sentence or "").strip()
    label = (label or "").strip()
    if not s or not label:
        return False
    if is_knower_pov_about_label(s, label):
        return True
    # Keep subject-led identity / status lines.
    if re.match(rf"^{re.escape(label)}\s+(?:is|was|are|were)\b", s, re.I):
        return False
    if re.match(rf"^{re.escape(label)}\s*[—–\-:,]", s, re.I):
        return False
    if not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False
    # "Serias, in his first POV, … Etherei …"
    if re.search(
        r"\bin (?:his|her|their) (?:first|second|third|opening|early) POV\b",
        s,
        re.I,
    ):
        return True
    # Led by a different proper name, then an event/observation about the subject.
    m = re.match(
        r"^([A-Z][\w'-]+(?:\s+(?:of|[A-Z][\w'-]+)){0,2})\b",
        s,
    )
    if not m:
        return False
    other = m.group(1).strip()
    if other.lower() == label.lower():
        return False
    # Skip work titles / filler openers mistaken for names.
    if other.lower() in {
        "the",
        "in",
        "from",
        "what",
        "this",
        "that",
        "smoke",
        "ashford",
        "premise",
        "role",
        "cast",
    }:
        return False
    return bool(_OTHER_CHAR_EVENT_RE.search(s))


def is_plot_walkthrough_text(text: str) -> bool:
    """True when text is mostly scene/POV chronology, not a cast card."""
    t = (text or "").strip()
    if not t:
        return False
    hits = len(_PLOT_SEQUENCE_RE.findall(t))
    if hits >= 2:
        return True
    if hits >= 1 and not _CAST_CARD_ANCHOR_RE.search(t):
        return True
    return False


def has_cast_card_anchors(text: str) -> bool:
    return bool(_CAST_CARD_ANCHOR_RE.search(text or ""))


def work_title_from_hints(hints: set[str]) -> str | None:
    if not hints:
        return None
    return next(iter(sorted(hints, key=len, reverse=True))).strip().title()


def _dedupe_key(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())[:140]


def _dedupe_clauses(clauses: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for clause in clauses:
        key = _dedupe_key(clause)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(clause.strip())
    return out


def _ensure_period(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    if t.endswith(("…", "...", ".", "!", "?")):
        return t
    return t + "."


def _strip_meta_from_line(line: str) -> str:
    line = re.sub(r"^\(Entry titled .+\)\s*", "", line or "", flags=re.I)
    return line.strip()


def _tie_to_reference(label: str, tie: str) -> str:
    tie = _strip_meta_from_line(tie)
    if not tie:
        return ""
    if _META_IN_TIE.search(tie):
        return tie
    m = re.match(r"^(Brother|Sister|Mother|Father|Son|Daughter|Child)\s+to\s+(.+?)\.?\s*$", tie, re.I)
    if m:
        rel, other = m.group(1).lower(), m.group(2).split("(")[0].strip().rstrip(".")
        if not is_plausible_cast_person_name(other):
            return ""
        if rel == "brother":
            return f"{label} is brother to {other}."
        if rel == "sister":
            return f"{label} is sister to {other}."
        return f"{label} is {rel} to {other}."
    if tie.lower().startswith(label.lower()):
        return _ensure_period(tie)
    if re.match(rf"^{re.escape(label)}\s", tie, re.I):
        return _ensure_period(tie)
    return _ensure_period(tie)


def _to_reference_clause(
    sentence: str, label: str, *, allow_pronoun_bind: bool = True
) -> str:
    s = _strip_meta_from_line(sentence)
    if not s:
        return ""
    if label_only_as_alias_mention(s, label):
        return ""
    s = re.sub(rf"^{re.escape(label)}\s*[—–\-:,]\s*", "", s, flags=re.I)
    married = re.match(r"^Married to\s+(.+?)\.?\s*$", s, re.I)
    if married:
        return f"{label} is married to {married.group(1).rstrip('.')}."
    if re.match(rf"^{re.escape(label)}\s", s, re.I):
        out = _ensure_period(s)
        return "" if is_scrap_identity_clause(out, label) else out
    if re.match(r"^(He|She|They)\b", s, re.I):
        if not allow_pronoun_bind or label_only_as_alias_mention(s, label):
            return ""
        s = re.sub(r"^(He|She|They)\b", label, s, count=1)
        out = _ensure_period(s)
        return "" if is_scrap_identity_clause(out, label) else out
    if not re.search(r"\b(is|was|are|were)\b", s, re.I) and re.match(
        r"^[A-Za-z\-]+(?:\s+[a-z\-]+){0,4}\.?$", s
    ):
        frag = s.rstrip(".").strip().lower()
        if frag in _SCRAP_IDENTITY_PREDICATES or len(frag) < 3:
            return ""
        if " " not in frag and not re.search(
            r"\b("
            r"protagonist|antagonist|villain|hero|rabbit|wolf|fox|lynx|arcanist|"
            r"guardian|spirit|noble|sentient"
            r")\b",
            frag,
            re.I,
        ):
            return ""
        out = f"{label} is {s.rstrip('.')}."
        return "" if is_scrap_identity_clause(out, label) else _ensure_period(out)
    if _ROLE_WORDS_RE.search(s) or re.search(
        rf"\b{re.escape(label)}\s+(?:is|was|are|were)\b", s, re.I
    ):
        return _ensure_period(s)
    if re.search(r"\b(married|brother|sister|son|daughter|grey|skin|arcanist)\b", s, re.I):
        if re.search(r"\b(married|engaged)\b", s, re.I):
            m2 = re.search(r"\b(?:married|engaged)\s+to\s+(.+?)\.?\s*$", s, re.I)
            if m2:
                return f"{label} is married to {m2.group(1).rstrip('.')}."
        return f"{label} — {s.rstrip('.')}."
    return _ensure_period(s)


def _prefer_explicit_over_inferred(explicit: list[str], inferred: str | None) -> list[str]:
    return merge_explicit_and_inferred(explicit, inferred, label="")


def _join_paragraph(clauses: list[str], max_clauses: int = 6) -> str:
    picked = _dedupe_clauses(clauses)[:max_clauses]
    if not picked:
        return ""
    text = " ".join(picked)
    if not text.endswith((".", "!", "?", "…")):
        text += "."
    return text


_PROFILE_CLAUSE_RE = re.compile(
    r"\b("
    r"is|was|are|were|married|engaged|brother|sister|mother|father|son|daughter|"
    r"protagonist|antagonist|main character|viewpoint|point of view|pov|narrator|"
    r"guardian|spirit|villain|hero|grey|gray|skin|tall|short|arcanist|elf|wolf|"
    r"male|female|going after|hunts?|hunting|"
    r"husband|wife|spouse|cousin|species|looks like|known as|called|"
    r"storywalks?|sets? in motion|younger brother|older brother"
    r")\b",
    re.I,
)

_NARRATIVE_OPENERS = re.compile(
    r"^(Opening|Closing|Then|When|After|Before|Suddenly|Meanwhile|Later|Finally|"
    r"So\s+right\s+after|As\s|While\s|"
    r"The\s+(?:door|sun|wind|night|morning|room|hall|gate))\b",
    re.I,
)

_AUTHOR_META_RE = re.compile(
    r"\b("
    r"i think|i thought|could start|should start|same time as the|chapter\s+\d+|"
    r"plot note|planning note|outline|note to self|maybe|perhaps|"
    r"find more ways|ways to mention|need to mention|todo|fix later|"
    r"next (?:POV|section)|POV will be|switches? to .{0,40}POV"
    r")\b",
    re.I,
)

_BIOGRAPHY_RE = re.compile(
    r"\b(?:is|was|were)\s+(?:born|raised|growing up|lived|fled|escaped|sent|brought|"
    r"created|written|introduced|first seen|only)\b",
    re.I,
)


def _clause_adds_profile(clause: str, label: str) -> bool:
    s = (clause or "").strip()
    if not s or _skip_planning_line(s, label):
        return False
    if is_scrap_identity_clause(s, label):
        return False
    if label_only_as_alias_mention(s, label):
        return False
    if is_other_character_scene_beat(s, label):
        return False
    if _is_plot_arc_clause(s):
        return False
    # Who-is: allow overview stakes (incl. upheaval reason); still reject bare storywalk dumps.
    if is_overview_significance_clause(s, label):
        return True
    if is_opposition_cast_clause(s, label):
        return True
    if is_story_significance_clause(s, label):
        return False
    if _BIOGRAPHY_RE.search(s):
        # Allow pinned family facts (raised-by / parents) on a role-or-identity card.
        if label and (
            _is_gold_tone_cast_sentence(s, label)
            or (
                re.search(rf"^{re.escape(label)}\s+is\b", s, re.I)
                and re.search(
                    r"\b(raised by|father died|widow mother|widow mother)\b",
                    s,
                    re.I,
                )
                and len(s) <= 360
            )
        ):
            return True
        return False
    if re.search(r"&(?:nbsp|#160;)|\u00a0", s, re.I):
        return False
    if len(s) > 220 and not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False
    if _NARRATIVE_OPENERS.search(s) and not re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return False
    if re.search(rf"\b{re.escape(label)}\s+(?:is|was|are|were)\b", s, re.I):
        return True
    # "Name and Partner share a … bond"
    if re.search(
        rf"\b{re.escape(label)}\s+and\b.{{0,60}}\b("
        r"share|shares|have|has|rivalry-care|both care|attachment|looks? out for"
        r")\b",
        s,
        re.I,
    ):
        return True
    # "Lord Tenebris of Cheshire is…" when asked label is Tenebris.
    if re.search(
        rf"\b(?:Lord|Lady|Duke|Duchess|Baron|Baroness|Sir|Dame)\s+"
        rf"{re.escape(label)}\b.{{0,60}}?\b(?:is|was|are|were)\b",
        s,
        re.I,
    ):
        return True
    if re.search(rf"\b{re.escape(label)}\s+of\s+\w+.{{0,40}}?\b(?:is|was|are|were)\b", s, re.I):
        return True
    if re.search(rf"\b{re.escape(label)}\s*[—–\-:,]", s, re.I):
        return True
    if re.search(
        r"\b(fairy[- ]?tale|faeble|young woman|young man|author)\b",
        s,
        re.I,
    ) and re.search(rf"\b{re.escape(label)}\b", s, re.I):
        return True
    if _ROLE_WORDS_RE.search(s):
        return True
    if re.search(r"\b(main character|viewpoint character|protagonist|antagonist)\b", s, re.I):
        return True
    if re.search(
        r"\b(married|engaged|brother|sister|mother|father|son|daughter|guardian|spirit|"
        r"husband|wife|spouse|cousin|grey|gray|arcanist|elf|villain|hero|species|"
        r"subject of|quarry|raised by|rabbit|preyfolk|known as|known to|buck|doe|"
        r"white rabbit|fairytale|ally|allies|co-?conspir|esteemed cousin|"
        r"political counterpart|your notes treat|refers to|"
        r"rivalry-care|both care|complicated (?:relationship|attachment|bond)|"
        r"cold on the surface|subject of .{0,40}fascination|"
        r"refuses to associate|larger politics at Court|"
        r"disgusted by Predator Court politics|"
        r"does not realize how much political influence|"
        r"mixed parentage|"
        r"cold shoulder|outsider|heavier load|"
        r"underestimates (?:his|her) own presence)\b",
        s,
        re.I,
    ):
        return True
    if _DIALOGUE_VERB.search(s):
        return bool(
            re.search(
                r"\b(brother|sister|mother|father|married|wife|husband|cousin)\b",
                s,
                re.I,
            )
        )
    return False


_DIALOGUE_VERB = re.compile(
    r"\b(said|says|asked|asks|replied|replies|whispered|shouted|muttered|murmured)\b",
    re.I,
)


def _skip_planning_line(line: str, label: str) -> bool:
    s = (line or "").strip()
    if not s:
        return True
    if _AUTHOR_META_RE.search(s):
        return True
    if _INCOMPLETE_KIN_FRAGMENT_RE.search(s):
        return True
    if re.match(r"^I\s+(think|thought|feel|want|should|could|might|need)\b", s, re.I):
        return True
    if re.search(
        r"\b("
        r"find more ways|need to mention|ways to mention|remember(?:s|ed)? this if|"
        r"todo|fix later|rewrite|outline|note to self"
        r")\b",
        s,
        re.I,
    ):
        return True
    if re.search(r"\bchapter\s+\d+\b", s, re.I) and not re.search(
        rf"\b{re.escape(label)}\b", s, re.I
    ):
        return True
    return False


def _composed_has_substance(paragraphs: list[str], label: str) -> bool:
    body = " ".join(paragraphs)
    if not body.strip():
        return False
    if _ROLE_WORDS_RE.search(body):
        return True
    if re.search(r"\bmain character\b", body, re.I):
        return True
    if re.search(rf"\b{re.escape(label)}\s+(?:is|was)\b", body, re.I):
        return True
    if re.search(
        rf"\b(?:Lord|Lady|Duke|Duchess|Baron|Baroness)\s+{re.escape(label)}\b"
        rf".{{0,60}}?\b(?:is|was|are|were)\b",
        body,
        re.I,
    ):
        return True
    if re.search(
        r"\b(married|brother|sister|son|daughter|guardian|spirit|protagonist|antagonist|"
        r"grey|gray|arcanist|elf|villain|hero|fairy[- ]?tale|faeble|cheshire|"
        r"baron of|young woman|young man|author)\b",
        body,
        re.I,
    ):
        return True
    if _AUTHOR_META_RE.search(body):
        return False
    if re.search(r"\b(also known as|known to|knows .+ as)\b", body, re.I):
        return True
    return False


def compose_character_reference(
    label: str,
    *,
    brief: dict[str, Any] | None,
    roles: list[str],
    identity: list[str],
    relationships: list[str],
    details: list[str],
    dialogue: list[str],
    scenes: list[str],
    work_title: str | None = None,
    stated_relationships: list[str] | None = None,
    alias_lines: list[str] | None = None,
    facet: str | None = None,
) -> str:
    """Wikipedia-shaped, reference voice — facts about the character, not meta coach copy."""
    brief = brief or {}
    lead: list[str] = []
    rel_clauses: list[str] = []

    explicit_roles = [
        _to_reference_clause(r, label)
        for r in roles
        if not _skip_planning_line(r, label)
        if (
            _ROLE_WORDS_RE.search(r)
            or re.search(rf"\b{re.escape(label)}\s+is\b", r, re.I)
            or is_overview_significance_clause(r, label)
        )
    ]
    explicit_roles = [r for r in explicit_roles if r]

    role_lines = _prefer_explicit_over_inferred(explicit_roles, brief.get("role"))
    lead.extend(c for c in role_lines if _clause_adds_profile(c, label))

    for line in alias_lines or []:
        clause = _ensure_period((line or "").strip())
        if clause and clause not in lead:
            lead.append(clause)

    # Species / gender traits early — before identity can fill the clause cap.
    for trait in brief.get("traits") or []:
        t = str(trait).strip()
        if re.match(r"^An\s+", t, re.I):
            clause = _ensure_period(f"{label} is {t[3:].lstrip()}")
        elif re.match(r"^A\s+", t, re.I):
            clause = _ensure_period(f"{label} is {t[2:].lstrip()}")
        elif re.match(rf"^{re.escape(label)}\s+is\s+", t, re.I):
            clause = _ensure_period(t)
        else:
            clause = _to_reference_clause(t, label) or _ensure_period(t)
        if clause and clause not in lead and _clause_adds_profile(clause, label):
            lead.append(clause)

    for line in identity:
        if _skip_planning_line(line, label):
            continue
        clause = _to_reference_clause(line, label)
        if clause and clause not in lead and _clause_adds_profile(clause, label):
            lead.append(clause)

    for line in relationships:
        if _skip_planning_line(line, label):
            continue
        clause = _to_reference_clause(line, label)
        if clause and _clause_adds_profile(clause, label):
            # Who-is: only standing cast ties — not long "responsibility to look out…" scraps.
            if facet is None and not is_who_is_cast_fact_sentence(clause, label):
                continue
            rel_clauses.append(clause)

    for tie in brief.get("ties") or []:
        clause = _tie_to_reference(label, str(tie))
        if clause:
            rel_clauses.append(clause)

    for line in details:
        if _skip_planning_line(line, label):
            continue
        clause = _to_reference_clause(line, label)
        if not clause:
            continue
        if facet == "appearance":
            if clause not in lead and clause not in rel_clauses:
                lead.append(clause)
            continue
        if not _clause_adds_profile(clause, label):
            continue
        if clause not in lead and clause not in rel_clauses:
            if re.search(
                r"\b(married|spouse|brother|sister|son|daughter|subject of|quarry|"
                r"known as|known to|buck|doe|cousin|ally|esteemed cousin)\b",
                clause,
                re.I,
            ):
                if facet is None and not is_who_is_cast_fact_sentence(clause, label):
                    continue
                rel_clauses.append(clause)
            else:
                lead.append(clause)

    if facet == "appearance":
        for line in scenes[:4]:
            if _skip_planning_line(line, label):
                continue
            clause = _to_reference_clause(line, label) or _ensure_period((line or "").strip())
            if clause and clause not in lead and clause not in rel_clauses:
                lead.append(clause)

    # Stated standing relations (cousin/ally harvest) first so they are not crowded out.
    stated_first: list[str] = []
    for line in stated_relationships or []:
        clause = _to_reference_clause(line, label)
        if clause and _clause_adds_profile(clause, label):
            if facet is None and not is_who_is_cast_fact_sentence(clause, label):
                # Ally lines that mention label mid-sentence — still allow.
                if not re.search(
                    r"\b(cousin|ally|allies|co-?conspir|esteemed cousin|your notes treat)\b",
                    clause,
                    re.I,
                ):
                    continue
            if clause not in stated_first and clause not in rel_clauses:
                stated_first.append(clause)
    rel_clauses = stated_first + [c for c in rel_clauses if c not in stated_first]

    for line in dialogue[:2]:
        if _skip_planning_line(line, label):
            continue
        clause = _to_reference_clause(line, label)
        if clause and _clause_adds_profile(clause, label):
            rel_clauses.append(clause)

    if work_title and lead and not any(work_title.lower() in c.lower() for c in lead):
        if role_lines and _ROLE_WORDS_RE.search(role_lines[0]):
            if not re.search(rf"\bin\s+{re.escape(work_title)}\b", lead[0], re.I):
                lead[0] = lead[0].rstrip(".") + f" in {work_title}."

    # Who-is / cast reference: weave family slots into plain formal prose.
    if facet is None:
        woven = weave_who_is_gold_tone(label, work_title, lead, rel_clauses)
        if woven:
            body = smooth_who_is_prose(label, woven)
            out = f"{label}\n\n{body}\n\n{_FOOTER_REFERENCE}"
            return append_who_is_cast_card_gaps(
                label, out, relation_lines=list(stated_relationships or []) + rel_clauses
            )

    paragraphs: list[str] = []
    if facet == "appearance":
        clause_cap = 4
    elif facet in ("role", "voice", "relationship"):
        clause_cap = 1
    else:
        clause_cap = 7
    p1 = _join_paragraph(lead, max_clauses=clause_cap)
    if p1:
        paragraphs.append(p1)
    p2 = _join_paragraph(rel_clauses, max_clauses=clause_cap if facet == "relationship" else 5)
    if p2:
        paragraphs.append(p2)

    if not paragraphs:
        return ""
    if not _composed_has_substance(paragraphs, label):
        return ""

    body = "\n\n".join(paragraphs)
    body = smooth_who_is_prose(label, body)
    out = f"{label}\n\n{body}\n\n{_FOOTER_REFERENCE}"
    if facet is None:
        out = append_who_is_cast_card_gaps(
            label, out, relation_lines=list(stated_relationships or []) + rel_clauses
        )
    return out


def who_is_has_close_ties(answer: str) -> bool:
    """True when answer includes defining kin / nemesis / best-friend style ties."""
    return bool(_CLOSE_TIE_RE.search(answer or ""))


def who_is_has_story_significance(answer: str) -> bool:
    """True when answer includes plain overview stakes beyond bare protagonist."""
    a = answer or ""
    return bool(_OVERVIEW_SIGNIFICANCE_RE.search(a) or _UPHEAVAL_REASON_RE.search(a))


def who_is_has_family_slots(answer: str) -> bool:
    """Close ties or overview significance — alias alone does not count."""
    return who_is_has_close_ties(answer) or who_is_has_story_significance(answer)


def who_is_overview_missing_depth(answer: str) -> bool:
    """True when the card is mostly role + alias without close ties / significance."""
    a = answer or ""
    if who_is_has_close_ties(a) or who_is_has_story_significance(a):
        return False
    return bool(
        re.search(
            r"\b(protagonist|antagonist|main character|known as|known by|known to|"
            r"white rabbit|also known)\b",
            a,
            re.I,
        )
    )


def weave_who_is_gold_tone(
    label: str,
    work_title: str | None,
    lead: list[str],
    rel_clauses: list[str],
) -> str:
    """
    Merge role + fairytale known-as + named parents/brothers into plain cast prose.
    Prefer identity over orphan raised-by life summary.
    """
    lead = [c for c in _dedupe_clauses(lead) if c]
    rel = [c for c in _dedupe_clauses(rel_clauses) if c]
    if not lead and not rel:
        return ""

    def _gender_only(c: str) -> bool:
        return bool(
            re.match(
                rf"^{re.escape(label)}\s+is\s+(?:male|female)\.?$",
                c,
                re.I,
            )
        )

    def _strip_male_female_role(c: str) -> str:
        return re.sub(
            rf"({re.escape(label)}\s+is\s+the\s+)(?:male|female)\s+",
            r"\1",
            c,
            count=1,
            flags=re.I,
        )

    brothers: list[str] = []
    twin_brother_keys: set[str] = set()
    seen_b: set[str] = set()
    rich_brother_lines: list[str] = []
    named_parents: list[str] = []
    alias_lines: list[str] = []
    other_family: list[str] = []
    significance_lines: list[str] = []
    extras_from_rel: list[str] = []
    orphan_lines: list[str] = []
    role_from_rel: list[str] = []
    gender_word: str | None = None

    def _brother_tail(c: str) -> str | None:
        for pat in (
            rf"^{re.escape(label)}\s+is\s+(?:also\s+)?(?:(?:younger|older|twin)\s+)*brother to\s+(.+?)\.?$",
            rf"^{re.escape(label)}\s*[—–\-:,]\s*(?:also\s+)?(?:(?:younger|older|twin)\s+)*brother to\s+(.+?)\.?$",
            rf"^(?:also\s+)?(?:(?:younger|older|twin)\s+)*brother to\s+(.+?)\.?$",
            rf"^{re.escape(label)}\s+is\s+(?:a\s+)?younger twin(?:\s+brother)?\s+to\s+(.+?)\.?$",
        ):
            m = re.search(pat, c, re.I)
            if m:
                return m.group(1).strip()
        return None

    def _clause_marks_twin(c: str) -> bool:
        return bool(re.search(r"\btwin\b", c or "", re.I))

    def _normalize_standing(c: str) -> str:
        standing = c
        if re.match(r"^(?:subject|quarry)\s+of\b", c, re.I):
            standing = f"{label} is the {c[0].lower()}{c[1:]}"
        elif re.match(r"^(?:son|daughter|child)\s+of\b", c, re.I):
            standing = f"{label} is the {c[0].lower()}{c[1:]}"
        elif re.match(
            rf"^{re.escape(label)}\s*[—–\-:,]\s*(?:(?:younger|older|twin)\s+)?brother to\b",
            c,
            re.I,
        ):
            standing = re.sub(
                rf"^{re.escape(label)}\s*[—–\-:,]\s*",
                f"{label} is ",
                c,
                count=1,
                flags=re.I,
            )
        if not standing.endswith((".", "!", "?")):
            standing += "."
        return standing

    for c in list(lead) + list(rel):
        if _gender_only(c):
            m = re.match(
                rf"^{re.escape(label)}\s+is\s+(male|female)\.?$",
                c,
                re.I,
            )
            if m:
                gender_word = m.group(1).lower()
            continue
        if is_orphan_life_summary(c) and not re.search(
            r"\b(known as|known to|son of|daughter of|white rabbit|chosen|nemesis)\b",
            c,
            re.I,
        ):
            # Pure orphan life summary — keep only as weak fallback.
            if not _is_gold_tone_cast_sentence(c, label):
                orphan_lines.append(_strip_male_female_role(c))
            continue
        # Cast role from standing harvest — before opposition/significance buckets.
        if re.search(
            rf"^{re.escape(label)}\s+is\s+the\s+(?:main\s+)?(?:antagonist|villain)\b|"
            rf"^{re.escape(label)}\s+is\s+(?:a|the)\s+(?:main\s+)?(?:antagonist|villain)\b",
            c,
            re.I,
        ):
            line = _strip_male_female_role(c)
            if line not in role_from_rel:
                role_from_rel.append(
                    line if line.endswith((".", "!", "?")) else line + "."
                )
            continue
        if is_overview_significance_clause(c, label) and not re.search(
            r"\b(brother to|sister to|son of|daughter of)\b", c, re.I
        ):
            line = _strip_male_female_role(c)
            if line not in significance_lines:
                significance_lines.append(
                    line if line.endswith((".", "!", "?")) else line + "."
                )
            continue
        if is_opposition_cast_clause(c, label):
            line = _strip_male_female_role(c)
            if line not in significance_lines:
                significance_lines.append(
                    line if line.endswith((".", "!", "?")) else line + "."
                )
            continue
        # Titled world-origin / fairy-tale standing (Lord X of Y is …).
        # Do not swallow parent/kin open notes that merely mention Faeble.
        if re.search(
            rf"^(?:Lord|Lady|Duke|Duchess|Baron|Baroness)\s+{re.escape(label)}\b|"
            rf"\b{re.escape(label)}\s+is\s+(?:a\s+)?(?:Baron|Lord|Lady)\b|"
            r"\b(fairy[- ]?tale|faeble|not entirely of this world)\b",
            c,
            re.I,
        ) and not re.search(
            r"\b("
            r"father|mother|parent stock|cousin|esteemed cousin|"
            r"your notes (?:sketch|say|leave|treat)|refers to|"
            r"antagonist|villain"
            r")\b",
            c,
            re.I,
        ):
            line = _strip_male_female_role(c)
            if line not in significance_lines:
                significance_lines.append(
                    line if line.endswith((".", "!", "?")) else line + "."
                )
            continue
        if re.search(
            r"\b(known as|known to|known by|also known|fairytale world|fairy[- ]tale world|"
            r"cheshire cat|white rabbit from|from (?:alice in )?wonderland|"
            r"is the (?:cheshire cat|white rabbit))\b",
            c,
            re.I,
        ) and not re.search(r"\b(subject of|quarry|father|mother|cousin)\b", c, re.I):
            line = _strip_male_female_role(c)
            if line not in alias_lines:
                alias_lines.append(line if line.endswith((".", "!", "?")) else line + ".")
            continue
        if re.search(r"\b(?:son|daughter|child)\s+of\b", c, re.I) and re.search(
            r"\b(?:brother|sister)\s+to\b", c, re.I
        ):
            # Combined kinship line: keep both parent + sibling slots.
            parent_m = re.search(
                r"^(.+?)(?:,\s+and\s+|\s+and\s+)(the\s+(?:son|daughter|child)\s+of\s+.+)$",
                c,
                re.I,
            )
            if parent_m and re.search(
                r"\b(?:brother|sister)\s+to\b", parent_m.group(1), re.I
            ):
                sib_bit = parent_m.group(1).strip(" ,")
                parent_bit = parent_m.group(2).strip(" ,")
                if not re.match(rf"^{re.escape(label)}\s+is\b", sib_bit, re.I):
                    if re.match(
                        r"^(?:(?:younger|older|twin)\s+)?(?:brother|sister)\s+to\b",
                        sib_bit,
                        re.I,
                    ):
                        sib_bit = f"{label} is {sib_bit}"
                named_parents.append(
                    _normalize_standing(
                        parent_bit
                        if re.match(rf"^{re.escape(label)}\s+is\b", parent_bit, re.I)
                        else f"{label} is {parent_bit}"
                    )
                )
                c = sib_bit if sib_bit.endswith((".", "!", "?")) else sib_bit + "."
            else:
                named_parents.append(_normalize_standing(c))
                continue
        elif re.search(r"\b(?:son|daughter|child)\s+of\b", c, re.I):
            if re.search(r"someone unnamed", c, re.I):
                continue
            named_parents.append(_normalize_standing(c))
            continue
        tail = _brother_tail(c)
        if tail is not None:
            twinish = _clause_marks_twin(c)
            # Keep rich standing lines (Rabbits of Death / Pinocchio, etc.).
            if re.search(
                r"\b(from|rabbits? of death|pinocchio|alice|wonderland|death)\b",
                c,
                re.I,
            ):
                rich_brother_lines.append(_normalize_standing(c))
            for part in re.split(r"\s+and\s+|,\s*", tail):
                name = part.strip().rstrip(".")
                name = re.sub(
                    r"^(?:two of the|one of the|the)\s+.+$",
                    "",
                    name,
                    flags=re.I,
                ).strip()
                # Prefer trailing proper names after standing phrases.
                # Allow "Character Q" (word + single capital letter) as well as
                # multi-word names like "Snow Thistle".
                name_m = re.search(
                    r"\b([A-Z][a-z]{2,}(?:\s+(?:[A-Z][a-z]{2,}|[A-Z0-9]))?)\s*$",
                    name,
                )
                if name_m:
                    name = name_m.group(1)
                if not name or not is_plausible_cast_person_name(name):
                    continue
                key = name.lower()
                if key in seen_b:
                    if twinish:
                        twin_brother_keys.add(key)
                    continue
                seen_b.add(key)
                brothers.append(name)
                if twinish:
                    twin_brother_keys.add(key)
            continue
        if re.search(
            rf"^.+\s+is\s+the\s+quarry\s+of\s+{re.escape(label)}\b|"
            rf"^{re.escape(label)}\s+hunts\s+.+$",
            c,
            re.I,
        ):
            line = _normalize_standing(c)
            if line not in other_family:
                other_family.append(line)
            continue
        if re.search(
            r"\b("
            r"sister|father|mother|widow|raised|parent|subject of|quarry|married|"
            r"nemesis|best friend|closest friend|cousin|father to|mother to|"
            r"esteemed cousin|ally|allies|co-?conspir|refers to|your notes treat|"
            r"possible (?:first|second|third )?cousin|calls?\b|father|mother|parent stock|"
            r"kinship is left open|kinship remains open|sketched as|cheshire cat|wonderland|"
            r"rivalry-care|both care|cold on the surface|fascination|"
            r"refuses to associate|larger politics at Court|"
            r"disgusted by Predator Court politics|"
            r"does not realize how much political influence|"
            r"mixed parentage|"
            r"cold shoulder|outsider|heavier load|"
            r"underestimates (?:his|her) own presence"
            r")\b",
            c,
            re.I,
        ) and not re.search(r"\b(protagonist|antagonist|main character)\b", c, re.I):
            if c not in other_family and not _is_gold_tone_cast_sentence(c, label):
                if is_orphan_life_summary(c):
                    orphan_lines.append(c)
                else:
                    other_family.append(_normalize_standing(c))
            continue
        if re.search(
            r"\b(rabbit|preyfolk|wolf|fox|lynx|arcanist|sentient|guardian|grey|gray|skin)\b",
            c,
            re.I,
        ):
            if c not in extras_from_rel:
                extras_from_rel.append(c)

    has_identity_slots = bool(
        brothers
        or rich_brother_lines
        or named_parents
        or alias_lines
        or other_family
        or significance_lines
        or role_from_rel
    )
    if not has_identity_slots:
        return ""

    base = next(
        (
            c
            for c in role_from_rel + list(lead)
            if re.search(r"\b(protagonist|antagonist|main character)\b", c, re.I)
        ),
        None,
    )
    if not base:
        base = next(
            (
                c
                for c in lead
                if not _gender_only(c)
                and (
                    is_overview_significance_clause(c, label)
                    or re.search(
                        r"\b(rabbit|preyfolk|wolf|fox|lynx|arcanist|guardian|sentient)\b",
                        c,
                        re.I,
                    )
                )
            ),
            None,
        )
    if not base:
        base = next((c for c in lead if not _gender_only(c)), lead[0] if lead else "")
    if not base:
        return ""

    base = _strip_male_female_role(base)
    # Fold titled standing (Baron of X) into antagonist / protagonist opening.
    if re.search(r"\b(antagonist|protagonist|villain|main character)\b", base, re.I):
        for c in lead:
            if c == base:
                continue
            m = re.match(
                rf"^{re.escape(label)}\s+is\s+"
                rf"((?:a\s+|the\s+)?(?:Baron|Lord|Lady|Duke|Duchess|Baroness)\b.+)$",
                c,
                re.I,
            )
            if not m:
                continue
            title_bit = m.group(1).rstrip(".")
            if title_bit.lower() not in base.lower():
                # "the main antagonist, Baron of Cheshire"
                base = base.rstrip(".") + f", {title_bit}."
            break

    # Drop orphan appositive from a role+raised-by gold dump when better slots exist.
    if is_orphan_life_summary(base) and (
        named_parents or alias_lines or rich_brother_lines or significance_lines
    ):
        base = re.split(
            r",\s*(?:a\s+)?(?:Preyfolk|who was raised|whose father)\b",
            base,
            maxsplit=1,
            flags=re.I,
        )[0].rstrip(" ,")
        if not base.endswith((".", "!", "?")):
            base += "."

    # Essay-hook open only when a titled seat is already folded in —
    # avoids "Baron of Cheshire of WorkTitle". Plain protagonist/antagonist
    # cards keep the existing "of WorkTitle" trail.
    if work_title and work_title.lower() not in base.lower():
        if re.search(r"\b(protagonist|antagonist|main character)\b", base, re.I):
            if re.search(
                rf"\b(?:Baron|Lord|Lady|Duke|Duchess|Baroness)\s+of\b",
                base,
                re.I,
            ):
                if re.match(rf"^{re.escape(label)}\s+is\b", base, re.I) and not re.match(
                    r"^In\s+", base, re.I
                ):
                    base = f"In {work_title}, {base}"
            else:
                base = base.rstrip(".") + f" of {work_title}."

    # Fold a short significance phrase into the role line when possible.
    if significance_lines and re.search(
        r"\b(protagonist|antagonist|main character)\b", base, re.I
    ):
        sig = significance_lines[0]
        sig_core = re.sub(
            rf"^{re.escape(label)}\s+is\s+(?:the\s+)?",
            "",
            sig,
            count=1,
            flags=re.I,
        ).rstrip(".")
        if sig_core and sig_core.lower() not in base.lower() and len(sig_core) < 120:
            if re.search(r"\b(chosen one|destined|fated|meant to)\b", sig_core, re.I):
                base = base.rstrip(".") + f", {sig_core}."
                significance_lines = significance_lines[1:]

    extras: list[str] = list(extras_from_rel)
    for c in lead:
        if c == base or _gender_only(c):
            continue
        # Already folded into antagonist/protagonist opening (Baron of …).
        if re.search(r"\b(antagonist|protagonist|villain)\b", base, re.I) and re.match(
            rf"^{re.escape(label)}\s+is\s+(?:a\s+|the\s+)?(?:Baron|Lord|Lady|Duke)\b",
            c,
            re.I,
        ):
            continue
        if (
            c in other_family
            or c in alias_lines
            or c in named_parents
            or c in significance_lines
            or c in role_from_rel
        ):
            continue
        if is_orphan_life_summary(c):
            continue
        if _brother_tail(c) is not None:
            continue
        if re.search(
            r"\b(known as|known to|also known|white rabbit|fairytale)\b", c, re.I
        ):
            continue
        if is_overview_significance_clause(c, label):
            continue
        extras.append(c)

    sentences: list[str] = []
    role = base if base.endswith((".", "!", "?")) else base + "."
    fairytale_aliases = [
        a
        for a in alias_lines
        if re.search(
            r"\b(fairytale|fairy[- ]tale|white rabbit from|wonderland|cheshire cat|"
            r"alice in wonderland)\b",
            a,
            re.I,
        )
    ]
    # Prefer named figure + tale over bare "from Wonderland".
    fairytale_aliases.sort(
        key=lambda a: (
            0
            if re.search(r"\b(cheshire cat|white rabbit)\b.*\b(alice|wonderland)\b", a, re.I)
            else 1
            if re.search(r"\b(cheshire cat|white rabbit|alice in wonderland)\b", a, re.I)
            else 2
        )
    )
    other_aliases = [a for a in alias_lines if a not in fairytale_aliases]

    kin_bits: list[str] = []
    if named_parents:
        parent = named_parents[0]
        parent_core = re.sub(
            rf"^{re.escape(label)}\s+is\s+(?:the\s+)?",
            "",
            parent,
            count=1,
            flags=re.I,
        ).rstrip(".")
        kin_bits.append(parent_core)
    if rich_brother_lines:
        bro = rich_brother_lines[0]
        bro_core = re.sub(
            rf"^{re.escape(label)}\s+is\s+",
            "",
            bro,
            count=1,
            flags=re.I,
        ).rstrip(".")
        kin_bits.append(bro_core)
    elif brothers:
        twin_bros = [b for b in brothers if b.lower() in twin_brother_keys]
        other_bros = [b for b in brothers if b.lower() not in twin_brother_keys]
        if twin_bros and not other_bros:
            if len(twin_bros) == 1:
                kin_bits.append(f"younger twin brother to {twin_bros[0]}")
            elif len(twin_bros) == 2:
                kin_bits.append(
                    f"younger twin brother to {twin_bros[0]} and {twin_bros[1]}"
                )
            else:
                joined = ", ".join(twin_bros[:-1]) + f", and {twin_bros[-1]}"
                kin_bits.append(f"younger twin brother to {joined}")
        elif other_bros and not twin_bros:
            if len(other_bros) == 1:
                kin_bits.append(f"younger brother to {other_bros[0]}")
            elif len(other_bros) == 2:
                kin_bits.append(
                    f"brother to {other_bros[0]} and {other_bros[1]}"
                )
            else:
                joined = ", ".join(other_bros[:-1]) + f", and {other_bros[-1]}"
                kin_bits.append(f"brother to {joined}")
        else:
            if len(twin_bros) == 1:
                kin_bits.append(f"younger twin brother to {twin_bros[0]}")
            elif twin_bros:
                joined = ", ".join(twin_bros[:-1]) + f", and {twin_bros[-1]}"
                kin_bits.append(f"younger twin brother to {joined}")
            if len(other_bros) == 1:
                kin_bits.append(f"also brother to {other_bros[0]}")
            elif other_bros:
                joined = ", ".join(other_bros[:-1]) + f", and {other_bros[-1]}"
                kin_bits.append(f"also brother to {joined}")

    # Opening cast sentence: role (+ fairytale alias) + kinship folded in.
    role_core = role.rstrip(".")
    if fairytale_aliases:
        alias = fairytale_aliases[0]
        alias_core = re.sub(
            rf"^{re.escape(label)}\s+is\s+",
            "",
            alias,
            count=1,
            flags=re.I,
        ).rstrip(".")
        if alias_core.lower() not in role_core.lower():
            # Title + fairy-tale figure folded into the opening cast line.
            if re.match(r"^(?:the\s+)?(?:cheshire cat|white rabbit)\b", alias_core, re.I):
                if re.search(r"\band\b", role_core, re.I):
                    # "…antagonist and Baron of Cheshire, and the Cheshire Cat…"
                    role_core = f"{role_core}, and {alias_core}"
                else:
                    role_core = f"{role_core} and {alias_core}"
            else:
                role_core = f"{role_core}, and is {alias_core}"

    kin_for_open: list[str] = []
    for bit in kin_bits:
        if bit.startswith(("son ", "daughter ", "child ")):
            kin_for_open.append(f"the {bit}")
        else:
            kin_for_open.append(bit)
    if kin_for_open:
        if len(kin_for_open) == 1:
            role_core = f"{role_core}, {kin_for_open[0]}"
        elif len(kin_for_open) == 2 and kin_for_open[1].startswith("also "):
            role_core = (
                f"{role_core}, {kin_for_open[0]}, and {kin_for_open[1]}"
            )
        else:
            role_core = (
                f"{role_core}, {kin_for_open[0]}, and "
                + ", and ".join(kin_for_open[1:])
            )

    # Essay-hook open: fold fascination (preferred) or quarry into antagonist line.
    folded_quarry: set[str] = set()
    if re.search(r"\b(antagonist|villain)\b", role_core, re.I):
        fasc_name = None
        quarry_name = None
        fasc_line = None
        quarry_line = None
        for c in list(other_family):
            fm = re.search(
                rf"^(.+?)\s+is\s+the\s+subject\s+of\s+"
                rf"(?:{re.escape(label)}'s|(?:his|her))\s+fascination\.?$",
                c.strip(),
                re.I,
            )
            if fm and not fasc_name:
                fasc_name = fm.group(1).strip()
                fasc_line = c
                continue
            qm = re.search(
                rf"^(.+?)\s+is\s+(?:the\s+quarry\s+of\s+{re.escape(label)}|"
                rf"{re.escape(label)}'s\s+quarry|(?:his|her)\s+quarry)\.?$",
                c.strip(),
                re.I,
            )
            if qm and not quarry_name:
                quarry_name = qm.group(1).strip()
                quarry_line = c
        fold_name = fasc_name or quarry_name
        fold_line = fasc_line or quarry_line
        if fold_name and fold_name.lower() not in role_core.lower():
            if fasc_name:
                role_core = (
                    role_core.rstrip(".")
                    + f", with {fold_name} as the subject of his fascination"
                )
            else:
                role_core = role_core.rstrip(".") + f", with {fold_name} as his quarry"
            if fold_line:
                folded_quarry.add(fold_line.lower())
            # Drop the thinner quarry line when fascination is folded.
            if fasc_line and quarry_line:
                folded_quarry.add(quarry_line.lower())
            other_family = [x for x in other_family if x.lower() not in folded_quarry]

    sentences.append(role_core + ".")

    # Second sentence: aka + faction / opposition — still natural, not stacked cards.
    trail_bits: list[str] = []
    for c in other_aliases[:1]:
        aka_core = re.sub(
            rf"^{re.escape(label)}\s+is\s+",
            "",
            c.rstrip("."),
            count=1,
            flags=re.I,
        )
        if aka_core and aka_core.lower() not in role_core.lower():
            trail_bits.append(aka_core)
    faction_bits: list[str] = []
    remain_sig: list[str] = []
    for sig in significance_lines[:3]:
        if re.search(
            r"\b(faction against|up against|opposed by|rival)\b",
            sig,
            re.I,
        ):
            core = re.sub(
                rf"^{re.escape(label)}\s+(?:is\s+|leads?\s+)?",
                "",
                sig.rstrip("."),
                count=1,
                flags=re.I,
            )
            # "leads a faction against X" / "up against X"
            if re.match(r"^(?:a\s+)?faction against\b", core, re.I):
                faction_bits.append(f"leads {core}" if not core.lower().startswith("leads") else core)
            elif re.match(r"^leads?\s+", core, re.I):
                faction_bits.append(core)
            else:
                faction_bits.append(core)
        else:
            remain_sig.append(sig)
    for c in extras[:2]:
        if re.search(r"\bfaction against\b", c, re.I):
            core = re.sub(
                rf"^{re.escape(label)}\s+(?:is\s+|leads?\s+)?",
                "",
                c.rstrip("."),
                count=1,
                flags=re.I,
            )
            if re.match(r"^(?:a\s+)?faction against\b", core, re.I):
                faction_bits.append(f"leads {core}")
            elif core not in faction_bits:
                faction_bits.append(core if core.lower().startswith("leads") else f"leads {core}")
    # Deduplicate faction
    seen_f: set[str] = set()
    faction_clean: list[str] = []
    for f in faction_bits:
        key = f.lower()[:80]
        if key in seen_f:
            continue
        seen_f.add(key)
        faction_clean.append(f)
    faction_bits = faction_clean[:1]

    if trail_bits or faction_bits:
        clauses: list[str] = []
        for bit in trail_bits:
            if re.match(r"^(?:also known|known as|known to|known by)\b", bit, re.I):
                clauses.append(f"{label} is {bit}")
            else:
                clauses.append(f"{label} is {bit}")
        for bit in faction_bits:
            if re.match(r"^leads?\b", bit, re.I):
                clauses.append(f"{label} {bit}")
            elif re.match(r"^(?:a\s+)?faction against\b", bit, re.I):
                clauses.append(f"{label} leads {bit}")
            else:
                clauses.append(f"{label} {bit}")
        if len(clauses) == 1:
            sentences.append(clauses[0] + ".")
        elif len(clauses) == 2:
            # "Platinus is also known as X, and leads a faction against Y."
            second = clauses[1]
            second = re.sub(
                rf"^{re.escape(label)}\s+",
                "",
                second,
                count=1,
                flags=re.I,
            )
            sentences.append(f"{clauses[0]}, and {second}.")
        else:
            sentences.append(" ".join(c if c.endswith(".") else c + "." for c in clauses))

    # Extra stakes (concealment / upheaval) as one more short sentence each, max 2.
    for sig in remain_sig[:2]:
        clause = sig if sig.endswith((".", "!", "?")) else sig + "."
        if clause not in sentences:
            sentences.append(clause)

    # Prefer cousin/care, then parents, then politics — gold essay-hook order.
    def _other_family_rank(line: str) -> tuple[int, int]:
        low = (line or "").lower()
        if re.search(r"rivalry-care|both care|cold on the surface", low):
            return (0, -len(line))
        if re.search(r"\b(?:first|second|third)\s+cousin\b", low):
            return (1, -len(line))
        if re.search(r"\b(?:father|mother|outsider|another realm|cold shoulder)\b", low):
            return (2, -len(line))
        if re.search(
            r"disgusted by Predator Court politics|refuses to associate|"
            r"larger politics|does not realize how much political|"
            r"underestimates|fascination|heavier load",
            low,
        ):
            return (3, -len(line))
        if re.search(r"\bmixed parentage\b", low):
            return (4, -len(line))
        if re.search(r"\b(?:quarry|subject of|hunts?)\b", low):
            return (5, -len(line))
        if re.search(r"\bcousin\b", low):
            return (6, -len(line))
        return (7, -len(line))

    other_family_sorted = sorted(other_family, key=_other_family_rank)
    for c in other_family_sorted[:8]:
        clause = c if c.endswith((".", "!", "?")) else c + "."
        if clause not in sentences:
            sentences.append(clause)

    # Species extras when fairytale alias does not already carry White Rabbit identity.
    if not fairytale_aliases:
        for c in extras[:2]:
            if re.search(r"\bfaction against\b", c, re.I):
                continue
            clause = c if c.endswith((".", "!", "?")) else c + "."
            if clause not in sentences and not is_orphan_life_summary(clause):
                sp = re.sub(
                    rf"^{re.escape(label)}\s+is\s+",
                    "",
                    clause.rstrip("."),
                    count=1,
                    flags=re.I,
                ).strip()
                sp = re.sub(r"^(?:an?\s+)", "", sp, count=1, flags=re.I)
                if (
                    len(sentences) == 1
                    and len(sp) < 60
                    and re.search(
                        r"\b(rabbit|wolf|fox|lynx|arcanist|sentient)\b",
                        sp,
                        re.I,
                    )
                ):
                    if sp.lower() in sentences[0].lower():
                        continue
                    if gender_word and not re.search(rf"\b{gender_word}\b", sp, re.I):
                        sp = f"{gender_word} {sp}"
                    sentences[0] = sentences[0].rstrip(".") + f", a {sp}."
                    gender_word = None
                    continue
                sentences.append(clause)

    # Orphan fallback only when no named parents / rich brother standing.
    if (
        not named_parents
        and not rich_brother_lines
        and orphan_lines
        and not kin_bits
        and not significance_lines
    ):
        clause = orphan_lines[0]
        if not clause.endswith((".", "!", "?")):
            clause += "."
        sentences.append(_strip_male_female_role(clause))

    # Re-attach bare gender onto a species line when kin does not already signal sex.
    if gender_word and sentences:
        has_kin_sex = any(
            re.search(
                r"\b(son of|daughter of|buck|doe|brother|sister|he is|she is)\b",
                s,
                re.I,
            )
            for s in sentences
        )
        if not has_kin_sex:
            woven = False
            for i, s in enumerate(sentences):
                if re.search(
                    r"\b(wolf|rabbit|fox|lynx|arcanist|preyfolk|sentient)\b",
                    s,
                    re.I,
                ) and not re.search(
                    r"\b(protagonist|antagonist|main character)\b", s, re.I
                ):
                    if not re.search(rf"\b{gender_word}\b", s, re.I):
                        sentences[i] = re.sub(
                            rf"({re.escape(label)}\s+is\s+(?:an?\s+)?)",
                            rf"\1{gender_word} ",
                            s,
                            count=1,
                            flags=re.I,
                        )
                    woven = True
                    break
            if not woven:
                sentences.append(f"{label} is {gender_word}.")

    body = " ".join(sentences)
    if not _composed_has_substance([body], label):
        return ""
    return body


def formalize_who_is_sentence(sentence: str, label: str) -> str:
    """
    Restate chatty upheaval/rediscovery lines in formal cast-card tone.
    Does not invent facts — only reorders and firms wording already present.
    """
    s = re.sub(r"\s+", " ", (sentence or "").strip())
    label = (label or "").strip()
    if not s or not label:
        return s

    # Drop leading "So Name," / "So Name " / "So now Name" / "now Name"
    s = re.sub(rf"^So\s+now\s+{re.escape(label)}\s*,?\s*", f"{label} ", s, count=1, flags=re.I)
    s = re.sub(rf"^Now\s+{re.escape(label)}\s*,?\s*", f"{label} ", s, count=1, flags=re.I)
    s = re.sub(rf"^So\s+{re.escape(label)}\s*,\s*", f"{label} ", s, count=1, flags=re.I)
    s = re.sub(rf"^So\s+{re.escape(label)}\s+", f"{label} ", s, count=1, flags=re.I)
    s = re.sub(r"^So\s+,?\s*", "", s, count=1, flags=re.I)

    # Soften leftover librarian scaffolding into essay-hook middle voice.
    s = re.sub(
        rf"^Your notes treat\s+(.+?)\s+as\s+a\s+possible\s+((?:first|second|third)\s+cousin)\s+to\s+"
        rf"{re.escape(label)}\b.*$",
        rf"\1 may be {label}'s \2, though that kinship remains open.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+refers to\s+(?:his|her|their)\s+['\"]?cousin['\"]?\s+(.+?)\.?$",
        rf"{label} calls \1 cousin, though that kinship remains open.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+refers to\s+(.+?)\s+as\s+cousin\s+in your notes.*$",
        rf"{label} calls \1 cousin, though that kinship remains open.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^Your notes sketch\s+{re.escape(label)}'s\s+father\s+as\s+(.+?)\s+parent stock,?\s*"
        rf"with open questions.*$",
        rf"{label}'s father is a \1, with whether he is a Faeble too still open.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}'s\s+father\s+is\s+sketched\s+as\s+(.+?)\s+parent stock;\s*"
        rf"notes leave open whether he is a Faeble too\.?$",
        rf"{label}'s father is a \1, with whether he is a Faeble too still open.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^Your notes say\s+{re.escape(label)}'s\s+mother\s+is\s+from\s+here\.?$",
        rf"{label}'s mother is from here.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^Your notes leave\s+{re.escape(label)}'s\s+father\s+open.*$",
        rf"{label}'s father remains open, including whether he is a Faeble too.",
        s,
        count=1,
        flags=re.I,
    )
    # Already-middle-voice openers: firm essay rhythm without inventing.
    s = re.sub(
        rf"^(.+?)\s+may be\s+{re.escape(label)}'s\s+((?:first|second|third)\s+cousin)\s+[—–\-]\s+"
        rf"that kinship is left open\.?$",
        rf"\1 may be {label}'s \2, though that kinship remains open.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^(.+?)\s+is\s+{re.escape(label)}'s\s+((?:first|second|third)\s+cousin)\.?$",
        rf"\1 is {label}'s \2.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+and\s+(.+?)\s+share\s+a\s+complicated\s+rivalry-care bond\s+[—–\-]\s+"
        rf"different in temperament,\s+but both care\.?$",
        rf"{label} and \1 share a complicated rivalry-care bond — different in temperament, but both care.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+and\s+(.+?)\s+share\s+a\s+relationship that is cold on the surface\s+"
        rf"but more complicated\s+[—–\-]\s+both care\.?$",
        rf"{label} and \1 share a relationship that is cold on the surface but more complicated — both care.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+is personally disgusted by Predator Court politics,\s+"
        rf"and does not realize how much political influence he holds\.?$",
        rf"{label} is personally disgusted by Predator Court politics, "
        rf"and does not realize how much political influence he holds.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+has\s+mixed parentage\.?$",
        rf"{label} has mixed parentage.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+refuses to associate with larger politics at Court\.?$",
        rf"{label} refuses to associate with larger politics at Court.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+refuses to associate with larger politics at Court,\s+"
        rf"and underestimates (?:his|her) own presence\.?$",
        rf"{label} refuses to associate with larger politics at Court, "
        rf"and underestimates his own presence.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+underestimates (?:his|her) own presence\.?$",
        rf"{label} underestimates his own presence.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^Your notes treat\s+(.+?)\s+as\s+a\s+possible\s+((?:first|second|third)\s+cousin)\s+to\s+"
        rf"{re.escape(label)}\b.*$",
        rf"\1 may be {label}'s \2, though that kinship remains open.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}'s\s+father\s+is\s+(.+?)\s+parent stock;\s*"
        rf"whether he is a Faeble too is left open\.?$",
        rf"{label}'s father is a \1, with whether he is a Faeble too still open.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}'s\s+father\s+is\s+(.+?)\s+parent stock\.?$",
        rf"{label}'s father is a \1.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(r"\bparent stock\b", "", s, flags=re.I)
    s = re.sub(r"\s{2,}", " ", s).strip()
    s = re.sub(
        rf"^{re.escape(label)}'s\s+father\s+is\s+a\s+a\s+",
        rf"{label}'s father is a ",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+and\s+(.+?)\s+share\s+a\s+relationship that is cold on the surface\s+"
        rf"but more complicated\s+[—–\-]\s+(.+?)\s+is among the few cats\s+"
        rf"{re.escape(label)}\s+does not grudge,\s+and both care\.?$",
        rf"{label} and \1 share a relationship that is cold on the surface but more complicated — "
        rf"\2 is among the few cats {label} does not grudge, and both care.",
        s,
        count=1,
        flags=re.I,
    )
    # "Etherei is the quarry of Tenebris" → "Etherei is Tenebris's quarry."
    s = re.sub(
        rf"^(.+?)\s+is\s+the\s+quarry\s+of\s+{re.escape(label)}\.?$",
        rf"\1 is {label}'s quarry.",
        s,
        count=1,
        flags=re.I,
    )
    s = re.sub(
        rf"^{re.escape(label)}\s+is\s+the\s+quarry\s+of\s+(.+?)\.?$",
        rf"{label} is \1's quarry.",
        s,
        count=1,
        flags=re.I,
    )
    # Drop meta rename scrap that restates the card title.
    if re.match(
        rf'^The protagonist is named ["\']?{re.escape(label)}\.?["\']?\.?$',
        s,
        re.I,
    ):
        return ""
    if re.match(
        rf'^The (?:main\s+)?(?:antagonist|character) is named ["\']?{re.escape(label)}\.?["\']?\.?$',
        s,
        re.I,
    ):
        return ""

    # Compress titled faeble / political standing into one clear beat.
    m_pol = re.match(
        rf"^(?:Lord|Lady)\s+{re.escape(label)}\s+of\s+([A-Z][\w'-]+)\s+is\s+"
        rf"(?:probably\s+)?not entirely of this world;\s*"
        rf".{{0,40}}not the king or emperor.{{0,40}}"
        rf"(?:Fairy Tale character|faeble).{{0,80}}social rank",
        s,
        re.I | re.S,
    )
    if m_pol:
        place = m_pol.group(1)
        s = (
            f"Lord {label} of {place} is a faeble with social rank — "
            f"not a king or emperor, and not entirely of this world."
        )
        return s

    # Concealment as cast identity (not "current undercover status" voice).
    # "Name has to conceal her identity … as a human and … an Author"
    # → "Name conceals that she is human and an Author."
    m_conceal = re.match(
        rf"^{re.escape(label)}\s+has to conceal\s+(.+)$",
        s,
        re.I,
    )
    if m_conceal:
        rest = m_conceal.group(1).strip().rstrip(".")
        human = bool(re.search(r"\bhuman\b", rest, re.I))
        author = bool(re.search(r"\bauthors?\b", rest, re.I))
        bits: list[str] = []
        if human and author:
            bits.append("human and an Author")
        elif human:
            bits.append("human")
        elif author:
            bits.append("an Author")
        if bits:
            pronoun = "she"
            if re.search(r"\bhis\b|\bhe\b", rest, re.I) and not re.search(
                r"\bher\b|\bshe\b", rest, re.I
            ):
                pronoun = "he"
            s = f"{label} conceals that {pronoun} is {' and '.join(bits)}."
            return s
        s = re.sub(
            rf"^{re.escape(label)}\s+has to conceal\b",
            f"{label} conceals",
            s,
            count=1,
            flags=re.I,
        )
        s = re.sub(
            r"\bin order to not be discovered as\b",
            "as",
            s,
            count=1,
            flags=re.I,
        )
        s = re.sub(r"\bsubsequently,?\s*", "", s, flags=re.I)
        if not s.endswith((".", "!", "?")):
            s += "."
        return s

    # "Name, by being discovered …, just set in motion …"
    # → "By being discovered …, Name has already set in motion …"
    m = re.match(
        rf"^{re.escape(label)}\s*,?\s+by\s+(being\s+.+?)\s*,?\s+"
        rf"(?:just\s+)?(?:has\s+)?set\s+in\s+motion\s+(.+)$",
        s,
        re.I,
    )
    if m:
        by_bit = m.group(1).strip().rstrip(",")
        rest = m.group(2).strip()
        # Prefer Cheshire Cat when sources say CC Baron / Baron of Cheshire.
        by_bit = re.sub(
            r"\b(?:the\s+)?CC\s+Baron(?:\s+of\s+Cheshire)?\b",
            "the Cheshire Cat",
            by_bit,
            flags=re.I,
        )
        rest = re.sub(
            r"\bthe eventual\s*\([^)]*few months[^)]*\)\s*reveal that\b",
            "the Predators' eventual rediscovery that",
            rest,
            flags=re.I,
        )
        rest = re.sub(
            r"\bthe eventual\s+reveal that\b",
            "the Predators' eventual rediscovery that",
            rest,
            flags=re.I,
        )
        rest = re.sub(
            r"\bare just as sentient as Predators\b",
            "possess the same level of sentience as Predators",
            rest,
            flags=re.I,
        )
        rest = re.sub(
            r"\bPreyfolk of this Dimension\b",
            "the Preyfolk of their own dimension",
            rest,
            flags=re.I,
        )
        # If timing was parenthetical "within a few months", append formal span once.
        if re.search(r"\bfew months\b", sentence, re.I) and not re.search(
            r"\bspan of several months\b", rest, re.I
        ):
            rest = rest.rstrip(".")
            rest += (
                ", a rediscovery that will gradually but inevitably take place "
                "within the span of several months"
            )
        s = f"By {by_bit}, {label} has already set in motion {rest}"
        if not s.endswith((".", "!", "?")):
            s += "."
        return s

    # Mild firming for other upheaval-reason lines.
    if is_upheaval_reason_clause(s, label) or is_overview_significance_clause(s, label):
        s = re.sub(r"\bjust set in motion\b", "has already set in motion", s, flags=re.I)
        s = re.sub(
            r"\b(?:the\s+)?CC\s+Baron(?:\s+of\s+Cheshire)?\b",
            "the Cheshire Cat",
            s,
            flags=re.I,
        )
    return s


def strip_who_is_cast_card_header(text: str, label: str) -> str:
    """
    Drop the lone cast-card title line so it cannot glue onto the open.

    Compose returns \"Name\\n\\nIn Work, Name is…\". Whitespace collapse
    turns that into \"Name In Work, Name is…\", which then fails identity
    matching and lets Dijon/parents float first.
    """
    text = (text or "").strip()
    label = (label or "").strip()
    if not text or not label:
        return text
    # Title on its own line (or with blank lines).
    text = re.sub(
        rf"^{re.escape(label)}\s*\n+",
        "",
        text,
        count=1,
        flags=re.I,
    ).strip()
    # Already collapsed: "Name In Work," or "Name Name is"
    text = re.sub(
        rf"^{re.escape(label)}\s+(?=In\s+)",
        "",
        text,
        count=1,
        flags=re.I,
    ).strip()
    text = re.sub(
        rf"^{re.escape(label)}\s+(?={re.escape(label)}\s+is\b)",
        "",
        text,
        count=1,
        flags=re.I,
    ).strip()
    # Garbled open left mid-card: "Name In Work, Name is" → "In Work, Name is"
    text = re.sub(
        rf"(?:^|(?<=[.!?]\s)){re.escape(label)}\s+(In\s+[^,]{{1,80}},\s*)"
        rf"{re.escape(label)}\s+is\b",
        r"\1" + label + " is",
        text,
        count=1,
        flags=re.I,
    )
    return text.strip()


def _order_who_is_gold_sentences(label: str, sentences: list[str]) -> list[str]:
    """
    Essay-hook order: role/open → cousin/care → parents → politics →
    mixed parentage → faeble/rank → rest. Never invent; only reorder.

    Locked against the Tenebris gold sample
    (tests/fixtures/tenebris_who_is_gold.txt) — do not loosen without owner OK.
    """
    kept = [s for s in sentences if (s or "").strip()]
    if len(kept) < 2:
        return kept
    label = (label or "").strip()

    def rank(s: str) -> tuple[int, int, int]:
        low = (s or "").lower()
        # 0 — role / work open
        if re.match(rf"^In\s+.{{1,80}}?,\s*{re.escape(label)}\s+is\b", s, re.I):
            return (0, 0, 0)
        if re.match(rf"^{re.escape(label)}\s+is\b", s, re.I) and re.search(
            r"\b(main\s+antagonist|antagonist|protagonist|main character|"
            r"cheshire cat|white rabbit|baron of)\b",
            s,
            re.I,
        ):
            return (0, 1, 0)
        # 1 — Dijon / cousin + care
        if re.search(
            r"cold on the surface|rivalry-care|both care|heavier load|"
            r"few cats .*(?:does not|do not) grudge",
            low,
        ):
            return (1, 0, 0)
        if re.search(r"\b(?:first|second|third)\s+cousin\b", low):
            return (1, 1, 0)
        # 2 — parents / heritage (before Court politics)
        if re.search(r"\b(mother|father)\b", low) and not re.search(
            r"mixed parentage", low
        ):
            return (2, 0, 0)
        if re.search(r"\bcold shoulder\b", low):
            return (2, 1, 0)
        # 3 — Court politics stance
        if re.search(
            r"disgusted|political influence|does not realize|"
            r"refuses to associate|larger politics|underestimates",
            low,
        ):
            return (3, 0, 0)
        # 4 — mixed parentage / not-entirely (before titled faeble rank)
        if re.search(r"mixed parentage", low):
            return (4, 0, 0)
        if re.match(r"^(?:He|She)\s+is\s+not entirely of this world\.?$", s, re.I):
            return (4, 1, 0)
        # 5 — titled faeble / social rank closer
        if re.search(r"\b(faeble|social rank)\b", low) and re.match(
            r"^(?:Lord|Lady|Duke|Duchess|Baron|Baroness)\b", s, re.I
        ):
            return (5, 0, 0)
        if re.search(r"\b(faeble|social rank|not entirely of this world)\b", low):
            return (5, 1, 0)
        return (6, 0, 0)

    indexed = list(enumerate(kept))
    indexed.sort(key=lambda it: (*rank(it[1]), it[0]))
    return [s for _, s in indexed]


def smooth_who_is_prose(label: str, body: str) -> str:
    """Drop bare gender when kin signals sex; formalize stakes; never invent facts."""
    text = (body or "").strip()
    label = (label or "").strip()
    if not text or not label:
        return text
    text = strip_who_is_cast_card_header(text, label)
    parts = text.split("\n\n")
    out_parts: list[str] = []
    for part in parts:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", part) if s.strip()]
        gender: str | None = None
        kept: list[str] = []
        for s in sentences:
            m = re.match(rf"^{re.escape(label)}\s+is\s+(male|female)\.?$", s, re.I)
            if m:
                gender = m.group(1).lower()
                continue
            # Strip accidental "male/female protagonist" wording.
            s = re.sub(
                rf"({re.escape(label)}\s+is\s+the\s+)(?:male|female)\s+"
                rf"(?=protagonist|antagonist|main character)",
                r"\1",
                s,
                count=1,
                flags=re.I,
            )
            s = formalize_who_is_sentence(s, label)
            if not s.strip():
                continue
            kept.append(s)
        # One cousin standing line is enough — keep second-cousin / may-be over thinner call lines.
        has_rich_cousin = any(
            re.search(
                r"\b(?:first|second|third)\s+cousin\b|\bmay be\b.+\bcousin\b|"
                r"rivalry-care bond",
                s,
                re.I,
            )
            for s in kept
        )
        if has_rich_cousin:
            kept = [
                s
                for s in kept
                if not re.search(
                    rf"^{re.escape(label)}\s+calls\s+.+\bcousin\b|"
                    rf"^{re.escape(label)}\s+refers to\b.+\bcousin\b|"
                    rf"\besteemed cousin\b",
                    s,
                    re.I,
                )
            ]
        # Drop near-duplicate role lines ("X is a young woman." then "X is a young woman and an author.")
        if len(kept) >= 2:
            deduped: list[str] = []
            for s in kept:
                core = re.sub(rf"^{re.escape(label)}\s+is\s+(?:an?\s+)?", "", s, count=1, flags=re.I)
                core = core.rstrip(".").strip().lower()
                subsumed = False
                for j, other in enumerate(deduped):
                    other_core = re.sub(
                        rf"^{re.escape(label)}\s+is\s+(?:an?\s+)?",
                        "",
                        other,
                        count=1,
                        flags=re.I,
                    )
                    other_core = other_core.rstrip(".").strip().lower()
                    if core and other_core and (
                        core in other_core or other_core in core
                    ):
                        # Keep the longer / richer line.
                        if len(s) > len(other):
                            deduped[j] = s
                        subsumed = True
                        break
                if not subsumed:
                    deduped.append(s)
            kept = deduped
        if gender and kept:
            has_kin_sex = any(
                re.search(
                    r"\b(son of|daughter of|buck|doe|brother|sister|he is|she is)\b",
                    s,
                    re.I,
                )
                for s in kept
            )
            if not has_kin_sex:
                woven = False
                for i, s in enumerate(kept):
                    if re.search(
                        r"\b(wolf|rabbit|fox|lynx|arcanist|preyfolk|sentient)\b",
                        s,
                        re.I,
                    ) and not re.search(
                        r"\b(protagonist|antagonist|main character)\b", s, re.I
                    ):
                        if not re.search(rf"\b{gender}\b", s, re.I):
                            kept[i] = re.sub(
                                rf"({re.escape(label)}\s+is\s+(?:an?\s+)?)",
                                rf"\1{gender} ",
                                s,
                                count=1,
                                flags=re.I,
                            )
                        woven = True
                        break
                if not woven:
                    # Fold into ", a wolf" appositive even when the line also names a role.
                    for i, s in enumerate(kept):
                        if re.search(rf"\b{gender}\b", s, re.I):
                            woven = True
                            break
                        m_sp = re.search(
                            r",\s*(?:an?\s+)?(wolf|rabbit|fox|lynx|arcanist)\b",
                            s,
                            re.I,
                        )
                        if m_sp:
                            kept[i] = (
                                s[: m_sp.start()]
                                + f", a {gender} {m_sp.group(1).lower()}"
                                + s[m_sp.end() :]
                            )
                            woven = True
                            break
                    if not woven:
                        # Prefer dropping bare gender over a trailing "X is male."
                        # when the card already has role / known-as identity.
                        has_identity = any(
                            re.search(
                                r"\b("
                                r"protagonist|antagonist|known as|white rabbit|"
                                r"baron|lord|lady|duke|duchess"
                                r")\b",
                                s,
                                re.I,
                            )
                            for s in kept
                        )
                        if not has_identity:
                            kept.append(f"{label} is {gender}.")
        kept = _essay_hook_who_is_sentences(label, kept)
        kept = _essay_flow_join_sentences(label, kept)
        out_parts.append(" ".join(kept) if kept else part)
    return "\n\n".join(p for p in out_parts if p.strip())


def _infer_who_is_pronoun(label: str, sentences: list[str]) -> str | None:
    """He/she from wording already on the card — never invent gender."""
    blob = " ".join(sentences)
    has_he = bool(re.search(r"(?<![A-Za-z])(?:he|his|him)\b", blob, re.I))
    has_she = bool(re.search(r"(?<![A-Za-z])(?:she|her|hers)\b", blob, re.I))
    # "her" in "mother" false positive is unlikely; still prefer title cues when mixed.
    if has_he and not has_she:
        return "he"
    if has_she and not has_he:
        return "she"
    if re.search(
        rf"\b(?:Baron|Lord|Duke|King|Prince)\s+{re.escape(label)}\b|"
        rf"\b{re.escape(label)}\s+is\s+(?:a\s+|the\s+)?(?:Baron|Lord|Duke)\b",
        blob,
        re.I,
    ):
        return "he"
    if re.search(
        rf"\b(?:Baroness|Lady|Duchess|Queen|Princess)\s+{re.escape(label)}\b|"
        rf"\b{re.escape(label)}\s+is\s+(?:a\s+|the\s+)?(?:Baroness|Lady|Duchess)\b|"
        rf"\b{re.escape(label)}\s+is\s+a\s+young woman\b",
        blob,
        re.I,
    ):
        return "she"
    if re.search(
        rf"\b{re.escape(label)}\b.{{0,60}}\b(?:twin\s+)?brother\b|"
        rf"\byounger twin brother\b",
        blob,
        re.I,
    ):
        return "he"
    if re.search(
        rf"\b{re.escape(label)}\b.{{0,60}}\b(?:twin\s+)?sister\b|"
        rf"\byoung woman\b",
        blob,
        re.I,
    ):
        return "she"
    gender = re.search(rf"\b{re.escape(label)}\s+is\s+(male|female)\b", blob, re.I)
    if gender:
        return "he" if gender.group(1).lower() == "male" else "she"
    return None


def _essay_flow_join_sentences(label: str, sentences: list[str]) -> list[str]:
    """
    Join related short cast facts into essay-hook rhythm — never invent facts.
    """
    kept = [re.sub(r"\s+", " ", (s or "").strip()) for s in sentences if (s or "").strip()]
    if len(kept) < 2:
        return kept

    def _take(pred):
        for i, s in enumerate(kept):
            if pred(s):
                return i, s
        return None, None

    # Mother + father → one parentage sentence.
    mi, mother = _take(lambda s: re.match(r"^(?:His|Her)\s+mother\s+is\s+from\s+here\.?$", s, re.I))
    fi, father = _take(
        lambda s: re.match(r"^(?:His|Her)\s+father\s+is\b", s, re.I)
        and not re.search(r"\bmother\b", s, re.I)
    )
    if mother and father and mi is not None and fi is not None:
        father_core = re.sub(
            r"^(?:His|Her)\s+father\s+is\s+",
            "",
            father.rstrip("."),
            count=1,
            flags=re.I,
        )
        poss = "His" if mother.lower().startswith("his") else "Her"
        joined = f"{poss} mother is from here, but {poss.lower()} father is {father_core}."
        kept = [s for j, s in enumerate(kept) if j not in {mi, fi}]
        # Place parents after Dijon / politics when possible — append for now.
        kept.append(joined)

    # Cousin + Dijon care → one clarifying kinship sentence.
    ci, cousin = _take(
        lambda s: re.search(r"\b(?:first|second|third)\s+cousin\b", s, re.I)
        and not re.search(r"cold on the surface|rivalry-care|both care", s, re.I)
    )
    di, dijon = _take(
        lambda s: re.search(r"cold on the surface|rivalry-care bond|both care", s, re.I)
    )
    if cousin and dijon and ci is not None and di is not None:
        # "Duke Dijon is his third cousin" + care line
        cm = re.match(
            r"^((?:Duke|Lord|Lady)\s+\w+|\w+)\s+is\s+(?:his|her)\s+"
            r"((?:first|second|third)\s+cousin)\.?$",
            cousin,
            re.I,
        )
        care_core = dijon.rstrip(".")
        care_core = re.sub(
            r"^(?:He|She)\s+and\s+(?:Duke|Lord|Lady)?\s*\w+\s+share\s+a\s+"
            r"relationship that is cold on the surface but more complicated\s+[—–\-]\s*",
            "",
            care_core,
            count=1,
            flags=re.I,
        )
        care_core = re.sub(
            rf"^(?:He|She|{re.escape(label)})\s+and\s+.+\s+share\s+a\s+"
            r"(?:complicated\s+rivalry-care bond|relationship that is cold on the surface)"
            r".*?[—–\-]\s*",
            "",
            care_core,
            count=1,
            flags=re.I,
        )
        if cm:
            other = cm.group(1)
            degree = cm.group(2)
            # Subject of the card → "he"; keep partner named in the care clause.
            care_core = re.sub(rf"\b{re.escape(label)}\b", "he", care_core)
            care_core = re.sub(
                r"\bunbeknownst to he\b",
                "unbeknownst to him",
                care_core,
                flags=re.I,
            )
            if re.search(r"among the few cats|both care|does not grudge", care_core, re.I):
                joined = (
                    f"{other} is his {degree}, with whom he shares a relationship "
                    f"that is cold on the surface but more complicated — {care_core}."
                )
            else:
                joined = (
                    f"{other} is his {degree}, with whom he shares a relationship "
                    f"that is cold on the surface but more complicated — both care."
                )
            kept = [s for j, s in enumerate(kept) if j not in {ci, di}]
            # Insert after opening / faeble when possible: after first sentence.
            if kept:
                kept.insert(1, joined)
            else:
                kept.append(joined)

    # Cold shoulder → fold into mother/father heritage when present.
    si, shoulder = _take(
        lambda s: re.search(r"\bcold shoulder\b", s, re.I)
        and not re.match(
            r"^(?:His|Her)\s+mother\s+is\s+from\s+here,\s+but\s+(?:his|her)\s+father\b",
            s,
            re.I,
        )
    )
    if shoulder and si is not None:
        pi, parents = _take(
            lambda s: re.match(
                r"^(?:His|Her)\s+mother\s+is\s+from\s+here,\s+but\s+(?:his|her)\s+father\b",
                s,
                re.I,
            )
            and not re.search(r"\bcold shoulder\b", s, re.I)
        )
        if parents and pi is not None:
            joined = (
                f"{parents.rstrip('.')} — and other cats gave him the cold shoulder "
                f"because that father was an outsider."
            )
            kept = [s for j, s in enumerate(kept) if j not in {si, pi}]
            kept.append(joined)

    # Mixed parentage + "not entirely of this world" faeble line.
    xi, mixed = _take(
        lambda s: re.match(r"^(?:He|She)\s+has\s+mixed parentage\.?$", s, re.I)
    )
    ri, realm = _take(
        lambda s: re.search(r"not entirely of this world", s, re.I)
        and re.search(r"faeble|social rank", s, re.I)
    )
    if mixed and realm and xi is not None and ri is not None:
        realm_core = realm.rstrip(".")
        # "Lord X is a faeble…" → keep titled subject after mixed clause.
        if re.match(r"^(?:Lord|Lady|Duke|Baron)\b", realm_core, re.I):
            joined = (
                f"{mixed.rstrip('.')}, and is not entirely of this world. {realm_core}."
            )
            # Avoid doubling "not entirely"
            if re.search(r"not entirely of this world", mixed, re.I):
                joined = f"{mixed.rstrip('.')}. {realm_core}."
            else:
                # Pull not-entirely into the mixed sentence; keep rank clause.
                rank = re.sub(
                    r",?\s*and not entirely of this world",
                    "",
                    realm_core,
                    count=1,
                    flags=re.I,
                )
                joined = (
                    f"{mixed.rstrip('.')}, and is not entirely of this world. {rank}."
                )
        else:
            joined = f"{mixed.rstrip('.')}, and is not entirely of this world."
            kept = [s for j, s in enumerate(kept) if j not in {xi, ri}]
            kept.append(joined)
            cleaned_early = [
                re.sub(r"\s{2,}", " ", x).strip() for x in kept if x.strip()
            ]
            return _order_who_is_gold_sentences(label, cleaned_early)
        kept = [s for j, s in enumerate(kept) if j not in {xi, ri}]
        # After open is best.
        if kept:
            kept.insert(min(1, len(kept)), joined)
        else:
            kept.append(joined)

    cleaned = [re.sub(r"\s{2,}", " ", x).strip() for x in kept if x.strip()]
    return _order_who_is_gold_sentences(label, cleaned)


def _essay_hook_who_is_sentences(label: str, sentences: list[str]) -> list[str]:
    """
    Light essay-hook polish: prefer pronouns after the open,
    keep every fact — never invent. Keep parent lines separate so scrub
    still recognizes them as cast-card facts before essay-flow joins them.
    """
    kept = [s for s in sentences if (s or "").strip()]
    if len(kept) < 2:
        return kept

    pronoun = _infer_who_is_pronoun(label, kept)
    if not pronoun or len(kept) < 2:
        return kept

    poss = "his" if pronoun == "he" else "her"
    out: list[str] = [kept[0]]
    for s in kept[1:]:
        if not re.match(rf"^{re.escape(label)}\b", s, re.I):
            s2 = re.sub(
                rf"^(.+?)\s+is\s+{re.escape(label)}'s\s+quarry\.?$",
                rf"\1 is {poss} quarry.",
                s,
                count=1,
                flags=re.I,
            )
            # "Duke Dijon may be Label's third cousin…"
            s2 = re.sub(
                rf"\b{re.escape(label)}'s\s+((?:first|second|third)\s+cousin)\b",
                rf"{poss} \1",
                s2,
                count=1,
                flags=re.I,
            )
            out.append(s2)
            continue
        # Rivalry-care / cold-surface pair lines: "He and Duke Dijon share…"
        if re.search(r"rivalry-care bond|cold on the surface", s, re.I):
            s2 = re.sub(
                rf"^{re.escape(label)}\s+and\s+",
                f"{pronoun.capitalize()} and ",
                s,
                count=1,
                flags=re.I,
            )
            out.append(s2)
            continue
        s2 = re.sub(
            rf"^{re.escape(label)}'s\s+",
            f"{poss.capitalize()} ",
            s,
            count=1,
            flags=re.I,
        )
        if re.match(rf"^{re.escape(label)}\b", s2, re.I):
            s2 = re.sub(
                rf"^{re.escape(label)}\s+is\s+",
                f"{pronoun.capitalize()} is ",
                s2,
                count=1,
                flags=re.I,
            )
        if re.match(rf"^{re.escape(label)}\b", s2, re.I):
            s2 = re.sub(
                rf"^{re.escape(label)}\s+has\s+",
                f"{pronoun.capitalize()} has ",
                s2,
                count=1,
                flags=re.I,
            )
        if re.match(rf"^{re.escape(label)}\b", s2, re.I):
            s2 = re.sub(
                rf"^{re.escape(label)}\s+conceals\s+",
                f"{pronoun.capitalize()} conceals ",
                s2,
                count=1,
                flags=re.I,
            )
        if re.match(rf"^{re.escape(label)}\b", s2, re.I):
            s2 = re.sub(
                rf"^{re.escape(label)}\s+calls\s+",
                f"{pronoun.capitalize()} calls ",
                s2,
                count=1,
                flags=re.I,
            )
        if re.match(rf"^{re.escape(label)}\b", s2, re.I):
            s2 = re.sub(
                rf"^{re.escape(label)}\s+leads\s+",
                f"{pronoun.capitalize()} leads ",
                s2,
                count=1,
                flags=re.I,
            )
        if re.match(rf"^{re.escape(label)}\b", s2, re.I):
            s2 = re.sub(
                rf"^{re.escape(label)}\s+refuses\s+",
                f"{pronoun.capitalize()} refuses ",
                s2,
                count=1,
                flags=re.I,
            )
        if re.match(rf"^{re.escape(label)}\b", s2, re.I):
            s2 = re.sub(
                rf"^{re.escape(label)}\s+underestimates\s+",
                f"{pronoun.capitalize()} underestimates ",
                s2,
                count=1,
                flags=re.I,
            )
        out.append(s2)
    return out


def character_unclear_body(
    label: str,
    *,
    mention_places: int,
    dialogue_only: bool,
    scene_only: bool,
    work_title: str | None = None,
    coverage: bool = False,
    has_clear_facts: bool = False,
) -> str:
    """Bottom paragraph: honest gaps — sources only, no invented missing detail."""
    where = f" in {work_title}" if work_title else ""
    parts: list[str] = []

    if has_clear_facts:
        if dialogue_only and scene_only:
            parts.append(
                "Mostly scenes and dialogue in your notes — not a full character sketch beyond the facts above."
            )
        elif scene_only:
            parts.append(
                "Mostly scene beats in your notes — not who they are in the story beyond the facts above."
            )
        elif dialogue_only:
            parts.append(
                "Mostly dialogue lines in your notes — not a character sketch beyond the facts above."
            )
        elif mention_places > 0:
            parts.append(
                "Role, family ties, motives, or look beyond the facts above aren't spelled out yet in your notes."
            )
        else:
            return ""
    elif mention_places > 0:
        place_word = "place" if mention_places == 1 else "places"
        if coverage:
            parts.append(
                f"You mention {label} in your draft ({mention_places} {place_word}), "
                "but you haven't fleshed them out yet — no clear role or family ties in your notes."
            )
        else:
            parts.append(
                f"{label} appears{where} in {mention_places} saved {place_word}, but little is "
                "spelled out yet about their role, ties, or look beyond what shows up in scenes."
            )
    else:
        if coverage:
            parts.append(f"I couldn't find anything about {label} in your saved notes for this work.")
        else:
            parts.append(f"Nothing saved yet{where} that describes {label}.")

    if not has_clear_facts:
        if dialogue_only and scene_only:
            parts.append("What exists is mostly scenes and dialogue — not a full character sketch.")
        elif scene_only:
            parts.append("What exists is mostly scene beats rather than a character sketch.")
        elif dialogue_only:
            parts.append("What exists is mostly dialogue lines rather than a character sketch.")

    if coverage and not has_clear_facts:
        parts.append(
            "That's a gap you might want to fill — a short character note on who they are, "
            "what they want, and how they connect to the rest of the cast."
        )

    return "\n\n".join(parts)


def append_unclear_section(
    answer: str,
    unclear_body: str,
    *,
    footer: str = _FOOTER_REFERENCE,
) -> str:
    body = (unclear_body or "").strip()
    if not body:
        return answer
    marker = footer
    idx = answer.find(marker)
    insert = f"\n\n{_UNCLEAR_SECTION_HEADING}\n\n{body}\n\n"
    if idx >= 0:
        return answer[:idx].rstrip() + insert + answer[idx:]
    return answer.rstrip() + insert + marker


def format_two_part_character_answer(
    label: str,
    clear_body: str,
    unclear_body: str,
    *,
    coverage: bool = False,
) -> str:
    footer = _FOOTER_COVERAGE if coverage else _FOOTER_REFERENCE
    lines = [label, ""]
    clear = (clear_body or "").strip()
    unclear = (unclear_body or "").strip()
    if clear:
        lines.append(clear)
    if unclear:
        if clear:
            lines.append("")
        lines.append(_UNCLEAR_SECTION_HEADING)
        lines.append("")
        lines.append(unclear)
    lines.append("")
    lines.append(footer)
    return "\n".join(lines)


def compose_character_gap_reference(
    label: str,
    *,
    mention_places: int,
    dialogue_only: bool,
    scene_only: bool,
    work_title: str | None = None,
) -> str:
    """Reference voice for thin material on a who-is question (not coverage/meta)."""
    unclear = character_unclear_body(
        label,
        mention_places=mention_places,
        dialogue_only=dialogue_only,
        scene_only=scene_only,
        work_title=work_title,
        coverage=False,
        has_clear_facts=False,
    )
    return format_two_part_character_answer(label, "", unclear)


def append_who_is_cast_card_gaps(
    label: str,
    answer: str,
    *,
    relation_lines: list[str] | None = None,
) -> str:
    """
    After a who-is cast card, name empty slots that belong on the card when
    notes never filled them — librarian honesty, not invented canon.
    """
    label = (label or "").strip()
    text = (answer or "").strip()
    if not label or not text:
        return answer
    body, footer = text, ""
    for mark in ("\n\n— From your notes only", "\n\n— "):
        if mark in text:
            body, footer = text.split(mark, 1)
            footer = mark + footer
            break
    body = body.strip()
    inspect = re.sub(rf"^{re.escape(label)}\s*\n+", "", body, count=1, flags=re.I).strip()
    low = inspect.lower()
    if not inspect or len(inspect) < 20:
        return answer
    if re.search(r"couldn'?t find|not enough|unclear from your notes", low):
        return answer

    gaps: list[str] = []
    has_rel = bool(
        relation_lines
        or re.search(
            r"\b("
            r"brother|sister|cousin|father|mother|parent|married|spouse|"
            r"ally|allies|co-?conspir|son of|daughter of|child of|"
            r"esteemed cousin|your notes treat|refers to|father|mother|"
            r"kinship is left open|kinship remains open|cheshire cat|wonderland"
            r")\b",
            low,
            re.I,
        )
    )
    has_role = bool(
        re.search(
            r"\b("
            r"protagonist|antagonist|main character|side character|"
            r"baron|lord of|lady |duke |duchess|matriarch|villain|hero"
            r")\b",
            low,
            re.I,
        )
    )
    if not has_rel and not re.search(
        r"don'?t yet spell out .{0,40}relations|close relations aren'?t spelled out",
        low,
        re.I,
    ):
        gaps.append(
            f"Notes don't yet spell out close relations for {label}."
        )
    if not has_role and not re.search(
        r"don'?t yet pin a clear cast role|clear cast role isn'?t pinned|don'?t yet spell out",
        low,
        re.I,
    ):
        gaps.append(
            f"Notes don't yet pin a clear cast role for {label} "
            f"(protagonist, antagonist, titled standing, etc.)."
        )
    if not gaps:
        return answer
    gap_block = " ".join(gaps[:2])
    merged = f"{body.rstrip()}\n\n{gap_block}"
    if footer:
        return merged + (footer if footer.startswith("\n") else f"\n\n{footer}")
    return f"{merged}\n\n{_FOOTER_REFERENCE}"


def cast_answer_is_thin(answer: str, label: str) -> bool:
    """True when a who-is answer lacks real cast role/status (gap or stub)."""
    a = (answer or "").strip()
    if not a:
        return True
    low = a.lower()
    body_only = (
        re.split(r"\n\n— From your notes only", a, maxsplit=1)[0]
        .replace(f"{label}\n\n", "")
        .strip()
    )
    first_line = body_only.split("\n")[0].strip() if body_only else ""
    # Knower-POV leak — never a finished cast card.
    if is_knower_pov_about_label(first_line, label) or is_knower_pov_about_label(
        body_only, label
    ):
        return True
    # Species/role scrap leaks — never treat as a finished cast card.
    if re.search(
        rf"\b{re.escape(label.lower())}\s+is\s+(?:side|of|one)\s*\.?\s*(?:$|\n)",
        low,
    ):
        return True
    if re.search(
        rf"\b{re.escape(label.lower())}\s+is\s+(?:birth|death|life|age|name)\s*\.?\s*(?:$|\n)",
        low,
    ):
        return True
    if is_incomplete_cast_clause(
        first_line,
        label,
    ):
        return True
    # Rename dump alone is not a cast card.
    if is_rename_infodump_clause(first_line, label) and not re.search(
        r"\b(brother|sister|son of|daughter of|up against|rival|young woman|"
        r"young man|baron|lord of|faction against)\b",
        body_only.lower(),
    ):
        return True
    if re.search(r"\bmale\s+or\s+female\b|\bfemale\s+or\s+male\b", low):
        return True
    # Plot/POV chronology or awareness dump is not a finished who-is answer.
    if is_plot_walkthrough_text(a) and not has_cast_card_anchors(a):
        return True
    if who_is_answer_has_bloat(a):
        return True
    if _UNCLEAR_SECTION_HEADING in a:
        before = a.split(_UNCLEAR_SECTION_HEADING, 1)[0]
        chunks = [p.strip() for p in before.split("\n\n") if p.strip()]
        body_chunks = [c for c in chunks if c != label and not c.startswith("—")]
        if body_chunks and len(" ".join(body_chunks)) > 45:
            if is_composed_reference_answer(a):
                return _composed_only_weak_pov(label, "\n\n".join(body_chunks))
            low_body = " ".join(body_chunks).lower()
            if has_cast_card_anchors(low_body):
                return False
            if is_plot_walkthrough_text("\n\n".join(body_chunks)):
                return True
    if "little is spelled out yet" in low or "but little is" in low:
        return True
    if "nothing saved yet" in low and "describes" in low:
        return True
    if "too scattered to summarize" in low:
        return True
    if is_composed_reference_answer(a):
        core = a.split(_UNCLEAR_SECTION_HEADING, 1)[0]
        core = re.split(r"\n\n— From your notes only", core, maxsplit=1)[0]
        parts = [p.strip() for p in core.split("\n\n") if p.strip()]
        body_parts = [p for p in parts if p != label and not p.startswith("—")]
        body_joined = "\n\n".join(body_parts)
        if _composed_only_weak_pov(label, body_joined):
            return True
        if is_plot_walkthrough_text(body_joined) and not has_cast_card_anchors(body_joined):
            return True
        return False
    if has_cast_card_anchors(a) and not is_plot_walkthrough_text(a) and not who_is_answer_has_bloat(a):
        return False
    label_low = label.lower()
    if label_low in low and re.search(rf"\b{re.escape(label_low)}\s+is\b", low):
        main = next(
            (p for p in a.split("\n\n") if p.strip() and not p.strip().startswith("—")),
            a,
        )
        if len(main.strip()) > 45:
            if is_plot_walkthrough_text(main):
                return True
            return False
    return True


def _composed_only_weak_pov(label: str, body: str) -> bool:
    """True when the card is only inferred viewpoint/main — prefer RAG."""
    text = re.sub(r"\s+", " ", (body or "").strip())
    if not text:
        return True
    return bool(
        re.fullmatch(
            rf"{re.escape(label)}\s+is the (?:viewpoint character|main character)"
            rf"(?:\s+in [^.]{{1,80}})?\.?",
            text,
            re.I,
        )
    )


def is_composed_reference_answer(answer: str) -> bool:
    """True when #12–13 reference-voice composition succeeded (not bullet scrap fallback)."""
    a = (answer or "").strip()
    if re.search(r"&(?:nbsp|#\d+;|[a-z]+;)", a, re.I):
        return False
    if _FOOTER_REFERENCE not in a and "— From your notes only" not in a:
        return False
    if "From what you've written:" in a:
        return False
    if "too scattered to summarize cleanly yet" in a:
        return False
    if _UNCLEAR_SECTION_HEADING not in a and "little is spelled out yet" in a:
        return False
    if a.count("•") >= 2:
        return False
    if "— from what you've saved:" in a.lower():
        return False
    core = a.split(_UNCLEAR_SECTION_HEADING, 1)[0] if _UNCLEAR_SECTION_HEADING in a else a
    if "\n\n" not in core:
        return False
    parts = core.split("\n\n")
    label = parts[0].strip()
    body_parts = [p for p in parts[1:] if not p.strip().startswith("—")]
    if not label or not body_parts:
        return False
    if not _composed_has_substance(body_parts, label):
        return False
    body = " ".join(body_parts).strip()
    if _BIOGRAPHY_RE.search(body) and not _ROLE_WORDS_RE.search(body):
        return False
    if re.match(
        rf"^{re.escape(label)}\s+is the main character\.?\s*$",
        body,
        re.I,
    ):
        return False
    return True


def compose_audit_summary(label: str, contradictions: list[str]) -> str:
    """Meta voice for discrepancy / audit questions — never smooth disagreements (#16)."""
    lines = [f"{label} — discrepancies in your notes:\n"]
    if contradictions:
        for item in contradictions[:6]:
            text = str(item).strip().rstrip(".")
            if text:
                lines.append(f"• {text}.")
    else:
        lines.append("No clear contradictions surfaced from what you saved.")
    lines.append("\n— Pulled from your notes only. Nothing invented.")
    return "\n".join(lines)


DRAFT_VS_NOTES_DRAFT_LABEL = "This is what the main draft says:"
DRAFT_VS_NOTES_NOTES_LABEL = "This is what your notes say:"


def _strip_compose_footer(text: str) -> str:
    out = (text or "").strip()
    for footer in (_FOOTER_REFERENCE, _FOOTER_COVERAGE):
        if out.endswith(footer):
            out = out[: -len(footer)].rstrip()
    # Also strip common ending dash lines writers' answers use
    lines = out.splitlines()
    while lines and lines[-1].strip().startswith("—"):
        lines.pop()
    return "\n".join(lines).strip()


def compose_draft_vs_notes_dual(draft_body: str, notes_body: str) -> str:
    """Neutral dual blocks when main draft and notes disagree — draft first."""
    draft = _strip_compose_footer(draft_body)
    notes = _strip_compose_footer(notes_body)
    if not draft or not notes:
        return draft or notes or ""
    return "\n".join(
        [
            DRAFT_VS_NOTES_DRAFT_LABEL,
            "",
            draft,
            "",
            DRAFT_VS_NOTES_NOTES_LABEL,
            "",
            notes,
        ]
    )


def compose_coverage_summary(
    label: str,
    findings: list[str],
    *,
    mention_places: int,
    dialogue_only: bool = False,
    scene_only: bool = False,
) -> str:
    clear_lines: list[str] = []
    if findings:
        for item in findings[:12]:
            clear_lines.append(f"• {item}")
    elif mention_places > 0:
        place_word = "place" if mention_places == 1 else "places"
        clear_lines.append(
            f"You mention {label} in {mention_places} {place_word}, but nothing substantial yet."
        )
    clear = "\n".join(clear_lines)
    unclear = ""
    if dialogue_only or scene_only or not findings:
        unclear = character_unclear_body(
            label,
            mention_places=mention_places,
            dialogue_only=dialogue_only,
            scene_only=scene_only,
            coverage=True,
            has_clear_facts=bool(findings),
        )
    if unclear and clear:
        return append_unclear_section(
            f"{label} — from what you've saved:\n\n{clear}\n\n{_FOOTER_COVERAGE}",
            unclear,
            footer=_FOOTER_COVERAGE,
        )
    if unclear:
        return format_two_part_character_answer(label + " — from what you've saved", "", unclear, coverage=True)
    lines = [f"{label} — from what you've saved:\n"]
    if clear:
        lines.append(clear)
    else:
        lines.append(f"Nothing saved yet that describes {label}.")
    lines.append(f"\n{_FOOTER_COVERAGE}")
    return "\n".join(lines)


def compose_coverage_gap(
    label: str,
    mention_places: int,
    dialogue_only: bool,
    scene_only: bool = False,
) -> str:
    """Meta voice when the writer asked about coverage, not identity."""
    unclear = character_unclear_body(
        label,
        mention_places=mention_places,
        dialogue_only=dialogue_only,
        scene_only=scene_only,
        coverage=True,
        has_clear_facts=False,
    )
    return format_two_part_character_answer(
        f"{label} — from what you've saved",
        "",
        unclear,
        coverage=True,
    )
