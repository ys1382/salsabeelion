(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.StitchCalculatorCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const ORDINALS = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
  };

  function toInt(value) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }

  function ordinalToNumber(value) {
    if (!value) return null;
    const raw = String(value).toLowerCase().trim();
    if (ORDINALS[raw]) return ORDINALS[raw];
    const stripped = raw.replace(/(st|nd|rd|th)$/i, "");
    return toInt(stripped);
  }

  function extractStitchCount(line) {
    const patterns = [/<\s*(\d+)(?:[^>]*)>/, /\(\s*(\d+)\s*\)/, /(\d+)\s*sts?\b/i];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return toInt(match[1]);
    }
    return null;
  }

  function detectPrimaryStitchType(line) {
    const lower = line.toLowerCase();
    if (/\bdc\b|double crochet/.test(lower)) return "dc";
    if (/\bhdc\b|half double crochet/.test(lower)) return "hdc";
    if (/\bsc\b|single crochet/.test(lower)) return "sc";
    if (/\btr\b|treble crochet/.test(lower)) return "tr";
    if (/\bch\b|chain/.test(lower)) return "ch";
    return "unknown";
  }

  function detectTags(line) {
    const lower = line.toLowerCase();
    const tags = [];
    if (lower.includes("mesh")) tags.push("mesh");
    if (lower.includes("shell")) tags.push("shell");
    if (lower.includes("brim")) tags.push("brim");
    if (/\b(increase|inc|2\s*(sc|dc|hdc|tr)\s+in)\b/i.test(lower)) tags.push("increase");
    if (/\b(decrease|dec|tog)\b/i.test(lower)) tags.push("decrease");
    if (lower.includes("repeat")) tags.push("repeat");
    if (/\bjoin|joined|joining\b/i.test(lower)) tags.push("join");
    return tags;
  }

  function parseComputedStitchMath(line) {
    const repeatMatch = line.match(/\(([^)]+)\)\s*(?:x|×|repeat)\s*(\d+)/i);
    if (!repeatMatch) return { computed: null, multiplier: null };
    const inner = repeatMatch[1];
    const multiplier = toInt(repeatMatch[2]);
    if (!multiplier) return { computed: null, multiplier: null };
    const stitchTokens = [...inner.matchAll(/(\d+)\s*(?:sc|dc|hdc|tr|sts?|st)\b/gi)];
    if (!stitchTokens.length) return { computed: null, multiplier };
    const perRepeat = stitchTokens.reduce((sum, token) => sum + toInt(token[1]), 0);
    return { computed: perRepeat * multiplier, multiplier };
  }

  function parseRowNumber(line) {
    const single = line.match(/\brow\s*(\d+)\b/i);
    if (single) return { rowNumber: toInt(single[1]), line };
    return null;
  }

  function parseRepeatBlocks(text) {
    const blocks = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(
        /rows?\s*(\d+)\s*[-–]\s*(\d+)\s*:\s*(?:continue\s+)?repeat(?:ing)?\s+rows?\s*(\d+)\s*(?:[-–]|through)\s*(\d+)/i
      );
      if (!match) continue;
      blocks.push({
        targetStart: toInt(match[1]),
        targetEnd: toInt(match[2]),
        sourceStart: toInt(match[3]),
        sourceEnd: toInt(match[4]),
      });
    }
    return blocks;
  }

  function parsePatternText(text) {
    const rows = [];
    const repeatBlocks = parseRepeatBlocks(text);
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const rowInfo = parseRowNumber(line);
      if (!rowInfo) continue;
      const { computed, multiplier } = parseComputedStitchMath(line);
      rows.push({
        rowNumber: rowInfo.rowNumber,
        tags: detectTags(line),
        stitchCount: extractStitchCount(line),
        computedStitchCount: computed,
        repeatMultiplier: multiplier,
        stitchType: detectPrimaryStitchType(line),
        sourceLine: line,
      });
    }
    return { rows, repeatBlocks };
  }

  function isMeshLikeRow(row) {
    if (row.tags.includes("mesh")) return true;
    const lower = row.sourceLine.toLowerCase();
    const hasCh = /\bch\b|chain/.test(lower);
    const hasSpace = /space|sp\b/.test(lower);
    const hasSolid = /\bdc\b|\bsc\b|\bhdc\b|\btr\b|double crochet|single crochet|half double crochet|treble crochet/.test(lower);
    return (hasCh && hasSpace) && !hasSolid;
  }

  function detectTrend(parsed) {
    const rowsWithCounts = parsed.rows
      .filter((r) => r.stitchCount != null)
      .sort((a, b) => a.rowNumber - b.rowNumber);
    const candidates = rowsWithCounts.filter((r) => !isMeshLikeRow(r));
    const groups = new Map();
    for (const row of candidates) {
      const key = row.stitchType || "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    let best = null;
    for (const [stitchType, group] of groups.entries()) {
      if (group.length < 3) continue;
      const deltas = [];
      for (let i = 1; i < group.length; i += 1) {
        const rowDiff = group[i].rowNumber - group[i - 1].rowNumber;
        if (rowDiff <= 0) continue;
        const countDiff = group[i].stitchCount - group[i - 1].stitchCount;
        deltas.push({ perRow: countDiff / rowDiff, raw: countDiff });
      }
      if (!deltas.length) continue;
      const rounded = deltas.map((d) => Math.round(d.perRow * 1000) / 1000);
      const mode = rounded
        .map((v) => ({ v, c: rounded.filter((x) => x === v).length }))
        .sort((a, b) => b.c - a.c)[0];
      const matchCount = rounded.filter((v) => v === mode.v).length;
      const trendBreak = matchCount !== rounded.length;
      const candidate = {
        stitchType,
        deltaPerRow: mode.v,
        baseRow: group[0].rowNumber,
        baseCount: group[0].stitchCount,
        strength: matchCount,
        trendBreak,
      };
      if (!best || candidate.strength > best.strength) best = candidate;
    }
    return best;
  }

  function projectCountFromTrend(rowNumber, trend) {
    if (!trend) return null;
    const offset = rowNumber - trend.baseRow;
    return Math.round((trend.baseCount + trend.deltaPerRow * offset) * 1000) / 1000;
  }

  function findNthTaggedRow(rows, tag, n) {
    const tagged = rows.filter((row) => row.tags.includes(tag));
    return tagged[n - 1] || null;
  }

  function resolveRepeatRow(question, parsed) {
    const match = question.toLowerCase().match(/(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+repeat.*row\s*(\d+)/i);
    if (!match) return null;
    const repeatWord = match[1];
    const localRow = toInt(match[2]);
    const repeatNumber = ordinalToNumber(repeatWord);
    if (!repeatNumber || !localRow) return null;

    for (const block of parsed.repeatBlocks) {
      const span = block.sourceEnd - block.sourceStart + 1;
      if (span <= 0) continue;
      const offsetInside = localRow - block.sourceStart;
      if (offsetInside < 0 || offsetInside >= span) continue;
      const target = block.sourceStart + (repeatNumber - 1) * span + offsetInside;
      if (target >= block.targetStart && target <= block.targetEnd) {
        return target;
      }
    }
    return null;
  }

  function resolveInformalReference(question, parsed) {
    const lower = question.toLowerCase();
    const types = ["mesh", "shell", "brim", "increase", "decrease"];
    for (const type of types) {
      const typeRef = lower.match(new RegExp("(first|second|third|fourth|fifth|\\d+(?:st|nd|rd|th)?)\\s+" + type + "\\s+row"));
      const aboveRef = lower.match(/(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+row above/);
      if (typeRef && aboveRef) {
        const typeN = ordinalToNumber(typeRef[1]);
        const aboveN = ordinalToNumber(aboveRef[1]);
        if (!typeN || !aboveN) continue;
        const anchor = findNthTaggedRow(parsed.rows, type, typeN);
        if (anchor) return anchor.rowNumber - aboveN;
      }
    }
    return null;
  }

  function resolveLabelReference(question, parsed) {
    const lower = question.toLowerCase();
    const afterLabel = lower.match(/row\s+after\s+the\s+([a-z\s]+?)\s+row/);
    if (afterLabel) {
      const label = afterLabel[1].trim();
      const row = parsed.rows.find((r) => r.sourceLine.toLowerCase().includes(label));
      if (row) return row.rowNumber + 1;
    }
    if (/row after the brim join/i.test(question)) {
      const brimJoin = parsed.rows.find((r) => r.tags.includes("brim") && r.tags.includes("join"));
      if (brimJoin) return brimJoin.rowNumber + 1;
    }
    return null;
  }

  function resolveRepeatLabel(question, parsed) {
    const lower = question.toLowerCase();
    const match = lower.match(/(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+repeat\s+of\s+the\s+([a-z]+)\s+row/);
    if (!match) return { rowNumber: null, repeatPosition: null };
    const nth = ordinalToNumber(match[1]);
    const label = match[2];
    if (!nth) return { rowNumber: null, repeatPosition: null };
    const row = findNthTaggedRow(parsed.rows, label, nth);
    if (!row) return { rowNumber: null, repeatPosition: match[1] };
    return { rowNumber: row.rowNumber, repeatPosition: match[1] };
  }

  function verifyResult(parsed, rowNumber, stitchCount, projectedFromTrend) {
    const verificationRow = parsed.rows.find((row) => row.rowNumber === rowNumber) || null;
    let mismatchDetected = false;
    if (verificationRow && verificationRow.stitchCount != null && verificationRow.computedStitchCount != null) {
      mismatchDetected = verificationRow.stitchCount !== verificationRow.computedStitchCount;
    }
    if (verificationRow && stitchCount != null && verificationRow.stitchCount != null) {
      mismatchDetected = mismatchDetected || stitchCount !== verificationRow.stitchCount;
    }
    if (projectedFromTrend && verificationRow && verificationRow.stitchCount != null) {
      mismatchDetected = mismatchDetected || projectedFromTrend !== verificationRow.stitchCount;
    }
    return { verificationRow, mismatchDetected };
  }

  function deriveConfidence(result, parsedRow, inferred) {
    if (result.uncertainty) return "low";
    if (result.mismatchDetected) return "low";
    if (parsedRow && parsedRow.stitchCount != null && !inferred) return "high";
    return "medium";
  }

  function buildResult(base) {
    const out = {
      rowNumber: base.rowNumber ?? null,
      stitchCount: base.stitchCount ?? null,
      repeatPosition: base.repeatPosition ?? null,
      confidenceLevel: base.confidenceLevel ?? "low",
      reasoning: base.reasoning || "",
      uncertainty: Boolean(base.uncertainty),
      mismatchDetected: Boolean(base.mismatchDetected),
      resultType: base.resultType || "unclear",
    };
    return out;
  }

  function analyzePattern(input) {
    const patternText = (input && input.patternText) || "";
    const question = ((input && input.question) || "").trim();
    const parsed = parsePatternText(patternText);
    const trend = detectTrend(parsed);
    const lower = question.toLowerCase();

    if (!question || /what row am i on\??$/i.test(question)) {
      return buildResult({
        uncertainty: true,
        reasoning: "Need a positional reference to identify a likely row.",
        resultType: "unclear",
      });
    }

    let rowNumber = null;
    let repeatPosition = null;
    let inferred = false;

    const directRow = lower.match(/\brow\s*(\d+)\b/);
    if (directRow) rowNumber = toInt(directRow[1]);

    const repeatRow = resolveRepeatRow(question, parsed);
    if (repeatRow != null) {
      rowNumber = repeatRow;
      inferred = true;
      const repMatch = lower.match(/(first|second|third|\d+(?:st|nd|rd|th)?)\s+repeat/i);
      repeatPosition = repMatch ? repMatch[1] : null;
    }

    const informal = resolveInformalReference(question, parsed);
    if (informal != null) {
      rowNumber = informal;
      inferred = true;
    }

    const labelResolved = resolveLabelReference(question, parsed);
    if (labelResolved != null) {
      rowNumber = labelResolved;
      inferred = true;
    }

    const repeatLabelResolved = resolveRepeatLabel(question, parsed);
    if (repeatLabelResolved.rowNumber != null) {
      rowNumber = repeatLabelResolved.rowNumber;
      repeatPosition = repeatLabelResolved.repeatPosition;
      inferred = true;
    } else if (repeatLabelResolved.repeatPosition && !repeatPosition) {
      repeatPosition = repeatLabelResolved.repeatPosition;
    }

    let parsedRow = parsed.rows.find((row) => row.rowNumber === rowNumber) || null;
    if (!parsedRow && inferred) {
      for (const block of parsed.repeatBlocks) {
        if (rowNumber < block.targetStart || rowNumber > block.targetEnd) continue;
        const inferredSourceRowNumber = block.sourceStart + (rowNumber - block.targetStart);
        parsedRow = parsed.rows.find((row) => row.rowNumber === inferredSourceRowNumber) || null;
        if (parsedRow) break;
      }
    }
    let stitchCount = parsedRow ? parsedRow.stitchCount : null;
    let projectedFromTrend = null;

    if (stitchCount == null && parsedRow && parsedRow.computedStitchCount != null) {
      stitchCount = parsedRow.computedStitchCount;
      inferred = true;
    }

    if (stitchCount == null && rowNumber != null && trend) {
      const meshQuestion = /\bmesh\b/.test(lower);
      if (!(meshQuestion && trend.stitchType === "dc")) {
        projectedFromTrend = projectCountFromTrend(rowNumber, trend);
        if (projectedFromTrend != null) {
          stitchCount = projectedFromTrend;
          inferred = true;
        }
      }
    }

    if (!rowNumber) {
      return buildResult({
        uncertainty: true,
        reasoning: "Could not resolve row reference from the question and provided rows.",
        resultType: "unclear",
      });
    }

    const verification = verifyResult(parsed, rowNumber, stitchCount, projectedFromTrend);
    const mismatchDetected = verification.mismatchDetected || Boolean(trend && trend.trendBreak);

    const uncertainty = !parsedRow && stitchCount == null;
    const reasoning = mismatchDetected
      ? projectedFromTrend != null
        ? "Best guess uses detected stitch-count trend, but explicit counts show mismatch or a trend break."
        : "Resolved row, but parsed stitch math mismatches explicit stitch count."
      : uncertainty
        ? "Resolved row reference, but no explicit row metadata found."
        : projectedFromTrend != null
          ? `Best guess assumes visible ${trend.deltaPerRow >= 0 ? "+" : ""}${trend.deltaPerRow} ${trend.stitchType} trend continues${parsed.repeatBlocks.length ? " through repeat sections" : ""}.`
        : inferred
          ? "Resolved from repeat/label clues and verified against parsed metadata."
          : "Row reference resolved and verified against parsed row metadata.";

    const confidenceLevel = deriveConfidence(
      { uncertainty, mismatchDetected },
      parsedRow,
      inferred
    );

    const resultType = uncertainty ? "unclear" : inferred ? "estimated" : "exact";

    return buildResult({
      rowNumber,
      stitchCount,
      repeatPosition,
      confidenceLevel,
      reasoning,
      uncertainty,
      mismatchDetected,
      resultType,
    });
  }

  return {
    parsePatternText,
    analyzePattern,
  };
});
