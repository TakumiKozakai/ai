/** Run fixed Playwright scenarios and collect independent DB/log/AWS evidence. */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { appLogCollect, appLogMark } from './appLog.ts';
import { awsCall, ec2Log, s3Snapshot } from './aws.ts';
import { browser } from './browser.ts';
import { isNotApplicable, loadConfig, validate } from './config.ts';
import type { AppLogOptions, CaseConfig, Config, Ec2Options, NamedRows, S3Options } from './config.ts';
import { dbSnapshot, seed } from './db.ts';
import type { SeedResult } from './db.ts';
import { save } from './files.ts';
import { ROOT } from './paths.ts';
import { interruptAll } from './process.ts';

export type Status = 'PASS' | 'FAIL' | 'NOT_RUN' | 'NOT_APPLICABLE';

export interface CheckRecord {
  name: string;
  status?: Status;
  case?: string;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  reason?: string;
}

// Every external access goes through here so unit tests can replace it.
export interface Collectors {
  seed: (config: Config, kase: CaseConfig) => Promise<SeedResult>;
  dbSnapshot: (config: Config, kase: CaseConfig) => Promise<NamedRows>;
  appLogMark: (options: AppLogOptions) => number;
  appLogCollect: (options: AppLogOptions, start: number, directory: string) => Promise<string>;
  browser: (kase: CaseConfig, config: Config, directory: string) => Promise<void>;
  s3Snapshot: (config: Config, options: S3Options) => Promise<any>;
  ec2Log: (config: Config, options: Ec2Options, directory: string) => Promise<string>;
  awsIdentity: (config: Config) => Promise<any>;
}

export const defaultCollectors: Collectors = {
  seed: (config, kase) => seed(config, kase),
  dbSnapshot: (config, kase) => dbSnapshot(config, kase),
  appLogMark,
  appLogCollect: (options, start, directory) => appLogCollect(options, start, directory),
  browser: (kase, config, directory) => browser(kase, config, directory),
  s3Snapshot: (config, options) => s3Snapshot(config, options),
  ec2Log: (config, options, directory) => ec2Log(config, options, directory),
  awsIdentity: (config) => awsCall(config, ['sts', 'get-caller-identity']),
};

const timestamp = () => new Date().toISOString();

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function attempt<T>(results: CheckRecord[], name: string, action: () => T | Promise<T>): Promise<T | undefined> {
  const record: CheckRecord = { name, startedAt: timestamp() };
  results.push(record);
  try {
    const value = await action();
    record.status = 'PASS';
    return value;
  } catch (error) {
    record.status = 'FAIL';
    record.error = message(error);
    return undefined;
  } finally {
    record.endedAt = timestamp();
  }
}

function ensure(condition: boolean, text: string): void {
  if (!condition) throw new Error(text);
}

function differing(expected: NamedRows, actual: NamedRows, names: string[]): string[] {
  return names.filter((name) => !isDeepStrictEqual(expected[name], actual[name]));
}

const passed = (results: CheckRecord[]) => results[results.length - 1].status === 'PASS';

export async function runCase(config: Config, kase: CaseConfig, directory: string, awsReady: boolean,
  collectors: Collectors = defaultCollectors): Promise<CheckRecord[]> {
  mkdirSync(directory, { recursive: true });
  const results: CheckRecord[] = [];
  const check = kase.database;

  let seedOk = true;
  if (kase.seed) {
    await attempt(results, 'DB seed', async () => {
      save(path.join(directory, 'seed.json'), await collectors.seed(config, kase));
    });
    seedOk = passed(results);
  }

  const snapshot = async (phase: string) => {
    const rows = await collectors.dbSnapshot(config, kase);
    save(path.join(directory, `db-${phase}.json`), rows);
    return rows;
  };
  const before = await attempt(results, 'DB before', () => snapshot('before'));
  let beforeOk = passed(results);
  if (before && check.expectedBefore) {
    const expected = check.expectedBefore;
    await attempt(results, 'DB before assertion', () => {
      const names = differing(expected, before, Object.keys(expected));
      ensure(!names.length, `DB before differs from expectedBefore: ${names.join(', ')}`);
    });
    beforeOk = passed(results);
  }

  let logStart: number | undefined;
  if (!isNotApplicable(kase.appLog)) {
    const appLog = kase.appLog;
    logStart = await attempt(results, 'App log start', () => collectors.appLogMark(appLog));
  }

  try {
    if (seedOk && beforeOk && awsReady) {
      await attempt(results, 'Browser', () => collectors.browser(kase, config, directory));
    } else {
      const reason = !seedOk ? 'DB seed failed' : !beforeOk ? 'DB precondition failed' : 'AWS account verification failed';
      results.push({ name: 'Browser', status: 'NOT_RUN', reason });
    }
  } finally {
    const after = await attempt(results, 'DB after', () => snapshot('after'));
    if (before && after) {
      const { unchanged, expectedAfter } = check;
      if (unchanged) {
        const names = unchanged === true ? Object.keys(check.queries) : unchanged;
        await attempt(results, 'DB unchanged', () => {
          const changed = differing(before, after, names);
          ensure(!changed.length, `DB changed: ${changed.join(', ')}`);
        });
      }
      if (expectedAfter) {
        await attempt(results, 'DB after assertion', () => {
          const names = differing(expectedAfter, after, Object.keys(expectedAfter));
          ensure(!names.length, `DB after differs from expectedAfter: ${names.join(', ')}`);
        });
      }
    }

    if (isNotApplicable(kase.appLog)) {
      results.push({ name: 'App log', status: 'NOT_APPLICABLE', reason: kase.appLog.notApplicable });
    } else if (logStart === undefined) {
      results.push({ name: 'App log', status: 'NOT_RUN', reason: 'App log start position unavailable' });
    } else {
      const appLog = kase.appLog;
      const start = logStart;
      await attempt(results, 'App log', () => collectors.appLogCollect(appLog, start, directory));
    }

    for (const source of ['s3', 'ec2'] as const) {
      const options = kase[source];
      if (isNotApplicable(options)) {
        results.push({ name: source, status: 'NOT_APPLICABLE', reason: options.notApplicable });
        continue;
      }
      if (!awsReady) {
        results.push({ name: source, status: 'NOT_RUN', reason: 'AWS account verification failed' });
        continue;
      }
      if (source === 's3') {
        const s3 = options as S3Options;
        await attempt(results, 'S3', async () => {
          const data = await collectors.s3Snapshot(config, s3);
          save(path.join(directory, 's3.json'), data);
          const keys = new Set((data.Contents ?? []).map((item: { Key: string }) => item.Key));
          ensure(s3.expectedKeys.every((key) => keys.has(key)), 'S3 expected objects missing');
        });
      } else {
        const ec2 = options as Ec2Options;
        await attempt(results, 'EC2', async () => {
          const output = await collectors.ec2Log(config, ec2, directory);
          ensure(ec2.contains.every((value) => output.includes(value)), 'EC2 expected log text missing');
        });
      }
    }
  }
  save(path.join(directory, 'checks.json'), results);
  return results;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[c]!);
}

