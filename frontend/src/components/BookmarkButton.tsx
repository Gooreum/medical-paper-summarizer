'use client';

import { useState, useEffect } from 'react';

export default function BookmarkButton({ paperId }: { paperId: number }) {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('bookmarked_papers');
    if (saved) {
      const ids: number[] = JSON.parse(saved);
      setBookmarked(ids.includes(paperId));
    }
  }, [paperId]);

  function toggle() {
    const saved = localStorage.getItem('bookmarked_papers');
    const ids: number[] = saved ? JSON.parse(saved) : [];
    let next: number[];
    if (ids.includes(paperId)) {
      next = ids.filter(id => id !== paperId);
      setBookmarked(false);
    } else {
      next = [...ids, paperId];
      setBookmarked(true);
    }
    localStorage.setItem('bookmarked_papers', JSON.stringify(next));
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
        bookmarked
          ? 'bg-yellow-50 border-yellow-300 text-yellow-600 hover:bg-yellow-100'
          : 'bg-white border-gray-200 text-gray-500 hover:border-yellow-300 hover:text-yellow-500'
      }`}
    >
      <span className="text-base">{bookmarked ? '★' : '☆'}</span>
      {bookmarked ? '북마크됨' : '북마크'}
    </button>
  );
}
