import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import notifier from 'node-notifier';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

interface Config {
  memoryThresholdPercent: number;
  checkIntervalMs: number;
  cooldownMs: number;
  zombieProcessPatterns: string[];
  notification: {
    enabled: boolean;
    title: string;
    body: string;
  };
}

function loadConfig(): Config {
  const configPath = path.join(process.cwd(), 'config', 'memwatcher.json');
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load config from ${configPath}: ${msg}`);
  }
}

function getMemoryUsagePercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 100);
}

async function findZombieProcesses(): Promise<string[]> {
  const { stdout } = await execAsync(
    'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine'
  );
  const lines = stdout.trim().split('\n').map(l => l.trim()).filter(l => l);
  const zombies: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\d+$/.test(line)) {
      const pid = line;
      const cmd = lines[i - 1] ?? '';
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
      'powershell -Command "wmic process where \\"name=\'node.exe\' and CommandLine like \'%Epstein%\'\\" call terminate"'
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const config = loadConfig();
  let lastWarningTime = 0;
  let running = true;

  process.on('SIGINT', () => {
    console.log('\n[INFO] memwatcher 已退出');
    running = false;
  });

  console.log(`[INFO] memwatcher 已启动，检测间隔 ${config.checkIntervalMs / 1000} 秒`);

  while (running) {
    const percent = getMemoryUsagePercent();

    if (percent < config.memoryThresholdPercent) {
      console.log(`[OK] 内存使用率: ${percent}%（低于阈值 ${config.memoryThresholdPercent}%）`);
    } else {
      const now = Date.now();
      const isInCooldown = (now - lastWarningTime) < config.cooldownMs;

      if (isInCooldown) {
        console.log(`[INFO] 内存使用率: ${percent}%（超过阈值 ${config.memoryThresholdPercent}%，冷却中）`);
      } else {
        const zombies = await findZombieProcesses();
        printWarning(percent, zombies);
        lastWarningTime = now;

        if (config.notification.enabled) {
          const body = config.notification.body.replace('{percent}', String(percent));
          notifier.notify({
            title: config.notification.title,
            message: body,
          });
        }
      }
    }

    await sleep(config.checkIntervalMs);
  }
}

main().catch(console.error);