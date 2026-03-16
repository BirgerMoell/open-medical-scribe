# Classification Readiness Checklist

Document ID: OMS-MDR-CL1-CLASSIFICATION-READINESS-CHECKLIST
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This checklist is the operational view of what still needs to happen before the OMS Class I Web Reference Build can be self-declared as an ordinary Class I device under MDR.

Use this as the single execution tracker across the roadmap folder.

## Status key

- `Done`
- `In progress`
- `Missing`
- `Blocked`

## Exactly what Birger / Moëll et al AB still need to do

| Area | Concrete action | Status | Current basis / blocker | Primary file(s) |
| --- | --- | --- | --- | --- |
| Manufacturer identity | Confirm `Moëll et al AB` details against official Bolagsverket extract | In progress | Working details exist, but source is still public business listings | `manufacturer-details-and-role-assignment.md` |
| Manufacturer signatory | Decide who signs the declaration of conformity for the company | Missing | No named signatory yet | `eu-declaration-of-conformity-draft.md` |
| PRRC model | Keep external PRRC model as final decision | In progress | Current docs assume external PRRC, but not yet contracted | `prrc-appointment-record.md` |
| External PRRC | Select and contract a named external PRRC | Missing | No named appointee or contract reference | `prrc-appointment-record.md`, `supplier-register.md` |
| Internal owners | Confirm Birger as technical owner, quality-system owner, PMS/complaint owner | In progress | Set in working records, but not yet approved in a formal company record | `manufacturer-details-and-role-assignment.md`, `qms-index.md` |
| Product scope | Approve v1 regulated scope as web SaaS only | In progress | Docs are aligned, but product and company approval still needed | `product-specification-web-reference-build.md`, `product-boundary-matrix.md` |
| Excluded features | Keep self-hosting, desktop, iPhone/iPad, coding hints, follow-up questions, alerts, decision support out of v1 certified scope | In progress | Documented, but code/product enforcement still incomplete | `product-boundary-matrix.md` |
| Review gate | Implement and enforce explicit review approval before export | Missing | Required by the regulatory file set, not yet evidenced as product control | `software-requirements-specification.md`, `hazard-analysis-initial-risk-file.md` |
| Feature gating | Implement regulated-build feature gating for excluded outputs and configuration freedom | Missing | Current repo remains broader than regulated scope | `software-requirements-specification.md`, `software-lifecycle-and-change-control-procedure.md` |
| Locked deployment | Freeze the production architecture, providers, prompts, and settings | In progress | Working baseline exists, but no final approved production baseline | `product-specification-web-reference-build.md`, `release-control-records.md` |
| Supplier approval | Approve final hosting supplier | In progress | `Fly.io` listed as working baseline, not yet contract-backed in controlled record | `supplier-register.md` |
| Supplier approval | Approve final transcription supplier | In progress | `Berget API service` listed as working baseline | `supplier-register.md` |
| Supplier approval | Approve final note-generation supplier | In progress | `Berget API service` listed as working baseline | `supplier-register.md` |
| Browser boundary | Freeze the supported-browser baseline per release | In progress | Browser families are defined; release-specific baselines still need approval | `supported-browser-matrix.md`, `release-control-records.md` |
| QMS operation | Operate document control, change control, CAPA, supplier control, complaint handling, PMS, and release control as real processes | In progress | Procedures exist, but live records and approvals are incomplete | `qms-index.md` |
| Evidence baseline | Keep and version the executed regression artifact `OMS-MDR-CL1-TEST-REP-001` | Done | Actual `node --test` evidence exists | `test-evidence-register.md` |
| Test evidence depth | Add dedicated protocol/report IDs beyond the broad regression suite | Missing | Current traceability links mostly rely on one broad executed artifact | `requirements-risk-test-traceability-matrix.md` |
| Risk file | Complete residual-risk decisions and control-verification links | Missing | Initial hazard file exists, but not yet finalized | `hazard-analysis-initial-risk-file.md`, `risk-management-plan.md` |
| Clinical evaluation | Execute literature review and create CER | Missing | Plan exists, report does not | `clinical-evaluation-plan.md` |
| PMCF | Decide PMCF plan vs justified limited approach | Missing | Not yet documented | `clinical-evaluation-plan.md` |
| Labeling / IFU | Finalize support contact details, versioning, and user-facing release materials | Missing | Starter pack exists, but final production values do not | `sweden-first-labeling-and-ifu-pack.md` |
| UDI | Assign Basic UDI-DI and UDI approach | Missing | No assignment record yet | `document-register.md` |
| EUDAMED | Complete actor and device registration records | Missing | No registration record yet | `document-register.md` |
| DoC | Finalize declaration of conformity and sign it | Missing | Draft exists, but key fields remain open | `eu-declaration-of-conformity-draft.md` |

## Most important gating items

If you want the shortest possible list, these are the real gates:

1. Contract an external PRRC.
2. Freeze the final regulated web build and suppliers.
3. Implement review-before-export and regulated-build feature gating in the product.
4. Produce dedicated V&V evidence, not just one broad regression run.
5. Complete the CER, labeling pack, UDI/registration records, and sign the DoC.

## Decision on external PRRC

For the current OMS plan, an external PRRC can be:

- an individual consultant with the Article 15 qualifications, or
- a regulatory consultancy that provides a named qualified person under contract

The person must meet the Article 15 qualification threshold and, for a micro or small manufacturer, may be outside your organisation but must be permanently and continuously at your disposal under contract.

Working implication for OMS:

- `Moëll et al AB` can use an external PRRC model
- the PRRC should be located in the Union for an EU-based manufacturer
- you should not use the same external organisation for both the manufacturer's PRRC and the authorised representative's PRRC if that ever becomes relevant

## Source anchors

- MDR Article 15
- MDCG 2019-07 Rev.1 on PRRC
