"use client";

import { C } from "@/lib/design-tokens";
import { SectionLabel } from "@/components/ui/SectionLabel";

interface ExtractedField {
  label: string;
  value: string;
}

interface ExtractionPreviewProps {
  fields: ExtractedField[];
}

/** 已提取字段预览：展示系统自动提取到的字段标签组 */
export default function ExtractionPreview({ fields }: ExtractionPreviewProps) {
  if (fields.length === 0) return null;

  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: C.radiusLg,
        padding: "14px 18px",
      }}
    >
      <SectionLabel>系统已自动提取</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
        {fields.map((f) => (
          <span
            key={f.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: C.radiusSm,
              fontSize: 11.5,
              fontWeight: 500,
              background: C.bgElevated,
              color: C.textSecondary,
              border: `1px solid ${C.border}`,
            }}
          >
            {f.label}: {f.value}
          </span>
        ))}
      </div>
    </div>
  );
}
