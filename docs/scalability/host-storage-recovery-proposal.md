# Host storage recovery proposal — approval required

Owner explicitly approved verified backup and managed relocation to E: on2026-10-12. This does not approve offline repair, pruning or data deletion. The concrete guarded script is `scripts/scalability/recover-local-wsl-storage.ps1`; without `-Execute` it reads only source/destination/space metadata. New private directories allow the owner and Windows SYSTEM required for WSL storage, excluding other users.

## Observed failure

After the owned PgBouncer build succeeded, Docker could not commit a new container snapshot: `/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/metadata.db: read-only file system`. Read-only diagnosis found **C: free0 bytes**, E: free89,236,811,776 bytes, and the Ubuntu-24.04 VHD at7,130,316,800 bytes. Installed WSL2.7.10 supports managed `--move` and VHD-format export.

The WSL system distribution confirms Ubuntu's ext4 mount is `ro,...,emergency_ro` with block I/O errors. Guest `df` shows a nominal1TB volume with951GB available, which does not represent host physical capacity. Ubuntu executables themselves fail I/O. Do not increase the guest virtual size to address the full Windows drive. No filesystem repair, remount, pruning, file deletion or Windows setting change has been executed.

The owner Windows backend/frontend/database/MFA were not restarted or reconfigured. The new fake API browser harness exited before successful startup. The fresh frontend build passed earlier; real browser tests have not run. Direct backend/SQL results recorded before this outage are valid historical results, not proof of the current environment's health.

## Proposed authorized operation

Because the original local-tooling approval excluded Windows settings and the standing rule requires approval for behavior/data-risk changes, relocation must wait for a new explicit approval.

1. Validate Ubuntu-24.04's registered VHD path, exact source file and free E: space. Prepare a **new owner-only ignored directory** beneath this repository's `.cache/scalability`; refuse any existing backup/move target.
2. Terminate **only Ubuntu-24.04**. This stops all Linux processes in that distribution, including owned Docker/test services and any owner Linux shell. No Windows app/service is stopped. Pending Linux work can be interrupted; close/save owner Linux work first.
3. Use WSL's supported VHD-format export to a new private E: backup. Compare backup/source length and SHA256 after termination. Report only match/length, never VHD content or credentials. If export or verification fails, preserve every file and stop; no fallback deletion/overwrite.
4. Run the installed supported `wsl --manage Ubuntu-24.04 --move <new-private-E-directory>`. WSL manages relocation/registration; do not manually edit registry, rename AppData files or unregister the distribution. This moves the preserved disk, including its existing data, to E:.
5. Verify registered location and relocated VHD length/hash against the retained backup **before starting Linux**. Start only this distribution and read filesystem/kernel health. Keep backup until restoration and regression gates pass; no automatic deletion or pruning.
6. If it remains read-only or errors persist, stop and prepare a **separate approval** for offline filesystem checking/repair based on Microsoft's documented procedure. Do not force a writable remount or automatically run e2fsck.
7. Once healthy, start only owned Docker/fake PostgreSQL/relays, inspect kernel limits/private identities and all fourteen migration checksums, rerun privilege29/security24/type/scan gates, then resume pooler/browser builds. Do not point tests at the owner database as a fallback.

The alternative is for the owner to free C: manually and report completion. Agent will not select or delete unrelated Windows files. Either route may still require backup and filesystem repair if I/O errors persist.

## Command contract and rollback

Installed command syntax was read locally. Execution must use literal reviewed paths and check exit codes individually:

```powershell
wsl.exe --terminate Ubuntu-24.04
wsl.exe --export Ubuntu-24.04 <new-private-backup.vhdx> --format vhd
# Check source and backup length/hash before relocation.
wsl.exe --manage Ubuntu-24.04 --move <new-private-E-runtime-directory>
# Check registry-selected location and backup/relocated bytes before startup.
```

No migration/schema/account/auth changes accompany this host operation. Relocation rollback uses the same supported managed move only after enough destination space and source/backup integrity are verified; no automatic restore/unregister/overwrite. Offline repair can modify filesystem metadata and needs its own reviewed backup-backed approval.

References: [Microsoft WSL disk-space and read-only recovery](https://learn.microsoft.com/en-us/windows/wsl/disk-space), [supported basic commands](https://learn.microsoft.com/en-us/windows/wsl/basic-commands), and installedWSL2.7.10 `--help`. Approved export/relocation is now executed and byte-verified; read [actual recovery review](host-storage-recovery-review.md). No offline repair/PITR restore was performed.
