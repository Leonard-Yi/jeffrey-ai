"use client";

import { useState, useMemo } from "react";

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
  // resolvedNames: key = original name in text, value = matched existing name
  onSkip: () => void;
};

function CareerTag({ name }: { name: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "11px",
        padding: "1px 6px",
        borderRadius: "4px",
        backgroundColor: "#dbeafe",
        color: "#1e40af",
        marginRight: "4px",
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: "6px" }}>
      <circle cx="6" cy="6" r="4.5" stroke="#9a8a7a" strokeWidth="1.5"/>
      <path d="M9.5 9.5L13 13" stroke="#9a8a7a" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function NameResolutionPrompt({ resolutions, allPersons, onConfirm, onSkip }: Props) {
  // Map: mentionedName -> selectedCandidateName (null = create new, undefined = not yet decided)
  const [selections, setSelections] = useState<Map<string, string | null | undefined>>(new Map());
  // Search query per mentioned name
  const [searchQueries, setSearchQueries] = useState<Map<string, string>>(new Map());
  // Expanded state per mentioned name (show search or not)
  const [searchExpanded, setSearchExpanded] = useState<Map<string, boolean>>(new Map());

  const handleSelect = (mentionedName: string, candidateName: string) => {
    const newMap = new Map(selections);
    // Toggle: if already selected, deselect; otherwise select
    newMap.set(mentionedName, newMap.get(mentionedName) === candidateName ? undefined : candidateName);
    setSelections(newMap);
  };

  const handleCreateNew = (mentionedName: string) => {
    const newMap = new Map(selections);
    // Toggle: if already "create new", deselect; otherwise set to null
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

  // Filter candidates based on search query for each mentioned name
  const getSearchResults = (mentionedName: string) => {
    const query = searchQueries.get(mentionedName) || "";
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return allPersons
      .filter((p) => {
        // Exclude already selected candidates for this mentioned name
        const currentSelection = selections.get(mentionedName);
        if (currentSelection === p.name) return false;
        // Search by name
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
    // Build resolved names map (only include confirmed matches, not denied ones)
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
        backgroundColor: "#fffbf0",
        border: "1px solid #f0d78c",
        borderRadius: "12px",
        padding: "20px 24px",
        marginTop: "16px",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 600, color: "#92400e", marginBottom: "12px" }}>
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
          <div key={mentionedName} style={{ marginBottom: "20px", borderBottom: "1px dashed #e5d9c3", paddingBottom: "16px" }}>
            {/* Header row */}
            <div style={{ fontSize: "14px", color: "#3a2a1a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 600, backgroundColor: "#fef3c7", padding: "2px 8px", borderRadius: "4px" }}>
                {mentionedName}
              </span>
              <span style={{ color: "#7a6a5a" }}>匹配到：</span>
            </div>

            {/* Candidates list with checkboxes */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
              {resolution.candidates.map((candidate) => {
                const isSelected = currentSelection === candidate.name;
                const matchBadge = candidate.matchType === "exact" ? (
                  <span style={{ fontSize: "11px", color: "#4caf50", fontWeight: 500 }}>姓名匹配</span>
                ) : (
                  <span style={{ fontSize: "11px", color: "#9a8a7a" }}>{(candidate.similarity * 100).toFixed(0)}% 相似</span>
                );

                return (
                  <label
                    key={candidate.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${isSelected ? "#c8a96e" : "#e5d9c3"}`,
                      backgroundColor: isSelected ? "#fef7ec" : "white",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "4px",
                        border: `2px solid ${isSelected ? "#c8a96e" : "#d1d5db"}`,
                        backgroundColor: isSelected ? "#c8a96e" : "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "2px",
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
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600, color: "#3a2a1a" }}>{candidate.name}</span>
                        {matchBadge}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
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

            {/* Search for other contacts */}
            <div style={{ marginBottom: "10px" }}>
              {!isSearchOpen ? (
                <button
                  onClick={() => toggleSearch(mentionedName)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    cursor: "pointer",
                    backgroundColor: "white",
                    border: "1px dashed #c8a96e",
                    color: "#92400e",
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
                      paddingLeft: "36px",
                      borderRadius: "6px",
                      border: "1px solid #c8a96e",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
                    <SearchIcon />
                  </div>
                  {searchResults.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        backgroundColor: "white",
                        border: "1px solid #e5d9c3",
                        borderRadius: "6px",
                        marginTop: "4px",
                        maxHeight: "200px",
                        overflowY: "auto",
                        zIndex: 10,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
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
                            gap: "8px",
                            borderBottom: "1px solid #f0ebe3",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef7ec")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <span style={{ fontWeight: 500 }}>{p.name}</span>
                          {p.careers && p.careers.length > 0 && (
                            <span style={{ fontSize: "12px", color: "#7a6a5a" }}>
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
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: "#9a8a7a",
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
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${isCreateNew ? "#e53935" : "#e5d9c3"}`,
                backgroundColor: isCreateNew ? "#ffebee" : "white",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "4px",
                  border: `2px solid ${isCreateNew ? "#e53935" : "#d1d5db"}`,
                  backgroundColor: isCreateNew ? "#e53935" : "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
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
              <span style={{ fontWeight: 500, color: isCreateNew ? "#e53935" : "#4b5563" }}>
                不是以上任何人，创建新条目「{mentionedName}」
              </span>
            </label>
          </div>
        );
      })}

      {/* Submit / Skip */}
      <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" }}>
        <button
          onClick={onSkip}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "13px",
            cursor: "pointer",
            backgroundColor: "white",
            border: "1px solid #d1d5db",
            color: "#4b5563",
          }}
        >
          跳过全部
        </button>
        <button
          onClick={handleSubmit}
          disabled={!allResolved}
          style={{
            padding: "8px 20px",
            borderRadius: "6px",
            fontSize: "13px",
            cursor: allResolved ? "pointer" : "not-allowed",
            backgroundColor: allResolved ? "#c8a96e" : "#f5f3ef",
            border: `1px solid ${allResolved ? "#c8a96e" : "#d1d5db"}`,
            color: allResolved ? "white" : "#9a8a7a",
          }}
        >
          继续分析
        </button>
      </div>
    </div>
  );
}
