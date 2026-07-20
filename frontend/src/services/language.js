const SUPPORTED_LANGUAGES = ['ru', 'en'];

function getSystemLanguage() {
  const browserLanguage =
    navigator.languages?.[0] ||
    navigator.language ||
    'en';

  const shortLanguage = browserLanguage.toLowerCase().split('-')[0];

  return SUPPORTED_LANGUAGES.includes(shortLanguage)
    ? shortLanguage
    : 'en';
}

export function getStoredLanguage() {
  const storedLanguage = localStorage.getItem('language');

  if (SUPPORTED_LANGUAGES.includes(storedLanguage)) {
    return storedLanguage;
  }

  return getSystemLanguage();
}

export function setStoredLanguage(language) {
  const nextLanguage = SUPPORTED_LANGUAGES.includes(language)
    ? language
    : 'en';

  localStorage.setItem('language', nextLanguage);
  document.documentElement.lang = nextLanguage;

  return nextLanguage;
}
