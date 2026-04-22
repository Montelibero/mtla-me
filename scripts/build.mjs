import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(rootDir, process.argv[2] || '_site');

const SUPPORTED_LANGS = ['en', 'ru', 'es', 'sr'];
const DOC_PATHS = {
  agreement: 'Agreement/Agreement',
  participation: 'Participation/Participation',
  principles: 'Principles/Principles',
  council: 'Council/Council',
};

const template = fs.readFileSync(path.join(rootDir, 'template.html'), 'utf8');
const localeContent = loadLocaleContent();
const agreementHtmlByLocale = {
  en: renderAgreementHtml('en'),
  ru: renderAgreementHtml('ru'),
};
const languageLabels = Object.fromEntries(
  SUPPORTED_LANGS.map((lang) => [lang, localeContent[lang].currentLanguageLabel])
);

buildSite();

function buildSite() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  copyPublicAsset('assets');
  copyPublicAsset('documents');
  copyPublicAsset('index.html');
  copyPublicAsset('CNAME');
  copyPublicAsset('.nojekyll');
  copyPublicAsset('robots.txt');
  copyPublicAsset('favicon.ico');
  copyPublicAsset('llms.txt');
  copyPublicAsset('sitemap.xml');

  for (const lang of SUPPORTED_LANGS) {
    const localeDir = path.join(outputDir, lang);
    fs.mkdirSync(localeDir, { recursive: true });

    const html = renderTemplate(template, buildViewModel(localeContent[lang]));
    fs.writeFileSync(path.join(localeDir, 'index.html'), html);
  }
}

function loadLocaleContent() {
  const content = {};

  for (const lang of SUPPORTED_LANGS) {
    const file = path.join(rootDir, 'i18n', lang, 'content.json');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));

    if (parsed.lang !== lang) {
      throw new Error(`Locale file ${file} declares lang=${parsed.lang}, expected ${lang}`);
    }

    content[lang] = parsed;
  }

  return content;
}

function buildViewModel(content) {
  return {
    lang: content.lang,
    title: content.title,
    description: content.description,
    ogLocale: content.ogLocale,
    canonicalUrl: `https://mtla.me/${content.lang}/`,
    currentLanguageLabel: content.currentLanguageLabel,
    languageSwitcherAriaLabel: content.languageSwitcherAriaLabel,
    alternateLinks: renderAlternateLinks(content.lang),
    languageMenuLinks: renderLanguageMenuLinks(content.lang),
    heroTitle: content.hero.title,
    heroLead: content.hero.lead,
    heroDescription: content.hero.description,
    heroNavLinks: renderHeroNavLinks(content.hero.navLinks),
    heroJoinLabel: content.hero.joinLabel,
    agreementTitle: content.agreement.title,
    agreementHtml: indentHtml(agreementHtmlByLocale[content.agreement.docLocale], 10),
    agreementOriginalUrl: docUrl('agreement', content.agreement.docLocale),
    agreementOriginalLabel: content.agreement.originalLabel,
    agreementOriginalNote: content.agreement.originalNote,
    bodiesTitle: content.bodies.title,
    bodiesItemsHtml: renderBodiesItems(content.bodies.items),
    documentsTitle: content.documents.title,
    documentsItemsHtml: renderDocumentItems(content.documents.items),
    documentsFooterHtml: renderInlineHtml(
      content.documents.footerPrefix,
      {
        href: 'https://github.com/Montelibero/MTLA-Documents',
        label: content.documents.footerLinkLabel,
        external: true,
      },
      content.documents.footerSuffix
    ),
    footerMadeWithLove: content.footer.madeWithLove,
    footerSourceHtml: renderInlineHtml(
      content.footer.sourcePrefix,
      {
        href: 'https://github.com/Montelibero/mtla-me',
        label: content.footer.sourceLinkLabel,
        external: true,
      },
      content.footer.sourceSuffix || ''
    ),
  };
}

