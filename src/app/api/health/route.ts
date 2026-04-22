import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const mem = process.memoryUsage();
  const freeMB = Math.round(os.freemem() / 1024 / 1024);
  const totalMB = Math.round(os.totalmem() / 1024 / 1024);

  const status = freeMB < 1000 ? "critical" : freeMB < 2000 ? "warning" : "ok";

  return NextResponse.json({
    status,
    process: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + " MB",
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + " MB",
      rss: Math.round(mem.rss / 1024 / 1024) + " MB",
    },
    system: {
      freeMem: freeMB + " MB",
      totalMem: totalMB + " MB",
      usedPercent: Math.round((1 - os.freemem() / os.totalmem()) * 100) + "%",
    },
    timestamp: new Date().toISOString(),
  });
}
