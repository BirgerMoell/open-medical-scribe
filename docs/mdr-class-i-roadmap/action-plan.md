# OMS Class I Action Plan

Document ID: OMS-MDR-CL1-ACTION-PLAN
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This plan is ordered to reduce the risk of doing expensive documentation work against the wrong product boundary.

## Phase 1: Lock the regulatory strategy

1. Confirm the legal manufacturer.
2. Freeze the exact regulated product name and reference build boundary.
3. Approve the intended purpose, intended users, intended environment, and explicit exclusions.
4. Write the formal qualification and classification rationale, including why OMS is:
   - medical device software under MDR, and
   - ordinary Class I rather than Rule 11 Class IIa or higher.

## Phase 2: Reduce classification risk in the product

1. Review current UI copy, README copy, prompts, and examples against the intended purpose.
2. Remove or quarantine any claims that imply diagnosis, treatment, triage, referral, or patient-prioritization support.
3. Define the locked CE-marked configuration:
   - supported providers
   - fixed model versions
   - fixed prompts
   - supported deployment architecture
   - supported integrations
4. Decide which current features remain outside the certified scope.

## Phase 3: Build the quality and safety backbone

1. Create the QMS structure required by MDR Article 10(9).
2. Create document control, change control, CAPA, supplier control, complaint handling, PMS, and vigilance procedures.
3. Start the risk management file and hazard analysis.
4. Start the software requirements, architecture, and traceability set for the reference build.

## Phase 4: Build the evidence package

1. Build the Annex I GSPR checklist.
2. Create the software verification and validation plan.
3. Run verification and validation against the locked configuration.
4. Create the clinical evaluation plan and clinical evaluation report.
5. Create the PMCF plan or a justified PMCF rationale if a limited plan is defensible.
6. Create usability evidence for clinician review workflows and error recovery.

## Phase 5: Prepare market access artifacts

1. Assign Basic UDI-DI and UDI-DI strategy.
2. Prepare labeling, IFU, and version identification.
3. Register the manufacturer in EUDAMED and obtain the SRN.
4. Register the device / UDI data in EUDAMED when the applicable module is live for use.
5. Draft and sign the EU declaration of conformity.
6. Affix the CE mark to the reference build and supplied materials.

## Phase 6: Operate the device after market entry

1. Run PMS continuously.
2. Maintain the Class I PMS report.
3. Process complaints, incidents, and corrective actions.
4. Reassess classification after major feature or model changes.
5. Keep the technical documentation current for at least 10 years after the last device has been placed on the market.

## Repo-specific near-term tasks

1. Add a qualification and classification memo in this folder.
2. Add a GSPR checklist template.
3. Add a software change control policy for model and prompt changes.
4. Add tests and product constraints that enforce the intended-purpose boundary in the CE-marked build.
5. Freeze the web reference build product specification and supported production architecture.
