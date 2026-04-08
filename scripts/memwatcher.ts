import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import notifier from 'node-notifier';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

interface Config {
  memoryThresholdPercent: number;
  zombieProcessPatterns: string[];
  notification: {
    enabled: boolean;
    title: string;
    body: string;
  };
}

function loadConfig(): Config {
  const configPath = path.join(process.cwd(), 'config', 'memwatcher.json');
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content);
}

function getMemoryUsagePercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 100);
}

async function findZombieProcesses(patterns: string[]): Promise<string[]> {
  const { stdout } = await execAsync(
    'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine'
  );
  const lines = stdout.trim().split('\n').slice(1);
  const zombies: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const pid = parts[parts.length - 1];
      const cmd = parts.slice(0, -1).join(' ');
      zombies.push(`PID ${pid} - ${cmd}`);
    }
  }
  return zombies;
}

function printWarning(percent: number, zombies: string[]) {
  console.log('\n[WARNING] 内存使用率:', percent + '%');
  if (zombies.length > 0) {
    console.log('检测到 Node 僵尸进程:');
    zombies.forEach(z => console.log(' ', z));
    console.log('\n建议执行清理命令:');
    console.log(
      'wmic process where "name=\'node.exe\' and CommandLine like \'%Epstein%\'" get ProcessId | tail -n +2 | xargs -I{} taskkill //F //PID {}'
    );
  }
}

async function main() {
  const config = loadConfig();
  const percent = getMemoryUsagePercent();

  if (percent < config.memoryThresholdPercent) {
    console.log(`[OK] 内存使用率: ${percent}%（低于阈值 ${config.memoryThresholdPercent}%）`);
    return;
  }

  const zombies = await findZombieProcesses(config.zombieProcessPatterns);
  printWarning(percent, zombies);

  if (config.notification.enabled) {
    const body = config.notification.body.replace('{percent}', String(percent));
    notifier.notify({
      title: config.notification.title,
      message: body,
    });
  }
}

main().catch(console.error);