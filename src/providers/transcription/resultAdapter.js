export function transcriptFromPlainText(text, extras = {}) {
  return {
    text: String(text || ""),
    words: Array.isArray(extras.words) ? extras.words : [],
    segments: Array.isArray(extras.segments) ? extras.segments : [],
    language: typeof extras.language === "string" ? extras.language : "",
    durationSec: coerceNumber(extras.durationSec ?? extras.duration),
  };
}

export function mapWordList(words, mapper) {
  if (!Array.isArray(words)) return [];
  return words
    .map((word) => mapper(word))
    .filter((word) => word && typeof word.text === "string" && word.text.trim())
    .map((word) => ({
      text: String(word.text).trim(),
      start: coerceNumber(word.start),
      end: coerceNumber(word.end),
      speaker: normalizeSpeaker(word.speaker),
      confidence: coerceNumber(word.confidence),
    }));
}

export function mapSegmentList(segments, mapper) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((segment) => mapper(segment))
    .filter((segment) => segment && typeof segment.text === "string" && segment.text.trim())
    .map((segment) => ({
      text: String(segment.text).trim(),
      start: coerceNumber(segment.start),
      end: coerceNumber(segment.end),
      speaker: normalizeSpeaker(segment.speaker),
    }));
}

export function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extensionFromMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("flac")) return "flac";
  return "bin";
}

export function secondsFromDuration(value) {
  return coerceNumber(value);
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
