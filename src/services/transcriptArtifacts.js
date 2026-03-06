const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function buildTranscriptDocument(source, context = {}) {
  const rawText = extractText(source);
  const text = normalizeTranscriptText(rawText);
  const words = normalizeWords(source?.words, text);
  const hydratedWords = words.length ? attachWordCharOffsets(words, text) : inferWordsFromText(text);
  const segments = normalizeSegments(source?.segments, text, hydratedWords);

  return {
    schemaVersion: 1,
    rawText,
    text,
    language: stringOrEmpty(source?.language || context.language),
    locale: stringOrEmpty(context.locale),
    country: stringOrEmpty(context.country),
    durationSec: coerceNumber(source?.durationSec ?? source?.duration),
    words: hydratedWords,
    segments,
    meta: {
      wordCount: hydratedWords.length,
      segmentCount: segments.length,
      hasWordTimestamps: hydratedWords.some(hasWordTiming),
      hasSegmentTimestamps: segments.some(hasSegmentTiming),
      normalization: "whitespace-collapse",
    },
  };
}

export function searchTranscriptDocument(document, query, opts = {}) {
  const safeDocument = buildTranscriptDocument(document || {});
  const normalizedQuery = String(query || "").trim();
  const queryTokens = tokenizeForSearch(normalizedQuery);
  const limit = clampLimit(opts.limit);

  if (!queryTokens.length || !safeDocument.words.length) {
    return [];
  }

  const matches = [];
  const searchableWords = safeDocument.words.filter((word) => word.normalized);
  const width = queryTokens.length;

  for (let index = 0; index < searchableWords.length; index += 1) {
    const slice = searchableWords.slice(index, index + width);
    if (slice.length !== width) continue;

    const exact = slice.every((word, tokenIndex) => word.normalized === queryTokens[tokenIndex]);
    const partial = width === 1 && slice[0].normalized.includes(queryTokens[0]);

    if (!exact && !partial) continue;

    const startWord = slice[0];
    const endWord = slice[slice.length - 1];
    const segment = findSegmentForWordRange(safeDocument.segments, startWord.index, endWord.index);
    matches.push({
      text: slice.map((word) => word.text).join(" "),
      normalizedQuery,
      score: exact ? 1 : 0.7,
      wordStartIndex: startWord.index,
      wordEndIndex: endWord.index,
      segmentIndex: segment?.index ?? null,
      startSec: startWord.startSec ?? segment?.startSec ?? null,
      endSec: endWord.endSec ?? segment?.endSec ?? null,
      charStart: startWord.charStart ?? null,
      charEnd: endWord.charEnd ?? null,
      excerpt: buildExcerpt(safeDocument.text, startWord.charStart, endWord.charEnd),
    });
  }

  matches.sort((a, b) => b.score - a.score || a.wordStartIndex - b.wordStartIndex);
  return dedupeMatches(matches).slice(0, limit);
}

