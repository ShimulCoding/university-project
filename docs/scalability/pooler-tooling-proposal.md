# Local pooler build network proposal

## Concrete scope

Build a local PgBouncer 1.26.0 image from its official source release, using the pinned official PostgreSQL16.15-bookworm image and signed Debian package repositories for compiler/libevent/OpenSSL dependencies. There is no official Docker Library PgBouncer image; an unexplained third-party image would add an avoidable provenance boundary.

Additional outbound sources requested: `https://www.pgbouncer.org/downloads/` and linked official release/checksum files; `https://deb.debian.org/debian/` and `https://security.debian.org/debian-security/` (signed APT metadata/packages inside the disposable build container). The existing approval already covers official Docker registries, documentation/advisory feeds and repository GitHub operations. No third-party registry, account, paid service or production endpoint is involved.

The source archive checksum must match its official manifest; retain the PgBouncer ISC license and package copyright/license metadata. Pin the resulting image digest and package versions, record image vulnerability-scan results without calling an unscanned artifact clean. Build/runtime have no application secret in arguments or layers. Runtime uses SCRAM and private mounted secrets/config, transaction pooling, bounded client/server queues/timeouts, nonroot execution and loopback-only published ports. Only the new fake PostgreSQL database/roles may be mapped; owner database/config/MFA remain untouched.

## Verification and rollback

Check actual pooler/server versions, denied runtime DDL/history/role escalation and permitted flows through direct and pooled URLs; prove transaction/rollback, prepared statements, concurrent idempotency and revocation behavior with real isolated fixtures. Record tests and same-machine/data measurements. This is a local compatibility gate, not VPS capacity proof.

Stop only the owned pooler/container to roll back. Preserve fake data/evidence unless owned cleanup is explicitly requested. No Windows host setting, global package, Docker TCP socket or automatic startup change is needed.
