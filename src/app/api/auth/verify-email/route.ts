import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "缺少 token" }, { status: 400 })
  }

  // 查找 Token
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token }
  })

  if (!verificationToken) {
    return NextResponse.json({ error: "无效的 token" }, { status: 400 })
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } })
    return NextResponse.json({ error: "Token 已过期" }, { status: 400 })
  }

  // 更新用户邮箱验证状态
  await prisma.user.update({
    where: { email: verificationToken.identifier },
    data: { emailVerified: new Date() }
  })

  // 删除已使用的 Token
  await prisma.verificationToken.delete({ where: { token } })

  return NextResponse.redirect(new URL("/auth/verify-email?verified=true", request.url))
}