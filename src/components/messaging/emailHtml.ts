export interface CtaButton {
  label: string;
  url: string;
  bg: string;
  color: string;
  radius: string;
  padding: string;
  align: string;
}

export interface EmailParts {
  text: string;
  buttons: CtaButton[];
  images: string[];
}

export const DEFAULT_CTA: CtaButton = {
  label: '',
  url: '',
  bg: '#3b82f6',
  color: '#ffffff',
  radius: '12px',
  padding: '12px 18px',
  align: 'center',
};

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const BUTTON_PATTERN = /<a\b([^>]*data-button="true"[^>]*)>([\s\S]*?)<\/a>/gi;
const IMAGE_PATTERN = /<img\b[^>]*>/gi;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);
}

function attribute(attributes: string, name: string): string {
  return new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(attributes)?.[1] ?? '';
}

export function normalizeRadius(value: string): string {
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  if (/^\d+(\.\d+)?(px|em|rem|%)$/i.test(trimmed)) return trimmed;
  return DEFAULT_CTA.radius;
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(style|script|head|title)\b[\s\S]*?<\/\1>/gi, '')
      .replace(BUTTON_PATTERN, (button) => `\n${button}\n`)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function ctaButtonHtml(button: CtaButton): string {
  const style = [
    'display:inline-block',
    `background-color:${button.bg}`,
    `color:${button.color}`,
    `padding:${button.padding}`,
    `border-radius:${button.radius}`,
    'text-decoration:none',
    'font-weight:600',
    'font-size:16px',
  ].join(';');
  const data = `data-button="true" data-bg="${escapeHtml(button.bg)}" data-color="${escapeHtml(button.color)}" data-radius="${escapeHtml(button.radius)}" data-padding="${escapeHtml(button.padding)}" data-align="${escapeHtml(button.align)}"`;
  return `<a href="${escapeHtml(button.url)}" style="${escapeHtml(style)}" ${data}>${escapeHtml(button.label)}</a>`;
}

export function composeEmailHtml({ text, buttons, images }: EmailParts): string {
  const paragraphs = text.trim()
    ? text
        .trim()
        .split('\n')
        .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'))
    : [];
  return [...paragraphs, ...images.map((image) => `<p>${image}</p>`), ...buttons.map(ctaButtonHtml)].join('');
}

export function parseEmailHtml(html: string): EmailParts {
  const buttons: CtaButton[] = [];
  const images = html.match(IMAGE_PATTERN) ?? [];
  const withoutButtons = html.replace(BUTTON_PATTERN, (_match, attributes: string, label: string) => {
    buttons.push({
      label: htmlToText(label),
      url: decodeEntities(attribute(attributes, 'href')),
      bg: attribute(attributes, 'data-bg') || DEFAULT_CTA.bg,
      color: attribute(attributes, 'data-color') || DEFAULT_CTA.color,
      radius: attribute(attributes, 'data-radius') || DEFAULT_CTA.radius,
      padding: attribute(attributes, 'data-padding') || DEFAULT_CTA.padding,
      align: attribute(attributes, 'data-align') || DEFAULT_CTA.align,
    });
    return '';
  });
  return { text: htmlToText(withoutButtons.replace(IMAGE_PATTERN, '')), buttons, images };
}

export function hasEmailBody(parts: EmailParts): boolean {
  return parts.text.trim().length > 0 || parts.buttons.length > 0 || parts.images.length > 0;
}
