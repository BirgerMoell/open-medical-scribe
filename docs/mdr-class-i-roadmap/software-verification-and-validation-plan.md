# Software Verification And Validation Plan

Document ID: OMS-MDR-CL1-SOFTWARE-VERIFICATION-AND-VALIDATION-PLAN
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document defines the initial verification and validation approach for the OMS Class I Web Reference Build.

## Purpose

To show that the regulated web build:

- conforms to its defined requirements and controlled configuration
- supports the intended documentation workflow safely and effectively
- maintains the intended-purpose boundary of documentation support rather than decision support

## Scope

Applies to:

- browser workflow
- backend orchestration
- locked transcription configuration
- locked note-generation configuration
- approval and export workflow
- audit and key operational controls

## V&V objectives

1. Verify that the released product matches the defined requirements and controlled configuration.
2. Validate that intended users can safely use the product for transcript-grounded draft documentation with mandatory review.
3. Demonstrate that excluded outputs and unsupported decision-support behavior do not appear in the regulated build.
4. Demonstrate that failures are visible and recoverable rather than silent.

## Test item baseline

Every V&V cycle must identify:

- application release version
- production configuration baseline
- exact prompt set version
- exact model/provider versions or pinned service baseline
- supported browser matrix
- infrastructure baseline

## Verification streams

### 1. Requirements verification

Goal:

- show each implemented requirement has objective evidence

Artifacts:

- requirements traceability matrix
- unit/integration/API tests
- release acceptance checklist

### 2. Workflow verification

Goal:

- confirm critical workflow controls behave as specified

Key test themes:

- audio upload / recording
- transcript creation and display
- note draft generation
- explicit approval requirement before export
- audit event creation
- error handling and recovery

### 3. Boundary verification

Goal:

- confirm the regulated build does not expose excluded functionality

Key test themes:

- no end-user provider switching
- no end-user model switching
- no coding hints or follow-up questions in regulated UI/API flow
- no decision-support or alert-style outputs

### 4. Configuration verification

Goal:

- show production deployment matches validated baseline

Key test themes:

- configuration immutability
- approved release artifact identity
- prompt/model/provider locking
- environment drift detection

### 5. Security and access verification

Goal:

- verify access control and integrity for the regulated workflow

Key test themes:

- authentication
- authorization
- session handling
- protected configuration
- audit logging integrity checks

## Validation streams

### 1. Intended-use validation

Objective:

- show representative intended users can complete the documentation workflow safely and as intended

Representative tasks:

- record or upload encounter audio
- review transcript
- review and edit draft note
- approve final documentation
- export approved output

Validation focus:

- recognition of draft vs approved state
- recognition of need for clinician review
- recovery from transcription or generation errors
- avoidance of over-trust in unsupported content

### 2. Hazard-based validation

Objective:

- specifically test the high-risk failure modes in the initial risk file

Minimum scenario families:

- omitted transcript content
- hallucinated draft note content
- stale output after regeneration or failure
- approval bypass attempts
- unsupported browser behavior

### 3. Content-grounding validation

Objective:

- assess whether draft note content remains supported by the transcript and does not add excluded recommendation content

Approach:

- representative transcript corpus
- expected-support annotations or clinician review rubric
- explicit unsupported-content checks

### 4. Usability validation

Objective:

- confirm the UI supports safe completion of the regulated workflow by intended users

Key topics:

- draft status visibility
- approval action comprehension
- error message comprehension
- export status comprehension

## Acceptance expectations

The release should not be approved unless:

- critical workflow tests pass
- high-severity hazards have implemented and verified controls
- no excluded outputs are exposed in the regulated workflow
- validation results support safe intended use with documented residual limitations

## Evidence outputs

- test protocol set
- requirements traceability matrix
- executed test reports
- validation report
- unresolved issue log
- release approval recommendation

## Open implementation tasks for OMS

1. Build a representative transcript corpus for Swedish-first clinical use.
2. Add regression tests for hallucination, omission, and approval-gate failure.
3. Add UI tests for draft/approved state visibility.
4. Add production baseline checks for locked provider/model/prompt configuration.
