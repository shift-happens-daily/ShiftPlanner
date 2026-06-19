import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { extractApiErrorMessage } from '../../services/error';

export default function ProfileTab({ language, user }) {
  const { refreshUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const texts = {
    ru: {
      title: 'Профиль',
      subtitle: 'Основная информация о вас.',
      fullName: 'Полное имя',
      email: 'Email',
      role: 'Роль',
      employeeId: 'ID сотрудника',
      company: 'Компания',
      branch: 'Филиал',
      position: 'Позиция',
      refresh: 'Обновить',
      empty: 'Нет данных',
      noCompany: 'Не привязана',
      manager: 'Менеджер',
      employee: 'Сотрудник',
      refreshError: 'Не удалось обновить профиль.',
    },
    en: {
      title: 'Profile',
      subtitle: 'Basic information about you.',
      fullName: 'Full name',
      email: 'Email',
      role: 'Role',
      employeeId: 'Employee ID',
      company: 'Company',
      branch: 'Branch',
      position: 'Position',
      refresh: 'Refresh',
      empty: 'No data',
      noCompany: 'Not linked',
      manager: 'Manager',
      employee: 'Employee',
      refreshError: 'Failed to refresh profile.',
    },
  };

  const t = texts[language] || texts.ru;

  const role = user?.role;
  const isManager = role === 'manager';
  const isEmployee = role === 'employee';

  const fullName = user?.fullName || user?.full_name || user?.name || t.empty;
  const email = user?.email || t.empty;
  const employeeId = user?.employeeId || user?.employee_id;
  const managerCompanyStorageKey = `shiftplanner_manager_company_${user?.email || 'current'}`;

  let savedManagerCompany = null;

  try {
    const rawCompany = localStorage.getItem(managerCompanyStorageKey);
    savedManagerCompany = rawCompany ? JSON.parse(rawCompany) : null;
  } catch {
    savedManagerCompany = null;
  }

  const fallbackCompany = user?.role === 'manager' ? savedManagerCompany : null;
  const companyName = user?.company?.name || fallbackCompany?.name;
  const branchName = user?.branch?.name;
  const positionName = user?.position?.name;

  const rows = [
    {
      label: t.fullName,
      value: fullName,
    },
    {
      label: t.email,
      value: email,
    },
  ];

  // Добавляем "Роль" только для менеджера
  if (isManager) {
    rows.push({
      label: t.role,
      value: t.manager,
    });
  }

  rows.push({
    label: t.company,
    value: companyName || t.noCompany,
    muted: !companyName,
  });

  if (isEmployee) {
    rows.push(
      {
        label: t.employeeId,
        value: employeeId || t.empty,
        muted: !employeeId,
      },
      {
        label: t.branch,
        value: branchName || t.empty,
        muted: !branchName,
      },
      {
        label: t.position,
        value: positionName || t.empty,
        muted: !positionName,
      }
    );
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setErrorMessage('');

    try {
      await refreshUser();
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.refreshError, language));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{t.title}</h2>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            style={isRefreshing ? styles.refreshButtonDisabled : styles.refreshButton}
            disabled={isRefreshing}
          >
            {isRefreshing ? '...' : t.refresh}
          </button>
        </div>

        {errorMessage && <div style={styles.error}>{errorMessage}</div>}

        <div style={styles.rows}>
          {rows.map((row) => (
            <div key={row.label} style={styles.row}>
              <span style={styles.label}>{row.label}</span>
              <span style={row.muted ? styles.valueMuted : styles.value}>
                {row.value || t.empty}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const styles = {
  page: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: '56px 24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    overflow: 'auto',
  },

  card: {
    width: 'min(100%, 1040px)',
    minHeight: '520px',
    maxHeight: '100%',
    boxSizing: 'border-box',
    padding: '36px 44px',
    borderRadius: '28px',
    background: '#f4faff',
    border: '1px solid rgba(222, 231, 231, 0.95)',
    boxShadow: '0 24px 60px rgba(0, 38, 66, 0.18)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
  },

  title: {
    margin: 0,
    color: '#002642',
    fontSize: '26px',
    fontWeight: '800',
    letterSpacing: '-0.02em',
  },

  subtitle: {
    margin: '4px 0 0',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '500',
  },

  refreshButton: {
    padding: '9px 16px',
    border: 'none',
    borderRadius: '12px',
    background: '#002642',
    color: '#f4faff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  refreshButtonDisabled: {
    padding: '9px 16px',
    border: 'none',
    borderRadius: '12px',
    background: '#4f646f',
    color: '#f4faff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'default',
    opacity: 0.7,
  },

  error: {
    marginBottom: '14px',
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'rgba(215, 173, 207, 0.35)',
    color: '#8d1d1d',
    fontSize: '14px',
    fontWeight: '600',
  },

  rows: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))',
    gap: '34px 42px',
    alignContent: 'flex-start',
    justifyContent: 'center',
    overflow: 'auto',
    minHeight: 0,
  },

  row: {
    minHeight: '115px',
    boxSizing: 'border-box',
    padding: '22px 24px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    gap: '8px',
  },

  label: {
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '700',
  },

  value: {
    color: '#002642',
    fontSize: '20px',
    fontWeight: '800',
    overflowWrap: 'anywhere',
  },

  valueMuted: {
    color: 'rgba(79, 100, 111, 0.7)',
    fontSize: '20px',
    fontWeight: '700',
    overflowWrap: 'anywhere',
  },
};