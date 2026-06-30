/* eslint-disable react-hooks/set-state-in-effect */
// frontend/src/components/tabs/CompanyTab.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import {
  acceptEmployeeRequest,
  createBranch,
  createCompany,
  declineEmployeeRequest,
  deleteBranch,
  joinCompany,
  listBranches,
  listEmployeeRequests,
  previewInviteCode,
  regenerateInviteCode,
} from '../../services/companyService';
import { extractApiErrorMessage } from '../../services/error';
import { useUserBranches } from '../../hooks/useUserBranches';
import { removeBranchFromAllStoredAssignments } from '../../utils/employeeBranches';
import { useTabResponsive } from '../../utils/tabResponsive';

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
  const r = useTabResponsive(1480);
  const { refreshUser } = useAuth();

  const [inviteCode, setInviteCode] = useState('');
  const [invitePreview, setInvitePreview] = useState(null);
  const [selectedJoinBranchId, setSelectedJoinBranchId] = useState('');
  const [selectedJoinPositionId, setSelectedJoinPositionId] = useState('');

  const [branches, setBranches] = useState([]);
  const [branchName, setBranchName] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [employeeRequests, setEmployeeRequests] = useState([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const texts = {
    ru: {
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
      noPositions: 'В компании пока нет позиций. Менеджеру нужно создать позицию во вкладке «Сотрудники».',
      createBranch: 'Создать филиал',
      branchName: '',
      branchPlaceholder: 'Например: Main Branch',
      branchCreated: 'Филиал создан.',
      branchDeleted: 'Филиал удалён.',
      createBranchError: 'Не удалось создать филиал.',
      deleteBranch: 'Удалить',
      confirmDeleteBranch: 'Удалить филиал «{name}»?',
      branchDeleteError: 'Не удалось удалить филиал.',
      branchInUse: 'Нельзя удалить: филиал назначен сотрудникам или используется в требованиях.',
      createCompanyFirst: 'Сначала создайте компанию.',
      branchRequired: 'Введите название филиала.',
      noBranchSelected: 'Без филиала',
      noPositionSelected: 'Без позиции',
      noBranchesAssigned: 'Филиалы не назначены',
      positionsHint: '',
      employeeHint: 'После подтверждения менеджером станут доступны расписание и отчёты.',
      managerHint: 'Скопируйте инвайт-код и отправьте его сотрудникам.',
      inviteFound: 'Инвайт-код найден.',
      joinSuccess: 'Вы успешно присоединились к компании!',
      joinPending: 'Заявка отправлена. Дождитесь подтверждения менеджера во вкладке «Компания».',
      pendingTitle: 'Заявка на рассмотрении',
      pendingText: 'Менеджер компании должен принять вашу заявку. После этого здесь появятся филиал и позиция.',
      employeeRequests: 'Заявки сотрудников',
      employeeRequestsHint: 'Примите или отклоните заявки на вступление в компанию.',
      noEmployeeRequests: 'Нет ожидающих заявок.',
      acceptRequest: 'Принять',
      declineRequest: 'Отклонить',
      requestAccepted: 'Сотрудник принят.',
      requestDeclined: 'Заявка отклонена.',
      requestActionError: 'Не удалось обработать заявку.',
      requestBranches: 'Филиалы в заявке',
      requestPosition: 'Позиция в заявке',
    },
    en: {
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
      noPositions: 'This company has no positions yet. A manager needs to create a position in the Employees tab.',
      createBranch: 'Create branch',
      branchName: '',
      branchPlaceholder: 'Example: Main Branch',
      branchCreated: 'Branch created.',
      branchDeleted: 'Branch deleted.',
      createBranchError: 'Failed to create branch.',
      deleteBranch: 'Delete',
      confirmDeleteBranch: 'Delete branch "{name}"?',
      branchDeleteError: 'Failed to delete branch.',
      branchInUse: 'Cannot delete: branch is assigned to employees or used in requirements.',
      createCompanyFirst: 'Create a company first.',
      branchRequired: 'Enter branch name.',
      noBranchSelected: 'No branch selected',
      noPositionSelected: 'No position selected',
      noBranchesAssigned: 'No branches assigned',
      positionsHint: '',
      employeeHint: 'Schedule and reports become available after a manager approves your request.',
      managerHint: 'Copy the invite code and send it to employees.',
      inviteFound: 'Invite found.',
      joinSuccess: 'You have successfully joined the company!',
      joinPending: 'Request submitted. Wait for manager approval in the Company tab.',
      pendingTitle: 'Request pending',
      pendingText: 'A company manager must approve your request. Branch and position will appear here after approval.',
      employeeRequests: 'Employee requests',
      employeeRequestsHint: 'Approve or decline join requests.',
      noEmployeeRequests: 'No pending requests.',
      acceptRequest: 'Accept',
      declineRequest: 'Decline',
      requestAccepted: 'Employee accepted.',
      requestDeclined: 'Request declined.',
      requestActionError: 'Failed to process the request.',
      requestBranches: 'Requested branches',
      requestPosition: 'Requested position',
    },
  };

  const t = texts[language] || texts.ru;
  const isManager = userRole === 'manager';
  const isEmployee = userRole === 'employee';
  const isPendingEmployee = isEmployee && user?.employeeStatus === 'pending';

  const currentCompany = user?.company || null;
  const currentPosition = user?.position || null;
  const currentCompanyId = getCompanyId(currentCompany);
  const { userBranches } = useUserBranches(user);

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

  const loadEmployeeRequests = async () => {
    if (!isManager || !currentCompanyId) {
      setEmployeeRequests([]);
      return;
    }

    try {
      const data = await listEmployeeRequests();
      setEmployeeRequests(normalizeArray(data));
    } catch {
      setEmployeeRequests([]);
    }
  };

  useEffect(() => {
    if (!isManager || !currentCompanyId) {
      setBranches([]);
      return;
    }

    void loadBranches(currentCompanyId);
  }, [isManager, currentCompanyId]);

  useEffect(() => {
    void loadEmployeeRequests();
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
      const joinedProfile = await joinCompany({
        invite_code: inviteCode.trim(),
        branch_id: selectedJoinBranchId ? Number(selectedJoinBranchId) : null,
        position_id: selectedJoinPositionId ? Number(selectedJoinPositionId) : null,
      });

      await refreshUser();

      setInviteCode('');
      setInvitePreview(null);
      setSelectedJoinBranchId('');
      setSelectedJoinPositionId('');
      setSuccessMessage(
        joinedProfile?.employee_status === 'pending' ? t.joinPending : t.joinSuccess
      );
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
      const updatedUser = await refreshUser();

      setCompanyName('');
      setSuccessMessage(t.companyCreated);

      const companyId = getCompanyId(updatedUser?.company);
      if (companyId) {
        await loadBranches(companyId);
      }
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBranch = async (branch) => {
    if (!branch?.id || !currentCompanyId) return;

    const branchTitle = getName(branch);
    const confirmMessage = t.confirmDeleteBranch.replace('{name}', branchTitle);
    if (!window.confirm(confirmMessage)) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await deleteBranch(branch.id);
      removeBranchFromAllStoredAssignments(branch.id);
      await loadBranches(currentCompanyId);
      setSuccessMessage(t.branchDeleted);
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (
        status === 409
        || (typeof detail === 'string' && detail.toLowerCase().includes('cannot be deleted'))
      ) {
        setErrorMessage(t.branchInUse);
      } else {
        setErrorMessage(extractApiErrorMessage(error, t.branchDeleteError, language));
      }
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
      await createBranch(currentCompanyId, {
        name: branchName.trim(),
      });

      await loadBranches(currentCompanyId);
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

  const getRequestBranchesLabel = (request) => {
    const labels = normalizeArray(request?.branches)
      .map((branch) => branch?.name || branch?.title)
      .filter(Boolean);
    return labels.length > 0 ? labels.join(', ') : '—';
  };

  const handleAcceptEmployeeRequest = async (requestId) => {
    clearMessages();
    setIsSubmitting(true);

    try {
      await acceptEmployeeRequest(requestId);
      await loadEmployeeRequests();
      setSuccessMessage(t.requestAccepted);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.requestActionError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineEmployeeRequest = async (requestId) => {
    if (!window.confirm(language === 'en' ? 'Decline this request?' : 'Отклонить заявку?')) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await declineEmployeeRequest(requestId);
      await loadEmployeeRequests();
      setSuccessMessage(t.requestDeclined);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.requestActionError, language));
    } finally {
      setIsSubmitting(false);
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
    <section
      style={{
        ...styles.page,
        ...r.page,
        ...(r.isMobile ? {} : styles.desktopViewportPage),
      }}
    >
      <div
        style={{
          ...styles.shell,
          ...r.shell,
          width: 'min(100%, 1480px)',
          padding: 0,
          borderRadius: 0,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          ...(r.isMobile ? {} : styles.desktopScaleShell),
        }}
      >
        {(errorMessage || successMessage) && (
          <div style={errorMessage ? styles.error : styles.success}>
            {errorMessage || successMessage}
          </div>
        )}

        {isManager && currentCompany ? (
          <div style={{
            ...styles.managerGrid,
            gridTemplateColumns: r.gridCols('minmax(0, 1fr) minmax(0, 1fr)'),
          }}>
            <section style={styles.card}>
              <div style={styles.cardHeaderCompact}>
                <h2 style={{ ...styles.title, ...r.title }}>{t.title}</h2>
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>{t.currentCompany}</h3>

                <div style={styles.companyPanel}>
                  <strong style={styles.companyTitle}>{currentCompany.name || t.empty}</strong>

                  {effectiveInviteCode && (
                    <div style={styles.inviteCodeBox}>
                      <div style={styles.inviteMain}>
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
                  )}
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>{t.branches}</h3>

                <div style={styles.branchCreateRow}>
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
                        <span style={styles.branchItemName}>{getName(branch)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBranch(branch)}
                          style={
                            isSubmitting
                              ? { ...styles.branchDeleteButton, opacity: 0.5, cursor: 'not-allowed' }
                              : styles.branchDeleteButton
                          }
                          disabled={isSubmitting}
                          aria-label={`${t.deleteBranch} ${getName(branch)}`}
                        >
                          {t.deleteBranch}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section style={{
              ...styles.requestsCard,
              gridColumn: r.isMobile ? 'auto' : '1 / -1',
            }}>
              <div style={styles.requestsHeader}>
                <h3 style={styles.sectionTitle}>{t.employeeRequests}</h3>
                <p style={styles.hint}>{t.employeeRequestsHint}</p>
              </div>

              <div style={styles.requestList}>
                {employeeRequests.length === 0 ? (
                  <div style={styles.emptyRequests}>{t.noEmployeeRequests}</div>
                ) : (
                  employeeRequests.map((request) => (
                    <div key={request.id} style={styles.requestItem}>
                      <div style={styles.requestMain}>
                        <strong style={styles.requestName}>{request.full_name || request.email}</strong>
                        <span style={styles.requestMeta}>{request.email}</span>
                        <span style={styles.requestMeta}>
                          {t.requestBranches}: {getRequestBranchesLabel(request)}
                        </span>
                        <span style={styles.requestMeta}>
                          {t.requestPosition}: {getName(request.position)}
                        </span>
                      </div>
                      <div style={styles.requestActions}>
                        <button
                          type="button"
                          onClick={() => handleAcceptEmployeeRequest(request.id)}
                          style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                          disabled={isSubmitting}
                        >
                          {t.acceptRequest}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineEmployeeRequest(request.id)}
                          style={isSubmitting ? styles.secondaryButtonDisabled : styles.secondaryButton}
                          disabled={isSubmitting}
                        >
                          {t.declineRequest}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          <div style={{ ...styles.grid, gridTemplateColumns: r.gridCols('1fr 1fr') }}>
            <section style={{ ...styles.card, ...r.card }}>
              <div style={styles.cardHeaderCompact}>
                <h2 style={{ ...styles.title, ...r.title }}>{t.title}</h2>
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>{t.currentCompany}</h3>

                {isPendingEmployee ? (
                  <div style={styles.pendingPanel}>
                    <strong style={styles.pendingTitle}>{t.pendingTitle}</strong>
                    <span style={styles.pendingText}>{t.pendingText}</span>
                  </div>
                ) : currentCompany ? (
                  <div style={styles.companyPanel}>
                    <strong style={styles.companyTitle}>{currentCompany.name || t.empty}</strong>

                    {isEmployee && (
                      <div style={{ ...styles.infoGrid, gridTemplateColumns: r.gridCols('1fr 1fr') }}>
                        <div style={styles.infoItem}>
                          <span style={styles.infoLabel}>{t.branches}</span>
                          {userBranches.length === 0 ? (
                            <strong style={styles.infoValue}>{t.noBranchesAssigned}</strong>
                          ) : (
                            <div style={styles.assignedBranchList}>
                              {userBranches.map((branch) => (
                                <span key={branch.id} style={styles.assignedBranchPill}>
                                  {getName(branch)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
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
            </section>

            {isManager && !currentCompany && (
              <section style={{ ...styles.card, ...r.card }}>
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
              </section>
            )}

            {isEmployee && !currentCompany && !isPendingEmployee && (
              <section style={{ ...styles.card, ...r.card }}>
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
                        <div style={styles.joinFieldCard}>
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
                        <div style={styles.joinFieldCard}>
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
              </section>
            )}
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
    padding: '16px 24px 18px',
    overflow: 'hidden',
    background: '#f4faff',
  },

  desktopViewportPage: {
    height: 'calc(100dvh - 96px)',
    overflow: 'hidden',
  },

  shell: {
    width: 'min(100%, 1480px)',
    height: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },

  desktopScaleShell: {
    width: '125%',
    height: '125%',
    transform: 'scale(0.8)',
    transformOrigin: 'top left',
  },

  managerGrid: {
    flex: '1 1 auto',
    minHeight: 0,
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    gap: '14px',
    alignItems: 'stretch',
  },

  grid: {
    flex: '1 1 auto',
    minHeight: 0,
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
    alignItems: 'stretch',
  },

  card: {
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'hidden',
  },

  requestsCard: {
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'hidden',
  },

  cardHeaderCompact: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: 0,
  },

  title: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#002642',
    margin: 0,
    letterSpacing: 0,
  },

  section: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  sectionTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '18px',
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'left',
  },

  hint: {
    margin: 0,
    color: '#4f646f',
    fontSize: '13px',
    lineHeight: 1.35,
    textAlign: 'left',
  },

  error: {
    flexShrink: 0,
    padding: '10px 14px',
    borderRadius: '14px',
    background: 'rgba(215, 173, 207, 0.36)',
    color: '#8d1d1d',
    fontSize: '14px',
    fontWeight: '750',
  },

  success: {
    flexShrink: 0,
    padding: '10px 14px',
    borderRadius: '14px',
    background: 'rgba(222, 231, 231, 0.82)',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '750',
  },

  companyPanel: {
    width: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    textAlign: 'left',
  },

  panelLabel: {
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '800',
  },

  companyTitle: {
    color: '#002642',
    fontSize: '20px',
    fontWeight: '900',
    lineHeight: 1.15,
  },

  inviteBlock: {
    width: '100%',
  },

  inviteCodeBox: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #dee7e7',
    background: '#f8fbff',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'end',
    gap: '12px',
  },

  inviteMain: {
    minWidth: 0,
  },

  inviteActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },

  inviteLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '850',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '6px',
  },

  inviteValue: {
    display: 'block',
    fontSize: '20px',
    fontWeight: '900',
    letterSpacing: '0.08em',
    color: '#102a43',
    wordBreak: 'normal',
    overflowWrap: 'anywhere',
  },

  branchCreateRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '8px',
  },

  branchList: {
    minHeight: 0,
    display: 'grid',
    gap: '8px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    overflowY: 'auto',
  },

  branchItem: {
    minHeight: '38px',
    padding: '8px 10px',
    borderRadius: '12px',
    background: '#f8fbff',
    border: '1px solid #dee7e7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },

  branchItemName: {
    color: '#002642',
    fontSize: '14px',
    fontWeight: '850',
    overflowWrap: 'anywhere',
  },

  branchDeleteButton: {
    flexShrink: 0,
    height: '30px',
    padding: '0 10px',
    border: 'none',
    borderRadius: '9px',
    background: 'rgba(215, 173, 207, 0.42)',
    color: '#8d1d1d',
    fontSize: '11px',
    fontWeight: '800',
    cursor: 'pointer',
  },

  requestsHeader: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
    paddingBottom: '10px',
    borderBottom: '1px solid #dee7e7',
  },

  requestList: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
  },

  emptyRequests: {
    flex: '1 1 auto',
    minHeight: '120px',
    borderRadius: '14px',
    background: '#f8fbff',
    border: '1px dashed #cfdde8',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '750',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },

  requestItem: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '14px',
    background: '#f8fbff',
    border: '1px solid #dee7e7',
  },

  requestMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '220px',
  },

  requestName: {
    color: '#002642',
    fontSize: '14px',
    fontWeight: '850',
  },

  requestMeta: {
    color: '#64748b',
    fontSize: '12px',
  },

  requestActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },

  emptyState: {
    minHeight: '108px',
    padding: '16px',
    borderRadius: '12px',
    background: '#f8fbff',
    border: '1px solid #dee7e7',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    textAlign: 'center',
  },

  emptyTitle: {
    color: '#002642',
    fontSize: '18px',
    fontWeight: '850',
  },

  emptyText: {
    margin: 0,
    color: '#4f646f',
    fontSize: '14px',
    lineHeight: 1.4,
    textAlign: 'center',
  },

  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  label: {
    color: '#4f646f',
    fontWeight: '750',
    fontSize: '13px',
  },

  input: {
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 14px',
    color: '#002642',
    fontSize: '13px',
    outline: 'none',
  },

  select: {
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 14px',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '700',
    outline: 'none',
    cursor: 'pointer',
  },

  primaryButton: {
    height: '40px',
    padding: '0 16px',
    background: '#002642',
    border: 'none',
    borderRadius: '10px',
    color: '#f4faff',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  primaryButtonDisabled: {
    height: '40px',
    padding: '0 16px',
    background: '#94a3b8',
    border: 'none',
    borderRadius: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
  },

  secondaryButton: {
    height: '40px',
    padding: '0 16px',
    background: '#eef2ff',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    borderRadius: '10px',
    color: '#3730a3',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  secondaryButtonDisabled: {
    height: '40px',
    padding: '0 16px',
    background: '#e2e8f0',
    border: 'none',
    borderRadius: '10px',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
  },

  copyButton: {
    height: '40px',
    minWidth: '104px',
    padding: '0 14px',
    borderRadius: '10px',
    border: '1px solid rgba(17, 24, 39, 0.12)',
    background: '#eef2ff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  previewBox: {
    marginTop: '4px',
    padding: '16px',
    borderRadius: '14px',
    background: '#f8fbff',
    border: '1px solid #dee7e7',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  previewTitle: {
    fontWeight: '900',
    color: '#002642',
    fontSize: '18px',
    textAlign: 'center',
  },

  joinFieldCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  infoGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },

  infoItem: {
    padding: '12px',
    borderRadius: '12px',
    background: '#f8fbff',
    border: '1px solid #dee7e7',
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

  assignedBranchList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '2px',
  },

  assignedBranchPill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '30px',
    padding: '0 12px',
    borderRadius: '999px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '700',
  },

  pendingPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '14px 16px',
    borderRadius: '12px',
    background: 'rgba(215, 173, 207, 0.18)',
    border: '1px solid rgba(215, 173, 207, 0.45)',
  },

  pendingTitle: {
    color: '#002642',
    fontSize: '16px',
    fontWeight: '850',
  },

  pendingText: {
    color: '#475569',
    fontSize: '14px',
    lineHeight: 1.5,
  },
};
