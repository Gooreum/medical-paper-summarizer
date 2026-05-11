'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TopicTabs from '@/src/components/TopicTabs';
import DateSection from '@/src/components/DateSection';
import PaperCard from '@/src/components/PaperCard';
import { fetchPapers, fetchTopicCounts, type Paper } from '@/src/lib/api';

const TOPICS = ['근비대', '해부학', '자세교정', '영양학', '탈모치료', '노화', '웨이트 트레이닝', '수면', '다이어트', '북마크'];
const LIMIT = 50;
const SCROLL_KEY = 'home_scroll';

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
    <div className="border border-gray-200 rounded-lg p-4 animate-pulse bg-white">
      <div className="flex gap-2 mb-2">
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-full mb-1" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
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
  const [topicCounts, setTopicCounts] = useState<{ total: number; counts: Record<string, number> }>({ total: 0, counts: {} });
  const scrollRestored = useRef(false);

  const [bookmarks, setBookmarks] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    const saved = localStorage.getItem('bookmarked_papers');
    return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
  });

  const toggleBookmark = useCallback((id: number) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('bookmarked_papers', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const load = useCallback(async (topic: string, currentSkip: number, append = false, bookmarkIds?: number[]) => {
    if (currentSkip === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      if (topic === '북마크') {
        if (!bookmarkIds || bookmarkIds.length === 0) {
          setPapers([]);
          setHasMore(false);
          return;
        }
        const data = await fetchPapers(undefined, undefined, currentSkip, LIMIT, bookmarkIds);
        setPapers((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === LIMIT);
      } else {
        const topicParam = topic === '전체' ? undefined : topic;
        const data = await fetchPapers(topicParam, undefined, currentSkip, LIMIT);
        setPapers((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === LIMIT);
      }
    } catch {
      // keep existing state on error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // 토픽 변경 → URL 업데이트
  function handleTopicChange(topic: string) {
    setSelected(topic);
    sessionStorage.removeItem(SCROLL_KEY);
    const params = new URLSearchParams();
    if (topic !== '전체') params.set('topic', topic);
    router.replace(params.toString() ? `/?${params}` : '/');
  }

  // 토픽 바뀌면 데이터 로드
  useEffect(() => {
    setSkip(0);
    load(selected, 0, false, selected === '북마크' ? Array.from(bookmarks) : undefined);
  }, [selected, load]); // bookmarks 변경은 북마크 탭에서 직접 처리

  // 토픽 카운트 로드
  useEffect(() => {
    fetchTopicCounts().then(setTopicCounts).catch(() => {});
  }, []);

  // 스크롤 위치 저장 (페이지 이탈 전)
  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    };
    window.addEventListener('beforeunload', saveScroll);
    return () => window.removeEventListener('beforeunload', saveScroll);
  }, []);

  // PaperCard 클릭 시 스크롤 저장
  function handleCardClick() {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  }

  // 로딩 완료 후 스크롤 복원
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
    load(selected, nextSkip, true, selected === '북마크' ? Array.from(bookmarks) : undefined);
  }

  const grouped = groupByDate(papers);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">의학 논문 AI 요약</h1>
          <p className="text-sm text-gray-400">PubMed · bioRxiv 최신 논문을 매일 한국어로 요약합니다</p>
        </div>
        <a href="/admin" className="text-xs text-gray-400 hover:text-gray-600 mt-1">
          관리자
        </a>
      </div>

      <TopicTabs topics={TOPICS} selected={selected} onChange={handleTopicChange} counts={topicCounts.counts} total={topicCounts.total} />

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <p className="text-gray-500 mt-8 text-center">수집된 논문이 없습니다.</p>
      ) : (
        <>
          {sortedDates.map((date) => (
            <DateSection key={date} date={date} count={grouped[date].length}>
              <div className="flex flex-col gap-3">
                {grouped[date].map((p) => (
                  <div key={p.id} onClick={handleCardClick}>
                    <PaperCard paper={p} isBookmarked={bookmarks.has(p.id)} onToggleBookmark={toggleBookmark} />
                  </div>
                ))}
              </div>
            </DateSection>
          ))}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
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
