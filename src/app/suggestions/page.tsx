"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SuggestionCard from "../../components/SuggestionCard";
import Header from "@/components/Header";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StaleContact = {
  id: string;
  name: string;
  lastContactDate: string;
  daysSinceContact: number;
  careers: string;
  relationshipScore: number;
  reason: string;
};

type PendingDebt = {
  id: string;
  personId: string;
  personName: string;
  description: string;
  interactionDate: string;
  daysSinceCreated: number;
};

type RemindersResponse = {
  staleContacts: StaleContact[];
  pendingDebts: PendingDebt[];
};

type IcebreakerResponse = {
  personName: string;
  openingLines: string[];
  suggestedTopics: string[];
  recentContext: string;
  jeffreyComment: string;
};

type PersonOption = { id: string; name: string; relationshipScore: number };

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const COLORS = {
  bg: "#f5f3ef",
  cardBg: "white",
  border: "#e0d9cf",
  accent: "#c8a96e",
  textDark: "#3a2a1a",
  textMedium: "#7a6a5a",
  textLight: "#9a8a7a",
  red: "#c44",
  blue: "#1e88e5",
  orange: "#f57c00",
};

const STYLES = {
  header: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: "12px 24px",
    backgroundColor: "white",
    borderBottom: `1px solid ${COLORS.border}`,
    position: "sticky" as const,
    top: 0,
    zIndex: 50,
  },
  navLink: (active: boolean) => ({
    padding: "6px 16px",
    borderRadius: 8,
    border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
    backgroundColor: active ? "#fff8f0" : "transparent",
    color: active ? "#b8860b" : COLORS.textMedium,
    fontSize: 14,
    cursor: "pointer" as const,
    textDecoration: "none",
    transition: "all 0.2s",
  }),
  main: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "32px 16px",
  },
  quote: {
    textAlign: "center" as const,
    marginBottom: 32,
    color: COLORS.textMedium,
    fontSize: 16,
    fontStyle: "italic" as const,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: COLORS.textDark,
    marginBottom: 16,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  contactItem: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: "12px 16px",
    backgroundColor: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    marginBottom: 8,
  },
  debtItem: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 12,
    padding: "10px 14px",
    backgroundColor: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderLeft: `3px solid ${COLORS.red}`,
    borderRadius: 8,
    marginBottom: 8,
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "24px 16px",
    color: COLORS.textLight,
    fontSize: 14,
  },
  button: {
    padding: "8px 16px",
    borderRadius: 8,
    border: `1px solid ${COLORS.accent}`,
    backgroundColor: "white",
    color: COLORS.accent,
    fontSize: 13,
    cursor: "pointer" as const,
  },
  personSelect: {
    width: "100%",
    padding: "10px 14px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    fontSize: 14,
    color: COLORS.textDark,
    backgroundColor: "white",
    cursor: "pointer" as const,
  },
  icebreakerResult: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#fffcf8",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
  },
  icebreakerSection: {
    marginBottom: 16,
  },
  icebreakerLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.textLight,
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  openingLine: {
    display: "block" as const,
    padding: "8px 12px",
    marginBottom: 6,
    backgroundColor: "white",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    fontSize: 14,
    color: COLORS.textDark,
    cursor: "pointer" as const,
  },
  topicTag: {
    display: "inline-block" as const,
    padding: "4px 10px",
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: "#e8f4e8",
    borderRadius: 12,
    fontSize: 13,
    color: "#2e7d32",
  },
  jeffreyComment: {
    fontStyle: "italic" as const,
    color: COLORS.textMedium,
    fontSize: 14,
    padding: "10px 14px",
    backgroundColor: "#fff8f0",
    borderRadius: 6,
    borderLeft: `3px solid ${COLORS.accent}`,
  },
};

// ─────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────

