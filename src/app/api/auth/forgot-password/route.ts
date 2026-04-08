import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendEmail, generateResetPasswordHtml } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "邮箱不能为空" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    // 即使用户不存在也返回成功，防止用户枚举攻击
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "如果邮箱存在，重置邮件已发送"
      })
    }

    // 生成重置 Token
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 小时

    await prisma.verificationToken.create({
      data: { identifier: email, token, expires }
    })

    // 发送重置邮件
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`
    await sendEmail({
      to: email,
      subject: "重置您的密码",
      html: generateResetPasswordHtml(user.name, resetUrl)
    })

    return NextResponse.json({
      success: true,
      message: "如果邮箱存在，重置邮件已发送"
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json({ error: "操作失败" }, { status: 500 })
  }
}
