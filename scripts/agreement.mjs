import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { SITE_ORIGIN } from '../site.config.mjs';

export function renderAgreementMarkdown(markdown, { locale, russianAgreementUrl }) {
  const normalized = normalizeAgreementMarkdown(markdown, russianAgreementUrl);
  const rendered = marked.parse(normalized, { gfm: true });
  const sanitized = sanitizeHtml(rendered, {
    allowedTags: ['a', 'p', 'ol', 'ul', 'li', 'blockquote', 'em', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br'],
    allowedAttributes: {
      a: ['href', 'hreflang', 'target', 'rel'],
      ol: ['start', 'type'],
    },
    allowedSchemes: ['https'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a(tagName, attribs) {
        const href = attribs.href || '';
        const nextAttribs = href ? { href } : {};

        if (href) assertSafeAgreementHref(href, locale);

        if (href === russianAgreementUrl) nextAttribs.hreflang = 'ru';

        if (isExternalHttpsUrl(href)) {
          nextAttribs.target = '_blank';
          nextAttribs.rel = 'noopener noreferrer';
        }

        return { tagName, attribs: nextAttribs };
      },
    },
  }).trim();

  if (/<h[1-6]\b/i.test(sanitized)) {
    throw new Error(`Agreement.${locale}.md: headings after the document title require an explicit template review.`);
  }

  return restoreAlphaListMarkers(sanitized);
}

function normalizeAgreementMarkdown(markdown, russianAgreementUrl) {
  const linked = markdown.replace(
    /\[Agreement\.ru\.md\]\(Agreement\.ru\.md\)/g,
    `[Agreement.ru.md](${russianAgreementUrl})`
  );
  const withoutTitle = stripLeadingHeading(linked);
  return normalizeAlphaLists(withoutTitle);
}

function stripLeadingHeading(markdown) {
  const lines = markdown.split('\n');
  const firstNumberedIndex = lines.findIndex((line) => /^\s*\d+\.\s+/.test(line));

  for (let i = 0; i < lines.length; i++) {
    if (firstNumberedIndex >= 0 && i >= firstNumberedIndex) break;

    if (/^#{1,6}\s+/.test(lines[i])) {
      lines.splice(i, 1);
      break;
    }

    if ((lines[i] || '').trim() && /^[=-]{2,}\s*$/.test(lines[i + 1] || '')) {
      lines.splice(i, 2);
      break;
    }
  }

  while (lines[0] === '') lines.shift();
  return lines.join('\n');
}

function normalizeAlphaLists(markdown) {
  return markdown.replace(/^(\s+)([a-z])\)\s+/gm, '$11. ');
}

function restoreAlphaListMarkers(html) {
  return html.replace(/(<\/p>\s*)<ol>(\s*<li>)/g, '$1<ol type="a">$2');
}

function assertSafeAgreementHref(href, locale) {
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(href)) return;

  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe URL');
  } catch (_) {
    throw new Error(`Agreement.${locale}.md: link must be an absolute HTTPS URL or a fragment: ${href}`);
  }
}

function isExternalHttpsUrl(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.origin !== SITE_ORIGIN;
  } catch (_) {
    return false;
  }
}