function getJefferyQuote(): { text: string; author: string } {
  const quotes = [
    { text: "您的社交生活需要一点推动，先生。", author: "Jeffrey" },
    { text: "人脉不维护，就会贬值。", author: "Jeffrey" },
    { text: "承诺不兑现，信任就会透支。", author: "Jeffrey" },
    { text: "了解，先生。", author: "Jeffrey" },
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function SuggestionsPage() {
  const [quote] = useState(getJefferyQuote);

  // Data state
  const [staleContacts, setStaleContacts] = useState<StaleContact[]>([]);
  const [pendingDebts, setPendingDebts] = useState<PendingDebt[]>([]);
  const [allPersons, setAllPersons] = useState<PersonOption[]>([]);

  // Icebreaker state
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [icebreaker, setIcebreaker] = useState<IcebreakerResponse | null>(null);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);

  // Load reminders data
  useEffect(() => {
    fetch("/api/suggestions/reminders")
      .then((r) => r.json())
      .then((data: RemindersResponse) => {
        setStaleContacts(data.staleContacts || []);
        setPendingDebts(data.pendingDebts || []);
      })
      .catch(console.error);
  }, []);

  // Load all persons for icebreaker selector
  useEffect(() => {
    fetch("/api/members/table")
      .then((r) => r.json())
      .then((data) => {
        const rows = data.rows || [];
        setAllPersons(
          rows
            .map((r: { id: string; name: string; relationshipScore: number }) => ({
              id: r.id,
              name: r.name,
              relationshipScore: r.relationshipScore || 0,
            }))
            .sort((a: PersonOption, b: PersonOption) => b.relationshipScore - a.relationshipScore)
        );
      })
      .catch(console.error);
  }, []);

  // Generate icebreaker when person is selected
  useEffect(() => {
    if (!selectedPersonId) {
      setIcebreaker(null);
      return;
    }

    setIcebreakerLoading(true);
    setIcebreaker(null);

    fetch(`/api/suggestions/icebreaker?personId=${selectedPersonId}`)
      .then((r) => r.json())
      .then((data: IcebreakerResponse) => {
        setIcebreaker(data);
        setIcebreakerLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIcebreakerLoading(false);
      });
  }, [selectedPersonId]);

  const totalSuggestions = staleContacts.length + pendingDebts.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
      <Header />

      {/* Main Content */}
      <main style={STYLES.main}>
        {/* Quote */}
        <div style={STYLES.quote}>
          <p>"{quote.text}"</p>
          <p style={{ marginTop: 4, fontSize: 13 }}>— {quote.author}</p>
        </div>

        {/* Section 1: Relationship Maintenance Reminders */}
        <section style={{ marginBottom: 32 }}>
          <div style={STYLES.sectionTitle}>
            <span>🔔 关系维护提醒 ({staleContacts.length})</span>
            {staleContacts.length > 3 && (
              <Link href="/members" style={{ fontSize: 13, color: COLORS.accent }}>
                查看全部 →
              </Link>
            )}
          </div>

          {staleContacts.length === 0 ? (
            <div style={STYLES.emptyState}>
              暂时没有需要维护的联系人，继续保持！
            </div>
          ) : (
            staleContacts.slice(0, 5).map((contact) => (
              <div key={contact.id} style={STYLES.contactItem}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: COLORS.textDark }}>
                    👤 {contact.name}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>
                    {contact.careers} · {contact.lastContactDate} · 关系评分 {contact.relationshipScore}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: contact.daysSinceContact > 60 ? COLORS.red : COLORS.orange,
                    }}
                  >
                    {contact.daysSinceContact}天未联系
                  </span>
                  <Link
                    href={`/input?personId=${contact.id}`}
                    style={{
                      ...STYLES.button,
                      fontSize: 12,
                      padding: "6px 12px",
                    }}
                  >
                    💬 戳他
                  </Link>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Section 2: Pending Debts */}
        <section style={{ marginBottom: 32 }}>
          <div style={STYLES.sectionTitle}>
            <span>📋 待办承诺 ({pendingDebts.length})</span>
          </div>

          {pendingDebts.length === 0 ? (
            <div style={STYLES.emptyState}>
              暂时没有未兑现的承诺，先生。
            </div>
          ) : (
            pendingDebts.slice(0, 5).map((debt) => (
              <div key={debt.id} style={STYLES.debtItem}>
                <span
                  style={{
                    fontSize: 11,
                    color: "white",
                    backgroundColor: COLORS.red,
                    padding: "2px 8px",
                    borderRadius: 10,
                  }}
                >
                  我欠
                </span>
                <span style={{ flex: 1, fontSize: 14, color: COLORS.textDark }}>
                  {debt.description}
                </span>
                <span style={{ fontSize: 12, color: COLORS.textLight }}>
                  {debt.personName} · {debt.daysSinceCreated}天
                </span>
              </div>
            ))
          )}
        </section>

        {/* Section 3: Icebreaker Helper */}
        <section>
          <SuggestionCard type="icebreaker">
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  color: COLORS.textMedium,
                  marginBottom: 6,
                }}
              >
                选择联系人：
              </label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                style={STYLES.personSelect}
              >
                <option value="">🔍 搜索选择联系人...</option>
                {allPersons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}（关系评分 {person.relationshipScore}）
                  </option>
                ))}
              </select>
            </div>

            {/* Icebreaker Results */}
            {icebreakerLoading && (
              <div style={{ ...STYLES.emptyState, padding: "16px" }}>
                Jeffrey 正在为您准备开场白...
              </div>
            )}

            {icebreaker && !icebreakerLoading && (
              <div style={STYLES.icebreakerResult}>
                {/* Recent Context */}
                {icebreaker.recentContext && (
                  <div style={STYLES.icebreakerSection}>
                    <div style={STYLES.icebreakerLabel}>💭 记忆切入点</div>
                    <div
                      style={{
                        fontSize: 14,
                        color: COLORS.textDark,
                        padding: "8px 12px",
                        backgroundColor: "white",
                        borderRadius: 6,
                      }}
                    >
                      {icebreaker.recentContext}
                    </div>
                  </div>
                )}

                {/* Opening Lines */}
                <div style={STYLES.icebreakerSection}>
                  <div style={STYLES.icebreakerLabel}>💬 开场白建议</div>
                  {icebreaker.openingLines.map((line, i) => (
                    <span key={i} style={STYLES.openingLine}>
                      {line}
                    </span>
                  ))}
                </div>

                {/* Suggested Topics */}
                <div style={STYLES.icebreakerSection}>
                  <div style={STYLES.icebreakerLabel}>🗣️ 建议话题</div>
                  {icebreaker.suggestedTopics.map((topic, i) => (
                    <span key={i} style={STYLES.topicTag}>
                      {topic}
                    </span>
                  ))}
                </div>

                {/* Jeffrey's Comment */}
                {icebreaker.jeffreyComment && (
                  <div style={STYLES.icebreakerSection}>
                    <div style={STYLES.icebreakerLabel}>📝 Jeffrey 备注</div>
                    <div style={STYLES.jeffreyComment}>
                      "{icebreaker.jeffreyComment}"
                    </div>
                  </div>
                )}
              </div>
            )}
          </SuggestionCard>
        </section>
      </main>
    </div>
  );
}
