import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AccountStatus } from "@prisma/client";
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { createUploadAdmission } from "../src/middlewares/upload-guard";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { storageProvider } from "../src/storage";
import { paymentsService } from "../src/modules/payments/services/payments.service";
import { signAccessToken } from "../src/utils/tokens";
import type { AuthenticatedUser } from "../src/types/auth";

async function main() {
  const run = randomUUID(); const userIds: string[] = []; let eventId: string | undefined;
  const save = storageProvider.saveFile; const remove = storageProvider.removeFile;
  const server = createApp().listen(0, "127.0.0.1");
  let checks = 0;
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const accounts = [];
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({ data: { fullName: "Upload security fixture", email: `upload-security-${i}-${run}@example.invalid`, passwordHash: "not-a-login-hash" } });
      userIds.push(user.id); accounts.push(user);
    }
    const event = await prisma.event.create({ data: { title: "Upload security fixture", slug: `upload-security-${run}` } }); eventId = event.id;
    const owner = accounts[0]!; const attacker = accounts[1]!;
    const registration = await prisma.registration.create({ data: { eventId, participantId: owner.id, participantName: "Synthetic owner", studentId: run, email: owner.email, registrationCode: run } });
    const actor: AuthenticatedUser = { id: attacker.id, fullName: attacker.fullName, email: attacker.email, status: AccountStatus.ACTIVE, roles: [], eventRoles: [] };
    let saves = 0;
    storageProvider.saveFile = async () => { saves++; return { absolutePath: "synthetic", relativePath: "synthetic", storedName: "synthetic" }; };
    storageProvider.removeFile = async () => {}; // Mocked files never touch disk.
    const buffer = Buffer.from("%PDF-1.4\n%%EOF\n");
    await assert.rejects(() => paymentsService.submitPaymentProof(actor, registration.id, { externalChannel: "Cash", referenceText: "Synthetic" }, [{ buffer, size: buffer.length, originalname: "proof.pdf", mimetype: "application/pdf" } as Express.Multer.File]), (error: { statusCode?: number }) => error.statusCode === 403); checks++;
    assert.equal(saves, 0, "A forbidden actor reached persistent upload storage"); checks++;
    const session = await prisma.refreshToken.create({ data: { userId: attacker.id, tokenHash: run, expiresAt: new Date(Date.now() + 60000) } });
    const token = signAccessToken(attacker.id, 0, session.id);
    const malformed = { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "multipart/form-data; boundary=synthetic" }, body: "malformed multipart" };
    for (const path of [`/payments/registrations/${registration.id}/proofs`, "/requests/budget-requests", "/requests/expense-requests", "/requests/expense-records"]) {
      assert.equal((await fetch(`${base}${path}`, malformed)).status, 403, "Forbidden multipart should be denied before parsing"); checks++;
    }
    const admission = createUploadAdmission(2);
    const response = () => Object.assign(new EventEmitter(), { headers: {} as Record<string, string>, statusCode: 200,
      setHeader(key: string, value: string) { this.headers[key] = value; },
      status(code: number) { this.statusCode = code; return this; }, json() { return this; },
    });
    const first = response(), second = response(), denied = response(); let admitted = 0;
    const enter = (res: ReturnType<typeof response>) => admission({} as Request, res as unknown as Response, () => { admitted++; });
    enter(first); enter(second); enter(denied);
    assert.equal(admitted, 2); assert.equal(denied.statusCode, 503); assert.equal(denied.headers["Retry-After"], "5"); checks += 3;
    first.emit("close"); first.emit("finish"); // A cancelled request releases its slot only once.
    enter(response()); enter(denied);
    assert.equal(admitted, 3, "Cancellation leaked or double-released an upload slot"); checks++;
    second.emit("finish"); enter(response()); assert.equal(admitted, 4); checks++;
  } finally {
    storageProvider.saveFile = save; storageProvider.removeFile = remove;
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
  console.log(`Upload security: ${checks} checks passed.`);
}
void main().catch((error: unknown) => { console.error(error instanceof assert.AssertionError ? error.message : "Upload security verification failed; details suppressed."); process.exitCode = 1; });
