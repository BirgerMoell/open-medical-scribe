# Supplier And External Service Control Procedure

Document ID: OMS-MDR-CL1-SUPPLIER-AND-EXTERNAL-SERVICE-CONTROL-PROCEDURE
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This procedure defines how suppliers and externally provided services are selected, approved, monitored, and changed for the OMS Class I Web Reference Build.

## Purpose

To control external dependencies that can affect safety, performance, security, privacy, or regulatory compliance.

## Scope

Applies to suppliers and service providers relevant to the regulated build, including:

- hosting and infrastructure providers
- transcription providers
- note-generation providers
- storage and logging services
- security-critical third-party services
- external PRRC service if used

## Supplier classes

### Critical suppliers

Suppliers whose failure or uncontrolled change can affect:

- regulated product behavior
- safety controls
- production availability
- PHI handling
- release integrity

### Non-critical suppliers

Suppliers that do not materially affect regulated product safety or performance.

## Control expectations for critical suppliers

- documented approval before use
- defined contract or service terms
- documented service description and dependency rationale
- monitoring of performance and incidents
- change impact review before switching or materially changing the supplier

## Minimum supplier record fields

- supplier name
- service provided
- criticality classification
- owner inside the manufacturer
- approval date
- key risks
- monitoring method
- exit / replacement considerations

## OMS-specific critical supplier examples

- production hosting provider
- locked transcription provider
- locked note-generation provider
- secrets / identity provider if used in the regulated build

## Supplier change rule

Any change to a critical supplier or critical service configuration requires:

- change-control assessment
- risk review
- documentation update
- verification and, where necessary, validation update

## Monitoring

Critical suppliers should be reviewed for:

- service reliability
- security issues
- unexpected behavior changes
- contractual / operational fit with the regulated deployment

## Records

- supplier register
- approval records
- review / monitoring records
- change assessments linked to supplier changes
