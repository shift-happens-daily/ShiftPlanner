import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getEmployeeReports, getMyReport } from '../../services/reportService';
import { extractApiErrorMessage } from '../../services/error';

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);

  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.reports)) {
    return value.reports;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  return [];
}

function normalizeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

const DEFAULT_HOURLY_RATE = 25;

function normalizeManagerRow(item) {
  const totalHours = normalizeNumber(item?.total_hours);
  const hourlyRate = normalizeNumber(item?.hourly_rate) || DEFAULT_HOURLY_RATE;
  const totalSalary = normalizeNumber(item?.total_salary) || normalizeNumber(item?.salary) || totalHours * hourlyRate;

  return {
    employee_id: item?.employee_id || item?.id || item?.user_id || `${item?.full_name}-${item?.position}`,
    full_name: item?.full_name || item?.employee_name || item?.name || '—',
    position: item?.position || item?.position_title || item?.position_name || '—',
    branch: item?.branch || item?.branch_name || item?.branch_title || item?.branch?.name || '—',
    total_hours: totalHours,
    total_shifts: normalizeNumber(item?.total_shifts),
    hourly_rate: hourlyRate,
    total_salary: totalSalary,
  };
}

function normalizeEmployeeReport(report) {
  if (!report) {
    return null;
  }

  const totalHours = normalizeNumber(report.total_hours);
  const totalSalary = normalizeNumber(report.total_salary) || normalizeNumber(report.salary) || totalHours * DEFAULT_HOURLY_RATE;

  return {
    full_name: report.full_name || report.employee_name || report.name || '—',
    position: report.position || report.position_title || report.position_name || '—',
    total_hours: totalHours,
    total_shifts: normalizeNumber(report.total_shifts),
    total_salary: totalSalary,
  };
}

