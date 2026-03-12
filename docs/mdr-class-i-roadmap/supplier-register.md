# Supplier Register

Document ID: OMS-MDR-CL1-SUPPLIER-REGISTER
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This is the working supplier register for the OMS Class I Web Reference Build.

## Status key

- `Approved working baseline`
- `Pending appointment`
- `Pending final approval`

## Supplier register

| Supplier / service | Role in regulated build | Criticality | Status | Notes |
| --- | --- | --- | --- | --- |
| `Fly.io` | Working hosting baseline for the Sweden-first regulated web deployment | Critical | Approved working baseline | Current deployment docs point to Fly.io in Stockholm region; final contract and architecture record still need controlled reference |
| `Berget API service` | Working transcription service baseline | Critical | Approved working baseline | Current deployment docs use `TRANSCRIPTION_PROVIDER=berget`; final service description and controlled configuration record still needed |
| `Berget API service` | Working note-generation service baseline | Critical | Approved working baseline | Current deployment docs use `NOTE_PROVIDER=berget`; final prompt/model baseline still needs controlled reference |
| `External PRRC service provider` | Article 15 PRRC role coverage | Critical | Pending appointment | Role assignment is external by current manufacturer decision; named supplier not yet contracted |

## Immediate follow-on tasks

1. Replace working supplier names with controlled supplier records and contract references.
2. Add internal owner and review date for each critical supplier.
3. Add monitoring evidence references after the first formal supplier review.
