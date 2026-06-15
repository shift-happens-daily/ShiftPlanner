import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getEmployeeReports, getMyReport } from '../../services/reportService';
import { extractApiErrorMessage } from '../../services/error';

function todayRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

export default function ReportsTab({ language, userRole }) {
  const [dateRange, setDateRange] = useState(todayRange);
  const [managerReport, setManagerReport] = useState([]);
  const [employeeReport, setEmployeeReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const texts = {
    ru: {
      title: 'Отчеты',
      selfTitle: 'Мой отчет',
      startDate: 'Начало периода',
      endDate: 'Конец периода',
      apply: 'Обновить',
      employee: 'Сотрудник',
      position: 'Позиция',
      hours: 'Часы',
      shifts: 'Смены',
      total: 'Итого',
      export: 'Экспорт XLSX',
      loading: 'Загрузка...',
      empty: 'Нет данных за выбранный период.',
      unknownPosition: 'Не указана',
    },
    en: {
      title: 'Reports',
      selfTitle: 'My report',
      startDate: 'Start date',
      endDate: 'End date',
      apply: 'Refresh',
      employee: 'Employee',
      position: 'Position',
      hours: 'Hours',
      shifts: 'Shifts',
      total: 'Total',
      export: 'Export XLSX',
      loading: 'Loading...',
      empty: 'No data for the selected period.',
      unknownPosition: 'Not specified',
    },
  };

  const t = texts[language] || texts.ru;

  const totals = useMemo(() => {
    if (userRole === 'manager') {
      return managerReport.reduce(
        (acc, item) => ({
          total_hours: acc.total_hours + item.total_hours,
          total_shifts: acc.total_shifts + item.total_shifts,
        }),
        { total_hours: 0, total_shifts: 0 }
      );
    }

    return employeeReport || { total_hours: 0, total_shifts: 0 };
  }, [employeeReport, managerReport, userRole]);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      if (userRole === 'manager') {
        const data = await getEmployeeReports(dateRange);
        setManagerReport(data);
      } else {
        const data = await getMyReport(dateRange);
        setEmployeeReport(data);
      }
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, null, language));
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, language, userRole]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReports();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadReports]);

  const exportToExcel = () => {
    const rows = userRole === 'manager'
      ? managerReport.map((item) => ({
        [t.employee]: item.full_name,
        [t.position]: item.position,
        [t.hours]: item.total_hours,
        [t.shifts]: item.total_shifts,
      }))
      : [{
        [t.employee]: employeeReport?.full_name || '',
        [t.position]: t.unknownPosition,
        [t.hours]: employeeReport?.total_hours || 0,
        [t.shifts]: employeeReport?.total_shifts || 0,
      }];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reports');
    XLSX.writeFile(workbook, `shiftplanner-report-${dateRange.start_date}-${dateRange.end_date}.xlsx`);
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{userRole === 'manager' ? t.title : t.selfTitle}</h2>
        </div>
        <button onClick={exportToExcel} style={styles.primaryButton} disabled={isLoading}>
          {t.export}
        </button>
      </div>

      <div style={styles.filters}>
        <label style={styles.filterLabel}>
          {t.startDate}
          <input
            type="date"
            value={dateRange.start_date}
            onChange={(event) => setDateRange((prev) => ({ ...prev, start_date: event.target.value }))}
            style={styles.input}
          />
        </label>
        <label style={styles.filterLabel}>
          {t.endDate}
          <input
            type="date"
            value={dateRange.end_date}
            onChange={(event) => setDateRange((prev) => ({ ...prev, end_date: event.target.value }))}
            style={styles.input}
          />
        </label>
        <button onClick={loadReports} style={styles.secondaryButton} disabled={isLoading}>
          {t.apply}
        </button>
      </div>

      {errorMessage && <div style={styles.error}>{errorMessage}</div>}
      {isLoading ? (
        <p style={styles.emptyText}>{t.loading}</p>
      ) : userRole === 'manager' ? (
        managerReport.length === 0 ? (
          <p style={styles.emptyText}>{t.empty}</p>
        ) : (
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
                {managerReport.map((item) => (
                  <tr key={item.employee_id}>
                    <td style={styles.td}>{item.full_name}</td>
                    <td style={styles.td}>{item.position}</td>
                    <td style={styles.td}>{item.total_hours}</td>
                    <td style={styles.td}>{item.total_shifts}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2" style={styles.totalLabel}>{t.total}</td>
                  <td style={styles.totalValue}>{totals.total_hours}</td>
                  <td style={styles.totalValue}>{totals.total_shifts}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : employeeReport ? (
        <div style={styles.reportBox}>
          <div style={styles.reportName}>{employeeReport.full_name}</div>
          <div style={styles.reportStat}>{t.hours}: {employeeReport.total_hours}</div>
          <div style={styles.reportStat}>{t.shifts}: {employeeReport.total_shifts}</div>
        </div>
      ) : (
        <p style={styles.emptyText}>{t.empty}</p>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '18px',
  },
  title: {
    margin: 0,
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
  emptyText: {
    margin: 0,
    color: '#4F646F',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#FFFFFF',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  th: {
    padding: '12px 14px',
    background: '#002642',
    color: '#F4FAFF',
    textAlign: 'left',
  },
  td: {
    padding: '12px 14px',
    color: '#002642',
    borderBottom: '1px solid #DEE7E7',
  },
  totalLabel: {
    padding: '12px 14px',
    background: '#DEE7E7',
    color: '#002642',
    fontWeight: '700',
    textAlign: 'right',
  },
  totalValue: {
    padding: '12px 14px',
    background: '#B7ADCF',
    color: '#002642',
    fontWeight: '700',
  },
  reportBox: {
    padding: '20px',
    borderRadius: '18px',
    background: '#FFFFFF',
    border: '1px solid #DEE7E7',
  },
  reportName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#002642',
    marginBottom: '12px',
  },
  reportStat: {
    color: '#4F646F',
    marginBottom: '8px',
  },
};
