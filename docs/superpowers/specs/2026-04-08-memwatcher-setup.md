# memwatcher 开机自启动配置指南

## 前置条件

1. Node.js 已安装并配置好 PATH
2. memwatcher 脚本已就绪: `d:\Epstein.AI\scripts\memwatcher.ts`

## 步骤

### 1. 打开任务计划程序

按 `Win + R`，输入 `taskschd.msc`，回车。

### 2. 创建基本任务

- 右侧点击 **"创建基本任务"**
- 名称: `memwatcher`
- 描述: `内存监控 - Node 僵尸进程检测`
- 点击 **下一步**

### 3. 设置触发器

- 选择 **"当用户登录时"**
- 点击 **下一步**

### 4. 设置操作

- 选择 **"启动程序"**
- 点击 **下一步**
- 程序/脚本: `cmd.exe`
- 添加参数: `/c "cd /d D:\Epstein.AI && npx tsx --env-file=.env scripts/memwatcher.ts"`
- 起始位置: `D:\Epstein.AI`（填项目根目录）

### 5. 完成

- 勾选 **"打开任务属性对话框"**
- 点击 **完成**

### 6. 属性额外设置

在属性对话框中:
- 勾选 **"使用最高权限运行"**（避免权限问题）
- 条件标签页：取消勾选 **"如果空闲则停止"**（确保后台运行）

## 验证

重新登录 Windows，打开任务计划程序确认任务存在且状态为"就绪"。

查看运行日志：
```powershell
Get-ScheduledTask -TaskName memwatcher | Get-ScheduledTaskInfo
```

## 停止服务

如需停止后台运行：
```powershell
Unregister-ScheduledTask -TaskName memwatcher -Confirm:$false
```

## 查看输出

memwatcher 运行时会占用一个 cmd 窗口查看日志。
如需无窗口后台运行，可用以下参数：
```
cmd /c "cd /d D:\Epstein.AI && npx tsx --env-file=.env scripts/memwatcher.ts > NUL 2>&1"
```
或使用 PM2 等进程管理器。
