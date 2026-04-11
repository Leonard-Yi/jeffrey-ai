import { z } from "zod"
import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import bcrypt from "bcrypt"

const RegisterSchema = z.object({
  email: z.string().email("无效的邮箱格式"),
  password: z.string().min(6, "密码至少6位"),
  name: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const parseResult = RegisterSchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, password, name } = parseResult.data

    // 检查邮箱是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "邮箱已被注册" },
        { status: 409 }
      )
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 12)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name,
      }
    })

    // 邮箱验证已暂时禁用 - 直接注册成功
    return NextResponse.json({
      success: true,
      message: "注册成功"
    })
  } catch (error) {
    console.error("Register error:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "邮箱已被注册" }, { status: 409 })
    }
    return NextResponse.json({ error: "注册失败" }, { status: 500 })
  }
}