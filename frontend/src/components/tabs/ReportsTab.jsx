import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getEmployeeReports, getMyReport } from '../../services/reportService';
import { listBranches } from '../../services/companyService';
import { filterRealEmployees, listEmployees } from '../../services/employeeService';
import { listPositions } from '../../services/positionService';
import { enrichReportRowBranch, getEmployeeBranchesLabel, getUserBranchesLabel, resolveEmployeeBranches } from '../../utils/employeeBranches';
import { getEmployeePositionLabel, getPositionLabel } from '../../utils/employeeDisplay';
import { extractApiErrorMessage } from '../../services/error';
import { POSITION_TITLES_CHANGED_EVENT } from '../../services/positionService';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { formatLocalDate } from '../../services/scheduleService';
import { CHECK_MARK, CLOSE_MARK, EM_DASH, formatDateRange } from '../../utils/textSymbols';
import { formatApiDateAsDisplay } from '../../utils/dateDisplay';
import DateField from '../ui/DateField';
import '../../styles/reports-tab.css';

function defaultRange() {
  const today = formatLocalDate(new Date());

  return {
    start_date: today,
    end_date: today,
  };
}

function formatHoursValue(value) {
  const hours = normalizeNumber(value);
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

function formatPeriodLabel(startDate, endDate) {
  return formatDateRange(startDate, endDate);
}

function formatAvgShiftLength(totalHours, totalShifts) {
  if (!totalShifts) return '0h';
  return `${(totalHours / totalShifts).toFixed(1)}h`;
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 19V17C16 15.3431 14.6569 14 13 14H7C5.34315 14 4 15.3431 4 17V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M20 19V17C20 15.9391 19.5786 14.9217 18.8284 14.1716" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 4.13C16.8604 4.35031 17.623 4.85071 18.1679 5.55232C18.7128 6.25392 19.0078 7.11683 19.0078 8.005C19.0078 8.89317 18.7128 9.75608 18.1679 10.4577C17.623 11.1593 16.8604 11.6597 16 11.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 14L8 10L12 14L16 8L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 11L12 15L16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const STAT_TONES = {
  blue: { background: '#eff6ff', color: '#2563eb' },
  violet: { background: '#f5f3ff', color: '#7c3aed' },
  amber: { background: '#fffbeb', color: '#d97706' },
  emerald: { background: '#ecfdf5', color: '#059669' },
};

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

function unwrapReportPayload(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.length ? value[0] : null;
  if (value?.report && typeof value.report === 'object') return value.report;
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) return value.data;
  return value;
}

function normalizeManagerRow(item, allBranches = [], employeesById = {}) {
  const totalHours = normalizeNumber(item?.total_hours);
  const employeeId = item?.employee_id || item?.id || item?.user_id;
  const employee = employeesById[String(employeeId)] || null;
  const branchInfo = employee
    ? {
      branch: getEmployeeBranchesLabel(employee, allBranches) || EM_DASH,
      branchNames: resolveEmployeeBranches(employee, allBranches)
        .map((branch) => branch.name || branch.title || branch.branch_name)
        .filter(Boolean),
    }
    : enrichReportRowBranch(item, allBranches);
  const position = employee
    ? getEmployeePositionLabel(employee, item?.position || item?.position_title || item?.position_name || EM_DASH)
    : getPositionLabel({
      position_title: item?.position || item?.position_title || item?.position_name,
    }, EM_DASH);

  return {
    employee_id: employeeId || `${item?.full_name}-${item?.position}`,
    full_name: item?.full_name || item?.employee_name || item?.name || EM_DASH,
    position,
    branch: branchInfo.branch,
    branchNames: branchInfo.branchNames,
    total_hours: totalHours,
    total_shifts: normalizeNumber(item?.total_shifts),
  };
}

