import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultSchedulePeriod,
  deleteSchedule,
  generateSchedule,
  getLatestSchedule,
  mergePublishedSchedule,
  publishSchedule,
} from '../../services/scheduleService';
import { filterRealEmployees, listEmployees } from '../../services/employeeService';
import { useAuth } from '../../context/useAuth';
import { extractApiErrorMessage } from '../../services/error';

function formatDate(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) {
    return String(d || '').slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function defaultPeriod() {
  return defaultSchedulePeriod();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.shifts)) return value.shifts;
  return [];
}

function parseTimeToHours(t) {
  if (!t) return 0;
  const parts = String(t).split(':');
  const h = Number(parts[0] || 0);
  const m = Number(parts[1] || 0);
  return h + m / 60;
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

function hasStaffingRequirements(scheduleRead) {
  return normalizeArray(scheduleRead?.shifts).length > 0
    || normalizeArray(scheduleRead?.unfilled_requirements).length > 0;
}

export default function ScheduleReview({ language }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const hasCompany = Boolean(user?.company);
  const [viewMode, setViewMode] = useState('day');
  const [periodForm, setPeriodForm] = useState(defaultPeriod);
  const [schedule, setSchedule] = useState(null);
  const [archivedSchedule, setArchivedSchedule] = useState(null);
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
      publish: 'Опубликовать',
      status: 'Статус',
      draft: 'Черновик',
      published: 'Опубликовано',
      unfilled: 'Не хватает людей',
      noSchedule: 'Расписание ещё не сгенерировано.',
      noScheduleHint: 'Алгоритму нужны шаблоны потребности, часы филиала и availability сотрудников.',
      noEmployeesAndRequirements: 'Нет сотрудников и требований для генерации расписания.',
      generating: 'Генерация...',
      loading: 'Загрузка...',
      generated: 'Черновик расписания создан.',
      publishedDone: 'Расписание опубликовано.',
      previousVersion: 'Прошлая версия',
      deletePrevious: 'Удалить прошлую версию',
      confirmDeletePrevious: 'Удалить прошлую версию расписания?',
      previousDeleted: 'Прошлая версия расписания удалена.',
      deletePreviousError: 'Не удалось удалить прошлую версию.',
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
      publish: 'Publish',
      status: 'Status',
      draft: 'Draft',
      published: 'Published',
      unfilled: 'Missing staff',
      noSchedule: 'Schedule has not been generated yet.',
      noScheduleHint: 'The solver needs staffing templates, branch hours, and employee availability.',
      noEmployeesAndRequirements: 'No employees or staffing requirements to generate a schedule.',
      generating: 'Generating...',
      loading: 'Loading...',
      generated: 'Draft schedule generated.',
      publishedDone: 'Schedule published.',
      previousVersion: 'Previous version',
      deletePrevious: 'Delete previous version',
      confirmDeletePrevious: 'Delete the previous schedule version?',
      previousDeleted: 'Previous schedule version deleted.',
      deletePreviousError: 'Failed to delete previous version.',
    },
  };

  const t = texts[language] || texts.ru;

  const cellWidth = 48;

  const scheduleStatus = schedule?.status === 'published' ? 'published' : 'draft';
  const unfilledCount = useMemo(
    () => normalizeArray(schedule?.unfilled_requirements).reduce(
      (sum, item) => sum + Number(item?.missing_staff || 0),
      0
    ),
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
      shifts: normalizeArray(schedule.shifts).filter((shift) => (
        realEmployeeIds.has(String(shift.employee_id))
      )),
    };
  }, [schedule, employeesLoaded, realEmployeeIds]);

  const schedules = useMemo(() => groupShiftsByDate(displaySchedule), [displaySchedule]);
  const dates = useMemo(() => schedules.map((s) => s.date), [schedules]);

  const pageSize = viewMode === 'day' ? 1 : viewMode === '3day' ? 3 : 30;

  const visibleDates = useMemo(() => {
    if (!dates.length) return [];
    const start = Math.max(0, Math.min(selectedDateIndex, dates.length - 1));
    return dates.slice(start, start + pageSize);
  }, [dates, selectedDateIndex, pageSize]);

  const dateIndexForVisible = useMemo(() => {
    const out = [];
    const start = Math.max(0, Math.min(selectedDateIndex, schedules.length - 1));
    for (let i = 0; i < pageSize; i += 1) {
      const idx = start + i;
      if (idx >= 0 && idx < schedules.length) out.push(idx);
    }
    return out;
  }, [schedules, selectedDateIndex, pageSize]);

  const employeesForView = useMemo(
    () => buildEmployeeListFromIndexes(schedules, dateIndexForVisible),
    [schedules, dateIndexForVisible]
  );

  const loadLatestSchedule = useCallback(async () => {
    for (const status of ['draft', 'published']) {
      try {
        return await getLatestSchedule(status);
      } catch (error) {
        if (error?.response?.status === 404 || isMissingCompanyError(error)) {
          continue;
        }
        throw error;
      }
    }

    return null;
  }, []);

  const loadArchivedSchedule = useCallback(async () => {
    try {
      return await getLatestSchedule('archived');
    } catch (error) {
      if (error?.response?.status === 404 || isMissingCompanyError(error)) {
        return null;
      }
      throw error;
    }
  }, []);

  const runGenerate = useCallback(async (period) => {
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const generated = await generateSchedule(period);
      const visibleShiftCount = countVisibleShifts(generated, realEmployeeIds);

      setSchedule(generated);
      setSelectedDateIndex(0);

      const archived = await loadArchivedSchedule();
      setArchivedSchedule(archived);

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
  }, [language, loadArchivedSchedule, realEmployeeIds, t.generated, t.noEmployeesAndRequirements, t.noScheduleHint]);

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
        setSchedule(null);
        setArchivedSchedule(null);
        setSelectedDateIndex(0);
        setEmployeesLoaded(true);
        setIsLoading(false);
        return;
      }

      try {
        const [employees, latestSchedule, archived] = await Promise.all([
          listEmployees().catch(() => []),
          loadLatestSchedule(),
          loadArchivedSchedule(),
        ]);

        if (cancelled) return;

        setRealEmployeeIds(new Set(
          filterRealEmployees(employees).map((employee) => String(employee.id))
        ));
        setSchedule(latestSchedule);
        setArchivedSchedule(archived);
        setSelectedDateIndex(0);
      } catch (error) {
        if (!cancelled && !isMissingCompanyError(error)) {
          setError(extractApiErrorMessage(error, t.noScheduleHint, language));
          setSchedule(null);
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
  }, [hasCompany, isAuthLoading, language, loadArchivedSchedule, loadLatestSchedule, t.noScheduleHint]);

  useEffect(() => {
    if (!error && !success) return undefined;
    const timer = setTimeout(() => {
      setError('');
      setSuccess('');
    }, error ? 5000 : 2500);
    return () => clearTimeout(timer);
  }, [error, success]);

  const handlePublish = async () => {
    if (!schedule?.id) return;
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const published = await publishSchedule(schedule.id);
      setSchedule((prev) => mergePublishedSchedule(prev, published));
      const archived = await loadArchivedSchedule();
      setArchivedSchedule(archived);
      setSuccess(t.publishedDone);
    } catch (e) {
      setError(extractApiErrorMessage(e, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePreviousSchedule = async () => {
    if (!archivedSchedule?.id) return;
    if (!window.confirm(t.confirmDeletePrevious)) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await deleteSchedule(archivedSchedule.id);
      setArchivedSchedule(null);
      setSuccess(t.previousDeleted);
    } catch (e) {
      setError(extractApiErrorMessage(e, t.deletePreviousError, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showDeletePrevious = Boolean(
    archivedSchedule?.id
    && String(archivedSchedule.id) !== String(schedule?.id)
  );

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

  const totalWidth = visibleDates.length * 24 * cellWidth;
  const hasShifts = schedules.length > 0 && employeesForView.length > 0;

  return (
    <section style={{ padding: 18 }}>
      <div style={{ background: '#ffffff', borderRadius: '22px', boxShadow: '0 22px 58px rgba(0, 38, 66, 0.16)', padding: 24 }}>
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, color: '#002642' }}>{t.title}</h2>
              <p style={{ margin: '8px 0 0', color: '#4f646f', fontSize: 14, maxWidth: 680 }}>{t.subtitle}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                padding: '8px 12px',
                borderRadius: 999,
                background: scheduleStatus === 'published' ? 'rgba(215, 173, 207, 0.55)' : '#dee7e7',
                color: '#002642',
                fontWeight: 800,
                fontSize: 13,
              }}>
                {t.status}: {scheduleStatus === 'published' ? t.published : t.draft}
              </span>
              <span style={{ color: '#8d1d1d', fontWeight: 800, fontSize: 13 }}>
                {t.unfilled}: {unfilledCount}
              </span>
            </div>
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

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#4f646f', fontSize: 12, fontWeight: 800 }}>
            {t.startDate}
            <input
              type="date"
              value={periodForm.start_date}
              onChange={(e) => setPeriodForm((prev) => ({ ...prev, start_date: e.target.value }))}
              style={{ height: 40, borderRadius: 12, border: '2px solid #dee7e7', padding: '0 12px', color: '#002642' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#4f646f', fontSize: 12, fontWeight: 800 }}>
            {t.endDate}
            <input
              type="date"
              value={periodForm.end_date}
              onChange={(e) => setPeriodForm((prev) => ({ ...prev, end_date: e.target.value }))}
              style={{ height: 40, borderRadius: 12, border: '2px solid #dee7e7', padding: '0 12px', color: '#002642' }}
            />
          </label>

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
            }}
          >
            {isSubmitting ? t.generating : t.generate}
          </button>

          {schedule?.id && scheduleStatus === 'draft' && (
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
              }}
            >
              {t.publish}
            </button>
          )}

          {showDeletePrevious && (
            <button
              type="button"
              onClick={handleDeletePreviousSchedule}
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
              }}
            >
              {t.deletePrevious}
            </button>
          )}
        </div>

        {showDeletePrevious && (
          <div style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 12,
            background: '#f4faff',
            border: '1px solid #dee7e7',
            color: '#4f646f',
            fontSize: 13,
            fontWeight: 600,
          }}>
            {t.previousVersion}: {archivedSchedule.start_date || archivedSchedule.period_start || '—'}
            {' — '}
            {archivedSchedule.end_date || archivedSchedule.period_end || '—'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f4faff', border: '1px solid #dee7e7', borderRadius: 12, padding: '10px 14px' }}>
            <button onClick={() => setSelectedDateIndex((i) => Math.max(0, i - 1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>&larr;</button>
            <strong style={{ color: '#002642' }}>{dates[selectedDateIndex] || '—'}</strong>
            <button onClick={() => setSelectedDateIndex((i) => Math.min(dates.length - 1, i + 1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>&rarr;</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['day', '3day', 'month'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
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

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={exportCSV} disabled={!hasShifts} style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: '#002642',
              color: '#fff',
              border: 'none',
              cursor: hasShifts ? 'pointer' : 'default',
              fontWeight: 600,
              opacity: hasShifts ? 1 : 0.5,
            }}>{t.exportCSV}</button>
          </div>
        </div>

        {!hasShifts ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f4faff', borderRadius: 18, border: '1px solid #dee7e7' }}>
            <h3 style={{ margin: 0, color: '#002642' }}>{t.noSchedule}</h3>
            <p style={{ margin: '8px 0 0', color: '#4f646f', fontSize: 14 }}>{t.noScheduleHint}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              borderCollapse: 'collapse',
              minWidth: 200 + totalWidth,
              tableLayout: 'fixed',
              background: '#ffffff',
              borderRadius: '18px',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0, 38, 66, 0.08)',
            }}>
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
                  }}>
                    {t.employee}
                  </th>
                  {visibleDates.map((d) => (
                    <th key={d} style={{
                      padding: '10px 4px',
                      borderBottom: '2px solid #dee7e7',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#4f646f',
                      background: '#f4faff',
                      width: 24 * cellWidth,
                      minWidth: 24 * cellWidth,
                      maxWidth: 24 * cellWidth,
                    }}>
                      {d}
                    </th>
                  ))}
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
                  }} />
                  {visibleDates.map((d) => (
                    <th key={`${d}-time`} style={{
                      padding: '4px 2px',
                      borderBottom: '2px solid #dee7e7',
                      background: '#f4faff',
                    }}>
                      <div style={{ display: 'flex', gap: 0 }}>
                        {Array.from({ length: 24 }).map((_, h) => (
                          <div key={h} style={{
                            flex: `0 0 ${cellWidth}px`,
                            textAlign: 'center',
                            fontSize: 11,
                            color: '#4f646f',
                            fontWeight: '500',
                          }}>
                            {`${String(h).padStart(2, '0')}:00`}
                          </div>
                        ))}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeesForView.map((emp, rowIndex) => (
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
                    }}>
                      {emp.full_name || emp.name || emp.email || `#${emp.id}`}
                    </td>
                    {visibleDates.map((d, idx) => {
                      const di = dateIndexForVisible[idx];
                      const day = schedules[di];
                      if (!day) {
                        return <td key={`${d}-${emp.id}`} style={{
                          padding: 0,
                          borderBottom: '1px solid #f0f0f0',
                          height: 72,
                          background: rowIndex % 2 === 0 ? '#ffffff' : '#f8faff',
                          width: 24 * cellWidth,
                          minWidth: 24 * cellWidth,
                          maxWidth: 24 * cellWidth,
                        }} />;
                      }

                      const myShifts = (day.shifts || []).filter((shift) => {
                        const ids = (shift.assigned_employees || shift.candidate_employees || []).map((e) => String(e.id));
                        return ids.includes(String(emp.id));
                      });

                      return (
                        <td key={`${d}-${emp.id}`} style={{
                          padding: 0,
                          borderBottom: '1px solid #f0f0f0',
                          height: 72,
                          position: 'relative',
                          background: rowIndex % 2 === 0 ? '#ffffff' : '#f8faff',
                          width: 24 * cellWidth,
                          minWidth: 24 * cellWidth,
                          maxWidth: 24 * cellWidth,
                        }}>
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {myShifts.map((shift) => {
                              const start = parseTimeToHours(shift.start_time);
                              const end = parseTimeToHours(shift.end_time || shift.start_time);
                              const duration = end - start;
                              const minWidthPx = 20;
                              const leftPx = start * cellWidth;
                              const widthPx = Math.max(duration * cellWidth, minWidthPx);
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
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
