import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This is a deployment boundary check, not a replacement for npm audit.
// GHSA-vfj7-8cjw-p6xm has no published patched braces release as of 2026-10-12.
const buildOnly = new Set([
  "braces", "micromatch", "fast-glob", "tailwindcss", "tailwindcss-animate",
  "eslint-config-next", "@next/eslint-plugin-next",
]);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packagePath = /(?:^|\/)node_modules\/(braces|micromatch|fast-glob|tailwindcss(?:-animate)?|eslint-config-next|@next\/eslint-plugin-next)(?:\/|$)/;
const moduleReference = /(?:\b(?:require|import)\s*\(\s*|\bfrom\s+|\bimport\s+)["'](braces|micromatch|fast-glob|tailwindcss(?:-animate)?|eslint-config-next|@next\/eslint-plugin-next)(?:\/[^"']*)?["']/;

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function contained(root, candidate) {
  const resolved = await realpath(candidate);
  if (!within(root, resolved)) throw new Error("Runtime artifact contains a path outside its declared root.");
  return resolved;
}

async function json(file) {
  const content = await readFile(file, "utf8");
  try { return JSON.parse(content); } catch { throw new Error("Invalid runtime manifest or output-file trace JSON."); }
}

function unsafe(name, version) {
  if (buildOnly.has(name)) return true;
  // chokidar 4 has no braces dependency and is not the affected chokidar 2/3 chain.
  return name === "chokidar" && (!/^\d+\.\d+\.\d+/.test(version ?? "") || Number(version.split(".")[0]) < 4);
}

async function files(root, directory, selected, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Build artifacts must not contain symbolic links.");
    if (entry.isDirectory()) await files(root, await contained(root, candidate), selected, output);
    else if (entry.isFile() && selected(entry.name)) output.push(await contained(root, candidate));
  }
  return output;
}

async function installedPackages(root, modules, seen = new Set(), output = []) {
  const location = await contained(root, modules);
  if (seen.has(location)) return output;
  seen.add(location);
  for (const entry of await readdir(location, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = await contained(root, path.join(location, entry.name));
    if (entry.name.startsWith("@") && entry.isDirectory()) {
      await installedPackages(root, entryPath, seen, output);
      continue;
    }
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const manifest = await json(await contained(root, path.join(entryPath, "package.json")));
    const folderName = path.basename(entryPath);
    if (unsafe(manifest.name, manifest.version) || unsafe(folderName, manifest.version)) {
      throw new Error("Build-only or affected dependency is installed.");
    }
    output.push({ name: manifest.name, version: manifest.version });
    const nested = path.join(entryPath, "node_modules");
    try { await stat(nested); } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    await installedPackages(root, nested, seen, output);
  }
  return output;
}

async function scanPrograms(root, directories) {
  let scannedFiles = 0;
  let scannedBytes = 0;
  let traces = 0;
  for (const directory of directories) {
    const selected = await files(root, directory, (name) => /\.(?:[cm]?js|map|json)$/.test(name));
    for (const file of selected) {
      const content = await readFile(file, "utf8");
      scannedFiles += 1;
      scannedBytes += Buffer.byteLength(content);
      if (packagePath.test(content.replaceAll("\\", "/")) || moduleReference.test(content)) {
        throw new Error(`Build-only dependency reference in emitted artifact: ${path.relative(root, file)}.`);
      }
      if (file.endsWith(".nft.json")) {
        let trace;
        try { trace = JSON.parse(content); } catch { throw new Error("Invalid Next output-file trace JSON."); }
        if (!Array.isArray(trace.files) || trace.files.some((value) => typeof value !== "string")) {
          throw new Error("Invalid Next output-file trace.");
        }
        traces += 1;
      }
    }
  }
  return { scannedFiles, scannedBytes, traces };
}

export async function verifySource(root) {
  const lock = await json(path.join(root, "package-lock.json"));
  if (!lock.packages || lock.lockfileVersion < 2) throw new Error("An npm lockfile with package metadata is required.");
  const affected = [];
  for (const [location, manifest] of Object.entries(lock.packages)) {
    const name = location.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/)?.[1];
    if (name && unsafe(name, manifest.version)) {
      if (!manifest.dev) throw new Error(`Build-only dependency is reachable in the production lock graph: ${name}.`);
      affected.push({ path: location, version: manifest.version, license: manifest.license });
    }
  }
  return {
    mode: "source", status: "source_dependency_boundary_passed", advisory: "GHSA-vfj7-8cjw-p6xm",
    runtimeArtifactVerified: false, developmentAdvisoryResolved: false, developmentChain: affected,
    auditRequirement: "Run npm audit and npm audit --omit=dev separately; preserve both exit codes.",
  };
}

