// src/app/api/auth/change-password/route.ts
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rotateKeys } from "@/lib/keyRotation";

const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入旧密码"),
  newPassword: z.string().min(6, "新密码至少6位"),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { oldPassword, newPassword } = parsed.data;
    const userId = session.user.id;

    // Verify old password
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "旧密码不正确" }, { status: 403 });
    }

    // Check if rotation already in progress
    if (user.keyRotationInProgress) {
      return NextResponse.json({ error: "密钥更新已在进行中，请稍后再试" }, { status: 409 });
    }

    // Update password hash
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    // Rotate encryption keys
    const result = await rotateKeys(oldPassword, newPassword, userId, prisma);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "密钥轮换完成，您的数据已用新密码保护",
      steps: [
        "🔐 正在用您的旧密钥解密数据...",
        "🔐 正在用新密钥重新加密...",
        "✅ 密钥轮换完成，您的数据已用新密码保护",
      ],
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
