import { SITE_ORIGIN } from '../site.config.mjs';

export function renderTemplate(source, view) {
  return source.replace(/{{{(\w+)}}}|{{@(\w+)}}|{{(\w+)}}/g, (match, rawKey, attrKey, textKey) => {
    const key = rawKey || attrKey || textKey;

    if (!(key in view)) {
      throw new Error(`Missing template value: ${key}`);
    }

    const value = String(view[key]);
    if (rawKey) return value;
    if (attrKey) return escapeAttr(value);
    return escapeText(value);
  });
}

export function renderAnchor({ href, label, className, hreflang, lang, external }) {
  assertSafeRenderedHref(href, { external });
  const attrs = [];

  if (className) attrs.push(`class="${escapeAttr(className)}"`);
  if (hreflang) attrs.push(`hreflang="${escapeAttr(hreflang)}"`);
  if (lang) attrs.push(`lang="${escapeAttr(lang)}"`);

  attrs.push(`href="${escapeAttr(href)}"`);

  if (external) {
    attrs.push('target="_blank"');
    attrs.push('rel="noopener noreferrer"');
  }

  return `<a ${attrs.join(' ')}>${escapeText(label)}</a>`;
}

export function escapeText(value) {
  return String(value).replace(/[&<>]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      default:
        return char;
    }
  });
}

export function escapeAttr(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

export function indentHtml(html, spaces) {
  const padding = ' '.repeat(spaces);
  return html
    .split('\n')
    .map((line) => (line ? padding + line : ''))
    .join('\n');
}

function assertSafeRenderedHref(href, { external = false } = {}) {
  if (typeof href !== 'string' || !href) {
    throw new Error('Cannot render an empty link target.');
  }

  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(href) || /^\.\.\/[a-z0-9-]+\/$/.test(href)) {
    if (external) throw new Error(`External link must be an absolute HTTPS URL: ${href}`);
    return;
  }

  let url;
  try {
    url = new URL(href);
  } catch (_) {
    throw new Error(`Unsafe or malformed link target: ${href}`);
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`Link target must use HTTPS without embedded credentials: ${href}`);
  }

  if (external && url.origin === SITE_ORIGIN) {
    throw new Error(`Same-origin link must not be marked external: ${href}`);
  }
}
