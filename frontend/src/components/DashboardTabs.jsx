import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import CompanyTab from './tabs/CompanyTab';
import EmployeesTab from './tabs/EmployeesTab';
import ProfileTab from './tabs/ProfileTab';
import ReportsTab from './tabs/ReportsTab';
import ScheduleTab from './tabs/ScheduleTab';
import ShiftsTab from './tabs/ShiftsTab';

export default function DashboardTabs({ userRole, language, title, rightSlot }) {
  const activeTabStorageKey = `shiftplanner_active_tab_${userRole || 'default'}`;
  const [activeTab, setActiveTab] = useState(() => (
    localStorage.getItem(activeTabStorageKey) || 'profile'
  ));

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

  useEffect(() => {
    const savedTab = localStorage.getItem(activeTabStorageKey);

    if (savedTab && tabs.some((tab) => tab.id === savedTab)) {
      setActiveTab(savedTab);
      return;
    }

    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('profile');
      localStorage.setItem(activeTabStorageKey, 'profile');
    }
  }, [activeTab, activeTabStorageKey, tabs]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem(activeTabStorageKey, tabId);
  };

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
      <header style={styles.topBar}>
        <h1 style={styles.brand}>{title || 'ShiftPlanner'}</h1>

        <nav style={styles.tabsContainer} aria-label="Dashboard navigation">
          {tabs.map((tab) => {
            const isActive = safeActiveTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {rightSlot && <div style={styles.rightSlot}>{rightSlot}</div>}
      </header>

      <main style={styles.content}>{renderContent()}</main>
    </div>
  );
}

const styles = {
  container: {
    height: '100%',
    width: '100%',
    background: 'linear-gradient(135deg, #002642 0%, #4f646f 100%)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  topBar: {
    flexShrink: 0,
    height: '96px',
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) max-content',
    alignItems: 'center',
    gap: '28px',
    padding: '0 28px',
    background: '#dee7e7',
    borderBottom: '1px solid rgba(79, 100, 111, 0.16)',
  },

  brand: {
    margin: 0,
    color: '#002642',
    fontSize: '26px',
    fontWeight: '900',
    letterSpacing: '-0.05em',
    whiteSpace: 'nowrap',
  },

  tabsContainer: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '4px',
    scrollbarWidth: 'none',
  },

  tab: {
    flexShrink: 0,
    padding: '12px 18px',
    background: 'transparent',
    border: 'none',
    borderRadius: '15px',
    fontSize: '15px',
    fontWeight: '700',
    color: '#4f646f',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },

  tabActive: {
    background: '#f4faff',
    color: '#002642',
    boxShadow: '0 8px 22px rgba(0, 38, 66, 0.12)',
  },

  rightSlot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '14px',
    flexShrink: 0,
    minWidth: 'fit-content',
  },
  content: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'auto',
  },
};
