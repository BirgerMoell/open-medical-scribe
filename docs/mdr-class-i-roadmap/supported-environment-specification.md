# Supported Environment Specification

Document ID: OMS-MDR-CL1-SUPPORTED-ENVIRONMENT-SPECIFICATION
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document defines the environment assumptions for the OMS Class I Web Reference Build.

Only the environments listed here should be treated as supported in the regulated configuration.

## Deployment model

- manufacturer-controlled web SaaS
- Sweden-first production hosting
- separate production and non-production environments

## User environment

### Intended use setting

- professional healthcare environments
- controlled remote documentation workflows used by healthcare professionals

### User device class

- desktop or laptop computers used by clinicians or authorized staff

### Excluded primary environment for v1

- phones as the primary regulated workflow surface
- unmanaged kiosk or public devices
- unsupported browsers

## Browser support

The regulated build uses the explicit baseline in `supported-browser-matrix.md`.

## Backend environment

- one production runtime architecture under manufacturer control
- fixed Node runtime version
- fixed application release package
- fixed infrastructure configuration

## Networking assumptions

- HTTPS required
- stable internet connectivity required for the SaaS workflow
- browser microphone permissions required for live capture

## Storage assumptions

- production storage under manufacturer control
- access-controlled audit log storage
- defined backup and restore capability
- defined retention policy

## Inference environment assumptions

- one validated transcription configuration
- one validated note-drafting configuration
- no end-user runtime switching

## Unsupported environment changes without re-evaluation

- changing hosting region or hosting provider in a way that affects safety, privacy, or performance assumptions
- adding new supported browsers without validation
- allowing unsupported mobile browser workflows
- changing model, provider, or prompt configuration
- enabling self-hosted deployment under the certified claim

## Linked records to maintain

1. Infrastructure baseline record
2. Supported browser matrix
3. Production configuration record
4. Release record per deployed version
