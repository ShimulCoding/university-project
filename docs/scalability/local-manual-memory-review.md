# Local manual Claude-Mem installation

Verified2026-10-30. This is developer tooling, separate from application authentication, databases, hosting and capacity. The owner approved local manual memory, with no automatic capture or separate AI-provider calls. The larger scalability mission remains in progress.

## Installed tooling

The requested skill packs are installed at user scope. These are publisher repositories; the community tools are not OpenAI products.

| Pack | Publisher / pinned release | Installed capability |
| --- | --- | --- |
| Superpowers | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b), MIT | 15 skills under the user's `.codex/skills` |
| Impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/df3a4abe7d0840d5f60324812c432e00b66a4e75),4.8.0, Apache-2.0 | Frontend skill and checksum-verified native Windows engine0.1.18 |
| GSD | [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core/tree/9dc57a772195de423ab788e4d0d8734b162db35d),1.19.0, MIT | Standard profile:23 skills,22 restricted agent definitions, core CLI and its update-check hook; no project initialization |
| Claude-Mem | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem/tree/325afb60108d4ab04e24d715f244bd591ca33fbe),15.7.0, Apache-2.0 | `mem-search` plus the manual local MCP installation below |

Previously installed Token Optimizer, Find Skills and Anthropic Frontend Design remain available. Token Optimizer is a community skill with a PolyForm Noncommercial license and limited small-business permission; its hooks/configuration were not activated. GSD's existing update hook is distinct from Claude-Mem: no Claude-Mem capture hook was registered. Skill guidance does not override the project's approvals, Git branch, MFA or test requirements.

## Use

1. In VS Code, run **Developer: Reload Window**, then open a new Codex chat so it loads `claude_mem_manual`.
2. Explicitly ask, for example: **“Remember this project decision: operational roles belong to individual events.”** Saving is configured to require tool approval.
3. Later ask: **“Search project memory for the event-role decision.”** Search, timeline and selected observations use the local notes store.

Only save non-sensitive facts or decisions you expressly want retained. The integration does not ingest project files, chat history, tool output or session summaries automatically. It does not compress notes through another AI provider or synchronize them to a cloud service. **Notes retrieved into Codex become part of its ordinary conversation/model context.** Local note storage does not exclude retrieved text from that context.

There are no useful project notes yet: the final store was verified empty. Synthetic test notes are in a separate stopped container/volume. Repository state files remain authoritative; memory does not replace reading them.

## Runtime and boundaries

- Installed launcher/profile/private rollback backups: `C:\Users\Lenovo\.codex\tools\claude-mem-manual`. Never publish its settings backup or copy it into the repository.
- Codex uses stdio through WSL `Ubuntu-24.04`, absolute executables and the explicit local Docker socket. Inherited Docker endpoints/contexts and application/provider credentials are excluded. Setup subprocesses use null stdin; only MCP attachment inherits the protocol stream.
- The container uses network mode `none`, no published ports, no host directory/socket mounts, UID/GID1000, private0700 notes directory, read-only root filesystem, all capabilities dropped and no-new-privileges. Only the owned named volume is persistent.
- Bounds:1CPU,768MiB RAM/no additional swap,128PIDs,64MiB noexec temporary directory and local Docker logs at1MiB x3. The notes volume is not disk-quota bounded or an encrypted backup.
- Chroma, transcripts, watched folders, automatic work views, workstate, cloud/Notion synchronization, backups and telemetry are disabled. The upstream optional generative provider is unconfigured; its degraded provider health is expected while manual storage is initialized.
- The trusted Codex client is configured to expose only `save_memory`, `search`, `timeline`, `get_observations`. Upstream advertises17 tools; this installation relies on the client's documented allowlist and per-save approval setting. [Codex configuration reference](https://developers.openai.com/codex/config-reference).
- The launcher starts the approved local Docker/containerd services on demand and restarts only its inspected owned container. Actual daemon-cold-start verification passes without a custom keeper. The normal open MCP connection holds WSL's lifetime; after disconnect the worker remains running until local WSL/Docker stops. No new OS startup service or Docker restart policy was enabled. A complete Windows-reboot drill was not performed.

The local user, WSL administrator and Docker daemon are trusted. A compromised host/root account can access notes or replace tooling. Container inspection is not protection against a concurrent malicious daemon administrator. Container isolation reduces exposure; it does not certify the upstream bundles against every vulnerability.

## Provenance

Public build inputs only:42 files/5,596,063bytes, checked against the pinned publisher archive. No owner environment, MFA files, credentials, uploaded evidence, application source or database was a build/runtime input. Genuine LICENSE/NOTICE files are retained. Build networking was disabled; runtime uses Bun `--no-install --no-env-file`.

- Bun1.4.4 official base: `oven/bun@sha256:153a951ae40106e125898103e6e990ee0f38e6aee7f561029e26cf9fbed23470`.
- Inspected derivative image: `sha256:f13adfc6238b9f2e99dd436b72d46d75147736209cd16afe37ff4637379e297b`.
- Installed launcher SHA256: `25bc97f479d1f60828e9741ada132e481d3db1a4147e2b100c9d8dd55d234c02`.
- The shipped15.7.0 compiled bundles initialize schema68 in the new notes volume. The repository's newer schema71 source is not a claim about those compiled bytes. No existing application schema or records were migrated.
- `mem-search` received a YAML-description quoting correction and an appended local manual-use policy; original skill/settings backups are private. Other Codex settings and existing hooks were preserved.

