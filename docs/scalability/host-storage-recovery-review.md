# Verified local host storage recovery

## Failure, authorization and measured result

The local Docker build completed, then a new container failed because containerd's metadata filesystem was read-only. C: had **0 free bytes**; Ubuntu's VHD was7,130,316,800 bytes. Read-only WSL-system inspection confirmed ext4 `emergency_ro` and block I/O errors, while guest df misleadingly showed951GB available in its nominal1TB volume. This was a host storage failure, not a reproduced application defect.

The owner explicitly approved the [backup/managed relocation proposal](host-storage-recovery-proposal.md). The guarded [script](../../scripts/scalability/recover-local-wsl-storage.ps1) stopped only Ubuntu-24.04, exported a new private VHD backup to E:, verified source/export length and SHA256, used supported WSL2.7.10 managed relocation, and verified relocated bytes **before Linux restarted**.

| Same-machine observation | Before | After |
| --- | --- | --- |
| C: free bytes | 0 | **7,099,965,440** at completed relocation |
| VHD bytes | 7,130,316,800 | **7,130,316,800**, source/backup/moved SHA256 equal |
| Ubuntu root mount | ro/emergency_ro, block I/O errors | **rw**, after normal restart |
| Manual filesystem repair / pruning | None | **None** |
| Owned container/security gate | Blocked by host I/O | **31 checks pass**; same immutable image/kernel limits |
| Restricted database gate | Previously29 pass; environment unhealthy | **29 pass again**, same14 migration names/checksums |
| Retained inherited backend suites | Previously24 pass | **24/24 exit0 again** after relocation |

No speed or capacity gain is inferred from suite duration. Native Windows tests still share the host with other applications; WSL is not the proposed2CPU/4GB VPS. Current boot also emits PCI/graphics/DNS startup warnings; these are unverified platform observations, not a claim of a perfectly clean kernel.

## Exact execution and intermediate failures

From the repository root:

```powershell
powershell.exe -NoProfile -NonInteractive -File scripts/scalability/recover-local-wsl-storage.ps1
powershell.exe -NoProfile -NonInteractive -File scripts/scalability/recover-local-wsl-storage.ps1 -Execute
powershell.exe -NoProfile -NonInteractive -File scripts/scalability/verify-host-recovery-contracts.ps1
```

Dry run passed without mutation. First execution stopped the distribution but VHD export returned ERROR_SHARING_VIOLATION while VM teardown still held its disk. The script blocked relocation and retained the new directory; no source was overwritten or deleted. Read-only state inspection then confirmed Ubuntu fully stopped and only wslservice remained. A fresh second execution exported/verified/moved successfully. Both fresh recovery directories are retained; the successful one is `.cache/scalability/wsl-recovery-7367bdf26abf4f24965c3042ae1431b0`. Its `evidence.json` records only operational metadata/byte-match booleans, not contents or digest values.

The first owned-service restart command failed because Windows Start-Process did not preserve an unquoted guest path containing spaces. Corrected explicit quoting starts only owned Docker/PostgreSQL/relay; startup readiness was confirmed before repeated gates. Initial failed verifications are recorded as failures, not converted into passes.

The fresh frontend build had passed before the outage and its owned3300 page now returns200; the new API harness initially exited at actual restricted-identity establishment during the I/O outage, and was restarted afterward. This report does not infer completed browser/MFA/PDF flows from a200 or build.

## Guard tests, privacy and rollback

The source checker passes **22 PS AST/order/mutation contracts**. It parses without executing recovery or reading registry/VHD contents, verifies reviewed command/type/method sets, exact three WSL actions/immediate exit checks, immutable root/distribution, fresh contained non-reparse target, private ACL-before-actions, backup and post-move byte-check order, and absence of repair/pruning/unregister or digest/content output. Unsafe in-memory source mutations fail. It is a regression aid for trusted operator code, not a sandbox for arbitrary PowerShell.

The concrete operation additionally proves actual byte identity and post-restart database regressions. New backup/runtime directories restrict access to the owner and Windows SYSTEM required by WSL; no other user was added. The VHD contains private Linux/fixture state: keep it ignored/restricted, never add it to Docker context/Git, inspect its contents unnecessarily or discard it automatically.

Owner Windows applications, backend configuration, original database permissions and supervised MFA were not reconfigured/restarted by this operation. Their complete integrity under a full OS drive is not inferred from fake-fixture tests. All application verification targets remain the isolated fake database.

Rollback uses supported managed relocation only after verifying backup integrity and sufficient destination space; no automated unregister/restore/overwrite. Re-running the guarded script now refuses its original C-drive precondition. Offline fsck/repair, deletion, pruning, changing WSL swap/host settings or backup removal require separate approval. Keep free-space checks before future builds, and complete production storage alerts/restore drills in Phase8; this retained byte-copy is not a rehearsed application/PITR restore.
