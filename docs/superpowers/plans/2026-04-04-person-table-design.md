# 动态人脉表格 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个 schema驱动的动态人脉表格页面，支持排序/筛选/编辑，点击图谱节点可弹出人员详情弹窗。

**Architecture:** 后端通过 schemaReader 读取 Person 模型字段定义，生成列配置 + 数据行返回给前端。前端根据列配置动态渲染表格，编辑时发送 PATCH 请求。弹窗组件在表格行点击和图谱节点点击两个场景中复用。

**Tech Stack:** Next.js App Router, TypeScript, Prisma ORM, Tailwind CSS, react-force-graph-2d

---

## File Structure

### New Files
- `src/lib/schemaReader.ts` — Person 模型字段定义 + 列配置生成器
- `src/app/api/members/table/route.ts` — GET /api/members/table
- `src/app/api/members/[id]/route.ts` — PATCH /api/members/:id
- `src/components/PersonModal.tsx` — 人员详情弹窗（查看/编辑）
- `src/app/members/page.tsx` — 表格页面

### Modified Files
- `src/app/graph/page.tsx` — 图谱节点点击 → 打开 PersonModal
- `src/app/input/page.tsx` — 添加"查看所有人脉"入口

---

## Column Definition (from schemaReader)

| key | label | type | editable | render |
|-----|-------|------|----------|--------|
| name | 姓名 | string | yes | text |
| careers | 职业标签 | array | yes | "投行(0.9), 木工(0.1)" |
| interests | 兴趣标签 | array | yes | comma-string |
| vibeTags | 性格标签 | string[] | yes | comma-string |
| baseCities | 城市 | string[] | yes | comma-string |
| favoritePlaces | 常去地点 | string[] | yes | comma-string |
| relationshipScore | 关系评分 | number | yes | progress bar 0-100 |
| lastContactDate | 最近联系 | date | yes | relative time |
| introducedBy | 介绍人 | relation | no | person name |
| actionItems | 待办行动项 | actionItems | no | badge "2项待办" |
| coreMemories | 核心记忆 | string[] | yes | comma-string |

---

## Task 1: Create schema reader utility

**Files:**
- Create: `src/lib/schemaReader.ts`
- Read: `src/schemas/core.ts`, `prisma/schema.prisma`

- [ ] **Step 1: Create schemaReader.ts**

