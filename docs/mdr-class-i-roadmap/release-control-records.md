# Release Control Records

Document ID: OMS-MDR-CL1-RELEASE-CONTROL-RECORDS
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document is the starter release-control record pack for the OMS Class I Web Reference Build.

It defines the minimum release and baseline records that must exist for each regulated production release.

## Record set

For each regulated release, maintain:

1. Release approval record
2. Production configuration baseline
3. Deployment record
4. Rollback / recovery reference

## Release approval record template

- Release identifier:
- Product name:
- Intended deployment:
- Approved by:
- Approval date:
- Linked change records:
- Linked verification records:
- Linked validation records:
- Linked risk review:
- Linked labeling / IFU update:
- Release decision:

## Production configuration baseline template

- Application version:
- Git commit / source baseline:
- Backend runtime version:
- Hosting environment:
- Transcription provider and version:
- Note-generation provider and version:
- Prompt set identifier:
- Supported browser matrix version:
- Enabled workflow features:
- Explicitly disabled excluded features:

## Deployment record template

- Deployment date/time:
- Target environment:
- Responsible operator:
- Release identifier:
- Configuration baseline identifier:
- Post-deploy checks completed:
- Rollback readiness confirmed:
- Notes:

## Rollback / recovery reference template

- Last known good release:
- Rollback owner:
- Restore procedure reference:
- Backup reference:

## Working Release 1.0 baseline

- Release identifier: `OMS-CI-WEB-1.0.0`
- Product name: `OMS Class I Web Reference Build`
- Deployment model: manufacturer-controlled web SaaS
- Working hosting supplier baseline: `Fly.io`
- Working transcription supplier baseline: `Berget API service`
- Working note-generation supplier baseline: `Berget API service`
- Supported browser matrix: `supported-browser-matrix.md` dated 2026-03-11
- Excluded features baseline:
  - end-user provider switching disabled
  - end-user model switching disabled
  - coding hints disabled
  - follow-up questions disabled
  - alert-style outputs disabled
  - self-hosted deployment outside certified scope

## Release rule

No regulated release should be approved unless:

- linked verification is complete
- linked validation is complete where required
- risk review is current
- supported browser matrix is current
- labeling / IFU impact is assessed
- production configuration baseline is frozen
