import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { operatorInventory } from "./operator-inventory.mjs";

// Never load application modules, environments, generated files, caches, or database clients.
export const BASE_COMMIT = "415a869";
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const verbs = new Set(["get", "post", "put", "patch", "delete", "options", "head", "all"]);
const databaseMethods = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany", "$transaction", "$queryRaw", "$executeRaw", "$queryRawUnsafe", "$executeRawUnsafe"]);
const fileMethods = new Set(["readFile", "writeFile", "mkdir", "unlink", "access", "stat", "rename", "rm", "createReadStream", "createWriteStream", "sendFile"]);
const networkMethods = new Set(["fetch", "connect", "createTransport", "sendMail", "request"]);
const posix = (path) => path.split(sep).join("/");
const clean = (value) => value.replace(/\s+/g, " ").trim();
const hash = (text) => createHash("sha256").update(text).digest("hex");
const cite = (file, node) => `${file.path}:${file.ast.getLineAndCharacterOfPosition(node.getStart(file.ast)).line + 1}`;
const walk = (node, visit) => { visit(node); ts.forEachChild(node, (child) => walk(child, visit)); };
const text = (node, file) => clean(node.getText(file.ast));

export function parseSource(path, content) {
  const ast = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error(`Parse failure in ${path}: ${ast.parseDiagnostics.length} diagnostics`);
  const file = { path, content, ast, routers: new Map(), imports: new Map(), exports: new Map(), calls: [], timers: [] };
  // Imports and named re-exports are resolved statically; no application code executes.
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement)) {
      const module = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause?.name) file.imports.set(clause.name.text, { module, imported: "default" });
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings) && module === "express") throw new Error(`Uncovered Express namespace import at ${cite(file, statement)}`);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const item of clause.namedBindings.elements) file.imports.set(item.name.text, { module, imported: item.propertyName?.text ?? item.name.text });
    }
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause && statement.moduleSpecifier) throw new Error(`Uncovered export-star pattern at ${cite(file, statement)}`);
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const item of statement.exportClause.elements) file.exports.set(item.name.text, statement.moduleSpecifier ? { module: statement.moduleSpecifier.text, imported: item.propertyName?.text ?? item.name.text } : { local: item.propertyName?.text ?? item.name.text });
    }
    if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) file.exports.set(declaration.name.text, { local: declaration.name.text });
  }
  walk(ast, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer)) {
      const initializer = node.initializer;
      const factory = initializer.expression.getText(ast);
      const importedFactory = ts.isIdentifier(initializer.expression) ? file.imports.get(initializer.expression.text) : null;
      const expressFactory = importedFactory?.module === "express" && ["Router", "default"].includes(importedFactory.imported);
      if (factory === "Router" || factory === "express.Router" || factory === "express" || expressFactory) file.routers.set(node.name.text, { key: `${path}#${node.name.text}`, file, name: node.name.text, source: cite(file, node), events: [] });
    }
    if (ts.isCallExpression(node)) file.calls.push(node);
  });
  walk(ast, (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.initializer) && file.routers.has(node.initializer.text)) throw new Error(`Uncovered router alias at ${cite(file, node)}`);
  });
  for (const call of file.calls) {
    const member = call.expression;
    if (ts.isElementAccessExpression(member) && ts.isIdentifier(member.expression) && file.routers.has(member.expression.text)) throw new Error(`Uncovered computed router method at ${cite(file, call)}`);
    if (ts.isPropertyAccessExpression(member) && [...verbs, "use", "route"].includes(member.name.text) && (!ts.isIdentifier(member.expression) || !file.routers.has(member.expression.text))) {
      if (ts.isCallExpression(member.expression) && ts.isPropertyAccessExpression(member.expression.expression) && member.expression.expression.name.text === "route") throw new Error(`Uncovered chained route at ${cite(file, call)}`);
      const inRouterFile = /(?:\/routes\/.*\.ts$|\.routes\.ts$)/.test(path);
      const suspectRouterName = /\b(?:router|app)\b/i.test(member.expression.getText(ast));
      if (inRouterFile || file.routers.size || suspectRouterName) throw new Error(`Uncovered receiver for router registration at ${cite(file, call)}`);
    }
    if (!ts.isPropertyAccessExpression(member) || !ts.isIdentifier(member.expression) || !file.routers.has(member.expression.text)) continue;
    const router = file.routers.get(member.expression.text);
    const method = member.name.text;
    if (["disable", "enable", "set", "listen"].includes(method)) continue;
    if (![...verbs, "use"].includes(method)) throw new Error(`Uncovered router registration ${method} at ${cite(file, call)}`);
    if (!call.arguments.length) throw new Error(`Missing router arguments at ${cite(file, call)}`);
    if (method === "use") {
      const pathArgument = call.arguments[0];
      const hasPath = ts.isStringLiteralLike(pathArgument);
      if (ts.isRegularExpressionLiteral(pathArgument) || ts.isArrayLiteralExpression(pathArgument)) throw new Error(`Uncovered router mount path at ${cite(file, call)}`);
      router.events.push({ kind: "use", path: hasPath ? pathArgument.text : null, args: [...call.arguments].slice(hasPath ? 1 : 0), source: cite(file, call) });
    } else {
      const pathArgument = call.arguments[0];
      if (!ts.isStringLiteralLike(pathArgument) || !pathArgument.text.startsWith("/")) throw new Error(`Uncovered nonliteral route path at ${cite(file, call)}`);
      if (call.arguments.length < 2) throw new Error(`Missing route handler at ${cite(file, call)}`);
      router.events.push({ kind: "route", method: method.toUpperCase(), path: pathArgument.text, args: [...call.arguments].slice(1), source: cite(file, call) });
    }
  }
  // Express route() chains would otherwise evade the direct-call parser.
  for (const call of file.calls) if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "route" && ts.isIdentifier(call.expression.expression) && file.routers.has(call.expression.expression.text)) throw new Error(`Uncovered chained route at ${cite(file, call)}`);
  return file;
}

