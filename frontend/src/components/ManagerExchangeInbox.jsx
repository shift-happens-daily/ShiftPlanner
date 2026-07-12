import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/useAuth';
import {
  acceptEmployeeRequest,
  acceptManagerRequest,
  declineEmployeeRequest,
  declineManagerRequest,
  listEmployeeRequests,
  listManagerRequests,
} from '../services/companyService';
import { extractApiErrorMessage } from '../services/error';
import { listExchangeRequests, updateExchangeRequest } from '../services/scheduleService';
import { getPositionLabel } from '../utils/employeeDisplay';
import { formatExchangeRequestShiftLine } from '../utils/exchangeRequestDisplay';
import '../styles/manager-exchange-inbox.css';

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function getRequestBranchesLabel(request) {
  const [branch] = normalizeArray(request?.branches);
  return branch?.name || branch?.title || '—';
}

const texts = {
  ru: {
    openInbox: 'Входящие запросы',
    title: 'Входящие',
    hint: 'Заявки на вступление и обмен смен, ожидающие вашего решения.',
    employeeRequests: 'Заявки сотрудников',
    managerRequests: 'Заявки менеджеров',
    exchangeRequests: 'Обмен смен',
    note: 'Причина',
    shift: 'Смена',
    branch: 'Филиал',
    position: 'Позиция',
    approve: 'Принять',
    reject: 'Отклонить',
    accept: 'Принять',
    decline: 'Отклонить',
    exchangeApproved: 'Запрос на обмен одобрен.',
    exchangeRejected: 'Запрос на обмен отклонён.',
    requestAccepted: 'Заявка принята.',
    requestDeclined: 'Заявка отклонена.',
    empty: 'Нет ожидающих запросов.',
    loading: 'Загрузка…',
    close: 'Закрыть',
    confirmDeclineEmployee: 'Отклонить заявку?',
    confirmDeclineManager: 'Отклонить заявку менеджера?',
  },
  en: {
    openInbox: 'Inbox',
    title: 'Inbox',
    hint: 'Join and shift exchange requests waiting for your review.',
    employeeRequests: 'Employee requests',
    managerRequests: 'Manager requests',
    exchangeRequests: 'Shift exchanges',
    note: 'Reason',
    shift: 'Shift',
    branch: 'Branch',
    position: 'Position',
    approve: 'Approve',
    reject: 'Reject',
    accept: 'Accept',
    decline: 'Decline',
    exchangeApproved: 'Exchange request approved.',
    exchangeRejected: 'Exchange request rejected.',
    requestAccepted: 'Request accepted.',
    requestDeclined: 'Request declined.',
    empty: 'No pending requests.',
    loading: 'Loading…',
    close: 'Close',
    confirmDeclineEmployee: 'Decline this request?',
    confirmDeclineManager: 'Decline this manager request?',
  },
};

function IconInbox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16v12H4V6ZM4 8l8 5 8-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InboxSection({ title, children }) {
  return (
    <section className="mei-section">
      <h3 className="mei-section-title">{title}</h3>
      <div className="mei-section-list">{children}</div>
    </section>
  );
}

