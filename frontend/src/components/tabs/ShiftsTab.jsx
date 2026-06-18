import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createEmployeeAbsence,
  deleteEmployeeAbsence,
  getEmployeeAvailability,
  getMyAbsences,
  getMyCalendarSummary,
  updateEmployeeAvailability,
} from '../../services/employeeService';
import { extractApiErrorMessage, localizeBackendMessage } from '../../services/error';
import { importRequirementsXlsx } from '../../services/importService';
import { mapEmployeeCalendarSummary } from '../../services/mappers';
import { listPositions } from '../../services/positionService';
import {
  createBulkRequirements,
  createRequirement,
  listRequirements,
} from '../../services/scheduleService';

const WEEKDAYS = [
  { value: 0, ru: 'Пн', en: 'Mon' },
  { value: 1, ru: 'Вт', en: 'Tue' },
  { value: 2, ru: 'Ср', en: 'Wed' },
  { value: 3, ru: 'Чт', en: 'Thu' },
  { value: 4, ru: 'Пт', en: 'Fri' },
  { value: 5, ru: 'Сб', en: 'Sat' },
  { value: 6, ru: 'Вс', en: 'Sun' },
];

const TIME_SLOTS = Array.from({ length: 33 }, (_, index) => {
  const hour = Math.floor(index / 2) + 6;
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minutes}`;
});

function createEmptyAvailabilityMatrix() {
  const matrix = {};

  WEEKDAYS.forEach((day) => {
    matrix[day.value] = new Set();
  });

  return matrix;
}

function buildAvailabilityMatrix(availability = []) {
  const matrix = createEmptyAvailabilityMatrix();

  availability.forEach((block) => {
    const weekday = Number(block.weekday);
    const startStr = String(block.start_time || '').slice(0, 5);
    const endStr = String(block.end_time || '').slice(0, 5);

    if (!Number.isFinite(weekday)) return;

    TIME_SLOTS.forEach(slot => {
      if (slot >= startStr && slot < endStr) {
        if (matrix[weekday]) matrix[weekday].add(slot);
      }
    });
  });

  return matrix;
}

function convertMatrixToIntervals(matrix) {
  const intervals = [];

  Object.entries(matrix).forEach(([weekday, slotSet]) => {
    const sortedSlots = Array.from(slotSet).sort();
    if (sortedSlots.length === 0) return;

    let start = sortedSlots[0];
    let prev = sortedSlots[0];

    for (let i = 1; i <= sortedSlots.length; i++) {
      const current = sortedSlots[i];
      const isContinuous = current && TIME_SLOTS[TIME_SLOTS.indexOf(prev) + 1] === current;

      if (!isContinuous) {
        const prevIdx = TIME_SLOTS.indexOf(prev);
        const end = TIME_SLOTS[prevIdx + 1] || "22:30";
        
        intervals.push({
          weekday: Number(weekday),
          start_time: `${start}:00`,
          end_time: `${end}:00`,
        });
        start = current;
      }
      prev = current;
    }
  });

  return intervals;
}
function defaultSingleRequirement() {
  const today = new Date().toISOString().slice(0, 10);

  return {
    position_id: '',
    date: today,
    min_staff: 1,
    start_time: '09:00:00',
    end_time: '18:00:00',
  };
}

function defaultBulkRequirement() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  return {
    start_date: start,
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
  const today = new Date();

  return {
    start_date: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
    end_date: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.requirements)) {
    return value.requirements;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  return [];
}

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

function getPositionTitle(position) {
  return position?.title || position?.name || position?.position_title || '';
}

function getRequirementId(requirement) {
  return requirement?.id || requirement?.requirement_id || requirement?.local_id;
}

function normalizeRequirement(requirement, positions = []) {
  if (!requirement) {
    return null;
  }

  const positionId = requirement.position_id || requirement.positionId;
  const position = positions.find((item) => String(item.id) === String(positionId));

  return {
    ...requirement,
    id: getRequirementId(requirement),
    local_id: requirement.local_id,
    position_id: positionId,
    position_title:
      requirement.position_title ||
      requirement.positionTitle ||
      requirement.position?.title ||
      requirement.position?.name ||
      getPositionTitle(position) ||
      'Position',
    date: requirement.date,
    start_time: requirement.start_time || requirement.startTime,
    end_time: requirement.end_time || requirement.endTime,
    min_staff: requirement.min_staff || requirement.minStaff || 1,
    isLocalOnly: Boolean(requirement.isLocalOnly),
  };
}

function isDateWithinRange(date, startDate, endDate) {
  if (!date || !startDate || !endDate) {
    return true;
  }

  return date >= startDate && date <= endDate;
}

function mergeRequirements(serverRequirements, localRequirements) {
  const merged = [];
  const seen = new Set();

  [...serverRequirements, ...localRequirements].forEach((requirement) => {
    if (!requirement) {
      return;
    }

    const id = getRequirementId(requirement);
    const key = id
      ? `id:${id}`
      : `${requirement.position_id}-${requirement.date}-${requirement.start_time}-${requirement.end_time}-${requirement.min_staff}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push(requirement);
  });

  return merged;
}

