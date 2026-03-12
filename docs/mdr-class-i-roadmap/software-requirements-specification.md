# Software Requirements Specification

Document ID: OMS-MDR-CL1-SOFTWARE-REQUIREMENTS-SPECIFICATION
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This is the starter software requirements specification for the OMS Class I Web Reference Build.

The requirements below define the intended regulated web configuration, not the full upstream OSS repository.

## Scope

In-scope product:

- manufacturer-controlled web SaaS
- browser-based clinician workflow
- locked transcription configuration
- locked note-drafting configuration
- explicit review / approval / export workflow

Out of scope:

- self-hosted variants
- desktop or native mobile regulated configurations
- end-user provider or model switching
- excluded decision-support outputs

## Requirement format

- `FR`: functional requirement
- `SR`: safety / risk-control requirement
- `ER`: environment / configuration requirement

## Functional requirements

### Workflow

- `FR-001` The system shall allow an authenticated user to start a new encounter workflow.
- `FR-002` The system shall allow the user to capture live audio or upload encounter audio.
- `FR-003` The system shall generate transcript output from submitted encounter audio using the locked production transcription configuration.
- `FR-004` The system shall display transcript output to the user for review.
- `FR-005` The system shall generate a draft note from the transcript using the locked production note-generation configuration.
- `FR-006` The system shall allow the user to edit the generated draft note before approval.
- `FR-007` The system shall require an explicit approval action before final export or copy is enabled.
- `FR-008` The system shall allow export or copy only for approved documentation.
- `FR-009` The system shall record an audit event for note approval.

### Content and output

- `FR-010` The regulated workflow shall output transcript text and draft documentation text only within the defined scope.
- `FR-011` The regulated workflow shall not expose coding hints, follow-up questions, or alert-style outputs.
- `FR-012` The system shall present draft and approved states distinctly.
- `FR-013` The system shall provide visible error feedback when transcription or note generation fails.

### Administrative and traceability

- `FR-014` The production deployment shall use a manufacturer-controlled configuration.
- `FR-015` The system shall maintain release and configuration traceability for the regulated deployment.
- `FR-016` The system shall support audit logging for key workflow events and failures.

## Safety and risk-control requirements

- `SR-001` The system shall not enable final export before explicit user approval.
- `SR-002` The system shall clearly identify generated documentation as draft until approval is recorded.
- `SR-003` The regulated build shall not expose end-user controls for switching providers or models.
- `SR-004` The regulated build shall use only validated prompts, models, providers, and runtime settings.
- `SR-005` The system shall fail visibly rather than silently fabricating output when a core processing step fails.
- `SR-006` The regulated build shall preserve the intended-purpose boundary and shall not expose diagnostic, triage, treatment, referral, or urgency-support functionality.
- `SR-007` The system shall protect approval, export, and configuration actions with appropriate authorization controls.

## Environment and configuration requirements

- `ER-001` The regulated product shall be deployed as a manufacturer-controlled web SaaS.
- `ER-002` The regulated product shall operate only within the supported browser and environment matrix.
- `ER-003` Production settings changes shall be controlled under the change-control procedure.
- `ER-004` Production and non-production environments shall remain separated.
- `ER-005` HTTPS shall be required for the production workflow.

## Traceability targets

Each requirement should be linked to:

- design element(s)
- risk-control mapping where applicable
- verification evidence
- validation evidence where applicable

## Immediate follow-on tasks

1. Expand this starter SRS into a full requirement list tied to actual endpoints, UI states, and environment constraints.
2. Create a requirement-to-test traceability matrix.
3. Link high-risk requirements to the hazard analysis and GSPR checklist.
