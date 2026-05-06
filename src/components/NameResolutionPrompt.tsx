"use client";

import { useState } from "react";
import { tokens as C } from "@/lib/design-tokens";

type Candidate = {
  id: string;
  name: string;
  similarity: number;
  matchType: "exact" | "embedding";
  careers: unknown[];
};

type Resolution = {
  mentionedName: string;
  candidates: Candidate[];
};

type PersonRow = {
  id: string;
  name: string;
  careers: Array<{ name: string }>;
};

type Props = {
  resolutions: Resolution[];
  allPersons: PersonRow[];
  onConfirm: (resolvedNames: Map<string, string>) => void;
  onSkip: () => void;
};

function CareerTag({ name }: { name: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        padding: "1px 6px",
        borderRadius: C.radiusSm,
        backgroundColor: C.infoBg,
        color: C.info,
        marginRight: 4,
      }}
    >
      {name}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7L5.5 10.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
      <circle cx="6" cy="6" r="4.5" stroke={C.textMuted} strokeWidth="1.5"/>
      <path d="M9.5 9.5L13 13" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function NameResolutionPrompt({ resolutions, allPersons, onConfirm, onSkip }: Props) {
  const [selections, setSelections] = useState<Map<string, string | null | undefined>>(new Map());
  const [searchQueries, setSearchQueries] = useState<Map<string, string>>(new Map());
  const [searchExpanded, setSearchExpanded] = useState<Map<string, boolean>>(new Map());

  const handleSelect = (mentionedName: string, candidateName: string) => {
    const newMap = new Map(selections);
    newMap.set(mentionedName, newMap.get(mentionedName) === candidateName ? undefined : candidateName);
    setSelections(newMap);
  };

  const handleCreateNew = (mentionedName: string) => {
    const newMap = new Map(selections);
    newMap.set(mentionedName, newMap.get(mentionedName) === null ? undefined : null);
    setSelections(newMap);
  };

  const handleSearchChange = (mentionedName: string, query: string) => {
    setSearchQueries(new Map(searchQueries).set(mentionedName, query));
  };

  const toggleSearch = (mentionedName: string) => {
    setSearchExpanded(new Map(searchExpanded).set(mentionedName, !searchExpanded.get(mentionedName)));
    setSearchQueries(new Map(searchQueries).set(mentionedName, ""));
  };

  const getSearchResults = (mentionedName: string) => {
    const query = searchQueries.get(mentionedName) || "";
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return allPersons
      .filter((p) => {
        const currentSelection = selections.get(mentionedName);
        if (currentSelection === p.name) return false;
        return p.name.toLowerCase().includes(lowerQuery);
      })
      .slice(0, 5);
  };

  const handleSearchSelect = (mentionedName: string, personName: string) => {
    const newMap = new Map(selections);
    newMap.set(mentionedName, personName);
    setSelections(newMap);
    setSearchExpanded(new Map(searchExpanded).set(mentionedName, false));
    setSearchQueries(new Map(searchQueries).set(mentionedName, ""));
  };

  const handleSubmit = () => {
    const resolved = new Map<string, string>();
    for (const [mentionedName, selectedName] of selections) {
      if (selectedName !== undefined && selectedName !== null) {
        resolved.set(mentionedName, selectedName);
      }
    }
    onConfirm(resolved);
  };

  const allResolved = resolutions.every((r) => selections.has(r.mentionedName));

  return (
    <div
      style={{
        backgroundColor: C.warningBg,
        border: `1px solid ${C.borderAccent}`,
        borderRadius: C.radiusLg,
        padding: "20px 24px",
        marginTop: 16,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: C.warning, marginBottom: 12 }}>
        🔍 检测到疑似已有联系人
      </div>

      {resolutions.map((resolution) => {
        const mentionedName = resolution.mentionedName;
        const currentSelection = selections.get(mentionedName);
        const isCreateNew = currentSelection === null;
        const isDecided = currentSelection !== undefined;
        const searchResults = getSearchResults(mentionedName);
        const isSearchOpen = searchExpanded.get(mentionedName);

        return (
          <div
            key={mentionedName}
            style={{
              marginBottom: 20,
              borderBottom: `1px dashed ${C.border}`,
              paddingBottom: 16,
            }}
          >
            {/* Header row */}
            <div
              style={{
                fontSize: 14,
                color: C.text,
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  backgroundColor: C.warningBg,
                  padding: "2px 8px",
                  borderRadius: C.radiusSm,
                }}
              >
                {mentionedName}
              </span>
              <span style={{ color: C.textSecondary }}>匹配到：</span>
            </div>

            {/* Candidates list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {resolution.candidates.map((candidate) => {
                const isSelected = currentSelection === candidate.name;
                const matchBadge =
                  candidate.matchType === "exact" ? (
                    <span style={{ fontSize: 11, color: C.success, fontWeight: 500 }}>
                      姓名匹配
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: C.textMuted }}>
                      {(candidate.similarity * 100).toFixed(0)}% 相似
                    </span>
                  );

                return (
                  <label
                    key={candidate.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: C.radiusMd,
                      border: `1px solid ${isSelected ? C.primary : C.border}`,
                      backgroundColor: isSelected ? C.warningBg : C.bgElevated,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: C.radiusSm,
                        border: `2px solid ${isSelected ? C.primary : C.borderStrong}`,
                        backgroundColor: isSelected ? C.primary : C.bgElevated,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                        color: "white",
                      }}
                    >
                      {isSelected && <CheckIcon />}
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelect(mentionedName, candidate.name)}
                      style={{ display: "none" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: C.text }}>
                          {candidate.name}
                        </span>
                        {matchBadge}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {((candidate.careers as Array<{ name: string }>) || [])
                          .slice(0, 3)
                          .map((c) => (
                            <CareerTag key={c.name} name={c.name} />
                          ))}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 10 }}>
              {!isSearchOpen ? (
                <button
                  onClick={() => toggleSearch(mentionedName)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: C.radiusSm,
                    fontSize: 13,
                    cursor: "pointer",
                    backgroundColor: C.bgElevated,
                    border: `1px dashed ${C.primary}`,
                    color: C.warning,
                    transition: "all 0.15s",
                  }}
                >
                  <SearchIcon />
                  搜索其他联系人
                </button>
              ) : (
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={searchQueries.get(mentionedName) || ""}
                    onChange={(e) => handleSearchChange(mentionedName, e.target.value)}
                    placeholder="搜索联系人姓名..."
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      paddingLeft: 36,
                      borderRadius: C.radiusSm,
                      border: `1px solid ${C.primary}`,
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                      backgroundColor: C.bgElevated,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <SearchIcon />
                  </div>
                  {searchResults.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        backgroundColor: C.bgElevated,
                        border: `1px solid ${C.border}`,
                        borderRadius: C.radiusSm,
                        marginTop: 4,
                        maxHeight: 200,
                        overflowY: "auto",
                        zIndex: 10,
                        boxShadow: C.shadowMd,
                      }}
                    >
                      {searchResults.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSearchSelect(mentionedName, p.name)}
                          style={{
                            padding: "8px 12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            borderBottom: `1px solid ${C.bgHover}`,
                          }}
                          onMouseEnter={(e) =>
                            ((e as any).currentTarget.style.backgroundColor = C.bgHover)
                          }
                          onMouseLeave={(e) =>
                            ((e as any).currentTarget.style.backgroundColor = "transparent")
                          }
                        >
                          <span style={{ fontWeight: 500 }}>{p.name}</span>
                          {p.careers && p.careers.length > 0 && (
                            <span style={{ fontSize: 12, color: C.textSecondary }}>
                              {p.careers.slice(0, 2).map((c) => c.name).join(", ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => toggleSearch(mentionedName)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: C.textMuted,
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Create new option */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: C.radiusMd,
                border: `1px solid ${isCreateNew ? C.error : C.border}`,
                backgroundColor: isCreateNew ? C.errorBg : C.bgElevated,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: C.radiusSm,
                  border: `2px solid ${isCreateNew ? C.error : C.borderStrong}`,
                  backgroundColor: isCreateNew ? C.error : C.bgElevated,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "white",
                }}
              >
                {isCreateNew && <CheckIcon />}
              </div>
              <input
                type="checkbox"
                checked={isCreateNew}
                onChange={() => handleCreateNew(mentionedName)}
                style={{ display: "none" }}
              />
              <span
                style={{
                  fontWeight: 500,
                  color: isCreateNew ? C.error : C.textSecondary,
                }}
              >
                不是以上任何人，创建新条目「{mentionedName}」
              </span>
            </label>
          </div>
        );
      })}

      {/* Submit / Skip */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 16,
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={onSkip}
          style={{
            padding: "8px 16px",
            borderRadius: C.radiusSm,
            fontSize: 13,
            cursor: "pointer",
            backgroundColor: C.bgElevated,
            border: `1px solid ${C.borderStrong}`,
            color: C.textSecondary,
          }}
        >
          跳过全部
        </button>
        <button
          onClick={handleSubmit}
          disabled={!allResolved}
          style={{
            padding: "8px 20px",
            borderRadius: C.radiusSm,
            fontSize: 13,
            cursor: allResolved ? "pointer" : "not-allowed",
            backgroundColor: allResolved ? C.primary : C.bg,
            border: `1px solid ${allResolved ? C.primary : C.borderStrong}`,
            color: allResolved ? C.textInverse : C.textMuted,
          }}
        >
          继续分析
        </button>
      </div>
    </div>
  );
}
