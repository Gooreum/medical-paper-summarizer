'use client';

import { useTheme } from './ThemeProvider';

const OPTIONS = [
  { value: 'light' as const, label: '☀️', title: '라이트' },
  { value: 'system' as const, label: '💻', title: '시스템' },
  { value: 'dark' as const, label: '🌙', title: '다크' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-full p-0.5">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
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
