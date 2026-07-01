// frontend/src/components/tabs/ShiftsTab.jsx
/* eslint-disable react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createMyAbsence,
  deleteEmployeeAbsence,
  getMyAbsences,
  updateEmployeeAvailability,
} from '../../services/employeeService';
import { extractApiErrorMessage, localizeBackendMessage } from '../../services/error';
import { importRequirementsXlsx } from '../../services/importService';
import { listPositions } from '../../services/positionService';
import {
  createBulkRequirements,
  createRequirement,
  deleteRequirement,
  formatLocalDate,
  listRequirements,
} from '../../services/scheduleService';
import { useTabResponsive } from '../../utils/tabResponsive';
import { usePositionTitleRevision } from '../../hooks/usePositionTitleRevision';
import { useUnsavedChanges } from '../../context/useUnsavedChanges';
import {
  DEFAULT_AVAILABILITY_STYLE,
  getAvailabilityStyle,
  getPositionLabel,
  normalizeAvailabilityStatus,
} from '../../utils/employeeDisplay';

const WEEKDAYS = [
  { value: 0, ru: 'Пн', en: 'Mon' },
  { value: 1, ru: 'Вт', en: 'Tue' },
  { value: 2, ru: 'Ср', en: 'Wed' },
  { value: 3, ru: 'Чт', en: 'Thu' },
  { value: 4, ru: 'Пт', en: 'Fri' },
  { value: 5, ru: 'Сб', en: 'Sat' },
  { value: 6, ru: 'Вс', en: 'Sun' },
];

const SLOT_MINUTES = 30;
const DAY_START_MINUTES = 6 * 60; // 06:00
const DAY_END_MINUTES = 23 * 60; // 23:00 (exclusive end of the last slot)

const TIME_SLOTS = Array.from(
  { length: (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES },
  (_, index) => {
    const total = DAY_START_MINUTES + (index * SLOT_MINUTES);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  },
);

const MOBILE_HOUR_GROUPS = TIME_SLOTS.reduce((groups, slot, index) => {
  if (index % 2 === 0) {
    groups.push({
      hour: slot.slice(0, 2),
      slots: TIME_SLOTS[index + 1] ? [slot, TIME_SLOTS[index + 1]] : [slot],
    });
  }
  return groups;
}, []);

const MOBILE_BRUSH_OPTIONS = [
  { id: 'available', color: '#4CAF50', textColor: '#ffffff' },
  { id: 'if_needed', color: '#FFC107', textColor: '#002642' },
  { id: 'unavailable', color: '#eef3f6', textColor: '#4f646f' },
];

const AVAILABILITY_MODE_OPTIONS = MOBILE_BRUSH_OPTIONS;
const SINGLE_REQUIREMENT_SCOPE = 'shifts-single-requirement';
const BULK_REQUIREMENT_SCOPE = 'shifts-bulk-requirement';
const IMPORT_SCOPE = 'shifts-import';
const AVAILABILITY_SCOPE = 'shifts-availability';
const ABSENCE_SCOPE = 'shifts-absence';

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isPastDateKey(dateKey) {
  if (!dateKey) return false;

  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  date.setHours(0, 0, 0, 0);
  return date.getTime() < startOfToday().getTime();
}

function slotToMinutes(slot) {
  const [hours, minutes] = String(slot).split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function buildIntervalsForWeekday(weekday, availabilityStatus, slotStarts) {
  const sorted = [...slotStarts].sort((a, b) => a - b);
  const intervals = [];
  let startMinutes = null;
  let previousMinutes = null;

  sorted.forEach((minutes) => {
    if (startMinutes === null) {
      startMinutes = minutes;
      previousMinutes = minutes;
      return;
    }

    if (minutes === previousMinutes + SLOT_MINUTES) {
      previousMinutes = minutes;
      return;
    }

    intervals.push({
      weekday,
      start_time: minutesToTimeString(startMinutes),
      end_time: minutesToTimeString(previousMinutes + SLOT_MINUTES),
      availability_status: availabilityStatus,
    });

    startMinutes = minutes;
    previousMinutes = minutes;
  });

  if (startMinutes !== null) {
    intervals.push({
      weekday,
      start_time: minutesToTimeString(startMinutes),
      end_time: minutesToTimeString(previousMinutes + SLOT_MINUTES),
      availability_status: availabilityStatus,
    });
  }

  return intervals;
}

// Backend only stores a recurring weekly availability template, so when saving we
// aggregate the visible week selections back into weekly intervals (Monday = 0).
function convertDatesToWeeklyIntervals(availabilityByDate, dates = []) {
  const slotsByWeekdayAndStatus = {};
  const sourceDates = Array.isArray(dates) && dates.length > 0
    ? dates
    : Object.keys(availabilityByDate || {}).map((dateKey) => new Date(`${dateKey}T00:00:00`));

  const dateEntries = sourceDates
    .map((date) => {
      const dateKey = toDateKey(date);
      return dateKey ? [dateKey, availabilityByDate?.[dateKey] || {}] : null;
    })
    .filter(Boolean);

  dateEntries.forEach(([dateKey, slotMap]) => {
    const jsDay = new Date(`${dateKey}T00:00:00`).getDay();
    const weekday = (jsDay + 6) % 7;

    Object.entries(slotMap || {}).forEach(([slot, status]) => {
      const normalizedStatus = normalizeAvailabilityStatus(status);
      if (normalizedStatus === 'available' || normalizedStatus === 'if_needed') {
        const key = `${weekday}:${normalizedStatus}`;
        if (!slotsByWeekdayAndStatus[key]) slotsByWeekdayAndStatus[key] = new Set();
        slotsByWeekdayAndStatus[key].add(slotToMinutes(slot));
      }
    });
  });

  const intervals = [];
  Object.entries(slotsByWeekdayAndStatus).forEach(([key, slotStarts]) => {
    const [weekday, availabilityStatus] = key.split(':');
    intervals.push(...buildIntervalsForWeekday(Number(weekday), availabilityStatus, slotStarts));
  });

  return intervals;
}

function normalizeAvailabilityByDate(value) {
  return Object.entries(value || {}).reduce((result, [dateKey, slotMap]) => {
    result[dateKey] = Object.entries(slotMap || {}).reduce((dayMap, [slot, status]) => {
      dayMap[slot] = normalizeAvailabilityStatus(status);
      return dayMap;
    }, {});
    return result;
  }, {});
}

function defaultSingleRequirement() {
  const today = formatLocalDate(new Date());
  return {
    position_id: '',
    date: today,
    min_staff: 1,
    start_time: '09:00:00',
    end_time: '18:00:00',
  };
}

function endOfCurrentMonth() {
  const today = new Date();
  return formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
}

function defaultBulkRequirement() {
  const today = formatLocalDate(new Date());
  const end = endOfCurrentMonth();

  return {
    start_date: today,
    end_date: end,
    weekdays: [0, 1, 2, 3, 4],
    requirements: [
      {
        position_id: '',
        min_staff: 1,
        start_time: '09:00:00',
        end_time: '18:00:00',
      },
    ],
  };
}

function currentMonthFilters() {
  const today = formatLocalDate(new Date());
  return {
    start_date: today,
    end_date: endOfCurrentMonth(),
    position_id: '',
    date: '',
  };
}

function buildRequirementListParams(filters = {}) {
  const params = {};

  if (filters.date) {
    params.start_date = filters.date;
    params.end_date = filters.date;
  } else {
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
  }

  if (filters.position_id) {
    params.position_id = Number(filters.position_id);
  }

  return params;
}

function matchesRequirementFilters(requirement, filters = {}) {
  if (filters.date) {
    if (requirement.date !== filters.date) return false;
  } else if (!isDateWithinRange(requirement.date, filters.start_date, filters.end_date)) {
    return false;
  }

  if (filters.position_id && String(requirement.position_id) !== String(filters.position_id)) {
    return false;
  }

  return true;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.requirements)) return value.requirements;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

function getRequirementId(requirement) {
  return requirement?.id || requirement?.requirement_id;
}

function normalizeRequirement(requirement, positions = []) {
  if (!requirement) return null;

  const positionId = requirement.position_id || requirement.positionId;
  const position = positions.find((item) => String(item.id) === String(positionId));

  return {
    ...requirement,
    id: getRequirementId(requirement),
    position_id: positionId,
    position_title: getPositionLabel({
      position_id: positionId,
      position_title: requirement.position_title || requirement.positionTitle,
      position: requirement.position,
    }, getPositionLabel(position) || 'Position'),
    date: requirement.date,
    start_time: requirement.start_time || requirement.startTime,
    end_time: requirement.end_time || requirement.endTime,
    min_staff: requirement.min_staff || requirement.minStaff || 1,
  };
}

function isDateWithinRange(date, startDate, endDate) {
  if (!date || !startDate || !endDate) return true;
  return date >= startDate && date <= endDate;
}

function normalizeError(error, fallback, language) {
  return extractApiErrorMessage(error, fallback, language) || fallback;
}

export default function ShiftsTab({ language, userRole, user }) {
  const positionTitleRevision = usePositionTitleRevision();
  const r = useTabResponsive(1480);
  const { markUnsaved, markSaved } = useUnsavedChanges();
  const isManager = userRole === 'manager';
  const employeeId = user?.employeeId || user?.employee_id;

  const [mode, setMode] = useState('single');
  const [positions, setPositions] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [singleRequirement, setSingleRequirement] = useState(defaultSingleRequirement);
  const [bulkRequirement, setBulkRequirement] = useState(defaultBulkRequirement);

  const [filterForm, setFilterForm] = useState(currentMonthFilters);
  const [appliedFilters, setAppliedFilters] = useState(currentMonthFilters);

  const availabilityStorageKey = employeeId
    ? `shiftplanner_availability_by_date_v2_${employeeId}`
    : 'shiftplanner_availability_by_date_v2_anon';

  // Availability is tracked per calendar date: { 'YYYY-MM-DD': { [hour]: 'available' | 'if_needed' | 'unavailable' } }
  const [availabilityByDate, setAvailabilityByDate] = useState(() => {
    try {
      const raw = localStorage.getItem(availabilityStorageKey);
      return raw ? normalizeAvailabilityByDate(JSON.parse(raw)) : {};
    } catch {
      return {};
    }
  });

  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [brushMode, setBrushMode] = useState('available');
  const dragSelectionRef = useRef({
    active: false,
    appliedKeys: new Set(),
    lastCell: null,
    touchIdentifier: null,
  });

  const weekDates = useMemo(() => {
    const current = new Date(selectedDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const [mobileAvailabilityDay, setMobileAvailabilityDay] = useState(() => (new Date().getDay() + 6) % 7);

  const shiftWeek = (deltaDays) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + deltaDays);
      return formatLocalDate(d);
    });
  };

  const handleSelectedDateChange = (value) => {
    setSelectedDate(value);
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      setMobileAvailabilityDay((date.getDay() + 6) % 7);
    }
  };

  const [absenceForm, setAbsenceForm] = useState(() => {
    const today = formatLocalDate(new Date());
    return {
      absence_type: 'vacation',
      start_date: today,
      end_date: today,
      comment: '',
    };
  });

  const [absences, setAbsences] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      stepOne: '1. Выберите период',
      stepTwo: '2. Создайте требование',
      stepThree: '3. Проверьте список',
      filters: 'Фильтры',
      allPositions: 'Все профессии',
      filterDate: 'Конкретная дата',
      clearFilters: 'Сбросить',
      single: 'Одно требование',
      bulk: 'Массовое создание',
      import: 'Импорт XLSX',
      requirements: 'Созданные требования',
      position: 'Позиция',
      date: 'Дата',
      startDate: 'Начало периода',
      endDate: 'Конец периода',
      startTime: 'Начало',
      endTime: 'Окончание',
      minStaff: 'Сотрудников',
      upload: 'Загрузить',
      create: 'Создать',
      refresh: 'Показать требования',
      save: 'Сохранить',
      availability: 'Моя доступность',
      markMode: 'Режим отметки',
      desiredDaysOff: 'Желаемые выходные',
      absences: 'Мои отсутствия',
      absenceType: 'Тип отсутствия',
      comment: 'Комментарий',
      addRow: 'Добавить интервал',
      addAbsence: 'Добавить отсутствие',
      empty: 'Нет данных',
      loading: 'Загрузка...',
      fileHint: 'Только .xlsx. Колонки: date, position_id, start_time, end_time, min_staff.',
      requirementCreated: 'Требование создано.',
      requirementDeleted: 'Требование удалено.',
      deleteRequirement: 'Удалить требование',
      bulkCreated: 'Требования созданы.',
      availabilitySaved: 'Доступность сохранена.',
      absenceAdded: 'Отсутствие добавлено.',
      absenceDeleted: 'Отсутствие удалено.',
      importDone: 'Импорт завершен.',
      vacation: 'Отпуск',
      sick_leave: 'Больничный',
      other: 'Другое',
      delete: 'Удалить',
      shifts: 'Смены из календаря',
      hours: 'Часы',
      totalShifts: 'Смены',
      importErrors: 'Ошибки импорта',
      xlsxOnly: 'Поддерживается только .xlsx.',
      row: 'Строка',
      draft: 'Черновик',
      published: 'Опубликовано',
      noPositions: 'Сначала создайте позиции во вкладке «Сотрудники».',
      noRequirements: 'За выбранный период требований нет.',
      choosePosition: 'Выберите позицию',
      selectFile: 'Выберите .xlsx файл',
      missingEmployeeProfile: 'Аккаунт сотрудника не привязан к профилю. Сначала присоединитесь к компании.',
      bulkHint: 'Создаст одинаковые требования на выбранные дни недели внутри периода.',
      singleHint: 'Например: Barista, 15.06, 09:00–18:00, нужно 2 человека.',
      localOnly: 'локально',
      deleteNotSupported: 'Удаление через API пока недоступно.',
      available: 'Доступен',
      if_needed: 'Может быть',
      unavailable: 'Недоступен',
      prevWeek: 'Предыдущая неделя',
      nextWeek: 'Следующая неделя',
      locked: 'Прошедшие даты изменить нельзя',
    },
    en: {
      stepOne: '1. Choose period',
      stepTwo: '2. Create requirement',
      stepThree: '3. Check list',
      filters: 'Filters',
      allPositions: 'All positions',
      filterDate: 'Specific date',
      clearFilters: 'Reset',
      single: 'Single requirement',
      bulk: 'Bulk creation',
      import: 'XLSX import',
      requirements: 'Created requirements',
      position: 'Position',
      date: 'Date',
      startDate: 'Start date',
      endDate: 'End date',
      startTime: 'Start',
      endTime: 'End',
      minStaff: 'Staff',
      upload: 'Upload',
      create: 'Create',
      refresh: 'Show requirements',
      save: 'Save',
      availability: 'My availability',
      markMode: 'Marking mode',
      desiredDaysOff: 'Desired days off',
      absences: 'My absences',
      absenceType: 'Absence type',
      comment: 'Comment',
      addRow: 'Add interval',
      addAbsence: 'Add absence',
      empty: 'No data',
      loading: 'Loading...',
      fileHint: 'Only .xlsx. Columns: date, position_id, start_time, end_time, min_staff.',
      requirementCreated: 'Requirement created.',
      requirementDeleted: 'Requirement deleted.',
      deleteRequirement: 'Delete requirement',
      bulkCreated: 'Requirements created.',
      availabilitySaved: 'Availability saved.',
      absenceAdded: 'Absence added.',
      absenceDeleted: 'Absence deleted.',
      importDone: 'Import completed.',
      vacation: 'Vacation',
      sick_leave: 'Sick leave',
      other: 'Other',
      delete: 'Delete',
      shifts: 'Calendar shifts',
      hours: 'Hours',
      totalShifts: 'Shifts',
      importErrors: 'Import errors',
      xlsxOnly: 'Only .xlsx is supported.',
      row: 'Row',
      draft: 'Draft',
      published: 'Published',
      noPositions: 'Create positions in the Employees tab first.',
      noRequirements: 'No requirements found for the selected period.',
      choosePosition: 'Choose position',
      selectFile: 'Choose .xlsx file',
      missingEmployeeProfile: 'This employee account is not linked to a profile yet. Join a company first.',
      bulkHint: 'Creates the same requirements for selected weekdays within the period.',
      singleHint: 'Example: Barista, Jun 15, 09:00–18:00, need 2 people.',
      localOnly: 'local',
      deleteNotSupported: 'Delete is not available via API yet.',
      available: 'Available',
      if_needed: 'If needed',
      unavailable: 'Unavailable',
      prevWeek: 'Previous week',
      nextWeek: 'Next week',
      locked: 'Past dates cannot be edited',
    },
  };

  const t = texts[language] || texts.ru;

  const isToday = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;

    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const getAvailabilityCellStyle = (dateKey, time) => {
    if (!dateKey || !time) return DEFAULT_AVAILABILITY_STYLE;

    const past = isPastDateKey(dateKey);
    if (past) return styles.gridCellLocked;

    const status = availabilityByDate?.[dateKey]?.[time];
    return getAvailabilityStyle(status, AVAILABILITY_STYLE_MAP, DEFAULT_AVAILABILITY_STYLE);
  };

  const getAvailabilityCellTitle = (dateKey, time) => {
    if (!dateKey || !time) return t.unavailable;

    const past = isPastDateKey(dateKey);
    const status = normalizeAvailabilityStatus(availabilityByDate?.[dateKey]?.[time]);

    if (past) return t.locked;
    if (status === 'available') return t.available;
    if (status === 'if_needed') return t.if_needed;
    return t.unavailable;
  };

  const weekRangeLabel = useMemo(() => {
    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    const start = weekDates[0]?.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) || '';
    const end = weekDates[6]?.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) || '';
    return `${start} — ${end}`;
  }, [language, weekDates]);

  const selectedMobileDate = weekDates[mobileAvailabilityDay] || weekDates[0];
  const selectedMobileDateKey = selectedMobileDate ? toDateKey(selectedMobileDate) : '';
  const selectedMobileDatePast = selectedMobileDateKey ? isPastDateKey(selectedMobileDateKey) : false;
  const selectedMobileDateLabel = selectedMobileDate instanceof Date && !Number.isNaN(selectedMobileDate.getTime())
    ? selectedMobileDate.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    : '—';

  const visibleRequirements = useMemo(() => (
    requirements
      .map((requirement) => normalizeRequirement(requirement, positions))
      .filter(Boolean)
      .filter((requirement) => matchesRequirementFilters(requirement, appliedFilters))
  ), [appliedFilters, positions, requirements, positionTitleRevision]);

  useEffect(() => {
    if (isManager) return;
    try {
      localStorage.setItem(availabilityStorageKey, JSON.stringify(availabilityByDate));
    } catch {
      // ignore localStorage failures
    }
  }, [availabilityByDate, availabilityStorageKey, isManager]);

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

  const loadManagerData = useCallback(async (filtersToUse = appliedFilters, options = {}) => {
    if (options.silent) setIsRefreshingList(true);

    const [positionsData, requirementsData] = await Promise.all([
      listPositions(),
      listRequirements(buildRequirementListParams(filtersToUse)),
    ]);

    const safePositions = normalizeArray(positionsData);
    const safeRequirements = normalizeArray(requirementsData)
      .map((requirement) => normalizeRequirement(requirement, safePositions))
      .filter(Boolean);

    setPositions(safePositions);
    setRequirements(safeRequirements);

    setSingleRequirement((prev) => ({
      ...prev,
      position_id: prev.position_id || String(safePositions[0]?.id || ''),
    }));

    setBulkRequirement((prev) => ({
      ...prev,
      requirements: prev.requirements.map((item) => ({
        ...item,
        position_id: item.position_id || String(safePositions[0]?.id || ''),
      })),
    }));

    if (options.silent) setIsRefreshingList(false);
  }, [appliedFilters]);

  const loadEmployeeData = useCallback(async () => {
    if (!employeeId) {
      setAvailabilityByDate({});
      setAbsences([]);
      return;
    }

    const absencesData = await getMyAbsences();

    const storedByDate = (() => {
      try {
        const raw = localStorage.getItem(availabilityStorageKey);
        return raw ? normalizeAvailabilityByDate(JSON.parse(raw)) : {};
      } catch {
        return {};
      }
    })();
    setAvailabilityByDate(storedByDate);

    setAbsences(normalizeArray(absencesData));
  }, [employeeId, availabilityStorageKey]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (isManager) {
        await loadManagerData(appliedFilters);
      } else {
        await loadEmployeeData();
      }
    } catch (error) {
      setErrorMessage(normalizeError(error, t.empty, language));
    } finally {
      setIsLoading(false);
      setIsRefreshingList(false);
    }
  }, [appliedFilters, isManager, language, loadEmployeeData, loadManagerData, t.empty]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const applyFilters = async () => {
    clearMessages();
    setAppliedFilters(filterForm);
    try {
      await loadManagerData(filterForm, { silent: true });
    } catch (error) {
      setErrorMessage(normalizeError(error, t.filters, language));
    } finally {
      setIsRefreshingList(false);
    }
  };

  const resetRequirementFilters = () => {
    const defaults = currentMonthFilters();
    setFilterForm(defaults);
    setAppliedFilters(defaults);
    void loadManagerData(defaults, { silent: true });
  };

  const applyAvailabilityStatus = useCallback((dateKey, slot, status = brushMode) => {
    if (!dateKey || !slot) return;
    if (isPastDateKey(dateKey)) return;

    const nextStatus = normalizeAvailabilityStatus(status);
    markUnsaved(AVAILABILITY_SCOPE);
    setAvailabilityByDate((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [slot]: nextStatus,
      },
    }));
  }, [brushMode, markUnsaved]);

  const applyAvailabilityDragCell = useCallback((dayIndex, slotIndex) => {
    const dragState = dragSelectionRef.current;
    const lastCell = dragState.lastCell;
    const steps = lastCell
      ? Math.max(Math.abs(dayIndex - lastCell.dayIndex), Math.abs(slotIndex - lastCell.slotIndex))
      : 0;

    for (let step = 0; step <= steps; step += 1) {
      const nextDayIndex = steps
        ? Math.round(lastCell.dayIndex + ((dayIndex - lastCell.dayIndex) * step) / steps)
        : dayIndex;
      const nextSlotIndex = steps
        ? Math.round(lastCell.slotIndex + ((slotIndex - lastCell.slotIndex) * step) / steps)
        : slotIndex;
      const date = weekDates[nextDayIndex];
      const slot = TIME_SLOTS[nextSlotIndex];
      if (!date || !slot) continue;

      const dateKey = toDateKey(date);
      const cellKey = `${dateKey}-${slot}`;
      if (dragState.appliedKeys.has(cellKey)) continue;
      dragState.appliedKeys.add(cellKey);
      applyAvailabilityStatus(dateKey, slot, brushMode);
    }

    dragState.lastCell = { dayIndex, slotIndex };
  }, [applyAvailabilityStatus, brushMode, weekDates]);

  const startAvailabilityDrag = useCallback((dayIndex, slotIndex, touchIdentifier = null) => {
    dragSelectionRef.current = {
      active: true,
      appliedKeys: new Set(),
      lastCell: null,
      touchIdentifier,
    };
    applyAvailabilityDragCell(dayIndex, slotIndex);
  }, [applyAvailabilityDragCell]);


  const endAvailabilityDrag = useCallback(() => {
    const dragState = dragSelectionRef.current;
    if (!dragState) return;

    dragState.active = false;
    dragState.appliedKeys?.clear?.();
    dragState.lastCell = null;
    dragState.touchIdentifier = null;
  }, []);
  const fillAvailabilityDay = useCallback(
    (dateKey, status = brushMode) => {
      if (!dateKey || isPastDateKey(dateKey)) return;

      const nextStatus = normalizeAvailabilityStatus(status);

      markUnsaved(AVAILABILITY_SCOPE);

      setAvailabilityByDate((prev) => {
        const nextDay = {};

        TIME_SLOTS.forEach((slot) => {
          nextDay[slot] = nextStatus;
        });

        return {
          ...prev,
          [dateKey]: nextDay,
        };
      });
    },
    [brushMode, markUnsaved],
  );

  const handleAvailabilityMouseDown = useCallback((event, dayIndex, slotIndex) => {
    if (event.button !== 0) return;
    event.preventDefault();
    startAvailabilityDrag(dayIndex, slotIndex);
  }, [startAvailabilityDrag]);

  const handleAvailabilityMouseEnter = useCallback((dayIndex, slotIndex) => {
    if (!dragSelectionRef.current.active || dragSelectionRef.current.touchIdentifier !== null) return;
    applyAvailabilityDragCell(dayIndex, slotIndex);
  }, [applyAvailabilityDragCell]);

  const handleAvailabilityTouchStart = useCallback((event, dayIndex, slotIndex) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    event.preventDefault();
    startAvailabilityDrag(dayIndex, slotIndex, touch.identifier);
  }, [startAvailabilityDrag]);

  const handleAvailabilityTouchMove = useCallback((event) => {
    const dragState = dragSelectionRef.current;
    if (!dragState.active || dragState.touchIdentifier === null) return;

    const changedTouches = Array.from(event.changedTouches || []);
    const activeTouches = Array.from(event.touches || []);
    const touch = changedTouches.find((item) => item.identifier === dragState.touchIdentifier)
      || activeTouches.find((item) => item.identifier === dragState.touchIdentifier);
    if (!touch) return;

    event.preventDefault();
    const target = document
      .elementFromPoint(touch.clientX, touch.clientY)
      ?.closest('[data-availability-cell="true"]');
    if (!target) return;

    applyAvailabilityDragCell(Number(target.dataset.dayIndex), Number(target.dataset.slotIndex));
  }, [applyAvailabilityDragCell]);

  const renderAvailabilityGrid = () => (
    <div style={styles.availabilityGridTable}>
      <div style={styles.availabilityTimeHeader}>
        <div style={styles.gridCorner} />
        {TIME_SLOTS.map((time, slotIndex) => (
          <div key={time} style={styles.timeHeaderCell}>
            {slotIndex % 2 === 0 ? time : time.slice(3)}
          </div>
        ))}
      </div>

      {WEEKDAYS.map((day, dayIndex) => {
        const rowDate = weekDates[dayIndex];
        const dateKey = toDateKey(rowDate);
        const itIsToday = isToday(rowDate);

        return (
          <div key={day.value} style={styles.dateGridRow}>
            <button
              type="button"
              onClick={() => fillAvailabilityDay(dateKey)}
              onDoubleClick={() => fillAvailabilityDay(dateKey, 'unavailable')}
              disabled={!dateKey || isPastDateKey(dateKey)}
              style={{
                ...styles.dateHeaderCell,
                background: itIsToday ? '#002642' : '#f4faff',
                color: itIsToday ? '#ffffff' : '#002642',
                border: 'none',
                borderRight: '1px solid #dbe6f0',
                borderBottom: '1px solid #dbe6f0',
                cursor: !dateKey || isPastDateKey(dateKey)
                  ? 'not-allowed'
                  : 'pointer',
              }}
            >
             <span style={styles.dateHeaderWeekday}>
               {day[language] || day.ru}
  </span>
  <span style={styles.dateHeaderDate}>
    {rowDate?.toLocaleDateString?.(
      language === 'ru' ? 'ru-RU' : 'en-US',
      { day: 'numeric', month: 'short' }
    ) || ''}
  </span>
</button>

            {TIME_SLOTS.map((time, slotIndex) => {
              const past = !dateKey || isPastDateKey(dateKey);
              const status = normalizeAvailabilityStatus(availabilityByDate?.[dateKey]?.[time]);

              return (
                <button
                  key={`${dateKey}-${time}`}
                  type="button"
                  onMouseDown={past ? undefined : (event) => handleAvailabilityMouseDown(event, dayIndex, slotIndex)}
                  onMouseEnter={past ? undefined : () => handleAvailabilityMouseEnter(dayIndex, slotIndex)}
                  onTouchStart={past ? undefined : (event) => handleAvailabilityTouchStart(event, dayIndex, slotIndex)}
                  onTouchMove={past ? undefined : handleAvailabilityTouchMove}
                  data-availability-cell="true"
                  data-day-index={dayIndex}
                  data-slot-index={slotIndex}
                  disabled={past}
                  style={getAvailabilityCellStyle(dateKey, time)}
                  aria-pressed={status === 'available'}
                  title={getAvailabilityCellTitle(dateKey, time)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );

  useEffect(() => {
    window.addEventListener('mouseup', endAvailabilityDrag);
    window.addEventListener('touchend', endAvailabilityDrag);
    window.addEventListener('touchcancel', endAvailabilityDrag);
    window.addEventListener('blur', endAvailabilityDrag);

    return () => {
      window.removeEventListener('mouseup', endAvailabilityDrag);
      window.removeEventListener('touchend', endAvailabilityDrag);
      window.removeEventListener('touchcancel', endAvailabilityDrag);
      window.removeEventListener('blur', endAvailabilityDrag);
    };
  }, [endAvailabilityDrag]);
  const submitManagerRequirement = async () => {
    if (!singleRequirement.position_id || !singleRequirement.date) {
      setErrorMessage(t.single);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await createRequirement({
        ...singleRequirement,
        position_id: Number(singleRequirement.position_id),
        min_staff: Number(singleRequirement.min_staff),
      });

      const nextFilters = isDateWithinRange(
        singleRequirement.date,
        appliedFilters.start_date,
        appliedFilters.end_date
      )
        ? appliedFilters
        : {
            start_date: singleRequirement.date,
            end_date: singleRequirement.date,
          };

      setFilterForm(nextFilters);
      setAppliedFilters(nextFilters);

      await loadManagerData(nextFilters, { silent: true });
      markSaved(SINGLE_REQUIREMENT_SCOPE);
      setSuccessMessage(t.requirementCreated);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.requirements, language));
    } finally {
      setIsSubmitting(false);
      setIsRefreshingList(false);
    }
  };

  const removeRequirement = async (requirementId) => {
    if (!requirementId) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await deleteRequirement(requirementId);
      await loadManagerData(appliedFilters, { silent: true });
      setSuccessMessage(t.requirementDeleted);
    } catch (error) {
      const message = String(error?.message || '');
      if (message.includes('404') || message.includes('405') || message.toLowerCase().includes('not found')) {
        setErrorMessage(t.deleteNotSupported);
      } else {
        setErrorMessage(message || t.deleteRequirement);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitBulkRequirements = async () => {
    if (!bulkRequirement.requirements[0]?.position_id) {
      setErrorMessage(t.bulk);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await createBulkRequirements({
        ...bulkRequirement,
        requirements: bulkRequirement.requirements.map((item) => ({
          ...item,
          position_id: Number(item.position_id),
          min_staff: Number(item.min_staff),
        })),
      });

      const nextFilters = {
        start_date: bulkRequirement.start_date,
        end_date: bulkRequirement.end_date,
      };

      setFilterForm(nextFilters);
      setAppliedFilters(nextFilters);

      await loadManagerData(nextFilters, { silent: true });
      markSaved(BULK_REQUIREMENT_SCOPE);
      setSuccessMessage(t.bulkCreated);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.bulk, language));
    } finally {
      setIsSubmitting(false);
      setIsRefreshingList(false);
    }
  };

  const submitImport = async () => {
    if (!selectedFile) {
      setErrorMessage(t.selectFile);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMessage(t.xlsxOnly);
      return;
    }

    clearMessages();
    setImportResult(null);
    setIsSubmitting(true);

    try {
      const result = await importRequirementsXlsx(selectedFile);
      setImportResult(result);
      await loadManagerData(appliedFilters, { silent: true });
      markSaved(IMPORT_SCOPE);
      setSuccessMessage(t.importDone);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.import, language));
    } finally {
      setIsSubmitting(false);
      setIsRefreshingList(false);
    }
  };

  const submitAvailability = async () => {
    if (!employeeId) {
      setErrorMessage(t.missingEmployeeProfile);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      try {
        localStorage.setItem(availabilityStorageKey, JSON.stringify(availabilityByDate));
      } catch {
        // ignore localStorage failures
      }

      await updateEmployeeAvailability(employeeId, {
        desired_days_off: [],
        // The API still accepts a weekly shape; keep that sync limited to the
        // visible week, while the UI stores selections by exact calendar date.
        weekly_availability: convertDatesToWeeklyIntervals(availabilityByDate, weekDates),
      });
      await loadEmployeeData();
      markSaved(AVAILABILITY_SCOPE);
      setSuccessMessage(t.availabilitySaved);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.availability, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitAbsence = async () => {
    if (!employeeId) {
      setErrorMessage(t.missingEmployeeProfile);
      return;
    }

    if (!absenceForm.start_date || !absenceForm.end_date) {
      setErrorMessage(t.addAbsence);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await createMyAbsence(absenceForm);
      const today = formatLocalDate(new Date());
      setAbsenceForm({ absence_type: 'vacation', start_date: today, end_date: today, comment: '' });
      await loadEmployeeData();
      markSaved(ABSENCE_SCOPE);
      setSuccessMessage(t.absenceAdded);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.addAbsence, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeAbsence = async (absenceId) => {
    if (!employeeId) {
      setErrorMessage(t.missingEmployeeProfile);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await deleteEmployeeAbsence(employeeId, absenceId);
      await loadEmployeeData();
      setSuccessMessage(t.absenceDeleted);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.delete, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderToast = () => (
    (errorMessage || successMessage) && (
      <div style={styles.toastLayer}>
        <div style={errorMessage ? styles.toastError : styles.toastSuccess}>
          <span style={errorMessage ? styles.toastIconError : styles.toastIconSuccess}>
            {errorMessage ? '!' : '✓'}
          </span>
          <span style={styles.toastText}>{errorMessage || successMessage}</span>
          <button
            type="button"
            onClick={() => { setErrorMessage(''); setSuccessMessage(''); }}
            style={styles.toastClose}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      </div>
    )
  );

  if (isLoading) {
    return (
      <section style={{ ...styles.page, ...r.page, ...(r.isMobile ? {} : styles.desktopPage) }}>
        <div style={{ ...styles.shell, ...r.shell, ...(r.isMobile ? {} : styles.desktopShell) }}>
          <div style={styles.emptyBox}>{t.loading}</div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ ...styles.page, ...r.page, ...(r.isMobile ? {} : styles.desktopPage) }}>
      <div style={{ ...styles.shell, ...r.shell, ...(r.isMobile ? {} : styles.desktopShell) }}>
        {renderToast()}

        <header style={{ ...styles.header, ...r.header }}>
          <div>
            <h2 style={{ ...styles.title, ...r.title }}>{isManager ? t.titleManager : t.titleEmployee}</h2>
            <p style={styles.subtitle}>{isManager ? t.subtitleManager : t.subtitleEmployee}</p>
          </div>
        </header>

        {isManager ? (
          <div style={{ ...styles.managerLayout, ...r.splitLayout('290px minmax(0, 1fr)') }}>
            <aside style={styles.sidebar}>
              <div style={styles.helpBox}>
                <strong>{t.stepOne}</strong>
                <span>{t.stepTwo}</span>
                <span>{t.stepThree}</span>
              </div>

              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>{t.filters}</h3>

                <div style={styles.stack}>
                  <label style={styles.label}>{t.position}</label>
                  <select
                    value={filterForm.position_id}
                    onChange={(event) => setFilterForm((prev) => ({ ...prev, position_id: event.target.value }))}
                    style={styles.input}
                  >
                    <option value="">{t.allPositions}</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {getPositionLabel(position)}
                      </option>
                    ))}
                  </select>

                  <label style={styles.label}>{t.filterDate}</label>
                  <input
                    type="date"
                    value={filterForm.date}
                    onChange={(event) => setFilterForm((prev) => ({ ...prev, date: event.target.value }))}
                    style={styles.dateInput}
                  />

                  <label style={styles.label}>{t.startDate}</label>
                  <input
                    type="date"
                    value={filterForm.start_date}
                    onChange={(event) => setFilterForm((prev) => ({ ...prev, start_date: event.target.value }))}
                    style={styles.dateInput}
                    disabled={Boolean(filterForm.date)}
                  />

                  <label style={styles.label}>{t.endDate}</label>
                  <input
                    type="date"
                    value={filterForm.end_date}
                    onChange={(event) => setFilterForm((prev) => ({ ...prev, end_date: event.target.value }))}
                    style={styles.dateInput}
                    disabled={Boolean(filterForm.date)}
                  />

                  <div style={styles.filterActions}>
                    <button type="button" onClick={applyFilters} style={styles.secondaryButton}>
                      {isRefreshingList ? '...' : t.refresh}
                    </button>
                    <button type="button" onClick={resetRequirementFilters} style={styles.smallSecondaryButton}>
                      {t.clearFilters}
                    </button>
                  </div>
                </div>
              </section>

              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>{t.import}</h3>
                <p style={styles.panelHint}>{t.fileHint}</p>

                <label style={styles.filePicker}>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => {
                      setSelectedFile(event.target.files?.[0] || null);
                      markUnsaved(IMPORT_SCOPE);
                    }}
                    style={styles.hiddenFileInput}
                  />
                  <span>{selectedFile?.name || t.selectFile}</span>
                </label>

                <button
                  type="button"
                  onClick={submitImport}
                  style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {t.upload}
                </button>

                {importResult && (
                  <div style={styles.importBox}>
                    <div>{t.create}: {importResult.created_count}</div>
                    {normalizeArray(importResult.errors).length > 0 && (
                      <div style={styles.importErrors}>
                        <strong style={styles.itemTitle}>{t.importErrors}</strong>
                        {importResult.errors.map((item, index) => (
                          <div key={`${item.row}-${index}`} style={styles.itemMeta}>
                            {t.row} {item.row}: {localizeBackendMessage(item.message, language)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </aside>

            <main style={styles.workArea}>
              <div style={styles.modeSwitch}>
                <button
                  type="button"
                  style={mode === 'single' ? styles.modeButtonActive : styles.modeButton}
                  onClick={() => setMode('single')}
                >
                  {t.single}
                </button>

                <button
                  type="button"
                  style={mode === 'bulk' ? styles.modeButtonActive : styles.modeButton}
                  onClick={() => setMode('bulk')}
                >
                  {t.bulk}
                </button>
              </div>

              {mode === 'single' ? (
                <section style={styles.panel}>
                  <h3 style={styles.panelTitle}>{t.single}</h3>
                  <p style={styles.panelHint}>{t.singleHint}</p>

                  <div style={{ ...styles.formGrid, gridTemplateColumns: r.gridCols('repeat(3, minmax(0, 1fr))') }}>
                    <Field label={t.position}>
                      <select
                        value={singleRequirement.position_id}
                        onChange={(event) => {
                          setSingleRequirement((prev) => ({ ...prev, position_id: event.target.value }));
                          markUnsaved(SINGLE_REQUIREMENT_SCOPE);
                        }}
                        style={styles.input}
                      >
                        <option value="">{positions.length ? t.choosePosition : t.noPositions}</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {getPositionLabel(position)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t.date}>
                      <input
                        type="date"
                        value={singleRequirement.date}
                        onChange={(event) => {
                          setSingleRequirement((prev) => ({ ...prev, date: event.target.value }));
                          markUnsaved(SINGLE_REQUIREMENT_SCOPE);
                        }}
                        style={styles.dateInput}
                      />
                    </Field>

                    <Field label={t.minStaff}>
                      <input
                        type="number"
                        min="1"
                        value={singleRequirement.min_staff}
                        onChange={(event) => {
                          setSingleRequirement((prev) => ({ ...prev, min_staff: event.target.value }));
                          markUnsaved(SINGLE_REQUIREMENT_SCOPE);
                        }}
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.startTime}>
                      <input
                        type="time"
                        value={formatTime(singleRequirement.start_time)}
                        onChange={(event) => {
                          setSingleRequirement((prev) => ({
                            ...prev,
                            start_time: `${event.target.value}:00`,
                          }));
                          markUnsaved(SINGLE_REQUIREMENT_SCOPE);
                        }}
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.endTime}>
                      <input
                        type="time"
                        value={formatTime(singleRequirement.end_time)}
                        onChange={(event) => {
                          setSingleRequirement((prev) => ({
                            ...prev,
                            end_time: `${event.target.value}:00`,
                          }));
                          markUnsaved(SINGLE_REQUIREMENT_SCOPE);
                        }}
                        style={styles.input}
                      />
                    </Field>
                  </div>

                  <button
                    type="button"
                    onClick={submitManagerRequirement}
                    style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                    disabled={isSubmitting || positions.length === 0}
                  >
                    {t.create}
                  </button>
                </section>
              ) : (
                <section style={styles.panel}>
                  <h3 style={styles.panelTitle}>{t.bulk}</h3>
                  <p style={styles.panelHint}>{t.bulkHint}</p>

                  <div style={{ ...styles.formGrid, gridTemplateColumns: r.gridCols('repeat(3, minmax(0, 1fr))') }}>
                    <Field label={t.startDate}>
                      <input
                        type="date"
                        value={bulkRequirement.start_date}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({ ...prev, start_date: event.target.value }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={styles.dateInput}
                      />
                    </Field>

                    <Field label={t.endDate}>
                      <input
                        type="date"
                        value={bulkRequirement.end_date}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({ ...prev, end_date: event.target.value }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={styles.dateInput}
                      />
                    </Field>

                    <Field label={t.position}>
                      <select
                        value={bulkRequirement.requirements[0].position_id}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], position_id: event.target.value }],
                          }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={styles.input}
                      >
                        <option value="">{positions.length ? t.choosePosition : t.noPositions}</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {getPositionLabel(position)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t.minStaff}>
                      <input
                        type="number"
                        min="1"
                        value={bulkRequirement.requirements[0].min_staff}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], min_staff: event.target.value }],
                          }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.startTime}>
                      <input
                        type="time"
                        value={formatTime(bulkRequirement.requirements[0].start_time)}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], start_time: `${event.target.value}:00` }],
                          }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.endTime}>
                      <input
                        type="time"
                        value={formatTime(bulkRequirement.requirements[0].end_time)}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], end_time: `${event.target.value}:00` }],
                          }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={styles.input}
                      />
                    </Field>
                  </div>

                  <div style={styles.dayPills}>
                    {WEEKDAYS.map((day) => {
                      const checked = bulkRequirement.weekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            setBulkRequirement((prev) => ({
                              ...prev,
                              weekdays: checked
                                ? prev.weekdays.filter((value) => value !== day.value)
                                : [...prev.weekdays, day.value].sort((a, b) => a - b),
                            }));
                            markUnsaved(BULK_REQUIREMENT_SCOPE);
                          }}
                          style={checked ? styles.dayPillActive : styles.dayPill}
                        >
                          {day[language] || day.ru}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={submitBulkRequirements}
                    style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                    disabled={isSubmitting || positions.length === 0}
                  >
                    {t.create}
                  </button>
                </section>
              )}

              <section style={styles.listPanel}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>{t.requirements}</h3>
                  <span style={styles.countPill}>{visibleRequirements.length}</span>
                </div>

                <div style={{
                  ...styles.requirementFilters,
                  gridTemplateColumns: r.gridCols('repeat(4, minmax(0, 1fr)) auto auto'),
                }}
                >
                  <Field label={t.position}>
                    <select
                      value={filterForm.position_id}
                      onChange={(event) => setFilterForm((prev) => ({ ...prev, position_id: event.target.value }))}
                      style={styles.input}
                    >
                      <option value="">{t.allPositions}</option>
                      {positions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {getPositionLabel(position)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={t.filterDate}>
                    <input
                      type="date"
                      value={filterForm.date}
                      onChange={(event) => setFilterForm((prev) => ({ ...prev, date: event.target.value }))}
                      style={styles.dateInput}
                    />
                  </Field>

                  <Field label={t.startDate}>
                    <input
                      type="date"
                      value={filterForm.start_date}
                      onChange={(event) => setFilterForm((prev) => ({ ...prev, start_date: event.target.value }))}
                      style={styles.dateInput}
                      disabled={Boolean(filterForm.date)}
                    />
                  </Field>

                  <Field label={t.endDate}>
                    <input
                      type="date"
                      value={filterForm.end_date}
                      onChange={(event) => setFilterForm((prev) => ({ ...prev, end_date: event.target.value }))}
                      style={styles.dateInput}
                      disabled={Boolean(filterForm.date)}
                    />
                  </Field>

                  <div style={styles.filterActions}>
                    <button
                      type="button"
                      onClick={applyFilters}
                      style={{
                        ...styles.secondaryButton,
                        ...(isRefreshingList ? { opacity: 0.65, cursor: 'not-allowed' } : {}),
                      }}
                      disabled={isRefreshingList}
                    >
                      {isRefreshingList ? '...' : t.refresh}
                    </button>
                    <button
                      type="button"
                      onClick={resetRequirementFilters}
                      style={styles.smallSecondaryButton}
                    >
                      {t.clearFilters}
                    </button>
                  </div>
                </div>

                {visibleRequirements.length === 0 ? (
                  <div style={styles.emptyBox}>{t.noRequirements}</div>
                ) : (
                  <div style={styles.requirementsList}>
                    {visibleRequirements.map((requirement) => (
                      <div key={getRequirementId(requirement)} style={{
                        ...styles.requirementItem,
                        gridTemplateColumns: r.gridCols('1.2fr 1fr auto auto'),
                        ...(r.isMobile ? { gap: 12 } : {}),
                      }}>
                        <div>
                          <strong style={styles.itemTitle}>{requirement.position_title}</strong>
                          <div style={styles.itemMeta}>
                            {requirement.date}
                          </div>
                        </div>

                        <div style={styles.itemMeta}>
                          {formatTime(requirement.start_time)} — {formatTime(requirement.end_time)}
                        </div>

                        <span style={styles.staffBadge}>
                          {t.minStaff}: {requirement.min_staff}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeRequirement(getRequirementId(requirement))}
                          style={styles.deleteRequirementButton}
                          disabled={isSubmitting}
                        >
                          {t.delete}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </main>
          </div>
        ) : (
          <div style={{ ...styles.employeeGrid, ...(r.isMobile ? styles.employeeGridMobile : {}) }}>
            <section style={{
              ...styles.panel,
              ...styles.availabilityPanel,
              ...(r.isMobile ? r.employeePanel : {}),
            }}>
              {r.isMobile ? (
                <>
                  <div style={styles.mobileAvailabilityHeader}>
                    <h3 style={{ ...styles.panelTitle, marginBottom: 0 }}>{t.availability}</h3>
                    <button
                      type="button"
                      onClick={submitAvailability}
                      style={{
                        ...(isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton),
                        ...styles.mobileTopSaveButton,
                      }}
                      disabled={isSubmitting}
                    >
                      {t.save}
                    </button>
                  </div>

                  <div style={styles.mobileWeekBar}>
                    <button
                      type="button"
                      onClick={() => shiftWeek(-7)}
                      style={styles.mobileWeekArrow}
                      aria-label={t.prevWeek}
                      title={t.prevWeek}
                    >
                      {'\u2190'}
                    </button>
                    <div style={styles.mobileWeekCenter}>
                      <div style={styles.mobileWeekLabel}>{weekRangeLabel}</div>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => handleSelectedDateChange(e.target.value)}
                        style={styles.mobileWeekDateInput}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => shiftWeek(7)}
                      style={styles.mobileWeekArrow}
                      aria-label={t.nextWeek}
                      title={t.nextWeek}
                    >
                      {'\u2192'}
                    </button>
                  </div>

                  <div style={styles.mobileSectionLabel}>{t.markMode}</div>
                  <div style={styles.mobileBrushRow}>
                    {MOBILE_BRUSH_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBrushMode(option.id)}
                        style={{
                          ...styles.mobileBrushButton,
                          background: option.color,
                          color: option.textColor,
                          border: brushMode === option.id ? '2px solid #002642' : '2px solid rgba(79, 100, 111, 0.12)',
                          boxShadow: brushMode === option.id ? '0 4px 12px rgba(0, 38, 66, 0.14)' : 'none',
                        }}
                      >
                        {t[option.id]}
                      </button>
                    ))}
                  </div>

                  <div style={styles.mobileDayGrid}>
                    {WEEKDAYS.map((day, index) => {
                      const cellDate = weekDates[index];
                      const itIsToday = isToday(cellDate);
                      const isActive = mobileAvailabilityDay === index;
                      const cellDateKey = toDateKey(cellDate);

                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => setMobileAvailabilityDay(index)}
                          disabled={!cellDateKey}
                          style={{
                            ...styles.mobileDayButton,
                            background: isActive ? '#002642' : (itIsToday ? '#dee7e7' : '#f4faff'),
                            color: isActive ? '#ffffff' : '#002642',
                            border: isActive ? '2px solid #002642' : '1px solid #dee7e7',
                          }}
                        >
                          <span style={styles.mobileDayButtonWeekday}>{day[language] || day.ru}</span>
                          <span style={styles.mobileDayButtonDate}>{cellDate?.getDate?.() || ''}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{
                    ...styles.mobileSelectedDayBar,
                    ...(selectedMobileDatePast ? styles.mobileSelectedDayBarLocked : {}),
                  }}
                  >
                    <strong style={styles.mobileSelectedDayTitle}>{selectedMobileDateLabel}</strong>
                    {selectedMobileDatePast && (
                      <span style={styles.mobileSelectedDayHint}>{t.locked}</span>
                    )}
                  </div>

                  {selectedMobileDatePast ? (
                    <div style={styles.mobileLockedBox}>{t.locked}</div>
                  ) : (
                    <div style={styles.mobileSlotsCard}>
                      {MOBILE_HOUR_GROUPS.map((group) => (
                        <div key={group.hour} style={styles.mobileHourRow}>
                          <div style={styles.mobileHourLabel}>{group.hour}:00</div>
                          {group.slots.map((slot) => {
                            const status = normalizeAvailabilityStatus(availabilityByDate[selectedMobileDateKey]?.[slot]);
                            const slotIndex = TIME_SLOTS.indexOf(slot);
                            const slotTextColor = status === 'available'
                              ? '#ffffff'
                              : status === 'if_needed'
                                ? '#002642'
                                : '#4f646f';

                            return (
                              <button
                                key={slot}
                                type="button"
                                onMouseDown={(event) => handleAvailabilityMouseDown(event, mobileAvailabilityDay, slotIndex)}
                                onMouseEnter={() => handleAvailabilityMouseEnter(mobileAvailabilityDay, slotIndex)}
                                onTouchStart={(event) => handleAvailabilityTouchStart(event, mobileAvailabilityDay, slotIndex)}
                                onTouchMove={handleAvailabilityTouchMove}
                                data-availability-cell="true"
                                data-day-index={mobileAvailabilityDay}
                                data-slot-index={slotIndex}
                                style={{
                                  ...getAvailabilityCellStyle(selectedMobileDateKey, slot),
                                  ...styles.mobileSlotButton,
                                  color: slotTextColor,
                                }}
                                aria-pressed={status === 'available'}
                                title={getAvailabilityCellTitle(selectedMobileDateKey, slot)}
                              >
                                {slot.slice(3)}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                </>
              ) : (
                <>
              <div style={styles.panelHeader}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
                >
                  <h3 style={styles.panelTitle}>{t.availability}</h3>

                  <div style={styles.brushPicker}>
                    {AVAILABILITY_MODE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBrushMode(option.id)}
                        style={{
                          ...styles.brushBtn,
                          background: option.color,
                          color: option.textColor,
                          border: brushMode === option.id ? '2px solid #002642' : '1px solid rgba(79, 100, 111, 0.18)',
                          boxShadow: brushMode === option.id ? '0 3px 10px rgba(0, 38, 66, 0.14)' : 'none',
                        }}
                        aria-pressed={brushMode === option.id}
                        title={t[option.id]}
                      >
                        {t[option.id]}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
                >
                  <button
                    type="button"
                    onClick={() => shiftWeek(-7)}
                    style={styles.weekNavButton}
                    aria-label={t.prevWeek}
                    title={t.prevWeek}
                  >
                    {'\u2190'}
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleSelectedDateChange(e.target.value)}
                    style={{ ...styles.dateInput, width: 'auto' }}
                  />
                  <button
                    type="button"
                    onClick={() => shiftWeek(7)}
                    style={styles.weekNavButton}
                    aria-label={t.nextWeek}
                    title={t.nextWeek}
                  >
                    {'\u2192'}
                  </button>
                  <button
                    type="button"
                    onClick={submitAvailability}
                    style={{
                      ...(isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton),
                      ...styles.topSaveButton,
                    }}
                    disabled={isSubmitting}
                  >
                    {t.save}
                  </button>
                </div>
              </div>

              <div style={styles.availabilityGridWrapper}>
                {renderAvailabilityGrid()}
              </div>

                </>
              )}
            </section>

            <section style={{ ...styles.panel, ...(r.isMobile ? r.employeePanel : {}) }}>
              <h3 style={styles.panelTitle}>{t.absences}</h3>

              {r.isMobile ? (
                <div style={styles.mobileFormStack}>
                  <Field label={t.absenceType}>
                    <select
                      value={absenceForm.absence_type}
                      onChange={(event) => {
                        setAbsenceForm((prev) => ({ ...prev, absence_type: event.target.value }));
                        markUnsaved(ABSENCE_SCOPE);
                      }}
                      style={styles.input}
                    >
                      <option value="vacation">{t.vacation}</option>
                      <option value="sick_leave">{t.sick_leave}</option>
                      <option value="other">{t.other}</option>
                    </select>
                  </Field>

                  <Field label={t.startDate}>
                    <input
                      type="date"
                      value={absenceForm.start_date}
                      onChange={(event) => {
                        setAbsenceForm((prev) => ({ ...prev, start_date: event.target.value }));
                        markUnsaved(ABSENCE_SCOPE);
                      }}
                      style={styles.dateInput}
                    />
                  </Field>

                  <Field label={t.endDate}>
                    <input
                      type="date"
                      value={absenceForm.end_date}
                      onChange={(event) => {
                        setAbsenceForm((prev) => ({ ...prev, end_date: event.target.value }));
                        markUnsaved(ABSENCE_SCOPE);
                      }}
                      style={styles.dateInput}
                    />
                  </Field>

                  <Field label={t.comment}>
                    <input
                      value={absenceForm.comment}
                      onChange={(event) => {
                        setAbsenceForm((prev) => ({ ...prev, comment: event.target.value }));
                        markUnsaved(ABSENCE_SCOPE);
                      }}
                      placeholder={t.comment}
                      style={styles.input}
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={submitAbsence}
                    style={{
                      ...(isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton),
                      ...r.primaryButton,
                    }}
                    disabled={isSubmitting}
                  >
                    {t.addAbsence}
                  </button>
                </div>
              ) : (
              <div style={{
                ...styles.absenceForm,
                gridTemplateColumns: r.gridCols('1.1fr 1fr 1fr 1.4fr auto'),
              }}
              >
                <select
                  value={absenceForm.absence_type}
                  onChange={(event) => {
                    setAbsenceForm((prev) => ({ ...prev, absence_type: event.target.value }));
                    markUnsaved(ABSENCE_SCOPE);
                  }}
                  style={styles.input}
                >
                  <option value="vacation">{t.vacation}</option>
                  <option value="sick_leave">{t.sick_leave}</option>
                  <option value="other">{t.other}</option>
                </select>

                <input
                  type="date"
                  value={absenceForm.start_date}
                  onChange={(event) => {
                    setAbsenceForm((prev) => ({ ...prev, start_date: event.target.value }));
                    markUnsaved(ABSENCE_SCOPE);
                  }}
                  style={styles.dateInput}
                />

                <input
                  type="date"
                  value={absenceForm.end_date}
                  onChange={(event) => {
                    setAbsenceForm((prev) => ({ ...prev, end_date: event.target.value }));
                    markUnsaved(ABSENCE_SCOPE);
                  }}
                  style={styles.dateInput}
                />

                <input
                  value={absenceForm.comment}
                  onChange={(event) => {
                    setAbsenceForm((prev) => ({ ...prev, comment: event.target.value }));
                    markUnsaved(ABSENCE_SCOPE);
                  }}
                  placeholder={t.other}
                  style={styles.input}
                />

                <button
                  type="button"
                  onClick={submitAbsence}
                  style={{
                    ...(isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton),
                    ...r.primaryButton,
                  }}
                  disabled={isSubmitting}
                >
                  {t.addAbsence}
                </button>
              </div>
              )}

              {absences.length === 0 ? (
                <p style={styles.emptyText}>{t.empty}</p>
              ) : (
                <div style={styles.list}>
                  {absences.map((absence) => (
                    <div
                      key={absence.id}
                      style={r.isMobile ? styles.mobileAbsenceCard : { ...styles.listItem, ...r.listItem }}
                    >
                      <div>
                        <strong style={styles.itemTitle}>{t[absence.absence_type] || absence.absence_type}</strong>
                        <div style={styles.itemMeta}>{absence.start_date} — {absence.end_date}</div>
                        {absence.comment && <div style={styles.itemMeta}>{absence.comment}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAbsence(absence.id)}
                        style={r.isMobile ? { ...styles.deleteButton, ...r.fullWidth } : styles.deleteButton}
                      >
                        {t.delete}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/*
                    <div style={styles.list}>
                      {summary.shifts.map((shift) => (
                        r.isMobile ? (
                          <div
                            key={`${shift.schedule_id}-${shift.shift_id}`}
                            style={{
                              padding: '14px 16px',
                              borderRadius: 14,
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.12)',
                              boxShadow: '0 2px 8px rgba(102,126,234,0.25)',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{shift.date}</div>
                            <div style={{ fontSize: 14, marginBottom: 4 }}>
                              {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.92 }}>
                              {t[shift.status] || localizeBackendMessage(shift.status, language)}
                            </div>
                          </div>
                        ) : (
                          <div key={`${shift.schedule_id}-${shift.shift_id}`} style={styles.listItem}>
                            <div>
                              <strong style={styles.itemTitle}>{shift.date}</strong>
                              <div style={styles.itemMeta}>
                                {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                              </div>
                              <div style={styles.itemMeta}>
                                {t[shift.status] || localizeBackendMessage(shift.status, language)}
                              </div>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p style={styles.emptyText}>{t.empty}</p>
              )}
            </section>
            */}
          </div>
        )}
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

