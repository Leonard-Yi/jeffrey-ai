/**
 * Jeffrey.AI — Copy & Voice System
 *
 * Voice principles:
 * - Natural Chinese, not translated feel
 * - Observant about human nature, not preachy
 * - Dry wit, not snarky
 * - Warm underneath, not cold
 * - Concise, not wordy
 * - Varied tone: sometimes gentle, sometimes teasing, never mean
 *
 * Usage contexts:
 * - Landing: confident, inviting, hints at the wit
 * - Input prompt: casual nudge, never interrogative
 * - Analysis result: insightful, concise observation
 * - Follow-up question: genuinely curious, not bureaucratic
 * - Error: direct but not harsh
 * - Empty states: gently encouraging
 */

export interface JeffreyQuote {
  text: string;
  /** Mood: 'dry' | 'warm' | 'observant' | 'gentle' */
  mood?: string;
  author?: string;
}

// ── Landing page quotes ─────────────────────────────────────────
export const jeffreyQuotes: JeffreyQuote[] = [
  { text: "人脉广是好事。但有些人记都记不住，那不叫人脉，叫路人。", mood: "observant" },
  { text: "关系这东西，不打理就会悄悄贬值。", mood: "observant" },
  { text: "你说的话我都记着。这是管家该做的事。", mood: "warm" },
  { text: "有些名字，值得被记住。有些约定，值得被兑现。", mood: "gentle" },
  { text: "别担心，你那些零散的关系，我来帮你理清楚。", mood: "warm" },
  { text: "社交不难。难的是记得谁是谁、谁欠谁、谁重要。", mood: "observant" },
  { text: "记录本身就是一种尊重。", mood: "gentle" },
];

// ── Input page prompting quotes ────────────────────────────────
// These appear in the greeting card on the input page
// Different moods to keep it fresh
export const jeffreyInputQuotes: string[] = [
  // Casual, inviting
  "今天见了谁？",
  "有什么值得记下来的吗？",
  "随便说说，我帮你整理。",

  // Observant, gentle nudge
  "上次见面是什么时候来着？该更新一下了。",
  "你上次提到的那个人，最近有联系吗？",
  "有些名字你是不是快忘了？",

  // Dry wit
  "别说'就聊了几句'——这种话我最讨厌记。",
  "放心，我不会告诉你你忘了谁的生日。",
  "你说话，我记录。各司其职。",

  // Warm, supportive
  "重要的不是见了谁，而是记得为什么见。",
  "关系需要经营。第一步是先记下来。",
  "慢慢来，不着急。我帮你一件件理清楚。",

  // Teasing (but never mean)
  "又去社交了？还是只是打了个招呼？",
  "让我猜猜——这次又'改天约'了？",
];

export function getJeffreyQuote(): JeffreyQuote {
  return jeffreyQuotes[Math.floor(Math.random() * jeffreyQuotes.length)];
}

export function getRandomInputQuote(): string {
  return jeffreyInputQuotes[Math.floor(Math.random() * jeffreyInputQuotes.length)];
}

// ── UI copy helpers ────────────────────────────────────────────
// Centralized UI text to ensure consistency
export const ui = {
  // Navigation
  nav: {
    input: "录入",
    graph: "图谱",
    suggestions: "建议",
    members: "人脉",
  },

  // Actions
  actions: {
    submit: "提交",
    cancel: "取消",
    save: "保存",
    delete: "删除",
    edit: "编辑",
    merge: "合并",
    confirm: "确认",
    close: "关闭",
    retry: "重试",
    clear: "清空",
    search: "搜索",
    refresh: "刷新",
    send: "发送",
  },

  // Empty states
  empty: {
    noContacts: "还没有联系人",
    noContactsHint: "去录入页面聊聊你最近见的人",
    noResults: "没找到匹配的",
    noResultsHint: "试试其他关键词",
    noData: "暂无数据",
    noDataHint: "先录入一些信息吧",
  },

  // Status
  status: {
    loading: "加载中...",
    saving: "保存中...",
    processing: "处理中...",
    complete: "已完成",
    error: "出错了",
  },

  // Labels
  labels: {
    recentEntries: "最近录入",
    extractedPersons: "已提取人物",
    socialDebts: "待办事项",
    jeffreyComment: "Jeffrey 说",
    followUpQuestion: "Jeffrey 的问题",
    conversationHistory: "对话记录",
    yourReply: "你的回复",
  },

  // Form placeholders
  placeholders: {
    searchContacts: "搜索人脉...",
    inputHint: "今天见了谁？聊了什么？有什么新动态？",
    replyHint: "输入你的回复...",
    filterCareer: "按职业筛选...",
    filterCity: "按城市筛选...",
  },

  // Error messages
  errors: {
    generic: "出了点问题，请稍后再试。",
    network: "网络不给力，检查一下？",
    notFound: "找不到这个",
    unauthorized: "需要先登录",
  },

  // Tooltips
  tooltips: {
    relationshipScore: "关系热度：综合互动频率、承诺兑现等计算",
    lastContact: "最后一次互动距今多久",
    actionItems: "待兑现的承诺",
  },
} as const;
