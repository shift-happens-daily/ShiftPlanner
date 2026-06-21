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
        border: '2px solid #002642',
        padding: '8px 16px',
        borderRadius: '20px',
        color: '#002642',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0, 38, 66, 0.08)',
      },
    },
    dark: {
      langBtn: {
        background: 'rgba(244,250,255,0.2)',
        backdropFilter: 'blur(10px)',
        border: '2px solid rgba(244, 250, 255, 0.75)',
        padding: '8px 16px',
        borderRadius: '20px',
        color: '#F4FAFF',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
      },
    },
  };

  const currentStyle = styles[variant] || styles.dark;

  return (
    <button type="button" onClick={toggleLanguage} style={currentStyle.langBtn}>
      {language === 'ru' ? 'RU' : 'EN'}
    </button>
  );
}
