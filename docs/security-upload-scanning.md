# Approved upload scanning setup

Code is on the review branch; a real ClamAV engine/signature database has not been installed or tested. Local regressions use a synthetic loopback daemon and benign buffers, not malware. Existing files are not rescanned or changed by this integration.

## Application behavior

`backend/src/utils/upload-utils.ts` validates MIME/signature/size, scans the buffer, then persists it. All untrusted upload services use this helper. A detected file returns 422; connection failure, scan error, malformed/oversized reply or absolute deadline returns 503. Neither verdict details, filenames nor contents are logged. Failed batches remove only their own newly saved files.

Production always enforces scanning and refuses startup without `CLAMD_HOST`, even when `UPLOAD_SCAN_REQUIRED=false`. Development/test can opt in with `UPLOAD_SCAN_REQUIRED=true`. Configure trusted operator inputs in the private backend environment:

```dotenv
UPLOAD_SCAN_REQUIRED=true
CLAMD_HOST=127.0.0.1
CLAMD_PORT=3310
CLAMD_TIMEOUT_MS=10000
```

The transport uses only the fixed `zINSTREAM` command with length-prefixed bytes; no user filename, path or command enters the daemon protocol. It caps input at 8 MiB and replies at 4 KiB, respects socket backpressure, enforces a total 1–15 second configured deadline and destroys sockets on every outcome. Only the exact clean reply is admitted. It uses Node's bounded socket transport and the established ClamAV engine, with [official protocol framing](https://docs.clamav.net/manual/Usage/ClamdProtocol.html). The inspected `clamscan` 2.4.0 client was not retained because its scan response buffering and post-connect timeout handling did not meet these bounds.

## Operator installation and verification

1. Install a supported ClamAV release from its [official installation instructions](https://docs.clamav.net/manual/Installing.html). Configure `clamd.conf` and `freshclam.conf` for that installation; remove their sample `Example` directive. Use a dedicated service account, private temp directory and restricted signature/config permissions.
2. For a daemon on the same machine, set these `clamd.conf` values, then validate them with the installed release:

   ```text
   TCPSocket 3310
   TCPAddr 127.0.0.1
   StreamMaxLength 8M
   MaxFileSize 8M
   MaxScanSize 64M
   MaxRecursion 16
   MaxFiles 1000
   MaxThreads 2
   MaxQueue 4
   AlertExceedsMax yes
   AlertEncrypted yes
   ```

   Oversized/encrypted contents must produce a blocking alert rather than silently be treated as clean. Confirm this on the actual engine. Bound daemon temporary storage and memory using OS/service limits. Use a scanner file-size limit at least as large as the application's 8 MiB cap.
3. Run `freshclam` (Windows: `freshclam.exe`) to obtain official signatures, then enable periodic updates and start `clamd` as an OS service. Use `clamdscan --version` to confirm availability. Do not launch a visible background window. Never expose port 3310 publicly: ClamAV's [TCP protocol has no built-in authentication/encryption](https://docs.clamav.net/manual/Usage/Scanning.html). For separate hosts, use a protected network or authenticated encrypted tunnel; do not send private evidence over untrusted plaintext TCP.
4. Restart the **local/staging** backend with the environment above. Upload a benign PDF/image through an owned fixture account, download it as that owner, and confirm another account/event is denied. Stop only the staging scanner and repeat: upload must return 503 and create no document. Review storage and database counts through fixture tests. Coordinate any scanner outage; do not stop a production service as part of this audit.
5. Run `npm run verify:security-scanner --workspace backend` after a backend build. This proves application transport/failure/cleanup behavior against a fake daemon. Arrange approved staging signature tests with the real engine before deployment; this repository does not contain malware fixtures. Keep signature age/service availability alerts active.

## Limits

Antivirus cannot prove a file harmless. Header checks are not complete PDF/image parsing or content disarm. Encrypted/oversized/nested content behavior depends on the daemon configuration. Existing evidence, real engine signatures, signature freshness and hosted scanner isolation remain unverified. Private files must retain current owner/event/category authorization and remain outside public assets. Content disarm and a human file-format penetration test are still appropriate for high-risk evidence workflows.
