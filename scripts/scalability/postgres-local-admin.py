"""Private-stdin local fixture provisioning with PostgreSQL's official libpq.

Never pass credentials as arguments or emit SQL, passwords, SCRAM verifiers,
connection errors or arbitrary server notices. This helper creates only a new
mu_scale database/role pair; it never resets, drops or changes the owner's DB.
"""
import ctypes
import json
import os
import re
import sys


class BoundaryFailure(Exception):
    def __init__(self, stage, sql_state=None):
        self.stage = stage
        self.sql_state = sql_state


class Postgres:
    def __init__(self, parameters, library_directory):
        self.dll_directory = os.add_dll_directory(library_directory) if os.name == "nt" else None
        self.lib = ctypes.CDLL(os.path.join(library_directory, "libpq.dll"))
        self.lib.PQconnectdbParams.argtypes = [ctypes.POINTER(ctypes.c_char_p), ctypes.POINTER(ctypes.c_char_p), ctypes.c_int]
        self.lib.PQconnectdbParams.restype = ctypes.c_void_p
        self.lib.PQstatus.argtypes = [ctypes.c_void_p]
        self.lib.PQstatus.restype = ctypes.c_int
        self.lib.PQfinish.argtypes = [ctypes.c_void_p]
        self.lib.PQexec.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
        self.lib.PQexec.restype = ctypes.c_void_p
        self.lib.PQexecParams.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(ctypes.c_char_p), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
        self.lib.PQexecParams.restype = ctypes.c_void_p
        self.lib.PQresultStatus.argtypes = [ctypes.c_void_p]
        self.lib.PQresultStatus.restype = ctypes.c_int
        self.lib.PQresultErrorField.argtypes = [ctypes.c_void_p, ctypes.c_int]
        self.lib.PQresultErrorField.restype = ctypes.c_char_p
        self.lib.PQclear.argtypes = [ctypes.c_void_p]
        self.lib.PQntuples.argtypes = [ctypes.c_void_p]
        self.lib.PQntuples.restype = ctypes.c_int
        self.lib.PQgetvalue.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
        self.lib.PQgetvalue.restype = ctypes.c_char_p
        self.lib.PQencryptPasswordConn.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p]
        self.lib.PQencryptPasswordConn.restype = ctypes.c_void_p
        self.lib.PQescapeIdentifier.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_size_t]
        self.lib.PQescapeIdentifier.restype = ctypes.c_void_p
        self.lib.PQescapeLiteral.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_size_t]
        self.lib.PQescapeLiteral.restype = ctypes.c_void_p
        self.lib.PQfreemem.argtypes = [ctypes.c_void_p]
        self.lib.PQlibVersion.restype = ctypes.c_int
        self.notice_callback = ctypes.CFUNCTYPE(None, ctypes.c_void_p, ctypes.c_char_p)(lambda _arg, _message: None)
        self.lib.PQsetNoticeProcessor.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]
        self.lib.PQsetNoticeProcessor.restype = ctypes.c_void_p
        parameters = {**parameters, "connect_timeout": "5", "application_name": "mu_scale_fixture_provisioner"}
        keys = (ctypes.c_char_p * (len(parameters) + 1))(*[key.encode() for key in parameters], None)
        values = (ctypes.c_char_p * (len(parameters) + 1))(*[str(value).encode() for value in parameters.values()], None)
        self.connection = self.lib.PQconnectdbParams(keys, values, 0)
        if not self.connection or self.lib.PQstatus(self.connection) != 0:
            self.close()
            raise BoundaryFailure("operator_connection")
        self.lib.PQsetNoticeProcessor(self.connection, self.notice_callback, None)

    def close(self):
        if getattr(self, "connection", None):
            self.lib.PQfinish(self.connection)
            self.connection = None

    def query(self, sql, stage, parameters=None):
        if parameters is None:
            result = self.lib.PQexec(self.connection, sql.encode())
        else:
            values = (ctypes.c_char_p * len(parameters))(*[str(value).encode() for value in parameters])
            result = self.lib.PQexecParams(self.connection, sql.encode(), len(parameters), None, values, None, None, 0)
        if not result:
            raise BoundaryFailure(stage)
        try:
            if self.lib.PQresultStatus(result) not in (1, 2):
                state = self.lib.PQresultErrorField(result, ord("C"))
                raise BoundaryFailure(stage, state.decode() if state else None)
            return [[self.lib.PQgetvalue(result, row, column).decode() for column in range(3)]
                    for row in range(self.lib.PQntuples(result))] if stage == "operator_guard" else self.lib.PQntuples(result)
        finally:
            self.lib.PQclear(result)

    def allocated(self, pointer):
        if not pointer:
            raise BoundaryFailure("official_password_or_identifier_helper")
        try:
            return ctypes.string_at(pointer).decode()
        finally:
            self.lib.PQfreemem(pointer)

    def identifier(self, name):
        value = name.encode()
        return self.allocated(self.lib.PQescapeIdentifier(self.connection, value, len(value)))

    def password_literal(self, password, role):
        # The same official SCRAM helper used by PostgreSQL clients; no custom crypto.
        verifier = self.allocated(self.lib.PQencryptPasswordConn(self.connection, password.encode(), role.encode(), b"scram-sha-256"))
        if not verifier.startswith("SCRAM-SHA-256$"):
            raise BoundaryFailure("scram_password_helper")
        encoded = verifier.encode()
        return self.allocated(self.lib.PQescapeLiteral(self.connection, encoded, len(encoded)))


