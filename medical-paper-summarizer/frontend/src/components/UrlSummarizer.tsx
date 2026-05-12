'use client';

import { useState } from 'react';
import { summarizeUrl } from '@/src/lib/api';

const TOPICS = [
  '수면', '비만', '당뇨', '고혈압', '심장건강', '스트레스', '장건강',
  '면역', '뇌건강', '운동', '영양', '노화', '암예방', '정신건강',
];

const MODELS = [
  { value: 'sonnet', label: 'Claude Sonnet (기본)' },
  { value: 'opus', label: 'Claude Opus (고품질)' },
  { value: 'haiku', label: 'Claude Haiku (빠름)' },
];

export default function UrlSummarizer() {
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [model, setModel] = useState('sonnet');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: number; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const paper = await summarizeUrl(url.trim(), topic, model);
      setResult({ id: paper.id, title: paper.title });
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '요약 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            논문 URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://pubmed.ncbi.nlm.nih.gov/... 또는 bioRxiv, PDF URL"
            disabled={loading}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 disabled:opacity-50"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              토픽
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              모델
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '요약 중...' : '요약 시작'}
        </button>
      </form>

      {loading && (
        <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-600 dark:text-blue-400">
          논문을 가져오고 요약하는 중입니다. 1~2분 소요될 수 있습니다.
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
          <a
            href={`/papers/${result.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-600"
          >
            논문 보기 →
          </a>
        </div>
      )}
    </div>
  );
}
