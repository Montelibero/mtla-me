import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { DOCS_SITE_URL, LOCALES, LOCALE_BY_KEY, SITE_ORIGIN, SUPPORTED_LANGS } from '../site.config.mjs';
import { validateLinksMap, validateLocaleContent } from './schema.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(rootDir, process.argv[2] || '_site');

function assertSkillSlug(name) {
  const n = String(name || '').trim();
  if (n.length < 1 || n.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(n)) {
    throw new Error(
      `SKILL.md frontmatter "name" must match Agent Skills id (1-64 chars, ^[a-z0-9]+(-[a-z0-9]+)*$); got ${JSON.stringify(name)}`
    );
  }
  return n;
}

function parseSkillFrontmatter(raw) {
  if (!raw.startsWith('---')) {
    return { name: 'montelibero-mtla-info', description: '' };
  }

  const end = raw.indexOf('\n---\n', 4);
  if (end < 0) {
    return { name: 'montelibero-mtla-info', description: '' };
  }

  const block = raw.slice(4, end);
  const fields = {};

  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[m[1]] = value;
  }

  return {
    name: fields.name || 'montelibero-mtla-info',
    description:
      fields.description ||
      'Instructions for answering questions about the Montelibero Association landing site, public identity, participation model, governance documents, communications, and safe interpretation boundaries.',
  };
}

const SKILL_SOURCE_PATH = path.join(rootDir, 'SKILL.md');
const skillSourceBody = fs.readFileSync(SKILL_SOURCE_PATH, 'utf8');
const SKILL_META = parseSkillFrontmatter(skillSourceBody);
const SKILL_SLUG = assertSkillSlug(SKILL_META.name);
const AGENT_SKILL_URL = `${SITE_ORIGIN}/.well-known/agent-skills/${SKILL_SLUG}/SKILL.md`;
const AGENT_SKILLS_INDEX_URL = `${SITE_ORIGIN}/.well-known/agent-skills/index.json`;
const AI_SUMMARY_URL = `${SITE_ORIGIN}/ai/summary.json`;
const LLMS_TXT_URL = `${SITE_ORIGIN}/llms.txt`;
const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const ORGANIZATION_DESCRIPTION =
  'A fixed-participation association and extraterritorial contractual jurisdiction created to coordinate action toward the goals of the Montelibero project and movement.';

const SAME_AS_URLS = [
  'https://montelibero.org/mtla/',
  'https://docs.mtla.me/',
  'https://github.com/Montelibero/MTLA-Documents',
  'https://github.com/Montelibero/mtla-me',
  'https://t.me/mtl_association',
  'https://monte.wiki/ru/%D0%90%D1%81%D1%81%D0%BE%D1%86%D0%B8%D0%B0%D1%86%D0%B8%D1%8F_%D0%9C%D0%BE%D0%BD%D1%82%D0%B5%D0%BB%D0%B8%D0%B1%D0%B5%D1%80%D0%BE',
];

const DOC_PATHS = {
  agreement: 'Agreement/Agreement',
  participation: 'Participation/Participation',
  principles: 'Principles/Principles',
  council: 'Council/Council',
};

/** Agent Skills Discovery v0.2.0 (opaque id; see cloudflare/agent-skills-discovery-rfc) */
const AGENT_SKILLS_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

const CONTACT_LANGUAGES = ['en', 'ru', 'es', 'sr-ME'];

const template = fs.readFileSync(path.join(rootDir, 'template.html'), 'utf8');
const sharedLinks = loadSharedLinks();
const localeContent = loadLocaleContent(sharedLinks);
const agreementHtmlByLocale = {
  en: renderAgreementHtml('en'),
  ru: renderAgreementHtml('ru'),
};
const languageLabels = Object.fromEntries(
  LOCALES.map(({ key }) => [key, localeContent[key].currentLanguageLabel])
);

buildSite();

