# Risk Management Plan

Document ID: OMS-MDR-CL1-RISK-MANAGEMENT-PLAN
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document defines the risk management approach for the OMS Class I Web Reference Build.

## Purpose

To establish a repeatable process for identifying hazards, evaluating risks, implementing controls, and monitoring residual risks across the lifecycle of the regulated build.

## Scope

Applies to the manufacturer-controlled web reference build, including:

- browser workflow
- backend orchestration
- transcription configuration
- draft note generation configuration
- review / approval workflow
- export workflow
- logging and supporting infrastructure

## Risk management principles

- risks are considered across the full lifecycle
- safety and performance are evaluated together
- transcript drafting errors are treated as safety-relevant
- risk controls should favor design controls before warnings alone
- post-market information feeds back into the risk file

## Intended use context

The device supports clinical documentation only. It does not replace clinician judgment and must not provide diagnosis or treatment recommendations.

This intended use boundary is itself a risk control and must be preserved in product design, labeling, and marketing.

## Preliminary hazard domains

### Clinical content risks

- hallucinated note content
- omission of relevant spoken content
- incorrect attribution of content to speaker or section
- misleading structure that appears more authoritative than warranted

### Workflow risks

- user exports a draft without adequate review
- approval state is unclear
- stale or hidden output is mistaken for final approved text

### Technical risks

- transcription failure
- partial processing failure
- corrupted storage or missing audit events
- deployment drift from validated configuration

### Security and privacy risks

- unauthorized access to PHI
- inappropriate log exposure
- insecure integration or credential handling

## Risk process

1. Identify hazard and foreseeable sequence of events.
2. Describe hazardous situation and possible harm.
3. Estimate risk before controls.
4. Identify and apply controls.
5. Estimate residual risk.
6. Determine overall acceptability.
7. Feed relevant findings into PMS and CAPA.

## Initial control strategy for OMS

Primary design controls expected for the reference build:

- explicit draft / approved state separation
- review approval gate before final export
- fixed validated inference configuration
- exclusion of decision-support outputs
- audit traceability for critical workflow events
- controlled release and change process

Secondary controls:

- user information and warnings
- training materials
- operational monitoring

## Risk acceptability

Detailed acceptability criteria must be defined in the hazard analysis. At minimum:

- uncontrolled classification drift is unacceptable
- bypass of approval workflow is unacceptable
- untracked production drift is unacceptable
- residual clinical-content risk must be justified through controls, validation, and clinician review workflow

## Outputs required from this plan

1. Hazard analysis and risk file
2. Benefit-risk rationale
3. Traceability between hazards, controls, and verification evidence
4. PMS feedback loop into risk review

## Review triggers

The risk file must be reviewed when:

- intended purpose changes
- a model or prompt changes
- a provider changes
- a new platform is added
- a serious complaint or incident occurs
- post-market data shows new failure modes
