"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import AmbiguousPrompt from '@/components/AmbiguousPrompt';
import NameResolutionPrompt from '@/components/NameResolutionPrompt';
import { tokens as C } from '@/lib/design-tokens';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getRandomInputQuote } from '@/lib/jeffrey-quotes';

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

interface Person {
  name: string;
  careers: Array<{ name: string; weight: number }>;
  interests: Array<{ name: string; weight: number }>;
  vibeTags: string[];
  ambiguous?: boolean;
  ambiguousWith?: string[];
}

interface ActionItem {
  description: string;
  ownedBy: 'me' | 'them' | 'both';
  resolved: boolean;
}

interface ExtractionResponse {
  status: 'complete' | 'pending' | 'ambiguous';
  jeffreyComment: string;
  persons: Person[];
  personIds: string[];
  followUpQuestion?: string;
  actionItems: ActionItem[];
  ambiguousPersons?: Person[];
}

interface RecentEntry {
  id: string;
  text: string;
  timestamp: string;
  status: 'complete' | 'pending';
  relativeTime: string;
}

interface ChatMessage {
  role: 'user' | 'jeffrey';
  content: string;
  timestamp: string;
}

// ─── Jeffrey Avatar ──────────────────────────────────────────
function JeffreyAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#fff',
        border: `1.5px solid ${C.borderStrong}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: size * 0.42,
          color: C.primary,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        J
      </span>
    </div>
  );
}

// ─── Tag Pill ───────────────────────────────────────────────
function TagPill({
  label,
  type,
  weight,
}: {
  label: string;
  type: 'career' | 'interest' | 'vibe';
  weight?: number;
}) {
  const colors = {
    career: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
    interest: { bg: '#fef3c7', text: C.primary, border: '#fde68a' },
    vibe: { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  }[type];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        lineHeight: 1.4,
      }}
    >
      {label}
      {weight != null && (
        <span style={{ opacity: 0.65, fontSize: 11 }}>{Math.round(weight * 100)}%</span>
      )}
    </span>
  );
}

// ─── Status Dot ──────────────────────────────────────────────
function StatusDot({ complete }: { complete: boolean }) {
  return (
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        backgroundColor: complete ? C.success : C.accent,
        flexShrink: 0,
      }}
    />
  );
}

const JeffreyInputPage = () => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jeffreyComment, setJeffreyComment] = useState('');
  const [persons, setPersons] = useState<Person[]>([]);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [status, setStatus] = useState<'complete' | 'pending' | 'ambiguous' | null>(null);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [selectedQuickReply, setSelectedQuickReply] = useState<string | null>(null);
  const [customReply, setCustomReply] = useState('');
  const [originalInputText, setOriginalInputText] = useState('');
  const [existingPersons, setExistingPersons] = useState<Array<{ id: string; name: string; careers: Array<{ name: string }> }>>([]);
  const [ambiguousPersons, setAmbiguousPersons] = useState<Person[]>([]);
  const [showResolutionPrompt, setShowResolutionPrompt] = useState(false);
  const [nameResolutions, setNameResolutions] = useState<Array<{ mentionedName: string; candidates: Array<{ id: string; name: string; similarity: number; matchType: 'exact' | 'embedding'; careers: unknown[] }> }>>([]);
  const [pendingText, setPendingText] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [dialogueComplete, setDialogueComplete] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [randomQuote] = useState(() => getRandomInputQuote());

  useEffect(() => {
    const saved = localStorage.getItem('jeffrey_recent_entries');
    if (saved) {
      try { setRecentEntries(JSON.parse(saved)); } catch (_) {}
    }
    fetch('/api/members/table')
      .then(r => r.json())
      .then(d => setExistingPersons(d.rows || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'zh-CN';
    recognitionRef.current.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInputText(p => p + (p ? ' ' : '') + t);
    };
    recognitionRef.current.onerror = () => setIsRecording(false);
    recognitionRef.current.onend = () => { if (isRecording) setIsRecording(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecordToggle = () => {
    if (!recognitionRef.current) { alert('语音识别不可用，请使用最新版 Chrome'); return; }
    if (isRecording) { recognitionRef.current.stop(); setIsRecording(false); }
    else { recognitionRef.current.start(); setIsRecording(true); }
  };

  const applyNameResolutions = (text: string, resolved: Map<string, string>) => {
    let r = text;
    for (const [orig, matched] of resolved) {
      if (orig !== matched) r = r.replace(new RegExp(orig, 'g'), matched);
    }
    return r;
  };

  const handleResolutionConfirm = async (resolved: Map<string, string>) => {
    setShowResolutionPrompt(false);
    const resolvedText = applyNameResolutions(pendingText, resolved);
    setInputText(resolvedText);
    setOriginalInputText(resolvedText);
    setIsProcessing(true);
    try {
      const data: ExtractionResponse = await (await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ text: resolvedText }),
      })).json();
      setJeffreyComment(data.jeffreyComment);
      setPersons(data.persons);
      setPersonIds(data.personIds || []);
      setFollowUpQuestion(data.followUpQuestion || '');
      setActionItems(data.actionItems);
      setStatus(data.status);
      setAmbiguousPersons(data.ambiguousPersons || []);
      if (data.status === 'complete') {
        const entry: RecentEntry = { id: Date.now().toString(), text: resolvedText.slice(0, 60) + (resolvedText.length > 60 ? '...' : ''), timestamp: new Date().toLocaleString(), status: data.status, relativeTime: '刚刚' };
        const updated = [entry, ...recentEntries.slice(0, 4)];
        setRecentEntries(updated);
        localStorage.setItem('jeffrey_recent_entries', JSON.stringify(updated));
        setDialogueComplete(true);
      } else if (data.status === 'pending' && data.followUpQuestion) {
        setConversationHistory([{ role: 'jeffrey', content: data.followUpQuestion, timestamp: new Date().toLocaleString('zh-CN') }]);
        setDialogueComplete(false);
      }
    } finally { setIsProcessing(false); }
  };

  const handleResolutionSkip = () => {
    setShowResolutionPrompt(false);
    handleSubmitWithText(pendingText, false);
  };

  const handleSubmitWithText = async (textToSubmit: string, isFollowUp = false) => {
    if (!textToSubmit.trim()) return;
    try {
      setIsProcessing(true);
      const userMsg: ChatMessage = { role: 'user', content: textToSubmit, timestamp: new Date().toLocaleString('zh-CN') };
      if (isFollowUp) setConversationHistory(p => [...p, userMsg]);
      const data: ExtractionResponse = await (await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ text: textToSubmit }),
      })).json();
      setJeffreyComment(data.jeffreyComment);
      setPersons(data.persons);
      setPersonIds(data.personIds || []);
      setFollowUpQuestion(data.followUpQuestion || '');
      setActionItems(data.actionItems);
      setStatus(data.status);
      setAmbiguousPersons(data.ambiguousPersons || []);
      if (data.status === 'complete') {
        const jeffreyMsg: ChatMessage = { role: 'jeffrey', content: data.jeffreyComment || '信息已保存。', timestamp: new Date().toLocaleString('zh-CN') };
        setConversationHistory(p => [...p, jeffreyMsg]);
        if (!isFollowUp) {
          const entry: RecentEntry = { id: Date.now().toString(), text: textToSubmit.slice(0, 60) + (textToSubmit.length > 60 ? '...' : ''), timestamp: new Date().toLocaleString(), status: data.status, relativeTime: '刚刚' };
          const updated = [entry, ...recentEntries.slice(0, 4)];
          setRecentEntries(updated);
          localStorage.setItem('jeffrey_recent_entries', JSON.stringify(updated));
          setDialogueComplete(true);
        } else { setDialogueComplete(true); }
      } else if (data.status === 'pending' && data.followUpQuestion) {
        setConversationHistory(p => [...p, { role: 'jeffrey', content: data.followUpQuestion, timestamp: new Date().toLocaleString('zh-CN') }]);
        setDialogueComplete(false);
      }
    } finally { setIsProcessing(false); }
  };

  const handleSubmit = async (followUpReply?: string) => {
    const base = originalInputText || inputText;
    const textToSubmit = followUpReply ? `${base}\n\n追问回复：${followUpReply}` : inputText;
    if (!textToSubmit.trim()) return;
    try {
      setIsProcessing(true);
      if (!followUpReply) setOriginalInputText(inputText);
      if (!followUpReply) {
        const r = await fetch('/api/persons/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: textToSubmit }) });
        if (r.ok) {
          const d = await r.json();
          if (d.resolutions?.length > 0) {
            setNameResolutions(d.resolutions);
            setPendingText(textToSubmit);
            setShowResolutionPrompt(true);
            setIsProcessing(false);
            return;
          }
        }
      }
      await handleSubmitWithText(textToSubmit, !!followUpReply);
      if (followUpReply) { setSelectedQuickReply(null); setCustomReply(''); setInputText(''); }
    } catch {} finally { if (!showResolutionPrompt) setIsProcessing(false); }
  };

  const handleClear = () => {
    setInputText(''); setOriginalInputText(''); setJeffreyComment(''); setPersons([]); setPersonIds([]);
    setFollowUpQuestion(''); setActionItems([]); setStatus(null); setSelectedQuickReply(null); setCustomReply('');
    setAmbiguousPersons([]); setShowResolutionPrompt(false); setNameResolutions([]); setPendingText('');
    setConversationHistory([]); setDialogueComplete(false); setIsProcessing(false);
  };

  // Icebreaker pre-gen timer
  const icebreakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (personIds.length === 0 || status !== 'complete') return;
    if (icebreakerTimerRef.current) clearTimeout(icebreakerTimerRef.current);
    icebreakerTimerRef.current = setTimeout(async () => {
      for (const pid of personIds) {
        try { await fetch(`/api/persons/${pid}/icebreaker`, { method: 'POST' }); } catch (_) {}
      }
    }, 3 * 60 * 1000);
    return () => { if (icebreakerTimerRef.current) clearTimeout(icebreakerTimerRef.current); };
  }, [personIds, status]);

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse 60% 40% at 10% 0%, rgba(217, 119, 6, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse 50% 35% at 90% 100%, rgba(146, 64, 14, 0.06) 0%, transparent 50%),
        #f5f3ef
      `,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Noise texture */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.025'/%3E%3C/svg%3E")`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
      <Header />

      <main
        style={{
          display: 'flex',
          gap: 16,
          padding: '16px 20px',
          maxWidth: 1520,
          margin: '0 auto',
        }}
      >
        {/* ── LEFT COLUMN ── */}
        <div style={{ width: '42%', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Greeting */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <JeffreyAvatar size={44} />
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontStyle: 'italic',
                  color: C.textSecondary,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {randomQuote}
              </p>
            </div>
          </Card>

          {/* Text Input */}
          <Card>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="今天见了谁？聊了什么？有什么新的发现或约定吗？"
              style={{
                width: '100%',
                height: 160,
                resize: 'none',
                border: 'none',
                outline: 'none',
                fontSize: 15,
                color: C.text,
                lineHeight: 1.7,
                backgroundColor: 'transparent',
                fontFamily: 'inherit',
              }}
            />
          </Card>

          {/* Voice */}
          <Card>
            <button
              onClick={handleRecordToggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: isRecording ? `2px solid ${C.accent}` : '2px solid transparent',
                backgroundColor: isRecording ? C.accentLight : '#fafaf9',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: isRecording ? C.accentLight : '#fff',
                  border: `1.5px solid ${isRecording ? C.accent : '#e7e5e4'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isRecording ? C.accent : 'none'} stroke={isRecording ? C.accent : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 14, color: isRecording ? C.primary : C.textSecondary, margin: 0, fontWeight: 500 }}>
                  {isRecording ? '正在录音中...' : '语音录入'}
                </p>
                <p style={{ fontSize: 12, color: C.textMuted, margin: '2px 0 0', lineHeight: 1.4 }}>
                  {isRecording ? '点击按钮结束录音' : '点击开始，说完再点击结束'}
                </p>
              </div>
            </button>
          </Card>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleClear}
              disabled={isProcessing || (!inputText && !jeffreyComment)}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: `1.5px solid ${C.borderStrong}`,
                backgroundColor: '#fff',
                color: C.textSecondary,
                fontSize: 14,
                fontWeight: 500,
                cursor: (isProcessing || (!inputText && !jeffreyComment)) ? 'not-allowed' : 'pointer',
                opacity: (isProcessing || (!inputText && !jeffreyComment)) ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              清空
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={!inputText.trim() || isProcessing}
              style={{
                flex: 2,
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                backgroundColor: !inputText.trim() || isProcessing ? '#d6d3d1' : C.primary,
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: (!inputText.trim() || isProcessing) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {isProcessing ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  Jeffrey 思考中...
                </>
              ) : '汇报给 Jeffrey'}
            </button>
          </div>

          {/* Recent Entries */}
          <Card>
            <SectionLabel>最近录入</SectionLabel>
            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentEntries.length === 0 ? (
                <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>暂无历史记录</p>
              ) : recentEntries.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'default',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.surfaceAlt)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <StatusDot complete={entry.status === 'complete'} />
                  <span style={{ flex: 1, fontSize: 13.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.text}</span>
                  <span style={{ fontSize: 11.5, color: C.textMuted, flexShrink: 0 }}>{entry.relativeTime}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ width: '58%', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Jeffrey's Comment */}
          {jeffreyComment && (
            <Card style={{ background: '#fffcf7', border: `1px solid #fde68a` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <JeffreyAvatar size={32} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.primary, letterSpacing: '0.01em' }}>Jeffrey 的点评</span>
              </div>
              <p style={{ fontSize: 14.5, color: C.text, lineHeight: 1.75, margin: 0, fontFamily: 'var(--font-display)' }}>{jeffreyComment}</p>
            </Card>
          )}

          {/* Conversation History */}
          {conversationHistory.length > 0 && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <SectionLabel>对话记录</SectionLabel>
                {dialogueComplete && (
                  <span style={{ fontSize: 12, color: C.success, fontWeight: 500 }}>✓ 对话已完成</span>
                )}
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {conversationHistory.map((msg, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        maxWidth: '82%',
                        borderRadius: 12,
                        padding: '10px 14px',
                        backgroundColor: msg.role === 'user' ? '#fff' : '#f5f5f4',
                        border: msg.role === 'user' ? `1px solid ${C.border}` : '1px solid #e7e5e4',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: msg.role === 'user' ? C.primary : C.textMuted }}>
                          {msg.role === 'user' ? '你' : 'Jeffrey'}
                        </span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{msg.timestamp}</span>
                      </div>
                      <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Extracted Persons */}
          {persons.length > 0 && (
            <Card>
              <SectionLabel>已提取人物</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {persons.map((person, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      padding: 14,
                      backgroundColor: C.surfaceAlt,
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <JeffreyAvatar size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>{person.name}</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {person.careers.map((c, i) => <TagPill key={i} label={c.name} type="career" weight={c.weight} />)}
                        {person.interests.map((i, idx) => <TagPill key={idx} label={i.name} type="interest" weight={i.weight} />)}
                        {person.vibeTags.map((v, idx) => <TagPill key={idx} label={v} type="vibe" />)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Name Resolution Prompt */}
          {showResolutionPrompt && nameResolutions.length > 0 && (
            <NameResolutionPrompt
              resolutions={nameResolutions}
              allPersons={existingPersons}
              onConfirm={handleResolutionConfirm}
              onSkip={handleResolutionSkip}
            />
          )}

          {/* Ambiguous */}
          {status === 'ambiguous' && ambiguousPersons.length > 0 && (
            <AmbiguousPrompt
              ambiguousPersons={ambiguousPersons as Array<{ name: string; ambiguousWith: string[]; careers: Array<{ name: string; weight: number }>; interests: Array<{ name: string; weight: number }>; vibeTags: string[] }>}
              existingPersons={existingPersons}
              onConfirmMerge={async (name, existingId, ambiguousName) => {
                setAmbiguousPersons([]); setStatus(null);
                await handleSubmit(`是的，${name}就是之前录入的${ambiguousName}，请合并。`);
              }}
              onCreateNew={name => {
                setAmbiguousPersons([]); setStatus(null);
                handleSubmit(`用户确认：${name}不是之前录入的同一人，是新创建的条目。`);
              }}
            />
          )}

          {/* Follow-up Question */}
          {status === 'pending' && followUpQuestion && !dialogueComplete && (
            <Card>
              <SectionLabel>Jeffrey 的追问</SectionLabel>
              <p style={{ fontSize: 14.5, color: C.textSecondary, fontStyle: 'italic', marginBottom: 16, lineHeight: 1.7 }}>
                &ldquo;{followUpQuestion}&rdquo;
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {['不太清楚', '他做并购', customReply || '自定义回复'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => { if (opt === '自定义回复') { setCustomReply(''); } else { setSelectedQuickReply(opt); setCustomReply(''); } }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      border: `1.5px solid ${(selectedQuickReply === opt || (opt === '自定义回复' && customReply)) ? C.accent : C.borderStrong}`,
                      backgroundColor: (selectedQuickReply === opt || (opt === '自定义回复' && customReply)) ? C.accentLight : '#fff',
                      color: (selectedQuickReply === opt || (opt === '自定义回复' && customReply)) ? C.primary : C.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customReply}
                onChange={e => { setCustomReply(e.target.value); setSelectedQuickReply('自定义回复'); }}
                placeholder="输入自定义回复..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: `1.5px solid ${C.borderStrong}`,
                  fontSize: 14,
                  color: C.text,
                  outline: 'none',
                  marginBottom: 12,
                  boxSizing: 'border-box',
                  transition: 'border-color 0.12s',
                }}
                onFocus={e => (e.target.style.borderColor = C.accent)}
                onBlur={e => (e.target.style.borderColor = C.borderStrong)}
              />
              <button
                onClick={() => {
                  const reply = (customReply && customReply.trim()) ? customReply : (selectedQuickReply || '');
                  if (!reply) { alert('请输入回复内容或选择快捷回复'); return; }
                  handleSubmit(reply);
                }}
                disabled={(!selectedQuickReply && !customReply) || isProcessing}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: (!selectedQuickReply && !customReply) || isProcessing ? '#d6d3d1' : C.primary,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: (!selectedQuickReply && !customReply) || isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {isProcessing ? '发送中...' : '发送回复'}
              </button>
            </Card>
          )}

          {/* Social Debts */}
          {actionItems.length > 0 && (
            <Card>
              <SectionLabel>社交债务</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {actionItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      backgroundColor: C.surfaceAlt,
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 100,
                        fontSize: 11.5,
                        fontWeight: 600,
                        backgroundColor: item.ownedBy === 'me' ? '#fee2e2' : item.ownedBy === 'them' ? '#dcfce7' : '#fef3c7',
                        color: item.ownedBy === 'me' ? '#dc2626' : item.ownedBy === 'them' ? '#16a34a' : C.primary,
                        border: `1px solid ${item.ownedBy === 'me' ? '#fca5a5' : item.ownedBy === 'them' ? '#bbf7d0' : '#fde68a'}`,
                        flexShrink: 0,
                      }}
                    >
                      {item.ownedBy === 'me' ? '我欠' : item.ownedBy === 'them' ? '他欠' : '双方'}
                    </span>
                    <span style={{ fontSize: 13.5, color: C.text }}>{item.description}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </main>
      </div>
    </div>
  );
};

export default JeffreyInputPage;
