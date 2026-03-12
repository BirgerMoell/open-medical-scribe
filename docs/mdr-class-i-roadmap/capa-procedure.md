# CAPA Procedure

Document ID: OMS-MDR-CL1-CAPA-PROCEDURE
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This procedure defines how corrective and preventive actions are identified, evaluated, implemented, and verified for the OMS Class I Web Reference Build.

## Purpose

To ensure that safety, performance, process, security, and compliance issues are corrected in a controlled way and that recurring causes are addressed systematically.

## CAPA inputs

- complaints
- PMS findings
- vigilance assessments
- security incidents
- verification / validation failures
- release-control failures
- audit or review findings

## CAPA workflow

1. Issue identified.
2. CAPA record opened.
3. Initial containment decided if needed.
4. Root cause analysis performed.
5. Corrective action and preventive action defined.
6. Effectiveness checks defined.
7. Actions implemented.
8. Effectiveness verified.
9. Related documents updated.
10. CAPA closed.

## CAPA triggers for OMS

- repeated hallucination or omission failures
- approval gate failures
- unsupported output appearing in the regulated build
- production drift from validated baseline
- recurring auth, logging, or storage failures
- unresolved safety-relevant complaints

## Required CAPA record fields

- CAPA identifier
- source of issue
- affected release / configuration
- issue summary
- risk / safety relevance
- containment action
- root cause
- corrective action
- preventive action
- effectiveness check
- closure decision

## Linkage requirements

Each CAPA should be linked to any relevant:

- complaint record
- PMS report
- risk-file update
- change record
- release record

## Closure rule

A CAPA may be closed only when the effectiveness check is complete and linked documents have been updated where required.
