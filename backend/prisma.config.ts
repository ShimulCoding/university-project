import { defineConfig } from "prisma/config";

import { loadProjectEnv } from "./src/config/load-env";

loadProjectEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
