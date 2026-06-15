import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getStoredLanguage } from '../services/language';

function EyeIcon() {
  return (
    <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4F646F', display: 'block' }}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </div>
  );
}

function EyeOffIcon() {
  return (
    <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4F646F', display: 'block' }}>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    </div>
  );
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('employee');
  const [isMobile, setIsMobile] = useState(false);
  const [language, setLanguage] = useState(getStoredLanguage);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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
      welcomeBack: 'Вход в ShiftPlanner',
      createAccount: 'Регистрация аккаунта',
      fullName: 'Имя и фамилия',
      email: 'Email',
      password: 'Пароль',
      employee: 'Сотрудник',
      manager: 'Менеджер',
      login: 'Войти',
      register: 'Зарегистрироваться',
      noAccount: 'Нет аккаунта? Зарегистрироваться',
      hasAccount: 'Уже есть аккаунт? Войти',
      namePlaceholder: 'Иван Петров',
      emailPlaceholder: 'ivan@example.com',
      passwordPlaceholder: 'Минимум 8 символов',
      loginHint: 'Роль определяется сервером после входа.',
      registerHint: 'Выберите роль только для регистрации.',
      requiredFields: 'Заполните email и пароль.',
      nameRequired: 'Укажите имя и фамилию.',
      registerSuccess: 'Аккаунт создан. Выполняю вход...',
      authError: 'Не удалось выполнить запрос.',
    },
    en: {
      langBtn: 'EN',
      welcomeBack: 'Sign in to ShiftPlanner',
      createAccount: 'Create an account',
      fullName: 'Full name',
      email: 'Email',
      password: 'Password',
      employee: 'Employee',
      manager: 'Manager',
      login: 'Login',
      register: 'Sign up',
      noAccount: "Don't have an account? Sign up",
      hasAccount: 'Already have an account? Login',
      namePlaceholder: 'Ivan Petrov',
      emailPlaceholder: 'ivan@example.com',
      passwordPlaceholder: 'At least 8 characters',
      loginHint: 'The backend decides your role after login.',
      registerHint: 'Choose a role only for registration.',
      requiredFields: 'Enter email and password.',
      nameRequired: 'Enter your full name.',
      registerSuccess: 'Account created. Signing in...',
      authError: 'Request failed.',
    },
  };

  const t = texts[language];

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 480);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(40px); }
        to { opacity: 1; transform: translateY(0); }
      }
      input, input:focus, input:active {
        color: #4F646F !important;
        caret-color: #B7ADCF !important;
      }
      input::placeholder {
        color: #999 !important;
        opacity: 1 !important;
      }
      input:focus {
        border-color: #B7ADCF !important;
        box-shadow: 0 0 0 3px rgba(183,173,207,0.2) !important;
        outline: none;
      }
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 30px #DEE7E7 inset !important;
        -webkit-text-fill-color: #4F646F !important;
      }
      .role-switch {
        position: relative;
        display: inline-flex;
        background: #DEE7E7;
        border-radius: 40px;
        padding: 4px;
      }
      .role-option {
        padding: 8px 20px;
        border-radius: 32px;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.3s ease;
        z-index: 1;
        background: transparent;
        border: none;
        cursor: pointer;
      }
      .role-option.active {
        background: #F4FAFF;
        color: #002642;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .role-option:not(.active) {
        color: #4F646F;
      }
      .eye-button {
        transition: transform 0.05s ease !important;
        will-change: transform !important;
      }
      .eye-button:active {
        transform: scale(0.96) !important;
        transition: transform 0.02s ease !important;
      }
      @media (max-width: 480px) {
        button:active { transform: scale(0.97) !important; }
        .role-option {
          padding: 6px 16px;
          font-size: 13px;
        }
      }
      @media (min-width: 481px) {
        button:hover { transform: translateY(-2px); }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!formData.email.trim() || !formData.password) {
      setErrorMessage(t.requiredFields);
      return;
    }

    if (!isLogin && !formData.name.trim()) {
      setErrorMessage(t.nameRequired);
      return;
    }

    setIsSubmitting(true);

    try {
      const profile = isLogin
        ? await login(formData.email.trim(), formData.password)
        : await register({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role,
        });

      if (!isLogin) {
        setSuccessMessage(t.registerSuccess);
      }

      navigate(profile.role === 'manager' ? '/manager' : '/employee', { replace: true });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, t.authError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    setFormData({ email: '', password: '', name: '' });
    setErrorMessage('');
    setSuccessMessage('');
    setShowPassword(false);
    setRole('employee');
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const responsiveStyles = {
    title: {
      fontSize: isMobile ? '42px' : '80px',
      fontWeight: '200',
      fontStyle: 'italic',
      background: 'linear-gradient(135deg, #F4FAFF 0%, #DEE7E7 30%, #B7ADCF 70%, #4F646F 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      margin: '0 0 8px 0',
      padding: 0,
      letterSpacing: '-0.5px',
      fontFamily: "'Poppins', sans-serif",
      lineHeight: '1.2',
      display: 'inline-block',
      maxWidth: '100%',
    },
    card: {
      background: '#DEE7E7',
      borderRadius: isMobile ? '24px' : '32px',
      padding: isMobile ? '24px 20px' : '32px 28px',
      width: '100%',
      maxWidth: '420px',
      boxSizing: 'border-box',
      boxShadow: isMobile ? '0 10px 30px rgba(0,0,0,0.12)' : '0 20px 40px rgba(0,0,0,0.1)',
      animation: 'slideUp 0.5s ease',
    },
    languageButton: {
      position: 'absolute',
      top: isMobile ? '12px' : '20px',
      right: isMobile ? '12px' : '20px',
      zIndex: 10,
    },
    input: {
      width: '100%',
      padding: '14px 16px',
      fontSize: '16px',
      color: '#4F646F',
      caretColor: '#B7ADCF',
      backgroundColor: '#F4FAFF',
      border: '2px solid #B7ADCF',
      borderRadius: '14px',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    passwordWrapper: {
      position: 'relative',
      width: '100%',
    },
    passwordInput: {
      width: '100%',
      padding: '14px 16px',
      paddingRight: '48px',
      fontSize: '16px',
      color: '#4F646F',
      caretColor: '#B7ADCF',
      backgroundColor: '#F4FAFF',
      border: '2px solid #B7ADCF',
      borderRadius: '14px',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    eyeButton: {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.6,
      borderRadius: '8px',
      color: '#4F646F',
    },
    submitBtn: {
      width: '100%',
      padding: '14px',
      fontSize: '16px',
      fontWeight: '600',
      color: '#F4FAFF',
      background: 'linear-gradient(135deg, #002642 0%, #4F646F 100%)',
      border: 'none',
      borderRadius: '14px',
      cursor: isSubmitting ? 'default' : 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      marginBottom: '20px',
      opacity: isSubmitting ? 0.8 : 1,
    },
  };

  if (isLoading) {
    return <div style={styles.loadingScreen}>{language === 'en' ? 'Loading...' : 'Загрузка...'}</div>;
  }

  return (
    <div style={styles.container}>
      <div style={responsiveStyles.languageButton}>
        <button
          style={styles.langBtn}
          onClick={() => setLanguage((prev) => {
            const nextLanguage = prev === 'ru' ? 'en' : 'ru';
            localStorage.setItem('language', nextLanguage);
            return nextLanguage;
          })}
        >
          {t.langBtn}
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.logoSection}>
          <h1 style={responsiveStyles.title}>ShiftPlanner</h1>
          <p style={styles.subtitle}>
            {isLogin ? t.welcomeBack : t.createAccount}
          </p>
        </div>

        <div style={responsiveStyles.card}>
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div style={styles.roleSwitchWrap}>
                <div className="role-switch">
                  <button
                    type="button"
                    className={`role-option ${role === 'employee' ? 'active' : ''}`}
                    onClick={() => setRole('employee')}
                  >
                    {t.employee}
                  </button>
                  <button
                    type="button"
                    className={`role-option ${role === 'manager' ? 'active' : ''}`}
                    onClick={() => setRole('manager')}
                  >
                    {t.manager}
                  </button>
                </div>
              </div>
            )}

            <p style={styles.hint}>{isLogin ? t.loginHint : t.registerHint}</p>

            {!isLogin && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>{t.fullName}</label>
                <input
                  type="text"
                  name="name"
                  style={responsiveStyles.input}
                  placeholder={t.namePlaceholder}
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}

            <div style={styles.inputGroup}>
              <label style={styles.label}>{t.email}</label>
              <input
                type="email"
                name="email"
                style={responsiveStyles.input}
                placeholder={t.emailPlaceholder}
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>{t.password}</label>
              <div style={responsiveStyles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  style={responsiveStyles.passwordInput}
                  placeholder={t.passwordPlaceholder}
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
                <button
                  type="button"
                  className="eye-button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={responsiveStyles.eyeButton}
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}
            {successMessage && <div style={styles.successBox}>{successMessage}</div>}

            <button type="submit" style={responsiveStyles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? '...' : isLogin ? t.login : t.register}
            </button>

            <div style={styles.toggleSection}>
              <button type="button" onClick={toggleMode} style={styles.toggleBtn}>
                {isLogin ? t.noAccount : t.hasAccount}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #002642 0%, #4F646F 100%)',
    position: 'relative',
    overflowX: 'hidden',
  },
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #002642 0%, #4F646F 100%)',
    color: '#F4FAFF',
    fontSize: '18px',
  },
  langBtn: {
    background: 'rgba(244,250,255,0.2)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(244,250,255,0.3)',
    padding: '8px 16px',
    borderRadius: '20px',
    color: '#F4FAFF',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: '100vh',
    padding: '24px',
    paddingTop: '60px',
    position: 'relative',
    zIndex: 1,
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '30px',
    animation: 'fadeInUp 0.6s ease',
  },
  subtitle: {
    fontSize: 'clamp(14px, 4vw, 16px)',
    color: 'rgba(244,250,255,0.9)',
    margin: 0,
  },
  roleSwitchWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  hint: {
    margin: '0 0 16px',
    fontSize: '13px',
    color: '#4F646F',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#4F646F',
    marginBottom: '8px',
  },
  errorBox: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#FDEAEA',
    color: '#A61B1B',
    fontSize: '14px',
  },
  successBox: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#E7F6EC',
    color: '#17663A',
    fontSize: '14px',
  },
  toggleSection: {
    textAlign: 'center',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#4F646F',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    padding: '8px',
    transition: 'color 0.2s ease',
  },
};
