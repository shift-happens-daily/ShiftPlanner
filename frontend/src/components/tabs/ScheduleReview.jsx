import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultSchedulePeriod,
  deleteScheduleForPeriod,
  deriveSchedulePeriod,
  fetchScheduleVersions,
  formatLocalDate,
  generateScheduleForPeriod,
  getFourWeekPeriodRange,
  clearMergedScheduleBundle,
  persistMergedScheduleBundle,
  publishScheduleForPeriod,
  assignRequirement,
} from '../../services/scheduleService';
import { filterRealEmployees, listEmployees } from '../../services/employeeService';
import { useAuth } from '../../context/useAuth';
import { extractApiErrorMessage } from '../../services/error';
import { useIsMobile } from '../../hooks/useMediaQuery';

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
  const today = formatLocalDate(new Date());
  return getFourWeekPeriodRange(today) || defaultSchedulePeriod();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.shifts)) return value.shifts;
  return [];
}

const SCHEDULE_SLOT_MINUTES = 30;
const SCHEDULE_SLOTS_PER_DAY = (24 * 60) / SCHEDULE_SLOT_MINUTES;
const SCHEDULE_CELL_WIDTH = 24;

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
      start_time: shift.start_time,
      end_time: shift.end_time,
      position_title: shift.position || shift.position_title || '',
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

