# Intended Purpose Draft For OMS Class I Reference Build

Document ID: OMS-MDR-CL1-INTENDED-PURPOSE-DRAFT
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This draft is written to support a narrow ordinary Class I strategy. It should be reviewed by regulatory counsel before being treated as a final intended purpose.

## Device name

Open Medical Scribe Class I Reference Build

## Device description

Open Medical Scribe is software intended to record or ingest clinical encounter audio, transcribe the spoken conversation, and produce an editable draft of encounter documentation for review by a licensed healthcare professional.

The software organizes transcript-grounded documentation into configured note structures and allows the clinician to review, edit, and approve the final text before it is used in the patient record.

## Intended purpose

The device is intended to support clinical documentation by converting encounter audio into transcript-grounded draft documentation for review and editing by licensed healthcare professionals.

The device is not intended to diagnose, screen, triage, predict, prognose, recommend treatment, recommend referral, prioritize urgency, or otherwise provide patient-specific clinical decision support.

## Intended users

- Licensed healthcare professionals
- Healthcare support staff acting under clinician supervision, where allowed by local workflow

## Intended use environment

- Professional healthcare environments
- Remote clinical documentation workflows controlled by healthcare providers

## Inputs

- Live or uploaded encounter audio
- Manual user text edits
- Configured note style selection

## Outputs

- Transcript text
- Draft structured documentation derived from transcript content
- Audit and provenance metadata where enabled

## Core functional claims to keep

- Records or ingests encounter audio
- Produces transcript text
- Drafts editable documentation from the transcript
- Preserves clinician review as the final control point
- Supports export of clinician-reviewed documentation

## Claims to exclude

- Diagnostic support
- Treatment recommendations
- Triage or urgency scoring
- Referral recommendations
- Detection of red flags or deterioration
- Autonomous coding claims tied to care decisions
- Claims of improved diagnostic accuracy or safer treatment decisions

## Safety-critical product constraints

- The final documentation must remain editable before use.
- The UI must clearly indicate draft status until clinician approval.
- The software must not present generated content as final clinical judgment.
- The CE-marked configuration must use fixed, validated models, prompts, and workflows under change control.

## Open issues

1. Decide whether final export should be technically blocked until a review action is recorded.
2. Decide whether transcript-to-note provenance links will be mandatory in the regulated build.
3. Decide whether some current note sections such as `Assessment` and `Plan` should be relabeled or constrained further in the CE-marked build.
