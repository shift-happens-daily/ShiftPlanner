import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  HeartPulse,
  Menu,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import shiftPlannerLogo from '../assets/logo_noback.svg';
import { ChevronDown } from 'lucide-react';
import '../styles/welcome-page.css';
import {
  getStoredLanguage,
  setStoredLanguage,
} from '../services/language';

const translations = {
  ru: {
    nav: {
      industries: 'Для кого',
      features: 'Возможности',
      why: 'Почему ShiftPlanner',
      how: 'Как это работает',
      benefits: 'Преимущества',
      login: 'Войти',
      start: 'Начать бесплатно',
    },

    hero: {
      eyebrow: 'Умное планирование смен',
      title: 'График работы',
      accent: ' без таблиц, конфликтов и бесконечных сообщений',
      description:
        'ShiftPlanner автоматически создаёт расписание с учётом доступности сотрудников, должностей и требований бизнеса.',
      start: 'Начать бесплатно',
      how: 'Посмотреть, как работает',
      note: 'Бесплатно во время тестирования',
    },

    industries: {
      label: 'Для кого',
      title: 'Подходит командам со сменным графиком',
      description:
        'Для небольших компаний, где важно учитывать доступность сотрудников и быстро закрывать каждую смену.',
    },

    features: {
      label: 'Возможности',
      title: 'Всё необходимое для составления смен',
      description:
        'Доступность, сотрудники и требования к графику находятся в одном понятном рабочем пространстве.',
    },

    why: {
      label: 'Почему ShiftPlanner',
      title: 'Перестаньте пересобирать график каждую неделю',
      description:
        'Замените таблицы, переписки и ручную проверку конфликтов единым процессом.',
    },

    how: {
      label: 'Как это работает',
      title: 'От доступности сотрудников до готового графика',
      description:
        'Настройте компанию один раз и используйте один понятный процесс для каждого нового расписания.',
    },

    benefits: {
      label: 'Преимущества',
      title: 'Один сервис для менеджера и сотрудников',
      managers: 'Для менеджеров',
      managersTitle: 'Меньше времени на ручное управление графиком',
      employees: 'Для сотрудников',
      employeesTitle: 'Понятно, когда и в каком филиале нужно работать',
    },

    cta: {
      title: 'Создайте следующий график за несколько минут',
      description:
        'Добавьте команду, соберите доступность и позвольте ShiftPlanner подготовить расписание для проверки.',
      start: 'Начать бесплатно',
      login: 'Войти',
    },

    footer: {
      description:
        'Планирование смен без таблиц, конфликтов и бесконечных сообщений.',
      copyright: '© 2026 ShiftPlanner',
      team: 'Создано командой ShiftPlanner',
    },
    cards: {
      industries: [
        'Кофейни',
        'Рестораны',
        'Магазины',
        'Клиники',
        'Салоны',
        'Другой сменный бизнес',
      ],

      features: [
        {
          title: 'Автоматическое расписание',
          description:
            'Создавайте смены с учётом доступности сотрудников, позиций и требований каждой смены.',
        },
        {
          title: 'Доступность сотрудников',
          description:
            'Сотрудники самостоятельно указывают дни и время, когда готовы работать.',
        },
        {
          title: 'Контроль покрытия',
          description:
            'Система показывает незакрытые и частично закрытые требования ещё до публикации.',
        },
        {
          title: 'Удобное редактирование',
          description:
            'Проверьте готовый график и внесите необходимые изменения перед публикацией.',
        },
      ],

      problems: [
        {
          title: 'Составление графика занимает часы',
          description:
            'Больше не нужно собирать пожелания в чатах и вручную распределять каждого сотрудника.',
          result: 'График создаётся автоматически.',
        },
        {
          title: 'Пожелания сотрудников теряются',
          description:
            'Вся доступность, должности и рабочие предпочтения находятся в одном месте.',
          result: 'Информация всегда перед глазами.',
        },
        {
          title: 'На сменах не хватает сотрудников',
          description:
            'Сразу видно, для какой позиции и в какое время не хватает людей.',
          result: 'Проблемные смены заметны заранее.',
        },
        {
          title: 'Любое изменение ломает весь график',
          description:
            'Редактируйте отдельные смены без полного пересоздания расписания.',
          result: 'Изменения занимают несколько минут.',
        },
      ],

      steps: [
        {
          title: 'Создайте компанию',
          description: 'Добавьте компанию, филиалы и позиции сотрудников.',
        },
        {
          title: 'Пригласите команду',
          description:
            'Сотрудники присоединяются к компании по инвайт-коду.',
        },
        {
          title: 'Соберите доступность',
          description:
            'Каждый сотрудник отмечает удобные дни и часы работы.',
        },
        {
          title: 'Сформируйте график',
          description:
            'ShiftPlanner распределит сотрудников и покажет незакрытые требования.',
        },
      ],
    },

    benefitItems: {
      managers: [
        'Автоматическая генерация расписания',
        'Контроль незакрытых требований',
        'Управление филиалами и позициями',
        'Редактирование перед публикацией',
      ],
      employees: [
        'Указание личной доступности',
        'Просмотр будущих смен',
        'Вся информация о компании в одном месте',
        'Меньше конфликтов в расписании',
      ],
    },

    preview: {
      board: 'Доска',
      schedule: 'Расписание',
      company: 'Компания',
      shifts: 'Смены',
      reports: 'Отчёты',
      manager: 'Менеджер',
      month: 'Июль 2026',
      generate: 'Сформировать',
      days: ['Пн', 'Вт', 'Ср', 'Чт'],
      generated: 'График сформирован',
      generatedSubtitle: 'Создано 32 смены',
      covered: 'Все смены закрыты',
      coveredSubtitle: 'Конфликтов не найдено',
    },
  },

  en: {
    nav: {
      industries: 'Who it’s for',
      features: 'Features',
      why: 'Why ShiftPlanner',
      how: 'How it works',
      benefits: 'Benefits',
      login: 'Log in',
      start: 'Start for free',
    },

    hero: {
      eyebrow: 'Smart shift planning',
      title: 'Work schedules',
      accent: ' without spreadsheets, conflicts, or endless messages',
      description:
        'ShiftPlanner automatically creates schedules based on employee availability, roles, and business requirements.',
      start: 'Start for free',
      how: 'See how it works',
      note: 'Free during the testing period',
    },

    industries: {
      label: 'Who it’s for',
      title: 'Built for teams working in shifts',
      description:
        'For small businesses that need to account for employee availability and quickly cover every shift.',
    },

    features: {
      label: 'Features',
      title: 'Everything you need to create shift schedules',
      description:
        'Availability, employees, and schedule requirements are kept in one clear workspace.',
    },

    why: {
      label: 'Why ShiftPlanner',
      title: 'Stop rebuilding the schedule every week',
      description:
        'Replace spreadsheets, chat messages, and manual conflict checks with one streamlined process.',
    },

    how: {
      label: 'How it works',
      title: 'From employee availability to a ready schedule',
      description:
        'Set up your company once and use the same clear process for every new schedule.',
    },

    benefits: {
      label: 'Benefits',
      title: 'One service for managers and employees',
      managers: 'For managers',
      managersTitle: 'Spend less time managing schedules manually',
      employees: 'For employees',
      employeesTitle: 'Know when and where you need to work',
    },

    cta: {
      title: 'Create your next schedule in minutes',
      description:
        'Add your team, collect availability, and let ShiftPlanner prepare a schedule for review.',
      start: 'Start for free',
      login: 'Log in',
    },

    footer: {
      description:
        'Shift planning without spreadsheets, conflicts, or endless messages.',
      copyright: '© 2026 ShiftPlanner',
      team: 'Built by the ShiftPlanner team',
    },
    cards: {
      industries: [
        'Coffee shops',
        'Restaurants',
        'Retail stores',
        'Clinics',
        'Salons',
        'Other shift-based business',
      ],

      features: [
        {
          title: 'Automatic scheduling',
          description:
            'Create shifts based on employee availability, roles, and the requirements of each shift.',
        },
        {
          title: 'Employee availability',
          description:
            'Employees specify the days and times when they are available to work.',
        },
        {
          title: 'Coverage control',
          description:
            'The system highlights uncovered and partially covered requirements before publication.',
        },
        {
          title: 'Easy editing',
          description:
            'Review the completed schedule and make any necessary changes before publishing.',
        },
      ],

      problems: [
        {
          title: 'Creating schedules takes hours',
          description:
            'No more collecting preferences in chats or assigning every employee manually.',
          result: 'Schedules are generated automatically.',
        },
        {
          title: 'Employee preferences get lost',
          description:
            'Availability, roles, and work preferences are kept in one place.',
          result: 'Important information is always visible.',
        },
        {
          title: 'Some shifts remain understaffed',
          description:
            'See immediately which role and time period still need more employees.',
          result: 'Problem shifts are visible in advance.',
        },
        {
          title: 'One change breaks the entire schedule',
          description:
            'Edit individual shifts without rebuilding the entire schedule.',
          result: 'Changes take only a few minutes.',
        },
      ],

      steps: [
        {
          title: 'Create your company',
          description: 'Add your company, branches, and employee roles.',
        },
        {
          title: 'Invite your team',
          description: 'Employees join the company using an invite code.',
        },
        {
          title: 'Collect availability',
          description:
            'Each employee marks the days and hours when they can work.',
        },
        {
          title: 'Generate the schedule',
          description:
            'ShiftPlanner assigns employees and highlights uncovered requirements.',
        },
      ],
    },

    benefitItems: {
      managers: [
        'Automatic schedule generation',
        'Control of uncovered requirements',
        'Branch and role management',
        'Editing before publication',
      ],
      employees: [
        'Personal availability settings',
        'View upcoming shifts',
        'All company information in one place',
        'Fewer scheduling conflicts',
      ],
    },

    preview: {
      board: 'Dashboard',
      schedule: 'Schedule',
      company: 'Company',
      shifts: 'Shifts',
      reports: 'Reports',
      manager: 'Manager',
      month: 'July 2026',
      generate: 'Generate',
      days: ['Mon', 'Tue', 'Wed', 'Thu'],
      generated: 'Schedule generated',
      generatedSubtitle: '32 shifts created',
      covered: 'All shifts covered',
      coveredSubtitle: 'No conflicts found',
    },
  },
};

