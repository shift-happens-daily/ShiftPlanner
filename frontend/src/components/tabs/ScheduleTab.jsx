// frontend/src/components/tabs/ScheduleTab.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ScheduleTab({ language }) {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [editingShift, setEditingShift] = useState(null);
  const [editForm, setEditForm] = useState({ employee: '', position: '', startTime: '', endTime: '' });
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShift, setNewShift] = useState({ employee: '', position: '', startTime: '09:00', endTime: '17:00' });

  // Моковые данные сотрудников и позиций
  const employees = [
    { id: 1, name: 'Иван Петров', position: 'Бармен' },
    { id: 2, name: 'Анна Сидорова', position: 'Официант' },
    { id: 3, name: 'Петр Иванов', position: 'Повар' },
    { id: 4, name: 'Мария Кузнецова', position: 'Администратор' },
    { id: 5, name: 'Дмитрий Соколов', position: 'Бармен' },
    { id: 6, name: 'Елена Волкова', position: 'Официант' },
  ];

  // Моковые данные расписания
  useEffect(() => {
    const mockShifts = [
      { id: 1, date: '2026-06-15', employee: 'Иван Петров', position: 'Бармен', startTime: '09:00', endTime: '17:00', status: 'draft' },
      { id: 2, date: '2026-06-15', employee: 'Анна Сидорова', position: 'Официант', startTime: '14:00', endTime: '22:00', status: 'draft' },
      { id: 3, date: '2026-06-16', employee: 'Петр Иванов', position: 'Повар', startTime: '10:00', endTime: '18:00', status: 'published' },
      { id: 4, date: '2026-06-16', employee: 'Мария Кузнецова', position: 'Администратор', startTime: '09:00', endTime: '17:00', status: 'published' },
      { id: 5, date: '2026-06-17', employee: 'Дмитрий Соколов', position: 'Бармен', startTime: '12:00', endTime: '20:00', status: 'draft' },
      { id: 6, date: '2026-06-17', employee: 'Елена Волкова', position: 'Официант', startTime: '11:00', endTime: '19:00', status: 'draft' },
    ];
    setShifts(mockShifts);
  }, []);

  // Добавляем глобальные стили для адаптива
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @media (max-width: 768px) {
        .schedule-main-container {
          flex-direction: column !important;
          padding: 8px !important;
          gap: 12px !important;
        }
        .schedule-calendar-section, .schedule-right-section {
          min-width: 100% !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: 12px !important;
          margin: 0 !important;
          box-sizing: border-box !important;
        }
        .schedule-calendar-days {
          gap: 2px !important;
        }
        .schedule-calendar-day {
          padding: 6px 0 !important;
          font-size: 12px !important;
        }
        .schedule-week-day {
          font-size: 10px !important;
          padding: 4px 0 !important;
        }
        .schedule-table th, .schedule-table td {
          padding: 6px 4px !important;
          font-size: 10px !important;
        }
        .schedule-header {
          flex-direction: column !important;
          align-items: flex-start !important;
        }
        .schedule-action-buttons {
          flex-direction: column !important;
          width: 100% !important;
        }
        .schedule-action-buttons button {
          width: 100% !important;
        }
        .schedule-modal {
          width: 95% !important;
          margin: 10px !important;
          padding: 16px !important;
        }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const texts = {
    ru: {
      title: 'Расписание',
      selectDate: 'Выберите дату',
      employee: 'Сотрудник',
      position: 'Позиция',
      startTime: 'Начало',
      endTime: 'Конец',
      actions: 'Действия',
      edit: 'Изменить',
      delete: 'Удалить',
      save: 'Сохранить',
      publish: 'Опубликовать',
      addShift: '+ Добавить смену',
      cancel: 'Отмена',
      editShift: 'Редактирование смены',
      addNewShift: 'Новая смена',
      selectEmployee: 'Выберите сотрудника',
      selectPosition: 'Выберите позицию',
      noShifts: 'Нет смен на выбранную дату',
      published: 'Опубликовано',
      draft: 'Черновик'
    },
    en: {
      title: 'Schedule',
      selectDate: 'Select date',
      employee: 'Employee',
      position: 'Position',
      startTime: 'Start',
      endTime: 'End',
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      publish: 'Publish',
      addShift: '+ Add Shift',
      cancel: 'Cancel',
      editShift: 'Edit Shift',
      addNewShift: 'New Shift',
      selectEmployee: 'Select employee',
      selectPosition: 'Select position',
      noShifts: 'No shifts for selected date',
      published: 'Published',
      draft: 'Draft'
    }
  };

  const t = texts[language] || texts.ru;

  // Форматирование даты
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Получение смен для выбранной даты
  const getShiftsForDate = () => {
    const dateStr = formatDate(selectedDate);
    return shifts.filter(shift => shift.date === dateStr);
  };

  // Получение дней в месяце для календаря
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Смена месяца
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Получение статуса дня (есть ли смены)
  const getDayStatus = (day) => {
    const dateStr = formatDate(day);
    const dayShifts = shifts.filter(shift => shift.date === dateStr);
    if (dayShifts.length === 0) return '';
    if (dayShifts.some(shift => shift.status === 'published')) return 'published';
    return 'draft';
  };

  // Редактирование смены
  const handleEdit = (shift) => {
    setEditingShift(shift.id);
    setEditForm({
      employee: shift.employee,
      position: shift.position,
      startTime: shift.startTime,
      endTime: shift.endTime
    });
  };

  const handleSaveEdit = () => {
    setShifts(shifts.map(shift => 
      shift.id === editingShift 
        ? { ...shift, ...editForm }
        : shift
    ));
    setEditingShift(null);
    setEditForm({ employee: '', position: '', startTime: '', endTime: '' });
  };

  const handleCancelEdit = () => {
    setEditingShift(null);
    setEditForm({ employee: '', position: '', startTime: '', endTime: '' });
  };

  // Удаление смены
  const handleDelete = (id) => {
    if (window.confirm('Вы уверены, что хотите удалить эту смену?')) {
      setShifts(shifts.filter(shift => shift.id !== id));
    }
  };

  // Добавление новой смены
  const handleAddShift = () => {
    if (newShift.employee && newShift.startTime && newShift.endTime) {
      const newId = Math.max(...shifts.map(s => s.id), 0) + 1;
      setShifts([...shifts, {
        id: newId,
        date: formatDate(selectedDate),
        employee: newShift.employee,
        position: employees.find(e => e.name === newShift.employee)?.position || '',
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        status: 'draft'
      }]);
      setShowAddShift(false);
      setNewShift({ employee: '', position: '', startTime: '09:00', endTime: '17:00' });
    }
  };

  // Сохранение всех изменений
  const handleSaveAll = () => {
    alert('Все изменения сохранены!');
  };

  // Публикация расписания
  const handlePublish = () => {
    const dateStr = formatDate(selectedDate);
    setShifts(shifts.map(shift => 
      shift.date === dateStr ? { ...shift, status: 'published' } : shift
    ));
    alert('Расписание опубликовано!');
  };

  const currentShifts = getShiftsForDate();

  const inputStyle = {
    padding: '8px 12px',
    fontSize: '14px',
    color: '#002642',
    backgroundColor: '#FFFFFF',
    border: '2px solid #DEE7E7',
    borderRadius: '8px',
    outline: 'none',
    transition: 'all 0.3s ease',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div className="schedule-main-container" style={styles.container}>
      {/* Календарь */}
      <div className="schedule-calendar-section" style={styles.calendarSection}>
        <div style={styles.calendarHeader}>
          <button onClick={prevMonth} style={styles.monthNavBtn}>←</button>
          <h3 style={styles.calendarTitle}>
            {currentMonth.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={nextMonth} style={styles.monthNavBtn}>→</button>
        </div>
        <div style={styles.weekDays}>
          {weekDays.map(day => (
            <div key={day} className="schedule-week-day" style={styles.weekDay}>{day}</div>
          ))}
        </div>
        <div className="schedule-calendar-days" style={styles.calendarDays}>
          {days.map((day, index) => {
            const dayStatus = getDayStatus(day);
            const isSelected = formatDate(day) === formatDate(selectedDate);
            return (
              <div
                key={index}
                onClick={() => setSelectedDate(day)}
                className="schedule-calendar-day"
                style={{
                  ...styles.calendarDay,
                  // Выбранный день всегда синий (самый высокий приоритет)
                  ...(isSelected && styles.calendarDaySelected),
                  // Только если день НЕ выбран, показываем его статус
                  ...(!isSelected && dayStatus === 'published' && styles.calendarDayPublished),
                  ...(!isSelected && dayStatus === 'draft' && styles.calendarDayDraft)
                }}
              >
                {day.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Таблица расписания */}
      <div className="schedule-right-section" style={styles.scheduleSection}>
        <div className="schedule-header" style={styles.scheduleHeader}>
          <h3 style={styles.scheduleTitle}>
            {t.title} — {selectedDate.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
          </h3>
          {isManager && (
            <button onClick={() => setShowAddShift(true)} style={styles.addShiftBtn}>
              {t.addShift}
            </button>
          )}
        </div>

        <div style={styles.tableWrapper}>
          <table className="schedule-table" style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.employee}</th>
                <th style={styles.th}>{t.position}</th>
                <th style={styles.th}>{t.startTime}</th>
                <th style={styles.th}>{t.endTime}</th>
                {isManager && <th style={styles.th}>{t.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {currentShifts.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 5 : 4} style={styles.emptyCell}>
                    {t.noShifts}
                  </td>
                </tr>
              ) : (
                currentShifts.map(shift => (
                  <tr key={shift.id}>
                    {editingShift === shift.id ? (
                      <>
                        <td style={styles.td}>
                          <select
                            value={editForm.employee}
                            onChange={(e) => setEditForm({ ...editForm, employee: e.target.value })}
                            style={inputStyle}
                          >
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.name}>{emp.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={styles.td}>
                          <input
                            type="text"
                            value={editForm.position}
                            onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                            style={inputStyle}
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            type="time"
                            value={editForm.startTime}
                            onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                            style={inputStyle}
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            type="time"
                            value={editForm.endTime}
                            onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                            style={inputStyle}
                          />
                        </td>
                        {isManager && (
                          <td style={styles.td}>
                            <button onClick={handleSaveEdit} style={styles.saveBtn}>✓</button>
                            <button onClick={handleCancelEdit} style={styles.cancelBtn}>✗</button>
                          </td>
                        )}
                      </>
                    ) : (
                      <>
                        <td style={styles.td}>{shift.employee}</td>
                        <td style={styles.td}>{shift.position}</td>
                        <td style={styles.td}>{shift.startTime}</td>
                        <td style={styles.td}>{shift.endTime}</td>
                        {isManager && (
                          <td style={styles.td}>
                            <button onClick={() => handleEdit(shift)} style={styles.editBtn}>✏️</button>
                            <button onClick={() => handleDelete(shift.id)} style={styles.deleteBtn}>🗑️</button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Кнопки для менеджера */}
        {isManager && (
          <div className="schedule-action-buttons" style={styles.actionButtons}>
            <button onClick={handleSaveAll} style={styles.saveAllBtn}>
              {t.save}
            </button>
            <button onClick={handlePublish} style={styles.publishBtn}>
              {t.publish}
            </button>
          </div>
        )}
      </div>

      {/* Модальное окно для добавления смены */}
      {showAddShift && (
        <div style={styles.modalOverlay} onClick={() => setShowAddShift(false)}>
          <div className="schedule-modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{t.addNewShift}</h3>
            <div style={styles.modalForm}>
              <select
                value={newShift.employee}
                onChange={(e) => setNewShift({ ...newShift, employee: e.target.value })}
                style={inputStyle}
              >
                <option value="">{t.selectEmployee}</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
              <input
                type="time"
                value={newShift.startTime}
                onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                style={inputStyle}
              />
              <input
                type="time"
                value={newShift.endTime}
                onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                style={inputStyle}
              />
              <div style={styles.modalActions}>
                <button onClick={handleAddShift} style={styles.primaryBtn}>{t.save}</button>
                <button onClick={() => setShowAddShift(false)} style={styles.cancelBtn}>{t.cancel}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  calendarSection: {
    flex: '1',
    minWidth: '280px',
    maxWidth: '100%',
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    boxSizing: 'border-box'
  },
  calendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  monthNavBtn: {
    padding: '8px 12px',
    backgroundColor: '#DEE7E7',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  calendarTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#002642',
    margin: 0
  },
  weekDays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    marginBottom: '8px'
  },
  weekDay: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: '600',
    color: '#4F646F',
    padding: '8px 0'
  },
  calendarDays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px'
  },
  calendarDay: {
    textAlign: 'center',
    padding: '10px 0',
    fontSize: '14px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#F4FAFF'
  },
  calendarDaySelected: {
    backgroundColor: '#002642',
    color: '#F4FAFF'
  },
  calendarDayPublished: {
    backgroundColor: '#B7ADCF',
    color: '#002642'
  },
  calendarDayDraft: {
    border: '2px solid #B7ADCF'
  },
  scheduleSection: {
    flex: '2',
    minWidth: '400px',
    maxWidth: '100%',
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    boxSizing: 'border-box'
  },
  scheduleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  scheduleTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#002642',
    margin: 0
  },
  addShiftBtn: {
    padding: '8px 16px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '8px',
    color: '#F4FAFF',
    fontWeight: '500',
    cursor: 'pointer'
  },
  tableWrapper: {
    overflowX: 'auto',
    marginBottom: '20px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '500px'
  },
  th: {
    padding: '12px',
    backgroundColor: '#002642',
    color: '#F4FAFF',
    fontWeight: '600',
    fontSize: '13px',
    textAlign: 'center',
    borderBottom: '2px solid #B7ADCF'
  },
  td: {
    padding: '10px 12px',
    fontSize: '13px',
    color: '#002642',
    borderBottom: '1px solid #DEE7E7',
    textAlign: 'center'
  },
  emptyCell: {
    padding: '40px',
    textAlign: 'center',
    color: '#4F646F'
  },
  editBtn: {
    padding: '4px 8px',
    backgroundColor: '#DEE7E7',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginRight: '4px'
  },
  deleteBtn: {
    padding: '4px 8px',
    backgroundColor: '#FFEBEE',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  saveBtn: {
    padding: '4px 8px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '6px',
    color: '#F4FAFF',
    cursor: 'pointer',
    marginRight: '4px'
  },
  cancelBtn: {
    padding: '4px 8px',
    backgroundColor: '#DEE7E7',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '16px'
  },
  saveAllBtn: {
    padding: '10px 20px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '8px',
    color: '#F4FAFF',
    fontWeight: '500',
    cursor: 'pointer'
  },
  publishBtn: {
    padding: '10px 20px',
    backgroundColor: '#B7ADCF',
    border: 'none',
    borderRadius: '8px',
    color: '#002642',
    fontWeight: '500',
    cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '24px',
    width: '90%',
    maxWidth: '400px'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#002642',
    margin: '0 0 20px 0'
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '8px'
  },
  primaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '8px',
    color: '#F4FAFF',
    fontWeight: '500',
    cursor: 'pointer'
  }
};