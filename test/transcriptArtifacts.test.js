import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTranscriptDocument,
  normalizeTranscriptText,
  searchTranscriptDocument,
} from "../src/services/transcriptArtifacts.js";

test("normalizeTranscriptText collapses whitespace without changing language content", () => {
  assert.equal(
    normalizeTranscriptText("Patienten\n har   ont i   halsen.\tTemp 38,2."),
    "Patienten har ont i halsen. Temp 38,2.",
  );
});

test("buildTranscriptDocument preserves timing metadata when provided", () => {
  const document = buildTranscriptDocument({
    text: "Patienten har ömhet i bröstet.",
    language: "sv",
    words: [
      { text: "Patienten", start: 0.0, end: 0.4 },
      { text: "har", start: 0.41, end: 0.6 },
      { text: "ömhet", start: 0.61, end: 1.0 },
      { text: "i", start: 1.01, end: 1.1 },
      { text: "bröstet.", start: 1.11, end: 1.5 },
    ],
    segments: [
      { text: "Patienten har ömhet i bröstet.", start: 0.0, end: 1.5 },
    ],
  }, { locale: "sv-SE", country: "SE" });

  assert.equal(document.language, "sv");
  assert.equal(document.locale, "sv-SE");
  assert.equal(document.country, "SE");
  assert.equal(document.meta.hasWordTimestamps, true);
  assert.equal(document.meta.hasSegmentTimestamps, true);
  assert.equal(document.words[2].text, "ömhet");
  assert.equal(document.segments[0].wordStartIndex, 0);
});

test("searchTranscriptDocument matches Swedish text accent-insensitively", () => {
  const document = buildTranscriptDocument({
    text: "Patienten har ömhet i bröstet och ny hosta sedan igår.",
  });

  const accentFolded = searchTranscriptDocument(document, "omhet");
  const phrase = searchTranscriptDocument(document, "ny hosta");

  assert.equal(accentFolded.length, 1);
  assert.match(accentFolded[0].excerpt, /ömhet/i);
  assert.equal(phrase.length, 1);
  assert.equal(phrase[0].text.toLowerCase(), "ny hosta");
});
