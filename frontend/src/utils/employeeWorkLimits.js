export const EMPLOYEE_WORK_LIMITS_STORAGE_KEY = 'shiftplanner_employee_work_limits';

export const DEFAULT_WEEKLY_HOURS = 40;
export const DEFAULT_DAILY_HOURS = 8;

const STORAGE_KEY = EMPLOYEE_WORK_LIMITS_STORAGE_KEY;

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getDefaultWorkLimits() {
  return {
    max_hours_per_week: DEFAULT_WEEKLY_HOURS,
    max_hours_per_day: DEFAULT_DAILY_HOURS,
  };
}

export function getStoredWorkLimits(employeeId) {
  if (employeeId == null || employeeId === '') return null;
  const stored = readStore()[String(employeeId)];
  if (!stored || typeof stored !== 'object') return null;
  return {
    max_hours_per_week: stored.max_hours_per_week ?? DEFAULT_WEEKLY_HOURS,
    max_hours_per_day: stored.max_hours_per_day ?? DEFAULT_DAILY_HOURS,
  };
}

export function setStoredWorkLimits(employeeId, limits) {
  if (employeeId == null || employeeId === '') return;
  const store = readStore();
  store[String(employeeId)] = {
    max_hours_per_week: limits.max_hours_per_week ?? DEFAULT_WEEKLY_HOURS,
    max_hours_per_day: limits.max_hours_per_day ?? DEFAULT_DAILY_HOURS,
  };
  writeStore(store);
}

export function resolveEmployeeWorkLimits(employee) {
  const stored = employee?.id != null ? getStoredWorkLimits(employee.id) : null;
  return {
    max_hours_per_week: employee?.max_hours_per_week ?? stored?.max_hours_per_week ?? DEFAULT_WEEKLY_HOURS,
    max_hours_per_day: employee?.max_hours_per_day ?? stored?.max_hours_per_day ?? DEFAULT_DAILY_HOURS,
  };
}

export function clampWorkLimits(limits) {
  const weekly = Number(limits?.max_hours_per_week);
  const daily = Number(limits?.max_hours_per_day);

  return {
    max_hours_per_week: Number.isFinite(weekly) ? Math.min(168, Math.max(1, Math.round(weekly))) : DEFAULT_WEEKLY_HOURS,
    max_hours_per_day: Number.isFinite(daily) ? Math.min(24, Math.max(1, Math.round(daily))) : DEFAULT_DAILY_HOURS,
  };
}
