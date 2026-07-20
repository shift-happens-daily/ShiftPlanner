import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordResetRequest } from '../services/authService';
import { extractApiErrorMessage } from '../services/error';
import { getStoredLanguage, setStoredLanguage } from '../services/language';

const APP_ICON_SRC = '/v2-Photoroom.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [language, setLanguage] = useState(getStoredLanguage);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const texts = {
    ru: {
      title: 'Новый пароль',
      subtitle: 'Придумайте новый пароль для входа в ShiftPlanner.',
      newPassword: 'Новый пароль',
      confirmPassword: 'Подтверждение пароля',
      passwordPlaceholder: 'Минимум 8 символов',
      submit: 'Сохранить пароль',
      wait: 'Подождите...',
      backToLogin: 'Вернуться ко входу',
      passwordTooShort: 'Пароль должен быть минимум 8 символов.',
      passwordMismatch: 'Пароли не совпадают.',
      missingToken: 'Ссылка для сброса пароля недействительна. Запросите новую на странице входа.',
      success: 'Пароль изменён. Теперь можно войти.',
      authError: 'Не удалось сменить пароль.',
      langBtn: 'RU',
    },
    en: {
      title: 'New password',
      subtitle: 'Choose a new password for your ShiftPlanner account.',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      passwordPlaceholder: 'At least 8 characters',
      submit: 'Save password',
      wait: 'Please wait...',
      backToLogin: 'Back to login',
      passwordTooShort: 'Password must be at least 8 characters.',
      passwordMismatch: 'Passwords do not match.',
      missingToken: 'Invalid reset link. Request a new one from the login page.',
      success: 'Password changed. You can log in now.',
      authError: 'Could not reset password.',
      langBtn: 'EN',
    },
  };

  const t = texts[language] || texts.ru;

  const pageStyle = useMemo(() => ({
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: 'linear-gradient(135deg, #002642 0%, #4f646f 100%)',
    boxSizing: 'border-box',
  }), []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!token) {
      setErrorMessage(t.missingToken);
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(t.passwordTooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t.passwordMismatch);
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordResetRequest({ token, new_password: newPassword });
      setSuccessMessage(t.success);
      setTimeout(() => navigate('/', { replace: true }), 1800);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.authError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLanguage = () => {
    const next = language === 'ru' ? 'en' : 'ru';
    setStoredLanguage(next);
    setLanguage(next);
  };

  return (
    <div style={pageStyle}>
      <button type="button" onClick={toggleLanguage} style={styles.languageButton}>
        {t.langBtn}
      </button>

      <div style={styles.brand}>
        <img src={APP_ICON_SRC} alt="ShiftPlanner" style={styles.logo} />
        <h1 style={styles.brandTitle}>ShiftPlanner</h1>
      </div>

      <section style={styles.card}>
        <h2 style={styles.title}>{t.title}</h2>
        <p style={styles.subtitle}>{t.subtitle}</p>

        {!token ? (
          <div style={styles.errorBox}>{t.missingToken}</div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={styles.inputGroup}>
              <label style={styles.label} htmlFor="reset-password">{t.newPassword}</label>
              <input
                id="reset-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={t.passwordPlaceholder}
                style={styles.input}
                autoComplete="new-password"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label} htmlFor="reset-password-confirm">{t.confirmPassword}</label>
              <input
                id="reset-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t.passwordPlaceholder}
                style={styles.input}
                autoComplete="new-password"
              />
            </div>

            {errorMessage ? <div style={styles.errorBox}>{errorMessage}</div> : null}
            {successMessage ? <div style={styles.successBox}>{successMessage}</div> : null}

            <button type="submit" style={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? t.wait : t.submit}
            </button>
          </form>
        )}

        <Link to="/" style={styles.backLink}>{t.backToLogin}</Link>
      </section>
    </div>
  );
}

const styles = {
  languageButton: {
    position: 'fixed',
    top: '22px',
    right: '28px',
    zIndex: 10,
    padding: '9px 18px',
    borderRadius: '999px',
    border: '1px solid rgba(79, 100, 111, 0.18)',
    background: 'rgba(222, 231, 231, 0.72)',
    color: '#002642',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
  },
  logo: {
    width: '72px',
    height: '72px',
    objectFit: 'contain',
  },
  brandTitle: {
    margin: 0,
    color: '#f4faff',
    fontSize: '42px',
    fontWeight: 600,
  },
  card: {
    width: 'min(100%, 430px)',
    boxSizing: 'border-box',
    padding: '26px 30px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    textAlign: 'left',
  },
  title: {
    margin: '0 0 8px',
    color: '#002642',
    fontSize: '24px',
    fontWeight: 800,
  },
  subtitle: {
    margin: '0 0 18px',
    color: '#4f646f',
    fontSize: '14px',
    lineHeight: 1.45,
  },
  inputGroup: {
    marginBottom: '14px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: 700,
  },
  input: {
    width: '100%',
    height: '48px',
    padding: '0 15px',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '1px solid #dee7e7',
    background: '#f8fbfd',
    color: '#002642',
    fontSize: '16px',
    fontFamily: 'inherit',
  },
  submitButton: {
    width: '100%',
    height: '48px',
    marginTop: '8px',
    border: 'none',
    borderRadius: '12px',
    background: '#002642',
    color: '#f4faff',
    fontSize: '16px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  errorBox: {
    marginBottom: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(215, 173, 207, 0.35)',
    color: '#8d1d1d',
    fontSize: '14px',
    fontWeight: 600,
  },
  successBox: {
    marginBottom: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#dee7e7',
    color: '#002642',
    fontSize: '14px',
    fontWeight: 600,
  },
  backLink: {
    display: 'inline-block',
    marginTop: '16px',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: 700,
    textDecoration: 'none',
  },
};
