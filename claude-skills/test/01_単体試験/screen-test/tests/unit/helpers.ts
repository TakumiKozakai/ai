import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';
import { loadConfig } from '../../src/config.ts';
import type { CaseConfig, Config } from '../../src/config.ts';
import type { Collectors } from '../../src/runner.ts';
import { ROOT } from '../../src/paths.ts';

const created: string[] = [];
after(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true });
});

export function tempDir(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'screen-test-'));
  created.push(directory);
  return directory;
}

export function todoConfig(): { config: Config; kase: CaseConfig } {
  const config = loadConfig(path.join(ROOT, 'config.todo-local.json'));
  return { config, kase: config.cases[0] };
}

export function ecsiteConfig(): { config: Config; kase: CaseConfig } {
  const config = loadConfig(path.join(ROOT, 'plans', 'ecsite-sample', 'config.example.json'));
  return { config, kase: config.cases[0] };
}

// Records call order; every collector succeeds unless overridden.
export function fakeCollectors(overrides: Partial<Collectors> = {}): { collectors: Collectors; calls: string[] } {
  const calls: string[] = [];
  const track = <A extends unknown[], R>(name: string, fn: (...args: A) => R) => (...args: A): R => {
    calls.push(name);
    return fn(...args);
  };
  const base: Collectors = {
    seed: async () => ({ files: [], output: '' }),
    dbSnapshot: async () => ({ todos: [] }),
    appLogMark: () => 0,
    appLogCollect: async () => '',
    browser: async () => {},
    s3Snapshot: async () => ({}),
    ec2Log: async () => '',
    awsIdentity: async () => ({}),
  };
  const merged = { ...base, ...overrides };
  const collectors = Object.fromEntries(Object.entries(merged).map(([name, fn]) =>
    [name, track(name, fn as (...args: unknown[]) => unknown)])) as unknown as Collectors;
  return { collectors, calls };
}
