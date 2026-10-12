# SEC-05: development dependency isolation

## Decision and status

As checked on 2026-10-12, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects `braces <=3.0.3` and lists **no patched version**. The official npm registry still reports `braces` latest `3.0.3`. Full `npm audit` remains exit 1 with seven high development entries. This failure is retained, not suppressed. No package, lockfile, lint rule, Tailwind output or application behavior was changed.

The compatible mitigation is an isolated build stage and a production artifact gate. A clean, production-only local installation and the existing compiled output passed the new known-chain exclusion gate. A final deployment image, fresh-build/source correspondence and an actual image startup have not been verified. SEC-05 remains an unpatched development advisory; this work demonstrates its runtime isolation path rather than claiming it was patched.

`npm audit fix --force` suggested Tailwind 4.3.3 and an `eslint-config-next` downgrade to 14.2.35. Those are broader, incompatible changes than dependency isolation and were not applied. A future compatible upstream patch should replace this mitigation after the same tests and visual/build gates.

## Source and license evidence

The current chain is:

```text
Tailwind 3.4.19 -> chokidar 3.6.0 -> braces 3.0.3
Tailwind 3.4.19 -> fast-glob 3.3.3 -> micromatch 4.0.8 -> braces 3.0.3
eslint-config-next 16.4.0 -> @next/eslint-plugin-next 16.4.0
  -> fast-glob 3.3.1 -> micromatch 4.0.8 -> braces 3.0.3
```

Evidence: `frontend/package.json` declares Tailwind/Next ESLint only in `devDependencies`; `package-lock.json` marks the affected chain `dev: true`; `npm ls ... --all` reproduces the installed edges. `tailwindcss-animate` is also treated as a build-only boundary dependency, though it is not a separate npm advisory entry. The nine boundary entries include both installed fast-glob versions and affected chokidar 3.

The installed/registry metadata reports MIT for braces, micromatch, fast-glob, Tailwind, its animation plugin and Next ESLint packages. Prisma/client metadata reports Apache-2.0. The verifier uses only Node built-ins and introduces **no dependency**.

Important: `npm ci --omit=dev` still installs Prisma 6.19.3 through `@prisma/client`'s optional peer and safe chokidar 4.0.3 through Prisma/config. Neither is the affected braces chain. This check permits safe chokidar 4; it does **not** claim every development or migration tool is removed. The final runtime image needs its own minimal dependency/privilege review.

## Measurement environment and data

- Native Windows 11, Intel Core i5-1135G7, 8 logical processors, 25,559,359,488 bytes physical RAM (23.80 GiB); Node 24.13.1, npm 11.8.0. Other local application processes were preserved. This is not a 2 CPU/4 GB VPS measurement.
- Base `415a869`; no source/package change in this concern. The existing Next production build had `BUILD_ID=1AmxxirPzudxU4Vkqn7s3`. Its originating build command/source correspondence was not reconstructed from timestamps.
- A fresh ignored directory `.cache/sec05-production-install-20261012-b23fe957` received only the root/workspace manifests and lockfile, followed by production server/static output, required Next root trace/build-ID files and `backend/dist`. No `.env`, owner's data, upload, `.next/dev`, build cache or framework trace log was copied.
- Original and copied compiled subsets match: 1,199 files, 19,637,798 bytes, aggregate SHA-256 `9f97f5e8dc71e1b245087d02563d922146bbce35e63ee36c60d36e6f003a0cff`. The digest concatenated sorted relative filenames, a NUL separator and file bytes for `frontend/.next/server`, `frontend/.next/static`, `backend/dist` and the three root Next files. This proves copy equality, not correspondence to current source.

| Metric / gate | Existing development workspace | Isolated production-only copy |
| --- | --- | --- |
| Installed known-chain boundary entries | 9 | 0 |
| Full source-lock npm audit | Seven high entries, exit 1 | Same source lock; not represented as resolved |
| `npm audit --omit=dev --json` | Zero advisories, exit 0 | Zero advisories, exit 0 |
| Runtime artifact gate | Rejects installed development chain, exit 1 | Passes: 204 installed package entries; 1,171 emitted JS/JSON/map files; 19,248,593 scanned bytes; 44 Next output traces |
| Clean production install | Not performed on live workspace | 204 packages; stopwatch 27.463 seconds |
| Artifact gate time | Early rejection; no throughput comparison | Initial 17.773 seconds; strengthened final check 1.107 seconds with warmed filesystem caches |

The 9-to-0 change is a packaging/security metric. The elapsed times are single local observations; they are not a performance improvement, statistical benchmark, application capacity or deployment claim. No Prisma generation, browser/database journey or application startup was performed in the isolated copy. Existing compiled files were inspected for package references, not executed as a deployment.

## Exact verification commands

All commands ran from `E:\4.1\WEB +PROJECT\University-project` unless the directory is stated.

