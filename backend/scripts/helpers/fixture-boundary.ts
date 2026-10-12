import assert from "node:assert/strict";

export const fixtureTransactionPooler = Object.freeze({
  host: "127.0.0.1",
  port: "16432",
  upstreamPort: "15432",
  imageId: "sha256:b5b268e6b371aab1cc3ef00cc92a0106e2c30643bc98e4534982e5b07df367a2",
});

export type FixtureConnection =
  | { connectionMode: "direct" }
  | { connectionMode: "pgbouncer-transaction"; pooler: typeof fixtureTransactionPooler };

export function fixtureUrlArguments(url: URL) {
  // Prisma v6's query `host` replaces the URI authority with a Unix socket.
  // A complete fixture-only allowlist also excludes file paths/session options.
  assert(url.hash === "", "Fixture URLs cannot carry fragments");
  const seen = new Set<string>();
  const integerLimits: Readonly<Record<string, number>> = { connection_limit: 100, pool_timeout: 60, connect_timeout: 60, socket_timeout: 300, statement_cache_size: 1000 };
  for (const [key, value] of url.searchParams) {
    assert(!seen.has(key), "Fixture URL arguments cannot be duplicated");
    seen.add(key);
    if (key === "schema") assert(value === "public", "Fixture clients require the reviewed public schema");
    else if (key === "pgbouncer") assert(value === "true" || value === "false", "Fixture PgBouncer compatibility must be explicit boolean text");
    else {
      const maximum = Object.hasOwn(integerLimits, key) ? integerLimits[key] : undefined;
      assert(maximum !== undefined && /^(0|[1-9][0-9]{0,3})$/.test(value) && Number(value) <= maximum && (key === "statement_cache_size" || Number(value) > 0), "Fixture URL arguments must be reviewed bounded connection settings");
    }
  }
}

// This module deliberately imports no application configuration or database client.
export function fixtureConnection(value?: unknown): FixtureConnection {
  assert(value === undefined || (typeof value === "object" && value !== null && !Array.isArray(value)), "Fixture connection metadata must be an object");
  const candidate = value as { connectionMode?: unknown; pooler?: unknown } | undefined;
  const mode = candidate?.connectionMode === undefined ? "direct" : candidate.connectionMode;
  if (mode === "direct") {
    assert(candidate?.pooler === undefined, "Direct fixtures cannot carry pooler metadata");
    return { connectionMode: "direct" };
  }
  assert(mode === "pgbouncer-transaction", "Only explicit reviewed fixture connection modes are accepted");
  const pooler = candidate?.pooler;
  assert(typeof pooler === "object" && pooler !== null && !Array.isArray(pooler), "Pooled fixtures require the reviewed pooler descriptor");
  const descriptor = pooler as Record<string, unknown>;
  assert(Object.keys(descriptor).length === Object.keys(fixtureTransactionPooler).length && Object.entries(fixtureTransactionPooler).every(([key, expected]) => Object.hasOwn(descriptor, key) && descriptor[key] === expected), "Fixture pooler host, ports and owned image must match the reviewed boundary");
  return { connectionMode: "pgbouncer-transaction", pooler: fixtureTransactionPooler };
}

export function fixtureConnectionEnvironment(values: Readonly<Record<string, string | undefined>>): FixtureConnection {
  const mode = values.VERIFY_FIXTURE_CONNECTION_MODE;
  const port = values.VERIFY_FIXTURE_POOLER_PORT;
  const upstreamPort = values.VERIFY_FIXTURE_UPSTREAM_PORT;
  const imageId = values.VERIFY_FIXTURE_POOLER_IMAGE_ID;
  if (mode === undefined || mode === "direct") {
    assert(port === undefined && upstreamPort === undefined && imageId === undefined, "Direct fixture invocation cannot inherit pooler metadata");
    return fixtureConnection({ connectionMode: "direct" });
  }
  return fixtureConnection({ connectionMode: mode, pooler: { host: "127.0.0.1", port, upstreamPort, imageId } });
}

export function fixtureDatabaseBoundary(runtimeValue: string, fixtureValue: string, metadata?: unknown) {
  const connection = fixtureConnection(metadata);
  const runtime = new URL(runtimeValue), fixture = new URL(fixtureValue);
  const database = decodeURIComponent(runtime.pathname.slice(1));
  fixtureUrlArguments(runtime); fixtureUrlArguments(fixture);
  assert([runtime, fixture].every((value) => ["postgres:", "postgresql:"].includes(value.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(value.hostname)), "Fixture clients require loopback PostgreSQL targets");
  assert(/^mu_scale_[a-z0-9_]{8,35}$/.test(database) && fixture.pathname === runtime.pathname, "Fixture clients require the same isolated mu_scale database");
  if (connection.connectionMode === "direct") {
    assert(runtime.hostname === fixture.hostname && runtime.port === fixture.port, "Direct fixture/runtime clients require the same host and port");
  } else {
    assert(runtime.hostname === connection.pooler.host && fixture.hostname === connection.pooler.host && runtime.port === connection.pooler.port && fixture.port === connection.pooler.upstreamPort, "Pooled fixtures require the reviewed loopback runtime and direct migration ports");
  }
  assert(decodeURIComponent(runtime.username) === `${database}_runtime` && decodeURIComponent(fixture.username) === `${database}_migration`, "Fixture clients require paired restricted runtime/migration roles");
  return database;
}
