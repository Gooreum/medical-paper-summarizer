export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg mb-6 animate-pulse" />
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6 mb-6 animate-pulse">
        <div className="flex gap-2 mb-4">
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-5 w-20 bg-gray-100 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-6" />
        <div className="h-10 w-28 bg-blue-200 dark:bg-blue-900/40 rounded-xl" />
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 mb-5 animate-pulse">
        <div className="h-5 w-24 bg-blue-200 dark:bg-blue-800/40 rounded mb-3" />
        <div className="h-4 bg-blue-100 dark:bg-blue-800/30 rounded w-full mb-2" />
        <div className="h-4 bg-blue-100 dark:bg-blue-800/30 rounded w-2/3" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 animate-pulse">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full mb-2" />
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-4/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
