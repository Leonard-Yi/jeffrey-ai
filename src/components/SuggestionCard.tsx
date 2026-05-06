"use client";

import React from "react";
import { tokens as C } from "@/lib/design-tokens";

type CardType = "reminder" | "debt" | "icebreaker";

interface SuggestionCardProps {
  type: CardType;
  children: React.ReactNode;
}

const TYPE_COLORS = {
  reminder: { bg: C.warningBg, text: C.warning, icon: "🔔" },
  debt: { bg: C.errorBg, text: C.error, icon: "📋" },
  icebreaker: { bg: C.infoBg, text: C.info, icon: "💡" },
};

export default function SuggestionCard({ type, children }: SuggestionCardProps) {
  const colors = TYPE_COLORS[type];

  return (
    <div
      style={{
        backgroundColor: C.bgElevated,
        border: `1px solid ${C.border}`,
        borderRadius: C.radiusLg,
        padding: "16px 20px",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: C.text,
          }}
        >
          {colors.icon}{" "}
          {type === "reminder"
            ? "关系维护提醒"
            : type === "debt"
            ? "待办承诺"
            : "破冰助手"}
        </span>
        <span
          style={{
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 10,
            fontWeight: 500,
            backgroundColor: colors.bg,
            color: colors.text,
          }}
        >
          {type === "reminder"
            ? "关系"
            : type === "debt"
            ? "待办"
            : "破冰"}
        </span>
      </div>
      {children}
    </div>
  );
}
