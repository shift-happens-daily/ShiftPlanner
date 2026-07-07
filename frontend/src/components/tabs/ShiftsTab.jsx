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

const MOBILE_SHIFTS_STYLES = {
  page: {
    padding: '6px 8px 10px',
    overflowY: 'auto',
    height: 'auto',
  },
  shell: {
    gap: 8,
    overflow: 'visible',
    height: 'auto',
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
  managerLayout: {
    gap: 8,
    overflow: 'visible',
  },
  sidebar: {
    gap: 8,
  },
  workArea: {
    gap: 8,
    overflow: 'visible',
    gridTemplateRows: 'auto auto auto',
  },
  helpBox: {
    padding: '10px 12px',
    fontSize: 12,
    gap: 4,
    borderRadius: 12,
  },
  panel: {
    padding: 10,
    borderRadius: 12,
  },
  listPanel: {
    padding: 10,
    borderRadius: 12,
  },
  panelTitle: {
    fontSize: 15,
  },
  panelHint: {
    fontSize: 11,
    margin: '2px 0 0',
  },
  panelHeader: {
    marginBottom: 8,
    gap: 8,
  },
  countPill: {
    minWidth: 28,
    height: 24,
    fontSize: 12,
    padding: '0 8px',
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
  dateInput: {
    height: 34,
    padding: '0 10px',
    fontSize: 13,
    borderRadius: 8,
  },
  primaryButton: {
    height: 34,
    padding: '0 12px',
    fontSize: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  primaryButtonDisabled: {
    height: 34,
    padding: '0 12px',
    fontSize: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  secondaryButton: {
    height: 34,
    padding: '0 12px',
    fontSize: 12,
    borderRadius: 8,
  },
  smallSecondaryButton: {
    height: 32,
    padding: '0 10px',
    fontSize: 11,
    borderRadius: 8,
  },
  modeSwitch: {
    width: '100%',
    borderRadius: 8,
  },
  modeButton: {
    height: 32,
    padding: '0 10px',
    fontSize: 12,
    flex: 1,
  },
  modeButtonActive: {
    height: 32,
    padding: '0 10px',
    fontSize: 12,
    flex: 1,
  },
  formGrid: {
    gap: 8,
    marginTop: 8,
  },
  stack: {
    gap: 7,
  },
  dayPills: {
    gap: 6,
    marginTop: 8,
  },
  dayPill: {
    height: 28,
    padding: '0 10px',
    fontSize: 11,
    borderRadius: 8,
  },
  dayPillActive: {
    height: 28,
    padding: '0 10px',
    fontSize: 11,
    borderRadius: 8,
  },
  requirementsList: {
    gap: 6,
    height: 'auto',
  },
  requirementItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 10,
  },
  requirementTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  requirementMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 10px',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 13,
    lineHeight: 1.25,
  },
  itemMeta: {
    fontSize: 11,
  },
  staffBadge: {
    padding: '4px 8px',
    fontSize: 11,
    borderRadius: 8,
    flexShrink: 0,
  },
  deleteRequirementButton: {
    height: 30,
    padding: '0 10px',
    fontSize: 11,
    borderRadius: 8,
    width: '100%',
  },
  emptyBox: {
    padding: '12px 14px',
    fontSize: 12,
    borderRadius: 10,
  },
  filterActions: {
    gap: 6,
    marginTop: 2,
  },
  filePicker: {
    minHeight: 36,
    padding: '0 10px',
    fontSize: 12,
    margin: '8px 0',
  },
  employeeGridMobile: {
    gap: 8,
  },
  mobileAvailabilityHeader: {
    marginBottom: 8,
    paddingBottom: 8,
    gap: 8,
  },
  mobileTopSaveButton: {
    height: 32,
    minWidth: 96,
    padding: '0 12px',
    fontSize: 12,
    borderRadius: 8,
  },
  mobileWeekBar: {
    marginBottom: 10,
    padding: '8px 10px',
    borderRadius: 10,
  },
  mobileWeekArrow: {
    width: 34,
    height: 30,
    fontSize: 16,
    borderRadius: 8,
  },
  mobileWeekLabel: {
    fontSize: 12,
  },
  mobileWeekDateInput: {
    height: 30,
    fontSize: 12,
  },
  mobileSectionLabel: {
    fontSize: 11,
    marginBottom: 6,
  },
  mobileBrushRow: {
    gap: 6,
    marginBottom: 10,
  },
  mobileBrushButton: {
    height: 30,
    padding: '0 8px',
    fontSize: 11,
    borderRadius: 8,
  },
  mobileAvailabilityTableWrap: {
    borderRadius: 10,
  },
  mobileAvailabilityTimeLabel: {
    width: 46,
    fontSize: 10,
  },
  mobileAvailabilityDayHeaderShort: {
    fontSize: 10,
  },
  mobileAvailabilityDayHeaderDate: {
    fontSize: 11,
  },
  mobileAvailabilitySlotButton: {
    minHeight: 24,
  },
  mobileFormStack: {
    gap: 8,
  },
  mobileAbsenceCard: {
    padding: '8px 10px',
    borderRadius: 10,
    gap: 4,
  },
  deleteButton: {
    height: 30,
    fontSize: 11,
    padding: '0 10px',
    borderRadius: 8,
  },
};

function toBackendDate(date) {
  if (!date) return '';

  if (date.includes('-')) return date;

  const [day, month, year] = date.split('/');
  return `${year}-${month}-${day}`;
}

function formatDisplayDateInput(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 8);

  let day = digits.slice(0, 2);
  let month = digits.slice(2, 4);
  const year = digits.slice(4);

  if (day.length === 1 && Number(day) > 3) {
    day = `0${day}`;
  }

  if (day.length === 2 && Number(day) > 31) {
    day = '31';
  }

  if (month.length === 1 && Number(month) > 1) {
    month = `0${month}`;
  }

  if (month.length === 2 && Number(month) > 12) {
    month = '12';
  }

  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;

  return `${day}/${month}/${year}`;
}


function displayDateToDate(value) {
  if (!/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(value)) return null;

  const [day, month, year] = value.split('/').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;

  return date;
}

function isDisplayDateValid(value) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const [, dayStr, monthStr, yearStr] = match;

  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isDisplayDateNotPast(value) {
  const date = displayDateToDate(value);
  if (!date) return false;

  date.setHours(0, 0, 0, 0);
  return date.getTime() >= startOfToday().getTime();
}

export default function ShiftsTab({ language, userRole, user }) {
  const positionTitleRevision = usePositionTitleRevision();
  const r = useTabResponsive(1480);
  const mobileStyles = r.isMobile ? MOBILE_SHIFTS_STYLES : null;
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
    return {
      absence_type: 'vacation',
      start_date: '',
      end_date: '',
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

      invalidDateFormat: 'Введите дату в формате dd/mm/yyyy',
      absencePastDate: 'Нельзя поставить отсутствие раньше сегодняшнего дня',
      absenceEndBeforeStart: 'Конец периода не может быть раньше начала',
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

      invalidDateFormat: 'Enter the date in dd/mm/yyyy format',
      absencePastDate: 'Absence cannot be earlier than today',
      absenceEndBeforeStart: 'End date cannot be earlier than start date',
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
            {time.endsWith(':00') ? time : ''}
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
    if (!isDisplayDateValid(absenceForm.start_date) || !isDisplayDateValid(absenceForm.end_date)) {
      setErrorMessage(t.invalidDateFormat);
      return;
    }
    
    if (!isDisplayDateNotPast(absenceForm.start_date) || !isDisplayDateNotPast(absenceForm.end_date)) {
      setErrorMessage(t.absencePastDate);
      return;
    }

    const start = displayDateToDate(absenceForm.start_date);
    const end = displayDateToDate(absenceForm.end_date);

    if (end.getTime() < start.getTime()) {
      setErrorMessage(t.absenceEndBeforeStart);
      return;
    }
    clearMessages();
    setIsSubmitting(true);

    try {
      await createMyAbsence({
        ...absenceForm,
        start_date: toBackendDate(absenceForm.start_date),
        end_date: toBackendDate(absenceForm.end_date),
    });
      setAbsenceForm({absence_type: 'vacation', start_date: '', end_date: '', comment: '',});
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
      <section style={{ ...styles.page, ...r.page, ...(r.isMobile ? {} : styles.desktopPage), ...mobileStyles?.page }}>
        <div style={{ ...styles.shell, ...r.shell, ...(r.isMobile ? {} : styles.desktopShell), ...mobileStyles?.shell }}>
          <div style={{ ...styles.emptyBox, ...mobileStyles?.emptyBox }}>{t.loading}</div>
        </div>
      </section>
    );
  }

  return (
    <section style={{
      ...styles.page,
      ...r.page,
      ...(r.isMobile ? {} : styles.desktopPage),
      ...mobileStyles?.page,
    }}
    >
      <div style={{
        ...styles.shell,
        ...r.shell,
        ...(r.isMobile ? {} : styles.desktopShell),
        ...mobileStyles?.shell,
      }}>
        {renderToast()}

        <header style={{ ...styles.header, ...r.header, ...mobileStyles?.header }}>
          <div>
            <h2 style={{ ...styles.title, ...r.title, ...mobileStyles?.title }}>{isManager ? t.titleManager : t.titleEmployee}</h2>
            <p style={{ ...styles.subtitle, ...mobileStyles?.subtitle }}>{isManager ? t.subtitleManager : t.subtitleEmployee}</p>
          </div>
        </header>

        {isManager ? (
          <div style={{ ...styles.managerLayout, ...r.splitLayout('290px minmax(0, 1fr)'), ...mobileStyles?.managerLayout }}>
            <aside style={{ ...styles.sidebar, ...mobileStyles?.sidebar }}>
              <div style={{ ...styles.helpBox, ...mobileStyles?.helpBox }}>
                <strong>{t.stepOne}</strong>
                <span>{t.stepTwo}</span>
                <span>{t.stepThree}</span>
              </div>

              <section style={{ ...styles.panel, ...mobileStyles?.panel }}>
                <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.filters}</h3>

                <div style={{ ...styles.stack, ...mobileStyles?.stack }}>
                  <label style={{ ...styles.label, ...mobileStyles?.label }}>{t.position}</label>
                  <select
                    value={filterForm.position_id}
                    onChange={(event) => setFilterForm((prev) => ({ ...prev, position_id: event.target.value }))}
                    style={{ ...styles.input, ...mobileStyles?.input }}
                  >
                    <option value="">{t.allPositions}</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {getPositionLabel(position)}
                      </option>
                    ))}
                  </select>

                  <label style={{ ...styles.label, ...mobileStyles?.label }}>{t.filterDate}</label>
                  <input
                    type="date"
                    value={filterForm.date}
                    onChange={(event) => setFilterForm((prev) => ({ ...prev, date: event.target.value }))}
                    style={{ ...styles.dateInput, ...mobileStyles?.dateInput }}
                  />

                  <label style={{ ...styles.label, ...mobileStyles?.label }}>{t.startDate}</label>
                  <input
                    type="date"
                    value={filterForm.start_date}
                    onChange={(event) => {
                      setFilterForm((prev) => ({ ...prev, start_date: event.target.value }));
                      markUnsaved(ABSENCE_SCOPE);
                    }}
                   style={{ ...styles.dateInput, ...mobileStyles?.dateInput }}
                    disabled={Boolean(filterForm.date)}
                  />

                  <label style={{ ...styles.label, ...mobileStyles?.label }}>{t.endDate}</label>
                  <input
                    type="date"
                    value={filterForm.end_date}
                    onChange={(event) => {
                      setFilterForm((prev) => ({ ...prev, end_date: event.target.value }));
                      markUnsaved(ABSENCE_SCOPE);
                    }}                    style={{ ...styles.dateInput, ...mobileStyles?.dateInput }}
                    disabled={Boolean(filterForm.date)}
                  />

                  <div style={{ ...styles.filterActions, ...mobileStyles?.filterActions }}>
                    <button type="button" onClick={applyFilters} style={{ ...styles.secondaryButton, ...mobileStyles?.secondaryButton }}>
                      {isRefreshingList ? '...' : t.refresh}
                    </button>
                    <button type="button" onClick={resetRequirementFilters} style={{ ...styles.smallSecondaryButton, ...mobileStyles?.smallSecondaryButton }}>
                      {t.clearFilters}
                    </button>
                  </div>
                </div>
              </section>

              <section style={{ ...styles.panel, ...mobileStyles?.panel }}>
                <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.import}</h3>
                <p style={{ ...styles.panelHint, ...mobileStyles?.panelHint }}>{t.fileHint}</p>

                <label style={{ ...styles.filePicker, ...mobileStyles?.filePicker }}>
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
                  style={isSubmitting
                    ? { ...styles.primaryButtonDisabled, ...mobileStyles?.primaryButtonDisabled }
                    : { ...styles.primaryButton, ...mobileStyles?.primaryButton }}
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

            <main style={{ ...styles.workArea, ...mobileStyles?.workArea }}>
              <div style={{ ...styles.modeSwitch, ...mobileStyles?.modeSwitch }}>
                <button
                  type="button"
                  style={mode === 'single'
                    ? { ...styles.modeButtonActive, ...mobileStyles?.modeButtonActive }
                    : { ...styles.modeButton, ...mobileStyles?.modeButton }}
                  onClick={() => setMode('single')}
                >
                  {t.single}
                </button>

                <button
                  type="button"
                  style={mode === 'bulk'
                    ? { ...styles.modeButtonActive, ...mobileStyles?.modeButtonActive }
                    : { ...styles.modeButton, ...mobileStyles?.modeButton }}
                  onClick={() => setMode('bulk')}
                >
                  {t.bulk}
                </button>
              </div>

              {mode === 'single' ? (
                <section style={{ ...styles.panel, ...mobileStyles?.panel }}>
                  <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.single}</h3>
                  <p style={{ ...styles.panelHint, ...mobileStyles?.panelHint }}>{t.singleHint}</p>

                  <div style={{ ...styles.formGrid, gridTemplateColumns: r.gridCols('repeat(3, minmax(0, 1fr))'), ...mobileStyles?.formGrid }}>
                    <Field label={t.position} labelStyle={mobileStyles?.label}>
                      <select
                        value={singleRequirement.position_id}
                        onChange={(event) => {
                          setSingleRequirement((prev) => ({ ...prev, position_id: event.target.value }));
                          markUnsaved(SINGLE_REQUIREMENT_SCOPE);
                        }}
                        style={{ ...styles.input, ...mobileStyles?.input }}
                      >
                        <option value="">{positions.length ? t.choosePosition : t.noPositions}</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {getPositionLabel(position)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t.date} labelStyle={mobileStyles?.label}>
                      <input
                        type="date"
                        value={singleRequirement.date}
                        onChange={(event) => {
                          setSingleRequirement((prev) => ({ ...prev, date: event.target.value }));
                          markUnsaved(SINGLE_REQUIREMENT_SCOPE);
                        }}
                        style={{ ...styles.dateInput, ...mobileStyles?.dateInput }}
                      />
                    </Field>

                    <Field label={t.minStaff} labelStyle={mobileStyles?.label}>
                      <input
                        type="number"
                        min="1"
                        value={singleRequirement.min_staff}
                        onChange={(event) => {
                          setSingleRequirement((prev) => ({ ...prev, min_staff: event.target.value }));
                          markUnsaved(SINGLE_REQUIREMENT_SCOPE);
                        }}
                        style={{ ...styles.input, ...mobileStyles?.input }}
                      />
                    </Field>

                    <Field label={t.startTime} labelStyle={mobileStyles?.label}>
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
                        style={{ ...styles.input, ...mobileStyles?.input }}
                      />
                    </Field>

                    <Field label={t.endTime} labelStyle={mobileStyles?.label}>
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
                        style={{ ...styles.input, ...mobileStyles?.input }}
                      />
                    </Field>
                  </div>

                  <button
                    type="button"
                    onClick={submitManagerRequirement}
                    style={isSubmitting
                      ? { ...styles.primaryButtonDisabled, ...mobileStyles?.primaryButtonDisabled }
                      : { ...styles.primaryButton, ...mobileStyles?.primaryButton }}
                    disabled={isSubmitting || positions.length === 0}
                  >
                    {t.create}
                  </button>
                </section>
              ) : (
                <section style={{ ...styles.panel, ...mobileStyles?.panel }}>
                  <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.bulk}</h3>
                  <p style={{ ...styles.panelHint, ...mobileStyles?.panelHint }}>{t.bulkHint}</p>

                  <div style={{ ...styles.formGrid, gridTemplateColumns: r.gridCols('repeat(3, minmax(0, 1fr))'), ...mobileStyles?.formGrid }}>
                    <Field label={t.startDate} labelStyle={mobileStyles?.label}>
                      <input
                        type="date"
                        value={bulkRequirement.start_date}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({ ...prev, start_date: event.target.value }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={{ ...styles.dateInput, ...mobileStyles?.dateInput }}
                      />
                    </Field>

                    <Field label={t.endDate} labelStyle={mobileStyles?.label}>
                      <input
                        type="date"
                        value={bulkRequirement.end_date}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({ ...prev, end_date: event.target.value }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={{ ...styles.dateInput, ...mobileStyles?.dateInput }}
                      />
                    </Field>

                    <Field label={t.position} labelStyle={mobileStyles?.label}>
                      <select
                        value={bulkRequirement.requirements[0].position_id}
                        onChange={(event) => {
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], position_id: event.target.value }],
                          }));
                          markUnsaved(BULK_REQUIREMENT_SCOPE);
                        }}
                        style={{ ...styles.input, ...mobileStyles?.input }}
                      >
                        <option value="">{positions.length ? t.choosePosition : t.noPositions}</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {getPositionLabel(position)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t.minStaff} labelStyle={mobileStyles?.label}>
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
                        style={{ ...styles.input, ...mobileStyles?.input }}
                      />
                    </Field>

                    <Field label={t.startTime} labelStyle={mobileStyles?.label}>
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
                        style={{ ...styles.input, ...mobileStyles?.input }}
                      />
                    </Field>

                    <Field label={t.endTime} labelStyle={mobileStyles?.label}>
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
                        style={{ ...styles.input, ...mobileStyles?.input }}
                      />
                    </Field>
                  </div>

                  <div style={{ ...styles.dayPills, ...mobileStyles?.dayPills }}>
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
                          style={checked
                            ? { ...styles.dayPillActive, ...mobileStyles?.dayPillActive }
                            : { ...styles.dayPill, ...mobileStyles?.dayPill }}
                        >
                          {day[language] || day.ru}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={submitBulkRequirements}
                    style={isSubmitting
                      ? { ...styles.primaryButtonDisabled, ...mobileStyles?.primaryButtonDisabled }
                      : { ...styles.primaryButton, ...mobileStyles?.primaryButton }}
                    disabled={isSubmitting || positions.length === 0}
                  >
                    {t.create}
                  </button>
                </section>
              )}

              <section style={{ ...styles.listPanel, ...mobileStyles?.listPanel }}>
                <div style={{ ...styles.panelHeader, ...mobileStyles?.panelHeader }}>
                  <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.requirements}</h3>
                  <span style={{ ...styles.countPill, ...mobileStyles?.countPill }}>{visibleRequirements.length}</span>
                </div>

                {!r.isMobile && (
                  <div style={{
                    ...styles.requirementFilters,
                    gridTemplateColumns: r.gridCols('repeat(4, minmax(0, 1fr)) auto auto'),
                  }}
                  >
                    <Field label={t.position} labelStyle={mobileStyles?.label}>
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

                    <Field label={t.filterDate} labelStyle={mobileStyles?.label}>
                      <input
                        type="date"
                        value={filterForm.date}
                        onChange={(event) => setFilterForm((prev) => ({ ...prev, date: event.target.value }))}
                        style={{
                          ...styles.dateInput,
                          ...(r.isMobile ? { height: 32, fontSize: 12, padding: '0 10px', borderRadius: 8 } : {}),
                        }}
                      />
                    </Field>

                    <Field label={t.startDate} labelStyle={mobileStyles?.label}>
                      <input
                        type="date"
                        value={filterForm.start_date}
                        onChange={(event) => {
                          setFilterForm((prev) => ({ ...prev, start_date: event.target.value }))
                          markUnsaved(ABSENCE_SCOPE);
                        }}                        style={{
                          ...styles.dateInput,
                          ...(r.isMobile ? { height: 32, fontSize: 12, padding: '0 10px', borderRadius: 8 } : {}),
                        }}
                        disabled={Boolean(filterForm.date)}
                      />
                    </Field>

                    <Field label={t.endDate} labelStyle={mobileStyles?.label}>
                      <input
                        type="date"
                        value={filterForm.end_date}
                        onChange={(event) => {
                          setFilterForm((prev) => ({ ...prev, end_date: event.target.value }))
                          markUnsaved(ABSENCE_SCOPE);
                        }}
                        style={{
                          ...styles.dateInput,
                          ...(r.isMobile ? { height: 32, fontSize: 12, padding: '0 10px', borderRadius: 8 } : {}),
                        }}
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
                )}

                {visibleRequirements.length === 0 ? (
                  <div style={{ ...styles.emptyBox, ...mobileStyles?.emptyBox }}>{t.noRequirements}</div>
                ) : (
                  <div style={{ ...styles.requirementsList, ...mobileStyles?.requirementsList }}>
                    {visibleRequirements.map((requirement) => (
                      r.isMobile ? (
                        <div key={getRequirementId(requirement)} style={{ ...styles.requirementItem, ...mobileStyles?.requirementItem }}>
                          <div style={mobileStyles?.requirementTopRow}>
                            <strong style={{ ...styles.itemTitle, ...mobileStyles?.itemTitle }}>
                              {requirement.position_title}
                            </strong>
                            <span style={{ ...styles.staffBadge, ...mobileStyles?.staffBadge }}>
                              {t.minStaff}: {requirement.min_staff}
                            </span>
                          </div>
                          <div style={mobileStyles?.requirementMetaRow}>
                            <span style={{ ...styles.itemMeta, ...mobileStyles?.itemMeta }}>{requirement.date}</span>
                            <span style={{ ...styles.itemMeta, ...mobileStyles?.itemMeta }}>
                              {formatTime(requirement.start_time)} — {formatTime(requirement.end_time)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRequirement(getRequirementId(requirement))}
                            style={{ ...styles.deleteRequirementButton, ...mobileStyles?.deleteRequirementButton }}
                            disabled={isSubmitting}
                          >
                            {t.delete}
                          </button>
                        </div>
                      ) : (
                      <div key={getRequirementId(requirement)} style={{
                        ...styles.requirementItem,
                        gridTemplateColumns: r.gridCols('1.2fr 1fr auto auto'),
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
                      )
                    ))}
                  </div>
                )}
              </section>
            </main>
          </div>
        ) : (
          <div style={{
            ...styles.employeeGrid,
            ...(r.isMobile ? styles.employeeGridMobile : {}),
            ...mobileStyles?.employeeGridMobile,
          }}>
            <section style={{
              ...styles.panel,
              ...styles.availabilityPanel,
              ...(r.isMobile ? r.employeePanel : {}),
              ...mobileStyles?.panel,
            }}>
              {r.isMobile ? (
                <>
                  <div style={{ ...styles.mobileAvailabilityHeader, ...mobileStyles?.mobileAvailabilityHeader }}>
                    <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle, marginBottom: 0 }}>{t.availability}</h3>
                    <button
                      type="button"
                      onClick={submitAvailability}
                      style={{
                        ...(isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton),
                        ...styles.mobileTopSaveButton,
                        ...mobileStyles?.mobileTopSaveButton,
                      }}
                      disabled={isSubmitting}
                    >
                      {t.save}
                    </button>
                  </div>

                  <div style={{ ...styles.mobileWeekBar, ...mobileStyles?.mobileWeekBar }}>
                    <button
                      type="button"
                      onClick={() => shiftWeek(-7)}
                      style={{ ...styles.mobileWeekArrow, ...mobileStyles?.mobileWeekArrow }}
                      aria-label={t.prevWeek}
                      title={t.prevWeek}
                    >
                      {'\u2190'}
                    </button>
                    <div style={styles.mobileWeekCenter}>
                      <div style={{ ...styles.mobileWeekLabel, ...mobileStyles?.mobileWeekLabel }}>{weekRangeLabel}</div>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => handleSelectedDateChange(e.target.value)}
                        style={{ ...styles.mobileWeekDateInput, ...mobileStyles?.mobileWeekDateInput }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => shiftWeek(7)}
                      style={{ ...styles.mobileWeekArrow, ...mobileStyles?.mobileWeekArrow }}
                      aria-label={t.nextWeek}
                      title={t.nextWeek}
                    >
                      {'\u2192'}
                    </button>
                  </div>

                  <div style={{ ...styles.mobileSectionLabel, ...mobileStyles?.mobileSectionLabel }}>{t.markMode}</div>
                  <div style={{ ...styles.mobileBrushRow, ...mobileStyles?.mobileBrushRow }}>
                    {MOBILE_BRUSH_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBrushMode(option.id)}
                        style={{
                          ...styles.mobileBrushButton,
                          ...mobileStyles?.mobileBrushButton,
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

                  <div style={{ ...styles.mobileAvailabilityTableWrap, ...mobileStyles?.mobileAvailabilityTableWrap }}>
                    <div style={styles.mobileAvailabilityTable}>
                      <div style={styles.mobileAvailabilityHeaderRow}>
                        <div style={styles.mobileAvailabilityTimeHeader}>Time</div>
                        {WEEKDAYS.map((day, index) => {
                          const cellDate = weekDates[index];
                          const cellDateKey = toDateKey(cellDate);
                          const itIsToday = isToday(cellDate);

                          return (
                            <div
                              key={day.value}
                              style={{
                                ...styles.mobileAvailabilityDayHeader,
                                background: itIsToday ? '#dee7e7' : '#f4faff',
                              }}
                            >
                              <span style={{ ...styles.mobileAvailabilityDayHeaderShort, ...mobileStyles?.mobileAvailabilityDayHeaderShort }}>{day[language] || day.ru}</span>
                              <span style={{ ...styles.mobileAvailabilityDayHeaderDate, ...mobileStyles?.mobileAvailabilityDayHeaderDate }}>{cellDate?.getDate?.() || ''}</span>
                            </div>
                          );
                        })}
                      </div>

                      {TIME_SLOTS.map((slot, slotIndex) => (
                        <div key={slot} style={styles.mobileAvailabilityRow}>
                          <div style={{ ...styles.mobileAvailabilityTimeLabel, ...mobileStyles?.mobileAvailabilityTimeLabel }}>{slot}</div>
                          {WEEKDAYS.map((day, dayIndex) => {
                            const cellDate = weekDates[dayIndex];
                            const cellDateKey = toDateKey(cellDate);
                            const past = !cellDateKey || isPastDateKey(cellDateKey);
                            const status = normalizeAvailabilityStatus(availabilityByDate[cellDateKey]?.[slot]);
                            const slotTextColor = status === 'available'
                              ? '#ffffff'
                              : status === 'if_needed'
                                ? '#002642'
                                : '#4f646f';

                            return (
                              <button
                                key={`${day.value}-${slot}`}
                                type="button"
                                onMouseDown={past ? undefined : (event) => handleAvailabilityMouseDown(event, dayIndex, slotIndex)}
                                onMouseEnter={past ? undefined : () => handleAvailabilityMouseEnter(dayIndex, slotIndex)}
                                onTouchStart={past ? undefined : (event) => handleAvailabilityTouchStart(event, dayIndex, slotIndex)}
                                onTouchMove={past ? undefined : handleAvailabilityTouchMove}
                                data-availability-cell="true"
                                data-day-index={dayIndex}
                                data-slot-index={slotIndex}
                                disabled={past}
                                style={{
                                  ...getAvailabilityCellStyle(cellDateKey, slot),
                                  ...styles.mobileAvailabilitySlotButton,
                                  ...mobileStyles?.mobileAvailabilitySlotButton,
                                  color: slotTextColor,
                                }}
                                aria-pressed={status === 'available'}
                                title={getAvailabilityCellTitle(cellDateKey, slot)}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

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

                          transform: brushMode === option.id
                            ? 'scale(1.08)'
                            : 'scale(1)',

                          boxShadow: brushMode === option.id
                            ? '0 8px 22px rgba(0,38,66,.22)'
                            : '0 3px 10px rgba(0,38,66,.08)',

                          outline: brushMode === option.id
                            ? '2px solid #002642'
                            : 'none',

                          zIndex: brushMode === option.id ? 2 : 1,
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

            <div
  style={{
    ...styles.absenceCardsGrid,
    gridTemplateColumns: r.gridCols('1fr 1fr'),
  }}
>
  <section style={{ ...styles.panel, ...(r.isMobile ? r.employeePanel : {}), ...mobileStyles?.panel }}>
    <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.addAbsence}</h3>

    <div style={styles.absenceCreateForm}>
      <Field label={t.absenceType} labelStyle={mobileStyles?.label}>
        <select
          value={absenceForm.absence_type}
          onChange={(event) => {
            setAbsenceForm((prev) => ({ ...prev, absence_type: event.target.value }));
            markUnsaved(ABSENCE_SCOPE);
          }}
          style={{ ...styles.input, ...mobileStyles?.input }}
        >
          <option value="vacation">{t.vacation}</option>
          <option value="sick_leave">{t.sick_leave}</option>
          <option value="other">{t.other}</option>
        </select>
      </Field>

      <div style={styles.absenceDatesRow}>
        <Field label={t.startDate} labelStyle={mobileStyles?.label}>
          <input
            type="text"
            placeholder="dd/mm/yyyy"
            value={absenceForm.start_date}
            onChange={(event) => {
              setAbsenceForm((prev) => ({ ...prev, start_date: formatDisplayDateInput(event.target.value) }));
              markUnsaved(ABSENCE_SCOPE);
            }}
            style={{ ...styles.dateInput, ...mobileStyles?.dateInput }}
          />
        </Field>

        <Field label={t.endDate} labelStyle={mobileStyles?.label}>
          <input
            type="text"
            placeholder="dd/mm/yyyy"
            value={absenceForm.end_date}
            onChange={(event) => {
              setAbsenceForm((prev) => ({ ...prev, end_date: formatDisplayDateInput(event.target.value) }));
              markUnsaved(ABSENCE_SCOPE);
            }}
            style={{ ...styles.dateInput, ...mobileStyles?.dateInput }}
          />
        </Field>
      </div>

      <Field label={t.comment} labelStyle={mobileStyles?.label}>
        <input
          value={absenceForm.comment}
          onChange={(event) => {
            setAbsenceForm((prev) => ({ ...prev, comment: event.target.value }));
            markUnsaved(ABSENCE_SCOPE);
          }}
          placeholder={t.other}
          style={{ ...styles.input, ...mobileStyles?.input }}
        />
      </Field>

      <button
        type="button"
        onClick={submitAbsence}
        style={{
          ...(isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton),
          ...styles.absenceSubmitButton,
        }}
        disabled={isSubmitting}
      >
        {t.addAbsence}
      </button>
    </div>
  </section>

  <section style={{ ...styles.panel, ...(r.isMobile ? r.employeePanel : {}), ...mobileStyles?.panel }}>
    <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.absences}</h3>

    {absences.length === 0 ? (
      <p style={styles.emptyText}>{t.empty}</p>
    ) : (
      <div style={styles.absenceHistoryList}>
        {absences.map((absence) => (
          <div key={absence.id} style={styles.absenceHistoryItem}>
            <div>
              <strong style={styles.itemTitle}>
                {t[absence.absence_type] || absence.absence_type}
              </strong>
              <div style={styles.itemMeta}>
                {absence.start_date} — {absence.end_date}
              </div>
              {absence.comment && (
                <div style={styles.itemMeta}>{absence.comment}</div>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeAbsence(absence.id)}
              style={styles.deleteButton}
            >
              {t.delete}
            </button>
          </div>
        ))}
      </div>
    )}
  </section>
</div>

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

function Field({ label, children, labelStyle }) {
  return (
    <label style={styles.field}>
      <span style={{ ...styles.label, ...labelStyle }}>{label}</span>
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

  mobileAvailabilityTableWrap: {
    marginBottom: 0,
    padding: 6,
    borderRadius: 12,
    background: '#f4faff',
    border: '1px solid #dee7e7',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },

  mobileAvailabilityTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    minWidth: '100%',
  },

  mobileAvailabilityHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '38px repeat(7, minmax(20px, 1fr))',
    gap: 0,
    alignItems: 'stretch',
    background: '#ffffff',
  },

  mobileAvailabilityTimeHeader: {
    padding: '4px 2px',
    borderRight: '1px solid #dee7e7',
    borderBottom: '1px solid #dee7e7',
    color: '#4f646f',
    fontSize: 8,
    fontWeight: 800,
    textAlign: 'center',
  },

  mobileAvailabilityDayHeader: {
    padding: '3px 1px',
    borderRight: '1px solid #dee7e7',
    borderBottom: '1px solid #dee7e7',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },

  mobileAvailabilityDayHeaderShort: {
    color: '#002642',
    fontSize: 9,
    fontWeight: 800,
  },

  mobileAvailabilityDayHeaderDate: {
    color: '#4f646f',
    fontSize: 9,
    fontWeight: 800,
  },

  mobileAvailabilityRow: {
    display: 'grid',
    gridTemplateColumns: '38px repeat(7, minmax(20px, 1fr))',
    gap: 0,
    alignItems: 'stretch',
  },

  mobileAvailabilityTimeLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4f646f',
    fontSize: 7,
    fontWeight: 800,
    padding: 0,
    minHeight: 14,
    height: 14,
    borderRight: '1px solid #dee7e7',
    borderBottom: '1px solid #f0f4f7',
    background: '#ffffff',
    boxSizing: 'border-box',
  },

  mobileAvailabilitySlotButton: {
    minHeight: 14,
    height: 14,
    padding: 0,
    borderRadius: 0,
    border: '1px solid rgba(219, 230, 240, 0.95)',
    cursor: 'pointer',
    boxSizing: 'border-box',
    fontSize: 0,
    lineHeight: 1,
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
    padding: '10px 12px',
    borderRadius: 12,
    background: '#f4faff',
    border: '1px solid #dee7e7',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  availabilityGridWrapper: {
    display: 'block',
    marginBottom: 0,
    overflowX: 'hidden',
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
    width: '100%',
    borderTop: '1px solid #dbe6f0',
    borderLeft: '1px solid #dbe6f0',
  },

  availabilityTimeHeader: {
    display: 'grid',
    gridTemplateColumns: '100px repeat(34, minmax(32px, 1fr))',
    gap: 0,
    alignItems: 'stretch',
    padding: 0,
    background: '#ffffff',
  },

  gridCorner: {
    height: 34,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    background: 'transparent',
  },

  timeHeaderCell: {
    height: 34,
    background: '#dee7e7',
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    color: '#002642',
    fontSize: 8,
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },

  dateGridRow: {
    display: 'grid',
    gridTemplateColumns: '100px repeat(34, minmax(32px, 1fr))',
    gap: 0,
    alignItems: 'stretch',
    minHeight: 34,
  },

  dateHeaderCell: {
    height: 34,
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
    fontSize: 9,
    fontWeight: 800,
    opacity: 0.85,
  },

  dateHeaderDate: {
    fontSize: 10,
    fontWeight: 900,
  },

  gridCell: {
    width: '100%',
    height: 34,
    minHeight: 34,
    padding: 0,
    boxSizing: 'border-box',
    background: '#eef3f6',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    fontSize: 0,
    lineHeight: 1,
  },

  gridCellAvailable: {
    width: '100%',
    height: 34,
    minHeight: 34,
    padding: 0,
    boxSizing: 'border-box',
    background: '#4CAF50',
    border: '1px solid #86efac',
    borderRadius: 4,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    cursor: 'pointer',
    transition: 'background 0.08s ease, border-color 0.08s ease',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    fontSize: 0,
    lineHeight: 1,
  },

  gridCellMaybe: {
    width: '100%',
    height: 34,
    minHeight: 34,
    padding: 0,
    boxSizing: 'border-box',
    background: '#FFC107',
    border: '1px solid #facc15',
    borderRadius: 4,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    cursor: 'pointer',
    transition: 'background 0.08s ease, border-color 0.08s ease',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    fontSize: 0,
    lineHeight: 1,
  },

  brushPicker: {
    display: 'flex',
    gap: '12px',
    background: 'transparent',
    padding: 0,
    borderRadius: 0,
  },

  brushBtn: {
    minWidth: '120px',
    height: '40px',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    padding: '0 18px',
    fontSize: '14px',
    fontWeight: '700',
    transition: 'all .18s ease',
  },
  gridCellLocked: {
    width: '100%',
    height: 34,
    minHeight: 34,
    padding: 0,
    boxSizing: 'border-box',
    background: 'repeating-linear-gradient(45deg, #eef3f6, #eef3f6 6px, #e2e8ec 6px, #e2e8ec 12px)',
    border: '1px solid #dbe6f0',
    borderRadius: 4,
    borderRight: '1px solid #dbe6f0',
    borderBottom: '1px solid #dbe6f0',
    cursor: 'not-allowed',
    opacity: 0.6,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    fontSize: 0,
    lineHeight: 1,
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
  absenceCardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
    alignItems: 'stretch',
  },

  absenceCreateForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  absenceDatesRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },

  absenceSubmitButton: {
    alignSelf: 'flex-end',
    minWidth: 180,
    marginTop: 6,
  },

  absenceHistoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxHeight: 340,
    overflowY: 'auto',
  },

  absenceHistoryItem: {
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    background: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
  },
  
};

const AVAILABILITY_STYLE_MAP = {
  available: styles.gridCellAvailable,
  if_needed: styles.gridCellMaybe,
  unavailable: styles.gridCell,
};