def main():
    payload = json.load(sys.stdin)
    if payload.get("operation") != "provision_new_fixture":
        raise BoundaryFailure("operation_guard")
    parameters = payload["operator"]
    allowed = {"host", "port", "user", "password", "dbname"}
    if not isinstance(parameters, dict) or set(parameters) != allowed or any(not isinstance(value, str) or not value or len(value) > 1024 or "\x00" in value for value in parameters.values()):
        raise BoundaryFailure("operator_parameter_allowlist")
    if parameters.get("host") not in ("localhost", "127.0.0.1", "::1") or parameters.get("dbname") != "postgres" or not re.fullmatch(r"[0-9]{1,5}", parameters["port"]) or not 1 <= int(parameters["port"]) <= 65535:
        raise BoundaryFailure("loopback_operator_guard")
    expected_library = os.path.realpath("C:/Program Files/PostgreSQL/16/bin")
    if os.name != "nt" or os.path.normcase(os.path.realpath(payload.get("libraryDirectory", ""))) != os.path.normcase(expected_library):
        raise BoundaryFailure("installed_library_guard")
    database = payload["database"]
    if not re.fullmatch(r"mu_scale_[a-z0-9_]{8,35}", database):
        raise BoundaryFailure("database_name_guard")
    runtime, migrator = database + "_runtime", database + "_migration"
    passwords = payload["passwords"]
    if any(not re.fullmatch(r"[A-Za-z0-9_-]{43}", passwords.get(role, "")) for role in (runtime, migrator)):
        raise BoundaryFailure("generated_password_guard")
    pg = Postgres(parameters, expected_library)
    try:
        guard = pg.query("SELECT current_database(), rolsuper::text, current_setting('server_version_num') FROM pg_roles WHERE rolname = current_user", "operator_guard")
        if len(guard) != 1 or guard[0][:2] != ["postgres", "true"]:
            raise BoundaryFailure("operator_superuser_required")
        server_version = int(guard[0][2])
        if not 160015 <= server_version < 170000:
            raise BoundaryFailure("reviewed_patched_fixture_server_required")
        if pg.query("SELECT 1 FROM pg_database WHERE datname = $1", "fresh_database_guard", [database]) or pg.query("SELECT 1 FROM pg_roles WHERE rolname IN ($1, $2)", "fresh_roles_guard", [runtime, migrator]):
            raise BoundaryFailure("refuse_existing_database_or_roles")
        pg.query("BEGIN", "begin_role_creation")
        for role in (runtime, migrator):
            pg.query("CREATE ROLE " + pg.identifier(role) + " LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD " + pg.password_literal(passwords[role], role), "create_new_role")
        pg.query("COMMIT", "commit_role_creation")
        pg.query("CREATE DATABASE " + pg.identifier(database) + " OWNER " + pg.identifier(migrator) + " TEMPLATE template0 ENCODING 'UTF8'", "create_new_database")
        pg.query("REVOKE ALL ON DATABASE " + pg.identifier(database) + " FROM PUBLIC", "revoke_database_public")
        pg.query("GRANT CONNECT ON DATABASE " + pg.identifier(database) + " TO " + pg.identifier(runtime) + ", " + pg.identifier(migrator), "grant_fixture_connect")
        print(json.dumps({"status": "created", "database": database, "runtimeRole": runtime, "migrationRole": migrator, "libpqVersion": pg.lib.PQlibVersion(), "serverVersionNumber": server_version}))
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
        print(json.dumps({"status": "failed", "stage": "private_input_or_library_guard"}))
        sys.exit(1)
