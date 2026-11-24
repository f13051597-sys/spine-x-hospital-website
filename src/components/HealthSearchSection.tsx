import { ExternalLink, Globe, Loader2, Search } from 'lucide-react';
import React, { useState } from 'react';

interface SearchSource {
  title: string;
  uri: string;
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const SUGGESTED_TOPICS = [
  'What to bring to an orthopedic OPD consultation in Nepal',
  'Post-fracture cast care and warning signs requiring emergency visit',
  'Travel routes and road conditions to Birtamode, Jhapa',
];

export function HealthSearchSection() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<SearchSource[]>([]);

  const executeSearch = async (q: string) => {
    const clean = q.trim();
    if (clean.length < 2) return;
    setQuery(clean);
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/grounding/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean }),
      });
      const data = (await res.json()) as {
        answer?: string;
        sources?: SearchSource[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to complete search.');
      }
      setAnswer(data.answer || '');
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to fetch grounded search data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeSearch(query);
  };

  return (
    <section className="py-16 lg:py-20 bg-white border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-7">
        <div className="space-y-2.5 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Verified Web Health &amp; Visit Search
          </p>
          <h2
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950"
            style={{ textWrap: 'balance' }}
          >
            Look Up Up-to-Date Patient &amp; Travel Information
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Powered by live Google Search grounding and source citations. For medical emergencies,
            always call{' '}
            <a href="tel:9807923351" className="font-mono font-semibold text-[#0F4C81] hover:underline">
              9807923351
            </a>{' '}
            directly.
          </p>
        </div>

        <div className="surface-card rounded-2xl p-6 sm:p-8 bg-slate-50/70 space-y-5">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about visit preparation, orthopedic recovery guidelines, or Jhapa travel..."
                className="clinical-input pl-10 pr-3.5 py-2.5 text-sm min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || query.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0A365C] disabled:bg-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>Search Web Sources</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => void executeSearch(topic)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-[#0F4C81] hover:text-[#0F4C81] shadow-2xs transition-colors cursor-pointer text-left"
              >
                {topic}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium"
            >
              {errorMsg}
            </div>
          )}

          {(answer || sources.length > 0) && (
            <div className="pt-5 border-t border-slate-200/80 space-y-4">
              {answer && (
                <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-white p-5 rounded-xl border border-slate-200/80">
                  {answer}
                </div>
              )}

              {sources.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#0F4C81]" aria-hidden="true" />
                    <span>Cited Google Search Sources</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sources.map((src) =>
                      isSafeHttpUrl(src.uri) ? (
                        <a
                          key={src.uri}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-[#0F4C81] hover:border-[#0F4C81] shadow-2xs transition-colors"
                        >
                          <span className="truncate max-w-[240px]">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                        </a>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
