# Device Architecture Description

Document ID: OMS-MDR-CL1-DEVICE-ARCHITECTURE-DESCRIPTION
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document describes the proposed architecture of the OMS Class I Web Reference Build.

It is written for the manufacturer-controlled web SaaS configuration defined in `product-specification-web-reference-build.md`.

## Scope

In-scope architecture:

- browser-based clinician client
- manufacturer-controlled web backend
- manufacturer-controlled inference configuration
- controlled persistence and audit components

Out of scope:

- self-hosted deployments
- native mobile standalone inference
- desktop standalone inference
- arbitrary third-party API endpoints

## Architectural objective

The architecture must support:

- transcript-grounded draft documentation
- explicit clinician review before final export
- configuration control
- traceability of release and runtime configuration
- post-market monitoring and incident response

## Logical components

### 1. Browser client

Responsibilities:

- user authentication flow
- audio capture and upload
- transcript display
- draft note display and editing
- explicit review / approval interaction
- controlled export of approved documentation

Key safety constraints:

- draft and approved states must be visually distinct
- no automatic conversion from draft to approved
- errors must be shown clearly without hiding incomplete output

### 2. Application backend

Responsibilities:

- API routing
- authentication and authorization enforcement
- request validation and size limits
- orchestration of transcription and note-drafting workflow
- audit event generation
- storage coordination

Key safety constraints:

- production configuration is fixed and not end-user editable
- all critical workflow steps are logged
- unsupported endpoints and features remain disabled in the regulated build

### 3. Transcription service layer

Responsibilities:

- submit audio to the locked transcription stack
- normalize transcription output into OMS transcript artifacts
- capture provider/runtime metadata needed for traceability

Key safety constraints:

- only validated production transcription configuration is used
- failures return recoverable errors and do not silently fabricate text

### 4. Note-drafting service layer

Responsibilities:

- apply the locked drafting prompt set
- generate transcript-grounded draft documentation
- return only outputs allowed inside the regulated scope

Key safety constraints:

- no decision-support outputs in the regulated build
- unsupported content types such as coding hints or clinical alerts are disabled
- runtime model and prompt configuration are version controlled

### 5. Persistence layer

Responsibilities:

- store required service state
- store transcript and note records where enabled
- store review / approval state
- store audit logs and operational records

Key safety constraints:

- separation of production and non-production data
- backup and recovery process
- controlled retention and deletion policy

### 6. Audit and monitoring layer

Responsibilities:

- capture workflow events
- support complaint investigation and PMS
- support anomaly detection and incident handling

Key safety constraints:

- audit records are tamper-evident or otherwise protected against inappropriate alteration
- logs do not expose unnecessary PHI outside authorized operational processes

## Data flow

1. User authenticates to the web application.
2. User records or uploads encounter audio.
3. Browser submits audio to the backend over HTTPS.
4. Backend validates the request and routes audio to the locked transcription service.
5. Backend stores or buffers transcript artifacts per configured workflow.
6. Backend submits transcript content to the locked note-drafting service.
7. Backend returns draft note content to the browser.
8. User reviews and edits the draft.
9. User performs explicit approval.
10. Backend records approval event and permits final export.

## Safety-critical control points

- authentication before clinical workflow access
- upload validation before processing
- fixed production inference configuration
- explicit review / approval gate before export
- version traceability for release, model, and prompt set
- audit logging for key workflow and failure events

## External dependencies

These must be frozen for the regulated build:

- hosting environment
- operating system/runtime versions for backend
- chosen transcription provider and version
- chosen note-generation provider and version
- browser support set
- storage and logging dependencies

Dependencies outside this frozen set are not part of the CE-marked configuration.

## Architecture risks to manage

- transcription failure or partial transcript
- unsupported note content generation
- approval bypass
- deployment drift between validated and production environments
- unauthorized access to PHI-bearing data
- audit gap during failures

## Required linked documents

1. Supported environment specification
2. Software lifecycle and change-control procedure
3. Risk management plan and hazard analysis
4. Verification and validation plan
5. Cybersecurity and data protection file
