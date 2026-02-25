export function buildSoapNoteFromTranscript(transcript) {
  const text = transcript || "";

  const sections = {
    subjective: extractSentences(text, ["reports", "complains", "states", "history"]),
    objective: extractSentences(text, ["exam", "vitals", "notable", "positive", "negative"]),
    assessment: extractSentences(text, ["assessment", "diagnosis", "consistent with", "likely"]),
    plan: extractSentences(text, ["start", "prescribe", "return", "follow", "plan"]),
  };

  const noteText = [
    "S: " + (sections.subjective || "Patient-reported history documented in transcript."),
    "O: " + (sections.objective || "Objective findings to be confirmed by clinician."),
    "A: " + (sections.assessment || "Assessment pending clinician review."),
    "P: " + (sections.plan || "Plan pending clinician confirmation."),
  ].join("\n");

  return { noteText, sections };
}

function extractSentences(text, keywords) {
  const sentences = splitSentences(text);
  const matches = sentences.filter((sentence) =>
    keywords.some((keyword) => sentence.toLowerCase().includes(keyword)),
  );
  return matches.join(" ") || "";
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

