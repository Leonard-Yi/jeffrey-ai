# memwatcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 独立的内存监控脚本，检测系统内存使用率和 Node 僵尸进程，超阈值时发 Windows 通知 + 终端警告，并提供清理命令。

**Architecture:** 单文件脚本 + JSON 配置文件，通过 os 模块获取内存，wmic 检测进程，node-notifier 发 Windows Toast。

**Tech Stack:** Node.js (tsx), os, child_process, node-notifier, JSON 配置文件

---

## File Structure

- `config/memwatcher.json` — 配置文件（阈值、通知内容）
- `scripts/memwatcher.ts` — 主脚本（内存检测、进程扫描、通知、终端输出）

---

## Task 1: 创建配置文件

**Files:**
- Create: `config/memwatcher.json`

- [ ] **Step 1: 创建配置文件**

```json
{
  "memoryThresholdPercent": 80,
  "zombieProcessPatterns": ["node.exe"],
  "notification": {
    "enabled": true,
    "title": "⚠️ 内存预警",
    "body": "当前内存使用率已达 {percent}%，建议清理后台进程"
  }
}
```

Run: `cat config/memwatcher.json`
Expected: 文件存在且格式正确

- [ ] **Step 2: Commit**

```bash
git add config/memwatcher.json
git commit -m "feat(memwatcher): add config file"
```

---

## Task 2: 编写主脚本

**Files:**
- Create: `scripts/memwatcher.ts`

- [ ] **Step 1: 创建目录**

Run: `mkdir -p scripts`（若不存在）

- [ ] **Step 2: 编写脚本框架**

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
  const lines = stdout.trim().split('\n').slice(1); // 跳过表头
  const zombies: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // wmic 输出格式: CommandLine \n ProcessId
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

  // 超过阈值，检测僵尸进程
  const zombies = await findZombieProcesses(config.zombieProcessPatterns);
  printWarning(percent, zombies);

  // 发送通知
  if (config.notification.enabled) {
    const body = config.notification.body.replace('{percent}', String(percent));
    notifier.notify({
      title: config.notification.title,
      message: body,
    });
  }
}

main().catch(console.error);
```

- [ ] **Step 2: 验证脚本可执行**

Run: `npx tsx --env-file=.env scripts/memwatcher.ts`
Expected: 输出内存使用率，无报错

- [ ] **Step 3: Commit**

```bash
git add scripts/memwatcher.ts
git commit -m "feat(memwatcher): add memory watcher script"
```

---

## Self-Review

1. **Spec coverage:** 架构✓ 配置✓ 检测逻辑✓ 输出格式✓ 使用方式✓
2. **Placeholder scan:** 无 TBD/TODO，代码完整
3. **Type consistency:** Config 接口与 JSON 结构一致，函数签名无歧义

---

**Plan complete.** 文件: `docs/superpowers/plans/2026-04-08-memwatcher-plan.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
