import React from 'react';

type Props = {
  date: string;
  count: number;
  children: React.ReactNode;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function DateSection({ date, count, children }: Props) {
  return (
    <section className="mb-3">
      <div className="flex items-center gap-1.5 px-1 mb-2">
        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
          {formatDate(date)}
        </span>
        <span className="text-[12px] text-gray-400 dark:text-gray-500">{count}편</span>
      </div>
      {children}
    </section>
  );
}