export async function verifyRuntime(root, component = "all") {
  root = await realpath(root);
  if (!["all", "frontend", "backend"].includes(component)) throw new Error("Unknown runtime component.");
  await json(await contained(root, path.join(root, "package.json")));
  const packages = await installedPackages(root, path.join(root, "node_modules"));
  const directories = [];
  let traces = 0;
  if (component !== "backend") {
    const frontend = await contained(root, path.join(root, "frontend/.next"));
    const buildId = (await readFile(await contained(root, path.join(frontend, "BUILD_ID")), "utf8")).trim();
    if (!buildId) throw new Error("A production Next BUILD_ID is required.");
    const routeManifest = await json(await contained(root, path.join(frontend, "server/app-paths-manifest.json")));
    if (!routeManifest || Array.isArray(routeManifest) || typeof routeManifest !== "object" || Object.keys(routeManifest).length === 0) {
      throw new Error("A nonempty compiled Next route manifest is required.");
    }
    const serverRoot = path.join(frontend, "server");
    for (const compiled of Object.values(routeManifest)) {
      if (typeof compiled !== "string" || !compiled.endsWith(".js")) throw new Error("Invalid compiled Next route manifest.");
      const program = await contained(root, path.resolve(serverRoot, compiled));
      if (!within(serverRoot, program) || !(await stat(program)).isFile()) throw new Error("Compiled Next route is missing or outside its server directory.");
    }
    const staticPrograms = await files(root, path.join(frontend, "static"), (name) => name.endsWith(".js"));
    if (staticPrograms.length === 0) throw new Error("Compiled Next browser chunks are required.");
    // Scan only deployed production output, never .next/dev/cache or framework trace logs.
    directories.push(path.join(frontend, "server"), path.join(frontend, "static"));
    for (const name of ["next-server.js.nft.json", "next-minimal-server.js.nft.json"]) {
      const trace = await json(await contained(root, path.join(frontend, name)));
      if (!Array.isArray(trace.files) || trace.files.some((file) => typeof file !== "string" || packagePath.test(file.replaceAll("\\", "/")))) {
        throw new Error("Invalid or unsafe Next server output-file trace.");
      }
      traces += 1;
    }
  }
  if (component !== "frontend") {
    const backend = await contained(root, path.join(root, "backend/dist"));
    const server = await contained(root, path.join(backend, "server.js"));
    if (!(await stat(server)).isFile()) throw new Error("Compiled backend server.js is required.");
    directories.push(backend);
  }
  const programs = await scanPrograms(root, directories);
  if (component !== "backend" && programs.traces === 0) throw new Error("Next page/proxy output-file traces are required.");
  return {
    mode: "runtime", component, status: "known_development_chain_excluded", installedPackageEntries: packages.length,
    ...programs, traces: traces + programs.traces, developmentAdvisoryResolved: false,
    limits: "Known package/import/path boundary only; not a general binary SBOM or vulnerability audit.",
    auditRequirement: "Run npm audit and npm audit --omit=dev separately; preserve both exit codes.",
  };
}

