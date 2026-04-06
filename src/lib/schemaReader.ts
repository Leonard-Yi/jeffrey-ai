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
  { key: "favoritePlaces",  label: "常去地点",          type: "string[]",   editable: true },
  { key: "relationshipScore", label: "关系评分",        type: "number",     editable: true, validation: { min: 0, max: 100 } },
  { key: "lastContactDate", label: "最近联系",         type: "date",       editable: true },
  { key: "introducedBy",   label: "介绍人",            type: "relation",   editable: false, relation: "Person" },
  { key: "actionItems",    label: "待办行动项",         type: "actionItems", editable: false },
  { key: "coreMemories",   label: "核心记忆",           type: "string[]",  editable: true },
];

// 辅助函数：将数组渲染为逗号字符串
export function renderArray(arr: unknown[]): string {
  return arr.map((item) => {
    if (typeof item === "object" && item !== null && "name" in item) {
      const named = item as { name: string; weight?: number };
      return named.weight !== undefined
        ? `${named.name}(${Math.round(named.weight * 100)}%)`
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