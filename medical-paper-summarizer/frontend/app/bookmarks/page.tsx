'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PaperCard from '@/src/components/PaperCard';
import { fetchPapers, type Paper } from '@/src/lib/api';

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

export default function BookmarksPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());

  const toggleBookmark = useCallback((id: number) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('bookmarked_papers', JSON.stringify(Array.from(next)));
      return next;
    });
    setPapers(prev => prev.filter(p => {
      const saved = localStorage.getItem('bookmarked_papers');
      const ids: number[] = saved ? JSON.parse(saved) : [];
      return ids.includes(p.id);
    }));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('bookmarked_papers');
    const ids: number[] = saved ? JSON.parse(saved) : [];
    const idSet = new Set<number>(ids);
    setBookmarks(idSet);

    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    fetchPapers(undefined, undefined, 0, 200, ids)
      .then(data => setPapers(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 북마크 해제 시 목록에서 즉시 제거
  useEffect(() => {
    setPapers(prev => prev.filter(p => bookmarks.has(p.id)));
  }, [bookmarks]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
          ← 목록
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          <span className="text-yellow-400 mr-1">★</span>북마크
        </h1>
        {bookmarks.size > 0 && (
          <span className="text-sm text-gray-400">{bookmarks.size}편</span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">북마크한 논문이 없습니다.</p>
          <Link href="/" className="text-blue-500 hover:underline text-sm">
            논문 목록으로 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {papers.map(p => (
            <PaperCard
              key={p.id}
              paper={p}
              isBookmarked={bookmarks.has(p.id)}
              onToggleBookmark={toggleBookmark}
            />
          ))}
        </div>
      )}
    </main>
  );
}
