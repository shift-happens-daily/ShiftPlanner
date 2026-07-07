import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { joinCompany, previewInviteCode } from '../../services/companyService';
import { extractApiErrorMessage } from '../../services/error';
import { useUserBranches } from '../../hooks/useUserBranches';
import { useUnsavedChanges } from '../../context/useUnsavedChanges';
import { getEmployeePositionLabel, getPositionLabel } from '../../utils/employeeDisplay';
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

function getInitials(value) {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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
      noBranchesAssigned: 'Филиалы не назначены',
      noBranchSelected: 'Без филиала',
      noPositionSelected: 'Без позиции',
      accountTitle: 'Ваш аккаунт',
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
      noBranchesAssigned: 'No branches assigned',
      noBranchSelected: 'No branch selected',
      noPositionSelected: 'No position selected',
      accountTitle: 'Your account',
      empty: '—',
    },
  };

  const t = texts[language] || texts.ru;

  const currentCompany = user?.company || null;
  const isPendingEmployee = user?.employeeStatus === 'pending';
  const employeePositionLabel = getEmployeePositionLabel(user, t.empty);
  const { userBranches } = useUserBranches(user);

  const previewCompany = getCompanyFromPreview(invitePreview);
  const previewCompanyName = previewCompany?.name || t.empty;
  const previewBranches = getBranchesFromPreview(invitePreview);
  const previewPositions = getPositionsFromPreview(invitePreview);
  const canJoin = Boolean(invitePreview) && !isSubmitting;

  const userName = user?.full_name || user?.fullName || user?.name || user?.email || t.empty;
  const userEmail = user?.email || t.empty;
  const employeePublicId = user?.publicId || user?.public_id || t.empty;
  const primaryBranch = userBranches[0] ? getName(userBranches[0]) : t.noBranchesAssigned;

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
          <div className="ed-card ed-company-hero-card">
            <div className="ed-company-hero">
              <div className="ed-company-logo">
                {getInitials(currentCompany?.name)}
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
                <span className="ed-info-label">{userBranches.length > 1 ? t.branches : t.branch}</span>
                {userBranches.length === 0 ? (
                  <p className="ed-info-value">{t.noBranchesAssigned}</p>
                ) : (
                  <div className="ed-branch-pills">
                    {userBranches.map((branch) => (
                      <span key={branch.id} className="ed-branch-pill">
                        {getName(branch)}
                      </span>
                    ))}
                  </div>
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

          <aside className="ed-card ed-side-card">
            <h3 className="ed-side-title">{t.accountTitle}</h3>

            <div className="ed-profile-row">
              <div className="ed-profile-avatar">{getInitials(userName)}</div>
              <div>
                <p className="ed-profile-name">{userName}</p>
                <p className="ed-profile-meta">{employeePositionLabel}</p>
              </div>
            </div>

            <div className="ed-email-box">
              <p className="ed-email-label">{t.email}</p>
              <p className="ed-email-value">{userEmail}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
