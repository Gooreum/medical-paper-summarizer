'use client';

import { useState, useEffect } from 'react';

function isDark(): boolean {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDark());
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    applyDark(next);
  }

  return (
    <button
      onClick={toggle}
      title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
    >
      {dark ? '🌙' : '☀️'}
    </button>
  );
}
