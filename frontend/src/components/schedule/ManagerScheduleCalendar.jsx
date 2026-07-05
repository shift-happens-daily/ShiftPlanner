import { useMemo } from 'react';
import { formatLocalDate } from '../../services/scheduleService';

const SHIFT_DOT_COLORS = ['#667eea', '#34c759', '#ff9500', '#ff3b30'];

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
  const date = parseDateKey(value);
  if (!date) return value;

  return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isDateWithinRange(dateKey, startDate, endDate) {
  if (!dateKey || !startDate || !endDate) return true;
  return dateKey >= startDate && dateKey <= endDate;
}

export default function ManagerScheduleCalendar({
  language,
  texts,
  panelStyle,
  mobileStyles,
  calendarMonth,
  onCalendarMonthChange,
  selectedDate,
  onSelectedDateChange,
  groupedScheduleByDate,
  coverageByDate,
  scheduleStartDate,
  scheduleEndDate,
  selectedDayEntries,
  renderShiftCard,
}) {
  const calendarGrid = useMemo(
    () => buildCalendarGrid(calendarMonth),
    [calendarMonth],
  );

  const calendarMonthLabel = useMemo(() => {
    const date = startOfMonthDate(calendarMonth);
    return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [calendarMonth, language]);

  const calendarMonthKey = useMemo(() => {
    const date = startOfMonthDate(calendarMonth);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }, [calendarMonth]);

  const weekdayLabels = useMemo(() => {
    const base = startOfMonthDate(calendarMonth);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(base);
      day.setDate(day.getDate() - ((day.getDay() + 6) % 7) + index);
      return day.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' });
    });
  }, [calendarMonth, language]);

  const shiftCalendarMonth = (delta) => {
    const current = startOfMonthDate(calendarMonth);
    current.setMonth(current.getMonth() + delta);
    onCalendarMonthChange(formatLocalDate(current));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobileStyles?.sectionGap || 12 }}>
      <section style={{
        ...panelStyle,
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
        gap: 8,
        padding: 18,
        ...mobileStyles?.calendarPanel,
      }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
        >
          <div>
            <h3 style={{
              margin: 0,
              color: '#002642',
              fontSize: 20,
              fontWeight: 900,
              textTransform: 'capitalize',
              ...mobileStyles?.calendarTitle,
            }}
            >
              {calendarMonthLabel}
            </h3>
            {scheduleStartDate && scheduleEndDate ? (
              <p style={{ margin: '4px 0 0', color: '#4f646f', fontSize: 13, ...mobileStyles?.selectedDayHint }}>
                {texts.loadedPeriod}: {scheduleStartDate} — {scheduleEndDate}
              </p>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => shiftCalendarMonth(-1)}
              style={{
                width: 40,
                height: 36,
                borderRadius: 10,
                border: '1px solid #dee7e7',
                background: '#eef3f6',
                color: '#002642',
                fontSize: 18,
                fontWeight: 800,
                cursor: 'pointer',
                ...mobileStyles?.calendarNavButton,
              }}
              aria-label={texts.prevMonth}
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => {
                const today = formatLocalDate(new Date());
                onCalendarMonthChange(today);
                onSelectedDateChange(today);
              }}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 10,
                border: '1px solid #dbe6f0',
                background: '#ffffff',
                color: '#002642',
                fontSize: 13,
                fontWeight: 850,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                ...mobileStyles?.calendarMonthKey,
              }}
            >
              {calendarMonthKey}
            </button>
            <button
              type="button"
              onClick={() => shiftCalendarMonth(1)}
              style={{
                width: 40,
                height: 36,
                borderRadius: 10,
                border: '1px solid #dee7e7',
                background: '#eef3f6',
                color: '#002642',
                fontSize: 18,
                fontWeight: 800,
                cursor: 'pointer',
                ...mobileStyles?.calendarNavButton,
              }}
              aria-label={texts.nextMonth}
            >
              →
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          background: '#f4faff',
          border: '1px solid #dee7e7',
          borderBottom: 'none',
          borderRadius: '10px 10px 0 0',
        }}
        >
          {weekdayLabels.map((weekday) => (
            <div
              key={weekday}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4f646f',
                fontSize: 12,
                fontWeight: 850,
                textTransform: 'capitalize',
                padding: '8px 0',
                ...mobileStyles?.monthWeekday,
              }}
            >
              {weekday}
            </div>
          ))}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gridAutoRows: 'minmax(52px, 1fr)',
          background: '#dee7e7',
          gap: '1px',
          border: '1px solid #dee7e7',
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
          ...mobileStyles?.monthGrid,
        }}
        >
          {calendarGrid.days.map((calendarDay) => {
            const dayCounts = groupedScheduleByDate[calendarDay.date] || { shifts: 0, unfilled: 0 };
            const coverage = coverageByDate[calendarDay.date];
            const hasShifts = dayCounts.shifts > 0;
            const hasUnfilled = dayCounts.unfilled > 0;
            const hasCoverage = Boolean(coverage?.hasSchedule);
            const isSelected = calendarDay.date === selectedDate;
            const isTodayDate = isSameDateKey(calendarDay.date, formatLocalDate(new Date()));
            const inLoadedRange = isDateWithinRange(
              calendarDay.date,
              scheduleStartDate,
              scheduleEndDate,
            );

            return (
              <button
                key={calendarDay.date}
                type="button"
                onClick={() => onSelectedDateChange(calendarDay.date)}
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  border: 0,
                  background: calendarDay.isCurrentMonth ? '#ffffff' : '#f8fbfd',
                  color: calendarDay.isCurrentMonth ? '#002642' : '#8da0a9',
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                  opacity: calendarDay.isCurrentMonth ? 1 : 0.55,
                  ...(hasCoverage ? { boxShadow: 'inset 0 0 0 1px rgba(0, 38, 66, 0.18)' } : {}),
                  ...(inLoadedRange ? { background: calendarDay.isCurrentMonth ? '#f8fcff' : '#f3f8fb' } : {}),
                  ...(isSelected ? {
                    background: '#eaf6ff',
                    boxShadow: 'inset 0 0 0 2px #002642',
                  } : {}),
                  ...mobileStyles?.monthDayCell,
                }}
              >
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 800,
                  ...(isTodayDate ? { border: '2px solid #007aff', color: '#007aff' } : {}),
                  ...(isSelected ? { background: '#002642', color: '#ffffff', borderColor: '#002642' } : {}),
                  ...mobileStyles?.monthDayNumber,
                }}
                >
                  {calendarDay.day}
                </span>

                <span style={{
                  minHeight: 8,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 3,
                  flexWrap: 'wrap',
                  ...mobileStyles?.monthDots,
                }}
                >
                  {hasCoverage && (
                    <span
                      title={texts.hasScheduleMarker}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        display: 'block',
                        background: coverage.status === 'published' ? '#34c759' : '#002642',
                        ...mobileStyles?.monthDot,
                      }}
                    />
                  )}
                  {hasShifts && (
                    <span
                      title={texts.hasShiftsMarker}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        display: 'block',
                        background: SHIFT_DOT_COLORS[0],
                        ...mobileStyles?.monthDot,
                      }}
                    />
                  )}
                  {hasUnfilled && (
                    <span
                      title={texts.hasUnfilledMarker}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        display: 'block',
                        background: '#ff9500',
                        ...mobileStyles?.monthDot,
                      }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          color: '#4f646f',
          fontSize: 12,
          fontWeight: 600,
        }}
        >
          <span>{texts.legendCoverage}</span>
          <span>{texts.legendShifts}</span>
          <span>{texts.legendUnfilled}</span>
        </div>
      </section>

      <section style={{
        ...panelStyle,
        background: '#f8fbfd',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 18,
        ...mobileStyles?.selectedDayPanel,
      }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
        >
          <div>
            <h3 style={{
              margin: 0,
              color: '#002642',
              fontSize: 18,
              fontWeight: 900,
              ...mobileStyles?.selectedDayTitle,
            }}
            >
              {formatDisplayDate(selectedDate, language)}
            </h3>
            <p style={{ margin: '2px 0 0', color: '#4f646f', fontSize: 13, ...mobileStyles?.selectedDayHint }}>
              {selectedDate}
            </p>
          </div>
          <span style={{
            minWidth: 40,
            height: 32,
            padding: '0 10px',
            borderRadius: 999,
            background: '#002642',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 900,
            ...mobileStyles?.selectedDayCount,
          }}
          >
            {selectedDayEntries.length}
          </span>
        </div>

        {selectedDayEntries.length === 0 ? (
          <div style={{
            padding: '12px 14px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #dee7e7',
            color: '#4f646f',
            fontWeight: 600,
            fontSize: 13,
            ...mobileStyles?.emptyBox,
          }}
          >
            {!isDateWithinRange(selectedDate, scheduleStartDate, scheduleEndDate)
              ? texts.noShiftsThisDay
              : (Object.keys(groupedScheduleByDate).length === 0 ? texts.noShiftsInVersion : texts.noShiftsThisDay)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedDayEntries.map((entry) => renderShiftCard(entry))}
          </div>
        )}
      </section>
    </div>
  );
}
