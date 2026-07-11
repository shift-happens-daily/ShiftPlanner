import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { extractApiErrorMessage, localizeBackendMessage } from '../../services/error';
import {
  assignRequirement,
  createExchangeRequest,
  defaultSchedulePeriod,
  deleteShift,
  fetchScheduleVersions,
  formatLocalDate,
  generateScheduleForPeriod,
  getMySchedule,
  getSchedule,
  listAvailableEmployees,
  listExchangeRequests,
  publishScheduleForPeriod,
  updateExchangeRequest,
  updateShift,
} from '../../services/scheduleService';
import { filterRealEmployees, listEmployees } from '../../services/employeeService';
import { useTabResponsive } from '../../utils/tabResponsive';
import { getBranchLabel, getPositionLabel } from '../../utils/employeeDisplay';
import { usePositionTitleRevision } from '../../hooks/usePositionTitleRevision';
import { useUnsavedChanges } from '../../context/useUnsavedChanges';
import { useAuth } from '../../context/useAuth';
import '../../styles/schedule-tab.css';
import { CHECK_MARK } from '../../utils/textSymbols';

const EXCHANGE_NOTE_SCOPE = 'schedule-exchange-note';

function defaultPeriod() {
  return defaultSchedulePeriod();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.shifts)) return value.shifts;
  return [];
}

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

