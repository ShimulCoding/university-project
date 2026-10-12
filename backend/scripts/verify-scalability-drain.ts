import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rmdir } from "node:fs/promises";
import type { Server } from "node:http";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import express from "express";
import { asyncHandler } from "../src/utils/async-handler";
import { createResourceAdmission, createWorkAdmission } from "../src/middlewares/resource-admission";
import { bindRequestWork, createGracefulShutdown, exitFailedShutdown, readinessHandler, RequestWork } from "../src/utils/request-work";

// No app/env/Prisma import: only synthetic loopback controller promises. Domain
// authorization/scanner/financial regressions run separately against fake DBs.
let checks = 0;
const check = (value: unknown, message: string) => { assert(value, message); checks++; };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
async function listen(app: express.Express) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  return { server, url: `http://127.0.0.1:${port}` };
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
async function request(url: string, method = "GET") {
  const response = await fetch(url, { method, signal: AbortSignal.timeout(2_000) });
  await response.arrayBuffer();
  return response;
}
async function unitCases() {
  const work = new RequestWork();
  check(work.isReady && work.activeCount === 0, "Registry initial state incorrect");
  const first = work.begin()!, second = work.begin()!;
  check(work.activeCount === 2, "Registry missed synchronous registration");
  let idle = false;
  const waiter = work.waitForIdle(); void waiter.promise.then(() => { idle = true; });
  first(); first(); await tick();
  check(work.activeCount === 1 && !idle, "Double release or premature idle");
  second(); await waiter.promise;
  check(work.activeCount === 0, "Final release leaked registration");
  await assert.rejects(work.track(async () => { throw new Error("Synthetic rejection"); })); checks++;
  check(work.activeCount === 0, "Rejected maintenance leaked registration");
  const other = new RequestWork(); work.startDraining(); work.startDraining();
  check(!work.isReady && work.begin() === null && other.isReady, "Drain not idempotent/app-isolated");
  let invoked = false;
  await assert.rejects(work.track(async () => { invoked = true; })); checks++;
  check(!invoked && work.activeCount === 0, "Drained maintenance still invoked");
  const server = express().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    for (const deadlineMs of [0, -1, 1.1, NaN, 300_001]) {
      assert.throws(() => createGracefulShutdown({ server, work: other, disconnect: async () => {}, stopMaintenance: () => {}, deadlineMs })); checks++;
    }
  } finally { await close(server); }
}

async function wrappedCases(kind: "ordinary" | "upload" | "report") {
  const work = new RequestWork(), app = express();
  const began = deferred(), held = deferred(), disconnected = deferred();
  let entered = 0, parsed = 0, disconnectedWith = -1, disconnects = 0, stops = 0;
  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/readyz", readinessHandler(work));
  app.use(bindRequestWork(work));
  app.use((_request, _response, next) => { parsed++; next(); });
  const handler = async (_request: express.Request, response: express.Response) => {
    entered++; response.once("close", disconnected.resolve); began.resolve(); await held.promise;
    if (!response.destroyed) response.sendStatus(204);
  };
  if (kind === "report") app.post("/work", createWorkAdmission(1, "Synthetic busy")(handler));
  else if (kind === "upload") app.post("/work", createResourceAdmission(1, "Synthetic busy"), asyncHandler(handler));
  else app.post("/work", asyncHandler(handler));
  const { server, url } = await listen(app);
  const shutdown = createGracefulShutdown({ server, work, stopMaintenance: () => { stops++; }, disconnect: async () => { disconnects++; disconnectedWith = work.activeCount; }, deadlineMs: 2_000 });
  try {
    const initiallyReady = await request(`${url}/readyz`);
    check(initiallyReady.status === 200 && initiallyReady.headers.get("cache-control") === "private, no-store", `${kind}: initial readiness incorrect/cacheable`);
    const controller = new AbortController();
    const pending = fetch(`${url}/work`, { method: "POST", signal: controller.signal }).catch(() => null);
    await began.promise;
    check(work.activeCount === 1, `${kind}: running promise not registered`);
    controller.abort(); await pending; await disconnected.promise;
    check(work.activeCount === 1, `${kind}: socket close released unfinished promise`);
    if (kind !== "ordinary") {
      check((await request(`${url}/work`, "POST")).status === 503, `${kind}: local capacity lost on disconnect`);
      check(entered === 1, `${kind}: extra controller entered while held`);
    }
    work.startDraining();
    const parsedBefore = parsed;
    const denied = await request(`${url}/work`, "POST");
    check(denied.status === 503 && denied.headers.get("retry-after") === "5", `${kind}: drain did not reject/advertise retry`);
    check(denied.headers.get("cache-control") === "private, no-store", `${kind}: drain denial could cache`);
    check(parsed === parsedBefore && entered === 1, `${kind}: drain reached parser/controller`);
    const ready = await request(`${url}/readyz`);
    check(ready.status === 503 && ready.headers.get("cache-control") === "private, no-store", `${kind}: readiness still green/cacheable`);
    check((await request(`${url}/health`)).status === 200, `${kind}: liveness disappeared during drain`);
    const one = shutdown(), two = shutdown();
    check(one === two, `${kind}: repeated signals started separate shutdowns`);
    await tick();
    check(disconnects === 0, `${kind}: database disconnected before held work`);
    held.resolve(); const result = await one;
    check(result.status === "completed" && disconnectedWith === 0, `${kind}: drain outcome ${JSON.stringify(result)}; work at disconnect ${disconnectedWith}`);
    check(disconnects === 1 && stops === 1 && work.activeCount === 0, `${kind}: cleanup count/leak incorrect`);
  } finally { held.resolve(); await close(server); }
}

