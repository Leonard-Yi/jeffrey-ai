"use client";

import { tokens as C } from "@/lib/design-tokens";

const STYLES = {
  fieldCard: {
    backgroundColor: C.bgElevated,
    border: `1px solid ${C.border}`,
    borderRadius: C.radiusMd,
    padding: "12px 16px",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  fieldValue: {
    fontSize: 15,
    color: C.text,
    cursor: "pointer",
    minHeight: 24,
  },
  fieldInput: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 15,
    color: C.text,
    border: `1px solid ${C.primary}`,
    borderRadius: C.radiusSm,
    outline: "none",
    boxSizing: "border-box" as const,
    backgroundColor: C.bg,
  },
  editButtons: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },
  saveButton: {
    padding: "6px 16px",
    backgroundColor: C.accent,
    color: C.bg,
    border: "none",
    borderRadius: C.radiusSm,
    cursor: "pointer",
    fontSize: 14,
  },
  cancelButton: {
    padding: "6px 16px",
    backgroundColor: C.bgActive,
    color: C.text,
    border: "none",
    borderRadius: C.radiusSm,
    cursor: "pointer",
    fontSize: 14,
  },
  errorText: {
    color: C.error,
    fontSize: 14,
    marginTop: 4,
  },
};

type FieldCardProps = {
  label: string;
  fieldKey: string;
  value: string;
  editingField: string | null;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
  isArray?: boolean;
  isNumber?: boolean;
  isDate?: boolean;
};

export default function FieldCard({
  label,
  fieldKey,
  value,
  editingField,
  editValue,
  onStartEdit,
  onEditChange,
  onKeyDown,
  onSave,
  onCancel,
  saving,
  saveError,
  isArray,
  isNumber,
  isDate,
}: FieldCardProps) {
  const isEditing = editingField === fieldKey;

  const inputType = isNumber ? "number" : isDate ? "date" : "text";
  const inputValue = isNumber
    ? editValue
    : isDate
    ? editValue
      ? editValue.split(" · ")[0].trim()
      : ""
    : editValue;

  return (
    <div style={STYLES.fieldCard}>
      <div style={STYLES.fieldLabel}>{label}</div>
      {isEditing ? (
        <>
          <input
            type={inputType}
            style={STYLES.fieldInput}
            value={inputValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            min={isNumber ? 0 : undefined}
            max={isNumber ? 100 : undefined}
          />
          {isDate && value && (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              当前: {value}
            </div>
          )}
          <div style={STYLES.editButtons}>
            <button
              style={STYLES.saveButton}
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button style={STYLES.cancelButton} onClick={onCancel}>
              取消
            </button>
          </div>
          {saveError && <div style={STYLES.errorText}>{saveError}</div>}
        </>
      ) : (
        <div
          style={STYLES.fieldValue}
          onClick={onStartEdit}
          title="点击编辑"
        >
          {value || "—"}
        </div>
      )}
    </div>
  );
}
