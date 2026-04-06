"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { renderArray, renderRelativeDate } from "@/lib/schemaReader";

type ActionItem = {
  description: string;
  ownedBy: "me" | "them" | "both";
  resolved: boolean;
};

type MultiIntroducerSelectorProps = {
  values: string[];
  currentPersonId: string;
  onChange: (ids: string[]) => Promise<void>;
  allPersons: Array<{ id: string; name: string; relationshipScore: number }>;
  onNavigate: (id: string) => void;
};

function MultiIntroducerSelector({ values, currentPersonId, onChange, allPersons, onNavigate }: MultiIntroducerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // persons list used for dropdown — derived from allPersons filtered by search
  const [persons, setPersons] = useState<Array<{ id: string; name: string; relationshipScore: number }>>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/members/table")
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.rows || [])
          .filter((p: { id: string }) => p.id !== currentPersonId)
          .sort((a: { relationshipScore: number }, b: { relationshipScore: number }) => b.relationshipScore - a.relationshipScore);
        setPersons(sorted);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("加载失败");
      });
  }, [open, currentPersonId]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Resolve names from allPersons (pre-loaded, available even when dropdown is closed)
  const displayNames = values.map((id) => {
    const found = allPersons.find((p) => p.id === id);
    return found ? found.name : id;
  });

  const displayText = values.length === 0
    ? "点击选择介绍人"
    : displayNames.join("、");

  const filtered = persons.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const togglePerson = async (id: string) => {
    const newValues = values.includes(id)
      ? values.filter((v) => v !== id)
      : [...values, id];
    await onChange(newValues);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {open ? (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            backgroundColor: "white",
            border: "1px solid #d4c9bb",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            padding: 8,
          }}
        >
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索人脉..."
            style={{
              width: "100%",
              border: "1px solid #d4c9bb",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 6 }}>
            {loading ? (
              <div style={{ padding: "8px 4px", color: "#7a6a5a", fontSize: 13 }}>加载中...</div>
            ) : error ? (
              <div style={{ padding: "8px 4px", color: "#e53935", fontSize: 13 }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "8px 4px", color: "#9a8a7a", fontSize: 13 }}>未找到匹配人脉</div>
            ) : (
              <>
                {values.length > 0 && (
                  <div
                    onClick={async () => { await onChange([]); }}
                    style={{ padding: "6px 4px", fontSize: 13, color: "#c44", cursor: "pointer" }}
                  >
                    清除全部
                  </div>
                )}
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => togglePerson(p.id)}
                    style={{
                      padding: "6px 4px",
                      fontSize: 13,
                      cursor: "pointer",
                      borderRadius: 4,
                      color: "#3a2a1a",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#faf8f4")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        border: `2px solid ${values.includes(p.id) ? "#c8a96e" : "#d4c9bb"}`,
                        backgroundColor: values.includes(p.id) ? "#c8a96e" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {values.includes(p.id) && (
                        <span style={{ color: "white", fontSize: 10, lineHeight: 1 }}>✓</span>
                      )}
                    </span>
                    {p.name}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", alignItems: "center" }}>
          {values.length === 0 ? (
            <span
              onClick={() => setOpen(true)}
              style={{ cursor: "pointer", color: "#c8a96e", fontStyle: "italic" }}
              title="点击选择介绍人"
            >
              点击选择介绍人
            </span>
          ) : (
            displayNames.map((name, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  onClick={() => onNavigate(values[i])}
                  style={{ cursor: "pointer", color: "#3a2a1a", textDecoration: "underline", textDecorationColor: "#c8a96e" }}
                  title={`查看 ${name} 的资料`}
                >
                  {name}
                </span>
                <span
                  onClick={() => setOpen(true)}
                  style={{ cursor: "pointer", color: "#9a8a7a", fontSize: 11 }}
                  title="编辑选择"
                >
                  ✎
                </span>
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
};

type PersonModalProps = {
  personId: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

const STYLES = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    backgroundColor: "#f5f3ef",
    borderRadius: "16px",
    width: "90vw",
    maxWidth: "640px",
    maxHeight: "85vh",
    overflow: "auto",
    position: "relative" as const,
  },
  header: {
    padding: "24px 24px 16px",
    borderBottom: "1px solid #e0d9cf",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  name: {
    fontFamily: "Georgia, serif",
    fontSize: "24px",
    color: "#3a2a1a",
    margin: 0,
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    color: "#7a6a5a",
    padding: "0",
    lineHeight: 1,
  },
  scoreBar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  scoreTrack: {
    flex: 1,
    height: "8px",
    backgroundColor: "#e0d9cf",
    borderRadius: "4px",
    overflow: "hidden",
  },
  scoreFill: {
    height: "100%",
    backgroundColor: "#c8a96e",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  scoreText: {
    fontSize: "14px",
    color: "#7a6a5a",
    minWidth: "45px",
  },
  body: {
    padding: "16px 24px 24px",
  },
  fieldCard: {
    backgroundColor: "white",
    border: "1px solid #e0d9cf",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "12px",
  },
  fieldLabel: {
    fontSize: "12px",
    color: "#9a8a7a",
    marginBottom: "4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  fieldValue: {
    fontSize: "15px",
    color: "#3a2a1a",
    cursor: "pointer",
    minHeight: "24px",
  },
  fieldInput: {
    width: "100%",
    padding: "8px 12px",
    fontSize: "15px",
    color: "#3a2a1a",
    border: "1px solid #c8a96e",
    borderRadius: "6px",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  editButtons: {
    display: "flex",
    gap: "8px",
    marginTop: "8px",
  },
  saveButton: {
    padding: "6px 16px",
    backgroundColor: "#7ab87a",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  cancelButton: {
    padding: "6px 16px",
    backgroundColor: "#e0d9cf",
    color: "#3a2a1a",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  errorText: {
    color: "#c44",
    fontSize: "14px",
    marginTop: "4px",
  },
  sectionHeader: {
    fontFamily: "Georgia, serif",
    fontSize: "18px",
    color: "#3a2a1a",
    margin: "24px 0 12px",
    paddingBottom: "8px",
    borderBottom: "1px solid #e0d9cf",
  },
  interactionCard: {
    backgroundColor: "white",
    border: "1px solid #e0d9cf",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "8px",
  },
  interactionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  interactionDate: {
    fontSize: "14px",
    color: "#3a2a1a",
    fontWeight: 500,
  },
  interactionMeta: {
    display: "flex",
    gap: "8px",
  },
  interactionBadge: {
    fontSize: "12px",
    padding: "2px 8px",
    borderRadius: "4px",
    backgroundColor: "#f5f3ef",
    color: "#7a6a5a",
  },
  interactionLocation: {
    fontSize: "13px",
    color: "#7a6a5a",
    marginTop: "4px",
  },
  interactionParticipants: {
    fontSize: "13px",
    color: "#9a8a7a",
    marginTop: "4px",
  },
  noData: {
    color: "#9a8a7a",
    fontSize: "14px",
    fontStyle: "italic" as const,
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "60px 24px",
    color: "#7a6a5a",
    fontSize: "16px",
  },
};

const EDITABLE_FIELDS = [
  "name",
  "vibeTags",
  "baseCities",
  "favoritePlaces",
  "relationshipScore",
  "lastContactDate",
  "coreMemories",
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
  const [initialPersonId, setInitialPersonId] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) {
      setPerson(null);
      setError(null);
      return;
    }

    if (!initialPersonId) {
      setInitialPersonId(personId);
      setNavigateStack([]);
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

  // Load all persons once for name resolution
  useEffect(() => {
    fetch("/api/members/table")
      .then((r) => r.json())
      .then((data) => {
        setAllPersons((data.rows || []).sort((a: { relationshipScore: number }, b: { relationshipScore: number }) => b.relationshipScore - a.relationshipScore));
      })
      .catch(() => {});
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
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
      setEditValue(currentValue.join(", "));
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
      .catch(() => {
        setLoading(false);
      });
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
      .catch(() => {
        setLoading(false);
      });
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

      if (!res.ok) {
        throw new Error(data.error || "Failed to update");
      }

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
    if (e.key === "Enter") {
      saveEditing();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const handleSaveActionItem = async (interactionId: string, itemIndex: number) => {
    if (!person?.interactions) return;
    const ip = person.interactions.find(
      (ip) => ip.interaction.id === interactionId
    );
    if (!ip) return;
    const interaction = ip.interaction;
    if (!Array.isArray(interaction.actionItems)) return;

    const items = [...(interaction.actionItems as ActionItem[])];
    if (!items[itemIndex]) return;

    const newDescription = editingActionItemValue;

    // Optimistic update
    setPerson((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        interactions: prev.interactions.map((ip2) => {
          if (ip2.interaction.id !== interactionId) return ip2;
          const items2 = [...(ip2.interaction.actionItems as ActionItem[])];
          items2[itemIndex] = { ...items2[itemIndex], description: newDescription };
          return {
            ...ip2,
            interaction: { ...ip2.interaction, actionItems: items2 },
          };
        }),
      };
    });

    setEditingActionItemId(null);

    // Background sync
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
    const ip = person.interactions.find(
      (ip) => ip.interaction.id === interactionId
    );
    if (!ip) return;
    const interaction = ip.interaction;
    if (!Array.isArray(interaction.actionItems) || !interaction.actionItems[itemIndex]) return;

    const itemKey = `${interactionId}-${itemIndex}`;
    const newResolved = !interaction.actionItems[itemIndex].resolved;

    // Optimistic update: immediately update local state
    setPerson((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        interactions: prev.interactions.map((ip2) => {
          if (ip2.interaction.id !== interactionId) return ip2;
          const items = [...(ip2.interaction.actionItems as ActionItem[])];
          items[itemIndex] = { ...items[itemIndex], resolved: newResolved };
          return {
            ...ip2,
            interaction: { ...ip2.interaction, actionItems: items },
          };
        }),
      };
    });

    // Trigger animation
    setAnimatingItemKey(itemKey);
    setTimeout(() => setAnimatingItemKey(null), 500);

    // Background sync
    const items = [...(interaction.actionItems as ActionItem[])];
    items[itemIndex] = { ...items[itemIndex], resolved: newResolved };
    await fetch(`/api/interactions/${interactionId}/actionItems`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItems: items }),
    });
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getUnresolvedActionItemsCount = (): number => {
    if (!person?.interactions) return 0;
    let count = 0;
    for (const { interaction } of person.interactions) {
      if (Array.isArray(interaction.actionItems)) {
        count += interaction.actionItems.filter((item) => !item.resolved).length;
      }
    }
    return count;
  };

  const getOwnerColor = (ownedBy: string) => {
    if (ownedBy === "me") return { border: "#e53935", dot: "#e53935", label: "我欠" };
    if (ownedBy === "them") return { border: "#1e88e5", dot: "#1e88e5", label: "对方欠" };
    return { border: "#f57c00", dot: "#f57c00", label: "互欠" };
  };

  const renderActionItems = () => {
    if (!person?.interactions) return null;

    const allItems: Array<{ item: ActionItem; date: string; interactionId: string; itemIndex: number }> = [];

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
            <div style={{ fontWeight: 600, marginBottom: 8, color: "#c44" }}>待完成</div>
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
                    onClick={() => handleToggleResolved(entry.interactionId, entry.itemIndex)}
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
                      onChange={(e) => setEditingActionItemValue(e.target.value)}
                      onBlur={() => handleSaveActionItem(entry.interactionId, entry.itemIndex)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveActionItem(entry.interactionId, entry.itemIndex);
                        if (e.key === "Escape") setEditingActionItemId(null);
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        border: "1px solid #d4c9bb",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 13,
                        backgroundColor: "#fff",
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingActionItemId(itemKey);
                        setEditingActionItemValue(entry.item.description);
                      }}
                      style={{ flex: 1, fontSize: 13, cursor: "text", color: "#3a2a1a" }}
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
                      borderRadius: 4,
                    }}
                  >
                    {colors.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {resolved.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: "#4a4a4a" }}>已完成</div>
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
                    color: "#9a8a7a",
                  }}
                >
                  <button
                    onClick={() => handleToggleResolved(entry.interactionId, entry.itemIndex)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "#4caf50",
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </button>
                  <span style={{ flex: 1, textDecoration: "line-through" }}>
                    {entry.item.description}
                  </span>
                  <span style={{ fontSize: 11, color: colors.dot }}>{colors.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const getSortedInteractions = (): typeof person.interactions => {
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
      <div style={STYLES.overlay} onClick={handleOverlayClick}>
      <div style={STYLES.modal}>
        {/* Header */}
        <div style={STYLES.header}>
          <div style={STYLES.headerTop}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {navigateStack.length > 0 && (
                <button
                  onClick={handleGoBack}
                  style={{
                    background: "none",
                    border: "1px solid #d4c9bb",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 16,
                    color: "#7a6a5a",
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
              <h2 style={STYLES.name}>{person?.name ?? "加载中..."}</h2>
            </div>
            <button
              style={STYLES.closeButton}
              onClick={onClose}
              aria-label="关闭"
            >
              ×
            </button>
          </div>
          {person && (
            <div style={STYLES.scoreBar}>
              <div style={STYLES.scoreTrack}>
                <div
                  style={{
                    ...STYLES.scoreFill,
                    width: `${person.relationshipScore}%`,
                  }}
                />
              </div>
              <span style={STYLES.scoreText}>
                {person.relationshipScore}/100
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={STYLES.body}>
          {loading && <div style={STYLES.loading}>加载中...</div>}

          {error && <div style={{ ...STYLES.errorText, fontSize: "16px" }}>{error}</div>}

          {person && !loading && (
            <>
              {/* Name */}
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

              {/* Careers */}
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

              {/* Interests */}
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

              {/* Vibe Tags */}
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

              {/* Base Cities */}
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

              {/* Favorite Places */}
              <FieldCard
                label="常去地点"
                fieldKey="favoritePlaces"
                value={(person.favoritePlaces ?? []).join(", ") || "—"}
                editingField={editingField}
                editValue={editValue}
                onStartEdit={() => startEditing("favoritePlaces", person.favoritePlaces)}
                onEditChange={setEditValue}
                onKeyDown={handleInputKeyDown}
                onSave={saveEditing}
                onCancel={cancelEditing}
                saving={saving}
                saveError={saveError}
              />

              {/* Relationship Score */}
              <FieldCard
                label="关系评分"
                fieldKey="relationshipScore"
                value={`${person.relationshipScore}/100`}
                editingField={editingField}
                editValue={editValue}
                onStartEdit={() => startEditing("relationshipScore", person.relationshipScore)}
                onEditChange={setEditValue}
                onKeyDown={handleInputKeyDown}
                onSave={saveEditing}
                onCancel={cancelEditing}
                saving={saving}
                saveError={saveError}
                isNumber
              />

              {/* Last Contact Date */}
              <FieldCard
                label="最近联系"
                fieldKey="lastContactDate"
                value={
                  person.lastContactDate
                    ? `${renderRelativeDate(new Date(person.lastContactDate))} · ${formatDate(person.lastContactDate)}`
                    : "—"
                }
                editingField={editingField}
                editValue={editValue}
                onStartEdit={() => startEditing("lastContactDate", person.lastContactDate)}
                onEditChange={setEditValue}
                onKeyDown={handleInputKeyDown}
                onSave={saveEditing}
                onCancel={cancelEditing}
                saving={saving}
                saveError={saveError}
                isDate
              />

              {/* Introduced By */}
              <div style={{ ...STYLES.fieldCard, position: "relative" }}>
                <div style={STYLES.fieldLabel}>介绍人</div>
                <MultiIntroducerSelector
                  values={person.introducedByIds ?? []}
                  currentPersonId={person.id}
                  allPersons={allPersons}
                  onNavigate={handleNavigateToPerson}
                  onChange={async (newIds) => {
                    setPerson((prev) =>
                      prev ? { ...prev, introducedByIds: newIds } : prev
                    );
                    await fetch(`/api/members/${person.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ field: "introducedByIds", value: newIds }),
                    });
                  }}
                />
              </div>

              {/* Core Memories */}
              <FieldCard
                label="核心记忆"
                fieldKey="coreMemories"
                value={(person.coreMemories ?? []).join(", ") || "—"}
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
              <div style={STYLES.fieldCard}>
                <div style={STYLES.fieldLabel}>待办行动项</div>
                {renderActionItems()}
              </div>

              {/* Interaction History */}
              <h3 style={STYLES.sectionHeader}>互动历史</h3>
              {getSortedInteractions().length === 0 ? (
                <div style={STYLES.noData}>暂无互动记录</div>
              ) : (
                getSortedInteractions()
                  .slice(0, 10)
                  .map((item, idx) => {
                    const { interaction } = item;
                    const otherParticipants = interaction.persons?.filter(
                      (p) => p.person.id !== person.id
                    );

                    return (
                      <div key={idx} style={STYLES.interactionCard}>
                        <div style={STYLES.interactionHeader}>
                          <span style={STYLES.interactionDate}>
                            {formatDate(interaction.date)}
                          </span>
                          <div style={STYLES.interactionMeta}>
                            <span style={STYLES.interactionBadge}>
                              {interaction.contextType}
                            </span>
                            <span style={STYLES.interactionBadge}>
                              {interaction.sentiment}
                            </span>
                          </div>
                        </div>
                        {interaction.location && (
                          <div style={STYLES.interactionLocation}>
                            📍 {interaction.location}
                          </div>
                        )}
                        {otherParticipants && otherParticipants.length > 0 && (
                          <div style={STYLES.interactionParticipants}>
                            👥 {otherParticipants.map((p) => p.person.name).join(", ")}
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

type FieldCardProps = {
  label: string;
  fieldKey: string;
  value: string;
  editingField: string | null;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
  isArray?: boolean;
  isNumber?: boolean;
  isDate?: boolean;
};

function FieldCard({
  label,
  fieldKey,
  value,
  editingField,
  editValue,
  onStartEdit,
  onEditChange,
  onKeyDown,
  onSave,
  onCancel,
  saving,
  saveError,
  isArray,
  isNumber,
  isDate,
}: FieldCardProps) {
  const isEditing = editingField === fieldKey;

  const inputType = isNumber ? "number" : isDate ? "date" : "text";
  const inputValue = isNumber
    ? editValue
    : isDate
    ? editValue
      ? editValue.split(" · ")[0].trim()
      : ""
    : editValue;

  return (
    <div style={STYLES.fieldCard}>
      <div style={STYLES.fieldLabel}>{label}</div>
      {isEditing ? (
        <>
          <input
            type={inputType}
            style={STYLES.fieldInput}
            value={inputValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            min={isNumber ? 0 : undefined}
            max={isNumber ? 100 : undefined}
          />
          {isDate && value && (
            <div style={{ fontSize: "12px", color: "#9a8a7a", marginTop: "4px" }}>
              当前: {value}
            </div>
          )}
          <div style={STYLES.editButtons}>
            <button
              style={STYLES.saveButton}
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button style={STYLES.cancelButton} onClick={onCancel}>
              取消
            </button>
          </div>
          {saveError && <div style={STYLES.errorText}>{saveError}</div>}
        </>
      ) : (
        <div style={STYLES.fieldValue} onClick={onStartEdit} title="点击编辑">
          {value || "—"}
        </div>
      )}
    </div>
  );
}