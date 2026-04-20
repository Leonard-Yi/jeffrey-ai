import { C } from "@/lib/design-tokens";

type BadgeVariant = "default" | "primary" | "success" | "error" | "warning" | "info";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  default: { bg: C.bgHover, color: C.textSecondary, border: C.borderStrong },
  primary: { bg: C.accentLight, color: C.accent, border: "rgba(232, 184, 109, 0.2)" },
  success: { bg: C.successBg, color: C.success, border: "rgba(124, 179, 119, 0.2)" },
  error: { bg: C.errorBg, color: C.error, border: "rgba(239, 108, 108, 0.2)" },
  warning: { bg: C.warningBg, color: C.warning, border: "rgba(232, 184, 109, 0.2)" },
  info: { bg: C.infoBg, color: C.info, border: "rgba(122, 162, 201, 0.2)" },
};

export function Badge({ children, variant = "default", size = "md", style }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: size === "sm" ? "2px 7px" : "3px 10px",
        fontSize: size === "sm" ? "11px" : "12px",
        fontWeight: 500,
        borderRadius: "9999px",
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
