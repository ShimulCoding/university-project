# IPv6 parser security patch

Prepared2026-10-27; refreshed2026-11-01 with guarded serial comparison and exact candidate evidence. Final application/artifact gates remain open.

[GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) affects ip-address through10.7.3: searching a zone with unanchored `/%.*$/` before checking address length permits quadratic work. The fix finds the first `%` by index and scans the suffix once. HTTP headers cannot carry CR/LF; ERL also checks `node:net.isIPv6` before this parser, excluding the fixture's invalid input. This is a package correction/artifact gate, not an application endpoint exploit reproduction.

Keep installed `express-rate-limit@8.7.1`, HEAD's backend range `^8.6.2` and ERL's `ip-address ^10.2.0` range. A transitive update selects **10.7.5**, requiring no new direct production dependency or override; only that lock entry changes and its verifier command is registered. Exclude the unrelated draft's exact ERL pin. Minimum security fix is10.7.4. The [maintainer comparison](https://github.com/beaugunderson/ip-address/compare/v10.7.4...v10.7.5), retained in ignored `ip-10.7.5-compare.json`, adds non-ASCII parser tests, development dependency updates and a Teredo flag-bit metadata correction. Its corrected zero-based bit-index callers are outside ERL's constructor/subnet identity path. No application validator, proxy hop, identity, subnet or rate policy changes.

`backend/scripts/verify-security-ip-parser.ts` runs bounded1,024/2,048/4,096-percent prefixes followed by newline and `x`(total1,026/2,050/4,098ASCII bytes) in a clean child. It counts calls to the problematic regex while delegating unchanged execution: retained10.7.3 dispatches six times across constructor/isValid controls, patched10.7.5 zero. Both reject every input. Timings are recorded without brittle wall-clock thresholds or whole-application capacity claims. Valid IPv4/IPv6, zones, non-ASCII rejection and unchanged ERL behaviors pass: IPv4-mapped identity, default/56 grouping, adjacent/56 separation, disabled grouping, and a real loopback204/204/429sequence with retry/rate headers/fresh-subnet204. **25assertions pass per version**,21child+4wrapper. The temporary import seam supplies the selected real parser to unchanged ERL; it is not a production override. OS variables use the existing portable allowlist, parent15s/output1MiB bounds unchanged.

Official registry 10.7.5 tarball integrity is `sha512-t2v0rkILYv9WXmSL7TpAaU3HXgaFYOPUcH3QHgwQ++gpJuH3bqyMy4Fvt/DJCTKwzH3Cf+bAp5W/mFL39KPLzA==`; downloaded bytes match. MIT `LICENSE` is present, 1,061B, SHA256 `f8d791359a50cbcac82c29cb7b0b1b889b28be76fdd35b8ee33f0f7c8704702a`. Clean OS/empty npm configs/absent project npmrc/official registry/disabled scripts were used. All 18 generated Prisma files remain identical.

Ignored evidence: `.cache/scalability/runtime-deps-20261027/step-ip-address/` retains exact before/after manifests/lock, tarball and installation report; original source and `final-checks/ip-parser-{before,after}.stdout.log` are retained. Run:

```powershell
node node_modules/tsx/dist/cli.mjs backend/scripts/verify-security-ip-parser.ts
```

The original metadata-export rejection is historical; standing approval now permits public-only official-registry audits with empty npm settings. Exact candidate `.cache/scalability/ip-candidate-20261101-22649c87505144dca05def26e6144041` afterf949beb has LF lock SHA256 `b13e6cbe44a486d46c109459a0c2743961fea36960fb4f33262db193447d0a94`, backend manifest `125daec01a6d2b8af67680d6240e9302a00abb06fc8b32196deb5e759934a813`. Audit run `verification-run-8a878745b422487c936e34edf93633f4/audit-report.json` has production1/full17entries, both exit1, versus same-day2/18; only ip-address disappears. Zod and development minimatch remain open. Lock dry-run0/hash unchanged is a manifest contract, not an installed exact whole-runtime proof.

Fresh commands under root `.cache/scalability`: `refresh-ip-proof-20261101.mjs`, `run-ip-pair-20261101.mjs`, `verify-ip-types-20261101.mjs`, `scan-ip-20261101.mjs`, `audit-ip-candidate-20261101.mjs`. Only public verifier4cf8b38a changes in the proven copy; manifestbabe782d/source1954b1eb/dependency6b79e4cc,536sources/37,708dependencies. Constructor106, old/new25each, strict726inputs/0diagnostics, Semgrep1.180.0/onefile/0findings/errors and0observed parent/launcher read/module/native counters pass. No DB operation. Evidence inside `.cache/scalability/verification-workspace-ebbbc0ea7c6f47608e406a67d75650c6`: `.cache/ip-proof-20261101-b7c3900a290544aca34f7dea660a1267/proof.json`, `.cache/ip-pair-20261101-07ec633eee044da7bb7c13335a9f581c/report.json`, `.cache/ip-types-20261101-90898ba84a434bf29021d954199630af/report.jsonl`. Old11public regular dependency files are enumerated/hashed with dependency policy and containment checks.

The serial same-input comparison measures Node24.13.1/Windows x64,8logical CPUs/25,559,359,488B RAM, without VPS CPU/RAM constraints or background-load isolation. Each single timing includes isValid plus constructor rejection and fixture assertions; no warm-up/distribution or throughput extrapolation is claimed.

| Percent-prefix characters | Total input bytes | Old combined fixture ms | Patched combined fixture ms |
| --- | --- | --- | --- |
| 1,024 | 1,026 | 1.603 | 0.376 |
| 2,048 | 2,050 | 5.099 | 0.051 |
| 4,096 | 4,098 | 20.277 | 0.040 |

Exact-index inventory/secret/review gates precede commit. The separate patched graph's24backend/933shared-app evidence is not this one-record candidate. Native artifact/licenses, actual memory/shared quotas/proxy/auth/session/browser integration, outage/recovery and workload/50k capacity gates remain open.

Rollback restores only the reviewed lock entry and owned test graph, retaining reports. Returning to 10.7.3 reopens release acceptance; no owner proxy settings, secrets, data or MFA changes are part of rollback.
