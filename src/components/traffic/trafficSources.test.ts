import { groupReferrers, placeLabels, projectCities, sharePercent, sourceDisplayName } from './trafficSources';

describe('groupReferrers', () => {
  it('merges the same source per embed site and sorts by clicks', () => {
    const grouped = groupReferrers([
      { referrer: 'https://m.facebook.com/', total_clicks: 10 },
      { referrer: 'https://www.facebook.com/story', total_clicks: 5 },
      { referrer: 'https://www.google.com/', embedded_on: 'https://www.wineofmoldova.com/', total_clicks: 20 },
      { referrer: 'https://google.com/', total_clicks: 2 },
      { referrer: null, total_clicks: 7 },
      { referrer: 'direct', total_clicks: 1 },
    ]);
    expect(grouped.map((source) => [source.key, source.totalClicks])).toEqual([
      ['google.com|wineofmoldova.com', 20],
      ['facebook.com|', 15],
      ['direct|', 8],
      ['google.com|', 2],
    ]);
  });
});

describe('sourceDisplayName', () => {
  it('names known networks, hosts and direct traffic', () => {
    expect(sourceDisplayName('https://l.instagram.com/', 'Direct')).toBe('Instagram');
    expect(sourceDisplayName('https://www.vinmoldova.md/evenimente', 'Direct')).toBe('vinmoldova.md');
    expect(sourceDisplayName('', 'Direct')).toBe('Direct');
  });
});

describe('sharePercent', () => {
  it('rounds to two decimals and guards zero totals', () => {
    expect(sharePercent(1876, 5214)).toBe(35.98);
    expect(sharePercent(3, 0)).toBe(0);
  });
});

describe('projectCities', () => {
  const city = (name: string, lat: number, lng: number, orders: number) => ({ city: name, country: 'Moldova', lat, lng, orders, tickets: orders });

  it('centres a single city', () => {
    const [marker] = projectCities([city('Chișinău', 47.01, 28.86, 10)], 300, 200, 20);
    expect(marker.x).toBe(150);
    expect(marker.y).toBe(100);
    expect(marker.r).toBe(18);
  });

  it('keeps every city inside the padded box and north above south', () => {
    const markers = projectCities(
      [city('Bălți', 47.76, 27.93, 74), city('Cahul', 45.91, 28.19, 28), city('Bucharest', 44.43, 26.1, 22)],
      300,
      200,
      20,
    );
    markers.forEach((marker) => {
      expect(marker.x).toBeGreaterThanOrEqual(20);
      expect(marker.x).toBeLessThanOrEqual(280);
      expect(marker.y).toBeGreaterThanOrEqual(20);
      expect(marker.y).toBeLessThanOrEqual(180);
    });
    expect(markers[0].y).toBeLessThan(markers[2].y);
  });
});

describe('placeLabels', () => {
  it('skips a label that would overlap one already placed', () => {
    const marker = (label: string, x: number, y: number) => ({ key: label, label, x, y, r: 6 });
    const labels = placeLabels([marker('Chișinău', 100, 100), marker('Ialoveni', 100, 102), marker('Cahul', 100, 160)], 300);
    expect(labels.map((label) => label.text)).toEqual(['Chișinău', 'Ialoveni', 'Cahul']);
    expect(labels[0].anchor).not.toBe(labels[1].anchor);
    const crowded = placeLabels([marker('A', 100, 100), marker('B', 100, 101), marker('C', 100, 102)], 300);
    expect(crowded).toHaveLength(2);
  });
});
