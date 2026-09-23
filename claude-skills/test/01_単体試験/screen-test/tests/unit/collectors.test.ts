import assert from 'node:assert/strict';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { appLogCollect, appLogMark } from '../../src/appLog.ts';
import { ec2Log } from '../../src/aws.ts';
import type { AwsCall } from '../../src/aws.ts';
import { browser } from '../../src/browser.ts';
import { dbSnapshot, seed } from '../../src/db.ts';
import type { CommandFn, CommandOptions } from '../../src/process.ts';
import { ecsiteConfig, tempDir, todoConfig } from './helpers.ts';

function recordingCommand(outputs: string[]): { run: CommandFn; calls: { args: string[]; options?: CommandOptions }[] } {
  const calls: { args: string[]; options?: CommandOptions }[] = [];
  const run: CommandFn = async (args, options) => {
    calls.push({ args, options });
    return outputs.shift() ?? '';
  };
  return { run, calls };
}

function sequence(responses: unknown[]): { call: AwsCall; args: string[][] } {
  const args: string[][] = [];
  return { call: async (_config, a) => { args.push(a); return responses.shift(); }, args };
}

const noSleep = async () => {};

test('psql snapshot uses a read-only transaction and no password in args', async () => {
  const { config, kase } = todoConfig();
  const { run, calls } = recordingCommand([JSON.stringify({ database: 'appdb', user: 'readonly_user', results: { todos: [] } })]);
  assert.deepEqual(await dbSnapshot(config, kase, run), { todos: [] });
  const { args, options } = calls[0];
  assert.ok(options?.stdin?.includes('BEGIN READ ONLY;'));
  assert.ok(options?.env?.PGOPTIONS?.includes('default_transaction_read_only=on'));
  assert.ok(!args.join(' ').includes('password'));
});

