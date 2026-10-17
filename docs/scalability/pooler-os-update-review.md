# Pooler vendor security update

Status: component update verified locally; final deployment and Phase 1 acceptance remain open. The owner's database, runtime configuration, MFA and main are unchanged.

## Finding and change

The previously pinned PgBouncer image inherited `perl-base=5.36.0-7+deb12u3`. Both the builder and runtime in `infra/scalability/PgBouncer.Dockerfile` now require Debian's signed `5.36.0-7+deb12u4`, its archive SHA256 `d7d1943aec9597629bf73075efcc5ef6dc9bda96d78e80d843156ecd448478b8`, installed version and genuine notice. Existing signed repositories, certificate verification, source/binary provenance and runtime restrictions remain enforced. No database migration, role-password reset or permission change accompanies this image update.

The old image is `sha256:b5b268e6b371aab1cc3ef00cc92a0106e2c30643bc98e4534982e5b07df367a2`; its replacement is `sha256:7e303539703c688c9fca8a47c5bf6135cfb43e385f511acaf713d76bdde5371a`. Fixture pins must change together so a test cannot silently exercise the old artifact. Source guards reject a missing/downgraded package, different archive hash or absent notice verification.

## Comparable measurement

The same Trivy 0.75.0 official database edition, updated 2026-10-12T13:18:23Z, scanned both exact images. Findings decrease from 255 occurrences / 119 unique IDs to 242 / 106: thirteen removed Perl occurrences, comprising three Critical, four High and six Medium. No new occurrence appears in this comparison. Raw scanner exit remains **23** for both images; the update does not establish a clean image advisory gate.

Image bytes increase from 133,832,933 to 145,688,285 because the update adds a layer above the pinned base. The observed patched build takes 73,525 ms with warm caches. Neither observation is a throughput improvement. The last separate refreshed feed was downloaded on 2026-10-14; it is historical evidence, and a current edition is required before deployment.

## Executed gates and limits

- `node scripts/scalability/verify-pgbouncer-build-contracts.mjs`: 53 pure checks, including five package/hash/notice negative controls. No private files, downloads, subprocesses or database calls.
- Session recheck `.cache/scalability/recheck-pooler-os.mjs`: 18 actual package/version/notice/resource/private-mount checks pass, with no application imports or database connections. The first diagnostic used the backend's custom notice path and correctly failed; the repeat checks the pooler's actual retained `/usr/share/doc/perl-base/copyright`. No control was weakened.
- Protected source-only repeat `.cache/scalability/run-safe-workspace-contracts.mjs`: fixture226 and pooler-inspection46 pass inside the already copied private public workspace. Filesystem/CommonJS tripwires observe zero reads into the original repository and zero outside module resolutions. This bounded source run is separate from pending complete ORM workspace acceptance.
- Exact artifact inspection verifies PgBouncer 1.26.0, libevent 2.1.12, OpenSSL 3.0.22, binary provenance, native linkage and retained Perl notice SHA256 `b52f3ca17b45473cb0da6ec46748949101fcf0dda1fd5d8b306e6c97fd41af4d`.
- Activation replaces only the labelled owned fake pooler service, using a new native-Linux UID10001/0400 credential profile and the new exact-template fake database `mu_scale_cebdcb0b5157492e9d773cf74d5c65ca`. Old profiles and volumes are retained. No owner service is targeted.
- Actual pooler verification passes 70 checks. Limits remain five transaction backends, fifty clients, no reserve, ten-second queue wait; six direct held backends become five pooled, and the sixth receives the required `P2010/query_wait_timeout` after 10,146 ms. Twelve prepared/transaction-local state cycles, unrelated-UID secret denial and wrong-password/migrator/console/database denials pass. Kernel-enforced limits remain 0.15 CPU, 64 MiB, no extra swap and PID32, read-only root, dropped capabilities and no published Docker port.
- The actual SQL policy suite passes 29 checks through this image with the same fourteen migration checksums. These earlier parent tooling runs retain the separately recorded legacy-Prisma dotenv isolation caveat; selected fake database/current-role assertions remain valid. Complete configuration-isolated reruns must follow the corrected verification workspace boundary.

The OCI archive links its index/platform manifest/config to all ten compressed and uncompressed layer hashes. A bounded all-layer regular-file scan covers 4,307 files / 95,332,134 bytes and returns ten raw Gitleaks findings, all byte-linked to public GnuTLS self-test constants. The public constants are not owner credentials. Detector/encoding/nested-payload/metadata limits remain; no claim of absence of secrets follows. Unfixed vendor advisories and full license-obligation review remain open. The full independent image review records their dispositions separately.

## Rollback

Stop admission to the owned fake test service, restore its preceding exact image/profile and repeat identity, privilege, resource and denial checks before reuse. Keep native credential files private and retained. This rollback does not authorize data deletion, original-runtime cutover, permission expansion or any main change. Returning to the old image restores the documented vendor advisories and is a diagnostic rollback, not a release recommendation.
