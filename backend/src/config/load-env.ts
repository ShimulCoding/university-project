import { existsSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

let loaded = false;

export function loadProjectEnv() {
  if (loaded) {
    return;
  }

  const envPath = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "backend", ".env"),
  ].find((candidate) => existsSync(candidate));

  if (envPath) {
    dotenv.config({ path: envPath, override: true });
  } else {
    dotenv.config();
  }

  loaded = true;
}