export function normalizeTranscriptText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function extractText(source) {
  if (typeof source === "string") return source;
  if (typeof source?.text === "string" && source.text.trim()) return source.text;
  if (Array.isArray(source?.segments) && source.segments.length) {
    return source.segments
      .map((segment) => stringOrEmpty(segment?.text))
      .filter(Boolean)
      .join(" ");
  }
  if (Array.isArray(source?.words) && source.words.length) {
    return source.words
      .map((word) => stringOrEmpty(word?.word ?? word?.text))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function normalizeWords(words, transcriptText) {
  if (!Array.isArray(words) || !words.length) return [];

  return words
    .map((word, index) => {
      const text = normalizeTranscriptText(word?.word ?? word?.text ?? "");
      if (!text) return null;
      return {
        index,
        text,
        normalized: normalizeToken(text),
        startSec: coerceNumber(word?.start ?? word?.startSec),
        endSec: coerceNumber(word?.end ?? word?.endSec),
        confidence: coerceNumber(word?.confidence),
        speaker: normalizeSpeaker(word?.speaker),
        charStart: coerceNumber(word?.charStart),
        charEnd: coerceNumber(word?.charEnd),
      };
    })
    .filter(Boolean)
    .slice(0, countSearchableWords(transcriptText) || undefined);
}

function normalizeSegments(segments, transcriptText, words) {
  if (!Array.isArray(segments) || !segments.length) {
    return inferSegmentsFromWords(words, transcriptText);
  }

  let cursor = 0;
  return segments
    .map((segment, index) => {
      const text = normalizeTranscriptText(segment?.text || "");
      const tokenCount = countSearchableWords(text);
      const wordStartIndex = tokenCount && cursor < words.length ? cursor : null;
      const wordEndIndex = tokenCount && cursor < words.length
        ? Math.min(words.length - 1, cursor + tokenCount - 1)
        : null;
      if (tokenCount) cursor += tokenCount;

      return {
        index,
        text: text || inferTextFromWordRange(words, wordStartIndex, wordEndIndex),
        normalizedText: normalizeTranscriptText(text),
        startSec: coerceNumber(segment?.start ?? segment?.startSec),
        endSec: coerceNumber(segment?.end ?? segment?.endSec),
        speaker: normalizeSpeaker(segment?.speaker),
        wordStartIndex,
        wordEndIndex,
      };
    })
    .filter((segment) => segment.text);
}

function inferWordsFromText(text) {
  const words = [];
  for (const match of String(text || "").matchAll(WORD_PATTERN)) {
    words.push({
      index: words.length,
      text: match[0],
      normalized: normalizeToken(match[0]),
      startSec: null,
      endSec: null,
      confidence: null,
      speaker: null,
      charStart: match.index,
      charEnd: match.index + match[0].length,
    });
  }
  return words;
}

function inferSegmentsFromWords(words, text) {
  if (!words.length && !text) return [];
  if (!words.length) {
    return [{
      index: 0,
      text,
      normalizedText: text,
      startSec: null,
      endSec: null,
      speaker: null,
      wordStartIndex: null,
      wordEndIndex: null,
    }];
  }

  const segments = [];
  let start = 0;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const next = words[index + 1];
    const gap = hasWordTiming(word) && hasWordTiming(next) ? next.startSec - word.endSec : 0;
    const boundary = /[.!?]$/.test(word.text) || gap > 1.2 || index === words.length - 1;
    if (!boundary) continue;

    segments.push(buildSegmentFromWordRange(segments.length, words, start, index));
    start = index + 1;
  }

  return segments.length ? segments : [buildSegmentFromWordRange(0, words, 0, words.length - 1)];
}

function buildSegmentFromWordRange(index, words, startIndex, endIndex) {
  const slice = words.slice(startIndex, endIndex + 1);
  return {
    index,
    text: slice.map((word) => word.text).join(" "),
    normalizedText: slice.map((word) => word.text).join(" "),
    startSec: slice[0]?.startSec ?? null,
    endSec: slice[slice.length - 1]?.endSec ?? null,
    speaker: dominantSpeaker(slice),
    wordStartIndex: startIndex,
    wordEndIndex: endIndex,
  };
}

function attachWordCharOffsets(words, transcriptText) {
  const text = String(transcriptText || "");
  let cursor = 0;

  return words.map((word) => {
    if (Number.isFinite(word.charStart) && Number.isFinite(word.charEnd)) {
      cursor = word.charEnd;
      return word;
    }

    const variants = [word.text, trimTokenEdgePunctuation(word.text)].filter(Boolean);
    let charStart = null;
    let charEnd = null;

    for (const candidate of variants) {
      const foundAt = text.toLowerCase().indexOf(candidate.toLowerCase(), cursor);
      if (foundAt >= 0) {
        charStart = foundAt;
        charEnd = foundAt + candidate.length;
        cursor = charEnd;
        break;
      }
    }

    return {
      ...word,
      charStart,
      charEnd,
    };
  });
}

function tokenizeForSearch(text) {
  return [...foldForSearch(text).matchAll(WORD_PATTERN)].map((match) => match[0]);
}

function normalizeToken(text) {
  const tokens = tokenizeForSearch(text);
  return tokens[0] || "";
}

function foldForSearch(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

function findSegmentForWordRange(segments, startIndex, endIndex) {
  return segments.find((segment) => (
    Number.isInteger(segment.wordStartIndex)
    && Number.isInteger(segment.wordEndIndex)
    && segment.wordStartIndex <= startIndex
    && segment.wordEndIndex >= endIndex
  ));
}

function buildExcerpt(text, start, end) {
  if (!String(text || "").length) return "";
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return String(text).slice(0, 160);
  }

  const safeStart = Math.max(0, start - 40);
  const safeEnd = Math.min(String(text).length, end + 40);
  return String(text).slice(safeStart, safeEnd).trim();
}

function dedupeMatches(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    const key = `${match.wordStartIndex}:${match.wordEndIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dominantSpeaker(words) {
  const counts = new Map();
  for (const word of words) {
    if (word.speaker === null || word.speaker === undefined) continue;
    counts.set(word.speaker, (counts.get(word.speaker) || 0) + 1);
  }
  let bestSpeaker = null;
  let bestCount = -1;
  for (const [speaker, count] of counts) {
    if (count > bestCount) {
      bestSpeaker = speaker;
      bestCount = count;
    }
  }
  return bestSpeaker;
}

function inferTextFromWordRange(words, startIndex, endIndex) {
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) return "";
  return words.slice(startIndex, endIndex + 1).map((word) => word.text).join(" ");
}

function trimTokenEdgePunctuation(text) {
  return String(text || "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function countSearchableWords(text) {
  return tokenizeForSearch(text).length;
}

function hasWordTiming(word) {
  return Number.isFinite(word?.startSec) && Number.isFinite(word?.endSec);
}

function hasSegmentTiming(segment) {
  return Number.isFinite(segment?.startSec) && Number.isFinite(segment?.endSec);
}

function normalizeSpeaker(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function coerceNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/s$/i, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || 5), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 5;
  return Math.min(parsed, 25);
}
