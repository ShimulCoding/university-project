"""Create fresh private Linux mounts for the approved fake-only pooler.

Windows owner ACLs do not establish Linux mode isolation on a DrvFS mount.
Inputs travel on stdin, never process arguments or output. Nothing is deleted.
"""
import json
import os
import pathlib
import re
import stat
import sys

BASE = pathlib.Path('/var/lib/university-project-test-pooler')


def validate(value):
    if not isinstance(value, dict) or set(value) != {'run', 'config', 'auth'}:
        raise ValueError('Explicit fake mount inputs required')
    if not re.fullmatch(r'mu-scale-local-pg-\d{8}-[a-f0-9]{8}-pooler-[a-f0-9]{32}', value['run']):
        raise ValueError('Fresh owned run required')
    if not isinstance(value['config'], str) or len(value['config']) > 4096:
        raise ValueError('Bounded fake configuration required')
    match = re.match(r'^\[databases\]\n(mu_scale_[a-z0-9_]{8,35}) = host=postgres port=5432 dbname=\1\n', value['config'])
    if not match or 'auth_type = scram-sha-256\n' not in value['config'] or '* =' in value['config'] or 'password=' in value['config'] or ' user=' in value['config']:
        raise ValueError('Runtime-only fake mapping required')
    database = match.group(1)
    if not isinstance(value['auth'], str) or not re.fullmatch(r'"' + re.escape(database) + r'_runtime" "SCRAM-SHA-256\$4096:[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=:[A-Za-z0-9+/]{43}="\n', value['auth']):
        raise ValueError('One fake runtime SCRAM verifier required')
    return BASE / value['run']


def install(value):
    directory = validate(value)
    if sys.platform != 'linux' or os.geteuid() != 0:
        raise ValueError('Approved local Linux operator required')
    try:
        os.mkdir(BASE, 0o700)
    except FileExistsError:
        pass
    info = os.lstat(BASE)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError('Private native root required')
    os.mkdir(directory, 0o700)  # Exclusive: never replace an existing run.
    for name, content in [('pgbouncer.ini', value['config']), ('auth.txt', value['auth'])]:
        destination = directory / name
        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o400)
        try:
            os.fchown(fd, 10001, 10001)
            os.fchmod(fd, 0o400)
            with os.fdopen(fd, 'w', encoding='utf-8', closefd=False) as output:
                output.write(content)
                output.flush()
                os.fsync(fd)
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != 10001 or info.st_gid != 10001 or stat.S_IMODE(info.st_mode) != 0o400:
                raise ValueError('Private mount ownership failed')
        finally:
            os.close(fd)
    return {'directory': str(directory), 'uid': 10001, 'gid': 10001, 'mode': '0400', 'existingFilesChanged': False}


def self_test():
    value = {'run': 'mu-scale-local-pg-20261012-12345678-pooler-' + 'a' * 32,
             'config': '[databases]\nmu_scale_contract_00000000 = host=postgres port=5432 dbname=mu_scale_contract_00000000\n\n[pgbouncer]\nauth_type = scram-sha-256\n',
             'auth': '"mu_scale_contract_00000000_runtime" "SCRAM-SHA-256$4096:' + 'A' * 22 + '==$' + 'A' * 43 + '=:' + 'A' * 43 + '="\n'}
    assert validate(value).parent == BASE
    mutations = [('run', '../owner'), ('run', value['run'] + '/child'), ('config', 'owner'), ('config', value['config'] + '* = host=owner\n'), ('auth', 'plaintext'), ('auth', value['auth'] + value['auth']), ('auth', value['auth'].replace('_runtime', '_migration'))]
    for key, replacement in mutations:
        candidate = dict(value)
        candidate[key] = replacement
        try:
            validate(candidate)
        except ValueError:
            continue
        raise AssertionError('Unsafe fake mount input accepted')
    return {'status': 'passed', 'checks': len(mutations) + 1, 'scope': 'pure inputs only; no filesystem, identity, secret or database access'}


if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['--self-test']:
            result = self_test()
        elif not sys.argv[1:]:
            raw = sys.stdin.buffer.read(8193)
            if len(raw) > 8192:
                raise ValueError('Bounded input required')
            result = install(json.loads(raw))
        else:
            raise ValueError('No credential arguments accepted')
        print(json.dumps(result))
    except Exception:
        print(json.dumps({'status': 'failed', 'privateDiagnosticsSuppressed': True}), file=sys.stderr)
        sys.exit(1)
