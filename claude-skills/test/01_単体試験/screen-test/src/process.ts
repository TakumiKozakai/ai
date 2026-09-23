import { spawn } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './paths.ts';

export interface CommandOptions {
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs?: number;
}

export type CommandFn = (args: string[], options?: CommandOptions) => Promise<string>;

const active = new Set<number>();
let interrupted = false;

// Kill every running child process group; later commands fail immediately.
export function interruptAll(): void {
  interrupted = true;
  for (const pid of active) killGroup(pid);
}

function killGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already exited.
  }
}

// No shell interpolation; do not persist credentials or command stderr.
export const command: CommandFn = (args, { env, stdin, timeoutMs = 90_000 } = {}) => {
  const name = path.basename(args[0]);
  if (interrupted) return Promise.reject(new Error(`${name}: interrupted`));
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd: ROOT, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const pid = child.pid;
    if (pid !== undefined) active.add(pid);
    let stdout = '';
    let timedOut = false;
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    // stderr is drained but never kept: it may echo connection strings or secrets.
    child.stderr.resume();
    const timer = setTimeout(() => {
      timedOut = true;
      if (pid !== undefined) killGroup(pid);
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      if (pid !== undefined) active.delete(pid);
      reject(new Error(`${name}: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (pid !== undefined) active.delete(pid);
      if (timedOut || interrupted) {
        reject(new Error(`${name}: timed out or interrupted`));
      } else if (code) {
        reject(new Error(`${name}: exit ${code}; 接続設定・権限を確認してください（秘密情報保護のためstderrは非保存）`));
      } else {
        resolve(stdout);
      }
    });
    child.stdin.on('error', () => { /* Reported through exit status. */ });
    child.stdin.end(stdin ?? '');
  });
};
