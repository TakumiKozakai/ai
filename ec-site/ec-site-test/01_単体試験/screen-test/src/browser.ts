import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CaseConfig, Config } from './config.ts';
import { ROOT } from './paths.ts';
import { command as defaultCommand } from './process.ts';
import type { CommandFn } from './process.ts';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface PlaywrightStats {
  expected: number;
  unexpected: number;
  skipped: number;
  flaky: number;
}

export async function browser(kase: CaseConfig, config: Config, directory: string,
  run: CommandFn = defaultCommand): Promise<void> {
  const env = { ...process.env, TEST_BASE_URL: config.baseUrl, EVIDENCE_DIR: directory };
  const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  const report = path.join(directory, 'playwright.json');
  try {
    const output = await run([process.execPath, cli, 'test', kase.spec, '--grep',
      `${escapeRegExp(kase.title)}$`], { env, timeoutMs: 180_000 });
    writeFileSync(path.join(directory, 'playwright.stdout.txt'), output, 'utf8');
  } finally {
    // Playwright reports survive assertion failure; absence is an execution failure.
    if (!existsSync(report)) {
      throw new Error('Playwright JSON report missing; check Node/browser installation');
    }
  }
  const stats = (JSON.parse(readFileSync(report, 'utf8')) as { stats: PlaywrightStats }).stats;
  if (stats.expected !== 1 || stats.unexpected || stats.skipped || stats.flaky) {
    throw new Error('Exactly one passing test is required; skipped/zero/multiple tests are not PASS');
  }
}
