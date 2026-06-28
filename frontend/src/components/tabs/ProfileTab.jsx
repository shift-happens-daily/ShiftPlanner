import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { deleteAccountRequest } from '../../services/authService';
import { leaveCompany, updateMyPosition } from '../../services/employeeService';
import { extractApiErrorMessage } from '../../services/error';
import { createPosition, listPositions } from '../../services/positionService';
import { useTabResponsive } from '../../utils/tabResponsive';

function getPositionLabel(position) {
  return position?.title || position?.name || position?.position_title || '';
}

export default function ProfileTab({ language, user }) {
  const r = useTabResponsive(1040);
  const navigate = useNavigate();
  const { refreshUser, clearAuth } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [positions, setPositions] = useState([]);
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [newPositionTitle, setNewPositionTitle] = useState('');

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
      deleteAccount: 'Удалить аккаунт',
      confirmDeleteAccount: 'Удалить аккаунт без возможности восстановления?',
      accountDeleted: 'Аккаунт удалён.',
      deleteAccountError: 'Не удалось удалить аккаунт.',
      leaveCompany: 'Покинуть компанию',
      confirmLeaveCompany: 'Отвязать аккаунт от текущей компании?',
      leftCompany: 'Вы покинули компанию.',
      leaveCompanyError: 'Не удалось покинуть компанию.',
      addPosition: 'Добавить позицию',
      positionPlaceholder: 'Например: Бариста',
      savePosition: 'Сохранить позицию',
      selectPosition: 'Выберите позицию',
      positionSaved: 'Позиция сохранена.',
      positionCreated: 'Позиция добавлена.',
      positionError: 'Не удалось обновить позицию.',
      requiredPosition: 'Введите название позиции.',
      positionSection: 'Моя позиция',
      positionSectionHint: 'Выберите позицию или добавьте новую для компании.',
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
      deleteAccount: 'Delete account',
      confirmDeleteAccount: 'Delete your account permanently?',
      accountDeleted: 'Account deleted.',
      deleteAccountError: 'Failed to delete account.',
      leaveCompany: 'Leave company',
      confirmLeaveCompany: 'Unlink your account from the current company?',
      leftCompany: 'You left the company.',
      leaveCompanyError: 'Failed to leave company.',
      addPosition: 'Add position',
      positionPlaceholder: 'Example: Barista',
      savePosition: 'Save position',
      selectPosition: 'Select position',
      positionSaved: 'Position saved.',
      positionCreated: 'Position added.',
      positionError: 'Failed to update position.',
      requiredPosition: 'Enter position title.',
      positionSection: 'My position',
      positionSectionHint: 'Select a position or add a new one for your company.',
    },
  };

  const t = texts[language] || texts.ru;

  const role = user?.role;
  const isManager = role === 'manager';
  const isEmployee = role === 'employee';
  const hasCompany = Boolean(user?.company);

  const fullName = user?.fullName || user?.full_name || user?.name || t.empty;
  const email = user?.email || t.empty;
  const employeeId = user?.employeeId || user?.employee_id;

  const companyName = user?.company?.name;
  const branchName = user?.branch?.name;
  const positionName = user?.position?.name;

  useEffect(() => {
    if (!isEmployee || !hasCompany) {
      return undefined;
    }

    let cancelled = false;

    async function loadPositions() {
      try {
        const data = await listPositions();
        if (cancelled) return;
        const items = Array.isArray(data) ? data : [];
        setPositions(items);
        setSelectedPositionId(String(user?.position?.id || user?.position_id || ''));
      } catch {
        if (!cancelled) {
          setPositions([]);
        }
      }
    }

    void loadPositions();

    return () => {
      cancelled = true;
    };
  }, [hasCompany, isEmployee, user?.position?.id, user?.position_id]);

  const rows = [
    {
      label: t.fullName,
      value: fullName,
    },
    {
      label: t.email,
      value: email,
    },
    {
      label: 'User ID',
      value: user?.publicId || user?.public_id || '-',
    },
  ];

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

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    clearMessages();

    try {
      await refreshUser();
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.refreshError, language));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSavePosition = async () => {
    if (!selectedPositionId) {
      setErrorMessage(t.selectPosition);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await updateMyPosition({ position_id: Number(selectedPositionId) });
      await refreshUser();
      setSuccessMessage(t.positionSaved);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.positionError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPosition = async () => {
    if (!newPositionTitle.trim()) {
      setErrorMessage(t.requiredPosition);
      return;
    }

    const companyId = user?.company?.id || user?.company_id;
    if (!companyId) {
      setErrorMessage(t.noCompany);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      const created = await createPosition({
        title: newPositionTitle.trim(),
        company_id: Number(companyId),
      });
      const data = await listPositions();
      setPositions(Array.isArray(data) ? data : []);
      setSelectedPositionId(String(created?.id || ''));
      setNewPositionTitle('');

      if (created?.id) {
        await updateMyPosition({ position_id: Number(created.id) });
        await refreshUser();
      }

      setSuccessMessage(t.positionCreated);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.positionError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveCompany = async () => {
    if (!window.confirm(t.confirmLeaveCompany)) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await leaveCompany();
      await refreshUser();
      setSuccessMessage(t.leftCompany);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.leaveCompanyError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t.confirmDeleteAccount)) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await deleteAccountRequest();
      clearAuth();
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.deleteAccountError, language));
      setIsSubmitting(false);
    }
  };

  return (
    <section style={{
      ...styles.page,
      padding: r.isMobile ? 10 : styles.page.padding,
    }}
    >
      <div style={{
        ...styles.card,
        width: '100%',
        padding: r.isMobile ? 16 : styles.card.padding,
        borderRadius: r.isMobile ? 18 : styles.card.borderRadius,
        boxShadow: r.isMobile ? 'none' : styles.card.boxShadow,
        gap: r.isMobile ? 16 : styles.card.gap,
      }}
      >
        <div style={{ ...styles.header, ...r.header }}>
          <div>
            <h2 style={{ ...styles.title, ...r.title }}>{t.title}</h2>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            style={{
              ...(isRefreshing ? styles.refreshButtonDisabled : styles.refreshButton),
              ...r.fullWidth,
            }}
            disabled={isRefreshing || isSubmitting}
          >
            {isRefreshing ? '...' : t.refresh}
          </button>
        </div>

        {errorMessage && <div style={styles.error}>{errorMessage}</div>}
        {successMessage && <div style={styles.success}>{successMessage}</div>}

        <div style={{
          ...styles.rows,
          gridTemplateColumns: r.gridCols('repeat(2, minmax(320px, 1fr))'),
          gap: r.isMobile ? 12 : styles.rows.gap,
        }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                ...styles.row,
                minHeight: r.isMobile ? 88 : styles.row.minHeight,
                padding: r.isMobile ? '16px 14px' : styles.row.padding,
              }}
            >
              <span style={styles.label}>{row.label}</span>
              <span style={{
                ...(row.muted ? styles.valueMuted : styles.value),
                fontSize: r.isMobile ? 17 : undefined,
              }}
              >
                {row.value || t.empty}
              </span>
            </div>
          ))}
        </div>

        {isEmployee && hasCompany && (
          <div style={{
            ...styles.section,
            padding: r.isMobile ? '16px 14px' : styles.section.padding,
          }}
          >
            <h3 style={styles.sectionTitle}>{t.positionSection}</h3>
            <p style={styles.sectionHint}>{t.positionSectionHint}</p>

            <div style={styles.formStack}>
              <label style={styles.fieldLabel}>{t.position}</label>
              <select
                value={selectedPositionId}
                onChange={(event) => setSelectedPositionId(event.target.value)}
                style={{ ...styles.select, ...r.fullWidth }}
                disabled={isSubmitting}
              >
                <option value="">{t.selectPosition}</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {getPositionLabel(position)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSavePosition}
                style={{
                  ...(isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton),
                  ...(r.isMobile ? { alignSelf: 'stretch', width: '100%' } : {}),
                }}
                disabled={isSubmitting}
              >
                {t.savePosition}
              </button>

              <div style={{
                ...styles.addPositionRow,
                flexDirection: r.isMobile ? 'column' : styles.addPositionRow.flexDirection,
              }}
              >
                <input
                  value={newPositionTitle}
                  onChange={(event) => setNewPositionTitle(event.target.value)}
                  placeholder={t.positionPlaceholder}
                  style={{ ...styles.input, ...(r.isMobile ? r.fullWidth : {}) }}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={handleAddPosition}
                  style={{
                    ...(isSubmitting ? styles.secondaryButtonDisabled : styles.secondaryButton),
                    ...r.fullWidth,
                    whiteSpace: r.isMobile ? 'normal' : 'nowrap',
                  }}
                  disabled={isSubmitting}
                >
                  {t.addPosition}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{
          ...styles.dangerZone,
          padding: r.isMobile ? '16px 14px' : styles.dangerZone.padding,
          alignItems: r.isMobile ? 'stretch' : styles.dangerZone.alignItems,
        }}
        >
          {isEmployee && hasCompany && (
            <button
              type="button"
              onClick={handleLeaveCompany}
              style={{
                ...(isSubmitting ? styles.warningButtonDisabled : styles.warningButton),
                ...r.fullWidth,
              }}
              disabled={isSubmitting}
            >
              {t.leaveCompany}
            </button>
          )}

          <button
            type="button"
            onClick={handleDeleteAccount}
            style={{
              ...(isSubmitting ? styles.dangerButtonDisabled : styles.dangerButton),
              ...r.fullWidth,
            }}
            disabled={isSubmitting}
          >
            {t.deleteAccount}
          </button>
        </div>
      </div>
    </section>
  );
}

