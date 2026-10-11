import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Socket } from "node:net";
import { createServer as createTlsServer, createSecureContext, TLSSocket } from "node:tls";
import nodemailer from "nodemailer";
import { configuredSmtpOptions, etherealSmtpOptions } from "../src/utils/smtp-security";

async function main() {
  let checks = 0;
  const check = (condition: unknown, message: string) => { assert(condition, message); checks++; };
  const configuration = { SMTP_HOST: "127.0.0.1", SMTP_FROM: "Fixture <fixture@example.invalid>", SMTP_USER: "synthetic-user", SMTP_PASS: "synthetic-password" };
  const options = configuredSmtpOptions(configuration);
  for (const policy of [options, etherealSmtpOptions({ user: "synthetic", pass: "synthetic" })]) {
    check(policy.requireTLS === true && policy.opportunisticTLS === false && policy.ignoreTLS === false, "TLS downgrade permitted");
    check(policy.tls?.rejectUnauthorized === true && policy.tls.minVersion === "TLSv1.2", "TLS identity/version not required");
    check(policy.disableFileAccess === true && policy.disableUrlAccess === true, "Remote/local attachment sources permitted");
    check(policy.logger === false && policy.debug === false, "SMTP content logging enabled");
  }
  check(configuredSmtpOptions({ ...configuration, SMTP_PORT: "465" }).secure === true, "Implicit TLS default missing");
  check(configuredSmtpOptions({ SMTP_HOST: "localhost", SMTP_FROM: "fixture@example.invalid" }).auth === undefined, "Relay acquired fake credentials");
  for (const change of [
    { SMTP_HOST: "https://smtp.example.invalid" }, { SMTP_HOST: "bad..host" }, { SMTP_HOST: "" },
    { SMTP_PORT: "abc" }, { SMTP_PORT: "0" }, { SMTP_PORT: "65536" }, { SMTP_SECURE: "yes" },
    { SMTP_FROM: "bad" }, { SMTP_FROM: "fixture@example.invalid\r\nBcc: somebody@example.invalid" },
    { SMTP_USER: "" }, { SMTP_PASS: "" },
  ]) {
    assert.throws(() => configuredSmtpOptions({ ...configuration, ...change }), (error: Error) => error.message === "Password recovery SMTP configuration is invalid."); checks++;
  }
  const directory = await fs.mkdtemp(path.join(tmpdir(), "university-smtp-fixture-"));
  const keyFile = path.join(directory, "fixture-key.pem"), certificateFile = path.join(directory, "fixture-cert.pem");
  const openssl = process.env.VERIFY_OPENSSL_PATH ?? "C:/Program Files/Git/usr/bin/openssl.exe";
  const generated = spawnSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyFile, "-out", certificateFile, "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { windowsHide: true, stdio: "ignore", timeout: 15000 });
  try {
    assert.equal(generated.status, 0, "Synthetic TLS certificate generation failed; install OpenSSL or set VERIFY_OPENSSL_PATH");
    const key = await fs.readFile(keyFile), cert = await fs.readFile(certificateFile);
    const secureContext = createSecureContext({ key, cert, minVersion: "TLSv1.2" });
    for (const mode of ["absent", "failed", "invalid-certificate", "implicit", "starttls"] as const) {
      const sockets = new Set<Socket>();
      const commands: { name: string; encrypted: boolean }[] = [];
      let delivered = false, credentialsEncrypted = false;
      const handle = (socket: Socket, encrypted: boolean, greet: boolean) => {
        sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.on("error", () => {});
        socket.setTimeout(3000, () => socket.destroy());
        if (greet) socket.write("220 local-fixture ESMTP\r\n");
        let pending = "", data = false, message = "";
        const read = (chunk: Buffer) => {
          pending += chunk.toString(); assert(pending.length < 65536, "Fixture input unbounded");
          while (pending.includes("\r\n")) {
            const end = pending.indexOf("\r\n"), line = pending.slice(0, end); pending = pending.slice(end + 2);
            if (data) {
              if (line === ".") { delivered = encrypted && message.includes("synthetic-reset-value-only"); data = false; socket.write("250 accepted\r\n"); }
              else message += line;
              continue;
            }
            const name = line.split(" ")[0]!; commands.push({ name, encrypted });
            if (name === "EHLO") socket.write(`250-local-fixture\r\n${!encrypted && mode !== "absent" ? "250-STARTTLS\r\n" : ""}250 AUTH PLAIN\r\n`);
            else if (name === "STARTTLS") {
              if (mode !== "starttls") socket.write("500 TLS unavailable\r\n");
              else {
                socket.write("220 upgrade\r\n"); socket.removeListener("data", read);
                handle(new TLSSocket(socket, { isServer: true, secureContext }), true, false);
                return;
              }
            } else if (name === "AUTH") { credentialsEncrypted = encrypted; socket.write("235 fixture auth accepted\r\n"); }
            else if (name === "DATA") { data = true; socket.write("354 send\r\n"); }
            else if (name === "QUIT") socket.end("221 bye\r\n");
            else socket.write("250 OK\r\n");
          }
        };
        socket.on("data", read);
      };
      const daemon = mode === "implicit" || mode === "invalid-certificate"
        ? createTlsServer({ key, cert, minVersion: "TLSv1.2" }, (socket) => handle(socket, true, true))
        : createServer((socket) => handle(socket, false, true));
      daemon.on("tlsClientError", () => {});
      daemon.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => daemon.once("listening", resolve));
      const address = daemon.address(); assert(address && typeof address !== "string");
      const policy = configuredSmtpOptions({ ...configuration, SMTP_PORT: String(address.port), SMTP_SECURE: ["implicit", "invalid-certificate"].includes(mode) ? "true" : "false" });
      const transport = nodemailer.createTransport({ ...policy, tls: { ...policy.tls, servername: "localhost", ...(mode === "invalid-certificate" ? {} : { ca: cert }) } });
      try {
        const delivery = () => transport.sendMail({ from: configuration.SMTP_FROM, to: "fixture@example.invalid", text: "https://example.invalid/reset?token=synthetic-reset-value-only" });
        if (mode === "absent") {
          // Exercise the actual application wiring, not only its option builder.
          const names = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_FROM", "SMTP_USER", "SMTP_PASS"] as const;
          const previous = names.map((name) => [name, process.env[name]] as const);
          try {
            Object.assign(process.env, configuration, { SMTP_PORT: String(address.port), SMTP_SECURE: "false" });
            const { mailer } = await import("../src/config/mailer");
            await assert.rejects(() => mailer.sendPasswordResetEmail("fixture@example.invalid", "https://example.invalid/reset?token=synthetic-reset-value-only")); checks++;
            check(!commands.some((command) => ["AUTH", "MAIL", "RCPT", "DATA"].includes(command.name)), "Application mailer bypassed required TLS");
          } finally {
            for (const [name, value] of previous) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
          }
        }
        if (["implicit", "starttls"].includes(mode)) {
          await delivery();
          check(delivered, `${mode}: trusted encrypted message did not arrive`);
          check(credentialsEncrypted, `${mode}: authentication was not encrypted`);
          check(commands.filter((command) => ["AUTH", "MAIL", "RCPT", "DATA"].includes(command.name)).every((command) => command.encrypted), `${mode}: private SMTP command preceded TLS`);
        } else {
          await assert.rejects(delivery); checks++;
          check(!delivered && !commands.some((command) => ["AUTH", "MAIL", "RCPT", "DATA"].includes(command.name)), `${mode}: insecure server received credentials/message`);
        }
      } finally {
        transport.close(); for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => daemon.close(() => resolve()));
      }
    }
    console.log(`Recovery mail TLS: ${checks} local policy/downgrade/certificate/encrypted-delivery checks passed.`);
  } finally {
    // Only this run's named temporary fixture files are removed, never a tree.
    await fs.unlink(keyFile).catch(() => {}); await fs.unlink(certificateFile).catch(() => {}); await fs.rmdir(directory);
  }
}
void main().catch(() => { console.error("Recovery mail TLS verification failed; fixture diagnostics suppressed."); process.exitCode = 1; });
