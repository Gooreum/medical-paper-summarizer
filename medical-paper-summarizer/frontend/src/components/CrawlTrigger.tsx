'use client';

import { useState, useRef, useEffect } from 'react';
import { API_BASE, triggerCrawl } from '../lib/api';

const ALL_TOPICS = ['근비대', '해부학', '자세교정', '영양학', '탈모치료', '노화', '웨이트 트레이닝', '수면', '다이어트'];

const SOURCE_OPTIONS = [
  { id: 'pubmed', label: 'PubMed', description: '피어리뷰 논문' },
  { id: 'biorxiv', label: 'bioRxiv / medRxiv', description: '프리프린트' },
  { id: 'koreamed', label: 'KoreaMed', description: '한국 의학 저널' },
];

const CLAUDE_MODELS = [
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
];

export default function CrawlTrigger() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(ALL_TOPICS);
  const [selectedSources, setSelectedSources] = useState<string[]>(['pubmed', 'biorxiv']);
  const [papersPerTopic, setPapersPerTopic] = useState(5);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6');
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoScroll]);

  function toggleTopic(t: string) {
    setSelectedTopics(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  }

  function toggleSource(s: string) {
    setSelectedSources(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  async function handleCrawl() {
    if (selectedTopics.length === 0 || selectedSources.length === 0) return;
    setRunning(true);
    setDone(null);
    setLogs(['크롤링 시작...']);

    try {
      await triggerCrawl(selectedTopics, papersPerTopic, selectedSources, selectedModel);
    } catch {
      // 409 = already running
    }

    if (esRef.current) esRef.current.close();
    const es = new EventSource(`${API_BASE}/api/crawl/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.new_logs?.length > 0) {
          setLogs(prev => [...prev, ...data.new_logs]);
        }
        if (!data.running) {
          setDone(`완료: ${data.results_count ?? 0}편 수집`);
          setRunning(false);
          es.close();
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      es.close();
      setRunning(false);
    };
  }

  return (
    <div className="space-y-4">
      {/* 논문 채널 선택 */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">논문 채널</p>
        <div className="flex flex-wrap gap-3">
          {SOURCE_OPTIONS.map(src => (
            <label
              key={src.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                selectedSources.includes(src.id)
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-400'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-500'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSources.includes(src.id)}
                onChange={() => toggleSource(src.id)}
                disabled={running}
                className="accent-indigo-600"
              />
              <span className="text-sm font-medium">{src.label}</span>
              <span className="text-xs opacity-60">{src.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 토픽 선택 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">토픽</p>
          <button
            onClick={() => setSelectedTopics(selectedTopics.length === ALL_TOPICS.length ? [] : ALL_TOPICS)}
            disabled={running}
            className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-50"
          >
            {selectedTopics.length === ALL_TOPICS.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_TOPICS.map(t => (
            <button
              key={t}
              onClick={() => toggleTopic(t)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selectedTopics.includes(t)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 모델 선택 */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">요약 모델</p>
        <div className="flex gap-4 flex-wrap">
          {CLAUDE_MODELS.map(m => (
            <label key={m.id} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={selectedModel === m.id}
                onChange={() => setSelectedModel(m.id)}
                disabled={running}
                className="accent-indigo-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 토픽당 논문 수 */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600 dark:text-gray-300">토픽당 논문 수</label>
        <input
          type="number"
          min={1}
          max={20}
          value={papersPerTopic}
          onChange={e => setPapersPerTopic(Math.max(1, Math.min(20, Number(e.target.value))))}
          disabled={running}
          className="w-16 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <span className="text-xs text-gray-400 dark:text-gray-500">최대 20</span>
      </div>

      {/* 크롤링 버튼 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCrawl}
          disabled={running || selectedTopics.length === 0 || selectedSources.length === 0}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {running && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          지금 크롤링
        </button>
        {done && <span className="text-sm text-green-600 dark:text-green-400 font-medium">{done}</span>}
      </div>

      {/* 로그 패널 */}
      {logs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">크롤링 로그</p>
            <button
              onClick={() => setAutoScroll(v => !v)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                autoScroll ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              자동스크롤 {autoScroll ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 h-72 overflow-y-auto font-mono text-xs">
            {logs.map((line, i) => (
              <div key={i} className={`leading-5 ${
                line.includes('완료 ✓') ? 'text-green-400' :
                line.includes('스킵') ? 'text-yellow-400' :
                line.includes('오류') ? 'text-red-400' :
                line.includes('요약 중') ? 'text-blue-300' :
                'text-gray-300'
              }`}>
                {line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