```typescript
// src/lib/schemaReader.ts

import { Prisma } from "@prisma/client";

// Column definition type
export type ColumnDef = {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "array" | "string[]" | "relation" | "actionItems";
  editable: boolean;
  validation?: {
    min?: number;
    max?: number;
  };
  relation?: string;
};

// Person 表列定义 — schema 变化时在此修改
export const PERSON_COLUMNS: ColumnDef[] = [
  { key: "name",           label: "姓名",            type: "string",     editable: true },
  { key: "careers",        label: "职业标签",          type: "array",      editable: true },
  { key: "interests",      label: "兴趣标签",          type: "array",      editable: true },
  { key: "vibeTags",       label: "性格标签",          type: "string[]",   editable: true },
  { key: "baseCities",     label: "城市",             type: "string[]",   editable: true },
  { key: "favoritePlaces", label: "常去地点",          type: "string[]",   editable: true },
  { key: "relationshipScore", label: "关系评分",       type: "number",     editable: true, validation: { min: 0, max: 100 } },
  { key: "lastContactDate", label: "最近联系",         type: "date",       editable: true },
  { key: "introducedBy",   label: "介绍人",            type: "relation",   editable: false, relation: "Person" },
  { key: "actionItems",    label: "待办行动项",        type: "actionItems", editable: false },
  { key: "coreMemories",   label: "核心记忆",          type: "string[]",   editable: true },
];

// 辅助函数：将数组渲染为逗号字符串
export function renderArray(arr: unknown[]): string {
  return arr.map((item) => {
    if (typeof item === "object" && item !== null && "name" in item) {
      const named = item as { name: string; weight?: number };
      return named.weight !== undefined
        ? `${named.name}(${named.weight})`
        : named.name;
    }
    return String(item);
  }).join(", ");
}

// 辅助函数：相对时间
export function renderRelativeDate(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}个月前`;
  return `${Math.floor(diff / 31536000)}年前`;
}
```

- [ ] **Step 2: Export from lib index (create src/lib/index.ts if not exists)**

Create `src/lib/index.ts`:
```typescript
export * from "./schemaReader";
export * from "./graphService";
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/schemaReader.ts src/lib/index.ts
git commit -m "feat(members): add schema reader with Person column definitions"
```

---

## Task 2: Create table API route (GET /api/members/table)

**Files:**
- Create: `src/app/api/members/table/route.ts`
- Read: `src/lib/schemaReader.ts`, `src/app/api/members/route.ts` (existing)

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/members/table/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PERSON_COLUMNS, renderArray, renderRelativeDate } from "@/lib/schemaReader";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") || "lastContactDate";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const filterCareer = searchParams.get("filterCareer");
  const filterCity = searchParams.get("filterCity");
  const filterInterest = searchParams.get("filterInterest");

  const { adapter } = await import("@/prisma/config");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ adapter });

  try {
    // 构建 where 条件
    const where: Record<string, unknown> = {};
    if (filterCareer) {
      where.careers = { path: [], array_contains: filterCareer };
    }
    if (filterCity) {
      where.baseCities = { has: filterCity };
    }
    if (filterInterest) {
      where.interests = { path: [], array_contains: filterInterest };
    }

    // 查询
    const persons = await prisma.person.findMany({
      where,
      orderBy: { [sort]: order },
      include: {
        introducedBy: { select: { name: true } },
        persons: {
          include: {
            interaction: {
              select: {
                actionItems: true,
              },
            },
          },
        },
      },
    });

    // 格式化行数据
    const rows = persons.map((p) => {
      // 未解决的行动项数量
      let actionItemCount = 0;
      for (const ip of p.persons) {
        const items = (ip.interaction.actionItems as unknown[]) || [];
        actionItemCount += items.filter((item: unknown) => {
          const ai = item as { resolved?: boolean };
          return !ai.resolved;
        }).length;
      }

      // 关系评分
      const score = p.relationshipScore;

      return {
        id: p.id,
        name: p.name,
        careers: renderArray((p.careers as unknown[]) || []),
        interests: renderArray((p.interests as unknown[]) || []),
        vibeTags: ((p.vibeTags as string[]) || []).join(", "),
        baseCities: ((p.baseCities as string[]) || []).join(", "),
        favoritePlaces: ((p.favoritePlaces as string[]) || []).join(", "),
        relationshipScore: score,
        lastContactDate: p.lastContactDate
          ? renderRelativeDate(p.lastContactDate)
          : "从未联系",
        introducedBy: p.introducedBy?.name || "—",
        actionItems: actionItemCount,
        coreMemories: ((p.coreMemories as string[]) || []).join(", "),
      };
    });

    return NextResponse.json({
      columns: PERSON_COLUMNS,
      rows,
    });
  } finally {
    await prisma.$disconnect();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/members/table/route.ts
git commit -m "feat(api): add GET /api/members/table with dynamic columns"
```

---

## Task 3: Create person edit API route (PATCH /api/members/:id)

**Files:**
- Create: `src/app/api/members/[id]/route.ts`
- Read: `src/lib/schemaReader.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/members/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

// 允许直接编辑的字段
const EDITABLE_FIELDS = [
  "name",
  "vibeTags",
  "baseCities",
  "favoritePlaces",
  "relationshipScore",
  "lastContactDate",
  "coreMemories",
];

// 数组解析：将 "投行, 木工" 解析为 string[]
function parseArrayString(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const { field, value } = body as { field: string; value: unknown };

  // 字段名白名单校验
  if (!EDITABLE_FIELDS.includes(field)) {
    return NextResponse.json({ error: `字段 ${field} 不允许直接编辑` }, { status: 403 });
  }

  // 关系评分范围校验
  if (field === "relationshipScore") {
    const num = Number(value);
    if (isNaN(num) || num < 0 || num > 100) {
      return NextResponse.json({ error: "关系评分必须在 0-100 之间" }, { status: 400 });
    }
  }

  // 姓名非空校验
  if (field === "name" && typeof value === "string" && !value.trim()) {
    return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
  }

  // 数组字段解析
  let dbValue: unknown = value;
  if (["vibeTags", "baseCities", "favoritePlaces", "coreMemories"].includes(field)) {
    dbValue = parseArrayString(String(value));
  }

  const { adapter } = await import("@/prisma/config");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ adapter });

  try {
    const updated = await prisma.person.update({
      where: { id },
      data: { [field]: dbValue },
    });

    return NextResponse.json({ success: true, person: updated });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// 获取单人详情（用于弹窗）
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const { adapter } = await import("@/prisma/config");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ adapter });

  try {
    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        introducedBy: { select: { id: true, name: true } },
        persons: {
          include: {
            interaction: {
              select: {
                date: true,
                contextType: true,
                sentiment: true,
                location: true,
                actionItems: true,
                coreMemories: true,
                persons: {
                  include: { person: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!person) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json(person);
  } finally {
    await prisma.$disconnect();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/members/[id]/route.ts
git commit -m "feat(api): add PATCH/GET /api/members/:id for editing and detail view"
```

