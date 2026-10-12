import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/prisma";
import { rolesService } from "./modules/roles/services/roles.service";
import { authRepository } from "./modules/auth/repositories/auth.repository";
import { logInternalFailure } from "./utils/security-logging";
import { createGracefulShutdown, exitFailedShutdown, RequestWork } from "./utils/request-work";

async function startServer() {
  await connectDatabase();
  await rolesService.ensureRoleCatalog();
  const work = new RequestWork();
  const pruneTokens = () => {
    if (work.isReady) void work.track(() => authRepository.pruneStaleTokens()).catch(() => logInternalFailure("token.cleanup.failure"));
  };
  pruneTokens();
  const tokenCleanup = setInterval(pruneTokens, 60 * 60 * 1000);
  tokenCleanup.unref();

  const app = createApp(work);
  const server = app.listen({ port: env.PORT, ...(env.ENABLE_LOCAL_ADMIN_BOOTSTRAP === "true" ? { host: "127.0.0.1" } : {}) }, () => {
    console.log(`Backend listening on http://localhost:${env.PORT}`);
  });

  const drain = createGracefulShutdown({ server, work, disconnect: disconnectDatabase, stopMaintenance: () => clearInterval(tokenCleanup) });
  let shutdownStarted = false;
  const shutdown = () => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    void drain().then((result) => {
      if (result.status === "failed") exitFailedShutdown(result);
      else process.exitCode = 0;
    });
  };

  process.on("SIGINT", () => {
    shutdown();
  });

  process.on("SIGTERM", () => {
    shutdown();
  });
}

void startServer().catch(async () => {
  logInternalFailure("startup.failure");
  await disconnectDatabase();
  process.exit(1);
});
