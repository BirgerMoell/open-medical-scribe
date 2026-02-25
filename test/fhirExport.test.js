import test from "node:test";
import assert from "node:assert/strict";
import { buildFhirDocumentReference } from "../src/services/fhirExport.js";

test("buildFhirDocumentReference creates preliminary note with base64 attachment", () => {
  const resource = buildFhirDocumentReference({
    noteText: "S: cough\nO: clear lungs",
    encounterId: "enc_123",
    patient: { age: 44, sex: "F" },
    meta: { noteStyle: "soap", specialty: "primary-care" },
  });

  assert.equal(resource.resourceType, "DocumentReference");
  assert.equal(resource.docStatus, "preliminary");
  assert.equal(resource.id, "enc_123");
  assert.match(resource.content[0].attachment.data, /^[A-Za-z0-9+/=]+$/);
  assert.equal(
    Buffer.from(resource.content[0].attachment.data, "base64").toString("utf8"),
    "S: cough\nO: clear lungs",
  );
});

