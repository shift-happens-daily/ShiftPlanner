import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getEmployeeAvailability,
  getMyAbsences,
} from '../../services/employeeService';
import { extractApiErrorMessage } from '../../services/error';
import { getMyReport } from '../../services/reportService';
import {
  formatLocalDate,
  getWeekPeriodRange,
  getMySchedule,
  snapToMonday,
} from '../../services/scheduleService';
import { getBranchLabel, getPositionLabel, getEmployeePositionLabel } from '../../utils/employeeDisplay';
import {
  formatApiDateRange,
  formatLocalizedDate,
  getDateLocale,
} from '../../utils/dateDisplay';
import '../../styles/employee-dashboard.css';

const PERIOD_WEEKS = [1, 2, 4];

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

function formatShiftTimeRange(shift) {
  const start = formatTime(shift?.start_time);
  const end = formatTime(shift?.end_time);
  if (!start || !end) return '—';
  return `${start} – ${end}`;
}

function getShiftHours(shift) {
  const startParts = String(shift?.start_time || '').split(':').map(Number);
  const endParts = String(shift?.end_time || '').split(':').map(Number);
  if (startParts.length < 2 || endParts.length < 2) return 0;
  const startMinutes = (startParts[0] * 60) + (startParts[1] || 0);
  const endMinutes = (endParts[0] * 60) + (endParts[1] || 0);
  const duration = endMinutes - startMinutes;
  return duration > 0 ? duration / 60 : 0;
}

function getShiftDateKey(shift) {
  return String(shift?.date || shift?.shift_date || '').slice(0, 10);
}

function getShiftBranch(shift, user) {
  return getBranchLabel(
    shift?.branch_name || shift?.branch?.name || user?.branch?.name || user?.branch_name,
    '—',
  );
}

function getShiftPosition(shift, user) {
  const fallback = getEmployeePositionLabel(user, '—');
  return getPositionLabel({
    position_id: shift?.position_id || shift?.position?.id,
    position_title: shift?.position_title || shift?.position_name || shift?.position,
    title: typeof shift?.position === 'string' ? shift.position : undefined,
    name: shift?.position?.name,
    position: typeof shift?.position === 'object' ? shift.position : undefined,
  }, fallback);
}

