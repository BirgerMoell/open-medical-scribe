import test from "node:test";
import assert from "node:assert/strict";
import { redactBasicPhi, maybeRedactForProvider } from "../src/services/privacy.js";

test("redactBasicPhi redacts common PHI markers", () => {
  const input =
    "Call me at 555-123-4567. DOB: 01/02/1980. MRN 1234ABCD. Email test@example.com.";
  const result = redactBasicPhi(input);

  assert.equal(result.redactionApplied, true);
  assert.match(result.text, /\[REDACTED-PHONE\]/);
  assert.match(result.text, /\[REDACTED-DOB\]/);
  assert.match(result.text, /\[REDACTED-MRN\]/);
  assert.match(result.text, /\[REDACTED-EMAIL\]/);
});

test("maybeRedactForProvider only redacts for API providers when enabled", () => {
  const config = {
    privacy: {
      redactBeforeApiCalls: true,
      phiRedactionMode: "basic",
    },
  };

  const openAi = maybeRedactForProvider({
    config,
    providerName: "openai",
    transcript: "Phone 555-111-2222",
  });
  const local = maybeRedactForProvider({
    config,
    providerName: "ollama",
    transcript: "Phone 555-111-2222",
  });

  assert.equal(openAi.redactionApplied, true);
  assert.equal(local.redactionApplied, false);
});

