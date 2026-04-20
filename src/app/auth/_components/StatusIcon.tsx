interface StatusIconProps {
  type: "success" | "error";
  className?: string;
}

export function StatusIcon({ type, className }: StatusIconProps) {
  if (type === "success") {
    return (
      <div className={`auth-status-icon auth-status-icon-success ${className || ""}`}>
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`auth-status-icon auth-status-icon-error ${className || ""}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </div>
  );
}
