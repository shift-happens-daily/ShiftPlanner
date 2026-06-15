// frontend/src/components/tabs/ShiftsTab.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ShiftsTab({ language }) {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  
  // Состояния
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [requirements, setRequirements] = useState([]);
  const [generalSettings, setGeneralSettings] = useState({
    maxShiftsPerWeek: 5,
    minBreakHours: 12,
    shiftDuration: 8
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  
  // Доступность сотрудника (по часам)
  const [hourlyAvailability, setHourlyAvailability] = useState({});
  
  // Запросы на выходной (общие для всех)
  const [dayOffRequests, setDayOffRequests] = useState([]);
  const [showDayOffModal, setShowDayOffModal] = useState(false);
  const [newDayOff, setNewDayOff] = useState({ date: '', reason: '' });

  // Предпочтения сотрудника
  const [preferences, setPreferences] = useState({
    morning: false,
    afternoon: false,
    evening: false
  });

  // Часы для выбора доступности (09:00 - 22:00)
  const hours = Array.from({ length: 14 }, (_, i) => i + 9); // 9,10,11...22

  // Моковые данные для требований (менеджер)
  useEffect(() => {
    const mockRequirements = [
      { id: 1, date: '2026-06-15', position: 'Бармен', minCount: 2, currentCount: 1, isMet: false },
      { id: 2, date: '2026-06-15', position: 'Официант', minCount: 3, currentCount: 2, isMet: false },
      { id: 3, date: '2026-06-15', position: 'Повар', minCount: 2, currentCount: 2, isMet: true },
      { id: 4, date: '2026-06-16', position: 'Бармен', minCount: 2, currentCount: 2, isMet: true },
      { id: 5, date: '2026-06-16', position: 'Официант', minCount: 3, currentCount: 3, isMet: true },
      { id: 6, date: '2026-06-17', position: 'Бармен', minCount: 2, currentCount: 0, isMet: false },
    ];
    setRequirements(mockRequirements);
  }, []);

  // Загрузка запросов на выходной из localStorage
  useEffect(() => {
    const savedRequests = localStorage.getItem('dayOffRequests');
    if (savedRequests) {
      setDayOffRequests(JSON.parse(savedRequests));
    } else {
      // Моковые данные для примера
      const mockRequests = [
        { id: 1, userId: 2, userName: 'Анна Сидорова', date: '2026-06-20', reason: 'Семейные обстоятельства', status: 'pending', createdAt: '2026-06-10' },
        { id: 2, userId: 3, userName: 'Петр Иванов', date: '2026-06-21', reason: 'Болезнь', status: 'approved', createdAt: '2026-06-09' },
      ];
      setDayOffRequests(mockRequests);
      localStorage.setItem('dayOffRequests', JSON.stringify(mockRequests));
    }
  }, []);

  // Загрузка доступности сотрудника из localStorage
  useEffect(() => {
    if (!isManager) {
      const savedAvailability = localStorage.getItem(`availability_${user?.id}`);
      if (savedAvailability) {
        setHourlyAvailability(JSON.parse(savedAvailability));
      }
    }
  }, [isManager, user?.id]);

  // Добавляем глобальные стили для адаптива
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @media (max-width: 768px) {
        .shifts-main-container {
          flex-direction: column !important;
          padding: 8px !important;
          gap: 12px !important;
        }
        .shifts-calendar-section, .shifts-right-panel {
          min-width: 100% !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: 12px !important;
          margin: 0 !important;
          box-sizing: border-box !important;
        }
        .shifts-calendar-days {
          gap: 2px !important;
        }
        .shifts-calendar-day {
          padding: 6px 0 !important;
          font-size: 12px !important;
        }
        .shifts-week-day {
          font-size: 10px !important;
          padding: 4px 0 !important;
        }
        .shifts-hours-grid {
          grid-template-columns: repeat(4, 1fr) !important;
        }
        .shifts-hour-btn {
          padding: 6px 4px !important;
          font-size: 10px !important;
        }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const texts = {
    ru: {
      title: 'Настройки смен',
      requirements: 'Требования к сменам',
      position: 'Позиция',
      required: 'Требуется',
      current: 'Назначено',
      status: 'Статус',
      completed: '✓ Выполнено',
      notCompleted: '✗ Не выполнено',
      generalSettings: 'Общие настройки',
      maxShiftsPerWeek: 'Максимум смен в неделю',
      minBreakHours: 'Минимальный перерыв (часы)',
      shiftDuration: 'Длительность смены (часы)',
      save: 'Сохранить',
      edit: 'Редактировать',
      cancel: 'Отмена',
      myAvailability: 'Моя доступность',
      selectHours: 'Выберите часы, когда вы можете работать',
      available: 'Доступен',
      notAvailable: 'Недоступен',
      dayOffRequests: 'Запросы на выходной',
      requestDayOff: '+ Запросить выходной',
      date: 'Дата',
      reason: 'Причина',
      statusLabel: 'Статус',
      pending: 'На рассмотрении',
      approved: 'Одобрено',
      rejected: 'Отклонено',
      sendRequest: 'Отправить запрос',
      myPreferences: 'Мои предпочтения',
      preferredTime: 'Предпочтительное время',
      morningPreferred: 'Предпочитаю утро (09:00-13:00)',
      afternoonPreferred: 'Предпочитаю день (13:00-17:00)',
      eveningPreferred: 'Предпочитаю вечер (17:00-22:00)',
      savePreferences: 'Сохранить предпочтения',
      noRequirements: 'Нет требований на выбранную дату',
      noRequests: 'Нет запросов',
      employeeRequests: 'Запросы сотрудников',
      employee: 'Сотрудник',
      actions: 'Действия',
      approve: 'Одобрить',
      reject: 'Отклонить',
      allDayOff: 'Целый день'
    },
    en: {
      title: 'Shift Settings',
      requirements: 'Shift Requirements',
      position: 'Position',
      required: 'Required',
      current: 'Current',
      status: 'Status',
      completed: '✓ Completed',
      notCompleted: '✗ Not completed',
      generalSettings: 'General Settings',
      maxShiftsPerWeek: 'Max shifts per week',
      minBreakHours: 'Minimum break (hours)',
      shiftDuration: 'Shift duration (hours)',
      save: 'Save',
      edit: 'Edit',
      cancel: 'Cancel',
      myAvailability: 'My Availability',
      selectHours: 'Select hours when you can work',
      available: 'Available',
      notAvailable: 'Not available',
      dayOffRequests: 'Day off requests',
      requestDayOff: '+ Request day off',
      date: 'Date',
      reason: 'Reason',
      statusLabel: 'Status',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      sendRequest: 'Send request',
      myPreferences: 'My Preferences',
      preferredTime: 'Preferred time',
      morningPreferred: 'Prefer morning (09:00-13:00)',
      afternoonPreferred: 'Prefer afternoon (13:00-17:00)',
      eveningPreferred: 'Prefer evening (17:00-22:00)',
      savePreferences: 'Save preferences',
      noRequirements: 'No requirements for selected date',
      noRequests: 'No requests',
      employeeRequests: 'Employee requests',
      employee: 'Employee',
      actions: 'Actions',
      approve: 'Approve',
      reject: 'Reject',
      allDayOff: 'All day'
    }
  };

  const t = texts[language] || texts.ru;

  // Форматирование даты
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Получение дней в месяце
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

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Проверка, есть ли требования на день (для менеджера)
  const hasRequirements = (day) => {
    const dateStr = formatDate(day);
    return requirements.some(r => r.date === dateStr);
  };

  // Получение требований для выбранной даты
  const getRequirementsForDate = () => {
    const dateStr = formatDate(selectedDate);
    return requirements.filter(r => r.date === dateStr);
  };

  // Обновление требований (чеклист для менеджера)
  const toggleCheckbox = (reqId, index, currentCount, minCount) => {
    let newCount;
    if (index < currentCount) {
      newCount = currentCount - 1;
    } else {
      newCount = currentCount + 1;
    }
    
    setRequirements(requirements.map(req => 
      req.id === reqId 
        ? { ...req, currentCount: newCount, isMet: newCount >= minCount }
        : req
    ));
  };

  // Сохранение общих настроек
  const saveGeneralSettings = () => {
    setIsEditingSettings(false);
    alert(t.save);
  };

  // Отправка запроса на выходной (СОХРАНЯЕТСЯ И ПОЯВЛЯЕТСЯ СРАЗУ)
  const sendDayOffRequest = () => {
    if (newDayOff.date) {
      const newRequest = {
        id: Date.now(),
        userId: user?.id,
        userName: `${user?.firstName} ${user?.lastName}`,
        date: newDayOff.date,
        reason: newDayOff.reason || 'Не указана',
        status: 'pending',
        createdAt: formatDate(new Date())
      };
      const updatedRequests = [...dayOffRequests, newRequest];
      setDayOffRequests(updatedRequests);
      localStorage.setItem('dayOffRequests', JSON.stringify(updatedRequests));
      setShowDayOffModal(false);
      setNewDayOff({ date: '', reason: '' });
      alert('Запрос на выходной отправлен!');
    }
  };

  // Одобрение запроса (для менеджера)
  const approveRequest = (id) => {
    const updatedRequests = dayOffRequests.map(req =>
      req.id === id ? { ...req, status: 'approved' } : req
    );
    setDayOffRequests(updatedRequests);
    localStorage.setItem('dayOffRequests', JSON.stringify(updatedRequests));
  };

  // Отклонение запроса (для менеджера)
  const rejectRequest = (id) => {
    const updatedRequests = dayOffRequests.map(req =>
      req.id === id ? { ...req, status: 'rejected' } : req
    );
    setDayOffRequests(updatedRequests);
    localStorage.setItem('dayOffRequests', JSON.stringify(updatedRequests));
  };

  // Переключение доступности по часам (для сотрудника)
  const toggleHourAvailability = (hour) => {
    const dateStr = formatDate(selectedDate);
    const key = `${dateStr}_${hour}`;
    const newAvailability = {
      ...hourlyAvailability,
      [key]: !hourlyAvailability[key]
    };
    setHourlyAvailability(newAvailability);
    localStorage.setItem(`availability_${user?.id}`, JSON.stringify(newAvailability));
  };

  // Проверка доступности часа
  const isHourAvailable = (hour) => {
    const dateStr = formatDate(selectedDate);
    const key = `${dateStr}_${hour}`;
    return hourlyAvailability[key] || false;
  };

  // Обновление предпочтений
  const togglePreference = (slot) => {
    setPreferences({
      ...preferences,
      [slot]: !preferences[slot]
    });
  };

  const savePreferences = () => {
    localStorage.setItem(`preferences_${user?.id}`, JSON.stringify(preferences));
    alert(t.savePreferences);
  };

  const currentRequirements = getRequirementsForDate();
  const dateStr = formatDate(selectedDate);

  const inputStyle = {
    padding: '8px 12px',
    fontSize: '14px',
    color: '#002642',
    backgroundColor: '#FFFFFF',
    border: '2px solid #DEE7E7',
    borderRadius: '8px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div className="shifts-main-container" style={styles.container}>
      {/* Календарь */}
      <div className="shifts-calendar-section" style={styles.calendarSection}>
        <div style={styles.calendarHeader}>
          <button onClick={prevMonth} style={styles.monthNavBtn}>←</button>
          <h3 style={styles.calendarTitle}>
            {currentMonth.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={nextMonth} style={styles.monthNavBtn}>→</button>
        </div>
        <div className="shifts-week-days" style={styles.weekDays}>
          {weekDays.map(day => (
            <div key={day} className="shifts-week-day" style={styles.weekDay}>{day}</div>
          ))}
        </div>
        <div className="shifts-calendar-days" style={styles.calendarDays}>
          {days.map((day, index) => {
            const hasReqs = hasRequirements(day);
            const isSelected = formatDate(day) === dateStr;
            return (
              <div
                key={index}
                onClick={() => setSelectedDate(day)}
                className="shifts-calendar-day"
                style={{
                  ...styles.calendarDay,
                  ...(isSelected && styles.calendarDaySelected),
                  ...(hasReqs && !isSelected && styles.calendarDayHasReqs)
                }}
              >
                {day.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Правая панель */}
      <div className="shifts-right-panel" style={styles.rightPanel}>
        {isManager ? (
          // Режим менеджера
          <>
            {/* Требования к сменам */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                {t.requirements} — {selectedDate.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
              </h3>
              {currentRequirements.length === 0 ? (
                <p style={styles.emptyText}>{t.noRequirements}</p>
              ) : (
                <div style={styles.requirementsList}>
                  {currentRequirements.map(req => (
                    <div key={req.id} style={styles.requirementItem}>
                      <div className="shifts-requirement-info" style={styles.requirementInfo}>
                        <span style={styles.positionName}>{req.position}</span>
                        <span style={styles.countInfo}>
                          {req.currentCount} / {req.minCount}
                        </span>
                        <span style={{
                          ...styles.statusBadge,
                          ...(req.isMet ? styles.statusMet : styles.statusNotMet)
                        }}>
                          {req.isMet ? t.completed : t.notCompleted}
                        </span>
                      </div>
                      <div className="shifts-checklist" style={styles.checklist}>
                        {[...Array(req.minCount)].map((_, i) => (
                          <div
                            key={i}
                            onClick={() => toggleCheckbox(req.id, i, req.currentCount, req.minCount)}
                            style={{
                              ...styles.checkbox,
                              ...(i < req.currentCount ? styles.checkboxChecked : {})
                            }}
                          >
                            {i < req.currentCount && '✓'}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Запросы сотрудников на выходной */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.employeeRequests}</h3>
              {dayOffRequests.length === 0 ? (
                <p style={styles.emptyText}>{t.noRequests}</p>
              ) : (
                <div style={styles.requestsList}>
                  {dayOffRequests.map(req => (
                    <div key={req.id} className="shifts-request-item" style={styles.requestItem}>
                      <div style={styles.requestInfo}>
                        <span style={styles.requestEmployee}>{req.userName}</span>
                        <span style={styles.requestDate}>{new Date(req.date).toLocaleDateString()}</span>
                        <span style={styles.requestReason}>{req.reason}</span>
                      </div>
                      <div style={styles.requestActions}>
                        {req.status === 'pending' ? (
                          <>
                            <button onClick={() => approveRequest(req.id)} style={styles.approveBtn}>
                              {t.approve}
                            </button>
                            <button onClick={() => rejectRequest(req.id)} style={styles.rejectBtn}>
                              {t.reject}
                            </button>
                          </>
                        ) : (
                          <span style={{
                            ...styles.requestStatus,
                            ...(req.status === 'approved' && styles.statusApproved),
                            ...(req.status === 'rejected' && styles.statusRejected)
                          }}>
                            {t[req.status]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Общие настройки */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>{t.generalSettings}</h3>
                {!isEditingSettings && (
                  <button onClick={() => setIsEditingSettings(true)} style={styles.editBtn}>
                    {t.edit}
                  </button>
                )}
              </div>
              {isEditingSettings ? (
                <div style={styles.settingsForm}>
                  <div className="shifts-setting-row" style={styles.settingRow}>
                    <label>{t.maxShiftsPerWeek}</label>
                    <input
                      type="number"
                      value={generalSettings.maxShiftsPerWeek}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, maxShiftsPerWeek: parseInt(e.target.value) })}
                      style={{ ...inputStyle, width: '100px' }}
                    />
                  </div>
                  <div className="shifts-setting-row" style={styles.settingRow}>
                    <label>{t.minBreakHours}</label>
                    <input
                      type="number"
                      value={generalSettings.minBreakHours}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, minBreakHours: parseInt(e.target.value) })}
                      style={{ ...inputStyle, width: '100px' }}
                    />
                  </div>
                  <div className="shifts-setting-row" style={styles.settingRow}>
                    <label>{t.shiftDuration}</label>
                    <input
                      type="number"
                      value={generalSettings.shiftDuration}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, shiftDuration: parseInt(e.target.value) })}
                      style={{ ...inputStyle, width: '100px' }}
                    />
                  </div>
                  <div style={styles.formActions}>
                    <button onClick={saveGeneralSettings} style={styles.saveBtn}>{t.save}</button>
                    <button onClick={() => setIsEditingSettings(false)} style={styles.cancelBtn}>{t.cancel}</button>
                  </div>
                </div>
              ) : (
                <div style={styles.settingsDisplay}>
                  <div><strong>{t.maxShiftsPerWeek}:</strong> {generalSettings.maxShiftsPerWeek}</div>
                  <div><strong>{t.minBreakHours}:</strong> {generalSettings.minBreakHours} ч.</div>
                  <div><strong>{t.shiftDuration}:</strong> {generalSettings.shiftDuration} ч.</div>
                </div>
              )}
            </div>
          </>
        ) : (
          // Режим сотрудника
          <>
            {/* Моя доступность по часам */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                {t.myAvailability} — {selectedDate.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
              </h3>
              <p style={styles.hintText}>{t.selectHours}</p>
              <div className="shifts-hours-grid" style={styles.hoursGrid}>
                {hours.map(hour => {
                  const isAvailable = isHourAvailable(hour);
                  return (
                    <button
                      key={hour}
                      onClick={() => toggleHourAvailability(hour)}
                      className="shifts-hour-btn"
                      style={{
                        ...styles.hourBtn,
                        ...(isAvailable ? styles.hourAvailable : styles.hourNotAvailable)
                      }}
                    >
                      {hour}:00
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Запросы на выходной (история) */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>{t.dayOffRequests}</h3>
                <button onClick={() => setShowDayOffModal(true)} style={styles.addBtn}>
                  {t.requestDayOff}
                </button>
              </div>
              {dayOffRequests.filter(req => req.userId === user?.id).length === 0 ? (
                <p style={styles.emptyText}>{t.noRequests}</p>
              ) : (
                <div style={styles.requestsList}>
                  {dayOffRequests.filter(req => req.userId === user?.id).map(req => (
                    <div key={req.id} className="shifts-request-item" style={styles.requestItem}>
                      <span>{new Date(req.date).toLocaleDateString()}</span>
                      <span style={styles.requestReason}>{req.reason}</span>
                      <span style={{
                        ...styles.requestStatus,
                        ...(req.status === 'pending' && styles.statusPending),
                        ...(req.status === 'approved' && styles.statusApproved),
                        ...(req.status === 'rejected' && styles.statusRejected)
                      }}>
                        {t[req.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Мои предпочтения */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t.myPreferences}</h3>
              <div style={styles.preferencesList}>
                {['morning', 'afternoon', 'evening'].map(slot => (
                  <label key={slot} style={styles.preferenceItem}>
                    <input 
                      type="checkbox" 
                      checked={preferences[slot]}
                      onChange={() => togglePreference(slot)}
                    /> 
                    {t[`${slot}Preferred`]}
                  </label>
                ))}
              </div>
              <button onClick={savePreferences} style={styles.savePreferencesBtn}>{t.savePreferences}</button>
            </div>
          </>
        )}
      </div>

      {/* Модальное окно для запроса выходного */}
      {showDayOffModal && (
        <div className="shifts-modal-overlay" style={styles.modalOverlay} onClick={() => setShowDayOffModal(false)}>
          <div className="shifts-modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{t.requestDayOff}</h3>
            <div style={styles.modalForm}>
              <input
                type="date"
                value={newDayOff.date}
                min={formatDate(new Date())}
                onChange={(e) => setNewDayOff({ ...newDayOff, date: e.target.value })}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder={t.reason}
                value={newDayOff.reason}
                onChange={(e) => setNewDayOff({ ...newDayOff, reason: e.target.value })}
                style={inputStyle}
              />
              <div style={styles.modalActions}>
                <button onClick={sendDayOffRequest} style={styles.primaryBtn}>{t.sendRequest}</button>
                <button onClick={() => setShowDayOffModal(false)} style={styles.cancelBtn}>{t.cancel}</button>
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
  calendarDayHasReqs: {
    backgroundColor: '#B7ADCF',
    color: '#002642'
  },
  rightPanel: {
    flex: '2',
    minWidth: '400px',
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  section: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    boxSizing: 'border-box'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#002642',
    margin: 0
  },
  requirementsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  requirementItem: {
    borderBottom: '1px solid #DEE7E7',
    paddingBottom: '12px'
  },
  requirementInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    flexWrap: 'wrap',
    gap: '8px'
  },
  positionName: {
    fontWeight: '600',
    color: '#002642'
  },
  countInfo: {
    fontSize: '14px',
    color: '#4F646F'
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  statusMet: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32'
  },
  statusNotMet: {
    backgroundColor: '#FFEBEE',
    color: '#D32F2F'
  },
  checklist: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  checkbox: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '2px solid #B7ADCF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#F4FAFF',
    transition: 'all 0.2s ease'
  },
  checkboxChecked: {
    backgroundColor: '#002642',
    borderColor: '#002642',
    color: '#F4FAFF'
  },
  editBtn: {
    padding: '6px 12px',
    backgroundColor: '#DEE7E7',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  settingsForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  settingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap'
  },
  settingsDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '12px'
  },
  saveBtn: {
    padding: '8px 16px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '8px',
    color: '#F4FAFF',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: '#DEE7E7',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  addBtn: {
    padding: '6px 12px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '8px',
    color: '#F4FAFF',
    cursor: 'pointer',
    fontSize: '12px'
  },
  hoursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px',
    marginTop: '12px'
  },
  hourBtn: {
    padding: '8px 6px',
    fontSize: '12px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontWeight: '500'
  },
  hourAvailable: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
    border: '1px solid #A5D6A7'
  },
  hourNotAvailable: {
    backgroundColor: '#FFEBEE',
    color: '#D32F2F',
    border: '1px solid #FFCDD2'
  },
  hintText: {
    fontSize: '13px',
    color: '#4F646F',
    marginBottom: '8px'
  },
  requestsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  requestItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #DEE7E7',
    flexWrap: 'wrap',
    gap: '10px'
  },
  requestInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '2'
  },
  requestEmployee: {
    fontWeight: '600',
    color: '#002642'
  },
  requestDate: {
    fontSize: '12px',
    color: '#4F646F'
  },
  requestReason: {
    fontSize: '12px',
    color: '#4F646F'
  },
  requestActions: {
    display: 'flex',
    gap: '8px'
  },
  approveBtn: {
    padding: '4px 12px',
    backgroundColor: '#E8F5E9',
    border: 'none',
    borderRadius: '6px',
    color: '#2E7D32',
    cursor: 'pointer',
    fontSize: '12px'
  },
  rejectBtn: {
    padding: '4px 12px',
    backgroundColor: '#FFEBEE',
    border: 'none',
    borderRadius: '6px',
    color: '#D32F2F',
    cursor: 'pointer',
    fontSize: '12px'
  },
  requestStatus: {
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500'
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
    color: '#E65100'
  },
  statusApproved: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32'
  },
  statusRejected: {
    backgroundColor: '#FFEBEE',
    color: '#D32F2F'
  },
  preferencesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px'
  },
  preferenceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '6px 0'
  },
  savePreferencesBtn: {
    padding: '10px 16px',
    backgroundColor: '#B7ADCF',
    border: 'none',
    borderRadius: '10px',
    color: '#002642',
    fontWeight: '500',
    cursor: 'pointer',
    width: '100%'
  },
  emptyText: {
    textAlign: 'center',
    padding: '20px',
    color: '#4F646F'
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
    cursor: 'pointer'
  }
};