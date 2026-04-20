import { C } from "@/lib/design-tokens";

interface SectionLabelProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionLabel({ children, action }: SectionLabelProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "14px",
        paddingBottom: "10px",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: C.textMuted,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
        }}
      >
        {children}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
