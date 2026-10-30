import type { OrgTrafficReferrerStat, OrgTrafficStats } from '@/store/api/trafficApi';

import { mock, type MockHandler } from './mock';

const referrers: Omit<OrgTrafficReferrerStat, 'percentage'>[] = [
  { referrer: 'https://l.instagram.com/', total_clicks: 1876 },
  { referrer: '', total_clicks: 1342 },
  { referrer: 'https://m.facebook.com/', total_clicks: 1108 },
  { referrer: 'https://eventino.co/', total_clicks: 612 },
  { referrer: 'https://www.google.com/', total_clicks: 189 },
  { referrer: 'https://t.me/', total_clicks: 87 },
];

const totalClicks = referrers.reduce((sum, item) => sum + item.total_clicks, 0);

const profileTraffic: OrgTrafficStats = {
  total_clicks: totalClicks,
  event_count: 6,
  by_referrer: referrers.map((item) => ({
    ...item,
    percentage: Math.round((item.total_clicks / totalClicks) * 10000) / 100,
  })),
};

export const handlers: MockHandler[] = [mock('GET', '/api/v1/tracking/stats/', profileTraffic)];