const features = [
  {
    icon: CalendarCheck2,
    title: 'Автоматическое расписание',
    description:
      'Создавайте смены с учётом доступности сотрудников, позиций и требований каждой смены.',
  },
  {
    icon: Users,
    title: 'Доступность сотрудников',
    description:
      'Сотрудники самостоятельно указывают дни и время, когда готовы работать.',
  },
  {
    icon: ShieldCheck,
    title: 'Контроль покрытия',
    description:
      'Система показывает незакрытые и частично закрытые требования ещё до публикации.',
  },
  {
    icon: CalendarDays,
    title: 'Удобное редактирование',
    description:
      'Проверьте готовый график и внесите необходимые изменения перед публикацией.',
  },
];

const problems = [
  {
    icon: Clock3,
    number: '01',
    title: 'Составление графика занимает часы',
    description:
      'Больше не нужно собирать пожелания в чатах и вручную распределять каждого сотрудника.',
    result: 'График создаётся автоматически.',
  },
  {
    icon: Users,
    number: '02',
    title: 'Пожелания сотрудников теряются',
    description:
      'Вся доступность, должности и рабочие предпочтения находятся в одном месте.',
    result: 'Информация всегда перед глазами.',
  },
  {
    icon: ShieldCheck,
    number: '03',
    title: 'На сменах не хватает сотрудников',
    description:
      'Сразу видно, для какой позиции и в какое время не хватает людей.',
    result: 'Проблемные смены заметны заранее.',
  },
  {
    icon: CalendarDays,
    number: '04',
    title: 'Любое изменение ломает весь график',
    description:
      'Редактируйте отдельные смены без полного пересоздания расписания.',
    result: 'Изменения занимают несколько минут.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Создайте компанию',
    description:
      'Добавьте компанию, филиалы и позиции сотрудников.',
  },
  {
    number: '02',
    title: 'Пригласите команду',
    description:
      'Сотрудники присоединяются к компании по инвайт-коду.',
  },
  {
    number: '03',
    title: 'Соберите доступность',
    description:
      'Каждый сотрудник отмечает удобные дни и часы работы.',
  },
  {
    number: '04',
    title: 'Сформируйте график',
    description:
      'ShiftPlanner распределит сотрудников и покажет незакрытые требования.',
  },
];

