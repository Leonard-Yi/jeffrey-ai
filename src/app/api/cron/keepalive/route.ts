import { prisma } from "@/lib/db";

/**
 * Vercel Cron Job — pings Supabase to prevent 7-day inactivity pause.
 * Called by Vercel Cron Jobs every 6 hours.
 */
export async function GET() {
  try {
    // Simple query to keep Supabase active
    const count = await prisma.user.count();
    return Response.json({ ok: true, users: count, at: new Date().toISOString() });
  } catch (err) {
    console.error("[keepalive] DB ping failed:", err);
    return Response.json({ ok: false, error: "DB unreachable" }, { status: 500 });
  }
}
