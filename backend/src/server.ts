import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/prisma";
import { rolesService } from "./modules/roles/services/roles.service";

async function startServer() {
  await connectDatabase();
  await rolesService.ensureRoleCatalog();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Backend listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);

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

void startServer().catch(async (error) => {
  console.error("Failed to start backend server.", error);
  await disconnectDatabase();
  process.exit(1);
});
