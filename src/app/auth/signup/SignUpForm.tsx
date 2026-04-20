"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "../_components/AuthCard";
import { C } from "@/lib/design-tokens";

export default function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "注册失败，请重试");
        setLoading(false);
        return;
      }

      router.push("/auth/signin?registered=true");
    } catch {
      setError("注册失败，请稍后再试");
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="注册"
      subtitle="开始管理你的人脉"
      footerLink={{ href: "/auth/signin", text: "已有账号？去登录" }}
    >
      {error && (
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
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="name"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: "6px",
            }}
          >
            姓名
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="张三"
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

        <div style={{ marginBottom: "24px" }}>
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
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
            minLength={6}
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
          disabled={loading}
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
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: `all ${C.transitionBase}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
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
              注册中...
            </>
          ) : (
            "注册"
          )}
        </button>
      </form>
    </AuthCard>
  );
}
