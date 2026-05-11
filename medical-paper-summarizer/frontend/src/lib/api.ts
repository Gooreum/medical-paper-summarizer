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
