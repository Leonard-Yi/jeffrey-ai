"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import AuthLayout from "@/components/AuthLayout"
import { AuthCard } from "../_components/AuthCard"
import { StatusIcon } from "../_components/StatusIcon"

export default function VerifyEmailForm() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")

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
  }, [])

  useEffect(() => {
    if (status === "success" && countdown <= 0) {
      window.location.href = "/auth/signin"
      return
    }
    if (status === "success" && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [status, countdown])

  return (
    <AuthLayout>
      <AuthCard footerLink={{ href: "/auth/signin", text: "返回登录" }}>
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div className="auth-spinner" style={{ marginBottom: "16px" }} />
            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
              验证中...
            </p>
          </div>
        )}

        {status === "success" && (
          <div>
            <StatusIcon type="success" />
            <h2 className="auth-card-title" style={{ textAlign: "center", marginBottom: "8px" }}>
              邮箱验证成功
            </h2>
            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", textAlign: "center", marginBottom: "20px", lineHeight: 1.6 }}>
              您的邮箱已验证成功，现在可以登录了。
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", textAlign: "center", marginBottom: "20px" }}>
              {countdown}秒后自动跳转...
            </p>
            <Link href="/auth/signin" className="auth-button" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              立即跳转
            </Link>
          </div>
        )}

        {status === "error" && (
          <div>
            <StatusIcon type="error" />
            <h2 className="auth-card-title" style={{ textAlign: "center", marginBottom: "8px" }}>
              验证失败
            </h2>
            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", textAlign: "center", marginBottom: "20px", lineHeight: 1.6 }}>
              邮箱验证链接无效或已过期。
            </p>
            <Link href="/auth/signup" className="auth-button" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              重新注册
            </Link>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  )
}
