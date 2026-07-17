// frontend/src/pages/ManagerDashboard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import DashboardTabs from '../components/DashboardTabs';
import { UnsavedChangesProvider } from '../context/UnsavedChangesContext';
import { getStoredLanguage } from '../services/language';
import { useUnsavedChanges } from '../context/useUnsavedChanges';

function ManagerDashboardContent({ language, onLanguageChange }) {
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
    },
    en: {
      title: 'ShiftPlanner',
    },
  };

  const t = texts[language] || texts.ru;

  return (
    <div style={styles.container}>
      <DashboardTabs
        userRole={user?.role || 'manager'}
        language={language}
        title={t.title}
        onLanguageChange={handleLanguageChange}
        onLogout={handleLogout}
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
};