async function unusedSocketCases() {
  for (const partial of [false, true]) {
    const work = new RequestWork();
    const { server } = await listen(express());
    let disconnects = 0;
    const shutdown = createGracefulShutdown({ server, work, stopMaintenance: () => {}, disconnect: async () => { disconnects++; }, deadlineMs: 500 });
    const socket = createConnection({ host: "127.0.0.1", port: (server.address() as { port: number }).port });
    let socketError: NodeJS.ErrnoException | undefined;
    socket.on("error", (error: NodeJS.ErrnoException) => { socketError = error; });
    await new Promise<void>((resolve) => socket.once("connect", resolve));
    if (partial) socket.write("GET /fixture HTTP/1.1\r\nHost: localhost\r\n");
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    try {
      check((await shutdown()).status === "completed", "Unused/partial header socket defeated drain");
      await closed;
      check(!socketError || socketError.code === "ECONNRESET", "Unused socket returned unexpected transport failure");
      check(disconnects === 1 && work.activeCount === 0, "Unused socket caused duplicate/unsafe cleanup");
    } finally { socket.destroy(); await close(server); }
  }
}

async function acceptedStreamCase() {
  const work = new RequestWork(), app = express();
  const began = deferred(), held = deferred();
  app.use(bindRequestWork(work));
  app.get("/stream", asyncHandler(async (_request, response) => {
    response.write("synthetic-first-"); began.resolve();
    // Model sendFile/stream delivery continuing after its controller returns.
    void held.promise.then(() => response.end("synthetic-last"));
  }));
  const { server, url } = await listen(app);
  let disconnects = 0;
  const shutdown = createGracefulShutdown({ server, work, stopMaintenance: () => {}, disconnect: async () => { disconnects++; }, deadlineMs: 2_000 });
  try {
    const pending = fetch(`${url}/stream`, { signal: AbortSignal.timeout(2_000) });
    await began.promise; const response = await pending; await tick();
    check(work.activeCount === 0, "Completed stream controller registration leaked");
    const draining = shutdown(); await tick();
    check(disconnects === 0, "Active accepted response stream was force-closed");
    held.resolve();
    check(await response.text() === "synthetic-first-synthetic-last", "Drain truncated accepted response bytes");
    check((await draining).status === "completed" && disconnects === 1, "Accepted stream did not drain fully");
  } finally { held.resolve(); await close(server); }
}