function getShiftDurationLabel(shift, language) {
  const start = String(shift?.start_time || '').split(':').map(Number);
  const end = String(shift?.end_time || '').split(':').map(Number);
  if (start.length < 2 || end.length < 2 || start.some(Number.isNaN) || end.some(Number.isNaN)) {
    return '';
  }

  const startMinutes = (start[0] * 60) + start[1];
  const endMinutes = (end[0] * 60) + end[1];
  const duration = endMinutes - startMinutes;
  if (duration <= 0) return '';

  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  if (language === 'ru') {
    const hoursUnit = '\u0447';
    const minutesUnit = '\u043c\u0438\u043d';
    return minutes ? `${hours} ${hoursUnit} ${minutes} ${minutesUnit}` : `${hours} ${hoursUnit}`;
  }
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatTimeForApi(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw.slice(0, 8);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return formatLocalDate(date);
}

function formatDisplayDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function parseDateKey(value) {
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

function getShiftId(shift) {
  return shift?.id || shift?.shift_id;
}

function getShiftPosition(shift) {
  return getPositionLabel({
    position_id: shift?.position_id || shift?.position?.id,
    position_title: shift?.position_title || shift?.position_name,
    title: typeof shift?.position === 'string' ? shift.position : undefined,
    name: shift?.position?.name,
    position: typeof shift?.position === 'object' ? shift.position : undefined,
  }, '—');
}

function getShiftEmployeeName(shift) {
  return shift?.employee_name || shift?.employee?.full_name || shift?.full_name || '—';
}

function getShiftBranch(shift, user) {
  return getBranchLabel(
    shift?.branch_name || shift?.branch?.name || user?.branch?.name || user?.branch_name,
    '—',
  );
}

function getShiftCompany(shift) {
  return shift?.company_name || shift?.company?.name || shift?.company || '—';
}

function formatLongDisplayDate(value, language) {
  const date = parseDateKey(value);
  if (!date) return value;
  return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getShiftPositionId(shift) {
  return shift?.position_id || shift?.position?.id;
}

function getScheduleStatus(schedule) {
  return schedule?.status || 'draft';
}

function countFilledShifts(schedule) {
  return normalizeArray(schedule?.shifts).filter((shift) => getShiftEmployeeName(shift) !== '—').length;
}

function countUnfilled(schedule) {
  return normalizeArray(schedule?.unfilled_requirements).reduce(
    (sum, item) => sum + Number(item?.missing_staff || 0),
    0
  );
}

function exportScheduleDraftToXlsx(schedule, translations) {
  if (!schedule) {
    return;
  }

  const shifts = normalizeArray(schedule.shifts).map((shift) => ({
    schedule_id: schedule.id || '',
    schedule_status: getScheduleStatus(schedule),
    shift_id: getShiftId(shift) || '',
    date: shift.date || '',
    position: getShiftPosition(shift),
    employee: getShiftEmployeeName(shift),
    start_time: formatTime(shift.start_time),
    end_time: formatTime(shift.end_time),
  }));

  const unfilled = normalizeArray(schedule.unfilled_requirements).map((item) => ({
    requirement_id: item.requirement_id || '',
    date: item.date || '',
    position: getPositionLabel({
      position_id: item.position_id,
      position_title: item.position_title || item.position,
    }, item.position_title || item.position || ''),
    start_time: formatTime(item.start_time),
    end_time: formatTime(item.end_time),
    missing_staff: item.missing_staff || 0,
  }));

  const conflicts = normalizeArray(schedule.conflicts).map((conflict) => ({
    employee_id: conflict.employee_id || '',
    employee: conflict.employee_name || '',
    date: conflict.date || '',
    message: conflict.message || '',
  }));

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(shifts.length ? shifts : [{ info: translations.empty }]),
    'Shifts'
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(unfilled.length ? unfilled : [{ info: translations.empty }]),
    'Unfilled'
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(conflicts.length ? conflicts : [{ info: translations.empty }]),
    'Conflicts'
  );

  const start = schedule.start_date || schedule.period_start || 'schedule';
  const end = schedule.end_date || schedule.period_end || 'draft';
  const fileName = `shiftplanner_schedule_${start}_${end}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

const MOBILE_EMPLOYEE_SCHEDULE_STYLES = {
  page: {
    padding: '6px 8px 10px',
  },
  shell: {
    gap: 8,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 12,
    margin: '2px 0 0',
  },
  employeeArea: {
    gap: 8,
  },
  employeeCalendarPanel: {
    padding: 10,
    gap: 8,
    gridTemplateRows: 'auto minmax(160px, 1fr) minmax(112px, auto)',
    borderRadius: 14,
  },
  employeeCalendarHeader: {
    gap: 8,
  },
  employeeCalendarTitle: {
    fontSize: 17,
  },
  panelHint: {
    fontSize: 11,
    margin: '2px 0 0',
  },
  calendarNav: {
    gap: 6,
  },
  calendarNavButton: {
    width: 34,
    height: 30,
    fontSize: 15,
    borderRadius: 8,
  },
  calendarTodayButton: {
    height: 30,
    padding: '0 10px',
    fontSize: 12,
    borderRadius: 8,
  },
  monthCalendar: {
    gridTemplateRows: '20px minmax(0, 1fr)',
    borderRadius: 10,
  },
  monthWeekday: {
    fontSize: 10,
  },
  monthGrid: {
    gridAutoRows: 'minmax(32px, 1fr)',
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
  monthDots: {
    minHeight: 5,
    gap: 2,
  },
  monthDot: {
    width: 4,
    height: 4,
  },
  selectedDatePanel: {
    padding: 8,
    gap: 6,
    borderRadius: 10,
  },
  panelTitle: {
    fontSize: 14,
  },
  selectedDateCount: {
    minWidth: 26,
    height: 24,
    padding: '0 8px',
    fontSize: 12,
  },
  selectedDateEmpty: {
    minHeight: 52,
    padding: '8px 10px',
    gap: 3,
    borderRadius: 8,
  },
  emptyTitle: {
    fontSize: 13,
  },
  emptySubtitle: {
    fontSize: 11,
    lineHeight: 1.35,
  },
  selectedShiftList: {
    gap: 6,
  },
  calendarShiftCard: {
    padding: 8,
    gap: 6,
    borderRadius: 8,
  },
  calendarShiftInfo: {
    gap: 6,
  },
  calendarShiftTimeInline: {
    height: 26,
    padding: '0 8px',
    fontSize: 12,
    borderRadius: 7,
  },
  calendarDurationBadge: {
    height: 26,
    padding: '0 8px',
    fontSize: 11,
    borderRadius: 7,
  },
  calendarShiftTitle: {
    fontSize: 14,
  },
  calendarExchangeRow: {
    gap: 6,
  },
  calendarExchangeInput: {
    height: 34,
    minHeight: 34,
    padding: '6px 8px',
    fontSize: 12,
    borderRadius: 8,
  },
  calendarExchangeButton: {
    height: 34,
    padding: '0 10px',
    fontSize: 12,
    borderRadius: 8,
  },
};

export default function ScheduleTab({ language, userRole }) {
  const positionTitleRevision = usePositionTitleRevision();
  const { markUnsaved, markSaved } = useUnsavedChanges();
  const { user } = useAuth();
  const isManager = userRole === 'manager';
  const r = useTabResponsive(1480);
  const isEmployeeMobile = !isManager && r.isMobile;
  const mobileSchedule = isEmployeeMobile ? MOBILE_EMPLOYEE_SCHEDULE_STYLES : null;

  const [periodForm, setPeriodForm] = useState(defaultPeriod);
  const [schedule, setSchedule] = useState(null);

  const [mySchedule, setMySchedule] = useState([]);
  const [employeeViewMode, setEmployeeViewMode] = useState('month');
  const [selectedEmployeeDate, setSelectedEmployeeDate] = useState(() => formatLocalDate(new Date()));
  const [employeeCalendarMonth, setEmployeeCalendarMonth] = useState(() => formatLocalDate(new Date()));
  const [exchangeNotes, setExchangeNotes] = useState({});
  const [exchangeRequests, setExchangeRequests] = useState([]);
  const [reassignEmployeeIds, setReassignEmployeeIds] = useState({});
  const [availableByShift, setAvailableByShift] = useState({});
  const [assignEmployeeIds, setAssignEmployeeIds] = useState({});
  const [manualEmployees, setManualEmployees] = useState([]);
  const [manualEmployeesLoaded, setManualEmployeesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      titleManager: 'Расписание',
      titleEmployee: 'Расписание',
      subtitleManager: 'Генерация и публикация смен для сотрудников.',
      subtitleEmployee: 'Ваши опубликованные смены по месяцам.',
      day: 'День',
      week: 'Неделя',
      month: 'Месяц',
      startDate: 'Начало периода',
      endDate: 'Конец периода',
      generate: 'Сгенерировать черновик',
      publish: 'Опубликовать',
      status: 'Статус',
      reassign: 'Переназначить',
      remove: 'Убрать сотрудника',
      noSchedule: 'Расписание ещё не сгенерировано',
      noScheduleHint: 'Выберите неделю (Пн–Вс) и нажмите «Сгенерировать черновик».',
      noScheduleRequirements: 'Перед генерацией должны быть настроены шаблоны потребности, часы филиала и доступность сотрудников.',
      loading: 'Загрузка...',
      unfilled: 'Незаполненные требования',
      shifts: 'Смены',
      note: 'Комментарий',
      conflicts: 'Конфликты',
      empty: 'Нет данных',
      generated: 'Черновик расписания создан.',
      exportDraft: 'Скачать XLSX',
      exportDone: 'Черновик скачан в XLSX.',
      clearSchedule: 'Очистить черновик',
      scheduleCleared: 'Черновик очищен.',
      publishedDone: 'Расписание опубликовано.',
      shiftUpdated: 'Смена обновлена.',
      missingStaff: 'Не хватает',
      draft: 'Черновик',
      published: 'Опубликовано',
      filledShifts: 'Назначено смен',
      unfilledCount: 'Не хватает людей',
      period: 'Период генерации',
      schedulePreview: 'Предпросмотр расписания',
      chooseEmployee: 'Выберите сотрудника',
      noEmployeesForPosition: 'Нет сотрудников этой позиции',
      noEmployeesAvailable: 'Нет доступных сотрудников',
      assign: 'Назначить',
      loadEmployees: 'Загрузить кандидатов',
      assigned: 'Сотрудник назначен на смену.',
      assignError: 'Не удалось назначить сотрудника.',
      noPublishedScheduleTitle: 'Пока нет опубликованных смен',
      noPublishedScheduleHint: 'Когда менеджер опубликует расписание, ваши смены появятся здесь.',
      noPublishedScheduleStep1: 'Дождитесь публикации от менеджера',
      noPublishedScheduleStep2: 'Обновите страницу, если расписание уже опубликовали',
      sectionHowItWorks: 'Как это работает',
      howOne: '1. «Настройки смен» задают спрос: сколько людей нужно.',
      howTwo: '2. «Сгенерировать» создает черновик смен.',
      howThree: '3. «Опубликовать» делает расписание видимым сотрудникам.',
      company: 'Компания',
      exchangeRequests: 'Запросы на обмен',
      exchangeNotePlaceholder: 'Причина обмена',
      requestExchange: 'Запросить обмен',
      exchangeRequested: 'Запрос на обмен отправлен.',
      exchangeNoteRequired: 'Укажите причину обмена.',
      exchangeApprove: 'Одобрить',
      exchangeReject: 'Отклонить',
      exchangeApproved: 'Запрос на обмен одобрен.',
      exchangeRejected: 'Запрос на обмен отклонён.',
      noExchangeRequests: 'Нет ожидающих запросов на обмен.',
      shiftTime: 'ВРЕМЯ СМЕНЫ',
      location: 'ФИЛИАЛ',
      positionLabel: 'ДОЛЖНОСТЬ',
      shiftSingular: 'смена',
      shiftPlural: 'смен',
      selectDay: 'Выберите день',
      selectDayHint: 'Нажмите на день с индикатором смены, чтобы увидеть детали.',
      closeDetail: 'Закрыть',
      legendAssigned: 'Назначено',
      legendNoShift: 'Нет смен',
      assignedStatus: 'Назначено',
      noShiftsThisDayTitle: 'Нет смен в этот день',
      noShiftsThisDayHint: 'На эту дату у вас нет опубликованных смен.',
    },
    en: {
      titleManager: 'Schedule',
      titleEmployee: 'Schedule',
      subtitleManager: 'Generate and publish shifts for your team.',
      subtitleEmployee: 'Your published shifts by month.',
      day: 'Day',
      week: 'Week',
      month: 'Month',
      startDate: 'Start date',
      endDate: 'End date',
      generate: 'Generate draft',
      publish: 'Publish',
      status: 'Status',
      reassign: 'Reassign',
      remove: 'Remove employee',
      noSchedule: 'Schedule has not been generated yet',
      noScheduleHint: 'Pick a Mon–Sun week and click Generate draft.',
      noScheduleRequirements: 'Before generating, set up staffing templates, branch hours, and employee availability.',
      loading: 'Loading...',
      unfilled: 'Unfilled requirements',
      shifts: 'Shifts',
      note: 'Note',
      conflicts: 'Conflicts',
      empty: 'No data',
      generated: 'Draft schedule generated.',
      exportDraft: 'Download XLSX',
      exportDone: 'Draft downloaded as XLSX.',
      clearSchedule: 'Clear draft',
      scheduleCleared: 'Draft cleared.',
      publishedDone: 'Schedule published.',
      shiftUpdated: 'Shift updated.',
      missingStaff: 'Missing',
      draft: 'Draft',
      published: 'Published',
      filledShifts: 'Assigned shifts',
      unfilledCount: 'Missing staff',
      period: 'Generation period',
      schedulePreview: 'Schedule preview',
      chooseEmployee: 'Choose employee',
      noEmployeesForPosition: 'No employees for this position',
      noEmployeesAvailable: 'No available employees',
      assign: 'Assign',
      loadEmployees: 'Load candidates',
      assigned: 'Employee assigned to shift.',
      assignError: 'Failed to assign employee.',
      noPublishedScheduleTitle: 'No published shifts yet',
      noPublishedScheduleHint: 'When your manager publishes the schedule, your shifts will appear here.',
      noPublishedScheduleStep1: 'Wait for the manager to publish the schedule',
      noPublishedScheduleStep2: 'Refresh the page if it was already published',
      sectionHowItWorks: 'How it works',
      howOne: '1. Shift setup defines demand: how many people are needed.',
      howTwo: '2. Generate creates a draft shift schedule.',
      howThree: '3. Publish makes the schedule visible to employees.',
      company: 'Company',
      exchangeRequests: 'Exchange requests',
      exchangeNotePlaceholder: 'Reason for exchange',
      requestExchange: 'Request exchange',
      exchangeRequested: 'Exchange request submitted.',
      exchangeNoteRequired: 'Enter a reason for the exchange.',
      exchangeApprove: 'Approve',
      exchangeReject: 'Reject',
      exchangeApproved: 'Exchange request approved.',
      exchangeRejected: 'Exchange request rejected.',
      noExchangeRequests: 'No pending exchange requests.',
      shiftTime: 'SHIFT TIME',
      location: 'LOCATION',
      positionLabel: 'POSITION',
      shiftSingular: 'shift',
      shiftPlural: 'shifts',
      selectDay: 'Select a day',
      selectDayHint: 'Click a day with a shift indicator to see details here.',
      closeDetail: 'Close',
      legendAssigned: 'Assigned',
      legendNoShift: 'No shift',
      assignedStatus: 'Assigned',
      noShiftsThisDayTitle: 'No shifts on this day',
      noShiftsThisDayHint: 'You have no published shifts scheduled for this date.',
    },
  };

  const t = texts[language] || texts.ru;

  const scheduleShifts = useMemo(() => normalizeArray(schedule?.shifts), [schedule]);
  const unfilledRequirements = useMemo(() => normalizeArray(schedule?.unfilled_requirements), [schedule, positionTitleRevision]);
  const conflicts = useMemo(() => normalizeArray(schedule?.conflicts), [schedule]);

  const employeeSchedule = mySchedule;

  const groupedMySchedule = useMemo(
    () => normalizeArray(employeeSchedule).reduce((acc, shift) => {
      const key = formatDate(shift.date || new Date()) || '—';
      acc[key] = acc[key] || [];
      acc[key].push(shift);
      return acc;
    }, {}),
    [employeeSchedule]
  );
  const employeeDates = useMemo(() => {
    return Object.keys(groupedMySchedule).sort();
  }, [groupedMySchedule]);

  const employeeTimelineDates = useMemo(() => {
    if (employeeViewMode === 'day') return employeeDates.slice(0, 1);
    if (employeeViewMode === 'week') return employeeDates.slice(0, 7);
    return employeeDates.slice(0, 30);
  }, [employeeDates, employeeViewMode]);

  const employeeCalendarGrid = useMemo(
    () => buildCalendarGrid(employeeCalendarMonth),
    [employeeCalendarMonth]
  );

  const selectedEmployeeDateShifts = useMemo(
    () => normalizeArray(groupedMySchedule[selectedEmployeeDate]).sort((a, b) =>
      String(a.start_time || '').localeCompare(String(b.start_time || ''))
    ),
    [groupedMySchedule, selectedEmployeeDate]
  );

  const employeeCalendarMonthLabel = useMemo(() => {
    const date = startOfMonthDate(employeeCalendarMonth);
    return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [employeeCalendarMonth, language]);

  const employeeCalendarMonthKey = useMemo(() => {
    const date = startOfMonthDate(employeeCalendarMonth);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }, [employeeCalendarMonth]);

  const employeeWeekdayLabels = useMemo(() => {
    const monday = new Date('2026-06-29T12:00:00');
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' });
    });
  }, [language]);

  const shiftDotColors = ['#007aff', '#34c759', '#ff3b30', '#ff9500'];

  useEffect(() => {
    if (!errorMessage && !successMessage) return undefined;

    const timer = setTimeout(() => {
      setErrorMessage('');
      setSuccessMessage('');
    }, errorMessage ? 5000 : 2500);

    return () => clearTimeout(timer);
  }, [errorMessage, successMessage]);

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const loadManagerData = useCallback(async () => {
    const [requestsData, versions] = await Promise.all([
      listExchangeRequests(),
      fetchScheduleVersions(periodForm),
    ]);
    setExchangeRequests(normalizeArray(requestsData));
    setSchedule(versions.draft || null);
  }, [periodForm]);

  const loadEmployeeData = useCallback(async () => {
    const shifts = await getMySchedule({
      date_from: employeeCalendarGrid.startDate,
      date_to: employeeCalendarGrid.endDate,
    });
    setMySchedule(normalizeArray(shifts));
  }, [employeeCalendarGrid.endDate, employeeCalendarGrid.startDate]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (isManager) {
        await loadManagerData();
      } else {
        await loadEmployeeData();
      }
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.empty, language));
    } finally {
      setIsLoading(false);
    }
  }, [isManager, language, loadEmployeeData, loadManagerData, t.empty]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (!isManager || !schedule?.id || unfilledRequirements.length === 0) {
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
      } catch (error) {
        if (!cancelled) {
          setManualEmployees([]);
          setManualEmployeesLoaded(true);
          setErrorMessage(extractApiErrorMessage(error, t.assignError, language));
        }
      }
    }

    void loadManualEmployees();

    return () => {
      cancelled = true;
    };
  }, [isManager, language, schedule?.id, t.assignError, unfilledRequirements.length]);

  const handleGenerate = async () => {
    clearMessages();
    setIsSubmitting(true);

    try {
      const generated = await generateScheduleForPeriod(periodForm);
      setSchedule(generated);
      setReassignEmployeeIds({});
      setSuccessMessage(t.generated);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.noScheduleHint, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!schedule?.id) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      const publishedSchedule = await publishScheduleForPeriod(schedule);
      setSchedule(publishedSchedule);
      setSuccessMessage(t.publishedDone);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportDraft = () => {
    if (!schedule) {
      return;
    }

    clearMessages();

    try {
      exportScheduleDraftToXlsx(schedule, t);
      setSuccessMessage(t.exportDone);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.exportDraft, language));
    }
  };

  const handleClearSchedule = () => {
    setSchedule(null);
    setReassignEmployeeIds({});
    setSuccessMessage(t.scheduleCleared);
  };

  const handleShiftAction = async (shiftId, action) => {
    if (!schedule?.id) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      if (action === 'remove') {
        await deleteShift(schedule.id, shiftId);
        const updatedSchedule = await getSchedule(schedule.id);
        setSchedule(updatedSchedule);
      } else {
        const updatedSchedule = await updateShift(schedule.id, shiftId, {
          action: 'reassign',
          employee_id: Number(reassignEmployeeIds[shiftId]),
        });
        setSchedule(updatedSchedule);
      }
      setSuccessMessage(t.shiftUpdated);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadAvailableForShift = async (shift) => {
    if (!schedule?.id || !shift) return;

    const shiftId = getShiftId(shift);
    const positionId = getShiftPositionId(shift);
    if (!positionId) return;

    try {
      const employees = await listAvailableEmployees(schedule.id, {
        date: shift.date,
        start_time: formatTimeForApi(shift.start_time),
        end_time: formatTimeForApi(shift.end_time),
        position_id: positionId,
      });
      setAvailableByShift((prev) => ({
        ...prev,
        [shiftId]: Array.isArray(employees) ? employees : [],
      }));
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.assignError, language));
    }
  };

  const handleAssignRequirement = async (requirementId) => {
    const employeeId = assignEmployeeIds[requirementId];
    if (!schedule?.id || !requirementId || !employeeId) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      const updatedSchedule = await assignRequirement(schedule.id, requirementId, {
        employee_id: Number(employeeId),
      });
      setSchedule(updatedSchedule);
      setAssignEmployeeIds((prev) => ({ ...prev, [requirementId]: '' }));
      setSuccessMessage(t.assigned);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t.assignError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExchangeRequest = async (shiftId) => {
    const note = String(exchangeNotes[shiftId] || '').trim();
    if (!note) {
      setErrorMessage(t.exchangeNoteRequired);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await createExchangeRequest({
        shift_id: Number(shiftId),
        note,
      });
      setExchangeNotes((prev) => ({ ...prev, [shiftId]: '' }));
      markSaved(EXCHANGE_NOTE_SCOPE);
      setSuccessMessage(t.exchangeRequested);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const shiftEmployeeCalendarMonth = (deltaMonths) => {
    const current = startOfMonthDate(employeeCalendarMonth);
    current.setMonth(current.getMonth() + deltaMonths);
    const nextMonth = formatLocalDate(current);
    setEmployeeCalendarMonth(nextMonth);
    setSelectedEmployeeDate(nextMonth);
  };

  const selectEmployeeCalendarDate = (dateKey) => {
    setSelectedEmployeeDate(dateKey);
    const selected = parseDateKey(dateKey);
    const month = startOfMonthDate(employeeCalendarMonth);
    if (selected && selected.getMonth() !== month.getMonth()) {
      setEmployeeCalendarMonth(formatLocalDate(new Date(selected.getFullYear(), selected.getMonth(), 1, 12, 0, 0, 0)));
    }
  };

  const handleExchangeDecision = async (requestId, status) => {
    clearMessages();
    setIsSubmitting(true);

    try {
      await updateExchangeRequest(requestId, { status });
      const requestsData = await listExchangeRequests();
      setExchangeRequests(normalizeArray(requestsData));
      setSuccessMessage(status === 'approved' ? t.exchangeApproved : t.exchangeRejected);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderToast = () => (
    (errorMessage || successMessage) && (
      <div style={styles.toastLayer}>
        <div style={errorMessage ? styles.toastError : styles.toastSuccess}>
          <span style={errorMessage ? styles.toastIconError : styles.toastIconSuccess}>
            {errorMessage ? '!' : CHECK_MARK}
          </span>

          <span style={styles.toastText}>{errorMessage || successMessage}</span>

          <button
            type="button"
            onClick={() => {
              setErrorMessage('');
              setSuccessMessage('');
            }}
            style={styles.toastClose}
            aria-label="Close notification"
          >
            <span className="st-icon-close" aria-hidden />
          </button>
        </div>
      </div>
    )
  );

  const pageStyle = {
    ...styles.page,
    ...r.page,
    ...(r.isMobile ? {} : styles.desktopViewportPage),
    ...mobileSchedule?.page,
  };

  const shellStyle = {
    ...styles.shell,
    ...r.shell,
    width: 'min(100%, 1480px)',
    padding: 0,
    borderRadius: 0,
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    ...(r.isMobile ? {} : styles.desktopScaleShell),
    ...mobileSchedule?.shell,
  };

  if (isLoading) {
    if (!isManager) {
      return (
        <section className="schedule-tab">
          <div className="st-page">
            <div className="st-loading">{t.loading}</div>
          </div>
        </section>
      );
    }

    return (
      <section style={pageStyle}>
        <div style={shellStyle}>
          <div style={styles.emptyBox}>{t.loading}</div>
        </div>
      </section>
    );
  }

  if (!isManager) {
    return (
      <section className="schedule-tab">
        <div className="st-page">
          {renderToast()}

          <header className="st-page-header">
            <div>
              <h1 className="st-page-title">{t.titleEmployee}</h1>
              <p className="st-page-subtitle">{t.subtitleEmployee}</p>
            </div>
          </header>

          <div className="st-layout">
            <div className="st-main">
              <div className="st-calendar-header">
                <div />
                <div className="st-month-nav">
                  <button
                    type="button"
                    className="st-month-nav-btn"
                    onClick={() => shiftEmployeeCalendarMonth(-1)}
                    aria-label="Previous month"
                  >
                    <span className="st-icon-chevron-left" aria-hidden />
                  </button>
                  <span className="st-month-label">{employeeCalendarMonthLabel}</span>
                  <button
                    type="button"
                    className="st-month-nav-btn"
                    onClick={() => shiftEmployeeCalendarMonth(1)}
                    aria-label="Next month"
                  >
                    <span className="st-icon-chevron-right" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="st-legend">
                <div className="st-legend-item">
                  <span className="st-legend-dot st-legend-dot--assigned" />
                  <span className="st-legend-label">{t.legendAssigned}</span>
                </div>
                <div className="st-legend-item">
                  <span className="st-legend-dot st-legend-dot--empty" />
                  <span className="st-legend-label">{t.legendNoShift}</span>
                </div>
              </div>

              <div className="st-calendar">
                <div className="st-calendar-weekdays">
                  {employeeWeekdayLabels.map((weekday) => (
                    <div key={weekday} className="st-calendar-weekday">{weekday}</div>
                  ))}
                </div>

                <div className="st-calendar-grid">
                  {employeeCalendarGrid.days.map((calendarDay, index) => {
                    const shiftsForDate = normalizeArray(groupedMySchedule[calendarDay.date]);
                    const isSelected = calendarDay.date === selectedEmployeeDate;
                    const isTodayDate = isSameDateKey(calendarDay.date, formatLocalDate(new Date()));
                    const isWeekend = index % 7 >= 5;

                    const cellClass = [
                      'st-day-cell',
                      isWeekend ? 'st-day-cell--weekend' : '',
                      !calendarDay.isCurrentMonth ? 'st-day-cell--outside' : '',
                      isSelected ? 'st-day-cell--selected' : '',
                    ].filter(Boolean).join(' ');

                    return (
                      <button
                        key={calendarDay.date}
                        type="button"
                        className={cellClass}
                        onClick={() => selectEmployeeCalendarDate(calendarDay.date)}
                      >
                        <span className={`st-day-number ${isTodayDate ? 'st-day-number--today' : ''}`}>
                          {calendarDay.day}
                        </span>

                        {shiftsForDate.length > 0 ? (
                          <div className="st-day-indicator">
                            <span className="st-day-indicator-dot" style={{ background: '#3b82f6' }} />
                            <span className="st-day-indicator-text">
                              {shiftsForDate.length}{' '}
                              {shiftsForDate.length === 1 ? t.shiftSingular : t.shiftPlural}
                            </span>
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
                {selectedEmployeeDate && selectedEmployeeDateShifts.length > 0 ? (
                  <div className="st-detail-content">
                    <div className="st-detail-header">
                      <div>
                        <p className="st-detail-date">{formatLongDisplayDate(selectedEmployeeDate, language)}</p>
                        <p className="st-detail-status">{t.assignedStatus}</p>
                      </div>
                      <button
                        type="button"
                        className="st-detail-close"
                        onClick={() => setSelectedEmployeeDate(null)}
                        aria-label={t.closeDetail}
                      >
                        <span className="st-icon-close" aria-hidden />
                      </button>
                    </div>

                    {selectedEmployeeDateShifts.map((shift) => {
                      const shiftId = getShiftId(shift);
                      const timeLabel = `${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}`;

                      return (
                        <div key={shiftId} className="st-detail-shift-card">
                          <div className="st-shift-time-box st-shift-time-box--assigned">
                            <p className="st-shift-time-label">{t.shiftTime}</p>
                            <p className="st-shift-time-value">{timeLabel}</p>
                          </div>

                          <div className="st-detail-section">
                            <p className="st-detail-section-label">{t.location}</p>
                            <p className="st-detail-section-value">{getShiftBranch(shift, user)}</p>
                          </div>

                          <div className="st-detail-section">
                            <p className="st-detail-section-label">{t.positionLabel}</p>
                            <p className="st-detail-section-value">{getShiftPosition(shift)}</p>
                          </div>

                          <div className="st-exchange-row">
                            <textarea
                              className="st-exchange-input"
                              value={exchangeNotes[shiftId] || ''}
                              onChange={(event) => {
                                setExchangeNotes((prev) => ({
                                  ...prev,
                                  [shiftId]: event.target.value,
                                }));
                                markUnsaved(EXCHANGE_NOTE_SCOPE);
                              }}
                              placeholder={t.exchangeNotePlaceholder}
                              disabled={isSubmitting}
                            />

                            <button
                              type="button"
                              onClick={() => handleCreateExchangeRequest(shiftId)}
                              className="st-btn st-btn--secondary"
                              disabled={isSubmitting}
                            >
                              {t.requestExchange}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="st-detail-empty">
                    <span className="st-detail-empty-icon" aria-hidden />
                    <p className="st-detail-empty-title">
                      {selectedEmployeeDate && selectedEmployeeDateShifts.length === 0
                        ? (employeeSchedule.length === 0 ? t.noPublishedScheduleTitle : t.noShiftsThisDayTitle)
                        : t.selectDay}
                    </p>
                    <p className="st-detail-empty-message">
                      {selectedEmployeeDate && selectedEmployeeDateShifts.length === 0
                        ? (employeeSchedule.length === 0 ? t.noPublishedScheduleHint : t.noShiftsThisDayHint)
                        : t.selectDayHint}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={pageStyle}>
      <div style={shellStyle}>
        {renderToast()}

        <header style={{ ...styles.header, ...r.header, ...mobileSchedule?.header }}>
          <div>
            <h2 style={{ ...styles.title, ...r.title, ...mobileSchedule?.title }}>{t.titleManager}</h2>
            <p style={{ ...styles.subtitle, ...mobileSchedule?.subtitle }}>{t.subtitleManager}</p>
          </div>

          {schedule && (
            <div style={styles.headerStats}>
              <Metric label={t.filledShifts} value={countFilledShifts(schedule)} />
              <Metric label={t.unfilledCount} value={countUnfilled(schedule)} />
            </div>
          )}
        </header>

        <div style={{ ...styles.managerLayout, ...r.splitLayout('300px minmax(0, 1fr)') }}>
            <aside style={styles.sidebar}>
              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>{t.period}</h3>

                <div style={styles.stack}>
                  <Field label={t.startDate}>
                    <input
                      type="date"
                      value={periodForm.start_date}
                      onChange={(event) =>
                        setPeriodForm((prev) => ({ ...prev, start_date: event.target.value }))
                      }
                      style={styles.dateInput}
                    />
                  </Field>

                  <Field label={t.endDate}>
                    <input
                      type="date"
                      value={periodForm.end_date}
                      onChange={(event) =>
                        setPeriodForm((prev) => ({ ...prev, end_date: event.target.value }))
                      }
                      style={styles.dateInput}
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                    disabled={isSubmitting}
                  >
                    {t.generate}
                  </button>

                  {schedule && (
                    <button
                      type="button"
                      onClick={handleExportDraft}
                      style={styles.secondaryButton}
                      disabled={isSubmitting}
                    >
                      {t.exportDraft}
                    </button>
                  )}

                  {schedule && (
                    <button
                      type="button"
                      onClick={handleClearSchedule}
                      style={styles.smallSecondaryButton}
                      disabled={isSubmitting}
                    >
                      {t.clearSchedule}
                    </button>
                  )}

                  {schedule && getScheduleStatus(schedule) === 'draft' && (
                    <button
                      type="button"
                      onClick={handlePublish}
                      style={isSubmitting ? styles.secondaryButtonDisabled : styles.secondaryButton}
                      disabled={isSubmitting}
                    >
                      {t.publish}
                    </button>
                  )}
                </div>
              </section>

              <section style={styles.helpBox}>
                <h3 style={styles.helpTitle}>{t.sectionHowItWorks}</h3>
                <span>{t.howOne}</span>
                <span>{t.howTwo}</span>
                <span>{t.howThree}</span>
              </section>

              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>{t.exchangeRequests}</h3>

                {exchangeRequests.length === 0 ? (
                  <p style={styles.emptyText}>{t.noExchangeRequests}</p>
                ) : (
                  <div style={styles.compactList}>
                    {exchangeRequests.map((request) => (
                      <div key={request.id} style={styles.compactItem}>
                        <strong style={styles.itemTitle}>{request.employee_name}</strong>
                        <span style={styles.itemMeta}>
                          {t.note}: {request.note}
                        </span>
                        <div style={styles.inlineActions}>
                          <button
                            type="button"
                            onClick={() => handleExchangeDecision(request.id, 'approved')}
                            style={isSubmitting ? styles.smallPrimaryButtonDisabled : styles.smallPrimaryButton}
                            disabled={isSubmitting}
                          >
                            {t.exchangeApprove}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExchangeDecision(request.id, 'rejected')}
                            style={isSubmitting ? styles.smallSecondaryButtonDisabled : styles.smallSecondaryButton}
                            disabled={isSubmitting}
                          >
                            {t.exchangeReject}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>

            <main style={styles.previewArea}>
              {!schedule ? (
                <div style={styles.emptyHero}>
                  <div style={styles.emptyHeroInner}>
                    <div className="st-detail-empty-icon" style={{ margin: '0 auto' }} aria-hidden />
                    <h3 style={styles.emptyTitle}>{t.noSchedule}</h3>
                    <p style={styles.emptySubtitle}>{t.noScheduleHint}</p>
                    <p style={styles.emptyNote}>{t.noScheduleRequirements}</p>
                  </div>
                </div>
              ) : (
                <>
                  <section style={styles.panel}>
                    <div style={styles.panelHeader}>
                      <div>
                        <h3 style={styles.panelTitle}>{t.schedulePreview}</h3>
                        <p style={styles.panelHint}>
                          {t.status}: {getScheduleStatus(schedule) === 'published' ? t.published : t.draft}
                        </p>
                      </div>

                      <span style={getScheduleStatus(schedule) === 'published' ? styles.statusPublished : styles.statusDraft}>
                        {getScheduleStatus(schedule) === 'published' ? t.published : t.draft}
                      </span>
                    </div>

                    {scheduleShifts.length === 0 ? (
                      <p style={styles.emptyText}>{t.empty}</p>
                    ) : (
                      <div style={styles.shiftList}>
                        {scheduleShifts.map((shift) => {
                          const shiftId = getShiftId(shift);
                          const availableEmployees = availableByShift[shiftId] || [];

                          return (
                            <div key={shiftId} style={styles.shiftCard}>
                              <div style={styles.shiftMain}>
                                <strong style={styles.itemTitle}>{getShiftEmployeeName(shift)}</strong>
                                <span style={styles.itemMeta}>{getShiftPosition(shift)}</span>
                                <span style={styles.itemMeta}>{shift.date}</span>
                                <span style={styles.timeBadge}>
                                  {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                                </span>
                              </div>

                              <div style={styles.shiftActions}>
                                <button
                                  type="button"
                                  onClick={() => handleLoadAvailableForShift(shift)}
                                  style={styles.smallSecondaryButton}
                                  disabled={isSubmitting}
                                >
                                  {t.loadEmployees}
                                </button>

                                <select
                                  value={reassignEmployeeIds[shiftId] || ''}
                                  onChange={(event) =>
                                    setReassignEmployeeIds((prev) => ({
                                      ...prev,
                                      [shiftId]: event.target.value,
                                    }))
                                  }
                                  onFocus={() => handleLoadAvailableForShift(shift)}
                                  style={styles.select}
                                >
                                  <option value="">
                                    {availableEmployees.length ? t.chooseEmployee : t.noEmployeesForPosition}
                                  </option>
                                  {availableEmployees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>
                                      {employee.full_name}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => handleShiftAction(shiftId, 'reassign', shift)}
                                  style={styles.smallPrimaryButton}
                                  disabled={!reassignEmployeeIds[shiftId] || isSubmitting}
                                >
                                  {t.reassign}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleShiftAction(shiftId, 'remove', shift)}
                                  style={styles.smallSecondaryButton}
                                  disabled={isSubmitting}
                                >
                                  {t.remove}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <div style={styles.bottomGrid}>
                    <section style={styles.panel}>
                      <h3 style={styles.panelTitle}>{t.unfilled}</h3>

                      {unfilledRequirements.length === 0 ? (
                        <p style={styles.emptyText}>{t.empty}</p>
                      ) : (
                        <div style={styles.compactList}>
                          {unfilledRequirements.map((item) => {
                            const requirementId = item.requirement_id;

                            return (
                            <div key={requirementId} style={styles.compactItem}>
                              <strong style={styles.itemTitle}>
                                {getPositionLabel({
                                  position_id: item.position_id,
                                  position_title: item.position_title || item.position,
                                }, item.position_title || '—')}
                              </strong>
                              <span style={styles.itemMeta}>{item.date}</span>
                              <span style={styles.itemMeta}>
                                {formatTime(item.start_time)} — {formatTime(item.end_time)}
                              </span>
                              <span style={styles.staffBadge}>
                                {t.missingStaff}: {item.missing_staff}
                              </span>
                              <div style={styles.shiftActions}>
                                <select
                                  value={assignEmployeeIds[requirementId] || ''}
                                  onChange={(event) => setAssignEmployeeIds((prev) => ({
                                    ...prev,
                                    [requirementId]: event.target.value,
                                  }))}
                                  style={styles.select}
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
                                  style={styles.smallPrimaryButton}
                                  disabled={isSubmitting || !assignEmployeeIds[requirementId]}
                                >
                                  {t.assign}
                                </button>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <section style={styles.panel}>
                      <h3 style={styles.panelTitle}>{t.conflicts}</h3>

                      {conflicts.length === 0 ? (
                        <p style={styles.emptyText}>{t.empty}</p>
                      ) : (
                        <div style={styles.compactList}>
                          {conflicts.map((conflict) => (
                            <div key={`${conflict.employee_id}-${conflict.date}`} style={styles.compactItem}>
                              <strong style={styles.itemTitle}>{conflict.employee_name}</strong>
                              <span style={styles.itemMeta}>{conflict.date}</span>
                              <span style={styles.itemMeta}>
                                {localizeBackendMessage(conflict.message, language)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
            </main>
          </div>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: '16px 24px 18px',
    overflowY: 'hidden',
    overflowX: 'hidden',
    background: '#f4faff',
  },

  desktopViewportPage: {
    height: 'calc(100dvh - 96px)',
    overflow: 'hidden',
  },

  shell: {
    width: 'min(100%, 1480px)',
    height: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: 0,
    borderRadius: 0,
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },

  desktopScaleShell: {
    width: '125%',
    height: '125%',
    transform: 'scale(0.8)',
    transformOrigin: 'top left',
  },

  header: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: '12px',
    marginBottom: '14px',
  },

  title: {
    margin: 0,
    color: '#002642',
    fontSize: '28px',
    fontWeight: '900',
    letterSpacing: 0,
  },

  subtitle: {
    maxWidth: '820px',
    margin: '4px 0 0',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: 1.45,
  },

  headerStats: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },

  managerLayout: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '300px minmax(0, 1fr)',
    gap: '14px',
    overflow: 'hidden',
  },

  sidebar: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
  },

  previewArea: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr) auto',
    gap: '14px',
    overflow: 'hidden',
  },

  employeeArea: {
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  panel: {
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },

  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '14px',
    flexShrink: 0,
  },

  panelTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '18px',
    fontWeight: '900',
  },

  panelHint: {
    margin: '4px 0 0',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '650',
  },

  modeSegment: {
    display: 'inline-flex',
    borderRadius: '12px',
    background: '#eef3f6',
    padding: '4px',
    gap: '6px',
    flexShrink: 0,
  },

  modeButton: {
    minWidth: '70px',
    border: 'none',
    borderRadius: '9px',
    background: 'transparent',
    color: '#4f646f',
    padding: '9px 13px',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },

  modeButtonActive: {
    background: '#002642',
    color: '#f4faff',
  },

  employeeCalendarPanel: {
    padding: '16px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto minmax(260px, 1fr) minmax(230px, 0.55fr)',
    gap: '12px',
    flex: 1,
    minHeight: 0,
  },

  employeeCalendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },

  employeeCalendarTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '24px',
    fontWeight: '900',
    textTransform: 'capitalize',
  },

  calendarNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  calendarNavButton: {
    width: '48px',
    height: '40px',
    borderRadius: '10px',
    border: '1px solid #dee7e7',
    background: '#eef3f6',
    color: '#002642',
    fontSize: '22px',
    fontWeight: '800',
    cursor: 'pointer',
  },

  calendarTodayButton: {
    height: '40px',
    padding: '0 16px',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  monthCalendar: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: '28px minmax(0, 1fr)',
    border: '1px solid #dee7e7',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#ffffff',
  },

  monthWeekdays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    background: '#f4faff',
    borderBottom: '1px solid #dee7e7',
  },

  monthWeekday: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '850',
    textTransform: 'capitalize',
  },

  monthGrid: {
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gridAutoRows: 'minmax(46px, 1fr)',
    background: '#dee7e7',
    gap: '1px',
  },

  monthDayCell: {
    minWidth: 0,
    minHeight: 0,
    border: 0,
    background: '#ffffff',
    color: '#002642',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4px',
  },

  monthDayMuted: {
    background: '#f8fbfd',
    color: '#8da0a9',
  },

  monthDaySelected: {
    background: '#eaf6ff',
    boxShadow: 'inset 0 0 0 2px #002642',
  },

  monthDayNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '800',
  },

  monthDayToday: {
    border: '2px solid #007aff',
    color: '#007aff',
  },

  monthDayNumberSelected: {
    background: '#002642',
    color: '#ffffff',
    borderColor: '#002642',
  },

  monthDots: {
    minHeight: '7px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '3px',
  },

  monthDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'block',
  },

  selectedDatePanel: {
    minHeight: 0,
    borderRadius: '12px',
    border: '1px solid #dee7e7',
    background: '#f8fbfd',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflow: 'hidden',
  },

  selectedDateHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    flexShrink: 0,
  },

  selectedDateCount: {
    minWidth: '40px',
    height: '32px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#002642',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    fontWeight: '900',
  },

  selectedDateEmpty: {
    flex: 1,
    minHeight: '100px',
    borderRadius: '10px',
    background: '#ffffff',
    border: '1px solid #edf2f2',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '6px',
    padding: '18px',
  },

  selectedShiftList: {
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingRight: '4px',
  },

  calendarShiftCard: {
    padding: '14px',
    borderRadius: '10px',
    background: '#ffffff',
    border: '1px solid #edf2f2',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  calendarShiftInfo: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },

  calendarShiftTimeInline: {
    height: '34px',
    padding: '0 12px',
    borderRadius: '9px',
    background: '#002642',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    fontWeight: '900',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  calendarDurationBadge: {
    height: '34px',
    padding: '0 12px',
    borderRadius: '9px',
    background: '#d7adcf',
    color: '#002642',
    border: '1px solid rgba(215, 173, 207, 0.85)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '850',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  calendarShiftTime: {
    borderRadius: '10px',
    background: '#002642',
    color: '#ffffff',
    padding: '10px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    minHeight: '86px',
  },

  calendarShiftTimeStart: {
    fontSize: '22px',
    fontWeight: '900',
    lineHeight: 1,
  },

  calendarShiftTimeLine: {
    width: '22px',
    height: '2px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.55)',
  },

  calendarShiftTimeEnd: {
    fontSize: '16px',
    fontWeight: '850',
    lineHeight: 1,
    opacity: 0.9,
  },

  calendarShiftBody: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '10px',
  },

  calendarShiftTitle: {
    minWidth: 0,
    color: '#002642',
    fontSize: '18px',
    fontWeight: '900',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  calendarExchangeRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 180px',
    gap: '10px',
    alignItems: 'stretch',
  },

  calendarShiftMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },

  calendarExchangePanel: {
    minWidth: 0,
    display: 'grid',
    gridTemplateRows: '1fr auto',
    gap: '8px',
  },

  calendarExchangeTextarea: {
    width: '100%',
    minHeight: '62px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#f8fbfd',
    padding: '10px 12px',
    color: '#002642',
    fontSize: '13px',
    resize: 'vertical',
    outline: 'none',
  },

  calendarExchangeInput: {
    width: '100%',
    height: '42px',
    minHeight: '42px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: '1px solid #dbe6f0',
    background: '#f8fbfd',
    padding: '11px 12px',
    color: '#002642',
    fontSize: '13px',
    resize: 'none',
    outline: 'none',
    overflow: 'hidden',
  },

  calendarExchangeButton: {
    width: '100%',
    height: '42px',
    padding: '0 14px',
    background: '#002642',
    border: 'none',
    borderRadius: '9px',
    color: '#f4faff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  employeeTimelineScroll: {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '4px',
  },

  employeeTimeline: {
    display: 'grid',
    gap: '16px',
    marginTop: '10px',
  },

  timelineDay: {
    padding: '16px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 10px 24px rgba(0, 38, 66, 0.035)',
  },

  timelineDayHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '14px',
  },

  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  label: {
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '850',
  },

  input: {
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 14px',
    color: '#002642',
    fontSize: '13px',
    outline: 'none',
  },

  dateInput: {
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 14px',
    color: '#002642',
    colorScheme: 'light',
    fontSize: '13px',
    fontWeight: '700',
    outline: 'none',
    cursor: 'pointer',
  },

  select: {
    width: '210px',
    height: '36px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 12px',
    color: '#002642',
    fontSize: '13px',
    outline: 'none',
  },

  textarea: {
    width: '100%',
    minHeight: '58px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '10px 12px',
    color: '#002642',
    fontSize: '14px',
    resize: 'vertical',
    outline: 'none',
  },

  primaryButton: {
    height: '40px',
    padding: '0 16px',
    background: '#002642',
    border: 'none',
    borderRadius: '10px',
    color: '#f4faff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  primaryButtonDisabled: {
    height: '40px',
    padding: '0 16px',
    background: '#4f646f',
    border: 'none',
    borderRadius: '10px',
    color: '#f4faff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
  },

  secondaryButton: {
    height: '40px',
    padding: '0 16px',
    background: '#eef2ff',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    borderRadius: '10px',
    color: '#3730a3',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  secondaryButtonDisabled: {
    height: '40px',
    padding: '0 16px',
    background: '#eef2ff',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    borderRadius: '10px',
    color: '#3730a3',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
  },

  smallPrimaryButton: {
    height: '34px',
    padding: '0 12px',
    background: '#002642',
    border: 'none',
    borderRadius: '9px',
    color: '#f4faff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  smallSecondaryButton: {
    height: '34px',
    padding: '0 12px',
    background: '#eef2ff',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    borderRadius: '9px',
    color: '#3730a3',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  smallPrimaryButtonDisabled: {
    height: '34px',
    padding: '0 12px',
    background: '#4f646f',
    border: 'none',
    borderRadius: '9px',
    color: '#f4faff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
  },

  smallSecondaryButtonDisabled: {
    height: '34px',
    padding: '0 12px',
    background: '#eef2ff',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    borderRadius: '9px',
    color: '#3730a3',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
  },

  inlineActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  },

  helpBox: {
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    color: '#002642',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '750',
    lineHeight: 1.35,
  },

  helpTitle: {
    margin: '0 0 4px',
    fontSize: '17px',
    fontWeight: '900',
  },

  metric: {
    minWidth: 0,
    height: '46px',
    boxSizing: 'border-box',
    padding: '0 18px',
    borderRadius: '12px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    color: '#002642',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    boxShadow: '0 8px 20px rgba(0, 38, 66, 0.035)',
  },

  metricLabel: {
    fontSize: '13px',
    color: '#4f646f',
    fontWeight: '800',
  },

  metricValue: {
    fontSize: '24px',
    fontWeight: '900',
    color: '#002642',
  },

  statusDraft: {
    padding: '7px 11px',
    borderRadius: '999px',
    background: '#f4faff',
    color: '#002642',
    border: '1px solid #dee7e7',
    fontSize: '13px',
    fontWeight: '850',
  },

  statusPublished: {
    padding: '7px 11px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#3730a3',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    fontSize: '13px',
    fontWeight: '850',
  },

  shiftList: {
    maxHeight: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  shiftCard: {
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#ffffff',
    border: '1px solid #edf2f2',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
  },

  shiftMain: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  shiftRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },

  shiftActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  timeBadge: {
    padding: '4px 10px',
    borderRadius: '999px',
    background: '#f4faff',
    color: '#002642',
    border: '1px solid #dee7e7',
    fontSize: '12px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },

  bottomGrid: {
    minHeight: '160px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },

  compactList: {
    marginTop: '12px',
    maxHeight: '180px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  compactItem: {
    padding: '12px 13px',
    borderRadius: '12px',
    background: '#ffffff',
    border: '1px solid #edf2f2',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },

  itemTitle: {
    color: '#002642',
    fontWeight: '850',
    overflowWrap: 'anywhere',
  },

  itemMeta: {
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '650',
  },

  staffBadge: {
    width: 'fit-content',
    padding: '7px 11px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#3730a3',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    fontSize: '13px',
    fontWeight: '850',
  },

  emptyHero: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '42px 28px',
    background: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
  },

  emptyHeroInner: {
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
  },

  emptyIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: '#f4faff',
    border: '1px solid #dee7e7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    marginBottom: '4px',
    boxShadow: '0 8px 20px rgba(0, 38, 66, 0.06)',
  },

  emptyTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '22px',
    fontWeight: '900',
  },

  emptySubtitle: {
    margin: 0,
    color: '#4f646f',
    fontSize: '15px',
    fontWeight: '650',
    lineHeight: 1.5,
  },

  emptyNote: {
    margin: '4px 0 0',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#f8fbff',
    border: '1px solid #dee7e7',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: 1.45,
  },

  emptySteps: {
    margin: '8px 0 0',
    padding: '14px 18px',
    listStyle: 'none',
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    background: '#f8fbff',
    border: '1px solid #dee7e7',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    textAlign: 'left',
  },

  emptyStepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },

  emptyStepBadge: {
    flexShrink: 0,
    width: '24px',
    height: '24px',
    borderRadius: '999px',
    background: '#dee7e7',
    color: '#002642',
    fontSize: '12px',
    fontWeight: '800',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyStepText: {
    color: '#334155',
    fontSize: '14px',
    fontWeight: '650',
    lineHeight: 1.45,
    textAlign: 'left',
  },

  emptyBox: {
    padding: '26px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    color: '#4f646f',
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyText: {
    margin: 0,
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '650',
    lineHeight: 1.45,
  },

  toastLayer: {
    position: 'absolute',
    top: '22px',
    right: '26px',
    zIndex: 20,
    width: 'min(420px, calc(100% - 52px))',
    pointerEvents: 'none',
  },

  toastSuccess: {
    minHeight: '44px',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: '16px',
    background: '#ffffff',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '750',
    display: 'grid',
    gridTemplateColumns: '26px minmax(0, 1fr) 28px',
    alignItems: 'center',
    gap: '10px',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    boxShadow: '0 16px 36px rgba(0, 38, 66, 0.16)',
    pointerEvents: 'auto',
  },

  toastError: {
    minHeight: '44px',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: '16px',
    background: '#ffffff',
    color: '#8d1d1d',
    fontSize: '14px',
    fontWeight: '750',
    display: 'grid',
    gridTemplateColumns: '26px minmax(0, 1fr) 28px',
    alignItems: 'center',
    gap: '10px',
    border: '1px solid rgba(215, 173, 207, 0.6)',
    boxShadow: '0 16px 36px rgba(0, 38, 66, 0.16)',
    pointerEvents: 'auto',
  },

  toastIconSuccess: {
    width: '26px',
    height: '26px',
    borderRadius: '999px',
    background: '#dee7e7',
    color: '#002642',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '900',
  },

  toastIconError: {
    width: '26px',
    height: '26px',
    borderRadius: '999px',
    background: 'rgba(215, 173, 207, 0.5)',
    color: '#8d1d1d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '900',
  },

  toastText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  toastClose: {
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '999px',
    background: 'transparent',
    color: '#4f646f',
    fontSize: '18px',
    fontWeight: '900',
    cursor: 'pointer',
    lineHeight: 1,
  },
};
