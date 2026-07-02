/* eslint-disable react-hooks/set-state-in-effect */
// frontend/src/components/tabs/EmployeesTab.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  deleteEmployee,
  listEmployeeAbsences,
  listEmployees,
  replaceEmployeeBranches,
  updateEmployeePosition,
} from '../../services/employeeService';
import { extractApiErrorMessage } from '../../services/error';
import { createPosition, deletePosition, listPositions, updatePosition } from '../../services/positionService';
import { listBranches, acceptEmployeeRequest, linkUserToCompany } from '../../services/companyService';
import {
  employeeHasBranch,
  getEmployeeBranchIds,
  getPrimaryBranchId,
  resolveEmployeeBranches,
} from '../../utils/employeeBranches';
import { useTabResponsive } from '../../utils/tabResponsive';
import { formatLocalDate } from '../../services/scheduleService';
import { getEmployeePositionLabel, getPositionLabel } from '../../utils/employeeDisplay';
import { usePositionTitleRevision } from '../../hooks/usePositionTitleRevision';
import { useUnsavedChanges } from '../../context/useUnsavedChanges';

const POSITION_CREATE_SCOPE = 'employees-position-create';
const POSITION_EDIT_SCOPE = 'employees-position-edit';
const LINK_USER_SCOPE = 'employees-link-user';
const EMPLOYEE_POSITION_SCOPE = 'employees-employee-position';
const EMPLOYEE_BRANCH_SCOPE = 'employees-employee-branch';

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeError(error, fallback, language) {
  const message = extractApiErrorMessage(error, fallback, language);
  if (!message) return fallback;
  return message;
}

function getCompanyId(company) {
  return company?.id || company?.company_id || null;
}

function getEmployeeName(employee) {
  return employee?.full_name || employee?.name || employee?.fullName || '';
}

function getInitials(value) {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || '?';
}

function getBranchLabel(employee, branches, fallback) {
  const employeeBranches = resolveEmployeeBranches(employee, branches);
  if (employeeBranches.length > 0) {
    return employeeBranches.map((branch) => branch.name || branch.title || `#${branch.id}`).join(', ');
  }

  return employee?.branch?.name || employee?.branch_name || fallback;
}

function getBranchId(branch) {
  const value = branch?.id ?? branch?.branch_id ?? branch?.branchId;
  return value == null || value === '' ? null : String(value);
}

function uniqueBranchIds(values) {
  return Array.from(
    new Set(
      normalizeArray(values)
        .map((value) => (value == null || value === '' ? '' : String(value)))
        .filter(Boolean)
    )
  );
}

function resolveBranchesFromIds(branchIds, branches) {
  const byId = new Map(
    normalizeArray(branches)
      .map((branch) => [getBranchId(branch), branch])
      .filter(([id]) => Boolean(id))
  );

  return uniqueBranchIds(branchIds).map((branchId) => byId.get(branchId) || { id: branchId, name: `#${branchId}` });
}

function mergeBranchLists(...lists) {
  const seen = new Set();
  const result = [];

  lists.flat().forEach((branch) => {
    if (!branch) return;
    const branchId = getBranchId(branch);
    const key = branchId || branch.name || branch.title;
    if (!key || seen.has(String(key))) return;
    seen.add(String(key));
    result.push(branch);
  });

  return result;
}

