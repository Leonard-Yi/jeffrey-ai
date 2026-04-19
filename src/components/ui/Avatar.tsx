import { C } from "@/lib/design-tokens";

interface AvatarProps {
  name?: string;
  size?: number;
  style?: React.CSSProperties;
}

export function Avatar({ name, size = 40, style }: AvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : "J";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.bgElevated,
        border: `1.5px solid ${C.borderStrong}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: C.shadowSm,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: size * 0.4,
          color: C.primary,
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        {initial}
      </span>
    </div>
  );
}