```powershell
npm audit --json
npm audit --omit=dev --json
npm view braces version versions license repository --json
npm ls braces micromatch tailwindcss eslint-config-next --all
node --version
npm --version
node --check scripts/scalability/verify-runtime-dependencies.mjs
node scripts/scalability/verify-runtime-dependencies.mjs --self-test
node scripts/scalability/verify-runtime-dependencies.mjs --mode source
node scripts/scalability/verify-runtime-dependencies.mjs --mode runtime --runtime-root .
node scripts/scalability/verify-runtime-dependencies.mjs --mode runtime --runtime-root .cache/sec05-production-install-20261012-b23fe957
```

The full-workspace runtime command intentionally returned exit 1. The isolated runtime command first returned exit 1 with missing compiled artifacts, then passed after the explicit copy. Missing artifacts never become a passing release check.

The clean install ran inside `.cache/sec05-production-install-20261012-b23fe957`:

```powershell
$depTimer = [System.Diagnostics.Stopwatch]::StartNew()
npm ci --omit=dev --ignore-scripts --no-fund --audit=false
$depExit = $LASTEXITCODE
$depTimer.Stop()
Write-Output ('MeasuredSeconds=' + $depTimer.Elapsed.TotalSeconds.ToString('F3', [Globalization.CultureInfo]::InvariantCulture))
exit $depExit
```

`--audit=false` disabled the install's automatic audit only; the separate official registry audits above ran and their failures/results are recorded. No dependency install script executed. After copying the compiled subset, the explicit registry production audit repeated successfully in that directory. `npm ls braces micromatch tailwindcss chokidar fast-glob eslint-config-next --all` there showed only the safe Prisma/chokidar 4 chain.

Final artifact timing ran from the repository root:

```powershell
$gateTimer = [System.Diagnostics.Stopwatch]::StartNew()
node scripts/scalability/verify-runtime-dependencies.mjs --mode runtime --runtime-root .cache/sec05-production-install-20261012-b23fe957
$gateExit = $LASTEXITCODE
$gateTimer.Stop()
Write-Output ('MeasuredSeconds=' + $gateTimer.Elapsed.TotalSeconds.ToString('F3', [Globalization.CultureInfo]::InvariantCulture))
exit $gateExit
```

## Gate contract and negative tests

[verify-runtime-dependencies.mjs](../../scripts/scalability/verify-runtime-dependencies.mjs) requires an explicit mode:

- `--mode source` checks source-lock production/development metadata and explicitly reports `runtimeArtifactVerified: false` and `developmentAdvisoryResolved: false`.
- `--mode runtime --runtime-root PATH` checks the declared root's installed packages and emitted backend/Next programs, source maps and output traces. `--component frontend|backend` narrows the artifact requirements for separate images; default `all` requires both.
- Runtime checks reject affected/build-only package entries, known emitted import/path references, external package/artifact symlinks, missing compiled server/build-ID/route/browser artifacts, malformed traces and empty Next route/browser output. Nested/scoped packages are included; safe chokidar 4 is allowed.
- All 14 synthetic contract checks pass, covering source-only disclosure, accidental production dependency promotion, missing artifacts, safe versus affected chokidar, dynamic import/CommonJS references, empty Next routes/chunks, valid output, trace paths/malformed traces, direct braces and scoped Next ESLint installation. These are isolated fake-file negative tests, not mocked application tests.

The gate detects the named dependency/path/import chain. It is not a general binary SBOM, recursive arbitrary-code semantic analysis or replacement for advisory scans. Audit JSON/exit codes must remain visible separately. Obfuscated vendoring or another dependency advisory needs independent scanning/review.

## Required build/deployment boundary

Use the [npm clean-install contract](https://docs.npmjs.com/cli/v11/commands/npm-ci/) and [Next output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) when packaging:

1. Build from the exact reviewed lockfile in a disposable stage, with no production secrets, no existing uploads/database mounts and no application credentials in build arguments.
2. Install runtime dependencies independently; copy only reviewed compiled/runtime assets and the generated Prisma client/engine. Never copy the builder's complete `node_modules` tree or run `next dev` in the serving image.
3. Run the runtime gate **inside the final image**, matching its declared artifact layout, then the production advisory scan and real image startup/journey regressions. Keep the full builder audit visible as an unresolved development finding.
4. Run builders with bounded CPU/memory and only trusted repository configuration/source. Public application input must never become build-time glob patterns. An attacker-controlled source/configuration can still exploit the unpatched development parser.

These are release requirements; this local check does not certify a Docker image or deployment. The copied subset exists solely for bounded dependency/artifact inspection.

## Hostile review and rollback

No data, authorization, auth flow, existing test or visual output changed. No dependency replacement/override was added. The verifier keeps source/runtime modes distinct, returns nonzero on missing/unsafe artifacts and never calls the network or reads local credential files. The only generated files are ignored synthetic/install/build-copy evidence.

Rollback is a revert of this verifier/document concern after review; it requires no database or business-data rollback. Removing a release gate later must not be used to hide a failing image or weaken the security policy. The unresolved advisory and isolation requirements remain documented until a compatible patched upstream version is verified.
