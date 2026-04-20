"use client";

import { useState } from "react";
import { C } from "@/lib/design-tokens";

type AmbiguousPerson = {
  name: string;
  ambiguousWith: string[];
  careers: Array<{ name: string; weight: number }>;
  interests: Array<{ name: string; weight: number }>;
  vibeTags: string[];
};

type Props = {
  ambiguousPersons: AmbiguousPerson[];
  onConfirmMerge: (name: string, existingId: string, ambiguousName: string) => Promise<void>;
  onCreateNew: (name: string) => void;
  existingPersons: Array<{ id: string; name: string; careers: Array<{ name: string }> }>;
};

export default function AmbiguousPrompt({
  ambiguousPersons,
  onConfirmMerge,
  onCreateNew,
  existingPersons,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleConfirmMerge = async (name: string, existingId: string, ambiguousName: string) => {
    setLoading(name);
    try {
      await onConfirmMerge(name, existingId, ambiguousName);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      style={{
        backgroundColor: C.prompt.bg,
        border: `1px solid ${C.prompt.borderLight}`,
        borderRadius: "12px",
        padding: "20px 24px",
        marginTop: "16px",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 600, color: C.prompt.accent, marginBottom: "12px" }}>
        🔍 发现疑似重复记录
      </div>

      {ambiguousPersons.map((person) => {
        // Find matching existing persons by ambiguousWith
        const candidates = existingPersons.filter((ep) =>
          person.ambiguousWith.some(
            (aw) => ep.name.includes(aw) || aw.includes(ep.name)
          )
        );

        return (
          <div key={person.name} style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "14px", color: C.prompt.text, marginBottom: "8px" }}>
              <span style={{ fontWeight: 600 }}>{person.name}</span>
              {person.ambiguousWith.length > 0 && (
                <span style={{ color: C.prompt.textMuted }}>
                  {" "}可能与{" "}
                  {person.ambiguousWith.map((aw, i) => (
                    <span key={aw} style={{ color: C.prompt.accent, fontWeight: 600 }}>
                      {aw}
                      {i < person.ambiguousWith.length - 1 ? "、" : ""}
                    </span>
                  ))}
                  {" "}是同一人
                </span>
              )}
            </div>

            {/* Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
              {(person.careers || []).slice(0, 3).map((c) => (
                <span
                  key={c.name}
                  style={{
                    fontSize: "11px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    backgroundColor: C.prompt.tagCareerBg,
                    color: C.prompt.tagCareerText,
                  }}
                >
                  {c.name}
                </span>
              ))}
              {(person.interests || []).slice(0, 2).map((i) => (
                <span
                  key={i.name}
                  style={{
                    fontSize: "11px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    backgroundColor: C.prompt.tagInterestBg,
                    color: C.prompt.tagInterestText,
                  }}
                >
                  {i.name}
                </span>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {/* Merge to existing options */}
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => handleConfirmMerge(person.name, candidate.id, person.name)}
                  disabled={loading === person.name}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    cursor: loading === person.name ? "not-allowed" : "pointer",
                    backgroundColor: loading === person.name ? C.prompt.bgLight : C.prompt.accent,
                    border: `1px solid ${C.prompt.accent}`,
                    color: loading === person.name ? C.prompt.textMuted : C.bg,
                    transition: "all 0.15s",
                  }}
                >
                  {loading === person.name ? "合并中..." : `是的，合并到老王`}
                </button>
              ))}

              {/* Create new option */}
              <button
                onClick={() => onCreateNew(person.name)}
                disabled={loading === person.name}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: loading === person.name ? "not-allowed" : "pointer",
                  backgroundColor: C.bg,
                  border: `1px solid ${C.borderStrong}`,
                  color: C.textSecondary,
                  transition: "all 0.15s",
                }}
              >
                不是，创建新条目
              </button>
            </div>
          </div>
        );
      })}

      {ambiguousPersons.length === 0 && (
        <div style={{ fontSize: "13px", color: C.prompt.textMuted }}>
          未找到疑似重复的记录
        </div>
      )}
    </div>
  );
}
