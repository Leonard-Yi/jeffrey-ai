"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      return
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (res.ok) {
          setStatus("success")
        } else {
          setStatus("error")
        }
      })
      .catch(() => setStatus("error"))
  }, [token])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md text-center">
          <p className="text-gray-600">验证中...</p>
        </div>
      </div>
    )
  }

  if (status === "success") {
    const [countdown, setCountdown] = useState(3)

    useEffect(() => {
      if (countdown <= 0) {
        window.location.href = "/auth/signin"
        return
      }
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }, [countdown])

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold mb-4 text-green-600">邮箱验证成功</h1>
          <p className="mb-4 text-gray-600">您的邮箱已验证成功。</p>
          <p className="text-sm text-gray-500 mb-4">{countdown}秒后自动跳转登录页...</p>
          <Link href="/auth/signin" className="text-blue-600 hover:underline">
            立即跳转
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">验证失败</h1>
        <p className="mb-4 text-gray-600">邮箱验证链接无效或已过期。</p>
        <Link href="/auth/signup" className="text-blue-600 hover:underline">
          重新注册
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><p>加载中...</p></div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}