import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveSeed, validateSeedSql } from './config.ts';
import type { CaseConfig, Config, NamedRows } from './config.ts';
import { command as defaultCommand } from './process.ts';
import type { CommandFn } from './process.ts';

const PSQL = ['psql', '-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1'];

// libpq reads the password from PGPASSFILE/~/.pgpass, not argv.
function psqlEnv(config: Config, options: string): NodeJS.ProcessEnv {
  const db = config.database;
  return {
    ...process.env,
    PGHOST: db.host, PGDATABASE: db.name, PGUSER: db.user,
    PGPORT: String(db.port ?? 5432), PGCONNECT_TIMEOUT: '10', PGOPTIONS: options,
  };
}

interface Identity {
  database: string;
  user: string;
}

function checkIdentity(config: Config, data: Identity): void {
  if (data.database !== config.database.name || data.user !== config.database.user) {
    throw new Error('Unexpected database or user');
  }
}

export async function dbSnapshot(config: Config, kase: CaseConfig, run: CommandFn = defaultCommand): Promise<NamedRows> {
  // Query names are validated as [A-Za-z0-9_-], so they are safe as SQL literals.
  const results = Object.entries(kase.database.queries).map(([name, query]) =>
    `'${name}',(SELECT COALESCE(json_agg(row_to_json(snapshot)), '[]'::json) FROM (${query}) AS snapshot)`);
  const sql = 'BEGIN READ ONLY;\n'
    + "SELECT json_build_object('database',current_database(),'user',current_user,"
    + `'results',json_build_object(${results.join(',')}));\nROLLBACK;\n`;
  const output = await run(PSQL, {
    env: psqlEnv(config, '-c default_transaction_read_only=on -c statement_timeout=30000'),
    stdin: sql,
  });
  const data = JSON.parse(output) as Identity & { results: NamedRows };
  checkIdentity(config, data);
  return data.results;
}

export interface SeedRecord {
  file: string;
  sha256: string;
}

export interface SeedResult {
  files: SeedRecord[];
  output: string;
}

export async function seed(config: Config, kase: CaseConfig, run: CommandFn = defaultCommand): Promise<SeedResult> {
  const env = psqlEnv(config, '-c statement_timeout=30000');
  // Refuse to write unless the connection lands on the configured database and role.
  const identity = await run(PSQL, {
    env,
    stdin: "SELECT json_build_object('database',current_database(),'user',current_user);\n",
  });
  checkIdentity(config, JSON.parse(identity) as Identity);
  const files: SeedRecord[] = [];
  const args = [...PSQL, '-1'];
  for (const file of kase.seed ?? []) {
    const resolved = resolveSeed(config, file);
    const bytes = readFileSync(resolved);
    // Re-validate: the file may have changed since the configuration was checked.
    validateSeedSql(bytes.toString('utf8'), file);
    files.push({ file: path.relative(config.configDir ?? '', resolved), sha256: createHash('sha256').update(bytes).digest('hex') });
    args.push('-f', resolved);
  }
  const output = await run(args, { env, timeoutMs: 120_000 });
  return { files, output };
}
