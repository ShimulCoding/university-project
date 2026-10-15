import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function prismaGrantManifest(source) {
  const enums = Object.fromEntries([...source.matchAll(/^enum (\w+) \{\s*([\s\S]*?)^\}/gm)].map(([, name, body]) => {
    const values = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    assert(values.length > 0 && values.every((value) => /^[A-Z][A-Z0-9_]*$/.test(value)), "Enum grammar changed; explicit grant review is required");
    return [name, values.sort()];
  }));
  const models = [...source.matchAll(/^model (\w+) \{\s*([\s\S]*?)^\}/gm)];
  assert.equal(models.length, 27, "Current approved grant policy covers exactly 27 application models");
  assert.equal(Object.keys(enums).length, 18, "Current approved grant policy covers exactly 18 enums");
  const names = new Set(models.map(([, name]) => name));
  const scalarTypes = { String: "text", Int: "integer", BigInt: "bigint", Boolean: "boolean", DateTime: "timestamp(3) without time zone", Json: "jsonb" };
  const columns = {};
  for (const [, name, body] of models) {
    assert(!/@@(?:map|id)\b/.test(body), "Mapped tables or compound primary keys require an explicit parser/policy review");
    const fields = {};
    for (const original of body.split(/\r?\n/)) {
      const line = original.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const field = line.match(/^(\w+)\s+(\w+)(\?|\[\])?(.*)$/);
      assert(field, "Model field grammar changed; explicit grant review is required");
      const [, fieldName, typeName, suffix, attributes] = field;
      if (names.has(typeName)) continue;
      assert(suffix !== "[]" && !/@map\b/.test(attributes), "Mapped/scalar-array columns require explicit grant review");
      let type = Object.hasOwn(scalarTypes, typeName) ? scalarTypes[typeName] : (Object.hasOwn(enums, typeName) ? `public."${typeName}"` : null);
      const decimal = attributes.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
      if (typeName === "Decimal") { assert(decimal, "Decimal precision must be explicit"); type = `numeric(${decimal[1]},${decimal[2]})`; }
      const native = attributes.match(/@db\.(\w+)(?:\([^)]*\))?/);
      if (native?.[1] === "Uuid") type = "uuid";
      else if (native?.[1] === "Char") { const character = attributes.match(/@db\.Char\((\d+)\)/); assert(character); type = `character(${character[1]})`; }
      else assert(!native || native[1] === "Decimal", "Unknown native column type requires explicit grant review");
      assert(type, "Unknown scalar column type requires explicit grant review");
      fields[fieldName] = [type, suffix === "?", /@id\b/.test(attributes)];
    }
    assert.equal(Object.values(fields).filter(([, , primary]) => primary).length, 1, "Approved models have one explicit primary-key column");
    columns[name] = fields;
  }
  return { columns, enums };
}

