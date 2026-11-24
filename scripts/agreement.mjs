import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { SITE_ORIGIN } from '../site.config.mjs';
import { parseHttpsUrl } from './html.mjs';

const agreementMarkdown = new Marked({
  extensions: [{
    name: 'alphaList',
    level: 'block',
    tokenizer(source) {
      const first = /^( {0,3})([a-z])\)(?=[ \t])/.exec(source);
      if (!first) return;

      // Normalize this marker depth so Marked can parse nested blocks.
      const [, indent, letter] = first;
      const [block] = source.split(new RegExp(`^ {0,${indent.length}}\\d+\\)(?=[ \\t])`, 'm'), 1);
      const marker = new RegExp(`^${indent}[a-z]\\)(?=[ \\t])`, 'gm');
      const normalized = block.replace(marker, `${indent}1)`);
      const list = this.lexer.tokenizer.list(normalized);
      if (!list) return;
      return {
        ...list,
        type: 'alphaList',
        raw: source.slice(0, list.raw.length),
        start: letter.charCodeAt(0) - 'a'.charCodeAt(0) + 1,
      };
    },
    renderer(token) {
      return this.parser.renderer.list(token).replace('<ol', '<ol type="a"');
    },
  }],
});

export function renderAgreementMarkdown(markdown, { locale, russianAgreementUrl }) {
  const normalized = normalizeAgreementMarkdown(markdown, russianAgreementUrl);
  const rendered = agreementMarkdown.parse(normalized, { gfm: true });
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

        const url = parseHttpsUrl(href);
        if (href && !url && !/^#[A-Za-z][A-Za-z0-9_-]*$/.test(href)) {
          throw new Error(`Agreement.${locale}.md: link must be an absolute HTTPS URL or a fragment: ${href}`);
        }

        if (href === russianAgreementUrl) nextAttribs.hreflang = 'ru';

        if (url && url.origin !== SITE_ORIGIN) {
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

  return sanitized;
}

function normalizeAgreementMarkdown(markdown, russianAgreementUrl) {
  const linked = markdown.replace(
    /\[Agreement\.ru\.md\]\(Agreement\.ru\.md\)/g,
    `[Agreement.ru.md](${russianAgreementUrl})`
  );
  return stripLeadingHeading(linked);
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
