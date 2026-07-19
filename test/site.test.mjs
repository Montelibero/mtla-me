import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  AGREEMENT_LOCALE_BY_SITE_LOCALE,
  DEFAULT_LOCALE_KEY,
  LOCALES,
  SITE_ORIGIN,
} from '../site.config.mjs';
import { renderAgreementMarkdown } from '../scripts/agreement.mjs';
import { verifyDocumentProvenance } from '../scripts/verify-documents.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(rootDir, '_site');
const sharedLinks = JSON.parse(fs.readFileSync(path.join(rootDir, 'i18n', 'links.json'), 'utf8'));
const russianLinkKeys = [
  'associationWiki',
  'assemblyWiki',
  'councilWiki',
  'courtPage',
  'distributedManagementWiki',
  'missionControlCenterWiki',
  'workingGroupsWiki',
];

test('agreement sources match their recorded authoritative hashes', () => {
  const result = verifyDocumentProvenance({ rootDir });
  assert.equal(result.files.length, 2);
  assert.match(result.commit, /^[0-9a-f]{40}$/);
});

test('agreement rendering strips active content and rejects unsafe link schemes', () => {
  const html = renderAgreementMarkdown(
    '# Test agreement\n\nSafe text.<img src=x onerror="alert(1)"> [Reference](https://example.com/)',
    { locale: 'en', russianAgreementUrl: 'https://docs.mtla.me/Agreement/Agreement.ru.html' }
  );

  assert.doesNotMatch(html, /<img|onerror|<script/i);
  assert.match(html, /href="https:\/\/example\.com\/" target="_blank" rel="noopener noreferrer"/);
  assert.throws(
    () => renderAgreementMarkdown('# Test\n\n[Unsafe](http://example.com/)', {
      locale: 'en',
      russianAgreementUrl: 'https://docs.mtla.me/Agreement/Agreement.ru.html',
    }),
    /link must be an absolute HTTPS URL/
  );
  assert.throws(
    () => renderAgreementMarkdown('# Test\n\n[Unsafe](javascript:alert(1))', {
      locale: 'en',
      russianAgreementUrl: 'https://docs.mtla.me/Agreement/Agreement.ru.html',
    }),
    /link must be an absolute HTTPS URL/
  );
});

