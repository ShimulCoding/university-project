import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dockerfileUrl = new URL('../../infra/scalability/PgBouncer.Dockerfile', import.meta.url);
const ignoreUrl = new URL('../../infra/scalability/PgBouncer.Dockerfile.dockerignore', import.meta.url);
const trust = 'buildpack-deps:bookworm-curl@sha256:a74523d7cca2436f4e3b6f5e47049d1830efbf473c33ebdf5a666f6f77425ebf';
const trustBundleHash = '714d457d580922dbf1d0be8bd35ba236a842b50b0072ae791582a19adef772a5';
const trustNoticeHash = 'e85e1bcad3a915dc7e6f41412bc5bdeba275cadd817896ea0451f2140a93967c';
const builder = 'postgres:16.15-bookworm@sha256:0ea6700a3b4f0ae6ce746519073558aed4d88a79d8d07622a9a644946c7319c4';
const runtime = 'debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587';
const sourceHash = 'afd25dd61ee6775d37b40629b87ce08736b3e6955f3057bb212e410fbf21c71d';
const sourceUrl = 'https://www.pgbouncer.org/downloads/files/1.26.0/pgbouncer-1.26.0.tar.gz';

// A deliberately narrow contract parser, not a general Dockerfile interpreter.
// Unsupported syntax fails instead of silently escaping the source-only gate.
export function instructions(source) {
  assert.equal(typeof source, 'string');
  assert(source.length <= 65536 && !source.includes('\0'), 'Invalid Dockerfile input');
  const result = [];
  let pending = '';
  for (const original of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = original.trim();
    if (!line || line.startsWith('#')) {
      assert(!/^#\s*(?:syntax|escape)\s*=/i.test(line), 'Unsupported parser directive');
      continue;
    }
    const continues = line.endsWith('\\');
    pending += `${pending ? ' ' : ''}${continues ? line.slice(0, -1).trimEnd() : line}`;
    if (continues) continue;
    const match = /^([A-Z]+)\s+([\s\S]+)$/.exec(pending);
    assert(match, 'Uncovered Dockerfile instruction');
    assert(['FROM', 'SHELL', 'USER', 'WORKDIR', 'RUN', 'COPY', 'LABEL', 'STOPSIGNAL', 'ENTRYPOINT', 'CMD'].includes(match[1]), 'Unsupported Dockerfile instruction');
    assert(!match[2].includes('<<'), 'Uncovered Dockerfile heredoc');
    result.push({ kind: match[1], value: match[2] });
    pending = '';
  }
  assert.equal(pending, '', 'Unterminated Dockerfile continuation');
  return result;
}

export function verifyBuildContract(source, ignoreSource) {
  const parsed = instructions(source);
  const stages = parsed.filter(item => item.kind === 'FROM');
  assert.deepEqual(stages.map(item => item.value), [`${trust} AS ca-trust`, `${builder} AS builder`, `${runtime} AS runtime`], 'Base-image pin drift');
  const builderStart = parsed.findIndex(item => item.kind === 'FROM' && item.value.endsWith(' AS builder'));
  assert.equal(builderStart, 1, 'Immutable CA carrier must not run commands or accept files');
  const runtimeStart = parsed.findIndex(item => item.kind === 'FROM' && item.value.endsWith(' AS runtime'));
  const buildPart = parsed.slice(0, runtimeStart);
  const finalPart = parsed.slice(runtimeStart);
  const runs = parsed.filter(item => item.kind === 'RUN').map(item => item.value);
  const buildRuns = buildPart.filter(item => item.kind === 'RUN').map(item => item.value);
  const runtimeRuns = finalPart.filter(item => item.kind === 'RUN').map(item => item.value);
  assert.equal(buildRuns.length, 2, 'Unexpected build command boundary');
  assert.equal(runtimeRuns.length, 2, 'Unexpected runtime command boundary');
  for (const run of runs) {
    assert(run.startsWith('set -eu;'), 'Every shell stage must fail closed');
    assert(!/\|\|\s*(?:true|:)(?:\s|;|$)|\bset\s+\+[a-z]*e\b/.test(run), 'Failure masking is forbidden');
  }
  const jsonArray = value => {
    let result;
    try { result = JSON.parse(value); } catch { assert.fail('Expected a JSON command array'); }
    assert(Array.isArray(result) && result.every(item => typeof item === 'string'), 'Expected a JSON string array');
    return result;
  };
  assert.deepEqual(parsed.filter(item => item.kind === 'SHELL').map(item => jsonArray(item.value)), [['/bin/sh', '-ec'], ['/bin/sh', '-ec']]);

  const copies = parsed.filter(item => item.kind === 'COPY');
  assert.deepEqual(copies.map(item => item.value), [
    '--from=ca-trust /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt',
    '--from=ca-trust /usr/share/doc/ca-certificates/copyright /usr/local/share/pgbouncer/bootstrap/ca-certificates.copyright',
    '--from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt',
    '--from=builder /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list.d/debian.sources',
    '--from=builder /etc/apt/apt.conf.d/99verified-pooler /etc/apt/apt.conf.d/99verified-pooler',
    '--from=builder /out/bin/pgbouncer /usr/local/bin/pgbouncer',
    '--from=builder /out/licenses /usr/local/share/pgbouncer/licenses',
    '--from=builder /out/provenance /usr/local/share/pgbouncer/provenance',
  ], 'Unexpected COPY can introduce host data or configs');
  assert.deepEqual(buildPart.filter(item => item.kind === 'COPY').map(item => item.value), copies.slice(0, 2).map(item => item.value), 'Builder accepts only the two immutable public trust files');
  const firstAptRun = parsed.findIndex(item => item.kind === 'RUN');
  assert(copies.slice(0, 2).every(item => parsed.indexOf(item) < firstAptRun), 'Trust input must precede any HTTPS APT command');
  const ignoreRules = ignoreSource.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  assert.deepEqual(ignoreRules, ['**'], 'Context must exclude every repository path');

  const aptRun = buildRuns[0];
  const compileRun = buildRuns[1];
  const bundleMarker = `${trustBundleHash}  /etc/ssl/certs/ca-certificates.crt`;
  const noticeMarker = `${trustNoticeHash}  /usr/local/share/pgbouncer/bootstrap/ca-certificates.copyright`;
  for (const marker of [bundleMarker, noticeMarker]) assert(aptRun.includes(marker), 'Exact reviewed public trust-file hash required');
  const bootstrapCheck = aptRun.indexOf('sha256sum --check --status');
  assert(bootstrapCheck > aptRun.indexOf(noticeMarker) && bootstrapCheck < aptRun.indexOf('apt-get update'), 'Verify public trust files before any package network traffic');
  assert(aptRun.includes('cp /usr/local/share/pgbouncer/bootstrap/ca-certificates.copyright /out/licenses/bootstrap/ca-certificates.copyright;'), 'Retain the imported CA notice');
  assert(aptRun.includes('cp --parents /usr/share/common-licenses/GPL-2 /usr/share/common-licenses/MPL-2.0 /out/licenses/build-packages/;'), 'Referenced common license texts must survive packaging');
  for (const marker of [
    'URIs: https://deb.debian.org/debian',
    'Suites: bookworm bookworm-updates',
    'URIs: https://security.debian.org/debian-security',
    'Suites: bookworm-security',
    'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg',
    'Acquire::https::Timeout "30";',
    'Acquire::Retries "2";',
    'Acquire::https::Verify-Peer "true";',
    'Acquire::https::Verify-Host "true";',
    'Acquire::Check-Valid-Until "true";',
    'Acquire::AllowInsecureRepositories "false";',
    'APT::Get::AllowUnauthenticated "false";',
    'APT::Update::Error-Mode=any',
    'rm -f /etc/apt/sources.list /etc/apt/sources.list.d/*',
  ]) assert(aptRun.includes(marker), `Missing signed repository control: ${marker}`);
  assert(!/(?:--allow-unauthenticated|--allow-downgrades|--force|trusted=yes|Check-Valid-Until\s+"false"|Verify-(?:Peer|Host)\s+"false"|curl\s+-[a-z]*k\b|--insecure|https?:\/\/[^\s'";]*@)/i.test(runs.join('\n')), 'Insecure transport/package control');
  assert(!/\b(?:apt-get\s+(?:upgrade|dist-upgrade)|git\s+clone|sudo|eval)\b/.test(runs.join('\n')), 'Unexpected build side effect');
  for (const item of parsed) assert(!/\b(?:PASSWORD|TOKEN|JWT_|DATABASE_URL|MFA_ENCRYPTION_KEY|GH_TOKEN)\b/.test(item.value), 'Secret channel introduced');

  const installs = runs.flatMap(run => [...run.matchAll(/apt-get install --yes --no-install-recommends\s+([^;]+)/g)].map(match => match[1].trim().split(/\s+/)));
  assert.deepEqual(installs, [
    ['ca-certificates=20250419~deb12u1', 'curl=7.88.1-10+deb12u15', 'gcc=4:12.2.0-3', 'libc6-dev=2.36-9+deb12u14', 'libevent-dev=2.1.12-stable-8+deb12u1', 'libssl-dev=3.0.22-1~deb12u1', 'make=4.3-4.1', 'openssl=3.0.22-1~deb12u1', 'pkg-config=1.8.1-1'],
    ['ca-certificates=20250419~deb12u1', 'libevent-2.1-7=2.1.12-stable-8+deb12u1', 'libssl3=3.0.22-1~deb12u1', 'openssl=3.0.22-1~deb12u1'],
  ], 'Exact package dependency pins drifted');
  assert.equal((runs.join('\n').match(/dpkg --print-architecture/g) ?? []).length, 2, 'Both stages must reject unexpected architecture');
  assert.equal((runs.join('\n').match(/test "\$\(dpkg --print-architecture\)" = amd64;/g) ?? []).length, 2, 'This reviewed build supports only native amd64');
  assert.equal((runs.join('\n').match(/dpkg-query -W/g) ?? []).length, 2, 'Resolved dependency manifests required');
  assert(compileRun.includes(sourceUrl) && compileRun.includes(`${sourceUrl}.sha256`), 'Official source/manifest missing');
  assert.equal((compileRun.match(new RegExp(sourceHash, 'g')) ?? []).length, 2, 'Fixed source hash must guard manifest and archive');
  const hashCheck = compileRun.indexOf('sha256sum --check --status');
  assert(hashCheck > 0 && hashCheck < compileRun.indexOf('tar --extract') && hashCheck < compileRun.indexOf('./configure'), 'Source must verify before extraction or execution');
  assert.equal((compileRun.match(/curl --fail --silent --show-error --proto '=https' --tlsv1\.2/g) ?? []).length, 2);
  assert(!/\s(?:--location|-L)(?:\s|$)/.test(compileRun), 'Redirects require a separately reviewed destination allow-list');
  for (const marker of ['--connect-timeout 15', '--max-time 120', '--max-time 30', '--max-filesize 4194304', '--max-filesize 4096', '--retry 2', '--no-same-owner', '--with-tls=openssl', '--without-cares', '--without-pam', '--without-ldap', '--without-systemd', 'make -j2 pgbouncer', '-fstack-protector-strong', '-D_FORTIFY_SOURCE=2', '-fPIE', '-Wl,-z,relro,-z,now -pie', "grep -q 'OpenSSL'"])
    assert(compileRun.includes(marker), `Missing bounded/secure compilation control: ${marker}`);
  assert(!/make\s+(?:-\S+\s+)*install\b/.test(compileRun), 'Do not install upstream sample config/auth files');
  assert(compileRun.includes('cp COPYRIGHT /out/licenses/pgbouncer/COPYRIGHT'));
  assert(aptRun.includes('/out/licenses/build-packages/') && compileRun.includes('/out/provenance/pgbouncer-binary.sha256'));
  assert(runtimeRuns[0].includes('find /etc/apt/sources.list.d -type f ! -name debian.sources -delete'));
  for (const marker of ['command -v getent', '! getent passwd 10001;', '! getent group 10001;', '! getent passwd pgbouncer;', '! getent group pgbouncer;'])
    assert(runtimeRuns[0].includes(marker), 'Nonroot account collision checks required');
  assert(runtimeRuns[1].includes('ldd /usr/local/bin/pgbouncer') && runtimeRuns[1].includes("! grep -q 'not found'"));
  assert(compileRun.includes('cd /out/bin; sha256sum pgbouncer') && runtimeRuns[1].includes('cd /usr/local/bin; sha256sum --check --status /usr/local/share/pgbouncer/provenance/pgbouncer-binary.sha256;'), 'Final binary must match the recorded build artifact');
  assert.deepEqual(finalPart.filter(item => item.kind === 'USER').map(item => item.value), ['0:0', '10001:10001']);
  assert.equal(finalPart.findLast(item => item.kind === 'WORKDIR')?.value, '/run/pgbouncer');
  assert.deepEqual(jsonArray(finalPart.find(item => item.kind === 'ENTRYPOINT')?.value), ['/usr/local/bin/pgbouncer']);
  assert.deepEqual(jsonArray(finalPart.find(item => item.kind === 'CMD')?.value), ['/run/secrets/pgbouncer.ini']);
  assert.equal(finalPart.find(item => item.kind === 'STOPSIGNAL')?.value, 'SIGTERM');
  assert(!finalPart.some(item => item.kind === 'RUN' && /\b(?:curl|gcc|make|psql|postgres)\s/.test(item.value)), 'Build/compiler/database tools must not be installed in final runtime');
  return true;
}

function main() {
  assert.equal(process.argv.length, 2, 'Expected no arguments; this gate reads only its Dockerfile and ignore file');
  const source = readFileSync(dockerfileUrl, 'utf8');
  const ignore = readFileSync(ignoreUrl, 'utf8');
  verifyBuildContract(source, ignore);
  const negatives = [
    ['mutable trust carrier', text => text.replace(trust, 'buildpack-deps:bookworm-curl')],
    ['wrong trust carrier', text => text.replace(trust, builder)],
    ['executed trust carrier', text => text.replace(`${trust} AS ca-trust`, `${trust} AS ca-trust\nRUN set -eu; true`)],
    ['external trust directory', text => text.replace('--from=ca-trust /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt', '--from=ca-trust /etc /etc')],
    ['host trust input', text => text.replace('--from=ca-trust /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt', '.cache/local-ca.crt /etc/ssl/certs/ca-certificates.crt')],
    ['bundle changed', text => text.replaceAll(trustBundleHash, '0'.repeat(64))],
    ['notice changed', text => text.replaceAll(trustNoticeHash, '0'.repeat(64))],
    ['bootstrap checksum bypass', text => text.replace('| sha256sum --check --status;', '| true;')],
    ['imported notice omitted', text => text.replace('cp /usr/local/share/pgbouncer/bootstrap/ca-certificates.copyright /out/licenses/bootstrap/ca-certificates.copyright;', '')],
    ['referenced license texts omitted', text => text.replace('cp --parents /usr/share/common-licenses/GPL-2 /usr/share/common-licenses/MPL-2.0 /out/licenses/build-packages/;', '')],
    ['mutable builder', text => text.replace(builder, 'postgres:latest')],
    ['mutable runtime', text => text.replace(runtime, 'debian:bookworm-slim')],
    ['credential ARG', text => `${text}\nARG DATABASE_URL\n`],
    ['credential ENV', text => `${text}\nENV PASSWORD=fake-value\n`],
    ['host copy', text => `${text}\nCOPY backend/.env /tmp/config\n`],
    ['sample auth files', text => text.replace('COPY --from=builder /out/licenses /usr/local/share/pgbouncer/licenses', 'COPY --from=builder /usr/src/pgbouncer/etc /etc/pgbouncer')],
    ['remote ADD', text => `${text}\nADD https://example.invalid/a /tmp/a\n`],
    ['root runtime', text => text.replace('USER 10001:10001', 'USER 0:0')],
    ['wrong architecture', text => text.replaceAll('= amd64;', '= arm64;')],
    ['rolling repository', text => text.replace('Suites: bookworm bookworm-updates', 'Suites: stable stable-updates')],
    ['unsigned source', text => text.replaceAll('Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg', 'Trusted: yes')],
    ['disabled Release expiry', text => text.replace('Acquire::Check-Valid-Until "true";', 'Acquire::Check-Valid-Until "false";')],
    ['disabled TLS verification', text => text.replace('Acquire::https::Verify-Peer "true";', 'Acquire::https::Verify-Peer "false";')],
    ['floating package', text => text.replace('libssl-dev=3.0.22-1~deb12u1', 'libssl-dev')],
    ['source corruption', text => text.replaceAll(sourceHash, '0'.repeat(64))],
    ['unverified source', text => text.replace(/sha256sum --check --status(?=; \\\r?\n\s+tar --extract)/, 'true')],
    ['silent source checksum failure', text => text.replace(/sha256sum --check --status(?=; \\\r?\n\s+tar --extract)/, 'sha256sum --check --status || true')],
    ['unchecked redirects', text => text.replaceAll('curl --fail', 'curl --location --fail')],
    ['unbounded download', text => text.replace('--max-time 120', '')],
    ['unbounded body', text => text.replace('--max-filesize 4194304', '')],
    ['unbounded compilation', text => text.replace('make -j2 pgbouncer', 'make -j64 pgbouncer')],
    ['no TLS backend', text => text.replace('--with-tls=openssl', '--without-tls')],
    ['upstream sample install', text => text.replace('make -j2 pgbouncer;', 'make -j2 pgbouncer; make install;')],
    ['missing license', text => text.replace('cp COPYRIGHT /out/licenses/pgbouncer/COPYRIGHT;', '')],
    ['missing package evidence', text => text.replaceAll('dpkg-query -W', 'echo')],
    ['missing linkage verification', text => text.replace("! grep -q 'not found'", 'true')],
    ['shell entrypoint', text => text.replace('ENTRYPOINT ["/usr/local/bin/pgbouncer"]', 'ENTRYPOINT /bin/sh -c pgbouncer')],
    ['configuration override', text => text.replace('CMD ["/run/secrets/pgbouncer.ini"]', 'CMD ["/etc/pgbouncer.ini"]')],
    ['unsupported parser directive', text => `# escape=\u0060\n${text}`],
    ['uncovered instruction', text => `${text}\nHEALTHCHECK CMD true\n`],
    ['unclosed continuation', text => `${text}\nRUN echo fake \\`],
    ['uncovered heredoc', text => `${text}\nRUN <<EOF\nfake\nEOF\n`],
  ];
  for (const [name, mutate] of negatives) {
    const modified = mutate(source);
    assert.notEqual(modified, source, `Negative fixture did not change source: ${name}`);
    assert.throws(() => verifyBuildContract(modified, ignore), { code: 'ERR_ASSERTION' }, `Contract accepted unsafe drift: ${name}`);
  }
  for (const unsafeIgnore of ['', '**\n!.env\n', '**\n!infra/**\n', '.env\n.cache\n'])
    assert.throws(() => verifyBuildContract(source, unsafeIgnore), { code: 'ERR_ASSERTION' });
  assert.equal(verifyBuildContract(source.replace(/\r?\n/g, '\r\n'), ignore.replace(/\r?\n/g, '\r\n')), true, 'Contract must preserve CRLF behavior');
  console.log(`PgBouncer build contracts: ${negatives.length + 6} source/context checks passed; no subprocess, download, container, database or private-file access. Image build, licenses, CVEs and runtime acceptance remain pending.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch {
    console.error('PgBouncer build contract failed; Dockerfile/context drift rejected without printing source or private diagnostics.');
    process.exitCode = 1;
  }
}