async function selfTest() {
  const cache = path.join(repositoryRoot, ".cache");
  await mkdir(cache, { recursive: true });
  const root = await mkdtemp(path.join(cache, "runtime-dependency-contract-"));
  const put = async (relative, value, fixtureRoot = root) => {
    const file = path.join(fixtureRoot, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, typeof value === "string" ? value : JSON.stringify(value));
  };
  let checks = 0;
  await put("package.json", { name: "synthetic-runtime-contract", private: true });
  await put("package-lock.json", { lockfileVersion: 3, packages: { "node_modules/braces": { version: "3.0.3", dev: true, license: "MIT" } } });
  assert.equal((await verifySource(root)).runtimeArtifactVerified, false); checks += 1;
  await put("package-lock.json", { lockfileVersion: 3, packages: { "node_modules/braces": { version: "3.0.3" } } });
  await assert.rejects(verifySource(root), /production lock graph/); checks += 1;
  await assert.rejects(verifyRuntime(root), /ENOENT/); checks += 1;
  await put("node_modules/chokidar/package.json", { name: "chokidar", version: "4.0.3" });
  await put("backend/dist/server.js", "export const synthetic = true;\n");
  assert.equal((await verifyRuntime(root, "backend")).installedPackageEntries, 1); checks += 1;
  await put("node_modules/chokidar/package.json", { name: "chokidar", version: "3.6.0" });
  await assert.rejects(verifyRuntime(root, "backend"), /affected dependency/); checks += 1;
  await put("node_modules/chokidar/package.json", { name: "chokidar", version: "4.0.3" });
  await put("backend/dist/server.js", 'import("micromatch");\n');
  await assert.rejects(verifyRuntime(root, "backend"), /emitted artifact/); checks += 1;
  await put("backend/dist/server.js", 'require("braces");\n');
  await assert.rejects(verifyRuntime(root, "backend"), /emitted artifact/); checks += 1;
  await put("backend/dist/server.js", "export const synthetic = true;\n");
  await put("frontend/.next/BUILD_ID", "synthetic-contract-build");
  await put("frontend/.next/server/app-paths-manifest.json", {});
  await assert.rejects(verifyRuntime(root), /nonempty compiled Next route/); checks += 1;
  await put("frontend/.next/server/app-paths-manifest.json", { "/page": "app/page.js" });
  await put("frontend/.next/server/app/page.js", "export const syntheticPage = true;\n");
  await mkdir(path.join(root, "frontend/.next/static"), { recursive: true });
  await assert.rejects(verifyRuntime(root), /browser chunks/); checks += 1;
  await put("frontend/.next/static/chunks/app.js", "export const syntheticBrowser = true;\n");
  for (const name of ["next-server.js.nft.json", "next-minimal-server.js.nft.json", "server/app/page.js.nft.json"]) {
    await put(`frontend/.next/${name}`, { files: [] });
  }
  assert.equal((await verifyRuntime(root)).traces, 3); checks += 1;
  await put("frontend/.next/server/app/page.js.nft.json", { files: ["../../../node_modules/braces/index.js"] });
  await assert.rejects(verifyRuntime(root), /emitted artifact/); checks += 1;
  await put("frontend/.next/server/app/page.js.nft.json", { files: "invalid" });
  await assert.rejects(verifyRuntime(root), /Invalid Next output/); checks += 1;
  await put("frontend/.next/server/app/page.js.nft.json", { files: [] });
  await put("node_modules/braces/package.json", { name: "braces", version: "3.0.3" });
  await assert.rejects(verifyRuntime(root), /affected dependency/); checks += 1;
  const scopedRoot = await mkdtemp(path.join(cache, "runtime-dependency-scoped-contract-"));
  await put("package.json", { name: "synthetic-scoped-contract", private: true }, scopedRoot);
  await put("node_modules/@next/eslint-plugin-next/package.json", { name: "@next/eslint-plugin-next", version: "16.4.0" }, scopedRoot);
  await assert.rejects(verifyRuntime(scopedRoot, "backend"), /affected dependency/); checks += 1;
  return { mode: "self-test", checks, status: "passed", fixtureDirectory: path.relative(repositoryRoot, root) };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--self-test") return selfTest();
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--mode", "--runtime-root", "--component"].includes(args[index]) || !args[index + 1] || options.has(args[index])) {
      throw new Error("Usage: --mode source | --mode runtime --runtime-root PATH [--component all|frontend|backend], or --self-test.");
    }
    options.set(args[index], args[index + 1]);
  }
  if (options.get("--mode") === "source" && options.size === 1) return verifySource(repositoryRoot);
  if (options.get("--mode") === "runtime" && options.has("--runtime-root")) {
    return verifyRuntime(path.resolve(options.get("--runtime-root")), options.get("--component") ?? "all");
  }
  throw new Error("An explicit source or runtime mode is required; source checks cannot prove deployment isolation.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    // Do not echo arbitrary JSON contents or raw module diagnostics into release logs.
    console.error(JSON.stringify({ status: "failed", reason: error.code === "ENOENT" ? "Required manifest, installed dependencies or compiled runtime artifact is missing." : error.message }));
    process.exitCode = 1;
  });
}
