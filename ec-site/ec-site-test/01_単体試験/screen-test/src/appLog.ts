import { openSync, readSync, closeSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AppLogOptions } from './config.ts';

const MAX_BYTES = 10 * 1024 * 1024;
const POLL_MS = 200;

// Byte offset of the log before the browser starts; only later bytes are evidence.
export function appLogMark(options: AppLogOptions): number {
  return statSync(options.path).size;
}

function readRange(file: string, start: number, end: number): string {
  const buffer = Buffer.alloc(end - start);
  const fd = openSync(file, 'r');
  try {
    let offset = 0;
    while (offset < buffer.length) {
      const read = readSync(fd, buffer, offset, buffer.length - offset, start + offset);
      if (!read) break;
      offset += read;
    }
    return buffer.subarray(0, offset).toString('utf8');
  } finally {
    closeSync(fd);
  }
}

const sleepMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Waits up to waitMs for the server to flush lines written after the response.
export async function appLogCollect(options: AppLogOptions, start: number, directory: string,
  sleep: (ms: number) => Promise<void> = sleepMs): Promise<string> {
  const deadline = performance.now() + (options.waitMs ?? 3000);
  for (;;) {
    const size = statSync(options.path).size;
    if (size < start) throw new Error('App log shrank during the test (rotated or truncated)');
    if (size - start > MAX_BYTES) throw new Error('App log grew more than 10MB during the test');
    const output = readRange(options.path, start, size);
    const missing = options.contains.filter((value) => !output.includes(value));
    if (!missing.length || performance.now() >= deadline) {
      writeFileSync(path.join(directory, 'app.log'), output, 'utf8');
      if (missing.length) throw new Error('App log expected text missing');
      return output;
    }
    await sleep(POLL_MS);
  }
}
