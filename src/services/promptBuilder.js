export function buildNotePrompt({
  transcript,
  noteStyle,
  specialty = "primary-care",
  patientContext = {},
  clinicianContext = {},
}) {
  const style = normalize(noteStyle) || "soap";
  const spec = normalize(specialty) || "primary-care";

  const isSwedish = style === "journal";
  const instructions = [
    isSwedish
      ? "Du är en klinisk dokumentationsassistent. Skriv journalanteckningar enbart baserat på given information."
      : "You are a clinical documentation assistant. Draft documentation only from provided information.",
    isSwedish
      ? "Hitta inte på fakta, vitalparametrar, undersökningsfynd, diagnoser eller planer. Markera saknad information som uppföljningsfrågor."
      : "Do not invent facts, vitals, exam findings, diagnoses, or plans. Mark missing details as needed follow-up questions.",
    "Return strict JSON with keys: noteText, sections, codingHints, followUpQuestions, warnings.",
    isSwedish
      ? "Skriv koncist, kliniskt korrekt på svenska. Använd vedertagna medicinska termer och förkortningar."
      : "Write concise clinician-ready wording.",
    styleInstruction(style),
    `Specialty context: ${spec}.`,
  ];

  const payload = {
    patientContext,
    clinicianContext,
    transcript,
  };

  return {
    system: instructions.join(" "),
    user: JSON.stringify(payload, null, 2),
  };
}

function styleInstruction(style) {
  switch (style) {
    case "soap":
      return "Format noteText as SOAP sections prefixed S:, O:, A:, P:. Sections object keys: subjective, objective, assessment, plan.";
    case "hp":
      return (
        "Format noteText as a History & Physical (H&P) note with these sections: " +
        "Chief Complaint, History of Present Illness, Past Medical History, Medications, " +
        "Allergies, Family History, Social History, Review of Systems, Physical Examination, " +
        "Assessment, Plan. Sections object keys: chiefComplaint, hpi, pmh, medications, " +
        "allergies, familyHistory, socialHistory, ros, physicalExam, assessment, plan."
      );
    case "progress":
      return (
        "Format noteText as a Progress Note with: Interval History (changes since last visit), " +
        "Current Medications, Examination Findings, Assessment, Plan. " +
        "Sections object keys: intervalHistory, medications, examination, assessment, plan."
      );
    case "dap":
      return (
        "Format noteText as a DAP note (behavioral health) prefixed D:, A:, P:. " +
        "D (Data): objective and subjective information from the session. " +
        "A (Assessment): clinical interpretation and progress toward goals. " +
        "P (Plan): next steps, homework, next session plans. " +
        "Sections object keys: data, assessment, plan."
      );
    case "procedure":
      return (
        "Format noteText as a Procedure Note with: Procedure Name, Indication, " +
        "Pre-procedure Diagnosis, Anesthesia, Description of Procedure, " +
        "Findings, Specimens, Complications, Post-procedure Condition, Plan. " +
        "Sections object keys: procedureName, indication, preDiagnosis, anesthesia, " +
        "description, findings, specimens, complications, postCondition, plan."
      );
    case "journal":
      return (
        "Formatera noteText som en svensk journalanteckning enligt svensk klinisk standard. " +
        "Använd följande rubriker: " +
        "Aktuellt: Beskrivning av varför patienten söker vård, gärna med patientens egna ord. " +
        "Anamnes: Hälso- och sjukdomshistoria, tidigare sjukdomar, ärftlighet, aktuella symtom. " +
        "Status: Fysisk undersökning och kliniska fynd. " +
        "Bedömning: Klinisk bedömning och diagnos, med ICD-10-kod om möjligt. " +
        "Planering: Planerad behandling, medicinering, remisser, provtagning eller uppföljning. " +
        "Skriv på svenska. Använd vedertagna medicinska förkortningar (t.ex. AT, BT, Cor, Pulm, Buk). " +
        "Sections object keys: aktuellt, anamnes, status, bedomning, planering."
      );
    default:
      return `Format noteText in ${style} style while still returning sections object.`;
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}
