'use client';

import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6"
    >
      ← 목록으로
    </button>
  );
}
