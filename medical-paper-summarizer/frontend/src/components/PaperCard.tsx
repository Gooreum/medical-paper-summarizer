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
      ? 'bg-blue-50 text-blue-500'
      : 'bg-gray-100 text-gray-500';
  const sourceLabel =
    src === 'pubmed' ? 'PubMed'
    : src === 'medrxiv' ? 'medRxiv'
    : src === 'biorxiv' ? 'bioRxiv'
    : paper.source;
  const preview = extractOneLiner(paper.summary_ko);

  return (
    <div className="group relative bg-white rounded-2xl p-4 cursor-pointer active:bg-gray-50 transition-colors">
      <Link href={`/papers/${paper.id}`} className="absolute inset-0 rounded-2xl" aria-label={paper.title} />

      {/* 배지 + 북마크 */}
      <div className="relative z-10 flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sourceBadgeColor}`}>
            {sourceLabel}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {paper.topic}
          </span>
          {paper.abstract_only && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
              초록
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark?.(paper.id); }}
          className={`shrink-0 text-lg transition-colors ${
            isBookmarked ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'
          }`}
          aria-label="북마크"
        >
          {isBookmarked ? '★' : '☆'}
        </button>
      </div>

      {/* 제목 */}
      <h3 className="text-[17px] font-semibold text-gray-900 group-hover:text-blue-500 line-clamp-2 leading-snug mb-2 transition-colors">
        {paper.title}
      </h3>

      {/* 한 줄 핵심 */}
      {preview && (
        <p className="text-[14px] text-gray-500 line-clamp-2 leading-relaxed mb-3">
          {preview}
        </p>
      )}

      {/* 하단 메타 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px] text-gray-400 min-w-0">
          {paper.authors && (
            <span className="truncate max-w-[140px]">{formatAuthors(paper.authors)}</span>
          )}
          {paper.published_date && (
            <>
              <span className="shrink-0">·</span>
              <span className="shrink-0">{paper.published_date}</span>
            </>
          )}
          {paper.citation_count > 0 && (
            <>
              <span className="shrink-0">·</span>
              <span className="shrink-0">인용 {paper.citation_count}</span>
            </>
          )}
        </div>
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 shrink-0 text-[13px] text-blue-500 hover:text-blue-600 font-medium ml-3"
        >
          원문 →
        </a>
      </div>
    </div>
  );
}
