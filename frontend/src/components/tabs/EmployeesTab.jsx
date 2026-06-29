// frontend/src/components/tabs/EmployeesTab.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  createEmployee,
  createEmployeeAbsence,
  deleteEmployee,
  deleteEmployeeAbsence,
  getEmployeeAvailability,
  getEmployeeCalendarSummary,
  listEmployeeAbsences,
  listEmployees,
  replaceEmployeeBranches,
  updateEmployeeAvailability,
  updateEmployeePosition,
} from '../../services/employeeService';
import { extractApiErrorMessage, localizeBackendMessage } from '../../services/error';
import { mapEmployeeCalendarSummary } from '../../services/mappers';
import { createPosition, deletePosition, listPositions, updatePosition } from '../../services/positionService';
import { listBranches, acceptEmployeeRequest, linkUserToCompany } from '../../services/companyService';
import {
  employeeHasBranch,
  getEmployeeBranchIds,
  getPrimaryBranchId,
  resolveEmployeeBranches,
} from '../../utils/employeeBranches';
import { useTabResponsive } from '../../utils/tabResponsive';

const WEEKDAYS = [
  { value: 0, ru: 'Пн', en: 'Mon' },
  { value: 1, ru: 'Вт', en: 'Tue' },
  { value: 2, ru: 'Ср', en: 'Wed' },
  { value: 3, ru: 'Чт', en: 'Thu' },
  { value: 4, ru: 'Пт', en: 'Fri' },
  { value: 5, ru: 'Сб', en: 'Sat' },
  { value: 6, ru: 'Вс', en: 'Sun' },
];

