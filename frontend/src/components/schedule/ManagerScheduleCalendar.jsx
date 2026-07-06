import { useMemo } from 'react';
import { formatLocalDate } from '../../services/scheduleService';

const SHIFT_CHIP_COLORS = {
  shift: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  unfilled: 'linear-gradient(135deg, #ffd6a5 0%, #ffb085 100%)',
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
  const date = parseDateKey(value);
  if (!date) return value;

  return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(value) {
  return String(value || '').slice(0, 5);
}

function isDateWithinRange(dateKey, startDate, endDate) {
  if (!dateKey || !startDate || !endDate) return true;
  return dateKey >= startDate && dateKey <= endDate;
}

function ShiftDetailCard({ entry, texts, compact = false, mobileStyles }) {
  const isUnfilled = entry.kind === 'unfilled';
  const timeLabel = `${formatTimeLabel(entry.startTime)} – ${formatTimeLabel(entry.endTime)}`;

  if (compact) {
    return (
      <div
        title={`${timeLabel} · ${entry.position}${entry.employee ? ` · ${entry.employee}` : ''}`}
        style={{
          width: '100%',
          padding: '2px 4px',
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          lineHeight: 1.25,
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: isUnfilled ? '#5a1a1a' : '#ffffff',
          background: isUnfilled ? SHIFT_CHIP_COLORS.unfilled : SHIFT_CHIP_COLORS.shift,
          border: isUnfilled ? '1px dashed rgba(141, 29, 29, 0.35)' : 'none',
          ...mobileStyles?.shiftChip,
        }}
      >
        {formatTimeLabel(entry.startTime)} {entry.position}
      </div>
    );
  }

  return (
    <article
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        background: isUnfilled ? SHIFT_CHIP_COLORS.unfilled : SHIFT_CHIP_COLORS.shift,
        color: isUnfilled ? '#5a1a1a' : '#ffffff',
        border: isUnfilled ? '2px dashed #8d1d1d' : '1px solid rgba(255,255,255,0.12)',
        boxShadow: isUnfilled
          ? '0 2px 8px rgba(141, 29, 29, 0.12)'
          : '0 2px 8px rgba(102,126,234,0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        ...mobileStyles?.shiftCard,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
      }}
      >
        <div style={{
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: '0.01em',
          ...mobileStyles?.shiftTime,
        }}
        >
          {timeLabel}
        </div>
        <span style={{
          flexShrink: 0,
          padding: '3px 8px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: isUnfilled ? 'rgba(141, 29, 29, 0.12)' : 'rgba(255,255,255,0.18)',
          color: isUnfilled ? '#8d1d1d' : '#ffffff',
        }}
        >
          {isUnfilled ? texts.unfilledBadge : texts.assignedBadge}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.82, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {texts.position}
          </span>
          <strong style={{ fontSize: 15, fontWeight: 800, ...mobileStyles?.shiftPosition }}>
            {entry.position}
          </strong>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.82, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {texts.employee}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, ...mobileStyles?.shiftEmployee }}>
            {isUnfilled
              ? (entry.missingStaff > 1
                ? texts.missingStaff.replace('{count}', String(entry.missingStaff))
                : texts.notFound)
              : entry.employee}
          </span>
        </div>

        {entry.branch ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.82, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {texts.branch}
            </span>
            <span style={{ fontSize: 13, fontWeight: 650 }}>
              {entry.branch}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
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
  entriesByDate = {},
  coverageByDate,
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

  const maxCellPreview = mobileStyles ? 2 : 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobileStyles?.sectionGap || 12 }}>
      <section style={{
        ...panelStyle,
        display: 'grid',
        gridTemplateRows: 'auto auto auto auto',
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
          gridAutoRows: 'minmax(88px, auto)',
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
            const dayEntries = entriesByDate[calendarDay.date] || [];
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
            const previewEntries = dayEntries.slice(0, maxCellPreview);
            const hiddenCount = Math.max(dayEntries.length - previewEntries.length, 0);

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
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                  gap: 4,
                  opacity: calendarDay.isCurrentMonth ? 1 : 0.55,
                  textAlign: 'left',
                  ...(hasCoverage ? { boxShadow: 'inset 0 0 0 1px rgba(0, 38, 66, 0.18)' } : {}),
                  ...(inLoadedRange ? { background: calendarDay.isCurrentMonth ? '#f8fcff' : '#f3f8fb' } : {}),
                  ...(isSelected ? {
                    background: '#eaf6ff',
                    boxShadow: 'inset 0 0 0 2px #002642',
                  } : {}),
                  ...mobileStyles?.monthDayCell,
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
                >
                  <span style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    flexShrink: 0,
                    ...(isTodayDate ? { border: '2px solid #007aff', color: '#007aff' } : {}),
                    ...(isSelected ? { background: '#002642', color: '#ffffff', borderColor: '#002642' } : {}),
                    ...mobileStyles?.monthDayNumber,
                  }}
                  >
                    {calendarDay.day}
                  </span>

                  {(hasCoverage || hasShifts || hasUnfilled) && previewEntries.length === 0 ? (
                    <span style={{
                      display: 'flex',
                      gap: 3,
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
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
                            background: '#667eea',
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
                          }}
                        />
                      )}
                    </span>
                  ) : null}
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  width: '100%',
                  minHeight: 0,
                  flex: 1,
                }}
                >
                  {previewEntries.map((entry) => (
                    <ShiftDetailCard
                      key={entry.key}
                      entry={entry}
                      texts={texts}
                      compact
                      mobileStyles={mobileStyles}
                    />
                  ))}
                  {hiddenCount > 0 ? (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: '#4f646f',
                      padding: '0 2px',
                    }}
                    >
                      {texts.moreShifts.replace('{count}', String(hiddenCount))}
                    </span>
                  ) : null}
                </div>
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
        gap: 12,
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 10,
          }}
          >
            {selectedDayEntries.map((entry) => (
              <ShiftDetailCard
                key={entry.key}
                entry={entry}
                texts={texts}
                mobileStyles={mobileStyles}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
