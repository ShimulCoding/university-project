# Fake-only pooler build. Never add application configuration or credentials.
# Execute from the repository root with this Dockerfile-specific empty context.
# Direct package versions were checked against official Debian amd64 pages.
# Resolved transitive versions and final-image advisories remain build gates.
FROM buildpack-deps:bookworm-curl@sha256:a74523d7cca2436f4e3b6f5e47049d1830efbf473c33ebdf5a666f6f77425ebf AS ca-trust

FROM postgres:16.15-bookworm@sha256:0ea6700a3b4f0ae6ce746519073558aed4d88a79d8d07622a9a644946c7319c4 AS builder

SHELL ["/bin/sh", "-ec"]
USER 0:0
WORKDIR /usr/src/pgbouncer

# The pinned PG and Node slim images were inspected and lack a CA bundle.
# Transfer only the verified public bundle and its genuine Debian notice from
# the immutable official trust carrier; no trust-stage command or host file.
COPY --from=ca-trust /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=ca-trust /usr/share/doc/ca-certificates/copyright /usr/local/share/pgbouncer/bootstrap/ca-certificates.copyright

# Replace inherited repositories: no PGDG, rolling suite, unsigned metadata,
# HTTP download, or disabled certificate/Release-expiry verification.
RUN set -eu; \
    test "$(dpkg --print-architecture)" = amd64; \
    test -s /etc/ssl/certs/ca-certificates.crt; \
    printf '%s\n' \
      '714d457d580922dbf1d0be8bd35ba236a842b50b0072ae791582a19adef772a5  /etc/ssl/certs/ca-certificates.crt' \
      'e85e1bcad3a915dc7e6f41412bc5bdeba275cadd817896ea0451f2140a93967c  /usr/local/share/pgbouncer/bootstrap/ca-certificates.copyright' \
      | sha256sum --check --status; \
    rm -f /etc/apt/sources.list /etc/apt/sources.list.d/*; \
    printf '%s\n' \
      'Types: deb' \
      'URIs: https://deb.debian.org/debian' \
      'Suites: bookworm bookworm-updates' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      '' \
      'Types: deb' \
      'URIs: https://security.debian.org/debian-security' \
      'Suites: bookworm-security' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      > /etc/apt/sources.list.d/debian.sources; \
    printf '%s\n' \
      'Acquire::https::Timeout "30";' \
      'Acquire::Retries "2";' \
      'Acquire::https::Verify-Peer "true";' \
      'Acquire::https::Verify-Host "true";' \
      'Acquire::Check-Valid-Until "true";' \
      'Acquire::AllowInsecureRepositories "false";' \
      'APT::Get::AllowUnauthenticated "false";' \
      > /etc/apt/apt.conf.d/99verified-pooler; \
    apt-get update -o APT::Update::Error-Mode=any; \
    DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
      ca-certificates=20250419~deb12u1 \
      curl=7.88.1-10+deb12u15 \
      gcc=4:12.2.0-3 \
      libc6-dev=2.36-9+deb12u14 \
      libevent-dev=2.1.12-stable-8+deb12u1 \
      libssl-dev=3.0.22-1~deb12u1 \
      make=4.3-4.1 \
      openssl=3.0.22-1~deb12u1 \
      pkg-config=1.8.1-1; \
    mkdir -p /out/bin /out/licenses/pgbouncer /out/licenses/build-packages /out/licenses/bootstrap /out/provenance; \
    cp /usr/local/share/pgbouncer/bootstrap/ca-certificates.copyright /out/licenses/bootstrap/ca-certificates.copyright; \
    cp --parents /usr/share/common-licenses/GPL-2 /usr/share/common-licenses/MPL-2.0 /out/licenses/build-packages/; \
    printf '%s\n' \
      'buildpack-deps:bookworm-curl@sha256:a74523d7cca2436f4e3b6f5e47049d1830efbf473c33ebdf5a666f6f77425ebf' \
      'ca-certificates=20250419~deb12u1' \
      'bundle-sha256=714d457d580922dbf1d0be8bd35ba236a842b50b0072ae791582a19adef772a5' \
      'notice-sha256=e85e1bcad3a915dc7e6f41412bc5bdeba275cadd817896ea0451f2140a93967c' \
      > /out/provenance/bootstrap-trust.txt; \
    dpkg-query -W -f='${binary:Package}\t${Version}\t${Architecture}\n' \
      | LC_ALL=C sort > /out/provenance/build-packages.tsv; \
    cp /etc/apt/sources.list.d/debian.sources /out/provenance/debian.sources; \
    for document in /usr/share/doc/*/copyright; do \
      test -f "$document" || continue; \
      cp --parents "$document" /out/licenses/build-packages/; \
    done; \
    rm -rf /var/lib/apt/lists/*

# No redirect is followed: an unexpected vendor move requires review.
# A release manifest and the archive must independently match the fixed hash.
RUN set -eu; \
    curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
      --connect-timeout 15 --max-time 120 --retry 2 --retry-delay 2 \
      --max-filesize 4194304 \
      --output /tmp/pgbouncer-1.26.0.tar.gz \
      https://www.pgbouncer.org/downloads/files/1.26.0/pgbouncer-1.26.0.tar.gz; \
    curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
      --connect-timeout 15 --max-time 30 --retry 2 --retry-delay 2 \
      --max-filesize 4096 \
      --output /tmp/pgbouncer-1.26.0.tar.gz.sha256 \
      https://www.pgbouncer.org/downloads/files/1.26.0/pgbouncer-1.26.0.tar.gz.sha256; \
    test "$(awk 'NR == 1 { print $1 }' /tmp/pgbouncer-1.26.0.tar.gz.sha256)" \
      = afd25dd61ee6775d37b40629b87ce08736b3e6955f3057bb212e410fbf21c71d; \
    printf '%s\n' \
      'afd25dd61ee6775d37b40629b87ce08736b3e6955f3057bb212e410fbf21c71d  /tmp/pgbouncer-1.26.0.tar.gz' \
      | sha256sum --check --status; \
    tar --extract --gzip --file /tmp/pgbouncer-1.26.0.tar.gz \
      --directory /usr/src/pgbouncer --strip-components=1 --no-same-owner; \
    ./configure --prefix=/usr/local --with-tls=openssl \
      --without-cares --without-pam --without-ldap --without-systemd \
      CFLAGS='-O2 -fstack-protector-strong -D_FORTIFY_SOURCE=2 -fPIE' \
      LDFLAGS='-Wl,-z,relro,-z,now -pie'; \
    make -j2 pgbouncer; \
    test "$(./pgbouncer --version | head -n 1)" = 'PgBouncer 1.26.0'; \
    ./pgbouncer --version > /out/provenance/pgbouncer-version.txt; \
    grep -q 'OpenSSL' /out/provenance/pgbouncer-version.txt; \
    install -m 0755 pgbouncer /out/bin/pgbouncer; \
    cp COPYRIGHT /out/licenses/pgbouncer/COPYRIGHT; \
    find lib -type f \( -iname 'copyright*' -o -iname 'license*' \) \
      -exec cp --parents '{}' /out/licenses/pgbouncer/ \;; \
    cp /tmp/pgbouncer-1.26.0.tar.gz.sha256 /out/provenance/pgbouncer-source.sha256; \
    cd /out/bin; \
    sha256sum pgbouncer > /out/provenance/pgbouncer-binary.sha256

FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587 AS runtime

SHELL ["/bin/sh", "-ec"]
USER 0:0

# Bootstrap HTTPS trust from the pinned official builder, never an HTTP APT run.
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list.d/debian.sources
COPY --from=builder /etc/apt/apt.conf.d/99verified-pooler /etc/apt/apt.conf.d/99verified-pooler

RUN set -eu; \
    test "$(dpkg --print-architecture)" = amd64; \
    rm -f /etc/apt/sources.list; \
    find /etc/apt/sources.list.d -type f ! -name debian.sources -delete; \
    apt-get update -o APT::Update::Error-Mode=any; \
    DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
      ca-certificates=20250419~deb12u1 \
      libevent-2.1-7=2.1.12-stable-8+deb12u1 \
      libssl3=3.0.22-1~deb12u1 \
      openssl=3.0.22-1~deb12u1; \
    mkdir -p /usr/local/share/pgbouncer/provenance /run/pgbouncer; \
    dpkg-query -W -f='${binary:Package}\t${Version}\t${Architecture}\n' \
      | LC_ALL=C sort > /usr/local/share/pgbouncer/provenance/runtime-packages.tsv; \
    command -v getent > /dev/null; \
    ! getent passwd 10001; \
    ! getent group 10001; \
    ! getent passwd pgbouncer; \
    ! getent group pgbouncer; \
    printf '%s\n' 'pgbouncer:x:10001:' >> /etc/group; \
    printf '%s\n' 'pgbouncer:x:10001:10001:PgBouncer:/nonexistent:/usr/sbin/nologin' >> /etc/passwd; \
    chmod 0750 /run/pgbouncer; \
    chown 10001:10001 /run/pgbouncer; \
    rm -rf /var/lib/apt/lists/*

# Only trusted built output crosses stages; no host COPY/ADD or sample configs.
COPY --from=builder /out/bin/pgbouncer /usr/local/bin/pgbouncer
COPY --from=builder /out/licenses /usr/local/share/pgbouncer/licenses
COPY --from=builder /out/provenance /usr/local/share/pgbouncer/provenance

RUN set -eu; \
    cd /usr/local/bin; \
    sha256sum --check --status /usr/local/share/pgbouncer/provenance/pgbouncer-binary.sha256; \
    test "$(/usr/local/bin/pgbouncer --version | head -n 1)" = 'PgBouncer 1.26.0'; \
    ldd /usr/local/bin/pgbouncer > /usr/local/share/pgbouncer/provenance/runtime-linkage.txt; \
    ! grep -q 'not found' /usr/local/share/pgbouncer/provenance/runtime-linkage.txt

LABEL org.opencontainers.image.title="University-project local PgBouncer" \
      org.opencontainers.image.version="1.26.0" \
      org.opencontainers.image.licenses="ISC" \
      org.opencontainers.image.source="https://github.com/pgbouncer/pgbouncer" \
      org.opencontainers.image.description="Fake-only verification pooler; OS and bundled licenses are retained separately."

USER 10001:10001
WORKDIR /run/pgbouncer
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/pgbouncer"]
CMD ["/run/secrets/pgbouncer.ini"]
