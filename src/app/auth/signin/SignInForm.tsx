"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import AuthLayout from "@/components/AuthLayout"

export default function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/input"
  const callbackUrl = rawCallbackUrl.startsWith("/") ? rawCallbackUrl : "/"
  const error = searchParams.get("error")
  const reason = searchParams.get("reason")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    })

    if (result?.error) {
      // Login failed - redirect back with error
      router.push(`/auth/signin?error=CredentialsSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`)
    } else if (result?.ok) {
      // Login succeeded - redirect to callbackUrl
      router.push(callbackUrl)
    }
    // If neither, do nothing (loading stays true)
  }

  const card = (
    <div className="auth-card">
      {/* Brand */}
      <div className="auth-card-brand">Jeffrey.AI</div>
      <div className="auth-card-tagline">你的 AI 人脉管理助手</div>

      <h1 className="auth-card-title">登录账号</h1>

      {reason === "unauthenticated" && (
        <div className="auth-alert auth-alert-info">
          访问该页面需要先登录
        </div>
      )}

      {error && (
        <div className="auth-alert auth-alert-error">
          {error === "CredentialsSignin" ? "邮箱或密码错误" : "登录失败"}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="auth-form-group">
          <label className="auth-label" htmlFor="email">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-form-group">
          <label className="auth-label" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <div style={{ marginTop: "8px", marginBottom: "20px", textAlign: "right" }}>
          <Link
            href="/auth/forgot-password"
            className="auth-link"
            style={{ fontSize: "13px" }}
          >
            忘记密码？
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-button"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>

      <div className="auth-divider" />

      <div className="auth-footer">
        还没有账号？{" "}
        <Link href="/auth/signup" className="auth-link">
          注册 Jeffrey.AI
        </Link>
      </div>
    </div>
  )

  // If this is a redirect from middleware (unauthenticated), show full page with layout
  if (reason === "unauthenticated") {
    return (
      <AuthLayout>{card}</AuthLayout>
    )
  }

  // Normal signin page
  return <AuthLayout>{card}</AuthLayout>
}