export default function ReportsTab({ language, userRole }) {
  const isManager = userRole === 'manager';

  const [filterForm, setFilterForm] = useState(defaultRange);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [reportMode, setReportMode] = useState('hours');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const [managerReport, setManagerReport] = useState([]);
  const [employeeReport, setEmployeeReport] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      title: 'Отчеты',
      selfTitle: 'Мой отчет',
      subtitleManager: 'Сводка по отработанным часам и сменам сотрудников за выбранный период.',
      subtitleEmployee: 'Личная сводка по опубликованным сменам за выбранный период.',
      period: 'Период отчета',
      startDate: 'Начало периода',
      endDate: 'Конец периода',
      apply: 'Показать отчет',
      employee: 'Сотрудник',
      position: 'Позиция',
      hours: 'Часы',
      shifts: 'Смены',
      salary: 'Зарплата',
      branch: 'Филиал',
      allBranches: 'Все филиалы',
      reportType: 'Тип отчета',
      hoursReport: 'По часам',
      shiftsReport: 'По сменам',
      salaryReport: 'По зарплате',
      total: 'Итого',
      export: 'Скачать XLSX',
      loading: 'Загрузка...',
      empty: 'Нет данных за выбранный период.',
      unknownPosition: 'Не указана',
      reportReady: 'Отчет обновлен.',
      exported: 'Отчет скачан в XLSX.',
      summary: 'Сводка',
      totalHours: 'Всего часов',
      totalShifts: 'Всего смен',
      employees: 'Сотрудников',
      noPermission:
        'У вас нет прав для этого отчета. Проверьте роль аккаунта или используйте личный отчет сотрудника.',
    },
    en: {
      title: 'Reports',
      selfTitle: 'My report',
      subtitleManager: 'Summary of employee workload by hours and shifts for the selected period.',
      subtitleEmployee: 'Personal summary of published shifts for the selected period.',
      period: 'Report period',
      startDate: 'Start date',
      endDate: 'End date',
      apply: 'Show report',
      employee: 'Employee',
      position: 'Position',
      hours: 'Hours',
      shifts: 'Shifts',
      salary: 'Salary',
      branch: 'Branch',
      allBranches: 'All branches',
      reportType: 'Report type',
      hoursReport: 'By hours',
      shiftsReport: 'By shifts',
      salaryReport: 'By salary',
      total: 'Total',
      export: 'Download XLSX',
      loading: 'Loading...',
      empty: 'No data for the selected period.',
      unknownPosition: 'Not specified',
      reportReady: 'Report refreshed.',
      exported: 'Report downloaded as XLSX.',
      summary: 'Summary',
      totalHours: 'Total hours',
      totalShifts: 'Total shifts',
      employees: 'Employees',
      noPermission:
        'You do not have permission for this report. Check the account role or use the employee personal report.',
    },
  };

  const t = texts[language] || texts.ru;

  const normalizedManagerReport = useMemo(
    () => normalizeArray(managerReport).map(normalizeManagerRow),
    [managerReport]
  );

  const filteredManagerReport = useMemo(() => {
    return normalizedManagerReport.filter((item) => {
      const matchesEmployee = !employeeSearch || item.full_name.toLowerCase().includes(employeeSearch.toLowerCase());
      const matchesPosition = !positionFilter || item.position.toLowerCase().includes(positionFilter.toLowerCase());
      const matchesBranch = !branchFilter || item.branch.toLowerCase().includes(branchFilter.toLowerCase());
      return matchesEmployee && matchesPosition && matchesBranch;
    });
  }, [normalizedManagerReport, employeeSearch, positionFilter, branchFilter]);

  const normalizedEmployeeReport = useMemo(
    () => normalizeEmployeeReport(employeeReport),
    [employeeReport]
  );

  const demoManagerReport = useMemo(() => {
    if (!isManager) return [];

    return [
      {
        employee_id: 'demo-1',
        full_name: language === 'ru' ? 'Иван Иванов' : 'John Doe',
        position: language === 'ru' ? 'Супервайзер' : 'Supervisor',
        branch: language === 'ru' ? 'Центральный' : 'Head Office',
        total_hours: 138,
        total_shifts: 16,
        hourly_rate: 32,
        total_salary: 4416,
      },
      {
        employee_id: 'demo-2',
        full_name: language === 'ru' ? 'Анна Смирнова' : 'Anna Smith',
        position: language === 'ru' ? 'Кассир' : 'Cashier',
        branch: language === 'ru' ? 'Западный' : 'West Branch',
        total_hours: 121,
        total_shifts: 14,
        hourly_rate: 28,
        total_salary: 3388,
      },
      {
        employee_id: 'demo-3',
        full_name: language === 'ru' ? 'Олег Петров' : 'Oleg Petrov',
        position: language === 'ru' ? 'Курьер' : 'Courier',
        branch: language === 'ru' ? 'Северный' : 'North Branch',
        total_hours: 104,
        total_shifts: 12,
        hourly_rate: 25,
        total_salary: 2600,
      },
    ];
  }, [isManager, language]);

  const displayManagerReport = useMemo(() => {
    if (!isManager) return [];
    if (filteredManagerReport.length > 0) return filteredManagerReport;
    return demoManagerReport;
  }, [isManager, filteredManagerReport, demoManagerReport]);

  const showDemoReport = isManager && filteredManagerReport.length === 0 && !isLoading && !errorMessage;

  const totals = useMemo(() => {
    if (isManager) {
      return displayManagerReport.reduce(
        (acc, item) => ({
          total_hours: acc.total_hours + item.total_hours,
          total_shifts: acc.total_shifts + item.total_shifts,
          total_salary: acc.total_salary + item.total_salary,
          employees: acc.employees + 1,
        }),
        { total_hours: 0, total_shifts: 0, total_salary: 0, employees: 0 }
      );
    }

    return {
      total_hours: normalizedEmployeeReport?.total_hours || 0,
      total_shifts: normalizedEmployeeReport?.total_shifts || 0,
      total_salary: normalizedEmployeeReport?.total_salary || 0,
      employees: normalizedEmployeeReport ? 1 : 0,
    };
  }, [isManager, normalizedEmployeeReport, filteredManagerReport]);

  useEffect(() => {
    if (!errorMessage && !successMessage) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setErrorMessage('');
      setSuccessMessage('');
    }, errorMessage ? 5000 : 2500);

    return () => clearTimeout(timer);
  }, [errorMessage, successMessage]);

  const loadReports = useCallback(async (range = appliedRange, options = {}) => {
    if (options.silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const requestParams = {
      ...range,
      report_type: reportMode,
      employee_search: employeeSearch,
      position: positionFilter,
      branch: branchFilter,
    };

    setErrorMessage('');

    try {
      if (isManager) {
        const data = await getEmployeeReports(requestParams);
        setManagerReport(normalizeArray(data));
      } else {
        const data = await getMyReport(requestParams);
        setEmployeeReport(data);
      }

      if (options.showSuccess) {
        setSuccessMessage(t.reportReady);
      }
    } catch (error) {
      const message = extractApiErrorMessage(error, null, language);

      if (String(message).toLowerCase().includes('permission') || String(message).includes('нет прав')) {
        setErrorMessage(t.noPermission);
      } else {
        setErrorMessage(message || t.empty);
      }

      if (isManager) {
        setManagerReport([]);
      } else {
        setEmployeeReport(null);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [appliedRange, isManager, language, t.empty, t.noPermission, t.reportReady]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReports(appliedRange);
    }, 0);

    return () => clearTimeout(timer);
  }, [appliedRange, loadReports]);

  const applyFilters = async () => {
    setAppliedRange(filterForm);
    await loadReports(filterForm, { silent: true, showSuccess: true });
  };

  const exportToExcel = () => {
    const rows = isManager
      ? displayManagerReport.map((item) => {
          const baseRow = {
            [t.employee]: item.full_name,
            [t.position]: item.position || t.unknownPosition,
            [t.branch]: item.branch || '—',
          };

          if (reportMode === 'salary') {
            return {
              ...baseRow,
              [t.hours]: item.total_hours,
              [t.salary]: item.total_salary,
            };
          }

          return {
            ...baseRow,
            [t.hours]: item.total_hours,
            [t.shifts]: item.total_shifts,
          };
        })
      : [
          {
            [t.employee]: normalizedEmployeeReport?.full_name || '',
            [t.position]: normalizedEmployeeReport?.position || t.unknownPosition,
            [t.hours]: normalizedEmployeeReport?.total_hours || 0,
            [t.shifts]: normalizedEmployeeReport?.total_shifts || 0,
            [t.salary]: normalizedEmployeeReport?.total_salary || 0,
          },
        ];

    const summaryRows = [
      { metric: t.totalHours, value: totals.total_hours },
      { metric: t.totalShifts, value: totals.total_shifts },
      { metric: t.employees, value: totals.employees },
      { metric: t.startDate, value: appliedRange.start_date },
      { metric: t.endDate, value: appliedRange.end_date },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: t.empty }]), 'Reports');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

    XLSX.writeFile(workbook, `shiftplanner_report_${appliedRange.start_date}_${appliedRange.end_date}.xlsx`);
    setSuccessMessage(t.exported);
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

  const hasManagerRows = normalizedManagerReport.length > 0 || showDemoReport;
  const hasEmployeeReport = Boolean(normalizedEmployeeReport);

  return (
    <section style={styles.page}>
      <div style={styles.shell}>
        {renderToast()}

        <header style={styles.header}>
          <div>
            <h2 style={styles.title}>{isManager ? t.title : t.selfTitle}</h2>
            <p style={styles.subtitle}>{isManager ? t.subtitleManager : t.subtitleEmployee}</p>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            style={styles.primaryButton}
            disabled={isRefreshing || (!hasManagerRows && !hasEmployeeReport)}
          >
            {t.export}
          </button>
        </header>

        <div style={styles.layout}>
          <aside style={styles.sidebar}>
            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>{t.period}</h3>

              <div style={styles.stack}>
                <Field label={t.startDate}>
                  <input
                    type="date"
                    value={filterForm.start_date}
                    onChange={(event) =>
                      setFilterForm((prev) => ({ ...prev, start_date: event.target.value }))
                    }
                    style={styles.input}
                  />
                </Field>

                <Field label={t.endDate}>
                  <input
                    type="date"
                    value={filterForm.end_date}
                    onChange={(event) =>
                      setFilterForm((prev) => ({ ...prev, end_date: event.target.value }))
                    }
                    style={styles.input}
                  />
                </Field>

                <Field label={t.reportType}>
                  <select
                    value={reportMode}
                    onChange={(event) => setReportMode(event.target.value)}
                    style={styles.select}
                  >
                    <option value="hours">{t.hoursReport}</option>
                    <option value="shifts">{t.shiftsReport}</option>
                    <option value="salary">{t.salaryReport}</option>
                  </select>
                </Field>

                <Field label={t.employee}>
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder={t.employee}
                    style={styles.input}
                  />
                </Field>

                <Field label={t.position}>
                  <input
                    type="text"
                    value={positionFilter}
                    onChange={(event) => setPositionFilter(event.target.value)}
                    placeholder={t.position}
                    style={styles.input}
                  />
                </Field>

                <Field label={t.branch}>
                  <input
                    type="text"
                    value={branchFilter}
                    onChange={(event) => setBranchFilter(event.target.value)}
                    placeholder={t.branch}
                    style={styles.input}
                  />
                </Field>

                <button
                  type="button"
                  onClick={applyFilters}
                  style={styles.secondaryButton}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? '...' : t.apply}
                </button>
              </div>
            </section>

            <section style={styles.summaryCard}>
              <h3 style={styles.panelTitle}>{t.summary}</h3>

              <Metric label={t.totalHours} value={totals.total_hours} />
              {reportMode === 'salary' ? (
                <Metric label={t.salary} value={totals.total_salary} />
              ) : (
                <Metric label={t.totalShifts} value={totals.total_shifts} />
              )}
              {isManager && <Metric label={t.employees} value={totals.employees} />}
            </section>
          </aside>

          <main style={styles.content}>
            {isManager ? (
              hasManagerRows ? (
                <div style={styles.tableCard}>
                  <div style={styles.tableHeader}>
                    <span>{t.employee}</span>
                    <span>{t.position}</span>
                    <span>{t.branch}</span>
                    <span>{t.hours}</span>
                    {reportMode !== 'salary' ? <span>{t.shifts}</span> : <span>{t.salary}</span>}
                  </div>

                  <div style={styles.tableBody}>
                    {displayManagerReport.map((item) => (
                      <div key={item.employee_id} style={styles.tableRow}>
                        <strong style={styles.employeeName}>{item.full_name}</strong>
                        <span style={styles.tableCell}>{item.position || t.unknownPosition}</span>
                        <span style={styles.tableCell}>{item.branch}</span>
                        <span style={styles.numberCell}>{item.total_hours}</span>
                        <span style={styles.numberCell}>
                          {reportMode === 'salary' ? item.total_salary : item.total_shifts}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={styles.tableFooter}>
                    <strong>{t.total}</strong>
                    <span />
                    <span />
                    <strong>{totals.total_hours}</strong>
                    <strong>{reportMode === 'salary' ? totals.total_salary : totals.total_shifts}</strong>
                  </div>
                </div>
              ) : (
                <div style={styles.emptyHero}>
                  <h3 style={styles.emptyTitle}>{t.empty}</h3>
                  <p style={styles.emptyText}>
                    {appliedRange.start_date} — {appliedRange.end_date}
                  </p>
                </div>
              )
            ) : hasEmployeeReport ? (
              <div style={styles.employeeReportCard}>
                <span style={styles.miniLabel}>{t.employee}</span>
                <h3 style={styles.employeeReportName}>{normalizedEmployeeReport.full_name}</h3>
                <p style={styles.employeePosition}>
                  {normalizedEmployeeReport.position || t.unknownPosition}
                </p>

                <div style={styles.employeeStats}>
                  <Metric label={t.hours} value={normalizedEmployeeReport.total_hours} />
                  {reportMode === 'salary' ? (
                    <Metric label={t.salary} value={normalizedEmployeeReport.total_salary} />
                  ) : (
                    <Metric label={t.shifts} value={normalizedEmployeeReport.total_shifts} />
                  )}
                </div>
              </div>
            ) : (
              <div style={styles.emptyHero}>
                <h3 style={styles.emptyTitle}>{t.empty}</h3>
                <p style={styles.emptyText}>
                  {appliedRange.start_date} — {appliedRange.end_date}
                </p>
              </div>
            )}
          </main>
        </div>
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
    width: 'min(100%, 1200px)',
    height: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: '26px',
    borderRadius: '30px',
    background: '#f4faff',
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
    maxWidth: '760px',
    margin: '6px 0 0',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: 1.45,
  },

  layout: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
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

  content: {
    minHeight: 0,
    overflow: 'hidden',
  },

  panel: {
    padding: '18px',
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
  },

  summaryCard: {
    padding: '18px',
    borderRadius: '22px',
    background: '#dee7e7',
    border: '1px solid rgba(79, 100, 111, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  panelTitle: {
    margin: '0 0 12px',
    color: '#002642',
    fontSize: '18px',
    fontWeight: '850',
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

  secondaryButton: {
    height: '42px',
    padding: '0 18px',
    background: '#dee7e7',
    border: 'none',
    borderRadius: '13px',
    color: '#002642',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  metric: {
    padding: '11px 14px',
    borderRadius: '16px',
    background: '#ffffff',
    color: '#002642',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    border: '1px solid rgba(79, 100, 111, 0.08)',
  },

  metricLabel: {
    fontSize: '12px',
    color: '#4f646f',
    fontWeight: '800',
  },

  metricValue: {
    fontSize: '20px',
    fontWeight: '900',
    color: '#002642',
  },

  tableCard: {
    height: '100%',
    minHeight: 0,
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
  },

  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr 0.7fr 0.7fr',
    gap: '10px',
    padding: '14px 16px',
    background: '#002642',
    color: '#f4faff',
    fontWeight: '900',
    fontSize: '14px',
  },

  tableBody: {
    minHeight: 0,
    overflowY: 'auto',
  },

  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr 0.7fr 0.7fr',
    gap: '10px',
    padding: '14px 16px',
    alignItems: 'center',
    borderBottom: '1px solid #dee7e7',
    color: '#002642',
  },

  employeeName: {
    overflowWrap: 'anywhere',
  },

  tableCell: {
    color: '#002642',
    fontWeight: '650',
    overflowWrap: 'anywhere',
  },

  numberCell: {
    color: '#002642',
    fontWeight: '850',
    textAlign: 'center',
  },

  tableFooter: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr 0.7fr 0.7fr',
    gap: '10px',
    padding: '14px 16px',
    background: '#dee7e7',
    color: '#002642',
    alignItems: 'center',
  },

  employeeReportCard: {
    height: '100%',
    minHeight: '360px',
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '30px',
    boxSizing: 'border-box',
  },

  miniLabel: {
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '850',
    marginBottom: '8px',
  },

  employeeReportName: {
    margin: 0,
    color: '#002642',
    fontSize: '28px',
    fontWeight: '900',
  },

  employeePosition: {
    margin: '8px 0 24px',
    color: '#4f646f',
    fontSize: '16px',
    fontWeight: '700',
  },

  employeeStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },

  emptyHero: {
    height: '100%',
    minHeight: '320px',
    padding: '28px',
    borderRadius: '24px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    textAlign: 'center',
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
