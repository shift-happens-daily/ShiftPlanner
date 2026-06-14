// frontend/src/components/tabs/EmployeesTab.jsx
import { useState, useEffect } from 'react';

export default function EmployeesTab({ language }) {
  // Список рабочих позиций
  const [positions, setPositions] = useState([
    { id: 1, name: 'Бармен' },
    { id: 2, name: 'Официант' },
    { id: 3, name: 'Повар' },
    { id: 4, name: 'Администратор' }
  ]);
  
  // Распределение сотрудников по позициям
  const [employeeAssignments, setEmployeeAssignments] = useState([
    { id: 1, name: 'Иван Петров', positionId: 1, positionName: 'Бармен' },
    { id: 2, name: 'Анна Сидорова', positionId: 2, positionName: 'Официант' },
    { id: 3, name: 'Петр Иванов', positionId: 3, positionName: 'Повар' },
    { id: 4, name: 'Мария Кузнецова', positionId: 4, positionName: 'Администратор' },
    { id: 5, name: 'Дмитрий Соколов', positionId: 1, positionName: 'Бармен' },
    { id: 6, name: 'Елена Волкова', positionId: 2, positionName: 'Официант' },
  ]);
  
  const [newPosition, setNewPosition] = useState('');
  const [editingPosition, setEditingPosition] = useState(null);
  const [editPositionName, setEditPositionName] = useState('');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', positionId: '' });

  // Добавляем глобальные стили для адаптива
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @media (max-width: 768px) {
        .employees-main-container {
          flex-direction: column !important;
          padding: 8px !important;
          gap: 8px !important;
        }
        .employees-left-panel, .employees-right-panel {
          min-width: 100% !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: 12px !important;
          margin: 0 !important;
          box-sizing: border-box !important;
        }
        .employees-panel-header {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 8px !important;
        }
        .employees-panel-header h3 {
          font-size: 16px !important;
        }
        .employees-table th, .employees-table td {
          padding: 6px 4px !important;
          font-size: 10px !important;
        }
        .employees-position-item {
          padding: 6px 8px !important;
        }
        .employees-position-name {
          font-size: 13px !important;
        }
        .employees-add-position-row {
          flex-direction: column !important;
        }
        .employees-add-position-row input {
          width: 100% !important;
        }
        .employees-add-position-row button {
          width: 100% !important;
        }
        .employees-edit-row {
          flex-wrap: wrap !important;
        }
        .employees-edit-row input {
          width: 100% !important;
        }
        .employees-edit-row button {
          flex: 1 !important;
        }
        .employees-table {
          display: block !important;
          overflow-x: auto !important;
          white-space: nowrap !important;
        }
        .employees-modal-content {
          width: 95% !important;
          margin: 10px !important;
          padding: 16px !important;
        }
        .employees-modal-content h3 {
          font-size: 18px !important;
        }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const texts = {
    ru: {
      workingPositions: 'Рабочие позиции',
      addPosition: '+ Добавить позицию',
      save: 'Сохранить',
      cancel: 'Отмена',
      employeeDistribution: 'Распределение сотрудников',
      employee: 'Сотрудник',
      position: 'Позиция',
      actions: 'Действия',
      addEmployee: '+ Добавить сотрудника',
      selectPosition: 'Выберите позицию',
      namePlaceholder: 'Имя и фамилия сотрудника',
      confirmDelete: 'Вы уверены, что хотите удалить эту позицию?',
      confirmDeleteEmployee: 'Вы уверены, что хотите удалить этого сотрудника из распределения?'
    },
    en: {
      workingPositions: 'Working Positions',
      addPosition: '+ Add Position',
      save: 'Save',
      cancel: 'Cancel',
      employeeDistribution: 'Employee Distribution',
      employee: 'Employee',
      position: 'Position',
      actions: 'Actions',
      addEmployee: '+ Add Employee',
      selectPosition: 'Select position',
      namePlaceholder: 'Employee full name',
      confirmDelete: 'Are you sure you want to delete this position?',
      confirmDeleteEmployee: 'Are you sure you want to remove this employee from distribution?'
    }
  };

  const t = texts[language] || texts.ru;

  const handleAddPosition = () => {
    if (newPosition.trim()) {
      const newId = Math.max(...positions.map(p => p.id), 0) + 1;
      setPositions([...positions, { id: newId, name: newPosition }]);
      setNewPosition('');
    }
  };

  const handleStartEdit = (position) => {
    setEditingPosition(position.id);
    setEditPositionName(position.name);
  };

  const handleSaveEdit = (id) => {
    if (editPositionName.trim()) {
      setPositions(positions.map(p => 
        p.id === id ? { ...p, name: editPositionName } : p
      ));
      setEmployeeAssignments(employeeAssignments.map(emp => 
        emp.positionId === id ? { ...emp, positionName: editPositionName } : emp
      ));
      setEditingPosition(null);
      setEditPositionName('');
    }
  };

  const handleDeletePosition = (id) => {
    if (window.confirm(t.confirmDelete)) {
      const hasEmployees = employeeAssignments.some(emp => emp.positionId === id);
      if (hasEmployees) {
        alert('Сначала удалите или переназначьте сотрудников с этой позицией');
        return;
      }
      setPositions(positions.filter(p => p.id !== id));
    }
  };

  const handleAddEmployee = () => {
    if (newEmployee.name && newEmployee.positionId) {
      const position = positions.find(p => p.id === parseInt(newEmployee.positionId));
      const newId = Math.max(...employeeAssignments.map(e => e.id), 0) + 1;
      setEmployeeAssignments([
        ...employeeAssignments,
        {
          id: newId,
          name: newEmployee.name,
          positionId: parseInt(newEmployee.positionId),
          positionName: position?.name || ''
        }
      ]);
      setNewEmployee({ name: '', positionId: '' });
      setShowAddEmployee(false);
    }
  };

  const handleDeleteEmployee = (id) => {
    if (window.confirm(t.confirmDeleteEmployee)) {
      setEmployeeAssignments(employeeAssignments.filter(emp => emp.id !== id));
    }
  };

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
    <div className="employees-main-container" style={styles.container}>
      {/* Левый блок: Рабочие позиции */}
      <div className="employees-left-panel" style={styles.leftPanel}>
        <div className="employees-panel-header" style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>{t.workingPositions}</h3>
        </div>
        
        <div style={styles.positionsList}>
          {positions.map(position => (
            <div key={position.id} className="employees-position-item" style={styles.positionItem}>
              {editingPosition === position.id ? (
                <div className="employees-edit-row" style={styles.editRow}>
                  <input
                    type="text"
                    value={editPositionName}
                    onChange={(e) => setEditPositionName(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    autoFocus
                  />
                  <button onClick={() => handleSaveEdit(position.id)} style={styles.saveSmallBtn}>
                    {t.save}
                  </button>
                  <button onClick={() => setEditingPosition(null)} style={styles.cancelSmallBtn}>
                    {t.cancel}
                  </button>
                </div>
              ) : (
                <>
                  <span className="employees-position-name" style={styles.positionName}>{position.name}</span>
                  <div style={styles.positionActions}>
                    <button onClick={() => handleStartEdit(position)} style={styles.editSmallBtn}>
                      ✏️
                    </button>
                    <button onClick={() => handleDeletePosition(position.id)} style={styles.deleteSmallBtn}>
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        
        <div className="employees-add-position-row" style={styles.addPositionRow}>
          <input
            type="text"
            placeholder={t.addPosition}
            value={newPosition}
            onChange={(e) => setNewPosition(e.target.value)}
            style={inputStyle}
            onKeyPress={(e) => e.key === 'Enter' && handleAddPosition()}
          />
          <button onClick={handleAddPosition} style={styles.addBtn}>
            +
          </button>
        </div>
      </div>

      {/* Правый блок: Распределение сотрудников */}
      <div className="employees-right-panel" style={styles.rightPanel}>
        <div className="employees-panel-header" style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>{t.employeeDistribution}</h3>
          <button onClick={() => setShowAddEmployee(true)} style={styles.addEmployeeBtn}>
            {t.addEmployee}
          </button>
        </div>
        
        <div style={styles.tableWrapper}>
          <table className="employees-table" style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.employee}</th>
                <th style={styles.th}>{t.position}</th>
                <th style={{ ...styles.th, width: '70px' }}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {employeeAssignments.length === 0 ? (
                <tr>
                  <td colSpan="3" style={styles.emptyCell}>
                    Нет распределенных сотрудников
                  </td>
                </tr>
              ) : (
                employeeAssignments.map(emp => (
                  <tr key={emp.id}>
                    <td style={styles.td}>{emp.name}</td>
                    <td style={styles.td}>{emp.positionName}</td>
                    <td style={styles.td}>
                      <button onClick={() => handleDeleteEmployee(emp.id)} style={styles.deleteSmallBtn}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно для добавления сотрудника */}
      {showAddEmployee && (
        <div style={styles.modalOverlay} onClick={() => setShowAddEmployee(false)}>
          <div className="employees-modal-content" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{t.addEmployee}</h3>
            <div style={styles.modalForm}>
              <input
                type="text"
                placeholder={t.namePlaceholder}
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                style={inputStyle}
              />
              <select
                value={newEmployee.positionId}
                onChange={(e) => setNewEmployee({ ...newEmployee, positionId: e.target.value })}
                style={inputStyle}
              >
                <option value="">{t.selectPosition}</option>
                {positions.map(pos => (
                  <option key={pos.id} value={pos.id}>{pos.name}</option>
                ))}
              </select>
              <div style={styles.modalActions}>
                <button onClick={handleAddEmployee} style={styles.primaryBtn}>{t.save}</button>
                <button onClick={() => setShowAddEmployee(false)} style={styles.cancelBtn}>{t.cancel}</button>
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
    gap: '16px',
    flexWrap: 'wrap',
    background: '#F4FAFF',
    borderRadius: '20px',
    padding: '12px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  leftPanel: {
    flex: '1',
    minWidth: '240px',
    maxWidth: '100%',
    background: '#FFFFFF',
    borderRadius: '14px',
    padding: '14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    boxSizing: 'border-box'
  },
  rightPanel: {
    flex: '2',
    minWidth: '300px',
    maxWidth: '100%',
    background: '#FFFFFF',
    borderRadius: '14px',
    padding: '14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    boxSizing: 'border-box'
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#002642',
    margin: 0
  },
  positionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '14px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  positionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    backgroundColor: '#F4FAFF',
    borderRadius: '8px',
    border: '1px solid #DEE7E7'
  },
  positionName: {
    fontSize: '13px',
    color: '#002642',
    fontWeight: '500'
  },
  positionActions: {
    display: 'flex',
    gap: '6px'
  },
  editRow: {
    display: 'flex',
    gap: '6px',
    width: '100%',
    alignItems: 'center'
  },
  addPositionRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px'
  },
  addBtn: {
    padding: '8px 14px',
    backgroundColor: '#B7ADCF',
    border: 'none',
    borderRadius: '8px',
    color: '#002642',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '16px'
  },
  editSmallBtn: {
    padding: '4px 8px',
    backgroundColor: '#DEE7E7',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  deleteSmallBtn: {
    padding: '4px 8px',
    backgroundColor: '#FFEBEE',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  saveSmallBtn: {
    padding: '5px 10px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '6px',
    color: '#F4FAFF',
    fontSize: '11px',
    cursor: 'pointer'
  },
  cancelSmallBtn: {
    padding: '5px 10px',
    backgroundColor: '#DEE7E7',
    border: 'none',
    borderRadius: '6px',
    color: '#4F646F',
    fontSize: '11px',
    cursor: 'pointer'
  },
  addEmployeeBtn: {
    padding: '6px 12px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '8px',
    color: '#F4FAFF',
    fontWeight: '500',
    fontSize: '12px',
    cursor: 'pointer'
  },
  tableWrapper: {
    overflowX: 'auto',
    marginTop: '12px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '280px'
  },
  th: {
    padding: '8px 8px',
    backgroundColor: '#002642',
    color: '#F4FAFF',
    fontWeight: '600',
    fontSize: '12px',
    textAlign: 'center',
    borderBottom: '2px solid #B7ADCF'
  },
  td: {
    padding: '8px 8px',
    fontSize: '12px',
    color: '#002642',
    borderBottom: '1px solid #DEE7E7'
  },
  emptyCell: {
    padding: '30px',
    textAlign: 'center',
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
    padding: '20px',
    width: '90%',
    maxWidth: '380px'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#002642',
    margin: '0 0 16px 0'
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '6px'
  },
  primaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '8px',
    color: '#F4FAFF',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '13px'
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: '#DEE7E7',
    border: 'none',
    borderRadius: '8px',
    color: '#4F646F',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '13px'
  }
};