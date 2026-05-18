export default function AdminLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      {[160, 120, 200, 140, 200].map((h, i) => (
        <div
          key={i}
          className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6 bg-white dark:bg-gray-800 animate-pulse"
          style={{ minHeight: h }}
        >
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-4/5" />
          </div>
        </div>
      ))}
    </main>
  );
}