function normalizeError(error, fallback, language) {
  return extractApiErrorMessage(error, fallback, language) || fallback;
}

async function deleteRequirementRequest(requirementId) {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const token = localStorage.getItem('shiftplanner_token');

  const response = await fetch(`${baseUrl}/schedule/requirements/${requirementId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    let detail = '';

    try {
      const payload = await response.json();
      detail = payload?.detail || payload?.message || '';
    } catch {
      detail = '';
    }

    throw new Error(detail || `Delete failed with status ${response.status}`);
  }
}

export default function ShiftsTab({ language, userRole, user }) {
  const isManager = userRole === 'manager';
  const employeeId = user?.employeeId || user?.employee_id;

  const [mode, setMode] = useState('single');
  const [positions, setPositions] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [singleRequirement, setSingleRequirement] = useState(defaultSingleRequirement);
  const [bulkRequirement, setBulkRequirement] = useState(defaultBulkRequirement);

  const [filterForm, setFilterForm] = useState(currentMonthFilters);
  const [appliedFilters, setAppliedFilters] = useState(currentMonthFilters);

  const localRequirementsStorageKey = 'shiftplanner_local_requirements';
  const [localRequirements, setLocalRequirements] = useState(() => {
    const raw = localStorage.getItem(localRequirementsStorageKey);

    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  const [availabilityForm, setAvailabilityForm] = useState({
    weekly_availability: [],
    desired_days_off: [],
  });

  const [availabilityMatrix, setAvailabilityMatrix] = useState(() => createEmptyAvailabilityMatrix());

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const weekDates = useMemo(() => {
    const current = new Date(selectedDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Пн
    const monday = new Date(current.setDate(diff));

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const [absenceForm, setAbsenceForm] = useState({
    absence_type: 'vacation',
    start_date: '',
    end_date: '',
    comment: '',
  });

  const [absences, setAbsences] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      titleManager: 'Настройки смен',
      titleEmployee: 'Доступность',
      subtitleEmployee: 'Сотрудник указывает, когда может работать и когда отсутствует.',
      stepOne: '1. Выберите период',
      stepTwo: '2. Создайте требование',
      stepThree: '3. Проверьте список',
      filters: 'Период списка',
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
      desiredDaysOff: 'Желаемые выходные',
      absences: 'Мои отсутствия',
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
    },
    en: {
      titleManager: 'Shift setup',
      titleEmployee: 'Availability',
      subtitleEmployee: 'Employees define when they can work and when they are absent.',
      stepOne: '1. Choose period',
      stepTwo: '2. Create requirement',
      stepThree: '3. Check list',
      filters: 'List period',
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
      desiredDaysOff: 'Desired days off',
      absences: 'My absences',
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
    },
  };

  const t = texts[language] || texts.ru;

  const todayStr = useMemo(() => new Date().toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  }), [language]);

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const visibleRequirements = useMemo(() => {
    const server = requirements
      .map((requirement) => normalizeRequirement(requirement, positions))
      .filter(Boolean);
    const local = localRequirements
      .map((requirement) => normalizeRequirement(requirement, positions))
      .filter(Boolean);

    return mergeRequirements(server, local).filter((requirement) =>
      isDateWithinRange(requirement.date, appliedFilters.start_date, appliedFilters.end_date)
    );
  }, [appliedFilters, localRequirements, positions, requirements]);

  useEffect(() => {
    localStorage.setItem(localRequirementsStorageKey, JSON.stringify(localRequirements));
  }, [localRequirements, localRequirementsStorageKey]);

  useEffect(() => {
    if (!errorMessage && !successMessage) {
      return undefined;
    }

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
    if (options.silent) {
      setIsRefreshingList(true);
    }

    const [positionsData, requirementsData] = await Promise.all([
      listPositions(),
      listRequirements(filtersToUse),
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

    if (options.silent) {
      setIsRefreshingList(false);
    }
  }, [appliedFilters]);

  const loadEmployeeData = useCallback(async () => {
    if (!employeeId) {
      setAvailabilityForm({ weekly_availability: [], desired_days_off: [] });
      setAvailabilityMatrix(createEmptyAvailabilityMatrix());
      setAbsences([]);
      setSummary(null);
      return;
    }

    const [availabilityData, absencesData, summaryData] = await Promise.all([
      getEmployeeAvailability(employeeId),
      getMyAbsences(),
      getMyCalendarSummary(),
    ]);

    const normalizedAvailability = normalizeArray(availabilityData?.weekly_availability);

    setAvailabilityForm({
      weekly_availability: normalizedAvailability,
      desired_days_off: normalizeArray(availabilityData?.desired_days_off),
    });
    setAvailabilityMatrix(buildAvailabilityMatrix(normalizedAvailability));

    setAbsences(normalizeArray(absencesData));
    setSummary(mapEmployeeCalendarSummary(summaryData));
  }, [employeeId]);

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
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

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

  const submitManagerRequirement = async () => {
    if (!singleRequirement.position_id || !singleRequirement.date) {
      setErrorMessage(t.single);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      const createdRequirement = await createRequirement({
        ...singleRequirement,
        position_id: Number(singleRequirement.position_id),
        min_staff: Number(singleRequirement.min_staff),
      });

      const fallbackRequirement = normalizeRequirement(
        createdRequirement || {
          ...singleRequirement,
          local_id: `local-${Date.now()}`,
          position_id: Number(singleRequirement.position_id),
          min_staff: Number(singleRequirement.min_staff),
          isLocalOnly: !createdRequirement,
        },
        positions
      );

      setLocalRequirements((prev) => mergeRequirements([fallbackRequirement], prev));

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
      setSuccessMessage(t.requirementCreated);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.requirements, language));
    } finally {
      setIsSubmitting(false);
      setIsRefreshingList(false);
    }
  };

  const removeRequirement = async (requirementId) => {
    if (!requirementId) {
      return;
    }

    const target = visibleRequirements.find(
      (requirement) => String(getRequirementId(requirement)) === String(requirementId)
    );

    clearMessages();

    if (target?.isLocalOnly || String(requirementId).startsWith('local-')) {
      setLocalRequirements((prev) =>
        prev.filter((requirement) => String(getRequirementId(requirement)) !== String(requirementId))
      );
      setSuccessMessage(t.requirementDeleted);
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteRequirementRequest(requirementId);

      setRequirements((prev) =>
        prev.filter((requirement) => String(getRequirementId(requirement)) !== String(requirementId))
      );
      setLocalRequirements((prev) =>
        prev.filter((requirement) => String(getRequirementId(requirement)) !== String(requirementId))
      );

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
      const createdRequirements = await createBulkRequirements({
        ...bulkRequirement,
        requirements: bulkRequirement.requirements.map((item) => ({
          ...item,
          position_id: Number(item.position_id),
          min_staff: Number(item.min_staff),
        })),
      });

      const returnedRequirements = normalizeArray(createdRequirements)
        .map((requirement) => normalizeRequirement(requirement, positions))
        .filter(Boolean);

      if (returnedRequirements.length > 0) {
        setLocalRequirements((prev) => mergeRequirements(returnedRequirements, prev));
      }

      const nextFilters = {
        start_date: bulkRequirement.start_date,
        end_date: bulkRequirement.end_date,
      };

      setFilterForm(nextFilters);
      setAppliedFilters(nextFilters);

      await loadManagerData(nextFilters, { silent: true });
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
      await updateEmployeeAvailability(employeeId, {
        ...availabilityForm,
        weekly_availability: convertMatrixToIntervals(availabilityMatrix),
      });
      await loadEmployeeData();
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
      await createEmployeeAbsence(employeeId, absenceForm);

      setAbsenceForm({ absence_type: 'vacation', start_date: '', end_date: '', comment: '' });
      await loadEmployeeData();
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
            onClick={() => {
              setErrorMessage('');
              setSuccessMessage('');
            }}
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
      <section style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.emptyBox}>{t.loading}</div>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.page}>
      <div style={styles.shell}>
        {renderToast()}

        <header style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div>
              <h2 style={styles.title}>{isManager ? t.titleManager : t.titleEmployee}</h2>
              <p style={styles.subtitle}>{isManager ? t.subtitleManager : t.subtitleEmployee}</p>
            </div>
            <div style={styles.todayBadge}>
              <span style={styles.todayLabel}>{language === 'ru' ? 'Сегодня' : 'Today'}</span>
              <span style={styles.todayDate}>{todayStr}</span>
            </div>
          </div>
        </header>
        {isManager ? (
          <div style={styles.managerLayout}>
            <aside style={styles.sidebar}>
              <div style={styles.helpBox}>
                <strong>{t.stepOne}</strong>
                <span>{t.stepTwo}</span>
                <span>{t.stepThree}</span>
              </div>

              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>{t.filters}</h3>

                <div style={styles.stack}>
                  <label style={styles.label}>{t.startDate}</label>
                  <input
                    type="date"
                    value={filterForm.start_date}
                    onChange={(event) => setFilterForm((prev) => ({ ...prev, start_date: event.target.value }))}
                    style={styles.input}
                  />

                  <label style={styles.label}>{t.endDate}</label>
                  <input
                    type="date"
                    value={filterForm.end_date}
                    onChange={(event) => setFilterForm((prev) => ({ ...prev, end_date: event.target.value }))}
                    style={styles.input}
                  />

                  <button type="button" onClick={applyFilters} style={styles.secondaryButton}>
                    {isRefreshingList ? '...' : t.refresh}
                  </button>
                </div>
              </section>

              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>{t.import}</h3>
                <p style={styles.panelHint}>{t.fileHint}</p>

                <label style={styles.filePicker}>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
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
                    <div>
                      {t.create}: {importResult.created_count}
                    </div>

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

                  <div style={styles.formGrid}>
                    <Field label={t.position}>
                      <select
                        value={singleRequirement.position_id}
                        onChange={(event) =>
                          setSingleRequirement((prev) => ({ ...prev, position_id: event.target.value }))
                        }
                        style={styles.input}
                      >
                        <option value="">{positions.length ? t.choosePosition : t.noPositions}</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {getPositionTitle(position)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t.date}>
                      <input
                        type="date"
                        value={singleRequirement.date}
                        onChange={(event) =>
                          setSingleRequirement((prev) => ({ ...prev, date: event.target.value }))
                        }
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.minStaff}>
                      <input
                        type="number"
                        min="1"
                        value={singleRequirement.min_staff}
                        onChange={(event) =>
                          setSingleRequirement((prev) => ({ ...prev, min_staff: event.target.value }))
                        }
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.startTime}>
                      <input
                        type="time"
                        value={formatTime(singleRequirement.start_time)}
                        onChange={(event) =>
                          setSingleRequirement((prev) => ({
                            ...prev,
                            start_time: `${event.target.value}:00`,
                          }))
                        }
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.endTime}>
                      <input
                        type="time"
                        value={formatTime(singleRequirement.end_time)}
                        onChange={(event) =>
                          setSingleRequirement((prev) => ({
                            ...prev,
                            end_time: `${event.target.value}:00`,
                          }))
                        }
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

                  <div style={styles.formGrid}>
                    <Field label={t.startDate}>
                      <input
                        type="date"
                        value={bulkRequirement.start_date}
                        onChange={(event) =>
                          setBulkRequirement((prev) => ({ ...prev, start_date: event.target.value }))
                        }
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.endDate}>
                      <input
                        type="date"
                        value={bulkRequirement.end_date}
                        onChange={(event) =>
                          setBulkRequirement((prev) => ({ ...prev, end_date: event.target.value }))
                        }
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.position}>
                      <select
                        value={bulkRequirement.requirements[0].position_id}
                        onChange={(event) =>
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], position_id: event.target.value }],
                          }))
                        }
                        style={styles.input}
                      >
                        <option value="">{positions.length ? t.choosePosition : t.noPositions}</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {getPositionTitle(position)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t.minStaff}>
                      <input
                        type="number"
                        min="1"
                        value={bulkRequirement.requirements[0].min_staff}
                        onChange={(event) =>
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], min_staff: event.target.value }],
                          }))
                        }
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.startTime}>
                      <input
                        type="time"
                        value={formatTime(bulkRequirement.requirements[0].start_time)}
                        onChange={(event) =>
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], start_time: `${event.target.value}:00` }],
                          }))
                        }
                        style={styles.input}
                      />
                    </Field>

                    <Field label={t.endTime}>
                      <input
                        type="time"
                        value={formatTime(bulkRequirement.requirements[0].end_time)}
                        onChange={(event) =>
                          setBulkRequirement((prev) => ({
                            ...prev,
                            requirements: [{ ...prev.requirements[0], end_time: `${event.target.value}:00` }],
                          }))
                        }
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
                          onClick={() =>
                            setBulkRequirement((prev) => ({
                              ...prev,
                              weekdays: checked
                                ? prev.weekdays.filter((value) => value !== day.value)
                                : [...prev.weekdays, day.value].sort((a, b) => a - b),
                            }))
                          }
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

                {visibleRequirements.length === 0 ? (
                  <div style={styles.emptyBox}>{t.noRequirements}</div>
                ) : (
                  <div style={styles.requirementsList}>
                    {visibleRequirements.map((requirement) => (
                      <div key={getRequirementId(requirement)} style={styles.requirementItem}>
                        <div>
                          <strong style={styles.itemTitle}>{requirement.position_title}</strong>
                          <div style={styles.itemMeta}>
                            {requirement.date}
                            {requirement.isLocalOnly ? ` · ${t.localOnly}` : ''}
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
          <div style={styles.employeeGrid}>
            <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <h3 style={styles.panelTitle}>{t.availability}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      style={{ ...styles.input, width: 'auto' }}
                    />
                  </div>
                </div>
              <div style={styles.availabilityGridWrapper}>
                <div style={styles.availabilityGridHeader}>
                  <div style={styles.gridCorner} />
                  {WEEKDAYS.map((day, index) => {
                    const itIsToday = isToday(weekDates[index]);
                    return (
                      <div 
                        key={day.value} 
                        style={{ 
                          ...styles.gridHeaderCell, 
                          flexDirection: 'column', 
                          height: 'auto', 
                          padding: '8px 4px',
                          background: itIsToday ? '#002642' : '#dee7e7',
                          color: itIsToday ? '#ffffff' : '#002642',
                          border: itIsToday ? 'none' : styles.gridHeaderCell.border
                        }}
                      >
                        <span style={{ fontSize: '11px', opacity: itIsToday ? 0.9 : 0.8 }}>{day[language] || day.ru}</span>
                        <span style={{ fontSize: '13px', fontWeight: '900', whiteSpace: 'nowrap' }}>
                          {weekDates[index].toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    );
                  })}                </div>
                <div style={styles.availabilityGridBody}>
                  {TIME_SLOTS.map((time) => (
                    <div key={time} style={styles.gridRow}>
                      <div style={styles.gridTimeCell}>{time}</div>
                        {WEEKDAYS.map((day) => {
                          const isAvailable = availabilityMatrix[day.value]?.has(time);

                          return (
                            <button
                              key={`${day.value}-${time}`}
                              type="button"
                              onClick={() =>
                                setAvailabilityMatrix((prev) => {
                                  const next = { ...prev };
                                  const daySet = new Set(next[day.value]);

                                  if (daySet.has(time)) {
                                    daySet.delete(time);
                                  } else {
                                    daySet.add(time);
                                  }

                                  next[day.value] = daySet;
                                  return next;
                                })
                              }
                              style={isAvailable ? styles.gridCellActive : styles.gridCell}
                              aria-pressed={isAvailable}
                            />
                          );
                        })}                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.desiredDaysOffSection}>
                <span style={styles.desiredDaysOffLabel}>{t.desiredDaysOff}</span>
                <div style={styles.dayPills}>
                  {WEEKDAYS.map((day) => {
                    const checked = availabilityForm.desired_days_off.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() =>
                          setAvailabilityForm((prev) => ({
                            ...prev,
                            desired_days_off: checked
                              ? prev.desired_days_off.filter((value) => value !== day.value)
                              : [...prev.desired_days_off, day.value].sort((a, b) => a - b),
                          }))
                        }
                        style={checked ? styles.dayPillActive : styles.dayPill}
                      >
                        {day[language] || day.ru}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={submitAvailability}
                style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                disabled={isSubmitting}
              >
                {t.save}
              </button>
            </section>

            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>{t.absences}</h3>

              <div style={styles.absenceForm}>
                <select
                  value={absenceForm.absence_type}
                  onChange={(event) =>
                    setAbsenceForm((prev) => ({ ...prev, absence_type: event.target.value }))
                  }
                  style={styles.input}
                >
                  <option value="vacation">{t.vacation}</option>
                  <option value="sick_leave">{t.sick_leave}</option>
                  <option value="other">{t.other}</option>
                </select>

                <input
                  type="date"
                  value={absenceForm.start_date}
                  onChange={(event) =>
                    setAbsenceForm((prev) => ({ ...prev, start_date: event.target.value }))
                  }
                  style={styles.input}
                />

                <input
                  type="date"
                  value={absenceForm.end_date}
                  onChange={(event) =>
                    setAbsenceForm((prev) => ({ ...prev, end_date: event.target.value }))
                  }
                  style={styles.input}
                />

                <input
                  value={absenceForm.comment}
                  onChange={(event) =>
                    setAbsenceForm((prev) => ({ ...prev, comment: event.target.value }))
                  }
                  placeholder={t.other}
                  style={styles.input}
                />

                <button
                  type="button"
                  onClick={submitAbsence}
                  style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {t.addAbsence}
                </button>
              </div>

              {absences.length === 0 ? (
                <p style={styles.emptyText}>{t.empty}</p>
              ) : (
                <div style={styles.list}>
                  {absences.map((absence) => (
                    <div key={absence.id} style={styles.listItem}>
                      <div>
                        <strong style={styles.itemTitle}>
                          {t[absence.absence_type] || absence.absence_type}
                        </strong>
                        <div style={styles.itemMeta}>
                          {absence.start_date} — {absence.end_date}
                        </div>
                        {absence.comment && <div style={styles.itemMeta}>{absence.comment}</div>}
                      </div>

                      <button type="button" onClick={() => removeAbsence(absence.id)} style={styles.deleteButton}>
                        {t.delete}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>{t.shifts}</h3>

              {summary ? (
                <>
                  <div style={styles.metricGrid}>
                    <Metric label={t.totalShifts} value={summary.workload.total_shifts} />
                    <Metric label={t.hours} value={summary.workload.total_hours} />
                  </div>

                  {summary.shifts.length === 0 ? (
                    <p style={styles.emptyText}>{t.empty}</p>
                  ) : (
                    <div style={styles.list}>
                      {summary.shifts.map((shift) => (
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
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p style={styles.emptyText}>{t.empty}</p>
              )}
            </section>
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
    padding: '22px',
    overflow: 'hidden',
  },

  shell: {
    width: 'min(100%, 1280px)',
    height: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: '26px',
    borderRadius: '30px',
    background: '#f4faff',
    border: '1px solid rgba(222, 231, 231, 0.95)',
    boxShadow: '0 22px 58px rgba(0, 38, 66, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },

  header: {
    flexShrink: 0,
    marginBottom: '18px',
  },

  title: {
    margin: 0,
    color: '#002642',
    fontSize: '28px',
    fontWeight: '900',
    letterSpacing: '-0.03em',
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

  managerLayout: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '290px minmax(0, 1fr)',
    gap: '18px',
    overflow: 'hidden',
  },

  sidebar: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflowY: 'auto',
  },

  workArea: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'auto auto minmax(0, 1fr)',
    gap: '14px',
    overflow: 'hidden',
  },

  helpBox: {
    padding: '16px',
    borderRadius: '22px',
    background: '#dee7e7',
    color: '#002642',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '800',
  },

  panel: {
    padding: '18px',
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
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
    borderRadius: '18px',
    background: '#dee7e7',
    display: 'flex',
    gap: '4px',
  },

  modeButton: {
    height: '40px',
    padding: '0 18px',
    border: 'none',
    borderRadius: '14px',
    background: 'transparent',
    color: '#4f646f',
    fontWeight: '850',
    cursor: 'pointer',
  },

  modeButtonActive: {
    height: '40px',
    padding: '0 18px',
    border: 'none',
    borderRadius: '14px',
    background: '#ffffff',
    color: '#002642',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(0, 38, 66, 0.1)',
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
    height: '42px',
    boxSizing: 'border-box',
    borderRadius: '13px',
    border: '2px solid #dee7e7',
    background: '#ffffff',
    padding: '0 13px',
    color: '#002642',
    fontSize: '14px',
    outline: 'none',
  },

  primaryButton: {
    height: '42px',
    padding: '0 18px',
    background: '#002642',
    border: 'none',
    borderRadius: '13px',
    color: '#f4faff',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    marginTop: '14px',
  },

  primaryButtonDisabled: {
    height: '42px',
    padding: '0 18px',
    background: '#4f646f',
    border: 'none',
    borderRadius: '13px',
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
    border: 'none',
    borderRadius: '13px',
    color: '#002642',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  deleteButton: {
    height: '38px',
    padding: '0 13px',
    background: 'rgba(215, 173, 207, 0.42)',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  deleteRequirementButton: {
    height: '34px',
    padding: '0 12px',
    border: 'none',
    borderRadius: '11px',
    background: 'rgba(215, 173, 207, 0.48)',
    color: '#002642',
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
    borderRadius: '999px',
    background: '#ffffff',
    color: '#4f646f',
    fontWeight: '800',
    cursor: 'pointer',
  },

  dayPillActive: {
    height: '34px',
    padding: '0 13px',
    border: '1px solid rgba(215, 173, 207, 0.8)',
    borderRadius: '999px',
    background: '#d7adcf',
    color: '#002642',
    fontWeight: '900',
    cursor: 'pointer',
  },

  listPanel: {
    minHeight: 0,
    padding: '18px',
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    overflow: 'hidden',
  },

  requirementsList: {
    height: 'calc(100% - 40px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  requirementItem: {
    padding: '14px 16px',
    borderRadius: '18px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.1)',
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
    borderRadius: '999px',
    background: 'rgba(215, 173, 207, 0.45)',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '850',
  },

  filePicker: {
    minHeight: '44px',
    boxSizing: 'border-box',
    padding: '0 14px',
    margin: '12px 0',
    borderRadius: '14px',
    border: '2px dashed #dee7e7',
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
    borderRadius: '16px',
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
    gap: '16px',
  },

  availabilityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '12px',
  },

  availabilityGridWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '16px',
    overflowX: 'auto',
    paddingBottom: '8px',
  },

  availabilityGridHeader: {
    display: 'grid',
    gridTemplateColumns: '72px repeat(7, 80px)',
    gap: '6px',
    alignItems: 'center',
  },
  availabilityGridBody: {
    display: 'grid',
    gap: '6px',
  },

  gridCorner: {
    height: '34px',
    borderRadius: '12px',
    background: 'transparent',
  },

  gridHeaderCell: {
    minHeight: '34px',
    borderRadius: '12px',
    background: '#dee7e7',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },

  gridRow: {
    display: 'grid',
    gridTemplateColumns: '72px repeat(7, 80px)',
    gap: '6px',
    alignItems: 'center',
  },
  gridTimeCell: {
    height: '34px',
    borderRadius: '12px',
    background: '#f4faff',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },

  gridCell: {
    width: '100%',
    minHeight: '34px',
    borderRadius: '12px',
    background: '#eef3f6',
    border: '1px solid transparent',
    cursor: 'pointer',
  },

  gridCellActive: {
    width: '100%',
    minHeight: '34px',
    borderRadius: '12px',
    background: '#83b8f4',
    border: '1px solid #5b8fd5',
    cursor: 'pointer',
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

  availabilityRow: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr 1fr auto',
    gap: '10px',
    alignItems: 'center',
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
