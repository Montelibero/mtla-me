(function redirectToPreferredLanguage() {
  'use strict';

  var root = document.documentElement;
  root.classList.add('redirecting');

  function normalizeTag(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');
  }

  function resolveLocale(value, aliases) {
    var normalized = normalizeTag(value);
    if (!normalized) return null;

    return aliases[normalized] || aliases[normalized.split('-')[0]] || null;
  }

  function resolveBrowserLocale(languages, aliases) {
    for (var i = 0; i < languages.length; i += 1) {
      var locale = resolveLocale(languages[i], aliases);
      if (locale) return locale;
    }
    return null;
  }

  try {
    var config = JSON.parse(root.getAttribute('data-language-config') || '');
    var queryLanguage = new URL(window.location.href).searchParams.get('lang');
    var browserLanguages = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    var locale = resolveLocale(queryLanguage, config.queryAliases)
      || resolveBrowserLocale(browserLanguages, config.browserAliases)
      || config.defaultLocale;
    var localePath = config.paths[locale];

    if (!localePath || !/^[a-z0-9-]+$/.test(localePath)) {
      throw new Error('Invalid locale path.');
    }

    window.location.replace(new URL('./' + localePath + '/', window.location.href).href);
  } catch (error) {
    root.classList.remove('redirecting');
    root.classList.add('redirect-failed');
    console.error('Automatic language selection failed.', error);
  }
})();
