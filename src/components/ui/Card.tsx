"use client";

import { C } from "@/lib/design-tokens";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  /** Slight elevation difference for nested cards */
  variant?: "default" | "elevated" | "flat";
  padding?: number | string;
  radius?: number;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({
  children,
  style,
  variant = "default",
  padding = 20,
  radius = 12,
  onClick,
  hoverable,
}: CardProps) {
  const baseStyle: React.CSSProperties = {
    background: variant === "elevated" ? C.bgElevated : C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: radius,
    padding: typeof padding === "number" ? `${padding}px` : padding,
    boxShadow: variant === "elevated" ? C.shadowLg : C.shadowMd,
    transition: `all ${C.transitionBase}`,
    cursor: onClick || hoverable ? "pointer" : undefined,
    ...style,
  };

  if (hoverable) {
    return (
      <div
        style={baseStyle}
        onClick={onClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = C.borderStrong;
          e.currentTarget.style.background = C.bgHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.background = variant === "elevated" ? C.bgElevated : C.bgCard;
        }}
      >
        {children}
      </div>
    );
  }

  if (onClick) {
    return (
      <div style={baseStyle} onClick={onClick}>
        {children}
      </div>
    );
  }

  return <div style={baseStyle}>{children}</div>;
}
