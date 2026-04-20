import { C } from "@/lib/design-tokens";

interface TagProps {
  label: string;
  type?: "career" | "interest" | "vibe";
  weight?: number;
  size?: "sm" | "md";
  color?: string;
}

export function Tag({ label, type, weight, size = "md", color }: TagProps) {
  const typeColors = {
    career: {
      bg: "rgba(122, 162, 201, 0.12)",
      text: "#7aa2c9",
      border: "rgba(122, 162, 201, 0.2)",
    },
    interest: {
      bg: "rgba(201, 149, 106, 0.12)",
      text: C.primary,
      border: C.borderAccent,
    },
    vibe: {
      bg: "rgba(124, 179, 119, 0.12)",
      text: C.success,
      border: "rgba(124, 179, 119, 0.2)",
    },
  };

  const colors = type ? typeColors[type] : null;

  const bg = color ? `${color}18` : colors?.bg ?? C.bgHover;
  const text = color ?? colors?.text ?? C.textSecondary;
  const border = color ? `${color}30` : colors?.border ?? C.borderStrong;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: weight != null ? "5px" : undefined,
        padding: size === "sm" ? "2px 7px" : "3px 9px",
        borderRadius: 6,
        fontSize: size === "sm" ? "11px" : "12px",
        fontWeight: 500,
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        lineHeight: 1.4,
      }}
    >
      {label}
      {weight != null && (
        <span style={{ opacity: 0.6, fontSize: "11px" }}>
          {Math.round(weight * 100)}%
        </span>
      )}
    </span>
  );
}
