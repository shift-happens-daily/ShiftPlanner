import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useIsMobile } from '../hooks/useMediaQuery';
import CompanyTab from './tabs/CompanyTab';
import EmployeesTab from './tabs/EmployeesTab';
import ProfileTab from './tabs/ProfileTab';
import ReportsTab from './tabs/ReportsTab';
import ScheduleTab from './tabs/ScheduleTab';
import ScheduleReview from './tabs/ScheduleReview';
import ShiftsTab from './tabs/ShiftsTab';

const TAB_ICONS = {
  schedule: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  company: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V8L12 4L20 8V20H4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 20V13H15V20" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  employees: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M4 19C4 16 6.2 14 9 14C11.8 14 14 16 14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 19C15.8 16.8 17.2 15 19 15C20.1 15 21 15.4 21.7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  shifts: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  reports: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19V11M12 19V5M19 19V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

export default function DashboardTabs({ userRole, language, title, rightSlot }) {
  const isMobile = useIsMobile();
  const activeTabStorageKey = `shiftplanner_active_tab_${userRole || 'default'}`;
  const [activeTab, setActiveTab] = useState(() => (
    localStorage.getItem(activeTabStorageKey) || 'schedule'
  ));

  const { user } = useAuth();
  const isEmployeePending = userRole === 'employee' && user?.employeeStatus === 'pending';

  const pendingTexts = {
    ru: {
      title: 'Ожидается подтверждение',
      text: 'Менеджер должен принять вашу заявку во вкладке «Компания». После этого откроются расписание, смены и отчёты.',
      action: 'Перейти в «Компания»',
    },
    en: {
      title: 'Waiting for approval',
      text: 'A manager must approve your request in the Company tab. Schedule, shifts, and reports will unlock after approval.',
      action: 'Open Company tab',
    },
  };
  const pendingT = pendingTexts[language] || pendingTexts.ru;

  const renderPendingNotice = () => (
    <section style={pendingStyles.page}>
      <div style={pendingStyles.card}>
        <h2 style={pendingStyles.title}>{pendingT.title}</h2>
        <p style={pendingStyles.text}>{pendingT.text}</p>
        <button type="button" onClick={() => handleTabClick('company')} style={pendingStyles.button}>
          {pendingT.action}
        </button>
      </div>
    </section>
  );

  const tabLabels = {
    ru: {
      profile: 'Профиль',
      company: 'Компания',
      employees: 'Сотрудники',
      shifts: 'Смены',
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
      shifts: 'Shifts',
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
    if (isEmployeePending && ['schedule', 'shifts', 'reports'].includes(safeActiveTab)) {
      return renderPendingNotice();
    }

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

  const renderTabButton = (tab, compact = false) => {
    const isActive = safeActiveTab === tab.id;

    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => handleTabClick(tab.id)}
        style={{
          ...styles.tab,
          ...(compact ? styles.tabCompact : {}),
          ...(isActive ? styles.tabActive : {}),
        }}
      >
        {compact ? (
          <>
            <span style={styles.tabIcon}>{TAB_ICONS[tab.id]}</span>
            <span style={{
              ...styles.tabCompactLabel,
              ...(isActive ? styles.tabCompactLabelActive : {}),
            }}
            >
              {tab.label}
            </span>
          </>
        ) : tab.label}
      </button>
    );
  };

  return (
    <div style={styles.container}>
      <header style={{
        ...styles.topBar,
        ...(isMobile ? styles.topBarMobile : {}),
      }}
      >
        <h1 style={{
          ...styles.brand,
          ...(isMobile ? styles.brandMobile : {}),
        }}
        >
          {title || 'ShiftPlanner'}
        </h1>

        {!isMobile && (
          <nav style={styles.tabsContainer} aria-label="Dashboard navigation">
            {tabs.map((tab) => renderTabButton(tab))}
          </nav>
        )}

        <div style={{
          ...styles.headerRight,
          ...(isMobile ? styles.headerRightMobile : {}),
        }}
        >
          <button
            type="button"
            onClick={() => handleTabClick('profile')}
            style={{
              ...styles.profileButton,
              ...(isMobile ? styles.profileButtonMobile : {}),
              ...(safeActiveTab === 'profile' ? styles.profileButtonActive : {}),
            }}
            aria-label={t.openProfile}
            title={t.openProfile}
          >
            <span style={styles.avatar}>{avatarInitials}</span>
            {!isMobile && (
              <span style={styles.profileInfo}>
                <span style={styles.profileName}>{fullName || t.profile}</span>
                <span style={styles.profilePosition}>{positionName}</span>
              </span>
            )}
          </button>

          {rightSlot && (
            <div style={{
              ...styles.rightSlot,
              ...(isMobile ? styles.rightSlotMobile : {}),
            }}
            >
              {rightSlot}
            </div>
          )}
        </div>
      </header>

      <main style={{
        ...styles.content,
        ...(isMobile ? styles.contentMobile : {}),
      }}
      >
        {renderContent()}
      </main>

      {isMobile && (
        <nav style={styles.bottomNav} aria-label="Mobile dashboard navigation">
          {tabs.map((tab) => renderTabButton(tab, true))}
        </nav>
      )}
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
    textAlign: 'left',
  },

  topBar: {
    flexShrink: 0,
    height: '68px',
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) max-content',
    alignItems: 'center',
    gap: '22px',
    padding: '0 24px',
    background: '#dee7e7',
    borderBottom: '1px solid rgba(79, 100, 111, 0.16)',
  },

  topBarMobile: {
    height: 'auto',
    minHeight: '58px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 12px',
  },

  brand: {
    margin: 0,
    color: '#002642',
    fontSize: '23px',
    fontWeight: '900',
    letterSpacing: '-0.05em',
    whiteSpace: 'nowrap',
  },

  brandMobile: {
    fontSize: '18px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: '1 1 auto',
  },

  tabsContainer: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '2px',
    scrollbarWidth: 'none',
  },

  tab: {
    flexShrink: 0,
    padding: '9px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '13px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#4f646f',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },

  tabCompact: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px 4px',
    borderRadius: '12px',
    fontSize: '11px',
    background: 'transparent',
  },

  tabIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 0,
  },

  tabCompactLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#4f646f',
    lineHeight: 1.1,
    textAlign: 'center',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  tabCompactLabelActive: {
    color: '#002642',
  },

  tabActive: {
    background: '#f4faff',
    color: '#002642',
    boxShadow: 'none',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexShrink: 0,
    minWidth: 'fit-content',
  },

  headerRightMobile: {
    gap: '8px',
    flexShrink: 0,
  },

  profileButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '5px 12px 5px 5px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.16)',
    borderRadius: '999px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    maxWidth: '220px',
  },

  profileButtonMobile: {
    padding: '4px',
    maxWidth: 'none',
  },

  profileButtonActive: {
    background: '#ffffff',
    boxShadow: 'none',
  },

  avatar: {
    flexShrink: 0,
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: '#002642',
    color: '#f4faff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
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
    fontSize: '13px',
    fontWeight: '800',
    lineHeight: 1.15,
    maxWidth: '145px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  profilePosition: {
    color: '#4f646f',
    fontSize: '11px',
    fontWeight: '600',
    lineHeight: 1.15,
    maxWidth: '145px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  rightSlot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexShrink: 0,
    minWidth: 'fit-content',
  },

  rightSlotMobile: {
    gap: '6px',
  },

  content: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
    background: '#f4faff',
  },

  contentMobile: {
    paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
  },

  bottomNav: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    gap: '2px',
    padding: '6px 6px calc(6px + env(safe-area-inset-bottom, 0px))',
    background: '#dee7e7',
    borderTop: '1px solid rgba(79, 100, 111, 0.16)',
    boxShadow: '0 -8px 24px rgba(0, 38, 66, 0.08)',
  },
};

const pendingStyles = {
  page: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '22px',
  },
  card: {
    maxWidth: '720px',
    margin: '40px auto',
    padding: '28px',
    borderRadius: '24px',
    background: '#f4faff',
    border: '1px solid rgba(222, 231, 231, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  title: {
    margin: 0,
    color: '#002642',
    fontSize: '24px',
    fontWeight: '850',
  },
  text: {
    margin: 0,
    color: '#475569',
    fontSize: '15px',
    lineHeight: 1.55,
  },
  button: {
    alignSelf: 'flex-start',
    height: '42px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '14px',
    background: '#d7adcf',
    color: '#002642',
    fontWeight: '800',
    cursor: 'pointer',
  },
};
