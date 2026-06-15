// frontend/src/pages/EmployeeDashboard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import DashboardTabs from '../components/DashboardTabs';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { getStoredLanguage } from '../services/language';

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState(getStoredLanguage);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
  };

  const texts = {
    ru: {
      title: 'ShiftPlanner',
      logout: 'Выйти'
    },
    en: {
      title: 'ShiftPlanner',
      logout: 'Logout'
    }
  };

  const t = texts[language];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t.title}</h1>
        <div style={styles.headerRight}>
          <LanguageSwitcher onLanguageChange={handleLanguageChange} variant="light" />
          <button onClick={handleLogout} style={styles.logoutBtn}>{t.logout}</button>
        </div>
      </div>
      <DashboardTabs userRole={user?.role || 'employee'} language={language} />
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #002642 0%, #4F646F 100%)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#DEE7E7'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#002642',
    margin: 0
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  logoutBtn: {
    padding: '8px 16px',
    background: '#B7ADCF',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '500',
    cursor: 'pointer'
  }
};
