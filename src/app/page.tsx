import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { C } from "@/lib/design-tokens";

export default async function LandingPage() {
  const session = await auth();

  if (session) {
    redirect("/input");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(ellipse 80% 60% at 20% -10%, rgba(245, 158, 11, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse 60% 50% at 80% 110%, rgba(5, 150, 105, 0.05) 0%, transparent 50%),
          ${C.bg}
        `,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Noise texture */}
      <div
        className="noise-overlay"
        style={{ opacity: 0.35 }}
      />

      {/* Decorative circles */}
      <div
        style={{
          position: "fixed",
          top: "-200px",
          right: "-100px",
          width: "600px",
          height: "600px",
          border: `1px solid ${C.borderAccent}`,
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "-150px",
          right: "-50px",
          width: "500px",
          height: "500px",
          border: `1px solid ${C.borderAccent.replace("0.4", "0.2")}`,
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "40px",
          left: "-100px",
          width: "400px",
          height: "400px",
          border: `1px solid ${C.borderAccent.replace("0.4", "0.2")}`,
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px 48px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 400,
            color: C.primary,
            letterSpacing: "-0.01em",
          }}
        >
          Jeffrey.AI
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link
            href="/auth/signin"
            style={{
              padding: "9px 20px",
              fontSize: "14px",
              fontWeight: 500,
              color: C.textSecondary,
              textDecoration: "none",
              border: `1px solid ${C.borderStrong}`,
              borderRadius: "8px",
              background: "transparent",
              transition: `all ${C.transitionBase}`,
            }}
          >
            登录
          </Link>
          <Link
            href="/auth/signup"
            style={{
              padding: "9px 20px",
              fontSize: "14px",
              fontWeight: 500,
              color: C.textInverse,
              textDecoration: "none",
              background: C.primary,
              borderRadius: "8px",
              transition: `all ${C.transitionBase}`,
            }}
          >
            开始使用
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "80px 48px 100px",
        }}
      >
        {/* Eyebrow */}
        <div
          className="animate-fade-in"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "32px",
            padding: "6px 14px",
            background: "rgba(201, 149, 106, 0.08)",
            borderRadius: "100px",
            border: `1px solid ${C.borderAccent}`,
            fontSize: "13px",
            color: C.primary,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: C.accent,
            }}
          />
          人脉管理系统
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-in-up"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(48px, 6vw, 72px)",
            fontWeight: 400,
            color: C.text,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            marginBottom: "28px",
            maxWidth: "820px",
          }}
        >
          你的人脉，
          <br />
          <span style={{ color: C.primary }}>值得被认真对待。</span>
        </h1>

        {/* Subheadline */}
        <p
          className="animate-fade-in-up stagger-2"
          style={{
            fontSize: "18px",
            color: C.textSecondary,
            lineHeight: 1.75,
            maxWidth: "500px",
            marginBottom: "52px",
          }}
        >
          用日常语言记录，AI 自动整理成可查可看的人际网络。
          <br />
          不会再错过任何一个重要的名字。
        </p>

        {/* CTA */}
        <div
          className="animate-fade-in-up stagger-3"
          style={{ display: "flex", gap: "14px", marginBottom: "100px" }}
        >
          <Link
            href="/auth/signup"
            style={{
              padding: "14px 32px",
              fontSize: "15px",
              fontWeight: 500,
              color: C.textInverse,
              textDecoration: "none",
              background: C.primary,
              borderRadius: "10px",
              transition: `all ${C.transitionBase}`,
              letterSpacing: "0.01em",
            }}
          >
            开始使用 →
          </Link>
          <Link
            href="/auth/signin"
            style={{
              padding: "14px 32px",
              fontSize: "15px",
              fontWeight: 500,
              color: C.textSecondary,
              textDecoration: "none",
              background: "transparent",
              border: `1px solid ${C.borderStrong}`,
              borderRadius: "10px",
              transition: `all ${C.transitionBase}`,
            }}
          >
            已有账号
          </Link>
        </div>

        {/* Features */}
        <div
          className="animate-fade-in-up stagger-4"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              ),
              title: "自然录入",
              desc: "像写日记一样，把见闻随手记下来。不用填表，不用想格式。",
              accent: C.primary,
              bg: C.accentLight,
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              ),
              title: "关系图谱",
              desc: "一眼看清你的人际网络。谁是节点、谁在连接，一目了然。",
              accent: C.info,
              bg: C.infoBg,
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              ),
              title: "智能提醒",
              desc: "该联系谁了？Jeffrey 会悄悄提醒你。别让人脉断在你手里。",
              accent: C.accent,
              bg: C.accentLight,
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="animate-fade-in-up"
              style={{
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                borderRadius: "14px",
                padding: "28px",
                boxShadow: C.shadowMd,
                transition: `all ${C.transitionBase}`,
                animationDelay: `${0.1 + i * 0.05}s`,
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: feature.bg,
                  color: feature.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "18px",
                  border: `1px solid ${feature.bg.replace("0.08", "0.15}")}`,
                }}
              >
                {feature.icon}
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "20px",
                  fontWeight: 400,
                  color: C.text,
                  marginBottom: "10px",
                  letterSpacing: "-0.01em",
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: C.textSecondary,
                  lineHeight: 1.7,
                }}
              >
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div
          className="animate-fade-in-up stagger-6"
          style={{
            marginTop: "100px",
            padding: "28px 32px",
            background: C.accentLight,
            borderRadius: "14px",
            border: `1px solid ${C.borderAccent}`,
            maxWidth: "560px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              color: C.textSecondary,
              fontStyle: "italic",
              lineHeight: 1.75,
              marginBottom: "10px",
            }}
          >
            "有些名字，值得被记住。
            <br />
            有些约定，值得被兑现。"
          </p>
          <p
            style={{
              fontSize: "12px",
              color: C.textMuted,
              letterSpacing: "0.05em",
            }}
          >
            — Jeffrey.AI
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 10,
          textAlign: "center",
          padding: "40px 48px",
          fontSize: "12px",
          color: C.textMuted,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        © 2026 Jeffrey.AI
      </footer>
    </div>
  );
}