export default function ManagerExchangeInbox({ language = 'ru', isMobile = false }) {
  const t = texts[language] || texts.ru;
  const { user } = useAuth();
  const hasCompany = Boolean(user?.companyId);
  const isPendingManager = user?.managerStatus === 'pending';

  const [isOpen, setIsOpen] = useState(false);
  const [employeeRequests, setEmployeeRequests] = useState([]);
  const [managerRequests, setManagerRequests] = useState([]);
  const [exchangeRequests, setExchangeRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const rootRef = useRef(null);

  const loadRequests = useCallback(async () => {
    if (!hasCompany || isPendingManager) {
      setEmployeeRequests([]);
      setManagerRequests([]);
      setExchangeRequests([]);
      return;
    }

    setIsLoading(true);

    const [employeeResult, managerResult, exchangeResult] = await Promise.allSettled([
      listEmployeeRequests(),
      listManagerRequests(),
      listExchangeRequests(),
    ]);

    setEmployeeRequests(
      employeeResult.status === 'fulfilled' ? normalizeArray(employeeResult.value) : [],
    );
    setManagerRequests(
      managerResult.status === 'fulfilled' ? normalizeArray(managerResult.value) : [],
    );
    setExchangeRequests(
      exchangeResult.status === 'fulfilled' ? normalizeArray(exchangeResult.value) : [],
    );
    setIsLoading(false);
  }, [hasCompany, isPendingManager]);

  useEffect(() => {
    void loadRequests();
    const interval = setInterval(() => {
      void loadRequests();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  useEffect(() => {
    if (isOpen) {
      void loadRequests();
    }
  }, [isOpen, loadRequests]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(''), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleExchangeDecision = async (requestId, status) => {
    setIsSubmitting(true);
    setFeedback('');

    try {
      await updateExchangeRequest(requestId, { status });
      await loadRequests();
      setFeedback(status === 'approved' ? t.exchangeApproved : t.exchangeRejected);
    } catch (error) {
      setFeedback(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptEmployeeRequest = async (requestId) => {
    setIsSubmitting(true);
    setFeedback('');

    try {
      await acceptEmployeeRequest(requestId);
      await loadRequests();
      setFeedback(t.requestAccepted);
    } catch (error) {
      setFeedback(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineEmployeeRequest = async (requestId) => {
    if (!window.confirm(t.confirmDeclineEmployee)) return;

    setIsSubmitting(true);
    setFeedback('');

    try {
      await declineEmployeeRequest(requestId);
      await loadRequests();
      setFeedback(t.requestDeclined);
    } catch (error) {
      setFeedback(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptManagerRequest = async (requestId) => {
    setIsSubmitting(true);
    setFeedback('');

    try {
      await acceptManagerRequest(requestId);
      await loadRequests();
      setFeedback(t.requestAccepted);
    } catch (error) {
      setFeedback(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineManagerRequest = async (requestId) => {
    if (!window.confirm(t.confirmDeclineManager)) return;

    setIsSubmitting(true);
    setFeedback('');

    try {
      await declineManagerRequest(requestId);
      await loadRequests();
      setFeedback(t.requestDeclined);
    } catch (error) {
      setFeedback(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = employeeRequests.length + managerRequests.length + exchangeRequests.length;
  const hasAnyRequests = pendingCount > 0;

  if (!hasCompany || isPendingManager) {
    return null;
  }

  return (
    <div className="mei-root" ref={rootRef}>
      <button
        type="button"
        className={`mei-trigger${isOpen ? ' mei-trigger--active' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-label={t.openInbox}
        title={t.openInbox}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        style={isMobile ? { width: 36, height: 36, padding: 0 } : undefined}
      >
        <IconInbox />
        {pendingCount > 0 ? (
          <span className="mei-badge" aria-hidden="true">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="mei-panel" role="dialog" aria-label={t.title}>
          <div className="mei-panel-header">
            <div>
              <h2 className="mei-panel-title">{t.title}</h2>
              <p className="mei-panel-hint">{t.hint}</p>
            </div>
            <button
              type="button"
              className="mei-close"
              onClick={() => setIsOpen(false)}
              aria-label={t.close}
            >
              <span className="mei-close-icon" aria-hidden />
            </button>
          </div>

          {feedback ? <div className="mei-feedback">{feedback}</div> : null}

          {isLoading ? (
            <p className="mei-empty">{t.loading}</p>
          ) : !hasAnyRequests ? (
            <p className="mei-empty">{t.empty}</p>
          ) : (
            <div className="mei-list">
              {employeeRequests.length > 0 ? (
                <InboxSection title={t.employeeRequests}>
                  {employeeRequests.map((request) => (
                    <article key={`employee-${request.id}`} className="mei-item">
                      <div className="mei-item-main">
                        <p className="mei-employee">{request.full_name || request.email}</p>
                        <p className="mei-meta">{request.email}</p>
                        <p className="mei-meta">
                          {t.branch}: {getRequestBranchesLabel(request)}
                        </p>
                        <p className="mei-meta">
                          {t.position}: {getPositionLabel(request.position, '—')}
                        </p>
                      </div>
                      <div className="mei-actions">
                        <button
                          type="button"
                          className="mei-btn mei-btn--approve"
                          onClick={() => handleAcceptEmployeeRequest(request.id)}
                          disabled={isSubmitting}
                        >
                          {t.accept}
                        </button>
                        <button
                          type="button"
                          className="mei-btn mei-btn--reject"
                          onClick={() => handleDeclineEmployeeRequest(request.id)}
                          disabled={isSubmitting}
                        >
                          {t.decline}
                        </button>
                      </div>
                    </article>
                  ))}
                </InboxSection>
              ) : null}

              {managerRequests.length > 0 ? (
                <InboxSection title={t.managerRequests}>
                  {managerRequests.map((request) => (
                    <article key={`manager-${request.id}`} className="mei-item">
                      <div className="mei-item-main">
                        <p className="mei-employee">{request.full_name || request.email}</p>
                        <p className="mei-meta">{request.email}</p>
                      </div>
                      <div className="mei-actions">
                        <button
                          type="button"
                          className="mei-btn mei-btn--approve"
                          onClick={() => handleAcceptManagerRequest(request.id)}
                          disabled={isSubmitting}
                        >
                          {t.accept}
                        </button>
                        <button
                          type="button"
                          className="mei-btn mei-btn--reject"
                          onClick={() => handleDeclineManagerRequest(request.id)}
                          disabled={isSubmitting}
                        >
                          {t.decline}
                        </button>
                      </div>
                    </article>
                  ))}
                </InboxSection>
              ) : null}

              {exchangeRequests.length > 0 ? (
                <InboxSection title={t.exchangeRequests}>
                  {exchangeRequests.map((request) => (
                    <article key={`exchange-${request.id}`} className="mei-item">
                      <div className="mei-item-main">
                        <p className="mei-employee">{request.employee_name}</p>
                        <p className="mei-meta">
                          {formatExchangeRequestShiftLine(request, t)}
                        </p>
                        <p className="mei-note">
                          <span className="mei-note-label">{t.note}:</span> {request.note}
                        </p>
                      </div>
                      <div className="mei-actions">
                        <button
                          type="button"
                          className="mei-btn mei-btn--approve"
                          onClick={() => handleExchangeDecision(request.id, 'approved')}
                          disabled={isSubmitting}
                        >
                          {t.approve}
                        </button>
                        <button
                          type="button"
                          className="mei-btn mei-btn--reject"
                          onClick={() => handleExchangeDecision(request.id, 'rejected')}
                          disabled={isSubmitting}
                        >
                          {t.reject}
                        </button>
                      </div>
                    </article>
                  ))}
                </InboxSection>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