function countVisibleShifts(scheduleRead, realEmployeeIds) {
  return normalizeArray(scheduleRead?.shifts).filter((shift) => (
    realEmployeeIds.has(String(shift.employee_id))
  )).length;
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
                        fontSize: isHalfHour ? 8 : 9,
                        color: isHalfHour ? '#8a9aa3' : '#4f646f',
                        fontWeight: isHalfHour ? 500 : 600,
                        lineHeight: 1.1,
                        paddingTop: 1,
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
                            height: 48,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '0px 0px',
                            fontSize: 11,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            boxShadow: '0 2px 8px rgba(102,126,234,0.25)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 11 }}>
                            {shift.position_title || '—'}
                          </div>
                          <div style={{ fontSize: 10, opacity: 0.9 }}>
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
                  {item.position_title || '—'}
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

function buildDayScheduleEntries(dateKey, displaySchedule, unfilledNotFoundRequirements) {
  const shiftEntries = normalizeArray(displaySchedule?.shifts)
    .filter((shift) => formatDate(shift.date) === dateKey)
    .map((shift) => ({
      key: `shift-${shift.id}`,
      kind: 'shift',
      sortTime: parseTimeToHours(shift.start_time),
      position: shift.position || shift.position_title || '—',
      employee: shift.employee_name || '—',
      startTime: shift.start_time,
      endTime: shift.end_time,
    }));

  const unfilledEntries = unfilledNotFoundRequirements
    .filter((item) => formatDate(item.date) === dateKey)
    .map((item) => ({
      key: `unfilled-${item.requirement_id}`,
      kind: 'unfilled',
      sortTime: parseTimeToHours(item.start_time),
      position: item.position_title || '—',
      startTime: item.start_time,
      endTime: item.end_time,
    }));

  return [...shiftEntries, ...unfilledEntries].sort((a, b) => a.sortTime - b.sortTime);
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
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 11 }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 10, opacity: 0.9 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function hasStaffingRequirements(scheduleRead) {
  return normalizeArray(scheduleRead?.shifts).length > 0
    || normalizeArray(scheduleRead?.unfilled_requirements).length > 0;
}

const EMPTY_SCHEDULE_VERSIONS = { draft: null, published: null };

async function loadScheduleVersions() {
  return fetchScheduleVersions();
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
  const isMobile = useIsMobile();
  const { user, isLoading: isAuthLoading } = useAuth();
  const hasCompany = Boolean(user?.company);
  const [viewMode, setViewMode] = useState('day');
  const [periodForm, setPeriodForm] = useState(defaultPeriod);
  const [generatedPeriod, setGeneratedPeriod] = useState(null);
  const [scheduleVersions, setScheduleVersions] = useState(EMPTY_SCHEDULE_VERSIONS);
  const [activeVersion, setActiveVersion] = useState('draft');
  const [assignEmployeeIds, setAssignEmployeeIds] = useState({});
  const [realEmployeeIds, setRealEmployeeIds] = useState(new Set());
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const texts = {
    ru: {
      title: 'Просмотр сгенерированного расписания',
      subtitle: 'Выберите период, сгенерируйте смены и посмотрите их в табличном формате.',
      employee: 'Сотрудник',
      day: 'День',
      threeDay: '3 дня',
      month: 'Месяц',
      exportCSV: 'Экспорт CSV',
      startDate: 'Начало',
      endDate: 'Конец',
      generate: 'Сгенерировать',
      fillMonth: '4 недели',
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
      noScheduleHint: 'Алгоритму нужны шаблоны потребности, часы филиала и доступность сотрудников.',
      noEmployeesAndRequirements: 'Нет сотрудников и требований для генерации расписания.',
      generating: 'Генерация...',
      loading: 'Загрузка...',
      generated: 'Черновик расписания создан.',
      publishedDone: 'Расписание опубликовано.',
      deletePublished: 'Удалить',
      confirmDeletePublished: 'Вы точно хотите удалить опубликованное расписание?',
      publishedDeleted: 'Опубликованное расписание удалено.',
      deletePublishedError: 'Не удалось удалить опубликованное расписание.',
      unfilledTitle: 'Незаполненные смены',
      assign: 'Назначить',
      chooseEmployee: 'Выберите сотрудника',
      assigned: 'Сотрудник назначен на смену.',
      assignError: 'Не удалось назначить сотрудника.',
    },
    en: {
      title: 'Generated Schedule Review',
      subtitle: 'Pick a period, generate shifts and review them in a table.',
      employee: 'Employee',
      day: 'Day',
      threeDay: '3-day',
      month: 'Month',
      exportCSV: 'Export CSV',
      startDate: 'Start',
      endDate: 'End',
      generate: 'Generate',
      fillMonth: '4 weeks',
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
      publishedDone: 'Schedule published.',
      deletePublished: 'Delete',
      confirmDeletePublished: 'Are you sure you want to delete the published schedule?',
      publishedDeleted: 'Published schedule deleted.',
      deletePublishedError: 'Failed to delete published schedule.',
      unfilledTitle: 'Unfilled shifts',
      assign: 'Assign',
      chooseEmployee: 'Choose employee',
      assigned: 'Employee assigned to shift.',
      assignError: 'Failed to assign employee.',
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
      shifts: normalizeArray(schedule.shifts).filter((shift) => {
        if (!shift?.employee_id) return false;
        if (!employeesLoaded) return false;
        return realEmployeeIds.size === 0 || realEmployeeIds.has(String(shift.employee_id));
      }),
    };
  }, [schedule, employeesLoaded, realEmployeeIds]);

  const basePeriod = useMemo(
    () => deriveSchedulePeriod(schedule, periodForm),
    [periodForm, schedule],
  );

  const monthViewRange = useMemo(() => (
    getFourWeekPeriodRange(periodForm.start_date)
    || getFourWeekPeriodRange(formatLocalDate(new Date()))
  ), [periodForm.start_date]);

  const applyMonthRangeFromStart = useCallback((startDate) => {
    const range = getFourWeekPeriodRange(startDate);
    if (!range) {
      return null;
    }
    setGeneratedPeriod(null);
    setPeriodForm(range);
    setSelectedDateIndex(0);
    return range;
  }, []);

  const resolveViewAnchorDate = useCallback(() => {
    const sparseDates = mergeScheduleDates(displaySchedule, unfilledNotFoundRequirements)
      .map((day) => day.date)
      .filter(Boolean);

    if (sparseDates.length > 0) {
      const safeIndex = Math.max(0, Math.min(selectedDateIndex, sparseDates.length - 1));
      return sparseDates[safeIndex];
    }

    return periodForm.start_date || formatLocalDate(new Date());
  }, [displaySchedule, periodForm.start_date, selectedDateIndex, unfilledNotFoundRequirements]);

  const activateMonthView = useCallback(() => {
    applyMonthRangeFromStart(resolveViewAnchorDate());
    setViewMode('month');
  }, [applyMonthRangeFromStart, resolveViewAnchorDate]);

  const scheduleStartDate = viewMode === 'month'
    ? monthViewRange.start_date
    : basePeriod.start_date;
  const scheduleEndDate = viewMode === 'month'
    ? monthViewRange.end_date
    : basePeriod.end_date;

  const sparseSchedules = useMemo(
    () => mergeScheduleDates(displaySchedule, unfilledNotFoundRequirements),
    [displaySchedule, unfilledNotFoundRequirements]
  );

  const schedules = useMemo(() => {
    if (viewMode !== 'month') {
      return sparseSchedules;
    }
    return buildFullScheduleRange(
      displaySchedule,
      unfilledNotFoundRequirements,
      scheduleStartDate,
      scheduleEndDate
    );
  }, [
    displaySchedule,
    unfilledNotFoundRequirements,
    scheduleEndDate,
    scheduleStartDate,
    sparseSchedules,
    viewMode,
  ]);

  const dates = useMemo(() => schedules.map((s) => s.date), [schedules]);

  const currentDateKey = dates[selectedDateIndex] || dates[0] || '';
  const mobileDayEntries = useMemo(
    () => buildDayScheduleEntries(currentDateKey, displaySchedule, unfilledNotFoundRequirements),
    [currentDateKey, displaySchedule, unfilledNotFoundRequirements],
  );

  const navStep = viewMode === '3day' ? 3 : 1;

  const visibleDates = useMemo(() => {
    if (!dates.length) return [];
    if (viewMode === 'month') return dates;
    const start = Math.max(0, Math.min(selectedDateIndex, dates.length - 1));
    const pageSize = viewMode === 'day' ? 1 : 3;
    return dates.slice(start, start + pageSize);
  }, [dates, selectedDateIndex, viewMode]);

  const dateIndexForVisible = useMemo(
    () => visibleDates
      .map((dateKey) => schedules.findIndex((day) => day.date === dateKey))
      .filter((index) => index >= 0),
    [schedules, visibleDates]
  );

  const navigationLabel = useMemo(() => {
    if (viewMode === 'month') {
      if (!scheduleStartDate || !scheduleEndDate) return '—';
      return `${scheduleStartDate} — ${scheduleEndDate}`;
    }
    if (visibleDates.length === 1) return visibleDates[0] || '—';
    return `${visibleDates[0]} — ${visibleDates[visibleDates.length - 1]}`;
  }, [scheduleEndDate, scheduleStartDate, viewMode, visibleDates]);

  const employeesForView = useMemo(() => {
    const fromGrid = buildEmployeeListFromIndexes(schedules, dateIndexForVisible);
    if (fromGrid.length > 0) {
      return fromGrid;
    }

    const empMap = {};
    normalizeArray(displaySchedule?.shifts).forEach((shift) => {
      if (!shift?.employee_id) return;
      empMap[String(shift.employee_id)] = {
        id: shift.employee_id,
        full_name: shift.employee_name || `#${shift.employee_id}`,
      };
    });
    return Object.values(empMap);
  }, [schedules, dateIndexForVisible, displaySchedule]);

  const reloadScheduleVersions = useCallback(async (preferredVersion) => {
    const versions = await loadScheduleVersions();
    setScheduleVersions(versions);
    setActiveVersion((current) => pickActiveVersion(versions, preferredVersion || current));
    return versions;
  }, []);

  const runGenerate = useCallback(async (period) => {
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const generationPeriod = viewMode === 'month'
        ? (getFourWeekPeriodRange(periodForm.start_date) || period)
        : period;
      const generated = await generateScheduleForPeriod(generationPeriod);
      const visibleShiftCount = countVisibleShifts(generated, realEmployeeIds);

      setGeneratedPeriod({
        start_date: generationPeriod.start_date,
        end_date: generationPeriod.end_date,
      });
      persistMergedScheduleBundle('draft', generated);
      setScheduleVersions((prev) => ({ ...prev, draft: generated }));
      setActiveVersion('draft');
      setSelectedDateIndex(0);

      if (visibleShiftCount > 0) {
        setSuccess(t.generated);
      } else if (realEmployeeIds.size === 0 && !hasStaffingRequirements(generated)) {
        setError(t.noEmployeesAndRequirements);
      } else {
        setError(t.noScheduleHint);
      }
    } catch (e) {
      setError(extractApiErrorMessage(e, t.noScheduleHint, language));
    } finally {
      setIsSubmitting(false);
    }
  }, [language, periodForm.start_date, realEmployeeIds, t.generated, t.noEmployeesAndRequirements, t.noScheduleHint, viewMode]);

  useEffect(() => {
    if (isAuthLoading) {
      return undefined;
    }

    let cancelled = false;

    async function loadInitialData() {
      setIsLoading(true);
      setError('');

      if (!hasCompany) {
        if (cancelled) return;
        setRealEmployeeIds(new Set());
        setScheduleVersions(EMPTY_SCHEDULE_VERSIONS);
        setActiveVersion('draft');
        setSelectedDateIndex(0);
        setEmployeesLoaded(true);
        setIsLoading(false);
        return;
      }

      try {
        const [employees, versions] = await Promise.all([
          listEmployees().catch(() => []),
          loadScheduleVersions(),
        ]);

        if (cancelled) return;

        setRealEmployeeIds(new Set(
          filterRealEmployees(employees).map((employee) => String(employee.id))
        ));
        setScheduleVersions(versions);
        setActiveVersion((current) => pickActiveVersion(versions, current));
        setSelectedDateIndex(0);
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
  }, [hasCompany, isAuthLoading, language, t.noScheduleHint]);

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
      const published = await publishScheduleForPeriod(schedule);
      persistMergedScheduleBundle('published', published);
      clearMergedScheduleBundle('draft');
      setGeneratedPeriod(
        getFourWeekPeriodRange(periodForm.start_date) || {
          start_date: periodForm.start_date,
          end_date: periodForm.end_date,
        },
      );
      setScheduleVersions((prev) => ({
        ...prev,
        draft: null,
        published,
      }));
      setActiveVersion('published');
      setSuccess(t.publishedDone);
    } catch (e) {
      setError(extractApiErrorMessage(e, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePublishedSchedule = async () => {
    const publishedSchedule = scheduleVersions.published;
    if (!publishedSchedule?.id) return;
    if (!window.confirm(t.confirmDeletePublished)) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await deleteScheduleForPeriod(publishedSchedule);
      clearMergedScheduleBundle('published');
      setGeneratedPeriod(null);
      await reloadScheduleVersions('draft');
      setSuccess(t.publishedDeleted);
    } catch (e) {
      setError(extractApiErrorMessage(e, t.deletePublishedError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showDeletePublished = activeVersion === 'published' && Boolean(scheduleVersions.published?.id);
  const canEditDraft = activeVersion === 'draft' && Boolean(schedule);

  const handleAssignRequirement = async (requirementId) => {
    const employeeId = assignEmployeeIds[requirementId];
    if (!schedule?.id || !requirementId || !employeeId) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await assignRequirement(schedule.id, requirementId, {
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
          shift.position_title || '',
          shift.assigned_employees?.[0]?.full_name || '',
          String(shift.start_time || '').slice(0, 5),
          String(shift.end_time || '').slice(0, 5),
        ]);
      });
    });
    downloadCSV('generated_schedule.csv', rows);
  };

  if (isLoading || isAuthLoading) return <div style={{ padding: 20 }}>{t.loading}</div>;

  const hasShifts = normalizeArray(displaySchedule?.shifts).length > 0;
  const hasGridContent = hasShifts || unfilledNotFoundRequirements.length > 0;
  const versionOptions = [
    { id: 'draft', label: t.viewDraft, schedule: scheduleVersions.draft },
    { id: 'published', label: t.viewPublished, schedule: scheduleVersions.published },
  ];
  const shellPadding = isMobile ? 10 : 18;
  const cardPadding = isMobile ? 14 : 24;
  const actionButtonStyle = isMobile ? { flex: '1 1 calc(50% - 6px)', minWidth: '140px' } : {};

  return (
    <section style={{ padding: shellPadding }}>
      <div style={{
        background: '#ffffff',
        borderRadius: isMobile ? '18px' : '22px',
        boxShadow: '0 22px 58px rgba(0, 38, 66, 0.16)',
        padding: cardPadding,
      }}
      >
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            flexDirection: isMobile ? 'column' : 'row',
          }}
          >
            <div style={{ width: isMobile ? '100%' : 'auto' }}>
              <h2 style={{ margin: 0, color: '#002642', fontSize: isMobile ? 20 : undefined }}>{t.title}</h2>
              {!isMobile && (
                <p style={{ margin: '8px 0 0', color: '#4f646f', fontSize: 14, maxWidth: 680 }}>{t.subtitle}</p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                padding: '8px 12px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 13,
                ...getStatusBadgeStyle(scheduleStatus),
              }}>
                {t.status}: {getStatusLabel(scheduleStatus, t)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                    setSelectedDateIndex(0);
                    setError('');
                    setSuccess('');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: isActive ? '2px solid #002642' : '1px solid #dee7e7',
                    background: isActive ? '#002642' : '#f4faff',
                    color: isDisabled ? 'rgba(79, 100, 111, 0.45)' : (isActive ? '#fff' : '#002642'),
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: isDisabled ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.55 : 1,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(215, 173, 207, 0.35)', color: '#8d1d1d', fontWeight: 600 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: '#dee7e7', color: '#002642', fontWeight: 600 }}>
            {success}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-end',
          marginBottom: 20,
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
        }}
        >
          <label style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            color: '#4f646f',
            fontSize: 12,
            fontWeight: 800,
            width: isMobile ? '100%' : 'auto',
          }}
          >
            {t.startDate}
            <input
              type="date"
              value={periodForm.start_date}
              onChange={(e) => {
                const startDate = e.target.value;
                if (viewMode === 'month') {
                  applyMonthRangeFromStart(startDate);
                  return;
                }
                setGeneratedPeriod(null);
                setPeriodForm((prev) => ({ ...prev, start_date: startDate }));
              }}
              style={{
                width: isMobile ? '100%' : 'auto',
                height: 40,
                borderRadius: 12,
                border: '2px solid #dee7e7',
                padding: '0 12px',
                background: '#ffffff',
                color: '#002642',
                colorScheme: 'light',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            color: '#4f646f',
            fontSize: 12,
            fontWeight: 800,
            width: isMobile ? '100%' : 'auto',
          }}
          >
            {t.endDate}
            <input
              type="date"
              value={periodForm.end_date}
              readOnly={viewMode === 'month'}
              onChange={(e) => {
                if (viewMode === 'month') return;
                setGeneratedPeriod(null);
                setPeriodForm((prev) => ({ ...prev, end_date: e.target.value }));
              }}
              style={{
                width: isMobile ? '100%' : 'auto',
                height: 40,
                borderRadius: 12,
                border: '2px solid #dee7e7',
                padding: '0 12px',
                background: viewMode === 'month' ? '#f4faff' : '#ffffff',
                color: '#002642',
                colorScheme: 'light',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              const range = getFourWeekPeriodRange(periodForm.start_date);
              if (!range) return;
              setGeneratedPeriod(null);
              setPeriodForm(range);
              if (viewMode === 'month') {
                setSelectedDateIndex(0);
              }
            }}
            disabled={isSubmitting}
            style={{
              height: 40,
              padding: '0 14px',
              borderRadius: 12,
              background: '#f4faff',
              color: '#002642',
              border: '2px solid #dee7e7',
              cursor: isSubmitting ? 'default' : 'pointer',
              fontWeight: 700,
              width: isMobile ? '100%' : 'auto',
              ...actionButtonStyle,
            }}
          >
            {t.fillMonth}
          </button>

          <button
            onClick={() => runGenerate(periodForm)}
            disabled={isSubmitting}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: 12,
              background: '#002642',
              color: '#fff',
              border: 'none',
              cursor: isSubmitting ? 'default' : 'pointer',
              fontWeight: 700,
              opacity: isSubmitting ? 0.65 : 1,
              width: isMobile ? '100%' : 'auto',
              ...actionButtonStyle,
            }}
          >
            {isSubmitting ? t.generating : t.generate}
          </button>

          {canEditDraft && schedule?.id && (
            <button
              onClick={handlePublish}
              disabled={isSubmitting || !hasShifts}
              style={{
                height: 40,
                padding: '0 16px',
                borderRadius: 12,
                background: '#d7adcf',
                color: '#002642',
                border: 'none',
                cursor: isSubmitting || !hasShifts ? 'default' : 'pointer',
                fontWeight: 700,
                opacity: isSubmitting || !hasShifts ? 0.65 : 1,
                width: isMobile ? '100%' : 'auto',
                ...actionButtonStyle,
              }}
            >
              {t.publish}
            </button>
          )}

          {showDeletePublished && (
            <button
              type="button"
              onClick={handleDeletePublishedSchedule}
              disabled={isSubmitting}
              style={{
                height: 40,
                padding: '0 16px',
                borderRadius: 12,
                background: '#8d1d1d',
                color: '#fff',
                border: 'none',
                cursor: isSubmitting ? 'default' : 'pointer',
                fontWeight: 700,
                opacity: isSubmitting ? 0.65 : 1,
                width: isMobile ? '100%' : 'auto',
                ...actionButtonStyle,
              }}
            >
              {t.deletePublished}
            </button>
          )}
        </div>

        {schedule?.id && canEditDraft && unfilledRequirements.length > 0 && (
          <div style={{
            marginBottom: 20,
            padding: '16px 18px',
            borderRadius: 16,
            background: '#f4faff',
            border: '1px solid #dee7e7',
          }}>
            <h3 style={{ margin: '0 0 12px', color: '#002642', fontSize: 16 }}>{t.unfilledTitle}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {unfilledRequirements.map((item) => {
                const requirementId = item.requirement_id;

                return (
                  <div
                    key={requirementId}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: '#fff',
                      border: '1px solid rgba(79, 100, 111, 0.12)',
                    }}
                  >
                    <div style={{ minWidth: 180 }}>
                      <strong style={{ color: '#002642' }}>{item.position_title}</strong>
                      <div style={{ color: '#4f646f', fontSize: 13 }}>
                        {formatDate(item.date)} · {String(item.start_time || '').slice(0, 5)}–{String(item.end_time || '').slice(0, 5)}
                      </div>
                      {unfilledNotFoundRequirements.some((entry) => entry.requirement_id === requirementId) && (
                        <div style={{ color: '#8d1d1d', fontSize: 12, fontWeight: 700 }}>
                          {t.notFound}
                        </div>
                      )}
                    </div>

                    <select
                      value={assignEmployeeIds[requirementId] || ''}
                      onChange={(event) => setAssignEmployeeIds((prev) => ({
                        ...prev,
                        [requirementId]: event.target.value,
                      }))}
                      style={{
                        minWidth: 200,
                        height: 36,
                        borderRadius: 10,
                        border: '2px solid #dee7e7',
                        padding: '0 10px',
                      }}
                      disabled={isSubmitting}
                    >
                      <option value="">{t.chooseEmployee}</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleAssignRequirement(requirementId)}
                      disabled={isSubmitting || !assignEmployeeIds[requirementId]}
                      style={{
                        height: 36,
                        padding: '0 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#002642',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: isSubmitting || !assignEmployeeIds[requirementId] ? 'default' : 'pointer',
                        opacity: isSubmitting || !assignEmployeeIds[requirementId] ? 0.6 : 1,
                      }}
                    >
                      {t.assign}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
        }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#f4faff',
            border: '1px solid #dee7e7',
            borderRadius: 12,
            padding: '10px 14px',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
          >
            <button
              type="button"
              onClick={() => setSelectedDateIndex((index) => Math.max(0, index - navStep))}
              disabled={viewMode === 'month' || selectedDateIndex <= 0}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: viewMode === 'month' || selectedDateIndex <= 0 ? 'default' : 'pointer',
                fontSize: 18,
                opacity: viewMode === 'month' || selectedDateIndex <= 0 ? 0.35 : 1,
              }}
            >
              &larr;
            </button>
            <strong style={{ color: '#002642' }}>{navigationLabel}</strong>
            <button
              type="button"
              onClick={() => setSelectedDateIndex((index) => Math.min(Math.max(dates.length - 1, 0), index + navStep))}
              disabled={viewMode === 'month' || selectedDateIndex >= Math.max(dates.length - 1, 0)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: viewMode === 'month' || selectedDateIndex >= Math.max(dates.length - 1, 0) ? 'default' : 'pointer',
                fontSize: 18,
                opacity: viewMode === 'month' || selectedDateIndex >= Math.max(dates.length - 1, 0) ? 0.35 : 1,
              }}
            >
              &rarr;
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['day', '3day', 'month'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  if (mode === 'month') {
                    activateMonthView();
                    return;
                  }
                  setViewMode(mode);
                  setSelectedDateIndex(0);
                }}
                style={{
                  fontWeight: viewMode === mode ? 700 : 400,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: viewMode === mode ? '#002642' : '#dee7e7',
                  color: viewMode === mode ? '#fff' : '#002642',
                  border: '1px solid #dee7e7',
                  cursor: 'pointer',
                }}
              >
                {mode === 'day' ? t.day : mode === '3day' ? t.threeDay : t.month}
              </button>
            ))}
          </div>

          <div style={{
            marginLeft: isMobile ? 0 : 'auto',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            width: isMobile ? '100%' : 'auto',
          }}
          >
            <button onClick={exportCSV} disabled={!hasShifts} style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: '#002642',
              color: '#fff',
              border: 'none',
              cursor: hasShifts ? 'pointer' : 'default',
              fontWeight: 600,
              opacity: hasShifts ? 1 : 0.5,
              width: isMobile ? '100%' : 'auto',
            }}>{t.exportCSV}</button>
          </div>
        </div>

        {!hasAnySchedule ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f4faff', borderRadius: 18, border: '1px solid #dee7e7' }}>
            <h3 style={{ margin: 0, color: '#002642' }}>{t.noSchedule}</h3>
            <p style={{ margin: '8px 0 0', color: '#4f646f', fontSize: 14 }}>{t.noScheduleHint}</p>
          </div>
        ) : !hasGridContent ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f4faff', borderRadius: 18, border: '1px solid #dee7e7' }}>
            <h3 style={{ margin: 0, color: '#002642' }}>{getStatusLabel(scheduleStatus, t)}</h3>
            <p style={{ margin: '8px 0 0', color: '#4f646f', fontSize: 14 }}>{t.noShiftsInVersion}</p>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mobileDayEntries.length === 0 ? (
              <div style={{
                padding: '32px 18px',
                textAlign: 'center',
                background: '#f4faff',
                borderRadius: 16,
                border: '1px solid #dee7e7',
                color: '#4f646f',
                fontWeight: 600,
              }}
              >
                {t.noShiftsThisDay}
              </div>
            ) : (
              mobileDayEntries.map((entry) => {
                const isUnfilled = entry.kind === 'unfilled';
                const timeLabel = `${String(entry.startTime || '').slice(0, 5)} - ${String(entry.endTime || '').slice(0, 5)}`;

                return (
                  <div
                    key={entry.key}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: isUnfilled
                        ? 'linear-gradient(135deg, #ffd6a5 0%, #ffb085 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: isUnfilled ? '#5a1a1a' : '#fff',
                      border: isUnfilled ? '2px dashed #8d1d1d' : '1px solid rgba(255,255,255,0.12)',
                      boxShadow: isUnfilled
                        ? '0 2px 8px rgba(141, 29, 29, 0.12)'
                        : '0 2px 8px rgba(102,126,234,0.25)',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{entry.position}</div>
                    <div style={{ fontSize: 14, marginBottom: 4 }}>
                      {isUnfilled ? t.notFound : entry.employee}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.92 }}>{timeLabel}</div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: viewMode === 'month' ? 20 : 24 }}>
            {visibleDates.map((dateKey) => {
              const dayIndex = schedules.findIndex((day) => day.date === dateKey);
              const day = dayIndex >= 0 ? schedules[dayIndex] : { date: dateKey, shifts: [] };
              const dayEmployees = buildEmployeeListFromIndexes(
                schedules,
                dayIndex >= 0 ? [dayIndex] : [],
              );
              const dayUnfilled = unfilledNotFoundRequirements.filter(
                (item) => formatDate(item.date) === dateKey,
              );

              return (
                <DayScheduleTable
                  key={dateKey}
                  dateKey={dateKey}
                  day={day}
                  employees={dayEmployees}
                  unfilledItems={dayUnfilled}
                  employeeLabel={t.employee}
                  notFoundLabel={t.notFound}
                  emptyDayLabel={t.noShiftsThisDay}
                  cellWidth={cellWidth}
                  slotsPerDay={slotsPerDay}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
