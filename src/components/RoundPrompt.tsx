"use client";

import { useEffect, useRef } from "react";
import { C } from "@/lib/design-tokens";
import { Button } from "@/components/ui/Button";
import StepIndicator, { type StepInfo } from "./StepIndicator";

export interface MissingFieldQuestion {
  field: string;
  priority: "high" | "mid" | "low";
  question: string;
  detail?: string;
}

interface RoundPromptProps {
  /** All missing fields (for step indicator) */
  allFields: MissingFieldQuestion[];
  /** Current question index */
  currentIndex: number;
  /** Pre-filled answer (when going back) */
  defaultValue?: string;
  /** Whether this is the last round */
  isLast: boolean;
  /** Whether showing the back button */
  showBack: boolean;
  /** Disable all interactive elements (during API call) */
  disabled?: boolean;
  /** Called when user confirms their answer */
  onConfirm: (answer: string | null) => void;
  /** Called when user skips */
  onSkip: () => void;
  /** Called when user goes back to previous question */
  onBack: () => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  high: { label: "🔴 关键", bg: C.errorBg, color: C.error, border: `rgba(224,85,106,0.25)` },
  mid: { label: "🟡 重要", bg: C.warningBg, color: C.warning, border: `rgba(212,168,83,0.25)` },
  low: { label: "⚪ 补充", bg: C.bgElevated, color: C.textMuted, border: `1px solid ${C.borderStrong}` },
};

const NAME_SUGGESTIONS = ["王总", "张总", "李总", "刘工", "陈老师"];

export default function RoundPrompt({
  allFields,
  currentIndex,
  defaultValue = "",
  isLast,
  showBack,
  disabled = false,
  onConfirm,
  onSkip,
  onBack,
}: RoundPromptProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currentField = allFields[currentIndex];
  const priorityCfg = PRIORITY_CONFIG[currentField.priority] || PRIORITY_CONFIG.low;

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentIndex]);

  const steps: StepInfo[] = allFields.map((f, i) => ({
    label: f.field === "name" ? "姓名" : f.field === "company" ? "公司" : f.field === "location" ? "地点" : f.field === "career" ? "职业" : f.field === "sentiment" ? "情绪" : f.field === "actionItems" ? "行动项" : "日期",
    status: i < currentIndex ? "done" : i === currentIndex ? "active" : "pending",
  }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !disabled) {
      const val = inputRef.current?.value?.trim() || null;
      onConfirm(val);
    }
  };

  const handleSubmit = () => {
    if (disabled) return;
    const val = inputRef.current?.value?.trim() || null;
    onConfirm(val);
  };

  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(212,168,83,0.06) 0%, rgba(201,169,110,0.03) 100%)`,
        border: `1px solid ${C.borderAccent}`,
        borderRadius: C.radiusLg,
        padding: "18px 20px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: C.bgElevated,
            border: `1.5px solid ${C.borderStrong}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 13,
            color: C.primary,
            flexShrink: 0,
          }}
        >
          J
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>
          Jeffrey 追问
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: 100,
            fontSize: 11.5,
            fontWeight: 600,
            background: priorityCfg.bg,
            color: priorityCfg.color,
            border: `1px solid ${priorityCfg.border}`,
          }}
        >
          {priorityCfg.label}
        </span>
      </div>

      {/* Step indicator */}
      <StepIndicator steps={steps} />

      {/* Question */}
      <div
        style={{
          fontSize: 15,
          color: C.text,
          fontStyle: "italic",
          lineHeight: 1.75,
          padding: "12px 16px",
          background: C.bgElevated,
          borderRadius: C.radiusMd,
          border: `1px solid ${C.border}`,
          marginBottom: 14,
        }}
      >
        <span style={{ display: "block", fontWeight: 500, fontStyle: "normal", marginBottom: 6, color: C.warning }}>
          第 {currentIndex + 1} 问：{steps[currentIndex].label}
        </span>
        {currentField.question}
        {currentField.detail && (
          <span style={{ display: "block", fontSize: 12.5, color: C.textMuted, marginTop: 6, fontStyle: "normal" }}>
            {currentField.detail}
          </span>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={currentField.priority === "high" ? "输入回答..." : "输入或留空跳过..."}
          defaultValue={defaultValue}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: C.radiusMd,
            border: `1.5px solid ${C.borderStrong}`,
            background: C.bg,
            color: C.text,
            fontFamily: "var(--font-body)",
            fontSize: 14,
            outline: "none",
            transition: "border-color 0.15s",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = C.primary)}
          onBlur={(e) => (e.target.style.borderColor = C.borderStrong)}
        />
        <Button
          variant="primary"
          disabled={disabled}
          onClick={handleSubmit}
          style={{ flex: "0 0 auto", minWidth: 80, borderRadius: C.radiusMd }}
        >
          {isLast ? "完成 ✓" : "继续 →"}
        </Button>
      </div>

      {/* Quick suggestions (for name field only) */}
      {currentField.field === "name" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          <span style={{ fontSize: 11.5, color: C.textMuted, alignSelf: "center" }}>快速选择：</span>
          {NAME_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              disabled={disabled}
              onClick={() => onConfirm(suggestion)}
              style={{
                padding: "4px 10px",
                borderRadius: 100,
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: "var(--font-body)",
                cursor: disabled ? "not-allowed" : "pointer",
                background: C.bgElevated,
                color: C.textSecondary,
                border: `1px solid ${C.borderStrong}`,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.borderColor = C.primary;
                  e.currentTarget.style.color = C.primary;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.borderStrong;
                e.currentTarget.style.color = C.textSecondary;
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Navigation row */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {showBack && (
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={onBack}
            style={{ flex: "0 0 auto", borderRadius: C.radiusMd, fontSize: 13 }}
          >
            ← 返回修改
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={onSkip}
          style={{ flex: "0 0 auto", borderRadius: C.radiusMd, fontSize: 13 }}
        >
          跳过
        </Button>
        <span style={{ fontSize: 12, color: C.textMuted, alignSelf: "center", marginLeft: "auto" }}>
          {currentIndex + 1}/{allFields.length}
        </span>
      </div>
    </div>
  );
}
