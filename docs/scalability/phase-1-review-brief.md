# Phase 1 independent review brief

Status: review preparation, **phase acceptance pending**. Compare the security carry-over changes after phase0 snapshot13134ea. Read [report](phase-1-report.md), [database boundary](database-boundary-review.md), [file response](file-response-review.md), [drain](graceful-drain-review.md), [dependency isolation](sec05-dependency-boundary.md), [PLAN](PLAN.md) and [LOG](LOG.md). Main changes and owner cutover are not authorized.

## Review questions

- Can runtime permissions mutate protected history directly, through PK cascades, object ownership, PUBLIC privileges, role membership or GRANT? Does the rollback negative control leave grants and rows unchanged?
- Do actual application/service clients stay restricted while fixture cleanup alone uses the migrator? Can malformed URLs, private-path symlinks, CLI aliases or browser defaults hit owner data/ports?
- Are credentials absent from arguments, output, artifacts and Git? Do explicit configuration/ACL checks happen before owner-environment reads? Do diagnostic filters retain SQLSTATE without leaking arbitrary text?
- Does sendFile retain filename-dotfile denial and service authorization/containment/integrity/audit? Does drain track actual promises after disconnected sockets, preserve accepted streams and disconnect only once?
- Does SEC-05 isolation preserve the full development audit failure and reject missing/unsafe/contaminated artifacts? Are fresh Linux builds and image scans still explicitly pending?
- Are pure unit contracts, direct real DB checks, browser/scanner integration and separate-instance evidence clearly distinguished? Are unexecuted gates still open rather than inferred from earlier owner-environment results?

## Reproduction and disposition

Use the commands in each concern review with a separately approved fake fixture. Pure inventory/workload/artifact/preparation contracts need no owner secrets. Actual permission tests need private fixture/operator files; do not reuse production or owner backend configuration. No real admin MFA key/code should be supplied.

Record findings with file:line, exact safe command and observed result. Rerun affected security and regression gates. Phase1 cannot be accepted yet: pooler/browser/real scanner/fresh-image/distributed controls and original SEC-22 disposition remain unresolved. Do not merge to main or make capacity claims from this evidence.
