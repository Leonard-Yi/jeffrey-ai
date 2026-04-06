"use client";

import { useState, useCallback, useEffect } from "react";
import PersonModal from "@/components/PersonModal";
import Header from "@/components/Header";

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

export default function MembersPage() {
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("lastContactDate");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [filterCareer, setFilterCareer] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchTable();
  }, [fetchTable]);

  const handleSort = (key: string, type: string) => {
    if (!SORTABLE_TYPES.has(type)) return;
    if (sort === key) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setOrder("desc");
    }
  };

  const handleSaved = () => {
    fetchTable();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTable();
  };

  const getScoreColor = (score: number) => {
    if (score > 60) return "#4caf50";
    if (score >= 30) return "#d4a017";
    return "#e53935";
  };

  const renderCell = (row: TableRow, col: ColumnDef) => {
    const value = (row as Record<string, unknown>)[col.key];

    if (col.key === "relationshipScore") {
      const score = Number(value);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "100px" }}>
          <div
            style={{
              width: "60px",
              height: "6px",
              backgroundColor: "#e0d9cf",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${score}%`,
                height: "100%",
                backgroundColor: getScoreColor(score),
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span style={{ fontSize: "13px", color: "#7a6a5a" }}>{score}/100</span>
        </div>
      );
    }

    if (col.key === "actionItems") {
      const count = Number(value);
      if (count > 0) {
        return (
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              backgroundColor: "#fef3e0",
              color: "#c44",
            }}
          >
            {count}项待办
          </span>
        );
      }
      return (
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            backgroundColor: "#f0f0f0",
            color: "#9a8a7a",
          }}
        >
          无待办
        </span>
      );
    }

    return (
      <span
        style={{
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={String(value)}
      >
        {String(value)}
      </span>
    );
  };

  return (
    <div style={{ backgroundColor: "#f5f3ef", minHeight: "100vh" }}>
      <Header totalCount={rows.length} />

      {/* Page Content */}
      <div style={{ padding: "24px 32px" }}>
        {/* Page Title */}
        <h2
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "22px",
            fontWeight: 700,
            color: "#3a2a1a",
            marginBottom: "24px",
          }}
        >
          人脉总览
        </h2>

        {/* Filter bar */}
      <form
        onSubmit={handleSearch}
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="按职业筛选..."
          value={filterCareer}
          onChange={(e) => setFilterCareer(e.target.value)}
          style={{
            padding: "8px 14px",
            border: "1px solid #d4c9bb",
            borderRadius: "8px",
            fontSize: "14px",
            backgroundColor: "white",
            outline: "none",
            width: "180px",
          }}
        />
        <input
          type="text"
          placeholder="按城市筛选..."
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          style={{
            padding: "8px 14px",
            border: "1px solid #d4c9bb",
            borderRadius: "8px",
            fontSize: "14px",
            backgroundColor: "white",
            outline: "none",
            width: "180px",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "8px 20px",
            backgroundColor: "#c8a96e",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          搜索
        </button>
      </form>

      {/* Table */}
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "60px",
            color: "#7a6a5a",
            fontSize: "16px",
          }}
        >
          加载中...
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "60px",
            color: "#9a8a7a",
            fontSize: "16px",
          }}
        >
          暂无联系人
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e0d9cf",
            overflowX: "auto",
          }}
        >
          <table style={{ minWidth: "900px", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key, col.type)}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      backgroundColor: "#f9f7f3",
                      borderBottom: "1px solid #e0d9cf",
                      fontWeight: 600,
                      color: "#5a4a3a",
                      fontSize: "14px",
                      cursor: SORTABLE_TYPES.has(col.type) ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {col.label}
                      {sort === col.key && SORTABLE_TYPES.has(col.type) && (
                        <span style={{ fontSize: "12px", color: "#c8a96e" }}>
                          {order === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  style={{
                    padding: "10px 16px",
                    borderBottom: rowIdx < rows.length - 1 ? "1px solid #f0ece4" : "none",
                    cursor: "pointer",
                    backgroundColor: "transparent",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedId !== row.id) {
                      e.currentTarget.style.backgroundColor = "#faf8f4";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== row.id) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: "10px 16px",
                        borderBottom:
                          rowIdx < rows.length - 1 ? "1px solid #f0ece4" : "none",
                        fontSize: "14px",
                        color: "#3a2a1a",
                        backgroundColor:
                          selectedId === row.id ? "#fef7ec" : "transparent",
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
      )}

      {/* PersonModal */}
      <PersonModal
        personId={selectedId}
        onClose={() => setSelectedId(null)}
        onSaved={handleSaved}
      />
      </div>
    </div>
  );
}