test('root is a no-flicker redirect with an accessible no-JavaScript fallback', () => {
  const html = readBuilt('index.html');
  const redirectScript = readSource('assets/redirect.js');
  const css = readSource('assets/style.css');

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en" data-language-config="[^"]+">/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.ok(html.indexOf(redirectScript.trim()) < html.indexOf('assets/style.css'));
  assert.match(html, /script-src 'sha256-[A-Za-z0-9+/]+=*'/);
  assert.match(css, /\.redirecting \.root-fallback\s*\{\s*display:\s*none/);
  assert.match(html, /<noscript>[\s\S]*assets\/noscript\.css/);
  assert.equal(countMatches(html, /<main\b/g), 1);

  const fallback = [...html.matchAll(/<noscript>[\s\S]*?<\/noscript>/g)]
    .map(([block]) => block)
    .find((block) => block.includes('language-options'));
  assert.ok(fallback, 'expected a manual language fallback inside noscript');
  for (const locale of LOCALES) {
    assert.match(
      fallback,
      new RegExp(`lang="${escapeRegExp(locale.htmlLang)}"[^>]+href="\\.\\/${escapeRegExp(locale.path)}\\/"`)
    );
  }

  assert.match(redirectScript, /navigator\.languages/);
  assert.match(redirectScript, /searchParams\.get\('lang'\)/);
  assert.match(redirectScript, /window\.location\.replace/);
  assert.doesNotMatch(redirectScript, /localStorage|sessionStorage/);
  assert.doesNotMatch(html, /unsafe-inline/);
  assert.doesNotMatch(html, /\{\{\{/);
});

test('the production palette and focus styles preserve readable interaction contrast', () => {
  const css = readSource('assets/style.css');
  const background = cssVariable(css, 'bg');

  assert.ok(contrastRatio(cssVariable(css, 'text'), background) >= 4.5);
  assert.ok(contrastRatio(cssVariable(css, 'muted'), background) >= 4.5);
  assert.ok(contrastRatio(cssVariable(css, 'accent'), background) >= 4.5);
  assert.ok(contrastRatio('#c9aa4f', background) >= 4.5);
  assert.match(css, /:focus-visible[\s\S]*outline:\s*2px solid var\(--accent\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('redirect honors explicit preferences, browser order, fallbacks, and the deployment base path', async (t) => {
  const cases = [
    {
      name: 'query preference wins',
      href: 'https://example.test/project/?lang=ru',
      languages: ['es-ES'],
      expected: 'https://example.test/project/ru/',
    },
    {
      name: 'query regions normalize to their primary language',
      href: 'https://example.test/project/?lang=es-MX',
      languages: ['en-US'],
      expected: 'https://example.test/project/es/',
    },
    {
      name: 'navigator.languages order is respected',
      href: 'https://example.test/project/',
      languages: ['de-DE', 'ru-RU', 'en-US'],
      expected: 'https://example.test/project/ru/',
    },
    {
      name: 'Bosnian query tags use the Montenegrin page',
      href: 'https://example.test/project/?lang=bs-BA',
      languages: ['en-US'],
      expected: 'https://example.test/project/sr/',
    },
    {
      name: 'Serbian browser tags use the Montenegrin page',
      href: 'https://example.test/project/',
      languages: ['sr-Latn-ME'],
      expected: 'https://example.test/project/sr/',
    },
    {
      name: 'Croatian browser tags use the Montenegrin page',
      href: 'https://example.test/project/',
      languages: ['hr-HR'],
      expected: 'https://example.test/project/sr/',
    },
    {
      name: 'Bosnian browser tags use the Montenegrin page',
      href: 'https://example.test/project/',
      languages: ['bs-Latn-BA'],
      expected: 'https://example.test/project/sr/',
    },
    {
      name: 'Montenegrin browser tags use the compatible sr URL',
      href: 'https://example.test/project/',
      languages: ['cnr-Latn-ME'],
      expected: 'https://example.test/project/sr/',
    },
    {
      name: 'unknown preferences use the configured default',
      href: 'https://example.test/project/',
      languages: ['de-DE'],
      expected: 'https://example.test/project/en/',
    },
  ];

  for (const item of cases) {
    await t.test(item.name, () => {
      const result = executeRedirect({ href: item.href, languages: item.languages });
      assert.equal(result.redirectedTo, item.expected);
      assert.ok(result.classes.has('redirecting'));
      assert.ok(!result.classes.has('redirect-failed'));
    });
  }
});

test('redirect fails closed to the visible language chooser when configuration is unsafe', () => {
  const config = redirectConfig();
  config.paths.en = '../outside';
  const result = executeRedirect({
    href: 'https://example.test/',
    languages: ['en'],
    config,
  });

  assert.equal(result.redirectedTo, undefined);
  assert.ok(!result.classes.has('redirecting'));
  assert.ok(result.classes.has('redirect-failed'));
});

test('every locale page has consistent metadata, semantics, and safe external links', async (t) => {
  for (const locale of LOCALES) {
    await t.test(locale.key, () => {
      const html = readBuilt(locale.path, 'index.html');
      const agreementLocale = AGREEMENT_LOCALE_BY_SITE_LOCALE[locale.key];
      const sourceContent = JSON.parse(readSource('i18n', locale.key, 'content.json'));

      assert.match(html, new RegExp(`<html lang="${escapeRegExp(locale.htmlLang)}">`));
      assert.match(html, new RegExp(`<link rel="canonical" href="${escapeRegExp(`${SITE_ORIGIN}/${locale.path}/`)}">`));
      assert.match(html, new RegExp(`<meta property="og:url" content="${escapeRegExp(`${SITE_ORIGIN}/${locale.path}/`)}">`));
      assert.match(html, new RegExp(`<article class="markdown" lang="${agreementLocale}" aria-labelledby="agreement-heading">`));
      assert.match(html, /<main id="main-content" class="wrap" tabindex="-1">/);
      assert.match(html, /<a class="skip-link" href="#main-content">/);
      assert.equal(countMatches(html, /<h1\b/g), 1);
      assert.equal(countMatches(html, /<meta property="og:locale:alternate"/g), LOCALES.length - 1);
      assert.doesNotMatch(html, /unsafe-inline/);
      assert.doesNotMatch(html, /\{\{/);
      assert.doesNotMatch(html, /class="doc-language" lang=/);

      const article = html.match(/<article class="markdown"[^>]*>([\s\S]*?)<\/article>/)?.[1];
      assert.ok(article, 'expected an agreement article');
      assert.doesNotMatch(article, /<h[1-6]\b/i);
      assert.match(
        html,
        new RegExp(
          `<\/article>\\s*<p><a href="https:\/\/docs\\.mtla\\.me\/Agreement\/Agreement\\.${agreementLocale}\\.html" hreflang="${agreementLocale}">`
        )
      );

      for (const alternate of LOCALES) {
        assert.match(
          html,
          new RegExp(
            `<link rel="alternate" hreflang="${escapeRegExp(alternate.hreflang)}" href="${escapeRegExp(`${SITE_ORIGIN}/${alternate.path}/`)}">`
          )
        );
        if (alternate.key !== locale.key) {
          assert.match(
            html,
            new RegExp(
              `<a hreflang="${escapeRegExp(alternate.hreflang)}" lang="${escapeRegExp(alternate.htmlLang)}" href="\\.\\.\/${escapeRegExp(alternate.path)}\/"`
            )
          );
        }
      }
      assert.match(html, new RegExp(`<link rel="alternate" hreflang="x-default" href="${escapeRegExp(`${SITE_ORIGIN}/`)}">`));

      for (const key of russianLinkKeys) {
        assert.match(
          html,
          new RegExp(`<a hreflang="ru" href="${escapeRegExp(sharedLinks[key])}"`)
        );
      }
      if (locale.key !== 'ru') {
        assert.match(html, new RegExp(`\\(${escapeRegExp(sourceContent.documents.languageNames.ru)}\\)`));
      }

      for (const match of html.matchAll(/<a\s+([^>]*target="_blank"[^>]*)>/g)) {
        assert.match(match[1], /rel="noopener noreferrer"/);
        const href = match[1].match(/href="([^"]+)"/)?.[1];
        assert.ok(href?.startsWith('https://'), `external link must use HTTPS: ${href}`);
      }

      const scripts = [...html.matchAll(/<script([^>]*)>/g)];
      assert.equal(scripts.length, 1);
      assert.match(scripts[0][1], /type="application\/ld\+json"/);
    });
  }
});

test('English, Spanish, and Montenegrin pages embed the same English agreement', () => {
  const article = (localePath) => readBuilt(localePath, 'index.html')
    .match(/<article class="markdown"[^>]*>([\s\S]*?)<\/article>/)?.[1]
    .trim();

  assert.equal(article('es'), article('en'));
  assert.equal(article('sr'), article('en'));
  assert.notEqual(article('ru'), article('en'));
});

test('sitemap and deploy metadata describe the canonical locale set', () => {
  const sitemap = readBuilt('sitemap.xml');
  const robots = readBuilt('robots.txt');

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, new RegExp(`<loc>${escapeRegExp(`${SITE_ORIGIN}/`)}</loc>`));
  assert.match(sitemap, new RegExp(`hreflang="x-default" href="${escapeRegExp(`${SITE_ORIGIN}/`)}"`));
  for (const locale of LOCALES) {
    assert.match(sitemap, new RegExp(`hreflang="${locale.hreflang}" href="${escapeRegExp(`${SITE_ORIGIN}/${locale.path}/`)}"`));
  }
  assert.match(robots, new RegExp(`Sitemap: ${escapeRegExp(`${SITE_ORIGIN}/sitemap.xml`)}`));
  assert.equal(readBuilt('CNAME').trim(), new URL(SITE_ORIGIN).hostname);
  assert.ok(fs.existsSync(path.join(outputDir, '.nojekyll')));
});

function executeRedirect({ href, languages, config = redirectConfig() }) {
  const classes = new Set();
  let redirectedTo;
  const root = {
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
    },
    getAttribute(name) {
      return name === 'data-language-config' ? JSON.stringify(config) : null;
    },
  };
  const location = {
    href,
    replace(value) { redirectedTo = value; },
  };

  vm.runInNewContext(readSource('assets/redirect.js'), {
    URL,
    console: { error() {} },
    document: { documentElement: root },
    navigator: { language: languages[0], languages },
    window: { location },
  });

  return { classes, redirectedTo };
}

function redirectConfig() {
  return {
    defaultLocale: DEFAULT_LOCALE_KEY,
    paths: Object.fromEntries(LOCALES.map(({ key, path: localePath }) => [key, localePath])),
    queryAliases: aliasMap('queryAliases'),
    browserAliases: aliasMap('browserAliases'),
  };
}

function aliasMap(field) {
  return Object.fromEntries(
    LOCALES.flatMap((locale) => locale[field].map((alias) => [alias, locale.key]))
  );
}

function readBuilt(...segments) {
  return fs.readFileSync(path.join(outputDir, ...segments), 'utf8');
}

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cssVariable(css, name) {
  const value = css.match(new RegExp(`--${escapeRegExp(name)}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  assert.ok(value, `expected --${name} to be a six-digit hex color`);
  return value;
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
