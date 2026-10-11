import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/prisma";
import { rolesService } from "./modules/roles/services/roles.service";
import { authRepository } from "./modules/auth/repositories/auth.repository";
import { logInternalFailure } from "./utils/security-logging";

async function startServer() {
  await connectDatabase();
  await rolesService.ensureRoleCatalog();
  void authRepository.pruneStaleTokens();
  const tokenCleanup = setInterval(() => void authRepository.pruneStaleTokens(), 60 * 60 * 1000);
  tokenCleanup.unref();

  const app = createApp();
  const server = app.listen({ port: env.PORT, ...(env.ENABLE_LOCAL_ADMIN_BOOTSTRAP === "true" ? { host: "127.0.0.1" } : {}) }, () => {
    console.log(`Backend listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    clearInterval(tokenCleanup);

    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void startServer().catch(async () => {
  logInternalFailure("startup.failure");
  await disconnectDatabase();
  process.exit(1);
});
