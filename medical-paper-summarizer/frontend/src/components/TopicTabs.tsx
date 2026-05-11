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
    <div className="relative mb-6">
      <div className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
        {all.map((topic) => {
          const isActive = selected === topic;
          const count = topic === '전체' ? total : (counts[topic] ?? 0);
          return (
            <button
              key={topic}
              onClick={() => onChange(topic)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-all duration-150 shrink-0 ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {topic}
              {count > 0 && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-blue-400 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
    </div>
  );
}
