"use client"

import { useState } from "react"
import Link from "next/link"
import AuthLayout from "@/components/AuthLayout"
import { AuthCard } from "../_components/AuthCard"
import { StatusIcon } from "../_components/StatusIcon"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        setSent(true)
      } else {
        const data = await res.json()
        setError(data.error || "操作失败")
      }
    } catch {
      setError("操作失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  const card = (
    <AuthCard>
      <h1 className="auth-card-title">重置密码</h1>

      {sent ? (
        <div>
          <StatusIcon type="success" />
          <div className="auth-alert auth-alert-success">
            如果该邮箱存在，我们会发送密码重置链接到您的邮箱。
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="auth-alert auth-alert-error">{error}</div>
          )}
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginBottom: "20px", lineHeight: 1.6 }}>
            输入您注册时使用的邮箱地址，我们会发送密码重置链接。
          </p>
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
            <button
              type="submit"
              disabled={loading}
              className="auth-button"
              style={{ marginTop: "8px" }}
            >
              {loading ? "发送中..." : "发送重置链接"}
            </button>
          </form>
        </>
      )}
    </AuthCard>
  )

  return <AuthLayout>{card}</AuthLayout>
}
