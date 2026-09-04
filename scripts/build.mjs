import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LOCALE_KEY,
  DOCS_SITE_URL,
  LINK_LOCALE_BY_KEY,
  LOCALES,
  LOCALE_BY_KEY,
  SITE_ORIGIN,
} from '../site.config.mjs';
import { renderAgreementMarkdown } from './agreement.mjs';
import { escapeAttr, escapeText, indentHtml, renderAnchor, renderTemplate } from './html.mjs';
import {
  renderAlternateLinks,
  renderLocaleJsonLd,
  renderOgAlternateLocales,
  renderRootJsonLd,
  renderSitemap,
} from './metadata.mjs';
import { validateLinksMap, validateLocaleContent, validateLocaleParity } from './schema.mjs';
import { verifyDocumentProvenance } from './verify-documents.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(rootDir, '_site');

if (process.argv.length > 2) {
  throw new Error('Custom build output paths are disabled; the site is always written to _site/.');
}

verifyDocumentProvenance({ rootDir });

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
const DOC_PATHS = {
  agreement: 'Agreement/Agreement',
  participation: 'Participation/Participation',
  principles: 'Principles/Principles',
  council: 'Council/Council',
};

/** Agent Skills Discovery v0.2.0 (opaque id; see cloudflare/agent-skills-discovery-rfc) */
const AGENT_SKILLS_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

const template = fs.readFileSync(path.join(rootDir, 'template.html'), 'utf8');
const redirectScriptSource = fs.readFileSync(path.join(rootDir, 'assets', 'redirect.js'), 'utf8').trimEnd();
const INLINE_REDIRECT_SCRIPT = `\n${redirectScriptSource}\n`;
const REDIRECT_SCRIPT_HASH = crypto.createHash('sha256').update(INLINE_REDIRECT_SCRIPT).digest('base64');
const ASSET_VERSION = createAssetVersion([
  'assets/style.css',
  'assets/noscript.css',
]);
const sharedLinks = loadSharedLinks();
const localeContent = loadLocaleContent(sharedLinks);
const agreementHtmlByLocale = {
  en: renderAgreement('en'),
  ru: renderAgreement('ru'),
};
const languageLabels = Object.fromEntries(
  LOCALES.map(({ key }) => [key, localeContent[key].currentLanguageLabel])
);

buildSite();

function buildSite() {
  prepareOutputDirectory();

  copyPublicAsset('assets/style.css');
  copyPublicAsset('assets/noscript.css');
  copyPublicAsset('.well-known/stellar.toml');
  copyPublicAsset('images/stellar-logo.png');
  copyPublicAsset('images/stellar-logo-mtlap.png');
  copyPublicAsset('images/stellar-logo-mtlac.png');
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

  for (const { key: lang, path: localePath } of LOCALES) {
    const localeDir = path.join(outputDir, localePath);
    fs.mkdirSync(localeDir, { recursive: true });

    const html = renderTemplate(template, buildViewModel(localeContent[lang]));
    fs.writeFileSync(path.join(localeDir, 'index.html'), html);
  }

  validateBuiltSite();
}

function writeRootIndexHtml() {
  const srcPath = path.join(rootDir, 'index.html');
  let html = fs.readFileSync(srcPath, 'utf8');

  html = html
    .replace(/\{\{\{BUILD_SITE_ORIGIN\}\}\}/g, SITE_ORIGIN)
    .replace('{{{BUILD_ROOT_SEO_LINKS}}}', renderRootSeoLinks())
    .replace('{{{BUILD_LANGUAGE_CONFIG_ATTR}}}', escapeAttr(JSON.stringify(buildRedirectLanguageConfig())))
    .replace('{{{BUILD_REDIRECT_SCRIPT_HASH}}}', escapeAttr(REDIRECT_SCRIPT_HASH))
    .replace('{{{BUILD_REDIRECT_SCRIPT}}}', INLINE_REDIRECT_SCRIPT)
    .replace(/\{\{\{BUILD_ASSET_VERSION\}\}\}/g, ASSET_VERSION)
    .replace('{{{BUILD_ROOT_HREFLANG_LINKS}}}', renderRootHreflangLinks())
    .replace('{{{BUILD_ROOT_JSON_LD}}}', renderRootJsonLd(sharedLinks))
    .replace(/\{\{\{BUILD_MANUAL_LANG_LINKS\}\}\}/g, renderManualLanguageLinks());

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
      `  <link rel="alternate" hreflang="${escapeAttr(locale.hreflang)}" href="${escapeAttr(`${SITE_ORIGIN}/${locale.path}/`)}">`
  )
    .concat([`  <link rel="alternate" hreflang="x-default" href="${escapeAttr(`${SITE_ORIGIN}/`)}">`])
    .join('\n');
}

