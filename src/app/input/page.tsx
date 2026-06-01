"use client";

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import AmbiguousPrompt from '@/components/AmbiguousPrompt';
import NameResolutionPrompt from '@/components/NameResolutionPrompt';
import { tokens as C } from '@/lib/design-tokens';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getRandomInputQuote } from '@/lib/jeffrey-quotes';
import { parseSSEStream } from '@/lib/sse-utils';
import RoundPrompt from '@/components/RoundPrompt';
import ExtractionPreview from '@/components/ExtractionPreview';
import AnalysisProgress, { type ProgressStep } from '@/components/AnalysisProgress';

// ─── Types ────────────────────────────────────

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

interface MissingField {
  field: string;
  priority: 'high' | 'mid' | 'low';
  question: string;
}

interface ExtractionResponse {
  status: 'complete' | 'pending' | 'ambiguous';
  jeffreyComment: string;
  persons: Person[];
  personIds: string[];
  followUpQuestion?: string;
  missingFields: MissingField[];
  date: string | null;
  sentiment: string | null;
  actionItems: ActionItem[];
  ambiguousPersons?: Person[];
}

type Phase = 'input' | 'analyzing' | 'followup' | 'result';

// ─── Jeffrey Avatar ────────────────────────────
function JeffreyAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: C.bgElevated, border: `1.5px solid ${C.borderStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, boxShadow: C.shadowSm,
      }}
    >
      <span style={{ fontFamily: C.fontDisplay, fontSize: size * 0.42, color: C.primary, fontWeight: 600, lineHeight: 1 }}>
        J
      </span>
    </div>
  );
}

// ─── Page Component ────────────────────────────

const JeffreyInputPage = () => {
  const { data: session } = useSession();
  const [randomQuote] = useState(() => getRandomInputQuote());

  // ── Core state ──
  const [phase, setPhase] = useState<Phase>('input');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // ── Analysis state ──
  const [analysisSteps, setAnalysisSteps] = useState<ProgressStep[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Follow-up state ──
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundAnswers, setRoundAnswers] = useState<Record<string, string | null>>({});
  const [roundHistory, setRoundHistory] = useState<Array<{ field: string; answer: string | null }>>([]);
  const [extractedDate, setExtractedDate] = useState<string | null>(null);
  const [extractedSentiment, setExtractedSentiment] = useState<string | null>(null);

  // ── Result state ──
  const [jeffreyComment, setJeffreyComment] = useState('');
  const [persons, setPersons] = useState<Person[]>([]);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [resultStatus, setResultStatus] = useState<'complete' | 'pending' | 'ambiguous' | null>(null);

  // ── Ambiguous / Resolution state ──
  const [ambiguousPersons, setAmbiguousPersons] = useState<Person[]>([]);
  const [showResolutionPrompt, setShowResolutionPrompt] = useState(false);
  const [nameResolutions, setNameResolutions] = useState<Array<{ mentionedName: string; candidates: Array<{ id: string; name: string; similarity: number; matchType: 'exact' | 'embedding'; careers: unknown[] }> }>>([]);
  const [pendingText, setPendingText] = useState('');
  const [originalInputText, setOriginalInputText] = useState('');
  const [existingPersons, setExistingPersons] = useState<Array<{ id: string; name: string; careers: Array<{ name: string }> }>>([]);

  // ── Voice init ──
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

  // ── Load existing persons ──
  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/members/table')
      .then(r => r.json())
      .then(d => setExistingPersons(d.rows || []))
      .catch(() => {});
  }, [session]);

  // ── Icebreaker pre-gen ──
  const icebreakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (personIds.length === 0 || resultStatus !== 'complete') return;
    if (icebreakerTimerRef.current) clearTimeout(icebreakerTimerRef.current);
    icebreakerTimerRef.current = setTimeout(async () => {
      for (const pid of personIds) {
        try { await fetch(`/api/persons/${pid}/icebreaker`, { method: 'POST' }); } catch (_) {}
      }
    }, 3 * 60 * 1000);
    return () => { if (icebreakerTimerRef.current) clearTimeout(icebreakerTimerRef.current); };
  }, [personIds, resultStatus]);

  // ──────────────────────────────────────────────
  // SSE: Fetch and consume analysis stream
  // ──────────────────────────────────────────────
  const fetchSSEAnalyze = async (textToSubmit: string): Promise<ExtractionResponse> => {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ text: textToSubmit }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText.slice(0, 100)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    try {
      for await (const event of parseSSEStream(reader)) {
        switch (event.type) {
          case 'progress':
            setAnalysisSteps(prev => {
              const existing = prev.find(s => s.title === event.message);
              if (existing) {
                return prev.map(s =>
                  s.title === event.message ? { ...s, status: 'done' as const } : s
                );
              }
              const updated = prev.map(s => ({ ...s, status: 'done' as const }));
              return [...updated, {
                icon: event.step === 'parsing' ? '🔍' : event.step === 'extracting' ? '🧠' : event.step === 'quality_check' ? '⚠️' : '📋',
                title: event.message,
                detail: event.detail,
                status: 'active' as const,
              }];
            });
            break;
          case 'result':
            return event.data as unknown as ExtractionResponse;
          case 'error':
            throw new Error(event.message);
        }
      }
      throw new Error('Stream ended without result event');
    } finally {
      reader.releaseLock();
    }
  };

  // ──────────────────────────────────────────────
  // Submit: input → analyze → followup | result
  // ──────────────────────────────────────────────
  const handleSubmitWithText = async (textToSubmit: string, isFollowUp = false) => {
    if (!textToSubmit.trim()) return;
    setIsProcessing(true);
    setErrorMessage('');
    setAnalysisSteps([]);

    if (!isFollowUp) {
      setPhase('analyzing');
    }

    try {
      const data = await fetchSSEAnalyze(textToSubmit);

      // Populate result state
      setJeffreyComment(data.jeffreyComment);
      setPersons(data.persons);
      setPersonIds(data.personIds || []);
      setActionItems(data.actionItems);
      setResultStatus(data.status);
      setAmbiguousPersons(data.ambiguousPersons || []);
      setMissingFields(data.missingFields || []);
      setExtractedDate(data.date || null);
      setExtractedSentiment(data.sentiment || null);

      if (data.missingFields && data.missingFields.length > 0) {
        setCurrentRound(0);
        setRoundAnswers({});
        setRoundHistory([]);
      }

      if (isFollowUp) {
        // After collecting follow-up answers, always go to result.
        // Never loop back to followup — one round of questions is enough.
        setPhase('result');
      } else if (data.status === 'complete') {
        setPhase('result');
      } else if (data.status === 'pending' && data.missingFields && data.missingFields.length > 0) {
        setPhase('followup');
      } else if (data.status === 'ambiguous') {
        setPhase('result');
      } else {
        setPhase('result');
      }
    } catch (err) {
      setPhase('input');
      if (err instanceof Error) {
        if (err.message.includes('API error')) {
          setErrorMessage(err.message);
        } else if (err.message.includes('not readable') || err.message.includes('NetworkError')) {
          setErrorMessage('网络连接失败，请检查网络后重试');
        } else {
          setErrorMessage(`分析失败：${err.message}`);
        }
      } else {
        setErrorMessage('分析失败，请重试');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // ──────────────────────────────────────────────
  // Entry point: check name resolution first
  // ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!inputText.trim()) return;
    setOriginalInputText(inputText);

    try {
      const r = await fetch('/api/persons/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.resolutions?.some((r: { candidates: unknown[] }) => r.candidates?.length > 0)) {
          setNameResolutions(d.resolutions);
          setPendingText(inputText);
          setShowResolutionPrompt(true);
          return;
        }
      }
    } catch {}

    await handleSubmitWithText(inputText);
  };

  // ──────────────────────────────────────────────
  // Name resolution callbacks
  // ──────────────────────────────────────────────
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
    await handleSubmitWithText(resolvedText);
  };

  const handleResolutionSkip = () => {
    setShowResolutionPrompt(false);
    handleSubmitWithText(pendingText);
  };

  // ──────────────────────────────────────────────
  // Follow-up round handlers
  // ──────────────────────────────────────────────
  const getExtractedPreview = (): Array<{ label: string; value: string }> => {
    const previews: Array<{ label: string; value: string }> = [];
    if (persons.length > 0) {
      const p = persons[0];
      if (p.careers.length > 0) previews.push({ label: '职业', value: p.careers.map(c => c.name).join(' / ') });
      if (p.vibeTags.length > 0) previews.push({ label: '氛围', value: p.vibeTags.join('、') });
    }
    if (extractedDate) previews.push({ label: '日期', value: extractedDate.split('T')[0] });
    if (extractedSentiment) previews.push({ label: '情绪', value: extractedSentiment });
    if (actionItems.length > 0) previews.push({ label: '行动项', value: actionItems.map(a => a.description).join('、') });
    return previews;
  };

  const handleRoundConfirm = async (answer: string | null) => {
    const field = missingFields[currentRound].field;
    const newAnswers = { ...roundAnswers, [field]: answer };
    const newHistory = [...roundHistory, { field, answer }];
    setRoundAnswers(newAnswers);
    setRoundHistory(newHistory);

    if (currentRound < missingFields.length - 1) {
      setCurrentRound(currentRound + 1);
    } else {
      // Build clear, declarative supplement text (not Q&A format)
      const fieldLabels: Record<string, string> = {
        name: '人物姓名', company: '公司名称', location: '见面地点',
        career: '职业方向', sentiment: '互动情绪', actionItems: '待办事项', date: '互动日期',
      };
      const supplements: string[] = [];
      for (const h of newHistory) {
        if (h.answer) {
          const label = fieldLabels[h.field] || h.field;
          supplements.push(`- ${label}：${h.answer}`);
        }
      }
      const supplementText = supplements.length > 0
        ? `\n\n[已确认的补充信息]\n${supplements.join('\n')}`
        : '';
      const accumulatedText = originalInputText
        ? `${originalInputText}${supplementText}`
        : `${inputText}${supplementText}`;
      await handleSubmitWithText(accumulatedText, true);
    }
  };

  const handleRoundSkip = () => {
    const field = missingFields[currentRound].field;
    const newAnswers = { ...roundAnswers, [field]: null };
    const newHistory = [...roundHistory, { field, answer: null }];
    setRoundAnswers(newAnswers);
    setRoundHistory(newHistory);

    if (currentRound < missingFields.length - 1) {
      setCurrentRound(currentRound + 1);
    } else {
      const accumulatedText = originalInputText || inputText;
      handleSubmitWithText(accumulatedText, true);
    }
  };

  const handleRoundBack = () => {
    if (currentRound > 0) {
      setRoundHistory(prev => prev.slice(0, -1));
      setCurrentRound(currentRound - 1);
    }
  };

  const handleSkipAllRounds = () => {
    setPhase('result');
    setResultStatus('complete');
  };

  // ──────────────────────────────────────────────
  // Voice
  // ──────────────────────────────────────────────
  const handleRecordToggle = () => {
    if (!recognitionRef.current) { alert('语音识别不可用，请使用最新版 Chrome'); return; }
    if (isRecording) { recognitionRef.current.stop(); setIsRecording(false); }
    else { recognitionRef.current.start(); setIsRecording(true); }
  };

  // ──────────────────────────────────────────────
  // Reset
  // ──────────────────────────────────────────────
  const handleClear = () => {
    setInputText('');
    setPhase('input');
    setErrorMessage('');
    setAnalysisSteps([]);
    setMissingFields([]);
    setCurrentRound(0);
    setRoundAnswers({});
    setRoundHistory([]);
    setExtractedDate(null);
    setExtractedSentiment(null);
    setJeffreyComment('');
    setPersons([]);
    setPersonIds([]);
    setActionItems([]);
    setResultStatus(null);
    setAmbiguousPersons([]);
    setOriginalInputText('');
  };

  const resetToInput = () => {
    setInputText('');
    setPhase('input');
    setErrorMessage('');
    setAnalysisSteps([]);
    setMissingFields([]);
    setCurrentRound(0);
    setRoundAnswers({});
    setRoundHistory([]);
    setExtractedDate(null);
    setExtractedSentiment(null);
    setJeffreyComment('');
    setPersons([]);
    setPersonIds([]);
    setActionItems([]);
    setResultStatus(null);
    setAmbiguousPersons([]);
    setOriginalInputText('');
  };

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  const isSubmitDisabled = !inputText.trim() || isProcessing;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, position: 'relative', overflow: 'hidden' }}>
      {/* Noise texture */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <Header />

        <main style={{ maxWidth: 620, margin: '0 auto', padding: '16px 20px' }}>
          {/* ═══════════════════════════════════ */}
          {/* OVERLAYS (above current phase)     */}
          {/* ═══════════════════════════════════ */}
          {showResolutionPrompt && nameResolutions.length > 0 && (
            <NameResolutionPrompt
              resolutions={nameResolutions}
              allPersons={existingPersons}
              onConfirm={handleResolutionConfirm}
              onSkip={handleResolutionSkip}
            />
          )}

          {resultStatus === 'ambiguous' && ambiguousPersons.length > 0 && (
            <AmbiguousPrompt
              ambiguousPersons={ambiguousPersons as Array<{ name: string; ambiguousWith: string[]; careers: Array<{ name: string; weight: number }>; interests: Array<{ name: string; weight: number }>; vibeTags: string[] }>}
              existingPersons={existingPersons}
              onConfirmMerge={async (name, existingId, ambiguousName) => {
                setAmbiguousPersons([]);
                setResultStatus(null);
                await handleSubmitWithText(`是的，${name}就是之前录入的${ambiguousName}，请合并。`, true);
              }}
              onCreateNew={name => {
                setAmbiguousPersons([]);
                setResultStatus(null);
                handleSubmitWithText(`用户确认：${name}不是之前录入的同一人，是新创建的条目。`, true);
              }}
            />
          )}

          {/* ═══════════════════════════════════ */}
          {/* PHASE: INPUT                        */}
          {/* ═══════════════════════════════════ */}
          {phase === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Jeffrey greeting */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <JeffreyAvatar size={42} />
                  <p style={{ fontFamily: C.fontDisplay, fontSize: 14, fontStyle: 'italic', color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>
                    {randomQuote}
                  </p>
                </div>
              </Card>

              {/* Text input */}
              <Card>
                <textarea
                  value={inputText}
                  onChange={e => { setInputText(e.target.value); setErrorMessage(''); }}
                  placeholder="今天见了谁？聊了什么？有什么新的发现或约定吗？"
                  style={{
                    width: '100%', minHeight: 150, padding: 14,
                    background: 'transparent', border: 'none', outline: 'none',
                    color: C.text, fontFamily: 'var(--font-body)',
                    fontSize: 15, lineHeight: 1.75, resize: 'vertical',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </Card>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="secondary" onClick={handleClear} disabled={isProcessing || (!inputText && phase === 'input')} style={{ flex: 1 }}>
                  清空
                </Button>
                <Button variant="primary" fullWidth loading={isProcessing} onClick={handleSubmit} disabled={isSubmitDisabled} style={{ flex: 4 }}>
                  {isProcessing ? 'Jeffrey 思考中...' : '告诉 Jeffrey'}
                </Button>
              </div>

              {/* Voice */}
              <Card>
                <button
                  onClick={handleRecordToggle}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                    padding: '12px 16px', borderRadius: 10,
                    border: isRecording ? `2px solid ${C.accent}` : '2px solid transparent',
                    backgroundColor: isRecording ? C.accentLight : C.bgElevated,
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    backgroundColor: isRecording ? C.accentLight : C.bgCard,
                    border: `1.5px solid ${isRecording ? C.accent : C.borderStrong}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s',
                    animation: isRecording ? 'recPulse 1.5s ease-in-out infinite' : 'none',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isRecording ? C.accent : 'none'} stroke={isRecording ? C.accent : C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    <p style={{ fontSize: 12, color: C.textMuted, margin: '2px 0 0' }}>
                      {isRecording ? '点击按钮结束录音' : '点击开始，说完再点击结束'}
                    </p>
                  </div>
                </button>
              </Card>

              {/* Error */}
              {errorMessage && (
                <div style={{
                  padding: '12px 16px', borderRadius: C.radiusMd,
                  background: C.errorBg, color: C.error,
                  border: `1px solid rgba(239,108,108,0.2)`,
                  fontSize: 13,
                }}>
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════ */}
          {/* PHASE: ANALYZING                   */}
          {/* ═══════════════════════════════════ */}
          {phase === 'analyzing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Collapsed input preview */}
              <div style={{
                background: C.bgCard, border: `1px solid ${C.border}`,
                borderRadius: C.radiusMd, padding: '12px 16px',
                fontSize: 14, color: C.textMuted,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                opacity: 0.6,
              }}>
                {originalInputText.slice(0, 80)}{originalInputText.length > 80 ? '...' : ''}
              </div>

              {/* Analysis steps */}
              <AnalysisProgress steps={analysisSteps} isStreaming={isProcessing} />

              {/* Error during analysis */}
              {errorMessage && (
                <div style={{
                  padding: '12px 16px', borderRadius: C.radiusMd,
                  background: C.errorBg, color: C.error,
                  border: `1px solid rgba(239,108,108,0.2)`,
                  fontSize: 13,
                }}>
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════ */}
          {/* PHASE: FOLLOWUP                    */}
          {/* ═══════════════════════════════════ */}
          {phase === 'followup' && missingFields.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isProcessing && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', borderRadius: C.radiusMd,
                  background: C.bgCard, border: `1px solid ${C.borderAccent}`,
                  fontSize: 14, color: C.textSecondary,
                }}>
                  <div style={{
                    width: 18, height: 18, border: `2px solid ${C.primaryDim}`,
                    borderTopColor: C.primary, borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  正在保存...
                </div>
              )}
              <RoundPrompt
                allFields={missingFields.map(f => ({
                  field: f.field,
                  priority: f.priority,
                  question: f.question,
                }))}
                currentIndex={currentRound}
                defaultValue={roundAnswers[missingFields[currentRound]?.field] || undefined}
                isLast={currentRound === missingFields.length - 1}
                showBack={currentRound > 0}
                disabled={isProcessing}
                onConfirm={handleRoundConfirm}
                onSkip={handleRoundSkip}
                onBack={handleRoundBack}
              />

              {persons.length > 0 && (
                <ExtractionPreview fields={getExtractedPreview()} />
              )}

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={handleSkipAllRounds}
                  disabled={isProcessing}
                  style={{
                    background: 'transparent', border: 'none',
                    color: C.textMuted, fontSize: 12, cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  全部跳过，稍后补充
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════ */}
          {/* PHASE: RESULT                      */}
          {/* ═══════════════════════════════════ */}
          {phase === 'result' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Completion badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 100,
                fontSize: 13, fontWeight: 500,
                background: C.successBg, color: C.success,
                border: `1px solid rgba(5,150,105,0.25)`,
                width: 'fit-content',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: C.success, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: C.bg, fontSize: 11, fontWeight: 700,
                }}>✓</div>
                数据已完整保存到知识图谱
              </div>

              {/* Jeffrey Comment */}
              {jeffreyComment && (
                <Card style={{ background: C.bgElevated, border: `1px solid ${C.borderAccent}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <JeffreyAvatar size={32} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.primary, letterSpacing: '0.01em' }}>Jeffrey 的点评</span>
                  </div>
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.75, margin: 0, fontStyle: 'italic', fontFamily: C.fontDisplay }}>
                    {jeffreyComment}
                  </p>
                </Card>
              )}

              {/* Extracted Persons */}
              {persons.length > 0 && (
                <Card>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: C.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
                  }}>
                    已提取人物
                  </div>
                  {persons.map((person, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        padding: 14, background: C.bgElevated,
                        borderRadius: C.radiusMd, border: `1px solid ${C.border}`,
                      }}
                    >
                      <JeffreyAvatar size={36} />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: '0 0 8px', fontFamily: C.fontDisplay }}>
                          {person.name}
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {person.careers.map((c, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 9px', borderRadius: C.radiusSm,
                              fontSize: 12, fontWeight: 500,
                              background: C.infoBg, color: C.info,
                              border: `1px solid rgba(37,99,235,0.15)`,
                            }}>
                              {c.name}
                              <span style={{ opacity: 0.65, fontSize: 11 }}>{Math.round(c.weight * 100)}%</span>
                            </span>
                          ))}
                          {person.interests.map((int, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 9px', borderRadius: C.radiusSm,
                              fontSize: 12, fontWeight: 500,
                              background: C.accentLight, color: C.primary,
                              border: `1px solid rgba(5,150,105,0.15)`,
                            }}>
                              {int.name}
                              <span style={{ opacity: 0.65, fontSize: 11 }}>{Math.round(int.weight * 100)}%</span>
                            </span>
                          ))}
                          {person.vibeTags.map((v, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 9px', borderRadius: C.radiusSm,
                              fontSize: 12, fontWeight: 500,
                              background: C.successBg, color: C.success,
                              border: `1px solid rgba(5,150,105,0.15)`,
                            }}>
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              {/* Action Items */}
              {actionItems.length > 0 && (
                <Card>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: C.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
                  }}>
                    社交债务
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {actionItems.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', background: C.bgElevated,
                          borderRadius: C.radiusMd, border: `1px solid ${C.border}`,
                          fontSize: 13,
                        }}
                      >
                        <span style={{
                          padding: '2px 8px', borderRadius: 100,
                          fontSize: 11, fontWeight: 600, flexShrink: 0,
                          background: item.ownedBy === 'me' ? C.errorBg : item.ownedBy === 'them' ? C.successBg : C.warningBg,
                          color: item.ownedBy === 'me' ? C.error : item.ownedBy === 'them' ? C.success : C.warning,
                          border: `1px solid ${item.ownedBy === 'me' ? 'rgba(220,38,38,0.15)' : item.ownedBy === 'them' ? 'rgba(5,150,105,0.15)' : 'rgba(217,119,6,0.15)'}`,
                        }}>
                          {item.ownedBy === 'me' ? '我欠' : item.ownedBy === 'them' ? '他欠' : '双方'}
                        </span>
                        <span style={{ color: C.text }}>{item.description}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* CTA */}
              <Button variant="primary" fullWidth onClick={resetToInput}>
                录入新的互动
              </Button>
            </div>
          )}

          {/* Recording pulse keyframes */}
          <style>{`
            @keyframes recPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); }
              50% { box-shadow: 0 0 0 8px rgba(5,150,105,0.15); }
            }
          `}</style>
        </main>
      </div>
    </div>
  );
};

export default JeffreyInputPage;
