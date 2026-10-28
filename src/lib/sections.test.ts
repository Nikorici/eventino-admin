import type { EventDetail, User } from '@/types/api';

import { sectionAccess, visibleSections } from './sections';

const owner: User = { id: 1, email: 'owner@example.com', is_staff: false };
const helper: User = { id: 2, email: 'helper@example.com', is_staff: false };

function event(overrides: Partial<EventDetail>): EventDetail {
  return { owner: { id: 1, first_name: '', last_name: '', organization_name: null, profile_image: null }, ...overrides } as EventDetail;
}

function keys(tab: Parameters<typeof visibleSections>[0], user: User, detail: EventDetail | null, stickers = false) {
  return visibleSections(tab, sectionAccess({ user, event: detail, hasStickerAccess: stickers })).flatMap((group) =>
    group.items.map((item) => item.key),
  );
}

describe('sections visibility mirrors the web sidebar', () => {
  it('gives the owner every event link, pre-sale only when enabled', () => {
    expect(keys('sales', owner, event({ has_presale: false }))).not.toContain('event-presale');
    expect(keys('sales', owner, event({ has_presale: true }))).toContain('event-presale');
    expect(keys('manage', owner, event({}))).toHaveLength(9);
  });

  it('shows a view-analytics staff member only Ticket Purchase Info', () => {
    const detail = event({
      is_staff_member: true,
      staff_permissions: {
        permission: 'custom',
        can_view_buyers: false,
        can_view_analytics: true,
        can_manage_tickets: false,
        can_manage_orders: false,
        can_manage_forms: false,
        can_manage_scanners: false,
      },
    });
    expect(keys('sales', helper, detail)).toEqual(['event-ticket-info']);
    expect(keys('analytics', helper, detail)).toEqual([]);
    expect(keys('manage', helper, detail)).toEqual([]);
  });

  it('hides event links until the event loads', () => {
    expect(keys('sales', owner, null)).toEqual([]);
  });

  it('gates Admin Events and Stickers on staff or sticker access', () => {
    expect(keys('more', owner, null)).not.toContain('admin-events');
    expect(keys('more', owner, null)).not.toContain('stickers');
    expect(keys('more', owner, null, true)).toContain('stickers');
    expect(keys('more', { ...owner, is_staff: true }, null)).toEqual(expect.arrayContaining(['admin-events', 'stickers']));
  });
});
