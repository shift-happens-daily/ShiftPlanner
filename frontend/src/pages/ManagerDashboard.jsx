// frontend/src/pages/ManagerDashboard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import DashboardTabs from '../components/DashboardTabs';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { UnsavedChangesProvider } from '../context/UnsavedChangesContext';
import { getStoredLanguage } from '../services/language';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useUnsavedChanges } from '../context/useUnsavedChanges';

function ManagerDashboardContent({ language, onLanguageChange }) {
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const { confirmDiscardChanges, resetUnsavedChanges } = useUnsavedChanges();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (!confirmDiscardChanges()) return;
    resetUnsavedChanges();
    logout();
    navigate('/');
  };

  const handleLanguageChange = (lang) => {
    onLanguageChange(lang);
  };

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

  return (
    <div style={styles.container}>
      <DashboardTabs
        userRole={user?.role || 'manager'}
        language={language}
        title={t.title}
        rightSlot={(
          <div style={styles.headerRight}>
            <LanguageSwitcher onLanguageChange={handleLanguageChange} variant="light" />
            <button type="button" onClick={handleLogout} style={{
              ...styles.logoutBtn,
              ...(isMobile ? styles.logoutBtnMobile : {}),
            }}
            >
              {t.logout}
            </button>
          </div>
        )}
      />
    </div>
  );
}

export default function ManagerDashboard() {
  const [language, setLanguage] = useState(getStoredLanguage);

  return (
    <UnsavedChangesProvider language={language}>
      <ManagerDashboardContent language={language} onLanguageChange={setLanguage} />
    </UnsavedChangesProvider>
  );
}

const styles = {
  container: {
    height: '100dvh',
    width: '100%',
    background: 'linear-gradient(135deg, #002642 0%, #4f646f 100%)',
    overflow: 'hidden',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },

  logoutBtn: {
    height: '42px',
    padding: '0 22px',
    background: '#d7adcf',
    border: 'none',
    borderRadius: '16px',
    color: '#002642',
    fontWeight: '900',
    fontSize: '15px',
    cursor: 'pointer',
  },

  logoutBtnMobile: {
    height: '36px',
    padding: '0 12px',
    borderRadius: '12px',
    fontSize: '12px',
  },
};

