'use client';

import { useState, useEffect } from 'react';
import { getScheduleConfig, updateScheduleConfig, type ScheduleConfig } from '@/src/lib/api';

const ALL_TOPICS = ['근비대', '해부학', '자세교정', '영양학', '탈모치료', '노화', '웨이트 트레이닝', '수면', '다이어트'];
const ALL_SOURCES = ['pubmed', 'biorxiv', 'koreamed'];
const CLAUDE_MODELS = [
  { id: null, label: '기본 (환경변수)' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
];

export default function ScheduleSettings() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScheduleConfig().then(setConfig).catch(() => setError('설정을 불러오지 못했습니다'));
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateScheduleConfig(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">{error ?? '불러오는 중...'}</p>;
  }

  return (
    <div className="space-y-5">
      {/* 활성화 토글 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">자동 크롤링 활성화</span>
        <button
          onClick={() => setConfig(c => c ? { ...c, enabled: !c.enabled } : c)}
          className={`relative w-11 h-6 rounded-full transition-colors ${config.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${config.enabled ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>

      {/* 실행 시간 */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 shrink-0">실행 시간</span>
        <select
          value={config.hour}
          onChange={e => setConfig(c => c ? { ...c, hour: Number(e.target.value) } : c)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>
          ))}
        </select>
        <select
          value={config.minute}
          onChange={e => setConfig(c => c ? { ...c, minute: Number(e.target.value) } : c)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {[0, 15, 30, 45].map(m => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
          ))}
        </select>
      </div>

      {/* 수집 토픽 */}
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">수집 토픽</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ALL_TOPICS.map(t => (
            <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={config.topics.includes(t)}
                onChange={e => setConfig(c => c ? {
                  ...c,
                  topics: e.target.checked ? [...c.topics, t] : c.topics.filter(x => x !== t),
                } : c)}
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      {/* 토픽당 편수 */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 shrink-0">토픽당 편수</span>
        <input
          type="number"
          min={1}
          max={20}
          value={config.papers_per_topic}
          onChange={e => setConfig(c => c ? { ...c, papers_per_topic: Number(e.target.value) } : c)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm w-16 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <span className="text-xs text-gray-400 dark:text-gray-500">편 (최대 20)</span>
      </div>

      {/* 수집 소스 */}
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">수집 소스</span>
        <div className="flex gap-4">
          {ALL_SOURCES.map(s => (
            <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={config.sources.includes(s)}
                onChange={e => setConfig(c => c ? {
                  ...c,
                  sources: e.target.checked ? [...c.sources, s] : c.sources.filter(x => x !== s),
                } : c)}
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      {/* 요약 모델 */}
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">요약 모델</span>
        <div className="flex flex-wrap gap-4">
          {CLAUDE_MODELS.map(m => (
            <label key={String(m.id)} className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                checked={config.model === m.id}
                onChange={() => setConfig(c => c ? { ...c, model: m.id } : c)}
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {/* 저장 */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">✓ 저장됨</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}
