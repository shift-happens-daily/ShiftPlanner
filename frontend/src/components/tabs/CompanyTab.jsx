// frontend/src/components/tabs/CompanyTab.jsx
import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import {
  createBranch,
  createCompany,
  joinCompany,
  listBranches,
  previewInviteCode,
  regenerateInviteCode,
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
  const [selectedJoinBranchId, setSelectedJoinBranchId] = useState('');
  const [selectedJoinPositionId, setSelectedJoinPositionId] = useState('');

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
      company: '',
      branch: 'Филиал',
      branches: 'Филиалы',
      position: 'Позиция',
      positions: 'Позиции',
      inviteCode: 'Инвайт-код',
      rotationStatus: 'Статус ротации',
      rotationComingSoon: 'Ротация кода появится позже. Сейчас код постоянный.',
      rotationEnabled: 'Автоматическое обновление кода',
      rotationFrequency: 'Период ротации',
      nextRotation: 'Следующее обновление',
      lastRegenerated: 'Последняя генерация',
      regenerateInvite: 'Сгенерировать новый код',
      confirmRegenerate: 'Сгенерировать новый код и аннулировать текущий?',
      inviteRegenerated: 'Код приглашения обновлён.',
      inviteAutoRotated: 'Код приглашения автоматически обновлён.',
      enabled: 'Включено',
      disabled: 'Отключено',
      daily: 'Каждый день',
      weekly: 'Каждую неделю',
      monthly: 'Каждый месяц',
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
      copy: 'Копировать',
      copied: 'Код скопирован.',
      noBranches: 'В компании пока нет филиалов.',
      noPositions: 'В компании пока нет позиций. Менеджеру нужно создать позицию во вкладке «Сотрудники».',
      createBranch: 'Создать филиал',
      branchName: '',
      branchPlaceholder: 'Например: Main Branch',
      branchCreated: 'Филиал создан.',
      createBranchError: 'Не удалось создать филиал.',
      createCompanyFirst: 'Сначала создайте компанию.',
      branchRequired: 'Введите название филиала.',
      noBranchSelected: 'Без филиала',
      noPositionSelected: 'Без позиции',
      positionsHint: '',
      employeeHint: 'После присоединения вкладки расписания и отчетов станут доступны.',
      managerHint: 'Скопируйте инвайт-код и отправьте его сотрудникам.',
      inviteFound: 'Инвайт-код найден.',
      joinSuccess: 'Вы успешно присоединились к компании!',
    },
    en: {
      title: 'Company',
      currentCompany: 'Current company',
      company: '',
      branch: 'Branch',
      branches: 'Branches',
      position: 'Position',
      positions: 'Positions',
      inviteCode: 'Invite code',
      rotationStatus: 'Rotation status',
      rotationComingSoon: 'Code rotation is coming later. The code stays fixed for now.',
      rotationEnabled: 'Auto rotate invite code',
      rotationFrequency: 'Rotation schedule',
      nextRotation: 'Next rotation',
      lastRegenerated: 'Last regenerated',
      regenerateInvite: 'Regenerate invite code',
      confirmRegenerate: 'Generate a new invite code and invalidate the current one?',
      inviteRegenerated: 'Invite code regenerated.',
      inviteAutoRotated: 'Invite code auto-rotated.',
      enabled: 'Enabled',
      disabled: 'Disabled',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
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
      copy: 'Copy',
      copied: 'Code copied.',
      noBranches: 'This company has no branches yet.',
      noPositions: 'This company has no positions yet. A manager needs to create a position in the Employees tab.',
      createBranch: 'Create branch',
      branchName: '',
      branchPlaceholder: 'Example: Main Branch',
      branchCreated: 'Branch created.',
      createBranchError: 'Failed to create branch.',
      createCompanyFirst: 'Create a company first.',
      branchRequired: 'Enter branch name.',
      noBranchSelected: 'No branch selected',
      noPositionSelected: 'No position selected',
      positionsHint: '',
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
  const currentCompanyId = getCompanyId(currentCompany);

  const effectiveInviteCode = getInviteCode(currentCompany);

  const previewCompany = getCompanyFromPreview(invitePreview);
  const previewCompanyName = previewCompany?.name || t.empty;
  const previewBranches = getBranchesFromPreview(invitePreview);
  const previewPositions = getPositionsFromPreview(invitePreview);

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
      setSelectedJoinBranchId('');
      setSelectedJoinPositionId('');
      setSuccessMessage(t.inviteFound);
    } catch (error) {
      setInvitePreview(null);
      setSelectedJoinBranchId('');
      setSelectedJoinPositionId('');
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
      await joinCompany({
        invite_code: inviteCode.trim(),
        branch_id: selectedJoinBranchId || null,
        position_id: selectedJoinPositionId || null,
      });

      await refreshUser();

      setInviteCode('');
      setInvitePreview(null);
      setSelectedJoinBranchId('');
      setSelectedJoinPositionId('');
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
    if (!effectiveInviteCode) return;

    try {
      await navigator.clipboard.writeText(effectiveInviteCode);
      setSuccessMessage(t.copied);
    } catch {
      setSuccessMessage('');
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!currentCompanyId) return;
    if (!window.confirm(t.confirmRegenerate)) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await regenerateInviteCode();
      await refreshUser();
      setSuccessMessage(t.inviteRegenerated);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.grid}>
          <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.title}>{t.title}</h2>
          </div>
          {errorMessage && <div style={styles.error}>{errorMessage}</div>}
          {successMessage && <div style={styles.success}>{successMessage}</div>}

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t.currentCompany}</h3>

            {currentCompany ? (
              <div style={styles.companyPanel}>
                <span style={styles.panelLabel}>{t.company}</span>
                <strong style={styles.companyTitle}>{currentCompany.name || t.empty}</strong>

                {isManager && effectiveInviteCode && (
                  <div style={styles.inviteBlock}>
                    <div style={styles.inviteCodeBox}>
                      <div>
                        <span style={styles.inviteLabel}>{t.inviteCode}</span>
                        <strong style={styles.inviteValue}>{effectiveInviteCode}</strong>
                      </div>
                      <div style={styles.inviteActions}>
                        <button type="button" onClick={copyInviteCode} style={styles.copyButton}>
                          {t.copy}
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateInviteCode}
                          style={
                            isSubmitting
                              ? { ...styles.secondaryButton, opacity: 0.5, cursor: 'not-allowed' }
                              : styles.secondaryButton
                          }
                          disabled={isSubmitting}
                        >
                          {t.regenerateInvite}
                        </button>
                      </div>
                    </div>
                  </div>
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

                  {previewBranches.length > 0 && (
                    <div style={styles.formStack}>
                      <label style={styles.label}>{t.branch}</label>
                      <select
                        value={selectedJoinBranchId}
                        onChange={(event) => setSelectedJoinBranchId(event.target.value)}
                        style={styles.select}
                      >
                        <option value="">{t.noBranchSelected}</option>
                        {previewBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {getName(branch)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {previewPositions.length > 0 && (
                    <div style={styles.formStack}>
                      <label style={styles.label}>{t.position}</label>
                      <select
                        value={selectedJoinPositionId}
                        onChange={(event) => setSelectedJoinPositionId(event.target.value)}
                        style={styles.select}
                      >
                        <option value="">{t.noPositionSelected}</option>
                        {previewPositions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {getName(position)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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
    boxSizing: 'border-box',
    padding: '22px',
    overflowX: 'hidden',
  },

  shell: {
    width: 'min(100%, 1200px)',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: '26px',
    borderRadius: '30px',
    background: '#f4faff',
    border: '1px solid rgba(222, 231, 231, 0.95)',
    boxShadow: 'none',
  },
  grid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '18px',
    alignItems: 'start',
  },

  card: {
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    padding: '28px',
    borderRadius: '30px',
    background: '#ffffff',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    boxShadow: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
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
    gap: '18px',
  },

  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: '850',
    letterSpacing: '-0.03em',
    textAlign: 'left',
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
    width: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    textAlign: 'left',
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

  inviteBlock: {
    width: '100%',
  },

  inviteCodeBox: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '18px 20px',
    borderRadius: '24px',
    border: '1px solid rgba(203, 213, 225, 0.85)',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '16px',
  },

  inviteActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },

  rotationCard: {
    width: '100%',
    padding: '20px',
    borderRadius: '22px',
    background: '#f8fafc',
    border: '1px solid rgba(226, 232, 240, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  rotationRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
  },

  rotationForm: {
    display: 'grid',
    gap: '16px',
  },

  rotationHint: {
    display: 'block',
    marginTop: '8px',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '600',
  },

  toggleLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    color: '#334155',
    fontWeight: '700',
  },

  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: '#002642',
    cursor: 'pointer',
  },

  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
  },

  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
  },

  metaItem: {
    padding: '14px',
    borderRadius: '18px',
    background: '#f8fafc',
    border: '1px solid rgba(226, 232, 240, 0.96)',
  },

  metaLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '12px',
    marginBottom: '6px',
  },

  metaValue: {
    color: '#0f172a',
    fontSize: '15px',
    fontWeight: '800',
  },

  inviteLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '8px',
  },

  inviteValue: {
    display: 'block',
    fontSize: '24px',
    fontWeight: '900',
    letterSpacing: '0.08em',
    color: '#102a43',
    wordBreak: 'break-all',
  },

  copyButton: {
    minWidth: '110px',
    padding: '12px 16px',
    borderRadius: '14px',
    border: '1px solid rgba(17, 24, 39, 0.12)',
    background: '#eef2ff',
    color: '#0f172a',
    fontWeight: '800',
    cursor: 'pointer',
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
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
  },

  primaryButtonDisabled: {
    height: '48px',
    padding: '0 20px',
    background: '#94a3b8',
    border: 'none',
    borderRadius: '14px',
    color: '#f8fafc',
    fontWeight: '800',
    cursor: 'default',
    opacity: 0.65,
  },

  secondaryButton: {
    height: '48px',
    padding: '0 22px',
    background: '#eef2ff',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    borderRadius: '14px',
    color: '#3730a3',
    fontWeight: '800',
    cursor: 'pointer',
  },

  secondaryButtonDisabled: {
    height: '48px',
    padding: '0 20px',
    background: '#e2e8f0',
    border: 'none',
    borderRadius: '14px',
    color: '#475569',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
  },

  previewBox: {
    marginTop: '4px',
    padding: '20px',
    borderRadius: '22px',
    background: '#f8fafc',
    border: '1px solid rgba(226, 232, 240, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  },

  branchItem: {
    padding: '14px 16px',
    borderRadius: '16px',
    background: '#ffffff',
    border: '1px solid rgba(226, 232, 240, 0.98)',
    color: '#0f172a',
    fontWeight: '850',
    textAlign: 'center',
  },
};