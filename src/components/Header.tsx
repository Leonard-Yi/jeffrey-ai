"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SearchResult = {
  id: string;
  name: string;
  careers: unknown[];
  interests: unknown[];
  vibeTags: string[];
  relationshipScore: number;
  similarity: number;
};

const NAV_ITEMS = [
  { href: "/input", label: "录入" },
  { href: "/graph", label: "图谱" },
  { href: "/suggestions", label: "建议" },
  { href: "/members", label: "人脉" },
];

export default function Header({ totalCount }: { totalCount?: number }) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: searchQuery, k: 5 }),
        });
        const data = await res.json();
        setSearchResults(data.results ?? []);
        setShowResults(true);
      } catch (err) {
        console.error("[Jeffrey.AI] Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const renderTags = (result: SearchResult) => {
    const careers = (result.careers as Array<{ name: string }>) ?? [];
    const interests = (result.interests as Array<{ name: string }>) ?? [];
    return [
      ...careers.slice(0, 2).map((c) => ({ label: c.name, type: "career" as const })),
      ...interests.slice(0, 1).map((i) => ({ label: i.name, type: "interest" as const })),
    ];
  };

  return (
    <header
      style={{
        backgroundColor: "white",
        borderBottom: "1px solid #e5e7eb",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937", fontFamily: "Georgia, serif" }}>
          Jeffrey.AI
        </h1>
        <nav style={{ display: "flex", gap: "8px" }}>
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                padding: "6px 20px",
                border: "1px solid",
                borderRadius: "8px",
                fontSize: "14px",
                textDecoration: "none",
                transition: "all 0.15s",
                ...(pathname === href
                  ? { backgroundColor: "#fffbeb", borderColor: "#d97706", color: "#b45309" }
                  : { borderColor: "#d1d5db", color: "#4b5563" }),
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Semantic Search Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div ref={searchRef} style={{ position: "relative" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim() && setShowResults(true)}
            placeholder="语义搜索：我认识哪些做投行的人..."
            style={{
              padding: "8px 14px",
              border: "1px solid #d4c9bb",
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: "white",
              outline: "none",
              width: "280px",
            }}
          />
          {isSearching && (
            <span style={{ position: "absolute", right: "10px", top: "8px", fontSize: "12px", color: "#9a8a7a" }}>
              搜索中...
            </span>
          )}

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                backgroundColor: "white",
                border: "1px solid #e0d9cf",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                width: "360px",
                maxHeight: "400px",
                overflowY: "auto",
                zIndex: 100,
              }}
            >
              <div style={{ padding: "8px 12px", fontSize: "12px", color: "#9a8a7a", borderBottom: "1px solid #f0ece4" }}>
                语义搜索结果
              </div>
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => {
                    setShowResults(false);
                    setSearchQuery("");
                    window.location.href = `/members?id=${result.id}`;
                  }}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f0ece4",
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#faf8f4")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600, color: "#3a2a1a" }}>{result.name}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {renderTags(result).map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "11px",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          backgroundColor: tag.type === "career" ? "#dbeafe" : "#fef3c7",
                          color: tag.type === "career" ? "#1e40af" : "#92400e",
                        }}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showResults && searchQuery.trim() && searchResults.length === 0 && !isSearching && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                backgroundColor: "white",
                border: "1px solid #e0d9cf",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                width: "280px",
                padding: "16px",
                textAlign: "center",
                color: "#9a8a7a",
                fontSize: "14px",
                zIndex: 100,
              }}
            >
              未找到匹配的人脉
            </div>
          )}
        </div>

        {totalCount !== undefined && (
          <span style={{ fontSize: "14px", color: "#6b7280" }}>
            {totalCount} 位联系人
          </span>
        )}
      </div>
    </header>
  );
}