export function verifyCutoverGrantSource(sql, prismaSource) {
  const manifest = prismaGrantManifest(prismaSource);
  const columns = sql.match(/\$column_manifest\$([\s\S]*?)\$column_manifest\$::jsonb/);
  const enums = sql.match(/\$enum_manifest\$([\s\S]*?)\$enum_manifest\$::jsonb/);
  assert(columns && enums, "Explicit column/type/PK/enum manifests are required");
  assert.deepEqual(JSON.parse(columns[1]), manifest.columns, "Cutover typed-column manifest must match the reviewed Prisma schema");
  assert.deepEqual(JSON.parse(enums[1]), manifest.enums, "Cutover enum manifest must match the reviewed Prisma schema");
  const code = sql.replace(/^\s*--.*$/gm, "");
  const requirements = [
    "\\set ON_ERROR_STOP on", "BEGIN;", "SET LOCAL search_path = pg_catalog;", "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '30s';", "COMMIT;",
    "current_database() <> database_name", "current_user <> operator_name OR session_user <> operator_name",
    "current_setting('security_cutover.reviewed_policy') <> '2026-10-12-column-grants-v1'",
    "rolname = runtime_name", "rolname = migration_name AND rolcanlogin", "rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls",
    "pg_get_userbyid(datdba)", "migration_name", "pg_database_owner", "c.relowner <> migration_oid", "t.typowner <> migration_oid",
    "actual_columns IS DISTINCT FROM expected_columns", "actual_enums IS DISTINCT FROM expected_enums", "actual_tables IS DISTINCT FROM expected_tables",
    "format_type(a.atttypid, a.atttypmod)", "a.attgenerated <> '' OR a.attidentity <> ''", "c.relkind <> 'r' OR c.relispartition", "pg_inherits", "pg_proc", "pg_trigger", "NOT t.tgisinternal", "pg_rewrite",
    "LOCK TABLE public.%I IN SHARE UPDATE EXCLUSIVE MODE", "aclexplode", "acldefault", "pg_default_acl", "acl.grantee = 0", "acl.privilege_type IN ('CREATE', 'TEMPORARY')",
    "WITH RECURSIVE history_parents", "fk.confrelid", "fk.confkey", "i.indisprimary", "a.attnum = ANY(i.indkey)", "a.attnum = ANY(fk.confkey)",
    "CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS",
    "GRANT SELECT, INSERT ON TABLE public.%I TO %I", "GRANT UPDATE (%s) ON TABLE public.%I TO %I",
    "target.table_name NOT IN ('AuditLog', 'FinancialIdempotency')",
    "GRANT DELETE ON TABLE public.\"RefreshToken\", public.\"PasswordResetToken\", public.\"MfaChallenge\" TO %I",
    "has_database_privilege(runtime_name, database_name, 'TEMP, CREATE')", "has_schema_privilege(runtime_name, 'public', 'CREATE')",
    "has_table_privilege(runtime_name, c.oid, 'UPDATE')", "has_column_privilege(runtime_name, c.oid, a.attnum, 'UPDATE')",
    "has_table_privilege(runtime_name, 'public.\"_prisma_migrations\"', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')",
    "runtime_name, c.oid, 'TRUNCATE, REFERENCES, TRIGGER, SELECT WITH GRANT OPTION, INSERT WITH GRANT OPTION, UPDATE WITH GRANT OPTION, DELETE WITH GRANT OPTION'",
    "SELECT 1 FROM pg_class c WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'",
  ];
  for (const value of requirements) assert(code.includes(value), "Required cutover scope/privilege fence is missing");
  for (const parameter of ["database_name", "runtime_role", "migration_role", "operator_role", "reviewed_policy"]) assert(code.includes(`\\if :{?${parameter}}`), "Cutover requires every explicit operator parameter");
  assert(!/\\quit\s+\d/.test(code), "PostgreSQL16 psql does not provide a quit-status parameter");
  assert.equal((code.match(/DO \$missing\$ BEGIN RAISE EXCEPTION/g) ?? []).length, 5, "Every missing parameter must use supported fail-closed PostgreSQL16 syntax");
  assert(code.indexOf("actual_columns IS DISTINCT FROM expected_columns") < code.indexOf("CREATE ROLE %I LOGIN"), "Scope/type guards must precede role creation");
  assert(code.indexOf("LOCK TABLE public.%I IN SHARE UPDATE EXCLUSIVE MODE") < code.indexOf("actual_columns IS DISTINCT FROM expected_columns"), "Typed-column validation must occur under relation locks");
  assert(!/\bGRANT\s+(?:ALL|[^;']*\bUPDATE\s+ON\s+TABLE)/i.test(code), "Table-wide UPDATE/ALL grants are forbidden");
  assert(!/ALTER\s+DEFAULT\s+PRIVILEGES|\b(?:DROP|TRUNCATE)\s+(?:TABLE|SCHEMA|DATABASE)|\b(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+public\./i.test(code), "Cutover must not modify records or default/future permissions");
  assert(!/REVOKE\s+[^;]*\sFROM\s+PUBLIC|REASSIGN\s+OWNED|ALTER\s+(?:TABLE|SCHEMA|DATABASE|TYPE)\s+[^;]*OWNER\s+TO/i.test(code), "Shared privileges and ownership require separate approved preparation");
  assert(!/CREATE\s+ROLE[^;']*(?:PASSWORD|SUPERUSER\s+(?!NOCREATEDB))/i.test(code), "No credential or elevated new-runtime role is allowed");
  return { applicationTables: Object.keys(manifest.columns).length, columns: Object.values(manifest.columns).reduce((sum, value) => sum + Object.keys(value).length, 0), enums: Object.keys(manifest.enums).length };
}

async function main() {
  const [sql, schema] = await Promise.all([readFile(path.join(root, "docs/security-runtime-grants.sql"), "utf8"), readFile(path.join(root, "backend/prisma/schema.prisma"), "utf8")]);
  const coverage = verifyCutoverGrantSource(sql, schema);
  let checks = 1;
  const rejects = (change) => { assert.throws(() => verifyCutoverGrantSource(change(sql), schema)); checks++; };
  for (const marker of [
    "current_database() <> database_name", "current_user <> operator_name OR session_user <> operator_name",
    "actual_columns IS DISTINCT FROM expected_columns", "actual_enums IS DISTINCT FROM expected_enums", "actual_tables IS DISTINCT FROM expected_tables",
    "c.relowner <> migration_oid", "t.typowner <> migration_oid", "a.attnum = ANY(i.indkey)", "a.attnum = ANY(fk.confkey)",
    "WITH RECURSIVE history_parents", "aclexplode", "pg_default_acl", "LOCK TABLE public.%I IN SHARE UPDATE EXCLUSIVE MODE",
    "NOREPLICATION", "target.table_name NOT IN ('AuditLog', 'FinancialIdempotency')",
  ]) rejects((text) => text.replaceAll(marker, "REMOVED_SECURITY_FENCE"));
  rejects((text) => text + '\nGRANT UPDATE ON TABLE public."User" TO "synthetic_runtime";');
  rejects((text) => text + '\nGRANT ALL ON TABLE public."AuditLog" TO "synthetic_runtime";');
  rejects((text) => text + '\nALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO "synthetic_runtime";');
  rejects((text) => text + '\nREVOKE ALL ON DATABASE "synthetic" FROM PUBLIC;');
  rejects((text) => text + '\nALTER TABLE public."User" OWNER TO "synthetic_runtime";');
  rejects((text) => text + '\nDELETE FROM public."AuditLog";');
  rejects((text) => text.replace("DO $missing$ BEGIN RAISE EXCEPTION", "\\quit 3 -- removed missing-parameter error"));
  rejects((text) => text.replace("SELECT 1 FROM pg_class c WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'", "SELECT 1 FROM pg_class c WHERE c.relnamespace = public_oid AND c.relname <> '_prisma_migrations'"));
  rejects((text) => text.replace('"numeric(18,2)"', '"numeric(12,2)"'));
  rejects((text) => text.replace('"character(64)"', '"text"'));
  rejects((text) => text.replace('"id":["text",false,true]', '"id":["text",false,false]'));
  assert.throws(() => verifyCutoverGrantSource(sql, schema.replace("@db.Decimal(18, 2)", "@db.Decimal(19, 2)"))); checks++;
  assert.throws(() => verifyCutoverGrantSource(sql, schema.replace("  fullName", "  unreviewedColumn String?\n  fullName"))); checks++;
  console.log(JSON.stringify({ status: "passed", checks, ...coverage, actualDatabaseConnections: 0, sqlStatementsExecuted: 0, privateFilesRead: 0, scope: "source drift and mutation contracts; PostgreSQL integration remains required" }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error(JSON.stringify({ status: "failed", details: "Source grant contract failed; no SQL or private configuration was executed" })); process.exitCode = 1; });
