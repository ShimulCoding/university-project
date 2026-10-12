import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { fixturePrisma, verifyFixtureDatabase, disconnectFixtureDatabase, fixtureFailureDiagnostics } from "./helpers/fixture-database";
import { env } from "../src/config/env";
import { storageProvider } from "../src/storage";
import { documentDirectories } from "../src/config/uploads";
import { createSensitiveActionLimits } from "../src/middlewares/sensitive-action-limits";
import { createResourceAdmission, createWorkAdmission } from "../src/middlewares/resource-admission";
import { asyncHandler } from "../src/utils/async-handler";
import { signAccessToken } from "../src/utils/tokens";
import { createFixtureMfa } from "./helpers/mfa-fixtures";

let checks = 0;
function check(condition: unknown, message: string) { assert(condition, message); checks++; }
async function main() {
  await verifyFixtureDatabase();
  assert(env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname), "Local database required");
  const run = randomUUID(), users: string[] = [];
  let eventId: string | undefined, complaintId: string | undefined, filePath: string | undefined;
  const releases: (() => void)[] = [];
  const fixture = express();
  // Mock identities are confined to this loopback unit harness. Production keys
  // always come from verified authentication, proved by the real API below.
  fixture.use((request, _response, next) => {
    const actorId = request.headers["x-fixture-actor"] ?? "fixture-a";
    assert(typeof actorId === "string", "Fixture identity header must be a string");
    request.auth = {
      userId: actorId, sessionId: "fixture-session", sessionVersion: 0, roles: [],
      user: { id: actorId, fullName: "Action limit fixture", email: "fixture@example.invalid", status: "ACTIVE", roles: [], eventRoles: [] },
    };
    next();
  });
  const limits = createSensitiveActionLimits(150, { mutations: 2, documents: 2, reports: 2 });
  const router = express.Router(); router.use(limits.mutation);
  router.all("/action", (_request, response) => response.sendStatus(204)); fixture.use("/api/fixture", router);
  const recovery = express.Router(); recovery.use(limits.mutation); recovery.post("/action", (_request, response) => response.sendStatus(204)); fixture.use("/api/auth", recovery);
  const expensive = createWorkAdmission(1, "Fixture busy");
  let entered: (() => void) | undefined, uploadEntered = 0, uploadsClosed = 0, workClosed = 0;
  fixture.post("/work", expensive(async (_request, response) => { response.once("close", () => { workClosed++; }); entered?.(); await new Promise<void>(resolve => releases.push(resolve)); response.sendStatus(204); }));
  fixture.post("/failed-work", expensive(async () => { throw new Error("Synthetic work failure"); }));
  fixture.post("/uploads", createResourceAdmission(2, "Fixture uploads busy"), asyncHandler(async (_request, response) => {
    uploadEntered++; response.once("close", () => { uploadsClosed++; }); await new Promise<void>(resolve => releases.push(resolve)); response.sendStatus(204);
  }));
  fixture.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => { response.sendStatus(500); });
  const unitServer = fixture.listen(0, "127.0.0.1"), server = createApp().listen(0, "127.0.0.1");
  const listen = (instance: typeof server) => new Promise<void>(resolve => instance.listening ? resolve() : instance.once("listening", resolve));
  try {
    await Promise.all([listen(unitServer), listen(server)]);
    const unitAddress = unitServer.address(), address = server.address(); assert(unitAddress && typeof unitAddress !== "string" && address && typeof address !== "string");
    const unit = `http://127.0.0.1:${unitAddress.port}`, base = `http://127.0.0.1:${address.port}/api`;
    const short = (method = "POST", actor = "fixture-a", path = "/api/fixture/action") => fetch(unit + path, { method, headers: { "x-fixture-actor": actor } });
    for (const method of ["GET", "HEAD", "OPTIONS"]) check((await short(method)).status === 204, "Read-only request consumed mutation budget");
    check((await short()).status === 204 && (await short("PATCH")).status === 204, "Allowance prematurely denied");
    const blocked = await short("DELETE");
    check(blocked.status === 429 && Boolean(blocked.headers.get("ratelimit")) && Boolean(blocked.headers.get("retry-after")), "No bounded denial/retry headers");
    check((await short("GET")).status === 204, "Exhausted mutation budget blocked navigation");
    check((await short("POST", "fixture-b")).status === 204, "Different actors shared budget");
    for (let index = 0; index < 3; index++) check((await short("POST", "fixture-a", "/api/auth/action")).status === 204, "Recovery was blocked by operational budget");
    await new Promise(resolve => setTimeout(resolve, 180));
    check((await short()).status === 204, "Expired window did not restore allowance");

    const cancellation = new AbortController();
    const began = new Promise<void>(resolve => { entered = resolve; });
    const working = fetch(unit + "/work", { method: "POST", signal: cancellation.signal }).catch(() => undefined);
    await began;
    check((await fetch(unit + "/work", { method: "POST" })).status === 503, "Concurrent work exceeded cap");
    cancellation.abort(); await working;
    while (workClosed < 1) await new Promise(resolve => setTimeout(resolve, 5));
    check((await fetch(unit + "/work", { method: "POST" })).status === 503, "Cancellation released still-running work");
    releases.splice(0).forEach(release => release());
    await new Promise(resolve => setTimeout(resolve, 20));
    check((await fetch(unit + "/failed-work", { method: "POST" })).status === 500, "Failed work did not release previous slot");
    check((await fetch(unit + "/failed-work", { method: "POST" })).status === 500, "Exception leaked admission slot");
    // A parsed upload controller still holds buffers while its service promise
    // runs. Closing the response must not free that memory admission slot early.
    const uploadControllers = [new AbortController(), new AbortController()];
    const uploads = uploadControllers.map(controller => fetch(unit + "/uploads", { method: "POST", signal: controller.signal }).catch(() => undefined));
    while (uploadEntered < 2) await new Promise(resolve => setTimeout(resolve, 5));
    uploadControllers.forEach(controller => controller.abort()); await Promise.all(uploads);
    while (uploadsClosed < 2) await new Promise(resolve => setTimeout(resolve, 5));
    const thirdUpload = await fetch(unit + "/uploads", { method: "POST", signal: AbortSignal.timeout(300) }).catch(() => undefined);
    check(thirdUpload?.status === 503, "Disconnected upload work evaded shared admission cap");
    releases.splice(0).forEach(release => release());
    await new Promise(resolve => setTimeout(resolve, 20));

    const event = await prisma.event.create({ data: { title: "Action limit fixture", slug: `action-limit-${run}`, status: "COMPLETED" } }); eventId = event.id;
    const tokens: string[] = [];
    for (const index of [0, 1, 2]) {
      const user = await prisma.user.create({ data: { fullName: "Action limit fixture", email: `action-limit-${index}-${run}@example.invalid`, passwordHash: "fixture-not-a-login" } }); users.push(user.id);
      await createFixtureMfa(user, run);
      await prisma.eventTeamMember.create({ data: { userId: user.id, eventId, roleCode: "FINANCIAL_CONTROLLER" } });
      const session = await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 300000), mfaVerifiedAt: new Date() } });
      tokens.push(signAccessToken(user.id, user.sessionVersion, session.id));
    }
    const headers = (index: number) => ({ Authorization: `Bearer ${tokens[index]}`, "Content-Type": "application/json" });
    for (let index = 0; index < 240; index++) assert.equal((await fetch(base + "/users/not-a-user/profile", { method: "PATCH", headers: headers(0), body: "{}" })).status, 403);
    checks++;
    check((await fetch(base + "/users/not-a-user/profile", { method: "PATCH", headers: { ...headers(0), "x-user-id": users[1]! }, body: "{}" })).status === 429, "Real budget trusted a claimed identity header");
    check((await fetch(base + "/auth/me", { headers: headers(0) })).status === 200, "Operational budget blocked current-session read");
    check((await fetch(base + "/auth/update-email", { method: "PATCH", headers: headers(0), body: "{}" })).status === 400, "Operational budget blocked recovery validation");
    check((await fetch(base + "/users/not-a-user/profile", { method: "PATCH", headers: headers(1), body: "{}" })).status === 403, "Real accounts shared mutation quota");
    for (let index = 0; index < 5; index++) check((await fetch(base + "/reconciliation/generate", { method: "POST", headers: headers(1), body: JSON.stringify({ eventId }) })).status === 201, "Legitimate report generation rejected");
    check((await fetch(base + "/reconciliation/generate", { method: "POST", headers: headers(1), body: JSON.stringify({ eventId }) })).status === 429, "Report flood was not denied");
    check(await prisma.reconciliationReport.count({ where: { eventId } }) === 5, "Rate denial still created a report");

    const complaint = await prisma.complaint.create({ data: { submittedById: users[0]!, subject: "Action limit fixture", description: "Synthetic private evidence" } }); complaintId = complaint.id;
    const bytes = Buffer.from("%PDF-1.4\n%%EOF\n");
    const stored = await storageProvider.saveFile({ buffer: bytes, originalName: "document.pdf", destinationDir: documentDirectories.COMPLAINT_EVIDENCE }); filePath = stored.relativePath;
    const document = await prisma.supportingDocument.create({ data: { category: "COMPLAINT_EVIDENCE", originalName: "fixture.pdf", mimeType: "application/pdf", storedName: stored.storedName, relativePath: stored.relativePath, sizeBytes: BigInt(bytes.length), uploadedById: users[0]!, complaintId } });
    for (let index = 0; index < 120; index++) {
      const response = await fetch(base + `/documents/${document.id}/open`, { headers: headers(0) });
      assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    }
    checks++;
    const deniedFile = await fetch(base + `/documents/${document.id}/open`, { headers: headers(0) });
    check(deniedFile.status === 429 && !(await deniedFile.text()).includes("%PDF"), "Exhausted download streamed evidence");
    check(await prisma.auditLog.count({ where: { entityId: document.id, action: "documents.access_authorized" } }) === 120, "Denied file request reached authorization/streaming");
    check((await fetch(base + `/documents/${document.id}/open`, { headers: headers(2) })).status === 403, "Different actor inherited download allowance or ownership");
    console.log(`Sensitive action limits: ${checks} local quota/expiry/identity/admission/cancellation/API checks passed.`);
  } finally {
    releases.splice(0).forEach(release => release());
    unitServer.closeAllConnections(); server.closeAllConnections();
    await Promise.all([new Promise<void>(resolve => unitServer.close(() => resolve())), new Promise<void>(resolve => server.close(() => resolve()))]);
    if (users.length) await fixturePrisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    if (complaintId) await fixturePrisma.complaint.deleteMany({ where: { id: complaintId } });
    if (eventId) await fixturePrisma.event.deleteMany({ where: { id: eventId } });
    if (users.length) await fixturePrisma.user.deleteMany({ where: { id: { in: users } } });
    if (filePath) await storageProvider.removeFile(filePath);
    await prisma.$disconnect(); await disconnectFixtureDatabase();
  }
}
void main().catch((error: unknown) => { console.error(JSON.stringify(fixtureFailureDiagnostics(error))); process.exitCode = 1; });
