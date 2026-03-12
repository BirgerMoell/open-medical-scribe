# Cybersecurity And Data Protection File

Document ID: OMS-MDR-CL1-CYBERSECURITY-AND-DATA-PROTECTION-FILE
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document is the starter cybersecurity and data protection file for the OMS Class I Web Reference Build.

It supports the MDR Annex I software and information-supplied requirements and should be maintained with the risk file, supported environment specification, and PMS records.

## Purpose

To define the security and data-protection assumptions, threats, controls, and maintenance expectations for the regulated web deployment.

## Scope

Applies to:

- browser client
- manufacturer-controlled backend
- production configuration and secrets
- audit and operational data
- transcript and note data handled within the regulated workflow
- integrations required for the locked production inference stack

## Primary regulatory anchors

- MDR Annex I Sections 17.2, 17.4, 22, and 23
- MDCG 2019-16 rev.1 cybersecurity guidance

## Security objectives

1. Preserve confidentiality of PHI and credentials.
2. Preserve integrity of released code, prompts, models, config, and audit records.
3. Preserve availability of the regulated workflow within defined operational limits.
4. Detect, investigate, and respond to security-relevant events.

## Protected assets

- encounter audio
- transcripts
- draft and approved note content
- user accounts and session data
- provider credentials and API keys
- production configuration
- prompt sets and model-selection baseline
- audit logs
- release artifacts

## Threat themes

### Unauthorized access

- compromised user accounts
- privilege escalation
- unauthorized admin/config access

### Data exposure

- insecure storage
- insecure logs
- accidental disclosure through support or debugging workflows

### Integrity compromise

- unapproved prompt or config change
- deployment artifact tampering
- manipulated audit records

### Availability disruption

- denial of service
- provider outage
- storage failure
- dependency failure

## Minimum control baseline

### Identity and access

- authenticated access for regulated workflows
- role-based authorization
- least-privilege admin access
- controlled credential rotation

### Transport and storage

- HTTPS in production
- protected storage for regulated data and logs
- encrypted secrets handling
- retention and deletion controls

### Configuration integrity

- production settings writes disabled unless explicitly controlled
- release artifacts identified and versioned
- prompt/model/provider baseline under change control
- monitoring for unapproved production drift

### Operational security

- logging of security-relevant events
- incident response path
- backup and recovery procedure
- separation of production and non-production environments

### Application security

- input validation
- file upload constraints
- protected administrative functions
- secure session handling

## Data-protection baseline

This file is not a full GDPR program, but the regulated product should align with these minimum principles:

- data minimization
- purpose limitation
- role-based access
- defined retention period
- support for incident investigation without excessive PHI exposure
- controlled use of cloud subprocessors where applicable

## OMS-specific security pressure points

- cloud inference providers handling sensitive transcript content
- production secrets for provider APIs
- audit logging that may contain PHI-bearing workflow metadata
- configuration drift that could change regulated behavior silently
- browser-based audio upload and microphone permission flows

## Security verification expectations

At minimum, maintain evidence for:

- authentication and authorization tests
- upload and input-validation tests
- configuration integrity checks
- environment separation checks
- logging and incident-detection checks

## Security maintenance expectations

Security review should be triggered by:

- major dependency updates
- hosting/infrastructure changes
- model/provider changes
- security incidents or near misses
- addition of new platforms or admin functions

## PMS and incident linkage

Security events that may affect safety, integrity of the regulated workflow, or availability of critical records must feed into:

- complaint handling
- vigilance assessment
- CAPA
- risk-file updates

## Sweden-first operational notes

- user-facing privacy and security information should be available in Swedish for Sweden-market use
- hosting and subprocessor choices should be documented consistently with the manufacturer's privacy materials and contracts
