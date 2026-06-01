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
            gridTemplateColumns: "repeat(3, 1fr)",
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

        {/* ── Admin's View ─────────────────────────────────────────── */}
        <section
          style={{
            maxWidth: "880px",
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
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            后台看到什么？
          </h2>
          <p
            style={{
              fontSize: C.textSm,
              color: C.textMuted,
              textAlign: "center",
              marginBottom: "36px",
            }}
          >
            即使攻击者拿到了完整数据库，他看到的也只有这些——
          </p>

          {/* Database Screenshot Comic */}
          <div
            style={{
              background: "#0d1117",
              borderRadius: C.radiusXl,
              border: "1px solid #30363d",
              overflow: "hidden",
              boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
            }}
          >
            {/* Title bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                background: "#161b22",
                borderBottom: "1px solid #30363d",
              }}
            >
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ff5f56" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ffbd2e" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#27ca40" }} />
              <span
                style={{
                  marginLeft: "12px",
                  fontSize: "12px",
                  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                  color: "#8b949e",
                }}
              >
                Supabase — jeffrey_db_main — Person 表
              </span>
            </div>

            {/* Table rows */}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                  fontSize: "12px",
                  lineHeight: "1.6",
                }}
              >
                <thead>
                  <tr style={{ background: "#161b22", color: "#8b949e" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #30363d", whiteSpace: "nowrap" }}>id</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #30363d", whiteSpace: "nowrap" }}>name</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #30363d", whiteSpace: "nowrap" }}>careers</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #30363d", whiteSpace: "nowrap" }}>coreMemories</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #30363d", whiteSpace: "nowrap" }}>sentiment</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      id: "a1b2...",
                      name: "v1:jK9mP2vR7s:7Hr8MtZTpEm56He2rGo1HO36FmuRBlQizg==",
                      careers: "v1:Xy7ZqW3v:Ut8Mn5BcVx9Lp4Rj2Wk6Hf3SaDg1Qw==",
                      memories: "v1:Nk4Pq9Rs:7Tv2Wx5Yz8Bc3Df1Gh6Jk9Lm2Np4Qr==",
                      sentiment: "v1:SaDg1Qw2:Jk9Lm2Np4Qr7Tv2Wx5Yz8Bc3Df1Gh==",
                      ver: "v1.0",
                    },
                    {
                      id: "c3d4...",
                      name: "v1:Wx5Yz8Bc3:Ds1Fg6Hj9Kl2Mn4Pq7Rt8Uv2Wx5Yz==",
                      careers: "v1:Bc3Df1Gh:6Jk9Lm2Np4Qr7Tv2Wx5Yz8Bc3Df1Gh==",
                      memories: "v1:K9Lm2Np4:Qr7Tv2Wx5Yz8Bc3Df1Gh6Jk9Lm2Np==",
                      sentiment: "v1:Gh6Jk9Lm:2Np4Qr7Tv2Wx5Yz8Bc3Df1Gh6Jk==",
                      ver: "v1.0",
                    },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i === 0 ? "#0d1117" : "#161b22",
                        borderBottom: "1px solid #21262d",
                      }}
                    >
                      <td style={{ padding: "10px 14px", color: "#58a6ff", whiteSpace: "nowrap" }}>{row.id}</td>
                      <td style={{ padding: "10px 14px", color: "#7ee787", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</td>
                      <td style={{ padding: "10px 14px", color: "#7ee787", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.careers}</td>
                      <td style={{ padding: "10px 14px", color: "#7ee787", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.memories}</td>
                      <td style={{ padding: "10px 14px", color: "#7ee787", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sentiment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Annotations */}
            <div style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: "16px", borderTop: "1px solid #30363d" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7ee787", flexShrink: 0 }} />
                <span style={{ fontSize: "11px", color: "#8b949e", fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace" }}>
                  All sensitive columns are AES-256-GCM ciphertext
                </span>
              </div>
            </div>
          </div>

          {/* The Key Flow */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr auto 1fr",
              alignItems: "center",
              gap: "0",
              marginTop: "36px",
              fontSize: C.textSm,
            }}
          >
            {/* Locked DB */}
            <div
              style={{
                textAlign: "center",
                padding: "20px 16px",
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                borderRadius: C.radiusLg,
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <div style={{ fontWeight: 500, color: C.text, marginBottom: "4px" }}>加密数据库</div>
              <div style={{ color: C.textMuted, lineHeight: 1.5 }}>
                全是 v1:... 密文
                <br />
                无密码 = 无解
              </div>
            </div>

            {/* Arrow 1 */}
            <div style={{ color: C.textMuted, fontSize: "20px", padding: "0 4px" }}>→</div>

            {/* Password */}
            <div
              style={{
                textAlign: "center",
                padding: "20px 16px",
                background: C.accentLight,
                border: `1.5px solid ${C.accent}`,
                borderRadius: C.radiusLg,
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <div style={{ fontWeight: 500, color: C.primary, marginBottom: "4px" }}>你的密码</div>
              <div style={{ color: C.textMuted, lineHeight: 1.5 }}>
                只在登录时存在于内存
                <br />
                不存盘 · 不记录 · 不传输
              </div>
            </div>

            {/* Arrow 2 */}
            <div style={{ color: C.textMuted, fontSize: "20px", padding: "0 4px" }}>→</div>

            {/* Decrypted */}
            <div
              style={{
                textAlign: "center",
                padding: "20px 16px",
                background: C.successBg,
                border: `1px solid rgba(34,197,94,0.2)`,
                borderRadius: C.radiusLg,
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div style={{ fontWeight: 500, color: C.success, marginBottom: "4px" }}>解密成功</div>
              <div style={{ color: C.textMuted, lineHeight: 1.5 }}>
                王总 · 投资人 · AI 医疗
                <br />
                下次见面：周三
              </div>
            </div>
          </div>

          {/* Bottom caption */}
          <div
            style={{
              marginTop: "24px",
              padding: "20px 24px",
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: C.radiusLg,
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
            }}
          >
            {/* Bcrypt hash display */}
            <div
              style={{
                flex: 1,
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: "11px",
                color: C.textMuted,
                lineHeight: "1.7",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 600, color: C.textSecondary, marginBottom: "6px", fontFamily: "var(--font-body)" }}>
                数据库 User 表中存储的"密码"：
              </div>
              <div style={{ wordBreak: "break-all", color: "#7ee787", background: "#0d1117", padding: "10px 14px", borderRadius: "6px", border: "1px solid #30363d" }}>
                passwordHash: $2b$12$k8Hf3Jq7Rz9Wx1Yv4Np6Ku...
              </div>
              <div style={{ marginTop: "10px", fontSize: "12px", fontWeight: 600, color: C.textSecondary, fontFamily: "var(--font-body)", marginBottom: "6px" }}>
                这不是你的密码：
              </div>
              <div style={{ color: C.textMuted, lineHeight: 1.6 }}>
                bcrypt 是单向哈希。任何人都无法从 <code style={{ color: "#7ee787", background: "rgba(126,231,135,0.08)", padding: "1px 4px", borderRadius: "3px" }}>$2b$12$...</code> 反推出原始密码。
                <br />
                你的密码只存在于你的记忆里。我们从未见过它，也永远无法见到它。
              </div>
            </div>

            {/* Decorative lock */}
            <div style={{ flexShrink: 0, opacity: 0.3 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
                <circle cx="12" cy="16" r="1" />
              </svg>
            </div>
          </div>
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
              { label: "明文输入", desc: "你输入的文字包含真实人名「老王」" },
              { label: "NER 假名化", desc: "本地识别「老王」→ 替换为 Person_a1b2c3" },
              { label: "AI 分析", desc: "仅假名化文本发送给 AI 服务商 —— 服务商只看到 Person_a1b2c3，不知「老王」是谁" },
              { label: "假名还原", desc: "本地将 AI 服务商返回的 Person_a1b2c3 还原为「老王」" },
              { label: "AES 加密存储", desc: "「老王」← AES-256-GCM 加密 → 密文存入 PostgreSQL", isDest: true },
            ].map((step, i, arr) => {
              const accent = (step as any).isDest ? C.accent : C.textSecondary;
              const bg = (step as any).isDest ? C.accentLight : C.bgHover;
              return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: bg,
                      color: accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: C.textSm,
                      fontWeight: 500,
                      border: `1.5px solid ${(step as any).isDest ? C.accent : C.borderStrong}`,
                    }}
                  >
                    {i + 1}
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: "1px", height: "28px", background: C.border, margin: "4px 0" }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? "20px" : "0" }}>
                  <div style={{ fontSize: C.textSm, fontWeight: 600, color: accent, marginBottom: "2px" }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: C.textSm, color: C.textSecondary, lineHeight: C.leadingNormal }}>
                    {step.desc}
                  </div>
                  </div>
                </div>
              );
            })}
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
              question="我的密码存在数据库里吗？"
              answer="不存。注册时密码经过 bcrypt（12 轮）哈希后仅保存哈希值——这是一个不可逆的数学运算，任何人都无法从哈希值反推出原始密码。登录时，系统用 bcrypt 验证你输入的密码是否匹配哈希值。验证通过后，密码仅在内存中短暂驻留以派生加密密钥——不会写入磁盘、不会写入日志、不会进入数据库。"
            />
            <FaqItem
              question="既然名字加密了，怎么搜索？"
              answer="名字的查找使用「盲索引」技术：HMAC-SHA256(名字, pseudoKey) 生成一个固定长度的哈希值（nameHash），存储为明文索引。同一名字 + 同一密钥总是生成同一哈希值，所以可以精确查找——但哈希值是单向的，从 nameHash 无法反推出原始名字。模糊搜索（如同一个人不同称呼）则通过向量嵌入的语义匹配完成，不依赖名字明文。"
            />
            <FaqItem
              question="哪些字段被加密了？"
              answer="人物模型：姓名、别名、职业标签、兴趣标签、氛围标签、常驻城市、常去地点、搜索文本、破冰数据、嵌入向量。互动模型：地点、场景类型、情绪基调、待办事项、核心记忆。注：人物 ID、关系得分、最后联系日期等元数据字段不加密，用于排序和筛选。"
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
