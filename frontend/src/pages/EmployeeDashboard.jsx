// frontend/src/pages/EmployeeDashboard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardTabs from '../components/DashboardTabs';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAuth } from '../context/useAuth';
import { UnsavedChangesProvider } from '../context/UnsavedChangesContext';
import { useUnsavedChanges } from '../context/useUnsavedChanges';
import { getStoredLanguage } from '../services/language';
import { useIsMobile } from '../hooks/useMediaQuery';

function EmployeeDashboardContent() {
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const { confirmDiscardChanges, resetUnsavedChanges } = useUnsavedChanges();
  const navigate = useNavigate();
  const [language, setLanguage] = useState(getStoredLanguage);

  const texts = {
    ru: {
      title: 'ShiftPlanner',
      logout: 'Выйти',
    },
    en: {
      title: 'ShiftPlanner',
      logout: 'Logout',
    },
  };

  const t = texts[language] || texts.ru;

  const handleLogout = () => {
    if (!confirmDiscardChanges()) return;
    resetUnsavedChanges();
    logout();
    navigate('/');
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
  };

  const rightSlot = (
    <>
      <LanguageSwitcher onLanguageChange={handleLanguageChange} variant="light" />
      <button type="button" onClick={handleLogout} style={{
        ...styles.logoutBtn,
        ...(isMobile ? styles.logoutBtnMobile : {}),
      }}
      >
        {t.logout}
      </button>
    </>
  );

  return (
    <div style={styles.container}>
      <DashboardTabs
        userRole={user?.role || 'employee'}
        language={language}
        title={t.title}
        rightSlot={rightSlot}
      />
    </div>
  );
}

export default function EmployeeDashboard() {
  return (
    <UnsavedChangesProvider>
      <EmployeeDashboardContent />
    </UnsavedChangesProvider>
  );
}

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    minHeight: '100vh',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #002642 0%, #4f646f 100%)',
  },

  logoutBtn: {
    height: '42px',
    padding: '0 14px',
    background: '#d7adcf',
    border: 'none',
    borderRadius: '14px',
    color: '#002642',
    fontWeight: '900',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 10px 24px rgba(0, 38, 66, 0.08)',
  },

  logoutBtnMobile: {
    height: '36px',
    padding: '0 10px',
    borderRadius: '12px',
    fontSize: '12px',
  },
};
