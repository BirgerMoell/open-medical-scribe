# Supported Browser Matrix

Document ID: OMS-MDR-CL1-SUPPORTED-BROWSER-MATRIX
Version: 0.1
Status: Draft
Owner: Birger Moëll

Last updated: 2026-03-11

This document defines the working browser support boundary for the OMS Class I Web Reference Build.

It should be read together with `supported-environment-specification.md` and the release-control records.

## Support policy

The regulated build is validated only for browsers listed in this matrix.

If a browser family or minimum version changes, the change must go through the software lifecycle and change-control procedure before it is treated as supported in the regulated build.

## Release 1.0 working browser matrix

| Browser family | Minimum supported version | Supported operating context | Status |
| --- | --- | --- | --- |
| Safari | Release-specific validated baseline recorded in the release-control record | Supported macOS desktop/laptop devices in the regulated workflow | Supported |
| Google Chrome | Release-specific validated baseline recorded in the release-control record | Supported desktop/laptop devices in the regulated workflow | Supported |
| Microsoft Edge | Release-specific validated baseline recorded in the release-control record | Supported desktop/laptop devices in the regulated workflow | Supported |
| Firefox | N/A | Not validated for the regulated workflow in v1 | Not supported |
| Mobile browsers | N/A | Phones and tablet browser workflows are outside the regulated v1 scope | Not supported |

## Why the matrix is narrow

- OMS v1 is a regulated desktop/laptop browser workflow, not a general consumer web app.
- Audio capture, review state handling, and approval controls must be validated on each supported browser family.
- Narrow browser support reduces variability and eases post-market control.

## Use rule

If a user accesses OMS from an unsupported browser, the regulated workflow should either:

- block the unsupported browser, or
- display a clear unsupported-environment warning and prevent regulated use

## Maintenance rule

This matrix should be reviewed when:

- a supported browser family issues a major update affecting the workflow
- PMS data shows browser-specific failures
- the manufacturer decides to add or remove browser families

## Note on version baseline

The exact minimum versions must be frozen in the release-control record for each regulated release. Browser families listed here are not a promise that every later version is automatically supported without controlled review.
