import { composeEmailHtml, DEFAULT_CTA, htmlToText, normalizeRadius, normalizeUrl, parseEmailHtml } from './emailHtml';

describe('emailHtml', () => {
  it('turns plain text lines into escaped paragraphs and appends buttons', () => {
    const html = composeEmailHtml({
      text: 'Salut <prieteni>\n\nNe vedem & dansăm',
      images: [],
      buttons: [{ ...DEFAULT_CTA, label: 'Bilete', url: 'https://eventino.md/x' }],
    });
    expect(html).toContain('<p>Salut &lt;prieteni&gt;</p><p><br></p><p>Ne vedem &amp; dansăm</p>');
    expect(html).toContain('href="https://eventino.md/x"');
    expect(html).toContain('data-button="true"');
    expect(html).toContain('>Bilete</a>');
  });

  it('round-trips text, buttons and images through parseEmailHtml', () => {
    const parts = {
      text: 'Programul zilei 2\n\nParcare pe str. Ismail',
      images: ['<img src="https://cdn.eventino.md/map.png">'],
      buttons: [{ ...DEFAULT_CTA, label: 'Vezi harta', url: 'https://eventino.md/harta', bg: '#000000' }],
    };
    expect(parseEmailHtml(composeEmailHtml(parts))).toEqual(parts);
  });

  it('reads web-composed html as text', () => {
    expect(htmlToText('<html><head><style>p{}</style></head><body><h1>Titlu</h1><p>Rând <b>unu</b><br>doi&nbsp;</p></body></html>')).toBe(
      'Titlu\nRând unu\ndoi',
    );
  });

  it('puts CTA buttons on their own line in the text preview', () => {
    const html = composeEmailHtml({ text: 'Salut', images: [], buttons: [{ ...DEFAULT_CTA, label: 'Bilete', url: 'https://eventino.md' }] });
    expect(htmlToText(`${html}<p>Sunset Events</p>`)).toBe('Salut\n\nBilete\nSunset Events');
  });

  it('normalizes radius and url like the web helper', () => {
    expect(normalizeRadius('8')).toBe('8px');
    expect(normalizeRadius('1.5rem')).toBe('1.5rem');
    expect(normalizeRadius('big')).toBe('12px');
    expect(normalizeUrl('eventino.md')).toBe('https://eventino.md');
    expect(normalizeUrl('http://eventino.md')).toBe('http://eventino.md');
  });
});
