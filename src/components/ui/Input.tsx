import { C } from "@/lib/design-tokens";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, hint, icon, style, ...props }: InputProps) {
  const inputId = props.id || props.name;

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 500,
            color: C.textSecondary,
            marginBottom: "6px",
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        {icon && (
          <div
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: C.textMuted,
              pointerEvents: "none",
              display: "flex",
            }}
          >
            {icon}
          </div>
        )}
        <input
          id={inputId}
          {...props}
          style={{
            width: "100%",
            padding: icon ? "10px 14px 10px 38px" : "10px 14px",
            fontSize: "15px",
            fontFamily: "var(--font-body)",
            color: C.text,
            background: C.bg,
            border: `1.5px solid ${error ? C.error : C.borderStrong}`,
            borderRadius: 8,
            outline: "none",
            transition: `border-color ${C.transitionBase}, box-shadow ${C.transitionBase}`,
            boxSizing: "border-box",
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? C.error : C.primary;
            e.currentTarget.style.boxShadow = error
              ? `0 0 0 3px ${C.errorBg}`
              : `0 0 0 3px rgba(201, 149, 106, 0.15)`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? C.error : C.borderStrong;
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
      {error && (
        <p style={{ fontSize: "12px", color: C.error, marginTop: "4px" }}>{error}</p>
      )}
      {hint && !error && (
        <p style={{ fontSize: "12px", color: C.textMuted, marginTop: "4px" }}>{hint}</p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, style, ...props }: TextareaProps) {
  const inputId = props.id || props.name;

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 500,
            color: C.textSecondary,
            marginBottom: "6px",
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: "15px",
          fontFamily: "var(--font-body)",
          color: C.text,
          background: C.bg,
          border: `1.5px solid ${error ? C.error : C.borderStrong}`,
          borderRadius: 8,
          outline: "none",
          resize: "vertical",
          minHeight: "100px",
          transition: `border-color ${C.transitionBase}, box-shadow ${C.transitionBase}`,
          boxSizing: "border-box",
          lineHeight: 1.6,
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? C.error : C.primary;
          e.currentTarget.style.boxShadow = error
            ? `0 0 0 3px ${C.errorBg}`
            : `0 0 0 3px rgba(201, 149, 106, 0.15)`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? C.error : C.borderStrong;
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      {error && (
        <p style={{ fontSize: "12px", color: C.error, marginTop: "4px" }}>{error}</p>
      )}
    </div>
  );
}
