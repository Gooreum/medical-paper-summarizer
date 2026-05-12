'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchCrawlHistory,
  fetchCrawlHistoryDetail,
  type CrawlSessionSummary,
  type CrawlEventItem,
  type CrawlHistoryDetailResponse,
} from '@/src/lib/api';

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  running:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  failed:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};
const STATUS_LABEL: Record<string, string> = {
  completed: '완료', running: '실행중', failed: '실패',
};

const EVENT_TABS = [
  { key: 'all',       label: '전체' },
  { key: 'summarized', label: '요약완료' },
  { key: 'collected', label: '수집됨' },
  { key: 'skipped',   label: '스킵됨' },
  { key: 'failed',    label: '실패' },
];

const EVENT_BADGE: Record<string, string> = {
  summarized: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  collected:  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  skipped:    'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  failed:     'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};
const EVENT_LABEL: Record<string, string> = {
  summarized: '요약완료', collected: '수집됨', skipped: '스킵됨', failed: '실패',
};

function pageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '진행중';
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  return `${m}분 ${s % 60}초`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Session Detail ──────────────────────────────────────────
function SessionDetail({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<CrawlHistoryDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const load = useCallback(async (tab: string, p: number) => {
    try {
      const data = await fetchCrawlHistoryDetail(sessionId, tab, p, LIMIT);
      setDetail(data);
    } catch {}
  }, [sessionId]);

  useEffect(() => { load(activeTab, 1); setPage(1); }, [activeTab, load]);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setPage(1);
  }

  function handlePage(p: number) {
    setPage(p);
    load(activeTab, p);
  }

  if (!detail) {
    return (
      <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">불러오는 중...</div>
    );
  }

  const { session, counts, events, total } = detail;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-3">
      {/* 세션 요약 */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-gray-500 dark:text-gray-400">
        <span>토픽: {session.topics.join(', ')}</span>
        <span>소스: {session.sources.join(', ')}</span>
        <span>토픽당 {session.papers_per_topic}편</span>
        <span>소요: {formatDuration(session.started_at, session.finished_at)}</span>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 px-4 pt-3 flex-wrap">
        {EVENT_TABS.map(tab => {
          const cnt = tab.key === 'all'
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : (counts[tab.key] ?? 0);
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.label} {cnt > 0 && <span className="opacity-70">{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* 이벤트 목록 */}
      <div className="px-4 pb-4 pt-2">
        {events.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">항목 없음</p>
        ) : (
          <div className="space-y-1.5 mt-2">
            {events.map(evt => (
              <div key={evt.id} className="flex items-start gap-2.5 text-[13px]">
                <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium ${EVENT_BADGE[evt.event_type] ?? ''}`}>
                  {EVENT_LABEL[evt.event_type] ?? evt.event_type}
                </span>
                <div className="min-w-0">
                  <span className="text-gray-800 dark:text-gray-200 leading-snug">{evt.title}</span>
                  <span className="ml-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                    [{evt.source}] {evt.topic}
                    {evt.reason && ` · ${evt.reason}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-4">
            {pageRange(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePage(p as number)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CrawlHistory (main) ─────────────────────────────────────
export default function CrawlHistory() {
  const [sessions, setSessions] = useState<CrawlSessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const LIMIT = 10;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await fetchCrawlHistory(p, LIMIT);
      setSessions(data.sessions);
      setTotal(data.total);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  function handlePage(p: number) {
    setPage(p);
    setExpandedId(null);
    load(p);
  }

  const totalPages = Math.ceil(total / LIMIT);

  if (loading) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>;
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">크롤링 히스토리가 없습니다.</p>;
  }

  return (
    <div>
      <div className="space-y-2">
        {sessions.map(s => (
          <div key={s.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {/* 세션 행 */}
            <button
              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[s.status]}`}>
                {STATUS_LABEL[s.status]}
              </span>
              <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200 shrink-0">
                {formatDateTime(s.started_at)}
              </span>
              <div className="flex gap-3 text-[12px] ml-1">
                <span className="text-green-600 dark:text-green-400 font-medium">요약 {s.total_saved}</span>
                <span className="text-gray-400 dark:text-gray-500">스킵 {s.total_skipped}</span>
                {s.total_failed > 0 && (
                  <span className="text-red-500 dark:text-red-400">실패 {s.total_failed}</span>
                )}
              </div>
              <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                {formatDuration(s.started_at, s.finished_at)}
              </span>
              <span className="text-gray-300 dark:text-gray-600 text-sm">
                {expandedId === s.id ? '▲' : '▼'}
              </span>
            </button>

            {/* 상세 */}
            {expandedId === s.id && (
              <SessionDetail sessionId={s.id} onClose={() => setExpandedId(null)} />
            )}
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          {pageRange(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">…</span>
            ) : (
              <button
                key={p}
                onClick={() => handlePage(p as number)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  p === page
                    ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