function buildSite() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  copyPublicAsset('assets');
  copyPublicAsset('CNAME');
  copyPublicAsset('.nojekyll');
  copyPublicAsset('robots.txt');
  copyPublicAsset('favicon.ico');
  copyPublicAsset('llms.txt');

  writeRootIndexHtml();
  writePublishedSkillMarkdown();
  writeAgentSkillsIndex();
  writeAiSummaryJson();

  fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), renderSitemap());

  for (const { key: lang } of LOCALES) {
    const localeDir = path.join(outputDir, lang);
    fs.mkdirSync(localeDir, { recursive: true });

    const html = renderTemplate(template, buildViewModel(localeContent[lang]));
    fs.writeFileSync(path.join(localeDir, 'index.html'), html);
  }
}

function writeRootIndexHtml() {
  const srcPath = path.join(rootDir, 'index.html');
  let html = fs.readFileSync(srcPath, 'utf8');

  html = html
    .replace(/\{\{\{BUILD_SITE_ORIGIN\}\}\}/g, SITE_ORIGIN)
    .replace('{{{BUILD_ROOT_SEO_LINKS}}}', renderRootSeoLinks())
    .replace('{{{BUILD_SUPPORTED_LANGS_JSON}}}', JSON.stringify(SUPPORTED_LANGS))
    .replace('{{{BUILD_REDIRECT_LOCALE_TEST_LINE}}}', renderRedirectLocaleTestLine())
    .replace('{{{BUILD_ROOT_HREFLANG_LINKS}}}', renderRootHreflangLinks())
    .replace('{{{BUILD_ROOT_JSON_LD}}}', renderRootJsonLd())
    .replace('{{{BUILD_NOSCRIPT_LANG_LINKS}}}', renderNoscriptLangLinks());

  if (html.includes('{{{BUILD_')) {
    throw new Error('index.html: unreplaced BUILD_* placeholder(s) remain after build');
  }

  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
}

function renderRootSeoLinks() {
  const origin = escapeAttr(SITE_ORIGIN);
  return [
    `  <link rel="canonical" href="${origin}/">`,
    `  <link rel="help" type="text/plain" href="${origin}/llms.txt" title="LLMs text">`,
    `  <link rel="help" type="text/markdown" href="${escapeAttr(AGENT_SKILL_URL)}" title="AI agent instructions">`,
    `  <link rel="index" type="application/json" href="${origin}/.well-known/agent-skills/index.json" title="Agent skills index">`,
    `  <link rel="alternate" type="application/json" href="${origin}/ai/summary.json" title="AI site summary">`,
  ].join('\n');
}

function renderRootHreflangLinks() {
  return LOCALES.map(
    (locale) =>
      `  <link rel="alternate" hreflang="${escapeAttr(locale.hreflang)}" href="./${escapeAttr(locale.path)}/">`
  )
    .concat(['  <link rel="alternate" hreflang="x-default" href="./en/">'])
    .join('\n');
}

function renderRedirectLocaleTestLine() {
  const alt = LOCALES.map(({ path }) => path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return `        if (!/\/(?:${alt})(\\/|$)/.test(path)) {`;
}

function renderNoscriptLangLinks() {
  return LOCALES.map((locale) => {
    const label = languageLabels[locale.key];
    const href = `./${locale.path}/`;
    return `        <a hreflang="${escapeAttr(locale.hreflang)}" class="btn" href="${escapeAttr(href)}">${escapeText(label)}</a>`;
  }).join('\n');
}

function writePublishedSkillMarkdown() {
  const dir = path.join(outputDir, '.well-known', 'agent-skills', SKILL_SLUG);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), skillSourceBody);
}

function writeAgentSkillsIndex() {
  const digest = crypto.createHash('sha256').update(skillSourceBody).digest('hex');

  const payload = {
    $schema: AGENT_SKILLS_SCHEMA,
    skills: [
      {
        name: SKILL_SLUG,
        type: 'skill-md',
        description: SKILL_META.description,
        url: AGENT_SKILL_URL,
        digest: `sha256:${digest}`,
      },
    ],
  };

  const dir = path.join(outputDir, '.well-known', 'agent-skills');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.json'), `${JSON.stringify(payload, null, 2)}\n`);
}

