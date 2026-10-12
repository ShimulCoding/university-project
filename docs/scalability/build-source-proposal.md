# Isolated build download sources

Fresh Linux and browser builds must use the correct local test API and native Linux Prisma engine. Copying Windows engines or the owner's configured Next build does not prove compatibility or isolate requests.

Requested additional official build sources:

- `https://binaries.prisma.sh/`: the official Prisma6.19.3 engine distribution and checksum files, invoked explicitly during native Linux client generation after audited lockfile installation.
- `https://fonts.googleapis.com/` and `https://fonts.gstatic.com/`: the current Next/font build's Public Sans, Fraunces and IBM Plex Mono CSS/font downloads. These are build-time font assets; no application account, request, token or student data will be sent.

All npm/container downloads remain pinned through the existing lockfile/image digests and approved official registries. New build output stays in ignored isolated directories or owned containers; private owner .env/.next trace/cache/uploads are excluded. Existing server processes, configuration and MFA remain intact. Record engine/font checksums/licenses, native startup/artifact audit and actual browser/security results before calling the gates passed. This does not authorize new services/accounts, production traffic or changes to authentication/permission behavior.