function resolveModule(files, owner, module) {
  if (!module.startsWith(".")) return null;
  const target = posix(relative(ROOT, resolve(ROOT, dirname(owner.path), module)));
  for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`]) if (files.has(candidate)) return files.get(candidate);
  return null;
}

function resolveRouter(files, file, name, seen = new Set()) {
  const key = `${file.path}#${name}`;
  if (seen.has(key)) throw new Error(`Cyclic router reference ${key}`);
  seen.add(key);
  if (file.routers.has(name)) return file.routers.get(name);
  const entry = file.imports.get(name) ?? file.exports.get(name);
  if (!entry) return null;
  if (entry.local) return entry.local === name ? null : resolveRouter(files, file, entry.local, seen);
  const imported = resolveModule(files, file, entry.module);
  return imported ? resolveRouter(files, imported, entry.imported, seen) : null;
}

function joinRoute(base, suffix) {
  return `/${[...base.split("/"), ...suffix.split("/")].filter(Boolean).join("/")}`;
}

export function extractRoutes(files) {
  const app = files.get("backend/src/app.ts")?.routers.get("app");
  if (!app) throw new Error("Missing statically declared Express application");
  const visited = new Set(); const routes = [];
  function mount(router, base, inherited, mountStack = []) {
    if (mountStack.includes(router.key)) throw new Error(`Cyclic router mount ${router.key}`);
    visited.add(router.key);
    const middleware = [...inherited];
    for (const event of router.events) {
      if (event.kind === "route") {
        const chain = [...middleware, ...event.args.map((arg) => text(arg, router.file))];
        const path = joinRoute(base, event.path);
        routes.push({ id: `${event.method} ${path}`, method: event.method, path, source: event.source, mountSources: [...mountStack, router.key], middleware: chain, access: chain.some((value) => /\bauthenticate\b|authenticateRefreshSession/.test(value)) ? "authenticated; service-level event/ownership checks must be traced" : "public or auth-challenge; handler-level controls must be traced", ...routeAssessment(event.method, path, chain) });
      } else {
        const mounted = event.args.map((arg) => ts.isIdentifier(arg) ? resolveRouter(files, router.file, arg.text) : null);
        if (event.path !== null && !mounted.some(Boolean)) throw new Error(`Uncovered path-scoped middleware mount at ${event.source}`);
        if (event.path === null && mounted.some(Boolean) && !mounted[0]) throw new Error(`Uncovered ambiguous pathless mounted router at ${event.source}`);
        const localMiddleware = event.args.filter((_, index) => !mounted[index]).map((arg) => text(arg, router.file));
        if (!mounted.some(Boolean)) middleware.push(...localMiddleware);
        else {
          // Mixing middleware after a router changes fall-through behavior and needs an explicit parser extension.
          const firstRouter = mounted.findIndex(Boolean);
          if (mounted.slice(firstRouter + 1).some((item) => !item)) throw new Error(`Uncovered middleware after mounted router at ${event.source}`);
          for (const child of mounted.filter(Boolean)) mount(child, joinRoute(base, event.path ?? ""), [...middleware, ...localMiddleware], [...mountStack, router.key]);
        }
      }
    }
  }
  mount(app, "", []);
  for (const file of files.values()) for (const router of file.routers.values()) if (router.events.some((event) => event.kind === "route") && !visited.has(router.key)) throw new Error(`Uncovered unmounted router ${router.key}`);
  const ids = new Set();
  for (const route of routes) { if (ids.has(route.id)) throw new Error(`Duplicate HTTP entry ${route.id}`); ids.add(route.id); }
  return routes.sort((a, b) => a.id.localeCompare(b.id, "en"));
}

