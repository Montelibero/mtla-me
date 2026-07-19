import {
  AGREEMENT_LOCALE_BY_SITE_LOCALE,
  SUPPORTED_LANGS as supportedLangs,
} from '../site.config.mjs';

const SUPPORTED_LANGS = new Set(supportedLangs);
const DOC_LOCALES = new Set(['en', 'ru']);
const DOC_KEYS = new Set(['agreement', 'participation', 'principles', 'council']);
const EXPECTED_STABLE_TARGETS = Object.freeze({
  'hero.navLinks': ['telegramChannel', 'associationWiki', 'stellarAccount', '#agreement', '#bodies', '#documents'],
  'bodies.items': [
    'assemblyWiki',
    'councilWiki',
    'courtPage',
    'distributedManagementWiki',
    'missionControlCenterWiki',
    'workingGroupsWiki',
  ],
  'documents.items': ['agreement', 'participation', 'principles', 'council'],
});

export function validateLinksMap(links, filePath) {
  if (!isPlainObject(links)) {
    throw new Error(`${filePath} must be a JSON object of shared link strings.`);
  }

  const errors = [];

  for (const [key, value] of Object.entries(links)) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(key)) {
      errors.push(`${filePath}.${key}: link keys must be camelCase identifiers.`);
    }

    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${filePath}.${key}: expected a non-empty string URL.`);
    } else {
      expectHttpsUrl(`${filePath}.${key}`, value, errors);
    }
  }

  throwIfErrors(filePath, errors);
}

export function validateLocaleContent(content, filePath, linkKeys) {
  const errors = [];

  if (!expectObjectShape(filePath, content, [
    'lang',
    'title',
    'description',
    'currentLanguageLabel',
    'languageSwitcherAriaLabel',
    'skipToContentLabel',
    'hero',
    'agreement',
    'bodies',
    'documents',
    'footer',
  ], [], errors)) {
    throwIfErrors(filePath, errors);
  }

  expectEnum(`${filePath}.lang`, content.lang, SUPPORTED_LANGS, errors);
  expectString(`${filePath}.title`, content.title, errors);
  expectString(`${filePath}.description`, content.description, errors);
  expectString(`${filePath}.currentLanguageLabel`, content.currentLanguageLabel, errors);
  expectString(`${filePath}.languageSwitcherAriaLabel`, content.languageSwitcherAriaLabel, errors);
  expectString(`${filePath}.skipToContentLabel`, content.skipToContentLabel, errors);

  validateHero(content.hero, `${filePath}.hero`, linkKeys, errors);
  validateAgreement(content.agreement, `${filePath}.agreement`, content.lang, errors);
  validateBodies(content.bodies, `${filePath}.bodies`, linkKeys, errors);
  validateDocuments(content.documents, `${filePath}.documents`, errors);
  validateFooter(content.footer, `${filePath}.footer`, errors);

  throwIfErrors(filePath, errors);
}

function validateHero(hero, path, linkKeys, errors) {
  if (!expectObjectShape(path, hero, [
    'title',
    'lead',
    'description',
    'navAriaLabel',
    'joinLabel',
    'joinHrefKey',
    'navLinks',
  ], [], errors)) {
    return;
  }

  expectString(`${path}.title`, hero.title, errors);
  expectString(`${path}.lead`, hero.lead, errors);
  expectString(`${path}.description`, hero.description, errors);
  expectString(`${path}.navAriaLabel`, hero.navAriaLabel, errors);
  expectString(`${path}.joinLabel`, hero.joinLabel, errors);
  expectKnownLinkKey(`${path}.joinHrefKey`, hero.joinHrefKey, linkKeys, errors);

  if (!Array.isArray(hero.navLinks)) {
    errors.push(`${path}.navLinks: expected an array.`);
    return;
  }

  for (let i = 0; i < hero.navLinks.length; i++) {
    validateNavLink(hero.navLinks[i], `${path}.navLinks[${i}]`, linkKeys, errors);
  }
}

function validateAgreement(agreement, path, siteLocale, errors) {
  if (!expectObjectShape(path, agreement, [
    'title',
    'docLocale',
    'originalLabel',
    'originalNote',
  ], [], errors)) {
    return;
  }

  expectString(`${path}.title`, agreement.title, errors);
  expectEnum(`${path}.docLocale`, agreement.docLocale, DOC_LOCALES, errors);
  const expectedDocLocale = AGREEMENT_LOCALE_BY_SITE_LOCALE[siteLocale];
  if (expectedDocLocale && agreement.docLocale !== expectedDocLocale) {
    errors.push(`${path}.docLocale: expected ${expectedDocLocale} for site locale ${siteLocale}.`);
  }
  expectString(`${path}.originalLabel`, agreement.originalLabel, errors);
  expectString(`${path}.originalNote`, agreement.originalNote, errors);
}

function validateBodies(bodies, path, linkKeys, errors) {
  if (!expectObjectShape(path, bodies, ['title', 'items'], [], errors)) {
    return;
  }

  expectString(`${path}.title`, bodies.title, errors);

  if (!Array.isArray(bodies.items)) {
    errors.push(`${path}.items: expected an array.`);
    return;
  }

  for (let i = 0; i < bodies.items.length; i++) {
    validateBodyItem(bodies.items[i], `${path}.items[${i}]`, linkKeys, errors);
  }
}

function validateDocuments(documents, path, errors) {
  if (!expectObjectShape(path, documents, [
    'title',
    'languageNames',
    'items',
    'footerPrefix',
    'footerLinkLabel',
    'footerSuffix',
  ], [], errors)) {
    return;
  }

  expectString(`${path}.title`, documents.title, errors);
  validateDocumentLanguageNames(documents.languageNames, `${path}.languageNames`, errors);
  expectString(`${path}.footerPrefix`, documents.footerPrefix, errors);
  expectString(`${path}.footerLinkLabel`, documents.footerLinkLabel, errors);
  expectString(`${path}.footerSuffix`, documents.footerSuffix, errors);

  if (!Array.isArray(documents.items)) {
    errors.push(`${path}.items: expected an array.`);
    return;
  }

  for (let i = 0; i < documents.items.length; i++) {
    validateDocumentItem(documents.items[i], `${path}.items[${i}]`, errors);
  }
}

function validateFooter(footer, path, errors) {
  if (!expectObjectShape(path, footer, [
    'madeWithLove',
    'sourcePrefix',
    'sourceLinkLabel',
    'sourceSuffix',
  ], [], errors)) {
    return;
  }

  expectString(`${path}.madeWithLove`, footer.madeWithLove, errors);
  expectString(`${path}.sourcePrefix`, footer.sourcePrefix, errors);
  expectString(`${path}.sourceLinkLabel`, footer.sourceLinkLabel, errors);
  expectStringValue(`${path}.sourceSuffix`, footer.sourceSuffix, errors);
}

function validateNavLink(link, path, linkKeys, errors) {
  if (!expectObjectShape(path, link, ['label'], ['href', 'hrefKey', 'external'], errors)) {
    return;
  }

  expectString(`${path}.label`, link.label, errors);
  expectExclusiveLinkTarget(link, path, 'href', 'hrefKey', linkKeys, errors);

  if (typeof link.href === 'string') {
    expectSafeContentHref(`${path}.href`, link.href, { allowFragment: true }, errors);
  }

  if ('external' in link) {
    expectBoolean(`${path}.external`, link.external, errors);
  }
}

function validateBodyItem(item, path, linkKeys, errors) {
  if (!expectObjectShape(path, item, ['title', 'description', 'linkLabel'], ['linkHref', 'linkHrefKey'], errors)) {
    return;
  }

  expectString(`${path}.title`, item.title, errors);
  expectString(`${path}.description`, item.description, errors);
  expectString(`${path}.linkLabel`, item.linkLabel, errors);
  expectExclusiveLinkTarget(item, path, 'linkHref', 'linkHrefKey', linkKeys, errors);
  if (typeof item.linkHref === 'string') {
    expectHttpsUrl(`${path}.linkHref`, item.linkHref, errors);
  }
}

function validateDocumentLanguageNames(languageNames, path, errors) {
  if (!expectObjectShape(path, languageNames, ['en', 'ru'], [], errors)) return;
  expectString(`${path}.en`, languageNames.en, errors);
  expectString(`${path}.ru`, languageNames.ru, errors);
}

function validateDocumentItem(item, path, errors) {
  if (!expectObjectShape(path, item, ['doc', 'docLocale', 'title', 'description', 'linkLabel'], [], errors)) {
    return;
  }

  expectEnum(`${path}.doc`, item.doc, DOC_KEYS, errors);
  expectEnum(`${path}.docLocale`, item.docLocale, DOC_LOCALES, errors);
  expectString(`${path}.title`, item.title, errors);
  expectString(`${path}.description`, item.description, errors);
  expectString(`${path}.linkLabel`, item.linkLabel, errors);
}

function expectExclusiveLinkTarget(value, path, hrefField, hrefKeyField, linkKeys, errors) {
  const hasHref = typeof value[hrefField] === 'string' && value[hrefField].trim();
  const hasHrefKey = typeof value[hrefKeyField] === 'string' && value[hrefKeyField].trim();

  if (Boolean(hasHref) === Boolean(hasHrefKey)) {
    errors.push(`${path}: expected exactly one of "${hrefField}" or "${hrefKeyField}".`);
    return;
  }

  if (hasHref) {
    expectString(`${path}.${hrefField}`, value[hrefField], errors);
  }

  if (hasHrefKey) {
    expectKnownLinkKey(`${path}.${hrefKeyField}`, value[hrefKeyField], linkKeys, errors);
  }
}

function expectKnownLinkKey(path, value, linkKeys, errors) {
  expectString(path, value, errors);
  if (typeof value === 'string' && !linkKeys.has(value)) {
    errors.push(`${path}: unknown link key "${value}".`);
  }
}

function expectSafeContentHref(path, value, options, errors) {
  if (options.allowFragment && /^#[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return;
  expectHttpsUrl(path, value, errors);
}

function expectHttpsUrl(path, value, errors) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      errors.push(`${path}: expected an HTTPS URL without embedded credentials.`);
    }
  } catch (_) {
    errors.push(`${path}: expected a valid absolute HTTPS URL.`);
  }
}

export function validateLocaleParity(contentByLocale) {
  const errors = [];
  const reference = contentByLocale.en;

  if (!reference) {
    throw new Error('Locale parity validation requires the English locale.');
  }

  const collections = [
    ['hero.navLinks', (content) => content.hero.navLinks.map((item) => item.hrefKey || item.href)],
    ['bodies.items', (content) => content.bodies.items.map((item) => item.linkHrefKey || item.linkHref)],
    ['documents.items', (content) => content.documents.items.map((item) => item.doc)],
  ];

  for (const [collectionPath, selectKeys] of collections) {
    const expected = selectKeys(reference);
    const required = EXPECTED_STABLE_TARGETS[collectionPath];

    if (JSON.stringify(expected) !== JSON.stringify(required)) {
      errors.push(
        `i18n/en/content.json.${collectionPath}: expected required targets ${JSON.stringify(required)}, got ${JSON.stringify(expected)}.`
      );
    }
    if (new Set(expected).size !== expected.length) {
      errors.push(`i18n/en/content.json.${collectionPath}: duplicate stable target.`);
    }

    for (const locale of supportedLangs) {
      const content = contentByLocale[locale];
      if (!content) {
        errors.push(`i18n/${locale}/content.json: missing locale content.`);
        continue;
      }

      const actual = selectKeys(content);
      if (new Set(actual).size !== actual.length) {
        errors.push(`i18n/${locale}/content.json.${collectionPath}: duplicate stable target.`);
      }
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        errors.push(
          `i18n/${locale}/content.json.${collectionPath}: expected stable targets ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`
        );
      }
    }
  }

  throwIfErrors('Locale parity', errors);
}

function expectString(path, value, errors) {
  expectStringValue(path, value, errors);
  if (typeof value === 'string' && !value.trim()) {
    errors.push(`${path}: expected a non-empty string.`);
  }
}

function expectStringValue(path, value, errors) {
  if (typeof value !== 'string') {
    errors.push(`${path}: expected a string.`);
  }
}

function expectBoolean(path, value, errors) {
  if (typeof value !== 'boolean') {
    errors.push(`${path}: expected a boolean.`);
  }
}

function expectEnum(path, value, allowedValues, errors) {
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    errors.push(`${path}: expected one of ${Array.from(allowedValues).join(', ')}.`);
  }
}

function expectObjectShape(path, value, requiredKeys, optionalKeys, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path}: expected an object.`);
    return false;
  }

  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);

  for (const key of requiredKeys) {
    if (!(key in value)) {
      errors.push(`${path}.${key}: missing required key.`);
    }
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${path}.${key}: unexpected key.`);
    }
  }

  return true;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function throwIfErrors(filePath, errors) {
  if (!errors.length) return;

  throw new Error(`${filePath} failed validation:\n- ${errors.join('\n- ')}`);
}
