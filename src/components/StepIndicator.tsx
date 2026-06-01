"use client";

import { C } from "@/lib/design-tokens";

export interface StepInfo {
  label: string;
  status: "done" | "active" | "pending";
}

interface StepIndicatorProps {
  steps: StepInfo[];
}

/** 分轮追问步骤指示器：①→②→③，当前步骤脉冲动画 */
export default function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {steps.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {i > 0 && (
              <div
                style={{
                  width: 32,
                  height: 2,
                  background: step.status === "done" || steps[i - 1]?.status === "done"
                    ? C.success
                    : C.border,
                  flexShrink: 0,
                  transition: "background 0.35s",
                }}
              />
            )}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
                border: `2px solid ${
                  step.status === "done"
                    ? C.success
                    : step.status === "active"
                      ? C.primary
                      : C.borderStrong
                }`,
                color:
                  step.status === "done"
                    ? C.success
                    : step.status === "active"
                      ? C.primary
                      : C.textMuted,
                background:
                  step.status === "active"
                    ? C.primaryDim
                    : step.status === "done"
                      ? C.successBg
                      : "transparent",
                transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                animation:
                  step.status === "active"
                    ? "stepPulse 1.8s ease-in-out infinite"
                    : "none",
              }}
            >
              {step.status === "done" ? "✓" : i + 1}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          width: "100%",
          maxWidth: 280,
          marginTop: 6,
          fontSize: 11,
          color: C.textMuted,
        }}
      >
        {steps.map((step) => (
          <span
            key={step.label}
            style={{
              textAlign: "center",
              color:
                step.status === "active"
                  ? C.primary
                  : step.status === "done"
                    ? C.success
                    : C.textMuted,
              fontWeight: step.status === "active" ? 500 : 400,
              transition: "color 0.35s",
            }}
          >
            {step.label}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes stepPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          50% { box-shadow: 0 0 0 6px rgba(245,158,11,0.15); }
        }
      `}</style>
    </div>
  );
}
