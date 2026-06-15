// frontend/src/components/tabs/ReportsTab.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';  // 👈 ДОБАВЬ ЭТОТ ИМПОРТ

export default function ReportsTab({ language }) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Временные данные (позже заменишь на API)
  useEffect(() => {
    const mockEmployees = [
      { id: 1, firstName: 'Иван', lastName: 'Петров', position: 'Бармен', hours: 96, shifts: 12 },
      { id: 2, firstName: 'Анна', lastName: 'Сидорова', position: 'Официант', hours: 80, shifts: 10 },
      { id: 3, firstName: 'Петр', lastName: 'Иванов', position: 'Повар', hours: 72, shifts: 9 },
      { id: 4, firstName: 'Мария', lastName: 'Кузнецова', position: 'Администратор', hours: 88, shifts: 11 },
      { id: 5, firstName: 'Дмитрий', lastName: 'Соколов', position: 'Бармен', hours: 64, shifts: 8 },
      { id: 6, firstName: 'Елена', lastName: 'Волкова', position: 'Официант', hours: 56, shifts: 7 },
      { id: 7, firstName: 'Алексей', lastName: 'Морозов', position: 'Повар', hours: 48, shifts: 6 },
    ];
    setEmployees(mockEmployees);
    setLoading(false);
  }, []);

  const texts = {
    ru: {
      title: 'Отчет по сотрудникам',
      employee: 'Сотрудник',
      position: 'Должность',
      hours: 'Кол-во часов',
      shifts: 'Кол-во смен',
      exportToExcel: 'Экспорт в Excel',
      totalHours: 'Всего часов',
      totalShifts: 'Всего смен',
      loading: 'Загрузка...',
      noData: 'Нет данных о сотрудниках'
    },
    en: {
      title: 'Employee Reports',
      employee: 'Employee',
      position: 'Position',
      hours: 'Total hours',
      shifts: 'Total shifts',
      exportToExcel: 'Export to Excel',
      totalHours: 'Total hours',
      totalShifts: 'Total shifts',
      loading: 'Loading...',
      noData: 'No employee data available'
    }
  };

  const t = texts[language] || texts.ru;

  const totalHours = employees.reduce((sum, emp) => sum + emp.hours, 0);
  const totalShifts = employees.reduce((sum, emp) => sum + emp.shifts, 0);

  // Функция экспорта в Excel (XLSX формат)
  const exportToExcel = () => {
    // Подготовка данных для Excel
    const excelData = [
      { [t.employee]: 'Сотрудник', [t.position]: 'Должность', [t.hours]: 'Часы', [t.shifts]: 'Смены' },
      ...employees.map(emp => ({
        [t.employee]: `${emp.lastName} ${emp.firstName}`,
        [t.position]: emp.position,
        [t.hours]: emp.hours,
        [t.shifts]: emp.shifts
      })),
      {},
      { [t.totalHours]: totalHours, [t.totalShifts]: totalShifts }
    ];

    // Создаем workbook и worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчет по сотрудникам');

    // Настройка ширины колонок
    worksheet['!cols'] = [
      { wch: 25 }, // Сотрудник
      { wch: 20 }, // Должность
      { wch: 12 }, // Часы
      { wch: 12 }  // Смены
    ];

    // Сохраняем файл
    XLSX.writeFile(workbook, `employee_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div style={styles.card}>
        <h2 style={styles.title}>{t.title}</h2>
        <p style={styles.loading}>{t.loading}</p>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div style={styles.card}>
        <h2 style={styles.title}>{t.title}</h2>
        <p style={styles.noData}>{t.noData}</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>{t.title}</h2>
      
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.employee}</th>
              <th style={styles.th}>{t.position}</th>
              <th style={styles.th}>{t.hours}</th>
              <th style={styles.th}>{t.shifts}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td style={styles.td}>{emp.lastName} {emp.firstName}</td>
                <td style={styles.td}>{emp.position}</td>
                <td style={{ ...styles.td, ...styles.numberCell }}>{emp.hours}</td>
                <td style={{ ...styles.td, ...styles.numberCell }}>{emp.shifts}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={styles.totalRow}>
              <td colSpan="2" style={styles.totalLabel}>{t.totalHours}:</td>
              <td style={styles.totalValue}>{totalHours}</td>
              <td style={styles.totalValue}></td>
            </tr>
            <tr style={styles.totalRow}>
              <td colSpan="2" style={styles.totalLabel}>{t.totalShifts}:</td>
              <td style={styles.totalValue}>{totalShifts}</td>
              <td style={styles.totalValue}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={styles.exportContainer}>
        <button onClick={exportToExcel} style={styles.exportBtn}>
          {t.exportToExcel}
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
    maxWidth: '1000px',
    margin: '0 auto',
    overflowX: 'auto'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#002642',
    margin: '0 0 24px 0'
  },
  tableWrapper: {
    overflowX: 'auto',
    marginBottom: '24px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  th: {
    padding: '14px 16px',
    backgroundColor: '#002642',
    color: '#F4FAFF',
    fontWeight: '600',
    fontSize: '14px',
    textAlign: 'center',
    borderBottom: '2px solid #B7ADCF'
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#002642',
    borderBottom: '1px solid #DEE7E7'
  },
  numberCell: {
    textAlign: 'center',
    fontWeight: '500'
  },
  totalRow: {
    backgroundColor: '#DEE7E7'
  },
  totalLabel: {
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#002642',
    textAlign: 'right'
  },
  totalValue: {
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#002642',
    textAlign: 'center',
    backgroundColor: '#B7ADCF'
  },
  exportContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '16px'
  },
  exportBtn: {
    padding: '12px 24px',
    backgroundColor: '#002642',
    border: 'none',
    borderRadius: '12px',
    color: '#F4FAFF',
    fontWeight: '500',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#4F646F'
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#4F646F'
  }
};

// Добавляем hover эффект для строк таблицы
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  tr:hover {
    background-color: #F0EDF5 !important;
  }
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,38,66,0.2);
  }
  button:active {
    transform: translateY(0);
  }
`;
if (!document.querySelector('#report-styles')) {
  styleSheet.id = 'report-styles';
  document.head.appendChild(styleSheet);
}