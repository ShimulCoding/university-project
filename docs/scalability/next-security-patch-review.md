# Next security patch: exact candidate verification

2026-10-30. Scope: pin Next and matching ESLint configuration to16.4.1 and add the maintained-runtime/package regression verifier. Backend parser/quota/image drafts remain separate. This does not accept a Linux runtime, deployment or50,000-user capacity.

## Change and reachability

`frontend/package.json` pins `next` and `eslint-config-next` to16.4.1 and registers `verify:framework-security-patch` once. Verifier: `frontend/scripts/verify-framework-security-patch.mjs`. The draft initially duplicated that script key: a JSON object-pairs check rejected it before removal and passed afterward; parsed command behavior is preserved.

Starting at4fbf0b2, exactly13 lock records change: frontend, Next, `@next/env`, `@next/eslint-plugin-next`, eight platform SWC packages and `eslint-config-next`. Independent review confirms forward reconstruction equals the candidate and reversal equals HEAD, with no hidden top-level/backend/Redis changes. Candidate lock SHA256: `5fd0b4eab35d4c0d52afed4beaccf3e0b19df0e25b9538803b9cdd9f0d98ea34`. Never stage the whole working lock, which contains other drafts.

Maintainer advisories identify16.4.1 as patched for [SVG image optimization](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [cached typed-array results](https://github.com/advisories/GHSA-673q-mjm6-r5xr) and [Server Action denial of service](https://github.com/advisories/GHSA-p3m5-59mp-jv5r). Feature/platform prerequisites matter: inspected project config has no SVG-enabling or Cache Components setting, and the frontend contains no `use server`/`use cache` directives. No application RCE or complete exploit reachability was demonstrated. The dependency gate still requires the patched release.

Sharp0.35.5 and all28 Sharp/libvips lock records were already present and remain unchanged. Next raises its declared Sharp minimum; this does not claim an installed Sharp upgrade. React/DOM remain matched at19.3.0. Changed artifacts resolve only to the official npm registry; publisher metadata, SHA512-verified archives and MIT notices are retained in ignored frontend-patch evidence. No authorization/session/MFA rule, install script or application migration is introduced.

## Same-feed advisory comparison

`node .cache/scalability/audit-resume-candidates-20261030.mjs` uses fresh public manifest/lock directories, empty npm configurations and official registry requests, retaining every audit status.

| Graph | Production / full exits | Findings |
| --- | --- | --- |
| Committed4fbf0b2 baseline | 1 / 1 | 7:1critical,3high,3moderate |
| Exact Next-only candidate | 1 / 1 | 6:0critical,3high,3moderate; Next absent |
| Complete patched working draft | 0 / 0 | 0; separate uncommitted backend/quota graph |

The six remaining candidate entries are body-parser,ip-address,multer,nodemailer,qs,zod. This is a security-advisory comparison, not a throughput or latency benchmark. Feed changes can change counts. Reports: `.cache/scalability/security-candidates-20261030-4d613d92d1be4780ba62b5269a97a6f0/`.

## Exact installation and tests

`node .cache/scalability/install-next-candidate-20261030.mjs` creates a fresh public frontend workspace and runs `npm ci --workspace frontend --include=dev --ignore-scripts` with the exact lock, official package hosts and empty user/global npm configuration. Install exits0 without lock-hash change. Original environment, owner accounts/MFA and database are not inputs. The first fixture omitted public `tsconfig.base.json` and failed TypeScript-dependent gates; adding that required input fixes the fixture without changing compiler options or assertions. Its failure remains retained.

`node .cache/scalability/verify-next-front-final-20261030.mjs --workspace .cache/scalability/next-candidate-20261030-142be1a4f06f474091aab0de5d9b4006/workspace` passes all12 gates: framework security21+4, client, financial submission, PDF, UI, policy, origins, logging, reset-token contract, lint, production build and types. All168 public frontend source files match root. Direct child guards report0 dotenv reads and0 ORM import attempts; they are not an OS sandbox. Local Windows runtime is Node24.13.1. Evidence: `.cache/scalability/frontend-final-20261030-8b044e7fd8214d7b8a89b3c15b5ae9d0/report.json`; retained missing-config failure: sibling `frontend-final-20261030-f1cc51ebd7a04733a3a1a37eb9bcfa1e/`.

The verifier exercises actual Sharp conversion, valid decoding, bounded cyclic-model rejection and synthetic typed-array view isolation, plus exact package/platform/version checks and rejected unsafe tags. The child has a10s bound and no shell. No native RCE payload is executed. A proposed before/after cyclic experiment failed its hypothesis: both SHA512-verified16.4.0 and16.4.1 reject its three-entry model. Keep `.cache/scalability/next-decoder-20261030-f8ba013abeed4a418924ae533c108924/report.json` and failing exit. This is maintained negative behavior, not a reproduced advisory or demonstrated DoS/performance gain; the assertion was not weakened.

`node .cache/scalability/run-next-candidate-browser-20261030.mjs --reuse-build` uses that exact freshly installed/built frontend, the proven copied fake backend and owned PostgreSQL16.15 fixture. Real Edge CSP15, event-workspace/design1135 and MFA74 pass; all reported outside-source/module/native counters0 and parent exit0. Workspace phase185,793ms, MFA27,405ms; these are verification durations, not application latency/capacity. Evidence: `.cache/scalability/verification-workspace-b7a7cf461a1548a3adcd75f029e33948/.cache/next-patch-browser-9652f735f61c4e0895db762b6b7bb725/report.json` records the exact candidate lock hash. The older301s timeout remains unclassified; neither successful rerun is a claimed product repair. Its unchanged deadline is300,000ms.

Independent read-only review confirms the13-record scope and no blocking code finding, with installation/scanning/index gates explicitly required. Semgrep1.180.0 runs68 applicable JS rules on the verifier:0findings/0errors, metrics/version checks off. Report: `.cache/scalability/next-verifier-semgrep-20261030.json`. Staged secret/diff/inventory gates must pass before commit.

Separately, the complete patched backend graph passes constructor106, build635compiler inputs/174outputs/0diagnostics and all24 serialized suites with0parent/child boundary violations. Its different lock `ed7e90ad7660a7c4b6f0716f03e1dcf06d4196e3e11db0f3c9e45424df3f3f3d` includes other drafts and is not substituted for this candidate. Native Linux/image/license/startup, real antivirus/email, shared-store failure behavior and later phase acceptance remain open. No workload benchmark or user capacity is claimed.

## Rollback

Reverse only this concern's two package pins,13 lock records and verifier/command through a reviewed follow-up commit. Preserve other drafts and all reports; do not reset the working tree, reseed a database or change credentials/MFA. A vulnerable-version rollback is development recovery, never release acceptance. Keep release blocked until remaining backend advisories and artifact/security gates pass. Commit from the repository root, alternate contributors, and push only `perf/world-class-scalability`.