const pending = (hypothesis, phase) => ({ bottleneck: `Unmeasured hypothesis: ${hypothesis}`, phase, change: "Mapped; no runtime change", before: "N/A: Phase 2 measurement pending", after: "N/A: no change measured", evidenceCommit: BASE_COMMIT });

function routeAssessment(method, path, chain) {
  if (path === "/health") return pending("liveness does not establish dependency readiness", 6);
  if (chain.some((value) => /upload\.(array|single)/.test(value))) return pending("in-memory multipart buffers and synchronous scanner/storage I/O limit admission", 5);
  if (path.includes("/reconciliation/generate")) return pending("synchronous report aggregation and one-process admission limit", 5);
  if (path.includes("/documents/")) return pending("local protected-file storage and per-process download budgets", 5);
  if (path.includes("/auth/")) return pending("password CPU, live session reads and process-local IP/action budgets", 1);
  if (method === "GET") return pending("database filtering/sorting/count cost and private no-store read amplification", 3);
  return pending("serializable governance writes, contention and audit/idempotency write volume", 3);
}

export function pagePath(filePath) {
  const prefix = "frontend/src/app/";
  if (!filePath.startsWith(prefix) || !/\/page\.(tsx?|jsx?)$/.test(`/${filePath}`)) throw new Error(`Invalid Next page path ${filePath}`);
  const pieces = filePath.slice(prefix.length).split("/").slice(0, -1);
  for (const piece of pieces) if (piece.startsWith("@") || /^\(\./.test(piece)) throw new Error(`Uncovered parallel/intercepting page convention ${filePath}`);
  return `/${pieces.filter((piece) => !/^\([^/]+\)$/.test(piece)).join("/")}`;
}

export function extractPages(files) {
  const pages = [];
  for (const file of files.values()) if (/^frontend\/src\/app\/(?:.*\/)?page\.tsx?$/.test(file.path)) {
    const path = pagePath(file.path);
    const directives = file.ast.statements.filter(ts.isExpressionStatement).map((node) => node.expression).filter(ts.isStringLiteral).map((node) => node.text);
    const dynamic = file.ast.statements.flatMap((node) => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []).find((node) => ts.isIdentifier(node.name) && node.name.text === "dynamic");
    const defaultExport = file.ast.statements.find((node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) || ts.isExportAssignment(node));
    if (!defaultExport) throw new Error(`Missing default page export ${file.path}`);
    const imports = [...file.imports.entries()].filter(([, value]) => value.module.startsWith("@/lib/api/") || value.module.startsWith("@/lib/session") || value.module.startsWith("@/components/")).map(([local, value]) => ({ local, ...value }));
    const workspace = file.path.includes("/(system)/") ? "global System Admin" : path.startsWith("/dashboard/events/") ? "event-specific team" : path.startsWith("/dashboard") ? "team selector/shared dashboard" : "public/student";
    pages.push({ id: path, source: cite(file, defaultExport), workspace, execution: directives.includes("use client") ? "client component" : "server component", dynamic: dynamic?.initializer ? text(dynamic.initializer, file) : "not declared; see proxy/layout/cache policy", imports, ...pending("SSR/API fan-out, bundle/render cost and database pagination require journey profiling", 7) });
  }
  const ids = new Set(); for (const page of pages) { if (ids.has(page.id)) throw new Error(`Duplicate Next page URL ${page.id}`); ids.add(page.id); }
  return pages.sort((a, b) => a.id.localeCompare(b.id, "en"));
}

export function extractSchema(content) {
  const lines = content.split(/\r?\n/); const models = []; const enums = []; let active = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/\/\/.*$/, "").trim();
    const declaration = /^(model|enum)\s+([A-Za-z][\w]*)\s*\{$/.exec(line);
    if (declaration) { if (active) throw new Error("Nested unsupported Prisma declaration"); active = { kind: declaration[1], name: declaration[2], source: `backend/prisma/schema.prisma:${index + 1}`, fields: [], indexes: [], constraints: [] }; continue; }
    if (!active) {
      if (/^(model|enum)\b/.test(line)) throw new Error(`Uncovered Prisma declaration at line ${index + 1}`);
      continue;
    }
    if (line === "}") { const { kind, ...entry } = active; (kind === "model" ? models : enums).push(kind === "model" ? { ...entry, ...pending("index/filter/join coverage, row growth, hot keys and transaction contention need local EXPLAIN evidence", 3) } : entry); active = null; continue; }
    if (!line) continue;
    const record = { declaration: line, source: `backend/prisma/schema.prisma:${index + 1}` };
    if (line.startsWith("@@index")) active.indexes.push(record);
    else if (line.startsWith("@@")) active.constraints.push(record);
    else active.fields.push(record);
  }
  if (active) throw new Error("Unclosed Prisma declaration");
  const names = new Set(); for (const model of models) { if (names.has(model.name)) throw new Error(`Duplicate model ${model.name}`); names.add(model.name); }
  return { models, enums };
}

