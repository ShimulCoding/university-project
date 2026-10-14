import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ROOT, buildInventory, extractPages, extractRoutes, extractSchema, pagePath, parseSource, renderMarkdown, writeOrCheck } from "./inventory.mjs";
import { operatorInventory } from "./operator-inventory.mjs";
import { sourceTextHash } from "./source-text.mjs";

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
async function asyncCheck(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
function fixture(additions = {}) {
  const sources = {
    "backend/src/app.ts": 'import express from "express"; import { apiRouter } from "./routes"; export function createApp() { const app = express(); app.use(rootGuard); app.get("/health", health); app.use("/api", apiRouter); return app; }',
    "backend/src/routes/index.ts": 'import { Router } from "express"; import { leafRouter } from "../modules/leaf"; export const apiRouter = Router(); apiRouter.use("/leaf", leafRouter);',
    "backend/src/modules/leaf/index.ts": 'export { leafRouter } from "./routes/leaf.routes";',
    "backend/src/modules/leaf/routes/leaf.routes.ts": 'import { Router } from "express"; const router = Router(); router.use(authenticate); router.get("/", first); router.use(lateGate); router.post("/:id", validateRequest(schema), second); export { router as leafRouter };',
    ...additions,
  };
  return new Map(Object.entries(sources).map(([path, source]) => [path, parseSource(path, source)]));
}

check("resolves router imports, aliases, re-exports and mounted prefixes", () => {
  const routes = extractRoutes(fixture());
  assert.deepEqual(routes.map((route) => route.id), ["GET /api/leaf", "GET /health", "POST /api/leaf/:id"]);
  assert.deepEqual(routes[0].middleware, ["rootGuard", "authenticate", "first"]);
});
check("preserves middleware declaration order and handler binding", () => {
  const routes = extractRoutes(fixture());
  assert.deepEqual(routes.find((route) => route.method === "POST").middleware, ["rootGuard", "authenticate", "lateGate", "validateRequest(schema)", "second"]);
  assert.equal(routes.find((route) => route.id === "GET /health").middleware.includes("authenticate"), false);
});
check("route groups do not change Next URLs", () => {
  assert.equal(pagePath("frontend/src/app/dashboard/(system)/page.tsx"), "/dashboard");
  assert.equal(pagePath("frontend/src/app/(public)/events/[slug]/page.tsx"), "/events/[slug]");
  assert.equal(pagePath("frontend/src/app/page.tsx"), "/");
  assert.equal(pagePath("frontend/src/app/files/[...path]/page.tsx"), "/files/[...path]");
  assert.equal(pagePath("frontend/src/app/files/[[...path]]/page.tsx"), "/files/[[...path]]");
});
check("parallel/intercepting Next routes fail closed until explicitly modeled", () => {
  assert.throws(() => pagePath("frontend/src/app/@modal/page.tsx"), /Uncovered/);
  assert.throws(() => pagePath("frontend/src/app/(.)photo/page.tsx"), /Uncovered/);
});
check("duplicate Next URLs after route-group removal are rejected", () => {
  const files = new Map(["a", "b"].map((group) => { const path = `frontend/src/app/(${group})/page.tsx`; return [path, parseSource(path, "export default function Page() { return null; }")]; }));
  assert.throws(() => extractPages(files), /Duplicate Next page URL/);
});
check("page source line and client/dynamic metadata derive from AST", () => {
  const path = "frontend/src/app/example/page.tsx";
  const page = extractPages(new Map([[path, parseSource(path, '"use client";\nexport const dynamic = "force-dynamic";\nexport default function Page() { return null; }')]]))[0];
  assert.equal(page.source, `${path}:3`); assert.equal(page.execution, "client component"); assert.equal(page.dynamic, '"force-dynamic"');
});
check("dynamic route paths are rejected instead of silently omitted", () => assert.throws(() => parseSource("x.ts", "const router = Router(); router.get(path, handler);"), /nonliteral route path/));
check("computed router methods are rejected", () => assert.throws(() => parseSource("x.ts", 'const router = Router(); router["get"]("/", handler);'), /computed router method/));
check("chained router registration is rejected", () => assert.throws(() => parseSource("x.ts", 'const router = Router(); router.route("/").get(handler);'), /Uncovered router registration route|Uncovered chained route/));
check("router aliases cannot evade coverage", () => assert.throws(() => parseSource("x.ts", 'const router = Router(); const alias = router; alias.get("/", handler);'), /router alias/));
check("unknown router factories in route modules fail rather than being omitted", () => assert.throws(() => parseSource("backend/src/modules/custom/routes/custom.routes.ts", 'const r = dynamicFactory(); r.get("/", handler);'), /Uncovered receiver/));
check("typed/cast router registrations fail rather than being omitted", () => assert.throws(() => parseSource("x.ts", 'const router = Router(); (router as CustomRouter).get("/", handler);'), /Uncovered receiver/));
check("unsupported Express namespace imports fail closed", () => assert.throws(() => parseSource("x.ts", 'import * as ex from "express"; const r = ex.Router();'), /Express namespace import/));
check("unsupported export-star router imports fail closed", () => assert.throws(() => parseSource("x.ts", 'export * from "./other";'), /export-star pattern/));
check("aliased Express factory is recognized", () => assert.throws(() => parseSource("x.ts", 'import { Router as makeRouter } from "express"; const r = makeRouter(); r.get(path, handler);'), /nonliteral route path/));
check("regex/array mount paths are rejected", () => {
  assert.throws(() => parseSource("x.ts", "const router = Router(); router.use(/regex/, other);"), /mount path/);
  assert.throws(() => parseSource("x.ts", 'const router = Router(); router.use(["/a", "/b"], other);'), /mount path/);
});
check("nonliteral mounts cannot silently lose the prefix", () => assert.throws(() => extractRoutes(fixture({ "backend/src/routes/index.ts": 'import { Router } from "express"; import { leafRouter } from "../modules/leaf"; export const apiRouter = Router(); apiRouter.use(prefix, leafRouter);' })), /ambiguous pathless mounted router/));
check("unmodeled path-scoped middleware fails closed", () => assert.throws(() => extractRoutes(fixture({ "backend/src/modules/leaf/routes/leaf.routes.ts": 'const router = Router(); router.use("/private", middleware); router.get("/", handler); export { router as leafRouter };' })), /path-scoped middleware mount/));
check("unmounted HTTP routers are rejected", () => assert.throws(() => extractRoutes(fixture({ "backend/src/modules/unmounted/routes/unmounted.routes.ts": 'const router = Router(); router.get("/", handler);' })), /unmounted router/));
check("duplicate canonical Express routes are rejected", () => assert.throws(() => extractRoutes(fixture({ "backend/src/modules/leaf/routes/leaf.routes.ts": 'const router = Router(); router.get("/same/", first); router.get("/same", second); export { router as leafRouter };' })), /Duplicate HTTP entry/));
check("router mounting cycles are rejected", () => assert.throws(() => extractRoutes(fixture({ "backend/src/modules/leaf/routes/leaf.routes.ts": 'const router = Router(); router.use("/cycle", router); router.get("/", handler); export { router as leafRouter };' })), /Cyclic router mount/));
check("middleware after a mounted router is rejected until modeled", () => assert.throws(() => extractRoutes(fixture({ "backend/src/routes/index.ts": 'import { Router } from "express"; import { leafRouter } from "../modules/leaf"; export const apiRouter = Router(); apiRouter.use("/leaf", leafRouter, later);' })), /middleware after mounted router/));
check("Prisma models, role enums and indexes retain source lines", () => {
  const schema = extractSchema('enum RoleCode {\n SYSTEM_ADMIN\n GENERAL_STUDENT\n}\nmodel Example {\n id String @id\n userId String\n @@index([userId])\n @@unique([id, userId])\n}\n');
  assert.equal(schema.models.length, 1); assert.equal(schema.models[0].source, "backend/prisma/schema.prisma:5"); assert.equal(schema.models[0].indexes[0].source, "backend/prisma/schema.prisma:8"); assert.equal(schema.enums[0].fields.length, 2);
});
check("unsupported or duplicate Prisma declarations are rejected", () => {
  assert.throws(() => extractSchema("model Example { id String }"), /Uncovered Prisma declaration/);
  assert.throws(() => extractSchema("model Example {\n id String\n"), /Unclosed Prisma/);
  assert.throws(() => extractSchema("model Example {\n}\nmodel Example {\n}"), /Duplicate model/);
});
check("invalid TypeScript cannot silently reduce coverage", () => assert.throws(() => parseSource("invalid.ts", "const router = Router(;"), /Parse failure/));

const inventory = await buildInventory();
check("operator scripts and every npm entry participate in coverage", () => {
  assert(inventory.operators.entries.some((entry) => entry.path === 'backend/prisma/seed.ts'));
  assert(inventory.operators.entries.some((entry) => entry.path === 'backend/scripts/authorize-mfa-enrollment.ts'));
  assert(inventory.operators.entries.some((entry) => entry.path.startsWith('backend/prisma/migrations/')));
  assert(inventory.operators.entries.some((entry) => entry.path === 'scripts/scalability/workload-model.mjs'));
  for (const config of ['backend/scripts/tsconfig.seed.json', 'frontend/scripts/tsconfig.json', 'backend/prisma/migrations/migration_lock.toml', 'frontend/tsconfig.json', 'backend/tsconfig.json']) assert(inventory.operators.entries.some((entry) => entry.path === config));
  assert(inventory.operators.npmScripts.some((entry) => entry.id === 'backend/package.json#mfa:authorize-enrollment'));
  assert(inventory.operators.entries.every((entry) => !/\.env|\.cache|node_modules|uploads\//.test(entry.path)));
});
check("existing baseline covers every mounted API/page/model", () => {
  const originalRoutes = JSON.parse(readFileSync(join(ROOT, 'scripts/scalability/baseline-routes.json'), 'utf8'));
  assert.equal(originalRoutes.length, 91);
  assert.equal(new Set(originalRoutes).size, 91);
  assert(originalRoutes.every((id) => inventory.routes.some((route) => route.id === id)), 'An inherited entry point was removed');
  assert.equal(inventory.counts.apiRoutesIncludingHealth, 92);
  const readiness = inventory.routes.find((route) => route.id === 'GET /readyz');
  assert(readiness && readiness.middleware.some((value) => value.includes('readinessHandler(work)')), 'New readiness entry must retain its drain handler');
  assert.equal(inventory.counts.pageFiles, 39); assert.equal(inventory.counts.prismaModels, 27);
  assert.equal(inventory.counts.recurringSchedulers, 1); assert.equal(inventory.roles.fields.length, 7);
  assert.ok(inventory.sourceFiles.every((file) => /^[0-9a-f]{64}$/.test(file.sha256)));
  assert.ok(inventory.sourceFiles.every((file) => !/\.env|\.cache|node_modules/.test(file.path)));
});
await asyncCheck("unchanged source produces byte-identical inventory", async () => assert.deepEqual(await buildInventory(), inventory));
check("markdown is deterministic and contains every route/page/model/source", () => {
  const markdown = renderMarkdown(inventory); assert.equal(markdown, renderMarkdown(inventory));
  for (const entry of [...inventory.routes, ...inventory.pages, ...inventory.models, ...inventory.sourceFiles]) assert.ok(markdown.includes(entry.source));
  assert.ok(markdown.includes("unmeasured hypotheses")); assert.ok(markdown.includes("Phase 2 profiling pending"));
});
const fixtureParent = join(ROOT, ".cache"); await mkdir(fixtureParent, { recursive: true });
const fixtureRoot = await mkdtemp(join(fixtureParent, "scalability-inventory-verification-"));
check("checkout normalization preserves content and meaningful whitespace drift", () => {
  assert.equal(sourceTextHash('same\r\nsource\r\n'), sourceTextHash('same\nsource\n'));
  for (const changed of ['same\rsource\n', 'same\nsource', 'same \nsource\n', 'same\nchanged\n', '\ufeffsame\nsource\n']) {
    assert.notEqual(sourceTextHash(changed), sourceTextHash('same\nsource\n'));
  }
});
await asyncCheck("real source inventory agrees across LF and CRLF checkouts", async () => {
  const sources = [...new Set([...inventory.sourceFiles.map(file => file.path), ...inventory.operators.entries.map(file => file.path), 'backend/prisma/schema.prisma'])];
  const copies = ['lf', 'crlf'].map(style => join(fixtureRoot, style));
  for (const source of sources) {
    const content = (await readFile(join(ROOT, source), 'utf8')).replace(/\r\n/g, '\n');
    for (const [index, destination] of copies.entries()) {
      const file = join(destination, source);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, index === 0 ? content : content.replace(/\n/g, '\r\n'), 'utf8');
    }
  }
  assert.deepEqual(await buildInventory(copies[0]), await buildInventory(copies[1]));
});
await asyncCheck("check rejects missing outputs", async () => assert.rejects(writeOrCheck(inventory, true, fixtureRoot), /Missing inventory output/));
await writeOrCheck(inventory, false, fixtureRoot);
await asyncCheck("generated inventory passes check without rewriting", async () => {
  const before = await readFile(join(fixtureRoot, "docs/scalability/inventory.json"), "utf8");
  await writeOrCheck(inventory, true, fixtureRoot);
  assert.equal(await readFile(join(fixtureRoot, "docs/scalability/inventory.json"), "utf8"), before);
});
await asyncCheck("Git-converted inventory output passes without rewriting; content edits fail", async () => {
  const output = join(fixtureRoot, 'docs/scalability/inventory.json');
  const crlf = (await readFile(output, 'utf8')).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  await writeFile(output, crlf, 'utf8');
  await writeOrCheck(inventory, true, fixtureRoot);
  assert.equal(await readFile(output, 'utf8'), crlf);
  await writeFile(output, crlf.replace('"formatVersion": 3', '"formatVersion": 99'), 'utf8');
  await assert.rejects(writeOrCheck(inventory, true, fixtureRoot), /Stale inventory output/);
  await writeOrCheck(inventory, false, fixtureRoot);
});
await asyncCheck("new source coverage is detected as drift", async () => {
  const changed = structuredClone(inventory); changed.sourceFiles.push({ ...changed.sourceFiles[0], path: "backend/src/new-source.ts" });
  await assert.rejects(writeOrCheck(changed, true, fixtureRoot), /Stale inventory output/);
});
await asyncCheck("changed source fingerprint is detected as drift", async () => {
  const changed = structuredClone(inventory); changed.sourceFiles[0].sha256 = "0".repeat(64);
  await assert.rejects(writeOrCheck(changed, true, fixtureRoot), /Stale inventory output/);
});
await asyncCheck("new or changed operator/npm entry invalidates the inventory", async () => {
  const added = structuredClone(inventory); added.operators.entries.push({ ...added.operators.entries[0], path: 'backend/scripts/new-tool.ts' });
  await assert.rejects(writeOrCheck(added, true, fixtureRoot), /Stale inventory output/);
  const modified = structuredClone(inventory); modified.operators.npmScripts[0].command = 'different-command';
  await assert.rejects(writeOrCheck(modified, true, fixtureRoot), /Stale inventory output/);
});
await asyncCheck("deleted route/model/page coverage is detected as drift", async () => {
  for (const area of ["routes", "models", "pages"]) { const changed = structuredClone(inventory); changed[area].pop(); await assert.rejects(writeOrCheck(changed, true, fixtureRoot), /Stale inventory output/); }
});
await asyncCheck("edited Markdown alone is detected as drift", async () => {
  await writeFile(join(fixtureRoot, "docs/scalability/INVENTORY.md"), "invalid generated output\n", "utf8");
  await assert.rejects(writeOrCheck(inventory, true, fixtureRoot), /Stale inventory output docs\/scalability\/INVENTORY.md/);
});
await asyncCheck("shell and Docker entrypoints are source-covered without execution", async () => {
  await mkdir(join(fixtureRoot, 'infra'), { recursive: true });
  await writeFile(join(fixtureRoot, 'infra/entrypoint.sh'), '#!/bin/sh\nprintf fake\n');
  await writeFile(join(fixtureRoot, 'infra/Dockerfile'), 'FROM fake-fixture-image\n');
  const operators = await operatorInventory(fixtureRoot, 'fake');
  assert(operators.entries.some((entry) => entry.path === 'infra/entrypoint.sh'));
  assert(operators.entries.some((entry) => entry.path === 'infra/Dockerfile'));
});
await asyncCheck("Dockerfile-specific contexts are covered and changes invalidate fingerprints", async () => {
  for (const name of ['Backend.Dockerfile', 'Backend.Dockerfile.dockerignore', 'Dockerfile.worker', 'Dockerfile.worker.dockerignore', '.dockerignore']) {
    await writeFile(join(fixtureRoot, 'infra', name), '# public synthetic build configuration\n');
  }
  await writeFile(join(fixtureRoot, 'infra/.env'), 'must-never-be-read\n');
  const before = await operatorInventory(fixtureRoot, 'fake');
  for (const name of ['Backend.Dockerfile', 'Backend.Dockerfile.dockerignore', 'Dockerfile.worker', 'Dockerfile.worker.dockerignore', '.dockerignore']) {
    assert(before.entries.some((entry) => entry.path === `infra/${name}`));
  }
  assert(!before.entries.some((entry) => entry.path.endsWith('/.env')));
  await writeFile(join(fixtureRoot, 'infra/Backend.Dockerfile.dockerignore'), '# changed allow-list\n');
  const after = await operatorInventory(fixtureRoot, 'fake');
  assert.notEqual(before.entries.find((entry) => entry.path === 'infra/Backend.Dockerfile.dockerignore').sha256,
    after.entries.find((entry) => entry.path === 'infra/Backend.Dockerfile.dockerignore').sha256);
});
await asyncCheck("generated Python bytecode is excluded without weakening source-format checks", async () => {
  await mkdir(join(fixtureRoot, 'infra/__pycache__'), { recursive: true });
  await writeFile(join(fixtureRoot, 'infra/__pycache__/fixture.cpython.pyc'), 'generated fixture bytes; do not read as source');
  const operators = await operatorInventory(fixtureRoot, 'fake');
  assert(!operators.entries.some((entry) => entry.path.includes('__pycache__')));
  const badRoot = join(fixtureRoot, 'unexpected-bytecode-fixture');
  await mkdir(join(badRoot, 'infra'), { recursive: true });
  await writeFile(join(badRoot, 'infra/bytecode-outside-cache.pyc'), 'unexpected binary requires review');
  await assert.rejects(operatorInventory(badRoot, 'fake'), /Uncovered operator\/config format.*bytecode-outside-cache\.pyc/);
});
await asyncCheck("unmodeled operator formats fail before reading/executing them", async () => {
  await writeFile(join(fixtureRoot, 'infra/entrypoint.unmodeled'), 'must-not-be-executed');
  await assert.rejects(operatorInventory(fixtureRoot, 'fake'), /Uncovered operator\/config format.*entrypoint\.unmodeled/);
});
console.log(JSON.stringify({ status: "passed", checks, ...inventory.counts, fixturePolicy: "Fresh ignored local fixture outputs retained; no project data modified or deleted" }));
