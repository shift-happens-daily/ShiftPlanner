import { useMemo } from 'react';
import { formatLocalDate } from '../../services/scheduleService';
import {
  formatApiDateRange,
  formatDisplayDateWithWeekday,
  formatLocalizedDate,
  getDateLocale,
} from '../../utils/dateDisplay';
import '../../styles/schedule-tab.css';

const INDICATOR_COLORS = {
  draft: '#6366f1',
  published: '#10b981',
  unfilled: '#f97316',
};

function parseDateKey(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfMonthDate(value) {
  const source = parseDateKey(value) || new Date();
  source.setHours(12, 0, 0, 0);
  return new Date(source.getFullYear(), source.getMonth(), 1, 12, 0, 0, 0);
}

function endOfMonthDate(value) {
  const source = parseDateKey(value) || new Date();
  source.setHours(12, 0, 0, 0);
  return new Date(source.getFullYear(), source.getMonth() + 1, 0, 12, 0, 0, 0);
}

function buildCalendarGrid(anchorDateKey) {
  const monthStart = startOfMonthDate(anchorDateKey);
  const monthEnd = endOfMonthDate(anchorDateKey);
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

  return { days };
}

function isSameDateKey(left, right) {
  return formatLocalDate(left) === formatLocalDate(right);
}

function formatDisplayDate(value, language = 'ru') {
  return formatDisplayDateWithWeekday(value, language);
}

function formatTimeLabel(value) {
  return String(value || '').slice(0, 5);
}

function isDateWithinRange(dateKey, startDate, endDate) {
  if (!dateKey || !startDate || !endDate) return true;
  return dateKey >= startDate && dateKey <= endDate;
}

function getDayIndicator(dayCounts, scheduleStatus) {
  const total = (dayCounts.shifts || 0) + (dayCounts.unfilled || 0);
  if (total === 0) return null;

  const color = dayCounts.unfilled > 0
    ? INDICATOR_COLORS.unfilled
    : (scheduleStatus === 'published' ? INDICATOR_COLORS.published : INDICATOR_COLORS.draft);

  return { total, color };
}

function ManagerShiftDetail({ entry, texts, scheduleStatus }) {
  const isUnfilled = entry.kind === 'unfilled';
  const timeLabel = `${formatTimeLabel(entry.startTime)} – ${formatTimeLabel(entry.endTime)}`;

  return (
    <div className="st-detail-shift-card">
      <div className="st-detail-header" style={{ marginBottom: 12 }}>
        <div>
          <p className="st-detail-status">
            {isUnfilled ? texts.unfilledBadge : texts.assignedBadge}
          </p>
        </div>
      </div>

      <div className={`st-shift-time-box ${isUnfilled ? 'st-shift-time-box--unfilled' : 'st-shift-time-box--assigned'}`}>
        <p className="st-shift-time-label">{texts.shiftTime || 'SHIFT TIME'}</p>
        <p className="st-shift-time-value">{timeLabel}</p>
      </div>

      <div className="st-detail-section">
        <p className="st-detail-section-label">{texts.position}</p>
        <p className="st-detail-section-value">{entry.position}</p>
      </div>

      <div className="st-detail-section">
        <p className="st-detail-section-label">{texts.employee}</p>
        <p className="st-detail-section-value">
          {isUnfilled
            ? (entry.missingStaff > 1
              ? texts.missingStaff.replace('{count}', String(entry.missingStaff))
              : texts.notFound)
            : entry.employee}
        </p>
      </div>

      {entry.branch ? (
        <div className="st-detail-section">
          <p className="st-detail-section-label">{texts.branch}</p>
          <p className="st-detail-section-value">{entry.branch}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function ManagerScheduleCalendar({
  language,
  texts,
  calendarMonth,
  onCalendarMonthChange,
  selectedDate,
  onSelectedDateChange,
  groupedScheduleByDate,
  entriesByDate = {},
  scheduleStatus = 'draft',
  scheduleStartDate,
  scheduleEndDate,
  selectedDayEntries,
}) {
  const calendarGrid = useMemo(
    () => buildCalendarGrid(calendarMonth),
    [calendarMonth],
  );

  const calendarMonthLabel = useMemo(() => {
    const date = startOfMonthDate(calendarMonth);
    return date.toLocaleDateString(getDateLocale(language), {
      month: 'long',
      year: 'numeric',
    });
  }, [calendarMonth, language]);

  const weekdayLabels = useMemo(() => {
    const base = startOfMonthDate(calendarMonth);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(base);
      day.setDate(day.getDate() - ((day.getDay() + 6) % 7) + index);
      return day.toLocaleDateString(getDateLocale(language), { weekday: 'short' });
    });
  }, [calendarMonth, language]);

  const shiftCalendarMonth = (delta) => {
    const current = startOfMonthDate(calendarMonth);
    current.setMonth(current.getMonth() + delta);
    onCalendarMonthChange(formatLocalDate(current));
  };

  const hasUnfilledInView = useMemo(
    () => Object.values(groupedScheduleByDate).some((day) => day.unfilled > 0),
    [groupedScheduleByDate],
  );

  const showDetail = Boolean(selectedDate) && (
    selectedDayEntries.length > 0
    || isDateWithinRange(selectedDate, scheduleStartDate, scheduleEndDate)
  );

  const emptyDetailMessage = !isDateWithinRange(selectedDate, scheduleStartDate, scheduleEndDate)
    ? texts.noShiftsThisDay
    : (Object.keys(groupedScheduleByDate).length === 0 ? texts.noShiftsInVersion : texts.noShiftsThisDay);

  return (
    <div className="st-layout">
      <div className="st-main">
        <div className="st-calendar-header">
          <div />
          <div className="st-month-nav">
            <button
              type="button"
              className="st-month-nav-btn"
              onClick={() => shiftCalendarMonth(-1)}
              aria-label={texts.prevMonth}
            >
              <span className="st-icon-chevron-left" aria-hidden />
            </button>
            <span className="st-month-label">{calendarMonthLabel}</span>
            <button
              type="button"
              className="st-month-nav-btn"
              onClick={() => shiftCalendarMonth(1)}
              aria-label={texts.nextMonth}
            >
              <span className="st-icon-chevron-right" aria-hidden />
            </button>
          </div>
        </div>

        {scheduleStartDate && scheduleEndDate ? (
          <p className="st-page-subtitle" style={{ marginBottom: 14 }}>
            {texts.loadedPeriod}: {formatApiDateRange(scheduleStartDate, scheduleEndDate)}
          </p>
        ) : null}

        <div className="st-legend">
          <div className="st-legend-item">
            <span
              className="st-legend-dot"
              style={{ background: scheduleStatus === 'published' ? INDICATOR_COLORS.published : INDICATOR_COLORS.draft }}
            />
            <span className="st-legend-label">
              {scheduleStatus === 'published' ? texts.legendPublishedShifts : texts.legendDraftShifts}
            </span>
          </div>
          {hasUnfilledInView ? (
            <div className="st-legend-item">
              <span className="st-legend-dot st-legend-dot--unfilled" />
              <span className="st-legend-label">{texts.legendUnfilled}</span>
            </div>
          ) : null}
          <div className="st-legend-item">
            <span className="st-legend-dot st-legend-dot--empty" />
            <span className="st-legend-label">{texts.legendNoShift || 'No shift'}</span>
          </div>
        </div>

        <div className="st-calendar">
          <div className="st-calendar-weekdays">
            {weekdayLabels.map((weekday) => (
              <div key={weekday} className="st-calendar-weekday">{weekday}</div>
            ))}
          </div>

          <div className="st-calendar-grid">
            {calendarGrid.days.map((calendarDay, index) => {
              const dayCounts = groupedScheduleByDate[calendarDay.date] || { shifts: 0, unfilled: 0 };
              const indicator = getDayIndicator(dayCounts, scheduleStatus);
              const isSelected = calendarDay.date === selectedDate;
              const isTodayDate = isSameDateKey(calendarDay.date, formatLocalDate(new Date()));
              const inLoadedRange = isDateWithinRange(
                calendarDay.date,
                scheduleStartDate,
                scheduleEndDate,
              );
              const isWeekend = index % 7 >= 5;

              const cellClass = [
                'st-day-cell',
                isWeekend ? 'st-day-cell--weekend' : '',
                !calendarDay.isCurrentMonth ? 'st-day-cell--outside' : '',
                isSelected ? 'st-day-cell--selected' : '',
                inLoadedRange && calendarDay.isCurrentMonth ? 'st-day-cell--in-range' : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={calendarDay.date}
                  type="button"
                  className={cellClass}
                  onClick={() => onSelectedDateChange(calendarDay.date)}
                >
                  <span className={`st-day-number ${isTodayDate ? 'st-day-number--today' : ''}`}>
                    {calendarDay.day}
                  </span>

                  {indicator ? (
                    <div
                      className="st-day-indicator"
                      title={`${indicator.total} ${indicator.total === 1 ? (texts.shiftSingular || 'shift') : (texts.shiftPlural || 'shifts')}`}
                    >
                      <span
                        className="st-day-indicator-dot"
                        style={{ background: indicator.color }}
                      />
                      <span className="st-day-indicator-text">
                        {indicator.total} {indicator.total === 1 ? (texts.shiftSingular || 'shift') : (texts.shiftPlural || 'shifts')}
                      </span>
                      <span className="st-day-indicator-count">{indicator.total}</span>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="st-sidebar">
        <div className="st-detail-panel">
          {showDetail && selectedDayEntries.length > 0 ? (
            <div className="st-detail-content">
              <div className="st-detail-header">
                <div>
                  <p className="st-detail-date">{formatDisplayDate(selectedDate, language)}</p>
                  <p className="st-detail-status">
                    {selectedDayEntries.length}{' '}
                    {selectedDayEntries.length === 1
                      ? (texts.shiftSingular || 'shift')
                      : (texts.shiftPlural || 'shifts')}
                  </p>
                </div>
                <button
                  type="button"
                  className="st-detail-close"
                  onClick={() => onSelectedDateChange(null)}
                  aria-label={texts.closeDetail || 'Close'}
                >
                  <span className="st-icon-close" aria-hidden />
                </button>
              </div>

              {selectedDayEntries.map((entry) => (
                <ManagerShiftDetail
                  key={entry.key}
                  entry={entry}
                  texts={texts}
                  scheduleStatus={scheduleStatus}
                />
              ))}
            </div>
          ) : (
            <div className="st-detail-empty">
              <span className="st-detail-empty-icon" aria-hidden />
              <p className="st-detail-empty-title">
                {selectedDate && selectedDayEntries.length === 0
                  ? (texts.noShiftsThisDay || emptyDetailMessage)
                  : (texts.selectDay || 'Select a day')}
              </p>
              <p className="st-detail-empty-message">
                {selectedDate && selectedDayEntries.length === 0
                  ? emptyDetailMessage
                  : (texts.selectDayHint || 'Click a day with a shift indicator to see details here.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