function extractSurfaces(files) {
  const sinks = []; const timers = []; const startupJobs = [];
  for (const file of files.values()) {
    for (const call of file.calls) {
      const callee = text(call.expression, file); const method = ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : ts.isIdentifier(call.expression) ? call.expression.text : "";
      const parent = ts.isPropertyAccessExpression(call.expression) ? text(call.expression.expression, file) : "";
      let surface = null;
      if (databaseMethods.has(method) && /^(?:prisma|db|tx)(?:\.|$)/.test(parent)) surface = "database";
      else if (fileMethods.has(method)) surface = "filesystem/protected download (method candidate; inspect import/data flow)";
      else if (networkMethods.has(method)) surface = "network/mail/socket (method candidate; inspect import/data flow)";
      else if (/PDFDocument|createPdf|generatePdf|downloadPdf|buildPdf|renderPdf/.test(callee)) surface = "browser PDF (candidate; inspect call chain)";
      if (surface) sinks.push({ surface, callee, source: cite(file, call) });
      if (["setInterval", "setTimeout"].includes(callee)) timers.push({ kind: callee === "setInterval" ? "recurring scheduler" : "deadline/retry/browser cleanup; not durable job", source: cite(file, call), callback: call.arguments[0] ? text(call.arguments[0], file) : "missing", interval: call.arguments[1] ? text(call.arguments[1], file) : "default", ...pending(callee === "setInterval" ? "scheduler runs independently in every app process; coordination/error handling require review" : "timer lifetime and deadline/backpressure require failure-injection proof", callee === "setInterval" ? 5 : 6) });
      if (file.path === "backend/src/server.ts" && ["rolesService.ensureRoleCatalog", "authRepository.pruneStaleTokens"].includes(callee) && !timers.some((timer) => timer.source === cite(file, call))) startupJobs.push({ kind: "startup task", source: cite(file, call), handler: callee, ...pending("repeated startup/scheduled database work across replicas requires coordination review", 5) });
    }
    walk(file.ast, (node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(file.ast) === "dangerouslySetInnerHTML") sinks.push({ surface: "HTML injection sink; inspect static/trusted data boundary", callee: "dangerouslySetInnerHTML", source: cite(file, node) });
      if (ts.isTaggedTemplateExpression(node) && /^(?:prisma|db|tx)\.\$(queryRaw|executeRaw)(Unsafe)?$/.test(text(node.tag, file))) sinks.push({ surface: "database tagged SQL; inspect parameterization/data flow", callee: text(node.tag, file), source: cite(file, node) });
      if (ts.isNewExpression(node) && /PDFDocument/.test(text(node.expression, file))) sinks.push({ surface: "browser PDF renderer construction", callee: text(node.expression, file), source: cite(file, node) });
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && /^(?:document(?:\.body)?|URL)$/.test(text(node.expression.expression, file)) && ["createElement", "appendChild", "createObjectURL"].includes(node.expression.name.text)) sinks.push({ surface: "browser DOM/download (candidate; inspect data flow)", callee: text(node.expression, file), source: cite(file, node) });
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && ["innerHTML", "outerHTML", "srcdoc", "href", "src"].includes(node.left.name.text)) sinks.push({ surface: "HTML/DOM/URL assignment (candidate; inspect data flow)", callee: text(node.left, file), source: cite(file, node) });
    });
  }
  return { sinks: sinks.sort((a, b) => a.source.localeCompare(b.source, "en") || a.callee.localeCompare(b.callee, "en")), timers, startupJobs };
}

