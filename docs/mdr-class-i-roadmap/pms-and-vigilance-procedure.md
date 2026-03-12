# Post-Market Surveillance And Vigilance Procedure

Document ID: OMS-MDR-CL1-PMS-AND-VIGILANCE-PROCEDURE
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This procedure defines how the manufacturer will monitor the OMS Class I Web Reference Build after market placement.

## Purpose

To collect and review post-market information, detect safety or performance issues, and escalate incidents and corrective actions when needed.

## Scope

Applies to the CE-marked web reference build and all deployed regulated releases.

## PMS inputs

- user complaints
- support tickets
- audit and operational logs
- defect reports
- cybersecurity events
- validation escapes detected after release
- feedback from clinical users

## PMS activities

1. Collect post-market information continuously.
2. Review trends for recurring failures or safety-relevant patterns.
3. Feed findings into CAPA, risk review, and change control.
4. Update the Class I PMS report when necessary.

## Minimum PMS topics for OMS

- draft note grounding failures
- review / approval workflow failures
- export of unreviewed text
- authentication or authorization failures
- transcription service degradation
- model-output drift after approved changes
- privacy and security events

## Complaint triage

Each complaint should be assessed for:

- product defect
- safety relevance
- possible serious incident
- need for immediate containment or corrective action

## Vigilance escalation

Potentially serious incidents must be escalated immediately for regulatory assessment.

For OMS, special attention is required if there is evidence that:

- unsafe or misleading output contributed to patient harm or serious deterioration
- approval controls failed in a way that allowed unsafe use
- a cybersecurity event compromised safety or serious PHI-bearing operational integrity

## Corrective action triggers

Corrective action should be considered when:

- the same failure recurs across multiple users or releases
- a risk control is shown to be ineffective
- production drift is discovered
- a release behaves materially differently from its validated baseline

## Required records

- complaint log
- incident assessment record
- PMS review log
- CAPA records
- updated PMS report
- updated risk file where relevant
