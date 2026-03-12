# Manufacturer Setup Notes

Document ID: OMS-MDR-CL1-MANUFACTURER-SETUP
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

## Recommended default structure

Use `Moëll et al AB` as the legal manufacturer for the CE-marked OMS reference build.

For the working manufacturer record and role ownership, see `manufacturer-details-and-role-assignment.md`.

Why this is the better default:

- A Swedish aktiebolag is an EU legal entity and can act directly as manufacturer under MDR.
- An EU manufacturer does not need a separate EU authorised representative.
- It creates a cleaner separation between the open-source project and the regulated product.
- It is easier to contract with suppliers, hospitals, and insurers through an AB than as a natural person.

## Birger Moëll's likely roles

Birger can credibly contribute as:

- founder / manufacturer representative
- product owner
- clinical subject-matter expert
- usability and workflow lead
- clinical evaluation contributor

## PRRC note

Do not assume that being a licensed clinical psychologist alone is enough to serve as the Article 15 Person Responsible for Regulatory Compliance.

Article 15 requires specific expertise in the field of medical devices, usually shown through:

- a diploma or equivalent qualification in law, medicine, pharmacy, engineering, or another relevant scientific discipline plus at least one year of professional experience in regulatory affairs or quality management systems relating to medical devices, or
- four years of professional experience in regulatory affairs or quality management systems relating to medical devices

Action: verify whether Birger already meets this standard. If not, plan to appoint an external PRRC who is permanently and continuously at the manufacturer's disposal.

## Open-source separation model

To avoid confusion, separate the following clearly:

- `open-medical-scribe` as the public upstream codebase
- `OMS Class I Reference Build` as the manufacturer-controlled product

Only the reference build should carry the CE mark and declaration of conformity. Forks, custom builds, model swaps, prompt changes, and deployment variants are not automatically covered.

## Immediate company-level tasks

1. Confirm the recorded manufacturer details against an official Bolagsverket extract.
2. Decide who signs the declaration of conformity on behalf of the manufacturer.
3. Decide who will act as PRRC.
4. Decide where the quality records, complaint files, and technical documentation master copies will live.
5. Decide whether the manufacturer brand should remain `Open Medical Scribe` or use a separate product brand.
