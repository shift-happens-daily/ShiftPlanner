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
      fullName: 'Полное имя',
      email: 'Email',
      role: 'Роль',
      employeeId: 'Employee ID',
      company: 'Компания',
      branch: 'Филиал',
      position: 'Позиция',
      refresh: 'Обновить',
      empty: 'Нет данных',
      manager: 'Менеджер',
      employee: 'Сотрудник',
      refreshError: 'Не удалось обновить профиль.',
    },
    en: {
      title: 'Profile',
      fullName: 'Full name',
      email: 'Email',
      role: 'Role',
      employeeId: 'Employee ID',
      company: 'Company',
      branch: 'Branch',
      position: 'Position',
      refresh: 'Refresh',
      empty: 'No data',
      manager: 'Manager',
      employee: 'Employee',
      refreshError: 'Failed to refresh profile.',
    },
  };

  const t = texts[language] || texts.ru;

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

  const rows = [
    { label: t.fullName, value: user?.fullName },
    { label: t.email, value: user?.email },
    { label: t.role, value: user?.role ? t[user.role] : null },
    { label: t.employeeId, value: user?.employeeId },
    { label: t.company, value: user?.company?.name },
    { label: t.branch, value: user?.branch?.name },
    { label: t.position, value: user?.position?.name },
  ];

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{t.title}</h2>
        </div>
        <button onClick={handleRefresh} style={styles.actionButton} disabled={isRefreshing}>
          {isRefreshing ? '...' : t.refresh}
        </button>
      </div>

      {errorMessage && <div style={styles.error}>{errorMessage}</div>}

      <div style={styles.infoList}>
        {rows.map((row) => (
          <div key={row.label} style={styles.infoRow}>
            <span style={styles.infoLabel}>{row.label}</span>
            <span style={styles.infoValue}>{row.value || t.empty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
    maxWidth: '820px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#002642',
    margin: 0,
  },
  actionButton: {
    padding: '10px 16px',
    background: '#002642',
    border: 'none',
    borderRadius: '12px',
    color: '#F4FAFF',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#FDEAEA',
    color: '#A61B1B',
    fontSize: '14px',
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  infoRow: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr',
    gap: '12px',
    paddingBottom: '14px',
    borderBottom: '1px solid #DEE7E7',
  },
  infoLabel: {
    color: '#4F646F',
    fontWeight: '600',
  },
  infoValue: {
    color: '#002642',
  },
};
