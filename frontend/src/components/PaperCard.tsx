import Link from 'next/link';
import type { Paper } from '@/src/lib/api';

type Props = {
  paper: Paper;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: number) => void;
};

function extractOneLiner(summary: string | null): string {
  if (!summary) return '';
  const match = summary.match(/##\s*한 줄 핵심[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  if (match) return match[1].trim().slice(0, 120);
  return summary.slice(0, 120);
}

function formatAuthors(authors: string): string {
  if (!authors) return '';
  const list = authors.split(',');
  if (list.length <= 2) return authors;
  return `${list[0].trim()} 외 ${list.length - 1}명`;
}

export default function PaperCard({ paper, isBookmarked = false, onToggleBookmark }: Props) {
  const src = (paper.source || '').toLowerCase();
  const sourceBadgeColor =
    src === 'pubmed'
      ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
      : src === 'medrxiv'
      ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-200'
      : 'bg-orange-50 text-orange-600 ring-1 ring-orange-200';
  const sourceLabel =
    src === 'pubmed' ? 'PubMed'
    : src === 'medrxiv' ? 'medRxiv'
    : src === 'biorxiv' ? 'bioRxiv'
    : paper.source;
  const preview = extractOneLiner(paper.summary_ko);

  return (
    <div className="group relative border border-gray-200 rounded-xl p-5 hover:border-blue-200 hover:shadow-md transition-all duration-150 bg-white cursor-pointer">
      {/* 카드 전체 클릭 오버레이 */}
      <Link href={`/papers/${paper.id}`} className="absolute inset-0 rounded-xl" aria-label={paper.title} />

      {/* 배지 행 + 북마크 버튼 */}
      <div className="relative z-10 flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sourceBadgeColor}`}>
            {sourceLabel}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {paper.topic}
          </span>
          {paper.abstract_only && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              초록
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark?.(paper.id); }}
          className={`shrink-0 ml-2 text-xl transition-colors ${
            isBookmarked ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'
          }`}
          aria-label="북마크"
        >
          {isBookmarked ? '★' : '☆'}
        </button>
      </div>

      {/* 제목 */}
      <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 leading-snug mb-2 transition-colors">
        {paper.title}
      </h3>

      {/* 한 줄 핵심 */}
      {preview && (
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-3">
          {preview}
        </p>
      )}

      {/* 하단 메타 */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-gray-400 truncate">
            {formatAuthors(paper.authors)}
          </span>
          {paper.published_date && (
            <span className="text-xs text-gray-300">{paper.published_date}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
          {paper.citation_count > 0 && (
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              {paper.citation_count}
            </span>
          )}
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex items-center gap-0.5 text-blue-500 hover:text-blue-700 font-medium"
          >
            원문
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
