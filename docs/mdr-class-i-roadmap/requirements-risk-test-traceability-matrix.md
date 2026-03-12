# Requirements Risk Test Traceability Matrix

Document ID: OMS-MDR-CL1-REQUIREMENTS-RISK-TEST-TRACEABILITY-MATRIX
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This is the starter traceability matrix linking the current software requirements, initial hazard analysis, and planned verification / validation evidence for the OMS Class I Web Reference Build.

## Traceability matrix

| Requirement | Summary | Linked hazard(s) | Planned verification / validation evidence | Current executed artifact ID(s) | Evidence status |
| --- | --- | --- | --- | --- | --- |
| FR-001 | Authenticated user starts new encounter | H-11 | Auth and access tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; detailed requirement mapping still provisional |
| FR-002 | Capture or upload encounter audio | H-08, H-13 | Upload and browser workflow tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; detailed requirement mapping still provisional |
| FR-003 | Generate transcript using locked config | H-01, H-08, H-10 | Transcript pipeline tests, config-baseline tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; detailed requirement mapping still provisional |
| FR-004 | Display transcript for review | H-01, H-13 | UI workflow tests, usability validation | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; dedicated UI validation still needed |
| FR-005 | Generate draft note using locked config | H-02, H-10 | Note-generation regression tests, config-baseline tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; detailed requirement mapping still provisional |
| FR-006 | User edits draft before approval | H-02, H-03 | UI editing tests, usability validation | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; dedicated UI validation still needed |
| FR-007 | Explicit approval required before export | H-04, H-14 | Approval-gate tests, negative-path tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; control-specific protocol still needed |
| FR-008 | Export only approved documentation | H-04, H-14 | Export workflow tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; control-specific protocol still needed |
| FR-009 | Approval audit event recorded | H-12, H-14 | Audit logging tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; explicit audit-evidence mapping still needed |
| FR-010 | Regulated workflow output stays in defined scope | H-02, H-09, H-17 | Schema/output tests, hazard-based validation | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; scope-specific validation still needed |
| FR-011 | No coding hints / follow-up questions / alert outputs | H-09, H-17 | Boundary verification tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; boundary-specific protocol still needed |
| FR-012 | Draft and approved states are distinct | H-03, H-04, H-05 | UI state tests, usability validation | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; dedicated UI validation still needed |
| FR-013 | Visible error feedback on failures | H-05, H-08 | Failure-path tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; failure-path protocol still needed |
| FR-014 | Production deployment uses manufacturer-controlled config | H-10, H-16 | Release-control record, baseline checks | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite plus document controls; release baseline still draft |
| FR-015 | Release and config traceability maintained | H-10, H-12, H-16 | Release records, audit checks | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite plus document controls; traceability maturing |
| FR-016 | Audit logging supports key workflow events | H-12 | Audit logging tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; explicit audit-evidence mapping still needed |
| SR-001 | No final export before explicit approval | H-04, H-14 | Approval-gate verification | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; control-specific protocol still needed |
| SR-002 | Generated documentation remains draft until approval | H-03, H-04, H-17 | UI state tests, labeling/usability validation | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; usability evidence still needed |
| SR-003 | No end-user provider/model switching | H-10, H-16 | Boundary verification tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; regulated-build-specific control still needs dedicated verification |
| SR-004 | Only validated prompts/models/providers/settings used | H-02, H-10, H-16 | Configuration integrity checks, release approval records | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; configuration integrity evidence still needed |
| SR-005 | Fail visibly, do not silently fabricate output | H-05, H-08 | Negative-path tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; dedicated negative-path evidence still needed |
| SR-006 | No diagnostic / triage / treatment / referral / urgency support | H-09, H-17 | Boundary verification tests, output review | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; decision-boundary evidence still needed |
| SR-007 | Approval, export, and config actions protected by authorization | H-04, H-11, H-16 | Authz tests, admin-path tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; authz-specific evidence still needed |
| ER-001 | Deployed as manufacturer-controlled web SaaS | H-10, H-16 | Release-control record, deployment baseline | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite plus document controls; deployment baseline still draft |
| ER-002 | Operates only within supported browser/environment matrix | H-13 | Browser matrix checks, compatibility tests | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; browser-specific validation still needed |
| ER-003 | Production setting changes are change-controlled | H-10, H-16 | Change-control audit, baseline checks | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite plus document controls; change records still draft |
| ER-004 | Production and non-production stay separated | H-11, H-15, H-16 | Environment separation checks | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; infrastructure evidence still needed |
| ER-005 | HTTPS required for production workflow | H-11 | Security verification | `OMS-MDR-CL1-TEST-REP-001` | Executed baseline suite; deployment evidence still needed |

## Notes

- This starter matrix should be expanded as the requirements set grows.
- Executed artifact `OMS-MDR-CL1-TEST-REP-001` is the current real regression-suite evidence baseline.
- Hazard identifiers should be updated if the risk file is restructured.
