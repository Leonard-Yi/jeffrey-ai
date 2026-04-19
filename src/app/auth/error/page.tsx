"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import AuthLayout from "@/components/AuthLayout"
import { AuthCard } from "../_components/AuthCard"
import { StatusIcon } from "../_components/StatusIcon"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const errorMessage =
    error === "OAuthAccountNotLinked"
      ? "该邮箱已被其他登录方式绑定，请使用原登录方式登录。"
      : "认证过程中发生错误，请重试。"

  return (
    <AuthLayout>
      <AuthCard
        footerLink={{ href: "/auth/signup", text: "注册新账号" }}
      >
        <StatusIcon type="error" />

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 400,
            color: "var(--color-text)",
            textAlign: "center",
            marginBottom: "12px",
            letterSpacing: "-0.01em",
          }}
        >
          认证错误
        </h2>

        <p
          style={{
            fontSize: "14px",
            color: "var(--color-text-secondary)",
            textAlign: "center",
            lineHeight: 1.7,
            marginBottom: "24px",
          }}
        >
          {errorMessage}
        </p>

        <Link
          href="/auth/signin"
          className="auth-button"
          style={{ display: "block", textAlign: "center", textDecoration: "none" }}
        >
          返回登录
        </Link>
      </AuthCard>
    </AuthLayout>
  )
}

export default function AuthErrorPage() {
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
      <AuthErrorContent />
    </Suspense>
  )
}
