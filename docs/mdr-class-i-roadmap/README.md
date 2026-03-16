# MDR Class I Roadmap For Open Medical Scribe

Document ID: OMS-MDR-CL1-README
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This folder is the working area for a Class I MDR path for Open Medical Scribe (OMS). It assumes the goal is to keep the codebase open source while creating one manufacturer-controlled reference build that can be self-declared as an ordinary Class I medical device under Regulation (EU) 2017/745.

This is a product and engineering workstream, not legal advice.

## Working assumptions

- Working manufacturer record: see `manufacturer-details-and-role-assignment.md`.
- Product owner / clinical SME: Birger Moëll.
- Market entry target: Sweden first, then other EU/EEA countries.
- Regulatory strategy: ordinary Class I medical device software, not Class Is / Im / Ir, and not Rule 11 Class IIa or higher.
- Distribution strategy: open-source upstream plus one locked reference build that is the only CE-marked configuration.

## Why this path is narrow

OMS currently sits close to the boundary between:

- software outside MDR as documentation support
- software inside MDR as ordinary Class I
- software inside MDR as Rule 11 Class IIa or higher

For the Class I path to remain credible, the CE-marked product must stay tightly constrained:

- transcript-grounded documentation support only
- clinician review and edit before final use
- no diagnosis, triage, treatment, referral, prognosis, or urgency recommendations
- no claims that the software provides information used to take diagnostic or therapeutic decisions

## Folder contents

- `intended-purpose-draft.md`: first draft of the regulated product definition
- `manufacturer-setup.md`: manufacturer structure and role allocation for a Swedish setup
- `action-plan.md`: ordered execution plan
- `document-register.md`: the MDR document set to create and maintain
- `qualification-and-classification-memo.md`: the current Class I rationale and red lines
- `product-boundary-matrix.md`: feature-by-feature scope for the CE-marked build
- `gspr-checklist.md`: Annex I checklist starter for the technical file
- `product-specification-web-reference-build.md`: the first recommended certified configuration
- `platform-expansion-strategy.md`: how desktop and iPhone/iPad can be added later without destabilizing v1
- `device-architecture-description.md`: the logical architecture of the regulated web build
- `supported-environment-specification.md`: the environment assumptions and support boundary
- `software-lifecycle-and-change-control-procedure.md`: how releases, prompts, models, and config changes are controlled
- `risk-management-plan.md`: the lifecycle risk-management approach for the regulated build
- `pms-and-vigilance-procedure.md`: post-market monitoring and incident escalation
- `complaint-handling-procedure.md`: intake, investigation, and closure process for complaints
- `hazard-analysis-initial-risk-file.md`: first hazard table and risk-control priorities
- `software-verification-and-validation-plan.md`: initial V&V strategy and evidence structure
- `cybersecurity-and-data-protection-file.md`: security and data-protection baseline for the regulated build
- `sweden-first-labeling-and-ifu-pack.md`: starter manufacturer information pack in English and Swedish
- `qms-index.md`: map of the procedures, records, and technical-file elements
- `software-requirements-specification.md`: starter requirements set for the regulated web build
- `clinical-evaluation-plan.md`: initial plan for clinical evidence generation and maintenance
- `pms-report-template.md`: Class I post-market report template
- `eu-declaration-of-conformity-draft.md`: working declaration template for the manufacturer
- `prrc-appointment-record.md`: explicit Article 15 appointment status record
- `manufacturer-details-and-role-assignment.md`: working manufacturer identity and role ownership record
- `capa-procedure.md`: corrective and preventive action procedure
- `supplier-and-external-service-control-procedure.md`: supplier approval and monitoring procedure
- `supplier-register.md`: working approved-supplier baseline and pending supplier appointments
- `requirements-risk-test-traceability-matrix.md`: starter links between requirements, hazards, and tests
- `test-evidence-register.md`: executed test evidence currently linked into the roadmap
- `supported-browser-matrix.md`: validated browser support boundary for v1
- `release-control-records.md`: release approval and production baseline record pack
- `document-control-register.md`: document ID, version, and owner register for the roadmap set
- `classification-readiness-checklist.md`: the single checklist of what Birger / Moëll et al AB still need to close

## Primary sources

- MDR text: https://eur-lex.europa.eu/eli/reg/2017/745/2017-05-05/eng
- MDCG 2019-11 rev.1 software qualification and classification: https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf&prefLang=pl
- EC Class I factsheet: https://health.ec.europa.eu/system/files/2021-07/md_mdcg_2021_factsheet-cl1_en_0.pdf
- EC manufacturer step-by-step guide: https://health.ec.europa.eu/publications/step-step-guide-medical-device-manufacturers_en
- EUDAMED actor registration: https://health.ec.europa.eu/medical-devices-eudamed/actor-registration-module_en
- EUDAMED getting ready: https://health.ec.europa.eu/medical-devices-eudamed/getting-ready_en
- UDI overview: https://health.ec.europa.eu/medical-devices-topics-interest/unique-device-identifier-udi_en

## Immediate next outputs to add

1. Replace working supplier baselines with contract-backed supplier approvals and review dates.
2. Name the external PRRC appointee and link qualification evidence.
3. Implement the product controls required by the checklist, especially review-before-export and regulated-build feature gating.
4. Add dedicated protocol/report IDs beyond the broad regression-suite artifact.
