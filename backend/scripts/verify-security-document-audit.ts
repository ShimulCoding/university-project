import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { fixturePrisma, verifyFixtureDatabase, disconnectFixtureDatabase, fixtureFailureDiagnostics } from "./helpers/fixture-database";
import { documentDirectories } from "../src/config/uploads";
import { storageProvider } from "../src/storage";
import { hashPassword } from "../src/utils/password";
import { authService } from "../src/modules/auth/services/auth.service";
import { auditService } from "../src/modules/audit/services/audit.service";

const run = randomUUID(); const users: string[] = []; let complaintId: string | undefined; let relativePath: string | undefined; let step = "setup";
async function main() {
  await verifyFixtureDatabase();
  const server = createApp().listen(0, "127.0.0.1");
  const record = auditService.record;
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const password = `Synthetic-${run}!`;
    const user = await prisma.user.create({ data: { fullName: "Document audit fixture", email: `document-audit-${run}@example.invalid`, studentId: `D${run.slice(0, 20)}`, passwordHash: await hashPassword(password) } }); users.push(user.id);
    const complaint = await prisma.complaint.create({ data: { submittedById: user.id, subject: "Isolated audit fixture", description: "Synthetic data" } }); complaintId = complaint.id;
    const content = Buffer.from("%PDF-1.4\n% Synthetic audit fixture\n%%EOF\n");
    const file = await storageProvider.saveFile({ buffer: content, destinationDir: documentDirectories.COMPLAINT_EVIDENCE, originalName: "document.pdf" }); relativePath = file.relativePath;
    const document = await prisma.supportingDocument.create({ data: { category: "COMPLAINT_EVIDENCE", originalName: "fixture.pdf", mimeType: "application/pdf", storedName: file.storedName, relativePath, sizeBytes: BigInt(content.length), uploadedById: user.id, complaintId } });
    const session = await authService.login({ studentId: user.studentId!, password }); assert("accessToken" in session);
    const response = await fetch(`${base}/documents/${document.id}/open`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
    step = "authorized private evidence access must be recorded";
    assert.equal(await prisma.auditLog.count({ where: { actorId: user.id, entityId: document.id, action: "documents.access_authorized" } }), 1);
    let checks = 3;
    function check(value: unknown, label: string) { step = label; assert(value, label); checks++; }
    check(response.headers.get("cache-control") === "private, no-store", "Evidence cannot enter a shared cache");
    const log = await prisma.auditLog.findFirstOrThrow({ where: { actorId: user.id, entityId: document.id } });
    check(log.route === "/:documentId/open" && log.context && !JSON.stringify(log.context).includes(document.originalName), "Audit records a template/category without evidence content or filename");
    const outsider = await prisma.user.create({ data: { fullName: "Document outsider fixture", email: `document-outsider-${run}@example.invalid`, studentId: `O${run.slice(0, 20)}`, passwordHash: user.passwordHash } }); users.push(outsider.id);
    const otherSession = await authService.login({ studentId: outsider.studentId!, password }); assert("accessToken" in otherSession);
    async function get(token: string | undefined, expected: number, id = document.id) {
      const result = await fetch(`${base}/documents/${id}/open`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      check(result.status === expected, `Protected document expected HTTP ${expected}`); return result;
    }
    await get(undefined, 401);
    await get(otherSession.accessToken, 403);
    check(await prisma.auditLog.count({ where: { actorId: outsider.id, action: "documents.access_authorized" } }) === 0, "IDOR denial cannot claim authorized access");
    await get(session.accessToken, 404, `${document.id}missing`);
    auditService.record = async () => { throw new Error("Synthetic document audit failure"); };
    const denied = await get(session.accessToken, 500);
    check(!(await denied.text()).includes(content.toString()), "Audit failure sends no private file bytes");
    auditService.record = record;
    await prisma.supportingDocument.update({ where: { id: document.id }, data: { relativePath: `../synthetic-never-existent-${run}.pdf` } });
    await get(session.accessToken, 500);
    await prisma.supportingDocument.update({ where: { id: document.id }, data: { relativePath } });
    await storageProvider.removeFile(relativePath); relativePath = undefined;
    await get(session.accessToken, 404);
    check(await prisma.auditLog.count({ where: { entityId: document.id, action: "documents.access_authorized" } }) === 1, "Failed, forbidden and missing files do not create success records");
    console.log(`Protected document audit: ${checks} checks passed.`);
  } finally {
    auditService.record = record;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fixturePrisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    if (complaintId) await fixturePrisma.complaint.delete({ where: { id: complaintId } });
    await fixturePrisma.user.deleteMany({ where: { id: { in: users } } });
    if (relativePath) await storageProvider.removeFile(relativePath);
    await prisma.$disconnect(); await disconnectFixtureDatabase();
  }
}
void main().catch((error: unknown) => { console.error(JSON.stringify(fixtureFailureDiagnostics(error))); process.exitCode = 1; });
