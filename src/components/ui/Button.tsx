"use client";

import { C } from "@/lib/design-tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const sizeStyles: Record<ButtonSize, { padding: string; fontSize: string; radius: number }> = {
  sm: { padding: "6px 12px", fontSize: "13px", radius: 6 },
  md: { padding: "10px 18px", fontSize: "14px", radius: 8 },
  lg: { padding: "13px 24px", fontSize: "16px", radius: 10 },
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: C.primary,
    color: C.bg,
    border: "none",
  },
  secondary: {
    background: "transparent",
    color: C.text,
    border: `1px solid ${C.borderStrong}`,
  },
  ghost: {
    background: "transparent",
    color: C.textSecondary,
    border: "none",
  },
  danger: {
    background: C.errorBg,
    color: C.error,
    border: `1px solid rgba(239, 108, 108, 0.2)`,
  },
  accent: {
    background: C.accent,
    color: C.bg,
    border: "none",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const sizeConf = sizeStyles[size];
  const baseStyle = variantStyles[variant];

  return (
    <button
      disabled={disabled || loading}
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: icon ? "8px" : undefined,
        padding: sizeConf.padding,
        fontSize: sizeConf.fontSize,
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        borderRadius: sizeConf.radius,
        border: baseStyle.border,
        background: baseStyle.background,
        color: baseStyle.color,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: `all ${C.transitionBase}`,
        width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          const el = e.currentTarget;
          if (variant === "primary") {
            el.style.background = C.primaryHover;
            el.style.boxShadow = C.shadowGlow;
          } else if (variant === "secondary") {
            el.style.background = C.bgHover;
            el.style.borderColor = C.borderAccent;
          } else if (variant === "ghost") {
            el.style.background = C.bgHover;
            el.style.color = C.text;
          } else if (variant === "danger") {
            el.style.background = "rgba(239, 108, 108, 0.15)";
          } else if (variant === "accent") {
            el.style.filter = "brightness(1.1)";
            el.style.boxShadow = C.shadowGlow;
          }
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = (baseStyle.background as string);
        el.style.boxShadow = "none";
        el.style.filter = "none";
        el.style.borderColor = variant === "secondary" ? C.borderStrong : variant === "danger" ? "rgba(239, 108, 108, 0.2)" : "transparent";
        el.style.color = baseStyle.color as string;
      }}
    >
      {loading ? (
        <>
          <div
            style={{
              width: 14,
              height: 14,
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: variant === "secondary" || variant === "ghost" ? C.textMuted : C.bg,
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }}
          />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