function buildRedirectLanguageConfig() {
  return {
    defaultLocale: DEFAULT_LOCALE_KEY,
    paths: Object.fromEntries(LOCALES.map(({ key, path: localePath }) => [key, localePath])),
    queryAliases: buildLocaleAliasMap('queryAliases'),
    browserAliases: buildLocaleAliasMap('browserAliases'),
  };
}

function buildLocaleAliasMap(field) {
  const aliases = {};

  for (const locale of LOCALES) {
    for (const alias of locale[field]) {
      const normalized = alias.toLowerCase();
      if (aliases[normalized] && aliases[normalized] !== locale.key) {
        throw new Error(`Duplicate ${field} alias: ${alias}`);
      }
      aliases[normalized] = locale.key;
    }
  }

  return aliases;
}

function renderManualLanguageLinks() {
  return LOCALES.map((locale) => {
    const label = languageLabels[locale.key];
    const href = `./${locale.path}/`;
    return `      <a lang="${escapeAttr(locale.htmlLang)}" hreflang="${escapeAttr(locale.hreflang)}" class="btn" href="${escapeAttr(href)}">${escapeText(label)}</a>`;
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

function validateBuiltSite() {
  const rootHtmlPath = path.join(outputDir, 'index.html');
  const htmlPaths = [
    rootHtmlPath,
    ...LOCALES.map(({ path: localePath }) => path.join(outputDir, localePath, 'index.html')),
  ];

  for (const filePath of htmlPaths) {
    const html = fs.readFileSync(filePath, 'utf8');

    if (html.includes('{{{BUILD_')) {
      throw new Error(`${filePath}: unreplaced BUILD_* placeholder remains`);
    }

    validateInlineJsonLd(html, filePath);
  }

  validateRootRedirectScript(rootHtmlPath);
  validateDeploymentConfiguration();
  validateJsonFile(path.join(outputDir, '.well-known', 'agent-skills', 'index.json'));
  validateJsonFile(path.join(outputDir, 'ai', 'summary.json'));
  validatePublishedSkillDigest();
}

function validateRootRedirectScript(rootHtmlPath) {
  const html = fs.readFileSync(rootHtmlPath, 'utf8');
  const scriptPath = path.join(rootDir, 'assets', 'redirect.js');
  const script = redirectScriptSource;

  try {
    new Function(script);
  } catch (error) {
    throw new Error(`${scriptPath}: redirect script is invalid: ${error.message}`);
  }

  if (!script.includes('window.location.replace(')) {
    throw new Error(`${scriptPath}: redirect script does not replace the root URL`);
  }
  if (!html.includes(`<script>${INLINE_REDIRECT_SCRIPT}</script>`)) {
    throw new Error(`${rootHtmlPath}: expected the validated inline redirect script`);
  }
  if (!html.includes(`script-src 'sha256-${REDIRECT_SCRIPT_HASH}'`)) {
    throw new Error(`${rootHtmlPath}: CSP does not authorize the exact inline redirect script`);
  }
  if (html.includes('src="./assets/redirect.js')) {
    throw new Error(`${rootHtmlPath}: redirect must not depend on a second network request`);
  }
  if (/localStorage|sessionStorage/.test(script)) {
    throw new Error(`${scriptPath}: client-side language storage is not permitted`);
  }
}

function validateDeploymentConfiguration() {
  const siteUrl = new URL(SITE_ORIGIN);
  const docsUrl = new URL(DOCS_SITE_URL);
  const cname = fs.readFileSync(path.join(rootDir, 'CNAME'), 'utf8').trim();
  const robots = fs.readFileSync(path.join(rootDir, 'robots.txt'), 'utf8');

  if (siteUrl.protocol !== 'https:' || siteUrl.pathname !== '/') {
    throw new Error('SITE_ORIGIN must be an HTTPS origin without a path.');
  }
  if (docsUrl.protocol !== 'https:') {
    throw new Error('DOCS_SITE_URL must use HTTPS.');
  }
  if (cname !== siteUrl.hostname) {
    throw new Error(`CNAME (${cname}) does not match SITE_ORIGIN (${siteUrl.hostname}).`);
  }
  if (!robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)) {
    throw new Error('robots.txt must reference the generated production sitemap.');
  }
}

function validateInlineJsonLd(html, filePath) {
  const matches = html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g);
  let count = 0;

  for (const match of matches) {
    count += 1;

    try {
      JSON.parse(match[1]);
    } catch (error) {
      throw new Error(`${filePath}: invalid JSON-LD: ${error.message}`);
    }
  }

  if (count !== 1) {
    throw new Error(`${filePath}: expected exactly one JSON-LD script, found ${count}`);
  }
}

function validateJsonFile(filePath) {
  try {
    JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${filePath}: invalid JSON: ${error.message}`);
  }
}

function validatePublishedSkillDigest() {
  const indexPath = path.join(outputDir, '.well-known', 'agent-skills', 'index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const skill = index.skills?.find(({ name }) => name === SKILL_SLUG);

  if (!skill) {
    throw new Error(`${indexPath}: missing skill entry for ${SKILL_SLUG}`);
  }

  const expectedDigest = `sha256:${crypto.createHash('sha256').update(skillSourceBody).digest('hex')}`;

  if (skill.digest !== expectedDigest) {
    throw new Error(`${indexPath}: digest mismatch for ${SKILL_SLUG}`);
  }

  const publishedSkillPath = path.join(outputDir, '.well-known', 'agent-skills', SKILL_SLUG, 'SKILL.md');
  const publishedDigest = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(publishedSkillPath)).digest('hex')}`;

  if (publishedDigest !== expectedDigest) {
    throw new Error(`${publishedSkillPath}: published skill digest does not match index`);
  }
}

function loadSharedLinks() {
  const file = path.join(rootDir, 'i18n', 'links.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  validateLinksMap(parsed, file);

  for (const [key, locale] of Object.entries(LINK_LOCALE_BY_KEY)) {
    if (!parsed[key]) throw new Error(`LINK_LOCALE_BY_KEY references unknown shared link key: ${key}`);
    if (!['en', 'ru'].includes(locale)) {
      throw new Error(`LINK_LOCALE_BY_KEY.${key}: no localized language-name support for ${locale}`);
    }
  }

  return parsed;
}

function loadLocaleContent(links) {
  const rawContent = {};
  const linkKeys = new Set(Object.keys(links));

  for (const { key: lang } of LOCALES) {
    const file = path.join(rootDir, 'i18n', lang, 'content.json');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    validateLocaleContent(parsed, file, linkKeys);

    if (parsed.lang !== lang) {
      throw new Error(`Locale file ${file} declares lang=${parsed.lang}, expected ${lang}`);
    }

    rawContent[lang] = parsed;
  }

  validateLocaleParity(rawContent);
  return Object.fromEntries(
    Object.entries(rawContent).map(([lang, content]) => [lang, resolveLocaleLinks(content, links)])
  );
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
        hrefLang: hrefKey ? LINK_LOCALE_BY_KEY[hrefKey] : undefined,
      })),
    },
    bodies: {
      ...content.bodies,
      items: content.bodies.items.map(({ linkHrefKey, ...item }) => ({
        ...item,
        linkHref: item.linkHref ?? resolveLinkKey(linkHrefKey, links),
        linkHrefLang: linkHrefKey ? LINK_LOCALE_BY_KEY[linkHrefKey] : undefined,
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
    ogAlternateLocales: renderOgAlternateLocales(content.lang),
    canonicalUrl: `${SITE_ORIGIN}/${locale.path}/`,
    stylesheetHref: `../assets/style.css?v=${ASSET_VERSION}`,
    llmsTxtUrl: LLMS_TXT_URL,
    agentSkillUrl: AGENT_SKILL_URL,
    agentSkillsIndexUrl: AGENT_SKILLS_INDEX_URL,
    aiSummaryUrl: AI_SUMMARY_URL,
    currentLanguageLabel: content.currentLanguageLabel,
    languageSwitcherAriaLabel: content.languageSwitcherAriaLabel,
    skipToContentLabel: content.skipToContentLabel,
    alternateLinks: renderAlternateLinks(content.lang),
    jsonLd: renderLocaleJsonLd(content, locale, sharedLinks),
    languageMenuLinks: renderLanguageMenuLinks(content.lang),
    heroTitle: content.hero.title,
    heroLead: content.hero.lead,
    heroDescription: content.hero.description,
    heroNavAriaLabel: content.hero.navAriaLabel,
    heroNavLinks: renderHeroNavLinks(content.hero.navLinks, content.lang, content.documents.languageNames),
    heroJoinHref: content.hero.joinHref,
    heroJoinLabel: content.hero.joinLabel,
    agreementTitle: content.agreement.title,
    agreementLang: content.agreement.docLocale,
    agreementHreflang: content.agreement.docLocale,
    agreementHtml: indentHtml(agreementHtmlByLocale[content.agreement.docLocale], 10),
    agreementOriginalUrl: docUrl('agreement', content.agreement.docLocale),
    agreementOriginalLabel: content.agreement.originalLabel,
    agreementOriginalNote: content.agreement.originalNote,
    bodiesTitle: content.bodies.title,
    bodiesItemsHtml: renderBodiesItems(content.bodies.items, content.lang, content.documents.languageNames),
    documentsTitle: content.documents.title,
    documentsItemsHtml: renderDocumentItems(content.documents.items, content.documents.languageNames),
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

function renderAgreement(locale) {
  const markdown = fs.readFileSync(path.join(rootDir, 'documents', `Agreement.${locale}.md`), 'utf8');
  return renderAgreementMarkdown(markdown, {
    locale,
    russianAgreementUrl: docUrl('agreement', 'ru'),
  });
}

function renderLanguageMenuLinks(currentLang) {
  return LOCALES
    .filter(({ key }) => key !== currentLang)
    .map(({ key, path, hreflang, htmlLang }) =>
      `        ${renderAnchor({
        href: `../${path}/`,
        label: languageLabels[key],
        hreflang,
        lang: htmlLang,
      })}`
    )
    .join('\n');
}

function renderHeroNavLinks(navLinks, pageLocale, languageNames) {
  return navLinks
    .map((link) => {
      const label = link.hrefLang && link.hrefLang !== pageLocale
        ? `${link.label} (${languageNames[link.hrefLang]})`
        : link.label;
      return `        ${renderAnchor({ ...link, label, hreflang: link.hrefLang })}`;
    })
    .join('\n');
}

function renderBodiesItems(items, pageLocale, languageNames) {
  return items
    .map((item) => {
      const languageNote = item.linkHrefLang && item.linkHrefLang !== pageLocale
        ? ` <small class="doc-language">(${escapeText(languageNames[item.linkHrefLang])})</small>`
        : '';
      return [
        `      <h3>${escapeText(item.title)}</h3>`,
        `      <p>${escapeText(item.description)}</p>`,
        `      <p>${renderAnchor({ href: item.linkHref, label: item.linkLabel, external: true, hreflang: item.linkHrefLang })}${languageNote}</p>`,
      ].join('\n');
    })
    .join('\n\n');
}

function renderDocumentItems(items, languageNames) {
  return items
    .map((item) => {
      const href = docUrl(item.doc, item.docLocale);
      const languageName = languageNames[item.docLocale];
      return [
        `      <h3>${escapeText(item.title)}</h3>`,
        `      <p>${escapeText(item.description)}</p>`,
        `      <p>${renderAnchor({ href, label: item.linkLabel, external: true, hreflang: item.docLocale })} <small class="doc-language">(${escapeText(languageName)})</small></p>`,
      ].join('\n');
    })
    .join('\n\n');
}

function renderInlineHtml(prefix, link, suffix) {
  return `${escapeText(prefix)}${renderAnchor(link)}${escapeText(suffix)}`;
}

function docUrl(doc, locale) {
  const base = DOC_PATHS[doc];
  if (!base) {
    throw new Error(`Unknown document key: ${doc}`);
  }

  return new URL(`${base}.${locale}.html`, DOCS_SITE_URL).href;
}

function copyPublicAsset(relativePath) {
  const destination = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(rootDir, relativePath), destination);
}

function createAssetVersion(relativePaths) {
  const hash = crypto.createHash('sha256');

  for (const relativePath of relativePaths) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(rootDir, relativePath)));
    hash.update('\0');
  }

  return hash.digest('hex').slice(0, 12);
}

function prepareOutputDirectory() {
  if (path.dirname(outputDir) !== rootDir || path.basename(outputDir) !== '_site') {
    throw new Error(`Refusing to clean unexpected build path: ${outputDir}`);
  }

  if (fs.existsSync(outputDir)) {
    const stat = fs.lstatSync(outputDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Refusing to replace non-directory build path: ${outputDir}`);
    }
    fs.rmSync(outputDir, { recursive: true });
  }

  fs.mkdirSync(outputDir, { recursive: false });
}
