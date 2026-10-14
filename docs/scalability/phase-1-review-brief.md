# Phase 1 independent review brief

Status: review preparation, **phase acceptance pending**. Compare the security carry-over changes after phase0 snapshot13134ea. Read [report](phase-1-report.md), [database boundary](database-boundary-review.md), [file response](file-response-review.md), [drain](graceful-drain-review.md), [dependency isolation](sec05-dependency-boundary.md), [PLAN](PLAN.md) and [LOG](LOG.md). Main changes and owner cutover are not authorized.

## Review questions

- Can runtime permissions mutate protected history directly, through PK cascades, object ownership, PUBLIC privileges, role membership or GRANT? Does the rollback negative control leave grants and rows unchanged?
- Do actual application/service clients stay restricted while fixture cleanup alone uses the migrator? Can malformed URLs, private-path symlinks, CLI aliases or browser defaults hit owner data/ports?
- Are credentials absent from arguments, output, artifacts and Git? Do explicit configuration/ACL checks happen before owner-environment reads? Do diagnostic filters retain SQLSTATE without leaking arbitrary text?
- Does sendFile retain filename-dotfile denial and service authorization/containment/integrity/audit? Does drain track actual promises after disconnected sockets, preserve accepted streams and disconnect only once?
- Does SEC-05 isolation preserve the full development audit failure and reject missing/unsafe/contaminated artifacts? Are fresh Linux builds and image scans still explicitly pending?
- Does inventory format3 ignore only Git CRLF conversion while continuing to reject source/content/whitespace drift? Are normalized source fingerprints kept distinct from deployment artifact byte verification? Read [portability review](inventory-portability-review.md).
- Are pure unit contracts, direct/pooled real DB checks, browser/scanner integration and separate-instance evidence clearly distinguished? Does the pooler deny migration/other database/console access and unrelated UID secret reads with actual0400 mounts, rather than relying on Windows ACL or generic rejection? Does the sixth queued client fail at the measured deadline and recover? Read [pooler review](pooler-boundary-review.md).

## Reproduction and disposition

Use the commands in each concern review with a separately approved fake fixture. Pure inventory/workload/artifact/preparation contracts need no owner secrets. Actual permission tests need private fixture/operator files; do not reuse production or owner backend configuration. No real admin MFA key/code should be supplied.

Record findings with file:line, exact safe command and observed result. Rerun affected security and regression gates. Local pooler/browser/PDF now pass actual checks; Phase1 still cannot be accepted: real scanner/SMTP/final production-image/shared controls and original SEC-22 disposition remain unresolved. Do not merge to main or make capacity claims from this evidence.