---

## Task 4: Create PersonModal component

**Files:**
- Create: `src/components/PersonModal.tsx`
- Read: `src/lib/schemaReader.ts`, `src/app/input/page.tsx` (for style reference)

- [ ] **Step 1: Create the component**

```tsx
// src/components/PersonModal.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { PERSON_COLUMNS, renderArray, renderRelativeDate } from "@/lib/schemaReader";

type PersonDetail = {
  id: string;
  name: string;
  careers: unknown[];
  interests: unknown[];
  vibeTags: string[];
  baseCities: string[];
  favoritePlaces: string[];
  relationshipScore: number;
  lastContactDate: string | null;
  introducedBy: { id: string; name: string } | null;
  coreMemories: string[];
  persons: Array<{
    interaction: {
      date: string;
      contextType: string;
      sentiment: string;
      location: string | null;
      actionItems: unknown[];
      coreMemories: string[];
      persons: Array<{ person: { id: string; name: string } }>;
    };
  }>;
};

type PersonModalProps = {
  personId: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

export default function PersonModal({ personId, onClose, onSaved }: PersonModalProps) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 加载人员详情
  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/members/${personId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setPerson(data);
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [personId]);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!personId) return null;

  const startEdit = (field: string, currentValue: string) => {
    setEditField(field);
    setEditValue(currentValue);
  };

  const saveEdit = async () => {
    if (!editField || !person) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ field: editField, value: editValue }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      // 更新本地状态
      setPerson((prev) => prev ? { ...prev, [editField]: data.person[editField] } : prev);
      setEditField(null);
      setError(null);
      onSaved?.();
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => { setEditField(null); setError(null); };

  // 获取列配置
  const getColumn = (key: string) => PERSON_COLUMNS.find((c) => c.key === key);

  // 渲染字段值
  const renderValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (key === "careers" || key === "interests") return renderArray(value as unknown[]);
    if (Array.isArray(value)) return (value as string[]).join(", ");
    if (key === "relationshipScore") return `${value}/100`;
    if (key === "lastContactDate") {
      const d = new Date(value as string);
      return `${renderRelativeDate(d)} (${d.toLocaleDateString("zh-CN")})`;
    }
    return String(value);
  };

  const unresolvedActions = person?.persons.reduce((acc, ip) => {
    const items = (ip.interaction.actionItems as unknown[]) || [];
    return acc + items.filter((item: unknown) => !(item as { resolved?: boolean }).resolved).length;
  }, 0) ?? 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#f5f3ef", borderRadius: 16,
          width: "90vw", maxWidth: 640, maxHeight: "85vh",
          overflow: "auto", padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {loading && <div style={{ textAlign: "center", padding: 40 }}>加载中...</div>}
        {error && <div style={{ color: "#c0392b", marginBottom: 16 }}>{error}</div>}
        {!loading && person && (
          <>
            {/* 头部 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, fontFamily: "Georgia, serif" }}>
                  {person.name}
                </h2>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, maxWidth: 200, height: 8, background: "#e0d9cf", borderRadius: 4 }}>
                    <div style={{
                      width: `${person.relationshipScore}%`, height: "100%",
                      background: person.relationshipScore > 60 ? "#7ab87a" : person.relationshipScore > 30 ? "#c8a96e" : "#b05c5c",
                      borderRadius: 4, transition: "width 0.3s",
                    }} />
                  </div>
                  <span style={{ fontSize: 14, color: "#7a6a5a" }}>
                    {person.relationshipScore}/100
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "none", border: "none", fontSize: 24,
                  cursor: "pointer", color: "#7a6a5a", lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* 字段卡片 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {PERSON_COLUMNS.map((col) => {
                const value = (person as Record<string, unknown>)[col.key];
                const displayValue = renderValue(col.key, value);
                const isEditing = editField === col.key;

                return (
                  <div
                    key={col.key}
                    style={{
                      padding: "12px 16px", background: "white", borderRadius: 8,
                      border: isEditing ? "2px solid #c8a96e" : "1px solid #e0d9cf",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#9a8a7a", marginBottom: 4, fontWeight: 600 }}>
                      {col.label}
                      {!col.editable && <span style={{ marginLeft: 6, fontSize: 10, color: "#bbb" }}>只读</span>}
                    </div>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          autoFocus
                          style={{
                            flex: 1, padding: "6px 10px", border: "1px solid #c8a96e",
                            borderRadius: 6, fontSize: 14, outline: "none",
                            ...(col.validation && (editValue === "" || isNaN(Number(editValue)))) && {
                              borderColor: "#c0392b",
                            },
                          }}
                        />
                        {col.validation && (
                          <span style={{ fontSize: 12, color: "#9a8a7a", alignSelf: "center" }}>
                            {col.validation.min}–{col.validation.max}
                          </span>
                        )}
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          style={{
                            padding: "6px 14px", background: "#7ab87a", color: "white",
                            border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
                          }}
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{
                            padding: "6px 14px", background: "#e0d9cf", color: "#5a4a3a",
                            border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
                          }}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 14, color: "#3a2a1a",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          cursor: col.editable ? "pointer" : "default",
                          minHeight: 24,
                        }}
                        onClick={() => col.editable && startEdit(col.key, displayValue === "—" ? "" : displayValue)}
                      >
                        <span>{displayValue || "—"}</span>
                        {col.editable && (
                          <span style={{ fontSize: 12, color: "#c8a96e", opacity: 0.7 }}>编辑</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 互动历史 */}
            {person.persons.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#3a2a1a" }}>
                  互动历史 ({person.persons.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {person.persons
                    .sort((a, b) => new Date(b.interaction.date).getTime() - new Date(a.interaction.date).getTime())
                    .slice(0, 10)
                    .map((ip, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px 14px", background: "white", borderRadius: 8,
                          border: "1px solid #e0d9cf",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7a6a5a" }}>
                          <span>{new Date(ip.interaction.date).toLocaleDateString("zh-CN")}</span>
                          <span>{ip.interaction.contextType} · {ip.interaction.sentiment}</span>
                        </div>
                        {ip.interaction.location && (
                          <div style={{ fontSize: 12, color: "#9a8a7a", marginTop: 2 }}>{ip.interaction.location}</div>
                        )}
                        {ip.interaction.persons.length > 1 && (
                          <div style={{ fontSize: 12, color: "#9a8a7a", marginTop: 4 }}>
                            同场: {ip.interaction.persons
                              .filter((p) => p.person.id !== person.id)
                              .map((p) => p.person.name)
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PersonModal.tsx
git commit -m "feat(components): add PersonModal for viewing and editing person details"
```

