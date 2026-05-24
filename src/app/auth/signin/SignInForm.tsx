"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "../_components/AuthCard";
import { C } from "@/lib/design-tokens";

export default function SignInForm() {
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/input";
  const isValidCallbackUrl = (url: string): string => {
    if (url.startsWith("/")) return window.location.origin + url;
    try {
      const u = new URL(url);
      if (u.origin === window.location.origin) return url;
    } catch {}
    return window.location.origin + "/";
  };
  const callbackUrl = isValidCallbackUrl(rawCallbackUrl);
  const error = searchParams.get("error");
  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Fetch CSRF token on page load — NextAuth requires it for POST
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((d) => setCsrfToken(d.csrfToken || ""))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLocalError("");

    // Use traditional form POST — browser handles cookie + redirect natively,
    // avoiding fetch(Set-Cookie) timing issues present in next-auth/react signIn().
    formRef.current?.submit();
  }

  return (
    <AuthCard
      title="登录"
      subtitle="欢迎回来"
      footerLink={{ href: "/auth/signup", text: "还没有账号？去注册" }}
    >
      {reason === "unauthenticated" && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            fontSize: "14px",
            background: C.infoBg,
            color: C.info,
            border: `1px solid rgba(122, 162, 201, 0.2)`,
            marginBottom: "18px",
          }}
        >
          访问该页面需要先登录
        </div>
      )}

      {(error || localError) && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            fontSize: "14px",
            background: C.errorBg,
            color: C.error,
            border: `1px solid rgba(239, 108, 108, 0.2)`,
            marginBottom: "18px",
          }}
        >
          {error === "CredentialsSignin" ? "邮箱或密码错误" : localError || "登录失败"}
        </div>
      )}

      <form
        ref={formRef}
        method="POST"
        action="/api/auth/callback/credentials"
        onSubmit={handleSubmit}
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: "6px",
            }}
          >
            邮箱
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: "15px",
              fontFamily: "var(--font-body)",
              color: C.text,
              background: C.bg,
              border: `1.5px solid ${C.borderStrong}`,
              borderRadius: "8px",
              outline: "none",
              boxSizing: "border-box",
              transition: `border-color ${C.transitionBase}, box-shadow ${C.transitionBase}`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = C.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px rgba(201, 149, 106, 0.15)`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = C.borderStrong;
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            htmlFor="password"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: "6px",
            }}
          >
            密码
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: "15px",
              fontFamily: "var(--font-body)",
              color: C.text,
              background: C.bg,
              border: `1.5px solid ${C.borderStrong}`,
              borderRadius: "8px",
              outline: "none",
              boxSizing: "border-box",
              transition: `border-color ${C.transitionBase}, box-shadow ${C.transitionBase}`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = C.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px rgba(201, 149, 106, 0.15)`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = C.borderStrong;
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !csrfToken}
          style={{
            width: "100%",
            padding: "11px 20px",
            fontSize: "15px",
            fontWeight: 500,
            fontFamily: "var(--font-body)",
            color: C.bg,
            background: C.primary,
            border: "none",
            borderRadius: "8px",
            cursor: loading || !csrfToken ? "not-allowed" : "pointer",
            opacity: loading || !csrfToken ? 0.6 : 1,
            transition: `all ${C.transitionBase}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
          onMouseEnter={(e) => {
            if (!loading && csrfToken) {
              e.currentTarget.style.background = C.primaryHover;
              e.currentTarget.style.boxShadow = C.shadowGlow;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = C.primary;
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {loading ? (
            <>
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: C.bg,
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              登录中...
            </>
          ) : (
            "登录"
          )}
        </button>
      </form>

      <div
        style={{
          marginTop: "16px",
          textAlign: "center",
          fontSize: "13px",
        }}
      >
        <Link
          href="/auth/forgot-password"
          style={{
            color: C.textMuted,
            textDecoration: "none",
            transition: `color ${C.transitionBase}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.textSecondary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
        >
          忘记密码？
        </Link>
      </div>
    </AuthCard>
  );
}
