# Inventory consistency across Windows and Linux

The source inventory previously hashed raw checkout text and compared generated output without allowing Git's CRLF conversion. With `core.autocrlf=true` on Windows, an unchanged Linux checkout would fail the future CI drift gate. This was reproduced locally with two copies of the same public source files, one LF and one CRLF: all 311 application fingerprints, 118 operator fingerprints and the Prisma schema fingerprint differed. The copies contained 430 files; no application or private configuration was loaded.

The inventory now hashes UTF-8 source text after converting only CRLF to LF. Format version 3 records that encoding explicitly. Its output check accepts the same checkout conversion without rewriting files. Other characters, spaces, a missing final newline, lone carriage returns and a BOM remain significant; source edits still fail the drift check. Deployment artifact checks continue to use actual bytes.

## Verification and measured result

On the same Windows machine, Node 24.13.1 and source dataset, `node .cache/scalability/reproduce-inventory-newlines.mjs` measured 311 application / 118 operator / one schema differences before, and zero after. The second copy has 431 files because the shared source-text helper was added. This measures verification correctness, not application performance.

`node scripts/scalability/verify-inventory.mjs` passes 43 checks, including two complete public source copies with different newlines, edited-output rejection, unchanged-output preservation and meaningful whitespace/BOM negatives. The inherited route, model, source, operator and format rejection tests remain intact. Exact staged snapshot index-review-izrNia passes the same43 checks, product build, all verifier/seed types and file transport10. That snapshot also passes `inventory.mjs --check` in native Linux Node24.21.0 with network disabled and read-only public source/TypeScript mounts. Semgrep1.180.0 reports0 findings/0 errors across the four changed source files. Final staged secret/diff checks are recorded in LOG before commit.

## Review and rollback

Only the inventory generator and its verification change. The normalized fingerprint is source coverage evidence, not a claim of byte-identical deployment artifacts. No runtime permissions, application behavior, dependencies, database or MFA change. Revert this concern and regenerate both inventory outputs to return to format 2; that restores the known cross-platform false failure. Never suppress genuine content drift to make CI pass.
