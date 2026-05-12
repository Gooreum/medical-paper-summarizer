export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type Paper = {
  id: number;
  title: string;
  authors: string;
  source: string;
  topic: string;
  url: string;
  citation_count: number;
  published_date: string;
  crawled_date: string;
  summary_ko: string | null;
  model_used: string | null;
  doi?: string | null;
  arxiv_id?: string | null;
  abstract_only?: boolean;
  full_text_length?: number | null;
};

export async function fetchPapers(
  topic?: string,
  date?: string,
  skip = 0,
  limit = 50,
  ids?: number[],
  sort?: string,
  source?: string,
): Promise<Paper[]> {
  const params = new URLSearchParams();
  if (topic) params.set('topic', topic);
  if (date) params.set('date', date);
  params.set('skip', String(skip));
  params.set('limit', String(limit));
  if (ids?.length) params.set('ids', ids.join(','));
  if (sort) params.set('sort', sort);
  if (source) params.set('source', source);
  const res = await fetch(`${API_BASE}/api/papers?${params}`);
  if (!res.ok) throw new Error('Failed to fetch papers');
  const data = await res.json();
  return data.papers ?? data;
}

export async function fetchPaper(id: number): Promise<Paper> {
  const res = await fetch(`${API_BASE}/api/papers/${id}`);
  if (!res.ok) throw new Error('Paper not found');
  return res.json();
}

export async function triggerCrawl(topics?: string[], papersPerTopic?: number, sources?: string[], model?: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/crawl/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics, papers_per_topic: papersPerTopic, sources, model }),
  });
  if (!res.ok && res.status !== 409) throw new Error('Failed to trigger crawl');
  return res.json();
}

export async function getCrawlStatus(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/crawl/status`);
  if (!res.ok) throw new Error('Failed to get crawl status');
  return res.json();
}

export async function fetchTopicCounts(): Promise<{ total: number; counts: Record<string, number> }> {
  const res = await fetch(`${API_BASE}/api/topics/counts`);
  if (!res.ok) throw new Error('Failed to fetch topic counts');
  return res.json();
}

export async function fetchSourceCounts(): Promise<{ total: number; counts: Record<string, number> }> {
  const res = await fetch(`${API_BASE}/api/sources/counts`);
  if (!res.ok) throw new Error('Failed to fetch source counts');
  return res.json();
}

export type ScheduleConfig = {
  enabled: boolean;
  hour: number;
  minute: number;
  topics: string[];
  papers_per_topic: number;
  sources: string[];
  model: string | null;
};

export async function getScheduleConfig(): Promise<ScheduleConfig> {
  const res = await fetch(`${API_BASE}/api/schedule`);
  if (!res.ok) throw new Error('Failed to fetch schedule config');
  return res.json();
}

export async function updateScheduleConfig(config: ScheduleConfig): Promise<ScheduleConfig> {
  const res = await fetch(`${API_BASE}/api/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update schedule config');
  return res.json();
}

export type CrawlSessionSummary = {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed';
  topics: string[];
  sources: string[];
  papers_per_topic: number;
  total_saved: number;
  total_skipped: number;
  total_failed: number;
};

export type CrawlEventItem = {
  id: number;
  event_type: 'collected' | 'skipped' | 'summarized' | 'failed';
  topic: string;
  source: string;
  title: string;
  reason: string | null;
  created_at: string | null;
};

export type CrawlHistoryListResponse = {
  total: number;
  page: number;
  limit: number;
  sessions: CrawlSessionSummary[];
};

export type CrawlHistoryDetailResponse = {
  session: CrawlSessionSummary;
  counts: Record<string, number>;
  total: number;
  page: number;
  limit: number;
  events: CrawlEventItem[];
};

export async function fetchCrawlHistory(page = 1, limit = 10): Promise<CrawlHistoryListResponse> {
  const res = await fetch(`${API_BASE}/api/crawl/history?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch crawl history');
  return res.json();
}

export async function summarizeUrl(url: string, topic: string, model?: string): Promise<Paper> {
  const res = await fetch(`${API_BASE}/api/papers/summarize-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, topic, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '요청 실패' }));
    throw new Error(err.detail || '요청 실패');
  }
  return res.json();
}

export async function fetchCrawlHistoryDetail(
  sessionId: number,
  eventType = 'all',
  page = 1,
  limit = 50,
): Promise<CrawlHistoryDetailResponse> {
  const res = await fetch(
    `${API_BASE}/api/crawl/history/${sessionId}?event_type=${eventType}&page=${page}&limit=${limit}`,
  );
  if (!res.ok) throw new Error('Failed to fetch crawl history detail');
  return res.json();
}
