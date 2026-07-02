import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { deleteAccountRequest } from '../../services/authService';
import { leaveCompany, updateMyPosition } from '../../services/employeeService';
import { extractApiErrorMessage } from '../../services/error';
import { listPositions } from '../../services/positionService';
import { useUserBranches } from '../../hooks/useUserBranches';
import { useTabResponsive } from '../../utils/tabResponsive';
import { getBranchLabel, getPositionLabel } from '../../utils/employeeDisplay';
import { useUnsavedChanges } from '../../context/useUnsavedChanges';

const POSITION_SCOPE = 'profile-position';

export default function ProfileTab({ language, user }) {
  const r = useTabResponsive(1040);
  const navigate = useNavigate();
  const { markUnsaved, markSaved } = useUnsavedChanges();
  const { refreshUser, clearAuth } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [positions, setPositions] = useState([]);
  const [selectedPositionId, setSelectedPositionId] = useState('');

  const texts = {
    ru: {
      title: 'Профиль',
      subtitle: 'Основная информация о вас.',
      fullName: 'Полное имя',
      email: 'Email',
      role: 'Роль',
      company: 'Компания',
      branch: 'Филиалы',
      position: 'Позиция',
      refresh: 'Обновить',
      empty: 'Нет данных',
      noCompany: 'Не привязана',
      pendingApproval: 'Ожидает подтверждения менеджера',
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
      savePosition: 'Сохранить позицию',
      selectPosition: 'Выберите позицию',
      positionSaved: 'Позиция сохранена.',
      positionError: 'Не удалось обновить позицию.',
      positionSection: 'Моя позиция',
      positionSectionHint: 'Выберите позицию из списка компании.',
      noPosition: 'Без позиции',
      noBranch: 'Без филиала',
    },
    en: {
      title: 'Profile',
      subtitle: 'Basic information about you.',
      fullName: 'Full name',
      email: 'Email',
      role: 'Role',
      company: 'Company',
      branch: 'Branches',
      position: 'Position',
      refresh: 'Refresh',
      empty: 'No data',
      noCompany: 'Not linked',
      pendingApproval: 'Waiting for manager approval',
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
      savePosition: 'Save position',
      selectPosition: 'Select position',
      positionSaved: 'Position saved.',
      positionError: 'Failed to update position.',
      positionSection: 'My position',
      positionSectionHint: 'Select a position from your company list.',
      noPosition: 'No position',
      noBranch: 'No branch',
    },
  };

  const t = texts[language] || texts.ru;

  const role = user?.role;
  const isManager = role === 'manager';
  const isEmployee = role === 'employee';
  const isPendingEmployee = isEmployee && user?.employeeStatus === 'pending';
  const hasCompany = Boolean(user?.company);

  const { branchesLabel } = useUserBranches(user);

  const fullName = user?.fullName || user?.full_name || user?.name || t.empty;
  const email = user?.email || t.empty;

  const companyName = user?.company?.name;
  const positionName = getPositionLabel(
    {
      id: user?.position?.id ?? user?.position_id,
      ...user?.position,
    },
    t.noPosition,
  );
  const branchName = getBranchLabel(branchesLabel, t.noBranch);

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
    value: companyName || (isPendingEmployee ? t.pendingApproval : t.noCompany),
    muted: !companyName && !isPendingEmployee,
  });

  if (isEmployee) {
    rows.push(
      {
        label: t.branch,
        value: branchName,
        muted: branchesLabel ? false : true,
      },
      {
        label: t.position,
        value: positionName,
        muted: user?.position?.name ? false : true,
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
      markSaved(POSITION_SCOPE);
      setSuccessMessage(t.positionSaved);
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
      padding: r.isMobile ? 6 : styles.page.padding,
    }}
    >
      <div style={{
        ...styles.card,
        width: '100%',
        padding: r.isMobile ? 8 : styles.card.padding,
        borderRadius: r.isMobile ? 12 : styles.card.borderRadius,
        boxShadow: r.isMobile ? 'none' : styles.card.boxShadow,
        gap: r.isMobile ? 8 : styles.card.gap,
      }}
      >
        <div style={{
          ...styles.header,
          ...r.header,
          flexDirection: r.isMobile ? 'column' : 'row',
          alignItems: r.isMobile ? 'flex-start' : 'center',
          gap: r.isMobile ? 8 : 16,
        }}>
          <div>
            <h2 style={{
              ...styles.title,
              ...r.title,
              fontSize: r.isMobile ? 15 : 26,
              marginBottom: r.isMobile ? 1 : 0,
            }}>{t.title}</h2>
            <p style={{
              ...styles.subtitle,
              fontSize: r.isMobile ? 10 : 14,
              marginTop: r.isMobile ? 1 : 4,
            }}>{t.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            style={{
              ...(isRefreshing ? styles.refreshButtonDisabled : styles.refreshButton),
              ...r.fullWidth,
              ...(r.isMobile ? {
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 8,
              } : {}),
            }}
            disabled={isRefreshing || isSubmitting}
          >
            {isRefreshing ? '...' : t.refresh}
          </button>
        </div>

        {errorMessage && <div style={{
          ...styles.error,
          fontSize: r.isMobile ? 11 : 14,
          padding: r.isMobile ? '6px 8px' : '10px 12px',
          borderRadius: r.isMobile ? 8 : 12,
        }}>{errorMessage}</div>}
        {successMessage && <div style={{
          ...styles.success,
          fontSize: r.isMobile ? 11 : 14,
          padding: r.isMobile ? '6px 8px' : '10px 12px',
          borderRadius: r.isMobile ? 8 : 12,
        }}>{successMessage}</div>}

        <div style={{
          ...styles.rows,
          gridTemplateColumns: r.gridCols(r.isMobile ? '1fr' : 'repeat(2, minmax(320px, 1fr))'),
          gap: r.isMobile ? 6 : styles.rows.gap,
        }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                ...styles.row,
                minHeight: r.isMobile ? 56 : styles.row.minHeight,
                padding: r.isMobile ? '10px 8px' : styles.row.padding,
                borderRadius: r.isMobile ? 12 : 20,
                gap: r.isMobile ? 3 : 8,
              }}
            >
              <span style={{
                ...styles.label,
                fontSize: r.isMobile ? 11 : 14,
              }}>{row.label}</span>
              <span style={{
                ...(row.muted ? styles.valueMuted : styles.value),
                fontSize: r.isMobile ? 13 : 20,
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
            padding: r.isMobile ? '10px 8px' : styles.section.padding,
            borderRadius: r.isMobile ? 12 : 20,
          }}
          >
            <h3 style={{
              ...styles.sectionTitle,
              fontSize: r.isMobile ? 12 : 18,
              marginBottom: r.isMobile ? 2 : 0,
            }}>{t.positionSection}</h3>
            <p style={{
              ...styles.sectionHint,
              fontSize: r.isMobile ? 10 : 13,
              margin: r.isMobile ? '1px 0 8px' : '6px 0 16px',
            }}>{t.positionSectionHint}</p>

            <div style={{
              ...styles.formStack,
              gap: r.isMobile ? 6 : 12,
            }}>
              <label style={{
                ...styles.fieldLabel,
                fontSize: r.isMobile ? 10 : 13,
              }}>{t.position}</label>
              <select
                value={selectedPositionId}
                onChange={(event) => {
                  setSelectedPositionId(event.target.value);
                  markUnsaved(POSITION_SCOPE);
                }}
                style={{
                  ...styles.select,
                  ...r.fullWidth,
                  ...(r.isMobile ? {
                    height: 32,
                    borderRadius: 8,
                    fontSize: 11,
                    padding: '0 8px',
                  } : {}),
                }}
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
                  ...(r.isMobile ? {
                    alignSelf: 'stretch',
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: 11,
                    borderRadius: 8,
                  } : {}),
                }}
                disabled={isSubmitting}
              >
                {t.savePosition}
              </button>
            </div>
          </div>
        )}

        <div style={{
          ...styles.actionsFooter,
          gap: r.isMobile ? 6 : 12,
        }}>
          {isEmployee && hasCompany && (
            <button
              type="button"
              onClick={handleLeaveCompany}
              style={{
                ...(isSubmitting ? styles.warningButtonDisabled : styles.warningButton),
                ...(r.isMobile ? {
                  padding: '5px 10px',
                  fontSize: 11,
                  borderRadius: 8,
                  alignSelf: 'stretch',
                } : {}),
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
              ...(r.isMobile ? {
                padding: '5px 10px',
                fontSize: 11,
                borderRadius: 8,
                alignSelf: 'stretch',
              } : {}),
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
    height: '100%',
    boxSizing: 'border-box',
    padding: '24px',
    paddingBottom: '32px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    overflowY: 'auto',
    overflowX: 'hidden',
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

  actionsFooter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '8px',
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
