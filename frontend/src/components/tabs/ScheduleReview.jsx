import { useCallback, useEffect, useMemo, useState } from 'react';
import '../../styles/schedule-tab.css';
import {
  formatApiDateAsDisplay,
  formatDisplayDateWithWeekday,
  getDateLocale,
} from '../../utils/dateDisplay';
import DateField from '../ui/DateField';
import {
  defaultSchedulePeriod,
  deleteScheduleWeek,
  deriveSchedulePeriod,
  fetchScheduleCoverage,
  fetchScheduleVersions,
  findOverlappingSchedules,
  formatLocalDate,
  generateScheduleWeeks,
  getWeekPeriodRange,
  isMonday,
  isScheduleGenerateTransportError,
  periodsOverlap,
  publishScheduleForPeriod,
  resolveScheduleIdForDate,
  snapToMonday,
  assignRequirement,
} from '../../services/scheduleService';
import { listBranches } from '../../services/companyService';
import ManagerScheduleCalendar from '../schedule/ManagerScheduleCalendar';
import { filterRealEmployees, listEmployees } from '../../services/employeeService';
import { useAuth } from '../../context/useAuth';
import { extractApiErrorMessage } from '../../services/error';
import { useTabResponsive } from '../../utils/tabResponsive';
import { getPositionLabel } from '../../utils/employeeDisplay';
import { usePositionTitleRevision } from '../../hooks/usePositionTitleRevision';
import { useUnsavedChanges } from '../../context/useUnsavedChanges';

const SCHEDULE_DRAFT_SCOPE = 'schedule-review-draft';

function getShiftPositionTitle(shift) {
  return getPositionLabel({
    position_id: shift?.position_id,
    position_title: shift?.position_title,
    title: typeof shift?.position === 'string' ? shift.position : undefined,
    name: shift?.position?.name,
    position: typeof shift?.position === 'object' ? shift.position : undefined,
  }, '—');
}

const scheduleShiftBlockStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
};

const scheduleShiftBlockLineStyle = {
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'center',
};

const MOBILE_MANAGER_SCHEDULE_STYLES = {
  page: {
    padding: '6px 8px 10px',
  },
  shell: {
    gap: 8,
  },
  title: {
    fontSize: 18,
  },
  statusBadge: {
    padding: '5px 10px',
    fontSize: 11,
  },
  versionButton: {
    height: 32,
    padding: '0 10px',
    fontSize: 12,
    borderRadius: 8,
  },
  controlsPanel: {
    padding: 10,
    gap: 8,
  },
  label: {
    fontSize: 11,
  },
  input: {
    height: 34,
    padding: '0 10px',
    fontSize: 13,
    borderRadius: 8,
  },
  actionButton: {
    height: 34,
    padding: '0 12px',
    fontSize: 12,
    borderRadius: 8,
    minWidth: 0,
    flex: '1 1 calc(50% - 4px)',
  },
  navPanel: {
    padding: 10,
    gap: 8,
  },
  navButton: {
    fontSize: 16,
  },
  navLabel: {
    fontSize: 12,
  },
  viewModeButton: {
    height: 30,
    padding: '0 10px',
    fontSize: 12,
    borderRadius: 8,
    flex: 1,
  },
  unfilledPanel: {
    padding: '10px 12px',
  },
  unfilledTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  unfilledItem: {
    padding: '8px 10px',
    gap: 8,
    borderRadius: 10,
  },
  unfilledPosition: {
    fontSize: 13,
  },
  unfilledMeta: {
    fontSize: 11,
  },
  unfilledSelect: {
    minWidth: 0,
    width: '100%',
    height: 32,
    fontSize: 12,
  },
  unfilledAssignButton: {
    height: 32,
    padding: '0 12px',
    fontSize: 12,
    width: '100%',
  },
  sectionGap: 8,
  dateHeader: {
    fontSize: 12,
    fontWeight: 800,
    color: '#4f646f',
    padding: '0 2px',
  },
  shiftCard: {
    padding: '8px 10px',
    borderRadius: 10,
  },
  shiftPosition: {
    fontSize: 13,
    marginBottom: 2,
  },
  shiftEmployee: {
    fontSize: 12,
    marginBottom: 2,
  },
  shiftTime: {
    fontSize: 11,
  },
  emptyBox: {
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
  },
  calendarPanel: {
    padding: 10,
    gap: 8,
    borderRadius: 12,
  },
  calendarTitle: {
    fontSize: 16,
  },
  calendarMonthKey: {
    height: 30,
    padding: '0 10px',
    fontSize: 12,
  },
  calendarNavButton: {
    width: 34,
    height: 30,
    fontSize: 15,
  },
  monthWeekday: {
    fontSize: 10,
  },
  monthCalendar: {
    gridTemplateRows: '20px minmax(0, 1fr)',
  },
  monthGrid: {
    gridAutoRows: 'minmax(32px, 1fr)',
  },
  monthDots: {
    minHeight: 5,
    gap: 2,
  },
  monthDayCell: {
    padding: 2,
    gap: 2,
  },
  monthDayNumber: {
    width: 22,
    height: 22,
    fontSize: 12,
  },
  monthDot: {
    width: 4,
    height: 4,
  },
  selectedDayPanel: {
    padding: 8,
    gap: 6,
    borderRadius: 10,
  },
  selectedDayTitle: {
    fontSize: 14,
  },
  selectedDayHint: {
    fontSize: 11,
  },
  selectedDayCount: {
    minWidth: 26,
    height: 24,
    padding: '0 8px',
    fontSize: 12,
  },
};

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

  return {
    days,
    startDate: formatLocalDate(gridStart),
    endDate: formatLocalDate(gridEnd),
  };
}

function isSameDateKey(left, right) {
  return formatDate(left) === formatDate(right);
}

function formatDisplayDate(value, language = 'ru') {
  return formatDisplayDateWithWeekday(value, language);
}

function isDateWithinRange(dateKey, startDate, endDate) {
  if (!dateKey || !startDate || !endDate) return true;
  return dateKey >= startDate && dateKey <= endDate;
}

function buildCalendarMonthPeriod(anchorDateKey) {
  const monthStart = startOfMonthDate(anchorDateKey);
  const monthEnd = endOfMonthDate(anchorDateKey);
  return {
    start_date: formatLocalDate(monthStart),
    end_date: formatLocalDate(monthEnd),
  };
}

function scheduleCoversPeriod(schedule, period) {
  if (!schedule?.start_date || !schedule?.end_date || !period?.start_date || !period?.end_date) {
    return false;
  }
  return periodsOverlap(
    schedule.start_date,
    schedule.end_date,
    period.start_date,
    period.end_date,
  );
}

function applyLoadedScheduleState({
  versions,
  period,
  setScheduleVersions,
  setActiveVersion,
  setViewPeriod,
  setCalendarSelectedDate,
  setCalendarMonth,
}) {
  const loaded = versions.draft || versions.published;
  if (!loaded?.id) {
    return false;
  }

  const derivedPeriod = deriveSchedulePeriod(loaded, period);
  setScheduleVersions(versions);
  setActiveVersion(versions.draft ? 'draft' : 'published');
  setViewPeriod(derivedPeriod);
  setCalendarSelectedDate(derivedPeriod.start_date);
  setCalendarMonth(derivedPeriod.start_date);
  return true;
}