function listFiles(directory: string): string[] {
  return (readdirSync(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .filter((file) => !file.includes('playwright-report/data/'))
    .sort();
}

export function report(directory: string, records: CheckRecord[]): number {
  const failed = records.some((r) => r.status !== 'PASS' && r.status !== 'NOT_APPLICABLE');
  const data = { status: failed ? 'FAIL' : 'PASS', endedAt: timestamp(), checks: records };
  save(path.join(directory, 'summary.json'), data);
  const rows = records.map((r) => '<tr>' + (['case', 'name', 'status', 'error', 'reason'] as const)
    .map((k) => `<td>${escapeHtml(String(r[k] ?? ''))}</td>`).join('') + '</tr>').join('');
  const links = listFiles(directory)
    .map((file) => `<li><a href="${escapeHtml(file)}">${escapeHtml(file)}</a></li>`).join('');
  writeFileSync(path.join(directory, 'index.html'),
    '<!doctype html><html lang="ja"><meta charset="utf-8"><title>画面試験結果</title>'
    + '<style>body{font-family:sans-serif;margin:2rem}td,th{border:1px solid #ccc;padding:.5rem}'
    + 'table{border-collapse:collapse}</style>'
    + `<h1>画面試験結果: ${data.status}</h1><p>NOT_APPLICABLEは対象外であり確認済みではありません。</p>`
    + '<table><tr><th>No.</th><th>確認</th><th>結果</th><th>エラー</th><th>理由</th></tr>'
    + `${rows}</table><h2>証跡</h2><ul>${links}</ul></html>`, 'utf8');
  return failed ? 1 : 0;
}

export async function main(argv: string[] = process.argv.slice(2), collectors: Collectors = defaultCollectors): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      validate: { type: 'boolean', default: false },
    },
  });
  if (!values.config) throw new Error('--config is required');
  const config = loadConfig(values.config);
  const usesAws = validate(config);
  if (values.validate) {
    console.log('Configuration valid (no connections made)');
    return 0;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '');
  const runId = `${stamp}-${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const directory = path.join(ROOT, 'runs', runId);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  save(path.join(directory, 'run.json'), { runId, startedAt: timestamp(), cases: config.cases.map((c) => c.id) });
  const records: CheckRecord[] = [];
  const onInterrupt = () => {
    records.push({ name: 'Runner', status: 'FAIL', error: 'interrupted' });
    interruptAll();
  };
  process.once('SIGINT', onInterrupt);
  try {
    let awsReady = true;
    if (usesAws) {
      await attempt(records, 'AWS identity', async () => {
        const actual = await collectors.awsIdentity(config);
        save(path.join(directory, 'aws-identity.json'), actual);
        ensure(actual.Account === config.aws!.accountId, 'Unexpected AWS account');
      });
      awsReady = passed(records);
    }
    for (const kase of config.cases) {
      const checks = await runCase(config, kase, path.join(directory, kase.id), awsReady, collectors);
      records.push(...checks.map((c) => ({ ...c, case: kase.id })));
    }
  } catch (error) {
    records.push({ name: 'Runner', status: 'FAIL', error: message(error) });
  } finally {
    process.off('SIGINT', onInterrupt);
  }
  const code = report(directory, records);
  console.log(`Results: ${path.join(directory, 'index.html')}`);
  return code;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (error: unknown) => {
    console.error(`Configuration/execution error: ${message(error)}`);
    process.exitCode = 2;
  });
}
