"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import AuthLayout from "@/components/AuthLayout"
import { AuthCard } from "../_components/AuthCard"
import { StatusIcon } from "../_components/StatusIcon"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }

    if (password.length < 6) {
      setError("密码长度至少为 6 位")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const data = await res.json()
        setError(data.error || "重置失败")
      }
    } finally {
      setLoading(false)
    }
  }

  const card = (
    <AuthCard showFooter={!success}>
      <h1 className="auth-card-title">设置新密码</h1>

      {!token ? (
        <div>
          <StatusIcon type="error" />
          <div className="auth-alert auth-alert-error">
            密码重置链接无效或已过期。
          </div>
        </div>
      ) : success ? (
        <div>
          <StatusIcon type="success" />
          <div className="auth-alert auth-alert-success">
            密码重置成功，现在可以使用新密码登录了。
          </div>
          <Link href="/auth/signin" className="auth-button auth-link" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            前往登录
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="auth-alert auth-alert-error">{error}</div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="password">
                新密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="至少 6 位"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="confirmPassword">
                确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="auth-input"
                placeholder="再次输入密码"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-button"
              style={{ marginTop: "8px" }}
            >
              {loading ? "重置中..." : "重置密码"}
            </button>
          </form>
        </>
      )}
    </AuthCard>
  )

  return <AuthLayout>{card}</AuthLayout>
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="auth-card" style={{ textAlign: "center", padding: "48px 40px" }}>
            <div className="auth-spinner" />
          </div>
        </AuthLayout>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
