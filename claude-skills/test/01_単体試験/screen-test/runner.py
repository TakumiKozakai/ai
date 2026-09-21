"""Run fixed Playwright scenarios and collect independent DB/AWS evidence."""
import argparse
import html
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from uuid import uuid4
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def command(args, *, env=None, stdin=None, timeout=90):
    # No shell interpolation; do not persist credentials or command stderr.
    process = subprocess.Popen(args, cwd=ROOT, env=env, stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, start_new_session=True)
    try:
        stdout, stderr = process.communicate(stdin, timeout=timeout)
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
        raise RuntimeError(f'{Path(args[0]).name}: timed out or interrupted') from None
    if process.returncode:
        raise RuntimeError(f'{Path(args[0]).name}: exit {process.returncode}; '
                           '接続設定・権限を確認してください（秘密情報保護のためstderrは非保存）')
    return stdout


def validate(config):
    parsed = urlsplit(config['baseUrl'])
    origin = f'{parsed.scheme}://{parsed.netloc}'
    if parsed.scheme not in ('http', 'https') or parsed.username or parsed.password:
        raise ValueError('baseUrl must be an HTTP(S) URL without credentials')
    if origin not in config['allowedOrigins']:
        raise ValueError('baseUrl is not in allowedOrigins')
    db = config['database']
    for key in ('host', 'name', 'user'):
        if not isinstance(db.get(key), str) or not db[key]:
            raise ValueError(f'database.{key} is required')
    if not config.get('cases'):
        raise ValueError('cases must not be empty')
    ids = set()
    uses_aws = False
    for case in config['cases']:
        if not re.fullmatch(r'[A-Za-z0-9_-]+', case['id']) or case['id'] in ids:
            raise ValueError('case id must be unique and path-safe')
        ids.add(case['id'])
        spec = (ROOT / 'specs' / case['spec']).resolve()
        if not spec.is_relative_to(ROOT / 'specs') or not spec.is_file():
            raise ValueError('spec must be a file under specs/')
        if not case.get('title'):
            raise ValueError('case.title is required')
        query = case['database']['query'].strip()
        # This is a single SELECT expression, never a psql script.
        if not re.match(r'^SELECT\s', query, re.I) or ';' in query or '\\' in query:
            raise ValueError('database.query must be a single SELECT without semicolons/backslashes')
        if not case['database'].get('unchanged') and 'expectedAfter' not in case['database']:
            raise ValueError('database requires unchanged or expectedAfter')
        for source in ('s3', 'ec2'):
            options = case.get(source)
            if options is None:
                raise ValueError(f'{source}: configuration or notApplicable reason is required')
            if 'notApplicable' in options:
                if not isinstance(options['notApplicable'], str) or not options['notApplicable'].strip():
                    raise ValueError('notApplicable requires a reason')
                continue
            uses_aws = True
            if source == 's3':
                if not options.get('bucket') or not isinstance(options.get('prefix'), str):
                    raise ValueError('s3 requires bucket and prefix')
                if not isinstance(options.get('expectedKeys'), list) or not options['expectedKeys']:
                    raise ValueError('s3.expectedKeys must contain expected object keys')
                if not all(isinstance(k, str) and k.startswith(options['prefix']) for k in options['expectedKeys']):
                    raise ValueError('expectedKeys must be within prefix')
            else:
                if not re.fullmatch(r'i-[0-9a-f]{8,17}', options.get('instanceId', '')):
                    raise ValueError('ec2.instanceId must be an EC2 instance id')
                if not options.get('logPath', '').startswith('/') or '\n' in options['logPath']:
                    raise ValueError('ec2.logPath must be an absolute single-line path')
                if type(options.get('lines')) is not int or not 1 <= options['lines'] <= 1000:
                    raise ValueError('ec2.lines must be between 1 and 1000')
                if not options.get('contains') or not all(isinstance(s, str) and s for s in options['contains']):
                    raise ValueError('ec2.contains must contain expected log strings')
    if uses_aws:
        aws = config.get('aws', {})
        if not re.fullmatch(r'\d{12}', aws.get('accountId', '')):
            raise ValueError('aws.accountId must be the expected 12-digit account id')
        if not aws.get('profile') or not aws.get('region'):
            raise ValueError('aws.profile and aws.region are required')
    return uses_aws


