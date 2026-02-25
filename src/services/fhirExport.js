export function buildFhirDocumentReference({
  noteText,
  encounterId,
  patient = {},
  clinician = {},
  meta = {},
}) {
  const now = new Date().toISOString();
  const note = String(noteText || "").trim();

  return {
    resourceType: "DocumentReference",
    status: "current",
    docStatus: "preliminary",
    id: encounterId || `doc-${Date.now()}`,
    type: { text: "Clinical note draft" },
    date: now,
    subject: patient.id
      ? { reference: `Patient/${patient.id}` }
      : { display: buildPatientDisplay(patient) },
    author: [buildAuthor(clinician)],
    description: `Scribe-generated ${meta.noteStyle || "clinical"} note draft`,
    category: [{ text: "clinical-note" }],
    content: [
      {
        attachment: {
          contentType: "text/plain",
          title: `Encounter note draft ${encounterId || ""}`.trim(),
          creation: now,
          data: Buffer.from(note, "utf8").toString("base64"),
        },
      },
    ],
    context: {
      encounter: encounterId ? [{ reference: `Encounter/${encounterId}` }] : [],
    },
    extension: [
      {
        url: "https://open-medical-scribe.dev/fhir/StructureDefinition/note-style",
        valueString: meta.noteStyle || "unknown",
      },
      {
        url: "https://open-medical-scribe.dev/fhir/StructureDefinition/specialty",
        valueString: meta.specialty || "unknown",
      },
    ],
  };
}

function buildPatientDisplay(patient) {
  const bits = [];
  if (patient.name) bits.push(String(patient.name));
  if (patient.age !== undefined) bits.push(`age ${patient.age}`);
  if (patient.sex) bits.push(String(patient.sex));
  return bits.join(", ") || "Unknown patient";
}

function buildAuthor(clinician) {
  if (clinician.id) return { reference: `Practitioner/${clinician.id}` };
  if (clinician.name) return { display: String(clinician.name) };
  return { display: "Clinician (unassigned)" };
}

