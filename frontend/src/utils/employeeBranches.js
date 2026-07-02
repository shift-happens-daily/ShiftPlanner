export const EMPLOYEE_BRANCHES_STORAGE_KEY = 'shiftplanner_employee_branch_ids';
export const EMPLOYEE_BRANCHES_CHANGED_EVENT = 'shiftplanner:employee-branches-changed';

const STORAGE_KEY = EMPLOYEE_BRANCHES_STORAGE_KEY;

function notifyBranchesChanged(employeeId) {
  if (typeof window === 'undefined' || employeeId == null) return;
  window.dispatchEvent(new CustomEvent(EMPLOYEE_BRANCHES_CHANGED_EVENT, {
    detail: { employeeId: String(employeeId) },
  }));
}

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

export function getPrimaryBranchId(employee) {
  if (!employee) return null;
  if (Array.isArray(employee.branches)) {
    const primary = employee.branches.find((branch) => branch?.is_primary);
    if (primary?.id != null) return primary.id;
  }
  return employee.branch?.id ?? employee.branch_id ?? employee.branchId ?? null;
}

function normalizeBranchId(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function branchIdsFromApiList(branches) {
  if (!Array.isArray(branches) || branches.length === 0) return [];
  return branches
    .map((branch) => normalizeBranchId(branch?.id ?? branch?.branch_id ?? branch))
    .filter(Boolean);
}

export function getStoredBranchIds(employeeId) {
  if (employeeId == null || employeeId === '') return [];
  const stored = readStore()[String(employeeId)];
  return Array.isArray(stored) ? stored.map(String).filter(Boolean) : [];
}

export function setStoredBranchIds(employeeId, branchIds) {
  if (employeeId == null || employeeId === '') return;
  const store = readStore();
  const normalized = Array.from(new Set((branchIds || []).map(normalizeBranchId).filter(Boolean)));
  if (normalized.length === 0) {
    delete store[String(employeeId)];
  } else {
    store[String(employeeId)] = normalized;
  }
  writeStore(store);
  notifyBranchesChanged(employeeId);
}

export function clearStoredBranchIds(employeeId) {
  if (employeeId == null || employeeId === '') return;
  const store = readStore();
  delete store[String(employeeId)];
  writeStore(store);
  notifyBranchesChanged(employeeId);
}

export function buildUserAsEmployee(user) {
  return {
    id: user?.employeeId ?? user?.employee_id,
    branch: user?.branch,
    branches: user?.branches,
    branch_id: user?.branch_id ?? user?.branch?.id,
  };
}

export function seedUserBranchIds(user) {
  return seedStoredBranchIds(buildUserAsEmployee(user));
}

export function seedStoredBranchIds(employee) {
  if (!employee?.id) return [];
  const existing = getStoredBranchIds(employee.id);
  if (existing.length > 0) return existing;

  const apiIds = branchIdsFromApiList(employee.branches);
  if (apiIds.length > 0) {
    setStoredBranchIds(employee.id, apiIds);
    return apiIds;
  }

  const primaryId = normalizeBranchId(getPrimaryBranchId(employee));
  if (primaryId) {
    setStoredBranchIds(employee.id, [primaryId]);
    return [primaryId];
  }

  return [];
}

export function getEmployeeBranchIds(employee) {
  if (!employee) return [];

  const apiIds = branchIdsFromApiList(employee.branches);
  if (apiIds.length > 0) return apiIds;

  const primaryId = normalizeBranchId(getPrimaryBranchId(employee));
  if (primaryId) return [primaryId];

  return getStoredBranchIds(employee.id);
}

export function resolveBranchById(branchId, allBranches = [], employee = null) {
  const id = normalizeBranchId(branchId);
  if (!id) return null;

  const fromEmployee = Array.isArray(employee?.branches)
    ? employee.branches.find((branch) => normalizeBranchId(branch?.id ?? branch?.branch_id) === id)
    : null;
  if (fromEmployee) return fromEmployee;

  if (normalizeBranchId(employee?.branch?.id) === id && employee?.branch) {
    return employee.branch;
  }

  const fromList = (allBranches || []).find((branch) => normalizeBranchId(branch?.id) === id);
  if (fromList) return fromList;

  return { id: branchId, name: `#${id}` };
}

export function resolveEmployeeBranches(employee, allBranches = []) {
  return getEmployeeBranchIds(employee)
    .map((branchId) => resolveBranchById(branchId, allBranches, employee))
    .filter(Boolean);
}

export function getEmployeeBranchesLabel(employee, allBranches = []) {
  const labels = resolveEmployeeBranches(employee, allBranches)
    .map((branch) => branch.name || branch.title || branch.branch_name)
    .filter(Boolean);
  return labels.join(', ');
}

export function employeeHasBranch(employee, branchId) {
  if (!branchId) return true;
  const targetId = normalizeBranchId(branchId);
  return getEmployeeBranchIds(employee).some((id) => id === targetId);
}

export function addEmployeeBranch(employee, branchId, allBranches = []) {
  const employeeId = employee?.id;
  const nextId = normalizeBranchId(branchId);
  if (!employeeId || !nextId) return getEmployeeBranchIds(employee);

  const current = getEmployeeBranchIds(employee);
  if (current.includes(nextId)) return current;

  const next = [...current, nextId];
  setStoredBranchIds(employeeId, next);
  return next;
}

export function removeEmployeeBranch(employee, branchId) {
  const employeeId = employee?.id;
  const removeId = normalizeBranchId(branchId);
  if (!employeeId || !removeId) return getEmployeeBranchIds(employee);

  const next = getEmployeeBranchIds(employee).filter((id) => id !== removeId);
  setStoredBranchIds(employeeId, next);
  return next;
}

export function removeBranchFromAllStoredAssignments(branchId) {
  const removeId = normalizeBranchId(branchId);
  if (!removeId) return;

  const store = readStore();
  const affectedEmployeeIds = [];

  Object.keys(store).forEach((employeeId) => {
    const current = (store[employeeId] || []).map(String).filter(Boolean);
    const next = current.filter((id) => id !== removeId);
    if (next.length === current.length) return;

    affectedEmployeeIds.push(employeeId);
    if (next.length === 0) {
      delete store[employeeId];
    } else {
      store[employeeId] = next;
    }
  });

  if (affectedEmployeeIds.length === 0) return;

  writeStore(store);
  affectedEmployeeIds.forEach((employeeId) => notifyBranchesChanged(employeeId));
}

export function getUserBranchIds(user) {
  if (!user) return [];

  const apiIds = branchIdsFromApiList(user.branches);
  if (apiIds.length > 0) return apiIds;

  const primaryId = normalizeBranchId(user.branch?.id ?? user.branch_id);
  if (primaryId) return [primaryId];

  const employeeId = user.employeeId ?? user.employee_id;
  return employeeId ? getStoredBranchIds(employeeId) : [];
}

export function resolveUserBranches(user, allBranches = []) {
  const syntheticEmployee = {
    id: user?.employeeId ?? user?.employee_id,
    branch: user?.branch,
    branches: user?.branches,
    branch_id: user?.branch_id,
  };

  return getUserBranchIds(user)
    .map((branchId) => resolveBranchById(branchId, allBranches, syntheticEmployee))
    .filter(Boolean);
}

export function getUserBranchesLabel(user, allBranches = []) {
  return resolveUserBranches(user, allBranches)
    .map((branch) => branch.name || branch.title)
    .filter(Boolean)
    .join(', ');
}

export function enrichReportRowBranch(item, allBranches = []) {
  const employeeId = item?.employee_id ?? item?.id;
  const apiBranchName =
    item?.branch || item?.branch_name || item?.branch_title || item?.branch?.name || '';

  if (!employeeId) {
    return {
      branch: apiBranchName || '—',
      branchNames: apiBranchName ? [apiBranchName] : [],
    };
  }

  const syntheticEmployee = {
    id: employeeId,
    branch: typeof item?.branch === 'object' ? item.branch : null,
    branch_id: item?.branch_id,
    branches: item?.branches,
  };

  const resolved = resolveEmployeeBranches(syntheticEmployee, allBranches);
  const branchNames = resolved
    .map((branch) => branch.name || branch.title)
    .filter(Boolean);

  if (branchNames.length === 0 && apiBranchName) {
    branchNames.push(apiBranchName);
  }

  return {
    branch: branchNames.length > 0 ? branchNames.join(', ') : '—',
    branchNames,
  };
}
