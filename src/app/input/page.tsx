"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import AmbiguousPrompt from '@/components/AmbiguousPrompt';
import NameResolutionPrompt from '@/components/NameResolutionPrompt';

// 语音识别类型
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

// 数据类型
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
  personIds: string[]; // 用于破冰助手预生成
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

// 对话历史中的单条消息
interface ChatMessage {
  role: 'user' | 'jeffrey';
  content: string;
  timestamp: string;
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
  const [nameResolutions, setNameResolutions] = useState<Array<{ mentionedName: string; candidates: Array<{ id: string; name: string; similarity: number; matchType: "exact" | "embedding"; careers: unknown[] }> }>>([]);
  const [pendingText, setPendingText] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [dialogueComplete, setDialogueComplete] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  // Jeffrey 随机问候语
  const jeffreyQuotes = [
    "今天又见了谁，先生？请如实汇报。",
    "啊，您又去应酬了？请详细说明。",
    "我洗耳恭听，希望不是些无聊的闲聊。",
    "看来您又有新的交际圈了，愿闻其详。",
    "请不要让我等待太久，先生。"
  ];

  const [randomQuote, setRandomQuote] = useState('');

  useEffect(() => {
    setRandomQuote(jeffreyQuotes[Math.floor(Math.random() * jeffreyQuotes.length)]);

    const savedEntries = localStorage.getItem('jeffrey_recent_entries');
    if (savedEntries) {
      try {
        setRecentEntries(JSON.parse(savedEntries));
      } catch (e) {
        console.error('Failed to parse recent entries', e);
      }
    }

    // Fetch existing persons for ambiguous merge lookup
    fetch('/api/members/table')
      .then((r) => r.json())
      .then((data) => {
        setExistingPersons(data.rows || []);
      })
      .catch(() => {});
  }, []);

  // 初始化语音识别
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true; // 支持连续录音，用户手动停止
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'zh-CN';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(prev => prev + (prev ? ' ' : '') + transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsRecording(false);
        };