function createAvailabilityBlock() {
  return { weekday: 0, start_time: '09:00:00', end_time: '18:00:00' };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeError(error, fallback, language) {
  const message = extractApiErrorMessage(error, fallback, language);
  if (!message) return fallback;
  return message;
}

function getPositionLabel(position) {
  return position?.title || position?.name || position?.position_title || '';
}

function getEmployeePosition(employee) {
  return employee?.position_title || employee?.position?.title || employee?.position?.name || '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getCompanyId(company) {
  return company?.id || company?.company_id || null;
}

export default function EmployeesTab({ language, userRole, user }) {
  const r = useTabResponsive(1380);
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

  const [availabilityForm, setAvailabilityForm] = useState({
    weekly_availability: [],
    desired_days_off: [],
  });

  const [employeeAbsences, setEmployeeAbsences] = useState([]);
  const [employeeSummary, setEmployeeSummary] = useState(null);

  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    position_id: '',
  });

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

  const [absenceForm, setAbsenceForm] = useState({
    absence_type: 'vacation',
    start_date: '',
    end_date: '',
    comment: '',
  });

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
      title: 'Сотрудники',
      subtitle: 'Позиции, сотрудники, доступность и отсутствия',
      employees: 'Сотрудники',
      positions: 'Позиции',
      availability: 'Доступность',
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
      noPositionsMessage: 'Позиции не найдены. Создайте одну слева.',
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
      branchesPreviewHint: 'Несколько филиалов сохраняются локально до обновления API.',
    },
    en: {
      title: 'Employees',
      subtitle: 'Positions, employees, availability, and absences',
      employees: 'Employees',
      positions: 'Positions',
      availability: 'Availability',
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
      noPositionsMessage: 'No positions available. Create one on the left.',
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
      branchesPreviewHint: 'Multiple branches are stored locally until the API supports them.',
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

  const selectedEmployeePosition = getEmployeePosition(selectedEmployee);
  const selectedEmployeeBranches = useMemo(() => {
    if (!selectedEmployee) return [];
    return resolveEmployeeBranches(selectedEmployee, branches);
  }, [selectedEmployee, branches, branchAssignmentsRevision]);

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

  const availableBranchesToAdd = useMemo(() => {
    const assigned = new Set(selectedEmployeeBranchIds.map(String));
    return branches.filter((branch) => !assigned.has(String(branch.id)));
  }, [branches, selectedEmployeeBranchIds]);

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

    setSelectedEmployeeDetails({
      position_id: selectedEmployee.position_id || selectedEmployee.position?.id || selectedEmployee.position?.position_id || '',
    });
    setSelectedEmployeeBranchIds(getEmployeeBranchIds(selectedEmployee));
    setBranchToAddId('');
  }, [selectedEmployee?.id]);

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
      setAvailabilityForm({ weekly_availability: [], desired_days_off: [] });
      setEmployeeAbsences([]);
      setEmployeeSummary(null);
      return undefined;
    }

    let isMounted = true;

    async function loadDetails() {
      setIsDetailsLoading(true);
      setErrorMessage('');

      try {
        const [availabilityData, absencesData, summaryData] = await Promise.all([
          getEmployeeAvailability(selectedEmployeeId),
          listEmployeeAbsences(selectedEmployeeId),
          getEmployeeCalendarSummary(selectedEmployeeId),
        ]);

        if (!isMounted) return;

        const weeklyAvailability = normalizeArray(availabilityData?.weekly_availability);
        const desiredDaysOff = normalizeArray(availabilityData?.desired_days_off);

        setAvailabilityForm({
          weekly_availability: weeklyAvailability,
          desired_days_off: desiredDaysOff,
        });

        setEmployeeAbsences(normalizeArray(absencesData));
        setEmployeeSummary(mapEmployeeCalendarSummary(summaryData));
      } catch (error) {
        if (isMounted) {
          setAvailabilityForm({ weekly_availability: [], desired_days_off: [] });
          setEmployeeAbsences([]);
          setEmployeeSummary(null);
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
    const normalizedIds = Array.from(new Set(branchIds.map(String).filter(Boolean)));
    if (normalizedIds.length === 0) {
      throw new Error('branch_ids required');
    }

    const currentPrimary = normalizeBranchId(primaryBranchId ?? getPrimaryBranchId(employee));
    const primaryId = currentPrimary && normalizedIds.includes(currentPrimary)
      ? currentPrimary
      : normalizedIds[0];

    await replaceEmployeeBranches(employee.id, {
      branch_ids: normalizedIds.map(Number),
      primary_branch_id: Number(primaryId),
    });
  };

  const normalizeBranchId = (value) => {
    if (value == null || value === '') return null;
    return String(value);
  };

  const handleAddEmployeeBranch = async () => {
    if (!selectedEmployee || !branchToAddId) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      const currentIds = getEmployeeBranchIds(selectedEmployee);
      const nextIds = Array.from(new Set([...currentIds, String(branchToAddId)]));
      await persistEmployeeBranches(selectedEmployee, nextIds);
      await reloadEmployees(selectedEmployee.id);
      bumpBranchAssignments();
      setBranchToAddId('');
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
    const nextIds = getEmployeeBranchIds(selectedEmployee).filter((id) => String(id) !== String(branchId));
    if (nextIds.length === 0) {
      setErrorMessage(t.assignmentsError);
      return;
    }

    setIsSubmitting(true);

    try {
      await persistEmployeeBranches(selectedEmployee, nextIds);
      await reloadEmployees(selectedEmployee.id);
      bumpBranchAssignments();
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
      setSuccessMessage(t.positionCreated);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.requiredPosition, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateEmployeeForm = () => {
    if (!employeeForm.full_name.trim()) {
      setErrorMessage(t.requiredEmployeeName);
      return false;
    }

    if (!employeeForm.email.trim()) {
      setErrorMessage(t.requiredEmployeeEmail);
      return false;
    }

    if (!isValidEmail(employeeForm.email.trim())) {
      setErrorMessage(t.invalidEmployeeEmail);
      return false;
    }

    if (!employeeForm.position_id) {
      setErrorMessage(t.requiredEmployeePosition);
      return false;
    }

    return true;
  };

  const handleCreateEmployee = async () => {
    if (!validateEmployeeForm()) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      const createdEmployee = await createEmployee({
        full_name: employeeForm.full_name.trim(),
        email: employeeForm.email.trim(),
        position_id: Number(employeeForm.position_id),
      });

      await reloadEmployees(createdEmployee?.id);
      setEmployeeForm({ full_name: '', email: '', position_id: '' });
      setSuccessMessage(t.employeeCreated);
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.createEmployee));
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

  const handleAvailabilityChange = (index, key, value) => {
    setAvailabilityForm((prev) => ({
      ...prev,
      weekly_availability: prev.weekly_availability.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const handleSaveAvailability = async () => {
    if (!selectedEmployeeId) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await updateEmployeeAvailability(selectedEmployeeId, availabilityForm);

      const [availabilityData, summaryData] = await Promise.all([
        getEmployeeAvailability(selectedEmployeeId),
        getEmployeeCalendarSummary(selectedEmployeeId),
      ]);

      setAvailabilityForm({
        weekly_availability: normalizeArray(availabilityData?.weekly_availability),
        desired_days_off: normalizeArray(availabilityData?.desired_days_off),
      });

      setEmployeeSummary(mapEmployeeCalendarSummary(summaryData));
      setSuccessMessage(t.availabilitySaved);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.availabilitySaved, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAbsence = async () => {
    if (!selectedEmployeeId || !absenceForm.start_date || !absenceForm.end_date) {
      setErrorMessage(t.addAbsence);
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      await createEmployeeAbsence(selectedEmployeeId, absenceForm);

      const [absencesData, summaryData] = await Promise.all([
        listEmployeeAbsences(selectedEmployeeId),
        getEmployeeCalendarSummary(selectedEmployeeId),
      ]);

      setEmployeeAbsences(normalizeArray(absencesData));
      setEmployeeSummary(mapEmployeeCalendarSummary(summaryData));
      setAbsenceForm({ absence_type: 'vacation', start_date: '', end_date: '', comment: '' });
      setSuccessMessage(t.absenceAdded);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.addAbsence, language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAbsence = async (absenceId) => {
    if (!selectedEmployeeId) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      await deleteEmployeeAbsence(selectedEmployeeId, absenceId);

      const [absencesData, summaryData] = await Promise.all([
        listEmployeeAbsences(selectedEmployeeId),
        getEmployeeCalendarSummary(selectedEmployeeId),
      ]);

      setEmployeeAbsences(normalizeArray(absencesData));
      setEmployeeSummary(mapEmployeeCalendarSummary(summaryData));
      setSuccessMessage(t.absenceDeleted);
    } catch (error) {
      setErrorMessage(normalizeError(error, t.delete, language));
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
    <section style={{ ...styles.page, ...r.page }} className="employees-tab">
      <div style={{ ...styles.shell, ...r.shell }}>
        <header style={{ ...styles.header, ...r.header }}>
          <div>
            <h2 style={{ ...styles.title, ...r.title }}>{t.title}</h2>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <div style={{ ...styles.headerStats, ...r.headerStats }}>
            <Metric label={t.employees} value={filteredEmployees.length} />
            <Metric label={t.positions} value={visiblePositions.length} />
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

        <div style={{ ...styles.mainGrid, ...r.splitLayout('340px minmax(0, 1fr)') }}>
          <aside style={styles.sidePanel}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>{t.createPosition}</h3>
              {!currentCompanyId && <p style={styles.panelHint}>{t.noCompanyForPosition}</p>}

              <div style={styles.stack}>
                <input
                  value={positionTitle}
                  onChange={(event) => setPositionTitle(event.target.value)}
                  placeholder={t.position}
                  style={styles.input}
                />

                <button
                  type="button"
                  onClick={handleCreatePosition}
                  style={{
                    ...(isSubmitting || !currentCompanyId ? styles.primaryButtonDisabled : styles.primaryButton),
                    ...r.fullWidth,
                  }}
                  disabled={isSubmitting || !currentCompanyId}
                >
                  {t.save}
                </button>
              </div>
            </div>

            {/* Блок привязки по User ID */}
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>{t.linkUserTitle}</h3>
              <p style={styles.panelHint}>{t.linkUserHint}</p>

              <div style={styles.stack}>
                <label style={styles.label}>{t.userIdLabel}</label>
                <input
                  type="text"
                  value={linkUserId}
                  onChange={(e) => setLinkUserId(e.target.value.toUpperCase())}
                  placeholder={t.userIdPlaceholder}
                  maxLength={16}
                  style={styles.input}
                />

                <div style={{ ...styles.row, gridTemplateColumns: r.gridCols('1fr 1fr') }}>
                  <div style={styles.flex}>
                    <label style={styles.label}>{t.branch}</label>
                    <select
                      value={linkBranchId}
                      onChange={(e) => setLinkBranchId(e.target.value)}
                      style={styles.select}
                    >
                      <option value="">{t.noBranchSelected}</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.flex}>
                    <label style={styles.label}>{t.position}</label>
                    <select
                      value={linkPositionId}
                      onChange={(e) => setLinkPositionId(e.target.value)}
                      style={styles.select}
                    >
                      <option value="">{t.noPositionSelected}</option>
                      {visiblePositions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {getPositionLabel(position)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLinkUser}
                  style={{
                    ...(isSubmitting || !linkUserId ? styles.primaryButtonDisabled : styles.primaryButton),
                    ...r.fullWidth,
                  }}
                  disabled={isSubmitting || !linkUserId}
                >
                  {isSubmitting ? '...' : t.linkUserButton}
                </button>
              </div>
            </div>
          </aside>

          <main style={{
            ...styles.detailsPanel,
            ...(r.isMobile ? { overflow: 'visible' } : {}),
          }}
          >
            <div style={{
              ...styles.detailsScroll,
              ...(r.isMobile ? { overflowY: 'visible', minHeight: 'auto', padding: 14 } : {}),
            }}
            >
              <section style={styles.innerSection}>
                <div style={{ ...styles.listHeader, ...r.listHeader }}>
                  <div>
                    <h3 style={styles.panelTitle}>{t.employees}</h3>
                    <p style={styles.panelHint}>{t.selectEmployee}</p>
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
                ) : (
                  <div style={styles.employeeList}>
                    {filteredEmployees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        style={styles.listButton}
                        onClick={() => {
                          setSelectedEmployeeId(String(employee.id));
                          setIsViewingEmployee(false);
                        }}
                      >
                        <div style={styles.listButtonContent}>
                          <strong>{employee.full_name || employee.name || employee.fullName || '—'}</strong>
                          <span style={styles.listButtonMeta}>
                            {employee.email || '—'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {selectedEmployee && !isViewingEmployee && (
                <div style={styles.modalOverlay}>
                  <div style={styles.modalContent}>
                    <div style={styles.actionBar}>
                      <button
                        type="button"
                        onClick={() => setIsViewingEmployee(true)}
                        style={styles.secondaryButton}
                      >
                        ← {t.backToList}
                      </button>
                    </div>

                    <div style={{ ...styles.employeeCard, gridTemplateColumns: r.gridCols('repeat(3, minmax(0, 1fr))') }}>
                      <Info label={t.fullName} value={selectedEmployee?.full_name || selectedEmployee?.name || '—'} />
                      <Info label={t.email} value={selectedEmployee?.email || '—'} />
                      <Info label={t.position} value={selectedEmployeePosition || t.empty} />
                      <div style={styles.cardBranchField}>
                        <span style={styles.cardLabel}>{t.branches}</span>
                        {selectedEmployeeBranches.length === 0 ? (
                          <span style={styles.cardValue}>{t.noBranchesAssigned}</span>
                        ) : (
                          <div style={styles.branchPills}>
                            {selectedEmployeeBranches.map((branch) => (
                              <span key={branch.id} style={styles.branchPillReadonly}>
                                {branch.name || branch.title || `#${branch.id}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={styles.innerSection}>
                      <div style={styles.innerHeader}>
                        <h4 style={styles.subTitle}>{t.assignPosition}</h4>
                      </div>

                      <div style={styles.stack}>
                        <label style={styles.label}>{t.position}</label>
                        <select
                          value={selectedEmployeeDetails.position_id}
                          onChange={(event) =>
                            setSelectedEmployeeDetails((prev) => ({ ...prev, position_id: event.target.value }))
                          }
                          style={styles.select}
                        >
                          <option value="">{t.selectPosition}</option>
                          {visiblePositions.map((position) => (
                            <option key={position.id} value={position.id}>
                              {getPositionLabel(position)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={styles.stack}>
                        <label style={styles.label}>{t.branches}</label>
                        <p style={styles.panelHint}>{t.branchesPreviewHint}</p>

                        {selectedEmployeeBranches.length === 0 ? (
                          <div style={styles.emptyBox}>{t.noBranchesAssigned}</div>
                        ) : (
                          <div style={styles.branchPills}>
                            {selectedEmployeeBranches.map((branch) => (
                              <span key={branch.id} style={styles.branchPill}>
                                <span>{branch.name || branch.title || `#${branch.id}`}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEmployeeBranch(branch.id)}
                                  style={styles.branchPillRemove}
                                  aria-label={`${t.removeBranch} ${branch.name || branch.id}`}
                                  disabled={isSubmitting}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div style={{ ...styles.row, gridTemplateColumns: r.gridCols('1fr auto') }}>
                          <select
                            value={branchToAddId}
                            onChange={(event) => setBranchToAddId(event.target.value)}
                            style={styles.select}
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
                              ...((!branchToAddId || isSubmitting) ? { opacity: 0.65, cursor: 'default' } : {}),
                            }}
                            disabled={!branchToAddId || isSubmitting}
                          >
                            {t.addBranch}
                          </button>
                        </div>
                      </div>

                      <button type="button" onClick={handleAssignDetails} style={styles.primaryButton}>
                        {t.save}
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteEmployeeFromCompany}
                        style={styles.deleteButton}
                        disabled={isSubmitting}
                      >
                        {t.removeFromCompany}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <section style={styles.innerSection}>
                <div style={{ ...styles.listHeader, ...r.listHeader }}>
                  <div>
                    <h3 style={styles.panelTitle}>{t.positions}</h3>
                    <p style={styles.panelHint}>{t.managePositionsHint}</p>
                  </div>
                </div>

                {visiblePositions.length === 0 ? (
                  <div style={styles.emptyBox}>{t.noPositionsMessage}</div>
                ) : (
                  <div style={styles.list}>
                    {visiblePositions.map((position) => (
                      <div key={position.id} style={{ ...styles.listItem, ...r.listItem }}>
                        {String(editingPositionId) === String(position.id) ? (
                          <>
                            <input
                              value={editingPositionTitle}
                              onChange={(event) => setEditingPositionTitle(event.target.value)}
                              style={{ ...styles.input, ...r.fullWidth }}
                            />
                            <div style={{ ...styles.actionGroup, ...r.actionGroup }}>
                              <button
                                type="button"
                                onClick={handleSaveEditedPosition}
                                style={{ ...styles.primaryButton, ...r.fullWidth }}
                                disabled={isSubmitting}
                              >
                                {t.save}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditPosition}
                                style={{ ...styles.secondaryButton, ...r.fullWidth }}
                                disabled={isSubmitting}
                              >
                                {t.cancel}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={r.isMobile ? { width: '100%' } : undefined}>
                              <strong style={styles.itemTitle}>{getPositionLabel(position)}</strong>
                            </div>
                            <div style={{ ...styles.actionGroup, ...r.actionGroup }}>
                              <button
                                type="button"
                                onClick={() => handleStartEditingPosition(position)}
                                style={{ ...styles.secondaryButton, ...r.fullWidth }}
                              >
                                {t.edit}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePosition(position.id)}
                                style={{ ...styles.deleteButton, ...r.fullWidth }}
                              >
                                {t.delete}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </section>
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

function Info({ label, value }) {
  return (
    <div>
      <span style={styles.cardLabel}>{label}</span>
      <strong style={styles.cardValue}>{value}</strong>
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
    width: 'min(100%, 1380px)',
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
    margin: '5px 0 0',
    color: '#4f646f',
    fontSize: '14px',
    fontWeight: '600',
  },

  headerStats: {
    display: 'flex',
    gap: '10px',
  },

  mainGrid: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '340px minmax(0, 1fr)',
    gap: '18px',
    overflow: 'hidden',
  },

  sidePanel: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflowY: 'auto',
    paddingRight: '4px',
  },

  panel: {
    padding: '18px',
    borderRadius: '22px',
    background: '#ffffff',
    border: '1px solid rgba(79, 100, 111, 0.12)',
  },

  panelTitle: {
    margin: '0 0 12px',
    color: '#002642',
    fontSize: '18px',
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
    gap: '10px',
    flexWrap: 'wrap',
  },

  filterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'nowrap',
  },

  searchInput: {
    height: '40px',
    width: '170px',
    flexShrink: 0,
    boxSizing: 'border-box',
    borderRadius: '13px',
    border: '2px solid #dee7e7',
    background: '#ffffff',
    padding: '0 14px',
    color: '#002642',
    fontSize: '14px',
    outline: 'none',
  },

  filterSelect: {
    height: '40px',
    width: 'auto',
    minWidth: '130px',
    flexShrink: 0,
    boxSizing: 'border-box',
    borderRadius: '13px',
    border: '2px solid #dee7e7',
    background: '#ffffff',
    padding: '0 12px',
    color: '#002642',
    fontSize: '14px',
    outline: 'none',
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
    gap: '8px',
    alignItems: 'center',
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
    minWidth: '90px',
    padding: '11px 14px',
    borderRadius: '16px',
    background: '#dee7e7',
    color: '#002642',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },

  metricLabel: {
    fontSize: '12px',
    color: '#4f646f',
    fontWeight: '800',
  },

  metricValue: {
    fontSize: '19px',
    fontWeight: '900',
    color: '#002642',
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
    maxHeight: '240px',
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

  itemTitle: {
    color: '#002642',
    fontWeight: '850',
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