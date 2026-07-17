// frontend/src/pages/EmployeeDashboard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardTabs from '../components/DashboardTabs';
import { useAuth } from '../context/useAuth';
import { UnsavedChangesProvider } from '../context/UnsavedChangesContext';
import { useUnsavedChanges } from '../context/useUnsavedChanges';
import { getStoredLanguage } from '../services/language';

function EmployeeDashboardContent({ language, onLanguageChange }) {
  const { user, logout } = useAuth();
  const { confirmDiscardChanges, resetUnsavedChanges } = useUnsavedChanges();
  const navigate = useNavigate();

  const texts = {
    ru: {
      title: 'ShiftPlanner',
    },
    en: {
      title: 'ShiftPlanner',
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
    onLanguageChange(lang);
  };

  return (
    <div style={styles.container}>
      <DashboardTabs
        userRole={user?.role || 'employee'}
        language={language}
        title={t.title}
        onLanguageChange={handleLanguageChange}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default function EmployeeDashboard() {
  const [language, setLanguage] = useState(getStoredLanguage);

  return (
    <UnsavedChangesProvider language={language}>
      <EmployeeDashboardContent language={language} onLanguageChange={setLanguage} />
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

};
