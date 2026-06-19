// frontend/src/components/tabs/CompanyTab.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import {
  createBranch,
  createCompany,
  joinCompany,
  listBranches,
  previewInviteCode,
} from '../../services/companyService';
import { extractApiErrorMessage } from '../../services/error';

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.branches)) return value.branches;
  if (Array.isArray(value?.positions)) return value.positions;
  return [];
}

function getName(item) {
  return item?.name || item?.title || item?.position_title || item?.full_name || '—';
}

function getCompanyFromPreview(preview) {
  if (!preview) return null;

  if (preview.company) return preview.company;
  if (preview.company_data) return preview.company_data;

  if (preview.company_id || preview.company_name) {
    return {
      id: preview.company_id,
      name: preview.company_name,
      invite_code: preview.invite_code,
    };
  }

  return preview;
}

function getBranchesFromPreview(preview) {
  const company = getCompanyFromPreview(preview);

  return normalizeArray(
    preview?.branches ||
    preview?.company_branches ||
    company?.branches ||
    (preview?.branch ? [preview.branch] : [])
  ).filter(Boolean);
}

function getPositionsFromPreview(preview) {
  const company = getCompanyFromPreview(preview);

  return normalizeArray(
    preview?.positions ||
    preview?.company_positions ||
    company?.positions ||
    (preview?.position ? [preview.position] : [])
  ).filter(Boolean);
}

function getCompanyId(company) {
  return company?.id || company?.company_id;
}

function getInviteCode(company) {
  return company?.invite_code || company?.inviteCode;
}

