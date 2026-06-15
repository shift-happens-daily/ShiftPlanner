import { useEffect, useMemo, useState } from 'react';
import {
  createEmployee,
  createEmployeeAbsence,
  deleteEmployeeAbsence,
  getEmployeeAvailability,
  getEmployeeCalendarSummary,
  listEmployeeAbsences,
  listEmployees,
  updateEmployeeAvailability,
} from '../../services/employeeService';
import { extractApiErrorMessage, localizeBackendMessage } from '../../services/error';
import { mapEmployeeCalendarSummary } from '../../services/mappers';
import { createPosition, listPositions } from '../../services/positionService';

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

export default function EmployeesTab({ language, userRole }) {
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [availabilityForm, setAvailabilityForm] = useState({
    weekly_availability: [],
    desired_days_off: [],
  });
  const [employeeAbsences, setEmployeeAbsences] = useState([]);
  const [employeeSummary, setEmployeeSummary] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    position_id: '',
  });
  const [positionTitle, setPositionTitle] = useState('');
  const [absenceForm, setAbsenceForm] = useState({
    absence_type: 'vacation',
    start_date: '',
    end_date: '',
    comment: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      title: 'Сотрудники и позиции',
      employees: 'Сотрудники',
      positions: 'Позиции',
      availability: 'Доступность',
      desiredDaysOff: 'Желаемые выходные',
      absences: 'Отсутствия',
      workload: 'Нагрузка',
      shifts: 'Смены',
      totalHours: 'Часы',
      totalShifts: 'Смены',
      createEmployee: 'Создать сотрудника',
      createPosition: 'Создать позицию',
      fullName: 'Имя и фамилия',
      email: 'Email',
      position: 'Позиция',
      save: 'Сохранить',
      addRow: 'Добавить интервал',
      addAbsence: 'Добавить отсутствие',
      type: 'Тип',
      startDate: 'Начало',
      endDate: 'Окончание',
      comment: 'Комментарий',
      empty: 'Нет данных',
      loading: 'Загрузка...',
      selectEmployee: 'Выберите сотрудника',
      vacation: 'Отпуск',
      sick_leave: 'Больничный',
      other: 'Другое',
      created: 'Данные сохранены.',
      managerOnly: 'Раздел доступен менеджеру.',
      delete: 'Удалить',
      draft: 'Черновик',
      published: 'Опубликовано',
    },
    en: {
      title: 'Employees and positions',
      employees: 'Employees',
      positions: 'Positions',
      availability: 'Availability',
      desiredDaysOff: 'Desired days off',
      absences: 'Absences',
      workload: 'Workload',
      shifts: 'Shifts',
      totalHours: 'Hours',
      totalShifts: 'Shifts',
      createEmployee: 'Create employee',
      createPosition: 'Create position',
      fullName: 'Full name',
      email: 'Email',
      position: 'Position',
      save: 'Save',
      addRow: 'Add interval',
      addAbsence: 'Add absence',
      type: 'Type',
      startDate: 'Start date',
      endDate: 'End date',
      comment: 'Comment',
      empty: 'No data',
      loading: 'Loading...',
      selectEmployee: 'Select employee',
      vacation: 'Vacation',
      sick_leave: 'Sick leave',
      other: 'Other',
      created: 'Data saved.',
      managerOnly: 'Manager access only.',
      delete: 'Delete',
      draft: 'Draft',
      published: 'Published',
    },
  };

  const t = texts[language] || texts.ru;

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(selectedEmployeeId)),
    [employees, selectedEmployeeId]
  );

  useEffect(() => {
    if (userRole !== 'manager') {
      return undefined;
    }

    let isMounted = true;

    async function bootstrap() {
      setIsLoading(true);
      try {
        const [employeesData, positionsData] = await Promise.all([
          listEmployees(),
          listPositions(),
        ]);

        if (!isMounted) {
          return;
        }

        setEmployees(employeesData);
        setPositions(positionsData);
        if (employeesData[0]) {
          setSelectedEmployeeId(String(employeesData[0].id));
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(extractApiErrorMessage(error, null, language));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      isMounted = false;
    };
  }, [language, userRole]);

  useEffect(() => {
    if (!selectedEmployeeId || userRole !== 'manager') {
      return undefined;
    }

    let isMounted = true;

    async function loadDetails() {
      setIsDetailsLoading(true);
      setErrorMessage('');
      try {
        const [availabilityData, absencesData, summaryData] = await Promise.all([
          getEmployeeAvailability(selectedEmployeeId),
          listEmployeeAbsences(selectedEmployeeId),
          getEmployeeCalendarSummary(selectedEmployeeId),
        ]);

        if (!isMounted) {
          return;
        }

        setAvailabilityForm({
          weekly_availability: availabilityData.weekly_availability.length
            ? availabilityData.weekly_availability
            : [],
          desired_days_off: availabilityData.desired_days_off || [],
        });
        setEmployeeAbsences(absencesData);
        setEmployeeSummary(mapEmployeeCalendarSummary(summaryData));
      } catch (error) {
        if (isMounted) {
          setErrorMessage(extractApiErrorMessage(error, null, language));
        }
      } finally {
        if (isMounted) {
          setIsDetailsLoading(false);
        }
      }
    }

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [language, selectedEmployeeId, userRole]);

  if (userRole !== 'manager') {
    return <div style={styles.card}>{t.managerOnly}</div>;
  }

  const reloadEmployees = async (preferEmployeeId) => {
    const employeesData = await listEmployees();
    setEmployees(employeesData);
    if (preferEmployeeId) {
      setSelectedEmployeeId(String(preferEmployeeId));
    } else if (!employeesData.some((employee) => String(employee.id) === String(selectedEmployeeId))) {
      setSelectedEmployeeId(employeesData[0] ? String(employeesData[0].id) : '');
    }
  };

  const reloadPositions = async () => {
    const positionsData = await listPositions();
    setPositions(positionsData);
  };

  const handleCreatePosition = async () => {
    if (!positionTitle.trim()) {
      setErrorMessage(t.position);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await createPosition({ title: positionTitle.trim() });
      await reloadPositions();
      setPositionTitle('');
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEmployee = async () => {
    if (!employeeForm.full_name.trim() || !employeeForm.email.trim() || !employeeForm.position_id) {
      setErrorMessage(t.createEmployee);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const createdEmployee = await createEmployee({
        full_name: employeeForm.full_name.trim(),
        email: employeeForm.email.trim(),
        position_id: Number(employeeForm.position_id),
      });
      await reloadEmployees(createdEmployee.id);
      setEmployeeForm({ full_name: '', email: '', position_id: '' });
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvailabilityChange = (index, key, value) => {
    setAvailabilityForm((prev) => ({
      ...prev,
      weekly_availability: prev.weekly_availability.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    }));
  };

  const handleSaveAvailability = async () => {
    if (!selectedEmployeeId) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await updateEmployeeAvailability(selectedEmployeeId, availabilityForm);
      const [availabilityData, summaryData] = await Promise.all([
        getEmployeeAvailability(selectedEmployeeId),
        getEmployeeCalendarSummary(selectedEmployeeId),
      ]);
      setAvailabilityForm({
        weekly_availability: availabilityData.weekly_availability,
        desired_days_off: availabilityData.desired_days_off,
      });
      setEmployeeSummary(mapEmployeeCalendarSummary(summaryData));
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAbsence = async () => {
    if (!selectedEmployeeId || !absenceForm.start_date || !absenceForm.end_date) {
      setErrorMessage(t.addAbsence);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await createEmployeeAbsence(selectedEmployeeId, absenceForm);
      const [absencesData, summaryData] = await Promise.all([
        listEmployeeAbsences(selectedEmployeeId),
        getEmployeeCalendarSummary(selectedEmployeeId),
      ]);
      setEmployeeAbsences(absencesData);
      setEmployeeSummary(mapEmployeeCalendarSummary(summaryData));
      setAbsenceForm({ absence_type: 'vacation', start_date: '', end_date: '', comment: '' });
      setSuccessMessage(t.created);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAbsence = async (absenceId) => {
    if (!selectedEmployeeId) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await deleteEmployeeAbsence(selectedEmployeeId, absenceId);
      const [absencesData, summaryData] = await Promise.all([
        listEmployeeAbsences(selectedEmployeeId),
        getEmployeeCalendarSummary(selectedEmployeeId),
      ]);
      setEmployeeAbsences(absencesData);
      setEmployeeSummary(mapEmployeeCalendarSummary(summaryData));
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
        <h2 style={styles.title}>{t.title}</h2>
        {errorMessage && <div style={styles.error}>{errorMessage}</div>}
        {successMessage && <div style={styles.success}>{successMessage}</div>}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>{t.createPosition}</h3>
          <div style={styles.inlineForm}>
            <input
              value={positionTitle}
              onChange={(event) => setPositionTitle(event.target.value)}
              placeholder={t.position}
              style={styles.input}
            />
            <button onClick={handleCreatePosition} style={styles.primaryButton} disabled={isSubmitting}>
              {t.save}
            </button>
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>{t.createEmployee}</h3>
          <div style={styles.formGrid}>
            <input
              value={employeeForm.full_name}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, full_name: event.target.value }))}
              placeholder={t.fullName}
              style={styles.input}
            />
            <input
              value={employeeForm.email}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder={t.email}
              style={styles.input}
            />
            <select
              value={employeeForm.position_id}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, position_id: event.target.value }))}
              style={styles.input}
            >
              <option value="">{t.selectEmployee}</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>{position.title}</option>
              ))}
            </select>
            <button onClick={handleCreateEmployee} style={styles.primaryButton} disabled={isSubmitting}>
              {t.save}
            </button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>{t.employees}</h3>
          <select
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            style={styles.input}
          >
            <option value="">{t.selectEmployee}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name} ({employee.position_title})
              </option>
            ))}
          </select>
        </div>

        {!selectedEmployee ? (
          <p style={styles.emptyText}>{t.empty}</p>
        ) : isDetailsLoading ? (
          <p style={styles.emptyText}>{t.loading}</p>
        ) : (
          <div style={styles.detailsGrid}>
            <div style={styles.infoBox}>
              <div style={styles.infoLine}><strong>{t.fullName}:</strong> {selectedEmployee.full_name}</div>
              <div style={styles.infoLine}><strong>{t.email}:</strong> {selectedEmployee.email}</div>
              <div style={styles.infoLine}><strong>{t.position}:</strong> {selectedEmployee.position_title}</div>
            </div>

            <div style={styles.section}>
              <h4 style={styles.subTitle}>{t.availability}</h4>
              {availabilityForm.weekly_availability.map((block, index) => (
                <div key={`${block.weekday}-${index}`} style={styles.availabilityRow}>
                  <select
                    value={block.weekday}
                    onChange={(event) => handleAvailabilityChange(index, 'weekday', Number(event.target.value))}
                    style={styles.input}
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>{day[language] || day.ru}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={String(block.start_time).slice(0, 5)}
                    onChange={(event) => handleAvailabilityChange(index, 'start_time', `${event.target.value}:00`)}
                    style={styles.input}
                  />
                  <input
                    type="time"
                    value={String(block.end_time).slice(0, 5)}
                    onChange={(event) => handleAvailabilityChange(index, 'end_time', `${event.target.value}:00`)}
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
                <button onClick={handleSaveAvailability} style={styles.primaryButton} disabled={isSubmitting}>
                  {t.save}
                </button>
              </div>
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
            </div>

            <div style={styles.section}>
              <h4 style={styles.subTitle}>{t.absences}</h4>
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
                  placeholder={t.comment}
                  style={styles.input}
                />
                <button onClick={handleCreateAbsence} style={styles.primaryButton} disabled={isSubmitting}>
                  {t.addAbsence}
                </button>
              </div>
              {employeeAbsences.length === 0 ? (
                <p style={styles.emptyText}>{t.empty}</p>
              ) : (
                <div style={styles.list}>
                  {employeeAbsences.map((absence) => (
                    <div key={absence.id} style={styles.listItem}>
                      <div>
                        <div style={styles.itemTitle}>{t[absence.absence_type] || absence.absence_type}</div>
                        <div style={styles.itemMeta}>{absence.start_date} - {absence.end_date}</div>
                        {absence.comment && <div style={styles.itemMeta}>{absence.comment}</div>}
                      </div>
                      <button onClick={() => handleDeleteAbsence(absence.id)} style={styles.secondaryButton}>
                        {t.delete}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.section}>
              <h4 style={styles.subTitle}>{t.workload}</h4>
              {employeeSummary ? (
                <>
                  <div style={styles.infoLine}><strong>{t.totalShifts}:</strong> {employeeSummary.workload.total_shifts}</div>
                  <div style={styles.infoLine}><strong>{t.totalHours}:</strong> {employeeSummary.workload.total_hours}</div>
                  <h4 style={styles.subTitle}>{t.shifts}</h4>
                  {employeeSummary.shifts.length === 0 ? (
                    <p style={styles.emptyText}>{t.empty}</p>
                  ) : (
                    <div style={styles.list}>
                      {employeeSummary.shifts.map((shift) => (
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
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'grid',
    gap: '20px',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
  },
  title: {
    fontSize: '24px',
    color: '#002642',
    margin: '0 0 8px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '18px',
  },
  sectionHeader: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  sectionTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '18px',
  },
  subTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '16px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  inlineForm: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
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
  detailsGrid: {
    display: 'grid',
    gap: '18px',
  },
  infoBox: {
    padding: '16px',
    borderRadius: '16px',
    background: '#FFFFFF',
    border: '1px solid #DEE7E7',
  },
  infoLine: {
    color: '#002642',
    marginBottom: '8px',
  },
  availabilityRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
  },
  checkboxRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#002642',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
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
    alignItems: 'center',
    flexWrap: 'wrap',
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
    color: '#4F646F',
    margin: 0,
  },
};
