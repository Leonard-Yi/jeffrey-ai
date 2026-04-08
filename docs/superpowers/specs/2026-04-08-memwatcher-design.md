# memwatcher 设计文档

## 概述

一个常驻后台的内存监控工具，检测系统内存使用率和 Node.js 僵尸进程，在达到预警值时通过 Windows Toast 通知和终端输出提醒用户，并提供可一键执行的清理命令。

## 架构

```
scripts/memwatcher.ts              # 常驻后台脚本（循环运行）
├── os 模块                         # 获取系统内存使用率
├── config/memwatcher.json         # 预警阈值等配置
├── child_process (wmic)            # 检测 Node 僵尸进程
├── node-notifier                   # 发送 Windows Toast 通知
└── console (彩色输出)              # 终端警告 + 进程列表
```

## 配置文件

路径: `config/memwatcher.json`

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

字段说明:
- `memoryThresholdPercent`: 内存预警阈值（默认 80）
- `checkIntervalMs`: 每次检测间隔（默认 300000ms = 5分钟）
- `cooldownMs`: 重复提醒冷却时间（默认 300000ms = 5分钟）

## 运行逻辑

1. 启动时加载配置
2. 进入 `while(true)` 循环:
   - 通过 `os.totalmem()` / `os.freemem()` 计算内存使用率
   - 若超过阈值，检测 node.exe 进程 + 发送通知（带冷却机制）
   - 等待 `checkIntervalMs` 后进行下一次检测
3. 支持 Ctrl+C 优雅退出

## 冷却机制

- 首次超过阈值时立即通知并记录时间戳
- 冷却期内（`cooldownMs`）同一状态不再重复通知
- 内存降回阈值以下后，再次超标会重新通知

## 开机自启动

通过 Windows 任务计划程序配置:
- 触发器：用户登录时
- 操作：运行 `npx tsx --env-file=.env scripts/memwatcher.ts`
- 设置方法写入 `docs/superpowers/specs/2026-04-08-memwatcher-setup.md`

## 输出示例

```
[INFO] memwatcher 已启动，检测间隔 5 分钟
[OK] 内存使用率: 52%（低于阈值 80%）
[WARNING] 内存使用率: 83%
检测到 Node 僵尸进程:
  PID 12345 - C:\...node.exe ...
建议执行清理命令:
  powershell -Command "wmic process where \"name='node.exe' and CommandLine like '%Epstein%'\" call terminate"
```

## 文件清单

- `scripts/memwatcher.ts` — 主脚本（常驻循环版本）
- `config/memwatcher.json` — 配置文件
- `docs/superpowers/specs/2026-04-08-memwatcher-setup.md` — 开机自启动配置指南