function renderAgreementHtml(locale) {
  const markdown = fs.readFileSync(path.join(rootDir, 'documents', `Agreement.${locale}.md`), 'utf8');
  const normalized = normalizeAgreementMarkdown(markdown);
  const rendered = marked.parse(normalized, { gfm: true });
  const sanitized = sanitizeHtml(rendered, {
    allowedTags: ['a', 'p', 'ol', 'ul', 'li', 'blockquote', 'em', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      ol: ['start', 'type'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: function(tagName, attribs) {
        const href = attribs.href || '';
        const nextAttribs = href ? { href } : {};

        if (isExternalHttpUrl(href)) {
          nextAttribs.target = '_blank';
          nextAttribs.rel = 'noopener noreferrer';
        }

        return { tagName, attribs: nextAttribs };
      },
    },
  }).trim();

  return restoreAlphaListMarkers(sanitized);
}

function normalizeAgreementMarkdown(markdown) {
  const linked = markdown.replace(
    /\[Agreement\.ru\.md\]\(Agreement\.ru\.md\)/g,
    `[Agreement.ru.md](${docUrl('agreement', 'ru')})`
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

function renderAlternateLinks(currentLang) {
  const orderedLangs = currentLang === 'ru'
    ? ['ru', 'en', 'es', 'sr']
    : ['en', 'ru', 'es', 'sr'];

  const links = orderedLangs.map((lang) =>
    `  <link rel="alternate" hreflang="${escapeAttr(lang)}" href="../${escapeAttr(lang)}/">`
  );
  links.push('  <link rel="alternate" hreflang="x-default" href="../en/">');
  return links.join('\n');
}

function renderLanguageMenuLinks(currentLang) {
  return SUPPORTED_LANGS
    .filter((lang) => lang !== currentLang)
    .map((lang) =>
      `        ${renderAnchor({
        href: `../${lang}/`,
        label: languageLabels[lang],
        hreflang: lang,
      })}`
    )
    .join('\n');
}

function renderHeroNavLinks(navLinks) {
  return navLinks
    .map((link) => `        ${renderAnchor(link)}`)
    .join('\n');
}

function renderBodiesItems(items) {
  return items
    .map(
      (item) =>
        [
          `      <h3>${escapeText(item.title)}</h3>`,
          `      <p>${escapeText(item.description)}</p>`,
          `      <p>${renderAnchor({ href: item.linkHref, label: item.linkLabel, external: true })}</p>`,
        ].join('\n')
    )
    .join('\n\n');
}

function renderDocumentItems(items) {
  return items
    .map((item) => {
      const href = docUrl(item.doc, item.docLocale);
      return [
        `      <h3>${escapeText(item.title)}</h3>`,
        `      <p>${escapeText(item.description)}</p>`,
        `      <p>${renderAnchor({ href, label: item.linkLabel, external: true })}</p>`,
      ].join('\n');
    })
    .join('\n\n');
}

function renderInlineHtml(prefix, link, suffix) {
  return `${escapeText(prefix)}${renderAnchor(link)}${escapeText(suffix)}`;
}

function renderAnchor({ href, label, className, hreflang, external }) {
  const attrs = [];

  if (className) attrs.push(`class="${escapeAttr(className)}"`);
  if (hreflang) attrs.push(`hreflang="${escapeAttr(hreflang)}"`);

  attrs.push(`href="${escapeAttr(href)}"`);

  if (external) {
    attrs.push('target="_blank"');
    attrs.push('rel="noopener"');
  }

  return `<a ${attrs.join(' ')}>${escapeText(label)}</a>`;
}

function docUrl(doc, locale) {
  const base = DOC_PATHS[doc];
  if (!base) {
    throw new Error(`Unknown document key: ${doc}`);
  }

  return `https://docs.mtla.me/${base}.${locale}.html`;
}

function renderTemplate(source, view) {
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

function escapeText(value) {
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

function escapeAttr(value) {
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

function indentHtml(html, spaces) {
  const padding = ' '.repeat(spaces);
  return html
    .split('\n')
    .map((line) => (line ? padding + line : ''))
    .join('\n');
}

function isExternalHttpUrl(href) {
  try {
    const url = new URL(href);
    return /^https?:$/.test(url.protocol) && url.origin !== 'https://mtla.me';
  } catch (_) {
    return false;
  }
}

function copyPublicAsset(relativePath) {
  fs.cpSync(path.join(rootDir, relativePath), path.join(outputDir, relativePath), {
    recursive: true,
  });
}
