"use client";

import { useState, useEffect, useRef } from "react";
import { C } from "@/lib/design-tokens";

export interface ProgressStep {
  icon: string;
  title: string;
  detail?: string;
  status: "waiting" | "active" | "done";
}

interface AnalysisProgressProps {
  /** 从 SSE 流中收集的进度步骤 */
  steps: ProgressStep[];
  /** 是否仍在等待更多事件 */
  isStreaming: boolean;
}

/** SSE 驱动的分析进度动画：逐步展示解析→提取→检测→完成 */
export default function AnalysisProgress({ steps, isStreaming }: AnalysisProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isStreaming) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isStreaming]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: C.radiusMd,
            background: step.status === "active"
              ? `linear-gradient(135deg, rgba(212,168,83,0.08) 0%, rgba(201,169,110,0.04) 100%)`
              : C.bgElevated,
            border: `1px solid ${
              step.status === "active"
                ? C.borderAccent
                : step.status === "done"
                  ? `rgba(110,191,139,0.2)`
                  : C.border
            }`,
            opacity: step.status === "waiting" ? 0 : 1,
            transform: step.status === "waiting" ? "translateY(8px)" : "translateY(0)",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 16,
              background:
                step.status === "active"
                  ? C.accentLight
                  : step.status === "done"
                    ? C.successBg
                    : "transparent",
              border: `1.5px solid ${
                step.status === "active"
                  ? C.primary
                  : step.status === "done"
                    ? C.success
                    : C.border
              }`,
              animation: step.status === "active" ? "spinPulse 1.5s ease-in-out infinite" : "none",
            }}
          >
            {step.status === "done" ? "✓" : step.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: 2, color: C.text }}>
              {step.title}
              {step.status === "active" && isStreaming && (
                <span style={{
                  display: "inline",
                  fontSize: 12,
                  color: C.textMuted,
                  fontWeight: 400,
                  marginLeft: 8,
                }}>
                  {elapsed < 60
                    ? `${elapsed}s`
                    : `${Math.floor(elapsed / 60)}m${elapsed % 60}s`}
                </span>
              )}
            </div>
            {step.detail && (
              <div style={{ fontSize: 12.5, color: C.textMuted }}>{step.detail}</div>
            )}
          </div>
        </div>
      ))}
      <style>{`
        @keyframes spinPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          50% { box-shadow: 0 0 0 5px rgba(245,158,11,0.12); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
