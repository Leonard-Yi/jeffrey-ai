"use client";

import { useEffect, useState, useRef } from "react";
import { tokens as C } from "@/lib/design-tokens";

type PersonOption = { id: string; name: string; relationshipScore: number };

type MultiIntroducerSelectorProps = {
  values: string[];
  currentPersonId: string;
  onChange: (ids: string[]) => Promise<void>;
  allPersons: PersonOption[];
  onNavigate: (id: string) => void;
};

export default function MultiIntroducerSelector({
  values,
  currentPersonId,
  onChange,
  allPersons,
  onNavigate,
}: MultiIntroducerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [persons, setPersons] = useState<PersonOption[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/members/table")
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.rows || [])
          .filter((p: PersonOption) => p.id !== currentPersonId)
          .sort(
          (a: PersonOption, b: PersonOption) =>
            b.relationshipScore - a.relationshipScore
        );
        setPersons(sorted);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("加载失败");
      });
  }, [open, currentPersonId]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const displayNames = values.map((id) => {
    const found = allPersons.find((p) => p.id === id);
    return found ? found.name : id;
  });

  const displayText =
    values.length === 0 ? "点击选择介绍人" : displayNames.join("、");

  const filtered = persons.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const togglePerson = async (id: string) => {
    const newValues = values.includes(id)
      ? values.filter((v) => v !== id)
      : [...values, id];
    await onChange(newValues);
  };

  const dropdownBase: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    backgroundColor: C.bgElevated,
    border: `1px solid ${C.border}`,
    borderRadius: C.radiusMd,
    boxShadow: C.shadowMd,
    padding: 8,
  };

  const searchInput: React.CSSProperties = {
    width: "100%",
    border: `1px solid ${C.border}`,
    borderRadius: C.radiusSm,
    padding: "6px 10px",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    color: C.text,
    backgroundColor: C.bg,
  };

  const listItem: React.CSSProperties = {
    padding: "6px 4px",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: 4,
    color: C.text,
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {open ? (
        <div onMouseDown={(e) => e.stopPropagation()} style={dropdownBase}>
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索人脉..."
            style={searchInput}
          />
          <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 6 }}>
            {loading ? (
              <div style={{ padding: "8px 4px", color: C.textMuted, fontSize: 13 }}>
                加载中...
              </div>
            ) : error ? (
              <div style={{ padding: "8px 4px", color: C.error, fontSize: 13 }}>
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "8px 4px", color: C.textMuted, fontSize: 13 }}>
                未找到匹配人脉
              </div>
            ) : (
              <>
                {values.length > 0 && (
                  <div
                    onClick={async () => {
                      await onChange([]);
                    }}
                    style={{ ...listItem, color: C.error, cursor: "pointer" }}
                  >
                    清除全部
                  </div>
                )}
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => togglePerson(p.id)}
                    style={listItem}
                    onMouseEnter={(e) =>
                      ((e as any).currentTarget.style.backgroundColor = C.bgHover)
                    }
                    onMouseLeave={(e) =>
                      ((e as any).currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        border: `2px solid ${
                          values.includes(p.id) ? C.primary : C.border
                        }`,
                        backgroundColor: values.includes(p.id)
                          ? C.primary
                          : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {values.includes(p.id) && (
                        <span style={{ color: "white", fontSize: 10, lineHeight: 1 }}>
                          ✓
                        </span>
                      )}
                    </span>
                    {p.name}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", alignItems: "center" }}>
          {values.length === 0 ? (
            <span
              onClick={() => setOpen(true)}
              style={{
                cursor: "pointer",
                color: C.primary,
                fontStyle: "italic",
              }}
              title="点击选择介绍人"
            >
              点击选择介绍人
            </span>
          ) : (
            displayNames.map((name, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  onClick={() => onNavigate(values[i])}
                  style={{
                    cursor: "pointer",
                    color: C.text,
                    textDecoration: "underline",
                    textDecorationColor: C.primary,
                  }}
                  title={`查看 ${name} 的资料`}
                >
                  {name}
                </span>
                <span
                  onClick={() => setOpen(true)}
                  style={{ cursor: "pointer", color: C.textMuted, fontSize: 11 }}
                  title="编辑选择"
                >
                  ✎
                </span>
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}