def db_snapshot(config, case):
    db = config['database']
    env = dict(os.environ)
    # libpq reads the password from PGPASSFILE/~/.pgpass, not argv.
    env.update(PGHOST=db['host'], PGDATABASE=db['name'], PGUSER=db['user'],
               PGPORT=str(db.get('port', 5432)), PGCONNECT_TIMEOUT='10',
               PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=30000')
    sql = ('BEGIN READ ONLY;\n'
           "SELECT json_build_object('database',current_database(),'user',current_user,"
           "'rows',COALESCE(json_agg(row_to_json(snapshot)), '[]'::json)) "
           f"FROM ({case['database']['query']}) AS snapshot;\nROLLBACK;\n")
    data = json.loads(command(['psql', '-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1'],
                              env=env, stdin=sql))
    if data['database'] != db['name'] or data['user'] != db['user']:
        raise RuntimeError('Unexpected database or user')
    return data['rows']


def aws_call(config, args):
    aws = config['aws']
    env = dict(os.environ, AWS_PAGER='', AWS_CLI_AUTO_PROMPT='off')
    output = command(['aws', '--profile', aws['profile'], '--region', aws['region'],
                      '--output', 'json', '--no-cli-pager', '--cli-connect-timeout', '10',
                      '--cli-read-timeout', '30', *args], env=env, timeout=120)
    return json.loads(output)


def s3_snapshot(config, options):
    # AWS CLI auto-pagination remains enabled; never silently inspect only page 1.
    data = aws_call(config, ['s3api', 'list-objects-v2', '--bucket', options['bucket'],
                            '--prefix', options['prefix']])
    return data


def ec2_log(config, options, directory):
    remote = f"tail -n {options['lines']} -- {shlex.quote(options['logPath'])}"
    sent = aws_call(config, ['ssm', 'send-command', '--instance-ids', options['instanceId'],
                            '--document-name', 'AWS-RunShellScript', '--timeout-seconds', '120',
                            '--parameters', json.dumps({'commands': [remote], 'executionTimeout': ['60']})])
    command_id = sent['Command']['CommandId']
    save(directory / 'ssm-command.json', {'commandId': command_id, 'command': remote})
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        # list-command-invocations returns [] while the invocation propagates.
        result = aws_call(config, ['ssm', 'list-command-invocations', '--command-id', command_id,
                                  '--instance-id', options['instanceId'], '--details'])
        invocations = result.get('CommandInvocations', [])
        if invocations:
            invocation = invocations[0]
            status = invocation['Status']
            if status == 'Success':
                detail = aws_call(config, ['ssm', 'get-command-invocation', '--command-id', command_id,
                                          '--instance-id', options['instanceId']])
                save(directory / 'ec2.json', detail)
                output = detail.get('StandardOutputContent', '')
                (directory / 'ec2.log').write_text(output, encoding='utf-8')
                if detail.get('ResponseCode') != 0 or detail.get('Status') != 'Success':
                    raise RuntimeError('SSM command did not finish successfully')
                if len(output) >= 24000:
                    raise RuntimeError('SSM output may be truncated; reduce ec2.lines')
                return output
            if status not in ('Pending', 'InProgress', 'Delayed'):
                save(directory / 'ec2.json', invocation)
                raise RuntimeError(f'SSM command ended with {status}')
        time.sleep(2)
    raise RuntimeError(f'SSM wait timed out; inspect command {command_id}')


def attempt(results, name, action):
    record = {'name': name, 'startedAt': timestamp()}
    results.append(record)
    try:
        value = action()
        record['status'] = 'PASS'
        return value
    except Exception as error:
        record.update(status='FAIL', error=str(error))
        return None
    finally:
        record['endedAt'] = timestamp()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def browser(case, config, directory):
    env = dict(os.environ, TEST_BASE_URL=config['baseUrl'], EVIDENCE_DIR=str(directory))
    cli = ROOT / 'node_modules' / '@playwright' / 'test' / 'cli.js'
    try:
        output = command(['node', str(cli), 'test', case['spec'], '--grep',
                          re.escape(case['title']) + '$'], env=env, timeout=180)
        (directory / 'playwright.stdout.txt').write_text(output, encoding='utf-8')
    finally:
        # Playwright reports survive assertion failure; absence is an execution failure.
        if not (directory / 'playwright.json').exists():
            raise RuntimeError('Playwright JSON report missing; check Node/browser installation')
    report = json.loads((directory / 'playwright.json').read_text(encoding='utf-8'))
    stats = report['stats']
    require(stats['expected'] == 1 and not any(stats[k] for k in ('unexpected', 'skipped', 'flaky')),
            'Exactly one passing test is required; skipped/zero/multiple tests are not PASS')


def run_case(config, case, directory, aws_ready):
    directory.mkdir(parents=True)
    results = []

    def snapshot(phase):
        rows = db_snapshot(config, case)
        save(directory / f'db-{phase}.json', rows)
        return rows

    before = attempt(results, 'DB before', lambda: snapshot('before'))
    before_ok = results[-1]['status'] == 'PASS'
    if before_ok and 'expectedBefore' in case['database']:
        attempt(results, 'DB before assertion', lambda: require(
            before == case['database']['expectedBefore'], 'DB before differs from expectedBefore'))
        before_ok = results[-1]['status'] == 'PASS'
    try:
        if before_ok and aws_ready:
            attempt(results, 'Browser', lambda: browser(case, config, directory))
        else:
            results.append({'name': 'Browser', 'status': 'NOT_RUN',
                            'reason': 'DB precondition or AWS account verification failed'})
    finally:
        after = attempt(results, 'DB after', lambda: snapshot('after'))
        after_ok = results[-1]['status'] == 'PASS'
        if before_ok and after_ok:
            if case['database'].get('unchanged'):
                attempt(results, 'DB unchanged', lambda: require(before == after, 'DB changed'))
            if 'expectedAfter' in case['database']:
                attempt(results, 'DB after assertion', lambda: require(
                    after == case['database']['expectedAfter'], 'DB after differs from expectedAfter'))
        for source in ('s3', 'ec2'):
            options = case[source]
            if 'notApplicable' in options:
                results.append({'name': source, 'status': 'NOT_APPLICABLE', 'reason': options['notApplicable']})
                continue
            if not aws_ready:
                results.append({'name': source, 'status': 'NOT_RUN', 'reason': 'AWS account verification failed'})
                continue
            if source == 's3':
                def check_s3():
                    data = s3_snapshot(config, options)
                    save(directory / 's3.json', data)
                    keys = {item['Key'] for item in data.get('Contents', [])}
                    require(set(options['expectedKeys']).issubset(keys), 'S3 expected objects missing')
                attempt(results, 'S3', check_s3)
            else:
                def check_ec2():
                    output = ec2_log(config, options, directory)
                    require(all(value in output for value in options['contains']), 'EC2 expected log text missing')
                attempt(results, 'EC2', check_ec2)
    save(directory / 'checks.json', results)
    return results


def report(directory, records):
    failed = any(r['status'] not in ('PASS', 'NOT_APPLICABLE') for r in records)
    data = {'status': 'FAIL' if failed else 'PASS', 'endedAt': timestamp(), 'checks': records}
    save(directory / 'summary.json', data)
    rows = ''.join('<tr>' + ''.join(f'<td>{html.escape(str(r.get(k, "")))}</td>'
                                  for k in ('case', 'name', 'status', 'error', 'reason')) + '</tr>'
                   for r in records)
    links = ''.join(f'<li><a href="{html.escape(p.relative_to(directory).as_posix(), quote=True)}">'
                    f'{html.escape(p.relative_to(directory).as_posix())}</a></li>'
                    for p in sorted(directory.rglob('*')) if p.is_file()
                    and 'playwright-report/data/' not in p.as_posix())
    (directory / 'index.html').write_text(
        '<!doctype html><html lang="ja"><meta charset="utf-8"><title>画面試験結果</title>'
        '<style>body{font-family:sans-serif;margin:2rem}td,th{border:1px solid #ccc;padding:.5rem}'
        'table{border-collapse:collapse}</style>'
        f'<h1>画面試験結果: {data["status"]}</h1><p>NOT_APPLICABLEは対象外であり確認済みではありません。</p>'
        '<table><tr><th>No.</th><th>確認</th><th>結果</th><th>エラー</th><th>理由</th></tr>'
        f'{rows}</table><h2>証跡</h2><ul>{links}</ul></html>', encoding='utf-8')
    return 1 if failed else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path)
    parser.add_argument('--validate', action='store_true', help='Validate only; no DB/AWS/browser access')
    args = parser.parse_args(argv)
    config = json.loads(args.config.read_text(encoding='utf-8'))
    uses_aws = validate(config)
    if args.validate:
        print('Configuration valid (no connections made)')
        return 0
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid4().hex[:8]
    directory = ROOT / 'runs' / run_id
    directory.mkdir(parents=True, mode=0o700)
    save(directory / 'run.json', {'runId': run_id, 'startedAt': timestamp(),
                                 'cases': [c['id'] for c in config['cases']]})
    records = []
    code = 1
    try:
        aws_ready = True
        if uses_aws:
            def identity():
                actual = aws_call(config, ['sts', 'get-caller-identity'])
                save(directory / 'aws-identity.json', actual)
                require(actual['Account'] == config['aws']['accountId'], 'Unexpected AWS account')
            attempt(records, 'AWS identity', identity)
            aws_ready = records[-1]['status'] == 'PASS'
        for case in config['cases']:
            checks = run_case(config, case, directory / case['id'], aws_ready)
            records.extend(dict(check, case=case['id']) for check in checks)
    except (Exception, KeyboardInterrupt) as error:
        records.append({'name': 'Runner', 'status': 'FAIL', 'error': str(error)})
    finally:
        code = report(directory, records)
        print(f'Results: {directory / "index.html"}')
    return code


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(f'Configuration/execution error: {error}', file=sys.stderr)
        sys.exit(2)
