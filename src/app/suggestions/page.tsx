"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { tokens as C } from "@/lib/design-tokens";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Tag } from "@/components/ui/Tag";
import { getJeffreyQuote } from "@/lib/jeffrey-quotes";

// ─── Icons (SVG, matching editorial style) ─────────────────
const Icons = {
  bell: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  clipboard: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  zap: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  arrow: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
};

// ─── Types ────────────────────────────────────────────────
type StaleContact = {
  id: string; name: string; lastContactDate: string;
  daysSinceContact: number; careers: string; relationshipScore: number; reason: string;
};
type PendingDebt = {
  id: string; personId: string; personName: string;
  description: string; interactionDate: string; daysSinceCreated: number;
};
type RemindersResponse = { staleContacts: StaleContact[]; pendingDebts: PendingDebt[] };
type IcebreakerResponse = {
  personName: string; openingLines: string[];
  suggestedTopics: string[]; recentContext: string; jeffreyComment: string;
};
type PersonOption = { id: string; name: string; relationshipScore: number };

// ─── Main Component ────────────────────────────────────────
export default function SuggestionsPage() {
  const [quote] = useState(getJeffreyQuote);
  const [staleContacts, setStaleContacts] = useState<StaleContact[]>([]);
  const [pendingDebts, setPendingDebts] = useState<PendingDebt[]>([]);
  const [allPersons, setAllPersons] = useState<PersonOption[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("日常");
  const [icebreaker, setIcebreaker] = useState<IcebreakerResponse | null>(null);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    fetch("/api/suggestions/reminders")
      .then(r => r.json())
      .then((d: RemindersResponse) => { setStaleContacts(d.staleContacts || []); setPendingDebts(d.pendingDebts || []); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/api/members/table")
      .then(r => r.json())
      .then(d => {
        const rows = d.rows || [];
        setAllPersons(rows
          .map((r: { id: string; name: string; relationshipScore: number }) => ({ id: r.id, name: r.name, relationshipScore: r.relationshipScore || 0 }))
          .sort((a: PersonOption, b: PersonOption) => b.relationshipScore - a.relationshipScore)
        );
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedPersonId) { setIcebreaker(null); return; }
    setIcebreakerLoading(true);
    setIcebreaker(null);
    fetch(`/api/suggestions/icebreaker?personId=${selectedPersonId}&style=${encodeURIComponent(selectedStyle)}`)
      .then(r => r.json())
      .then((d: IcebreakerResponse) => { setIcebreaker(d); setIcebreakerLoading(false); })
      .catch(() => setIcebreakerLoading(false));
  }, [selectedPersonId, selectedStyle]);

  const handleBatchGenerate = async () => {
    if (allPersons.length === 0) return;
    if (!window.confirm(`将为全部 ${allPersons.length} 位联系人生成破冰文案。\n\n可能消耗较多 token，但之后每次查询都会变快。\n\n确定要继续吗？`)) return;
    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: allPersons.length });
    let success = 0, fail = 0;
    for (let i = 0; i < allPersons.length; i++) {
      setBatchProgress({ current: i + 1, total: allPersons.length });
      try {
        const r = await fetch(`/api/persons/${allPersons[i].id}/icebreaker`, { method: "POST" });
        if (r.ok) success++; else fail++;
      } catch { fail++; }
      await new Promise(r => setTimeout(r, 500));
    }
    setBatchGenerating(false);
    alert(`完成！成功 ${success} 个，失败 ${fail} 个。`);
  };

  const styles = [
    { value: "日常", label: "日常" },
    { value: "正式", label: "正式" },
    { value: "务实", label: "务实" },
    { value: "问候", label: "问候" },
    { value: "老友", label: "老友" },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg }}>
      <Header />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>

        {/* Quote */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontStyle: "italic", color: C.textSecondary, margin: "0 0 6px", lineHeight: 1.7 }}>
            &ldquo;{quote.text}&rdquo;
          </p>
          <p style={{ fontSize: 12, color: C.textMuted }}>— {quote.author ?? "Jeffrey"}</p>
        </div>

        {/* Section 1: Stale Contacts */}
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.accent }}>{Icons.bell}</span>
              关系维护提醒 ({staleContacts.length})
            </span>
            {staleContacts.length > 3 && (
              <Link href="/members" style={{ fontSize: 12, color: C.accent, textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                查看全部 {Icons.arrow}
              </Link>
            )}
          </SectionLabel>

          {staleContacts.length === 0 ? (
            <p style={{ color: C.textMuted, fontSize: 13.5, textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>暂时没有需要维护的联系人，继续保持！</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {staleContacts.slice(0, 5).map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", backgroundColor: C.bgElevated, borderRadius: 9, border: `1px solid ${C.border}`, gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: C.text, marginBottom: 2 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{c.careers} · {c.lastContactDate} · 关系 {c.relationshipScore}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: c.daysSinceContact > 60 ? C.error : C.warning, fontWeight: 500 }}>
                      {c.daysSinceContact}天未联系
                    </span>
                    <Link href={`/input?personId=${c.id}`} style={{ padding: "5px 12px", backgroundColor: C.primary, color: C.textInverse, borderRadius: 7, fontSize: 12, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" }}>
                      戳他
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 2: Pending Debts */}
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.error }}>{Icons.clipboard}</span>
              待办承诺 ({pendingDebts.length})
            </span>
          </SectionLabel>

          {pendingDebts.length === 0 ? (
            <p style={{ color: C.textMuted, fontSize: 13.5, textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>暂时没有未兑现的承诺，先生。</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingDebts.slice(0, 5).map(d => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", backgroundColor: C.bgElevated, borderRadius: 8, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.error}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textInverse, backgroundColor: C.error, padding: "1px 7px", borderRadius: 10, flexShrink: 0 }}>我欠</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: C.text }}>{d.description}</span>
                  <span style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>{d.personName} · {d.daysSinceCreated}天</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 3: Icebreaker */}
        <Card>
          <SectionLabel>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.accent }}>{Icons.zap}</span>
              破冰助手
            </span>
          </SectionLabel>

          {/* Batch Pre-generate */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: C.accentLight, borderRadius: 9, border: `1px solid ${C.warning}`, marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: C.primary }}>
              <span style={{ fontWeight: 600 }}>预生成破冰文案</span>
              <span style={{ marginLeft: 8, color: C.textMuted, fontSize: 12 }}>开启后查询更快，但会消耗更多 token</span>
            </div>
            <button
              onClick={handleBatchGenerate}
              disabled={batchGenerating || allPersons.length === 0}
              style={{
                padding: "5px 14px",
                borderRadius: 7,
                border: `1.5px solid ${C.accent}`,
                backgroundColor: batchGenerating ? C.bgElevated : C.bg,
                color: batchGenerating ? C.textMuted : C.primary,
                fontSize: 13,
                fontWeight: 500,
                cursor: batchGenerating || allPersons.length === 0 ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {batchGenerating ? `生成中 ${batchProgress.current}/${batchProgress.total}...` : `一键生成 (${allPersons.length})`}
            </button>
          </div>

          {/* Person Selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, color: C.textSecondary, marginBottom: 6, fontWeight: 500 }}>选择联系人</label>
            <select
              value={selectedPersonId}
              onChange={e => setSelectedPersonId(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${C.borderStrong}`, borderRadius: 9, fontSize: 14, color: C.text, backgroundColor: C.bg, cursor: "pointer", outline: "none" }}
            >
              <option value="">搜索选择联系人...</option>
              {allPersons.map(p => <option key={p.id} value={p.id}>{p.name}（关系 {p.relationshipScore}）</option>)}
            </select>
          </div>

          {/* Style Selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, color: C.textSecondary, marginBottom: 6, fontWeight: 500 }}>选择风格</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {styles.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSelectedStyle(s.value)}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 8,
                    border: `1.5px solid ${selectedStyle === s.value ? C.accent : C.borderStrong}`,
                    backgroundColor: selectedStyle === s.value ? C.accentLight : C.bg,
                    color: selectedStyle === s.value ? C.primary : C.textSecondary,
                    fontSize: 13,
                    fontWeight: selectedStyle === s.value ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icebreaker Result */}
          {icebreakerLoading && (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.textMuted, fontSize: 14 }}>
              <div style={{ width: 28, height: 28, border: "2.5px solid #3d4660", borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 10px" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              Jeffrey 正在为您准备开场白...
            </div>
          )}

          {icebreaker && !icebreakerLoading && (
            <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.warning}`, borderRadius: 10, padding: 16 }}>
              {icebreaker.recentContext && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>记忆切入点</div>
                  <div style={{ fontSize: 13.5, color: C.text, padding: "8px 12px", backgroundColor: C.bg, borderRadius: 7, lineHeight: 1.6 }}>{icebreaker.recentContext}</div>
                </div>
              )}
              {icebreaker.openingLines?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>开场白建议</div>
                  {icebreaker.openingLines.map((line, i) => (
                    <div key={i} style={{ fontSize: 14, color: C.text, padding: "8px 12px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, marginBottom: 5, cursor: "default", lineHeight: 1.55 }}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
              {icebreaker.suggestedTopics?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>建议话题</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {icebreaker.suggestedTopics.map((t, i) => <Tag key={i} label={t} color="#16a34a" />)}
                  </div>
                </div>
              )}
              {icebreaker.jeffreyComment && (
                <div style={{ marginTop: 12, padding: "10px 14px", backgroundColor: C.accentLight, borderLeft: `3px solid ${C.accent}`, borderRadius: "0 7px 7px 0" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, marginBottom: 4 }}>Jeffrey 备注</div>
                  <p style={{ fontSize: 13.5, color: C.primary, fontStyle: "italic", margin: 0, lineHeight: 1.6 }}>&ldquo;{icebreaker.jeffreyComment}&rdquo;</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