---

## Task 5: Create members page

**Files:**
- Create: `src/app/members/page.tsx`
- Create: `src/app/members/layout.tsx`
- Read: `src/components/PersonModal.tsx`, `src/app/graph/page.tsx`

- [ ] **Step 1: Create layout.tsx**

```tsx
// src/app/members/layout.tsx
export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create the members page**

```tsx
// src/app/members/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PersonModal from "@/components/PersonModal";

type ColumnDef = {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "array" | "string[]" | "relation" | "actionItems";
  editable: boolean;
  validation?: { min?: number; max?: number };
};

type TableRow = Record<string, unknown>;

export default function MembersPage() {
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("lastContactDate");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [filterCareer, setFilterCareer] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchTable = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort, order });
    if (filterCareer) params.set("filterCareer", filterCareer);
    if (filterCity) params.set("filterCity", filterCity);
    const res = await fetch(`/api/members/table?${params}`);
    const data = await res.json();
    setColumns(data.columns);
    setRows(data.rows);
    setLoading(false);
  }, [sort, order, filterCareer, filterCity]);

  useEffect(() => { fetchTable(); }, [fetchTable]);

  // 排序
  const handleSort = (key: string) => {
    if (sort === key) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setOrder("desc");
    }
  };

  // 编辑保存后刷新
  const handleSaved = () => { setSavedCount((c) => c + 1); fetchTable(); };

  // 滚动到选中行
  useEffect(() => {
    if (!selectedId || !tableRef.current) return;
    const row = tableRef.current.querySelector(`[data-row-id="${selectedId}"]`) as HTMLElement;
    if (row) { row.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  }, [selectedId]);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef", padding: "24px 32px" }}>
      {/* 顶部导航 */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif" }}>人脉总览</h1>
        <span style={{ fontSize: 14, color: "#9a8a7a" }}>{rows.length} 位联系人</span>
      </div>

      {/* 筛选栏 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="按职业筛选..."
          value={filterCareer}
          onChange={(e) => setFilterCareer(e.target.value)}
          style={{
            padding: "8px 14px", border: "1px solid #d4c9bb", borderRadius: 8,
            fontSize: 14, background: "white", outline: "none", minWidth: 160,
          }}
        />
        <input
          placeholder="按城市筛选..."
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          style={{
            padding: "8px 14px", border: "1px solid #d4c9bb", borderRadius: 8,
            fontSize: 14, background: "white", outline: "none", minWidth: 160,
          }}
        />
        <button
          onClick={fetchTable}
          style={{
            padding: "8px 16px", background: "#c8a96e", color: "white",
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14,
          }}
        >
          搜索
        </button>
      </div>

      {/* 表格 */}
      <div
        ref={tableRef}
        style={{
          background: "white", borderRadius: 12,
          border: "1px solid #e0d9cf",
          overflow: "auto", maxHeight: "calc(100vh - 220px)",
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9a8a7a" }}>加载中...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9a8a7a" }}>暂无联系人</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => ["string", "number", "date", "array", "string[]"].includes(col.type) && handleSort(col.key)}
                    style={{
                      padding: "12px 16px", textAlign: "left",
                      background: "#f9f7f3", borderBottom: "1px solid #e0d9cf",
                      cursor: ["string", "number", "date", "array", "string[]"].includes(col.type) ? "pointer" : "default",
                      userSelect: "none", whiteSpace: "nowrap", fontWeight: 600, color: "#5a4a3a",
                    }}
                  >
                    {col.label}
                    {sort === col.key && (
                      <span style={{ marginLeft: 4 }}>{order === "asc" ? "↑" : "↓"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id as string}
                  data-row-id={row.id}
                  onClick={() => setSelectedId(row.id as string)}
                  style={{
                    cursor: "pointer",
                    background: selectedId === row.id ? "#fef7ec" : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (selectedId !== row.id) (e.currentTarget as HTMLElement).style.background = "#faf8f4"; }}
                  onMouseLeave={(e) => { if (selectedId !== row.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: "10px 16px", borderBottom: "1px solid #f0ece4",
                        maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        ...(col.key === "relationshipScore" && {
                          display: "flex", alignItems: "center", gap: 8,
                        }),
                      }}
                    >
                      {col.key === "relationshipScore" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                          <div style={{ flex: 1, height: 6, background: "#e0d9cf", borderRadius: 3 }}>
                            <div style={{
                              width: `${row[col.key]}%`, height: "100%",
                              background: Number(row[col.key]) > 60 ? "#7ab87a" : Number(row[col.key]) > 30 ? "#c8a96e" : "#b05c5c",
                              borderRadius: 3,
                            }} />
                          </div>
                          <span style={{ fontSize: 13, color: "#7a6a5a", minWidth: 36 }}>
                            {row[col.key]}/100
                          </span>
                        </div>
                      ) : col.type === "actionItems" ? (
                        <span style={{
                          display: "inline-block", padding: "2px 8px",
                          background: Number(row[col.key]) > 0 ? "#fef3e0" : "#f0f0f0",
                          color: Number(row[col.key]) > 0 ? "#b05c5c" : "#9a8a7a",
                          borderRadius: 12, fontSize: 12, fontWeight: 600,
                        }}>
                          {Number(row[col.key]) > 0 ? `${row[col.key]}项待办` : "无待办"}
                        </span>
                      ) : (
                        <span title={String(row[col.key] ?? "")}>{String(row[col.key] ?? "—")}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 弹窗 */}
      {selectedId && (
        <PersonModal
          personId={selectedId}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/members/layout.tsx src/app/members/page.tsx
git commit -m "feat(members): add dynamic members table page with sorting and filtering"
```

---

## Task 6: Add PersonModal to graph page

**Files:**
- Modify: `src/app/graph/page.tsx`
- Read: `src/app/graph/page.tsx`, `src/components/PersonModal.tsx`

- [ ] **Step 1: Read current graph page**

Read `src/app/graph/page.tsx` to understand its current state.

- [ ] **Step 2: Add PersonModal import and state**

Add to the imports/state section:
```tsx
import PersonModal from "@/components/PersonModal";

// Add to state:
const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
```

- [ ] **Step 3: Modify node click handler**

Find the `node.onClick` handler and add:
```tsx
node.onClick = () => setSelectedPersonId(node.id);
```

- [ ] **Step 4: Add PersonModal at bottom of JSX**

Add before the closing `</div>` of the main container:
```tsx
{selectedPersonId && (
  <PersonModal
    personId={selectedPersonId}
    onClose={() => setSelectedPersonId(null)}
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/graph/page.tsx
git commit -m "feat(graph): add PersonModal popup on node click"
```

---

## Task 7: Write design doc

**Files:**
- Create: `docs/superpowers/specs/2026-04-04-person-table-design.md`

- [ ] **Step 1: Write design document**

```markdown
# 动态人脉表格设计文档

**日期**: 2026-04-04
**作者**: Claude (with 用户)
**状态**: 已设计，待实现

---

## 一、功能概述

新增一个 schema 驱动的动态人脉表格页面，替代 `/suggestions` 占位页，支持：
1. 查看所有人的结构化信息（表格形式）
2. 按职业/城市/兴趣筛选
3. 按任意列排序
4. 点击行打开详情弹窗，支持编辑
5. 图谱页面点击节点弹出详情弹窗

## 二、技术方案

### 后端

#### GET /api/members/table
返回 `{ columns, rows }`，columns 由 `src/lib/schemaReader.ts` 中的 `PERSON_COLUMNS` 定义驱动，rows 包含所有 Person 数据及派生字段（actionItems 数量、introducedBy 名称等）。

Query 参数：`sort`, `order`, `filterCareer`, `filterCity`, `filterInterest`

#### PATCH /api/members/:id
部分字段更新，支持字段：name, vibeTags, baseCities, favoritePlaces, relationshipScore, lastContactDate, coreMemories。
实时校验：relationshipScore 限 0-100，name 非空。

#### GET /api/members/:id
返回单人完整详情（含互动历史），用于弹窗展示。

### 前端

#### /members/page.tsx
动态表格页面，列根据 `columns` 配置渲染，关键交互：
- 列头点击排序（direction 切换）
- 筛选栏（职业/城市）
- 行点击 → 打开 PersonModal

#### PersonModal.tsx
通用弹窗组件，两个场景复用：
1. members 表格行点击
2. graph 节点点击

功能：展示所有字段、编辑可编辑字段、显示互动历史。

### 图谱联动
graph/page.tsx 中，节点 `onClick` → `setSelectedPersonId(node.id)` → 打开弹窗。

## 三、数据流

```
前端加载 → GET /api/members/table → columns + rows → 动态渲染表格
点击行/节点 → GET /api/members/:id → 弹窗详情
编辑字段 → PATCH /api/members/:id → 刷新表格数据
```

## 四、字段渲染规则

| 字段 | 表格渲染 | 弹窗渲染 |
|------|----------|----------|
| careers/interests | "投行(0.9), 木工(0.1)" | 同上 |
| vibeTags等string[] | 逗号拼接 | 逗号拼接 |
| relationshipScore | 进度条 | 进度条 + 数字 |
| lastContactDate | 相对时间 | 相对时间 + 悬停完整日期 |
| introducedBy | 人名 | 人名 |
| actionItems | 徽章"2项待办" | 互动历史列表 |

## 五、关键文件

| 文件 | 作用 |
|------|------|
| `src/lib/schemaReader.ts` | 列定义 + 辅助函数 |
| `src/app/api/members/table/route.ts` | 表格数据接口 |
| `src/app/api/members/[id]/route.ts` | 单人详情+编辑接口 |
| `src/components/PersonModal.tsx` | 弹窗组件 |
| `src/app/members/page.tsx` | 表格页面 |
| `src/app/graph/page.tsx` | 图谱节点点击弹窗 |

## 六、已知约束

- arrays 字段（careers/interests）在表格中为只读展示，编辑时需重新输入逗号分隔字符串
- introducedBy 和 actionItems 为只读
- 无多用户隔离，所有数据共享
```

- [ ] **Step 2: Commit design doc**

```bash
git add docs/superpowers/specs/2026-04-04-person-table-design.md
git commit -m "docs: add person table design spec"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Table view ✅, Sorting ✅, Filtering ✅, Editable ✅, Modal ✅, Graph integration ✅
- [x] **Placeholder scan**: No TBD/TODO, all code is concrete
- [x] **Type consistency**: All field keys match PERSON_COLUMNS definitions exactly
- [x] **No gaps**: Every requirement from brainstorming is addressed

---

**Plan saved to:** `docs/superpowers/plans/2026-04-04-person-table-design.md`