const styles = {
  page: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  card: {
    width: 'min(100%, 1040px)',
    boxSizing: 'border-box',
    padding: '36px 44px',
    borderRadius: '28px',
    background: '#f4faff',
    border: '1px solid rgba(222, 231, 231, 0.95)',
    boxShadow: '0 24px 60px rgba(0, 38, 66, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
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
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'rgba(215, 173, 207, 0.35)',
    color: '#8d1d1d',
    fontSize: '14px',
    fontWeight: '600',
  },

  success: {
    padding: '10px 12px',
    borderRadius: '12px',
    background: '#dee7e7',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '600',
  },

  rows: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))',
    gap: '34px 42px',
    alignContent: 'flex-start',
    justifyContent: 'center',
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

  section: {
    padding: '22px 24px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
  },

  sectionTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '18px',
    fontWeight: '800',
  },

  sectionHint: {
    margin: '6px 0 16px',
    color: '#4f646f',
    fontSize: '13px',
  },

  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  fieldLabel: {
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '700',
  },

  select: {
    height: '42px',
    borderRadius: '12px',
    border: '2px solid #dee7e7',
    padding: '0 12px',
    color: '#002642',
    background: '#fff',
    fontSize: '14px',
  },

  input: {
    flex: 1,
    minWidth: 0,
    height: '42px',
    borderRadius: '12px',
    border: '2px solid #dee7e7',
    padding: '0 12px',
    color: '#002642',
    fontSize: '14px',
  },

  addPositionRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },

  primaryButton: {
    alignSelf: 'flex-start',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    background: '#002642',
    color: '#f4faff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  primaryButtonDisabled: {
    alignSelf: 'flex-start',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    background: '#4f646f',
    color: '#f4faff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'default',
    opacity: 0.7,
  },

  secondaryButton: {
    padding: '10px 16px',
    border: '2px solid #002642',
    borderRadius: '12px',
    background: '#f4faff',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  secondaryButtonDisabled: {
    padding: '10px 16px',
    border: '2px solid #4f646f',
    borderRadius: '12px',
    background: '#f4faff',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'default',
    opacity: 0.7,
    whiteSpace: 'nowrap',
  },

  dangerZone: {
    padding: '22px 24px',
    borderRadius: '20px',
    background: 'rgba(215, 173, 207, 0.12)',
    border: '1px solid rgba(141, 29, 29, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'flex-start',
  },

  warningButton: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    background: '#4f646f',
    color: '#f4faff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  warningButtonDisabled: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    background: '#4f646f',
    color: '#f4faff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'default',
    opacity: 0.7,
  },

  dangerButton: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    background: '#8d1d1d',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  dangerButtonDisabled: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    background: '#8d1d1d',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'default',
    opacity: 0.7,
  },
};
