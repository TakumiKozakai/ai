import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { PLANS_DIR, SPECS_DIR, isWithin } from './paths.ts';

export type Row = Record<string, unknown>;
export type Rows = Row[];
export type NamedRows = Record<string, Rows>;

export interface NotApplicable {
  notApplicable: string;
}

export interface S3Options {
  bucket: string;
  prefix: string;
  expectedKeys: string[];
}

export interface Ec2Options {
  instanceId: string;
  logPath: string;
  lines: number;
  contains: string[];
}

export interface AppLogOptions {
  path: string;
  contains: string[];
  waitMs?: number;
}

export interface DatabaseCheck {
  queries: Record<string, string>;
  unchanged?: boolean | string[];
  expectedBefore?: NamedRows;
  expectedAfter?: NamedRows;
}

export interface CaseConfig {
  id: string;
  spec: string;
  title: string;
  seed?: string[];
  database: DatabaseCheck;
  appLog: AppLogOptions | NotApplicable;
  s3: S3Options | NotApplicable;
  ec2: Ec2Options | NotApplicable;
}

export interface DatabaseConfig {
  host: string;
  name: string;
  user: string;
  port?: number;
  allowSeed?: boolean;
}

export interface AwsConfig {
  profile: string;
  region: string;
  accountId: string;
}

export interface Config {
  baseUrl: string;
  allowedOrigins: string[];
  database: DatabaseConfig;
  aws?: AwsConfig;
  cases: CaseConfig[];
  // Set by loadConfig: seed paths are relative to the config file.
  configDir?: string;
}

const NAME = /^[A-Za-z0-9_-]+$/;
const MAX_QUERIES = 20;

export function isNotApplicable(options: object): options is NotApplicable {
  return 'notApplicable' in options;
}

export function loadConfig(file: string): Config {
  const config = JSON.parse(readFileSync(file, 'utf8')) as Config;
  config.configDir = path.dirname(path.resolve(file));
  return config;
}

// A single SELECT expression, never a psql script.
export function validateSelect(query: unknown, label: string): void {
  if (typeof query !== 'string' || !/^SELECT\s/i.test(query.trim()) || query.includes(';') || query.includes('\\')) {
    throw new Error(`${label} must be a single SELECT without semicolons/backslashes`);
  }
}

export function resolveSeed(config: Config, file: string): string {
  const resolved = path.resolve(config.configDir ?? process.cwd(), file);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    throw new Error(`seed file not found: ${file}`);
  }
  const real = realpathSync(resolved);
  if (!isWithin(real, realpathSync(PLANS_DIR)) || !real.endsWith('.sql')) {
    throw new Error('seed must be a .sql file under plans/');
  }
  return real;
}

// psql meta-commands (\i, \!, ...) and transaction control would escape the
// single transaction the runner wraps seeds in.
export function validateSeedSql(sql: string, file: string): void {
  if (sql.includes('\\')) {
    throw new Error(`${file}: seed SQL must not contain backslashes (psql meta-commands)`);
  }
  // BEGIN/END also appear in DO blocks and CASE expressions, so only statement forms of
  // BEGIN are matched and END (a COMMIT synonym) is left to the COMMIT/ROLLBACK checks.
  if (/^\s*(BEGIN\s*(;|TRANSACTION\b|WORK\b|ISOLATION\b)|COMMIT\b|ROLLBACK\b|ABORT\b|START\s+TRANSACTION\b)/im.test(sql)) {
    throw new Error(`${file}: seed SQL must not control transactions`);
  }
}

function validateDatabase(check: DatabaseCheck): void {
  const names = Object.keys(check.queries ?? {});
  if (!names.length || names.length > MAX_QUERIES) {
    throw new Error(`database.queries must contain 1-${MAX_QUERIES} named SELECTs`);
  }
  for (const name of names) {
    if (!NAME.test(name)) throw new Error('database.queries names must be path-safe');
    validateSelect(check.queries[name], `database.queries.${name}`);
  }
  const { unchanged } = check;
  if (Array.isArray(unchanged)) {
    if (!unchanged.length || !unchanged.every((name) => names.includes(name))) {
      throw new Error('database.unchanged must list defined query names');
    }
  } else if (unchanged !== undefined && typeof unchanged !== 'boolean') {
    throw new Error('database.unchanged must be true or a list of query names');
  }
  for (const key of ['expectedBefore', 'expectedAfter'] as const) {
    const expected = check[key];
    if (expected === undefined) continue;
    const keys = Object.keys(expected);
    if (!keys.length || !keys.every((name) => names.includes(name) && Array.isArray(expected[name]))) {
      throw new Error(`database.${key} must map defined query names to row arrays`);
    }
  }
  if (!unchanged && check.expectedAfter === undefined) {
    throw new Error('database requires unchanged or expectedAfter');
  }
}

