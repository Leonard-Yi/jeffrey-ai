import os from "os";

const freeMB = Math.round(os.freemem() / 1024 / 1024);
const totalMB = Math.round(os.totalmem() / 1024 / 1024);
const usedMB = totalMB - freeMB;
const cpuCount = os.cpus().length;
const cpuModel = os.cpus()[0]?.model ?? "未知";

console.log("========================================");
console.log("  系统资源检查");
console.log("========================================");
console.log(`  CPU  : ${cpuCount} 核  (${cpuModel})`);
console.log(`  内存 : ${freeMB} MB 可用 / ${totalMB} MB 总计 (已用 ${usedMB} MB)`);
console.log("========================================");

if (freeMB < 1500) {
  console.error("⛔ 可用内存不足 1.5GB，无法安全启动服务器！");
  console.error("   请先关闭以下程序后再试：");
  console.error("   - Docker Desktop（如果不需要数据库操作）");
  console.error("   - 浏览器多余标签页");
  console.error("   - VSCode 其他窗口");
  console.error("   - 其他 Node.js 进程（用 tasklist | grep node 查看）");
  process.exit(1);
} else if (freeMB < 3000) {
  console.warn("⚠️  可用内存 1.5-3GB，建议使用生产模式启动：");
  console.warn("   npm run build && npm start");
  console.warn("   （开发模式 npm run dev 需要至少 3GB 可用内存）");
  console.warn("   继续启动中...");
} else {
  console.log("✅ 资源充足，可以启动");
}
