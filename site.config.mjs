export const SITE_ORIGIN = 'https://mtla.me';
export const DOCS_SITE_URL = 'https://docs.mtla.me/';
export const DEFAULT_LOCALE_KEY = 'en';

export const LOCALES = [
  {
    key: 'en',
    path: 'en',
    htmlLang: 'en',
    hreflang: 'en',
    ogLocale: 'en_US',
    queryAliases: ['en'],
    browserAliases: ['en'],
  },
  {
    key: 'ru',
    path: 'ru',
    htmlLang: 'ru',
    hreflang: 'ru',
    ogLocale: 'ru_RU',
    queryAliases: ['ru'],
    browserAliases: ['ru'],
  },
  {
    key: 'es',
    path: 'es',
    htmlLang: 'es',
    hreflang: 'es',
    ogLocale: 'es_ES',
    queryAliases: ['es'],
    browserAliases: ['es'],
  },
  {
    key: 'cnr',
    path: 'sr',
    // Keep the established /sr/ URL, but identify the content accurately as
    // Montenegrin. Serbian, Bosnian, Croatian, and Montenegrin preferences
    // intentionally share this localized page while its content remains
    // correctly tagged as Montenegrin.
    htmlLang: 'cnr',
    hreflang: 'cnr',
    ogLocale: 'cnr_ME',
    queryAliases: ['cnr', 'sr', 'bs', 'hr'],
    browserAliases: ['cnr', 'sr', 'bs', 'hr'],
  },
];

export const AGREEMENT_LOCALE_BY_SITE_LOCALE = Object.freeze({
  en: 'en',
  ru: 'ru',
  es: 'en',
  cnr: 'en',
});

export const LINK_LOCALE_BY_KEY = Object.freeze({
  associationWiki: 'ru',
  assemblyWiki: 'ru',
  councilWiki: 'ru',
  courtPage: 'ru',
  distributedManagementWiki: 'ru',
  missionControlCenterWiki: 'ru',
  workingGroupsWiki: 'ru',
});

export const SUPPORTED_LANGS = LOCALES.map(({ key }) => key);

export const LOCALE_BY_KEY = Object.fromEntries(
  LOCALES.map((locale) => [locale.key, locale])
);
