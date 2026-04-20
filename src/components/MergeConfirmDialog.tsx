"use client";

import { useState } from "react";
import type { WeightedTag } from "@/lib/embedding";
import { C } from "@/lib/design-tokens";

type PersonSummary = {
  id: string;
  name: string;
  careers: WeightedTag[];
  interests: WeightedTag[];
  vibeTags: string[];
  relationshipScore: number;
  lastContactDate: string;
  interactionCount: number;
};

type Props = {
  allPersons: PersonSummary[];
  survivorId: string;
  onSurvivorChange: (survivorId: string) => void;
  onConfirm: (survivorId: string, victimIds: string[]) => Promise<void>;
  onCancel: () => void;
};

const STYLES = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    backgroundColor: C.prompt.bg,
    borderRadius: "16px",
    width: "90vw",
    maxWidth: "520px",
    maxHeight: "85vh",
    overflow: "auto",
  },
  header: {
    padding: "20px 24px 12px",
    borderBottom: `1px solid ${C.prompt.border}`,
  },
  body: {
    padding: "16px 24px",
  },
  footer: {
    padding: "12px 24px 20px",
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: C.prompt.bgLight,
    border: `1px solid ${C.prompt.border}`,
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "12px",
  },
  survivorCard: {
    backgroundColor: C.prompt.bgLight,
    border: `2px solid ${C.prompt.survivorBorder}`,
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "12px",
  },
  victimCard: {
    backgroundColor: C.prompt.victimBg,
    border: `1px solid ${C.prompt.border}`,
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "8px",
  },
  tag: {
    display: "inline-block",
    fontSize: "11px",
    padding: "1px 6px",
    borderRadius: "4px",
    marginRight: "4px",
    marginBottom: "2px",
  },
  btn: {
    padding: "8px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
    border: "1px solid",
    transition: "all 0.15s",
  },
};

function TagPill({ label, type }: { label: string; type: "career" | "interest" | "vibe" }) {
  const colors = {
    career: { bg: C.prompt.tagCareerBg, color: C.prompt.tagCareerText },
    interest: { bg: C.prompt.tagInterestBg, color: C.prompt.tagInterestText },
    vibe: { bg: C.prompt.tagVibeBg, color: C.prompt.tagVibeText },
  };
  return (
    <span
      style={{
        ...STYLES.tag,
        backgroundColor: colors[type].bg,
        color: colors[type].color,
      }}
    >
      {label}
    </span>
  );
}

export default function MergeConfirmDialog({ allPersons, survivorId, onSurvivorChange, onConfirm, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const survivor = allPersons.find((p) => p.id === survivorId)!;
  const victims = allPersons.filter((p) => p.id !== survivorId);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(survivorId, victims.map((v) => v.id));
    } catch (e) {
      setError("合并失败，请重试");
      setLoading(false);
    }
  };

  return (
    <div style={STYLES.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={STYLES.modal}>
        {/* Header */}
        <div style={STYLES.header}>
          <h2 style={{ margin: 0, fontSize: "18px", color: C.prompt.text }}>
            合并 {allPersons.length} 条人脉记录
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: C.prompt.textMuted }}>
            合并后，被合并的记录将标记为已删除，所有信息汇总到主条目
          </p>
        </div>

        {/* Body */}
        <div style={STYLES.body}>
          {/* Summary stats */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div style={{ flex: 1, backgroundColor: C.prompt.bgLight, border: `1px solid ${C.prompt.border}`, borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 600, color: C.prompt.accent }}>{allPersons.length}</div>
              <div style={{ fontSize: "11px", color: C.prompt.textMuted }}>合并条目</div>
            </div>
            <div style={{ flex: 1, backgroundColor: C.prompt.bgLight, border: `1px solid ${C.prompt.border}`, borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 600, color: C.prompt.accent }}>
                {victims.reduce((sum, v) => sum + v.interactionCount, 0)}
              </div>
              <div style={{ fontSize: "11px", color: C.prompt.textMuted }}>迁移互动</div>
            </div>
            <div style={{ flex: 1, backgroundColor: C.prompt.bgLight, border: `1px solid ${C.prompt.border}`, borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 600, color: C.prompt.accent }}>
                {[
                  ...new Set([
                    ...allPersons.flatMap((p) => (p.careers || []).map((c) => c.name)),
                  ]),
                ].length}
              </div>
              <div style={{ fontSize: "11px", color: C.prompt.textMuted }}>职业标签</div>
            </div>
          </div>

          {/* Aliases */}
          {victims.some((v) => v.name !== survivor.name) && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: C.prompt.textMuted, marginBottom: "4px" }}>别名汇总</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {[
                  survivor.name,
                  ...victims.map((v) => v.name),
                ]
                  .filter((name) => name !== survivor.name)
                  .map((name) => (
                    <span
                      key={name}
                      style={{
                        fontSize: "12px",
                        padding: "2px 8px",
                        backgroundColor: C.prompt.tagInterestBg,
                        color: C.prompt.tagInterestText,
                        borderRadius: "4px",
                      }}
                    >
                      {name}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Person cards */}
          <div style={{ fontSize: "13px", fontWeight: 600, color: C.prompt.text, marginBottom: "8px" }}>
            选择主条目（保留）
          </div>

          {/* Survivor selector */}
          {allPersons.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                if (p.id !== survivorId) {
                  onSurvivorChange(p.id);
                }
              }}
              style={{
                ...(p.id === survivorId ? STYLES.survivorCard : STYLES.victimCard),
                cursor: "pointer",
                border: p.id === survivorId ? `2px solid ${C.prompt.survivorBorder}` : `1px solid ${C.prompt.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="radio"
                  checked={p.id === survivorId}
                  onChange={() => {
                    if (p.id !== survivorId) {
                      onSurvivorChange(p.id);
                    }
                  }}
                  style={{ accentColor: C.prompt.accent, width: "16px", height: "16px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontWeight: 600, color: C.prompt.text, fontSize: "15px" }}>{p.name}</span>
                    <span style={{ fontSize: "12px", color: C.prompt.textMuted }}>关系 {p.relationshipScore}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                    {(p.careers || []).slice(0, 3).map((c) => (
                      <TagPill key={c.name} label={c.name} type="career" />
                    ))}
                    {(p.interests || []).slice(0, 2).map((i) => (
                      <TagPill key={i.name} label={i.name} type="interest" />
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: "12px", color: p.id === survivorId ? C.prompt.accent : C.prompt.textMuted }}>
                  {p.id === survivorId ? "主条目" : "→ 合并"}
                </span>
              </div>
            </div>
          ))}


          {error && (
            <div style={{ color: C.error, fontSize: "13px", marginTop: "8px" }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={STYLES.footer}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              ...STYLES.btn,
              backgroundColor: C.prompt.bgLight,
              borderColor: C.borderStrong,
              color: C.textSecondary,
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              ...STYLES.btn,
              backgroundColor: loading ? C.prompt.bgLight : C.prompt.accent,
              borderColor: C.prompt.accent,
              color: loading ? C.prompt.textMuted : C.bg,
            }}
          >
            {loading ? "合并中..." : "确认合并"}
          </button>
        </div>
      </div>
    </div>
  );
}
