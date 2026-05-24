import Link from "next/link";
import { C } from "@/lib/design-tokens";

// ─── Icons (inline SVGs) ────────────────────────────────────────────────

function ShieldIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function EyeOffIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function KeyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

// ─── Layer Card ────────────────────────────────────────────────────────

function LayerCard({
  icon,
  title,
  subtitle,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: C.radiusXl,
        padding: "36px",
        boxShadow: C.shadowMd,
        transition: `all ${C.transitionBase}`,
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: C.radiusLg,
          background: C.accentLight,
          color: C.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: C.textXl,
          fontWeight: 400,
          color: C.text,
          marginBottom: "6px",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: C.textSm,
          color: C.accent,
          fontWeight: 500,
          marginBottom: "16px",
        }}
      >
        {subtitle}
      </p>
      <p
        style={{
          fontSize: C.textSm,
          color: C.textSecondary,
          lineHeight: C.leadingRelaxed,
        }}
      >
        {description}
      </p>
    </div>
  );
}

// ─── FAQ Item ───────────────────────────────────────────────────────────

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details
      style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "20px 0",
        cursor: "pointer",
      }}
    >
      <summary
        style={{
          fontSize: C.textBase,
          fontWeight: 500,
          color: C.text,
          listStyle: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {question}
        <span style={{ fontSize: "12px", color: C.textMuted, marginLeft: "12px" }}>▾</span>
      </summary>
      <p
        style={{
          marginTop: "12px",
          fontSize: C.textSm,
          color: C.textSecondary,
          lineHeight: C.leadingRelaxed,
          maxWidth: "640px",
        }}
      >
        {answer}
      </p>
    </details>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function SecurityPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
      }}
    >
      {/* Noise texture */}
      <div className="noise-overlay" style={{ opacity: 0.3 }} />

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px 48px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 400,
            color: C.primary,
            letterSpacing: "-0.01em",
            textDecoration: "none",
          }}
        >
          Jeffrey.AI
        </Link>
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
              borderRadius: C.radiusMd,
              background: "transparent",
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
              borderRadius: C.radiusMd,
            }}
          >
            开始使用
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <main style={{ position: "relative", zIndex: 10 }}>
        <section
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            padding: "80px 48px 60px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: C.accentLight,
              color: C.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 28px",
            }}
          >
            <ShieldIcon size={36} />
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(40px, 5vw, 56px)",
              fontWeight: 400,
              color: C.text,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              marginBottom: "20px",
            }}
          >
            你的数据，
            <br />
            <span style={{ color: C.accent }}>只有你能看。</span>
          </h1>

          <p
            style={{
              fontSize: C.textLg,
              color: C.textSecondary,
              lineHeight: C.leadingRelaxed,
              maxWidth: "540px",
              margin: "0 auto",
            }}
          >
            Jeffrey.AI 采用端到端字段加密与 AI
            假名化技术，确保你的人脉数据在任何环节都不会暴露给第三方——包括我们。
          </p>
        </section>

        {/* ── Three Layers ──────────────────────────────────────── */}
        <section
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            padding: "0 48px 80px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          <LayerCard
            icon={<LockIcon />}
            title="存储加密"
            subtitle="AES-256-GCM"
            description="你的所有人脉数据——姓名、职业、兴趣、互动记忆、社交债务——在存入数据库前均使用 AES-256-GCM 算法加密。加密密钥由你的密码通过 Argon2id 密钥派生函数生成，不会存储在服务器的任何位置。即使攻击者获得了数据库的全部文件，看到的也只是密文。"
          />

          <LayerCard
            icon={<EyeOffIcon />}
            title="AI 假名化"
            subtitle="NER + 确定性替换"
            description="当你提交文本给 AI 分析时，系统首先在本地运行命名实体识别（NER），检测出真实人名、地名、机构名，然后用确定性假名（如 Person_a1b2c3）替换后，再将文本发送给 AI 服务商。AI 返回分析结果后，假名自动还原为真名。AI 服务商从未见过你的真实联系人信息。"
          />

          <LayerCard
            icon={<KeyIcon />}
            title="密钥安全"
            subtitle="Argon2id 密钥派生"
            description="你的登录密码是唯一的解密钥匙。密码本身通过 bcrypt（12 轮）哈希存储，仅用于登录验证。加密密钥通过 Argon2id（内存硬哈希函数，抗 GPU 暴力破解）从密码独立派生，仅在登录成功后的 JWT 会话中短暂存在于服务端内存。退出登录或会话过期后，密钥立即消失。"
          />
        </section>

        {/* ── Architecture Diagram ───────────────────────────────── */}
        <section
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            padding: "0 48px 80px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: C.text2xl,
              fontWeight: 400,
              color: C.text,
              letterSpacing: "-0.01em",
              marginBottom: "28px",
              textAlign: "center",
            }}
          >
            数据流向
          </h2>

          <div
            style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: C.radiusXl,
              padding: "36px",
              boxShadow: C.shadowMd,
            }}
          >
            {[
              { label: "明文输入", desc: "你输入的文字包含真实人名「老王」", color: C.primary, bg: C.warningBg },
              { label: "NER 假名化", desc: "本地识别「老王」→ 替换为 Person_a1b2c3", color: C.info, bg: C.infoBg },
              { label: "AI 分析", desc: "假名化文本发给 AI → AI 分析 Person_a1b2c3", color: C.textMuted, bg: C.bgHover },
              { label: "假名还原", desc: "AI 结果中 Person_a1b2c3 → 「老王」", color: C.info, bg: C.infoBg },
              { label: "AES 加密存储", desc: "「老王」← AES-256-GCM 加密 → 密文存入 PostgreSQL", color: C.accent, bg: C.accentLight },
            ].map((step, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                {/* Step number + line */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: step.bg,
                      color: step.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: C.textSm,
                      fontWeight: 600,
                      border: `1.5px solid ${step.color}`,
                    }}
                  >
                    {i + 1}
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: "1.5px", height: "28px", background: C.border, margin: "4px 0" }} />
                  )}
                </div>
                {/* Content */}
                <div style={{ paddingBottom: i < arr.length - 1 ? "20px" : "0" }}>
                  <div style={{ fontSize: C.textSm, fontWeight: 600, color: step.color, marginBottom: "2px" }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: C.textSm, color: C.textSecondary, lineHeight: C.leadingNormal }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            padding: "0 48px 80px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: C.text2xl,
              fontWeight: 400,
              color: C.text,
              letterSpacing: "-0.01em",
              marginBottom: "4px",
              textAlign: "center",
            }}
          >
            常见问题
          </h2>

          <div style={{ marginTop: "32px" }}>
            <FaqItem
              question="你们能看到我的数据吗？"
              answer="不能。所有敏感数据在写入数据库前都经过了 AES-256-GCM 加密，加密密钥由你的登录密码派生，服务器不存储密钥。数据库管理员看到的只是密文。"
            />
            <FaqItem
              question="我忘了密码怎么办？"
              answer="我们无法帮你恢复数据。你的密码是解密数据的唯一途径——这不是一个可选的'找回密码'功能，而是加密系统的基本属性：没有密钥，就无法解密。请务必妥善保管你的密码。"
            />
            <FaqItem
              question="加密会影响使用体验吗？"
              answer="不会。AES-256-GCM 是现代 CPU 硬件加速的加密算法，加密/解密操作在微秒级完成。假名化的 NER 识别在本地运行，延迟在毫秒级。你不会感知到任何性能差异。"
            />
            <FaqItem
              question="数据存在哪里？"
              answer="加密后的数据存储在 PostgreSQL 数据库（由 Supabase 托管）。Supabase 提供企业级基础设施安全，但即使 Supabase 也无法读取你的明文数据——因为他们没有你的解密密钥。"
            />
            <FaqItem
              question="如果我换了密码怎么办？"
              answer="更改密码时，系统会用旧密码解密全部数据，再用新密码重新加密——这个过程称为「密钥轮换」。轮换期间写入操作会被暂时阻止，以保证数据一致性。整个过程对用户透明。"
            />
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section
          style={{
            textAlign: "center",
            padding: "0 48px 100px",
          }}
        >
          <Link
            href="/auth/signup"
            style={{
              display: "inline-block",
              padding: "14px 32px",
              fontSize: "15px",
              fontWeight: 500,
              color: C.textInverse,
              textDecoration: "none",
              background: C.primary,
              borderRadius: C.radiusLg,
              letterSpacing: "0.01em",
            }}
          >
            开始使用 Jeffrey.AI →
          </Link>
          <p
            style={{
              marginTop: "14px",
              fontSize: C.textXs,
              color: C.textMuted,
            }}
          >
            无需信用卡 · 永远尊重你的隐私
          </p>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        style={{
          position: "relative",
          zIndex: 10,
          textAlign: "center",
          padding: "32px 48px",
          fontSize: C.textXs,
          color: C.textMuted,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <Link
          href="/"
          style={{
            color: C.textMuted,
            textDecoration: "none",
          }}
        >
          © 2026 Jeffrey.AI
        </Link>
      </footer>
    </div>
  );
}