export default function CompanyTab({ language, userRole, user }) {
  const { refreshUser } = useAuth();

  const [inviteCode, setInviteCode] = useState('');
  const [invitePreview, setInvitePreview] = useState(null);

  const [branches, setBranches] = useState([]);
  const [branchName, setBranchName] = useState('');

  const [companyName, setCompanyName] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const texts = {
    ru: {
      title: 'Компания',
      currentCompany: 'Текущая компания',
      company: 'Компания',
      branch: 'Филиал',
      branches: 'Филиалы',
      position: 'Позиция',
      positions: 'Позиции',
      inviteCode: 'Инвайт-код',
      noCompany: 'Аккаунт еще не привязан к компании.',
      noCompanyManager: 'Создайте компанию, чтобы получить инвайт-код для сотрудников.',
      noCompanyEmployee: 'Введите инвайт-код, чтобы присоединиться к своей компании.',
      previewInvite: 'Проверить код',
      joinCompany: 'Присоединиться',
      invitePlaceholder: 'Введите инвайт-код',
      createCompany: 'Создать компанию',
      companyName: 'Название компании',
      saveCompany: 'Создать',
      empty: 'Нет данных',
      companyCreated: 'Компания создана.',
      companyJoined: 'Компания успешно привязана.',
      previewHint: 'Проверьте инвайт-код, затем нажмите "Присоединиться".',
      copied: 'Код скопирован.',
      noBranches: 'В компании пока нет филиалов. Менеджеру нужно создать филиал.',
      noPositions: 'В компании пока нет позиций. Менеджеру нужно создать позицию во вкладке «Сотрудники».',
      createBranch: 'Создать филиал',
      branchName: 'Название филиала',
      branchPlaceholder: 'Например: Main Branch',
      branchCreated: 'Филиал создан.',
      createBranchError: 'Не удалось создать филиал.',
      createCompanyFirst: 'Сначала создайте компанию.',
      branchRequired: 'Введите название филиала.',
      positionsHint: 'Позиции создаются во вкладке «Сотрудники».',
      employeeHint: 'После присоединения вкладки расписания и отчетов станут доступны.',
      managerHint: 'Скопируйте инвайт-код и отправьте его сотрудникам.',
      inviteFound: 'Инвайт-код найден.',
      joinSuccess: 'Вы успешно присоединились к компании!',
    },
    en: {
      title: 'Company',
      currentCompany: 'Current company',
      company: 'Company',
      branch: 'Branch',
      branches: 'Branches',
      position: 'Position',
      positions: 'Positions',
      inviteCode: 'Invite code',
      noCompany: 'This account is not linked to a company yet.',
      noCompanyManager: 'Create a company to get an invite code for employees.',
      noCompanyEmployee: 'Enter an invite code to join your company.',
      previewInvite: 'Preview invite',
      joinCompany: 'Join company',
      invitePlaceholder: 'Enter invite code',
      createCompany: 'Create company',
      companyName: 'Company name',
      saveCompany: 'Create',
      empty: 'No data',
      companyCreated: 'Company created.',
      companyJoined: 'Company joined successfully.',
      previewHint: 'Preview the invite code first, then click "Join company".',
      copied: 'Code copied.',
      noBranches: 'This company has no branches yet. A manager needs to create a branch.',
      noPositions: 'This company has no positions yet. A manager needs to create a position in the Employees tab.',
      createBranch: 'Create branch',
      branchName: 'Branch name',
      branchPlaceholder: 'Example: Main Branch',
      branchCreated: 'Branch created.',
      createBranchError: 'Failed to create branch.',
      createCompanyFirst: 'Create a company first.',
      branchRequired: 'Enter branch name.',
      positionsHint: 'Positions are created in the Employees tab.',
      employeeHint: 'After joining, schedule and reports tabs become available.',
      managerHint: 'Copy the invite code and send it to employees.',
      inviteFound: 'Invite found.',
      joinSuccess: 'You have successfully joined the company!',
    },
  };

  const t = texts[language] || texts.ru;
  const isManager = userRole === 'manager';
  const isEmployee = userRole === 'employee';

  const currentCompany = user?.company || null;
  const currentBranch = user?.branch || null;
  const currentPosition = user?.position || null;

  const currentInviteCode = getInviteCode(currentCompany);

  const previewCompany = getCompanyFromPreview(invitePreview);
  const previewCompanyName = previewCompany?.name || t.empty;

  const canJoin = Boolean(invitePreview) && !isSubmitting;

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const loadBranches = async (companyId) => {
    if (!companyId) {
      setBranches([]);
      return;
    }

    try {
      const data = await listBranches(companyId);
      setBranches(normalizeArray(data));
    } catch {
      setBranches([]);
    }
  };

  const currentCompanyId = getCompanyId(currentCompany);

  useEffect(() => {
    if (isManager && currentCompanyId) {
      void loadBranches(currentCompanyId);
      return;
    }

    setBranches([]);
  }, [isManager, currentCompanyId]);

  const handlePreview = async () => {
    if (!inviteCode.trim()) {
      setErrorMessage(t.invitePlaceholder);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      const preview = await previewInviteCode(inviteCode.trim());
      setInvitePreview(preview);
      setSuccessMessage(t.inviteFound);
    } catch (error) {
      setInvitePreview(null);
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!canJoin) {
      setErrorMessage(t.previewHint);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      const previewBranches = getBranchesFromPreview(invitePreview);
      const previewPositions = getPositionsFromPreview(invitePreview);

      await joinCompany({
        invite_code: inviteCode.trim(),
        branch_id: previewBranches[0]?.id || null,
        position_id: previewPositions[0]?.id || null,
      });

      await refreshUser();

      setInviteCode('');
      setInvitePreview(null);
      setSuccessMessage(t.joinSuccess);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      setErrorMessage(t.companyName);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await createCompany({ name: companyName.trim() });
      await refreshUser();

      setCompanyName('');
      setSuccessMessage(t.companyCreated);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!currentCompanyId) {
      setErrorMessage(t.createCompanyFirst);
      return;
    }

    if (!branchName.trim()) {
      setErrorMessage(t.branchRequired);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      const created = await createBranch(currentCompanyId, {
        name: branchName.trim(),
      });

      setBranches((prev) => [...prev, created]);
      setBranchName('');
      setSuccessMessage(t.branchCreated);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.createBranchError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInviteCode = async () => {
    if (!currentInviteCode) return;

    try {
      await navigator.clipboard.writeText(currentInviteCode);
      setSuccessMessage(t.copied);
    } catch {
      setSuccessMessage('');
    }
  };

  return (
    <section style={styles.page}>
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.title}>{t.title}</h2>
            <span style={styles.rolePill}>{isManager ? 'Manager' : 'Employee'}</span>
          </div>

          {errorMessage && <div style={styles.error}>{errorMessage}</div>}
          {successMessage && <div style={styles.success}>{successMessage}</div>}

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t.currentCompany}</h3>

            {currentCompany ? (
              <div style={styles.companyPanel}>
                <span style={styles.panelLabel}>{t.company}</span>
                <strong style={styles.companyTitle}>{currentCompany.name || t.empty}</strong>

                {isManager && currentInviteCode && (
                  <>
                    <button type="button" onClick={copyInviteCode} style={styles.inviteCodeBox}>
                      <span style={styles.inviteLabel}>{t.inviteCode}</span>
                      <strong style={styles.inviteValue}>{currentInviteCode}</strong>
                    </button>
                    <p style={styles.hint}>{t.managerHint}</p>
                  </>
                )}

                {isEmployee && (
                  <div style={styles.infoGrid}>
                    <InfoItem label={t.branch} value={getName(currentBranch)} />
                    <InfoItem label={t.position} value={getName(currentPosition)} />
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.emptyState}>
                <strong style={styles.emptyTitle}>{t.noCompany}</strong>
                <span style={styles.emptyText}>
                  {isManager ? t.noCompanyManager : t.noCompanyEmployee}
                </span>
              </div>
            )}
          </div>
        </div>

        {isManager && !currentCompany && (
          <div style={styles.card}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.createCompany}</h3>

              <div style={styles.formStack}>
                <label style={styles.label}>{t.companyName}</label>
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder={t.companyName}
                  style={styles.input}
                />

                <button
                  type="button"
                  onClick={handleCreateCompany}
                  style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '...' : t.saveCompany}
                </button>
              </div>
            </div>
          </div>
        )}

        {isManager && currentCompany && (
          <div style={styles.card}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.branches}</h3>
              <p style={styles.hint}>{t.positionsHint}</p>

              <div style={styles.formStack}>
                <label style={styles.label}>{t.branchName}</label>
                <input
                  value={branchName}
                  onChange={(event) => setBranchName(event.target.value)}
                  placeholder={t.branchPlaceholder}
                  style={styles.input}
                />

                <button
                  type="button"
                  onClick={handleCreateBranch}
                  style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '...' : t.createBranch}
                </button>
              </div>

              <div style={styles.branchList}>
                {branches.length === 0 ? (
                  <p style={styles.emptyText}>{t.noBranches}</p>
                ) : (
                  branches.map((branch) => (
                    <div key={branch.id} style={styles.branchItem}>
                      {getName(branch)}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {isEmployee && !currentCompany && (
          <div style={styles.card}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.joinCompany}</h3>
              <p style={styles.hint}>{t.previewHint}</p>

              <div style={styles.formStack}>
                <label style={styles.label}>{t.inviteCode}</label>
                <input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  placeholder={t.invitePlaceholder}
                  style={styles.input}
                />

                <button
                  type="button"
                  onClick={handlePreview}
                  style={isSubmitting ? styles.secondaryButtonDisabled : styles.secondaryButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '...' : t.previewInvite}
                </button>
              </div>

              {invitePreview && (
                <div style={styles.previewBox}>
                  <strong style={styles.previewTitle}>{previewCompanyName}</strong>

                  <button
                    type="button"
                    onClick={handleJoin}
                    style={canJoin ? styles.primaryButton : styles.primaryButtonDisabled}
                    disabled={!canJoin}
                  >
                    {t.joinCompany}
                  </button>
                </div>
              )}

              <p style={styles.hint}>{t.employeeHint}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value || '—'}</strong>
    </div>
  );
}

const styles = {
  page: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  grid: {
    width: 'min(100%, 1120px)',
    maxHeight: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))',
    gap: '24px',
    alignItems: 'stretch',
    overflowY: 'auto',
    padding: '4px',
  },

  card: {
    minHeight: '360px',
    boxSizing: 'border-box',
    padding: '32px',
    borderRadius: '28px',
    background: '#f4faff',
    border: '1px solid rgba(222, 231, 231, 0.95)',
    boxShadow: '0 20px 50px rgba(0, 38, 66, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '18px',
  },

  title: {
    fontSize: '28px',
    fontWeight: '850',
    color: '#002642',
    margin: 0,
    letterSpacing: '-0.03em',
  },

  rolePill: {
    padding: '7px 12px',
    borderRadius: '999px',
    background: 'rgba(215, 173, 207, 0.45)',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '800',
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  sectionTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '22px',
    fontWeight: '850',
    letterSpacing: '-0.02em',
    textAlign: 'center',
  },

  hint: {
    margin: 0,
    color: '#4f646f',
    fontSize: '14px',
    lineHeight: 1.4,
    textAlign: 'center',
  },

  error: {
    marginBottom: '14px',
    padding: '11px 13px',
    borderRadius: '14px',
    background: 'rgba(215, 173, 207, 0.36)',
    color: '#8d1d1d',
    fontSize: '14px',
    fontWeight: '700',
  },

  success: {
    marginBottom: '14px',
    padding: '11px 13px',
    borderRadius: '14px',
    background: 'rgba(222, 231, 231, 0.82)',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '700',
  },

  companyPanel: {
    minHeight: '160px',
    padding: '24px',
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    textAlign: 'center',
  },

  panelLabel: {
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '800',
  },

  companyTitle: {
    color: '#002642',
    fontSize: '24px',
    fontWeight: '900',
  },

  inviteCodeBox: {
    marginTop: '4px',
    width: '100%',
    maxWidth: '320px',
    padding: '14px 16px',
    borderRadius: '18px',
    border: '1px solid rgba(215, 173, 207, 0.8)',
    background: 'rgba(215, 173, 207, 0.28)',
    color: '#002642',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },

  inviteLabel: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#4f646f',
  },

  inviteValue: {
    fontSize: '24px',
    fontWeight: '900',
    letterSpacing: '0.08em',
  },

  emptyState: {
    minHeight: '180px',
    padding: '24px',
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    textAlign: 'center',
  },

  emptyTitle: {
    color: '#002642',
    fontSize: '20px',
    fontWeight: '850',
  },

  emptyText: {
    margin: 0,
    color: '#4f646f',
    fontSize: '15px',
    lineHeight: 1.45,
    textAlign: 'center',
  },

  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
  },

  label: {
    color: '#4f646f',
    fontWeight: '750',
    fontSize: '14px',
  },

  input: {
    width: '100%',
    height: '48px',
    boxSizing: 'border-box',
    borderRadius: '14px',
    border: '2px solid #dee7e7',
    background: '#ffffff',
    padding: '0 15px',
    color: '#002642',
    fontSize: '15px',
    outline: 'none',
  },

  primaryButton: {
    height: '48px',
    padding: '0 20px',
    background: '#002642',
    border: 'none',
    borderRadius: '14px',
    color: '#f4faff',
    fontWeight: '800',
    cursor: 'pointer',
  },

  primaryButtonDisabled: {
    height: '48px',
    padding: '0 20px',
    background: '#4f646f',
    border: 'none',
    borderRadius: '14px',
    color: '#f4faff',
    fontWeight: '800',
    cursor: 'default',
    opacity: 0.65,
  },

  secondaryButton: {
    height: '48px',
    padding: '0 20px',
    background: '#d7adcf',
    border: 'none',
    borderRadius: '14px',
    color: '#002642',
    fontWeight: '850',
    cursor: 'pointer',
  },

  secondaryButtonDisabled: {
    height: '48px',
    padding: '0 20px',
    background: '#d7adcf',
    border: 'none',
    borderRadius: '14px',
    color: '#002642',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
  },

  previewBox: {
    marginTop: '4px',
    padding: '18px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    display: 'flex',
    flexDirection: 'column',
    gap: '13px',
  },

  previewTitle: {
    fontWeight: '900',
    color: '#002642',
    fontSize: '18px',
    textAlign: 'center',
  },

  infoGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },

  infoItem: {
    padding: '12px',
    borderRadius: '16px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  infoLabel: {
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '800',
  },

  infoValue: {
    color: '#002642',
    fontSize: '15px',
    fontWeight: '850',
    overflowWrap: 'anywhere',
  },

  branchList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  branchItem: {
    padding: '14px 16px',
    borderRadius: '16px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    color: '#002642',
    fontWeight: '850',
    textAlign: 'center',
  },
};