function normalizeEmployeeReport(report, user) {
  const payload = unwrapReportPayload(report);
  if (!payload) {
    return null;
  }

  const totalHours = normalizeNumber(payload.total_hours);
  const position = user
    ? getEmployeePositionLabel(user, payload.position || payload.position_title || payload.position_name || EM_DASH)
    : getPositionLabel({
      position_title: payload.position || payload.position_title || payload.position_name,
    }, EM_DASH);

  return {
    full_name: payload.full_name || payload.employee_name || payload.name || user?.fullName || user?.full_name || EM_DASH,
    position,
    branches: getUserBranchesLabel(user) || EM_DASH,
    total_hours: totalHours,
    total_shifts: normalizeNumber(payload.total_shifts),
  };
}

function StatCard({ icon: Icon, tone, value, label, sub }) {
  const toneStyle = STAT_TONES[tone] || STAT_TONES.blue;

  return (
    <div className="rt-stat-card">
      <div className="rt-stat-icon" style={{ background: toneStyle.background, color: toneStyle.color }}>
        <Icon />
      </div>
      <p className="rt-stat-value">{value}</p>
      <p className="rt-stat-label">{label}</p>
      {sub ? <p className="rt-stat-sub">{sub}</p> : null}
    </div>
  );
}

export default function ReportsTab({ language, userRole, user }) {
  const isMobile = useIsMobile();
  const isManager = userRole === 'manager';
  const companyId = user?.company?.id || user?.company_id || null;

  const [filterForm, setFilterForm] = useState(defaultRange);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [companyBranches, setCompanyBranches] = useState([]);
  const [companyEmployees, setCompanyEmployees] = useState([]);
  const [companyPositions, setCompanyPositions] = useState([]);
  const [positionTitlesRevision, setPositionTitlesRevision] = useState(0);

  const [managerReport, setManagerReport] = useState([]);
  const [employeeReport, setEmployeeReport] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      title: 'Отчёты',
      selfTitle: 'Мой отчёт',
      subtitleManager: 'Сводка по часам и сменам за выбранный период.',
      subtitleEmployee: 'Ваши часы и смены за выбранный период.',
      period: 'Период',
      startDate: 'Дата начала',
      endDate: 'Дата окончания',
      apply: 'Показать отчёт',
      employee: 'Сотрудник',
      position: 'Позиция',
      hours: 'Часы',
      shifts: 'Смены',
      branch: 'Филиал',
      allBranches: 'Все филиалы',
      allEmployees: 'Все сотрудники',
      allPositions: 'Все позиции',
      hoursReport: 'По часам',
      total: 'Итого',
      export: 'Скачать XLSX',
      loading: 'Загрузка...',
      empty: 'Нет данных за выбранный период.',
      unknownPosition: 'Не указана',
      reportReady: 'Отчёт обновлён.',
      exported: 'Отчёт сохранён в формате XLSX.',
      summary: 'Сводка',
      totalHours: 'Всего часов',
      totalShifts: 'Всего смен',
      avgShift: 'Средняя длительность смены',
      perShift: 'за смену',
      employees: 'Сотрудники',
      noPermission:
        'У вас нет доступа к этому отчёту. Проверьте роль аккаунта или откройте личный отчёт.',
    },
    en: {
      title: 'Reports',
      selfTitle: 'My Report',
      subtitleManager: 'Summary of hours and shifts for the selected period.',
      subtitleEmployee: 'Your hours and shifts for the selected period.',
      period: 'Period',
      startDate: 'Start date',
      endDate: 'End date',
      apply: 'Show report',
      employee: 'Employee',
      position: 'Position',
      hours: 'Hours',
      shifts: 'Shifts',
      branch: 'Branch',
      allBranches: 'All branches',
      allEmployees: 'All employees',
      allPositions: 'All positions',
      hoursReport: 'Hours report',
      total: 'Total',
      export: 'Download XLSX',
      loading: 'Loading...',
      empty: 'No data for the selected period.',
      unknownPosition: 'Not specified',
      reportReady: 'Report updated.',
      exported: 'Report saved as XLSX.',
      summary: 'Summary',
      totalHours: 'Total hours',
      totalShifts: 'Total shifts',
      avgShift: 'Average shift length',
      perShift: 'per shift',
      employees: 'Employees',
      noPermission:
        'You do not have access to this report. Check your account role or open your personal report.',
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

  useEffect(() => {
    function handlePositionTitlesChanged() {
      setPositionTitlesRevision((value) => value + 1);
    }

    window.addEventListener(POSITION_TITLES_CHANGED_EVENT, handlePositionTitlesChanged);
    return () => window.removeEventListener(POSITION_TITLES_CHANGED_EVENT, handlePositionTitlesChanged);
  }, []);

  const employeesById = useMemo(() => {
    return Object.fromEntries(
      companyEmployees.map((employee) => [String(employee.id), employee])
    );
  }, [companyEmployees]);

  const normalizedManagerReport = useMemo(
    () => normalizeArray(managerReport).map((item) => normalizeManagerRow(item, companyBranches, employeesById)),
    [managerReport, companyBranches, employeesById, positionTitlesRevision]
  );

  const filteredManagerReport = useMemo(() => {
    return normalizedManagerReport.filter((item) => {
      const matchesEmployee = !employeeSearch || item.full_name.toLowerCase().includes(employeeSearch.toLowerCase());
      const matchesPosition = !positionFilter || item.position.toLowerCase().includes(positionFilter.toLowerCase());
      const matchesBranch = !branchFilter || (
        (item.branchNames || []).some((name) => name.toLowerCase() === branchFilter.toLowerCase())
        || item.branch.toLowerCase().includes(branchFilter.toLowerCase())
      );
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
    () => normalizeEmployeeReport(employeeReport, user),
    [employeeReport, user, positionTitlesRevision]
  );

  const totals = useMemo(() => {
    if (isManager) {
      return filteredManagerReport.reduce(
        (acc, item) => ({
          total_hours: acc.total_hours + item.total_hours,
          total_shifts: acc.total_shifts + item.total_shifts,
          employees: acc.employees + 1,
        }),
        { total_hours: 0, total_shifts: 0, employees: 0 }
      );
    }

    return {
      total_hours: normalizedEmployeeReport?.total_hours || 0,
      total_shifts: normalizedEmployeeReport?.total_shifts || 0,
      employees: normalizedEmployeeReport ? 1 : 0,
    };
  }, [isManager, normalizedEmployeeReport, filteredManagerReport]);

  const periodSub = formatPeriodLabel(appliedRange.start_date, appliedRange.end_date);

  const statsCards = useMemo(() => {
    const cards = [
      {
        key: 'hours',
        icon: IconClock,
        tone: 'blue',
        value: formatHoursValue(totals.total_hours),
        label: t.totalHours,
        sub: periodSub,
      },
      {
        key: 'shifts',
        icon: IconCheckCircle,
        tone: 'violet',
        value: String(totals.total_shifts),
        label: t.totalShifts,
        sub: periodSub,
      },
    ];

    if (isManager) {
      cards.push(
        {
          key: 'employees',
          icon: IconUsers,
          tone: 'emerald',
          value: String(totals.employees),
          label: t.employees,
          sub: periodSub,
        },
        {
          key: 'avg',
          icon: IconActivity,
          tone: 'amber',
          value: formatAvgShiftLength(totals.total_hours, totals.total_shifts),
          label: t.avgShift,
          sub: t.perShift,
        }
      );
    } else {
      cards.push({
        key: 'avg',
        icon: IconActivity,
        tone: 'amber',
        value: formatAvgShiftLength(totals.total_hours, totals.total_shifts),
        label: t.avgShift,
        sub: t.perShift,
      });
    }

    return cards;
  }, [isManager, periodSub, t, totals]);

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
      report_type: 'hours',
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
      ? filteredManagerReport.map((item) => ({
          [t.employee]: item.full_name,
          [t.position]: item.position || t.unknownPosition,
          [t.branch]: item.branch || EM_DASH,
          [t.hours]: item.total_hours,
          [t.shifts]: item.total_shifts,
        }))
      : [
          {
            [t.employee]: normalizedEmployeeReport?.full_name || '',
            [t.position]: normalizedEmployeeReport?.position || t.unknownPosition,
            [t.hours]: normalizedEmployeeReport?.total_hours || 0,
            [t.shifts]: normalizedEmployeeReport?.total_shifts || 0,
          },
        ];

    const summaryRows = [
      { metric: t.totalHours, value: totals.total_hours },
      { metric: t.totalShifts, value: totals.total_shifts },
      { metric: t.employees, value: totals.employees },
      { metric: t.startDate, value: formatApiDateAsDisplay(appliedRange.start_date) },
      { metric: t.endDate, value: formatApiDateAsDisplay(appliedRange.end_date) },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: t.empty }]), 'Reports');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

    XLSX.writeFile(workbook, `shiftplanner_report_${appliedRange.start_date}_${appliedRange.end_date}.xlsx`);
    setSuccessMessage(t.exported);
  };

  const renderToast = () => (
    (errorMessage || successMessage) && (
      <div className="rt-toast-layer">
        <div className={`rt-toast${errorMessage ? ' rt-toast--error' : ''}`}>
          <span className="rt-toast-icon">
            {errorMessage ? '!' : CHECK_MARK}
          </span>

          <span className="rt-toast-text">{errorMessage || successMessage}</span>

          <button
            type="button"
            onClick={() => {
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className="rt-toast-close"
            aria-label="Close notification"
          >
            {CLOSE_MARK}
          </button>
        </div>
      </div>
    )
  );

  const renderFilters = () => (
    <div className={`rt-filters-grid ${isManager ? 'rt-filters-grid--manager' : 'rt-filters-grid--employee'}`}>
      <label className="rt-field">
        <span className="rt-label">{t.startDate}</span>
        <DateField
          language={language}
          className="rt-input"
          value={filterForm.start_date}
          onChange={(nextValue) =>
            setFilterForm((prev) => ({ ...prev, start_date: nextValue }))
          }
        />
      </label>

      <label className="rt-field">
        <span className="rt-label">{t.endDate}</span>
        <DateField
          language={language}
          className="rt-input"
          value={filterForm.end_date}
          onChange={(nextValue) =>
            setFilterForm((prev) => ({ ...prev, end_date: nextValue }))
          }
        />
      </label>

      {isManager ? (
        <>
          <label className="rt-field">
            <span className="rt-label">{t.employee}</span>
            <select
              className="rt-select"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
            >
              <option value="">{t.allEmployees}</option>
              {employeeFilterOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="rt-field">
            <span className="rt-label">{t.position}</span>
            <select
              className="rt-select"
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
            >
              <option value="">{t.allPositions}</option>
              {positionFilterOptions.map((position) => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </label>

          <label className="rt-field">
            <span className="rt-label">{t.branch}</span>
            <select
              className="rt-select"
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
            >
              <option value="">{t.allBranches}</option>
              {branchFilterOptions.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <button
        type="button"
        onClick={applyFilters}
        className="rt-btn rt-btn-secondary"
        disabled={isRefreshing}
      >
        {isRefreshing ? '...' : t.apply}
      </button>
    </div>
  );

  const renderManagerContent = () => {
    if (!hasManagerRows) {
      return (
        <div className="rt-empty">
          <h3 className="rt-empty-title">{t.empty}</h3>
          <p className="rt-empty-text">{periodSub}</p>
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="rt-mobile-list">
          {filteredManagerReport.map((item) => (
            <div key={item.employee_id} className="rt-mobile-card">
              <strong className="rt-employee-name">{item.full_name}</strong>
              <div className="rt-mobile-row">
                <span>{t.position}</span>
                <span>{item.position || t.unknownPosition}</span>
              </div>
              <div className="rt-mobile-row">
                <span>{t.branch}</span>
                <span>{item.branch}</span>
              </div>
              <div className="rt-mobile-row">
                <span>{t.hours}</span>
                <span>{item.total_hours}</span>
              </div>
              <div className="rt-mobile-row">
                <span>{t.shifts}</span>
                <span>{item.total_shifts}</span>
              </div>
            </div>
          ))}
          <div className="rt-mobile-card rt-mobile-card--total">
            <strong className="rt-employee-name">{t.total}</strong>
            <div className="rt-mobile-row">
              <span>{t.hours}</span>
              <span>{totals.total_hours}</span>
            </div>
            <div className="rt-mobile-row">
              <span>{t.shifts}</span>
              <span>{totals.total_shifts}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rt-table-wrap">
        <table className="rt-table">
          <thead>
            <tr>
              <th>{t.employee}</th>
              <th>{t.position}</th>
              <th>{t.branch}</th>
              <th>{t.hours}</th>
              <th>{t.shifts}</th>
            </tr>
          </thead>
          <tbody>
            {filteredManagerReport.map((item) => (
              <tr key={item.employee_id}>
                <td className="rt-employee-name">{item.full_name}</td>
                <td>{item.position || t.unknownPosition}</td>
                <td>{item.branch}</td>
                <td className="rt-number">{item.total_hours}</td>
                <td className="rt-number">{item.total_shifts}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t.total}</td>
              <td />
              <td />
              <td className="rt-number">{totals.total_hours}</td>
              <td className="rt-number">{totals.total_shifts}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderEmployeeContent = () => {
    if (!hasEmployeeReport) {
      return (
        <div className="rt-empty">
          <h3 className="rt-empty-title">{t.empty}</h3>
          <p className="rt-empty-text">{periodSub}</p>
        </div>
      );
    }

    return (
      <div className="rt-employee-panel">
        <div className="rt-employee-header">
          <div>
            <h3 className="rt-employee-name-lg">{normalizedEmployeeReport.full_name}</h3>
            <p className="rt-employee-meta">
              {normalizedEmployeeReport.position || t.unknownPosition}
            </p>
            <p className="rt-employee-meta">
              {t.branch}: {normalizedEmployeeReport.branches || EM_DASH}
            </p>
          </div>
          <span className="rt-pill">{t.hoursReport}</span>
        </div>

        {!hasEmployeeData ? (
          <div className="rt-empty">
            <p className="rt-empty-text">{t.empty}</p>
          </div>
        ) : null}
      </div>
    );
  };

  if (isLoading) {
    return (
      <section className="reports-tab">
        <div className="rt-page">
          <div className="rt-loading">{t.loading}</div>
        </div>
      </section>
    );
  }

  const hasManagerRows = filteredManagerReport.length > 0;
  const hasEmployeeReport = normalizedEmployeeReport != null;
  const hasEmployeeData = hasEmployeeReport && (
    normalizedEmployeeReport.total_hours > 0
    || normalizedEmployeeReport.total_shifts > 0
  );

  return (
    <section className="reports-tab">
      <div className="rt-page">
        {renderToast()}

        <header className="rt-header">
          <div>
            <h1 className="rt-title">{isManager ? t.title : t.selfTitle}</h1>
            <p className="rt-subtitle">{isManager ? t.subtitleManager : t.subtitleEmployee}</p>
          </div>

          <div className="rt-header-actions">
            <button
              type="button"
              onClick={exportToExcel}
              className="rt-btn rt-btn-primary"
              disabled={isRefreshing || (!hasManagerRows && !hasEmployeeReport)}
            >
              <IconDownload />
              {t.export}
            </button>
          </div>
        </header>

        <div className={`rt-stats-grid${isManager ? '' : ' rt-stats-grid--employee'}`}>
          {statsCards.map((card) => (
            <StatCard
              key={card.key}
              icon={card.icon}
              tone={card.tone}
              value={card.value}
              label={card.label}
              sub={card.sub}
            />
          ))}
        </div>

        <div className="rt-card rt-card-padded">
          <h2 className="rt-card-title">{t.period}</h2>
          {renderFilters()}
        </div>

        <div className="rt-card">
          {isManager ? renderManagerContent() : renderEmployeeContent()}
        </div>
      </div>
    </section>
  );
}
