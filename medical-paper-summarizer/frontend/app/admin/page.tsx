'use client';

import { useState, useEffect } from 'react';
import CrawlTrigger from '@/src/components/CrawlTrigger';
import ScheduleSettings from '@/src/components/ScheduleSettings';
import CrawlHistory from '@/src/components/CrawlHistory';
import { getCrawlStatus } from '@/src/lib/api';

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin';

type CrawlStatus = {
  running: boolean;
  progress: string;
  started_at: string | null;
  results: number;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);
  const [status, setStatus] = useState<CrawlStatus | null>(null);

  useEffect(() => {
    if (!authed) return;

    const fetch = () => getCrawlStatus().then((s) => setStatus(s as CrawlStatus)).catch(() => {});
    fetch();

    const id = setInterval(fetch, 2000);
    return () => clearInterval(id);
  }, [authed]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <form
          onSubmit={handleLogin}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 w-80 shadow-sm"
        >
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-6">관리자 로그인</h1>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
          {pwError && (
            <p className="text-xs text-red-500 mb-3">비밀번호가 틀렸습니다.</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            로그인
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">관리자</h1>
        <a href="/" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          ← 목록으로
        </a>
      </div>

      <section className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6 bg-white dark:bg-gray-800">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">자동 크롤링 설정</h2>
        <ScheduleSettings />
      </section>

      <section className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6 bg-white dark:bg-gray-800">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">수동 크롤링</h2>
        <CrawlTrigger />
      </section>

      <section className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6 bg-white dark:bg-gray-800">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">크롤링 상태</h2>
        {status ? (
          <dl className="space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="text-gray-500 dark:text-gray-400 w-24">상태</dt>
              <dd className={status.running ? 'text-blue-500 font-medium' : 'text-gray-700 dark:text-gray-300'}>
                {status.running ? '실행 중' : '대기 중'}
              </dd>
            </div>
            {status.started_at && (
              <div className="flex gap-3">
                <dt className="text-gray-500 dark:text-gray-400 w-24">시작 시간</dt>
                <dd className="text-gray-700 dark:text-gray-300">{new Date(status.started_at).toLocaleString('ko-KR')}</dd>
              </div>
            )}
            <div className="flex gap-3">
              <dt className="text-gray-500 dark:text-gray-400 w-24">수집 논문</dt>
              <dd className="text-gray-700 dark:text-gray-300">{status.results}편</dd>
            </div>
            {status.progress && (
              <div className="flex gap-3">
                <dt className="text-gray-500 dark:text-gray-400 w-24">진행 상황</dt>
                <dd className="text-gray-700 dark:text-gray-300">{status.progress}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">상태를 불러오는 중...</p>
        )}
      </section>

      <section className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-800">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">크롤링 히스토리</h2>
        <CrawlHistory />
      </section>
    </main>
  );
}
