# Platform Expansion Strategy

Document ID: OMS-MDR-CL1-PLATFORM-EXPANSION-STRATEGY
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document explains how desktop and iPhone/iPad clients fit into the OMS Class I plan.

## Short answer

Yes, they can be added.

No, they should not be added to the first certified configuration unless there is a strong business reason to do so.

The first CE-marked build should remain one manufacturer-controlled web deployment. Additional platforms should be added as later controlled configurations under the same intended purpose only after the web build is stable.

## Why more platforms increase regulatory work

Each added platform increases:

- supported environment definitions
- verification and validation scope
- usability validation scope
- cybersecurity scope
- release and change-control scope
- complaint and post-market surveillance complexity
- technical documentation size

The MDR class may stay the same, but the evidence burden grows.

## Desktop app assessment

### Best-case desktop path

The desktop app is the easier expansion path if it is treated as a thin client to the same manufacturer-controlled backend used by the web reference build.

That means:

- same intended purpose
- same backend logic
- same inference stack
- same prompts
- same review workflow
- same audit and storage architecture
- desktop app mainly adds a packaging and client-platform layer

In that model, desktop is not trivial, but it is manageable as a second controlled configuration.

### Higher-risk desktop path

Desktop becomes much more complex if it includes:

- bundled local models
- standalone offline note generation
- separate local data stores
- local release channels outside the web release process
- platform-specific workflows that differ from the web build

At that point it starts to behave like a separate regulated product configuration rather than a simple client.

## iPhone / iPad assessment

### Why iPhone is harder

The native Apple app in this repo already points toward a different technical stack:

- different client codebase
- mobile OS constraints
- device-permission workflows
- app-store distribution and update path
- potentially different local model runtime
- potentially different user behavior and use environments

If the iPhone/iPad app performs local transcription or local note generation, the validation boundary diverges sharply from the web build.

### Lower-risk iPhone path

The safer route is a narrower mobile companion configuration, for example:

- authentication to the same manufacturer-controlled backend
- audio capture and upload
- transcript viewing
- draft review and approval
- little or no on-device inference in the certified scope

That keeps the mobile client closer to a controlled frontend rather than a separate inference product.

### Higher-risk iPhone path

Using on-device transcription or on-device note generation in the certified scope would materially complicate:

- model validation
- hardware support matrix
- performance consistency
- software lifecycle evidence
- change control when Apple or model dependencies update

## Recommended sequencing

1. Certify the web SaaS reference build first.
2. Add a desktop client second only if it uses the same backend and same locked regulated workflow.
3. Add iPhone/iPad third, and preferably first as a companion client rather than as a separate on-device AI runtime.

## Recommendation for OMS

Recommended platform policy:

- v1 certified scope: web SaaS only
- v2 candidate: desktop client to the same backend
- v3 candidate: iPhone/iPad companion client to the same backend
- on-device AI on desktop or mobile: keep outside certified scope until there is a separate validation program for it

## Decision rule

Add a platform to the CE-marked scope only if:

- it uses the same intended purpose
- it uses the same core regulated workflow
- it does not materially expand the model or deployment variability
- there is a clear business reason that justifies the extra validation burden
