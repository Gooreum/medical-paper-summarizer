'use client';

type Props = {
  topics: string[];
  selected: string;
  onChange: (t: string) => void;
  counts?: Record<string, number>;
  total?: number;
};

export default function TopicTabs({ topics, selected, onChange, counts = {}, total = 0 }: Props) {
  const all = ['전체', ...topics];
  return (
    <div className="bg-gray-100 pb-1">
      <div className="flex overflow-x-auto gap-1.5 px-4 py-2.5 scrollbar-hide">
        {all.map((topic) => {
          const isActive = selected === topic;
          const count = topic === '전체' ? total : (counts[topic] ?? 0);
          return (
            <button
              key={topic}
              onClick={() => onChange(topic)}
              className={`flex items-center gap-1 px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap rounded-full transition-all duration-150 shrink-0 ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {topic}
              {count > 0 && (
                <span className={`text-[11px] font-semibold ${
                  isActive ? 'text-blue-200' : 'text-gray-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