async function lateAndIsolationCases() {
  const firstWork = new RequestWork(), secondWork = new RequestWork();
  const preflightStarted = deferred(), preflightHeld = deferred();
  let parsed = 0, entered = 0;
  const firstApp = express(), secondApp = express();
  firstApp.use(bindRequestWork(firstWork)); secondApp.use(bindRequestWork(secondWork));
  firstApp.post("/late", asyncHandler(async (_request, _response, next) => {
    preflightStarted.resolve(); await preflightHeld.promise; next();
  }), createResourceAdmission(1, "Synthetic busy"), (_request, _response, next) => { parsed++; next(); }, asyncHandler(async (_request, response) => { entered++; response.sendStatus(204); }));
  secondApp.get("/work", asyncHandler(async (_request, response) => { response.sendStatus(204); }));
  const first = await listen(firstApp), second = await listen(secondApp);
  try {
    const pending = request(`${first.url}/late`, "POST"); await preflightStarted.promise;
    firstWork.startDraining(); preflightHeld.resolve();
    check((await pending).status === 503, "Preflight started multipart work after drain");
    check(parsed === 0 && entered === 0, "Late admission reached parser/controller");
    await tick(); check(firstWork.activeCount === 0, "Late rejection leaked preflight work");
    check((await request(`${second.url}/work`)).status === 204, "First app draining rejected another app's work");
    await tick(); check(secondWork.activeCount === 0 && secondWork.isReady, "Response registries crossed app boundary");
    await close(first.server);
    let disconnects = 0;
    const shutdown = createGracefulShutdown({ server: first.server, work: firstWork, stopMaintenance: () => {}, disconnect: async () => { disconnects++; } });
    check((await shutdown()).status === "completed" && disconnects === 1, "Already closed server could not drain safely");
  } finally { preflightHeld.resolve(); await close(first.server); await close(second.server); }
}

async function errorAndBackgroundCases() {
  const work = new RequestWork(), app = express();
  app.use(bindRequestWork(work));
  app.get("/error", asyncHandler(async () => { throw new Error("Synthetic rejection"); }));
  app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => { response.sendStatus(500); });
  const { server, url } = await listen(app);
  try {
    check((await request(`${url}/error`)).status === 500, "Controlled error path changed");
    await tick(); check(work.activeCount === 0, "Error response leaked tracked controller");
    const hold = deferred(); const task = work.track(() => hold.promise);
    check(work.activeCount === 1, "Background cleanup not synchronously tracked");
    let disconnects = 0;
    const shutdown = createGracefulShutdown({ server, work, stopMaintenance: () => {}, disconnect: async () => { disconnects++; }, deadlineMs: 2_000 });
    const pending = shutdown(); await tick();
    check(disconnects === 0, "Maintenance promise did not delay disconnect");
    hold.resolve(); await task;
    check((await pending).status === "completed" && disconnects === 1, "Maintenance drain did not complete");
  } finally { await close(server); }
}

async function deadlineCases() {
  for (const stage of ["work", "disconnect", "cleanup"] as const) {
    const work = new RequestWork(), app = express();
    const { server } = await listen(app);
    const hold = deferred(); let disconnects = 0;
    const finish = stage === "work" ? work.begin()! : () => {};
    const shutdown = createGracefulShutdown({ server, work, deadlineMs: 40, stopMaintenance: () => {}, disconnect: async () => {
      disconnects++; if (stage === "disconnect") await hold.promise;
      if (stage === "cleanup") throw new Error("Synthetic secret must stay out of diagnostics");
    } });
    try {
      const started = performance.now(); const result = await shutdown();
      const elapsedMs = performance.now() - started;
      check(result.status === "failed" && result.reason === (stage === "cleanup" ? "cleanup" : "deadline"), `${stage}: failed drain hidden`);
      check(elapsedMs < 1_000, `${stage}: shutdown deadline unbounded`);
      check(disconnects === (stage === "work" ? 0 : 1), `${stage}: unsafe disconnect invocation`);
      check(result.unfinishedWork === (stage === "work" ? 1 : 0), `${stage}: pending count wrong`);
      finish(); hold.resolve(); await tick();
      check(disconnects === (stage === "work" ? 0 : 1), `${stage}: timed-out coordinator disconnected later`);
    } finally { finish(); hold.resolve(); await close(server); }
  }
}

async function failedExitCase() {
  const child = spawn(process.execPath, [...process.execArgv, __filename, "--child-failed-shutdown"], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = "", errorOutput = "";
  child.stdout.on("data", (value: Buffer) => { output += value.toString(); });
  child.stderr.on("data", (value: Buffer) => { errorOutput += value.toString(); });
  const deadline = setTimeout(() => child.kill(), 5_000);
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    check(code === 1, "Failed shutdown child did not exit1");
    check(output === "", "Failed shutdown emitted unplanned stdout");
    assert.deepEqual(JSON.parse(errorOutput), { event: "shutdown.failed", reason: "deadline", unfinishedWork: 1 }); checks++;
  } finally { clearTimeout(deadline); }
}

