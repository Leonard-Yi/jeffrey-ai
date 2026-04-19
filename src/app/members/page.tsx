"use client";

import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import PersonModal from "@/components/PersonModal";
import MergeConfirmDialog from "@/components/MergeConfirmDialog";
import type { WeightedTag } from "@/lib/embedding";
import { tokens as C } from "@/lib/design-tokens";
import { Card } from "@/components/ui/Card";

type ColumnDef = {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "array" | "string[]" | "relation" | "actionItems";
  editable: boolean;
  validation?: { min?: number; max?: number };
};

type TableRow = {
  id: string;
  name: string;
  careers: string;
  interests: string;
  vibeTags: string;
  baseCities: string;
  favoritePlaces: string;
  relationshipScore: number;
  lastContactDate: string;
  introducedBy: string;
  actionItems: number;
  coreMemories: string;
};

const SORTABLE_TYPES = new Set(["string", "number", "date"]);

function Input({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        padding: "8px 12px",
        border: `1.5px solid ${C.borderStrong}`,
        borderRadius: 9,
        fontSize: 14,
        color: C.text,
        backgroundColor: "#fff",
        outline: "none",
        transition: "border-color 0.12s",
        ...style,
      }}
    />
  );
}

export default function MembersPage() {
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("lastContactDate");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [filterCareer, setFilterCareer] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergePersons, setMergePersons] = useState<Array<{
    id: string; name: string;
    careers: WeightedTag[]; interests: WeightedTag[]; vibeTags: string[];
    relationshipScore: number; lastContactDate: string;
    interactionCount: number;
  }>>([]);
  const [survivorIdForMerge, setSurvivorIdForMerge] = useState<string>("");
  const [merging, setMerging] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);

  const fetchTable = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort, order });
    if (filterCareer) params.set("filterCareer", filterCareer);
    if (filterCity) params.set("filterCity", filterCity);
    const res = await fetch(`/api/members/table?${params}`);
    const data = await res.json();
    setColumns(data.columns ?? []);
    setRows(data.rows ?? []);
    setLoading(false);
  }, [sort, order, filterCareer, filterCity]);

  useEffect(() => { fetchTable(); }, [fetchTable]);

  const handleSort = (key: string, type: string) => {
    if (!SORTABLE_TYPES.has(type)) return;
    if (sort === key) { setOrder(o => o === "asc" ? "desc" : "asc"); }
    else { setSort(key); setOrder("desc"); }
  };

  const handleSaved = () => { fetchTable(); };

  const handleMergeClick = async () => {
    if (selectedIds.length < 2) return;
    setMergeLoading(true);
    // Fetch full details for selected persons
    const persons = await Promise.all(
      selectedIds.map(async (id) => {
        const res = await fetch(`/api/members/${id}`);
        const data = await res.json();
        return {
          id: data.id,
          name: data.name,
          careers: data.careers as WeightedTag[],
          interests: data.interests as WeightedTag[],
          vibeTags: data.vibeTags as string[],
          relationshipScore: data.relationshipScore,
          lastContactDate: data.lastContactDate,
          interactionCount: (data.interactions?.length ?? 0) as number,
        };
      })
    );
    // Sort to find default survivor (highest relationshipScore)
    const sorted = [...persons].sort((a, b) => b.relationshipScore - a.relationshipScore);
    setMergePersons(persons);
    setSurvivorIdForMerge(sorted[0]?.id || persons[0]?.id || "");
    setMergeLoading(false);
    setMergeDialogOpen(true);
  };

  const handleSurvivorChange = (id: string) => setSurvivorIdForMerge(id);

  const handleMergeConfirm = async (survivorId: string, victimIds: string[]) => {
    setMerging(true);
    const res = await fetch("/api/persons/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survivorId, victimIds }),
    });
    if (!res.ok) throw new Error("Merge failed");
    const victimSet = new Set(victimIds);
    setRows(prev => prev.filter(r => !victimSet.has(r.id)));
    setMerging(false);
    setMergeDialogOpen(false);
    setSelectedIds([]);
  };

  const getScoreColor = (score: number) => {
    if (score > 60) return C.success;
    if (score >= 30) return "#d97706";
    return C.error;
  };

  const renderCell = (row: TableRow, col: ColumnDef) => {
    const value = (row as Record<string, unknown>)[col.key];

    if (col.key === "relationshipScore") {
      const score = Number(value);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
          <div style={{ width: 56, height: 5, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${score}%`, height: "100%", backgroundColor: getScoreColor(score), borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 13, color: C.textSecondary }}>{score}</span>
        </div>
      );
    }

    if (col.key === "actionItems") {
      const count = Number(value);
      return (
        <span style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 500,
          backgroundColor: count > 0 ? "#fef2f2" : C.surfaceAlt,
          color: count > 0 ? C.error : C.textMuted,
          border: `1px solid ${count > 0 ? "#fecaca" : C.border}`,
        }}>
          {count > 0 ? `${count}项待办` : "无待办"}
        </span>
      );
    }

    return (
      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={String(value)}>
        {String(value)}
      </span>
    );
  };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }}>
      <Header />

      <div style={{ padding: "24px 28px", maxWidth: 1400 }}>
        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: C.text, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            人脉总览
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>{rows.length} 位联系人</p>
        </div>

        {/* Filter Bar */}
        <Card style={{ padding: "16px 20px", marginBottom: 16 }}>
          <form onSubmit={e => { e.preventDefault(); fetchTable(); }} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              placeholder="按职业筛选..."
              value={filterCareer}
              onChange={e => setFilterCareer(e.target.value)}
              style={{ width: 170 }}
            />
            <Input
              placeholder="按城市筛选..."
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              style={{ width: 170 }}
            />
            <button
              type="submit"
              style={{
                padding: "8px 18px",
                backgroundColor: C.primary,
                color: "#fff",
                border: "none",
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              搜索
            </button>

            <div style={{ flex: 1 }} />

            {selectedIds.length >= 2 && (
              <button
                onClick={handleMergeClick}
                disabled={mergeLoading}
                style={{
                  padding: "8px 18px",
                  backgroundColor: mergeLoading ? C.surfaceAlt : C.error,
                  color: mergeLoading ? C.textMuted : "#fff",
                  border: "none",
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: mergeLoading ? "not-allowed" : "pointer",
                }}
              >
                {mergeLoading ? "加载中..." : `合并 ${selectedIds.length} 条`}
              </button>
            )}
            {selectedIds.length > 0 && selectedIds.length < 2 && (
              <span style={{ fontSize: 13, color: C.textMuted }}>再选一条才能合并</span>
            )}
          </form>
        </Card>

        {/* Table */}
        {loading ? (
          <Card style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ color: C.textMuted, fontSize: 14 }}>加载中...</div>
          </Card>
        ) : rows.length === 0 ? (
          <Card style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ color: C.textMuted, fontSize: 14 }}>暂无联系人</div>
          </Card>
        ) : (
          <Card>
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 900, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px 14px", backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, width: 42, textAlign: "left" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length === rows.length && rows.length > 0}
                        onChange={e => setSelectedIds(e.target.checked ? rows.map(r => r.id) : [])}
                        style={{ cursor: "pointer", accentColor: C.accent }}
                      />
                    </th>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key, col.type)}
                        style={{
                          padding: "10px 14px",
                          textAlign: "left",
                          backgroundColor: C.surfaceAlt,
                          borderBottom: `1px solid ${C.border}`,
                          fontWeight: 600,
                          color: C.textSecondary,
                          fontSize: 13,
                          cursor: SORTABLE_TYPES.has(col.type) ? "pointer" : "default",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {col.label}
                          {sort === col.key && SORTABLE_TYPES.has(col.type) && (
                            <span style={{ color: C.accent, fontSize: 12 }}>{order === "asc" ? "↑" : "↓"}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      style={{
                        cursor: "pointer",
                        backgroundColor: selectedIds.includes(row.id) ? "#fffbf0" : ri % 2 === 0 ? "transparent" : C.surfaceAlt,
                        transition: "background-color 0.1s",
                      }}
                      onMouseEnter={e => { if (!selectedIds.includes(row.id)) e.currentTarget.style.backgroundColor = "#faf8f4"; }}
                      onMouseLeave={e => { if (!selectedIds.includes(row.id)) e.currentTarget.style.backgroundColor = selectedIds.includes(row.id) ? "#fffbf0" : ri % 2 === 0 ? "transparent" : C.surfaceAlt; }}
                    >
                      <td
                        style={{ padding: "9px 12px", borderBottom: `1px solid ${C.border}`, backgroundColor: "inherit" }}
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={e => setSelectedIds(e.target.checked ? [...selectedIds, row.id] : selectedIds.filter(id => id !== row.id))}
                          style={{ cursor: "pointer", accentColor: C.accent }}
                        />
                      </td>
                      {columns.map(col => (
                        <td
                          key={col.key}
                          style={{
                            padding: "9px 14px",
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13.5,
                            color: C.text,
                            backgroundColor: "inherit",
                            maxWidth: 200,
                          }}
                        >
                          {renderCell(row, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* PersonModal */}
      {selectedId && (
        <PersonModal personId={selectedId} onClose={() => setSelectedId(null)} onSaved={handleSaved} />
      )}

      {/* Merge Confirm Dialog */}
      {mergeDialogOpen && mergePersons.length >= 2 && (
        <MergeConfirmDialog
          allPersons={mergePersons}
          survivorId={survivorIdForMerge}
          onSurvivorChange={handleSurvivorChange}
          onConfirm={handleMergeConfirm}
          onCancel={() => { setMergeDialogOpen(false); setSelectedIds([]); }}
        />
      )}
    </div>
  );
}