function buildGroupedScheduleCounts(displaySchedule, unfilledNotFoundRequirements) {
  const byDate = {};

  normalizeArray(displaySchedule?.shifts).forEach((shift) => {
    const key = formatDate(shift.date);
    if (!byDate[key]) {
      byDate[key] = { shifts: 0, unfilled: 0 };
    }
    byDate[key].shifts += 1;
  });

  unfilledNotFoundRequirements.forEach((item) => {
    const key = formatDate(item.date);
    if (!byDate[key]) {
      byDate[key] = { shifts: 0, unfilled: 0 };
    }
    byDate[key].unfilled += 1;
  });

  return byDate;
}

function formatTimeForApi(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw.slice(0, 8);
}

function formatDate(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) {
    return String(d || '').slice(0, 10);
  }
  return formatLocalDate(date);
}

function defaultPeriod() {
  return defaultSchedulePeriod();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.shifts)) return value.shifts;
  return [];
}

const SCHEDULE_SLOT_MINUTES = 30;
const SCHEDULE_SLOTS_PER_DAY = (24 * 60) / SCHEDULE_SLOT_MINUTES;
const SCHEDULE_CELL_WIDTH = 31;

function parseTimeToHours(t) {
  if (!t) return 0;
  const parts = String(t).split(':');
  const h = Number(parts[0] || 0);
  const m = Number(parts[1] || 0);
  return h + m / 60;
}

function timeToSlotOffset(time) {
  return parseTimeToHours(time) * (60 / SCHEDULE_SLOT_MINUTES);
}

