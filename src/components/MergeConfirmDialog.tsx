"use client";

import { useState } from "react";
import type { WeightedTag } from "@/lib/embedding";

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
  survivor: PersonSummary;
  victims: PersonSummary[];
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
    backgroundColor: "#f5f3ef",
    borderRadius: "16px",
    width: "90vw",
    maxWidth: "520px",
    maxHeight: "85vh",
    overflow: "auto",
  },
  header: {
    padding: "20px 24px 12px",
    borderBottom: "1px solid #e0d9cf",
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
    backgroundColor: "white",
    border: "1px solid #e0d9cf",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "12px",
  },
  survivorCard: {
    backgroundColor: "white",
    border: "2px solid #c8a96e",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "12px",
  },
  victimCard: {
    backgroundColor: "#faf8f4",
    border: "1px solid #e0d9cf",
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
    career: { bg: "#dbeafe", color: "#1e40af" },
    interest: { bg: "#fef3c7", color: "#92400e" },
    vibe: { bg: "#e0e7ff", color: "#3730a3" },
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

export default function MergeConfirmDialog({ survivor, victims, onConfirm, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(survivor.id, victims.map((v) => v.id));
    } catch (e) {
      setError("合并失败，请重试");
      setLoading(false);
    }
  };

  const allPersons = [survivor, ...victims];

  return (
    <div style={STYLES.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={STYLES.modal}>
        {/* Header */}
        <div style={STYLES.header}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#3a2a1a" }}>
            合并 {allPersons.length} 条人脉记录
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#7a6a5a" }}>
            合并后，被合并的记录将标记为已删除，所有信息汇总到主条目
          </p>
        </div>

        {/* Body */}
        <div style={STYLES.body}>
          {/* Summary stats */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div style={{ flex: 1, backgroundColor: "#fff", border: "1px solid #e0d9cf", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 600, color: "#c8a96e" }}>{allPersons.length}</div>
              <div style={{ fontSize: "11px", color: "#7a6a5a" }}>合并条目</div>
            </div>
            <div style={{ flex: 1, backgroundColor: "#fff", border: "1px solid #e0d9cf", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 600, color: "#c8a96e" }}>
                {victims.reduce((sum, v) => sum + v.interactionCount, 0)}
              </div>
              <div style={{ fontSize: "11px", color: "#7a6a5a" }}>迁移互动</div>
            </div>
            <div style={{ flex: 1, backgroundColor: "#fff", border: "1px solid #e0d9cf", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 600, color: "#c8a96e" }}>
                {[
                  ...new Set([
                    ...allPersons.flatMap((p) => (p.careers || []).map((c) => c.name)),
                  ]),
                ].length}
              </div>
              <div style={{ fontSize: "11px", color: "#7a6a5a" }}>职业标签</div>
            </div>
          </div>

          {/* Aliases */}
          {victims.some((v) => v.name !== survivor.name) && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "#7a6a5a", marginBottom: "4px" }}>别名汇总</div>
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
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
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
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#3a2a1a", marginBottom: "8px" }}>
            保留 <span style={{ color: "#c8a96e" }}>{survivor.name}</span> 作为主条目
          </div>

          {/* Survivor */}
          <div style={STYLES.survivorCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontWeight: 600, color: "#3a2a1a", fontSize: "15px" }}>{survivor.name}</span>
              <span style={{ fontSize: "12px", color: "#7a6a5a" }}>关系 {survivor.relationshipScore}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
              {(survivor.careers || []).slice(0, 3).map((c) => (
                <TagPill key={c.name} label={c.name} type="career" />
              ))}
              {(survivor.interests || []).slice(0, 2).map((i) => (
                <TagPill key={i.name} label={i.name} type="interest" />
              ))}
            </div>
          </div>

          {/* Victims */}
          {victims.map((v) => (
            <div key={v.id} style={STYLES.victimCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600, color: "#7a6a5a", fontSize: "14px" }}>{v.name}</span>
                <span style={{ fontSize: "12px", color: "#9a8a7a" }}>→ 合并</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                {(v.careers || []).slice(0, 2).map((c) => (
                  <TagPill key={c.name} label={c.name} type="career" />
                ))}
                {(v.interests || []).slice(0, 1).map((i) => (
                  <TagPill key={i.name} label={i.name} type="interest" />
                ))}
              </div>
              {v.interactionCount > 0 && (
                <div style={{ fontSize: "11px", color: "#9a8a7a", marginTop: "4px" }}>
                  含 {v.interactionCount} 条互动记录
                </div>
              )}
            </div>
          ))}

          {error && (
            <div style={{ color: "#dc2626", fontSize: "13px", marginTop: "8px" }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={STYLES.footer}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              ...STYLES.btn,
              backgroundColor: "white",
              borderColor: "#d1d5db",
              color: "#4b5563",
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              ...STYLES.btn,
              backgroundColor: loading ? "#f5f3ef" : "#c8a96e",
              borderColor: "#c8a96e",
              color: loading ? "#9a8a7a" : "white",
            }}
          >
            {loading ? "合并中..." : "确认合并"}
          </button>
        </div>
      </div>
    </div>
  );
}
