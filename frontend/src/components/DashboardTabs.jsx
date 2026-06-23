import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import CompanyTab from './tabs/CompanyTab';
import EmployeesTab from './tabs/EmployeesTab';
import ProfileTab from './tabs/ProfileTab';
import ReportsTab from './tabs/ReportsTab';
import ScheduleTab from './tabs/ScheduleTab';
import ScheduleReview from './tabs/ScheduleReview';
import ShiftsTab from './tabs/ShiftsTab';

export default function DashboardTabs({ userRole, language, title, rightSlot }) {
  const activeTabStorageKey = `shiftplanner_active_tab_${userRole || 'default'}`;
  const [activeTab, setActiveTab] = useState(() => (
    localStorage.getItem(activeTabStorageKey) || 'schedule'
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
      manager: 'Менеджер',
      employee: 'Сотрудник',
      openProfile: 'Открыть профиль',
    },
    en: {
      profile: 'Profile',
      company: 'Company',
      employees: 'Employees',
      shifts: 'Shift setup',
      schedule: 'Schedule',
      reports: 'Reports',
      manager: 'Manager',
      employee: 'Employee',
      openProfile: 'Open profile',
    },
  };

  const t = tabLabels[language] || tabLabels.ru;

  const tabs = useMemo(() => (
    userRole === 'manager'
      ? [
        { id: 'schedule', label: t.schedule },
        { id: 'company', label: t.company },
        { id: 'employees', label: t.employees },
        { id: 'shifts', label: t.shifts },
        { id: 'reports', label: t.reports },
      ]
      : [
        { id: 'schedule', label: t.schedule },
        { id: 'company', label: t.company },
        { id: 'shifts', label: t.shifts },
        { id: 'reports', label: t.reports },
      ]
  ), [t, userRole]);

  // 'profile' is reachable via the header profile section, not the nav tabs.
  const isValidTab = (tabId) => tabId === 'profile' || tabs.some((tab) => tab.id === tabId);
  const safeActiveTab = isValidTab(activeTab) ? activeTab : 'schedule';

  useEffect(() => {
    const savedTab = localStorage.getItem(activeTabStorageKey);

    if (savedTab && isValidTab(savedTab)) {
      setActiveTab(savedTab);
      return;
    }

    if (!isValidTab(activeTab)) {
      setActiveTab('schedule');
      localStorage.setItem(activeTabStorageKey, 'schedule');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeTabStorageKey, tabs]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem(activeTabStorageKey, tabId);
  };

  const fullName = user?.fullName || user?.full_name || user?.name || '';
  const positionName = user?.position?.name
    || (userRole === 'manager' ? t.manager : t.employee);

  const avatarInitials = (fullName.trim() || user?.email || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

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
        return userRole === 'manager' ? <ScheduleReview {...sharedProps} /> : <ScheduleTab {...sharedProps} />;
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

        <div style={styles.headerRight}>
          <button
            type="button"
            onClick={() => handleTabClick('profile')}
            style={{
              ...styles.profileButton,
              ...(safeActiveTab === 'profile' ? styles.profileButtonActive : {}),
            }}
            aria-label={t.openProfile}
            title={t.openProfile}
          >
            <span style={styles.avatar}>{avatarInitials}</span>
            <span style={styles.profileInfo}>
              <span style={styles.profileName}>{fullName || t.profile}</span>
              <span style={styles.profilePosition}>{positionName}</span>
            </span>
          </button>

          {rightSlot && <div style={styles.rightSlot}>{rightSlot}</div>}
        </div>
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

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '16px',
    flexShrink: 0,
    minWidth: 'fit-content',
  },

  profileButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 14px 8px 8px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.16)',
    borderRadius: '999px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    maxWidth: '240px',
  },

  profileButtonActive: {
    background: '#ffffff',
    boxShadow: '0 8px 22px rgba(0, 38, 66, 0.12)',
  },

  avatar: {
    flexShrink: 0,
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#002642',
    color: '#f4faff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    fontWeight: '800',
    letterSpacing: '0.02em',
  },

  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 0,
  },

  profileName: {
    color: '#002642',
    fontSize: '14px',
    fontWeight: '800',
    lineHeight: 1.2,
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  profilePosition: {
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: 1.2,
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