        // 不再自动停止，由用户手动控制
        recognitionRef.current.onend = () => {
          // 只有非用户主动停止时才更新状态
          if (isRecording) {
            setIsRecording(false);
          }
        };
      }
    }
  }, []);

  const handleRecordToggle = () => {
    if (!recognitionRef.current) {
      alert('语音识别不可用，请使用最新版 Chrome 浏览器');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  // Apply resolved name replacements to text
  const applyNameResolutions = (text: string, resolvedNames: Map<string, string>): string => {
    let result = text;
    for (const [originalName, matchedName] of resolvedNames) {
      if (originalName !== matchedName) {
        result = result.replace(new RegExp(originalName, 'g'), matchedName);
      }
    }
    return result;
  };

  // Handle resolution confirmation: replace names and proceed to analyze
  const handleResolutionConfirm = async (resolvedNames: Map<string, string>) => {
    setShowResolutionPrompt(false);
    const resolvedText = applyNameResolutions(pendingText, resolvedNames);
    setInputText(resolvedText);
    setOriginalInputText(resolvedText);

    // Now proceed with the resolved text
    setIsProcessing(true);
    try {
      const payload = JSON.stringify({ text: resolvedText });
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: payload
      });

      if (!response.ok) {
        throw new Error(`API Error ${response.status}`);
      }

      const data: ExtractionResponse = await response.json();
      setJeffreyComment(data.jeffreyComment);
      setPersons(data.persons);
      setPersonIds(data.personIds || []);
      setFollowUpQuestion(data.followUpQuestion || '');
      setActionItems(data.actionItems);
      setStatus(data.status);
      setAmbiguousPersons(data.ambiguousPersons || []);

      if (data.status === 'complete') {
        const newEntry: RecentEntry = {
          id: Date.now().toString(),
          text: resolvedText.substring(0, 60) + (resolvedText.length > 60 ? '...' : ''),
          timestamp: new Date().toLocaleString(),
          status: data.status,
          relativeTime: '刚刚'
        };
        const updatedEntries = [newEntry, ...recentEntries.slice(0, 4)];
        setRecentEntries(updatedEntries);
        localStorage.setItem('jeffrey_recent_entries', JSON.stringify(updatedEntries));
        setDialogueComplete(true);
      } else if (data.status === 'pending' && data.followUpQuestion) {
        const jeffreyMessage: ChatMessage = {
          role: 'jeffrey',
          content: data.followUpQuestion,
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        setConversationHistory([jeffreyMessage]);
        setDialogueComplete(false);
      }
    } catch (error) {
      console.error('Error after resolution:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Skip resolution and proceed directly to analyze
  const handleResolutionSkip = () => {
    setShowResolutionPrompt(false);
    // Proceed with original text as-is
    handleSubmitWithText(pendingText, false);
  };

  // Internal: submit a specific text to analyze (used after resolution)
  const handleSubmitWithText = async (textToSubmit: string, isFollowUp = false) => {
    if (!textToSubmit.trim()) return;

    try {
      setIsProcessing(true);

      // Add user message to conversation history
      const userMessage: ChatMessage = {
        role: 'user',
        content: textToSubmit,
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      if (isFollowUp) {
        setConversationHistory(prev => [...prev, userMessage]);
      }

      const payload = JSON.stringify({ text: textToSubmit });
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: payload
      });

      if (!response.ok) {
        throw new Error(`API Error ${response.status}`);
      }

      const data: ExtractionResponse = await response.json();
      setJeffreyComment(data.jeffreyComment);
      setPersons(data.persons);
      setPersonIds(data.personIds || []);
      setFollowUpQuestion(data.followUpQuestion || '');
      setActionItems(data.actionItems);
      setStatus(data.status);
      setAmbiguousPersons(data.ambiguousPersons || []);

      if (data.status === 'complete') {
        // Add Jeffrey's response to conversation history
        const jeffreyMessage: ChatMessage = {
          role: 'jeffrey',
          content: data.jeffreyComment || '信息已保存到数据库。',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        setConversationHistory(prev => [...prev, jeffreyMessage]);

        if (!isFollowUp) {
          // First time complete - save to recent entries but keep dialogue open
          const newEntry: RecentEntry = {
            id: Date.now().toString(),
            text: textToSubmit.substring(0, 60) + (textToSubmit.length > 60 ? '...' : ''),
            timestamp: new Date().toLocaleString(),
            status: data.status,
            relativeTime: '刚刚'
          };
          const updatedEntries = [newEntry, ...recentEntries.slice(0, 4)];
          setRecentEntries(updatedEntries);
          localStorage.setItem('jeffrey_recent_entries', JSON.stringify(updatedEntries));
          // Mark dialogue as complete since no follow-up was needed
          setDialogueComplete(true);
        } else {
          // After follow-up complete - dialogue is done
          setDialogueComplete(true);
        }
      } else if (data.status === 'pending' && data.followUpQuestion) {
        // Add Jeffrey's follow-up question to conversation history
        const jeffreyMessage: ChatMessage = {
          role: 'jeffrey',
          content: data.followUpQuestion,
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        setConversationHistory(prev => [...prev, jeffreyMessage]);
        setDialogueComplete(false);
      }
    } catch (error) {
      console.error('Error submitting:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (followUpReply?: string) => {
    // 确保使用正确的原文本
    const baseText = originalInputText || inputText;
    const textToSubmit = followUpReply ? `${baseText}\n\n追问回复：${followUpReply}` : inputText;

    if (!textToSubmit.trim()) {
      console.error('[Jeffrey.AI] Empty text to submit');
      return;
    }

    console.log('[Jeffrey.AI] baseText (originalInputText || inputText):', baseText);
    console.log('[Jeffrey.AI] followUpReply:', followUpReply);
    console.log('[Jeffrey.AI] Submitting text:', textToSubmit);
    console.log('[Jeffrey.AI] Text type:', typeof textToSubmit);
    console.log('[Jeffrey.AI] Text length:', textToSubmit.length);

    try {
      setIsProcessing(true);

      // 如果是首次提交（非追问回复），保存原文本
      if (!followUpReply) {
        console.log('[Jeffrey.AI] Saving original input text:', inputText);
        setOriginalInputText(inputText);
      }

      // Step 1: Pre-check for name resolution (only for initial submissions, not follow-up replies)
      if (!followUpReply) {
        const resolveRes = await fetch('/api/persons/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSubmit }),
        });

        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.resolutions?.length > 0) {
            // Found potential matches - show confirmation prompt
            setNameResolutions(resolveData.resolutions);
            setPendingText(textToSubmit);
            setShowResolutionPrompt(true);
            setIsProcessing(false);
            return; // Wait for user confirmation
          }
        }
      }

      // Step 2: No resolutions needed or follow-up reply - proceed to analyze
      await handleSubmitWithText(textToSubmit, !!followUpReply);

      // 追问回复发送后，清空回复相关状态
      if (followUpReply) {
        setSelectedQuickReply(null);
        setCustomReply('');
        // 清空输入框内容
        setInputText('');
      }
    } catch (error) {
      console.error('Error submitting:', error);
    } finally {
      if (!showResolutionPrompt) {
        setIsProcessing(false);
      }
    }
  };

  const handleClear = () => {
    setInputText('');
    setOriginalInputText('');
    setJeffreyComment('');
    setPersons([]);
    setPersonIds([]);
    setFollowUpQuestion('');
    setActionItems([]);
    setStatus(null);
    setSelectedQuickReply(null);
    setCustomReply('');
    setIsProcessing(false);
    setAmbiguousPersons([]);
    setShowResolutionPrompt(false);
    setNameResolutions([]);
    setPendingText('');
    setAmbiguousPersons([]);
    setConversationHistory([]);
    setDialogueComplete(false);
  };

  const handleQuickReply = (reply: string) => {
    setSelectedQuickReply(reply);
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return '刚刚';
    if (diffInHours < 24) return `${diffInHours}小时前`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}天前`;
    return '更早';
  };

  // 破冰助手预生成：分析完成后，等待3分钟无新操作则触发
  const icebreakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 只在有提取到人物且状态为 complete 时触发
    if (personIds.length === 0 || status !== 'complete') return;

    // 清除之前的定时器
    if (icebreakerTimerRef.current) {
      clearTimeout(icebreakerTimerRef.current);
    }

    // 设置新的3分钟定时器
    icebreakerTimerRef.current = setTimeout(async () => {
      console.log('[Jeffrey.AI] Triggering icebreaker pre-generation for', personIds.length, 'persons');

      // 为每个人物触发预生成（后台进行，不阻塞UI）
      for (const personId of personIds) {
        try {
          await fetch(`/api/persons/${personId}/icebreaker`, {
            method: 'POST',
          });
        } catch (e) {
          console.error('[Jeffrey.AI] Icebreaker pre-gen failed for', personId, e);
        }
      }
    }, 3 * 60 * 1000); // 3分钟

    return () => {
      if (icebreakerTimerRef.current) {
        clearTimeout(icebreakerTimerRef.current);
      }
    };
  }, [personIds, status]);

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      <Header />

      {/* 主内容区 */}
      <main className="flex flex-col lg:flex-row gap-4 p-4 max-w-[1600px] mx-auto">
        {/* 左栏 - 输入区 */}
        <div className="lg:w-[42%] flex flex-col gap-4">
          {/* Jeffrey 头像与问候语 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center border border-amber-200">
                <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-gray-500 italic text-sm">{randomQuote}</p>
            </div>
          </div>

          {/* 输入框 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="今天见了谁？聊了什么？有什么新的发现或约定吗？"
              className="w-full h-40 resize-none text-gray-700 placeholder-gray-400 focus:outline-none text-base leading-relaxed"
            />
          </div>

          {/* 语音按钮 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <button
              onClick={handleRecordToggle}
              className={`flex items-center space-x-3 w-full py-3 px-4 rounded-lg transition ${
                isRecording
                  ? 'bg-red-50 border-2 border-red-300'
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isRecording ? 'bg-red-100' : 'bg-white border border-gray-200'
              }`}>
                <svg className={`w-6 h-6 ${isRecording ? 'text-red-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 2.93V16a1 1 0 102 0v-2.07z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-500 text-sm">
                {isRecording ? '正在录音中，请说话...\n点击按钮结束录音' : '点击开始录音\n说完后再次点击结束'}
              </span>
            </button>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-3">
            <button
              onClick={handleClear}
              disabled={isProcessing}
              className="flex-1 py-3 px-6 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              清空
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              disabled={!inputText.trim() || isProcessing}
              className={`flex-1 py-3 px-6 rounded-xl transition font-medium ${
                isProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : inputText.trim()
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Jeffrey 思考中...
                </span>
              ) : (
                '汇报给 Jeffrey'
              )}
            </button>
          </div>

          {/* 最近录入 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium mb-3 pb-2 border-b border-gray-100">最近录入</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center p-2.5 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className={`w-2 h-2 rounded-full mr-3 ${
                    entry.status === 'pending' ? 'bg-amber-500' : 'bg-green-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 text-sm truncate">{entry.text}</p>
                  </div>
                  <span className="text-xs text-gray-400 ml-2">{entry.relativeTime}</span>
                </div>
              ))}
              {recentEntries.length === 0 && (
                <p className="text-gray-400 text-sm italic text-center py-4">暂无历史记录</p>
              )}
            </div>
          </div>
        </div>

        {/* 右栏 - 响应区 */}
        <div className="lg:w-[58%] flex flex-col gap-4">
          {/* Jeffrey 解读 */}
          {jeffreyComment && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 shadow-sm border border-amber-100">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-amber-700 text-xs font-bold">J</span>
                </div>
                <h3 className="text-amber-800 text-sm font-medium">Jeffrey 的点评</h3>
              </div>
              <p className="text-gray-700 leading-relaxed">{jeffreyComment}</p>
            </div>
          )}

          {/* 对话历史 */}
          {conversationHistory.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">对话记录</h3>
                {dialogueComplete && (
                  <span className="text-xs text-green-600 font-medium">✓ 对话已完成</span>
                )}
              </div>
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {conversationHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-amber-100 text-gray-800 rounded-br-md'
                          : 'bg-gray-100 text-gray-700 rounded-bl-md'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${
                          msg.role === 'user' ? 'text-amber-700' : 'text-gray-500'
                        }`}>
                          {msg.role === 'user' ? '你' : 'Jeffrey'}
                        </span>
                        <span className="text-xs text-gray-400">{msg.timestamp}</span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 已提取人物 */}
          {persons.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-4">已提取</h3>
              <div className="space-y-3">
                {persons.map((person, index) => (
                  <div key={index} className="flex items-start space-x-4 p-3 rounded-lg bg-gray-50">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center border border-blue-200 flex-shrink-0">
                      <span className="text-blue-700 font-medium">{person.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 mb-2">{person.name}</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {person.careers.map((career, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                          >
                            {career.name}
                            <span className="ml-1 opacity-70">{(career.weight * 100).toFixed(0)}%</span>
                          </span>
                        ))}
                        {person.interests.map((interest, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                          >
                            {interest.name}
                            <span className="ml-1 opacity-70">{(interest.weight * 100).toFixed(0)}%</span>
                          </span>
                        ))}
                        {person.vibeTags.map((vibe, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200"
                          >
                            {vibe}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 姓名预检区 - 在提交前让用户确认疑似匹配 */}
          {showResolutionPrompt && nameResolutions.length > 0 && (
            <NameResolutionPrompt
              resolutions={nameResolutions}
              allPersons={existingPersons}
              onConfirm={handleResolutionConfirm}
              onSkip={handleResolutionSkip}
            />
          )}

          {/* Ambiguous 区 */}
          {status === 'ambiguous' && ambiguousPersons.length > 0 && (
            <AmbiguousPrompt
              ambiguousPersons={ambiguousPersons as Parameters<typeof AmbiguousPrompt>[0]['ambiguousPersons']}
              existingPersons={existingPersons}
              onConfirmMerge={async (name, existingId, ambiguousName) => {
                // User confirmed: the new person IS the existing person.
                // Clear ambiguous state and re-submit with confirmation appended to original text.
                setAmbiguousPersons([]);
                setStatus(null);
                // Use handleSubmit with followUpReply to append confirmation to originalText
                await handleSubmit(`是的，${name}就是之前录入的${ambiguousName}，请合并到已有档案。`);
              }}
              onCreateNew={(name) => {
                // User says it's NOT the same person - create a new entry.
                // Re-submit as new person with explicit instruction.
                setAmbiguousPersons([]);
                setStatus(null);
                handleSubmit(`用户确认：${name}不是之前录入的同一人，是新创建的条目。`);
              }}
            />
          )}

          {/* 追问区 - 当对话未完成且有待回复问题时显示 */}
          {status === 'pending' && followUpQuestion && !dialogueComplete && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">JEFFREY 的追问</h3>
              <p className="text-gray-600 italic leading-relaxed mb-4">"{followUpQuestion}"</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {['不太清楚', '他做并购', customReply || '自定义回复'].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      if (option === '自定义回复') {
                        setCustomReply('');
                      } else {
                        setSelectedQuickReply(option);
                        setCustomReply('');
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm transition ${
                      (selectedQuickReply === option || (option === '自定义回复' && customReply))
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customReply}
                onChange={(e) => {
                  setCustomReply(e.target.value);
                  setSelectedQuickReply('自定义回复');
                }}
                placeholder="输入自定义回复..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-amber-300 transition mb-3"
              />
              <button
                onClick={() => {
                  // 确保发送的是字符串
                  let reply: string;
                  if (customReply && typeof customReply === 'string' && customReply.trim()) {
                    reply = customReply;
                  } else if (selectedQuickReply && typeof selectedQuickReply === 'string') {
                    reply = selectedQuickReply;
                  } else {
                    alert('请输入回复内容或选择快捷回复');
                    return;
                  }
                  handleSubmit(reply);
                }}
                disabled={(!selectedQuickReply && !customReply) || isProcessing}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition ${
                  isProcessing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : selectedQuickReply || customReply
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Jeffrey 思考中...
                  </span>
                ) : (
                  '发送回复给 Jeffrey'
                )}
              </button>
            </div>
          )}

          {/* 社交债务 */}
          {actionItems.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-4">社交债务</h3>
              <div className="space-y-2">
                {actionItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center p-3 rounded-lg bg-gray-50"
                  >
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium mr-3 ${
                      item.ownedBy === 'me'
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : item.ownedBy === 'them'
                        ? 'bg-green-50 text-green-600 border border-green-200'
                        : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>
                      {item.ownedBy === 'me' ? '我欠' : item.ownedBy === 'them' ? '他欠' : '双方'}
                    </span>
                    <span className="text-gray-700">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default JeffreyInputPage;