function validateContains(values: unknown, label: string): void {
  if (!Array.isArray(values) || !values.length || !values.every((v) => typeof v === 'string' && v)) {
    throw new Error(`${label} must contain expected log strings`);
  }
}

export function validate(config: Config): boolean {
  const parsed = new URL(config.baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('baseUrl must be an HTTP(S) URL without credentials');
  }
  if (!config.allowedOrigins?.includes(parsed.origin)) {
    throw new Error('baseUrl is not in allowedOrigins');
  }
  const db = config.database;
  for (const key of ['host', 'name', 'user'] as const) {
    if (typeof db?.[key] !== 'string' || !db[key]) throw new Error(`database.${key} is required`);
  }
  if (!config.cases?.length) throw new Error('cases must not be empty');
  const ids = new Set<string>();
  let usesAws = false;
  for (const kase of config.cases) {
    if (!NAME.test(kase.id ?? '') || ids.has(kase.id)) {
      throw new Error('case id must be unique and path-safe');
    }
    ids.add(kase.id);
    const spec = path.resolve(SPECS_DIR, kase.spec ?? '');
    if (!existsSync(spec) || !statSync(spec).isFile() || !isWithin(realpathSync(spec), realpathSync(SPECS_DIR))) {
      throw new Error('spec must be a file under specs/');
    }
    if (!kase.title) throw new Error('case.title is required');
    if (kase.seed !== undefined) {
      if (!Array.isArray(kase.seed) || !kase.seed.length) {
        throw new Error('seed must be a non-empty list of SQL files');
      }
      // Guards against pointing a seed-enabled suite at a shared environment by accident.
      if (db.allowSeed !== true) throw new Error('seed requires database.allowSeed: true');
      for (const file of kase.seed) validateSeedSql(readFileSync(resolveSeed(config, file), 'utf8'), file);
    }
    if (!kase.database) throw new Error('database check is required');
    validateDatabase(kase.database);
    for (const source of ['appLog', 's3', 'ec2'] as const) {
      const options = kase[source];
      if (options === undefined || options === null) {
        throw new Error(`${source}: configuration or notApplicable reason is required`);
      }
      if (isNotApplicable(options)) {
        if (typeof options.notApplicable !== 'string' || !options.notApplicable.trim()) {
          throw new Error('notApplicable requires a reason');
        }
        continue;
      }
      if (source === 'appLog') {
        const appLog = options as AppLogOptions;
        if (typeof appLog.path !== 'string' || !path.isAbsolute(appLog.path)) {
          throw new Error('appLog.path must be an absolute path');
        }
        validateContains(appLog.contains, 'appLog.contains');
        if (appLog.waitMs !== undefined && (!Number.isInteger(appLog.waitMs) || appLog.waitMs < 0 || appLog.waitMs > 30_000)) {
          throw new Error('appLog.waitMs must be between 0 and 30000');
        }
        continue;
      }
      usesAws = true;
      if (source === 's3') {
        const s3 = options as S3Options;
        if (!s3.bucket || typeof s3.prefix !== 'string') throw new Error('s3 requires bucket and prefix');
        if (!Array.isArray(s3.expectedKeys) || !s3.expectedKeys.length) {
          throw new Error('s3.expectedKeys must contain expected object keys');
        }
        if (!s3.expectedKeys.every((k) => typeof k === 'string' && k.startsWith(s3.prefix))) {
          throw new Error('expectedKeys must be within prefix');
        }
      } else {
        const ec2 = options as Ec2Options;
        if (!/^i-[0-9a-f]{8,17}$/.test(ec2.instanceId ?? '')) {
          throw new Error('ec2.instanceId must be an EC2 instance id');
        }
        if (typeof ec2.logPath !== 'string' || !ec2.logPath.startsWith('/') || ec2.logPath.includes('\n')) {
          throw new Error('ec2.logPath must be an absolute single-line path');
        }
        if (!Number.isInteger(ec2.lines) || ec2.lines < 1 || ec2.lines > 1000) {
          throw new Error('ec2.lines must be between 1 and 1000');
        }
        validateContains(ec2.contains, 'ec2.contains');
      }
    }
  }
  if (usesAws) {
    const aws = config.aws;
    if (!/^\d{12}$/.test(aws?.accountId ?? '')) {
      throw new Error('aws.accountId must be the expected 12-digit account id');
    }
    if (!aws?.profile || !aws.region) throw new Error('aws.profile and aws.region are required');
  }
  return usesAws;
}
