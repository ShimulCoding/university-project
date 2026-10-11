import assert from "node:assert/strict";
import { authService } from "../src/modules/auth/services/auth.service";
import { usersRepository } from "../src/modules/users/repositories/users.repository";
import { prisma } from "../src/config/prisma";
import type { RegisterInput } from "../src/modules/auth/types/auth.types";
import { permitsLocalBootstrap } from "../src/middlewares/local-bootstrap";
import { createApp } from "../src/app";

async function main() {
  const count = usersRepository.countUsers;
  let inspected = false;
  try {
    usersRepository.countUsers = async () => { inspected = true; throw new Error("Synthetic database-access trap"); };
    await assert.rejects(() => authService.bootstrapAdmin({ fullName: "Synthetic bootstrap", email: "bootstrap@example.invalid", password: "Synthetic-password!" } as RegisterInput), (error: { statusCode?: number }) => error.statusCode === 404);
    assert(!inspected, "Disabled bootstrap inspected the database");
    let checks = 2;
    const allowed = { enabled: true, production: false, remoteAddress: "127.0.0.1" };
    for (const remoteAddress of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) { assert(permitsLocalBootstrap({ ...allowed, remoteAddress })); checks++; }
    for (const input of [{ ...allowed, enabled: false }, { ...allowed, production: true }, { ...allowed, remoteAddress: "203.0.113.7" }, { ...allowed, remoteAddress: undefined }, { ...allowed, browserOrigin: "http://localhost:3000" }, { ...allowed, forwarded: "for=127.0.0.1" }, { ...allowed, forwardedFor: "127.0.0.1" }, { ...allowed, realIp: "127.0.0.1" }]) { assert(!permitsLocalBootstrap(input)); checks++; }
    const server = createApp().listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address = server.address(); assert(address && typeof address !== "string");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/bootstrap-admin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      assert.equal(response.status, 404); checks++;
      assert(!inspected); checks++;
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
    console.log(`Local bootstrap security: ${checks} checks passed.`);
  } finally { usersRepository.countUsers = count; await prisma.$disconnect(); }
}
void main().catch(() => { console.error("Local bootstrap verification failed. Private details suppressed."); process.exitCode = 1; });
