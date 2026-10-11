import assert from "node:assert/strict";
import { format } from "node:util";
import nodemailer from "nodemailer";
import { createApp } from "../src/app";
import { errorHandler } from "../src/middlewares/error-handler";
import { mailer } from "../src/config/mailer";
import type { Request, Response } from "express";

async function main() {
  const marker = "SYNTHETIC_SECURITY_SECRET_81b725";
  let output = "";
  const stdout = process.stdout.write;
  const originalError = console.error;
  const originalLog = console.log;
  const account = nodemailer.createTestAccount;
  const transport = nodemailer.createTransport;
  const preview = nodemailer.getTestMessageUrl;
  const smtpHost = process.env.SMTP_HOST;
  const server = createApp().listen(0, "127.0.0.1");
  try {
    process.stdout.write = ((chunk: unknown) => { output += String(chunk); return true; }) as typeof stdout;
    console.error = (...args) => { output += format(...args); };
    console.log = (...args) => { output += format(...args); };
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${base}/health?token=${marker}`);
    assert.equal(response.status, 200);
    assert.equal((await fetch(`${base}/${marker}?password=${marker}`)).status, 404);
    let status = 0;
    const res = { locals: {}, headersSent: false, status(code: number) { status = code; return this; }, json(body: unknown) { assert(!JSON.stringify(body).includes(marker)); } };
    errorHandler(new Error(`password=${marker}; DATABASE_URL=postgres://${marker}`), {} as Request, res as Response, () => {});
    assert.equal(status, 500);
    // Isolated fake transport: no mail, credentials, or network traffic leave this process.
    delete process.env.SMTP_HOST;
    nodemailer.createTestAccount = (async () => ({ user: marker, pass: marker })) as typeof account;
    nodemailer.createTransport = (() => ({ sendMail: async () => ({ messageId: "synthetic" }) })) as unknown as typeof transport;
    nodemailer.getTestMessageUrl = (() => `https://example.invalid/${marker}`) as typeof preview;
    await mailer.sendPasswordResetEmail(`${marker}@example.invalid`, `https://example.invalid/reset?token=${marker}`);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert(!output.includes(marker), "Sensitive query, exception, or email capability reached operational logs");
    assert(output.includes("/health") && output.includes("200"), "Safe request diagnostics were lost");
  } finally {
    process.stdout.write = stdout; console.error = originalError; console.log = originalLog;
    nodemailer.createTestAccount = account; nodemailer.createTransport = transport; nodemailer.getTestMessageUrl = preview;
    if (smtpHost === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = smtpHost;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  console.log("Security logging: 7 checks passed (query/path/error/mail redaction and normal responses). ");
}
void main().catch(() => { console.error("Security logging verification failed; sensitive test output suppressed."); process.exitCode = 1; });
