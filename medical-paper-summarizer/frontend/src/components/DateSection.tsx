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
    <section className="mb-8">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {formatDate(date)}
        </span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 shrink-0">
          {count}편
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      {children}
    </section>
  );
}
