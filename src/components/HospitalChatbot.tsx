import {
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  MessageSquareText,
  RotateCcw,
  Send,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';
import { HOSPITAL_INFO } from '../data/hospitalCatalog';

type ChatMode = 'search' | 'maps' | 'fast';

interface SearchSource {
  title: string;
  uri: string;
}

interface MapsPlaceSource {
  title: string;
  uri: string;
  snippets: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  searchSources?: SearchSource[];
  mapsPlaces?: MapsPlaceSource[];
}

interface HospitalChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  onBookNow: () => void;
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: `Namaste. I am the Patient Assistance Chatbot for ${HOSPITAL_INFO.name} (${HOSPITAL_INFO.address}). Ask me about our departments, doctor OPD fees, online appointment booking, or nearby directions.`,
};

const QUICK_PROMPTS: { label: string; mode: ChatMode }[] = [
  { label: 'What are the OPD fees for each doctor?', mode: 'fast' },
  { label: 'How do I check my booking status?', mode: 'fast' },
  { label: 'Find landmarks & bus stops near Spine X Hospital', mode: 'maps' },
  { label: 'How should I prepare for an orthopedic visit?', mode: 'search' },
];

export function HospitalChatbot({ isOpen, onClose, onBookNow }: HospitalChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('search');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend: string, overrideMode?: ChatMode) => {
    const clean = textToSend.trim();
    if (!clean || loading) return;

    const activeMode = overrideMode || mode;
    if (overrideMode) setMode(overrideMode);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: clean,
    };

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: historyPayload,
          mode: activeMode,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        model?: string;
        searchSources?: SearchSource[];
        mapsPlaces?: MapsPlaceSource[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Unable to get a response from the hospital assistant.');
      }

      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply || '',
        modelUsed: data.model,
        searchSources: Array.isArray(data.searchSources) ? data.searchSources : [],
        mapsPlaces: Array.isArray(data.mapsPlaces) ? data.mapsPlaces : [],
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleReset = () => {
    setMessages([INITIAL_WELCOME]);
    setErrorMsg(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Hospital Patient Assistance Chat"
          className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[410px] max-h-[76vh] bg-white border border-slate-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-[#0F4C81] text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <MessageSquareText className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold text-sm truncate">
                  Spine X Patient Assistant
                </div>
                <div className="text-[11px] text-sky-100 truncate font-mono tabular-nums">
                  Emergency 24/7: {HOSPITAL_INFO.phone}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                title="Start new conversation"
                aria-label="Reset conversation"
                className="p-2 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close chat assistant"
                className="p-2 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grounding / Model Mode Selector */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                mode === 'search'
                  ? 'bg-white text-[#0F4C81] border border-slate-200/90 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3 h-3" aria-hidden="true" />
              <span>Web Search</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('maps')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                mode === 'maps'
                  ? 'bg-white text-[#0F4C81] border border-slate-200/90 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3 h-3" aria-hidden="true" />
              <span>Maps Info</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('fast')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                mode === 'fast'
                  ? 'bg-white text-emerald-700 border border-slate-200/90 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3 h-3" aria-hidden="true" />
              <span>Fast Guide</span>
            </button>
          </div>

          {/* Scrollable Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white min-h-[260px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-[#0F4C81] text-white rounded-br-sm'
                      : 'bg-slate-50 text-slate-900 border border-slate-200/80 rounded-bl-sm'
                  }`}
                >
                  {msg.text}

                  {msg.searchSources && msg.searchSources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-700">Sources</div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.searchSources.map((src) =>
                          isSafeHttpUrl(src.uri) ? (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-medium text-[#0F4C81] hover:border-[#0F4C81]"
                            >
                              <span className="truncate max-w-[170px]">{src.title}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}

                  {msg.mapsPlaces && msg.mapsPlaces.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-700">
                        Google Maps Places
                      </div>
                      <div className="space-y-1.5">
                        {msg.mapsPlaces.map((place) =>
                          isSafeHttpUrl(place.uri) ? (
                            <a
                              key={place.uri}
                              href={place.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-[#0F4C81] hover:border-[#0F4C81]"
                            >
                              <div className="font-semibold flex items-center justify-between gap-1">
                                <span className="truncate">{place.title}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </div>
                              {place.snippets[0] && (
                                <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                  “{place.snippets[0]}”
                                </div>
                              )}
                            </a>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Quick Questions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => void sendMessage(q.label, q.mode)}
                      className="text-left px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-700 hover:border-[#0F4C81] hover:text-[#0F4C81] hover:bg-white transition-colors cursor-pointer"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F4C81]" aria-hidden="true" />
                <span>Assistant is replying...</span>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900"
              >
                {errorMsg}
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>

          {/* Footer Input */}
          <div className="p-3.5 border-t border-slate-200/80 bg-slate-50/90 space-y-2.5">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about OPD fees, doctors, or directions..."
                maxLength={2000}
                className="clinical-input flex-1 px-3.5 py-2 text-sm min-h-[40px]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#0F4C81] text-white hover:bg-[#0A365C] disabled:bg-slate-300 transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Informational support only</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBookNow();
                }}
                className="font-semibold text-[#0F4C81] hover:underline cursor-pointer"
              >
                Book OPD Slot &rarr;
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
