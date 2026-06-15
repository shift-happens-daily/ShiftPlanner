import { useCallback, useEffect, useState } from 'react';
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

function createAvailabilityBlock() {
  return { weekday: 0, start_time: '09:00:00', end_time: '18:00:00' };
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
    requirements: [{ position_id: '', min_staff: 1, start_time: '09:00:00', end_time: '18:00:00' }],
  };
}

export default function ShiftsTab({ language, userRole, user }) {
  const isManager = userRole === 'manager';
  const [positions, setPositions] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [singleRequirement, setSingleRequirement] = useState(defaultSingleRequirement);
  const [bulkRequirement, setBulkRequirement] = useState(defaultBulkRequirement);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  });
  const [availabilityForm, setAvailabilityForm] = useState({
    weekly_availability: [],
    desired_days_off: [],
  });
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      titleManager: 'Настройки смен и требования',
      titleEmployee: 'Доступность и отсутствия',
      requirements: 'Требования к сменам',
      bulk: 'Массовое создание требований',
      import: 'Импорт требований из XLSX',
      position: 'Позиция',
      date: 'Дата',
      startDate: 'Начало периода',
      endDate: 'Конец периода',
      startTime: 'Начало',
      endTime: 'Окончание',
      minStaff: 'Минимум сотрудников',
      weekdays: 'Дни недели',
      upload: 'Загрузить файл',
      create: 'Создать',
      refresh: 'Обновить',
      save: 'Сохранить',
      availability: 'Моя доступность',
      desiredDaysOff: 'Желаемые выходные',
      absences: 'Мои отсутствия',
      addRow: 'Добавить интервал',
      addAbsence: 'Добавить отсутствие',
      empty: 'Нет данных',
      loading: 'Загрузка...',
      fileHint: 'Поддерживается только .xlsx. Загрузка идет напрямую в backend.',
      created: 'Операция выполнена.',
      importDone: 'Импорт завершен.',
      vacation: 'Отпуск',
      sick_leave: 'Больничный',
      other: 'Другое',
      delete: 'Удалить',
      shifts: 'Смены из календарной сводки',
      hours: 'Часы',
      totalShifts: 'Смены',
      importErrors: 'Ошибки импорта',
      xlsxOnly: 'Поддерживается только .xlsx.',
      row: 'Строка',
      draft: 'Черновик',
      published: 'Опубликовано',
    },
    en: {
      titleManager: 'Shift setup and requirements',
      titleEmployee: 'Availability and absences',
      requirements: 'Shift requirements',
      bulk: 'Bulk requirements',
      import: 'Import requirements from XLSX',
      position: 'Position',
      date: 'Date',
      startDate: 'Start date',
      endDate: 'End date',
      startTime: 'Start time',
      endTime: 'End time',
      minStaff: 'Minimum staff',
      weekdays: 'Weekdays',
      upload: 'Upload file',
      create: 'Create',
      refresh: 'Refresh',
      save: 'Save',
      availability: 'My availability',
      desiredDaysOff: 'Desired days off',
      absences: 'My absences',
      addRow: 'Add interval',
      addAbsence: 'Add absence',
      empty: 'No data',
      loading: 'Loading...',
      fileHint: 'Only .xlsx is supported. The file is sent directly to the backend.',
      created: 'Operation completed.',
      importDone: 'Import completed.',
      vacation: 'Vacation',
      sick_leave: 'Sick leave',
      other: 'Other',
      delete: 'Delete',
      shifts: 'Shifts from calendar summary',
      hours: 'Hours',
      totalShifts: 'Shifts',
      importErrors: 'Import errors',
      xlsxOnly: 'Only .xlsx is supported.',
      row: 'Row',
      draft: 'Draft',
      published: 'Published',
    },
  };

  const t = texts[language] || texts.ru;

  const loadManagerData = useCallback(async () => {
    const [positionsData, requirementsData] = await Promise.all([
      listPositions(),
      listRequirements(filters),
    ]);
    setPositions(positionsData);
    setRequirements(requirementsData);
    setSingleRequirement((prev) => ({
      ...prev,
      position_id: prev.position_id || String(positionsData[0]?.id || ''),
    }));
    setBulkRequirement((prev) => ({
      ...prev,
      requirements: prev.requirements.map((item) => ({
        ...item,
        position_id: item.position_id || String(positionsData[0]?.id || ''),
      })),
    }));
  }, [filters]);

  const loadEmployeeData = useCallback(async () => {
    if (!user?.employeeId) {
      setAvailabilityForm({ weekly_availability: [], desired_days_off: [] });
      setAbsences([]);
      setSummary(null);
      return;
    }

    const [availabilityData, absencesData, summaryData] = await Promise.all([
      getEmployeeAvailability(user.employeeId),
      getMyAbsences(),
      getMyCalendarSummary(),
    ]);

    setAvailabilityForm({
      weekly_availability: availabilityData.weekly_availability,
      desired_days_off: availabilityData.desired_days_off,
    });
    setAbsences(absencesData);
    setSummary(mapEmployeeCalendarSummary(summaryData));
  }, [user]);

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
  }, [isManager, language, loadEmployeeData, loadManagerData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const submitManagerRequirement = async () => {
    if (!singleRequirement.position_id || !singleRequirement.date) {
      setErrorMessage(t.requirements);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await createRequirement({
        ...singleRequirement,
        position_id: Number(singleRequirement.position_id),
        min_staff: Number(singleRequirement.min_staff),
      });
      await loadManagerData();
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitBulkRequirements = async () => {
    if (!bulkRequirement.requirements[0]?.position_id) {
      setErrorMessage(t.bulk);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
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
      await loadManagerData();
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitImport = async () => {
    if (!selectedFile) {
      setErrorMessage(t.import);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMessage(t.xlsxOnly);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setImportResult(null);
    setIsSubmitting(true);
    try {
      const result = await importRequirementsXlsx(selectedFile);
      setImportResult(result);
      await loadManagerData();
      setSuccessMessage(t.importDone);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitAvailability = async () => {
    if (!user?.employeeId) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await updateEmployeeAvailability(user.employeeId, availabilityForm);
      await loadEmployeeData();
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitAbsence = async () => {
    if (!user?.employeeId || !absenceForm.start_date || !absenceForm.end_date) {
      setErrorMessage(t.addAbsence);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await createEmployeeAbsence(user.employeeId, absenceForm);
      setAbsenceForm({ absence_type: 'vacation', start_date: '', end_date: '', comment: '' });
      await loadEmployeeData();
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeAbsence = async (absenceId) => {
    if (!user?.employeeId) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await deleteEmployeeAbsence(user.employeeId, absenceId);
      await loadEmployeeData();
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
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>{isManager ? t.titleManager : t.titleEmployee}</h2>
        {errorMessage && <div style={styles.error}>{errorMessage}</div>}
        {successMessage && <div style={styles.success}>{successMessage}</div>}

        {isManager ? (
          <>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.requirements}</h3>
              <div style={styles.formGrid}>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(event) => setFilters((prev) => ({ ...prev, start_date: event.target.value }))}
                  style={styles.input}
                />
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value }))}
                  style={styles.input}
                />
                <button onClick={loadData} style={styles.secondaryButton}>{t.refresh}</button>
              </div>

              <div style={styles.formGrid}>
                <select
                  value={singleRequirement.position_id}
                  onChange={(event) => setSingleRequirement((prev) => ({ ...prev, position_id: event.target.value }))}
                  style={styles.input}
                >
                  <option value="">{t.position}</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>{position.title}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={singleRequirement.date}
                  onChange={(event) => setSingleRequirement((prev) => ({ ...prev, date: event.target.value }))}
                  style={styles.input}
                />
                <input
                  type="number"
                  min="1"
                  value={singleRequirement.min_staff}
                  onChange={(event) => setSingleRequirement((prev) => ({ ...prev, min_staff: event.target.value }))}
                  style={styles.input}
                />
                <input
                  type="time"
                  value={singleRequirement.start_time.slice(0, 5)}
                  onChange={(event) => setSingleRequirement((prev) => ({ ...prev, start_time: `${event.target.value}:00` }))}
                  style={styles.input}
                />
                <input
                  type="time"
                  value={singleRequirement.end_time.slice(0, 5)}
                  onChange={(event) => setSingleRequirement((prev) => ({ ...prev, end_time: `${event.target.value}:00` }))}
                  style={styles.input}
                />
                <button onClick={submitManagerRequirement} style={styles.primaryButton} disabled={isSubmitting}>
                  {t.create}
                </button>
              </div>

              {requirements.length === 0 ? (
                <p style={styles.emptyText}>{t.empty}</p>
              ) : (
                <div style={styles.list}>
                  {requirements.map((requirement) => (
                    <div key={requirement.id} style={styles.listItem}>
                      <div style={styles.itemTitle}>{requirement.position_title}</div>
                      <div style={styles.itemMeta}>{requirement.date}</div>
                      <div style={styles.itemMeta}>
                        {String(requirement.start_time).slice(0, 5)} - {String(requirement.end_time).slice(0, 5)}
                      </div>
                      <div style={styles.itemMeta}>{t.minStaff}: {requirement.min_staff}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.bulk}</h3>
              <div style={styles.formGrid}>
                <input
                  type="date"
                  value={bulkRequirement.start_date}
                  onChange={(event) => setBulkRequirement((prev) => ({ ...prev, start_date: event.target.value }))}
                  style={styles.input}
                />
                <input
                  type="date"
                  value={bulkRequirement.end_date}
                  onChange={(event) => setBulkRequirement((prev) => ({ ...prev, end_date: event.target.value }))}
                  style={styles.input}
                />
                <select
                  value={bulkRequirement.requirements[0].position_id}
                  onChange={(event) => setBulkRequirement((prev) => ({
                    ...prev,
                    requirements: [{ ...prev.requirements[0], position_id: event.target.value }],
                  }))}
                  style={styles.input}
                >
                  <option value="">{t.position}</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>{position.title}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={bulkRequirement.requirements[0].min_staff}
                  onChange={(event) => setBulkRequirement((prev) => ({
                    ...prev,
                    requirements: [{ ...prev.requirements[0], min_staff: event.target.value }],
                  }))}
                  style={styles.input}
                />
                <input
                  type="time"
                  value={bulkRequirement.requirements[0].start_time.slice(0, 5)}
                  onChange={(event) => setBulkRequirement((prev) => ({
                    ...prev,
                    requirements: [{ ...prev.requirements[0], start_time: `${event.target.value}:00` }],
                  }))}
                  style={styles.input}
                />
                <input
                  type="time"
                  value={bulkRequirement.requirements[0].end_time.slice(0, 5)}
                  onChange={(event) => setBulkRequirement((prev) => ({
                    ...prev,
                    requirements: [{ ...prev.requirements[0], end_time: `${event.target.value}:00` }],
                  }))}
                  style={styles.input}
                />
              </div>
              <div style={styles.checkboxRow}>
                {WEEKDAYS.map((day) => (
                  <label key={day.value} style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={bulkRequirement.weekdays.includes(day.value)}
                      onChange={() => setBulkRequirement((prev) => ({
                        ...prev,
                        weekdays: prev.weekdays.includes(day.value)
                          ? prev.weekdays.filter((value) => value !== day.value)
                          : [...prev.weekdays, day.value].sort((a, b) => a - b),
                      }))}
                    />
                    {day[language] || day.ru}
                  </label>
                ))}
              </div>
              <button onClick={submitBulkRequirements} style={styles.primaryButton} disabled={isSubmitting}>
                {t.create}
              </button>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.import}</h3>
              <p style={styles.hint}>{t.fileHint}</p>
              <div style={styles.formGrid}>
                <input type="file" accept=".xlsx" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
                <button onClick={submitImport} style={styles.primaryButton} disabled={isSubmitting}>
                  {t.upload}
                </button>
              </div>
              {importResult && (
                <div style={styles.importBox}>
                  <div>{t.create}: {importResult.created_count}</div>
                  {importResult.errors.length > 0 && (
                    <div style={styles.importErrors}>
                      <div style={styles.itemTitle}>{t.importErrors}</div>
                      {importResult.errors.map((item, index) => (
                        <div key={`${item.row}-${index}`} style={styles.itemMeta}>
                          {t.row} {item.row}: {localizeBackendMessage(item.message, language)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.availability}</h3>
              {availabilityForm.weekly_availability.map((block, index) => (
                <div key={`${block.weekday}-${index}`} style={styles.formGrid}>
                  <select
                    value={block.weekday}
                    onChange={(event) => setAvailabilityForm((prev) => ({
                      ...prev,
                      weekly_availability: prev.weekly_availability.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, weekday: Number(event.target.value) } : item
                      )),
                    }))}
                    style={styles.input}
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>{day[language] || day.ru}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={String(block.start_time).slice(0, 5)}
                    onChange={(event) => setAvailabilityForm((prev) => ({
                      ...prev,
                      weekly_availability: prev.weekly_availability.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, start_time: `${event.target.value}:00` } : item
                      )),
                    }))}
                    style={styles.input}
                  />
                  <input
                    type="time"
                    value={String(block.end_time).slice(0, 5)}
                    onChange={(event) => setAvailabilityForm((prev) => ({
                      ...prev,
                      weekly_availability: prev.weekly_availability.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, end_time: `${event.target.value}:00` } : item
                      )),
                    }))}
                    style={styles.input}
                  />
                  <button
                    onClick={() => setAvailabilityForm((prev) => ({
                      ...prev,
                      weekly_availability: prev.weekly_availability.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                    style={styles.secondaryButton}
                  >
                    {t.delete}
                  </button>
                </div>
              ))}

              <div style={styles.checkboxRow}>
                {WEEKDAYS.map((day) => (
                  <label key={day.value} style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={availabilityForm.desired_days_off.includes(day.value)}
                      onChange={() => setAvailabilityForm((prev) => ({
                        ...prev,
                        desired_days_off: prev.desired_days_off.includes(day.value)
                          ? prev.desired_days_off.filter((value) => value !== day.value)
                          : [...prev.desired_days_off, day.value].sort((a, b) => a - b),
                      }))}
                    />
                    {day[language] || day.ru}
                  </label>
                ))}
              </div>

              <div style={styles.buttonRow}>
                <button
                  onClick={() => setAvailabilityForm((prev) => ({
                    ...prev,
                    weekly_availability: [...prev.weekly_availability, createAvailabilityBlock()],
                  }))}
                  style={styles.secondaryButton}
                >
                  {t.addRow}
                </button>
                <button onClick={submitAvailability} style={styles.primaryButton} disabled={isSubmitting}>
                  {t.save}
                </button>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.absences}</h3>
              <div style={styles.formGrid}>
                <select
                  value={absenceForm.absence_type}
                  onChange={(event) => setAbsenceForm((prev) => ({ ...prev, absence_type: event.target.value }))}
                  style={styles.input}
                >
                  <option value="vacation">{t.vacation}</option>
                  <option value="sick_leave">{t.sick_leave}</option>
                  <option value="other">{t.other}</option>
                </select>
                <input
                  type="date"
                  value={absenceForm.start_date}
                  onChange={(event) => setAbsenceForm((prev) => ({ ...prev, start_date: event.target.value }))}
                  style={styles.input}
                />
                <input
                  type="date"
                  value={absenceForm.end_date}
                  onChange={(event) => setAbsenceForm((prev) => ({ ...prev, end_date: event.target.value }))}
                  style={styles.input}
                />
                <input
                  value={absenceForm.comment}
                  onChange={(event) => setAbsenceForm((prev) => ({ ...prev, comment: event.target.value }))}
                  placeholder={t.other}
                  style={styles.input}
                />
                <button onClick={submitAbsence} style={styles.primaryButton} disabled={isSubmitting}>
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
                        <div style={styles.itemTitle}>{t[absence.absence_type] || absence.absence_type}</div>
                        <div style={styles.itemMeta}>{absence.start_date} - {absence.end_date}</div>
                        {absence.comment && <div style={styles.itemMeta}>{absence.comment}</div>}
                      </div>
                      <button onClick={() => removeAbsence(absence.id)} style={styles.secondaryButton}>
                        {t.delete}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.shifts}</h3>
              {summary ? (
                <>
                  <div style={styles.itemMeta}>{t.totalShifts}: {summary.workload.total_shifts}</div>
                  <div style={styles.itemMeta}>{t.hours}: {summary.workload.total_hours}</div>
                  {summary.shifts.length === 0 ? (
                    <p style={styles.emptyText}>{t.empty}</p>
                  ) : (
                    <div style={styles.list}>
                      {summary.shifts.map((shift) => (
                        <div key={`${shift.schedule_id}-${shift.shift_id}`} style={styles.listItem}>
                          <div>
                            <div style={styles.itemTitle}>{shift.date}</div>
                            <div style={styles.itemMeta}>
                              {String(shift.start_time).slice(0, 5)} - {String(shift.end_time).slice(0, 5)}
                            </div>
                            <div style={styles.itemMeta}>{t[shift.status] || localizeBackendMessage(shift.status, language)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p style={styles.emptyText}>{t.empty}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
  },
  title: {
    margin: '0 0 8px',
    color: '#002642',
    fontSize: '24px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '20px',
  },
  sectionTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '18px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '2px solid #DEE7E7',
    background: '#FFFFFF',
    padding: '12px 14px',
    color: '#002642',
    fontSize: '14px',
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
    padding: '10px 14px',
    background: '#DEE7E7',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '600',
    cursor: 'pointer',
  },
  checkboxRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#002642',
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  list: {
    display: 'grid',
    gap: '10px',
  },
  listItem: {
    padding: '14px 16px',
    borderRadius: '16px',
    background: '#FFFFFF',
    border: '1px solid #DEE7E7',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
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
  importBox: {
    padding: '16px',
    borderRadius: '16px',
    background: '#FFFFFF',
    border: '1px solid #DEE7E7',
  },
  importErrors: {
    marginTop: '12px',
  },
  hint: {
    margin: 0,
    color: '#4F646F',
    fontSize: '14px',
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
};
