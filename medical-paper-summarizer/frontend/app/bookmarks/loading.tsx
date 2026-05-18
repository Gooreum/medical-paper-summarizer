export default function BookmarksLoading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-4 animate-pulse bg-white dark:bg-gray-800">
            <div className="flex gap-2 mb-2.5">
              <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded-full" />
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full mb-1" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