async function databaseMiddlewareCases() {
  // Load the real middleware with ephemeral configuration from an empty owned
  // directory. Never read the owner's .env or connect to any database. These
  // bounded persistence seams test lifecycle timing, not domain DB behavior.
  const originalCwd = process.cwd(), ownedDirectory = await mkdtemp(path.join(tmpdir(), "university-drain-"));
  process.chdir(ownedDirectory);
  Object.assign(process.env, {
    NODE_ENV: "test", DATABASE_URL: "postgresql://127.0.0.1:1/drain_never_connect",
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64"), FRONTEND_URL: "http://127.0.0.1:1",
    UPLOAD_SCAN_REQUIRED: "false", ENABLE_LOCAL_ADMIN_BOOTSTRAP: "false", BCRYPT_SALT_ROUNDS: "10",
  });
  let loaded: {
    prisma: typeof import("../src/config/prisma").prisma;
    authenticate: typeof import("../src/middlewares/authenticate").authenticate;
    authenticateRefreshSession: typeof import("../src/middlewares/authenticate-refresh-session").authenticateRefreshSession;
    authorizeEventScoped: typeof import("../src/middlewares/authorize").authorizeEventScoped;
    authRepository: typeof import("../src/modules/auth/repositories/auth.repository").authRepository;
    tokens: typeof import("../src/utils/tokens");
    authCookieNames: typeof import("../src/config/auth").authCookieNames;
  };
  try {
    const [{ prisma }, { authenticate }, { authenticateRefreshSession }, { authorizeEventScoped }, { authRepository }, tokens, { authCookieNames }] = await Promise.all([
      import("../src/config/prisma"), import("../src/middlewares/authenticate"), import("../src/middlewares/authenticate-refresh-session"),
      import("../src/middlewares/authorize"), import("../src/modules/auth/repositories/auth.repository"), import("../src/utils/tokens"), import("../src/config/auth"),
    ]);
    loaded = { prisma, authenticate, authenticateRefreshSession, authorizeEventScoped, authRepository, tokens, authCookieNames };
  } finally { process.chdir(originalCwd); await rmdir(ownedDirectory); }
  const { prisma, authenticate, authenticateRefreshSession, authorizeEventScoped, authRepository, tokens, authCookieNames } = loaded;
  const { authenticatedSessionContext } = await import("../src/utils/authenticated-session-context");
  const originals = { user: prisma.user.findUnique, session: prisma.refreshToken.findUnique, event: prisma.event.findFirst, refresh: authRepository.findRefreshTokenByHash };
  const user = {
    id: "synthetic-drain-user", fullName: "Synthetic drain account", email: "drain@example.invalid", status: "ACTIVE", sessionVersion: 0,
    mfaFactor: { enrolledAt: new Date() } as { enrolledAt: Date } | null, roles: [],
    eventTeamMemberships: [{ eventId: "synthetic-drain-event", roleCode: "FINANCIAL_CONTROLLER", assignedAt: new Date(), event: { id: "synthetic-drain-event", title: "Synthetic", slug: "synthetic", status: "PUBLISHED" } }],
    createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
  };
  const session = { id: "synthetic-drain-session", userId: user.id, expiresAt: new Date(Date.now() + 3_600_000), revokedAt: null, mfaVerifiedAt: new Date(), user };
  const access = tokens.signAccessToken(user.id, 0, session.id), refresh = tokens.signRefreshToken(user.id);
  try {
    for (const stage of ["access-user", "access-session", "refresh-session", "event-scope"] as const) {
      const work = new RequestWork(), app = express(), began = deferred(), held = deferred(), closed = deferred();
      let entered = 0, disconnects = 0, unsettled = true;
      const read = async (name: typeof stage, value: unknown) => { if (name === stage) { began.resolve(); await held.promise; } return value; };
      Object.assign(prisma.user, { findUnique: () => read("access-user", user) });
      Object.assign(prisma.refreshToken, { findUnique: () => read("access-session", session) });
      Object.assign(authRepository, { findRefreshTokenByHash: () => read("refresh-session", session) });
      Object.assign(prisma.event, { findFirst: () => read("event-scope", { id: "synthetic-drain-event" }) });
      app.use(bindRequestWork(work));
      app.use((request, response, next) => {
        response.once("close", closed.resolve); request.cookies = { [authCookieNames.refreshToken]: refresh };
        if (stage === "event-scope") request.auth = { userId: user.id, sessionId: session.id, sessionVersion: 0, roles: [], user: { id: user.id, fullName: user.fullName, email: user.email, status: "ACTIVE", roles: [], eventRoles: [{ eventId: "synthetic-drain-event", roleCode: "FINANCIAL_CONTROLLER" }] } };
        next();
      });
      const middleware = stage === "refresh-session" ? authenticateRefreshSession : stage === "event-scope" ? authorizeEventScoped(["FINANCIAL_CONTROLLER"]) : authenticate;
      app.post("/fixture/:eventLookupKey", async (request, response, next) => {
        const actualPromise = middleware(request, response, next);
        check(actualPromise instanceof Promise, `${stage}: direct caller lost actual middleware promise`);
        await actualPromise; unsettled = false;
      }, asyncHandler(async (_request, response) => { entered++; response.sendStatus(204); }));
      const { server, url } = await listen(app);
      const shutdown = createGracefulShutdown({ server, work, stopMaintenance: () => {}, disconnect: async () => { check(work.activeCount === 0, `${stage}: disconnect raced read`); disconnects++; }, deadlineMs: 2_000 });
      try {
        const controller = new AbortController();
        const pending = fetch(`${url}/fixture/synthetic`, { method: "POST", headers: { authorization: `Bearer ${access}` }, signal: controller.signal }).catch(() => null);
        await began.promise;
        check(work.activeCount === 1 && unsettled, `${stage}: held DB read not registered/awaitable`);
        controller.abort(); await pending; await closed.promise;
        const draining = shutdown(); await tick();
        check(disconnects === 0 && work.activeCount === 1, `${stage}: abort released ongoing DB read`);
        held.resolve();
        check((await draining).status === "completed" && disconnects === 1, `${stage}: read failed to drain`);
        check(work.activeCount === 0 && entered === 0 && !unsettled, `${stage}: late controller/leaked registry/promise`);
      } finally { held.resolve(); await close(server); }
    }

    for (const kind of ["access", "refresh", "event"] as const) {
      for (const failure of ["draining", "read-error"] as const) {
        let lookups = 0, entered = 0;
        const rejectRead = async () => { lookups++; throw new Error("Synthetic read failure"); };
        Object.assign(prisma.user, { findUnique: rejectRead }); Object.assign(prisma.event, { findFirst: rejectRead });
        Object.assign(authRepository, { findRefreshTokenByHash: rejectRead });
        const work = new RequestWork(), app = express(); app.use(bindRequestWork(work));
        app.use((request, _response, next) => {
          request.cookies = { [authCookieNames.refreshToken]: refresh };
          request.auth = { userId: user.id, sessionId: session.id, sessionVersion: 0, roles: [], user: { id: user.id, fullName: user.fullName, email: user.email, status: "ACTIVE", roles: [], eventRoles: [{ eventId: "synthetic-drain-event", roleCode: "FINANCIAL_CONTROLLER" }] } };
          next();
        });
        const middleware = kind === "access" ? authenticate : kind === "refresh" ? authenticateRefreshSession : authorizeEventScoped(["FINANCIAL_CONTROLLER"]);
        app.post("/fixture/:eventLookupKey", async (request, response, next) => {
          if (failure === "draining") work.startDraining();
          await middleware(request, response, next);
        }, asyncHandler(async (_request, response) => { entered++; response.sendStatus(204); }));
        app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => response.sendStatus(500));
        const { server, url } = await listen(app);
        try {
          const result = await fetch(`${url}/fixture/synthetic`, { method: "POST", headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(2_000) }); await result.arrayBuffer(); await tick();
          check(result.status === (failure === "draining" ? 503 : kind === "refresh" ? 401 : 500), `${kind}/${failure}: existing error/drain semantics changed`);
          check(lookups === (failure === "draining" ? 0 : 1), `${kind}/${failure}: drained read or unexpected lookup`);
          check(work.activeCount === 0 && entered === 0, `${kind}/${failure}: leaked work or unauthorized controller`);
        } finally { await close(server); }
      }
    }

    // Real middleware chain keeps each overlapping promise registered once.
    let lookups = 0, entered = 0, peak = 0;
    Object.assign(prisma.user, { findUnique: async () => { lookups++; return user; } });
    Object.assign(prisma.refreshToken, { findUnique: async () => { lookups++; return session; } });
    Object.assign(prisma.event, { findFirst: async () => { lookups++; return { id: "synthetic-drain-event" }; } });
    const work = new RequestWork(), app = express(); app.use(bindRequestWork(work));
    app.use((request, _response, next) => { request.cookies = {}; next(); });
    app.post("/fixture/:eventLookupKey", authenticate, authorizeEventScoped(["FINANCIAL_CONTROLLER"]), asyncHandler(async (_request, response) => {
      check(authenticatedSessionContext.getStore()?.userId === user.id, "Tracking lost trusted session context");
      peak = work.activeCount; entered++; response.sendStatus(204);
    }));
    const { server, url } = await listen(app);
    try {
      const response = await fetch(`${url}/fixture/synthetic`, { method: "POST", headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(2_000) }); await response.arrayBuffer(); await tick();
      check(response.status === 204 && entered === 1 && lookups === 3, "Authentication/preflight/controller chain changed valid policy");
      check(peak >= 1 && peak <= 3 && work.activeCount === 0, "Chain double-registration/leak");
      user.mfaFactor = null;
      const mfaDenied = await fetch(`${url}/fixture/synthetic`, { method: "POST", headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(2_000) }); await mfaDenied.arrayBuffer(); await tick();
      check(mfaDenied.status === 401 && entered === 1 && work.activeCount === 0, "Tracking bypassed mandatory MFA or leaked denial");
      user.mfaFactor = { enrolledAt: new Date() };
      const invalid = await fetch(`${url}/fixture/synthetic`, { method: "POST", headers: { authorization: "Bearer synthetic-invalid" }, signal: AbortSignal.timeout(2_000) }); await invalid.arrayBuffer(); await tick();
      check(invalid.status === 401 && entered === 1 && work.activeCount === 0, "Tracking bypassed token verification");
      work.startDraining(); const before = lookups;
      check((await request(`${url}/fixture/synthetic`, "POST")).status === 503 && lookups === before, "Drained endpoint still performed DB lookups");
    } finally { await close(server); }
  } finally {
    Object.assign(prisma.user, { findUnique: originals.user }); Object.assign(prisma.refreshToken, { findUnique: originals.session });
    Object.assign(prisma.event, { findFirst: originals.event }); Object.assign(authRepository, { findRefreshTokenByHash: originals.refresh });
    await prisma.$disconnect();
  }
}