The image is pinned and isolated. A complete fresh CVE/SAST audit of its embedded vendor bundles/runtime was not performed; pinning is not a vulnerability-free claim. No application dependency-audit result is reused to certify this tooling image.

## Verification and corrections

Commands ran from the repository root; scripts/reports are in ignored `.cache` and contain synthetic fixtures only. Successful exit codes were0.

| Command | Actual result |
| --- | --- |
| `python .cache/verify-manual-memory-mcp30.py` | 8 protocol/behavior checks: initialize, explicit fake save, search, timeline, selected Unicode details, blank-note and unknown-tool negatives; EOF exit0. Ran against the separate synthetic volume. |
| `python .cache/verify-manual-memory-isolation30.py` | 34 checks, repeated after helper hardening: private UID/mode, actual EACCES/EROFS, limits/mounts/settings, zero capture rows, no AI interaction, real restart persistence. Native socket in the same network namespace returns ENETUNREACH; no routes. |
| `python .cache/probe-manual-memory-stdin30.py` | Synthetic initialization canary lost with inherited setup stdin, preserved with null setup stdin. |
| `python .cache/verify-installed-manual-memory30.py` | 40 checks, including25 rejected isolation-metadata changes, actual existing-volume refusal, misleading Docker-context resistance, native CLI configuration parsing, real installed-wrapper initialize/search/EOF and empty final store. Repeated after deliberately stopping only its owned container to prove on-demand container restart. |
| `python .cache/verify-manual-memory-cold-start30.py` | 4 checks starting with the local daemon actually unavailable: installed MCP starts services, all40 boundary checks pass during a normal open session, the original session remains usable, and EOF exits0. No extra keeper or saved note. |
| `codex mcp get claude_mem_manual --json` | Native CLI accepts enabled local stdio/four-tool allowlist and timeouts. Save prompting is checked in parsed TOML; interactive prompt/filter observation remains pending reload. |

Evidence directory: `.cache/skill-packs-20261030/claude-mem/`. Relevant reports are `manual-mcp-verification.json`, `manual-isolation-verification.json`, `native-network-observation.json`, `manual-stdin-probe.json`, `manual-final-verification.json`, `manual-cold-start-verification.json`, and `manual-client-installation.json`. Earlier GSD23-skill/22-agent validation, CLI smoke and Impeccable Windows-launcher checks are recorded in the parent `final-verification.json`; its earlier memory-inactive flag predates this separately approved activation.

The initial network assertion expected Bun's Node-compatible socket error to equal Linux's errno. Bun returned ECONNREFUSED; an independent native socket in the exact namespace returned ENETUNREACH. The corrected verifier requires native denial plus matching namespace/no routes; it does not treat connection refusal alone as proof of isolation.

Independent read-only review found inherited remote-Docker settings in provisioning and idempotent volume adoption. Both were corrected; actual endpoint-poisoning and collision tests pass. Installed-client verification then reproduced an85-second MCP timeout: WSL setup consumed the initialization message. Null setup stdin fixes the root cause; the canary and installed protocol tests now pass. The reviewer rechecked these fixes and found no remaining blocking code finding within this focused scope. Its review was source/evidence inspection, not an independent runtime rerun.

The synthetic container is stopped and its notes volume preserved. Both temporary task-owned WSL keeper processes were verified and stopped. A subsequent verifier initially failed its direct Docker preflight because WSL had stopped the daemon. Testing the installed launcher first, with its normal MCP connection open during dependent checks, proves actual daemon-cold-start behavior without an extra keeper. The final worker is available on demand. No application tests were rerun for this documentation/tooling concern, and no application security/capacity milestone is asserted.

## Pause, rollback and maintenance

To pause the client, set `enabled = false` only under `[mcp_servers.claude_mem_manual]` in the user's Codex configuration, then reload Codex. This alone does not stop the worker.

For this exact installation, stop the worker without deleting notes:

```powershell
wsl.exe -d Ubuntu-24.04 -u root --exec /usr/bin/docker --host unix:///var/run/docker.sock stop f61328bf53039e47b68bcf0c39c98576a680dcadae00fbc002e1525cc45b2354
```

The launcher checks this immutable container ID, image, ownership, volume and isolation before reconnecting. Preserve the notes volume named in the private `profile.json`; do not run volume prune, remove the volume, reset WSL or change the application's database. Re-enabling the client allows its checked container to start again.

For full rollback, remove only the named MCP entry; restore only the appended local `mem-search` policy from its private backup if desired. Do not replace the whole Codex configuration from an old backup, because later unrelated settings may exist.

Before an upgrade, stop the owned worker, take a private offline backup of its notes volume, verify publisher hashes/licenses and review new schemas/settings. Test an upgraded copy on a separate volume before switching. Do not reuse the application DB or auto-enable capture/provider credentials to resolve optional-provider health. Notes currently have no tested encrypted backup/restore procedure; avoid retaining sensitive or irreplaceable information until that is separately configured and verified.