test('multiple named queries are fetched in one psql call', async () => {
  const { config, kase } = todoConfig();
  kase.database.queries = { todos: 'SELECT id FROM todos', users: 'SELECT id FROM users' };
  const { run, calls } = recordingCommand([JSON.stringify({ database: 'appdb', user: 'readonly_user', results: { todos: [], users: [] } })]);
  await dbSnapshot(config, kase, run);
  assert.equal(calls.length, 1);
  assert.match(calls[0].options?.stdin ?? '', /'todos',\(SELECT .* FROM \(SELECT id FROM todos\)/);
  assert.match(calls[0].options?.stdin ?? '', /'users',\(SELECT .* FROM \(SELECT id FROM users\)/);
});

test('snapshot from an unexpected database or user fails', async () => {
  const { config, kase } = todoConfig();
  const { run } = recordingCommand([JSON.stringify({ database: 'prod', user: 'readonly_user', results: {} })]);
  await assert.rejects(dbSnapshot(config, kase, run), /Unexpected database/);
});

test('seed verifies the target before writing and runs files in one transaction', async () => {
  const { config, kase } = ecsiteConfig();
  const { run, calls } = recordingCommand([JSON.stringify({ database: config.database.name, user: 'playwright_user' }), '']);
  const result = await seed(config, kase, run);
  assert.equal(calls.length, 2);
  assert.ok(!calls[0].args.includes('-f'));
  assert.ok(calls[1].args.includes('-1'));
  assert.ok(calls[1].args[calls[1].args.indexOf('-f') + 1].endsWith(path.join('ecsite-sample', 'seed', '01_products.sql')));
  assert.ok(!calls[1].options?.env?.PGOPTIONS?.includes('read_only'));
  assert.match(result.files[0].sha256, /^[0-9a-f]{64}$/);
});

test('seed does not write when connected to an unexpected database', async () => {
  const { config, kase } = ecsiteConfig();
  const { run, calls } = recordingCommand([JSON.stringify({ database: 'other', user: 'playwright_user' })]);
  await assert.rejects(seed(config, kase, run), /Unexpected database/);
  assert.equal(calls.length, 1);
});

test('app log keeps only bytes written after the mark', async () => {
  const directory = tempDir();
  const file = path.join(directory, 'server.log');
  writeFileSync(file, 'old line GET /api/products?keyword=PW_\n');
  const options = { path: file, contains: ['keyword=PW_'], waitMs: 0 };
  const start = appLogMark(options);
  appendFileSync(file, 'new line GET /api/products?keyword=PW_x\n');
  const output = await appLogCollect(options, start, directory, noSleep);
  assert.equal(output, 'new line GET /api/products?keyword=PW_x\n');
  assert.equal(readFileSync(path.join(directory, 'app.log'), 'utf8'), output);
});

test('app log text present only before the mark does not pass', async () => {
  const directory = tempDir();
  const file = path.join(directory, 'server.log');
  writeFileSync(file, 'keyword=PW_\n');
  const options = { path: file, contains: ['keyword=PW_'], waitMs: 0 };
  const start = appLogMark(options);
  appendFileSync(file, 'unrelated\n');
  await assert.rejects(appLogCollect(options, start, directory, noSleep), /expected text missing/);
});

test('app log waits for late lines', async () => {
  const directory = tempDir();
  const file = path.join(directory, 'server.log');
  writeFileSync(file, '');
  const options = { path: file, contains: ['done'], waitMs: 10_000 };
  const sleep = async () => { appendFileSync(file, 'done\n'); };
  assert.equal(await appLogCollect(options, 0, directory, sleep), 'done\n');
});

test('app log that shrank (rotated/truncated) fails', async () => {
  const directory = tempDir();
  const file = path.join(directory, 'server.log');
  writeFileSync(file, 'x'.repeat(100));
  const options = { path: file, contains: ['x'], waitMs: 0 };
  const start = appLogMark(options);
  writeFileSync(file, 'x');
  await assert.rejects(appLogCollect(options, start, directory, noSleep), /shrank/);
});

test('SSM propagation polling and log path quoting', async () => {
  const { config } = todoConfig();
  const { call, args } = sequence([
    { Command: { CommandId: 'command-id' } },
    { CommandInvocations: [] },
    { CommandInvocations: [{ Status: 'Success' }] },
    { Status: 'Success', ResponseCode: 0, StandardOutputContent: 'expected' },
  ]);
  const options = { instanceId: 'i-0123456789abcdef0', lines: 20, logPath: '/var/log/test; touch malicious.log', contains: ['x'] };
  assert.equal(await ec2Log(config, options, tempDir(), call, noSleep), 'expected');
  const parameters = JSON.parse(args[0][args[0].length - 1]);
  assert.deepEqual(parameters.commands, ["tail -n 20 -- '/var/log/test; touch malicious.log'"]);
});

test('truncated EC2 output does not pass', async () => {
  const { config } = todoConfig();
  const { call } = sequence([
    { Command: { CommandId: 'command-id' } },
    { CommandInvocations: [{ Status: 'Success' }] },
    { Status: 'Success', ResponseCode: 0, StandardOutputContent: 'x'.repeat(24000) },
  ]);
  const options = { instanceId: 'i-0123456789abcdef0', lines: 100, logPath: '/var/log/app.log', contains: ['x'] };
  await assert.rejects(ec2Log(config, options, tempDir(), call, noSleep), /truncated/);
});

test('skipped browser test is not PASS', async () => {
  const { config, kase } = todoConfig();
  const directory = tempDir();
  writeFileSync(path.join(directory, 'playwright.json'), JSON.stringify({ stats: { expected: 0, unexpected: 0, skipped: 1, flaky: 0 } }));
  const { run } = recordingCommand(['']);
  await assert.rejects(browser(kase, config, directory, run), /Exactly one passing test/);
});

test('missing Playwright report is an execution failure', async () => {
  const { config, kase } = todoConfig();
  const run: CommandFn = async () => { throw new Error('node: exit 1'); };
  await assert.rejects(browser(kase, config, tempDir(), run), /report missing/);
});
