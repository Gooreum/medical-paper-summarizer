'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import TopicTabs from '@/src/components/TopicTabs';
import DateSection from '@/src/components/DateSection';
import PaperCard from '@/src/components/PaperCard';
import ThemeToggle from '@/src/components/ThemeToggle';
import { fetchPapers, fetchTopicCounts, fetchSourceCounts, type Paper } from '@/src/lib/api';

// Module-level cache: survives component unmount/remount (back-navigation)
const _papersCache = new Map<string, { papers: Paper[]; total: number; ts: number }>();
const PAPERS_TTL = 60_000;

const TOPICS = ['근비대', '해부학', '자세교정', '영양학', '탈모치료', '노화', '웨이트 트레이닝', '수면', '다이어트'];
const LIMIT = 50;
const SCROLL_KEY = 'home_scroll';

type SortBy = 'crawled_date' | 'published_date' | 'citation_count';
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'crawled_date', label: '최신 수집순' },
  { value: 'published_date', label: '최신 발행순' },
  { value: 'citation_count', label: '인용수 높은순' },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'pubmed', label: 'PubMed' },
  { value: 'biorxiv', label: 'bioRxiv' },
  { value: 'koreamed', label: 'KoreaMed' },
];

function groupByDate(papers: Paper[]): Record<string, Paper[]> {
  return papers.reduce(
    (acc, p) => {
      const date = p.crawled_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(p);
      return acc;
    },
    {} as Record<string, Paper[]>,
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 animate-pulse bg-white dark:bg-gray-800">
      <div className="flex gap-2 mb-2.5">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full mb-1" />
      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3" />
    </div>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicParam = searchParams.get('topic') || '전체';

  const [selected, setSelected] = useState(topicParam);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const rawSort = searchParams.get('sort');
  const sortParam: SortBy = rawSort === 'published_date' || rawSort === 'citation_count' ? rawSort : 'crawled_date';
  const [sortBy, setSortBy] = useState<SortBy>(sortParam);
  const rawSource = searchParams.get('source') || '';
  const [sourceFilter, setSourceFilter] = useState(rawSource);
  const { data: topicData } = useSWR('topicCounts', fetchTopicCounts, { revalidateOnFocus: false, dedupingInterval: 300_000 });
  const { data: sourceData } = useSWR('sourceCounts', fetchSourceCounts, { revalidateOnFocus: false, dedupingInterval: 300_000 });
  const topicCounts = topicData ?? { total: 0, counts: {} };
  const sourceCounts = sourceData?.counts ?? {};
  const scrollRestored = useRef(false);
  const [navTo, setNavTo] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('bookmarked_papers');
    if (saved) setBookmarks(new Set<number>(JSON.parse(saved)));
  }, []);

  const toggleBookmark = useCallback((id: number) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('bookmarked_papers', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const load = useCallback(async (topic: string, currentSkip: number, append = false, sort: SortBy = 'crawled_date', source = '') => {
    const cacheKey = `${topic}|${sort}|${source}`;
    if (currentSkip === 0 && !append) {
      const cached = _papersCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < PAPERS_TTL) {
        setPapers(cached.papers);
        setHasMore(cached.papers.length < cached.total);
        setLoading(false);
        return;
      }
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const topicFilter = topic === '전체' ? undefined : topic;
      const data = await fetchPapers(topicFilter, undefined, currentSkip, LIMIT, undefined, sort, source || undefined);
      if (currentSkip === 0) {
        _papersCache.set(cacheKey, { ...data, ts: Date.now() });
      }
      setPapers((prev) => (append ? [...prev, ...data.papers] : data.papers));
      setHasMore(currentSkip + data.papers.length < data.total);
    } catch {
      // keep existing state on error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  function buildParams(topic: string, sort: SortBy, source: string) {
    const params = new URLSearchParams();
    if (topic !== '전체') params.set('topic', topic);
    if (sort !== 'crawled_date') params.set('sort', sort);
    if (source) params.set('source', source);
    return params.toString() ? `/?${params}` : '/';
  }

  function handleTopicChange(topic: string) {
    setSelected(topic);
    sessionStorage.removeItem(SCROLL_KEY);
    router.replace(buildParams(topic, sortBy, sourceFilter));
  }

  function handleSortChange(sort: SortBy) {
    setSortBy(sort);
    router.replace(buildParams(selected, sort, sourceFilter));
  }

  function handleSourceChange(source: string) {
    setSourceFilter(source);
    sessionStorage.removeItem(SCROLL_KEY);
    router.replace(buildParams(selected, sortBy, source));
  }

  useEffect(() => {
    setSkip(0);
    load(selected, 0, false, sortBy, sourceFilter);
  }, [selected, sortBy, sourceFilter, load]);

  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    };
    window.addEventListener('beforeunload', saveScroll);
    return () => window.removeEventListener('beforeunload', saveScroll);
  }, []);

  function handleCardClick() {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  }

  useEffect(() => {
    if (!loading && !scrollRestored.current) {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: Number(saved), behavior: 'instant' });
          scrollRestored.current = true;
          sessionStorage.removeItem(SCROLL_KEY);
        });
      } else {
        scrollRestored.current = true;
      }
    }
  }, [loading]);

  function handleLoadMore() {
    const nextSkip = skip + LIMIT;
    setSkip(nextSkip);
    load(selected, nextSkip, true, sortBy, sourceFilter);
  }

  const grouped = groupByDate(papers);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">의학 논문 AI 요약</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">PubMed · bioRxiv 최신 논문을 매일 한국어로 요약합니다</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ThemeToggle />
          <Link
            href="/bookmarks"
            onClick={() => setNavTo('bookmarks')}
            className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            {navTo === 'bookmarks'
              ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <>★ {bookmarks.size > 0 ? bookmarks.size : '저장'}</>}
          </Link>
          <Link
            href="/admin"
            onClick={() => setNavTo('admin')}
            className="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {navTo === 'admin'
              ? <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : '관리자'}
          </Link>
        </div>
      </div>

      <TopicTabs topics={TOPICS} selected={selected} onChange={handleTopicChange} counts={topicCounts.counts} total={topicCounts.total} />

      <div className="py-3 space-y-2.5 border-b border-gray-200 dark:border-gray-700 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 w-7 shrink-0">정렬</span>
          <div className="flex gap-1.5">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSortChange(opt.value)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                  sortBy === opt.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 w-7 shrink-0">출처</span>
          <div className="flex gap-1.5">
            {SOURCE_OPTIONS.map(opt => {
              const count = opt.value !== '' ? (sourceCounts[opt.value] ?? 0) : 0;
              const isActive = sourceFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSourceChange(opt.value)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {opt.label}
                  {count > 0 && (
                    <span className={`text-[11px] font-semibold ${isActive ? 'text-gray-400 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 mt-8 text-center">수집된 논문이 없습니다.</p>
      ) : (
        <>
          {sortBy === 'crawled_date' ? (
            sortedDates.map((date) => (
              <DateSection key={date} date={date} count={grouped[date].length}>
                <div className="flex flex-col gap-3">
                  {grouped[date].map((p) => (
                    <div key={p.id} onClick={handleCardClick}>
                      <PaperCard paper={p} isBookmarked={bookmarks.has(p.id)} onToggleBookmark={toggleBookmark} />
                    </div>
                  ))}
                </div>
              </DateSection>
            ))
          ) : (
            <div className="flex flex-col gap-3">
              {papers.map((p) => (
                <div key={p.id} onClick={handleCardClick}>
                  <PaperCard paper={p} isBookmarked={bookmarks.has(p.id)} onToggleBookmark={toggleBookmark} />
                </div>
              ))}
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? '로딩 중...' : '더 보기'}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
