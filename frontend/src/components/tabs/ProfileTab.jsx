// frontend/src/components/tabs/ProfileTab.jsx
import { useState } from 'react';

export default function ProfileTab({ language, user, updateUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || 'Иван',
    lastName: user?.lastName || 'Петров',
    company: user?.company || 'ShiftPlanner Inc.',
    telegram: user?.telegram || '@ivan_petrov',
    email: user?.email || 'ivan@example.com',
    position: user?.position || 'Бармен'
  });

  const texts = {
    ru: {
      title: 'Личный кабинет',
      firstName: 'Имя',
      lastName: 'Фамилия',
      company: 'Компания',
      telegram: 'Telegram (алиас)',
      email: 'Email',
      position: 'Должность',
      edit: 'Редактировать',
      save: 'Сохранить',
      cancel: 'Отмена'
    },
    en: {
      title: 'Profile',
      firstName: 'First Name',
      lastName: 'Last Name',
      company: 'Company',
      telegram: 'Telegram (alias)',
      email: 'Email',
      position: 'Position',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel'
    }
  };

  const t = texts[language] || texts.ru;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (updateUser) updateUser(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || 'Иван',
      lastName: user?.lastName || 'Петров',
      company: user?.company || 'ShiftPlanner Inc.',
      telegram: user?.telegram || '@ivan_petrov',
      email: user?.email || 'ivan@example.com',
      position: user?.position || 'Бармен'
    });
    setIsEditing(false);
  };

  const inputStyle = {
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
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>{t.title}</h2>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} style={styles.editBtn}>
            {t.edit}
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t.firstName}</label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t.lastName}</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t.company}</label>
            <input type="text" name="company" value={formData.company} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t.telegram}</label>
            <input type="text" name="telegram" value={formData.telegram} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t.email}</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t.position}</label>
            <input type="text" name="position" value={formData.position} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={styles.formActions}>
            <button onClick={handleSave} style={styles.saveBtn}>{t.save}</button>
            <button onClick={handleCancel} style={styles.cancelBtn}>{t.cancel}</button>
          </div>
        </div>
      ) : (
        <div style={styles.infoList}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t.firstName}:</span>
            <span style={styles.infoValue}>{formData.firstName}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t.lastName}:</span>
            <span style={styles.infoValue}>{formData.lastName}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t.company}:</span>
            <span style={styles.infoValue}>{formData.company}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t.telegram}:</span>
            <span style={styles.infoValue}>{formData.telegram}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t.email}:</span>
            <span style={styles.infoValue}>{formData.email}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t.position}:</span>
            <span style={styles.infoValue}>{formData.position}</span>
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
  cardTitle: {
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
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
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
    width: '140px',
    fontWeight: '600',
    color: '#4F646F'
  },
  infoValue: {
    flex: 1,
    color: '#002642'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formRow: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap'
  },
  formGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '200px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#4F646F'
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px'
  },
  saveBtn: {
    padding: '10px 20px',
    background: '#002642',
    border: 'none',
    borderRadius: '12px',
    color: '#F4FAFF',
    fontWeight: '500',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '10px 20px',
    background: '#DEE7E7',
    border: 'none',
    borderRadius: '12px',
    color: '#4F646F',
    fontWeight: '500',
    cursor: 'pointer'
  }
};