function writeAiSummaryJson() {
  const en = localeContent.en;
  const enBase = `${SITE_ORIGIN}/en/`;

  const languages = LOCALES.map((locale) => ({
    code: locale.hreflang,
    url: `${SITE_ORIGIN}/${locale.path}/`,
  }));

  const payload = {
    name: 'Montelibero Association',
    alternateName: 'MTLA',
    url: `${SITE_ORIGIN}/`,
    description: `${en.hero.title}: ${en.hero.lead}. ${en.hero.description}`.replace(/\s+/g, ' ').trim(),
    languages,
    primarySections: [
      { name: en.agreement.title, url: `${enBase}#agreement` },
      { name: en.bodies.title, url: `${enBase}#bodies` },
      { name: en.documents.title, url: `${enBase}#documents` },
    ],
    referenceSources: [
      'https://docs.mtla.me/',
      'https://docs.mtla.me/llms.txt',
      'https://github.com/Montelibero/MTLA-Documents',
      'https://montelibero.org/mtla/',
      'https://montelibero.org/2023/08/09/montelibero_association_agreement/',
    ],
    agentResources: {
      llms: LLMS_TXT_URL,
      skill: AGENT_SKILL_URL,
      skillsIndex: AGENT_SKILLS_INDEX_URL,
    },
    boundaries: [
      'The site is about the Montelibero Association, not the entire Montelibero movement or ecosystem.',
      'MTLA is one structure within the broader Montelibero ecosystem and does not claim sole representation of the movement.',
      'Governance, participation, token/status, and procedural claims should be checked against current official MTLA documents.',
    ],
  };

  const dir = path.join(outputDir, 'ai');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'summary.json'), `${JSON.stringify(payload, null, 2)}\n`);
}

function loadSharedLinks() {
  const file = path.join(rootDir, 'i18n', 'links.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  validateLinksMap(parsed, file);
  return parsed;
}

function loadLocaleContent(links) {
  const content = {};
  const linkKeys = new Set(Object.keys(links));

  for (const { key: lang } of LOCALES) {
    const file = path.join(rootDir, 'i18n', lang, 'content.json');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    validateLocaleContent(parsed, file, linkKeys);

    if (parsed.lang !== lang) {
      throw new Error(`Locale file ${file} declares lang=${parsed.lang}, expected ${lang}`);
    }

    content[lang] = resolveLocaleLinks(parsed, links);
  }

  return content;
}

function resolveLocaleLinks(content, links) {
  return {
    ...content,
    hero: {
      ...content.hero,
      joinHref: resolveLinkKey(content.hero.joinHrefKey, links),
      navLinks: content.hero.navLinks.map(({ hrefKey, ...link }) => ({
        ...link,
        href: link.href ?? resolveLinkKey(hrefKey, links),
      })),
    },
    bodies: {
      ...content.bodies,
      items: content.bodies.items.map(({ linkHrefKey, ...item }) => ({
        ...item,
        linkHref: item.linkHref ?? resolveLinkKey(linkHrefKey, links),
      })),
    },
  };
}

function resolveLinkKey(key, links) {
  if (!key) return undefined;
  const value = links[key];
  if (!value) {
    throw new Error(`Unknown shared link key: ${key}`);
  }
  return value;
}

function buildViewModel(content) {
  const locale = LOCALE_BY_KEY[content.lang];

  return {
    lang: locale.htmlLang,
    title: content.title,
    description: content.description,
    ogLocale: locale.ogLocale,
    canonicalUrl: `${SITE_ORIGIN}/${locale.path}/`,
    llmsTxtUrl: LLMS_TXT_URL,
    agentSkillUrl: AGENT_SKILL_URL,
    agentSkillsIndexUrl: AGENT_SKILLS_INDEX_URL,
    aiSummaryUrl: AI_SUMMARY_URL,
    currentLanguageLabel: content.currentLanguageLabel,
    languageSwitcherAriaLabel: content.languageSwitcherAriaLabel,
    alternateLinks: renderAlternateLinks(content.lang),
    jsonLd: renderLocaleJsonLd(content, locale),
    languageMenuLinks: renderLanguageMenuLinks(content.lang),
    heroTitle: content.hero.title,
    heroLead: content.hero.lead,
    heroDescription: content.hero.description,
    heroNavLinks: renderHeroNavLinks(content.hero.navLinks),
    heroJoinHref: content.hero.joinHref,
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
        href: DOCS_SITE_URL,
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
  const orderedLocales = [
    LOCALE_BY_KEY[currentLang],
    ...LOCALES.filter(({ key }) => key !== currentLang),
  ];

  const links = orderedLocales.map((locale) =>
    `  <link rel="alternate" hreflang="${escapeAttr(locale.hreflang)}" href="../${escapeAttr(locale.path)}/">`
  );
  links.push('  <link rel="alternate" hreflang="x-default" href="../en/">');
  return links.join('\n');
}

function buildOrganizationEntity() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Montelibero Association',
    alternateName: 'MTLA',
    url: SITE_ORIGIN,
    description: ORGANIZATION_DESCRIPTION,
    sameAs: SAME_AS_URLS,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'public participation',
        url: sharedLinks.joinBot,
        availableLanguage: CONTACT_LANGUAGES,
      },
      {
        '@type': 'ContactPoint',
        contactType: 'public announcements',
        url: sharedLinks.telegramChannel,
        availableLanguage: CONTACT_LANGUAGES,
      },
    ],
  };
}

