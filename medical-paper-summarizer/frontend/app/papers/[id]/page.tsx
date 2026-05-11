import { fetchPaper } from '@/src/lib/api';
import Link from 'next/link';
import BackButton from '@/src/components/BackButton';
import BookmarkButton from '@/src/components/BookmarkButton';

type Props = { params: { id: string } };

const SECTION_ICONS: Record<string, string> = {
  '한 줄 핵심': '💡',
  '왜 이 연구를 했나': '🔍',
  '어떻게 연구했나': '🧪',
  '무엇을 발견했나': '📊',
  '어려운 용어 풀이': '📖',
  '내 삶에서의 의미': '🌱',
  '오늘부터 실천하는 방법': '✅',
  '주의할 점': '⚠️',
};

function cleanBody(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('>'))  // blockquote 제거
    .filter(line => !/^-{3,}$/.test(line.trim()))        // --- 제거
    .join('\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')                    // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')                        // *italic* → italic
    .trim();
}

function parseSections(summary: string): { heading: string; body: string }[] {
  const parts = summary.split(/\n(?=##\s)/);
  return parts
    .filter(part => part.trimStart().startsWith('##'))
    .map((part) => {
      const newline = part.indexOf('\n');
      if (newline === -1) return { heading: part.replace(/^##\s*/, ''), body: '' };
      return {
        heading: part.slice(0, newline).replace(/^##\s*/, '').trim(),
        body: cleanBody(part.slice(newline + 1)),
      };
    })
    .filter((s) => s.heading);
}

export default async function PaperDetailPage({ params }: Props) {
  let paper;
  try {
    paper = await fetchPaper(Number(params.id));
  } catch {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">논문을 찾을 수 없습니다.</p>
        <Link href="/" className="mt-4 inline-block text-blue-500 hover:underline">목록으로</Link>
      </main>
    );
  }

  const srcLower = (paper.source || '').toLowerCase();
  const isPubMed = srcLower === 'pubmed';
  const isMedRxiv = srcLower === 'medrxiv';
  const isBioRxiv = srcLower === 'biorxiv';
  const sourceLabel = isPubMed ? 'PubMed' : isMedRxiv ? 'medRxiv' : isBioRxiv ? 'bioRxiv' : paper.source;
  const sourceBadgeClass = isPubMed
    ? 'bg-blue-100 text-blue-700'
    : isMedRxiv
    ? 'bg-purple-100 text-purple-700'
    : 'bg-orange-100 text-orange-700';
  const sections = paper.summary_ko ? parseSections(paper.summary_ko) : [];
  const highlightSection = sections.find(s => s.heading === '한 줄 핵심');
  const otherSections = sections.filter(s => s.heading !== '한 줄 핵심');

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <BackButton />

      {/* 헤더 카드 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        {/* 배지 */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sourceBadgeClass}`}>
            {sourceLabel}
          </span>
          {paper.topic && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              {paper.topic}
            </span>
          )}
          {!isPubMed && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
              피어리뷰 미완료
            </span>
          )}
          {paper.abstract_only && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              초록 기반 요약
            </span>
          )}
        </div>

        {/* 제목 */}
        <h1 className="text-xl font-bold text-gray-900 leading-snug mb-3">{paper.title}</h1>

        {/* 메타 */}
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{paper.authors}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          {paper.published_date && <span>📅 {paper.published_date}</span>}
          {paper.citation_count > 0 && <span>📌 인용 {paper.citation_count}회</span>}
          {paper.full_text_length != null && paper.full_text_length > 0 && (
            <span>📄 {paper.full_text_length.toLocaleString()}자</span>
          )}
        </div>

        {/* 원문 + 북마크 버튼 */}
        <div className="mt-5 flex items-center gap-3">
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            원문 보기 →
          </a>
          <BookmarkButton paperId={paper.id} />
        </div>
      </div>

      {/* 한 줄 핵심 강조 박스 */}
      {highlightSection && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💡</span>
            <span className="text-sm font-semibold text-blue-700">한 줄 핵심</span>
          </div>
          <p className="text-gray-800 font-medium leading-relaxed">{highlightSection.body}</p>
        </div>
      )}

      {/* 나머지 섹션들 */}
      {otherSections.length > 0 && (
        <div className="space-y-4">
          {otherSections.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{SECTION_ICONS[s.heading] ?? '📝'}</span>
                <h2 className="text-sm font-semibold text-gray-800">{s.heading}</h2>
              </div>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.body}</div>
            </div>
          ))}
        </div>
      )}

      {sections.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          요약이 아직 생성되지 않았습니다.
        </div>
      )}
    </main>
  );
}
