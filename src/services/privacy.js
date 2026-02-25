export function maybeRedactForProvider({ config, providerName, transcript }) {
  const shouldRedact =
    config.privacy?.redactBeforeApiCalls &&
    (providerName === "openai" || providerName === "anthropic" || providerName === "gemini");

  if (!shouldRedact) {
    return { text: transcript, redactionApplied: false, redactionSummary: [] };
  }

  const mode = config.privacy?.phiRedactionMode || "basic";
  if (mode === "off") {
    return { text: transcript, redactionApplied: false, redactionSummary: [] };
  }

  return redactBasicPhi(transcript);
}

export function redactBasicPhi(input) {
  let text = String(input || "");
  const redactionSummary = [];

  text = replace(text, /\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED-SSN]", redactionSummary, "ssn");
  text = replace(
    text,
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g,
    "[REDACTED-PHONE]",
    redactionSummary,
    "phone",
  );
  text = replace(
    text,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[REDACTED-EMAIL]",
    redactionSummary,
    "email",
  );
  text = replace(
    text,
    /\b(?:DOB|Date of Birth)\s*[:\-]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    "DOB: [REDACTED-DOB]",
    redactionSummary,
    "dob",
  );
  text = replace(
    text,
    /\b(?:MRN|Medical Record Number)\s*[:\-]?\s*[A-Z0-9-]{4,}\b/gi,
    "MRN: [REDACTED-MRN]",
    redactionSummary,
    "mrn",
  );

  return {
    text,
    redactionApplied: redactionSummary.length > 0,
    redactionSummary,
  };
}

function replace(text, regex, token, summary, label) {
  let count = 0;
  const next = text.replace(regex, () => {
    count += 1;
    return token;
  });
  if (count > 0) summary.push({ type: label, count });
  return next;
}

