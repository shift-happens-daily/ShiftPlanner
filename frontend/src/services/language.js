const SUPPORTED_LANGUAGES = ['ru', 'en'];
const FALLBACK_LANGUAGE = 'en';

function getSystemLanguage() {
  if (typeof navigator === 'undefined') {
    return FALLBACK_LANGUAGE;
  }

  const browserLanguages = [
    ...(navigator.languages || []),
    navigator.language,
  ].filter(Boolean);

  for (const browserLanguage of browserLanguages) {
    const shortLanguage = browserLanguage.toLowerCase().split('-')[0];

    if (SUPPORTED_LANGUAGES.includes(shortLanguage)) {
      return shortLanguage;
    }
  }

  return FALLBACK_LANGUAGE;
}

export function getStoredLanguage() {
  const storedLanguage = localStorage.getItem('language');

  if (SUPPORTED_LANGUAGES.includes(storedLanguage)) {
    return storedLanguage;
  }

  return getSystemLanguage();
}

export function initializeLanguage() {
  const language = getStoredLanguage();

  document.documentElement.lang = language;

  return language;
}

export function setStoredLanguage(language) {
  const nextLanguage = SUPPORTED_LANGUAGES.includes(language)
    ? language
    : getSystemLanguage();

  localStorage.setItem('language', nextLanguage);
  document.documentElement.lang = nextLanguage;

  return nextLanguage;
}
