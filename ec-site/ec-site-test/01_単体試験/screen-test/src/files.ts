import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function save(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
