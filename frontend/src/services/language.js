export function getStoredLanguage() {
  const language = localStorage.getItem('language');
  return language === 'en' ? 'en' : 'ru';
}
