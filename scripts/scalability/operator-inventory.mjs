import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const digest = (content) => createHash('sha256').update(content).digest('hex');

// Reads source only. Never executes scripts, loads .env, or walks private/generated trees.
export async function operatorInventory(root, evidenceCommit) {
  const candidates = new Set();
  const collect = async (directory, recursive = true) => {
    let entries;
    try { entries = await readdir(join(root, directory), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'uploads', 'public', 'src', 'secrets'].includes(entry.name)) continue;
      const file = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Operator source symlink requires review: ${file}`);
      if (entry.isDirectory() && recursive) await collect(file);
      else if (entry.isFile() && (/\.(?:[cm]?js|tsx?|ps1|py|sh|sql|ya?ml|json|toml|conf|ini)$/.test(entry.name) || /^Dockerfile(?:\..*)?$/i.test(entry.name))) candidates.add(file);
      else if (entry.isFile() && !/\.(?:md|txt|css|map|tsbuildinfo|log|pid|lock|png|jpe?g|svg|woff2?|ttf|pdf)$/.test(entry.name)) {
        throw new Error(`Uncovered operator/config format requires review: ${file}`);
      }
    }
  };
  const sourceDiscovery = ['backend/scripts', 'frontend/scripts', 'scripts', 'infra', 'backend/prisma/migrations', '.github/workflows'];
  for (const directory of sourceDiscovery) await collect(directory);
  for (const directory of ['', 'backend', 'frontend']) await collect(directory, false);
  try { await readFile(join(root, 'backend/prisma/seed.ts'), 'utf8'); candidates.add('backend/prisma/seed.ts'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const entries = [];
  for (const file of [...candidates].sort()) {
    const content = await readFile(join(root, file), 'utf8');
    const kind = file.includes('/migrations/') ? 'database migration; approval required on real data'
      : /(?:^|\/)verify|^scripts\/scalability\//.test(file) ? 'verification/profiling tool'
      : /seed/.test(file) ? 'operator data creation/seed'
      : /authorize-mfa/.test(file) ? 'supervised operator MFA grant'
      : file.startsWith('.github/workflows/') ? 'CI workflow'
      : /config|\.config\./.test(file) ? 'build/runtime configuration'
      : 'maintenance/operator script; inspect before execution';
    const effects = [], guards = [];
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      const source = `${file}:${index + 1}`;
      if (/\b(?:prisma|db|tx)\b|\$queryRaw|\$executeRaw|CREATE\s+(?:TABLE|ROLE|INDEX)|ALTER\s+TABLE/i.test(line)) effects.push({ kind: 'database candidate', source });
      if (/\b(?:writeFile|unlink|rm|rename|mkdir|createWriteStream|writeFileSync)\b/.test(line)) effects.push({ kind: 'filesystem write candidate', source });
      if (/\b(?:fetch|https?\.request|urlopen|sendMail|createTestAccount)\s*\(/.test(line)) effects.push({ kind: 'network candidate', source });
      if (/console\.(?:log|error)|print\s*\(/.test(line)) effects.push({ kind: 'output candidate; inspect PII/capabilities', source });
      if (/NODE_ENV|DATABASE_URL|localhost|127\.0\.0\.1|confirm-supervised|ENABLE_LOCAL|fixture|\.cache/.test(line)) guards.push(source);
    }
    entries.push({ path: file, source: `${file}:1`, kind, lines: content.split(/\r?\n/).length, sha256: digest(content), effects, guardCandidates: guards,
      trustBoundary: 'Explicit operator/CI execution; lexical candidates do not prove guard enforcement or safe execution. Never executed by this generator.',
      change: 'Mapped; no runtime change', before: 'N/A: source coverage only', after: 'N/A: no application change', evidenceCommit });
  }
  const npmScripts = [];
  for (const manifest of ['package.json', 'backend/package.json', 'frontend/package.json']) {
    let content;
    try { content = await readFile(join(root, manifest), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const parsed = JSON.parse(content);
    for (const [name, command] of Object.entries(parsed.scripts ?? {})) {
      if (typeof command !== 'string') throw new Error(`Invalid npm command in ${manifest}`);
      const line = content.split(/\r?\n/).findIndex((value) => value.includes(JSON.stringify(name)) && value.includes(':')) + 1;
      npmScripts.push({ id: `${manifest}#${name}`, command, source: `${manifest}:${line}`, manifestHash: digest(content),
        trustBoundary: 'Operator/build/test command; trace imported and external effects before execution.' });
    }
  }
  return { entries, npmScripts, sourceDiscovery };
}
