import type { BuyerLocations, EventTrafficSources, TrafficReferrer } from '@/store/api/trackingApi';

import { mock, type MockHandler } from './mock';

function stats(paidOrders: number, byReferrer: TrafficReferrer[]): EventTrafficSources {
  const totalClicks = byReferrer.reduce((sum, item) => sum + item.total_clicks, 0);
  return {
    total_clicks: totalClicks,
    paid_orders: paidOrders,
    conversion_rate: totalClicks ? Math.round((paidOrders / totalClicks) * 10000) / 100 : 0,
    by_referrer: byReferrer,
  };
}

const trafficByEvent: Record<number, EventTrafficSources> = {
  4101: stats(1036, [
    { referrer: 'https://www.facebook.com/', total_clicks: 2980 },
    { referrer: 'https://l.instagram.com/', total_clicks: 2236 },
    { referrer: null, total_clicks: 1874 },
    { referrer: 'https://eventino.co/', total_clicks: 1105 },
    { referrer: 'https://m.facebook.com/', total_clicks: 432 },
    { referrer: 'https://t.me/', total_clicks: 412 },
    { referrer: 'https://www.google.com/', embedded_on: 'https://www.wineofmoldova.com/', total_clicks: 287 },
    { referrer: 'https://www.vinmoldova.md/evenimente', total_clicks: 160 },
  ]),
  4102: stats(84, [
    { referrer: 'https://l.instagram.com/', total_clicks: 516 },
    { referrer: null, total_clicks: 233 },
    { referrer: 'https://www.facebook.com/', total_clicks: 198 },
    { referrer: 'https://eventino.co/', total_clicks: 71 },
  ]),
  4103: stats(212, [
    { referrer: 'https://www.facebook.com/', total_clicks: 1240 },
    { referrer: 'https://www.iabilet.ro/', embedded_on: 'https://www.clujlive.ro/', total_clicks: 388 },
    { referrer: 'https://eventino.co/', total_clicks: 402 },
    { referrer: null, total_clicks: 296 },
    { referrer: 'https://www.youtube.com/', total_clicks: 64 },
  ]),
  4104: stats(0, []),
  4105: stats(318, [
    { referrer: 'https://l.instagram.com/', total_clicks: 1530 },
    { referrer: 'https://www.facebook.com/', total_clicks: 870 },
    { referrer: null, total_clicks: 610 },
    { referrer: 'https://www.linkedin.com/', total_clicks: 45 },
  ]),
};

const locationsByEvent: Record<number, BuyerLocations> = {
  4101: {
    total_located: 942,
    total_paid: 1036,
    cities: [
      { city: 'Chișinău', country: 'Moldova', lat: 47.0105, lng: 28.8638, orders: 612, tickets: 1104 },
      { city: 'Bălți', country: 'Moldova', lat: 47.7617, lng: 27.9293, orders: 74, tickets: 131 },
      { city: 'Ialoveni', country: 'Moldova', lat: 46.9431, lng: 28.7825, orders: 58, tickets: 97 },
      { city: 'Orhei', country: 'Moldova', lat: 47.3849, lng: 28.8245, orders: 41, tickets: 72 },
      { city: 'Iași', country: 'Romania', lat: 47.1585, lng: 27.6014, orders: 39, tickets: 70 },
      { city: 'Ungheni', country: 'Moldova', lat: 47.2108, lng: 27.8006, orders: 33, tickets: 55 },
      { city: 'Cahul', country: 'Moldova', lat: 45.9075, lng: 28.1944, orders: 28, tickets: 46 },
      { city: 'Bucharest', country: 'Romania', lat: 44.4268, lng: 26.1025, orders: 22, tickets: 38 },
      { city: 'Comrat', country: 'Moldova', lat: 46.2956, lng: 28.655, orders: 15, tickets: 24 },
      { city: 'Soroca', country: 'Moldova', lat: 48.1558, lng: 28.2975, orders: 12, tickets: 20 },
      { city: 'Cluj-Napoca', country: 'Romania', lat: 46.7712, lng: 23.6236, orders: 8, tickets: 14 },
    ],
  },
  4102: {
    total_located: 79,
    total_paid: 84,
    cities: [
      { city: 'Chișinău', country: 'Moldova', lat: 47.0105, lng: 28.8638, orders: 71, tickets: 118 },
      { city: 'Ialoveni', country: 'Moldova', lat: 46.9431, lng: 28.7825, orders: 8, tickets: 12 },
    ],
  },
  4103: {
    total_located: 188,
    total_paid: 212,
    cities: [
      { city: 'Cluj-Napoca', country: 'Romania', lat: 46.7712, lng: 23.6236, orders: 141, tickets: 236 },
      { city: 'Bucharest', country: 'Romania', lat: 44.4268, lng: 26.1025, orders: 27, tickets: 41 },
      { city: 'Oradea', country: 'Romania', lat: 47.0465, lng: 21.9189, orders: 12, tickets: 19 },
      { city: 'Chișinău', country: 'Moldova', lat: 47.0105, lng: 28.8638, orders: 8, tickets: 13 },
    ],
  },
  4105: { total_located: 0, total_paid: 318, cities: [] },
};

const EMPTY_LOCATIONS: BuyerLocations = { cities: [], total_located: 0, total_paid: 0 };

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/tracking/stats/:id/buyer-locations/', ({ params }) => locationsByEvent[Number(params.id)] ?? EMPTY_LOCATIONS),
  mock('GET', '/api/v1/tracking/stats/:id/', ({ params }) => ({
    event_id: Number(params.id),
    ...(trafficByEvent[Number(params.id)] ?? stats(0, [])),
  })),
];
