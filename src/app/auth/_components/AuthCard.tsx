"use client";

import Link from "next/link";
import { C } from "@/lib/design-tokens";

interface AuthCardProps {
  children: React.ReactNode;
  showFooter?: boolean;
  footerLink?: { href: string; text: string };
  title?: string;
  subtitle?: string;
}

export function AuthCard({ children, showFooter = true, footerLink, title, subtitle }: AuthCardProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `
          radial-gradient(ellipse 80% 60% at 50% -10%, rgba(245, 158, 11, 0.07) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 90% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%),
          ${C.bg}
        `,
        overflow: "hidden",
      }}
    >
      {/* Noise */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Decorative circle */}
      <div
        style={{
          position: "fixed",
          top: "-120px",
          right: "-80px",
          width: "400px",
          height: "400px",
          border: `1px solid ${C.borderAccent}`,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "420px",
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: "16px",
          padding: "40px",
          boxShadow: C.shadowLg,
          margin: "0 16px",
        }}
      >
        {/* Brand */}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "28px",
            fontWeight: 400,
            color: C.primary,
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          Jeffrey.AI
        </div>
        <div
          style={{
            fontSize: "14px",
            color: C.textMuted,
            marginBottom: "32px",
            lineHeight: 1.5,
          }}
        >
          {subtitle || "你的 AI 人脉管理助手"}
        </div>

        {/* Title */}
        {title && (
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "22px",
              fontWeight: 400,
              color: C.text,
              marginBottom: "28px",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h1>
        )}

        {children}

        {showFooter && (
          <>
            <div
              style={{
                height: "1px",
                background: C.border,
                margin: "24px 0",
              }}
            />
            <div
              style={{
                textAlign: "center",
                fontSize: "14px",
                color: C.textSecondary,
              }}
            >
              <Link
                href={footerLink?.href || "/auth/signin"}
                style={{
                  color: C.primary,
                  textDecoration: "none",
                  fontWeight: 500,
                  transition: `color ${C.transitionBase}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.primaryHover)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.primary)}
              >
                {footerLink?.text || "返回登录"}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