function getGreeting(language) {
  const hour = new Date().getHours();
  if (language === 'ru') {
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  }
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatLongDate(dateKey, language) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return formatLocalizedDate(dateKey, language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShiftDateLabel(dateKey, language) {
  const todayKey = formatLocalDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = formatLocalDate(tomorrow);

  if (dateKey === todayKey) {
    return language === 'ru' ? 'Сегодня' : 'Today';
  }
  if (dateKey === tomorrowKey) {
    return language === 'ru' ? 'Завтра' : 'Tomorrow';
  }

  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return formatLocalizedDate(dateKey, language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function countUpcomingAbsences(absences, period) {
  return absences.filter((item) => {
    const endDate = String(item?.end_date || '').slice(0, 10);
    const startDate = String(item?.start_date || '').slice(0, 10);
    if (!endDate || endDate < period.start_date) return false;
    if (startDate && startDate > period.end_date) return false;
    return true;
  }).length;
}

function isDateWithinPeriod(dateKey, period) {
  if (!dateKey || !period?.start_date || !period?.end_date) return false;
  return dateKey >= period.start_date && dateKey <= period.end_date;
}

function formatPeriodRange(period) {
  return formatApiDateRange(period.start_date, period.end_date);
}
function getAvailabilityIntervals(value) {
  if (Array.isArray(value)) return value;

  const weekly = Array.isArray(value?.weekly_availability)
    ? value.weekly_availability
    : [];

  const daily = Array.isArray(value?.daily_availability)
    ? value.daily_availability
    : [];

  if (weekly.length > 0 || daily.length > 0) {
    return [...daily, ...weekly];
  }

  if (Array.isArray(value?.availability)) return value.availability;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;

  return [];
}

function timeToMinutes(value) {
  if (typeof value === 'number') {
    return value * 30;
  }

  const [hours, minutes] = String(value || '')
    .slice(0, 5)
    .split(':')
    .map(Number);

  if (!Number.isFinite(hours)) return null;

  return (hours * 60) + (Number.isFinite(minutes) ? minutes : 0);
}

function getIntervalStartMinutes(interval) {
  if (interval?.start_slot != null) {
    return Number(interval.start_slot) * 30;
  }

  return timeToMinutes(
    interval?.start_time
    ?? interval?.start
    ?? interval?.from,
  );
}

function getIntervalEndMinutes(interval) {
  if (interval?.end_slot != null) {
    return Number(interval.end_slot) * 30;
  }

  return timeToMinutes(
    interval?.end_time
    ?? interval?.end
    ?? interval?.to,
  );
}

function getIntervalDateKey(interval) {
  return String(
    interval?.date
    ?? interval?.availability_date
    ?? interval?.day_date
    ?? '',
  ).slice(0, 10);
}

function getIntervalWeekday(interval) {
  const value = interval?.weekday
    ?? interval?.day_of_week
    ?? interval?.week_day
    ?? interval?.day;

  const numericValue = Number(value);

  if (Number.isInteger(numericValue)) {
    return numericValue;
  }

  return null;
}

function normalizeAvailabilityStatus(interval) {
  const value = String(
    interval?.status
    ?? interval?.availability_status
    ?? interval?.type
    ?? '',
  ).toLowerCase();

  if (
    value === 'if_needed'
    || value === 'maybe'
    || value === 'possible'
  ) {
    return 'if_needed';
  }

  if (
    value === 'unavailable'
    || value === 'not_available'
    || interval?.is_available === false
  ) {
    return 'unavailable';
  }

  return 'available';
}

function formatAvailabilityRange(interval) {
  const startMinutes = getIntervalStartMinutes(interval);
  const endMinutes = getIntervalEndMinutes(interval);

  if (startMinutes == null || endMinutes == null) {
    return '';
  }

  const formatMinutes = (minutes) => {
    const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mins = String(minutes % 60).padStart(2, '0');
    return `${hours}:${mins}`;
  };

  return `${formatMinutes(startMinutes)}–${formatMinutes(endMinutes)}`;
}

function getCurrentAvailabilityStatus(availability, now, language) {
  const intervals = getAvailabilityIntervals(availability);

  const mondayBasedWeekday = (now.getDay() + 6) % 7;
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  // Если доступность вообще не заполнена — по условию считаем сотрудника доступным.
  if (intervals.length === 0) {
    return {
      key: 'available',
      value: language === 'ru' ? 'Доступен' : 'Available',
      sub: language === 'ru'
        ? 'Доступность не задана'
        : 'Availability is not set',
      tone: 'green',
      icon: IconCheck,
    };
  }

  const todayKey = formatLocalDate(now);

  const todayIntervals = intervals.filter((interval) => {
    const dateKey = getIntervalDateKey(interval);

    if (dateKey) {
      return dateKey === todayKey;
    }

    const weekday = getIntervalWeekday(interval);
    return weekday == null || weekday === mondayBasedWeekday;
  });

  // Если на сегодня доступность вообще не задана, по умолчанию считаем сотрудника доступным.
  if (todayIntervals.length === 0) {
    return {
      key: 'available',
      value: language === 'ru' ? 'Доступен' : 'Available',
      sub: language === 'ru'
        ? 'На сегодня доступность не задана'
        : 'Availability is not set for today',
      tone: 'green',
      icon: IconCheck,
    };
  }

  const currentInterval = todayIntervals.find((interval) => {
    const startMinutes = getIntervalStartMinutes(interval);
    const endMinutes = getIntervalEndMinutes(interval);

    if (startMinutes == null || endMinutes == null) {
      return false;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });

  // На сегодня интервалы есть, но текущее время не входит ни в один из них.
  if (!currentInterval) {
    return {
      key: 'unavailable',
      value: language === 'ru' ? 'Недоступен' : 'Unavailable',
      sub: language === 'ru'
        ? 'Сейчас вне доступных интервалов'
        : 'Currently outside available intervals',
      tone: 'red',
      icon: IconX,
    };
  }

  const status = normalizeAvailabilityStatus(currentInterval);
  const range = formatAvailabilityRange(currentInterval);

  if (status === 'if_needed') {
    return {
      key: 'if_needed',
      value: language === 'ru' ? 'Возможно' : 'If needed',
      sub: range,
      tone: 'amber',
      icon: IconAlert,
    };
  }

  if (status === 'unavailable') {
    return {
      key: 'unavailable',
      value: language === 'ru' ? 'Недоступен' : 'Unavailable',
      sub: range,
      tone: 'red',
      icon: IconX,
    };
  }

  return {
    key: 'available',
    value: language === 'ru' ? 'Доступен' : 'Available',
    sub: range,
    tone: 'green',
    icon: IconCheck,
  };
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 16L10 10L14 14L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 6H20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9 9L15 15M15 9L9 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21S6 14.5 6 10a6 6 0 1 1 12 0c0 4.5-6 11-6 11Z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function EmployeeDashboardTab({ language = 'ru', user, onNavigateTab }) {
  const [weeks, setWeeks] = useState(1);
  const [shifts, setShifts] = useState([]);
  const [reportHours, setReportHours] = useState(null);
  const [absences, setAbsences] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const texts = {
    ru: {
      dashboard: 'Доска',
      upcomingShifts: 'Предстоящие смены',
      oneWeek: '1 неделя',
      twoWeeks: '2 недели',
      fourWeeks: '4 недели',
      noShiftsTitle: 'Нет смен',
      noShiftsText: 'На выбранный период смен пока нет. Проверьте позже или свяжитесь с менеджером.',
      today: 'Сегодня',
      todayOff: 'Сегодня смен нет',
      quickActions: 'Быстрые действия',
      changeAvailability: 'Изменить доступность',
      requestAbsence: 'Запросить отсутствие',
      viewSchedule: 'Открыть расписание',
      viewReports: 'Открыть отчёты',
      hoursInPeriod: 'Часов за период',
      ofScheduled: 'по расписанию',
      shiftsCount: 'Смен за период',
      upcomingAbsences: 'Предст. отсутствия',
      requests: 'заявок',
      status: 'Статус',
      available: 'Доступен',
      ifNeeded: 'Возможно',
      unavailable: 'Недоступен',
      waitingApproval: 'Ожидает подтверждения',
      loading: 'Загрузка…',
      salaryEstimate: 'Оценка зарплаты',
      forPeriod: 'за период',
    },
    en: {
      dashboard: 'Dashboard',
      upcomingShifts: 'Upcoming Shifts',
      oneWeek: '1 week',
      twoWeeks: '2 weeks',
      fourWeeks: '4 weeks',
      noShiftsTitle: 'No shifts scheduled',
      noShiftsText: 'You have no shifts for this period. Check back later or contact your manager.',
      today: 'Today',
      todayOff: 'No shift today',
      quickActions: 'Quick Actions',
      changeAvailability: 'Change Availability',
      requestAbsence: 'Request Absence',
      viewSchedule: 'Open Schedule',
      viewReports: 'View Reports',
      hoursInPeriod: 'Hours in period',
      ofScheduled: 'scheduled',
      shiftsCount: 'Shifts in period',
      upcomingAbsences: 'Upcoming absences',
      requests: 'requests',
      status: 'Status',
      available: 'Available',
      ifNeeded: 'If needed',
      unavailable: 'Unavailable',
      waitingApproval: 'Waiting for approval',
      loading: 'Loading…',
      salaryEstimate: 'Salary estimate',
      forPeriod: 'for period',
    },
  };

  const t = texts[language] || texts.ru;
  const fullName = user?.fullName || user?.full_name || user?.name || '';
  const firstName = fullName.trim().split(/\s+/)[0] || fullName || (language === 'ru' ? 'коллега' : 'there');

  const period = useMemo(() => {
    const monday = snapToMonday(formatLocalDate(new Date()));
    return getWeekPeriodRange(monday, weeks);
  }, [weeks]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setShifts([]);
    setReportHours(null);
    try {
      const employeeId = user?.employeeId
        ?? user?.employee_id
        ?? user?.employee?.id;

      const [shiftsData, reportData, absencesData, availabilityData] =
        await Promise.all([
          getMySchedule({
            date_from: period.start_date,
            date_to: period.end_date,
          }),
          getMyReport({
            start_date: period.start_date,
            end_date: period.end_date,
          }).catch(() => null),
          getMyAbsences().catch(() => []),
          employeeId
            ? getEmployeeAvailability(employeeId).catch(() => [])
            : Promise.resolve([])
        ]);

      const normalizedShifts = normalizeArray(shiftsData).filter((shift) => (
        isDateWithinPeriod(getShiftDateKey(shift), period)
      ));
      setShifts(normalizedShifts);
      setReportHours(reportData?.total_hours ?? null);
      setAbsences(normalizeArray(absencesData));
      setAvailability(availabilityData || []);
    } catch (loadError) {
      setError(extractApiErrorMessage(loadError, t.loading, language));
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    language,
    period,
    t.loading,
    user?.employeeId,
    user?.employee_id,
    user?.employee?.id,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);
  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const periodShifts = useMemo(() => (
    shifts
      .filter((shift) => isDateWithinPeriod(getShiftDateKey(shift), period))
      .sort((left, right) => {
        const leftDate = getShiftDateKey(left);
        const rightDate = getShiftDateKey(right);
        if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
        return formatTime(left.start_time).localeCompare(formatTime(right.start_time));
      })
  ), [period.end_date, period.start_date, shifts]);

  const totalHours = useMemo(() => {
    const computed = periodShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    if (reportHours != null && Number.isFinite(Number(reportHours))) {
      return Number(reportHours);
    }
    return computed;
  }, [periodShifts, reportHours]);

  const todayKey = formatLocalDate(new Date());
  const todayShift = periodShifts.find((shift) => getShiftDateKey(shift) === todayKey) || null;
  const upcomingAbsencesCount = countUpcomingAbsences(absences, period);
  const isPending = user?.employeeStatus === 'pending';
  const periodLabel = weeks === 1 ? t.oneWeek : weeks === 2 ? t.twoWeeks : t.fourWeeks;

  const currentAvailabilityStatus = useMemo(
    () => getCurrentAvailabilityStatus(availability, now, language),
    [availability, language, now],
  );

  const stats = [
    {
      key: 'hours',
      value: `${totalHours.toFixed(1)}${language === 'ru' ? 'ч' : 'h'}`,
      label: t.hoursInPeriod,
      sub: periodLabel,
      icon: IconClock,
      tone: 'blue',
    },
    {
      key: 'shifts',
      value: String(periodShifts.length),
      label: t.shiftsCount,
      sub: periodLabel,
      icon: IconTrend,
      tone: 'green',
    },
    {
      key: 'absences',
      value: String(upcomingAbsencesCount),
      label: t.upcomingAbsences,
      sub: t.requests,
      icon: IconCalendar,
      tone: 'amber',
    },
    {
      key: 'status',
      value: isPending ? '…' : currentAvailabilityStatus.value,
      label: t.status,
      sub: isPending
        ? t.waitingApproval
        : currentAvailabilityStatus.sub,
      icon: isPending
        ? IconAlert
        : currentAvailabilityStatus.icon,
      tone: isPending
        ? 'amber'
        : currentAvailabilityStatus.tone,
    },
  ];

  const toneStyles = {
    blue: {
      background: '#eff6ff',
      color: '#2563eb',
    },
    green: {
      background: '#ecfdf5',
      color: '#059669',
    },
    amber: {
      background: '#fffbeb',
      color: '#d97706',
    },
    red: {
      background: '#fef2f2',
      color: '#dc2626',
    },
  };

  const periodTabLabel = (value) => {
    if (value === 1) return t.oneWeek;
    if (value === 2) return t.twoWeeks;
    return t.fourWeeks;
  };

  const navigate = (tabId) => {
    if (typeof onNavigateTab === 'function') {
      onNavigateTab(tabId);
    }
  };

  return (
    <div className="employee-dashboard">
      <div className="ed-page">
        <header>
          <h1 className="ed-greeting-title">
            {getGreeting(language)}, {firstName}
          </h1>
          <p className="ed-greeting-sub">{formatLongDate(todayKey, language)}</p>
        </header>

        {error ? <div className="ed-error">{error}</div> : null}

        <div className="ed-stats-grid">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const tone = toneStyles[stat.tone] || toneStyles.blue;
            return (
              <div key={stat.key} className="ed-stat-card">
                <div className="ed-stat-icon" style={tone}>
                  <Icon />
                </div>
                <p className="ed-stat-value">{stat.value}</p>
                <p className="ed-stat-label">{stat.label}</p>
                <p className="ed-stat-sub">{stat.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="ed-main-grid">
          <section className="ed-card">
            <div className="ed-card-header">
              <div className="ed-card-header-main">
                <h2 className="ed-card-title">{t.upcomingShifts}</h2>
                <p className="ed-period-range">{formatPeriodRange(period)}</p>
              </div>
              <div className="ed-period-tabs" role="tablist" aria-label={t.upcomingShifts}>
                {PERIOD_WEEKS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={weeks === value}
                    className={`ed-period-tab${weeks === value ? ' is-active' : ''}`}
                    onClick={() => setWeeks(value)}
                  >
                    {periodTabLabel(value)}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="ed-loading">{t.loading}</div>
            ) : periodShifts.length === 0 ? (
              <div className="ed-empty">
                <div className="ed-empty-icon"><IconCalendar /></div>
                <h3 className="ed-empty-title">{t.noShiftsTitle}</h3>
                <p className="ed-empty-text">{t.noShiftsText}</p>
              </div>
            ) : (
              <div className="ed-shift-list">
                {periodShifts.map((shift) => {
                  const dateKey = getShiftDateKey(shift);
                  const rowKey = `${dateKey}-${formatTime(shift.start_time)}-${shift.id || shift.shift_id || ''}`;
                  return (
                    <article key={rowKey} className="ed-shift-row">
                      <span className="ed-shift-dot" aria-hidden="true" />
                      <div className="ed-shift-main">
                        <div className="ed-shift-meta-top">
                          <span className="ed-date-badge">{formatShiftDateLabel(dateKey, language)}</span>
                          <span className="ed-shift-time">{formatShiftTimeRange(shift)}</span>
                        </div>
                        <div className="ed-shift-details">
                          <span className="ed-shift-detail">
                            <IconMapPin />
                            {getShiftBranch(shift, user)}
                          </span>
                          <span className="ed-shift-detail">
                            <IconBriefcase />
                            {getShiftPosition(shift, user)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="ed-side-col">
            <div className="ed-today-card">
              <p className="ed-today-label">{t.today}</p>
              {todayShift ? (
                <>
                  <p className="ed-today-time">{formatShiftTimeRange(todayShift)}</p>
                  <p className="ed-today-sub">
                    {getShiftBranch(todayShift, user)} · {getShiftPosition(todayShift, user)}
                  </p>
                </>
              ) : (
                <p className="ed-today-empty">{t.todayOff}</p>
              )}
            </div>

            <div className="ed-card ed-quick-actions">
              <h2 className="ed-quick-title">{t.quickActions}</h2>
              <div className="ed-quick-list">
                <button type="button" className="ed-quick-btn" onClick={() => navigate('shifts')}>
                  <span className="ed-quick-icon"><IconCalendar /></span>
                  <span className="ed-quick-btn-label">{t.changeAvailability}</span>
                  <IconArrowRight />
                </button>
                <button type="button" className="ed-quick-btn" onClick={() => navigate('shifts')}>
                  <span className="ed-quick-icon"><IconBriefcase /></span>
                  <span className="ed-quick-btn-label">{t.requestAbsence}</span>
                  <IconArrowRight />
                </button>
                <button type="button" className="ed-quick-btn" onClick={() => navigate('schedule')}>
                  <span className="ed-quick-icon"><IconClock /></span>
                  <span className="ed-quick-btn-label">{t.viewSchedule}</span>
                  <IconArrowRight />
                </button>
                <button type="button" className="ed-quick-btn" onClick={() => navigate('reports')}>
                  <span className="ed-quick-icon"><IconTrend /></span>
                  <span className="ed-quick-btn-label">{t.viewReports}</span>
                  <IconArrowRight />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
