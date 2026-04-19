"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useMemberCount } from "./MemberCountContext";

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

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { count } = useMemberCount();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        backgroundColor: "#fff",
        borderBottom: "1px solid #e7e5e4",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: "60px",
        boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
      }}
    >
      {/* Left: Brand + Nav */}
      <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
        <Link
          href="/input"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            fontWeight: 400,
            color: "#1c1917",
            letterSpacing: "-0.02em",
            textDecoration: "none",
          }}
        >
          Jeffrey.AI
        </Link>
        <nav style={{ display: "flex", gap: "4px" }}>
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: "5px 14px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: isActive ? 500 : 400,
                  textDecoration: "none",
                  transition: "all 0.12s",
                  ...(isActive
                    ? {
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        border: "1px solid #fde68a",
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "#78716c",
                        border: "1px solid transparent",
                      }),
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: Search + User */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Search */}
        <div ref={searchRef} style={{ position: "relative" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setShowResults(true)}
              placeholder="语义搜索人脉..."
              style={{
                padding: "7px 12px 7px 34px",
                border: "1px solid #d6d3d1",
                borderRadius: "8px",
                fontSize: "13.5px",
                backgroundColor: "#fafaf9",
                outline: "none",
                width: "240px",
                color: "#1c1917",
                transition: "border-color 0.12s, box-shadow 0.12s",
              }}
              onFocusCapture={(e) => {
                e.currentTarget.style.borderColor = "#d97706";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(217,119,6,0.1)";
                e.currentTarget.style.backgroundColor = "#fff";
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.borderColor = "#d6d3d1";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.backgroundColor = "#fafaf9";
              }}
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a8a29e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: "10px", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {isSearching && (
              <span
                style={{
                  position: "absolute",
                  right: "10px",
                  fontSize: "12px",
                  color: "#a8a29e",
                }}
              >
                ...
              </span>
            )}
          </div>

          {/* Search Results */}
          {showResults && searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                backgroundColor: "#fff",
                border: "1px solid #e7e5e4",
                borderRadius: "12px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                width: "340px",
                maxHeight: "380px",
                overflowY: "auto",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: "8px 14px",
                  fontSize: "11px",
                  color: "#a8a29e",
                  borderBottom: "1px solid #f0ece4",
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                搜索结果
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
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f5f3ef",
                    transition: "background-color 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#faf8f4")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#1c1917", fontSize: "14px" }}>
                      {result.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {renderTags(result).map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "11px",
                          padding: "1px 7px",
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
                top: "calc(100% + 6px)",
                right: 0,
                backgroundColor: "#fff",
                border: "1px solid #e7e5e4",
                borderRadius: "12px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                width: "240px",
                padding: "20px",
                textAlign: "center",
                color: "#a8a29e",
                fontSize: "13.5px",
                zIndex: 100,
              }}
            >
              未找到匹配的人脉
            </div>
          )}
        </div>

        {/* Contact count badge */}
        <div
          style={{
            fontSize: "12px",
            color: "#78716c",
            padding: "3px 10px",
            backgroundColor: "#f5f3ef",
            borderRadius: "100px",
            border: "1px solid #e7e5e4",
          }}
        >
          {count} 位联系人
        </div>

        {/* User section */}
        {session?.user && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "13px",
                color: "#78716c",
                maxWidth: "140px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session.user.email || session.user.name || "用户"}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              style={{
                padding: "5px 12px",
                fontSize: "13px",
                border: "1px solid #e7e5e4",
                borderRadius: "7px",
                backgroundColor: "#fff",
                color: "#78716c",
                cursor: "pointer",
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#d6d3d1";
                e.currentTarget.style.color = "#1c1917";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e7e5e4";
                e.currentTarget.style.color = "#78716c";
              }}
            >
              退出
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
