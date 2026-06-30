import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getEmployeeReports, getMyReport } from '../../services/reportService';
import { listBranches } from '../../services/companyService';
import { filterRealEmployees, listEmployees } from '../../services/employeeService';
import { listPositions } from '../../services/positionService';
import { enrichReportRowBranch } from '../../utils/employeeBranches';
import { extractApiErrorMessage } from '../../services/error';
import { useTabResponsive } from '../../utils/tabResponsive';
import { formatLocalDate } from '../../services/scheduleService';

function defaultRange() {
  const today = formatLocalDate(new Date());

  return {
    start_date: today,
    end_date: today,
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

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

const DEFAULT_HOURLY_RATE = 25;

function normalizeManagerRow(item, allBranches = []) {
  const totalHours = normalizeNumber(item?.total_hours);
  const hourlyRate = normalizeNumber(item?.hourly_rate) || DEFAULT_HOURLY_RATE;
  const totalSalary = normalizeNumber(item?.total_salary) || normalizeNumber(item?.salary) || totalHours * hourlyRate;
  const branchInfo = enrichReportRowBranch(item, allBranches);

  return {
    employee_id: item?.employee_id || item?.id || item?.user_id || `${item?.full_name}-${item?.position}`,
    full_name: item?.full_name || item?.employee_name || item?.name || '—',
    position: item?.position || item?.position_title || item?.position_name || '—',
    branch: branchInfo.branch,
    branchNames: branchInfo.branchNames,
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

export default function ReportsTab({ language, userRole, user }) {
  const r = useTabResponsive(1480);
  const isManager = userRole === 'manager';
  const companyId = user?.company?.id || user?.company_id || null;

  const [filterForm, setFilterForm] = useState(defaultRange);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [reportMode, setReportMode] = useState('hours');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [companyBranches, setCompanyBranches] = useState([]);
  const [companyEmployees, setCompanyEmployees] = useState([]);
  const [companyPositions, setCompanyPositions] = useState([]);

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
      allEmployees: 'Все сотрудники',
      allPositions: 'Все позиции',
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
      allEmployees: 'All employees',
      allPositions: 'All positions',
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

  useEffect(() => {
    let cancelled = false;

    async function loadFilterOptions() {
      if (!isManager || !companyId) {
        if (!cancelled) {
          setCompanyBranches([]);
          setCompanyEmployees([]);
          setCompanyPositions([]);
        }
        return;
      }

      try {
        const [branchesData, employeesData, positionsData] = await Promise.all([
          listBranches(companyId),
          listEmployees(),
          listPositions(),
        ]);
        if (!cancelled) {
          setCompanyBranches(Array.isArray(branchesData) ? branchesData : []);
          setCompanyEmployees(filterRealEmployees(normalizeArray(employeesData)));
          setCompanyPositions(normalizeArray(positionsData));
        }
      } catch {
        if (!cancelled) {
          setCompanyBranches([]);
          setCompanyEmployees([]);
          setCompanyPositions([]);
        }
      }
    }

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [companyId, isManager]);

  const normalizedManagerReport = useMemo(
    () => normalizeArray(managerReport).map((item) => normalizeManagerRow(item, companyBranches)),
    [managerReport, companyBranches]
  );

  const filteredManagerReport = useMemo(() => {
    return normalizedManagerReport.filter((item) => {
      const matchesEmployee = !employeeSearch || item.full_name.toLowerCase().includes(employeeSearch.toLowerCase());
      const matchesPosition = !positionFilter || item.position.toLowerCase().includes(positionFilter.toLowerCase());
      const matchesBranch = !branchFilter || item.branch.toLowerCase().includes(branchFilter.toLowerCase());
      return matchesEmployee && matchesPosition && matchesBranch;
    });
  }, [normalizedManagerReport, employeeSearch, positionFilter, branchFilter]);

  const employeeFilterOptions = useMemo(() => {
    const fromEmployees = companyEmployees.map((employee) => employee.full_name || employee.name || employee.email);
    const fromReport = normalizedManagerReport.map((item) => item.full_name);
    return uniqueSorted([...fromEmployees, ...fromReport]);
  }, [companyEmployees, normalizedManagerReport]);

  const positionFilterOptions = useMemo(() => {
    const fromPositions = companyPositions.map((position) => position.title || position.name);
    const fromReport = normalizedManagerReport.map((item) => item.position);
    return uniqueSorted([...fromPositions, ...fromReport]);
  }, [companyPositions, normalizedManagerReport]);

  const branchFilterOptions = useMemo(() => {
    const fromBranches = companyBranches.map((branch) => branch.name || branch.title);
    const fromReport = normalizedManagerReport.flatMap((item) => item.branchNames || item.branch);
    return uniqueSorted([...fromBranches, ...fromReport]);
  }, [companyBranches, normalizedManagerReport]);

  const normalizedEmployeeReport = useMemo(
    () => normalizeEmployeeReport(employeeReport),
    [employeeReport]
  );

  const totals = useMemo(() => {
    if (isManager) {
      return filteredManagerReport.reduce(
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
  }, [
    appliedRange,
    isManager,
    language,
    reportMode,
    t.empty,
    t.noPermission,
    t.reportReady,
  ]);

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
      ? filteredManagerReport.map((item) => {
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
          };
        })
      : [
          {
            [t.employee]: normalizedEmployeeReport?.full_name || '',
            [t.position]: normalizedEmployeeReport?.position || t.unknownPosition,
            [t.hours]: normalizedEmployeeReport?.total_hours || 0,
            ...(reportMode === 'salary'
              ? { [t.salary]: normalizedEmployeeReport?.total_salary || 0 }
              : {}),
          },
        ];

    const summaryRows = [
      { metric: t.totalHours, value: totals.total_hours },
      ...(reportMode === 'salary'
        ? [{ metric: t.salary, value: totals.total_salary }]
        : []),
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
      <section style={{ ...styles.page, ...r.page, ...(r.isMobile ? {} : styles.desktopPage) }}>
        <div style={{ ...styles.shell, ...r.shell, ...(r.isMobile ? {} : styles.desktopShell) }}>
          <div style={styles.emptyBox}>{t.loading}</div>
        </div>
      </section>
    );
  }

  const hasManagerRows = filteredManagerReport.length > 0;
  const hasEmployeeReport = Boolean(normalizedEmployeeReport);
  const tableColumns = reportMode === 'salary'
    ? '1.2fr 1fr 0.8fr 0.7fr 0.7fr'
    : '1.2fr 1fr 0.8fr 0.7fr';

  return (
    <section style={{ ...styles.page, ...r.page, ...(r.isMobile ? {} : styles.desktopPage) }}>
      <div style={{ ...styles.shell, ...r.shell, ...(r.isMobile ? {} : styles.desktopShell) }}>
        {renderToast()}

        <header style={{ ...styles.header, ...r.header }}>
          <div>
            <h2 style={{ ...styles.title, ...r.title }}>{isManager ? t.title : t.selfTitle}</h2>
            <p style={styles.subtitle}>{isManager ? t.subtitleManager : t.subtitleEmployee}</p>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            style={{ ...styles.primaryButton, ...r.fullWidth }}
            disabled={isRefreshing || (!hasManagerRows && !hasEmployeeReport)}
          >
            {t.export}
          </button>
        </header>

        <div style={{ ...styles.layout, ...r.splitLayout('280px minmax(0, 1fr)') }}>
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
                    style={styles.dateInput}
                  />
                </Field>

                <Field label={t.endDate}>
                  <input
                    type="date"
                    value={filterForm.end_date}
                    onChange={(event) =>
                      setFilterForm((prev) => ({ ...prev, end_date: event.target.value }))
                    }
                    style={styles.dateInput}
                  />
                </Field>

                <Field label={t.reportType}>
                  <div style={{ ...styles.modeSegment, ...r.modeSegment }}>
                    {[
                      { id: 'hours', label: t.hoursReport },
                      { id: 'salary', label: t.salaryReport },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setReportMode(mode.id)}
                        style={
                          reportMode === mode.id
                            ? { ...styles.modeButton, ...styles.modeButtonActive, ...r.modeButton }
                            : { ...styles.modeButton, ...r.modeButton }
                        }
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </Field>
                {isManager && (
                  <>
                    <Field label={t.employee}>
                      <select
                        value={employeeSearch}
                        onChange={(event) => setEmployeeSearch(event.target.value)}
                        style={styles.select}
                      >
                        <option value="">{t.allEmployees}</option>
                        {employeeFilterOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t.position}>
                      <select
                        value={positionFilter}
                        onChange={(event) => setPositionFilter(event.target.value)}
                        style={styles.select}
                      >
                        <option value="">{t.allPositions}</option>
                        {positionFilterOptions.map((position) => (
                          <option key={position} value={position}>{position}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label={t.branch}>
                      <select
                        value={branchFilter}
                        onChange={(event) => setBranchFilter(event.target.value)}
                        style={styles.select}
                      >
                        <option value="">{t.allBranches}</option>
                        {branchFilterOptions.map((branch) => (
                          <option key={branch} value={branch}>{branch}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}

                <button
                  type="button"
                  onClick={applyFilters}
                  style={{ ...styles.secondaryButton, ...r.fullWidth }}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? '...' : t.apply}
                </button>
              </div>
            </section>

            <section style={styles.summaryCard}>
              <h3 style={styles.summaryTitle}>{t.summary}</h3>

              <Metric label={t.totalHours} value={totals.total_hours} />
              {reportMode === 'salary' && (
                <Metric label={t.salary} value={totals.total_salary} />
              )}
              {isManager && <Metric label={t.employees} value={totals.employees} />}
            </section>
          </aside>

          <main style={{ ...styles.content, ...(r.isMobile ? { overflow: 'visible' } : {}) }}>
            {isManager ? (
              hasManagerRows ? (
                r.isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredManagerReport.map((item) => (
                      <div key={item.employee_id} style={r.reportCard}>
                        <strong style={{ color: '#002642', fontSize: 16 }}>{item.full_name}</strong>
                        <div style={r.reportCardRow}>
                          <span>{t.position}</span>
                          <span style={r.reportCardValue}>{item.position || t.unknownPosition}</span>
                        </div>
                        <div style={r.reportCardRow}>
                          <span>{t.branch}</span>
                          <span style={r.reportCardValue}>{item.branch}</span>
                        </div>
                        <div style={r.reportCardRow}>
                          <span>{t.hours}</span>
                          <span style={r.reportCardValue}>{item.total_hours}</span>
                        </div>
                        {reportMode === 'salary' && (
                          <div style={r.reportCardRow}>
                            <span>{t.salary}</span>
                            <span style={r.reportCardValue}>{item.total_salary}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{
                      ...r.reportCard,
                      background: '#dee7e7',
                      border: '1px solid rgba(79, 100, 111, 0.12)',
                    }}
                    >
                      <strong style={{ color: '#002642' }}>{t.total}</strong>
                      <div style={r.reportCardRow}>
                        <span>{t.hours}</span>
                        <span style={r.reportCardValue}>{totals.total_hours}</span>
                      </div>
                      {reportMode === 'salary' && (
                        <div style={r.reportCardRow}>
                          <span>{t.salary}</span>
                          <span style={r.reportCardValue}>{totals.total_salary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                <div style={styles.tableCard}>
                  <div style={{ ...styles.tableHeader, gridTemplateColumns: tableColumns }}>
                    <span>{t.employee}</span>
                    <span>{t.position}</span>
                    <span>{t.branch}</span>
                    <span>{t.hours}</span>
                    {reportMode === 'salary' && <span>{t.salary}</span>}
                  </div>

                  <div style={styles.tableBody}>
                    {filteredManagerReport.map((item) => (
                      <div key={item.employee_id} style={{ ...styles.tableRow, gridTemplateColumns: tableColumns }}>
                        <strong style={styles.employeeName}>{item.full_name}</strong>
                        <span style={styles.tableCell}>{item.position || t.unknownPosition}</span>
                        <span style={styles.tableCell}>{item.branch}</span>
                        <span style={styles.numberCell}>{item.total_hours}</span>
                        {reportMode === 'salary' && (
                          <span style={styles.numberCell}>{item.total_salary}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ ...styles.tableFooter, gridTemplateColumns: tableColumns }}>
                    <strong>{t.total}</strong>
                    <span />
                    <span />
                    <strong>{totals.total_hours}</strong>
                    {reportMode === 'salary' && <strong>{totals.total_salary}</strong>}
                  </div>
                </div>
                )
              ) : (
                <div style={styles.emptyHero}>
                  <h3 style={styles.emptyTitle}>{t.empty}</h3>
                  <p style={styles.emptyText}>
                    {appliedRange.start_date} — {appliedRange.end_date}
                  </p>
                </div>
              )
            ) : hasEmployeeReport ? (
              <div style={{
                ...styles.employeeReportCard,
                ...(r.isMobile ? { minHeight: 0, padding: 20 } : {}),
              }}
              >
                <div style={styles.employeeReportHeader}>
                  <div>
                    <span style={styles.miniLabel}>
                      {appliedRange.start_date} — {appliedRange.end_date}
                    </span>
                  </div>
                  <span style={styles.employeeReportPill}>{reportMode === 'salary' ? t.salaryReport : t.hoursReport}</span>
                </div>

                <div style={{
                  ...styles.employeeStats,
                  ...(r.isMobile ? { gridTemplateColumns: '1fr' } : {}),
                }}
                >
                  <Metric label={t.totalHours} value={normalizedEmployeeReport.total_hours} />
                  <Metric label={t.totalShifts} value={normalizedEmployeeReport.total_shifts} />
                  {reportMode === 'salary' && (
                    <Metric label={t.salary} value={normalizedEmployeeReport.total_salary} />
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
    padding: '16px 24px 18px',
    overflow: 'hidden',
    background: '#f4faff',
  },

  desktopPage: {
    height: 'calc(100dvh - 96px)',
  },

  shell: {
    width: '100%',
    height: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: 0,
    borderRadius: 0,
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflow: 'hidden',
    position: 'relative',
  },

  desktopShell: {
    width: '100%',
    padding: 0,
    borderRadius: 0,
  },

  header: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 18,
    marginBottom: 0,
  },

  title: {
    margin: 0,
    color: '#002642',
    fontSize: '28px',
    fontWeight: '900',
    letterSpacing: 0,
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
    gap: 14,
    overflow: 'hidden',
  },

  sidebar: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflowY: 'auto',
  },

  content: {
    minHeight: 0,
    overflow: 'hidden',
  },

  panel: {
    padding: '16px',
    borderRadius: 12,
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 10px 24px rgba(0, 38, 66, 0.035)',
  },

  summaryCard: {
    padding: '16px',
    borderRadius: 12,
    background: '#002642',
    border: '1px solid #dee7e7',
    boxShadow: '0 10px 24px rgba(0, 38, 66, 0.035)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  panelTitle: {
    margin: '0 0 12px',
    color: 'inherit',
    fontSize: '18px',
    fontWeight: '850',
  },

  summaryTitle: {
    margin: '0 0 2px',
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: '900',
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
    height: 40,
    boxSizing: 'border-box',
    borderRadius: 10,
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 13px',
    color: '#002642',
    fontSize: '14px',
    outline: 'none',
  },

  select: {
    width: '100%',
    height: 40,
    boxSizing: 'border-box',
    borderRadius: 10,
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 13px',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '700',
    outline: 'none',
    cursor: 'pointer',
  },

  dateInput: {
    width: '100%',
    height: 40,
    boxSizing: 'border-box',
    borderRadius: 10,
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 13px',
    color: '#002642',
    colorScheme: 'light',
    fontSize: '14px',
    fontWeight: '700',
    outline: 'none',
    cursor: 'pointer',
  },

  modeSegment: {
    display: 'flex',
    borderRadius: 10,
    background: '#dee7e7',
    padding: '4px',
    gap: '4px',
  },

  modeButton: {
    flex: 1,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#4f646f',
    padding: '8px 4px',
    fontSize: '12px',
    fontWeight: '750',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  modeButtonActive: {
    background: '#ffffff',
    color: '#002642',
    boxShadow: 'none',
  },

  primaryButton: {
    height: 40,
    padding: '0 18px',
    background: '#002642',
    border: 'none',
    borderRadius: 10,
    color: '#f4faff',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  secondaryButton: {
    height: 40,
    padding: '0 18px',
    background: '#dee7e7',
    border: '1px solid #dee7e7',
    borderRadius: 10,
    color: '#002642',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  metric: {
    padding: '12px 14px',
    borderRadius: 10,
    background: '#f8fbfd',
    color: '#002642',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    border: '1px solid #edf2f2',
  },

  metricLabel: {
    fontSize: '12px',
    color: 'currentColor',
    opacity: 0.72,
    fontWeight: '800',
  },

  metricValue: {
    fontSize: '20px',
    fontWeight: '900',
    color: 'currentColor',
  },

  tableCard: {
    height: '100%',
    minHeight: 0,
    borderRadius: 12,
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 10px 24px rgba(0, 38, 66, 0.035)',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
  },

  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr 0.7fr 0.7fr',
    gap: '10px',
    padding: '13px 16px',
    background: '#002642',
    fontWeight: '900',
    fontSize: '13px',
    color: '#ffffff',
  },

  tableBody: {
    minHeight: 0,
    overflowY: 'auto',
  },

  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr 0.7fr 0.7fr',
    gap: '10px',
    padding: '13px 16px',
    alignItems: 'center',
    borderBottom: '1px solid #edf2f2',
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
    padding: '12px 16px',
    background: '#f8fbfd',
    color: '#002642',
    alignItems: 'center',
  },

  employeeReportCard: {
    height: '100%',
    minHeight: '360px',
    borderRadius: 12,
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 10px 24px rgba(0, 38, 66, 0.035)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '22px',
    padding: '28px',
    boxSizing: 'border-box',
  },

  employeeReportHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },

  employeeReportPill: {
    height: '34px',
    padding: '0 12px',
    borderRadius: '999px',
    background: '#f4faff',
    border: '1px solid #dee7e7',
    color: '#002642',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '850',
    whiteSpace: 'nowrap',
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
    fontSize: '30px',
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
    borderRadius: 14,
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
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
    borderRadius: 14,
    background: '#ffffff',
    border: '1px solid #dee7e7',
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
