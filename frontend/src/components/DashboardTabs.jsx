import { useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import CompanyTab from './tabs/CompanyTab';
import EmployeesTab from './tabs/EmployeesTab';
import ProfileTab from './tabs/ProfileTab';
import ReportsTab from './tabs/ReportsTab';
import ScheduleTab from './tabs/ScheduleTab';
import ShiftsTab from './tabs/ShiftsTab';

export default function DashboardTabs({ userRole, language }) {
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useAuth();

  const tabLabels = {
    ru: {
      profile: 'Профиль',
      company: 'Компания',
      employees: 'Сотрудники',
      shifts: 'Настройки смен',
      schedule: 'Расписание',
      reports: 'Отчеты',
    },
    en: {
      profile: 'Profile',
      company: 'Company',
      employees: 'Employees',
      shifts: 'Shift setup',
      schedule: 'Schedule',
      reports: 'Reports',
    },
  };

  const t = tabLabels[language] || tabLabels.ru;

  const tabs = useMemo(() => (
    userRole === 'manager'
      ? [
        { id: 'profile', label: t.profile },
        { id: 'company', label: t.company },
        { id: 'employees', label: t.employees },
        { id: 'shifts', label: t.shifts },
        { id: 'schedule', label: t.schedule },
        { id: 'reports', label: t.reports },
      ]
      : [
        { id: 'profile', label: t.profile },
        { id: 'company', label: t.company },
        { id: 'shifts', label: t.shifts },
        { id: 'schedule', label: t.schedule },
        { id: 'reports', label: t.reports },
      ]
  ), [t, userRole]);

  const safeActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'profile';

  const sharedProps = {
    language,
    userRole,
    user,
  };

  const renderContent = () => {
    switch (safeActiveTab) {
      case 'profile':
        return <ProfileTab {...sharedProps} />;
      case 'company':
        return <CompanyTab {...sharedProps} />;
      case 'employees':
        return <EmployeesTab {...sharedProps} />;
      case 'shifts':
        return <ShiftsTab {...sharedProps} />;
      case 'schedule':
        return <ScheduleTab {...sharedProps} />;
      case 'reports':
        return <ReportsTab {...sharedProps} />;
      default:
        return <ProfileTab {...sharedProps} />;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(safeActiveTab === tab.id ? styles.tabActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.content}>{renderContent()}</div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #002642 0%, #4F646F 100%)',
  },
  tabsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '16px',
    background: '#DEE7E7',
    borderBottom: '1px solid #B7ADCF',
  },
  tab: {
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#4F646F',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: '#F4FAFF',
    color: '#002642',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  content: {
    padding: '20px',
  },
};
