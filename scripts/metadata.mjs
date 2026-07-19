import { LOCALES, LOCALE_BY_KEY, SITE_ORIGIN } from '../site.config.mjs';
import { escapeAttr, escapeText, indentHtml } from './html.mjs';

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const ORGANIZATION_DESCRIPTION =
  'A fixed-participation association and extraterritorial contractual jurisdiction created to coordinate action toward the goals of the Montelibero project and movement.';
const CONTACT_LANGUAGES = LOCALES.map(({ htmlLang }) => htmlLang);
const SAME_AS_URLS = [
  'https://montelibero.org/mtla/',
  'https://docs.mtla.me/',
  'https://github.com/Montelibero/MTLA-Documents',
  'https://github.com/Montelibero/mtla-me',
  'https://t.me/mtl_association',
  'https://monte.wiki/ru/%D0%90%D1%81%D1%81%D0%BE%D1%86%D0%B8%D1%8F_%D0%9C%D0%BE%D0%BD%D1%82%D0%B5%D0%BB%D0%B8%D0%B1%D0%B5%D1%80%D0%BE',
];

export function renderAlternateLinks(currentLang) {
  const orderedLocales = [
    LOCALE_BY_KEY[currentLang],
    ...LOCALES.filter(({ key }) => key !== currentLang),
  ];

  const links = orderedLocales.map((locale) =>
    `  <link rel="alternate" hreflang="${escapeAttr(locale.hreflang)}" href="${escapeAttr(`${SITE_ORIGIN}/${locale.path}/`)}">`
  );
  links.push(`  <link rel="alternate" hreflang="x-default" href="${escapeAttr(`${SITE_ORIGIN}/`)}">`);
  return links.join('\n');
}

export function renderOgAlternateLocales(currentLang) {
  return LOCALES
    .filter(({ key }) => key !== currentLang)
    .map(({ ogLocale }) => `  <meta property="og:locale:alternate" content="${escapeAttr(ogLocale)}">`)
    .join('\n');
}

export function renderLocaleJsonLd(content, locale, sharedLinks) {
  const pageUrl = `${SITE_ORIGIN}/${locale.path}/`;
  const graph = [
    buildOrganizationEntity(sharedLinks),
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

export function renderRootJsonLd(sharedLinks) {
  const graph = [
    buildOrganizationEntity(sharedLinks),
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

export function renderSitemap() {
  const alternates = LOCALES
    .map(
      ({ path, hreflang }) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeAttr(hreflang)}" href="${SITE_ORIGIN}/${escapeAttr(path)}/"/>`
    )
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/"/>`)
    .join('\n');

  const entries = [
    { loc: `${SITE_ORIGIN}/`, alternates },
    ...LOCALES.map(({ path }) => ({ loc: `${SITE_ORIGIN}/${path}/`, alternates })),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.flatMap(({ loc, alternates: links }) => [
      '  <url>',
      `    <loc>${escapeText(loc)}</loc>`,
      links,
      '  </url>',
    ]),
    '</urlset>',
    '',
  ].join('\n');
}

function buildOrganizationEntity(sharedLinks) {
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
