# memwatcher 设计文档

## 概述

一个独立的内存监控工具，检测系统内存使用率和 Node.js 僵尸进程，在达到预警值时通过 Windows Toast 通知和终端输出提醒用户，并提供可一键执行的清理命令。

## 架构

```
scripts/memwatcher.ts              # 入口脚本
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
  "zombieProcessPatterns": ["node.exe"],
  "notification": {
    "enabled": true,
    "title": "⚠️ 内存预警",
    "body": "当前内存使用率已达 {percent}%，建议清理后台进程"
  }
}
```

## 检测逻辑

1. 通过 `os.totalmem()` / `os.freemem()` 计算内存使用率
2. 若超过阈值，检测匹配 `zombieProcessPatterns` 的进程（通过 `wmic process where "name='node.exe'" get ProcessId,CommandLine`）
3. 若检测到进程，打印进程列表并发送 Windows 通知

## 输出示例

```
[WARNING] 内存使用率: 83%
检测到 Node 僵尸进程:
  PID 12345 - node.exe (命令行包含 Epstein...)
  PID 23456 - node.exe (僵尸残留)

建议执行清理命令:
  wmic process where "name='node.exe' and CommandLine like '%Epstein%'" get ProcessId | tail -n +2 | xargs -I{} taskkill //F //PID {}
```

## 使用方式

```bash
# 直接运行一次检查
npx tsx scripts/memwatcher.ts
```

## 文件清单

- `scripts/memwatcher.ts` — 主脚本
- `config/memwatcher.json` — 配置文件
