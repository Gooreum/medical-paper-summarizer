'use client';

import Link from 'next/link';
import { useState } from 'react';
import { summarizeUrl, summarizeText } from '@/src/lib/api';

const TOPICS = [
  '수면', '비만', '당뇨', '고혈압', '심장건강', '스트레스', '장건강',
  '면역', '뇌건강', '운동', '영양', '노화', '암예방', '정신건강',
];

const MODELS = [
  { value: 'sonnet', label: 'Sonnet (기본)' },
  { value: 'opus', label: 'Opus (고품질)' },
  { value: 'haiku', label: 'Haiku (빠름)' },
];

type Mode = 'url' | 'text';

export default function UrlSummarizer() {
  const [mode, setMode] = useState<Mode>('url');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [model, setModel] = useState('sonnet');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: number; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // URL mode
  const [url, setUrl] = useState('');

  // Text mode
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [paperUrl, setPaperUrl] = useState('');
  const [text, setText] = useState('');

  // Common
  const [citationCount, setCitationCount] = useState<number>(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let paper;
      if (mode === 'url') {
        if (!url.trim()) return;
        paper = await summarizeUrl(url.trim(), topic, model, citationCount || undefined);
      } else {
        if (!title.trim() || !text.trim()) return;
        paper = await summarizeText(title.trim(), text.trim(), topic, model, authors.trim() || undefined, paperUrl.trim() || undefined, citationCount || undefined);
      }
      setResult({ id: paper.id, title: paper.title });
      if (mode === 'url') setUrl('');
      else { setTitle(''); setAuthors(''); setPaperUrl(''); setText(''); }
    } catch (err) {
      setError(err instanceof Error ? err.message : '요약 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = mode === 'url' ? url.trim().length > 0 : title.trim().length > 0 && text.trim().length >= 100;

  return (
    <div>
      {/* 모드 탭 */}
      <div className="flex gap-1 mb-4 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl w-fit">
        {(['url', 'text'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); setResult(null); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {m === 'url' ? 'URL 입력' : '텍스트 직접 입력'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'url' ? (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">논문 URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://pubmed.ncbi.nlm.nih.gov/... 또는 bioRxiv, PDF URL"
              disabled={loading}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 disabled:opacity-50"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">제목 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="논문 제목"
                disabled={loading}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">저자 (선택)</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Lavie CJ, Osman AF, ..."
                  disabled={loading}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 disabled:opacity-50"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">원문 URL (선택)</label>
                <input
                  type="url"
                  value={paperUrl}
                  onChange={(e) => setPaperUrl(e.target.value)}
                  placeholder="https://pubmed.ncbi.nlm.nih.gov/..."
                  disabled={loading}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                초록 / 본문 * <span className="text-gray-400 font-normal">({text.length}자)</span>
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="논문의 초록이나 전문을 여기에 붙여넣으세요 (최소 100자)"
                disabled={loading}
                rows={7}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 disabled:opacity-50 resize-y font-mono"
              />
            </div>
          </>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">토픽</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
            >
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">모델</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
            >
              {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">인용수 (선택)</label>
            <input
              type="number"
              min={0}
              value={citationCount}
              onChange={(e) => setCitationCount(Math.max(0, Number(e.target.value)))}
              disabled={loading}
              className="w-24 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '요약 중...' : '요약 시작'}
        </button>
      </form>

      {loading && (
        <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-600 dark:text-blue-400">
          논문을 요약하는 중입니다. 1~2분 소요될 수 있습니다.
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">요약 완료!</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">{result.title}</p>
          <Link href={`/papers/${result.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-600">
            논문 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
