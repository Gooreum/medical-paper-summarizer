'use client';

import { useTheme } from './ThemeProvider';

const OPTIONS = [
  { value: 'light' as const, label: '☀️' },
  { value: 'system' as const, label: '💻' },
  { value: 'dark' as const, label: '🌙' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5 gap-0.5">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`w-7 h-7 rounded-full text-sm flex items-center justify-center transition-colors ${
            theme === opt.value
              ? 'bg-white dark:bg-gray-600 shadow-sm'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
          aria-label={opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