function absenceEvidence(files, routes, schema) {
  const checks = [
    { feature: "Academic results, exams, marks and grade mutations", expression: /(?:\bgrades?\b|\bmarks?\b|\bexam(?:ination)?s?\b|\bacademicResult\b)/i, scope: ["route paths", "Prisma model/field declarations"], reason: "No academic result/grade schema or endpoint exists; UI search-result wording is not an academic module." },
    { feature: "Payment webhooks and external card/gateway settlement", expression: /webhook|stripe|paypal|sslcommerz|braintree|bkash.*callback/i, scope: ["route paths", "application imports"], reason: "Payments are participant proof/manual finance workflows; no payment gateway callback is implemented." },
    { feature: "SMS delivery", expression: /twilio|vonage|sendSms|smsProvider/i, scope: ["application imports", "call expressions"], reason: "No SMS provider/dispatch integration exists." },
    { feature: "Server-side PDF renderer/export endpoint", expression: /puppeteer|playwright|chromium|wkhtmltopdf|pdfkit|\/pdf\b|\/export\b/i, scope: ["backend imports", "route paths"], reason: "Existing PDF exports use frontend PDFKit; no server renderer or export route exists." },
    { feature: "Durable queue, cache, shared distributed rate store and object-storage adapter", expression: /bullmq|pg-boss|redis|ioredis|memcached|@aws-sdk\/client-s3|@azure\/storage-blob/i, scope: ["application imports"], reason: "Not implemented at this baseline; existing storage is local, session state is PostgreSQL, several budgets are per process." },
  ];
  const imports = [...files.values()].flatMap((file) => [...file.imports.values()].map((value) => `${file.path}: ${value.module}`));
  const backendImports = imports.filter((value) => value.startsWith("backend/"));
  const modelDeclarations = schema.models.flatMap((model) => [model.name, ...model.fields.map((field) => field.declaration)]);
  const calls = [...files.values()].flatMap((file) => file.calls.map((call) => `${file.path}: ${text(call.expression, file)}`));
  const sources = { "route paths": routes.map((route) => route.id), "Prisma model/field declarations": modelDeclarations, "application imports": imports, "backend imports": backendImports, "call expressions": calls };
  return checks.map((check) => { const matches = check.scope.flatMap((scope) => sources[scope].filter((entry) => check.expression.test(entry))); return { feature: check.feature, status: matches.length ? "UNVERIFIED: matching source requires review" : "N/A: absent in inventoried source", reason: check.reason, searchExpression: check.expression.source, searchScope: check.scope, matches }; });
}

