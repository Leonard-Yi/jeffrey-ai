"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">认证错误</h1>
        <p className="mb-4 text-gray-600">
          {error === "OAuthAccountNotLinked"
            ? "该邮箱已被其他登录方式绑定"
            : "认证过程中发生错误"}
        </p>
        <Link
          href="/auth/signin"
          className="text-blue-600 hover:underline"
        >
          返回登录
        </Link>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><p>加载中...</p></div>}>
      <AuthErrorContent />
    </Suspense>
  )
}
