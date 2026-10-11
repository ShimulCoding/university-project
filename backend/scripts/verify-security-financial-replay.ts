import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { FinancialOperation, Prisma } from "@prisma/client";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";
import { storageProvider } from "../src/storage";
import { paymentsService } from "../src/modules/payments/services/payments.service";
import { requestsService } from "../src/modules/requests/services/requests.service";
import { auditService } from "../src/modules/audit/services/audit.service";
import { signAccessToken } from "../src/utils/tokens";
import { financialRequestKey, financialTransaction } from "../src/utils/financial-idempotency";
import { uploadScanner } from "../src/utils/upload-scanner";
import type { AuthenticatedUser } from "../src/types/auth";
import { createFixtureMfa } from "./helpers/mfa-fixtures";

const run = randomUUID();
let checks = 0;
function check(condition: unknown, message: string) { assert(condition, message); checks++; }
const evidence = (text = "%PDF-1.4\n%%EOF\n", name = "synthetic.pdf") => {
  const buffer = Buffer.from(text);
  return { buffer, size: buffer.length, originalname: name, mimetype: "application/pdf" } as Express.Multer.File;
};
async function main() {
  assert(env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.DATABASE_URL).hostname), "Local database required");
  const users: string[] = [], events: string[] = [];
  const stored = new Set<string>();
  const save = storageProvider.saveFile, remove = storageProvider.removeFile, recordAudit = auditService.record;
  const preflight = paymentsService.assertIncomeRecordUploadAccess;
  const server = createApp().listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const event = await prisma.event.create({ data: { title: "Financial retry fixture", slug: `financial-retry-${run}` } }); events.push(event.id);
    const foreignEvent = await prisma.event.create({ data: { title: "Foreign retry fixture", slug: `foreign-retry-${run}` } }); events.push(foreignEvent.id);
    const actors: AuthenticatedUser[] = [], tokens: string[] = [], sessionIds: string[] = [];
    for (const index of [0, 1]) {
      const user = await prisma.user.create({ data: { fullName: "Financial retry fixture", email: `financial-retry-${index}-${run}@example.invalid`, passwordHash: "fixture-not-a-login" } }); users.push(user.id);
      await createFixtureMfa(user, run);
      await prisma.eventTeamMember.create({ data: { userId: user.id, eventId: event.id, roleCode: "FINANCIAL_CONTROLLER" } });
      const session = await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 300000), mfaVerifiedAt: new Date() } }); sessionIds.push(session.id);
      tokens.push(signAccessToken(user.id, user.sessionVersion, session.id));
      actors.push({ id: user.id, fullName: user.fullName, email: user.email, status: "ACTIVE", roles: [], eventRoles: [{ eventId: event.id, roleCode: "FINANCIAL_CONTROLLER" }] });
    }
    const finance = actors[0]!;
    storageProvider.saveFile = async () => {
      const path = `synthetic-${randomUUID()}`; stored.add(path);
      return { storedName: path, relativePath: path, absolutePath: path };
    };
    storageProvider.removeFile = async (path) => { stored.delete(path); };
    const incomeInput = { eventId: event.id, sourceType: "DONATION" as const, sourceLabel: "Synthetic donation", amount: "10.00", referenceText: "Synthetic reference" };
    const expenseInput = { eventId: event.id, amount: "10.00", category: "Synthetic expense", description: "Synthetic paid record" };
    const headers = (actorIndex = 0, key?: string) => ({ Authorization: `Bearer ${tokens[actorIndex]}`, ...(key === undefined ? {} : { "Idempotency-Key": key }) });
    const json = (body: unknown, key?: string, actorIndex = 0) => fetch(`${base}/payments/income-records`, { method: "POST", headers: { ...headers(actorIndex, key), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const form = () => {
      const body = new FormData();
      for (const [name, value] of Object.entries(expenseInput)) body.set(name, value);
      body.set("supportingDocument", new Blob([evidence().buffer], { type: "application/pdf" }), "synthetic.pdf");
      return body;
    };
    for (const key of [undefined, "bad", "x".repeat(4096), `${run},${run}`, run.replace(/-4/, "-1")]) {
      check((await json(incomeInput, key)).status === 400, "Missing/invalid financial key accepted");
    }
    check((await fetch(`${base}/requests/expense-records`, { method: "POST", headers: { ...headers(1), "Content-Type": "multipart/form-data; boundary=missing" }, body: "malformed" })).status === 400, "Missing key reached multipart parsing");
    check(stored.size === 0, "Invalid keys persisted files");
    check((await json({ ...incomeInput, amount: "-1.00" }, randomUUID())).status === 400, "Invalid financial input accepted");

    const incomeKey = randomUUID();
    const first = await json(incomeInput, incomeKey); const firstBody = await first.json() as { incomeRecord: { id: string } };
    const second = await json(incomeInput, incomeKey.toUpperCase()); const secondBody = await second.json() as { incomeRecord: { id: string } };
    check(first.status === 201 && second.status === 201, "Same-key HTTP retry did not succeed");
    check(firstBody.incomeRecord.id === secondBody.incomeRecord.id, "Same key created another income record");
    check(await prisma.incomeRecord.count({ where: { eventId: event.id } }) === 1, "Income duplicated");
    check(await prisma.auditLog.count({ where: { entityId: firstBody.incomeRecord.id, action: "income.create" } }) === 1, "Replay repeated financial audit");
    check((await json({ ...incomeInput, amount: "11.00" }, incomeKey)).status === 409, "Changed amount reused key");
    check((await json({ ...incomeInput, eventId: foreignEvent.id }, incomeKey)).status === 403, "Replay bypassed event scope");

    const expenseKey = randomUUID();
    const expenseOne = await fetch(`${base}/requests/expense-records`, { method: "POST", headers: headers(1, expenseKey), body: form() }); const expenseOneBody = await expenseOne.json() as { expenseRecord: { id: string } };
    const filesAfterCreate = stored.size;
    const expenseTwo = await fetch(`${base}/requests/expense-records`, { method: "POST", headers: headers(1, expenseKey), body: form() }); const expenseTwoBody = await expenseTwo.json() as { expenseRecord: { id: string } };
    check(expenseOne.status === 201 && expenseTwo.status === 201, "Expense HTTP retry failed");
    check(expenseOneBody.expenseRecord.id === expenseTwoBody.expenseRecord.id, "Standalone expense duplicated");
    check(stored.size === filesAfterCreate, "Replay left redundant files");
    check(await prisma.expenseRecord.count({ where: { eventId: event.id } }) === 1, "Expense duplicated in database");
    check(await prisma.auditLog.count({ where: { entityId: expenseOneBody.expenseRecord.id, action: "expense_records.create" } }) === 1, "Expense replay repeated audit");
    const healthySave = storageProvider.saveFile, healthyScan = uploadScanner.scan;
    storageProvider.saveFile = async () => { throw new Error("Synthetic storage outage"); };
    uploadScanner.scan = async () => { throw new Error("Synthetic scanner outage"); };
    try {
      const completedRetry = await fetch(`${base}/requests/expense-records`, { method: "POST", headers: headers(1, expenseKey), body: form() });
      check(completedRetry.status === 201, "Completed financial replay depended on scanner/storage availability");
      const completedBody = await completedRetry.json() as { expenseRecord: { id: string } };
      check(completedBody.expenseRecord.id === expenseOneBody.expenseRecord.id, "Outage retry returned another financial record");
    } finally { storageProvider.saveFile = healthySave; uploadScanner.scan = healthyScan; }

    for (const [operation, input, action] of [
      [FinancialOperation.INCOME_CREATE, incomeInput, (key: string, files: Express.Multer.File[]) => paymentsService.createIncomeRecord(finance, incomeInput, files, key)],
      [FinancialOperation.EXPENSE_CREATE, expenseInput, (key: string, files: Express.Multer.File[]) => requestsService.createExpenseRecord(finance, expenseInput, files, key)],
    ] as const) {
      const key = randomUUID(), before = stored.size;
      const results = await Promise.all(Array.from({ length: 8 }, () => action(key, [evidence()])));
      check(new Set(results.map((result) => result.id)).size === 1, `${operation}: concurrent retries created duplicates`);
      check(stored.size === before + 1, `${operation}: concurrency leaked redundant uploads`);
      check(await prisma.financialIdempotency.count({ where: { actorId: finance.id, operation, key } }) === 1, `${operation}: duplicate markers`);
      await assert.rejects(() => action(key, [evidence("%PDF-1.4\nchanged\n%%EOF\n")]), (error: { statusCode?: number }) => error.statusCode === 409); checks++;
      await assert.rejects(() => action(key, [evidence(undefined, "renamed.pdf")]), (error: { statusCode?: number }) => error.statusCode === 409); checks++;
      check(stored.size === before + 1, `${operation}: changed-file rejection leaked uploads`);
      const auditCount = await prisma.auditLog.count({ where: { actorId: finance.id } });
      const records = await prisma.financialIdempotency.count({ where: { actorId: finance.id } });
      const ledgerCount = operation === FinancialOperation.INCOME_CREATE
        ? await prisma.incomeRecord.count({ where: { eventId: event.id } })
        : await prisma.expenseRecord.count({ where: { eventId: event.id } });
      const rollbackKey = randomUUID();
      auditService.record = async () => { throw new Error("Synthetic audit failure"); };
      try { await assert.rejects(() => action(rollbackKey, [evidence()])); checks++; }
      finally { auditService.record = recordAudit; }
      check(await prisma.financialIdempotency.count({ where: { actorId: finance.id } }) === records, `${operation}: failed audit consumed key`);
      check(await prisma.auditLog.count({ where: { actorId: finance.id } }) === auditCount, `${operation}: failed audit wrote partial history`);
      check((operation === FinancialOperation.INCOME_CREATE
        ? await prisma.incomeRecord.count({ where: { eventId: event.id } })
        : await prisma.expenseRecord.count({ where: { eventId: event.id } })) === ledgerCount, `${operation}: audit rollback left a money record`);
      check(stored.size === before + 1, `${operation}: rollback leaked uploads`);
      const recovered = await action(rollbackKey, [evidence()]);
      check(Boolean(recovered.id), `${operation}: rollback key could not be retried`);
      const ownMarker = await prisma.financialIdempotency.findUniqueOrThrow({ where: { actorId_operation_key: { actorId: finance.id, operation, key } } });
      check(/^[0-9a-f]{64}$/.test(ownMarker.inputHash) && !JSON.stringify(ownMarker).includes("Synthetic reference"), `${operation}: raw payload persisted`);
      // Direct fixture callers use normalized typed input; HTTP schema validation
      // is exercised separately above. Preserve both authorized create paths.
      check(input.eventId === event.id, "Fixture ownership changed");
    }
    const distinct = await paymentsService.createIncomeRecord(finance, incomeInput, [], randomUUID());
    check(distinct.id !== firstBody.incomeRecord.id, "Distinct legitimate contribution incorrectly deduplicated");
    const otherActor = await paymentsService.createIncomeRecord(actors[1]!, incomeInput, [], incomeKey);
    check(otherActor.id !== firstBody.incomeRecord.id, "Another actor inherited retry result");
    const linked = await prisma.expenseRequest.create({ data: { eventId: event.id, amount: "10.00", category: "Synthetic", purpose: "Synthetic approved request", state: "APPROVED" } });
    const linkedInput = { ...expenseInput, expenseRequestId: linked.id };
    const linkedRecord = await requestsService.createExpenseRecord(finance, linkedInput, [], incomeKey);
    check((await requestsService.createExpenseRecord(finance, linkedInput, [], incomeKey)).id === linkedRecord.id, "Linked request replay failed");
    check(linkedRecord.id !== firstBody.incomeRecord.id, "Operation keys are not separated");
    await paymentsService.voidIncomeRecord(finance, firstBody.incomeRecord.id, { reason: "Synthetic void" });
    check((await paymentsService.createIncomeRecord(finance, incomeInput, [], incomeKey)).state === "REJECTED", "Retry resurrected original state");

    let uniqueAttempts = 0;
    await financialTransaction(finance, async () => {
      uniqueAttempts++;
      if (uniqueAttempts === 1) throw new Prisma.PrismaClientKnownRequestError("Synthetic marker collision", { code: "P2002", clientVersion: Prisma.prismaVersion.client, meta: { target: ["actorId", "operation", "key"] } });
    });
    check(uniqueAttempts === 2, "Exact marker collision was not retried on a fresh transaction");
    let unrelatedAttempts = 0;
    await assert.rejects(() => financialTransaction(finance, async () => {
      unrelatedAttempts++;
      throw new Prisma.PrismaClientKnownRequestError("Synthetic unrelated collision", { code: "P2002", clientVersion: Prisma.prismaVersion.client, meta: { target: ["expenseRequestId"] } });
    })); checks++;
    check(unrelatedAttempts === 1, "Unrelated unique failure was retried");
    check(financialRequestKey(incomeKey.toUpperCase()) === incomeKey, "Key canonicalization failed");

    let revokeOnce = true;
    paymentsService.assertIncomeRecordUploadAccess = async (...args) => {
      await preflight(...args);
      if (revokeOnce) { revokeOnce = false; await prisma.refreshToken.update({ where: { id: sessionIds[0]! }, data: { revokedAt: new Date() } }); }
    };
    check((await json(incomeInput, incomeKey)).status === 403, "Replay ignored session revocation after preflight");
    paymentsService.assertIncomeRecordUploadAccess = preflight;
    await prisma.eventTeamMember.updateMany({ where: { userId: finance.id }, data: { revokedAt: new Date() } });
    await assert.rejects(() => paymentsService.createIncomeRecord(finance, incomeInput, [], incomeKey), (error: { statusCode?: number }) => error.statusCode === 403); checks++;
    await assert.rejects(() => requestsService.createExpenseRecord(finance, linkedInput, [], incomeKey), (error: { statusCode?: number }) => error.statusCode === 403); checks++;
    console.log(`Financial idempotency: ${checks} local HTTP/concurrency/negative/rollback checks passed.`);
  } finally {
    auditService.record = recordAudit; paymentsService.assertIncomeRecordUploadAccess = preflight;
    storageProvider.saveFile = save; storageProvider.removeFile = remove;
    if (users.length) await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    if (events.length) await prisma.event.deleteMany({ where: { id: { in: events } } });
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
}
void main().catch(() => { console.error("Financial idempotency verification failed; private diagnostics suppressed."); process.exitCode = 1; });
