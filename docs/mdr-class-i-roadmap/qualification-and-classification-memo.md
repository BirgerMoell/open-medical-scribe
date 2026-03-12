# Qualification And Classification Memo

Document ID: OMS-MDR-CL1-QUALIFICATION-AND-CLASSIFICATION-MEMO
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

## Purpose of this memo

This memo records the current working rationale for positioning the OMS Class I Reference Build as ordinary Class I medical device software under Regulation (EU) 2017/745.

This is an internal working document for product and engineering planning. It is not legal advice and should be reviewed by regulatory counsel before being used as part of market placement.

## Product under assessment

The assessed product is not the open-source repository in all possible configurations. It is one manufacturer-controlled reference build with:

- fixed intended purpose
- fixed workflows
- fixed model and prompt configuration
- controlled release management
- clinician review before final use

## Legal qualification question

The first question is whether the reference build is a medical device at all under MDR Article 2(1). That depends on the manufacturer's intended purpose, not on the code alone.

Working position:

- the current broad OMS repository can be positioned outside MDR as documentation support
- the proposed reference build is instead intentionally positioned as regulated healthcare software for professional clinical documentation workflows

That means the manufacturer must make a consistent case across the IFU, product UI, marketing, and technical documentation.

## Software qualification guidance

MDCG 2019-11 rev.1 states, in substance, that:

- software for storage, archival, communication, or simple search is generally not medical device software
- speech recognition is generally not medical device software
- software intended to provide information used to take decisions with diagnosis or therapy purposes is classified under Rule 11

OMS sits near that boundary because pure recording and transcription point away from MDR, while regulated documentation workflows point toward MDR if they are deliberately brought within a medical purpose and manufacturer claim set.

## Working classification position

Working classification target: ordinary Class I under Annex VIII Rule 11.

Rationale:

1. The reference build is software intended for a medical purpose linked to clinical documentation in professional healthcare use.
2. The product is not intended to provide information used to take decisions for diagnostic or therapeutic purposes.
3. The product is not intended to monitor physiological processes.
4. The product is not intended to drive or influence another device.
5. The product therefore aims to fall into the Rule 11 residual bucket: "All other software is classified as class I."

## What must be true for this rationale to hold

The following product and claim constraints are critical:

- The software output remains a draft for clinician review and editing.
- The software does not rank urgency, suggest diagnoses, recommend treatment, recommend referral, or flag deterioration.
- The manufacturer does not claim that OMS improves diagnostic accuracy, treatment safety, triage quality, or patient-management decisions.
- Generated text is presented as documentation support, not as patient-specific medical judgment.
- The reference build is locked to validated models, prompts, and workflows under change control.

## What would likely break the Class I argument

Any of the following would create substantial risk of Rule 11 Class IIa or higher:

- claims that the software provides information used to take diagnosis or therapy decisions
- patient-specific clinical recommendations
- red-flag detection or alarm generation
- urgency or prioritization logic
- autonomous coding or summarization positioned as driving reimbursement or care decisions
- hidden or explicit reasoning layers presented as clinical insight

## Repo-specific pressure points

The current repository contains features and wording that need review before they could sit inside a Class I technical file:

- note sections such as `Assessment` and `Plan`
- marketing phrases such as `journal-ready`
- flexible model / provider choices that weaken validation of one certified configuration
- open-ended note generation that can look like clinical reasoning even if it is intended as drafting support

These do not automatically defeat the Class I path, but they do require tighter scope control.

## Immediate evidence needed

Before relying on this classification position, create:

1. a tighter intended purpose and exclusion statement
2. a product boundary matrix showing what is inside and outside the CE-marked build
3. a UI and marketing claim review against Rule 11 risk
4. a model and prompt change-control policy
5. validation evidence showing the output remains transcript-grounded and review-first

## Current recommendation

Proceed with the Class I workstream only if OMS is intentionally narrowed to a documentation-support reference build. If the business goal changes toward clinical decision support, coding support tied to care decisions, triage, or risk detection, stop this path and re-run classification for Rule 11 Class IIa or higher.

## Primary sources

- MDR Article 2, Article 10, Article 15, Article 52, Annex VIII Rule 11: https://eur-lex.europa.eu/eli/reg/2017/745/2017-05-05/eng
- MDCG 2019-11 rev.1: https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf&prefLang=pl
- EC Class I factsheet: https://health.ec.europa.eu/system/files/2021-07/md_mdcg_2021_factsheet-cl1_en_0.pdf
