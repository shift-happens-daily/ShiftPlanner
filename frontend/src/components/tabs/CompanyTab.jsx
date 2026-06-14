// frontend/src/components/tabs/CompanyTab.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function CompanyTab({ language }) {
  const { user, updateCompany } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    address: '',
    phone: '',
    inviteCode: ''
  });

  // Данные компании (позже будут из API/контекста)
  const [company, setCompany] = useState(user?.company || null);

  // Принудительные стили для полей ввода
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      .company-input,
      .company-input:focus,
      .company-input:active {
        color: #002642 !important;
        background-color: #FFFFFF !important;
      }
      .company-input::placeholder {
        color: #999 !important;
        opacity: 1 !important;
      }
      .company-input:-webkit-autofill,
      .company-input:-webkit-autofill:hover,
      .company-input:-webkit-autofill:focus,
      .company-input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 30px #FFFFFF inset !important;
        -webkit-text-fill-color: #002642 !important;
        color: #002642 !important;
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const texts = {
    ru: {
      title: 'Информация о компании',
      noCompany: 'Вы еще не присоединились ни к одной компании',
      enterInviteCode: 'Ввести invite code',
      inviteCodePlaceholder: 'Введите invite code',
      join: 'Присоединиться',
      createCompany: 'Создать компанию',
      companyName: 'Название компании',
      address: 'Адрес',
      phone: 'Телефон',
      yourInviteCode: 'Invite код для сотрудников',
      generate: 'Сгенерировать',
      save: 'Сохранить',
      cancel: 'Отмена',
      edit: 'Редактировать',
      copy: 'Копировать',
      copied: 'Скопировано!',
      name: 'Название',
      addressLabel: 'Адрес',
      phoneLabel: 'Телефон'
    },
    en: {
      title: 'Company Information',
      noCompany: 'You are not yet a member of any company',
      enterInviteCode: 'Enter invite code',
      inviteCodePlaceholder: 'Enter invite code',
      join: 'Join',
      createCompany: 'Create company',
      companyName: 'Company name',
      address: 'Address',
      phone: 'Phone',
      yourInviteCode: 'Invite code for employees',
      generate: 'Generate',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      copy: 'Copy',
      copied: 'Copied!',
      name: 'Name',
      addressLabel: 'Address',
      phoneLabel: 'Phone'
    }
  };

  const t = texts[language] || texts.ru;

  // Генерация случайного invite кода
  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewCompany({ ...newCompany, inviteCode: code });
  };

  // Создание компании
  const handleCreateCompany = () => {
    if (newCompany.name && newCompany.inviteCode) {
      const createdCompany = {
        id: Date.now(),
        name: newCompany.name,
        address: newCompany.address || '',
        phone: newCompany.phone || '',
        inviteCode: newCompany.inviteCode
      };
      setCompany(createdCompany);
      if (updateCompany) updateCompany(createdCompany);
      setShowCreateForm(false);
      setNewCompany({ name: '', address: '', phone: '', inviteCode: '' });
    }
  };

  // Присоединение по invite коду
  const handleJoinCompany = () => {
    if (inviteCode) {
      const joinedCompany = {
        id: Date.now(),
        name: 'Пример компании',
        address: 'г. Москва, ул. Примерная, д. 123',
        phone: '+7 (999) 123-45-67',
        inviteCode: inviteCode
      };
      setCompany(joinedCompany);
      if (updateCompany) updateCompany(joinedCompany);
      setShowInviteInput(false);
      setInviteCode('');
    }
  };

  // Редактирование компании
  const [editForm, setEditForm] = useState({
    name: company?.name || '',
    address: company?.address || '',
    phone: company?.phone || ''
  });

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = () => {
    const updatedCompany = { ...company, ...editForm };
    setCompany(updatedCompany);
    if (updateCompany) updateCompany(updatedCompany);
    setIsEditing(false);
  };

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(company?.inviteCode || '');
    alert(t.copied);
  };

  // Если нет компании
  if (!company) {
    const isManager = user?.role === 'manager';

    return (
      <div style={styles.card}>
        <h2 style={styles.title}>{t.title}</h2>
        <div style={styles.noCompanyContainer}>
          <p style={styles.noCompanyText}>{t.noCompany}</p>
          
          {!showInviteInput && !showCreateForm && (
            <div style={styles.buttonGroup}>
              <button onClick={() => setShowInviteInput(true)} style={styles.primaryBtn}>
                {t.enterInviteCode}
              </button>
              {isManager && (
                <button onClick={() => setShowCreateForm(true)} style={styles.secondaryBtn}>
                  {t.createCompany}
                </button>
              )}
            </div>
          )}

          {/* Форма ввода invite кода */}
          {showInviteInput && (
            <div style={styles.form}>
              <input
                type="text"
                className="company-input"
                placeholder={t.inviteCodePlaceholder}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                style={styles.input}
              />
              <div style={styles.formActions}>
                <button onClick={handleJoinCompany} style={styles.primaryBtn}>{t.join}</button>
                <button onClick={() => setShowInviteInput(false)} style={styles.cancelBtn}>{t.cancel}</button>
              </div>
            </div>
          )}

          {/* Форма создания компании (только для менеджера) */}
          {showCreateForm && isManager && (
            <div style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t.companyName}</label>
                <input
                  type="text"
                  className="company-input"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t.address}</label>
                <input
                  type="text"
                  className="company-input"
                  value={newCompany.address}
                  onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t.phone}</label>
                <input
                  type="text"
                  className="company-input"
                  value={newCompany.phone}
                  onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t.yourInviteCode}</label>
                <div style={styles.inviteRow}>
                  <input
                    type="text"
                    className="company-input"
                    value={newCompany.inviteCode}
                    readOnly
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <button onClick={generateInviteCode} style={styles.generateBtn}>
                    {t.generate}
                  </button>
                </div>
              </div>
              <div style={styles.formActions}>
                <button onClick={handleCreateCompany} style={styles.primaryBtn}>{t.save}</button>
                <button onClick={() => setShowCreateForm(false)} style={styles.cancelBtn}>{t.cancel}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Если компания есть — показываем информацию
  const isManager = user?.role === 'manager';

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.title}>{t.title}</h2>
        {isManager && !isEditing && (
          <button onClick={() => {
            setEditForm({
              name: company.name,
              address: company.address || '',
              phone: company.phone || ''
            });
            setIsEditing(true);
          }} style={styles.editBtn}>
            {t.edit}
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t.companyName}</label>
            <input type="text" className="company-input" name="name" value={editForm.name} onChange={handleEditChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t.addressLabel}</label>
            <input type="text" className="company-input" name="address" value={editForm.address} onChange={handleEditChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t.phoneLabel}</label>
            <input type="text" className="company-input" name="phone" value={editForm.phone} onChange={handleEditChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t.yourInviteCode}</label>
            <div style={styles.inviteRow}>
              <input type="text" className="company-input" value={company.inviteCode} readOnly style={{ ...styles.input, flex: 1 }} />
              <button onClick={handleCopyInviteCode} style={styles.generateBtn}>{t.copy}</button>
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={handleSaveEdit} style={styles.primaryBtn}>{t.save}</button>
            <button onClick={() => setIsEditing(false)} style={styles.cancelBtn}>{t.cancel}</button>
          </div>
        </div>
      ) : (
        <div style={styles.infoList}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t.companyName}:</span>
            <span style={styles.infoValue}>{company.name}</span>
          </div>
          {company.address && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>{t.addressLabel}:</span>
              <span style={styles.infoValue}>{company.address}</span>
            </div>
          )}
          {company.phone && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>{t.phoneLabel}:</span>
              <span style={styles.infoValue}>{company.phone}</span>
            </div>
          )}
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t.yourInviteCode}:</span>
            <div style={styles.inviteValue}>
              <span style={styles.infoValue}>{company.inviteCode}</span>
              <button onClick={handleCopyInviteCode} style={styles.copySmallBtn}>{t.copy}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#002642',
    margin: 0
  },
  editBtn: {
    padding: '8px 16px',
    background: '#B7ADCF',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '500',
    cursor: 'pointer'
  },
  noCompanyContainer: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  noCompanyText: {
    fontSize: '16px',
    color: '#4F646F',
    marginBottom: '24px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  primaryBtn: {
    padding: '12px 24px',
    background: '#002642',
    border: 'none',
    borderRadius: '12px',
    color: '#F4FAFF',
    fontWeight: '500',
    cursor: 'pointer'
  },
  secondaryBtn: {
    padding: '12px 24px',
    background: '#B7ADCF',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '500',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '12px 24px',
    background: '#DEE7E7',
    border: 'none',
    borderRadius: '12px',
    color: '#4F646F',
    fontWeight: '500',
    cursor: 'pointer'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#4F646F'
  },
  input: {
    padding: '12px 14px',
    fontSize: '16px',
    color: '#002642',
    backgroundColor: '#FFFFFF',
    border: '2px solid #DEE7E7',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.3s ease',
    width: '100%',
    boxSizing: 'border-box'
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '8px'
  },
  inviteRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  generateBtn: {
    padding: '12px 20px',
    background: '#B7ADCF',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  infoRow: {
    display: 'flex',
    padding: '12px 0',
    borderBottom: '1px solid #DEE7E7'
  },
  infoLabel: {
    width: '160px',
    fontWeight: '600',
    color: '#4F646F'
  },
  infoValue: {
    flex: 1,
    color: '#002642'
  },
  inviteValue: {
    flex: 1,
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  copySmallBtn: {
    padding: '4px 12px',
    background: '#DEE7E7',
    border: 'none',
    borderRadius: '8px',
    color: '#4F646F',
    fontSize: '12px',
    cursor: 'pointer'
  }
};