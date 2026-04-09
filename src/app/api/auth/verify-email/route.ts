import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
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

  // Use transaction to atomically update user and delete token
  // P2025 means token was already deleted by concurrent request (acceptable)
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { email: verificationToken.identifier },
        data: { emailVerified: new Date() }
      }),
      prisma.verificationToken.delete({
        where: { token }
      })
    ])
    return NextResponse.redirect(new URL("/auth/verify-email?verified=true", request.url))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      // Token already deleted by concurrent request - user was already verified, redirect to success
      return NextResponse.redirect(new URL("/auth/verify-email?verified=true", request.url))
    }
    console.error("Email verification error:", error)
    return NextResponse.json({ error: "验证失败" }, { status: 500 })
  }
}