# Local manual memory implementation plan

**Goal:** Configure the owner's approved Claude-Mem integration for explicit local notes, without automatic capture or external AI calls.

**Scope:** Developer tooling only. This is separate from the application and from its future VPS deployment. The existing scalability phases, event permissions, account MFA, owner configuration and application database are unchanged.

**Architecture:** Use the pinned upstream Claude-Mem worker and MCP bundles in a nonroot Docker container with `--network none`, no published ports, no host directory mounts and a dedicated new notes volume. Connect over process stdio through WSL Docker. Codex exposes only `save_memory`, `search`, `timeline` and `get_observations`; saving requires a tool approval prompt. Disable upstream capture, transcripts, telemetry, Chroma, cloud synchronization and automatic generated work views. Do not register Claude-Mem hooks.

**Approved specification:** The owner selected “Local-only manual memory, without automatic capture or external AI calls” in response to the integration-scope question on 2026-10-30.

## Verification and rollback

- [x] Verify original-publisher revisions, licenses and runtime image digest; copy only public allowlisted build inputs into ignored tooling storage.
- [x] Start an isolated fake-notes instance. Verify nonroot/read-only/capability/resource/mount/network boundaries and effective disabled settings. A non-loopback connection must fail; the container must have no external network interface or published host listener.
- [x] Exercise the actual MCP protocol: initialize, enumerate tools, save a synthetic note, search, inspect its timeline, fetch selected details, reject invalid inputs, and retrieve the note after an owned-container restart. Keep verification data in a separate test volume.
- [x] Create a fresh empty final notes volume, install the checked launcher, register the four-tool allowlist with save prompting, and verify preservation of unrelated Codex settings and hooks. Earlier skill-installation checks cover unrelated skill files. Record exact evidence and limitations.

Implementation evidence and operating instructions: [local-manual-memory-review.md](local-manual-memory-review.md). Synthetic MCP8, repeated isolation/persistence34, and installed-launcher40 checks pass. Final notes/capture rows are0. Native Codex parses the four-tool allowlist; its interactive filtering/save prompt still needs observation after reload. This limitation is not counted as a passed UI test.

Rollback disables/removes only the new named MCP configuration entry and stops only the positively identified manual-memory container. Preserve its volume; do not delete notes or change existing hooks, services, application settings or the owner database.

## Review focus

Default worker background features must not regain capture or provider access. A preexisting container or volume with the same name must be refused rather than adopted. No owner dotenv, credentials, sessions, uploads or project source tree may enter the build context or runtime mounts. Stdout must remain valid MCP traffic. Registry downloads are provisioning traffic; runtime has no network route. Docker/WSL availability and compromise of the local host remain operational trust assumptions.
