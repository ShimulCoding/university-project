# Local tooling proposal — approval required for host installation

## Observed state

Windows has no Docker/k6/gh command through PATH and no Docker Desktop executable at its standard installation path. The existing `Ubuntu-24.04` WSL distribution starts with kernel `6.18.33.2-microsoft-standard-WSL2`; its current user ID is 1000. `command -v docker k6 pgbouncer semgrep node` found none. This proves no usable tool at those locations, not absence of every installation. Windows PostgreSQL 16.13, Node 24.13.1 and Semgrep 1.180.0 are available. The owner's applications and database remain running and untouched.

## Requested scope

1. Install the free Docker Engine/Compose plugin inside the existing Ubuntu distribution using Docker's official Ubuntu apt repository and Ubuntu's official package mirrors. Pin exact package versions after reading the repository metadata; verify Docker's signing key using its official installation documentation. Do not install Docker Desktop, modify Windows firmware/WSL settings, add the user to the root-equivalent docker group, or expose a Docker TCP socket.
2. Start only this local daemon; use its Unix socket through explicitly authorized local administrative commands. Application/database/test ports bind to loopback. Every fixture/database/volume has a mission-specific name; do not stop, prune or delete unrelated containers/volumes/images or the owner's applications.
3. Download pinned checksum-verified k6 and GitHub CLI binaries from their vendors' official GitHub releases into ignored project tooling directories. Current upstream licenses are [AGPL-3.0 for k6](https://github.com/grafana/k6/blob/master/LICENSE.md) and [MIT for GitHub CLI](https://github.com/cli/cli/blob/trunk/LICENSE); recheck the actual chosen release's metadata before installation. Do not use unofficial mirrors or create a new account/service. CLI authentication may use the existing authorized repository credential without printing it; no interactive account creation is authorized.
4. Keep tool/version/digest/license/audit evidence in the execution log. Benchmark only fake data/local targets. Docker resource limits must be tested; a YAML limit alone is not evidence of an effective 2 CPU/4 GB total budget.

Docker changes the local Linux host environment and requires administrator access. If installation cannot be approved/executed, retain a concrete Compose/CI acceptance gap and continue native source/security work; do not relabel Windows measurements as VPS capacity. Existing external permission covers npm/container registries and repository operations, but this proposal also needs the explicitly named apt mirrors and vendor binary release downloads.

Installation follows the [official Docker Ubuntu guide](https://docs.docker.com/engine/install/ubuntu/), selecting an exact engine/plugin version after approved repository metadata access. The existing Ubuntu distribution is supported by that guide; daemon/administrator readiness still needs execution verification.

## Verification and rollback

Before installing, record installed package versions/services and the current distribution state. After installing, record `docker version`, `docker compose version`, effective engine context and Unix-socket access; run a disposable resource-limited local container and inspect cgroup CPU/memory. Check that no Docker TCP listener/public test port is added. Record official binary release versions/checksums and `k6 version`/`gh version`.

Rollback stops only the daemon started for this mission and removes only newly installed tool packages after operator approval. Do not delete fixture volumes/data without approved cleanup. No host/software installation has been performed by this proposal.
