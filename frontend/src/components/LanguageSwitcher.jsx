// frontend/src/components/LanguageSwitcher.jsx
import { useEffect, useState } from 'react';
import { getStoredLanguage } from '../services/language';

export default function LanguageSwitcher({ onLanguageChange, variant = 'light' }) {
  const [language, setLanguage] = useState(getStoredLanguage);

  useEffect(() => {
    if (onLanguageChange) onLanguageChange(language);
  }, [language, onLanguageChange]);

  const toggleLanguage = () => {
    const newLang = language === 'ru' ? 'en' : 'ru';
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
    if (onLanguageChange) onLanguageChange(newLang);
  };

  // Разные стили для светлого и тёмного фона
  const styles = {
    light: {
      langBtn: {
        background: '#F4FAFF',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '20px',
        color: '#002642',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: 'none',
      },
    },
    dark: {
      langBtn: {
        background: 'rgba(244,250,255,0.2)',
        backdropFilter: 'blur(10px)',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '20px',
        color: '#F4FAFF',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: 'none',
      },
    },
  };

  const currentStyle = styles[variant] || styles.dark;

  return (
    <button type="button" onClick={toggleLanguage} style={currentStyle.langBtn}>
      {language === 'ru' ? 'ENG' : 'RU'}
    </button>  );
}