function getDateValue(value) {
  const timestamp = Date.parse(value || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDateRange(startDate, endDate) {
  const start = formatShortDate(startDate);
  const end = formatShortDate(endDate);
  if (!start && !end) return '';
  if (!end || start === end) return start;
  return `${start} - ${end}`;
}

export default function EmployeesTab({ language, userRole, user }) {
  usePositionTitleRevision();
  const r = useTabResponsive(1380);
  const { markUnsaved, markSaved } = useUnsavedChanges();
  // Добавляем глобальные стили для полей ввода
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      .employees-tab input,
      .employees-tab select,
      .employees-tab input:focus,
      .employees-tab select:focus {
        color: #002642 !important;
        background-color: #ffffff !important;
      }
      .employees-tab input::placeholder {
        color: #999 !important;
        opacity: 1 !important;
      }
      .employees-tab input:-webkit-autofill {
        -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
        -webkit-text-fill-color: #002642 !important;
        color: #002642 !important;
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [isViewingEmployee, setIsViewingEmployee] = useState(true);

  const [employeeAbsences, setEmployeeAbsences] = useState([]);

  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState({
    position_id: '',
  });
  const [selectedEmployeeBranchIds, setSelectedEmployeeBranchIds] = useState([]);
  const [branchToAddId, setBranchToAddId] = useState('');
  const [branchAssignmentsRevision, setBranchAssignmentsRevision] = useState(0);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [positionTitle, setPositionTitle] = useState('');
  const [editingPositionId, setEditingPositionId] = useState('');
  const [editingPositionTitle, setEditingPositionTitle] = useState('');

  // Для привязки по User ID
  const [linkUserId, setLinkUserId] = useState('');
  const [linkBranchId, setLinkBranchId] = useState('');
  const [linkPositionId, setLinkPositionId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    ru: {
      employees: 'Сотрудники',
      positions: 'Позиции',
      availability: 'Доступность',
      availabilityAndAbsences: 'Доступность и отсутствия',
      desiredDaysOff: 'Желаемые выходные',
      absences: 'Отсутствия',
      workload: 'Нагрузка',
      shifts: 'Смены',
      totalHours: 'Часы',
      totalShifts: 'Смены',
      createEmployee: 'Создать сотрудника',
      createPosition: 'Создать позицию',
      employeeDetails: 'Карточка сотрудника',
      fullName: 'Имя и фамилия',
      email: 'Email',
      position: 'Позиция',
      save: 'Сохранить',
      addRow: 'Добавить интервал',
      addAbsence: 'Добавить отсутствие',
      startDate: 'Начало',
      endDate: 'Окончание',
      comment: 'Комментарий',
      empty: 'Нет данных',
      loading: 'Загрузка...',
      selectEmployee: 'Выберите сотрудника',
      selectPosition: 'Выберите позицию',
      vacation: 'Отпуск',
      sick_leave: 'Больничный',
      other: 'Другое',
      absenceAdded: 'Отсутствие добавлено.',
      absenceDeleted: 'Отсутствие удалено.',
      managerOnly: 'Раздел доступен менеджеру.',
      delete: 'Удалить',
      draft: 'Черновик',
      published: 'Опубликовано',
      noEmployees: 'Сотрудники пока не добавлены.',
      noIntervals: 'Интервалы доступности не добавлены.',
      noAbsences: 'Отсутствия не добавлены.',
      noShifts: 'Смены не найдены.',
      requiredPosition: 'Введите название позиции.',
      requiredEmployeeName: 'Введите имя и фамилию сотрудника.',
      requiredEmployeeEmail: 'Введите email сотрудника.',
      invalidEmployeeEmail: 'Введите корректный email сотрудника.',
      requiredEmployeePosition: 'Выберите позицию сотрудника.',
      duplicateEmployee: 'Пользователь или сотрудник с таким email уже существует. Используйте другой email или попросите сотрудника присоединиться по инвайт-коду.',
      positionCreated: 'Позиция создана.',
      positionUpdated: 'Позиция обновлена.',
      positionUpdateError: 'Не удалось обновить позицию.',
      positionDeleted: 'Позиция удалена.',
      employeeCreated: 'Сотрудник создан.',
      availabilitySaved: 'Доступность сохранена.',
      assignmentsSaved: 'Данные сотрудника обновлены.',
      assignmentsError: 'Не удалось обновить данные сотрудника.',
      branch: 'Филиал',
      selectBranch: 'Выберите филиал',
      assignBranch: 'Назначить филиал',
      assignPosition: 'Назначить позицию',
      backToList: 'Назад к списку',
      edit: 'Редактировать',
      cancel: 'Отменить',
      confirmDeletePosition: 'Удалить эту позицию?',
      managePositionsHint: 'Редактируйте и удаляйте позиции для компании.',
      noPositionsMessage: 'Нет позиций',
      allBranches: 'Все филиалы',
      allPositions: 'Все позиции',
      searchEmployee: 'Поиск сотрудника...',
      linkUserTitle: 'Привязать сотрудника по ID',
      linkUserHint: 'Введите User ID сотрудника (16 символов), чтобы привязать его к компании',
      userIdLabel: 'User ID',
      userIdPlaceholder: 'Например: A1B2C3D4E5F6G7H8',
      noBranchSelected: 'Без филиала',
      noPositionSelected: 'Без позиции',
      linkUserButton: 'Привязать',
      linkSuccess: 'Пользователь привязан к компании!',
      linkError: 'Ошибка привязки',
      userIdRequired: 'Введите 16-значный User ID',
      noCompanyForLink: 'У вас нет компании',
      noCompanyForPosition: 'Сначала создайте компанию во вкладке «Компания».',
      noPositionsHint: 'Сначала создайте позицию, потом добавьте сотрудника.',
      removeFromCompany: 'Удалить из компании',
      confirmRemoveEmployee: 'Удалить сотрудника из компании?',
      employeeRemoved: 'Сотрудник удалён из компании.',
      removeEmployeeError: 'Не удалось удалить сотрудника.',
      branches: 'Филиалы',
      addBranch: 'Добавить филиал',
      removeBranch: 'Убрать',
      noBranchesAssigned: 'Филиалы не назначены',
    },
    en: {
      employees: 'Employees',
      positions: 'Positions',
      availability: 'Availability',
      availabilityAndAbsences: 'Availability and absences',
      desiredDaysOff: 'Desired days off',
      absences: 'Absences',
      workload: 'Workload',
      shifts: 'Shifts',
      totalHours: 'Hours',
      totalShifts: 'Shifts',
      createEmployee: 'Create employee',
      createPosition: 'Create position',
      employeeDetails: 'Employee card',
      fullName: 'Full name',
      email: 'Email',
      position: 'Position',
      save: 'Save',
      addRow: 'Add interval',
      addAbsence: 'Add absence',
      startDate: 'Start date',
      endDate: 'End date',
      comment: 'Comment',
      empty: 'No data',
      loading: 'Loading...',
      selectEmployee: 'Select employee',
      selectPosition: 'Select position',
      vacation: 'Vacation',
      sick_leave: 'Sick leave',
      other: 'Other',
      absenceAdded: 'Absence added.',
      absenceDeleted: 'Absence deleted.',
      managerOnly: 'Manager access only.',
      delete: 'Delete',
      draft: 'Draft',
      published: 'Published',
      noEmployees: 'No employees yet.',
      noIntervals: 'No availability intervals yet.',
      noAbsences: 'No absences yet.',
      noShifts: 'No shifts found.',
      requiredPosition: 'Enter position title.',
      requiredEmployeeName: 'Enter employee full name.',
      requiredEmployeeEmail: 'Enter employee email.',
      invalidEmployeeEmail: 'Enter a valid employee email.',
      requiredEmployeePosition: 'Select employee position.',
      duplicateEmployee: 'A user or employee with this email already exists. Use another email or ask the employee to join by invite code.',
      positionCreated: 'Position created.',
      positionUpdated: 'Position updated.',
      positionUpdateError: 'Failed to update position.',
      positionDeleted: 'Position deleted.',
      employeeCreated: 'Employee created.',
      availabilitySaved: 'Availability saved.',
      assignmentsSaved: 'Employee details updated.',
      assignmentsError: 'Failed to update employee details.',
      branch: 'Branch',
      selectBranch: 'Select branch',
      assignBranch: 'Assign branch',
      assignPosition: 'Assign position',
      backToList: 'Back to list',
      edit: 'Edit',
      cancel: 'Cancel',
      confirmDeletePosition: 'Delete this position?',
      managePositionsHint: 'Edit and delete positions for the company.',
      noPositionsMessage: 'No positions.',
      allBranches: 'All branches',
      allPositions: 'All positions',
      searchEmployee: 'Search employee...',
      linkUserTitle: 'Link employee by ID',
      linkUserHint: 'Enter the employee\'s 16-character User ID to link them to the company',
      userIdLabel: 'User ID',
      userIdPlaceholder: 'e.g. A1B2C3D4E5F6G7H8',
      noBranchSelected: 'No branch',
      noPositionSelected: 'No position',
      linkUserButton: 'Link',
      linkSuccess: 'User linked to company!',
      linkError: 'Failed to link user',
      userIdRequired: 'Enter a 16-character User ID',
      noCompanyForLink: 'You don\'t have a company',
      noCompanyForPosition: 'Create a company in the Company tab first.',
      noPositionsHint: 'Create a position first, then add an employee.',
      removeFromCompany: 'Remove from company',
      confirmRemoveEmployee: 'Remove this employee from the company?',
      employeeRemoved: 'Employee removed from company.',
      removeEmployeeError: 'Failed to remove employee.',
      branches: 'Branches',
      addBranch: 'Add branch',
      removeBranch: 'Remove',
      noBranchesAssigned: 'No branches assigned',
    },
  };

  const t = texts[language] || texts.ru;

  const currentCompany = user?.company || null;
  const currentCompanyId = getCompanyId(currentCompany);

  const visiblePositions = useMemo(() => {
    if (!currentCompanyId) {
      return positions;
    }

    return positions.filter((position) => {
      const positionCompanyId = position.company_id || position.companyId;
      if (!positionCompanyId) return false;
      return String(positionCompanyId) === String(currentCompanyId);
    });
  }, [positions, currentCompanyId]);

  useEffect(() => {
    if (!errorMessage && !successMessage) return undefined;
    const timer = setTimeout(() => {
      setErrorMessage('');
      setSuccessMessage('');
    }, errorMessage ? 5000 : 2500);
    return () => clearTimeout(timer);
  }, [errorMessage, successMessage]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(selectedEmployeeId)),
    [employees, selectedEmployeeId]
  );

  const selectedEmployeePosition = getEmployeePositionLabel(selectedEmployee);
  const selectedEmployeeBranches = useMemo(() => {
    if (!selectedEmployee) return [];

    return mergeBranchLists(
      resolveEmployeeBranches(selectedEmployee, branches),
      resolveBranchesFromIds(selectedEmployeeBranchIds, branches)
    );
  }, [selectedEmployee, branches, selectedEmployeeBranchIds]);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return employees.filter((employee) => {
      if (selectedBranchId) {
        if (!employeeHasBranch(employee, selectedBranchId)) return false;
      }

      if (selectedPositionId) {
        const employeePositionId = employee.position_id
          || employee.position?.id
          || employee.position?.position_id;
        if (String(employeePositionId) !== String(selectedPositionId)) return false;
      }

      if (query) {
        const name = (employee.full_name || employee.name || employee.fullName || '').toLowerCase();
        const email = (employee.email || '').toLowerCase();
        if (!name.includes(query) && !email.includes(query)) return false;
      }

      return true;
    });
  }, [employees, selectedBranchId, selectedPositionId, searchQuery, branchAssignmentsRevision]);

  const upcomingAbsences = useMemo(() => {
    const today = formatLocalDate(new Date());
    return normalizeArray(employeeAbsences)
      .filter((absence) => !absence.end_date || String(absence.end_date) >= today)
      .sort((first, second) => getDateValue(first.start_date) - getDateValue(second.start_date))
      .slice(0, 3);
  }, [employeeAbsences]);

  const availableBranchesToAdd = useMemo(() => {
    const assigned = new Set(selectedEmployeeBranches.map(getBranchId).filter(Boolean));
    return branches.filter((branch) => {
      const branchId = getBranchId(branch);
      return branchId && !assigned.has(branchId);
    });
  }, [branches, selectedEmployeeBranches]);

  useEffect(() => {
    if (filteredEmployees.some((employee) => String(employee.id) === String(selectedEmployeeId))) return;

    setSelectedEmployeeId(filteredEmployees[0] ? String(filteredEmployees[0].id) : '');
  }, [filteredEmployees, selectedEmployeeId]);

  useEffect(() => {
    if (!selectedEmployee) {
      setSelectedEmployeeDetails({ position_id: '' });
      setSelectedEmployeeBranchIds([]);
      setBranchToAddId('');
      return;
    }

    const resolvedBranchIds = resolveEmployeeBranches(selectedEmployee, branches)
      .map(getBranchId)
      .filter(Boolean);

    setSelectedEmployeeDetails({
      position_id: selectedEmployee.position_id || selectedEmployee.position?.id || selectedEmployee.position?.position_id || '',
    });
    setSelectedEmployeeBranchIds(uniqueBranchIds([...getEmployeeBranchIds(selectedEmployee), ...resolvedBranchIds]));
    setBranchToAddId('');
  }, [selectedEmployee?.id, branches]);

  useEffect(() => {
    if (userRole !== 'manager') return undefined;

    let isMounted = true;

    async function bootstrap() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [employeesData, positionsData] = await Promise.all([listEmployees(), listPositions()]);

        let branchesData = [];

        if (currentCompanyId) {
          try {
            branchesData = await listBranches(currentCompanyId);
          } catch {
            branchesData = normalizeArray(currentCompany?.branches || []);
          }
        }

        if (!isMounted) return;

        const safeEmployees = normalizeArray(employeesData);
        const safePositions = normalizeArray(positionsData);
        const safeBranches = normalizeArray(branchesData || []);

        setEmployees(safeEmployees);
        setPositions(safePositions);
        setBranches(safeBranches);

        if (safeEmployees[0]) {
          setSelectedEmployeeId(String(safeEmployees[0].id));
          setIsViewingEmployee(true);
        } else {
          setSelectedEmployeeId('');
          setIsViewingEmployee(true);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(normalizeError(error, t.empty, language));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [language, t.empty, userRole, currentCompanyId]);

  useEffect(() => {
    if (!selectedEmployeeId || userRole !== 'manager') {
      setEmployeeAbsences([]);
      return undefined;
    }

    let isMounted = true;

    async function loadDetails() {
      setIsDetailsLoading(true);
      setErrorMessage('');

      try {
        const absencesData = await listEmployeeAbsences(selectedEmployeeId);

        if (!isMounted) return;

        setEmployeeAbsences(normalizeArray(absencesData));
      } catch (error) {
        if (isMounted) {
          setEmployeeAbsences([]);
          setErrorMessage(normalizeError(error, t.empty, language));
        }
      } finally {
        if (isMounted) {
          setIsDetailsLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [language, selectedEmployeeId, t.empty, userRole]);

  if (userRole !== 'manager') {
    return (
      <section style={styles.page}>
        <div style={styles.card}>{t.managerOnly}</div>
      </section>
    );
  }

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const getFriendlyError = (error, fallback) => {
    const rawMessage = normalizeError(error, fallback, language);
    const lowerMessage = String(rawMessage).toLowerCase();

    if (
      lowerMessage.includes('already exists') ||
      lowerMessage.includes('уже существует') ||
      lowerMessage.includes('duplicate') ||
      lowerMessage.includes('unique')
    ) {
      return t.duplicateEmployee;
    }

    return rawMessage;
  };

  const reloadEmployees = async (preferEmployeeId) => {
    const employeesData = normalizeArray(await listEmployees());
    setEmployees(employeesData);

    if (preferEmployeeId) {
      setSelectedEmployeeId(String(preferEmployeeId));
      return;
    }

    const currentFiltered = employeesData.filter((employee) => {
      if (!selectedBranchId) return true;
      return employeeHasBranch(employee, selectedBranchId);
    });

    if (!currentFiltered.some((employee) => String(employee.id) === String(selectedEmployeeId))) {
      setSelectedEmployeeId(currentFiltered[0] ? String(currentFiltered[0].id) : '');
    }
  };

  const reloadPositions = async () => {
    const positionsData = normalizeArray(await listPositions());
    setPositions(positionsData);
  };

  const bumpBranchAssignments = () => {
    setBranchAssignmentsRevision((value) => value + 1);
  };

  const persistEmployeeBranches = async (employee, branchIds, primaryBranchId = null) => {
    const normalizedIds = uniqueBranchIds(branchIds);
    const currentPrimary = normalizeBranchId(primaryBranchId ?? getPrimaryBranchId(employee));
    const primaryId = currentPrimary && normalizedIds.includes(currentPrimary)
      ? currentPrimary
      : normalizedIds[0] || null;

    await replaceEmployeeBranches(employee.id, {
      branch_ids: normalizedIds.map(Number),
      primary_branch_id: primaryId ? Number(primaryId) : null,
    });
  };

  const normalizeBranchId = (value) => {
    if (value == null || value === '') return null;
    return String(value);
  };

  const patchEmployeeBranchesLocally = (employeeId, branchIds) => {
    const normalizedIds = uniqueBranchIds(branchIds);
    const branchObjects = resolveBranchesFromIds(normalizedIds, branches);
    const primaryBranch = branchObjects[0] || null;

    setEmployees((currentEmployees) =>
      currentEmployees.map((employee) => {
        if (String(employee.id) !== String(employeeId)) return employee;

        return {
          ...employee,
          branch_ids: normalizedIds,
          branches: branchObjects,
          branch: primaryBranch,
          branch_id: primaryBranch ? primaryBranch.id : null,
          branch_name: primaryBranch ? primaryBranch.name || primaryBranch.title || `#${primaryBranch.id}` : '',
        };
      })
    );
  };

  const handleAddEmployeeBranch = async () => {
    if (!selectedEmployee || !branchToAddId) return;

    clearMessages();
    setIsSubmitting(true);

    const currentIds = uniqueBranchIds([
      ...getEmployeeBranchIds(selectedEmployee),
      ...selectedEmployeeBranchIds,
      ...selectedEmployeeBranches.map(getBranchId),
    ]);
    const nextIds = uniqueBranchIds([...currentIds, branchToAddId]);

    try {
      await persistEmployeeBranches(selectedEmployee, nextIds);
      await reloadEmployees(selectedEmployee.id);
      setSelectedEmployeeBranchIds(nextIds);
      patchEmployeeBranchesLocally(selectedEmployee.id, nextIds);
      bumpBranchAssignments();
      setBranchToAddId('');
      markSaved(EMPLOYEE_BRANCH_SCOPE);
      setSuccessMessage(t.assignmentsSaved);
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.assignmentsError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveEmployeeBranch = async (branchId) => {
    if (!selectedEmployee) return;

    clearMessages();
    const currentIds = uniqueBranchIds([
      ...getEmployeeBranchIds(selectedEmployee),
      ...selectedEmployeeBranchIds,
      ...selectedEmployeeBranches.map(getBranchId),
    ]);
    const nextIds = currentIds.filter((id) => String(id) !== String(branchId));

    setIsSubmitting(true);

    try {
      await persistEmployeeBranches(selectedEmployee, nextIds);
      await reloadEmployees(selectedEmployee.id);
      setSelectedEmployeeBranchIds(nextIds);
      patchEmployeeBranchesLocally(selectedEmployee.id, nextIds);
      bumpBranchAssignments();
      markSaved(EMPLOYEE_BRANCH_SCOPE);
      setSuccessMessage(t.assignmentsSaved);
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.assignmentsError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignDetails = async () => {
    if (!selectedEmployee) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await updateEmployeePosition(selectedEmployee.id, {
        position_id: selectedEmployeeDetails.position_id
          ? Number(selectedEmployeeDetails.position_id)
          : null,
      });

      await reloadEmployees(selectedEmployee.id);
      bumpBranchAssignments();
      markSaved(EMPLOYEE_POSITION_SCOPE);
      setSuccessMessage(t.assignmentsSaved);
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.assignmentsError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePosition = async () => {
    if (!positionTitle.trim()) {
      setErrorMessage(t.requiredPosition);
      return;
    }

    if (!currentCompanyId) {
      setErrorMessage(t.noCompanyForPosition);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await createPosition({
        title: positionTitle.trim(),
        company_id: Number(currentCompanyId),
      });
      await reloadPositions();
      setPositionTitle('');
      markSaved(POSITION_CREATE_SCOPE);
      setSuccessMessage(t.positionCreated);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.requiredPosition, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditingPosition = (position) => {
    setErrorMessage('');
    setSuccessMessage('');
    setEditingPositionId(String(position.id));
    setEditingPositionTitle(getPositionLabel(position));
  };

  const handleCancelEditPosition = () => {
    setEditingPositionId('');
    setEditingPositionTitle('');
    markSaved(POSITION_EDIT_SCOPE);
  };

  const handleSaveEditedPosition = async () => {
    if (!editingPositionTitle.trim()) {
      setErrorMessage(t.requiredPosition);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await updatePosition(editingPositionId, { title: editingPositionTitle.trim() });
      await reloadPositions();
      handleCancelEditPosition();
      setSuccessMessage(t.positionUpdated);
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.positionUpdateError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePosition = async (positionId) => {
    if (!window.confirm(t.confirmDeletePosition)) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await deletePosition(positionId);
      await reloadPositions();

      if (String(editingPositionId) === String(positionId)) {
        handleCancelEditPosition();
      }

      setSuccessMessage(t.positionDeleted);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.requiredPosition, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployeeFromCompany = async () => {
    if (!selectedEmployee) return;
    if (!window.confirm(t.confirmRemoveEmployee)) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await deleteEmployee(selectedEmployee.id);
      setSelectedEmployeeId('');
      setIsViewingEmployee(true);
      await reloadEmployees();
      setSuccessMessage(t.employeeRemoved);
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.removeEmployeeError));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== ПРИВЯЗКА ПО USER ID =====
  const handleLinkUser = async () => {
    const publicId = linkUserId.trim().toUpperCase();

    if (publicId.length !== 16) {
      setErrorMessage(t.userIdRequired);
      return;
    }

    const companyId = user?.company?.id;
    if (!companyId) {
      setErrorMessage(t.noCompanyForLink);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      const linked = await linkUserToCompany({
        user_public_id: publicId,
        branch_id: linkBranchId ? Number(linkBranchId) : null,
        position_id: linkPositionId ? Number(linkPositionId) : null,
      });

      if (linked?.id) {
        await acceptEmployeeRequest(linked.id);
      }

      setLinkUserId('');
      setLinkBranchId('');
      setLinkPositionId('');
      markSaved(LINK_USER_SCOPE);
      setSuccessMessage(t.linkSuccess);
      await reloadEmployees();
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.linkError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section style={{ ...styles.page, ...r.page }}>
        <div style={styles.card}>{t.loading}</div>
      </section>
    );
  }

  return (
    <section
      style={{
        ...styles.page,
        ...r.page,
        ...(r.isMobile ? {} : styles.desktopViewportPage),
      }}
      className="employees-tab"
    >
      <div style={{
        ...styles.shell,
        ...r.shell,
        width: 'min(100%, 1480px)',
        padding: 0,
        borderRadius: 0,
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        ...(r.isMobile ? {} : styles.desktopScaleShell),
      }}>
        <header style={{ ...styles.header, ...r.header }}>
          <div>
            <h2 style={{ ...styles.title, ...r.title }}>{t.title}</h2>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <div style={{ ...styles.headerStats, ...r.headerStats }}>
            <Metric isMobile={r.isMobile} label={t.employees} value={filteredEmployees.length} />
            <Metric isMobile={r.isMobile} label={t.positions} value={visiblePositions.length} />
            <Metric isMobile={r.isMobile} label={t.branches} value={branches.length} />
          </div>
        </header>

        {(errorMessage || successMessage) && (
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
        )}

        <div style={{ ...styles.mainGrid, ...r.splitLayout('300px minmax(520px, 1fr) 320px') }}>
          <aside style={styles.sidePanel}>
            <div style={styles.leftCard}>
              <div style={styles.leftCardHeader}>
                <span style={styles.leftCardIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="5" width="12" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" />
                    <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <h3 style={styles.leftCardTitle}>{t.createPosition}</h3>
              </div>

              <div style={styles.leftCardStack}>
                <input
                  value={positionTitle}
                  onChange={(event) => {
                    setPositionTitle(event.target.value);
                    markUnsaved(POSITION_CREATE_SCOPE);
                  }}
                  placeholder={t.position}
                  style={styles.leftInput}
                />

                <button
                  type="button"
                  onClick={handleCreatePosition}
                  style={{
                    ...(isSubmitting || !currentCompanyId ? styles.leftPrimaryButtonDisabled : styles.leftPrimaryButton),
                    ...r.fullWidth,
                  }}
                  disabled={isSubmitting || !currentCompanyId}
                >
                  {t.save}
                </button>
              </div>
            </div>

            {/* Блок привязки по User ID */}
            <div style={{ ...styles.leftCard, ...styles.leftCardGrow }}>
              <div style={styles.leftCardHeader}>
                <span style={styles.leftCardIcon} aria-hidden="true">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                    <path d="M10.6 13.4a4.2 4.2 0 0 0 5.94 0l2.08-2.08a4.2 4.2 0 0 0-5.94-5.94l-1.02 1.02" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M13.4 10.6a4.2 4.2 0 0 0-5.94 0l-2.08 2.08a4.2 4.2 0 0 0 5.94 5.94l1.02-1.02" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </span>
                <h3 style={styles.leftCardTitle}>{t.linkUserTitle}</h3>
              </div>

              <div style={styles.leftCardStack}>
                <label style={styles.leftLabel}>{t.userIdLabel}</label>
                <input
                  type="text"
                  value={linkUserId}
                  onChange={(e) => {
                    setLinkUserId(e.target.value.toUpperCase());
                    markUnsaved(LINK_USER_SCOPE);
                  }}
                  placeholder={t.userIdPlaceholder}
                  maxLength={16}
                  style={styles.leftInput}
                />

                <label style={styles.leftLabel}>{t.branch}</label>
                <select
                  value={linkBranchId}
                  onChange={(e) => {
                    setLinkBranchId(e.target.value);
                    markUnsaved(LINK_USER_SCOPE);
                  }}
                  style={styles.leftSelect}
                >
                  <option value="">{t.selectBranch}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>

                <label style={styles.leftLabel}>{t.position}</label>
                <select
                  value={linkPositionId}
                  onChange={(e) => {
                    setLinkPositionId(e.target.value);
                    markUnsaved(LINK_USER_SCOPE);
                  }}
                  style={styles.leftSelect}
                >
                  <option value="">{t.selectPosition}</option>
                  {visiblePositions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {getPositionLabel(position)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleLinkUser}
                  style={{
                    ...(isSubmitting || !linkUserId ? styles.leftLinkButtonDisabled : styles.leftLinkButton),
                    ...r.fullWidth,
                  }}
                  disabled={isSubmitting || !linkUserId}
                >
                  {isSubmitting ? '...' : t.linkUserButton}
                </button>
              </div>
            </div>
          </aside>

          <main style={styles.tablePanel}>
            <div style={{ ...styles.listHeader, ...r.listHeader }}>
              <div>
                <h3 style={styles.panelTitle}>{t.employees}</h3>
              </div>

              <div style={{ ...styles.filterRow, ...r.filterRow }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t.searchEmployee}
                  style={{ ...styles.searchInput, ...r.searchInput }}
                  aria-label={t.searchEmployee}
                />
                <select
                  id="branch-filter-select"
                  value={selectedBranchId}
                  onChange={(event) => setSelectedBranchId(event.target.value)}
                  style={{ ...styles.filterSelect, ...r.filterSelect }}
                  aria-label={t.branch}
                >
                  <option value="">{t.allBranches}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <select
                  id="position-filter-select"
                  value={selectedPositionId}
                  onChange={(event) => setSelectedPositionId(event.target.value)}
                  style={{ ...styles.filterSelect, ...r.filterSelect }}
                  aria-label={t.position}
                >
                  <option value="">{t.allPositions}</option>
                  {visiblePositions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {getPositionLabel(position)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredEmployees.length === 0 ? (
              <div style={styles.emptyBox}>{t.noEmployees}</div>
            ) : r.isMobile ? (
              <div style={styles.mobileEmployeeList}>
                {filteredEmployees.map((employee) => {
                  const employeeName = getEmployeeName(employee) || t.empty;
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(String(employee.id));
                        setIsViewingEmployee(false);
                      }}
                      style={styles.mobileEmployeeCard}
                      aria-label={`${t.edit} ${employeeName}`}
                    >
                      <div style={styles.mobileEmployeeCardTop}>
                        <div style={styles.employeeIdentity}>
                          <span style={styles.avatar}>{getInitials(employeeName)}</span>
                          <div style={{ minWidth: 0 }}>
                            <strong style={styles.employeeName}>{employeeName}</strong>
                            <div style={styles.mobileEmployeeCardMeta}>
                              <span>{employee.email || '-'}</span>
                            </div>
                          </div>
                        </div>
                        <span style={styles.mobileEmployeeChevron}>›</span>
                      </div>

                      <div style={styles.mobileEmployeeCardMeta}>
                        <span>{getBranchLabel(employee, branches, t.empty)}</span>
                        <span>{getEmployeePositionLabel(employee) || t.empty}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.employeeTable}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeaderCell}>{t.employees}</th>
                      <th style={styles.tableHeaderCell}>{t.email}</th>
                      <th style={styles.tableHeaderCell}>{t.branch}</th>
                      <th style={styles.tableHeaderCell}>{t.position}</th>
                      <th style={{ ...styles.tableHeaderCell, ...styles.actionsHeader }} aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => {
                      const employeeName = getEmployeeName(employee) || t.empty;
                      return (
                        <tr key={employee.id} style={styles.tableRow}>
                          <td style={styles.tableCell}>
                            <div style={styles.employeeIdentity}>
                              <span style={styles.avatar}>{getInitials(employeeName)}</span>
                              <strong style={styles.employeeName}>{employeeName}</strong>
                            </div>
                          </td>
                          <td style={styles.tableCell}>{employee.email || '-'}</td>
                          <td style={styles.tableCell}>{getBranchLabel(employee, branches, t.empty)}</td>
                          <td style={styles.tableCell}>{getEmployeePositionLabel(employee) || t.empty}</td>
                          <td style={{ ...styles.tableCell, ...styles.actionsCell }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEmployeeId(String(employee.id));
                                setIsViewingEmployee(false);
                              }}
                              style={styles.tableActionButton}
                              aria-label={t.edit}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 6.7h.01M12 12h.01M12 17.3h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </main>

          <aside style={styles.positionsPanel}>
            <div style={styles.positionsHeader}>
              <h3 style={styles.panelTitle}>{t.positions}</h3>
            </div>

            {visiblePositions.length === 0 ? (
              <div style={styles.emptyBox}>{t.noPositionsMessage}</div>
            ) : (
              <div style={styles.positionList}>
                {visiblePositions.map((position) => (
                  <div
                    key={position.id}
                    style={{
                      ...styles.positionItem,
                      ...(r.isMobile ? styles.positionItemMobile : {}),
                    }}
                  >
                    {String(editingPositionId) === String(position.id) ? (
                      <>
                        <input
                          value={editingPositionTitle}
                          onChange={(event) => {
                            setEditingPositionTitle(event.target.value);
                            markUnsaved(POSITION_EDIT_SCOPE);
                          }}
                          style={{ ...styles.input, ...(r.isMobile ? {} : r.fullWidth) }}
                        />
                        <div style={{ ...styles.actionGroup, ...(r.isMobile ? styles.positionActionGroupMobile : {}) }}>
                          <button
                            type="button"
                            onClick={handleSaveEditedPosition}
                            style={{ ...styles.primaryButton, ...(r.isMobile ? {} : r.fullWidth) }}
                            disabled={isSubmitting}
                          >
                            {t.save}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditPosition}
                            style={{ ...styles.secondaryButton, ...(r.isMobile ? {} : r.fullWidth) }}
                            disabled={isSubmitting}
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ ...styles.positionTitleWrap, ...(r.isMobile ? styles.positionTitleWrapMobile : {}) }}>
                          <PositionGlyph index={visiblePositions.indexOf(position)} />
                          <strong style={{ ...styles.itemTitle, ...(r.isMobile ? styles.itemTitleMobile : {}) }}>
                            {getPositionLabel(position)}
                          </strong>
                        </div>
                        <div style={{ ...styles.actionGroup, ...(r.isMobile ? styles.positionActionGroupMobile : {}) }}>
                          <button
                            type="button"
                            onClick={() => handleStartEditingPosition(position)}
                            style={{ ...styles.iconButton, ...(r.isMobile ? {} : r.fullWidth) }}
                            aria-label={t.edit}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M4 20h4.8L19 9.8a2.8 2.8 0 0 0-4-4L4.8 16H4v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <path d="M13.7 7.1l3.2 3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePosition(position.id)}
                            style={{ ...styles.iconDeleteButton, ...(r.isMobile ? {} : r.fullWidth) }}
                            aria-label={t.delete}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M5 7h14M10 11v6M14 11v6M9 7l.5-2h5L15 7M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>

        {selectedEmployee && !isViewingEmployee && (
          <div style={{ ...styles.modalOverlay, padding: r.isMobile ? 0 : '20px' }}>
            <div style={{
              ...styles.modalContent,
              width: r.isMobile ? '100%' : 'min(760px, 100%)',
              maxHeight: r.isMobile ? '100%' : '90vh',
              borderRadius: r.isMobile ? 0 : '24px',
              padding: r.isMobile ? '16px' : '24px',
            }}>
              <div style={{ ...styles.actionBar, marginBottom: r.isMobile ? 10 : 14 }}>
                <button
                  type="button"
                  onClick={() => setIsViewingEmployee(true)}
                  style={{
                    ...styles.secondaryButton,
                    ...(r.isMobile ? { width: '100%' } : {}),
                  }}
                >
                  {t.backToList}
                </button>
              </div>

              <div style={{
                ...styles.employeeCard,
                gridTemplateColumns: r.gridCols(r.isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'),
                gap: r.isMobile ? 8 : 12,
              }}>
                <Info label={t.fullName} value={selectedEmployee?.full_name || selectedEmployee?.name || '-'} />
                <Info label={t.email} value={selectedEmployee?.email || '-'} />
                <Info label={t.position} value={selectedEmployeePosition || t.empty} />
              </div>

              <div style={{
                ...styles.innerSection,
                padding: r.isMobile ? '12px' : '16px',
                gap: r.isMobile ? 8 : 12,
              }}>
                <div style={{ ...styles.innerHeader, ...(r.isMobile ? { gap: 8 } : {}) }}>
                  <h4 style={{ ...styles.subTitle, fontSize: r.isMobile ? 15 : 17 }}>{t.assignPosition}</h4>
                </div>

                <div style={{ ...(r.isMobile ? { display: 'flex', flexDirection: 'column', gap: 6 } : styles.stack) }}>
                  <label style={{ ...styles.label, marginBottom: r.isMobile ? 4 : 8 }}>{t.position}</label>
                  <select
                    value={selectedEmployeeDetails.position_id}
                    onChange={(event) => {
                      setSelectedEmployeeDetails((prev) => ({ ...prev, position_id: event.target.value }));
                      markUnsaved(EMPLOYEE_POSITION_SCOPE);
                    }}
                    style={{ ...styles.select, ...(r.isMobile ? { height: 36, borderRadius: 10, fontSize: 13 } : {}) }}
                  >
                    <option value="">{t.selectPosition}</option>
                    {visiblePositions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {getPositionLabel(position)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ ...(r.isMobile ? { display: 'flex', flexDirection: 'column', gap: 6 } : styles.stack) }}>
                  <label style={{ ...styles.label, marginBottom: r.isMobile ? 4 : 8 }}>{t.branches}</label>
                  <p style={{ ...styles.panelHint, margin: r.isMobile ? '0 0 4px' : undefined }}>{t.branchesPreviewHint}</p>

                  {selectedEmployeeBranches.length === 0 ? (
                    <div style={{ ...styles.emptyBox, margin: r.isMobile ? '0' : '18px', padding: r.isMobile ? '12px' : '28px' }}>{t.noBranchesAssigned}</div>
                  ) : (
                    <div style={{ ...styles.branchPills, gap: r.isMobile ? 6 : 8 }}>
                      {selectedEmployeeBranches.map((branch) => (
                        <span key={branch.id} style={{
                          ...styles.branchPill,
                          minHeight: r.isMobile ? 28 : 34,
                          padding: r.isMobile ? '0 8px 0 10px' : '0 8px 0 13px',
                          fontSize: r.isMobile ? 12 : 13,
                        }}>
                          <span>{branch.name || branch.title || `#${branch.id}`}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEmployeeBranch(branch.id)}
                            style={{
                              ...styles.branchPillRemove,
                              width: r.isMobile ? 20 : 24,
                              height: r.isMobile ? 20 : 24,
                              fontSize: r.isMobile ? 13 : 16,
                            }}
                            aria-label={`${t.removeBranch} ${branch.name || branch.id}`}
                            disabled={isSubmitting}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: r.gridCols(r.isMobile ? '1fr' : '1fr auto'),
                    gap: r.isMobile ? 8 : 10,
                    alignItems: 'center',
                  }}>
                    <select
                      value={branchToAddId}
                      onChange={(event) => {
                        setBranchToAddId(event.target.value);
                        markUnsaved(EMPLOYEE_BRANCH_SCOPE);
                      }}
                      style={{ ...styles.select, ...(r.isMobile ? { height: 36, borderRadius: 10, fontSize: 13 } : {}) }}
                      disabled={availableBranchesToAdd.length === 0 || isSubmitting}
                    >
                      <option value="">{t.selectBranch}</option>
                      {availableBranchesToAdd.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddEmployeeBranch}
                      style={{
                        ...styles.secondaryButton,
                        ...(r.isMobile ? { width: '100%', height: 36, borderRadius: 10, padding: '0 12px' } : {}),
                        ...((!branchToAddId || isSubmitting) ? { opacity: 0.65, cursor: 'default' } : {}),
                      }}
                      disabled={!branchToAddId || isSubmitting}
                    >
                      {t.addBranch}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAssignDetails}
                  style={{
                    ...styles.primaryButton,
                    ...(r.isMobile ? { height: 36, borderRadius: 10, padding: '0 12px' } : {}),
                  }}
                >
                  {t.save}
                </button>

                <button
                  type="button"
                  onClick={handleDeleteEmployeeFromCompany}
                  style={{
                    ...styles.deleteButton,
                    ...(r.isMobile ? { height: 36, borderRadius: 10, padding: '0 12px' } : {}),
                  }}
                  disabled={isSubmitting}
                >
                  {t.removeFromCompany}
                </button>
              </div>
            </div>
          </div>
        )}

        <section style={{ ...styles.availabilityPanel, ...(r.isMobile ? styles.availabilityPanelMobile : {}) }}>
          <div style={styles.availabilityTitleBlock}>
            <h3 style={styles.panelTitle}>{t.absences}</h3>
          </div>

          <div style={{ ...styles.availabilityContent, ...(r.isMobile ? styles.availabilityContentMobile : {}) }}>
            <div style={{ ...styles.absenceStrip, ...(r.isMobile ? styles.absenceStripMobile : {}) }}>
              {isDetailsLoading ? (
                <span style={styles.emptyInline}>{t.loading}</span>
              ) : upcomingAbsences.length === 0 ? (
                <span style={styles.emptyInline}>{t.noAbsences}</span>
              ) : (
                upcomingAbsences.map((absence) => {
                  const absenceEmployeeName = getEmployeeName(selectedEmployee) || selectedEmployee?.email || t.empty;

                  return (
                    <div key={absence.id || `${absence.start_date}-${absence.end_date}`} style={styles.absenceItem}>
                      <div style={styles.absenceText}>
                        <strong>{absenceEmployeeName}</strong>
                        <span>{t[absence.absence_type] || absence.absence_type || t.absences}</span>
                        <span>{formatDateRange(absence.start_date, absence.end_date)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value, isMobile }) {
  return (
    <div style={styles.metric}>
      <span style={{ ...styles.metricLabel, ...(isMobile ? styles.metricLabelMobile : {}) }}>{label}</span>
      <strong style={{ ...styles.metricValue, ...(isMobile ? styles.metricValueMobile : {}) }}>{value}</strong>
    </div>
  );
}

function PositionGlyph({ index }) {
  const paths = [
    <path key="briefcase" d="M9 7V5.8C9 4.8 9.8 4 10.8 4h2.4c1 0 1.8.8 1.8 1.8V7M5 8h14v11H5V8ZM5 12h14" />,
    <path key="cup" d="M6 8h10v4a5 5 0 0 1-10 0V8ZM16 9h1.5a2 2 0 0 1 0 4H16M6 20h10M8 4h.01M12 4h.01" />,
    <path key="cash" d="M4 8h16v10H4V8ZM8 12h.01M16 14h.01M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
    <path key="shield" d="M12 3 5.5 5.6v5.1c0 4.1 2.6 7.8 6.5 9.3 3.9-1.5 6.5-5.2 6.5-9.3V5.6L12 3ZM12 8v4l2 1.4" />,
    <path key="cap" d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5ZM6.5 12v3.2c1.6 1.4 3.4 2 5.5 2s3.9-.6 5.5-2V12" />,
  ];

  return (
    <span style={styles.positionIcon} aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths[index % paths.length]}
      </svg>
    </span>
  );
}

function Info({ label, value, isMobile }) {
  return (
    <div>
      <span style={{
        ...styles.cardLabel,
        ...(isMobile ? { fontSize: 11, marginBottom: 4 } : {}),
      }}>{label}</span>
      <strong style={{
        ...styles.cardValue,
        ...(isMobile ? { fontSize: 14 } : {}),
      }}>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: '16px 24px 18px',
    overflowY: 'hidden',
    overflowX: 'hidden',
    background: '#f4faff',
  },

  desktopViewportPage: {
    height: 'calc(100dvh - 96px)',
    overflow: 'hidden',
  },

  shell: {
    width: 'min(100%, 1480px)',
    height: '100%',
    minHeight: 0,
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: 0,
    borderRadius: 0,
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },

  desktopScaleShell: {
    width: '125%',
    height: '125%',
    transform: 'scale(0.8)',
    transformOrigin: 'top left',
  },

  header: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '12px',
    marginBottom: '14px',
  },

  title: {
    margin: 0,
    color: '#002642',
    fontSize: '28px',
    fontWeight: '900',
    letterSpacing: 0,
  },

  subtitle: {
    margin: '4px 0 0',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '600',
  },

  headerStats: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },

  mainGrid: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '300px minmax(520px, 1fr) 320px',
    gap: '14px',
    alignItems: 'stretch',
    overflow: 'hidden',
  },

  sidePanel: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'hidden',
    paddingRight: 0,
  },

  panel: {
    padding: '18px 18px 20px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
  },

  leftCard: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '16px',
    borderRadius: '12px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 10px 26px rgba(0, 38, 66, 0.035)',
  },

  leftCardGrow: {
    flex: '1 1 auto',
    minHeight: 0,
  },

  leftCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },

  leftCardIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '9px',
    flexShrink: 0,
    background: '#f0edff',
    color: '#5a50ff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  leftCardTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '17px',
    lineHeight: 1.15,
    fontWeight: '900',
    letterSpacing: '-0.02em',
  },

  leftCardStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  leftLabel: {
    display: 'block',
    margin: '2px 0 -2px',
    color: '#002642',
    fontSize: '12px',
    fontWeight: '850',
  },

  leftInput: {
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 15px',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '600',
    outline: 'none',
    boxShadow: '0 1px 2px rgba(0, 38, 66, 0.03)',
  },

  leftSelect: {
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 15px',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '600',
    outline: 'none',
    boxShadow: '0 1px 2px rgba(0, 38, 66, 0.03)',
  },

  leftPrimaryButton: {
    height: '40px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '10px',
    background: '#00296b',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 10px 20px rgba(0, 41, 107, 0.16)',
  },

  leftPrimaryButtonDisabled: {
    height: '40px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '10px',
    background: '#00296b',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'default',
    whiteSpace: 'nowrap',
    opacity: 0.45,
  },

  leftLinkButton: {
    height: '38px',
    padding: '0 16px',
    marginTop: '4px',
    border: 'none',
    borderRadius: '8px',
    background: '#c7b8ff',
    color: '#5647ff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  leftLinkButtonDisabled: {
    height: '38px',
    padding: '0 16px',
    marginTop: '4px',
    border: 'none',
    borderRadius: '8px',
    background: '#c7b8ff',
    color: '#5647ff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'default',
    whiteSpace: 'nowrap',
    opacity: 0.7,
  },

  panelTitle: {
    margin: '0 0 10px',
    color: '#002642',
    fontSize: '15px',
    fontWeight: '850',
  },

  panelHint: {
    margin: '0 0 10px',
    color: '#4f646f',
    fontSize: '13px',
    lineHeight: 1.35,
    fontWeight: '600',
  },

  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    alignItems: 'end',
  },

  flex: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },

  detailsPanel: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    overflow: 'hidden',
  },

  tablePanel: {
    minWidth: 0,
    minHeight: '360px',
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflow: 'hidden',
  },

  positionsPanel: {
    minWidth: 0,
    minHeight: '360px',
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'hidden',
  },

  positionsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid #dee7e7',
  },

  employeePicker: {
    flexShrink: 0,
    padding: '18px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 420px)',
    gap: '16px',
    alignItems: 'center',
    borderBottom: '1px solid #dee7e7',
  },

  detailsScroll: {
    flex: '1 1 auto',
    minHeight: 0,
    padding: '18px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  employeeCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },

  cardLabel: {
    display: 'block',
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '850',
    marginBottom: '5px',
  },

  cardValue: {
    display: 'block',
    color: '#002642',
    fontSize: '16px',
    fontWeight: '850',
    overflowWrap: 'anywhere',
  },

  innerSection: {
    padding: '16px',
    borderRadius: '20px',
    background: '#f4faff',
    border: '1px solid rgba(79, 100, 111, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  innerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },

  actionBar: {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '10px',
    marginBottom: '14px',
  },

  listPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '18px',
  },

  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },

  filterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'nowrap',
  },

  searchInput: {
    height: '40px',
    width: '220px',
    flexShrink: 0,
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 14px',
    color: '#002642',
    fontSize: '13px',
    fontWeight: '650',
    outline: 'none',
  },

  filterSelect: {
    height: '40px',
    width: 'auto',
    minWidth: '138px',
    flexShrink: 0,
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #dbe6f0',
    background: '#ffffff',
    padding: '0 12px',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '750',
    outline: 'none',
  },

  tableWrap: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
    borderTop: '1px solid #dee7e7',
  },

  employeeTable: {
    width: '100%',
    minWidth: '720px',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },

  tableHeaderCell: {
    padding: '11px 10px',
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '850',
    textAlign: 'left',
    borderBottom: '1px solid #dee7e7',
    whiteSpace: 'nowrap',
  },

  tableRow: {
    borderBottom: '1px solid #edf2f2',
  },

  tableCell: {
    padding: '10px',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '650',
    verticalAlign: 'middle',
    overflowWrap: 'anywhere',
  },

  actionsHeader: {
    width: '88px',
    textAlign: 'right',
  },

  actionsCell: {
    textAlign: 'right',
  },

  tableActionButton: {
    width: '34px',
    height: '34px',
    padding: 0,
    border: 'none',
    borderRadius: '999px',
    background: 'transparent',
    color: '#002642',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  employeeIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },

  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    flexShrink: 0,
    background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.18), rgba(67, 160, 255, 0.18))',
    color: '#4b4df7',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '900',
  },

  employeeName: {
    minWidth: 0,
    color: '#002642',
    fontSize: '14px',
    fontWeight: '850',
    overflowWrap: 'anywhere',
  },

  listButton: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '18px',
    border: '1px solid rgba(79, 100, 111, 0.12)',
    background: '#ffffff',
    textAlign: 'left',
    cursor: 'pointer',
  },

  listButtonContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  listButtonMeta: {
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '700',
  },

  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '800',
  },

  subTitle: {
    margin: 0,
    color: '#002642',
    fontSize: '17px',
    fontWeight: '850',
  },

  availabilityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  availabilityRow: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr 1fr auto',
    gap: '10px',
    alignItems: 'center',
  },

  absenceForm: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr 1fr 1.4fr auto',
    gap: '10px',
    alignItems: 'center',
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

  select: {
    width: '100%',
    height: '44px',
    boxSizing: 'border-box',
    borderRadius: '14px',
    border: '2px solid #dee7e7',
    background: '#ffffff',
    padding: '0 14px',
    color: '#002642',
    fontSize: '14px',
    outline: 'none',
  },

  primaryButton: {
    height: '42px',
    padding: '0 16px',
    background: '#002642',
    border: 'none',
    borderRadius: '13px',
    color: '#f4faff',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  primaryButtonDisabled: {
    height: '42px',
    padding: '0 16px',
    background: '#4f646f',
    border: 'none',
    borderRadius: '13px',
    color: '#f4faff',
    fontWeight: '800',
    cursor: 'default',
    whiteSpace: 'nowrap',
    opacity: 0.65,
  },

  secondaryButton: {
    height: '38px',
    padding: '0 14px',
    background: '#dee7e7',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  deleteButton: {
    height: '38px',
    padding: '0 13px',
    background: 'rgba(215, 173, 207, 0.42)',
    border: 'none',
    borderRadius: '12px',
    color: '#002642',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  actionGroup: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
    flexShrink: 0,
  },

  positionActionGroupMobile: {
    gap: '8px',
    flexDirection: 'row',
    width: 'auto',
    flexShrink: 0,
  },

  daysOff: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  dayPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },

  dayPill: {
    height: '34px',
    padding: '0 13px',
    border: '1px solid #dee7e7',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#4f646f',
    fontWeight: '800',
    cursor: 'pointer',
  },

  dayPillActive: {
    height: '34px',
    padding: '0 13px',
    border: '1px solid rgba(215, 173, 207, 0.8)',
    borderRadius: '999px',
    background: '#d7adcf',
    color: '#002642',
    fontWeight: '900',
    cursor: 'pointer',
  },

  branchPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },

  branchPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '34px',
    padding: '0 8px 0 13px',
    border: '1px solid #dee7e7',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#002642',
    fontWeight: '700',
    fontSize: '13px',
  },

  branchPillReadonly: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '34px',
    padding: '0 13px',
    border: '1px solid #dee7e7',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#002642',
    fontWeight: '700',
    fontSize: '13px',
  },

  cardBranchField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },

  branchPillRemove: {
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: '999px',
    background: 'rgba(215, 173, 207, 0.35)',
    color: '#8d1d1d',
    fontSize: '16px',
    lineHeight: 1,
    cursor: 'pointer',
    fontWeight: '900',
  },

  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },

  metric: {
    width: '100%',
    minWidth: 0,
    height: '40px',
    boxSizing: 'border-box',
    padding: '0 10px',
    borderRadius: '10px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    color: '#002642',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    boxShadow: '0 6px 14px rgba(0, 38, 66, 0.025)',
  },

  metricIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    flexShrink: 0,
    background: 'linear-gradient(135deg, rgba(90, 80, 255, 0.13), rgba(67, 160, 255, 0.12))',
    color: '#554cff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  metricLabel: {
    fontSize: '13px',
    color: '#4f646f',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },

  metricLabelMobile: {
    fontSize: '9px',
    lineHeight: 1.1,
    whiteSpace: 'normal',
    textAlign: 'center',
  },

  metricValue: {
    fontSize: '24px',
    lineHeight: 1,
    fontWeight: '900',
    color: '#002642',
    whiteSpace: 'nowrap',
  },

  metricValueMobile: {
    fontSize: '15px',
  },

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  employeeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '120px',
    overflowY: 'auto',
    paddingRight: '4px',
  },

  listItem: {
    padding: '13px 14px',
    borderRadius: '16px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
  },

  mobileEmployeeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  mobileEmployeeCard: {
    width: '100%',
    border: '1px solid #dee7e7',
    borderRadius: '14px',
    background: '#ffffff',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start',
    textAlign: 'left',
    cursor: 'pointer',
  },

  mobileEmployeeCardTop: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },

  mobileEmployeeCardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '700',
  },

  mobileEmployeeChevron: {
    color: '#4b4df7',
    fontSize: '18px',
    lineHeight: 1,
    marginTop: '2px',
  },

  positionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    minHeight: 0,
    overflow: 'hidden',
  },

  positionItem: {
    padding: '8px 0',
    borderBottom: '1px solid #edf2f2',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
  },

  positionItemMobile: {
    gap: '10px',
    alignItems: 'center',
  },

  positionTitleWrap: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: '1 1 auto',
  },

  positionTitleWrapMobile: {
    gap: '8px',
  },

  positionIcon: {
    width: '24px',
    height: '24px',
    flexShrink: 0,
    color: '#554cff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconButton: {
    width: '32px',
    height: '32px',
    padding: 0,
    background: '#ffffff',
    border: '1px solid #dee7e7',
    borderRadius: '10px',
    color: '#4b4df7',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  iconDeleteButton: {
    width: '32px',
    height: '32px',
    padding: 0,
    background: '#ffffff',
    border: '1px solid rgba(215, 173, 207, 0.65)',
    borderRadius: '10px',
    color: '#c92c5a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  itemTitle: {
    color: '#002642',
    fontWeight: '850',
    minWidth: 0,
    overflowWrap: 'anywhere',
  },

  itemTitleMobile: {
    fontSize: '14px',
    lineHeight: 1.3,
  },

  itemMeta: {
    color: '#4f646f',
    fontSize: '13px',
    marginTop: '4px',
  },

  error: {
    flexShrink: 0,
    marginBottom: '12px',
    padding: '11px 13px',
    borderRadius: '13px',
    background: 'rgba(215, 173, 207, 0.36)',
    color: '#8d1d1d',
    fontSize: '14px',
    fontWeight: '700',
  },

  success: {
    flexShrink: 0,
    marginBottom: '12px',
    padding: '11px 13px',
    borderRadius: '13px',
    background: 'rgba(222, 231, 231, 0.82)',
    color: '#002642',
    fontSize: '14px',
    fontWeight: '700',
  },

  emptyBox: {
    margin: '18px',
    padding: '28px',
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
  },

  availabilityPanel: {
    marginTop: '16px',
    padding: '18px 20px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #dee7e7',
    boxShadow: '0 12px 30px rgba(0, 38, 66, 0.04)',
    display: 'grid',
    gridTemplateColumns: '220px minmax(0, 1fr)',
    gap: '18px',
    alignItems: 'center',
  },

  availabilityPanelMobile: {
    gridTemplateColumns: '1fr',
    alignItems: 'stretch',
  },

  availabilityTitleBlock: {
    minWidth: 0,
  },

  availabilityContent: {
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
    alignItems: 'center',
  },

  availabilityContentMobile: {
    gridTemplateColumns: '1fr',
  },

  compactList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    minWidth: 0,
  },

  compactPill: {
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '999px',
    border: '1px solid #dee7e7',
    background: '#f4faff',
    color: '#002642',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },

  absenceStrip: {
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  },

  absenceStripMobile: {
    gridTemplateColumns: '1fr',
  },

  absenceItem: {
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid #edf2f2',
    background: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  avatarSmall: {
    width: '30px',
    height: '30px',
    borderRadius: '999px',
    flexShrink: 0,
    background: 'rgba(215, 173, 207, 0.35)',
    color: '#002642',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '900',
  },

  absenceText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    color: '#4f646f',
    fontSize: '12px',
    fontWeight: '700',
  },

  emptyInline: {
    color: '#4f646f',
    fontSize: '13px',
    fontWeight: '750',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.35)',
    padding: '20px',
  },

  modalContent: {
    width: 'min(760px, 100%)',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    borderRadius: '24px',
    background: '#ffffff',
    boxShadow: '0 24px 64px rgba(0, 38, 66, 0.24)',
    position: 'relative',
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