function trustBoundaries(files) {
  const anchors = [
    ["Browser → Next proxy/SSR", "frontend/src/proxy.ts", /export .*proxy|export .*function/, "nonce CSP, no-store and authenticated SSR; browser UI grants no authority"],
    ["Next/browser → Express API", "backend/src/app.ts", /cors\(corsOptions\)/, "exact-origin credentialed CORS, parser limits, response security headers"],
    ["Health → liveness response", "backend/src/app.ts", /app\.get\("\/health"/, "included in the API count; current health does not check PostgreSQL/scanner/readiness"],
    ["Unknown HTTP path → 404", "backend/src/middlewares/not-found.ts", /export .*notFoundHandler/, "fall-through middleware, not an additional API route; response must not expose raw paths/secrets"],
    ["Unhandled API failure → sanitized response", "backend/src/middlewares/error-handler.ts", /export .*errorHandler/, "error middleware, not an additional API route; preserve status/error contract without raw dependency diagnostics"],
    ["Untrusted cookies → trusted live session", "backend/src/middlewares/authenticate.ts", /export .*authenticate/, "signature/token/session/account/MFA checks; current session context bound server-side"],
    ["Trusted request → governance transaction", "backend/src/utils/governance-transaction.ts", /export .*function|export const/, "serializable authority/session recheck and atomic audit; no client-inferred event membership"],
    ["Multipart bytes → scanner", "backend/src/utils/upload-scanner.ts", /export .*function|export const/, "content/size checks and ClamAV fail-closed boundary before persistence"],
    ["Authorized bytes → local file storage", "backend/src/storage/adapters/local-storage.adapter.ts", /export .*class|export .*const/, "local private storage; moving across instances requires an adapter and release authorization"],
    ["Authorized document ID → file response", "backend/src/modules/documents/controllers/documents.controller.ts", /openProtectedDocument/, "transactional authorization/audit before protected file stream"],
    ["Recovery capability → SMTP", "backend/src/config/mailer.ts", /sendPasswordResetEmail/, "verified TLS; secrets excluded from logs; real provider delivery not verified"],
    ["Public finance snapshot → browser PDF", "frontend/src/lib/pdf.ts", /export .*function/, "local PDFKit generation; public snapshot disclosure rules remain required"],
    ["Operator Prisma tools → PostgreSQL", "backend/src/config/prisma.ts", /new PrismaClient/, "baseline runtime credentials currently excessive (SEC-22); migration credentials need separation"],
  ];
  return anchors.map(([name, path, pattern, controls]) => { const file = files.get(path); if (!file) throw new Error(`Missing boundary anchor ${path}`); const line = file.content.split(/\r?\n/).findIndex((value) => pattern.test(value)); if (line < 0) throw new Error(`Missing boundary anchor pattern in ${path}`); return { name, source: `${path}:${line + 1}`, controls, status: "Mapped; controls require existing regressions plus scale-specific tests" }; });
}

async function sourceFiles(root, directory) {
  const output = [];
  for (const entry of (await readdir(join(root, directory), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const path = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Source symlink requires explicit review: ${path}`);
    if (entry.name.startsWith(".") || ["node_modules", "dist"].includes(entry.name)) throw new Error(`Excluded private/generated path inside source: ${path}`);
    if (entry.isDirectory()) output.push(...await sourceFiles(root, path));
    else if (entry.isFile()) {
      if (!/\.(ts|tsx|css|md)$/.test(entry.name)) throw new Error(`Uncovered source extension requires review before reading: ${path}`);
      output.push(path);
    }
  }
  return output;
}

async function buildApplicationInventory(root = ROOT) {
  const paths = [...await sourceFiles(root, "backend/src"), ...await sourceFiles(root, "frontend/src")].sort();
  const sourceIndex = []; const files = new Map();
  for (const path of paths) {
    const content = await readFile(join(root, path), "utf8");
    sourceIndex.push({ path, source: `${path}:1`, lines: content.split(/\r?\n/).length, sha256: hash(content), kind: /\/page\.tsx?$/.test(path) ? "Next page" : /\/routes\/|backend\/src\/routes\//.test(path) ? "HTTP router" : /\/repositories\//.test(path) ? "repository" : /\/services\//.test(path) ? "service" : path.includes("/components/") ? "component" : "support/source", change: "Mapped; no runtime change", metrics: "N/A: source coverage evidence; benchmark by owning journey", evidenceCommit: BASE_COMMIT });
    if (/\.tsx?$/.test(path)) files.set(path, parseSource(path, content));
    if (/^frontend\/src\/app\/.*\/route\.tsx?$/.test(path)) throw new Error(`New Next API handler requires inventory extension: ${path}`);
  }
  const routes = extractRoutes(files); const pages = extractPages(files);
  const schemaContent = await readFile(join(root, "backend/prisma/schema.prisma"), "utf8"); const schema = extractSchema(schemaContent);
  const surfaces = extractSurfaces(files);
  const roles = schema.enums.find((entry) => entry.name === "RoleCode");
  if (!roles) throw new Error("Missing role enum");
  return { formatVersion: 1, evidenceCommit: BASE_COMMIT, compilerVersion: ts.version, counts: { applicationSourceFiles: sourceIndex.length, applicationTypeScriptFiles: files.size, supportingSourceFiles: sourceIndex.length - files.size, apiRoutesIncludingHealth: routes.length, pageFiles: pages.length, prismaModels: schema.models.length, recurringSchedulers: surfaces.timers.filter((timer) => timer.kind === "recurring scheduler").length, timers: surfaces.timers.length, inputSinkCandidates: surfaces.sinks.length }, coverage: { scope: ["backend/src/**", "frontend/src/**", "backend/prisma/schema.prisma"], sourceCountExplanation: "The prior security map indexes 307 .ts/.tsx files; this inventory additionally fingerprints globals.css and backend/src/modules/README.md, totaling 309.", excluded: [".env and local/private cache files", "generated dist/.next/node_modules", "verification/seed CLI scripts: separate operator-tool inventory required"], schemaHash: hash(schemaContent), legacyMapExpected: { apiRoutesIncludingHealth: 91, pageFiles: 39, prismaModels: 27 }, canonicalTrailingSlashes: "Express non-strict routes collapse trailing slash; root remains /" }, roles, routes, pages, models: schema.models, enums: schema.enums, jobs: { startupAndCallbacks: surfaces.startupJobs, timers: surfaces.timers }, trustBoundaries: trustBoundaries(files), absentFeatures: absenceEvidence(files, routes, schema), sinkCandidates: surfaces.sinks, sourceFiles: sourceIndex };
}

export async function buildInventory(root = ROOT) {
  const inventory = await buildApplicationInventory(root);
  inventory.operators = await operatorInventory(root, BASE_COMMIT);
  inventory.formatVersion = 2;
  inventory.counts.operatorSources = inventory.operators.entries.length;
  inventory.counts.npmCommands = inventory.operators.npmScripts.length;
  inventory.coverage.scope.push(...inventory.operators.sourceDiscovery.map((directory) => `${directory}/**`), 'backend/prisma/seed.ts', 'root/backend/frontend loose source/config scripts', 'workspace package scripts');
  inventory.coverage.excluded = inventory.coverage.excluded.filter((entry) => !entry.startsWith('verification/seed'));
  inventory.coverage.excluded.push('binary font/image assets: byte budgets in browser/artifact profiling; not executable entry points');
  inventory.coverage.sourceCountExplanation = `The prior security map indexed 307 TypeScript application files. Current application coverage: ${inventory.counts.applicationTypeScriptFiles} TypeScript files plus ${inventory.counts.supportingSourceFiles} supporting sources. Operator/config/migration sources are counted separately.`;
  return inventory;
}

const cell = (value) => String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").replace(/`/g, "'");
const table = (headers, rows) => `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${row.map(cell).join(" | ")} |`).join("\n")}\n`;

export function renderMarkdown(inventory) {
  const metric = "N/A: Phase 2 profiling pending; implemented changes and correctness measurements are recorded in phase reports";
  let doc = `# Scalability source inventory\n\nGenerated deterministically by \`node scripts/scalability/inventory.mjs\`; \`--check\` rejects stale outputs. No application module, environment file, database, private cache or network is accessed. Baseline evidence: \`${inventory.evidenceCommit}\`. TypeScript compiler: ${inventory.compilerVersion}.\n\n## Coverage and evidence limits\n\n${table(["Area", "Count"], Object.entries(inventory.counts))}\nAll listed bottlenecks are **unmeasured hypotheses**, not performance findings or capacity claims. Before/after metrics are ${metric}. Static sink candidates identify locations to trace; they do not prove user-controlled input or vulnerabilities. Inventory is current-source driven; historical evidence remains in the security reports. Canonical API URLs omit Express's optional trailing slash. Health is included in the 91-route baseline; timers include deadlines and browser cleanup, which are not durable background jobs.\n\nExcluded private/generated paths and operator CLI scripts: ${inventory.coverage.excluded.join("; ")}. CLI jobs are not HTTP entry points and need the operator-tool review before deployment.\n\n## Every HTTP entry\n\n${table(["Method/path", "Source", "Effective ordered middleware / handler", "Hypothesis / phase", "Change and before/after", "Evidence commit"], inventory.routes.map((route) => [route.id, route.source, route.middleware.join(" → "), `${route.bottleneck}; Phase ${route.phase}`, metric, route.evidenceCommit]))}\n## Every Next page\n\n${table(["URL", "Source", "Workspace / execution", "API/session imports", "Hypothesis / phase", "Change and before/after", "Evidence commit"], inventory.pages.map((page) => [page.id, page.source, `${page.workspace}; ${page.execution}; dynamic=${page.dynamic}`, page.imports.map((entry) => entry.local).join(", ") || "none directly; inspect component/layout chain", `${page.bottleneck}; Phase ${page.phase}`, metric, page.evidenceCommit]))}\n## Every Prisma model\n\n${table(["Model", "Source", "Fields / explicit indexes / model constraints", "Hypothesis / phase", "Change and before/after", "Evidence commit"], inventory.models.map((model) => [model.name, model.source, `${model.fields.length} / ${model.indexes.map((index) => index.declaration).join("; ") || "none"} / ${model.constraints.map((constraint) => constraint.declaration).join("; ") || "none"}`, `${model.bottleneck}; Phase ${model.phase}`, metric, model.evidenceCommit]))}\n## Roles\n\n${table(["Role", "Source"], inventory.roles.fields.map((field) => [field.declaration, field.source]))}\nSYSTEM_ADMIN is global governance. Operational authority requires an active owning-event assignment; GENERAL_STUDENT uses ownership checks. Event role accounts must be distinct and cannot be SYSTEM_ADMIN accounts. Schema enum membership alone grants no permission.\n\n## Startup tasks, scheduler callbacks, and timers\n\n${table(["Kind", "Source", "Handler / interval", "Hypothesis / phase", "Before/after", "Evidence commit"], [...inventory.jobs.startupAndCallbacks.map((job) => [job.kind, job.source, job.handler, `${job.bottleneck}; Phase ${job.phase}`, metric, job.evidenceCommit]), ...inventory.jobs.timers.map((job) => [job.kind, job.source, `${job.callback}; ${job.interval}`, `${job.bottleneck}; Phase ${job.phase}`, metric, job.evidenceCommit])])}\n## Trust boundaries\n\n${table(["Boundary", "Source", "Current controls / review requirement"], inventory.trustBoundaries.map((boundary) => [boundary.name, boundary.source, `${boundary.controls}; ${boundary.status}`]))}\n## Requested capabilities absent at baseline\n\n${table(["Capability", "Status / reason", "Source search scope / expression", "Matches"], inventory.absentFeatures.map((feature) => [feature.feature, `${feature.status}; ${feature.reason}`, `${feature.searchScope.join(", ")}; /${feature.searchExpression}/i`, feature.matches.join("; ") || "none"]))}\n## Database, file, network, HTML and PDF sink candidates\n\n${table(["Surface", "Source", "Callee"], inventory.sinkCandidates.map((sink) => [sink.surface, sink.source, sink.callee]))}\n## Every application source file\n\nFingerprints are stored in \`inventory.json\`; any content/path/line change makes \`--check\` fail until regenerated and reviewed.\n\n${table(["Source", "Kind", "Lines", "Change / metric", "Evidence commit"], inventory.sourceFiles.map((file) => [file.source, file.kind, file.lines, `${file.change}; ${file.metrics}`, file.evidenceCommit]))}`;
  doc += `\n## Operator, verification, migration and build sources\n\nThese are separate from HTTP jobs. Side effects/guards are lexical candidates, not proof of safe execution. All source fingerprints and npm commands participate in --check.\n\n${table(['Source', 'Kind / operator boundary', 'Side-effect candidates', 'Guard source candidates', 'Before/after', 'Evidence commit'], inventory.operators.entries.map((entry) => [entry.source, `${entry.kind}; ${entry.trustBoundary}`, entry.effects.map((effect) => `${effect.kind}: ${effect.source}`).join('; ') || 'none directly; inspect imported calls', entry.guardCandidates.join('; ') || 'none found; enforcement unverified', `${entry.before}; ${entry.after}`, entry.evidenceCommit]))}\n## Every npm command\n\n${table(['Command ID', 'Source', 'Exact command / boundary'], inventory.operators.npmScripts.map((entry) => [entry.id, entry.source, `${entry.command}; ${entry.trustBoundary}`]))}`;
  return doc.replace("\nAll listed bottlenecks", `\n${inventory.coverage.sourceCountExplanation}\n\nAll listed bottlenecks`).replace('Excluded private/generated paths and operator CLI scripts:', 'Excluded private/generated paths:').replace('CLI jobs are not HTTP entry points and need the operator-tool review before deployment.', 'Operator CLI/config/migration sources and npm commands are mapped below; guard enforcement must still be reviewed before execution.');
}

export async function writeOrCheck(inventory, check, root = ROOT) {
  const outputs = [["docs/scalability/inventory.json", `${JSON.stringify(inventory, null, 2)}\n`], ["docs/scalability/INVENTORY.md", renderMarkdown(inventory)]];
  for (const [path, output] of outputs) {
    if (check) {
      let existing; try { existing = await readFile(join(root, path), "utf8"); } catch (error) { if (error.code === "ENOENT") throw new Error(`Missing inventory output ${path}`); throw error; }
      if (existing !== output) throw new Error(`Stale inventory output ${path}; regenerate and review the source change`);
    } else { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), output, "utf8"); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); if (args.some((arg) => arg !== "--check") || args.length > 1) throw new Error("Usage: node scripts/scalability/inventory.mjs [--check]");
  const inventory = await buildInventory(); await writeOrCheck(inventory, args.includes("--check"));
  console.log(JSON.stringify({ status: args.includes("--check") ? "current" : "generated", ...inventory.counts }));
}
