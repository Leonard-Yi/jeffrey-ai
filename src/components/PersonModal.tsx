"use client";

import { useEffect, useState, useCallback } from "react";
import { renderArray, renderRelativeDate } from "@/lib/schemaReader";
import { tokens as C } from "@/lib/design-tokens";
import MultiIntroducerSelector from "./MultiIntroducerSelector";
import FieldCard from "./FieldCard";

type ActionItem = {
  description: string;
  ownedBy: "me" | "them" | "both";
  resolved: boolean;
};

type PersonDetail = {
  id: string;
  name: string;
  careers: unknown[];
  interests: unknown[];
  vibeTags: string[];
  baseCities: string[];
  favoritePlaces: string[];
  relationshipScore: number;
  lastContactDate: string | Date | null;
  introducedBy: { id: string; name: string } | null;
  introducedByIds: string[];
  coreMemories: string[];
  interactions?: Array<{
    interaction: {
      id?: string;
      date: string | Date;
      contextType: string;
      sentiment: string;
      location?: string | null;
      actionItems: ActionItem[];
      coreMemories: string[];
      persons?: Array<{ person: { id: string; name: string } }>;
    };
  }>;
  introductions?: Array<{ id: string; name: string }>;
};

type PersonModalProps = {
  personId: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

const EDITABLE_FIELDS = [
  "name",
  "vibeTags",
  "baseCities",
  "favoritePlaces",
  "relationshipScore",
  "lastContactDate",
  "coreMemories",
  "careers",
  "interests",
] as const;

export default function PersonModal({ personId, onClose, onSaved }: PersonModalProps) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingActionItemId, setEditingActionItemId] = useState<string | null>(null);
  const [editingActionItemValue, setEditingActionItemValue] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [animatingItemKey, setAnimatingItemKey] = useState<string | null>(null);
  const [allPersons, setAllPersons] = useState<Array<{ id: string; name: string; relationshipScore: number }>>([]);
  const [navigateStack, setNavigateStack] = useState<string[]>([]);

  useEffect(() => {
    if (!personId) {
      setPerson(null);
      setError(null);
      return;
    }

    const fetchPerson = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/members/${personId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch person");
        }
        const data: PersonDetail = await res.json();
        setPerson(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchPerson();
  }, [personId, refreshTrigger]);

  useEffect(() => {
    fetch("/api/members/table")
      .then((r) => r.json())
      .then((data) => {
        setAllPersons(
          (data.rows || []).sort(
            (a: { relationshipScore: number }, b: { relationshipScore: number }) =>
              b.relationshipScore - a.relationshipScore
          )
        );
      })
      .catch(() => {});
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (personId) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [personId, handleKeyDown]);

  const startEditing = (field: string, currentValue: unknown) => {
    if (!EDITABLE_FIELDS.includes(field as typeof EDITABLE_FIELDS[number])) return;

    if (field === "relationshipScore") {
      setEditValue(String(currentValue ?? 0));
    } else if (Array.isArray(currentValue) && currentValue !== null) {
      if (
        currentValue.length > 0 &&
        typeof currentValue[0] === "object" &&
        "name" in (currentValue[0] as object)
      ) {
        const wt = currentValue as Array<{ name: string; weight?: number }>;
        setEditValue(
          wt
            .map((t) =>
              t.weight != null
                ? `${t.name}(${Math.round(t.weight * 100)}%)`
                : t.name
            )
            .join(", ")
        );
      } else {
        setEditValue(currentValue.join(", "));
      }
    } else if (currentValue === null || currentValue === undefined) {
      setEditValue("");
    } else {
      setEditValue(String(currentValue));
    }
    setEditingField(field);
    setSaveError(null);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue("");
    setSaveError(null);
  };

  const handleNavigateToPerson = (targetId: string) => {
    if (!person) return;
    setNavigateStack((prev) => [...prev, person.id]);
    setPerson(null);
    setLoading(true);
    fetch(`/api/members/${targetId}`)
      .then((r) => r.json())
      .then((data: PersonDetail) => {
        setPerson(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleGoBack = () => {
    if (navigateStack.length === 0) return;
    const prevId = navigateStack[navigateStack.length - 1];
    setNavigateStack((prev) => prev.slice(0, -1));
    setPerson(null);
    setLoading(true);
    fetch(`/api/members/${prevId}`)
      .then((r) => r.json())
      .then((data: PersonDetail) => {
        setPerson(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const saveEditing = async () => {
    if (!editingField || !person) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/members/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: editingField, value: editValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setPerson((prev) => (prev ? { ...prev, ...data.person } : prev));
      setEditingField(null);
      setEditValue("");
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEditing();
    else if (e.key === "Escape") cancelEditing();
  };

  const handleSaveActionItem = async (interactionId: string, itemIndex: number) => {
    if (!person?.interactions) return;
    const ip = person.interactions.find((ip) => ip.interaction.id === interactionId);
    if (!ip) return;
    const interaction = ip.interaction;
    if (!Array.isArray(interaction.actionItems)) return;

    const items = [...(interaction.actionItems as ActionItem[])];
    if (!items[itemIndex]) return;
    const newDescription = editingActionItemValue;

    setPerson((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        interactions: prev.interactions.map((ip2) => {
          if (ip2.interaction.id !== interactionId) return ip2;
          const items2 = [...(ip2.interaction.actionItems as ActionItem[])];
          items2[itemIndex] = { ...items2[itemIndex], description: newDescription };
          return { ...ip2, interaction: { ...ip2.interaction, actionItems: items2 } };
        }),
      };
    });

    setEditingActionItemId(null);

    const itemsToSave = [...items];
    itemsToSave[itemIndex] = { ...itemsToSave[itemIndex], description: newDescription };
    await fetch(`/api/interactions/${interactionId}/actionItems`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItems: itemsToSave }),
    });
  };

  const handleToggleResolved = async (interactionId: string, itemIndex: number) => {
    if (!person?.interactions) return;
    const ip = person.interactions.find((ip) => ip.interaction.id === interactionId);
    if (!ip) return;
    const interaction = ip.interaction;
    if (!Array.isArray(interaction.actionItems) || !interaction.actionItems[itemIndex]) return;

    const itemKey = `${interactionId}-${itemIndex}`;
    const newResolved = !interaction.actionItems[itemIndex].resolved;

    setPerson((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        interactions: prev.interactions.map((ip2) => {
          if (ip2.interaction.id !== interactionId) return ip2;
          const items = [...(ip2.interaction.actionItems as ActionItem[])];
          items[itemIndex] = { ...items[itemIndex], resolved: newResolved };
          return { ...ip2, interaction: { ...ip2.interaction, actionItems: items } };
        }),
      };
    });

    setAnimatingItemKey(itemKey);
    setTimeout(() => setAnimatingItemKey(null), 500);

    const items = [...(interaction.actionItems as ActionItem[])];
    items[itemIndex] = { ...items[itemIndex], resolved: newResolved };
    await fetch(`/api/interactions/${interactionId}/actionItems`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItems: items }),
    });
  };

  const handleDeleteActionItem = async (interactionId: string, itemIndex: number) => {
    if (!person?.interactions) return;
    const ip = person.interactions.find((ip) => ip.interaction.id === interactionId);
    if (!ip) return;
    const items = [...(ip.interaction.actionItems as ActionItem[])];
    items.splice(itemIndex, 1);

    setPerson((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        interactions: prev.interactions.map((ip2) => {
          if (ip2.interaction.id !== interactionId) return ip2;
          return { ...ip2, interaction: { ...ip2.interaction, actionItems: items } };
        }),
      };
    });

    await fetch(`/api/interactions/${interactionId}/actionItems`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItems: items }),
    });
    onSaved?.();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  };

  const getOwnerColor = (ownedBy: string) => {
    if (ownedBy === "me") return { border: C.error, dot: C.error, label: "我欠" };
    if (ownedBy === "them") return { border: C.info, dot: C.info, label: "对方欠" };
    return { border: C.warning, dot: C.warning, label: "互欠" };
  };

  const renderActionItems = () => {
    if (!person?.interactions) return null;

    const allItems: Array<{
      item: ActionItem;
      date: string;
      interactionId: string;
      itemIndex: number;
    }> = [];

    for (const { interaction } of person.interactions) {
      if (Array.isArray(interaction.actionItems) && interaction.id) {
        for (let i = 0; i < interaction.actionItems.length; i++) {
          allItems.push({
            item: interaction.actionItems[i],
            date: interaction.date as string,
            interactionId: interaction.id,
            itemIndex: i,
          });
        }
      }
    }

    const unresolved = allItems.filter((i) => !i.item.resolved);
    const resolved = allItems.filter((i) => i.item.resolved);

    return (
      <div>
        {unresolved.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8, color: C.error }}>
              待完成
            </div>
            {unresolved.map((entry) => {
              const colors = getOwnerColor(entry.item.ownedBy);
              const itemKey = `${entry.interactionId}-${entry.itemIndex}`;
              const isEditing = editingActionItemId === itemKey;

              return (
                <div
                  key={itemKey}
                  className={`action-item-row${animatingItemKey === itemKey ? " animating" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    paddingLeft: 8,
                    borderLeft: `3px solid ${colors.border}`,
                  }}
                >
                  <button
                    onClick={() =>
                      handleToggleResolved(entry.interactionId, entry.itemIndex)
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: colors.dot,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ○
                  </button>

                  {isEditing ? (
                    <input
                      value={editingActionItemValue}
                      onChange={(e) =>
                        setEditingActionItemValue(e.target.value)
                      }
                      onBlur={() =>
                        handleSaveActionItem(entry.interactionId, entry.itemIndex)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleSaveActionItem(entry.interactionId, entry.itemIndex);
                        if (e.key === "Escape") setEditingActionItemId(null);
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        border: `1px solid ${C.border}`,
                        borderRadius: C.radiusSm,
                        padding: "2px 6px",
                        fontSize: 13,
                        backgroundColor: C.bgElevated,
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingActionItemId(itemKey);
                        setEditingActionItemValue(entry.item.description);
                      }}
                      style={{
                        flex: 1,
                        fontSize: 13,
                        cursor: "text",
                        color: C.text,
                      }}
                      title="点击编辑"
                    >
                      {entry.item.description}
                    </span>
                  )}

                  <span
                    style={{
                      fontSize: 11,
                      color: colors.dot,
                      backgroundColor: `${colors.dot}15`,
                      padding: "1px 6px",
                      borderRadius: C.radiusSm,
                    }}
                  >
                    {colors.label}
                  </span>

                  <button
                    onClick={() =>
                      handleDeleteActionItem(entry.interactionId, entry.itemIndex)
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: C.textMuted,
                      padding: "0 2px",
                      lineHeight: 1,
                      opacity: 0.6,
                      marginLeft: 4,
                    }}
                    title="删除此待办"
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.opacity = "1")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.opacity = "0.6")
                    }
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {resolved.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: C.textSecondary }}>
              已完成
            </div>
            {resolved.slice(0, 5).map((entry) => {
              const colors = getOwnerColor(entry.item.ownedBy);
              const itemKey = `${entry.interactionId}-${entry.itemIndex}`;
              return (
                <div
                  key={itemKey}
                  className={`action-item-row${animatingItemKey === itemKey ? " animating" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                    fontSize: 13,
                    color: C.textMuted,
                  }}
                >
                  <button
                    onClick={() =>
                      handleToggleResolved(entry.interactionId, entry.itemIndex)
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: C.success,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </button>
                  <span style={{ flex: 1, textDecoration: "line-through" }}>
                    {entry.item.description}
                  </span>
                  <span style={{ fontSize: 11, color: colors.dot }}>
                    {colors.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const getSortedInteractions = () => {
    if (!person?.interactions) return [];
    return [...person.interactions].sort(
      (a, b) =>
        new Date(b.interaction.date).getTime() -
        new Date(a.interaction.date).getTime()
    );
  };

  if (!personId) return null;

  return (
    <>
      <style>{`
        @keyframes item-toggle {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes item-complete {
          0% { background-color: transparent; }
          30% { background-color: rgba(76, 175, 80, 0.15); }
          100% { background-color: transparent; }
        }
        .action-item-row {
          border-radius: 6px;
          transition: background-color 0.3s ease;
        }
        .action-item-row.animating {
          animation: item-toggle 0.4s ease, item-complete 0.5s ease;
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 20,
        }}
        onClick={handleOverlayClick}
      >
        <div
          style={{
            backgroundColor: C.bg,
            borderRadius: C.radiusXl,
            width: "90vw",
            maxWidth: 640,
            maxHeight: "85vh",
            overflow: "auto",
            position: "relative",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "24px 24px 16px",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {navigateStack.length > 0 && (
                  <button
                    onClick={handleGoBack}
                    style={{
                      background: "none",
                      border: `1px solid ${C.border}`,
                      borderRadius: C.radiusSm,
                      cursor: "pointer",
                      fontSize: 16,
                      color: C.textSecondary,
                      padding: "4px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title="返回"
                  >
                    ← 返回
                  </button>
                )}
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 24,
                    color: C.text,
                    margin: 0,
                  }}
                >
                  {person?.name ?? "加载中..."}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="关闭"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: C.textSecondary,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            {person && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    backgroundColor: C.bgActive,
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${person.relationshipScore}%`,
                      backgroundColor: C.primary,
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: 14, color: C.textSecondary, minWidth: 45 }}>
                  {person.relationshipScore}/100
                </span>
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: "16px 24px 24px" }}>
            {loading && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "60px 24px",
                  color: C.textSecondary,
                  fontSize: 16,
                }}
              >
                加载中...
              </div>
            )}

            {error && (
              <div style={{ color: C.error, fontSize: 16 }}>{error}</div>
            )}

            {person && !loading && (
              <>
                <FieldCard
                  label="姓名"
                  fieldKey="name"
                  value={person.name}
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() => startEditing("name", person.name)}
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                />

                <FieldCard
                  label="职业标签"
                  fieldKey="careers"
                  value={renderArray(person.careers)}
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() => startEditing("careers", person.careers)}
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                  isArray
                />

                <FieldCard
                  label="兴趣标签"
                  fieldKey="interests"
                  value={renderArray(person.interests)}
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() => startEditing("interests", person.interests)}
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                  isArray
                />

                <FieldCard
                  label="性格标签"
                  fieldKey="vibeTags"
                  value={(person.vibeTags ?? []).join(", ") || "—"}
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() => startEditing("vibeTags", person.vibeTags)}
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                />

                <FieldCard
                  label="城市"
                  fieldKey="baseCities"
                  value={(person.baseCities ?? []).join(", ") || "—"}
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() => startEditing("baseCities", person.baseCities)}
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                />

                <FieldCard
                  label="常去地点"
                  fieldKey="favoritePlaces"
                  value={(person.favoritePlaces ?? []).join(", ") || "—"}
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() =>
                    startEditing("favoritePlaces", person.favoritePlaces)
                  }
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                />

                <FieldCard
                  label="关系评分"
                  fieldKey="relationshipScore"
                  value={`${person.relationshipScore}/100`}
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() =>
                    startEditing("relationshipScore", person.relationshipScore)
                  }
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                  isNumber
                />

                <FieldCard
                  label="最近联系"
                  fieldKey="lastContactDate"
                  value={
                    person.lastContactDate
                      ? `${renderRelativeDate(
                          new Date(person.lastContactDate)
                        )} · ${formatDate(person.lastContactDate)}`
                      : "—"
                  }
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() =>
                    startEditing("lastContactDate", person.lastContactDate)
                  }
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                  isDate
                />

                {/* Introduced By */}
                <div
                  style={{
                    backgroundColor: C.bgElevated,
                    border: `1px solid ${C.border}`,
                    borderRadius: C.radiusMd,
                    padding: "12px 16px",
                    marginBottom: 12,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textMuted,
                      marginBottom: 4,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.5px",
                    }}
                  >
                    介绍人
                  </div>
                  <MultiIntroducerSelector
                    values={person.introducedByIds ?? []}
                    currentPersonId={person.id}
                    allPersons={allPersons}
                    onNavigate={handleNavigateToPerson}
                    onChange={async (newIds) => {
                      setPerson((prev) =>
                        prev ? { ...prev, introducedByIds: newIds } : prev
                      );
                      const res = await fetch(`/api/members/${person.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          field: "introducedByIds",
                          value: newIds,
                        }),
                      });
                      if (res.ok) onSaved?.();
                    }}
                  />
                </div>

                {/* Introduced Others */}
                {person.introductions && person.introductions.length > 0 && (
                  <div
                    style={{
                      backgroundColor: C.bgElevated,
                      border: `1px solid ${C.border}`,
                      borderRadius: C.radiusMd,
                      padding: "12px 16px",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: C.textMuted,
                        marginBottom: 4,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.5px",
                      }}
                    >
                      引见过的人
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 8,
                      }}
                    >
                      {person.introductions.map((p) => (
                        <span
                          key={p.id}
                          onClick={() => handleNavigateToPerson(p.id)}
                          style={{
                            cursor: "pointer",
                            padding: "4px 10px",
                            borderRadius: C.radiusSm,
                            fontSize: 13,
                            background: C.bgElevated,
                            border: `1px solid ${C.borderStrong}`,
                            color: C.accent,
                            transition: "opacity 0.12s",
                          }}
                          onMouseEnter={(e) =>
                            ((e.target as HTMLElement).style.opacity = "0.7")
                          }
                          onMouseLeave={(e) =>
                            ((e.target as HTMLElement).style.opacity = "1")
                          }
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Core Memories */}
                <FieldCard
                  label="核心记忆"
                  fieldKey="coreMemories"
                  value={
                    (() => {
                      const mems = (person.interactions ?? [])
                        .flatMap(
                          (ip: any) =>
                            (ip.interaction?.coreMemories ?? []) as string[]
                        )
                        .filter(
                          (m: string, i: number, arr: string[]) =>
                            m && arr.indexOf(m) === i
                        )
                        .slice(-20);
                      return mems.length > 0 ? mems.join(" / ") : "—";
                    })()
                  }
                  editingField={editingField}
                  editValue={editValue}
                  onStartEdit={() => startEditing("coreMemories", person.coreMemories)}
                  onEditChange={setEditValue}
                  onKeyDown={handleInputKeyDown}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                  saving={saving}
                  saveError={saveError}
                />

                {/* Action Items */}
                <div
                  style={{
                    backgroundColor: C.bgElevated,
                    border: `1px solid ${C.border}`,
                    borderRadius: C.radiusMd,
                    padding: "12px 16px",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textMuted,
                      marginBottom: 4,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.5px",
                    }}
                  >
                    待办行动项
                  </div>
                  {renderActionItems()}
                </div>

                {/* Interaction History */}
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    color: C.text,
                    margin: "24px 0 12px",
                    paddingBottom: 8,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  互动历史
                </h3>
                {getSortedInteractions().length === 0 ? (
                  <div
                    style={{
                      color: C.textMuted,
                      fontSize: 14,
                      fontStyle: "italic",
                    }}
                  >
                    暂无互动记录
                  </div>
                ) : (
                  getSortedInteractions()
                    .slice(0, 10)
                    .map((item, idx) => {
                      const { interaction } = item;
                      const otherParticipants = interaction.persons?.filter(
                        (p) => p.person.id !== person.id
                      );

                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: C.bgElevated,
                            border: `1px solid ${C.border}`,
                            borderRadius: C.radiusMd,
                            padding: "12px 16px",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                color: C.text,
                                fontWeight: 500,
                              }}
                            >
                              {formatDate(interaction.date)}
                            </span>
                            <div style={{ display: "flex", gap: 8 }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  padding: "2px 8px",
                                  borderRadius: C.radiusSm,
                                  backgroundColor: C.bg,
                                  color: C.textSecondary,
                                }}
                              >
                                {interaction.contextType}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  padding: "2px 8px",
                                  borderRadius: C.radiusSm,
                                  backgroundColor: C.bg,
                                  color: C.textSecondary,
                                }}
                              >
                                {interaction.sentiment}
                              </span>
                            </div>
                          </div>
                          {interaction.location && (
                            <div
                              style={{
                                fontSize: 13,
                                color: C.textSecondary,
                                marginTop: 4,
                              }}
                            >
                              📍 {interaction.location}
                            </div>
                          )}
                          {otherParticipants && otherParticipants.length > 0 && (
                            <div
                              style={{
                                fontSize: 13,
                                color: C.textMuted,
                                marginTop: 4,
                              }}
                            >
                              👥{" "}
                              {otherParticipants
                                .map((p) => p.person.name)
                                .join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
