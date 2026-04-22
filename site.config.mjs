export const SITE_ORIGIN = 'https://mtla.me';
export const DOCS_SITE_URL = 'https://docs.mtla.me/';

export const LOCALES = [
  {
    key: 'en',
    path: 'en',
    htmlLang: 'en',
    hreflang: 'en',
    ogLocale: 'en_US',
  },
  {
    key: 'ru',
    path: 'ru',
    htmlLang: 'ru',
    hreflang: 'ru',
    ogLocale: 'ru_RU',
  },
  {
    key: 'es',
    path: 'es',
    htmlLang: 'es',
    hreflang: 'es',
    ogLocale: 'es_ES',
  },
  {
    key: 'sr',
    path: 'sr',
    htmlLang: 'sr-Latn-ME',
    hreflang: 'sr-ME',
    ogLocale: 'sr_ME',
  },
];

export const SUPPORTED_LANGS = LOCALES.map(({ key }) => key);

export const LOCALE_BY_KEY = Object.fromEntries(
  LOCALES.map((locale) => [locale.key, locale])
);
