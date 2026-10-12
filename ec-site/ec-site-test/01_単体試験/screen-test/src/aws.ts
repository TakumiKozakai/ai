import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Config, Ec2Options, S3Options } from './config.ts';
import { command as defaultCommand } from './process.ts';
import type { CommandFn } from './process.ts';
import { save } from './files.ts';

export type AwsCall = (config: Config, args: string[]) => Promise<any>;

export function makeAwsCall(run: CommandFn = defaultCommand): AwsCall {
  return async (config, args) => {
    const aws = config.aws!;
    const env = { ...process.env, AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off' };
    const output = await run(['aws', '--profile', aws.profile, '--region', aws.region,
      '--output', 'json', '--no-cli-pager', '--cli-connect-timeout', '10',
      '--cli-read-timeout', '30', ...args], { env, timeoutMs: 120_000 });
    return JSON.parse(output);
  };
}

export const awsCall = makeAwsCall();

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export async function s3Snapshot(config: Config, options: S3Options, call: AwsCall = awsCall): Promise<any> {
  // AWS CLI auto-pagination remains enabled; never silently inspect only page 1.
  return call(config, ['s3api', 'list-objects-v2', '--bucket', options.bucket, '--prefix', options.prefix]);
}

const sleepMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function ec2Log(config: Config, options: Ec2Options, directory: string,
  call: AwsCall = awsCall, sleep: (ms: number) => Promise<void> = sleepMs): Promise<string> {
  const remote = `tail -n ${options.lines} -- ${shellQuote(options.logPath)}`;
  const sent = await call(config, ['ssm', 'send-command', '--instance-ids', options.instanceId,
    '--document-name', 'AWS-RunShellScript', '--timeout-seconds', '120',
    '--parameters', JSON.stringify({ commands: [remote], executionTimeout: ['60'] })]);
  const commandId: string = sent.Command.CommandId;
  save(path.join(directory, 'ssm-command.json'), { commandId, command: remote });
  const deadline = performance.now() + 180_000;
  while (performance.now() < deadline) {
    // list-command-invocations returns [] while the invocation propagates.
    const result = await call(config, ['ssm', 'list-command-invocations', '--command-id', commandId,
      '--instance-id', options.instanceId, '--details']);
    const invocations = result.CommandInvocations ?? [];
    if (invocations.length) {
      const invocation = invocations[0];
      const status: string = invocation.Status;
      if (status === 'Success') {
        const detail = await call(config, ['ssm', 'get-command-invocation', '--command-id', commandId,
          '--instance-id', options.instanceId]);
        save(path.join(directory, 'ec2.json'), detail);
        const output: string = detail.StandardOutputContent ?? '';
        writeFileSync(path.join(directory, 'ec2.log'), output, 'utf8');
        if (detail.ResponseCode !== 0 || detail.Status !== 'Success') {
          throw new Error('SSM command did not finish successfully');
        }
        if (output.length >= 24000) throw new Error('SSM output may be truncated; reduce ec2.lines');
        return output;
      }
      if (!['Pending', 'InProgress', 'Delayed'].includes(status)) {
        save(path.join(directory, 'ec2.json'), invocation);
        throw new Error(`SSM command ended with ${status}`);
      }
    }
    await sleep(2000);
  }
  throw new Error(`SSM wait timed out; inspect command ${commandId}`);
}
