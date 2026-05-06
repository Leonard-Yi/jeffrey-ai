"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Jeffrey.AI] input page error:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        padding: "40px 20px",
        textAlign: "center",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: "#dc2626",
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        出错了
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#6b7280",
          marginBottom: 24,
          maxWidth: 400,
        }}
      >
        输入页面加载失败，请尝试刷新。
      </div>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          backgroundColor: "#f59e0b",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        重试
      </button>
    </div>
  );
}