function formatScheduleSlotLabel(slotIndex) {
  const hour = Math.floor(slotIndex / 2);
  const minutes = (slotIndex % 2) * SCHEDULE_SLOT_MINUTES;
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function scheduleSlotGridStyle(cellWidth, background) {
  return {
    backgroundImage: `repeating-linear-gradient(to right, rgba(79, 100, 111, 0.14) 0, rgba(79, 100, 111, 0.14) 1px, transparent 1px, transparent ${cellWidth}px)`,
    backgroundSize: `${cellWidth}px 100%`,
    backgroundColor: background,
  };
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Convert the backend ScheduleRead (flat list of assigned shifts) into the
// per-date structure the grid renders: [{ date, shifts: [...] }].
function groupShiftsByDate(scheduleRead) {
  const shifts = normalizeArray(scheduleRead?.shifts);
  const byDate = {};

  shifts.forEach((shift) => {
    const dateKey = formatDate(shift.date);
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push({
      id: shift.id,
      position_id: shift.position_id,
      position: shift.position,
      position_title: shift.position_title || shift.position,
      start_time: shift.start_time,
      end_time: shift.end_time,
      assigned_employees: [{ id: shift.employee_id, full_name: shift.employee_name }],
      assigned_employee_ids: [shift.employee_id],
    });
  });

  return Object.keys(byDate)
    .sort()
    .map((date) => ({ date, shifts: byDate[date] }));
}

function buildEmployeeListFromIndexes(schedules, dateIndexes) {
  const empMap = {};
  dateIndexes.forEach((di) => {
    const day = schedules[di];
    if (!day) return;
    (day.shifts || []).forEach((shift) => {
      (shift.assigned_employees || shift.candidate_employees || []).forEach((e) => {
        if (!e || e.id === undefined || e.id === null) return;
        empMap[String(e.id)] = e;
      });
    });
  });
  return Object.values(empMap).sort((a, b) =>
    (a.full_name || a.name || '').localeCompare(b.full_name || b.name || '')
  );
}

function isMissingCompanyError(error) {
  const detail = error?.response?.data?.detail;
  return error?.response?.status === 403 && (
    detail === 'Manager is not linked to a company.'
    || detail === 'User is not linked to a company.'
  );
}

function countVisibleShifts(scheduleRead) {
  return normalizeArray(scheduleRead?.shifts).filter((shift) => Boolean(shift?.employee_id)).length;
}

function matchesRequirementSlot(shift, requirement) {
  return (
    formatDate(shift.date) === formatDate(requirement.date)
    && Number(shift.position_id) === Number(requirement.position_id)
    && formatTimeForApi(shift.start_time) === formatTimeForApi(requirement.start_time)
    && formatTimeForApi(shift.end_time) === formatTimeForApi(requirement.end_time)
  );
}

function getCompletelyUnfilledRequirements(schedule) {
  const shifts = normalizeArray(schedule?.shifts);
  return normalizeArray(schedule?.unfilled_requirements).filter(
    (item) => !shifts.some((shift) => matchesRequirementSlot(shift, item) && shift.employee_id),
  );
}

function mergeScheduleDates(scheduleRead, unfilledItems) {
  const byDate = {};
  groupShiftsByDate(scheduleRead).forEach((day) => {
    byDate[day.date] = day;
  });
  unfilledItems.forEach((item) => {
    const dateKey = formatDate(item.date);
    if (!byDate[dateKey]) {
      byDate[dateKey] = { date: dateKey, shifts: [] };
    }
  });
  return Object.keys(byDate)
    .sort()
    .map((date) => byDate[date]);
}

function enumerateDates(startDate, endDate) {
  if (!startDate || !endDate) return [];

  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function buildFullScheduleRange(scheduleRead, unfilledItems, startDate, endDate) {
  const sparse = mergeScheduleDates(scheduleRead, unfilledItems);
  const range = enumerateDates(startDate, endDate);
  if (!range.length) {
    return sparse;
  }

  const sparseByDate = Object.fromEntries(sparse.map((day) => [day.date, day]));

  return range.map((date) => sparseByDate[date] || { date, shifts: [] });
}

function DayScheduleTable({
  dateKey,
  day,
  employees,
  unfilledItems,
  employeeLabel,
  notFoundLabel,
  emptyDayLabel,
  cellWidth,
  slotsPerDay,
}) {
  const dayWidth = slotsPerDay * cellWidth;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        borderCollapse: 'collapse',
        minWidth: 200 + dayWidth,
        tableLayout: 'fixed',
        width: '100%',
        background: '#ffffff',
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0, 38, 66, 0.08)',
      }}
      >
        <thead>
          <tr>
            <th style={{
              position: 'sticky',
              left: 0,
              zIndex: 10,
              background: '#f4faff',
              padding: '10px 16px',
              borderBottom: '2px solid #dee7e7',
              width: '200px',
              minWidth: '200px',
              maxWidth: '200px',
              textAlign: 'left',
              fontSize: '14px',
              fontWeight: '700',
              color: '#002642',
            }}
            >
              {employeeLabel}
            </th>
            <th style={{
              padding: '10px 4px',
              borderBottom: '2px solid #dee7e7',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: '600',
              color: '#4f646f',
              background: '#f4faff',
              width: dayWidth,
              minWidth: dayWidth,
              maxWidth: dayWidth,
            }}
            >
              {dateKey}
            </th>
          </tr>
          <tr>
            <th style={{
              position: 'sticky',
              left: 0,
              zIndex: 10,
              background: '#f4faff',
              padding: '4px 16px',
              borderBottom: '2px solid #dee7e7',
              width: '200px',
              minWidth: '200px',
              maxWidth: '200px',
            }}
            />
            <th style={{
              padding: '4px 2px',
              borderBottom: '2px solid #dee7e7',
              background: '#f4faff',
            }}
            >
              <div style={{ display: 'flex', gap: 0 }}>
                {Array.from({ length: slotsPerDay }).map((_, slotIndex) => {
                  const isHalfHour = slotIndex % 2 === 1;
                  return (
                    <div
                      key={slotIndex}
                      style={{
                        flex: `0 0 ${cellWidth}px`,
                        boxSizing: 'border-box',
                        borderRight: isHalfHour
                          ? '1px solid rgba(79, 100, 111, 0.12)'
                          : '1px solid rgba(79, 100, 111, 0.28)',
                        textAlign: 'center',
                        fontSize: isHalfHour ? 10 : 11,
                        color: isHalfHour ? '#8a9aa3' : '#4f646f',
                        fontWeight: isHalfHour ? 500 : 600,
                        lineHeight: 1.2,
                        paddingTop: 2,
                      }}
                    >
                      {formatScheduleSlotLabel(slotIndex)}
                    </div>
                  );
                })}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 && unfilledItems.length === 0 ? (
            <tr>
              <td
                colSpan={2}
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: '#4f646f',
                  fontWeight: 600,
                  fontSize: 14,
                  background: '#f8faff',
                }}
              >
                {emptyDayLabel}
              </td>
            </tr>
          ) : null}
          {employees.map((emp, rowIndex) => {
            const myShifts = (day?.shifts || []).filter((shift) => {
              const ids = (shift.assigned_employees || shift.candidate_employees || []).map((e) => String(e.id));
              return ids.includes(String(emp.id));
            });

            return (
              <tr key={emp.id} style={{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f8faff' }}>
                <td style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  background: rowIndex % 2 === 0 ? '#ffffff' : '#f8faff',
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  width: '220px',
                  minWidth: '220px',
                  maxWidth: '220px',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#002642',
                }}
                >
                  {emp.full_name || emp.name || emp.email || `#${emp.id}`}
                </td>
                <td style={{
                  padding: 0,
                  borderBottom: '1px solid #f0f0f0',
                  height: 72,
                  position: 'relative',
                  ...scheduleSlotGridStyle(cellWidth, rowIndex % 2 === 0 ? '#ffffff' : '#f8faff'),
                  width: dayWidth,
                  minWidth: dayWidth,
                  maxWidth: dayWidth,
                }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {myShifts.map((shift) => {
                      const startSlots = timeToSlotOffset(shift.start_time);
                      const endSlots = timeToSlotOffset(shift.end_time || shift.start_time);
                      const leftPx = startSlots * cellWidth;
                      const widthPx = Math.max((endSlots - startSlots) * cellWidth, 20);
                      return (
                        <div
                          key={shift.id}
                          style={{
                            position: 'absolute',
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                            top: 12,
                            height: 54,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '0px 4px',
                            fontSize: 11,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            boxShadow: '0 2px 8px rgba(102,126,234,0.25)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            ...scheduleShiftBlockStyle,
                          }}
                        >
                          <div style={{ ...scheduleShiftBlockLineStyle, fontWeight: 700, fontSize: 11 }}>
                            {getShiftPositionTitle(shift)}
                          </div>
                          <div style={{ ...scheduleShiftBlockLineStyle, fontSize: 10, opacity: 0.9 }}>
                            {`${String(shift.start_time || '').slice(0, 5)} - ${String(shift.end_time || '').slice(0, 5)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
          {unfilledItems.map((item) => {
            const rowBg = '#fff6f0';
            return (
              <tr key={`unfilled-${item.requirement_id}`} style={{ background: rowBg }}>
                <td style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  background: rowBg,
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  width: '220px',
                  minWidth: '220px',
                  maxWidth: '220px',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#8d1d1d',
                }}
                >
                  {getPositionLabel({
                    position_id: item.position_id,
                    position_title: item.position_title || item.position,
                  }, item.position_title || '—')}
                </td>
                <td style={{
                  padding: 0,
                  borderBottom: '1px solid #f0f0f0',
                  height: 72,
                  position: 'relative',
                  ...scheduleSlotGridStyle(cellWidth, rowBg),
                  width: dayWidth,
                  minWidth: dayWidth,
                  maxWidth: dayWidth,
                }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {renderTimeSlotBlock({
                      startTime: item.start_time,
                      endTime: item.end_time,
                      title: notFoundLabel,
                      subtitle: `${String(item.start_time || '').slice(0, 5)} - ${String(item.end_time || '').slice(0, 5)}`,
                      cellWidth,
                      background: 'linear-gradient(135deg, #ffd6a5 0%, #ffb085 100%)',
                      color: '#5a1a1a',
                      border: '2px dashed #8d1d1d',
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function buildDayScheduleEntries(dateKey, displaySchedule, unfilledNotFoundRequirements, branchLabel = '') {
  const shiftEntries = normalizeArray(displaySchedule?.shifts)
    .filter((shift) => formatDate(shift.date) === dateKey)
    .map((shift) => ({
      key: `shift-${shift.id}`,
      kind: 'shift',
      sortTime: parseTimeToHours(shift.start_time),
      position: getShiftPositionTitle(shift),
      employee: shift.employee_name || '—',
      branch: branchLabel,
      startTime: shift.start_time,
      endTime: shift.end_time,
    }));

  const unfilledEntries = unfilledNotFoundRequirements
    .filter((item) => formatDate(item.date) === dateKey)
    .map((item) => ({
      key: `unfilled-${item.requirement_id}`,
      kind: 'unfilled',
      sortTime: parseTimeToHours(item.start_time),
      position: getPositionLabel({
        position_id: item.position_id,
        position_title: item.position_title || item.position,
      }, item.position_title || '—'),
      branch: branchLabel,
      missingStaff: Number(item.missing_staff) || 1,
      startTime: item.start_time,
      endTime: item.end_time,
    }));

  return [...shiftEntries, ...unfilledEntries].sort((a, b) => a.sortTime - b.sortTime);
}

function buildMobileScheduleSections(visibleDates, displaySchedule, unfilledNotFoundRequirements, branchLabel = '') {
  return visibleDates.map((dateKey) => ({
    dateKey,
    entries: buildDayScheduleEntries(dateKey, displaySchedule, unfilledNotFoundRequirements, branchLabel),
  }));
}

function buildDateScheduleItems(dateKey, displaySchedule, unfilledNotFoundRequirements, notFoundLabel) {
  const shiftItems = normalizeArray(displaySchedule?.shifts)
    .filter((shift) => formatDate(shift.date) === dateKey)
    .map((shift) => ({
      key: `shift-${shift.id}`,
      kind: 'shift',
      startTime: shift.start_time,
      endTime: shift.end_time,
      title: getShiftPositionTitle(shift),
      subtitle: `${shift.employee_name || '---'} - ${String(shift.start_time || '').slice(0, 5)} - ${String(shift.end_time || '').slice(0, 5)}`,
      sortStart: timeToSlotOffset(shift.start_time),
      sortEnd: timeToSlotOffset(shift.end_time || shift.start_time),
    }));

  const unfilledItems = unfilledNotFoundRequirements
    .filter((item) => formatDate(item.date) === dateKey)
    .map((item) => ({
      key: `unfilled-${item.requirement_id}`,
      kind: 'unfilled',
      startTime: item.start_time,
      endTime: item.end_time,
      title: getPositionLabel({
        position_id: item.position_id,
        position_title: item.position_title || item.position,
      }, item.position_title || '---'),
      subtitle: `${notFoundLabel} - ${String(item.start_time || '').slice(0, 5)} - ${String(item.end_time || '').slice(0, 5)}`,
      sortStart: timeToSlotOffset(item.start_time),
      sortEnd: timeToSlotOffset(item.end_time || item.start_time),
    }));

  return [...shiftItems, ...unfilledItems].sort((a, b) => {
    if (a.sortStart !== b.sortStart) return a.sortStart - b.sortStart;
    return a.sortEnd - b.sortEnd;
  });
}

function assignScheduleItemLanes(items) {
  const laneEnds = [];

  return items.map((item) => {
    const itemStart = item.sortStart;
    const itemEnd = item.sortEnd > item.sortStart ? item.sortEnd : SCHEDULE_SLOTS_PER_DAY;
    let lane = laneEnds.findIndex((end) => end <= itemStart);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(itemEnd);
    } else {
      laneEnds[lane] = itemEnd;
    }

    return { ...item, lane };
  });
}

function DateScheduleGrid({
  dates,
  displaySchedule,
  unfilledItems,
  dateLabel,
  notFoundLabel,
  cellWidth,
  slotsPerDay,
}) {
  const dateColumnWidth = 180;
  const dayWidth = slotsPerDay * cellWidth;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        borderCollapse: 'collapse',
        minWidth: dateColumnWidth + dayWidth,
        tableLayout: 'fixed',
        width: '100%',
        background: '#ffffff',
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0, 38, 66, 0.08)',
      }}
      >
        <thead>
          <tr>
            <th style={{
              position: 'sticky',
              left: 0,
              zIndex: 20,
              background: '#f4faff',
              padding: '10px 16px',
              borderBottom: '2px solid #dee7e7',
              width: dateColumnWidth,
              minWidth: dateColumnWidth,
              maxWidth: dateColumnWidth,
              textAlign: 'left',
              fontSize: 14,
              fontWeight: 700,
              color: '#002642',
            }}
            >
              {dateLabel}
            </th>
            <th style={{
              padding: '6px 2px',
              borderBottom: '2px solid #dee7e7',
              background: '#f4faff',
              width: dayWidth,
              minWidth: dayWidth,
              maxWidth: dayWidth,
            }}
            >
              <div style={{ display: 'flex', gap: 0 }}>
                {Array.from({ length: slotsPerDay }).map((_, slotIndex) => {
                  const isHalfHour = slotIndex % 2 === 1;
                  return (
                    <div
                      key={slotIndex}
                      style={{
                        flex: `0 0 ${cellWidth}px`,
                        boxSizing: 'border-box',
                        borderRight: isHalfHour
                          ? '1px solid rgba(79, 100, 111, 0.12)'
                          : '1px solid rgba(79, 100, 111, 0.28)',
                        textAlign: 'center',
                        fontSize: isHalfHour ? 10 : 11,
                        color: isHalfHour ? '#8a9aa3' : '#4f646f',
                        fontWeight: isHalfHour ? 500 : 600,
                        lineHeight: 1.2,
                        paddingTop: 2,
                      }}
                    >
                      {formatScheduleSlotLabel(slotIndex)}
                    </div>
                  );
                })}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {dates.map((dateKey, rowIndex) => {
            const items = assignScheduleItemLanes(
              buildDateScheduleItems(dateKey, displaySchedule, unfilledItems, notFoundLabel),
            );
            const laneCount = Math.max(1, ...items.map((item) => item.lane + 1));
            const rowHeight = Math.max(64, 18 + laneCount * 56);
            const rowBg = rowIndex % 2 === 0 ? '#ffffff' : '#f8faff';

            return (
              <tr key={dateKey} style={{ background: rowBg }}>
                <td style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  background: rowBg,
                  padding: '12px 16px',
                  borderBottom: '1px solid #edf2f2',
                  width: dateColumnWidth,
                  minWidth: dateColumnWidth,
                  maxWidth: dateColumnWidth,
                  height: rowHeight,
                  boxSizing: 'border-box',
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#002642',
                  verticalAlign: 'top',
                }}
                >
                  {dateKey}
                </td>
                <td style={{
                  padding: 0,
                  borderBottom: '1px solid #edf2f2',
                  height: rowHeight,
                  position: 'relative',
                  ...scheduleSlotGridStyle(cellWidth, rowBg),
                  width: dayWidth,
                  minWidth: dayWidth,
                  maxWidth: dayWidth,
                }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {items.map((item) => {
                      const startSlots = Math.max(0, Math.min(slotsPerDay, timeToSlotOffset(item.startTime)));
                      const rawEndSlots = timeToSlotOffset(item.endTime || item.startTime);
                      const endSlots = Math.max(
                        startSlots,
                        Math.min(slotsPerDay, rawEndSlots > startSlots ? rawEndSlots : slotsPerDay),
                      );
                      const leftPx = startSlots * cellWidth;
                      const remainingWidth = Math.max(20, dayWidth - leftPx);
                      const widthPx = Math.min(Math.max((endSlots - startSlots) * cellWidth, 56), remainingWidth);
                      const isUnfilled = item.kind === 'unfilled';

                      return (
                        <div
                          key={item.key}
                          style={{
                            position: 'absolute',
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                            top: 9 + item.lane * 56,
                            height: 46,
                            background: isUnfilled
                              ? 'linear-gradient(135deg, #ffd6a5 0%, #ffb085 100%)'
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: isUnfilled ? '#5a1a1a' : '#fff',
                            borderRadius: 8,
                            padding: '4px 6px',
                            fontSize: 11,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            boxShadow: isUnfilled
                              ? '0 2px 8px rgba(141, 29, 29, 0.12)'
                              : '0 2px 8px rgba(102,126,234,0.25)',
                            border: isUnfilled ? '2px dashed #8d1d1d' : '1px solid rgba(255,255,255,0.12)',
                            boxSizing: 'border-box',
                            ...scheduleShiftBlockStyle,
                          }}
                        >
                          <div style={{ ...scheduleShiftBlockLineStyle, fontWeight: 700, fontSize: 11 }}>
                            {item.title}
                          </div>
                          <div style={{ ...scheduleShiftBlockLineStyle, fontSize: 10, opacity: 0.9 }}>
                            {item.subtitle}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderTimeSlotBlock({
  startTime,
  endTime,
  title,
  subtitle,
  cellWidth,
  background,
  color,
  border,
}) {
  const startSlots = timeToSlotOffset(startTime);
  const endSlots = timeToSlotOffset(endTime || startTime);
  const leftPx = startSlots * cellWidth;
  const widthPx = Math.max((endSlots - startSlots) * cellWidth, 20);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        top: 12,
        height: 48,
        background,
        color,
        borderRadius: 8,
        padding: '4px 6px',
        fontSize: 11,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        boxShadow: '0 2px 8px rgba(141, 29, 29, 0.12)',
        border,
        boxSizing: 'border-box',
        ...scheduleShiftBlockStyle,
      }}
    >
      <div style={{ ...scheduleShiftBlockLineStyle, fontWeight: 700, fontSize: 11 }}>{title}</div>
      {subtitle ? (
        <div style={{ ...scheduleShiftBlockLineStyle, fontSize: 10, opacity: 0.9 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function hasStaffingRequirements(scheduleRead) {
  return normalizeArray(scheduleRead?.shifts).length > 0
    || normalizeArray(scheduleRead?.unfilled_requirements).length > 0;
}

const EMPTY_SCHEDULE_VERSIONS = { draft: null, published: null };

async function loadScheduleVersions(period, branchId) {
  return fetchScheduleVersions(period, branchId);
}

function pickActiveVersion(versions, current) {
  if (current && versions[current]) {
    return current;
  }
  if (versions.draft) return 'draft';
  if (versions.published) return 'published';
  return 'draft';
}

function getStatusLabel(status, t) {
  if (status === 'published') return t.published;
  return t.draft;
}

function getStatusBadgeStyle(status) {
  if (status === 'published') {
    return { background: 'rgba(215, 173, 207, 0.55)', color: '#002642' };
  }
  return { background: '#dee7e7', color: '#002642' };
}

export default function ScheduleReview({ language }) {
  const r = useTabResponsive(1480);
  const positionTitleRevision = usePositionTitleRevision();
  const { markUnsaved, markSaved } = useUnsavedChanges();
  const isMobile = r.isMobile;
  const mobileStyles = isMobile ? MOBILE_MANAGER_SCHEDULE_STYLES : null;
  const { user, isLoading: isAuthLoading } = useAuth();
  const hasCompany = Boolean(user?.company);
  const companyId = user?.company?.id || user?.company_id || null;
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [generationStartMonday, setGenerationStartMonday] = useState(() => defaultSchedulePeriod().start_date);
  const [deleteWeekMonday, setDeleteWeekMonday] = useState(() => defaultSchedulePeriod().start_date);
  const [viewPeriod, setViewPeriod] = useState(() => defaultSchedulePeriod());
  const [scheduleVersions, setScheduleVersions] = useState(EMPTY_SCHEDULE_VERSIONS);
  const [activeVersion, setActiveVersion] = useState('draft');
  const [coverageByDate, setCoverageByDate] = useState({});
  const [assignEmployeeIds, setAssignEmployeeIds] = useState({});
  const [manualEmployees, setManualEmployees] = useState([]);
  const [manualEmployeesLoaded, setManualEmployeesLoaded] = useState(false);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => formatLocalDate(new Date()));
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const texts = {
    ru: {
      title: 'Расписание',
      subtitle: 'Календарь смен по филиалам. Генерация и удаление — по неделям с понедельника.',
      employee: 'Сотрудник',
      date: 'Дата',
      exportCSV: 'Экспорт CSV',
      branch: 'Филиал',
      startDate: 'Начало периода (понедельник)',
      deleteWeekStart: 'Неделя для удаления (с понедельника)',
      oneWeek: '1 неделя',
      twoWeeks: '2 недели',
      fourWeeks: '4 недели',
      generate: 'Сгенерировать',
      deleteWeek: 'Удалить неделю',
      publish: 'Опубликовать',
      status: 'Статус',
      draft: 'Черновик',
      published: 'Опубликовано',
      viewDraft: 'Черновик',
      viewPublished: 'Опубликовано',
      noShiftsInVersion: 'В этой версии расписания нет назначенных смен.',
      noShiftsThisDay: 'На этот день смен нет.',
      notFound: 'Не найдено',
      noSchedule: 'Расписание ещё не сгенерировано.',
      noScheduleHint: 'Для генерации нужны шаблоны потребности, часы филиала и доступность сотрудников.',
      noEmployeesAndRequirements: 'Нет сотрудников и требований для генерации расписания.',
      generating: 'Генерация...',
      loading: 'Загрузка...',
      generated: 'Черновик расписания создан.',
      generatedRecovered: 'Расписание сохранено на сервере. Данные подгружены автоматически.',
      publishedDone: 'Расписание опубликовано.',
      weekDeleted: 'Неделя расписания удалена.',
      deleteWeekError: 'Не удалось удалить неделю расписания.',
      confirmDeleteWeek: 'Удалить расписание за неделю с {start} по {end}?',
      conflictError: 'На выбранные даты уже есть расписание. Сначала удалите старое.',
      mondayRequired: 'Дата начала должна быть понедельником.',
      unfilledTitle: 'Незаполненные смены',
      assign: 'Назначить',
      chooseEmployee: 'Выберите сотрудника',
      noEmployeesAvailable: 'Нет доступных сотрудников',
      assigned: 'Сотрудник назначен на смену.',
      assignError: 'Не удалось назначить сотрудника.',
      loadedPeriod: 'Загруженный период',
      prevMonth: 'Предыдущий месяц',
      nextMonth: 'Следующий месяц',
      legendDraftShifts: 'Смены (черновик)',
      legendPublishedShifts: 'Опубликованные смены',
      legendUnfilled: 'Незаполненные смены',
      position: 'Должность',
      assignedBadge: 'Назначено',
      unfilledBadge: 'Не назначено',
      missingStaff: 'Не хватает: {count}',
      moreShifts: '+{count}',
      shiftTime: 'ВРЕМЯ СМЕНЫ',
      shiftSingular: 'смена',
      shiftPlural: 'смен',
      selectDay: 'Выберите день',
      selectDayHint: 'Нажмите на день с индикатором смены, чтобы увидеть детали.',
      closeDetail: 'Закрыть',
      legendNoShift: 'Нет смен',
      calendarTitle: 'Расписание',
    },
    en: {
      title: 'Schedule',
      subtitle: 'Branch calendar view. Generate and delete schedules week by week from Monday.',
      employee: 'Employee',
      date: 'Date',
      exportCSV: 'Export CSV',
      branch: 'Branch',
      startDate: 'Period start (Monday)',
      deleteWeekStart: 'Week to delete (from Monday)',
      oneWeek: '1 week',
      twoWeeks: '2 weeks',
      fourWeeks: '4 weeks',
      generate: 'Generate',
      deleteWeek: 'Delete week',
      publish: 'Publish',
      status: 'Status',
      draft: 'Draft',
      published: 'Published',
      viewDraft: 'Draft',
      viewPublished: 'Published',
      noShiftsInVersion: 'This schedule version has no assigned shifts.',
      noShiftsThisDay: 'No shifts on this day.',
      notFound: 'Not found',
      noSchedule: 'Schedule has not been generated yet.',
      noScheduleHint: 'The solver needs staffing templates, branch hours, and employee availability.',
      noEmployeesAndRequirements: 'No employees or staffing requirements to generate a schedule.',
      generating: 'Generating...',
      loading: 'Loading...',
      generated: 'Draft schedule generated.',
      generatedRecovered: 'Schedule was saved on the server. Data loaded automatically.',
      publishedDone: 'Schedule published.',
      weekDeleted: 'Schedule week deleted.',
      deleteWeekError: 'Failed to delete schedule week.',
      confirmDeleteWeek: 'Delete schedule for week {start} to {end}?',
      conflictError: 'A schedule already exists for these dates. Delete the old one first.',
      mondayRequired: 'Start date must be a Monday.',
      unfilledTitle: 'Unfilled shifts',
      assign: 'Assign',
      chooseEmployee: 'Choose employee',
      noEmployeesAvailable: 'No available employees',
      assigned: 'Employee assigned to shift.',
      assignError: 'Failed to assign employee.',
      loadedPeriod: 'Loaded period',
      prevMonth: 'Previous month',
      nextMonth: 'Next month',
      legendDraftShifts: 'Draft shifts',
      legendPublishedShifts: 'Published shifts',
      legendUnfilled: 'Unfilled shifts',
      position: 'Position',
      assignedBadge: 'Assigned',
      unfilledBadge: 'Unassigned',
      missingStaff: 'Missing: {count}',
      moreShifts: '+{count}',
      shiftTime: 'SHIFT TIME',
      shiftSingular: 'shift',
      shiftPlural: 'shifts',
      selectDay: 'Select a day',
      selectDayHint: 'Click a day with a shift indicator to see details here.',
      closeDetail: 'Close',
      legendNoShift: 'No shift',
      calendarTitle: 'Schedule',
    },
  };

  const t = texts[language] || texts.ru;

  const cellWidth = SCHEDULE_CELL_WIDTH;
  const slotsPerDay = SCHEDULE_SLOTS_PER_DAY;

  const schedule = scheduleVersions[activeVersion] || null;
  const scheduleStatus = schedule?.status || activeVersion;
  const hasAnySchedule = Boolean(
    scheduleVersions.draft || scheduleVersions.published
  );
  const unfilledRequirements = useMemo(
    () => normalizeArray(schedule?.unfilled_requirements),
    [schedule]
  );

  const unfilledNotFoundRequirements = useMemo(
    () => getCompletelyUnfilledRequirements(schedule),
    [schedule]
  );

  const displaySchedule = useMemo(() => {
    if (!schedule) {
      return null;
    }

    if (!employeesLoaded) {
      return { ...schedule, shifts: [] };
    }

    return {
      ...schedule,
      shifts: normalizeArray(schedule.shifts).filter((shift) => Boolean(shift?.employee_id)),
    };
  }, [schedule, employeesLoaded]);

  const scheduleStartDate = viewPeriod.start_date;
  const scheduleEndDate = viewPeriod.end_date;

  const selectedBranchLabel = useMemo(() => {
    const branch = branches.find((item) => Number(item.id) === Number(selectedBranchId));
    return branch?.name || '';
  }, [branches, selectedBranchId]);

  const groupedScheduleByDate = useMemo(
    () => buildGroupedScheduleCounts(displaySchedule, unfilledNotFoundRequirements),
    [displaySchedule, unfilledNotFoundRequirements, positionTitleRevision],
  );

  const calendarEntriesByDate = useMemo(() => {
    const dateKeys = new Set([
      ...normalizeArray(displaySchedule?.shifts).map((shift) => formatDate(shift.date)),
      ...unfilledNotFoundRequirements.map((item) => formatDate(item.date)),
    ]);

    const byDate = {};
    dateKeys.forEach((dateKey) => {
      byDate[dateKey] = buildDayScheduleEntries(
        dateKey,
        displaySchedule,
        unfilledNotFoundRequirements,
        selectedBranchLabel,
      );
    });
    return byDate;
  }, [
    displaySchedule,
    unfilledNotFoundRequirements,
    positionTitleRevision,
    selectedBranchLabel,
  ]);

  const calendarSelectedDayEntries = useMemo(
    () => buildDayScheduleEntries(
      calendarSelectedDate,
      displaySchedule,
      unfilledNotFoundRequirements,
      selectedBranchLabel,
    ),
    [
      calendarSelectedDate,
      displaySchedule,
      unfilledNotFoundRequirements,
      positionTitleRevision,
      selectedBranchLabel,
    ],
  );

  const schedules = useMemo(
    () => buildFullScheduleRange(
      displaySchedule,
      unfilledNotFoundRequirements,
      scheduleStartDate,
      scheduleEndDate,
    ),
    [
      displaySchedule,
      unfilledNotFoundRequirements,
      scheduleEndDate,
      scheduleStartDate,
      positionTitleRevision,
    ],
  );

  const reloadScheduleVersions = useCallback(async (preferredVersion, period = null, branchId = selectedBranchId) => {
    const targetPeriod = period || viewPeriod;
    const versions = await loadScheduleVersions(targetPeriod, branchId);
    setScheduleVersions(versions);
    setActiveVersion((current) => pickActiveVersion(versions, preferredVersion || current));
    return versions;
  }, [selectedBranchId, viewPeriod]);

  const reloadCoverage = useCallback(async (branchId = selectedBranchId, monthAnchor = calendarMonth) => {
    if (!branchId) {
      setCoverageByDate({});
      return;
    }

    const monthStart = startOfMonthDate(monthAnchor);
    const monthEnd = endOfMonthDate(monthAnchor);
    const coverage = await fetchScheduleCoverage({
      branch_id: branchId,
      date_from: formatLocalDate(monthStart),
      date_to: formatLocalDate(monthEnd),
    });
    setCoverageByDate(coverage);
  }, [calendarMonth, selectedBranchId]);

  const runGenerate = useCallback(async (weeks) => {
    if (!selectedBranchId) {
      setError(t.noScheduleHint);
      return;
    }

    const mondayStart = snapToMonday(generationStartMonday);
    if (!isMonday(mondayStart)) {
      setError(t.mondayRequired);
      return;
    }

    const period = getWeekPeriodRange(mondayStart, weeks);
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const applyGeneratedSchedule = (generated, versions = null) => {
      const nextVersions = versions || { ...scheduleVersions, draft: generated };
      applyLoadedScheduleState({
        versions: nextVersions,
        period,
        setScheduleVersions,
        setActiveVersion,
        setViewPeriod,
        setCalendarSelectedDate,
        setCalendarMonth,
      });
      markUnsaved(SCHEDULE_DRAFT_SCOPE);
    };

    try {
      const conflicts = await findOverlappingSchedules({
        branch_id: selectedBranchId,
        start_date: period.start_date,
        end_date: period.end_date,
      });

      if (conflicts.length > 0) {
        setError(t.conflictError);
        return;
      }

      const generated = await generateScheduleWeeks(mondayStart, weeks, selectedBranchId);
      const visibleShiftCount = countVisibleShifts(generated);

      applyGeneratedSchedule(generated);
      await reloadCoverage(selectedBranchId, period.start_date);

      if (visibleShiftCount > 0) {
        setSuccess(t.generated);
      } else if (!hasStaffingRequirements(generated)) {
        setError(t.noEmployeesAndRequirements);
      } else {
        setError(t.noScheduleHint);
      }
    } catch (e) {
      if (isScheduleGenerateTransportError(e)) {
        try {
          const versions = await loadScheduleVersions(period, selectedBranchId);
          const loaded = versions.draft || versions.published;
          if (loaded?.id && scheduleCoversPeriod(loaded, period)) {
            applyGeneratedSchedule(loaded, versions);
            await reloadCoverage(selectedBranchId, period.start_date);
            const visibleShiftCount = countVisibleShifts(loaded);
            if (visibleShiftCount > 0 || hasStaffingRequirements(loaded)) {
              setSuccess(t.generatedRecovered);
            } else {
              setError(t.noScheduleHint);
            }
            return;
          }
        } catch {
          // Fall through to the original error message.
        }
      }
      setError(extractApiErrorMessage(e, t.noScheduleHint, language));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    generationStartMonday,
    language,
    markUnsaved,
    reloadCoverage,
    scheduleVersions,
    selectedBranchId,
    t.conflictError,
    t.generated,
    t.generatedRecovered,
    t.mondayRequired,
    t.noEmployeesAndRequirements,
    t.noScheduleHint,
  ]);

  const handleDeleteWeek = useCallback(async () => {
    if (!selectedBranchId) return;

    const mondayStart = snapToMonday(deleteWeekMonday);
    const weekPeriod = getWeekPeriodRange(mondayStart, 1);
    const confirmText = t.confirmDeleteWeek
      .replace('{start}', weekPeriod.start_date)
      .replace('{end}', weekPeriod.end_date);

    if (!window.confirm(confirmText)) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await deleteScheduleWeek({
        branch_id: selectedBranchId,
        start_date: weekPeriod.start_date,
        end_date: weekPeriod.end_date,
      });
      await reloadScheduleVersions('draft', viewPeriod, selectedBranchId);
      await reloadCoverage(selectedBranchId, calendarMonth);
      setSuccess(t.weekDeleted);
    } catch (e) {
      setError(extractApiErrorMessage(e, t.deleteWeekError, language));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    calendarMonth,
    deleteWeekMonday,
    language,
    reloadCoverage,
    reloadScheduleVersions,
    selectedBranchId,
    t.confirmDeleteWeek,
    t.deleteWeekError,
    t.weekDeleted,
    viewPeriod,
  ]);

  useEffect(() => {
    if (isAuthLoading || !hasCompany || !companyId) {
      return undefined;
    }

    let cancelled = false;

    async function loadBranches() {
      try {
        const data = await listBranches(companyId);
        if (cancelled) return;
        const normalized = normalizeArray(data);
        setBranches(normalized);
        setSelectedBranchId((current) => current || normalized[0]?.id || null);
      } catch {
        if (!cancelled) {
          setBranches([]);
        }
      }
    }

    void loadBranches();

    return () => {
      cancelled = true;
    };
  }, [companyId, hasCompany, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading) {
      return undefined;
    }

    let cancelled = false;

    async function loadInitialData() {
      setIsLoading(true);
      setError('');

      if (!hasCompany || !selectedBranchId) {
        if (cancelled) return;
        setScheduleVersions(EMPTY_SCHEDULE_VERSIONS);
        setActiveVersion('draft');
        setEmployeesLoaded(true);
        setIsLoading(false);
        return;
      }

      try {
        const monthPeriod = buildCalendarMonthPeriod(calendarMonth);
        const versions = await loadScheduleVersions(monthPeriod, selectedBranchId);

        if (cancelled) return;

        setScheduleVersions(versions);
        setActiveVersion((current) => pickActiveVersion(versions, current));

        const loadedSchedule = versions.draft || versions.published;
        if (loadedSchedule) {
          const derived = deriveSchedulePeriod(loadedSchedule, monthPeriod);
          setViewPeriod(derived);
        }
      } catch (error) {
        if (!cancelled && !isMissingCompanyError(error)) {
          setError(extractApiErrorMessage(error, t.noScheduleHint, language));
          setScheduleVersions(EMPTY_SCHEDULE_VERSIONS);
        }
      } finally {
        if (!cancelled) {
          setEmployeesLoaded(true);
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [calendarMonth, hasCompany, isAuthLoading, language, selectedBranchId, t.noScheduleHint]);

  useEffect(() => {
    if (!selectedBranchId || !hasCompany || isAuthLoading || isLoading) {
      return undefined;
    }

    const loadedSchedule = scheduleVersions.draft || scheduleVersions.published;
    const monthPeriod = buildCalendarMonthPeriod(calendarMonth);
    if (loadedSchedule?.id && scheduleCoversPeriod(loadedSchedule, monthPeriod)) {
      return undefined;
    }

    const hasCoverageInMonth = Object.keys(coverageByDate).some((dateKey) => (
      dateKey >= monthPeriod.start_date && dateKey <= monthPeriod.end_date
    ));
    if (!hasCoverageInMonth) {
      return undefined;
    }

    let cancelled = false;

    async function syncScheduleFromCoverage() {
      try {
        const versions = await loadScheduleVersions(monthPeriod, selectedBranchId);
        if (cancelled) return;

        const loaded = versions.draft || versions.published;
        if (!loaded?.id) return;

        applyLoadedScheduleState({
          versions,
          period: deriveSchedulePeriod(loaded, monthPeriod),
          setScheduleVersions,
          setActiveVersion,
          setViewPeriod,
          setCalendarSelectedDate,
          setCalendarMonth,
        });
      } catch {
        // Ignore background sync errors.
      }
    }

    void syncScheduleFromCoverage();

    return () => {
      cancelled = true;
    };
  }, [
    calendarMonth,
    coverageByDate,
    hasCompany,
    isAuthLoading,
    isLoading,
    scheduleVersions.draft,
    scheduleVersions.published,
    selectedBranchId,
  ]);

  useEffect(() => {
    if (!selectedBranchId) return undefined;
    let cancelled = false;

    async function loadCoverage() {
      try {
        await reloadCoverage(selectedBranchId, calendarMonth);
      } catch {
        if (!cancelled) {
          setCoverageByDate({});
        }
      }
    }

    void loadCoverage();

    return () => {
      cancelled = true;
    };
  }, [calendarMonth, reloadCoverage, selectedBranchId]);

  useEffect(() => {
    if (!error && !success) return undefined;
    const timer = setTimeout(() => {
      setError('');
      setSuccess('');
    }, error ? 5000 : 2500);
    return () => clearTimeout(timer);
  }, [error, success]);

  const handlePublish = async () => {
    if (!schedule?.id || activeVersion !== 'draft') return;
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const published = await publishScheduleForPeriod({
        ...schedule,
        branch_id: schedule.branch_id || selectedBranchId,
      });
      setScheduleVersions({
        draft: null,
        published,
      });
      setActiveVersion('published');
      markSaved(SCHEDULE_DRAFT_SCOPE);
      await reloadCoverage(selectedBranchId, calendarMonth);
      setSuccess(t.publishedDone);
    } catch (e) {
      setError(extractApiErrorMessage(e, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEditDraft = activeVersion === 'draft' && Boolean(schedule);

  useEffect(() => {
    if (!schedule?.id || !canEditDraft || unfilledRequirements.length === 0) {
      setManualEmployees([]);
      setManualEmployeesLoaded(false);
      return undefined;
    }

    let cancelled = false;

    async function loadManualEmployees() {
      setManualEmployeesLoaded(false);
      try {
        const employees = filterRealEmployees(normalizeArray(await listEmployees()));
        if (!cancelled) {
          setManualEmployees(employees);
          setManualEmployeesLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setManualEmployees([]);
          setManualEmployeesLoaded(true);
          setError(extractApiErrorMessage(e, t.assignError, language));
        }
      }
    }

    void loadManualEmployees();

    return () => {
      cancelled = true;
    };
  }, [canEditDraft, language, schedule?.id, t.assignError, unfilledRequirements.length]);

  const handleAssignRequirement = async (requirementId) => {
    const employeeId = assignEmployeeIds[requirementId];
    if (!schedule?.id || !requirementId || !employeeId) return;

    const requirement = unfilledRequirements.find(
      (item) => Number(item.requirement_id) === Number(requirementId),
    );
    const requirementDate = String(requirement?.date || '').slice(0, 10);
    const scheduleId = resolveScheduleIdForDate(schedule, requirementDate) || schedule.id;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await assignRequirement(scheduleId, requirementId, {
        employee_id: Number(employeeId),
      });
      await reloadScheduleVersions('draft');
      setAssignEmployeeIds((prev) => ({ ...prev, [requirementId]: '' }));
      setSuccess(t.assigned);
    } catch (e) {
      setError(extractApiErrorMessage(e, t.assignError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportCSV = () => {
    const rows = [['date', 'position', 'employee', 'start_time', 'end_time']];
    schedules.forEach((s) => {
      (s.shifts || []).forEach((shift) => {
        rows.push([
          s.date,
          getShiftPositionTitle(shift),
          shift.assigned_employees?.[0]?.full_name || '',
          String(shift.start_time || '').slice(0, 5),
          String(shift.end_time || '').slice(0, 5),
        ]);
      });
    });
    downloadCSV('generated_schedule.csv', rows);
  };

  const hasShifts = normalizeArray(schedule?.shifts).some((shift) => Boolean(shift?.employee_id));
  const hasGridContent = hasShifts || unfilledNotFoundRequirements.length > 0;
  const versionOptions = [
    { id: 'draft', label: t.viewDraft, schedule: scheduleVersions.draft },
    { id: 'published', label: t.viewPublished, schedule: scheduleVersions.published },
  ];
  const actionButtonStyle = isMobile ? { flex: '1 1 calc(50% - 6px)', minWidth: '140px' } : {};

  if (isLoading || isAuthLoading) {
    return (
      <section className="schedule-tab">
        <div className="st-page">
          <div className="st-loading">{t.loading}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="schedule-tab">
      <div className="st-page">
        <div className="st-page-header">
          <div>
            <h1 className="st-page-title">{t.title}</h1>
            {!isMobile && <p className="st-page-subtitle">{t.subtitle}</p>}
          </div>

          <span className={`st-status-badge ${scheduleStatus === 'published' ? 'st-status-badge--published' : 'st-status-badge--draft'}`}>
            {t.status}: {getStatusLabel(scheduleStatus, t)}
          </span>
        </div>

        <div className="st-version-toggle">
          {versionOptions.map(({ id, label, schedule: versionSchedule }) => {
            const isActive = activeVersion === id;
            const isDisabled = !versionSchedule;

            return (
              <button
                key={id}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  setActiveVersion(id);
                  setError('');
                  setSuccess('');
                }}
                className={`st-version-btn ${isActive ? 'st-version-btn--active' : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && <div className="st-alert st-alert--error">{error}</div>}
        {success && <div className="st-alert st-alert--success">{success}</div>}

        <div className="st-control-panel">
          <label className="st-field" style={{ width: isMobile ? '100%' : '220px' }}>
            <span className="st-field-label">{t.branch}</span>
            <select
              className="st-select"
              value={selectedBranchId || ''}
              onChange={(e) => {
                const branchId = Number(e.target.value) || null;
                setSelectedBranchId(branchId);
                setScheduleVersions(EMPTY_SCHEDULE_VERSIONS);
                setActiveVersion('draft');
              }}
              disabled={!branches.length || isSubmitting}
            >
              {branches.length === 0 ? (
                <option value="">—</option>
              ) : (
                branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))
              )}
            </select>
          </label>

          <label className="st-field">
            <span className="st-field-label">{t.startDate}</span>
            <DateField
              language={language}
              className="st-input"
              value={generationStartMonday}
              onChange={(nextValue) => setGenerationStartMonday(snapToMonday(nextValue))}
            />
          </label>

          {[1, 2, 4].map((weeks) => (
            <button
              key={weeks}
              type="button"
              onClick={() => runGenerate(weeks)}
              disabled={isSubmitting || !selectedBranchId}
              className="st-btn st-btn--primary"
              style={actionButtonStyle}
            >
              {isSubmitting ? t.generating : (weeks === 1 ? t.oneWeek : weeks === 2 ? t.twoWeeks : t.fourWeeks)}
            </button>
          ))}

          {canEditDraft && schedule?.id && (
            <button
              onClick={handlePublish}
              disabled={isSubmitting || !hasShifts}
              className="st-btn st-btn--secondary"
              style={actionButtonStyle}
            >
              {t.publish}
            </button>
          )}
        </div>

        <div className="st-control-panel">
          <label className="st-field">
            <span className="st-field-label">{t.deleteWeekStart}</span>
            <DateField
              language={language}
              className="st-input"
              value={deleteWeekMonday}
              onChange={(nextValue) => setDeleteWeekMonday(snapToMonday(nextValue))}
            />
          </label>

          <button
            type="button"
            onClick={handleDeleteWeek}
            disabled={isSubmitting || !selectedBranchId}
            className="st-btn st-btn--danger"
            style={actionButtonStyle}
          >
            {t.deleteWeek}
          </button>
        </div>

        {schedule?.id && canEditDraft && unfilledRequirements.length > 0 && (
          <div className="st-unfilled-panel">
            <h3 className="st-unfilled-title">{t.unfilledTitle}</h3>
            {unfilledRequirements.map((item) => {
              const requirementId = item.requirement_id;

              return (
                <div key={requirementId} className="st-unfilled-item">
                  <div style={{ minWidth: isMobile ? 0 : 180, flex: '1 1 auto' }}>
                    <strong>
                      {getPositionLabel({
                        position_id: item.position_id,
                        position_title: item.position_title || item.position,
                      }, item.position_title || '—')}
                    </strong>
                    <div className="st-unfilled-meta">
                      {formatApiDateAsDisplay(item.date)} · {String(item.start_time || '').slice(0, 5)}–{String(item.end_time || '').slice(0, 5)}
                    </div>
                    {unfilledNotFoundRequirements.some((entry) => entry.requirement_id === requirementId) && (
                      <div className="st-unfilled-warning">{t.notFound}</div>
                    )}
                  </div>

                  <select
                    className="st-select"
                    value={assignEmployeeIds[requirementId] || ''}
                    onChange={(event) => setAssignEmployeeIds((prev) => ({
                      ...prev,
                      [requirementId]: event.target.value,
                    }))}
                    style={{ minWidth: isMobile ? 0 : 200, flex: '1 1 200px' }}
                    disabled={isSubmitting}
                  >
                    <option value="">
                      {!manualEmployeesLoaded
                        ? t.loading
                        : manualEmployees.length
                          ? t.chooseEmployee
                          : t.noEmployeesAvailable}
                    </option>
                    {manualEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name}
                        {employee.position?.name ? ` (${employee.position.name})` : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleAssignRequirement(requirementId)}
                    disabled={isSubmitting || !assignEmployeeIds[requirementId]}
                    className="st-btn st-btn--primary"
                  >
                    {t.assign}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="st-control-panel" style={{ justifyContent: 'flex-end' }}>
          <button
            onClick={exportCSV}
            disabled={!hasShifts}
            className="st-btn st-btn--primary"
            style={isMobile ? { width: '100%' } : {}}
          >
            {t.exportCSV}
          </button>
        </div>

        {hasCompany ? (
          <ManagerScheduleCalendar
            language={language}
            texts={t}
            calendarMonth={calendarMonth}
            onCalendarMonthChange={setCalendarMonth}
            selectedDate={calendarSelectedDate}
            onSelectedDateChange={setCalendarSelectedDate}
            groupedScheduleByDate={groupedScheduleByDate}
            entriesByDate={calendarEntriesByDate}
            scheduleStatus={scheduleStatus}
            scheduleStartDate={scheduleStartDate}
            scheduleEndDate={scheduleEndDate}
            selectedDayEntries={calendarSelectedDayEntries}
          />
        ) : (
          <div className="st-detail-empty">
            <p className="st-detail-empty-title">{t.noSchedule}</p>
            <p className="st-detail-empty-message">{t.noScheduleHint}</p>
          </div>
        )}
      </div>
    </section>
  );
}
