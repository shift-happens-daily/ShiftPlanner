import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { listEmployees } from '../../services/employeeService';
import { extractApiErrorMessage, localizeBackendMessage } from '../../services/error';
import {
  createExchangeRequest,
  generateSchedule,
  getMySchedule,
  publishSchedule,
  updateShift,
} from '../../services/scheduleService';

function defaultPeriod() {
  const today = new Date();

  return {
    start_date: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
    end_date: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
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

function parseTimeToHours(value) {
  if (!value) return 0;
  const parts = String(value).split(':');
  const hours = Number(parts[0] || 0);
  const minutes = Number(parts[1] || 0);
  return hours + minutes / 60;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const iso = date.toISOString().slice(0, 10);
  return iso;
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

const MOCK_MY_SCHEDULE = [
  { id: 'mock-1', date: new Date().toISOString(), start_time: '08:00', end_time: '12:00', position_title: 'Cashier', company_name: 'ShiftPlanner Inc.' },
  { id: 'mock-2', date: new Date().toISOString(), start_time: '13:00', end_time: '17:00', position_title: 'Stock', company_name: 'ShiftPlanner Inc.' },
  { id: 'mock-3', date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), start_time: '09:00', end_time: '14:00', position_title: 'Reception', company_name: 'ShiftPlanner Inc.' },
  { id: 'mock-4', date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(), start_time: '10:00', end_time: '15:00', position_title: 'Support', company_name: 'ShiftPlanner Inc.' },
];

function getShiftId(shift) {
  return shift?.id || shift?.shift_id;
}

function getShiftPosition(shift) {
  return shift?.position || shift?.position_title || shift?.position_name || shift?.position?.title || shift?.position?.name || '—';
}

function getShiftEmployeeName(shift) {
  return shift?.employee_name || shift?.employee?.full_name || shift?.full_name || '—';
}

function getShiftCompany(shift) {
  return shift?.company_name || shift?.company?.name || shift?.company || '—';
}

function getEmployeePositionId(employee) {
  return employee?.position_id || employee?.position?.id;
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
    position: item.position_title || item.position || '',
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

export default function ScheduleTab({ language, userRole }) {
  const isManager = userRole === 'manager';

  const [periodForm, setPeriodForm] = useState(defaultPeriod);

  const scheduleStorageKey = 'shiftplanner_manager_draft_schedule';
  const [schedule, setSchedule] = useState(() => {
    const rawSchedule = localStorage.getItem(scheduleStorageKey);

    if (!rawSchedule) {
      return null;
    }

    try {
      return JSON.parse(rawSchedule);
    } catch {
      localStorage.removeItem(scheduleStorageKey);
      return null;
    }
  });

  const [mySchedule, setMySchedule] = useState([]);
  const [employeeViewMode, setEmployeeViewMode] = useState('day');
  const [employees, setEmployees] = useState([]);
  const [exchangeNotes, setExchangeNotes] = useState({});
  const [reassignEmployeeIds, setReassignEmployeeIds] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      titleManager: 'Расписание',
      titleEmployee: 'Мое расписание',
      subtitleEmployee: 'Здесь отображаются опубликованные смены.',
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
      noSchedule: 'Расписание еще не сгенерировано.',
      noScheduleHint: 'Выбери период и нажми «Сгенерировать черновик». Если смены не появятся, проверь требования к сменам.',
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
      noPublishedSchedule: 'Опубликованных смен пока нет.',
      sectionHowItWorks: 'Как это работает',
      howOne: '1. «Настройки смен» задают спрос: сколько людей нужно.',
      howTwo: '2. «Сгенерировать» создает черновик смен.',
      howThree: '3. «Опубликовать» делает расписание видимым сотрудникам.',
      company: 'Компания',
    },
    en: {
      titleManager: 'Schedule',
      titleEmployee: 'My schedule',
      subtitleEmployee: 'Published shifts appear here.',
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
      noSchedule: 'Schedule has not been generated yet.',
      noScheduleHint: 'Choose a period and click Generate draft. If no shifts appear, check shift requirements.',
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
      noPublishedSchedule: 'No published shifts yet.',
      sectionHowItWorks: 'How it works',
      howOne: '1. Shift setup defines demand: how many people are needed.',
      howTwo: '2. Generate creates a draft shift schedule.',
      howThree: '3. Publish makes the schedule visible to employees.',
      company: 'Company',
    },
  };

  const t = texts[language] || texts.ru;

  const scheduleShifts = useMemo(() => normalizeArray(schedule?.shifts), [schedule]);
  const unfilledRequirements = useMemo(() => normalizeArray(schedule?.unfilled_requirements), [schedule]);
  const conflicts = useMemo(() => normalizeArray(schedule?.conflicts), [schedule]);

  const employeeSchedule = mySchedule.length ? mySchedule : MOCK_MY_SCHEDULE;

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
    const dates = [...new Set(normalizeArray(employeeSchedule).map((shift) => formatDate(shift.date || new Date())))];
    return dates.sort();
  }, [employeeSchedule]);

  const employeeTimelineDates = useMemo(() => {
    if (employeeViewMode === 'day') return employeeDates.slice(0, 1);
    if (employeeViewMode === 'week') return employeeDates.slice(0, 7);
    return employeeDates.slice(0, 30);
  }, [employeeDates, employeeViewMode]);

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

  useEffect(() => {
    if (!isManager) {
      return;
    }

    if (schedule) {
      localStorage.setItem(scheduleStorageKey, JSON.stringify(schedule));
    } else {
      localStorage.removeItem(scheduleStorageKey);
    }
  }, [isManager, schedule, scheduleStorageKey]);

  const loadManagerData = useCallback(async () => {
    const employeesData = await listEmployees();
    setEmployees(normalizeArray(employeesData));
  }, []);

  const loadEmployeeData = useCallback(async () => {
    const shifts = await getMySchedule();
    setMySchedule(normalizeArray(shifts));
  }, []);

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

  const handleGenerate = async () => {
    clearMessages();
    setIsSubmitting(true);

    try {
      const generated = await generateSchedule(periodForm);
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
      const publishedSchedule = await publishSchedule(schedule.id);
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
      const payload = action === 'remove'
        ? { action }
        : { action, employee_id: Number(reassignEmployeeIds[shiftId]) };

      const updatedSchedule = await updateShift(schedule.id, shiftId, payload);
      setSchedule(updatedSchedule);
      setSuccessMessage(t.shiftUpdated);
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
          <div>
            <h2 style={styles.title}>{isManager ? t.titleManager : t.titleEmployee}</h2>
            <p style={styles.subtitle}>{isManager ? t.subtitleManager : t.subtitleEmployee}</p>
          </div>

          {isManager && schedule && (
            <div style={styles.headerStats}>
              <Metric label={t.filledShifts} value={countFilledShifts(schedule)} />
              <Metric label={t.unfilledCount} value={countUnfilled(schedule)} />
            </div>
          )}
        </header>

        {isManager ? (
          <div style={styles.managerLayout}>
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
                      style={styles.input}
                    />
                  </Field>

                  <Field label={t.endDate}>
                    <input
                      type="date"
                      value={periodForm.end_date}
                      onChange={(event) =>
                        setPeriodForm((prev) => ({ ...prev, end_date: event.target.value }))
                      }
                      style={styles.input}
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
            </aside>

            <main style={styles.previewArea}>
              {!schedule ? (
                <div style={styles.emptyHero}>
                  <h3 style={styles.emptyTitle}>{t.noSchedule}</h3>
                  <p style={styles.emptyText}>{t.noScheduleHint}</p>
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
                          const shiftPositionId = getShiftPositionId(shift);
                          const availableEmployees = employees.filter((employee) => (
                            String(getEmployeePositionId(employee)) === String(shiftPositionId)
                          ));

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
                                <select
                                  value={reassignEmployeeIds[shiftId] || ''}
                                  onChange={(event) =>
                                    setReassignEmployeeIds((prev) => ({
                                      ...prev,
                                      [shiftId]: event.target.value,
                                    }))
                                  }
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
                                  onClick={() => handleShiftAction(shiftId, 'reassign')}
                                  style={styles.smallPrimaryButton}
                                  disabled={!reassignEmployeeIds[shiftId] || isSubmitting}
                                >
                                  {t.reassign}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleShiftAction(shiftId, 'remove')}
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
                          {unfilledRequirements.map((item) => (
                            <div key={item.requirement_id} style={styles.compactItem}>
                              <strong style={styles.itemTitle}>{item.position_title}</strong>
                              <span style={styles.itemMeta}>{item.date}</span>
                              <span style={styles.itemMeta}>
                                {formatTime(item.start_time)} — {formatTime(item.end_time)}
                              </span>
                              <span style={styles.staffBadge}>
                                {t.missingStaff}: {item.missing_staff}
                              </span>
                            </div>
                          ))}
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
        ) : (
          <main style={styles.employeeArea}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h3 style={styles.panelTitle}>{t.titleEmployee}</h3>
                  <p style={styles.panelHint}>{t.subtitleEmployee}</p>
                </div>

                <div style={styles.modeSegment}>
                  {['day', 'week', 'month'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEmployeeViewMode(mode)}
                      style={
                        employeeViewMode === mode
                          ? { ...styles.modeButton, ...styles.modeButtonActive }
                          : styles.modeButton
                      }
                    >
                      {t[mode] || mode}
                    </button>
                  ))}
                </div>
              </div>

              {employeeSchedule.length === 0 ? (
                <div style={styles.emptyHero}>
                  <h3 style={styles.emptyTitle}>{t.noPublishedSchedule}</h3>
                  <p style={styles.emptyText}>{t.noScheduleHint}</p>
                </div>
              ) : (
                <div style={styles.employeeTimelineScroll}>
                  <div style={styles.employeeTimeline}>
                    {employeeTimelineDates.map((date) => {
                      const shiftsForDate = normalizeArray(employeeSchedule).filter(
                        (shift) => formatDate(shift.date || '') === date
                      );

                      return (
                        <section key={date} style={styles.timelineDay}>
                          <div style={styles.timelineDayHeader}>
                            <strong style={styles.itemTitle}>{formatDisplayDate(date)}</strong>
                            <span style={styles.itemMeta}>{date}</span>
                          </div>

                          {shiftsForDate.length === 0 ? (
                            <p style={styles.emptyText}>{t.empty}</p>
                          ) : (
                            <div style={styles.shiftList}>
                              {shiftsForDate.map((shift) => {
                                const shiftId = getShiftId(shift);

                                return (
                                  <div key={shiftId} style={styles.shiftCard}>
                                    <div style={styles.shiftMain}>
                                      <div style={styles.shiftRow}>
                                        <strong style={styles.itemTitle}>{getShiftPosition(shift)}</strong>
                                        <span style={styles.itemMeta}>· {getShiftCompany(shift)}</span>
                                        <span style={styles.timeBadge}>
                                          {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </main>
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
    background: '#ffffff',
    border: '1px solid rgba(222, 231, 231, 0.95)',
    boxShadow: '0 22px 58px rgba(0, 38, 66, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
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
    maxWidth: '820px',
    margin: '6px 0 0',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: 1.45,
  },

  headerStats: {
    display: 'flex',
    gap: '10px',
  },

  managerLayout: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '300px minmax(0, 1fr)',
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

  previewArea: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr) auto',
    gap: '16px',
    overflow: 'hidden',
  },

  employeeArea: {
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  panel: {
    padding: '18px',
    borderRadius: '22px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
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
    fontWeight: '850',
  },

  panelHint: {
    margin: '4px 0 0',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '650',
  },

  modeSegment: {
    display: 'inline-flex',
    borderRadius: '999px',
    background: '#eceff4',
    padding: '4px',
    gap: '6px',
    flexShrink: 0,
  },

  modeButton: {
    minWidth: '70px',
    border: 'none',
    borderRadius: '999px',
    background: 'transparent',
    color: '#4f646f',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  modeButtonActive: {
    background: '#002642',
    color: '#f4faff',
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
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid rgba(222, 231, 231, 0.95)',
    boxShadow: '0 8px 18px rgba(0, 38, 66, 0.08)',
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

  select: {
    width: '210px',
    height: '38px',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '2px solid #dee7e7',
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
    borderRadius: '13px',
    border: '2px solid #dee7e7',
    background: '#ffffff',
    padding: '10px 12px',
    color: '#002642',
    fontSize: '14px',
    resize: 'vertical',
    outline: 'none',
  },

  primaryButton: {
    height: '42px',
    padding: '0 18px',
    background: '#002642',
    border: 'none',
    borderRadius: '13px',
    color: '#f4faff',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  primaryButtonDisabled: {
    height: '42px',
    padding: '0 18px',
    background: '#4f646f',
    border: 'none',
    borderRadius: '13px',
    color: '#f4faff',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
  },

  secondaryButton: {
    height: '42px',
    padding: '0 18px',
    background: '#d7adcf',
    border: 'none',
    borderRadius: '13px',
    color: '#002642',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  secondaryButtonDisabled: {
    height: '42px',
    padding: '0 18px',
    background: '#d7adcf',
    border: 'none',
    borderRadius: '13px',
    color: '#002642',
    fontWeight: '850',
    cursor: 'default',
    opacity: 0.65,
    whiteSpace: 'nowrap',
  },

  smallPrimaryButton: {
    height: '36px',
    padding: '0 13px',
    background: '#002642',
    border: 'none',
    borderRadius: '12px',
    color: '#f4faff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  smallSecondaryButton: {
    height: '36px',
    padding: '0 13px',
    background: 'rgba(215, 173, 207, 0.42)',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  helpBox: {
    padding: '18px',
    borderRadius: '22px',
    background: '#dee7e7',
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
    minWidth: '110px',
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

  statusDraft: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: '#dee7e7',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '850',
  },

  statusPublished: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(215, 173, 207, 0.55)',
    color: '#002642',
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
    padding: '14px 16px',
    borderRadius: '18px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.1)',
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
    background: '#dee7e7',
    color: '#002642',
    border: '1px solid rgba(79, 100, 111, 0.1)',
    fontSize: '12px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },

  bottomGrid: {
    minHeight: '160px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
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
    borderRadius: '16px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.1)',
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
    background: 'rgba(215, 173, 207, 0.45)',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '850',
  },

  emptyHero: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    background: '#f4faff',
    borderRadius: '22px',
    border: '1px solid rgba(79, 100, 111, 0.12)',
  },

  emptyTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '22px',
    fontWeight: '900',
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