const industries = [
  {
    icon: Coffee,
    title: 'Кофейни',
  },
  {
    icon: Store,
    title: 'Рестораны',
  },
  {
    icon: ShoppingBag,
    title: 'Магазины',
  },
  {
    icon: HeartPulse,
    title: 'Клиники',
  },
  {
    icon: Sparkles,
    title: 'Салоны',
  },
  {
    icon: Building2,
    title: 'Другой сменный бизнес',
  },
];

function SchedulePreview({ t }) {
  return (
    <div className="welcome-preview">
      <div className="welcome-preview-window">
        <div className="welcome-app-header">
          <div className="welcome-app-brand">
            <img
              src={shiftPlannerLogo}
              alt="ShiftPlanner"
              className="welcome-app-logo"
            />
          </div>

          <nav className="welcome-app-tabs">
            <span className="active">{t.preview.board}</span>
            <span>{t.preview.schedule}</span>
            <span>{t.preview.company}</span>
            <span>{t.preview.shifts}</span>
            <span>{t.preview.reports}</span>
          </nav>

          <div className="welcome-app-user">
            <span className="welcome-app-user-avatar">НШ</span>

            <div>
              <strong>Никола Шилоу</strong>
              <small>{t.preview.manager}</small>
            </div>

            <ChevronDown className="welcome-app-user-arrow" size={14} />
          </div>
        </div>

        <div className="welcome-preview-content">
          <div className="welcome-preview-heading">
            <div>
              <span>{t.preview.schedule}</span>
              <strong>{t.preview.month}</strong>
            </div>

            <button type="button">{t.preview.generate}</button>
          </div>

          <div className="welcome-preview-calendar">
            <div className="welcome-calendar-header">
              <span />

              {t.preview.days.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="welcome-calendar-row">
              <div className="welcome-employee">
                <span className="welcome-employee-avatar">МК</span>

                <div>
                  <strong>Мария К.</strong>
                  <small>Бариста</small>
                </div>
              </div>

              <div className="welcome-shift-cell">
                <span className="welcome-shift blue">08:00–16:00</span>
              </div>

              <div className="welcome-shift-cell">
                <span className="welcome-shift blue">08:00–16:00</span>
              </div>

              <div className="welcome-shift-cell" />

              <div className="welcome-shift-cell">
                <span className="welcome-shift green">10:00–18:00</span>
              </div>
            </div>

            <div className="welcome-calendar-row">
              <div className="welcome-employee">
                <span className="welcome-employee-avatar light">ТК</span>

                <div>
                  <strong>Том К.</strong>
                  <small>Старший бариста</small>
                </div>
              </div>

              <div className="welcome-shift-cell" />

              <div className="welcome-shift-cell">
                <span className="welcome-shift purple">12:00–20:00</span>
              </div>

              <div className="welcome-shift-cell">
                <span className="welcome-shift purple">12:00–20:00</span>
              </div>

              <div className="welcome-shift-cell">
                <span className="welcome-shift purple">12:00–20:00</span>
              </div>
            </div>

            <div className="welcome-calendar-row">
              <div className="welcome-employee">
                <span className="welcome-employee-avatar green">ЛС</span>

                <div>
                  <strong>Лиза С.</strong>
                  <small>Кассир</small>
                </div>
              </div>

              <div className="welcome-shift-cell">
                <span className="welcome-shift green">09:00–17:00</span>
              </div>

              <div className="welcome-shift-cell" />

              <div className="welcome-shift-cell">
                <span className="welcome-shift green">09:00–17:00</span>
              </div>

              <div className="welcome-shift-cell">
                <span className="welcome-shift green">09:00–17:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="welcome-floating-card top">
        <span className="welcome-floating-icon blue">
          <CalendarCheck2 size={18} />
        </span>

        <div>
          <strong>{t.preview.generated}</strong>
          <small>{t.preview.generatedSubtitle}</small>
        </div>
      </div>

      <div className="welcome-floating-card bottom">
        <span className="welcome-floating-icon green">
          <CheckCircle2 size={18} />
        </span>

        <div>
          <strong>{t.preview.covered}</strong>
          <small>{t.preview.coveredSubtitle}</small>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setLanguage] = useState(getStoredLanguage);

  const t = translations[language];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = () => {
    const nextLanguage = language === 'ru' ? 'en' : 'ru';

    setStoredLanguage(nextLanguage);
    setLanguage(nextLanguage);
    setMenuOpen(false);
  };

  return (
    <div className="welcome-page">
      <header className="welcome-header">
        <div className="welcome-container welcome-header-inner">
          <Link to="/" className="welcome-logo">
            <img
              src={shiftPlannerLogo}
              alt=""
              aria-hidden="true"
              className="welcome-logo-image"
            />

            <span className="welcome-logo-text">
              <span className="welcome-logo-dark">Shift</span>
              <span className="welcome-logo-pink">Planner</span>
            </span>
          </Link>

          <nav className={`welcome-nav ${menuOpen ? 'open' : ''}`}>
            <a href="#industries" onClick={() => setMenuOpen(false)}>
              {t.nav.industries}
            </a>

            <a href="#features" onClick={() => setMenuOpen(false)}>
              {t.nav.features}
            </a>

            <a href="#why" onClick={() => setMenuOpen(false)}>
              {t.nav.why}
            </a>

            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
              {t.nav.how}
            </a>

            <a href="#benefits" onClick={() => setMenuOpen(false)}>
              {t.nav.benefits}
            </a>
          </nav>

          <div className="welcome-header-actions">
            <button
              type="button"
              className="welcome-language-button"
              onClick={changeLanguage}
              aria-label={language === 'ru' ? 'Switch to English' : 'Переключить на русский'}
            >
              {language === 'ru' ? 'EN' : 'RU'}
            </button>
            <Link to="/auth?mode=login" className="welcome-login-link">
              {t.nav.login}
            </Link>

            <Link
              to="/auth?mode=register"
              className="welcome-button welcome-button-primary small"
            >
              {t.nav.start}
            </Link>

            <button
                type="button"
                className="welcome-menu-button"
                aria-label="Открыть меню"
                onClick={() => setMenuOpen((current) => !current)}
            >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="welcome-hero">
          <div className="welcome-container welcome-hero-grid">
            <div className="welcome-hero-copy">
              <div className="welcome-eyebrow">
                <Sparkles size={15} />
                {t.hero.eyebrow}
              </div>

              <h1>
                {t.hero.title}
                <span>{t.hero.accent}</span>
              </h1>

              <p>{t.hero.description}</p>

              <div className="welcome-hero-actions">
                <Link to="/auth?mode=register" className="welcome-button welcome-button-primary">
                  {t.hero.start}
                  <ArrowRight size={18} />
                </Link>

                <a
                  href="#how-it-works"
                  className="welcome-button welcome-button-secondary"
                >
                  {t.hero.how}
                </a>
              </div>

              <div className="welcome-hero-notes">
                <span>
                  <Check size={16} />
                  {t.hero.note}
                </span>
              </div>
            </div>

            <SchedulePreview t={t} />
          </div>
        </section>

        <section
          className="welcome-industry-section"
          id="industries"
        >
          <div className="welcome-container">
            <div className="welcome-section-heading">
              <span>{t.industries.label}</span>
              <h2>{t.industries.title}</h2>
              <p>{t.industries.description}</p>
            </div>

            <div className="welcome-industry-list">
              {industries.map(({ icon: Icon }, index) => {
                const title = t.cards.industries[index];

                return (
                  <div className="welcome-industry-item" key={title}>
                    <span className="welcome-industry-item-icon">
                      <Icon size={18} />
                    </span>

                    <span>{title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="welcome-section" id="features">
          <div className="welcome-container">
            <div className="welcome-section-heading">
              <span>{t.features.label}</span>
              <h2>{t.features.title}</h2>
              <p>{t.features.description}</p>
            </div>

            <div className="welcome-feature-grid">
              {features.map(({ icon: Icon }, index) => {
                const item = t.cards.features[index];

                return (
                  <article className="welcome-feature-card" key={item.title}>
                    <span className="welcome-feature-icon">
                      <Icon size={22} />
                    </span>

                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="welcome-section welcome-muted"
          id="why"
        >
          <div className="welcome-container">
            <div className="welcome-section-heading welcome-problem-heading">
              <span>{t.why.label}</span>
              <h2>{t.why.title}</h2>
              <p>{t.why.description}</p>
            </div>

            <div className="welcome-problem-grid">
              {problems.map(({ icon: Icon, number }, index) => {
                const item = t.cards.problems[index];

                return (
                  <article className="welcome-problem-card" key={number}>
                    <span className="welcome-problem-icon">
                      <Icon size={22} />
                    </span>

                    <h3>{item.title}</h3>
                    <p>{item.description}</p>

                    <div className="welcome-problem-result">
                      <CheckCircle2 size={18} />
                      <span>{item.result}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="welcome-section" id="how-it-works">
          <div className="welcome-container">
            <div className="welcome-section-heading">
              <span>{t.how.label}</span>
              <h2>{t.how.title}</h2>
              <p>{t.how.description}</p>
            </div>

            <div className="welcome-step-grid">
              {steps.map((step, index) => {
                const item = t.cards.steps[index];

                return (
                  <article className="welcome-step-card" key={step.number}>
                    <span className="welcome-step-number">{step.number}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>


        <section className="welcome-section" id="benefits">
          <div className="welcome-container">
            <div className="welcome-section-heading">
              <span>{t.benefits.label}</span>
              <h2>{t.benefits.title}</h2>
            </div>

            <div className="welcome-benefit-grid">
              <article className="welcome-benefit-card dark">
                <span className="welcome-benefit-icon">
                  <Building2 size={24} />
                </span>

                <p className="welcome-benefit-label">
                {t.benefits.managers}
                </p>
                <h3>{t.benefits.managersTitle}</h3>

                <ul>
                  {t.benefitItems.managers.map((item) => (
                    <li key={item}>
                      <Check size={17} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="welcome-benefit-card">
                <span className="welcome-benefit-icon light">
                  <Users size={24} />
                </span>

                <p className="welcome-benefit-label">
                {t.benefits.employees}
                </p>
                <h3>{t.benefits.employeesTitle}</h3>

                <ul>
                  {t.benefitItems.employees.map((item) => (
                    <li key={item}>
                      <Check size={17} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="welcome-cta-section">
          <div className="welcome-container">
            <div className="welcome-cta">
              <span className="welcome-cta-icon">
                <Clock3 size={24} />
              </span>

              <h2>{t.cta.title}</h2>

              <p>{t.cta.description}</p>

              <div>
                <Link to="/auth?mode=register" className="welcome-button welcome-button-white">
                  {t.hero.start}
                  <ArrowRight size={18} />
                </Link>

                <Link
                  to="/auth?mode=login"
                  className="welcome-button welcome-button-outline"
                >
                  {t.cta.login}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <div className="welcome-container welcome-footer-main">
          <div>
            <Link to="/" className="welcome-logo">
              <img
                src={shiftPlannerLogo}
                alt=""
                aria-hidden="true"
                className="welcome-logo-image"
              />

              <span className="welcome-logo-text">
                <span className="welcome-logo-dark">Shift</span>
                <span className="welcome-logo-pink">Planner</span>
              </span>
            </Link>

            <p>{t.footer.description}</p>
          </div>

          <div className="welcome-footer-links">
            <a href="#industries">{t.nav.industries}</a>
            <a href="#features">{t.nav.features}</a>
            <a href="#why">{t.nav.why}</a>
            <a href="#how-it-works">{t.nav.how}</a>
            <a href="#benefits">{t.nav.benefits}</a>
            <Link to="/auth?mode=login">{t.nav.login}</Link>
          </div>
        </div>

        <div className="welcome-container welcome-footer-bottom">
          <span>{t.footer.copyright}</span>
          <span>{t.footer.team}</span>
        </div>
      </footer>
    </div>
  );
}