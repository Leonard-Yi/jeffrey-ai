import { auth } from "@/lib/auth"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function LandingPage() {
  const session = await auth()

  // 已登录用户直接跳转 /input
  if (session) {
    redirect("/input")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-xl w-full p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: "Georgia, serif" }}>
          Jeffrey.AI
        </h1>
        <p className="text-lg text-gray-600 mb-8">你的 AI 人脉管理助手</p>

        <div className="space-y-6 text-left mb-10">
          <div>
            <h2 className="text-base font-semibold text-gray-800">自然录入</h2>
            <p className="text-sm text-gray-500">对话中轻松记录人际交往，无需手动填写</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">关系图谱</h2>
            <p className="text-sm text-gray-500">可视化你的人际网络</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">智能建议</h2>
            <p className="text-sm text-gray-500">AI 驱动的社交时机和建议</p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signin"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            登录
          </Link>
          <Link
            href="/auth/signup"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
          >
            注册
          </Link>
        </div>
      </div>
    </div>
  )
}