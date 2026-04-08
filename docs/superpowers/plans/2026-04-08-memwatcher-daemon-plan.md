# memwatcher 常驻后台版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 memwatcher 改造成常驻后台进程，支持循环检测和 5 分钟冷却机制。

**Architecture:** 改造 `scripts/memwatcher.ts`，增加 `while(true)` 循环和冷却时间追踪；更新 `config/memwatcher.json` 新增 `checkIntervalMs` 和 `cooldownMs` 字段。

**Tech Stack:** Node.js (tsx), os, child_process, node-notifier, JSON 配置文件

---

## File Structure

- `config/memwatcher.json` — 修改：新增 `checkIntervalMs` 和 `cooldownMs` 字段
- `scripts/memwatcher.ts` — 重写：改造为常驻循环版本

---

## Task 1: 更新配置文件

**Files:**
- Modify: `config/memwatcher.json`

- [ ] **Step 1: 更新配置文件**

将内容替换为：

```json
{
  "memoryThresholdPercent": 80,
  "checkIntervalMs": 300000,
  "cooldownMs": 300000,
  "zombieProcessPatterns": ["node.exe"],
  "notification": {
    "enabled": true,
    "title": "⚠️ 内存预警",
    "body": "当前内存使用率已达 {percent}%，建议清理后台进程"
  }
}
```

Run: `cat config/memwatcher.json`
Expected: 文件包含 checkIntervalMs: 300000 和 cooldownMs: 300000

- [ ] **Step 2: Commit**

```bash
git add config/memwatcher.json
git commit -m "feat(memwatcher): add interval and cooldown config fields"
```

---

## Task 2: 重写主脚本（常驻循环版）

**Files:**
- Modify: `scripts/memwatcher.ts`

- [ ] **Step 1: 重写 memwatcher.ts**

将 `scripts/memwatcher.ts` 全部内容替换为：

```typescript
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

  // Ctrl+C 优雅退出
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
```

- [ ] **Step 2: 验证脚本可执行**

Run: `npx tsx --env-file=.env scripts/memwatcher.ts`
启动后等待几秒，按 Ctrl+C 退出
Expected: 打印启动信息，正常退出无报错

- [ ] **Step 3: Commit**

```bash
git add scripts/memwatcher.ts
git commit -m "feat(memwatcher): convert to daemon mode with loop and cooldown"
```

---

## Self-Review

1. **Spec coverage:** 常驻循环✓ 冷却机制✓ Ctrl+C 退出✓ checkIntervalMs✓ cooldownMs✓ 配置字段✓
2. **Placeholder scan:** 无 TBD/TODO，代码完整
3. **Type consistency:** Config 接口与 JSON 结构一致，sleep 函数签名清晰

---

**Plan complete.** 文件: `docs/superpowers/plans/2026-04-08-memwatcher-daemon-plan.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
