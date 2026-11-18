import { z } from 'zod';
import { call, qs } from '@/infrastructure/news/news-http';

/** Estadísticas de noticias (backend: exige news.analytics; limitado a las dependencias del usuario). */

const n = z.number();
const ratio = z.number().nullable(); // null = base cero (no se inventa un 0 %)

const totalsSchema = z.object({
  page_views: n,
  unique_visitors: n,
  sessions: n,
  active_seconds: n,
  engaged: n,
  news_viewed: n,
  shares: n,
  news_published: n,
  avg_active_per_view: ratio,
  avg_active_per_session: ratio,
  engaged_rate: ratio,
  share_rate: ratio,
  avg_views_per_news: ratio,
});
const countSchema = z.object({ key: z.string(), page_views: n });
const rowSchema = z.object({
  id: n,
  slug: z.string(),
  title: z.string(),
  category_id: n,
  published_at: z.string().nullable(),
  views: n,
  prev_views: n,
  visitors: n,
  shares: n,
  active_seconds: n,
  avg_active: ratio,
  engaged_rate: ratio,
  growth: n,
});
const pointSchema = z.object({
  period: z.string(),
  page_views: n,
  unique_visitors: n,
  sessions: n,
  active_seconds: n,
  shares: n,
});
const overviewSchema = z.object({
  period: z.object({
    start: z.string(),
    end: z.string(),
    previous_start: z.string(),
    previous_end: z.string(),
    granularity: z.enum(['day', 'week', 'month', 'year']),
  }),
  totals: totalsSchema,
  previous: totalsSchema,
  timeline: z.array(pointSchema),
  previous_timeline: z.array(pointSchema),
  sources: z.array(countSchema),
  devices: z.array(countSchema),
  browsers: z.array(countSchema),
  os: z.array(countSchema),
  referrers: z.array(countSchema),
  channels: z.array(z.object({ key: z.string(), shares: n })),
  read_distribution: z.array(countSchema),
  navigation: z.object({ entries: n, from_other_news: n }),
  min_views_for_averages: n,
});
const generalSchema = overviewSchema.extend({
  top: z.object({
    views: z.array(rowSchema),
    shares: z.array(rowSchema),
    avg_active: z.array(rowSchema),
    growth: z.array(rowSchema),
    low: z.array(rowSchema),
  }),
});
const detailSchema = overviewSchema.extend({
  title: z.string(),
  slug: z.string(),
  status: z.string(),
  published_at: z.string().nullable(),
  news: rowSchema.nullable(),
  comparison: z.object({ peers: n, peer_avg_views: n, peer_avg_active: ratio, percentile: n }).nullable(),
});
const liveSchema = z.object({
  at: z.string(),
  window_seconds: n,
  active_readers: n,
  views_last_30_min: n,
  reading_now: z.array(z.object({ id: n, title: z.string(), readers: n })),
});
export type LiveStats = z.infer<typeof liveSchema>;
const rankingSchema = z.object({ total: n, page: n, page_size: n, items: z.array(rowSchema) });

export type Point = z.infer<typeof pointSchema>;
export type Totals = z.infer<typeof totalsSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type GeneralStats = z.infer<typeof generalSchema>;
export type NewsStats = z.infer<typeof detailSchema>;
export type RankingRow = z.infer<typeof rowSchema>;
export type RankingSort =
  'views' | 'visitors' | 'shares' | 'avg_active' | 'engaged_rate' | 'growth' | 'published_at' | 'title';

export interface StatsFilter {
  start_date?: string;
  end_date?: string;
  category_id?: number;
  scope_type?: string;
  scope_id?: number;
  device?: string;
  channel?: string;
  granularity?: string;
}

type Ranking = StatsFilter & {
  min_views?: number;
  sort: RankingSort;
  order: 'asc' | 'desc';
  page: number;
  page_size: number;
};

export const analyticsApi = {
  overview: (f: StatsFilter) => call(`/news/analytics/overview${qs({ ...f })}`, generalSchema),
  ranking: (f: Ranking) => call(`/news/analytics/news${qs({ ...f })}`, rankingSchema),
  live: (f: StatsFilter, newsId?: number) =>
    call(`/news/analytics/live${qs({ ...f, news_id: newsId })}`, liveSchema),
  news: (id: number, f: StatsFilter) => call(`/news/${id}/analytics${qs({ ...f })}`, detailSchema),
};
