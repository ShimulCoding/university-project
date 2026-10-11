import { prisma } from "../src/config/prisma";
import { governanceTransaction } from "../src/utils/governance-transaction";
import { localSeedConfig } from "../src/utils/local-seed-policy";
import { seedLocalDataset, seedPasswordHashes } from "../src/utils/local-seed";

async function main() {
  const config = localSeedConfig(process.env); // Validate before database writes.
  const hashes = await seedPasswordHashes(config);
  const result = await governanceTransaction((tx) => seedLocalDataset(tx, config, hashes));
  console.log(`Local seed completed. Admin configured: ${result.adminConfigured}; new demo created: ${result.demoCreated}. Existing account credentials and assignments are preserved.`);
}
void main().catch(() => {
  console.error("Local seed refused or failed. Check local mode, private seed inputs and dataset prerequisites; private details suppressed.");
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
