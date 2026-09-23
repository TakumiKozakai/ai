import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { validate } from '../../src/config.ts';
import { report, runCase } from '../../src/runner.ts';
import type { CheckRecord } from '../../src/runner.ts';
import { ecsiteConfig, fakeCollectors, tempDir, todoConfig } from './helpers.ts';

const statuses = (checks: CheckRecord[]) => Object.fromEntries(checks.map((c) => [c.name, c.status]));
const failures = (checks: CheckRecord[]) => checks.filter((c) => c.status === 'FAIL').map((c) => c.name);

test('before failure blocks browser but attempts after', async () => {
  const { config, kase } = todoConfig();
  let snapshots = 0;
  const { collectors, calls } = fakeCollectors({
    dbSnapshot: async () => {
      if (++snapshots === 1) throw new Error('offline');
      return { todos: [] };
    },
  });
  const root = tempDir();
  const checks = await runCase(config, kase, path.join(root, 'case'), true, collectors);
  assert.ok(!calls.includes('browser'));
  assert.equal(calls.filter((c) => c === 'dbSnapshot').length, 2);
  assert.equal(statuses(checks).Browser, 'NOT_RUN');
  assert.equal(report(root, checks), 1);
});

test('browser failure still collects DB, S3 and EC2', async () => {
  const { config, kase } = todoConfig();
  kase.s3 = { bucket: 'sample', prefix: '', expectedKeys: ['result.txt'] };
  kase.ec2 = { instanceId: 'i-0123456789abcdef0', logPath: '/var/log/app.log', lines: 10, contains: ['request completed'] };
  const { collectors, calls } = fakeCollectors({
    dbSnapshot: async () => ({ todos: [{ id: 1 }] }),
    browser: async () => { throw new Error('UI failed'); },
    s3Snapshot: async () => ({ Contents: [{ Key: 'result.txt' }] }),
    ec2Log: async () => 'request completed',
  });
  const root = tempDir();
  const checks = await runCase(config, kase, path.join(root, 'case'), true, collectors);
  assert.equal(calls.filter((c) => c === 'dbSnapshot').length, 2);
  assert.ok(calls.includes('s3Snapshot') && calls.includes('ec2Log'));
  assert.deepEqual(failures(checks), ['Browser']);
  assert.equal(report(root, checks), 1);
});

test('DB difference and missing S3 objects fail', async () => {
  const { config, kase } = todoConfig();
  kase.s3 = { bucket: 'sample', prefix: '', expectedKeys: ['missing.txt'] };
  let snapshots = 0;
  const { collectors } = fakeCollectors({
    dbSnapshot: async () => (++snapshots === 1 ? { todos: [] } : { todos: [{ id: 1 }] }),
  });
  const checks = await runCase(config, kase, path.join(tempDir(), 'case'), true, collectors);
  assert.deepEqual(failures(checks), ['DB unchanged', 'S3']);
});

test('seed runs before the DB before snapshot and its result is saved', async () => {
  const { config, kase } = ecsiteConfig();
  const { collectors, calls } = fakeCollectors({
    seed: async () => ({ files: [{ file: 'seed/01_products.sql', sha256: 'abc' }], output: '' }),
    dbSnapshot: async () => ({ pw_products: kase.database.expectedBefore!.pw_products }),
  });
  const directory = path.join(tempDir(), 'case');
  const checks = await runCase(config, kase, directory, true, collectors);
  assert.deepEqual(calls.slice(0, 3), ['seed', 'dbSnapshot', 'appLogMark']);
  assert.deepEqual(failures(checks), []);
  assert.equal(JSON.parse(readFileSync(path.join(directory, 'seed.json'), 'utf8')).files[0].sha256, 'abc');
});

test('seed failure blocks browser but still collects after-evidence', async () => {
  const { config, kase } = ecsiteConfig();
  const { collectors, calls } = fakeCollectors({
    seed: async () => { throw new Error('psql: exit 3'); },
    dbSnapshot: async () => ({ pw_products: [] }),
  });
  const checks = await runCase(config, kase, path.join(tempDir(), 'case'), true, collectors);
  assert.ok(!calls.includes('browser'));
  assert.equal(checks.find((c) => c.name === 'Browser')?.reason, 'DB seed failed');
  assert.ok(calls.includes('appLogCollect'));
  assert.equal(statuses(checks)['DB after'], 'PASS');
});

test('unchanged with names compares only the listed queries', async () => {
  const { config, kase } = todoConfig();
  kase.database = {
    queries: { todos: 'SELECT id FROM todos', audit: 'SELECT id FROM audit' },
    unchanged: ['todos'],
  };
  validate(config);
  let snapshots = 0;
  const { collectors } = fakeCollectors({
    dbSnapshot: async () => ({ todos: [{ id: 1 }], audit: [{ id: ++snapshots }] }),
  });
  const checks = await runCase(config, kase, path.join(tempDir(), 'case'), true, collectors);
  assert.equal(statuses(checks)['DB unchanged'], 'PASS');
});

test('expectedAfter reports which named query differs', async () => {
  const { config, kase } = todoConfig();
  kase.database = {
    queries: { todos: 'SELECT id FROM todos', users: 'SELECT id FROM users' },
    expectedAfter: { todos: [{ id: 1 }], users: [] },
  };
  const { collectors } = fakeCollectors({ dbSnapshot: async () => ({ todos: [{ id: 1 }], users: [{ id: 9 }] }) });
  const checks = await runCase(config, kase, path.join(tempDir(), 'case'), true, collectors);
  const record = checks.find((c) => c.name === 'DB after assertion');
  assert.equal(record?.status, 'FAIL');
  assert.match(record?.error ?? '', /users/);
  assert.doesNotMatch(record?.error ?? '', /todos/);
});

test('app log start failure is NOT_RUN, not PASS', async () => {
  const { config, kase } = ecsiteConfig();
  const { collectors, calls } = fakeCollectors({
    appLogMark: () => { throw new Error('ENOENT'); },
    dbSnapshot: async () => ({ pw_products: kase.database.expectedBefore!.pw_products }),
  });
  const checks = await runCase(config, kase, path.join(tempDir(), 'case'), true, collectors);
  assert.ok(calls.includes('browser'));
  assert.ok(!calls.includes('appLogCollect'));
  assert.equal(statuses(checks)['App log'], 'NOT_RUN');
});

test('not-applicable app log is recorded with its reason', async () => {
  const { config, kase } = todoConfig();
  const { collectors, calls } = fakeCollectors();
  const checks = await runCase(config, kase, path.join(tempDir(), 'case'), true, collectors);
  assert.ok(!calls.includes('appLogMark'));
  const record = checks.find((c) => c.name === 'App log');
  assert.equal(record?.status, 'NOT_APPLICABLE');
  assert.ok(record?.reason);
});

test('report escapes error text', () => {
  const directory = tempDir();
  assert.equal(report(directory, [{ name: 'test', status: 'FAIL', error: '<script>alert(1)</script>' }]), 1);
  assert.ok(!readFileSync(path.join(directory, 'index.html'), 'utf8').includes('<script>'));
});
