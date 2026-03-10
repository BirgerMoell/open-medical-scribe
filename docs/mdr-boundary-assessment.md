# MDR Boundary Assessment For Eir Scribe

Last reviewed: 2026-03-10

This document is a product and engineering assessment of how the current Eir Scribe feature set relates to the EU Medical Device Regulation (MDR). It is not legal advice. If you plan to commercialize the product in clinical settings, you should have this reviewed by regulatory counsel and, if needed, a notified body strategy adviser.

## Executive conclusion

Eir Scribe can plausibly be positioned outside MDR if its intended purpose remains narrow:

- record a clinical conversation
- transcribe the conversation
- draft editable documentation for clinician review
- export documentation into existing journal workflows

That position becomes much harder to defend if the product is marketed or implemented as making patient-specific diagnostic, triage, treatment, referral, or risk-management recommendations.

The highest-risk feature in the current product is not audio capture or transcription. It is AI-generated note drafting, especially when the output includes sections such as `Bedömning`, `Assessment`, or `Plan`. That can still be outside MDR if the software is framed and constrained as documentation support only, but it is the part most likely to draw regulatory scrutiny.

## Primary sources reviewed

- EU MDR text: [Regulation (EU) 2017/745](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A02017R0745-20250110)
- European Commission guidance: [MDCG 2019-11 rev.1, Qualification and Classification of Software](https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf&prefLang=pl)
- European Commission explainer: [Is your software a medical device?](https://health.ec.europa.eu/document/download/b865d8e9-081a-4601-a91a-f120321c0491_en)
- Swedish regulator FAQ on language requirements: [Läkemedelsverket, märknings- och informationskrav](https://fragor.lakemedelsverket.se/org/lakemedelsverket/d/vilken-markning-och-information-ska-finnas-pa-medi/)

## Core MDR boundary

Under MDR, software is a medical device when the manufacturer intends it to be used for one or more medical purposes, such as diagnosis, prevention, monitoring, prediction, prognosis, treatment, or alleviation of disease.

MDCG 2019-11 rev.1 also draws a practical line:

- software for storage, archival, communication, or simple search is generally not medical device software
- speech recognition or speech-to-text systems are generally not medical device software
- software that drives or influences clinical decisions for individual patients can fall under MDR and Rule 11

## Eir Scribe feature-by-feature assessment

### Features that are likely outside MDR if the intended purpose stays narrow

| Feature | Current role | MDR view |
| --- | --- | --- |
| Audio recording | Capture encounter audio | Likely outside MDR |
| Speech-to-text transcription | Convert speech to text | Likely outside MDR |
| Transcript storage and history | Save prior encounters and revisions | Likely outside MDR |
| Export functions | Copy journal text, share files, FHIR `DocumentReference` formatting | Likely outside MDR if purely formatting and transfer |
| Search across transcripts | Accent-insensitive text search | Likely outside MDR if it stays simple retrieval |
| Hosting, authentication, quotas, audit logs | Operational infrastructure | Outside MDR as infrastructure |
| Local model selection and downloads | Runtime configuration | Outside MDR as infrastructure |

Why: MDCG 2019-11 rev.1 explicitly treats storage, communication, simple search, and speech recognition as generally outside the medical-device-software boundary.

### Features that are borderline and need careful control

| Feature | Risk | Current view |
| --- | --- | --- |
| Draft note generation from transcript | Can look like clinical reasoning if the model invents or recommends content | Borderline |
| Swedish journal structure with `Bedömning` and `Plan` sections | Fine as documentation structure, risky if presented as machine clinical judgment | Borderline |
| Example note text on site and in app | Marketing examples can imply diagnosis support even if the code does not | Borderline |

Why: the more the product appears to transform raw conversation into patient-specific medical judgment, the more likely regulators are to see it as software providing information used for diagnosis or treatment decisions under Rule 11.

### Features that would likely pull the product into MDR

These should be treated as in-scope triggers:

- red-flag detection or alarm generation
- triage recommendations
- differential diagnosis suggestions
- treatment or dosage recommendations
- patient-specific referral recommendations
- risk scores, prognosis, or deterioration prediction
- ranking urgency or level of care
- highlighting clinically important findings in a way intended to influence decisions
- autonomous coding or documentation claims tied to reimbursement or treatment decisions

If Eir Scribe is intentionally marketed or used for those purposes, it likely becomes medical device software and Rule 11 classification analysis is required.

## Assessment of the current repository

### What already helps

The repository already contains language that supports a non-MDR positioning:

- `assistive documentation tool, not a diagnostic system`
- `clinician review required`
- `draft note`
- `do not invent symptoms, findings, diagnoses, medications, or plans`

Those are the right instincts.

### What remains risky

The current product still generates structured sections like `Assessment` and `Plan`, and some site copy uses phrases such as `journal-ready`. That is acceptable for a documentation product, but it creates a tighter regulatory boundary because the generated text may read like clinician-authored judgment even when it is AI-drafted.

This does not automatically make the product MDR-regulated. It does mean the product should be designed and marketed so that:

- the AI is summarizing what was said, not making fresh clinical decisions
- the clinician remains the authorizing decision-maker
- the product does not claim to improve diagnosis, treatment, or triage quality

## Recommended path if you want to stay outside MDR

### Intended-purpose language

Use a tight intended-purpose statement consistently:

> Eir Scribe is a clinician-assistive documentation system that records, transcribes, and drafts editable clinical notes for review by a licensed healthcare professional. It is not intended to diagnose, triage, predict, recommend treatment, or otherwise make patient-specific clinical decisions.

### Product constraints

- Keep all note output editable and review-first.
- Require clinician sign-off before export or finalization in production deployments.
- Keep prompts constrained to transcript-grounded summarization.
- Avoid automated alerts, warnings, red-flag labels, or referrals.
- Avoid hidden reasoning features that claim clinical insight.
- Treat FHIR export as document packaging, not decision support.

### Marketing and documentation controls

- Avoid claims such as `diagnostic support`, `safer diagnosis`, `clinical decision support`, `recommends treatment`, `finds red flags`, or `prioritizes urgent cases`.
- Avoid selling the product on improved diagnostic accuracy unless you are prepared to go into MDR.
- Explain that the output is a draft for documentation, not a recommendation engine.
- Keep Swedish and English product pages aligned on this point.

### Engineering controls

- Log model failures and hallucination-like output events.
- Keep transcript-to-note prompts grounded in source text.
- Add tests that reject invented diagnoses, medications, referrals, or treatment plans not supported by the transcript.
- Keep clear UI markers such as `Draft`, `Edited`, and `Clinician review required`.

## What you would need if MDR does apply

If you decide to add decision-support features, or if your intended purpose shifts enough that MDR applies, the likely workstream is:

1. Define intended purpose, users, environment, and clinical claims.
2. Classify the software under MDR, especially Rule 11.
3. Establish a QMS under MDR Article 10(9).
4. Maintain risk management under Article 10(2) and Annex I.
5. Produce technical documentation under Article 10(4) and Annex II/III.
6. Perform clinical evaluation under Article 61 and Annex XIV.
7. Appoint a PRRC under Article 15.
8. Establish post-market surveillance and vigilance under Article 83 onward.
9. Complete conformity assessment and CE-marking steps appropriate to the class.

In practice, most software that provides information used to make patient-management decisions does not stay in Class I under MDR. Rule 11 often pushes that software into Class IIa or higher.

## Sweden-specific note

If the product is CE-marked as a medical device and placed on the Swedish market, labeling and information supplied to the user generally need to be in Swedish unless an exception applies. That matters for instructions for use, warnings, and product labeling.

## Practical next steps for this repository

### Immediate

- Keep the current `assistive documentation` framing in the app, README, and public site.
- Review prompts and examples so they stay transcript-grounded and do not imply diagnosis support.
- Add negative tests for invented diagnosis or treatment content.
- Add this MDR boundary review to product decision-making for every new feature.

### Before commercial rollout

- Prepare a written intended-purpose statement for the production offering.
- Review all marketing claims and App Store descriptions against that intended purpose.
- Decide explicitly whether the company strategy is:
  - stay outside MDR as documentation software, or
  - enter MDR as medical device software
- Get external regulatory review before making any claims about clinical decision quality, patient safety improvement, triage, or treatment guidance.

## Repo-level conclusion

Based on the current feature set and current guidance, Eir Scribe can still be positioned outside MDR if it remains a review-first documentation and transcription product. The main regulatory pressure point is AI note drafting. If that drafting evolves into patient-specific clinical recommendations, or is marketed as influencing care decisions, the product should be treated as likely in scope for MDR and reworked accordingly.
