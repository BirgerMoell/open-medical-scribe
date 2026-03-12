# Hazard Analysis And Initial Risk File

Document ID: OMS-MDR-CL1-HAZARD-ANALYSIS-INITIAL-RISK-FILE
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document is the first working hazard analysis for the OMS Class I Web Reference Build.

It should be maintained alongside `risk-management-plan.md`, the verification and validation file set, complaint handling records, and PMS outputs.

## Scope

In scope:

- manufacturer-controlled web SaaS configuration
- browser-based clinician workflow
- locked transcription configuration
- locked note-drafting configuration
- review / approval / export workflow
- audit and storage components that support the regulated workflow

Out of scope:

- self-hosted deployments
- desktop and native mobile expansions
- excluded outputs such as coding hints, clinical alerts, and decision-support features

## Risk rating method

Working qualitative scale:

- Severity: `Low`, `Medium`, `High`
- Probability: `Low`, `Medium`, `High`
- Residual acceptability: `Acceptable`, `Needs further control`, `Unacceptable`

This is a starter file. The final technical documentation should replace or supplement this with a fully controlled scoring method.

## Initial hazard table

| ID | Hazard / sequence of events | Hazardous situation / possible harm | Initial severity | Initial probability | Existing / proposed controls | Verification / validation evidence needed | Residual status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H-01 | Transcript omits clinically relevant spoken content | Clinician reviews an incomplete draft and records incomplete documentation; downstream care communication may be impaired | High | Medium | Transcript display separate from note; clinician review/edit required; draft status; validation on omission scenarios; clear limitations in IFU | Transcript and note V&V cases; usability validation; IFU review | Needs further control |
| H-02 | Draft note hallucinates unsupported clinical content | User relies on unsupported text, causing inaccurate documentation or unsafe downstream interpretation | High | Medium | Transcript-grounded prompting; explicit draft state; clinician review/approval gate; excluded decision-support outputs; regression tests for unsupported content | Prompt/model regression tests; hazard-based validation set; review workflow usability study | Needs further control |
| H-03 | Draft note structure implies stronger clinical judgment than warranted | User may over-trust `Assessment` / `Plan` language and miss that it is machine-drafted | Medium | Medium | Review section labels; clear draft markers; IFU warnings; possible section relabeling or constraints | UI validation; labeling review; template review record | Needs further control |
| H-04 | Approval workflow can be bypassed or is unclear | Unreviewed text is exported or copied as if final | High | Medium | Technical gate before export; clear draft vs approved state; audit log of approval action | Workflow tests; access-control tests; UI validation | Needs further control |
| H-05 | Old or hidden output remains visible after regeneration or failure | User mistakes stale content for current validated draft | Medium | Medium | UI state reset rules; explicit timestamps/version markers; failure-state handling | Frontend regression tests; usability tests | Needs further control |
| H-06 | Wrong patient, encounter, or record context is used | Documentation is associated with the wrong patient or wrong encounter | High | Low | Encounter/session identifiers; UI confirmation; audit traceability; workflow restrictions | Integration tests; usability tests | Needs further control |
| H-07 | Speaker diarization attributes content incorrectly | Statements may be attributed to the wrong speaker, confusing documentation | Medium | Medium | Keep diarization constrained or out of scope; label diarization limits; user review before approval | Diarization validation if in scope; IFU limitations | Needs further control |
| H-08 | Transcription service fails partially or silently | Missing or degraded transcript creates inaccurate draft note without obvious warning | High | Medium | Fail-closed behavior; visible error states; audit of failures; no silent fallback text fabrication | Negative-path tests; service failure simulations | Needs further control |
| H-09 | Note-generation service returns unsupported output type | User sees coding hints, alerts, or decision-adjacent content in regulated workflow | Medium | Medium | Disable unsupported output fields; schema validation; filtered rendering in regulated build | API contract tests; UI rendering tests | Acceptable if controls implemented |
| H-10 | Prompt/model/provider drift changes output behavior after release | Validated behavior no longer matches production behavior | High | Medium | Locked baseline; change-control procedure; release approval; production drift monitoring | Release process evidence; baseline checks; regression suite | Needs further control |
| H-11 | Authentication or authorization failure exposes PHI or regulated workflow to the wrong user | Privacy breach and possible unsafe use of data or outputs | High | Low | Access controls; session management; least privilege; logging and incident response | Security testing; auth regression tests | Needs further control |
| H-12 | Audit logging is missing or incomplete during a complaint or incident | Manufacturer cannot reconstruct safety-relevant events or prove control execution | Medium | Medium | Required event logging; storage protection; monitoring for logging failures | Operational test records; log completeness checks | Needs further control |
| H-13 | Unsupported browser or environment causes broken capture or review UI | User may unknowingly use an unsafe or degraded workflow | Medium | Medium | Supported environment specification; browser gating or warnings; validation on supported browsers only | Browser compatibility tests; environment controls | Needs further control |
| H-14 | Export package misrepresents documentation status | Draft content is exported or integrated downstream as though clinician-approved | High | Low | Approval gate; approved status metadata; export labeling; audit log | Export workflow tests; FHIR packaging tests | Needs further control |
| H-15 | Backup/recovery or storage failure causes loss of audit or note records | Complaint investigation or service continuity is impaired | Medium | Low | Backup/recovery process; integrity checks; controlled retention | Disaster recovery tests; operational SOPs | Needs further control |
| H-16 | Security incident changes prompts, models, or config without approval | Unvalidated behavior is released into production | High | Low | Configuration access control; immutable release artifacts; change approvals; monitoring | Security testing; configuration integrity checks | Needs further control |
| H-17 | User over-relies on documentation tool despite intended-purpose limits | Output is used as implicit clinical judgment | High | Medium | Intended-purpose wording; IFU limitations; UI markers; workflow design preserving clinician authorship | Usability evidence; labeling review; PMS trend monitoring | Needs further control |

## Initial control priorities

Highest-priority controls to implement and verify early:

1. Export blocked until explicit review approval.
2. Draft and approved states made unambiguous in UI and exported output.
3. Unsupported output fields removed from the regulated web build.
4. Locked production configuration for models, prompts, providers, and runtime settings.
5. Hazard-based regression set for hallucination, omission, and stale-output cases.

## Links to other files

- `risk-management-plan.md`
- `software-lifecycle-and-change-control-procedure.md`
- `product-boundary-matrix.md`
- `product-specification-web-reference-build.md`
- `software-verification-and-validation-plan.md`
- `cybersecurity-and-data-protection-file.md`

## Primary source anchors

- MDR Annex I general safety and performance requirements
- MDR Article 10 obligations of manufacturers
- MDCG 2019-11 rev.1 qualification and classification of software
