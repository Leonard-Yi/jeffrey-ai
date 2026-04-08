import { NextRequest, NextResponse } from "next/server"
import { PrismaClientKnownRequestError } from "@prisma/client"
import { prisma } from "@/lib/db"
import bcrypt from "bcrypt"

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token 和密码不能为空" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少6位" }, { status: 400 })
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

    // 更新密码并删除 Token（使用事务处理并发）
    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.$transaction([
      prisma.user.update({
        where: { email: verificationToken.identifier },
        data: { passwordHash }
      }),
      prisma.verificationToken.delete({
        where: { token }
      })
    ]).catch((error) => {
      // P2025 = Record to delete does not exist (token already used by concurrent request)
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
        return
      }
      throw error
    })

    return NextResponse.json({ success: true, message: "密码重置成功" })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "操作失败" }, { status: 500 })
  }
}
