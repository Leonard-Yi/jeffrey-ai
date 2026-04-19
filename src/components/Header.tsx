"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useMemberCount } from "./MemberCountContext";
import { tokens as C } from "@/lib/design-tokens";

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

// ─── Jeffrey Logo / Chin Mascot ──────────────────────────────────────
function JeffreyLogo({ size = 40 }: { size?: number }) {
  const scale = size / 40;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {/* Chin silhouette - Vault-style antique bronze */}
      <circle cx="20" cy="20" r="19" fill={C.bgCard} stroke={C.borderStrong} strokeWidth="1" />
      {/* Inner bronze ring */}
      <circle cx="20" cy="20" r="16" fill="none" stroke={C.borderAccent} strokeWidth="0.5" />
      {/* Stylized chin/face shape */}
      <path
        d="M12 18 C12 14 15 11 20 11 C25 11 28 14 28 18 C28 22 26 24 24 26 L24 30 C24 31 23 32 22 32 L18 32 C17 32 16 31 16 30 L16 26 C14 24 12 22 12 18 Z"
        fill={C.primary}
        opacity="0.9"
      />
      {/* Subtle highlight */}
      <ellipse cx="17" cy="16" rx="2" ry="1.5" fill={C.primaryHover} opacity="0.4" />
    </svg>
  );
}

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
        backgroundColor: C.bgCard,
        borderBottom: `1px solid ${C.border}`,
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: C.headerHeight,
        boxShadow: C.shadowSm,
      }}
    >
      {/* Left: Brand + Nav */}
      <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
        <Link
          href="/input"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
          }}
        >
          <JeffreyLogo size={36} />
          <span
            style={{
              fontFamily: C.fontDisplay,
              fontSize: "20px",
              fontWeight: 400,
              color: C.text,
              letterSpacing: "-0.02em",
            }}
          >
            Jeffrey.AI
          </span>
        </Link>
        <nav style={{ display: "flex", gap: "4px" }}>
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: "6px 14px",
                  borderRadius: C.radiusMd,
                  fontSize: "14px",
                  fontWeight: isActive ? 500 : 400,
                  textDecoration: "none",
                  transition: `all ${C.transitionBase}`,
                  ...(isActive
                    ? {
                        backgroundColor: C.bgActive,
                        color: C.primary,
                        border: `1px solid ${C.borderAccent}`,
                      }
                    : {
                        backgroundColor: "transparent",
                        color: C.textSecondary,
                        border: `1px solid transparent`,
                      }),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = C.bgHover;
                    e.currentTarget.style.color = C.text;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = C.textSecondary;
                  }
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
                border: `1px solid ${C.borderStrong}`,
                borderRadius: C.radiusMd,
                fontSize: "13.5px",
                backgroundColor: C.bgElevated,
                outline: "none",
                width: "240px",
                color: C.text,
                transition: `border-color ${C.transitionBase}, box-shadow ${C.transitionBase}`,
              }}
              onFocusCapture={(e) => {
                e.currentTarget.style.borderColor = C.primary;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accentLight}`;
                e.currentTarget.style.backgroundColor = C.bgCard;
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.borderColor = C.borderStrong;
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.backgroundColor = C.bgElevated;
              }}
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.textMuted}
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
                  color: C.textMuted,
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
                backgroundColor: C.bgCard,
                border: `1px solid ${C.borderStrong}`,
                borderRadius: C.radiusLg,
                boxShadow: C.shadowMd,
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
                  color: C.textMuted,
                  borderBottom: `1px solid ${C.border}`,
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
                    borderBottom: `1px solid ${C.border}`,
                    transition: `background-color ${C.transitionFast}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.bgHover)}
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
                    <span style={{ fontWeight: 600, color: C.text, fontSize: "14px" }}>
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
                          borderRadius: C.radiusSm,
                          backgroundColor: tag.type === "career" ? C.infoBg : C.warningBg,
                          color: tag.type === "career" ? C.info : C.primary,
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
                backgroundColor: C.bgCard,
                border: `1px solid ${C.borderStrong}`,
                borderRadius: C.radiusLg,
                boxShadow: C.shadowMd,
                width: "240px",
                padding: "20px",
                textAlign: "center",
                color: C.textMuted,
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
            color: C.textSecondary,
            padding: "3px 10px",
            backgroundColor: C.bgElevated,
            borderRadius: C.radiusFull,
            border: `1px solid ${C.border}`,
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
                color: C.textSecondary,
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
                border: `1px solid ${C.borderStrong}`,
                borderRadius: C.radiusMd,
                backgroundColor: "transparent",
                color: C.textSecondary,
                cursor: "pointer",
                transition: `all ${C.transitionBase}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.primary;
                e.currentTarget.style.color = C.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.borderStrong;
                e.currentTarget.style.color = C.textSecondary;
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
