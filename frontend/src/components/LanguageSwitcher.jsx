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
        background: '#DEE7E7',
        border: '1px solid #B7ADCF',
        padding: '8px 16px',
        borderRadius: '20px',
        color: '#002642',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }
    },
    dark: {
      langBtn: {
        background: 'rgba(244,250,255,0.2)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(244,250,255,0.3)',
        padding: '8px 16px',
        borderRadius: '20px',
        color: '#F4FAFF',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }
    }
  };

  const currentStyle = styles[variant] || styles.dark;

  return (
    <button onClick={toggleLanguage} style={currentStyle.langBtn}>
      🌐 {language === 'ru' ? 'RU' : 'EN'}
    </button>
  );
}