const styles = {
  page: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: '16px 24px 18px',
    overflow: 'hidden',
    background: '#f4faff',
  },

  desktopPage: {
    height: 'calc(100dvh - 96px)',
  },

  shell: {
    width: '100%',
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
    gap: 14,
    overflow: 'hidden',
    position: 'relative',
  },

  desktopShell: {
    width: '100%',
    padding: 0,
    borderRadius: 0,
  },

  header: {
    flexShrink: 0,
    marginBottom: 0,
  },

  title: {
    margin: 0,
    color: '#002642',
    fontSize: '28px',
    fontWeight: '900',
    letterSpacing: 0,
  },

  subtitle: {
    margin: '6px 0 0',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: 1.45,
  },

  todayBadge: {
    background: '#ffffff',
    padding: '10px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(79, 100, 111, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    boxShadow: '0 4px 12px rgba(0, 38, 66, 0.05)',
  },

  todayLabel: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#4f646f',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '2px',
  },

  todayDate: {
    fontSize: '14px',
    fontWeight: '900',
    color: '#002642',
  },

  legend: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    flexWrap: 'wrap',
    padding: '8px 12px',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid rgba(79, 100, 111, 0.1)',
  },

  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  legendColor: {
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    flexShrink: 0,
  },

  legendText: {
    fontSize: '13px',
    color: '#4f646f',
    fontWeight: '600',
  },

  managerLayout: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '290px minmax(0, 1fr)',
    gap: 14,
    overflow: 'hidden',
  },

  sidebar: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflowY: 'auto',
  },

  workArea: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'auto auto minmax(0, 1fr)',
    gap: 14,
    overflow: 'hidden',
  },

  helpBox: {
    padding: '14px 16px',
    borderRadius: 14,
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    color: '#002642',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '800',
  },

  panel: {
    padding: '18px',
    borderRadius: 14,
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
  },

  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '14px',
  },

  panelTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '18px',
    fontWeight: '850',
  },

  panelHint: {
    margin: '4px 0 0',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: 1.35,
  },

  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
  },

  modeSwitch: {
    width: 'fit-content',
    padding: '4px',
    borderRadius: 10,
    background: '#dee7e7',
    display: 'flex',
    gap: '4px',
  },

  modeButton: {
    height: '40px',
    padding: '0 18px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#4f646f',
    fontWeight: '850',
    cursor: 'pointer',
  },

  modeButtonActive: {
    height: '40px',
    padding: '0 18px',
    border: 'none',
    borderRadius: 8,
    background: '#ffffff',
    color: '#002642',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: 'none',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
    marginTop: '14px',
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
    height: 40,
    boxSizing: 'border-box',
    borderRadius: 10,
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 13px',
    color: '#002642',
    fontSize: '14px',
    outline: 'none',
  },

  dateInput: {
    width: '100%',
    height: 40,
    boxSizing: 'border-box',
    borderRadius: 10,
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 13px',
    color: '#002642',
    colorScheme: 'light',
    fontSize: '14px',
    fontWeight: '700',
    outline: 'none',
    cursor: 'pointer',
  },

  primaryButton: {
    height: 40,
    padding: '0 18px',
    background: '#002642',
    border: 'none',
    borderRadius: 10,
    color: '#f4faff',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    marginTop: '14px',
  },

  primaryButtonDisabled: {
    height: 40,
    padding: '0 18px',
    background: '#4f646f',
    border: 'none',
    borderRadius: 10,
    color: '#f4faff',
    fontWeight: '800',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
    marginTop: '14px',
  },

  secondaryButton: {
    height: '40px',
    padding: '0 16px',
    background: '#dee7e7',
    border: '1px solid #dee7e7',
    borderRadius: 10,
    color: '#002642',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  smallSecondaryButton: {
    height: '40px',
    padding: '0 16px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    borderRadius: 10,
    color: '#002642',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: 'none',
  },

  weekNavButton: {
    width: '42px',
    height: '42px',
    flexShrink: 0,
    background: '#dee7e7',
    border: 'none',
    borderRadius: '13px',
    color: '#002642',
    fontSize: '18px',
    fontWeight: '900',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },

  deleteButton: {
    height: '38px',
    padding: '0 13px',
    background: 'rgba(215, 173, 207, 0.42)',
    border: 'none',
    borderRadius: 10,
    color: '#002642',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  deleteRequirementButton: {
    height: '34px',
    padding: '0 12px',
    border: 'none',
    borderRadius: 10,
    background: '#8d1d1d',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  dayPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '14px',
  },

  dayPill: {
    height: '34px',
    padding: '0 13px',
    border: '1px solid #dee7e7',
    borderRadius: 10,
    background: '#ffffff',
    color: '#4f646f',
    fontWeight: '800',
    cursor: 'pointer',
  },

  dayPillActive: {
    height: '34px',
    padding: '0 13px',
    border: '1px solid rgba(215, 173, 207, 0.8)',
    background: '#002642',
    color: '#ffffff',
    fontWeight: '900',
    cursor: 'pointer',
  },

  listPanel: {
    minHeight: 0,
    padding: '18px',
    borderRadius: 14,
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    overflow: 'hidden',
  },

  requirementFilters: {
    display: 'grid',
    gap: 12,
    alignItems: 'end',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid #edf2f2',
  },

  filterActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
  },

  requirementsList: {
    height: 'calc(100% - 104px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  requirementItem: {
    padding: '12px 14px',
    borderRadius: 12,
    background: '#ffffff',
    border: '1px solid #edf2f2',
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr auto auto',
    alignItems: 'center',
    gap: '10px',
  },

  countPill: {
    minWidth: '36px',
    height: '30px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#dee7e7',
    color: '#002642',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '900',
  },

  staffBadge: {
    width: 'fit-content',
    padding: '7px 11px',
    borderRadius: 10,
    background: '#f4faff',
    border: '1px solid #dee7e7',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '850',
  },

  filePicker: {
    minHeight: '44px',
    boxSizing: 'border-box',
    padding: '0 14px',
    margin: '12px 0',
    borderRadius: 10,
    border: '1px dashed #c7d6df',
    background: '#f4faff',
    color: '#4f646f',
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    overflow: 'hidden',
  },

  hiddenFileInput: {
    display: 'none',
  },

  importBox: {
    marginTop: '12px',
    padding: '14px',
    borderRadius: 12,
    background: '#f4faff',
    border: '1px solid #dee7e7',
    color: '#002642',
    fontWeight: '700',
  },

  importErrors: {
    marginTop: '10px',
  },

  employeeGrid: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 14,
  },

  employeeGridMobile: {
    gap: 12,
    overflowY: 'visible',
  },

  availabilityPanel: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  topSaveButton: {
    marginTop: 0,
    height: 40,
    borderRadius: 10,
  },

  mobileAvailabilityHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 10,
    background: '#ffffff',
    borderBottom: '1px solid #edf2f2',
  },

  mobileTopSaveButton: {
    marginTop: 0,
    height: 38,
    minWidth: 112,
    padding: '0 14px',
    borderRadius: 10,
  },

  mobileWeekBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: '10px 12px',
    borderRadius: 16,
    background: '#f4faff',
    border: '1px solid #dee7e7',
  },

  mobileWeekArrow: {
    width: 40,
    height: 40,
    flexShrink: 0,
    border: 'none',
    borderRadius: 12,
    background: '#ffffff',
    color: '#002642',
    fontSize: 18,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 38, 66, 0.08)',
  },

  mobileWeekCenter: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },

  mobileWeekLabel: {
    color: '#002642',
    fontSize: 15,
    fontWeight: 900,
    textAlign: 'center',
  },

  mobileWeekDateInput: {
    width: '100%',
    maxWidth: 180,
    height: 38,
    boxSizing: 'border-box',
    borderRadius: 10,
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 10px',
    color: '#002642',
    colorScheme: 'light',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },

  mobileSectionLabel: {
    marginBottom: 8,
    color: '#4f646f',
    fontSize: 12,
    fontWeight: 850,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  mobileBrushRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },

  mobileBrushButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800,
    padding: '8px 6px',
  },

  mobileDayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 6,
    marginBottom: 14,
  },

  mobileDayButton: {
    minHeight: 58,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '6px 2px',
  },

  mobileDayButtonWeekday: {
    fontSize: 10,
    fontWeight: 800,
    opacity: 0.85,
  },

  mobileDayButtonDate: {
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1,
  },

  mobileSelectedDayBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 12,
    padding: '12px 14px',
    borderRadius: 14,
    background: '#dee7e7',
  },

  mobileSelectedDayBarLocked: {
    background: '#eef3f6',
  },

  mobileSelectedDayTitle: {
    color: '#002642',
    fontSize: 15,
    fontWeight: 850,
  },

  mobileSelectedDayHint: {
    color: '#4f646f',
    fontSize: 12,
    fontWeight: 650,
  },

  mobileLockedBox: {
    marginBottom: 16,
    padding: '18px 14px',
    borderRadius: 14,
    background: '#f4faff',
    border: '1px dashed #dee7e7',
    color: '#4f646f',
    fontSize: 13,
    fontWeight: 650,
    textAlign: 'center',
  },

  mobileSlotsCard: {
    marginBottom: 0,
    padding: 12,
    borderRadius: 14,
    background: '#f4faff',
    border: '1px solid #dee7e7',
    maxHeight: 'min(54vh, 460px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  mobileHourRow: {
    display: 'grid',
    gridTemplateColumns: '42px 1fr 1fr',
    gap: 8,
    alignItems: 'stretch',
  },

  mobileHourLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4f646f',
    fontSize: 12,
    fontWeight: 800,
  },

  mobileSlotButton: {
    minHeight: 42,
    borderRadius: 12,
    border: '2px solid transparent',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 900,
    color: '#002642',
  },

  mobileDayOffGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 6,
    marginBottom: 16,
  },

  mobileDayOffButton: {
    minHeight: 38,
    border: '1px solid #dee7e7',
    borderRadius: 10,
    background: '#f4faff',
    color: '#002642',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },

  mobileDayOffActive: {
    minHeight: 38,
    border: '2px solid #002642',
    borderRadius: 10,
    background: '#002642',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  },

  mobileStickyAction: {
    marginTop: 4,
  },

  mobileFormStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 12,
  },

  mobileAbsenceCard: {
    padding: '14px 16px',
    borderRadius: 14,
    background: '#f4faff',
    border: '1px solid #dee7e7',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  availabilityGridWrapper: {
    display: 'block',
    marginBottom: 0,
    overflowX: 'auto',
    overflowY: 'visible',
    padding: 10,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    borderRadius: 12,
    border: '1px solid #edf2f2',
    background: '#ffffff',
  },

  availabilityGridTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    minWidth: 1320,
    borderTop: '1px solid #dbe6f0',
    borderLeft: '1px solid #dbe6f0',
  },

  availabilityTimeHeader: {
    display: 'grid',
    gridTemplateColumns: '104px repeat(34, 36px)',
    gap: 0,
    alignItems: 'stretch',
    padding: 0,
    background: '#ffffff',
  },

  gridCorner: {
    height: 42,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    background: 'transparent',
  },

  timeHeaderCell: {
    height: 42,
    background: '#dee7e7',
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    color: '#002642',
    fontSize: 9,
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },

  dateGridRow: {
    display: 'grid',
    gridTemplateColumns: '104px repeat(34, 36px)',
    gap: 0,
    alignItems: 'stretch',
    minHeight: 42,
  },

  dateHeaderCell: {
    height: 42,
    background: '#f4faff',
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },

  dateHeaderWeekday: {
    fontSize: 10,
    fontWeight: 800,
    opacity: 0.85,
  },

  dateHeaderDate: {
    fontSize: 12,
    fontWeight: 900,
  },

  gridCell: {
    width: '100%',
    height: 42,
    minHeight: 42,
    padding: 0,
    boxSizing: 'border-box',
    background: '#eef3f6',
    border: 0,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  },

  gridCellAvailable: {
    width: '100%',
    height: 42,
    minHeight: 42,
    padding: 0,
    boxSizing: 'border-box',
    background: '#4CAF50',
    border: 0,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    cursor: 'pointer',
    transition: 'background 0.08s ease, border-color 0.08s ease',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  },

  gridCellMaybe: {
    width: '100%',
    height: 42,
    minHeight: 42,
    padding: 0,
    boxSizing: 'border-box',
    background: '#FFC107',
    border: 0,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    cursor: 'pointer',
    transition: 'background 0.08s ease, border-color 0.08s ease',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  },

  brushPicker: {
    display: 'flex',
    gap: '6px',
    background: '#eceff4',
    padding: '4px',
    borderRadius: '8px',
  },

  brushBtn: {
    minWidth: '86px',
    minHeight: '28px',
    borderRadius: '6px',
    cursor: 'pointer',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: '850',
    transition: 'transform 0.1s ease',
  },
  gridCellLocked: {
    width: '100%',
    height: 42,
    minHeight: 42,
    padding: 0,
    boxSizing: 'border-box',
    background: 'repeating-linear-gradient(45deg, #eef3f6, #eef3f6 6px, #e2e8ec 6px, #e2e8ec 12px)',
    border: 0,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    cursor: 'not-allowed',
    opacity: 0.6,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  },

  desiredDaysOffSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '14px',
  },

  desiredDaysOffLabel: {
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '800',
  },

  absenceForm: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr 1fr 1.4fr auto',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '12px',
  },

  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginBottom: '12px',
  },

  metric: {
    minWidth: '96px',
    padding: '11px 14px',
    borderRadius: '16px',
    background: '#dee7e7',
    color: '#002642',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },

  metricLabel: {
    fontSize: '12px',
    color: '#4f646f',
    fontWeight: '800',
  },

  metricValue: {
    fontSize: '19px',
    fontWeight: '900',
    color: '#002642',
  },

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  listItem: {
    padding: '13px 14px',
    borderRadius: '16px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
  },

  itemTitle: {
    color: '#002642',
    fontWeight: '850',
  },

  itemMeta: {
    color: '#4f646f',
    fontSize: '13px',
    marginTop: '4px',
  },

  emptyBox: {
    padding: '26px',
    borderRadius: '20px',
    background: '#f4faff',
    color: '#4f646f',
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyText: {
    margin: 0,
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '650',
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

const AVAILABILITY_STYLE_MAP = {
  available: styles.gridCellAvailable,
  if_needed: styles.gridCellMaybe,
  unavailable: styles.gridCell,
};
