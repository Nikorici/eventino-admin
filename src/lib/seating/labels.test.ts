import { fixtureLayout } from './testFixtures';
import { localizedText, rowLabelPositions, sectionLabelPosition } from './labels';

describe('localizedText', () => {
  it('prefers the requested language, then english, then the fallback', () => {
    expect(localizedText('Parter', { en: 'Stalls', ro: 'Parter' }, 'ro-RO')).toBe('Parter');
    expect(localizedText('Parter', { en: 'Stalls' }, 'ru')).toBe('Stalls');
    expect(localizedText('Parter', null, 'ru')).toBe('Parter');
  });
});

describe('rowLabelPositions', () => {
  const parter = fixtureLayout.sections[0];

  it('places labels at both row ends with a seat-radius based gap', () => {
    const positions = rowLabelPositions(parter, 10);
    expect(positions).toHaveLength(4);
    expect(positions[0]).toEqual({ key: '10:l', x: 50 - 26, y: 50, text: '1' });
    expect(positions[1]).toEqual({ key: '10:r', x: 130 + 26, y: 50, text: '1' });
  });

  it('uses the fixed x positions when the section asks for them', () => {
    const positions = rowLabelPositions({ ...parter, row_labels: { mode: 'fixed', x: [5, 300] } }, 10);
    expect(positions[0].x).toBe(5);
    expect(positions[1].x).toBe(300);
  });

  it('returns nothing for the none mode', () => {
    expect(rowLabelPositions({ ...parter, row_labels: { mode: 'none', x: null } }, 10)).toEqual([]);
  });
});

describe('sectionLabelPosition', () => {
  const parter = fixtureLayout.sections[0];

  it('uses the explicit label when present', () => {
    const labelled = { ...parter, label: { x: 1, y: 2, rotation: 90, anchor: 'start' as const } };
    expect(sectionLabelPosition(labelled, 'en')).toEqual({ x: 1, y: 2, rotation: 90, anchor: 'start', text: 'Parter' });
  });

  it('falls back to the outline centre', () => {
    expect(sectionLabelPosition(parter, 'en')).toEqual({ x: 200, y: 100, rotation: 0, anchor: 'middle', text: 'Parter' });
  });

  it('returns null without an outline', () => {
    expect(sectionLabelPosition({ ...parter, label: null, outline: [] }, 'en')).toBeNull();
  });
});
