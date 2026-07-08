import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { requestPasswordResetRequest } from '../services/authService';
import { getStoredLanguage } from '../services/language';

const APP_ICON_SRC = '/v2-Photoroom.png';

function EyeIcon() {
  return (
    <div style={iconWrapStyle}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={iconStyle}
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </div>
  );
}

function EyeOffIcon() {
  return (
    <div style={iconWrapStyle}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={iconStyle}
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    </div>
  );
}

export default function Auth() {
  const [authMode, setAuthMode] = useState('login');
  const [role, setRole] = useState('employee');
  const [isCompact, setIsCompact] = useState(false);
  const [language, setLanguage] = useState(getStoredLanguage);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const {
    isAuthenticated,
    isLoading,
    login,
    register,
    user,
    extractErrorMessage,
  } = useAuth();

  const texts = {
    ru: {
      langBtn: 'RU',
      forgotTitle: 'Сброс пароля',
      fullName: 'Имя и фамилия',
      email: 'Email',
      password: 'Пароль',
      confirmPassword: 'Подтверждение пароля',
      employee: 'Сотрудник',
      manager: 'Менеджер',
      login: 'Войти',
      register: 'Зарегистрироваться',
      noAccount: 'Зарегистрироваться',
      hasAccount: 'Войти',
      forgotPassword: 'Забыли пароль?',
      sendResetLink: 'Отправить ссылку',
      backToLogin: 'Вернуться ко входу',
      forgotHint: 'Введите email — мы отправим ссылку для сброса пароля.',
      resetEmailSent: 'Если аккаунт с этим email существует, мы отправили письмо со ссылкой для сброса пароля.',
      emailRequired: 'Введите email.',
      namePlaceholder: 'Иван Петров',
      emailPlaceholder: 'ivan@example.com',
      passwordPlaceholder: 'Минимум 8 символов',
      confirmPasswordPlaceholder: 'Повторите пароль',
      requiredFields: 'Заполните email и пароль.',
      nameRequired: 'Укажите имя и фамилию.',
      passwordTooShort: 'Пароль должен быть минимум 8 символов.',
      passwordMismatch: 'Пароли не совпадают.',
      registerSuccess: 'Аккаунт создан. Проверьте почту и подтвердите email, затем войдите.',
      authError: 'Не удалось выполнить запрос.',
      loading: 'Загрузка...',
      wait: 'Подождите...',
    },
    en: {
      langBtn: 'EN',
      forgotTitle: 'Reset password',
      fullName: 'Full name',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm password',
      employee: 'Employee',
      manager: 'Manager',
      login: 'Log in',
      register: 'Sign up',
      noAccount: 'Sign up',
      hasAccount: 'Log in',
      forgotPassword: 'Forgot password?',
      sendResetLink: 'Send reset link',
      backToLogin: 'Back to login',
      forgotHint: 'Enter your email and we will send a password reset link.',
      resetEmailSent: 'If an account exists for this email, a password reset email has been sent.',
      emailRequired: 'Enter your email.',
      namePlaceholder: 'Ivan Petrov',
      emailPlaceholder: 'ivan@example.com',
      passwordPlaceholder: 'At least 8 characters',
      confirmPasswordPlaceholder: 'Repeat password',
      requiredFields: 'Enter email and password.',
      nameRequired: 'Enter your full name.',
      passwordTooShort: 'Password must be at least 8 characters.',
      passwordMismatch: 'Passwords do not match.',
      registerSuccess: 'Account created. Check your email to confirm it, then log in.',
      authError: 'Request failed.',
      loading: 'Loading...',
      wait: 'Please wait...',
    },
  };

  const t = texts[language] || texts.ru;
  const isLogin = authMode === 'login';
  const isRegister = authMode === 'register';
  const isForgot = authMode === 'forgot';

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth <= 520 || window.innerHeight <= 760);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role) {
      navigate(user.role === 'manager' ? '/manager' : '/employee', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, user?.role]);

  useEffect(() => {
    const styleSheet = document.createElement('style');

    styleSheet.textContent = `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(18px);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes cardIn {
        from {
          opacity: 0;
          transform: translateY(24px) scale(0.98);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      input::placeholder {
        color: rgba(79, 100, 111, 0.58) !important;
        opacity: 1 !important;
      }

      input:focus {
        border-color: #d7adcf !important;
        box-shadow: 0 0 0 4px rgba(215, 173, 207, 0.26) !important;
        outline: none !important;
      }

      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 30px #f4faff inset !important;
        -webkit-text-fill-color: #002642 !important;
      }

      .auth-role-switch {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 4px;
        border-radius: 14px;
        background: #f4faff;
        border: 1px solid #dee7e7;
      }

      .auth-role-option {
        border: 0;
        border-radius: 10px;
        padding: 9px 22px;
        background: transparent;
        color: #4f646f;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
      }

      .auth-role-option.active {
        background: #ffffff;
        color: #002642;
      }

      .auth-eye-button {
        transition: transform 0.08s ease, opacity 0.2s ease, background 0.2s ease;
      }

      .auth-eye-button:hover {
        opacity: 1 !important;
        background: rgba(215, 173, 207, 0.22) !important;
      }

      .auth-eye-button:active {
        transform: translateY(-50%) scale(0.94) !important;
      }

      .auth-link-button:hover {
        color: #002642 !important;
        text-decoration: underline;
      }

      .auth-submit-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: none;
      }

      .auth-submit-button:active:not(:disabled) {
        transform: translateY(0);
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          animation: none !important;
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setErrorMessage(isForgot ? t.emailRequired : t.requiredFields);
      return false;
    }

    if (isForgot) {
      return true;
    }

    if (!formData.password) {
      setErrorMessage(t.requiredFields);
      return false;
    }

    if (isRegister && !formData.name.trim()) {
      setErrorMessage(t.nameRequired);
      return false;
    }

    if (isRegister && formData.password.length < 8) {
      setErrorMessage(t.passwordTooShort);
      return false;
    }

    if (isRegister && formData.password !== formData.confirmPassword) {
      setErrorMessage(t.passwordMismatch);
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isForgot) {
        const response = await requestPasswordResetRequest(formData.email.trim());
        setSuccessMessage(response?.detail || t.resetEmailSent);
        return;
      }

      if (isLogin) {
        const profile = await login(formData.email.trim(), formData.password);
        navigate(profile.role === 'manager' ? '/manager' : '/employee', { replace: true });
        return;
      }

      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role,
      });

      setSuccessMessage(t.registerSuccess);
      setAuthMode('login');
      setFormData((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
        name: '',
      }));
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, t.authError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchToLogin = () => {
    setAuthMode('login');
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
    });
    setErrorMessage('');
    setSuccessMessage('');
    setShowPassword(false);
    setRole('employee');
  };

  const toggleMode = () => {
    if (isLogin) {
      setAuthMode('register');
    } else {
      switchToLogin();
    }
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
    });
    setErrorMessage('');
    setSuccessMessage('');
    setShowPassword(false);
    setRole('employee');
  };

  const openForgotPassword = () => {
    setAuthMode('forgot');
    setErrorMessage('');
    setSuccessMessage('');
    setShowPassword(false);
  };

  const changeLanguage = () => {
    setLanguage((prev) => {
      const nextLanguage = prev === 'ru' ? 'en' : 'ru';
      localStorage.setItem('language', nextLanguage);
      return nextLanguage;
    });
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const titleText = 'ShiftPlanner';
  const cardLabel = isForgot ? t.forgotTitle : titleText;

  const view = createViewStyles(isCompact, isSubmitting);

  if (isLoading) {
    return <div style={styles.loadingScreen}>{t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      <button type="button" style={view.languageButton} onClick={changeLanguage}>
        {t.langBtn}
      </button>

      <main style={view.content}>
        <section style={view.brandSection}>
          <div style={view.brandTitle}>
            <img src={APP_ICON_SRC} alt="" aria-hidden="true" style={view.brandLogo} />
            <h1 style={view.title}>
              {titleText.slice(0, 5)}
              <span style={styles.titleAccent}>{titleText.slice(5)}</span>
            </h1>
          </div>
        </section>

        <section style={view.card} aria-label={cardLabel}>
          {isRegister && (
            <div style={styles.roleSwitchWrap}>
              <div className={`auth-role-switch ${role === 'manager' ? 'is-manager' : 'is-employee'}`}>
                <button
                  type="button"
                  className={`auth-role-option ${role === 'employee' ? 'active' : ''}`}
                  onClick={() => setRole('employee')}
                >
                  {t.employee}
                </button>

                <button
                  type="button"
                  className={`auth-role-option ${role === 'manager' ? 'active' : ''}`}
                  onClick={() => setRole('manager')}
                >
                  {t.manager}
                </button>
              </div>
            </div>
          )}

          {isForgot && <p style={view.hint}>{t.forgotHint}</p>}

          <form onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <div style={view.inputGroup}>
                <label style={styles.label} htmlFor="auth-name">
                  {t.fullName}
                </label>

                <input
                  id="auth-name"
                  type="text"
                  name="name"
                  style={view.input}
                  placeholder={t.namePlaceholder}
                  value={formData.name}
                  onChange={handleInputChange}
                  autoComplete="name"
                />
              </div>
            )}

            <div style={view.inputGroup}>
              <label style={styles.label} htmlFor="auth-email">
                {t.email}
              </label>

              <input
                id="auth-email"
                type="email"
                name="email"
                style={view.input}
                placeholder={t.emailPlaceholder}
                value={formData.email}
                onChange={handleInputChange}
                autoComplete="email"
              />
            </div>

            {!isForgot && (
              <div style={view.inputGroup}>
                <label style={styles.label} htmlFor="auth-password">
                  {t.password}
                </label>

                <div style={styles.passwordWrapper}>
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    style={view.passwordInput}
                    placeholder={t.passwordPlaceholder}
                    value={formData.password}
                    onChange={handleInputChange}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />

                  <button
                    type="button"
                    className="auth-eye-button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={styles.eyeButton}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>

                {isLogin ? (
                  <button
                    type="button"
                    className="auth-link-button"
                    onClick={openForgotPassword}
                    style={styles.forgotButton}
                  >
                    {t.forgotPassword}
                  </button>
                ) : null}
              </div>
            )}

            {isRegister && (
              <div style={view.inputGroup}>
                <label style={styles.label} htmlFor="auth-confirm-password">
                  {t.confirmPassword}
                </label>

                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  style={view.input}
                  placeholder={t.confirmPasswordPlaceholder}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                />
              </div>
            )}

            {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}
            {successMessage && <div style={styles.successBox}>{successMessage}</div>}

            <button
              type="submit"
              className="auth-submit-button"
              style={view.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t.wait
                : (isForgot ? t.sendResetLink : (isLogin ? t.login : t.register))}
            </button>

            <div style={styles.toggleSection}>
              {isForgot ? (
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="auth-link-button"
                  style={styles.toggleButton}
                >
                  {t.backToLogin}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleMode}
                  className="auth-link-button"
                  style={styles.toggleButton}
                >
                  {isLogin ? t.noAccount : t.hasAccount}
                </button>
              )}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function createViewStyles(isCompact, isSubmitting) {
  return {
    languageButton: {
      position: 'fixed',
      top: isCompact ? '14px' : '22px',
      right: isCompact ? '14px' : '28px',
      zIndex: 10,
      padding: isCompact ? '7px 13px' : '9px 18px',
      borderRadius: '999px',
      border: '1px solid rgba(79, 100, 111, 0.18)',
      background: 'rgba(222, 231, 231, 0.72)',
      color: '#002642',
      fontSize: '14px',
      fontWeight: 700,
      cursor: 'pointer',
      backdropFilter: 'blur(10px)',
    },

    content: {
      minHeight: '100dvh',
      width: '100%',
      boxSizing: 'border-box',
      padding: isCompact ? '18px 16px' : '24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 1,
    },

    brandSection: {
      textAlign: 'center',
      marginBottom: isCompact ? '16px' : '22px',
      animation: 'fadeInUp 0.45s ease',
    },

    brandTitle: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isCompact ? '10px' : '16px',
    },

    brandLogo: {
      width: isCompact ? '78px' : '128px',
      height: isCompact ? '78px' : '128px',
      flexShrink: 0,
      objectFit: 'contain',
    },

    title: {
      margin: 0,
      fontSize: isCompact ? '44px' : '76px',
      lineHeight: 0.95,
      fontWeight: 500,
      letterSpacing: isCompact ? '-2px' : '-4px',
      color: '#002642',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    },

    subtitle: {
      margin: isCompact ? '10px 0 0' : '14px 0 0',
      color: '#4f646f',
      fontSize: isCompact ? '14px' : '16px',
      fontWeight: 500,
    },

    card: {
      width: 'min(100%, 430px)',
      boxSizing: 'border-box',
      padding: isCompact ? '20px 22px' : '26px 30px',
      borderRadius: '14px',
      background: '#ffffff',
      border: '1px solid #dee7e7',
      animation: 'cardIn 0.45s ease',
    },

    hint: {
      margin: isCompact ? '0 0 14px' : '0 0 18px',
      fontSize: '13px',
      color: '#4f646f',
      textAlign: 'center',
      lineHeight: 1.4,
    },

    inputGroup: {
      marginBottom: isCompact ? '12px' : '15px',
    },

    input: {
      width: '100%',
      height: isCompact ? '44px' : '48px',
      padding: '0 15px',
      boxSizing: 'border-box',
      borderRadius: '12px',
      border: '1px solid #dee7e7',
      background: '#f8fbfd',
      color: '#002642',
      caretColor: '#d7adcf',
      fontSize: '16px',
      fontFamily: 'inherit',
      outline: 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    },

    passwordInput: {
      width: '100%',
      height: isCompact ? '44px' : '48px',
      padding: '0 48px 0 15px',
      boxSizing: 'border-box',
      borderRadius: '12px',
      border: '1px solid #dee7e7',
      background: '#f8fbfd',
      color: '#002642',
      caretColor: '#d7adcf',
      fontSize: '16px',
      fontFamily: 'inherit',
      outline: 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    },

    submitButton: {
      width: '100%',
      height: isCompact ? '46px' : '50px',
      marginTop: isCompact ? '2px' : '4px',
      marginBottom: '12px',
      border: 0,
      borderRadius: '16px',
      background: '#002642',
      color: '#f4faff',
      fontSize: '16px',
      fontWeight: 800,
      cursor: isSubmitting ? 'default' : 'pointer',
      opacity: isSubmitting ? 0.72 : 1,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
    },
  };
}

const iconWrapStyle = {
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const iconStyle = {
  color: '#4f646f',
  display: 'block',
};

const styles = {
  container: {
    minHeight: '100dvh',
    position: 'relative',
    overflowX: 'hidden',
    background: '#f4faff',
  },

  loadingScreen: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #002642 0%, #4f646f 100%)',
    color: '#f4faff',
    fontSize: '18px',
  },

  titleAccent: {
    color: '#d7adcf',
  },

  roleSwitchWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },

  label: {
    display: 'block',
    marginBottom: '7px',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: 800,
  },

  passwordWrapper: {
    position: 'relative',
    width: '100%',
  },

  eyeButton: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '34px',
    height: '34px',
    border: 0,
    borderRadius: '10px',
    background: 'transparent',
    color: '#4f646f',
    opacity: 0.72,
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorBox: {
    marginBottom: '12px',
    padding: '11px 13px',
    borderRadius: '14px',
    background: 'rgba(215, 173, 207, 0.34)',
    border: '1px solid rgba(166, 27, 27, 0.16)',
    color: '#8d1d1d',
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1.35,
  },

  successBox: {
    marginBottom: '12px',
    padding: '11px 13px',
    borderRadius: '14px',
    background: 'rgba(244, 250, 255, 0.78)',
    border: '1px solid rgba(79, 100, 111, 0.14)',
    color: '#002642',
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1.35,
  },

  toggleSection: {
    textAlign: 'center',
  },

  forgotButton: {
    marginTop: '8px',
    border: 0,
    background: 'transparent',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
  },

  toggleButton: {
    border: 0,
    background: 'transparent',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '6px 8px',
  },
};

