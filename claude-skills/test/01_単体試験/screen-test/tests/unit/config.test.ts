import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { validate, validateSeedSql } from '../../src/config.ts';
import { ecsiteConfig, tempDir, todoConfig } from './helpers.ts';

test('invalid origin and non-SELECT query are rejected before connections', () => {
  const { config, kase } = todoConfig();
  config.baseUrl = 'https://production.example.com';
  assert.throws(() => validate(config), /allowedOrigins/);
  config.baseUrl = 'http://localhost:8080';
  kase.database.queries.todos = 'SELECT 1; DELETE FROM todos';
  assert.throws(() => validate(config), /single SELECT/);
});

test('missing AWS or app log configuration is not silently skipped', () => {
  for (const source of ['s3', 'appLog'] as const) {
    const { config, kase } = todoConfig();
    delete (kase as Partial<typeof kase>)[source];
    assert.throws(() => validate(config), new RegExp(source));
  }
});

test('the ecsite sample configuration is valid', () => {
  const { config } = ecsiteConfig();
  assert.equal(validate(config), false);
});

test('seed requires database.allowSeed', () => {
  const { config } = ecsiteConfig();
  delete config.database.allowSeed;
  assert.throws(() => validate(config), /allowSeed/);
});

test('seed outside plans/ is rejected', () => {
  const { config, kase } = ecsiteConfig();
  const outside = path.join(tempDir(), 'evil.sql');
  writeFileSync(outside, 'DELETE FROM users');
  kase.seed = [outside];
  assert.throws(() => validate(config), /under plans/);
  kase.seed = ['../../config.example.json'];
  assert.throws(() => validate(config), /not found|under plans/);
});

test('seed SQL must not contain psql meta-commands or transaction control', () => {
  assert.throws(() => validateSeedSql("\\! rm -rf /\n", 'a.sql'), /backslashes/);
  assert.throws(() => validateSeedSql('INSERT INTO t VALUES (1);\nCOMMIT;\n', 'a.sql'), /transactions/);
  assert.throws(() => validateSeedSql('begin;\nDELETE FROM t;\n', 'a.sql'), /transactions/);
  // DO blocks and CASE expressions keep their own BEGIN/END keywords.
  validateSeedSql('DO $$\nBEGIN\n  PERFORM 1;\nEND\n$$;\nSELECT CASE WHEN true THEN 1\nEND;\n', 'a.sql');
});

test('database queries: names, unchanged and expected rows reference defined queries', () => {
  const { config, kase } = todoConfig();
  kase.database = { queries: { 'bad name': 'SELECT 1' }, unchanged: true };
  assert.throws(() => validate(config), /path-safe/);
  kase.database = { queries: { todos: 'SELECT 1' }, unchanged: ['users'] };
  assert.throws(() => validate(config), /unchanged/);
  kase.database = { queries: { todos: 'SELECT 1' }, expectedAfter: { users: [] } };
  assert.throws(() => validate(config), /expectedAfter/);
  kase.database = { queries: { todos: 'SELECT 1' } };
  assert.throws(() => validate(config), /unchanged or expectedAfter/);
  kase.database = { queries: {}, unchanged: true };
  assert.throws(() => validate(config), /queries/);
});

test('app log path must be absolute', () => {
  const { config, kase } = ecsiteConfig();
  kase.appLog = { path: 'logs/app.log', contains: ['GET'] };
  assert.throws(() => validate(config), /absolute/);
  kase.appLog = { path: '/tmp/app.log', contains: [] };
  assert.throws(() => validate(config), /appLog.contains/);
});
