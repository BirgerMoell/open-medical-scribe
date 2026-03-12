# Sweden-First Labeling And IFU Pack

Document ID: OMS-MDR-CL1-SWEDEN-FIRST-LABELING-AND-IFU-PACK
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document is a starter pack for the information supplied by the manufacturer for the OMS Class I Web Reference Build.

It is not a final artwork or UI asset pack. It is the content structure and starter wording for the regulated web deployment.

Manufacturer identity should be kept consistent with `manufacturer-details-and-role-assignment.md`.

## Regulatory notes

- For use in Sweden, labeling and instructions for use should be available in Swedish.
- For a software device, the required information can be provided through the software interface, accompanying documentation, or other supplied materials, as long as MDR requirements are met.
- The final pack must align with the exact released product, manufacturer details, UDI data, and supported environment.

## Pack contents

1. Device identification and manufacturer details
2. Intended purpose and limitations
3. User-facing warnings and precautions
4. Supported environment statement
5. Core instructions for use
6. Complaint / incident contact information
7. Version and traceability information

## 1. Device identification

### English working text

Product name: OMS Class I Web Reference Build

Device type: Medical device software for professional clinical documentation support

Manufacturer: Moëll et al AB

Address: Slagrutevägen 3, 182 34 Danderyd, Sweden

Organization number: 556998-2605

### Swedish working text

Produktnamn: OMS Class I Web Reference Build

Produkttyp: Medicinteknisk programvara för professionellt stöd vid klinisk dokumentation

Tillverkare: Moëll et al AB

Adress: Slagrutevägen 3, 182 34 Danderyd, Sverige

Organisationsnummer: 556998-2605

## 2. Intended purpose statement

### English working text

OMS is intended to support clinical documentation by converting encounter audio into transcript-grounded draft documentation for review and editing by licensed healthcare professionals.

OMS is not intended to diagnose, triage, predict, recommend treatment, recommend referral, prioritize urgency, or otherwise provide patient-specific clinical decision support.

### Swedish working text

OMS är avsedd att stödja klinisk dokumentation genom att omvandla ljud från vårdmöten till utkast till journaltext som är förankrad i transkriptionen och som ska granskas och redigeras av legitimerad hälso- och sjukvårdspersonal.

OMS är inte avsedd att diagnostisera, triagera, prediktera, rekommendera behandling, rekommendera remiss, prioritera brådskandegrad eller på annat sätt ge patientspecifikt kliniskt beslutsstöd.

## 3. Intended users and environment

### English working text

Intended users: licensed healthcare professionals and authorized support staff working under clinician supervision where permitted.

Intended environment: professional healthcare settings and controlled remote documentation workflows.

### Swedish working text

Avsedda användare: legitimerad hälso- och sjukvårdspersonal samt behörig stödpersonal som arbetar under klinikers överinseende där detta är tillåtet.

Avsedd användningsmiljö: professionella vårdmiljöer och kontrollerade arbetsflöden för klinisk dokumentation på distans.

## 4. Core warnings and limitations

### English working text

- Draft output must be reviewed and edited as needed by a licensed healthcare professional before use.
- Do not use OMS as a diagnostic or treatment decision tool.
- Do not treat generated text as complete or authoritative without review against the transcript and clinical context.
- Use only within the supported browser and deployment environment defined by the manufacturer.

### Swedish working text

- Utkast som genereras av OMS måste granskas och vid behov redigeras av legitimerad hälso- och sjukvårdspersonal innan de används.
- OMS får inte användas som verktyg för diagnostiska beslut eller behandlingsbeslut.
- Genererad text får inte betraktas som fullständig eller auktoritativ utan granskning mot transkriptionen och det kliniska sammanhanget.
- Produkten får endast användas inom den webbläsar- och driftsmiljö som tillverkaren har specificerat.

## 5. Supported environment summary

### English working text

- Manufacturer-controlled web deployment
- Supported browsers and minimum versions as specified by the manufacturer
- Stable internet connection required
- Microphone permission required for live audio capture

### Swedish working text

- Tillverkarkontrollerad webbtjänst
- Webbläsare och lägsta versioner enligt tillverkarens specifikation
- Stabil internetanslutning krävs
- Mikrofonbehörighet krävs för liveinspelning av ljud

## 6. Basic instructions for use

### English working text

1. Sign in to the OMS web application.
2. Start a new encounter and record audio or upload an audio file.
3. Review the generated transcript.
4. Review and edit the generated draft note.
5. Approve the note only after confirming it is accurate and suitable for the patient record.
6. Export or copy the approved documentation.

### Swedish working text

1. Logga in i OMS webbapplikation.
2. Starta ett nytt möte och spela in ljud eller ladda upp en ljudfil.
3. Granska den genererade transkriptionen.
4. Granska och redigera det genererade anteckningsutkastet.
5. Godkänn anteckningen först efter att du har säkerställt att den är korrekt och lämplig för patientjournalen.
6. Exportera eller kopiera den godkända dokumentationen.

## 7. Complaint and incident reporting text

### English working text

If you suspect that OMS has malfunctioned, produced unsafe output, or contributed to a serious adverse event, stop using the affected workflow and report the issue to the manufacturer without undue delay.

### Swedish working text

Om du misstänker att OMS har fungerat felaktigt, genererat osäkert innehåll eller bidragit till en allvarlig negativ händelse ska användningen av det berörda arbetsflödet avbrytas och händelsen rapporteras till tillverkaren utan onödigt dröjsmål.

## 8. Traceability fields to finalize before release

- support / complaint contact details
- support / complaint email
- device version
- release date
- Basic UDI-DI
- UDI-DI if applicable to supplied instance
- CE marking presentation

## 9. Packaging locations for software labeling

For the regulated web deployment, the final information pack will likely need to appear in multiple places:

- in-app `About` / device information page
- in-app instructions / help page
- website legal / product information page
- downloadable IFU PDF for controlled release

## 10. Primary source anchors

- MDR Annex I Section 23
- European Commission overview of language requirements for manufacturers of medical devices
- Läkemedelsverket guidance stating that medical devices used in Sweden must have labeling and IFU in Swedish, including software
