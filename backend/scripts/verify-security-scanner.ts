import assert from "node:assert/strict";
import { createServer, Socket } from "node:net";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { DocumentCategory } from "@prisma/client";
import { scanClamdBuffer } from "../src/utils/clamd-stream";
import { scannerRequired, uploadScanner } from "../src/utils/upload-scanner";
import { storeValidatedUpload, storeValidatedUploads } from "../src/utils/upload-utils";
import { storageProvider } from "../src/storage";

async function main() {
  let checks = 0; let mode = "clean"; let received = Buffer.alloc(0); let connections = 0; let daemonPort = 0;
  const sockets = new Set<Socket>();
  const daemon = createServer((socket) => {
    connections++; sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.on("error", () => {});
    let command = false; let pending = Buffer.alloc(0); const chunks: Buffer[] = [];
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      if (!command) {
        const end = pending.indexOf(0); if (end < 0) return;
        assert.equal(pending.subarray(0, end).toString(), "zINSTREAM"); command = true; pending = pending.subarray(end + 1);
      }
      while (pending.length >= 4) {
        const length = pending.readUInt32BE(); assert(length <= 32 * 1024);
        if (pending.length < length + 4) return;
        const body = pending.subarray(4, length + 4); pending = pending.subarray(length + 4);
        if (length) { chunks.push(body); continue; }
        received = Buffer.concat(chunks);
        const replies: Record<string, string> = { clean: "stream: OK\0", infected: "stream: Synthetic-Detection FOUND\0", error: "stream: limit exceeded ERROR\0", malformed: "stream: NOT OK\0", missingTerminator: "stream: OK", multiple: "stream: OK\0stream: Synthetic-Detection FOUND\0", wrongLabel: "other: OK\0", oversized: "X".repeat(5000), batch: received.includes("synthetic-second-file") ? "stream: Synthetic-Detection FOUND\0" : "stream: OK\0" };
        if (mode === "silent") return;
        if (mode === "trickle") {
          const timer = setInterval(() => socket.write(" "), 30); socket.on("close", () => clearInterval(timer)); return;
        }
        if (mode === "disconnect") { socket.destroy(); return; }
        if (mode === "fragmented") { socket.write("stream:"); setTimeout(() => socket.end(" OK\0"), 10); return; }
        const reply = replies[mode]; assert(typeof reply === "string", "Unknown fixture scanner mode");
        socket.end(reply); return;
      }
    });
  }).listen(0, "127.0.0.1");
  const scan = uploadScanner.scan; const save = storageProvider.saveFile; const remove = storageProvider.removeFile;
  try {
    await new Promise<void>((resolve) => daemon.once("listening", resolve));
    const address = daemon.address(); assert(address && typeof address !== "string");
    daemonPort = address.port;
    const config = { host: "127.0.0.1", port: address.port, timeoutMs: 500 };
    const buffer = Buffer.from("%PDF-1.4\nSynthetic benign fixture\n%%EOF");
    await scanClamdBuffer(buffer, config); checks++;
    assert.deepEqual(received, buffer); checks++;
    mode = "fragmented"; await scanClamdBuffer(Buffer.alloc(1024 * 1024, 65), config); checks++;
    assert.equal(received.length, 1024 * 1024); checks++;
    for (const [testMode, status] of [["infected", 422], ["error", 503], ["malformed", 503], ["missingTerminator", 503], ["multiple", 503], ["wrongLabel", 503], ["oversized", 503], ["silent", 503], ["trickle", 503], ["disconnect", 503]] as const) {
      mode = testMode; const start = Date.now();
      await assert.rejects(() => scanClamdBuffer(buffer, config), (error: { statusCode?: number; message?: string }) => error.statusCode === status && !error.message?.includes("Synthetic-Detection")); checks++;
      assert(Date.now() - start < 2000, "Scanning exceeded its absolute deadline"); checks++;
    }
    const prior = connections;
    await assert.rejects(() => scanClamdBuffer(Buffer.alloc(0), config)); checks++;
    await assert.rejects(() => scanClamdBuffer(Buffer.alloc(8 * 1024 * 1024 + 1), config)); checks++;
    assert.equal(connections, prior); checks++;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(sockets.size, 0, "Failed/timed-out scans leaked sockets"); checks++;
    assert(scannerRequired({ NODE_ENV: "production", UPLOAD_SCAN_REQUIRED: "false" })); checks++;
    assert(!scannerRequired({ NODE_ENV: "test", UPLOAD_SCAN_REQUIRED: "false" })); checks++;

    let saves = 0; const removed: string[] = [];
    storageProvider.saveFile = async () => ({ absolutePath: "synthetic", relativePath: `synthetic-${++saves}`, storedName: `synthetic-${saves}` });
    storageProvider.removeFile = async (file) => { removed.push(file); };
    uploadScanner.scan = (bytes) => scanClamdBuffer(bytes, config);
    const file = (bytes = buffer) => ({ buffer: bytes, size: bytes.length, mimetype: "application/pdf", originalname: "../../synthetic-command.pdf" }) as Express.Multer.File;
    const options = { category: DocumentCategory.SUPPORTING_DOCUMENT, destinationDir: "synthetic", rule: { allowedMimeTypes: ["application/pdf"], maxFileSizeBytes: 8 * 1024 * 1024 } };
    for (const denied of ["infected", "error", "silent"]) {
      mode = denied; await assert.rejects(() => storeValidatedUpload(file(), options)); checks++;
      assert.equal(saves, 0, "Rejected scan reached persistence"); checks++;
    }
    mode = "clean"; await storeValidatedUpload(file(), options); checks++;
    assert.equal(saves, 1); checks++;
    assert.deepEqual(received, buffer, "Client filenames entered the scanner command"); checks++;
    const beforeValidation = connections;
    await assert.rejects(() => storeValidatedUpload(file(Buffer.from("not a PDF")), options)); checks++;
    assert.equal(connections, beforeValidation); checks++;
    mode = "batch";
    await assert.rejects(() => storeValidatedUploads([file(), file(Buffer.from("%PDF-1.4\nsynthetic-second-file"))], options)); checks++;
    assert.deepEqual(removed, ["synthetic-2"], "Batch rejection left its first newly stored file behind"); checks++;
    for (const overrides of [ { NODE_ENV: "production", UPLOAD_SCAN_REQUIRED: "false", CLAMD_HOST: undefined }, { NODE_ENV: "test", UPLOAD_SCAN_REQUIRED: "true", CLAMD_HOST: undefined }, { NODE_ENV: "test", UPLOAD_SCAN_REQUIRED: "true", CLAMD_HOST: "http://127.0.0.1" } ]) {
      const child = spawnSync(process.execPath, [path.join(__dirname, "../dist/config/env.js")], { encoding: "utf8", timeout: 5000, maxBuffer: 8192, env: { ...process.env, ...overrides } });
      assert.notEqual(child.status, 0); checks++;
    }
    const configured = spawnSync(process.execPath, [path.join(__dirname, "../dist/config/env.js")], { encoding: "utf8", timeout: 5000, maxBuffer: 8192, env: { ...process.env, NODE_ENV: "production", UPLOAD_SCAN_REQUIRED: "false", CLAMD_HOST: "127.0.0.1" } });
    assert.equal(configured.status, 0); checks++;
  } finally {
    uploadScanner.scan = scan; storageProvider.saveFile = save; storageProvider.removeFile = remove;
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => daemon.close((error) => error ? reject(error) : resolve()));
  }
  // Refused connection is checked after the owned fake daemon is closed.
  const address = daemon.address(); assert.equal(address, null);
  await assert.rejects(() => scanClamdBuffer(Buffer.from("benign synthetic"), { host: "127.0.0.1", port: daemonPort, timeoutMs: 500 }), (error: { statusCode?: number }) => error.statusCode === 503); checks++;
  console.log(`ClamAV transport/storage: ${checks} bounded negative/cleanup checks passed against a local synthetic daemon; real definitions were not tested.`);
}
void main().catch(() => { console.error("Scanner verification failed; file/daemon details suppressed."); process.exitCode = 1; });
