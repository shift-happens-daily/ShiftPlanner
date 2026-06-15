import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function ScheduleTab({ language, userRole }) {
  const isManager = userRole === 'manager';
  const [period, setPeriod] = useState(defaultPeriod);
  const [schedule, setSchedule] = useState(null);
  const [mySchedule, setMySchedule] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [exchangeNotes, setExchangeNotes] = useState({});
  const [reassignEmployeeIds, setReassignEmployeeIds] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      titleManager: 'Генерация и публикация расписания',
      titleEmployee: 'Мое расписание',
      startDate: 'Начало периода',
      endDate: 'Конец периода',
      generate: 'Сгенерировать',
      publish: 'Опубликовать',
      status: 'Статус',
      reassign: 'Переназначить',
      remove: 'Удалить',
      noSchedule: 'Нет данных расписания.',
      loading: 'Загрузка...',
      unfilled: 'Незаполненные требования',
      shifts: 'Смены',
      send: 'Отправить',
      note: 'Комментарий',
      conflicts: 'Конфликты',
      empty: 'Нет данных',
      created: 'Операция выполнена.',
      missingStaff: 'Не хватает',
      draft: 'Черновик',
      published: 'Опубликовано',
    },
    en: {
      titleManager: 'Schedule generation and publishing',
      titleEmployee: 'My schedule',
      startDate: 'Start date',
      endDate: 'End date',
      generate: 'Generate',
      publish: 'Publish',
      status: 'Status',
      reassign: 'Reassign',
      remove: 'Remove',
      noSchedule: 'No schedule data.',
      loading: 'Loading...',
      unfilled: 'Unfilled requirements',
      shifts: 'Shifts',
      send: 'Send',
      note: 'Note',
      conflicts: 'Conflicts',
      empty: 'No data',
      created: 'Operation completed.',
      missingStaff: 'Missing',
      draft: 'Draft',
      published: 'Published',
    },
  };

  const t = texts[language] || texts.ru;

  const groupedMySchedule = useMemo(
    () => mySchedule.reduce((acc, shift) => {
      const key = shift.date;
      acc[key] = acc[key] || [];
      acc[key].push(shift);
      return acc;
    }, {}),
    [mySchedule]
  );

  const loadManagerData = async () => {
    const employeesData = await listEmployees();
    setEmployees(employeesData);
  };

  const loadEmployeeData = async () => {
    const shifts = await getMySchedule();
    setMySchedule(shifts);
  };

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
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsLoading(false);
    }
  }, [isManager, language]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleGenerate = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const generated = await generateSchedule(period);
      setSchedule(generated);
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!schedule) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const publishedSchedule = await publishSchedule(schedule.id);
      setSchedule(publishedSchedule);
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShiftAction = async (shiftId, action) => {
    if (!schedule) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const payload = action === 'remove'
        ? { action }
        : { action, employee_id: Number(reassignEmployeeIds[shiftId]) };
      const updatedSchedule = await updateShift(schedule.id, shiftId, payload);
      setSchedule(updatedSchedule);
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExchangeRequest = async (shiftId) => {
    const note = exchangeNotes[shiftId]?.trim();
    if (!note) {
      setErrorMessage(t.note);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await createExchangeRequest({ shift_id: shiftId, note });
      setExchangeNotes((prev) => ({ ...prev, [shiftId]: '' }));
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div style={styles.card}>{t.loading}</div>;
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>{isManager ? t.titleManager : t.titleEmployee}</h2>
      {errorMessage && <div style={styles.error}>{errorMessage}</div>}
      {successMessage && <div style={styles.success}>{successMessage}</div>}

      {isManager ? (
        <>
          <div style={styles.filters}>
            <label style={styles.filterLabel}>
              {t.startDate}
              <input
                type="date"
                value={period.start_date}
                onChange={(event) => setPeriod((prev) => ({ ...prev, start_date: event.target.value }))}
                style={styles.input}
              />
            </label>
            <label style={styles.filterLabel}>
              {t.endDate}
              <input
                type="date"
                value={period.end_date}
                onChange={(event) => setPeriod((prev) => ({ ...prev, end_date: event.target.value }))}
                style={styles.input}
              />
            </label>
            <button onClick={handleGenerate} style={styles.primaryButton} disabled={isSubmitting}>
              {t.generate}
            </button>
            {schedule?.status === 'draft' && (
              <button onClick={handlePublish} style={styles.secondaryButton} disabled={isSubmitting}>
                {t.publish}
              </button>
            )}
          </div>

          {!schedule ? (
            <p style={styles.emptyText}>{t.noSchedule}</p>
          ) : (
            <div style={styles.section}>
              <div style={styles.statusBadge}>
                {t.status}: {schedule.status === 'published' ? t.published : t.draft}
              </div>

              <h3 style={styles.sectionTitle}>{t.shifts}</h3>
              {schedule.shifts.length === 0 ? (
                <p style={styles.emptyText}>{t.empty}</p>
              ) : (
                <div style={styles.list}>
                  {schedule.shifts.map((shift) => (
                    <div key={shift.id} style={styles.listItem}>
                      <div style={styles.shiftInfo}>
                        <div style={styles.itemTitle}>{shift.employee_name}</div>
                        <div style={styles.itemMeta}>{shift.position}</div>
                        <div style={styles.itemMeta}>{shift.date}</div>
                        <div style={styles.itemMeta}>
                          {String(shift.start_time).slice(0, 5)} - {String(shift.end_time).slice(0, 5)}
                        </div>
                      </div>
                      <div style={styles.shiftActions}>
                        <select
                          value={reassignEmployeeIds[shift.id] || ''}
                          onChange={(event) => setReassignEmployeeIds((prev) => ({ ...prev, [shift.id]: event.target.value }))}
                          style={styles.input}
                        >
                          <option value="">{t.reassign}</option>
                          {employees
                            .filter((employee) => employee.position_id === shift.position_id)
                            .map((employee) => (
                              <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleShiftAction(shift.id, 'reassign')}
                          style={styles.primaryButton}
                          disabled={!reassignEmployeeIds[shift.id] || isSubmitting}
                        >
                          {t.reassign}
                        </button>
                        <button
                          onClick={() => handleShiftAction(shift.id, 'remove')}
                          style={styles.secondaryButton}
                          disabled={isSubmitting}
                        >
                          {t.remove}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={styles.sectionTitle}>{t.unfilled}</h3>
              {schedule.unfilled_requirements.length === 0 ? (
                <p style={styles.emptyText}>{t.empty}</p>
              ) : (
                <div style={styles.list}>
                  {schedule.unfilled_requirements.map((item) => (
                    <div key={item.requirement_id} style={styles.listItem}>
                      <div>
                        <div style={styles.itemTitle}>{item.position_title}</div>
                        <div style={styles.itemMeta}>{item.date}</div>
                        <div style={styles.itemMeta}>
                          {String(item.start_time).slice(0, 5)} - {String(item.end_time).slice(0, 5)}
                        </div>
                        <div style={styles.itemMeta}>{t.missingStaff}: {item.missing_staff}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={styles.sectionTitle}>{t.conflicts}</h3>
              {schedule.conflicts.length === 0 ? (
                <p style={styles.emptyText}>{t.empty}</p>
              ) : (
                <div style={styles.list}>
                  {schedule.conflicts.map((conflict) => (
                    <div key={`${conflict.employee_id}-${conflict.date}`} style={styles.listItem}>
                      <div>
                        <div style={styles.itemTitle}>{conflict.employee_name}</div>
                        <div style={styles.itemMeta}>{conflict.date}</div>
                        <div style={styles.itemMeta}>{localizeBackendMessage(conflict.message, language)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : mySchedule.length === 0 ? (
        <p style={styles.emptyText}>{t.noSchedule}</p>
      ) : (
        <div style={styles.section}>
          {Object.entries(groupedMySchedule).map(([date, shifts]) => (
            <div key={date} style={styles.dayBlock}>
              <h3 style={styles.sectionTitle}>{date}</h3>
              <div style={styles.list}>
                {shifts.map((shift) => (
                  <div key={shift.id} style={styles.listItem}>
                    <div style={styles.shiftInfo}>
                      <div style={styles.itemTitle}>{shift.position}</div>
                      <div style={styles.itemMeta}>
                        {String(shift.start_time).slice(0, 5)} - {String(shift.end_time).slice(0, 5)}
                      </div>
                    </div>
                    <div style={styles.exchangeBox}>
                      <textarea
                        value={exchangeNotes[shift.id] || ''}
                        onChange={(event) => setExchangeNotes((prev) => ({ ...prev, [shift.id]: event.target.value }))}
                        placeholder={t.note}
                        style={styles.textarea}
                      />
                      <button onClick={() => handleExchangeRequest(shift.id)} style={styles.primaryButton} disabled={isSubmitting}>
                        {t.send}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    margin: '0 0 8px',
    color: '#002642',
    fontSize: '24px',
  },
  filters: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    marginBottom: '18px',
  },
  filterLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#4F646F',
    fontWeight: '600',
    fontSize: '14px',
  },
  input: {
    minWidth: '180px',
    borderRadius: '12px',
    border: '2px solid #DEE7E7',
    background: '#FFFFFF',
    padding: '12px 14px',
    color: '#002642',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    minHeight: '70px',
    borderRadius: '12px',
    border: '2px solid #DEE7E7',
    background: '#FFFFFF',
    padding: '12px 14px',
    color: '#002642',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  primaryButton: {
    padding: '12px 18px',
    background: '#002642',
    border: 'none',
    borderRadius: '12px',
    color: '#F4FAFF',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '12px 18px',
    background: '#DEE7E7',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#FDEAEA',
    color: '#A61B1B',
  },
  success: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#E7F6EC',
    color: '#17663A',
  },
  emptyText: {
    margin: 0,
    color: '#4F646F',
  },
  section: {
    display: 'grid',
    gap: '18px',
  },
  sectionTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '18px',
  },
  statusBadge: {
    display: 'inline-flex',
    padding: '10px 14px',
    borderRadius: '999px',
    background: '#DEE7E7',
    color: '#002642',
    fontWeight: '700',
    marginBottom: '8px',
  },
  list: {
    display: 'grid',
    gap: '12px',
  },
  listItem: {
    padding: '16px',
    borderRadius: '16px',
    background: '#FFFFFF',
    border: '1px solid #DEE7E7',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  shiftInfo: {
    minWidth: '220px',
  },
  shiftActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  exchangeBox: {
    minWidth: '280px',
    flex: 1,
    display: 'grid',
    gap: '10px',
  },
  dayBlock: {
    display: 'grid',
    gap: '12px',
  },
  itemTitle: {
    fontWeight: '700',
    color: '#002642',
  },
  itemMeta: {
    color: '#4F646F',
    fontSize: '13px',
    marginTop: '4px',
  },
};
