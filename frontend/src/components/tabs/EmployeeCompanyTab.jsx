import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { joinCompany, listEmployeeCompanyManagers, previewInviteCode } from '../../services/companyService';
import { extractApiErrorMessage } from '../../services/error';
import { useUserBranches } from '../../hooks/useUserBranches';
import { useUnsavedChanges } from '../../context/useUnsavedChanges';
import { getEmployeePositionLabel, getPositionLabel } from '../../utils/employeeDisplay';
import { getManagerInitials, normalizeManagerList, sortCompanyManagers } from '../../utils/managerDisplay';
import '../../styles/employee-dashboard.css';

const JOIN_SCOPE = 'company-join';

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

function IconBuilding() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 7H10M9 11H10M9 15H10M14 7H15M14 11H15M14 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 21H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function EmployeeCompanyTab({ language, user }) {
  const { markUnsaved, markSaved } = useUnsavedChanges();
  const { refreshUser } = useAuth();

  const [inviteCode, setInviteCode] = useState('');
  const [invitePreview, setInvitePreview] = useState(null);
  const [selectedJoinBranchId, setSelectedJoinBranchId] = useState('');
  const [selectedJoinPositionId, setSelectedJoinPositionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyManagers, setCompanyManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersError, setManagersError] = useState('');

  const texts = {
    ru: {
      title: 'Компания',
      notConnectedTitle: 'Вы ещё не подключены',
      notConnectedText: 'Попросите у менеджера код приглашения, чтобы присоединиться к компании.',
      inviteCode: 'Инвайт-код',
      invitePlaceholder: 'ВВЕДИТЕ КОД',
      previewInvite: 'Проверить код',
      joinCompany: 'Присоединиться',
      previewHint: 'Сначала проверьте код, затем нажмите «Присоединиться».',
      employeeHint: 'После подтверждения менеджером станут доступны расписание и отчёты.',
      inviteFound: 'Инвайт-код найден.',
      joinSuccess: 'Вы успешно присоединились к компании!',
      joinPending: 'Заявка отправлена. Дождитесь подтверждения менеджера.',
      pendingTitle: 'Заявка на рассмотрении',
      pendingText: 'Менеджер компании должен принять вашу заявку. После этого здесь появятся филиал и позиция.',
      connected: 'Подключено',
      pending: 'На рассмотрении',
      branch: 'Филиал',
      branches: 'Филиалы',
      position: 'Позиция',
      employeeId: 'ID сотрудника',
      email: 'Email',
      status: 'Статус',
      active: 'Активен',
      noBranchesAssigned: 'Филиал не назначен',
      noBranchSelected: 'Без филиала',
      noPositionSelected: 'Без позиции',
      managerTitle: 'Менеджер компании',
      managersTitle: 'Менеджеры компании',
      managersHint: 'Контакты менеджеров вашей компании.',
      managerEmail: 'Email',
      managerRoleOwner: 'Владелец',
      managerRoleManager: 'Менеджер',
      noManagerAvailable: 'Контакт менеджера пока недоступен.',
      pendingManagerContact: 'Контакт менеджера появится после подтверждения вашей заявки.',
      managersLoading: 'Загрузка контактов менеджеров…',
      managersLoadError: 'Не удалось загрузить контакты менеджеров.',
      empty: '—',
    },
    en: {
      title: 'Company',
      notConnectedTitle: "You're not connected yet",
      notConnectedText: 'Ask your manager for an invitation code to join your company workspace.',
      inviteCode: 'Invite code',
      invitePlaceholder: 'ENTER CODE',
      previewInvite: 'Preview invite',
      joinCompany: 'Join company',
      previewHint: 'Preview the invite code first, then click "Join company".',
      employeeHint: 'Schedule and reports become available after a manager approves your request.',
      inviteFound: 'Invite found.',
      joinSuccess: 'You have successfully joined the company!',
      joinPending: 'Request submitted. Wait for manager approval.',
      pendingTitle: 'Request pending',
      pendingText: 'A company manager must approve your request. Branch and position will appear here after approval.',
      connected: 'Connected',
      pending: 'Pending',
      branch: 'Branch',
      branches: 'Branches',
      position: 'Position',
      employeeId: 'Employee ID',
      email: 'Email',
      status: 'Status',
      active: 'Active',
      noBranchesAssigned: 'No branch assigned',
      noBranchSelected: 'No branch selected',
      noPositionSelected: 'No position selected',
      managerTitle: 'Company manager',
      managersTitle: 'Company managers',
      managersHint: 'Contact details for your company managers.',
      managerEmail: 'Email',
      managerRoleOwner: 'Owner',
      managerRoleManager: 'Manager',
      noManagerAvailable: 'Manager contact is not available yet.',
      pendingManagerContact: 'Manager contact will appear after your request is approved.',
      managersLoading: 'Loading manager contacts…',
      managersLoadError: 'Could not load manager contacts.',
      empty: '—',
    },
  };

  const t = texts[language] || texts.ru;

  const currentCompany = user?.company || null;
  const companyId = user?.companyId ?? currentCompany?.id ?? null;
  const employeeStatus = user?.employeeStatus ?? user?.employee_status ?? null;
  const isPendingEmployee = employeeStatus === 'pending';
  const employeePositionLabel = getEmployeePositionLabel(user, t.empty);
  const { userBranches } = useUserBranches(user);

  const previewCompany = getCompanyFromPreview(invitePreview);
  const previewCompanyName = previewCompany?.name || t.empty;
  const previewBranches = getBranchesFromPreview(invitePreview);
  const previewPositions = getPositionsFromPreview(invitePreview);
  const canJoin = Boolean(invitePreview) && !isSubmitting;

  const employeePublicId = user?.publicId || user?.public_id || t.empty;
  const primaryBranch = userBranches[0] ? getName(userBranches[0]) : t.noBranchesAssigned;

  useEffect(() => {
    let cancelled = false;

    async function loadManagers() {
      setManagersError('');

      try {
        const freshUser = await refreshUser();
        if (cancelled) return;

        const freshCompanyId = freshUser?.companyId ?? freshUser?.company?.id ?? null;
        const freshStatus = freshUser?.employeeStatus ?? freshUser?.employee_status ?? null;
        const freshIsPending = freshStatus === 'pending';

        if (!freshCompanyId || freshIsPending) {
          setCompanyManagers([]);
          setManagersLoading(false);
          return;
        }

        setManagersLoading(true);

        const data = await listEmployeeCompanyManagers();
        if (cancelled) return;

        setCompanyManagers(sortCompanyManagers(normalizeManagerList(data)));
      } catch (error) {
        if (cancelled) return;
        setCompanyManagers([]);
        setManagersError(extractApiErrorMessage(error, t.managersLoadError, language));
      } finally {
        if (!cancelled) {
          setManagersLoading(false);
        }
      }
    }

    void loadManagers();

    return () => {
      cancelled = true;
    };
  }, [companyId, employeeStatus, language, refreshUser, t.managersLoadError]);

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
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
      markSaved(JOIN_SCOPE);
      setSuccessMessage(
        joinedProfile?.employee_status === 'pending' ? t.joinPending : t.joinSuccess
      );
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentCompany && !isPendingEmployee) {
    return (
      <div className="employee-dashboard">
        <div className="ed-page">
          {errorMessage ? <div className="ed-error">{errorMessage}</div> : null}
          {successMessage ? <div className="ed-alert ed-alert-success">{successMessage}</div> : null}

          <div className="ed-card ed-join-card">
            <div className="ed-join-icon">
              <IconBuilding />
            </div>
            <h2 className="ed-join-title">{t.notConnectedTitle}</h2>
            <p className="ed-join-text">{t.notConnectedText}</p>

            <div className="ed-form-stack">
              <label className="ed-label" htmlFor="employee-invite-code">{t.inviteCode}</label>
              <input
                id="employee-invite-code"
                value={inviteCode}
                onChange={(event) => {
                  setInviteCode(event.target.value.toUpperCase());
                  setInvitePreview(null);
                  markUnsaved(JOIN_SCOPE);
                }}
                placeholder={t.invitePlaceholder}
                className="ed-input ed-input-code"
                autoComplete="off"
              />

              <button
                type="button"
                onClick={handlePreview}
                className="ed-btn ed-btn-secondary"
                disabled={isSubmitting}
              >
                {isSubmitting ? '…' : t.previewInvite}
              </button>

              {invitePreview ? (
                <div className="ed-preview-box">
                  <p className="ed-preview-title">{previewCompanyName}</p>

                  {previewBranches.length > 0 ? (
                    <>
                      <label className="ed-label" htmlFor="employee-join-branch">{t.branch}</label>
                      <select
                        id="employee-join-branch"
                        value={selectedJoinBranchId}
                        onChange={(event) => {
                          setSelectedJoinBranchId(event.target.value);
                          markUnsaved(JOIN_SCOPE);
                        }}
                        className="ed-select"
                      >
                        <option value="">{t.noBranchSelected}</option>
                        {previewBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {getName(branch)}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}

                  {previewPositions.length > 0 ? (
                    <>
                      <label className="ed-label" htmlFor="employee-join-position">{t.position}</label>
                      <select
                        id="employee-join-position"
                        value={selectedJoinPositionId}
                        onChange={(event) => {
                          setSelectedJoinPositionId(event.target.value);
                          markUnsaved(JOIN_SCOPE);
                        }}
                        className="ed-select"
                      >
                        <option value="">{t.noPositionSelected}</option>
                        {previewPositions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {getPositionLabel(position, getName(position))}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleJoin}
                    className="ed-btn ed-btn-primary"
                    disabled={!canJoin}
                  >
                    {t.joinCompany}
                  </button>
                </div>
              ) : null}

              <p className="ed-side-text">{t.employeeHint}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-dashboard">
      <div className="ed-page">
        <header>
          <h1 className="ed-greeting-title">{t.title}</h1>
        </header>

        {errorMessage ? <div className="ed-error">{errorMessage}</div> : null}
        {successMessage ? <div className="ed-alert ed-alert-success">{successMessage}</div> : null}

        {isPendingEmployee ? (
          <div className="ed-alert ed-alert-warning">
            <strong>{t.pendingTitle}</strong>
            {t.pendingText}
          </div>
        ) : null}

        <div className="ed-company-grid">
          <div className="ed-card ed-company-hero-card ed-company-hero-card--full">
            <div className="ed-company-hero">
              <div className="ed-company-logo">
                {getManagerInitials(currentCompany?.name)}
              </div>
              <div>
                <h2 className="ed-company-name">{currentCompany?.name || t.empty}</h2>
                <p className="ed-company-sub">{primaryBranch}</p>
                <span className={`ed-status-badge ${isPendingEmployee ? 'is-pending' : 'is-connected'}`}>
                  <IconCheckCircle />
                  {isPendingEmployee ? t.pending : t.connected}
                </span>
              </div>
            </div>

            <div className="ed-info-grid">
              <div className="ed-info-tile ed-info-tile--branches">
                <span className="ed-info-label">{t.branch}</span>
                {userBranches.length === 0 ? (
                  <p className="ed-info-value">{t.noBranchesAssigned}</p>
                ) : (
                  <p className="ed-info-value">{getName(userBranches[0])}</p>
                )}
              </div>

              <div className="ed-info-tile">
                <span className="ed-info-label">{t.position}</span>
                <p className="ed-info-value">{employeePositionLabel}</p>
              </div>

              <div className="ed-info-tile">
                <span className="ed-info-label">{t.employeeId}</span>
                <p className="ed-info-value">{employeePublicId}</p>
              </div>

              <div className="ed-info-tile">
                <span className="ed-info-label">{t.status}</span>
                <p className="ed-info-value">{isPendingEmployee ? t.pending : t.active}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="ed-card ed-managers-section">
          <div className="ed-managers-section-header">
            <div>
              <h3 className="ed-managers-section-title">
                {companyManagers.length > 1 ? t.managersTitle : t.managerTitle}
              </h3>
              <p className="ed-managers-section-hint">{t.managersHint}</p>
            </div>
            {companyManagers.length > 0 ? (
              <span className="ed-managers-count">{companyManagers.length}</span>
            ) : null}
          </div>

          {isPendingEmployee ? (
            <p className="ed-side-text">{t.pendingManagerContact}</p>
          ) : managersLoading ? (
            <p className="ed-side-text">{t.managersLoading}</p>
          ) : managersError ? (
            <p className="ed-side-text ed-error-inline">{managersError}</p>
          ) : companyManagers.length === 0 ? (
            <p className="ed-side-text">{t.noManagerAvailable}</p>
          ) : (
            <div className="ed-managers-grid">
              {companyManagers.map((manager) => {
                const managerName = manager.full_name || manager.email || t.empty;
                const managerEmail = manager.email || t.empty;
                const roleLabel = manager.manager_role === 'owner'
                  ? t.managerRoleOwner
                  : t.managerRoleManager;

                return (
                  <div key={manager.id ?? manager.user_id ?? manager.email} className="ed-manager-card">
                    <div className="ed-profile-row ed-profile-row--compact">
                      <div className="ed-profile-avatar">{getManagerInitials(managerName)}</div>
                      <div>
                        <p className="ed-profile-name">{managerName}</p>
                        <span className={`ed-manager-role-badge ${manager.manager_role === 'owner' ? 'is-owner' : ''}`}>
                          {roleLabel}
                        </span>
                      </div>
                    </div>

                    <div className="ed-email-box">
                      <p className="ed-email-label">{t.managerEmail}</p>
                      <p className="ed-email-value">{managerEmail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
