# Annex I GSPR Checklist Starter

Document ID: OMS-MDR-CL1-GSPR-CHECKLIST
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This is a starter checklist for the OMS Class I Reference Build against Annex I of Regulation (EU) 2017/745.

It is intentionally practical:

- not every Annex I requirement applies to standalone software
- each applicable requirement needs evidence, not just a yes/no answer
- the evidence references below are placeholders to help structure the technical file

## Status key

- `Applicable`
- `Not applicable`
- `TBD`

## Checklist

| Annex I requirement area | Status | OMS interpretation | Evidence to create / link |
| --- | --- | --- | --- |
| 1. General safety and performance | Applicable | Device must be safe and perform as intended in professional documentation use | Intended purpose, risk management plan, clinical evaluation report |
| 2. Risk reduction as far as possible | Applicable | Risks such as hallucinated note content, omissions, and user overreliance must be reduced by design and process | Hazard analysis, design controls, validation evidence |
| 3. Benefit-risk acceptability | Applicable | Residual risks must be justified against documentation-support benefit | Benefit-risk section in risk file and CER |
| 4. Reduction of use error | Applicable | Workflow must reduce review omissions and mistaken acceptance of draft text | Usability file, UI review workflow design, validation report |
| 5. Performance consistency over lifetime | Applicable | Release and change control must preserve validated behavior of the locked build | Change control procedure, release policy, configuration record |
| 6. Transport / storage conditions | TBD | Depends on whether the certified build includes packaged hardware or only downloadable software | Distribution specification, IFU |
| 8. Chemical / biological properties | Not applicable | Standalone software only | N/A rationale |
| 9. Infection / microbial contamination | Not applicable | Standalone software only | N/A rationale |
| 10. Devices with measuring function | Not applicable | No measuring function in the MDR sense | Classification memo |
| 11. Protection against radiation | Not applicable | Standalone software only | N/A rationale |
| 12. Devices connected to energy sources | Applicable | Software must behave safely across supported hardware, battery, and interruption conditions | System requirements, failure-mode tests, recovery behavior |
| 13. Protection against mechanical and thermal risks | Not applicable | Standalone software only | N/A rationale |
| 14. Risks from supplied energy / substances | Not applicable | Standalone software only | N/A rationale |
| 15. Device usable safely with materials/substances | Not applicable | Standalone software only | N/A rationale |
| 16. Diagnostic/measurement accuracy under environment conditions | TBD | Likely partially relevant only as software performance under supported environments, not as a measuring device | Supported environment specification, V&V reports |
| 17. Electronic programmable systems / software | Applicable | Core software safety, repeatability, validation, IT security, and state-of-the-art controls are required | Software lifecycle file, architecture, V&V, cybersecurity file |
| 17.1 Repeatability / reliability / performance | Applicable | Locked build must be reproducible and validated | Configuration record, test reports |
| 17.2 State of the art / lifecycle / risk management | Applicable | Need documented lifecycle process proportionate to risk | SDLC procedure, traceability matrix |
| 17.3 Minimum hardware / IT network requirements | Applicable | Supported OS, browser, device, network, cloud dependencies must be defined | Product specification, IFU |
| 17.4 IT security and unauthorized access | Applicable | Protect PHI, credentials, logs, and remote interfaces | Cybersecurity file, penetration testing or equivalent, access control design |
| 18. Active devices incorporating software | Applicable | Standalone software is within scope here | Architecture and software safety evidence |
| 19. Devices administering substances | Not applicable | Standalone software only | N/A rationale |
| 20. Protection against mechanical/electrical risks for active devices | TBD | Mostly not applicable, but system failure and interruption behavior still matter | Failure handling tests, IFU |
| 21. Devices emitting ionizing radiation | Not applicable | Standalone software only | N/A rationale |
| 22. Programmable devices and cyber environment risks | Applicable | Must address update integrity, corrupted data, and interoperability risks | Cybersecurity file, change control, backup/recovery design |
| 23. Information supplied with the device | Applicable | Need labels, IFU, intended purpose, limitations, warnings, manufacturer identity, language coverage | Labeling pack, IFU, release notes |

## OMS-specific evidence packages to create next

1. Risk management plan and hazard analysis.
2. Product specification for the locked reference build.
3. Software lifecycle / change-control procedure for models, prompts, and releases.
4. Verification and validation plan covering transcript accuracy handling, draft-note grounding, review workflow, and failure recovery.
5. Cybersecurity and data protection file.
6. Labeling and IFU pack for Sweden-first launch.

## Known OMS pressure points against Annex I

- Free switching between providers and models weakens repeatability and validation.
- Draft narrative generation creates risk of unsupported or omitted clinical content.
- Current outputs mentioning `warnings`, `coding hints`, or `follow-up questions` need boundary review.
- Review approval, provenance, and clear draft status should likely become mandatory in the reference build.
