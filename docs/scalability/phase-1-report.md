# Phase 1 security carry-over report

Status: **in progress**, not phase acceptance. Main and the owner's data/configuration/MFA remain unchanged. This report records local evidence; it does not certify deployment, 50k users or completion of later phases.

| Concern | Evidence | Remaining gate |
| --- | --- | --- |
| SEC-22 database privilege separation | Fresh PG16.15, 14 migrations, 29 actual privilege/rollback checks and all 24 inherited non-browser backend suites pass. Non-PK column grants block indirect audit/retry-history cascades. [Review](database-boundary-review.md). | Actual pooler, browser/PDF/scanner, final image; original owner runtime remains privileged and needs separately approved cutover. |
| SEC-05 dev advisory isolation | `6fce5aa`: 14 artifact-gate contracts; isolated production installation removes nine known advisory-chain entries; existing compiled artifact passes path/content gate. Full dev audit remains visibly nonzero. | Fresh reproducible Linux runtime-only builds, startup and final-image advisory/artifact scan. The dev advisory is not patched. |
| Authorized hidden-root file delivery | `410f383`: same54-byte fake PDF, old500 to new200/exact bytes; transport10 and actual document14/action32/project81. [Review](file-response-review.md). | Full Linux/browser/scanner acceptance. |
| Drain disconnected async work | `3680c0d`: lifecycle144, unchanged admission12; same80ms native fake task unfinished-at-DB-disconnect1 to0, full accepted streams preserved. [Review](graceful-drain-review.md). | Linux/process/failure acceptance. Readiness currently reports lifecycle, not dependency health. |
| Distributed rate enforcement | Two independent limiter factories with budget3 accepted6 for one synthetic identity. | Shared adapter/store, actual two-process and outage negative tests. No budget weakened. |
| Strict verifier source contracts | Expanded same-machine strict check51 errors to0; all24 inherited suites pass again; same compiled objects for type-only repository contracts. [Review](verifier-types-review.md). | Exact-index/security/commit review; ongoing CI enforcement in Phase9. |

Direct suites run on native Node24.13.1/Windows with the new local container through an owned loopback test relay; test mode and default optional development scanner remain clearly distinct from fail-closed production requirements. Existing mocked unit cases do not replace actual database tests. Environment/resources/data scope and exact reproduction are in the linked reviews and append-only [LOG](LOG.md).

Database concern8a1b83a is committed/pushed. The fresh native frontend build and checksum-verified PgBouncer1.26.0 build pass; browser/pooled acceptance is not inferred from them. Next: commit the strict verifier concern, run actual pooled transactions/security/finance and browser/PDF regressions, complete final artifact/secret/advisory scans, and implement proven distributed boundaries before capacity profiling. Phase2-9 gates remain open.
