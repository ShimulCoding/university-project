"""Private-stdin setup for new fake-only cutover acceptance, not owner cutover."""
import importlib.util
import json
import os
import pathlib
import re
import sys

source = pathlib.Path(__file__).with_name("postgres-local-admin.py")
spec = importlib.util.spec_from_file_location("approved_libpq_fixture", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
BoundaryFailure, Postgres = module.BoundaryFailure, module.Postgres


def literal(pg, value):
    encoded = value.encode()
    return pg.allocated(pg.lib.PQescapeLiteral(pg.connection, encoded, len(encoded)))


def main():
    payload = json.load(sys.stdin)
    operation = payload.get("operation")
    if operation not in ("create_migration_only_fixture", "set_unset_new_runtime_password"):
        raise BoundaryFailure("cutover_operation_guard")
    parameters = payload.get("operator")
    keys = {"host", "port", "user", "password", "dbname"}
    if not isinstance(parameters, dict) or set(parameters) != keys or any(not isinstance(value, str) or not value or len(value) > 1024 or "\x00" in value for value in parameters.values()):
        raise BoundaryFailure("cutover_operator_parameter_guard")
    if parameters["host"] != "127.0.0.1" or parameters["port"] != "15432" or parameters["dbname"] != "postgres":
        raise BoundaryFailure("cutover_exact_loopback_guard")
    expected_library = os.path.realpath("C:/Program Files/PostgreSQL/16/bin")
    if os.name != "nt" or os.path.normcase(os.path.realpath(payload.get("libraryDirectory", ""))) != os.path.normcase(expected_library):
        raise BoundaryFailure("cutover_installed_library_guard")
    database = payload.get("database", "")
    if not isinstance(database, str) or not re.fullmatch(r"mu_scale_[a-f0-9]{32}", database):
        raise BoundaryFailure("cutover_new_database_name_guard")
    runtime, migrator = database + "_runtime", database + "_migration"
    passwords = payload.get("passwords", {})
    if not isinstance(passwords, dict) or set(passwords) != {runtime, migrator} or any(not isinstance(passwords[role], str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", passwords[role]) for role in (runtime, migrator)):
        raise BoundaryFailure("cutover_generated_password_guard")
    pg = Postgres(parameters, expected_library)
    try:
        identity = pg.query("SELECT current_database(), current_user, current_setting('server_version_num')", "operator_guard")
        if len(identity) != 1 or identity[0][:2] != ["postgres", parameters["user"]] or identity[0][2] != "160015" or pg.query("SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper AND rolcanlogin", "cutover_actual_operator_flags") != 1:
            raise BoundaryFailure("cutover_actual_operator_identity")
        if operation == "create_migration_only_fixture":
            if pg.query("SELECT 1 FROM pg_database WHERE datname = $1", "cutover_fresh_database", [database]) or pg.query("SELECT 1 FROM pg_roles WHERE rolname IN ($1,$2)", "cutover_fresh_roles", [runtime, migrator]):
                raise BoundaryFailure("cutover_refuse_existing_scope")
            pg.query("BEGIN", "cutover_begin_migration_role")
            pg.query("CREATE ROLE " + pg.identifier(migrator) + " LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD " + pg.password_literal(passwords[migrator], migrator), "cutover_create_new_migration_role")
            pg.query("COMMIT", "cutover_commit_new_migration_role")
            pg.query("CREATE DATABASE " + pg.identifier(database) + " OWNER " + pg.identifier(migrator) + " TEMPLATE template0 ENCODING 'UTF8'", "cutover_create_new_database")
            pg.query("COMMENT ON DATABASE " + pg.identifier(database) + " IS " + literal(pg, "isolated_fake_cutover_acceptance:" + database), "cutover_mark_owned_database")
            # This revocation applies only to the just-created, empty fake database.
            pg.query("REVOKE ALL ON DATABASE " + pg.identifier(database) + " FROM PUBLIC", "cutover_new_database_public_policy")
            pg.query("GRANT CONNECT ON DATABASE " + pg.identifier(database) + " TO " + pg.identifier(migrator), "cutover_new_migrator_connect")
            if pg.query("SELECT 1 FROM pg_roles WHERE rolname = $1", "cutover_runtime_must_remain_absent", [runtime]):
                raise BoundaryFailure("cutover_unexpected_precreated_runtime")
        else:
            if pg.query("SELECT 1 FROM pg_database WHERE datname=$1 AND pg_get_userbyid(datdba)=$2 AND shobj_description(oid,'pg_database')=$3", "cutover_owned_database_marker", [database, migrator, "isolated_fake_cutover_acceptance:" + database]) != 1:
                raise BoundaryFailure("cutover_owned_database_guard")
            if pg.query("SELECT 1 FROM pg_authid WHERE rolname=$1 AND rolcanlogin AND rolpassword IS NULL AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls)", "cutover_unset_new_runtime_password_guard", [runtime]) != 1:
                raise BoundaryFailure("cutover_refuse_existing_password_or_policy")
            if pg.query("SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1) OR roleid=(SELECT oid FROM pg_roles WHERE rolname=$1)", "cutover_runtime_membership_guard", [runtime]):
                raise BoundaryFailure("cutover_runtime_membership_guard")
            pg.query("ALTER ROLE " + pg.identifier(runtime) + " PASSWORD " + pg.password_literal(passwords[runtime], runtime), "cutover_set_only_unset_new_password")
        print(json.dumps({"status": "created_migration_only" if operation == "create_migration_only_fixture" else "set_new_runtime_password", "database": database, "serverVersionNumber": 160015, "libpqVersion": pg.lib.PQlibVersion()}))
    finally:
        pg.close()


if __name__ == "__main__":
    try:
        main()
    except BoundaryFailure as failure:
        result = {"status": "failed", "stage": failure.stage}
        if failure.sql_state and re.fullmatch(r"[0-9A-Z]{5}", failure.sql_state):
            result["sqlState"] = failure.sql_state
        print(json.dumps(result))
        sys.exit(1)
    except Exception:
        print(json.dumps({"status": "failed", "stage": "cutover_private_input_or_library_guard"}))
        sys.exit(1)
