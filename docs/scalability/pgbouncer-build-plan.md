# Pinned local PgBouncer build

## Scope and evidence

Parent execution is now recorded in [pooler-boundary-review.md](pooler-boundary-review.md): native build/image identity, actual kernel/security/mount controls70, restricted SQL29, all24 inherited suites and real browser/PDF/security journeys pass. OS/image/all-layer/full-license and deployment/load gates remain open. The source-only history below records the original proposal and its then-unexecuted gates; it is not the current runtime disposition.

This implements the approved [pooler tooling proposal](pooler-tooling-proposal.md) as a source-build definition and a read-only contract gate. It does not contact a database, start a container, change Compose or touch the owner's running applications. Only the new fake PostgreSQL target may be used in subsequent execution.

Hypothesis: a checked upstream release, pinned bases, explicit dependency versions and an empty repository context remove mutable third-party-image and local-secret build inputs. Proof in this concern is source-drift rejection, not latency or capacity. Before: no reviewed source-build/context contract. Initial source gate: 38 passing source/context checks. The parent then executed a real build, which failed before APT because the PostgreSQL base lacked its assumed CA bundle; the source gate did not establish image compatibility. After the verified trust bootstrap below: 48 passing source/context checks. Successful image build, resolved dependency review, complete license audit, image advisories and runtime compatibility remain open.

| Input | Pin | Verification state |
| --- | --- | --- |
| Public trust carrier | `buildpack-deps:bookworm-curl@sha256:a74523d7cca2436f4e3b6f5e47049d1830efbf473c33ebdf5a666f6f77425ebf` | Parent verified the actual registry manifest digest and inspected bundle/package/notice in a network-disabled container. Only the checked bundle and genuine package notice are copied. |
| PgBouncer | 1.26.0; source SHA256 `afd25dd61ee6775d37b40629b87ce08736b3e6955f3057bb212e410fbf21c71d` | Official release/checksum previously inspected; Dockerfile requires both vendor manifest and archive agreement before extraction/execution. The archive was not downloaded in this concern. |
| Builder | `postgres:16.15-bookworm@sha256:0ea6700a3b4f0ae6ce746519073558aed4d88a79d8d07622a9a644946c7319c4` | Official base and digest match the approved fake database component. Container build remains unexecuted here. |
| Runtime | `debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587` | Official Docker registry digest previously inspected; smaller runtime excludes the PostgreSQL server/compiler tree. Runtime build and linkage are unverified. |
| Architecture | Linux/amd64 | Both stages reject another architecture; no cross-platform capacity inference. |

These digest pins identify inputs; they do not establish a clean vulnerability scan or signed-image verification. PgBouncer's exact-tag [COPYRIGHT](https://raw.githubusercontent.com/pgbouncer/pgbouncer/pgbouncer_1_26_0/COPYRIGHT) identifies ISC. Embedded source notices and Debian package copyright documents are retained for actual artifact review; the image label does not describe every bundled license. The official trust carrier's repository UI identifies MIT for build definitions; exact-commit LICENSE retrieval through the documentation browser failed, so that notice verification is not claimed here. Debian CA scripts/certificate data have their own genuine notices and referenced license texts.

### Verified public trust bootstrap

The parent inspected both pinned PostgreSQL16.15 and Node24.21 slim images and found no `/etc/ssl/certs/ca-certificates.crt`; neither is assumed to supply trust. The source-only 38-check gate correctly remained separate from the real build, but its CA-presence premise was unverified until that build failed. No HTTP bootstrap, disabled TLS verification or unsigned package source was substituted.

