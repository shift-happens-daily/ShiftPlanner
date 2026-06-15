import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { createCompany, joinCompany, listCompanies, previewInviteCode } from '../../services/companyService';
import { extractApiErrorMessage } from '../../services/error';

export default function CompanyTab({ language, userRole, user }) {
  const { refreshUser } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(userRole === 'manager');
  const [inviteCode, setInviteCode] = useState('');
  const [invitePreview, setInvitePreview] = useState(null);
  const [joinPayload, setJoinPayload] = useState({ branch_id: '', position_id: '' });
  const [companyName, setCompanyName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const texts = {
    ru: {
      title: 'Компания',
      currentCompany: 'Текущая привязка',
      company: 'Компания',
      branch: 'Филиал',
      position: 'Позиция',
      inviteCode: 'Invite-код',
      noCompany: 'Аккаунт еще не привязан к компании.',
      previewInvite: 'Проверить код',
      joinCompany: 'Присоединиться',
      invitePlaceholder: 'Введите invite-код',
      selectBranch: 'Выберите филиал',
      selectPosition: 'Выберите позицию',
      companies: 'Список компаний',
      createCompany: 'Создать компанию',
      companyName: 'Название компании',
      saveCompany: 'Создать',
      empty: 'Нет данных',
      loading: 'Загрузка...',
      companyCreated: 'Компания создана.',
      companyJoined: 'Компания успешно привязана.',
      previewHint: 'Сначала проверьте invite-код, затем выберите филиал и позицию.',
    },
    en: {
      title: 'Company',
      currentCompany: 'Current binding',
      company: 'Company',
      branch: 'Branch',
      position: 'Position',
      inviteCode: 'Invite code',
      noCompany: 'This account is not linked to a company yet.',
      previewInvite: 'Preview invite',
      joinCompany: 'Join company',
      invitePlaceholder: 'Enter invite code',
      selectBranch: 'Select branch',
      selectPosition: 'Select position',
      companies: 'Companies',
      createCompany: 'Create company',
      companyName: 'Company name',
      saveCompany: 'Create',
      empty: 'No data',
      loading: 'Loading...',
      companyCreated: 'Company created.',
      companyJoined: 'Company joined successfully.',
      previewHint: 'Preview the invite code first, then choose branch and position.',
    },
  };

  const t = texts[language] || texts.ru;

  useEffect(() => {
    if (userRole !== 'manager') {
      return undefined;
    }

    let isMounted = true;

    async function loadCompanies() {
      setIsLoadingCompanies(true);
      try {
        const data = await listCompanies();
        if (isMounted) {
          setCompanies(data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(extractApiErrorMessage(error, null, language));
        }
      } finally {
        if (isMounted) {
          setIsLoadingCompanies(false);
        }
      }
    }

    loadCompanies();
    return () => {
      isMounted = false;
    };
  }, [language, userRole]);

  const handlePreview = async () => {
    if (!inviteCode.trim()) {
      setErrorMessage(t.invitePlaceholder);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const preview = await previewInviteCode(inviteCode.trim());
      setInvitePreview(preview);
      setJoinPayload({
        branch_id: preview.branches[0]?.id ? String(preview.branches[0].id) : '',
        position_id: preview.positions[0]?.id ? String(preview.positions[0].id) : '',
      });
    } catch (error) {
      setInvitePreview(null);
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!invitePreview) {
      setErrorMessage(t.previewHint);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await joinCompany({
        invite_code: inviteCode.trim(),
        branch_id: joinPayload.branch_id ? Number(joinPayload.branch_id) : null,
        position_id: joinPayload.position_id ? Number(joinPayload.position_id) : null,
      });
      await refreshUser();
      setInviteCode('');
      setInvitePreview(null);
      setJoinPayload({ branch_id: '', position_id: '' });
      setSuccessMessage(t.companyJoined);
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

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const createdCompany = await createCompany({ name: companyName.trim() });
      setCompanies((prev) => [createdCompany, ...prev]);
      setCompanyName('');
      setSuccessMessage(t.companyCreated);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountRows = [
    { label: t.company, value: user?.company?.name },
    { label: t.branch, value: user?.branch?.name },
    { label: t.position, value: user?.position?.name },
  ];

  return (
    <div style={styles.layout}>
      <div style={styles.card}>
        <h2 style={styles.title}>{t.title}</h2>
        {errorMessage && <div style={styles.error}>{errorMessage}</div>}
        {successMessage && <div style={styles.success}>{successMessage}</div>}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>{t.currentCompany}</h3>
          {user?.company ? (
            <div style={styles.infoList}>
              {accountRows.map((row) => (
                <div key={row.label} style={styles.infoRow}>
                  <span style={styles.infoLabel}>{row.label}</span>
                  <span style={styles.infoValue}>{row.value || t.empty}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyText}>{t.noCompany}</p>
          )}
        </div>

        {userRole === 'employee' && !user?.company && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t.joinCompany}</h3>
            <p style={styles.hint}>{t.previewHint}</p>
            <div style={styles.formGroup}>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder={t.invitePlaceholder}
                style={styles.input}
              />
            </div>
            <div style={styles.buttonRow}>
              <button onClick={handlePreview} style={styles.primaryButton} disabled={isSubmitting}>
                {t.previewInvite}
              </button>
            </div>

            {invitePreview && (
              <div style={styles.previewBox}>
                <div style={styles.previewTitle}>{invitePreview.company_name}</div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t.branch}</label>
                  <select
                    value={joinPayload.branch_id}
                    onChange={(event) => setJoinPayload((prev) => ({ ...prev, branch_id: event.target.value }))}
                    style={styles.input}
                  >
                    <option value="">{t.selectBranch}</option>
                    {invitePreview.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t.position}</label>
                  <select
                    value={joinPayload.position_id}
                    onChange={(event) => setJoinPayload((prev) => ({ ...prev, position_id: event.target.value }))}
                    style={styles.input}
                  >
                    <option value="">{t.selectPosition}</option>
                    {invitePreview.positions.map((position) => (
                      <option key={position.id} value={position.id}>{position.name}</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleJoin} style={styles.primaryButton} disabled={isSubmitting}>
                  {t.joinCompany}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {userRole === 'manager' && (
        <div style={styles.card}>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t.createCompany}</h3>
            <div style={styles.inlineForm}>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder={t.companyName}
                style={styles.input}
              />
              <button onClick={handleCreateCompany} style={styles.primaryButton} disabled={isSubmitting}>
                {t.saveCompany}
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t.companies}</h3>
            {isLoadingCompanies ? (
              <p style={styles.emptyText}>{t.loading}</p>
            ) : companies.length === 0 ? (
              <p style={styles.emptyText}>{t.empty}</p>
            ) : (
              <div style={styles.companyList}>
                {companies.map((company) => (
                  <div key={company.id} style={styles.companyItem}>
                    <div style={styles.companyName}>{company.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  layout: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#002642',
    margin: '0 0 20px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectionTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '18px',
  },
  hint: {
    margin: 0,
    color: '#4F646F',
    fontSize: '13px',
  },
  error: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#FDEAEA',
    color: '#A61B1B',
  },
  success: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#E7F6EC',
    color: '#17663A',
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoRow: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: '10px',
    paddingBottom: '12px',
    borderBottom: '1px solid #DEE7E7',
  },
  infoLabel: {
    color: '#4F646F',
    fontWeight: '600',
  },
  infoValue: {
    color: '#002642',
  },
  emptyText: {
    margin: 0,
    color: '#4F646F',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: '#4F646F',
    fontWeight: '600',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '2px solid #DEE7E7',
    background: '#FFFFFF',
    padding: '12px 14px',
    color: '#002642',
    fontSize: '14px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
  },
  inlineForm: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    padding: '12px 18px',
    background: '#002642',
    border: 'none',
    borderRadius: '12px',
    color: '#F4FAFF',
    fontWeight: '600',
    cursor: 'pointer',
  },
  previewBox: {
    marginTop: '8px',
    padding: '16px',
    borderRadius: '16px',
    background: '#FFFFFF',
    border: '1px solid #DEE7E7',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  previewTitle: {
    fontWeight: '700',
    color: '#002642',
  },
  companyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  companyItem: {
    padding: '14px 16px',
    borderRadius: '16px',
    background: '#FFFFFF',
    border: '1px solid #DEE7E7',
  },
  companyName: {
    color: '#002642',
    fontWeight: '700',
    marginBottom: '6px',
  },
  companyMeta: {
    color: '#4F646F',
    fontSize: '14px',
  },
};
