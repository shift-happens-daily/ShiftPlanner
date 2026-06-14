// frontend/src/components/DashboardTabs.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfileTab from './tabs/ProfileTab';
import CompanyTab from './tabs/CompanyTab';
import EmployeesTab from './tabs/EmployeesTab';
import ShiftsTab from './tabs/ShiftsTab';
import ScheduleTab from './tabs/ScheduleTab';
import ReportsTab from './tabs/ReportsTab';

export default function DashboardTabs({ userRole, language }) {
  const [activeTab, setActiveTab] = useState('profile');
  const { user, updateUser } = useAuth();

  const tabLabels = {
    ru: { profile: 'Личный кабинет', company: 'Информация о компании', employees: 'Сотрудники и позиции', shifts: 'Настройки смен', schedule: 'Расписание', reports: 'Отчет по сотрудникам' },
    en: { profile: 'Profile', company: 'Company Info', employees: 'Employees & Positions', shifts: 'Shift Settings', schedule: 'Schedule', reports: 'Employee Reports' }
  };
  const t = tabLabels[language] || tabLabels.ru;

  const employeeTabs = [
    { id: 'profile', label: t.profile },
    { id: 'company', label: t.company },
    { id: 'shifts', label: t.shifts },
    { id: 'schedule', label: t.schedule }
  ];

  const managerTabs = [
    { id: 'profile', label: t.profile },
    { id: 'company', label: t.company },
    { id: 'employees', label: t.employees },
    { id: 'shifts', label: t.shifts },
    { id: 'schedule', label: t.schedule },
    { id: 'reports', label: t.reports }
  ];

  const tabs = userRole === 'manager' ? managerTabs : employeeTabs;

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab language={language} user={user} updateUser={updateUser} />;
      case 'company': return <CompanyTab language={language} />;
      case 'employees': return <EmployeesTab language={language} />;
      case 'shifts': return <ShiftsTab language={language} />;
      case 'schedule': return <ScheduleTab language={language} />;
      case 'reports': return <ReportsTab language={language} />;
      default: return <ProfileTab language={language} user={user} updateUser={updateUser} />;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.tabsContainer}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}>
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.content}>{renderContent()}</div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #002642 0%, #4F646F 100%)' },
  tabsContainer: { display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '16px', background: '#DEE7E7', borderBottom: '1px solid #B7ADCF' },
  tab: { padding: '12px 20px', background: 'transparent', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '500', color: '#4F646F', cursor: 'pointer', transition: 'all 0.2s ease' },
  tabActive: { background: '#F4FAFF', color: '#002642', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  content: { padding: '20px' }
};