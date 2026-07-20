import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useIsMobile } from '../hooks/useMediaQuery';
import EmployeeDashboardTab from './tabs/EmployeeDashboardTab';
import EmployeeCompanyTab from './tabs/EmployeeCompanyTab';
import CompanyTab from './tabs/CompanyTab';
import EmployeesTab from './tabs/EmployeesTab';
import ProfileTab from './tabs/ProfileTab';
import ReportsTab from './tabs/ReportsTab';
import ScheduleTab from './tabs/ScheduleTab';
import ScheduleReview from './tabs/ScheduleReview';
import ShiftsTab from './tabs/ShiftsTab';
import { getPositionLabel } from '../utils/employeeDisplay';
import { usePositionTitleRevision } from '../hooks/usePositionTitleRevision';
import { useUnsavedChanges } from '../context/useUnsavedChanges';
import ManagerExchangeInbox from './ManagerExchangeInbox';
import { setStoredLanguage } from '../services/language';
import {
  User,
  Languages,
  LogOut,
  ChevronDown,
} from "lucide-react";

const APP_ICON_SRC = '/v2-Photoroom.png';

const TAB_ICONS = {
  dashboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
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

export default function DashboardTabs({
  userRole,
  language,
  title,
  onLanguageChange,
  onLogout,
}) {
  usePositionTitleRevision();
  const isMobile = useIsMobile();
  const {
    isDirty,
    message: unsavedMessage,
    confirmDiscardChanges,
    resetUnsavedChanges,
  } = useUnsavedChanges();
  const activeTabStorageKey = `shiftplanner_active_tab_${userRole || 'default'}`;
  const defaultEmployeeTab = 'dashboard';
  const [activeTab, setActiveTab] = useState(() => {
    const stored = localStorage.getItem(activeTabStorageKey);
    if (stored) return stored;
    return userRole === 'employee' ? defaultEmployeeTab : 'schedule';
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

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
      dashboard: 'Доска',
      profile: 'Профиль',
      company: 'Компания',
      employees: 'Сотрудники',
      shifts: 'Смены',
      schedule: 'Расписание',
      reports: 'Отчёты',
      manager: 'Менеджер',
      employee: 'Сотрудник',
      openProfile: 'Открыть профиль',
      noPosition: 'Без позиции',
      language: 'Язык',
      logout: 'Выйти',
    },
    en: {
      dashboard: 'Dashboard',
      profile: 'Profile',
      company: 'Company',
      employees: 'Employees',
      shifts: 'Shifts',
      schedule: 'Schedule',
      reports: 'Reports',
      manager: 'Manager',
      employee: 'Employee',
      openProfile: 'Open profile',
      noPosition: 'No position',
      language: 'Language',
      logout: 'Logout',
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
        { id: 'dashboard', label: t.dashboard },
        { id: 'schedule', label: t.schedule },
        { id: 'company', label: t.company },
        { id: 'shifts', label: t.shifts },
        { id: 'reports', label: t.reports },
      ]
  ), [t, userRole]);

  const isValidTab = (tabId) => tabId === 'profile' || tabs.some((tab) => tab.id === tabId);
  const safeActiveTab = isValidTab(activeTab)
    ? activeTab
    : (userRole === 'employee' ? defaultEmployeeTab : 'schedule');

  useEffect(() => {
    if (!isValidTab(activeTab)) {
      localStorage.setItem(activeTabStorageKey, 'schedule');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeTabStorageKey, tabs]);

  useEffect(() => {
    function handleClick(event) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);

    return () =>
      document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleTabClick = (tabId) => {
    if (tabId !== safeActiveTab && !confirmDiscardChanges()) {
      return;
    }

    if (tabId !== safeActiveTab) {
      resetUnsavedChanges();
    }

    setActiveTab(tabId);
    localStorage.setItem(activeTabStorageKey, tabId);
  };

  const handleProfileClick = () => {
    setProfileMenuOpen(false);
    handleTabClick('profile');
  };

  const handleLanguageClick = () => {
    const nextLanguage = language === 'ru' ? 'en' : 'ru';
    setStoredLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage);
    setProfileMenuOpen(false);
  };

  const handleLogoutClick = () => {
    setProfileMenuOpen(false);
    onLogout?.();
  };

  const fullName = user?.fullName || user?.full_name || user?.name || '';
  const positionName = getPositionLabel(
    {
      id: user?.position?.id ?? user?.position_id,
      ...user?.position,
    },
    userRole === 'manager' ? t.manager : t.noPosition,
  );

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
    onNavigateTab: handleTabClick,
  };

  const renderContent = () => {
    if (isEmployeePending && ['schedule', 'shifts', 'reports'].includes(safeActiveTab)) {
      return renderPendingNotice();
    }

    switch (safeActiveTab) {
      case 'dashboard':
        return userRole === 'employee' ? <EmployeeDashboardTab {...sharedProps} /> : <ProfileTab {...sharedProps} />;
      case 'profile':
        return <ProfileTab {...sharedProps} />;
      case 'company':
        return userRole === 'employee'
          ? <EmployeeCompanyTab {...sharedProps} />
          : <CompanyTab {...sharedProps} />;
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
        <div style={{
          ...styles.brandWrap,
          ...(isMobile ? styles.brandWrapMobile : {}),
        }}
        >
          <img
            src={APP_ICON_SRC}
            alt=""
            aria-hidden="true"
            style={{
              ...styles.brandLogo,
              ...(isMobile ? styles.brandLogoMobile : {}),
            }}
          />
          {isMobile ? (
            <span style={styles.brandSrOnly}>{title || 'ShiftPlanner'}</span>
          ) : (
            <h1 style={styles.brand}>
              {title || 'ShiftPlanner'}
            </h1>
          )}
        </div>

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
          {userRole === 'manager' ? (
            <ManagerExchangeInbox language={language} isMobile={isMobile} />
          ) : null}

          <div ref={profileMenuRef} style={styles.profileMenuWrapper}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              style={{
                ...styles.profileButton,
                ...(isMobile ? styles.profileButtonMobile : {}),
                ...(profileMenuOpen || safeActiveTab === 'profile'
                  ? styles.profileButtonActive
                  : {}),
              }}
              aria-label={t.openProfile}
              aria-expanded={profileMenuOpen}
            >
              <span style={styles.avatar}>{avatarInitials}</span>

              {!isMobile && (
                <span style={styles.profileInfo}>
                  <span style={styles.profileName}>
                    {fullName || t.profile}
                  </span>
                  <span style={styles.profilePosition}>
                    {positionName}
                  </span>
                </span>
              )}

              <ChevronDown
                size={16}
                style={{
                  ...styles.profileChevron,
                  ...(profileMenuOpen ? styles.profileChevronOpen : {}),
                }}
              />
            </button>

            {profileMenuOpen && (
              <div style={{
                ...styles.profileDropdown,
                ...(isMobile ? styles.profileDropdownMobile : {}),
              }}
              >
                <button
                  type="button"
                  onClick={handleProfileClick}
                  style={styles.profileMenuItem}
                >
                  <User
                    size={18}
                    style={styles.profileMenuIcon}
                  />
                  <span>{t.profile}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLanguageClick}
                  style={styles.profileMenuItem}
                >
                  <Languages
                    size={18}
                    style={styles.profileMenuIcon}
                  />

                  <span style={styles.profileMenuItemContent}>
                    <span>{t.language}</span>
                    <strong style={styles.profileLanguageValue}>
                      {language === 'ru' ? 'EN' : 'RU'}
                    </strong>
                  </span>
                </button>

                <div style={styles.profileMenuDivider} />

                <button
                  type="button"
                  onClick={handleLogoutClick}
                  style={{
                    ...styles.profileMenuItem,
                    ...styles.profileLogoutItem,
                  }}
                >
                  <LogOut
                    size={18}
                    style={styles.profileMenuIcon}
                  />
                  <span>{t.logout}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{
        ...styles.content,
        ...(isMobile ? styles.contentMobile : {}),
        ...(userRole === 'employee' && ['dashboard', 'company'].includes(safeActiveTab) ? styles.contentScrollHost : {}),
      }}
      >
        {isDirty && (
          <div style={styles.unsavedBanner} role="alert">
            {unsavedMessage}
          </div>
        )}
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

  brandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },

  brandWrapMobile: {
    flex: '0 0 auto',
  },

  brandLogo: {
    width: '32px',
    height: '32px',
    flexShrink: 0,
    objectFit: 'contain',
  },

  brandLogoMobile: {
    width: '28px',
    height: '28px',
  },

  brand: {
    margin: 0,
    color: '#002642',
    fontSize: '23px',
    fontWeight: '900',
    letterSpacing: '-0.05em',
    whiteSpace: 'nowrap',
  },

  brandSrOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
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

  profileMenuWrapper: {
    position: 'relative',
    flexShrink: 0,
  },

  profileChevron: {
    marginLeft: '2px',
    color: '#4f646f',
    fontSize: '16px',
    lineHeight: 1,
    transition: 'transform 0.2s ease',
  },

  profileChevronOpen: {
    transform: 'rotate(180deg)',
  },

  profileDropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    zIndex: 1000,
    width: '230px',
    boxSizing: 'border-box',
    padding: '8px',
    borderRadius: '16px',
    border: '1px solid rgba(79, 100, 111, 0.16)',
    background: '#ffffff',
    boxShadow: '0 18px 40px rgba(0, 38, 66, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },

  profileDropdownMobile: {
    position: 'fixed',
    top: '66px',
    right: '12px',
    width: 'min(230px, calc(100vw - 24px))',
  },

  profileMenuItem: {
    width: '100%',
    minHeight: '44px',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: 'none',
    borderRadius: '10px',
    background: 'transparent',
    color: '#002642',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    fontWeight: '750',
    textAlign: 'left',
    cursor: 'pointer',
  },

  profileMenuIcon: {
    width: 18,
    height: 18,
    flexShrink: 0,
    color: '#4f646f',
  },

  profileMenuItemContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },

  profileLanguageValue: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '800',
  },

  profileMenuDivider: {
    height: '1px',
    margin: '4px 0',
    background: '#dee7e7',
  },

  profileLogoutItem: {
    color: '#b42318',
  },

  profileButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '7px 16px 7px 7px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.16)',
    borderRadius: '999px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    maxWidth: '260px',
    minHeight: '52px',
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
    fontSize: '15px',
    fontWeight: '800',
    lineHeight: 1.15,
    maxWidth: '145px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  profilePosition: {
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: 1.15,
    maxWidth: '145px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  content: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
    background: '#f4faff',
    position: 'relative',
  },

  contentMobile: {
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
  },

  contentScrollHost: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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

  unsavedBanner: {
    position: 'absolute',
    top: '12px',
    left: '50%',
    zIndex: 40,
    transform: 'translateX(-50%)',
    maxWidth: 'calc(100% - 24px)',
    minHeight: '40px',
    boxSizing: 'border-box',
    padding: '10px 16px',
    borderRadius: '12px',
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
    fontSize: '14px',
    fontWeight: '850',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.12)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
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