async function measure(mode: "before" | "after") {
  const work = new RequestWork(), app = express();
  const began = deferred(), held = deferred(), closed = deferred();
  app.use(bindRequestWork(work));
  app.post("/fixture", createWorkAdmission(1, "Synthetic busy")(async (_request, response) => {
    response.once("close", closed.resolve); began.resolve(); await held.promise;
    if (!response.destroyed) response.sendStatus(204);
  }));
  const { server, url } = await listen(app);
  let unfinishedAtDisconnect = -1;
  try {
    const controller = new AbortController();
    const pending = fetch(`${url}/fixture`, { method: "POST", signal: controller.signal }).catch(() => null);
    await began.promise; controller.abort(); await pending; await closed.promise;
    const start = performance.now();
    const timer = setTimeout(held.resolve, 80);
    if (mode === "before") {
      // Exact prior server.ts ordering with a harmless observation replacing
      // real DB disconnect/process exit; no security control is skipped.
      await new Promise<void>((resolve) => server.close(() => { unfinishedAtDisconnect = work.activeCount; resolve(); }));
    } else {
      const shutdown = createGracefulShutdown({ server, work, stopMaintenance: () => {}, deadlineMs: 2_000, disconnect: async () => { unfinishedAtDisconnect = work.activeCount; } });
      check((await shutdown()).status === "completed", "Measured drain failed");
    }
    const drainMs = performance.now() - start;
    await held.promise; clearTimeout(timer); await tick();
    return { mode, heldTaskMs: 80, unfinishedAtDisconnect, drainMs: Number(drainMs.toFixed(3)) };
  } finally { held.resolve(); await close(server); }
}

async function main() {
  await unitCases();
  for (const kind of ["ordinary", "upload", "report"] as const) await wrappedCases(kind);
  await unusedSocketCases(); await acceptedStreamCase(); await lateAndIsolationCases(); await errorAndBackgroundCases(); await deadlineCases(); await databaseMiddlewareCases(); await failedExitCase();
  const before = await measure("before"), after = await measure("after");
  check(before.unfinishedAtDisconnect === 1, "Baseline defect not reproduced");
  check(after.unfinishedAtDisconnect === 0, "Fixed path still disconnected unfinished work");
  console.log(JSON.stringify({ verification: "scalability-drain", checks, node: process.version, dataset: "one synthetic held controller; no DB or real accounts", environment: "native localhost; no CPU/RAM isolation", before, after }));
}

if (process.argv.includes("--child-failed-shutdown")) exitFailedShutdown({ status: "failed", reason: "deadline", unfinishedWork: 1 });
else void main().catch((error) => { console.error(error instanceof assert.AssertionError ? error.message : "Scalability drain verification failed; private diagnostics suppressed."); process.exitCode = 1; });
