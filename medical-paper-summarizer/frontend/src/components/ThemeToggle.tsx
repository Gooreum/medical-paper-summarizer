'use client';

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

const OPTIONS = [
  { value: 'light' as const, label: '☀️', title: '라이트' },
  { value: 'system' as const, label: '💻', title: '시스템' },
  { value: 'dark' as const, label: '🌙', title: '다크' },
];

function apply(t: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (t === 'dark' || (t === 'system' && prefersDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('theme', t);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setTheme(saved);
    }
  }, []);

  function select(t: Theme) {
    setTheme(t);
    apply(t);
  }

  return (
    <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-full p-0.5">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => select(opt.value)}
          title={opt.title}
          className={`w-8 h-8 rounded-full text-sm flex items-center justify-center transition-all ${
            theme === opt.value
              ? 'bg-white dark:bg-gray-500 shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
