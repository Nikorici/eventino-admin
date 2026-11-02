import { eventPermissions } from '@/lib/sections';
import type { EventDetail } from '@/types/api';

import { eventTourSteps } from './EventTourSheet';

jest.mock('@/components/ui', () => ({}));
jest.mock('@/hooks/useThemeColor', () => ({ useThemeColor: () => '' }));

const event = { id: 1, owner: { id: 7 } } as unknown as EventDetail;

describe('eventTourSteps', () => {
  it('shows every in-page step to the owner', () => {
    const titles = eventTourSteps(eventPermissions(event, { id: 7 } as never)).map((step) => step.title);
    expect(titles).toEqual(['eventTourOverviewTitle', 'eventTourStatsTitle', 'eventTourAnalyticsTitle', 'eventTourOrdersTitle']);
  });

  it('keeps only the overview for a member without analytics or orders access', () => {
    const titles = eventTourSteps(eventPermissions(event, { id: 9 } as never)).map((step) => step.title);
    expect(titles).toEqual(['eventTourOverviewTitle']);
  });
});
