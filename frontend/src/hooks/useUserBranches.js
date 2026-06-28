import { useEffect, useMemo, useState } from 'react';
import { listBranches } from '../services/companyService';
import {
  EMPLOYEE_BRANCHES_CHANGED_EVENT,
  EMPLOYEE_BRANCHES_STORAGE_KEY,
  getUserBranchesLabel,
  resolveUserBranches,
  seedUserBranchIds,
} from '../utils/employeeBranches';

export function useUserBranches(user) {
  const [companyBranches, setCompanyBranches] = useState([]);
  const [revision, setRevision] = useState(0);

  const employeeId = user?.employeeId ?? user?.employee_id ?? null;
  const companyId = user?.company?.id || user?.company_id || null;
  const hasCompany = Boolean(companyId);

  useEffect(() => {
    if (!hasCompany) {
      setCompanyBranches([]);
      return undefined;
    }

    let cancelled = false;

    async function loadBranches() {
      try {
        const data = await listBranches(companyId);
        if (!cancelled) {
          setCompanyBranches(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setCompanyBranches([]);
        }
      }
    }

    void loadBranches();

    return () => {
      cancelled = true;
    };
  }, [companyId, hasCompany]);

  useEffect(() => {
    function bumpRevision() {
      setRevision((value) => value + 1);
    }

    function handleStorage(event) {
      if (event.key === EMPLOYEE_BRANCHES_STORAGE_KEY || event.key === null) {
        bumpRevision();
      }
    }

    function handleBranchesChanged(event) {
      const changedEmployeeId = event.detail?.employeeId;
      if (!employeeId || !changedEmployeeId || changedEmployeeId === String(employeeId)) {
        bumpRevision();
      }
    }

    window.addEventListener('storage', handleStorage);
    window.addEventListener(EMPLOYEE_BRANCHES_CHANGED_EVENT, handleBranchesChanged);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(EMPLOYEE_BRANCHES_CHANGED_EVENT, handleBranchesChanged);
    };
  }, [employeeId]);

  const userBranches = useMemo(() => {
    seedUserBranchIds(user);
    return resolveUserBranches(user, companyBranches);
  }, [user, companyBranches, revision]);

  const branchesLabel = useMemo(
    () => getUserBranchesLabel(user, companyBranches),
    [user, companyBranches, revision]
  );

  return {
    companyBranches,
    userBranches,
    branchesLabel,
  };
}
