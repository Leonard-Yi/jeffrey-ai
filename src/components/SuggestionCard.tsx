"use client";

import React from "react";

type CardType = "reminder" | "debt" | "icebreaker";

interface SuggestionCardProps {
  type: CardType;
  children: React.ReactNode;
}

const STYLES = {
  card: {
    backgroundColor: "white",
    border: "1px solid #e0d9cf",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 12,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: "#3a2a1a",
  },
  badge: {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 10,
    fontWeight: 500,
  },
};

const TYPE_COLORS = {
  reminder: {
    bg: "#fff3e0",
    text: "#e65100",
    icon: "🔔",
  },
  debt: {
    bg: "#ffebee",
    text: "#c62828",
    icon: "📋",
  },
  icebreaker: {
    bg: "#e3f2fd",
    text: "#1565c0",
    icon: "💡",
  },
};

export default function SuggestionCard({ type, children }: SuggestionCardProps) {
  const colors = TYPE_COLORS[type];

  return (
    <div style={STYLES.card}>
      <div style={STYLES.header}>
        <span style={STYLES.title}>
          {colors.icon} {type === "reminder" ? "关系维护提醒" : type === "debt" ? "待办承诺" : "破冰助手"}
        </span>
        <span style={{ ...STYLES.badge, backgroundColor: colors.bg, color: colors.text }}>
          {type === "reminder" ? "关系" : type === "debt" ? "待办" : "破冰"}
        </span>
      </div>
      {children}
    </div>
  );
}
