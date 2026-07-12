import { useEffect, useMemo, useState } from 'react';
import { formatLocalDate } from '../../services/scheduleService';
import { getDateLocale, parseApiDate } from '../../utils/dateDisplay';

const LABELS = {
  ru: {
    prevMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    today: 'Сегодня',
  },
  en: {
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    today: 'Today',
  },
};

function startOfMonthDate(value) {
  const source = parseApiDate(value) || new Date();
  return new Date(source.getFullYear(), source.getMonth(), 1, 12, 0, 0, 0);
}

function endOfMonthDate(value) {
  const source = parseApiDate(value) || new Date();
  return new Date(source.getFullYear(), source.getMonth() + 1, 0, 12, 0, 0, 0);
}

function buildCalendarDays(anchorApiDate) {
  const monthStart = startOfMonthDate(anchorApiDate);
  const monthEnd = endOfMonthDate(anchorApiDate);
  const gridStart = new Date(monthStart);
  const startOffset = (gridStart.getDay() + 6) % 7;
  gridStart.setDate(gridStart.getDate() - startOffset);

  const gridEnd = new Date(monthEnd);
  const endOffset = 6 - ((gridEnd.getDay() + 6) % 7);
  gridEnd.setDate(gridEnd.getDate() + endOffset);

  const days = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push({
      date: formatLocalDate(cursor),
      day: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === monthStart.getMonth(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function compareApiDates(left, right) {
  if (!left || !right) return 0;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export default function DatePickerCalendar({
  value = '',
  onChange,
  language = 'en',
  minDate = '',
  maxDate = '',
}) {
  const labels = LABELS[language] || LABELS.en;
  const locale = getDateLocale(language);
  const todayKey = formatLocalDate(new Date());
  const selectedKey = value || '';

  const [monthAnchor, setMonthAnchor] = useState(() => selectedKey || todayKey);

  useEffect(() => {
    if (selectedKey) {
      setMonthAnchor(selectedKey);
    }
  }, [selectedKey]);

  const visibleMonth = useMemo(() => {
    const date = parseApiDate(monthAnchor) || new Date();
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }, [locale, monthAnchor]);

  const weekdayLabels = useMemo(() => {
    const monday = new Date('2026-06-29T12:00:00');
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  const days = useMemo(() => buildCalendarDays(monthAnchor), [monthAnchor]);

  const shiftMonth = (delta) => {
    const date = parseApiDate(monthAnchor) || new Date();
    date.setMonth(date.getMonth() + delta, 1);
    setMonthAnchor(formatLocalDate(date));
  };

  const isDisabledDay = (dateKey) => {
    if (minDate && compareApiDates(dateKey, minDate) < 0) return true;
    if (maxDate && compareApiDates(dateKey, maxDate) > 0) return true;
    return false;
  };

  return (
    <div className="df-calendar" role="dialog" aria-label={visibleMonth}>
      <div className="df-calendar-header">
        <button
          type="button"
          className="df-calendar-nav"
          onClick={() => shiftMonth(-1)}
          aria-label={labels.prevMonth}
        >
          {'\u2039'}
        </button>
        <div className="df-calendar-title">{visibleMonth}</div>
        <button
          type="button"
          className="df-calendar-nav"
          onClick={() => shiftMonth(1)}
          aria-label={labels.nextMonth}
        >
          {'\u203a'}
        </button>
      </div>

      <div className="df-calendar-weekdays">
        {weekdayLabels.map((label) => (
          <div key={label} className="df-calendar-weekday">{label}</div>
        ))}
      </div>

      <div className="df-calendar-grid">
        {days.map((day) => {
          const isSelected = day.date === selectedKey;
          const isToday = day.date === todayKey;
          const disabled = isDisabledDay(day.date);
          const className = [
            'df-calendar-day',
            !day.isCurrentMonth ? 'df-calendar-day--outside' : '',
            isSelected ? 'df-calendar-day--selected' : '',
            isToday ? 'df-calendar-day--today' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={day.date}
              type="button"
              className={className}
              disabled={disabled}
              onClick={() => onChange?.(day.date)}
              aria-pressed={isSelected}
              aria-label={day.date}
            >
              {day.day}
            </button>
          );
        })}
      </div>

      <div className="df-calendar-footer">
        <button
          type="button"
          className="df-calendar-today"
          onClick={() => {
            setMonthAnchor(todayKey);
            if (!isDisabledDay(todayKey)) {
              onChange?.(todayKey);
            }
          }}
          disabled={isDisabledDay(todayKey)}
        >
          {labels.today}
        </button>
      </div>
    </div>
  );
}