[Official image metadata](https://github.com/docker-library/official-images/blob/master/library/buildpack-deps) maps `bookworm-curl` to build-definition commit `3e18c3af1f5dce6a48abf036857f9097b6bd79cc`. That [exact definition](https://raw.githubusercontent.com/docker-library/buildpack-deps/3e18c3af1f5dce6a48abf036857f9097b6bd79cc/debian/bookworm/curl/Dockerfile) installs `ca-certificates` through Debian APT. The immutable image above is used as a passive carrier: no instruction executes in its stage and no source/context files enter it.

Actual parent inspection found `ca-certificates=20250419~deb12u1`. Public bundle SHA256 is `714d457d580922dbf1d0be8bd35ba236a842b50b0072ae791582a19adef772a5`; genuine `/usr/share/doc/ca-certificates/copyright` SHA256 is `e85e1bcad3a915dc7e6f41412bc5bdeba275cadd817896ea0451f2140a93967c`. The Dockerfile copies only those two files, checks both hashes before the first package network operation, retains the notice and writes carrier/package/hash provenance. After package installation it preserves the GPL2/MPL2 common-license texts from the genuine Debian base package; [Debian's base-files list](https://packages.debian.org/bookworm/amd64/base-files/filelist) includes those texts. Full artifact/license review still remains an acceptance gate.

## Dependency and repository contract

[Tagged configure.ac](https://raw.githubusercontent.com/pgbouncer/pgbouncer/pgbouncer_1_26_0/configure.ac) and [upstream build instructions](https://www.pgbouncer.org/install.html) require a C11 compiler, pkg-config, libevent and OpenSSL for TLS. This build uses the release archive's generated Autoconf files and the binary target only. It disables optional c-ares, PAM, LDAP and systemd backends. No Git checkout, experimental build system or upstream sample authentication/configuration file enters the final image.

Direct amd64 package pins inspected on official Debian pages on 2026-10-12:

| Package | Exact version | Purpose / source |
| --- | --- | --- |
| gcc | `4:12.2.0-3` | C11 compiler; [Debian](https://packages.debian.org/bookworm/gcc) |
| libc6-dev | `2.36-9+deb12u14` | Native libc headers; [Debian](https://packages.debian.org/bookworm/libc6-dev) |
| make | `4.3-4.1` | Build the binary with two compiler jobs; [Debian](https://packages.debian.org/bookworm/make) |
| pkg-config | `1.8.1-1` | Library discovery; [Debian](https://packages.debian.org/bookworm/pkg-config) |
| libevent-dev / libevent-2.1-7 | `2.1.12-stable-8+deb12u1` | Builder headers / runtime event loop; [development](https://packages.debian.org/bookworm/libevent-dev), [runtime](https://packages.debian.org/bookworm/libevent-2.1-7) |
| libssl-dev / libssl3 / openssl | `3.0.22-1~deb12u1` | Builder headers / runtime TLS and certificate-store tooling; [development](https://packages.debian.org/bookworm/libssl-dev), [runtime](https://packages.debian.org/bookworm/libssl3) |
| curl | `7.88.1-10+deb12u15` | Builder-only bounded HTTPS source fetch; [Debian](https://packages.debian.org/bookworm/curl) |
| ca-certificates | `20250419~deb12u1` | Certificate verification; [Debian](https://packages.debian.org/bookworm/ca-certificates) |

Inherited repositories are replaced with only HTTPS `deb.debian.org/debian` (`bookworm`, `bookworm-updates`) and `security.debian.org/debian-security` (`bookworm-security`), using the pinned base's Debian archive keyring. Certificate/hostname verification, signed metadata and Release expiry checks remain enabled. The runtime bootstraps HTTPS trust from the checked builder certificate store before installing its own pinned CA package. APT update errors fail the build. No `stable` alias, unsigned repository or insecure bootstrap is allowed. [APT's authentication chain](https://manpages.debian.org/bookworm/apt/apt-secure.8.en.html)

APT still resolves transitive dependencies from live, signed Bookworm repositories. Both installing stages record the complete installed package/version/architecture manifest. This is **not** a promise of bit-for-bit rebuilds or a complete transitive dependency lock. Acceptance requires reviewing that resolved manifest, freezing the resulting image identity and recording advisories/licenses. If an exact direct version disappears or conflicts with a newer base, fail and review the update. Do not remove pins, force a downgrade or bypass signatures. A timestamped Debian snapshot would be a distinct network/provenance decision; it is not silently introduced here.

## Build isolation and runtime boundary

`PgBouncer.Dockerfile.dockerignore` excludes every repository path. No host `COPY` or remote `ADD` is permitted. Only two checked public trust files enter the builder; built output, provenance, copyright documents and certificate/repository trust data cross into runtime. There is no credential argument/environment channel, config generation, migration, seed or application code in the image. The passive trust stage does not transfer binaries, directories, its image configuration, environment or authentication files.

Source and manifest fetches use verified HTTPS with connect/total deadlines, size limits and bounded retries. Redirects are not followed; a vendor URL change requires review. The fixed archive hash is checked before `tar` and `configure`. Two compiler jobs and stack/PIE/RELRO hardening are explicit. Parent execution must additionally supervise overall build time/resources; individual deadlines do not establish a whole-build cgroup budget.

Runtime is UID/GID `10001:10001`, with collision checks, a non-login account and an exec-form foreground binary. Default config path is `/run/secrets/pgbouncer.ini`, supplied only at runtime. Absent config fails; there is no fallback password or trust authentication. Final-stage linkage must succeed without missing shared libraries. The image contains no default listener or credential.

The Compose/runtime executor must prove these controls, rather than infer them from the Dockerfile:

- Read-only root filesystem, dropped capabilities, no-new-privileges, finite PIDs, CPU/RAM/swap and shutdown limits; private writable tmpfs only where needed.
- Read-only private config/auth mounts readable by UID10001 and denied to unrelated users. Verify effective ownership/mode; file-backed Compose secrets can ignore requested uid/gid/mode.
- Only the existing owned internal fake-database network; no Docker socket or external/public database listener. If native test transport is needed, bind only loopback and verify the effective binding.
- An exact fake database mapping and runtime role. No wildcard database mapping, forced operator/migrator identity, admin users or database-role auto-discovery query. A separate direct migrator connection performs owned fixture setup/cleanup.
- SCRAM credentials must agree with the fake PostgreSQL verifier. Never use `trust`, plaintext credentials in Compose arguments/layers, or weakening of existing application MFA/authorization.
- Transaction pooling with bounded client/backend connection counts, queue/connect/login/transaction deadlines and a reviewed prepared-statement strategy for Prisma6.19.3. PostgreSQL has 50 maximum connections; leave headroom for direct operator/migrator/maintenance connections.
- Verified TLS is required when the transport crosses hosts. An isolated unencrypted Docker/loopback fixture is not proof of cross-host encryption, certificate validation or production readiness.
- Disable raw connection/disconnection/pooler-error/statistics logging in the private initial config. Capture sanitized aggregate diagnostics outside the default pooler log, never SQL parameters or secret-bearing DSNs.

No capacity or 2CPU/4GB whole-stack fit is established by these controls. Mandatory ClamAV remains part of the eventual measured resource budget.

## Commands and remaining acceptance

Executed from the repository root, Node24.13.1 on native Windows:

```powershell
node scripts/scalability/verify-pgbouncer-build-contracts.mjs
node --check scripts/scalability/verify-pgbouncer-build-contracts.mjs
```

The source-only gate reads just its Dockerfile/ignore file, makes no subprocess/network/DB call, rejects unsupported Dockerfile syntax and passes the same contract with CRLF. Its negative fixtures include mutable bases/dependencies, credential channels, unsafe context/copies, unsigned/TLS-disabled sources, altered/masked checksums, unlimited transfers/compilation, missing notices/evidence and root runtime. The initial new verifier failed its wrong-architecture negative because it counted checks without validating the checked architecture; the assertion was strengthened, then all 38 passed. After the actual missing-CA build failure and checked public bootstrap, the expanded 48 pass, including mutable/wrong/executable trust carrier, host/full-directory trust copy, changed bundle/notice hashes, skipped bootstrap hash verification and omitted notices/common-license texts. This remains source proof; the parent owns actual rebuild commands and evidence.

### Inventory integration proposal

The parent maintains shared inventory sources. Treat the exact `.dockerignore` basename and names ending `.Dockerfile.dockerignore` as operational build-context configuration, alongside the corresponding Dockerfile. Include their content fingerprints and file:line evidence; do not exclude them as generated artifacts. Add a coverage-drift fixture proving a newly added Dockerfile-specific ignore file must be inventoried. Do not read any file it excludes, evaluate Dockerfile commands, enumerate private context directories or broaden discovery to arbitrary ignored secrets. This proposal changes no shared inventory code in this concern.

Parent-executed Linux build command, **not executed in this concern**:

```sh
docker build --platform linux/amd64 --pull --no-cache \
  --file infra/scalability/PgBouncer.Dockerfile \
  --tag university-project/pgbouncer:local-1.26.0 .
```

Before accepting that image: retain complete build/version/package/source/binary evidence; inspect authentic notices; scan image/layers for secrets and OS/runtime vulnerabilities; record final content identity; prove nonroot/read-only/limits/mounts/network under Docker. Inspect runtime `--version` (including TLS), actual library linkage and prepared-statement behavior. A local tag is only a build label; pin the accepted artifact identity in generated fixture deployment metadata. Do not assert an unpublished registry digest exists.

Then rerun strict role/DDL/history/PK-cascade denial checks and legitimate application security/finance/upload/export fixtures through both direct and pooled runtime URLs. Prove transaction rollback, financial idempotency and parallel requests, revocation, parameter reset between reused backends, pool exhaustion/backpressure, shutdown and reconnect behavior. Preserve negative tests and record any failure without calling it resolved until the code/config fix is independently verified.

## Rollback

This concern is additive tooling only; application/database behavior is unchanged. Stop only the owned future pooler or use the existing owned direct fake-runtime connection. Preserve evidence and fixture data; do not delete volumes/images or alter the original owner environment. Revert this concern's source files in a normal follow-up commit if its artifact gates cannot be met. Commit/push, shared inventory regeneration, PLAN/LOG updates and contributor sequence belong to the parent integrator.