function buildWebSiteEntity() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'Montelibero Association',
    alternateName: 'MTLA.me',
    url: SITE_ORIGIN,
    inLanguage: LOCALES.map(({ htmlLang }) => htmlLang),
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: [
      {
        '@type': 'ReadAction',
        target: LOCALES.map(({ path }) => `${SITE_ORIGIN}/${path}/`),
      },
    ],
  };
}

function stringifyJsonLdGraph(graph) {
  return indentHtml(
    JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/<\/script/gi, '<\\/script'),
    4
  );
}

function renderLocaleJsonLd(content, locale) {
  const pageUrl = `${SITE_ORIGIN}/${locale.path}/`;
  const graph = [
    buildOrganizationEntity(),
    buildWebSiteEntity(),
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: content.title,
      description: content.description,
      inLanguage: locale.htmlLang,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      mainEntity: { '@id': ORGANIZATION_ID },
    },
  ];

  return stringifyJsonLdGraph(graph);
}

function renderRootJsonLd() {
  const graph = [
    buildOrganizationEntity(),
    buildWebSiteEntity(),
    {
      '@type': 'WebPage',
      '@id': `${SITE_ORIGIN}/#webpage`,
      url: `${SITE_ORIGIN}/`,
      name: 'Montelibero Association',
      description: 'Language selection page for the Montelibero Association website.',
      inLanguage: LOCALES.map(({ htmlLang }) => htmlLang),
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
    },
  ];

  return stringifyJsonLdGraph(graph);
}

function renderLanguageMenuLinks(currentLang) {
  return LOCALES
    .filter(({ key }) => key !== currentLang)
    .map(({ key, path, hreflang }) =>
      `        ${renderAnchor({
        href: `../${path}/`,
        label: languageLabels[key],
        hreflang,
      })}`
    )
    .join('\n');
}

function renderSitemap() {
  const alternates = LOCALES
    .map(
      ({ path, hreflang }) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeAttr(hreflang)}" href="${SITE_ORIGIN}/${escapeAttr(path)}/"/>`
    )
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/en/"/>`)
    .join('\n');

  const entries = [
    {
      loc: `${SITE_ORIGIN}/`,
      alternates,
    },
    ...LOCALES.map(({ path }) => ({
      loc: `${SITE_ORIGIN}/${path}/`,
      alternates,
    })),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.flatMap(({ loc, alternates }) => [
      '  <url>',
      `    <loc>${escapeText(loc)}</loc>`,
      alternates,
      '  </url>',
    ]),
    '</urlset>',
    '',
  ].join('\n');
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
    attrs.push('rel="noopener noreferrer"');
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
    return /^https?:$/.test(url.protocol) && url.origin !== SITE_ORIGIN;
  } catch (_) {
    return false;
  }
}

function copyPublicAsset(relativePath) {
  fs.cpSync(path.join(rootDir, relativePath), path.join(outputDir, relativePath), {
    recursive: true,
  });
}
