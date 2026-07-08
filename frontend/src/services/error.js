import { getStoredLanguage } from './language';

const translations = {
  ru: {
    requestFailed: 'Не удалось выполнить запрос.',
    validationError: 'Проверьте введенные данные.',
    network: 'Бэкенд недоступен.',
    serverError: 'Ошибка на сервере.',
    noResponse: 'Сервер не ответил — возможно, упал при генерации. Проверьте логи бэкенда.',
    sessionExpired: 'Сессия истекла. Войдите снова.',
    forbidden: 'У вас нет прав для этого действия.',
    notFound: 'Запрошенные данные не найдены.',
    employeeProfileMissing: 'Аккаунт сотрудника не привязан к профилю сотрудника.',
    inviteCodeNotFound: 'Компания с таким инвайт-кодом не найдена.',
    invalidCredentials: 'Неверный email или пароль.',
    emailNotVerified: 'Подтвердите email по ссылке из письма, затем войдите.',
    userExists: 'Пользователь с таким email уже существует.',
    branchMismatch: 'Выбранный филиал не относится к компании.',
    positionMismatch: 'Выбранная позиция не относится к компании.',
    employeeMismatch: 'Сотрудник не подходит для этой смены по позиции.',
    scheduleDraftOnly: 'Опубликовать можно только черновик расписания.',
    exchangePendingOnly: 'Можно обработать только ожидающий запрос на обмен.',
    invalidXlsx: 'Неверный формат XLSX-файла.',
    employeeNotFound: 'Сотрудник не найден.',
    absenceNotFound: 'Отсутствие не найдено.',
    scheduleNotFound: 'Расписание не найдено.',
    shiftNotFound: 'Смена не найдена.',
    exchangeNotFound: 'Запрос на обмен не найден.',
    managersCannotJoin: 'Менеджер не может присоединиться к компании как сотрудник.',
    managerJoinPending: 'Заявка менеджера уже отправлена.',
    managerAlreadyActive: 'Менеджер уже состоит в другой компании.',
    managerRequestNotFound: 'Заявка менеджера не найдена.',
    ownerActionRequired: 'Только владелец компании может выполнить это действие.',
    permissionRequired: 'У вас нет прав для этого действия.',
    noAccessEmployee: 'У вас нет доступа к данным этого сотрудника.',
    invalidToken: 'Сессия истекла. Войдите снова.',
    loggedOut: 'Вы вышли из системы.',
  },
  en: {
    requestFailed: 'Request failed.',
    validationError: 'Please check the entered data.',
    network: 'Backend is unavailable.',
    serverError: 'Server error.',
    noResponse: 'Server did not respond — it may have crashed during generation. Check backend logs.',
    sessionExpired: 'Session expired. Please log in again.',
    forbidden: 'You do not have permission for this action.',
    notFound: 'Requested data was not found.',
    employeeProfileMissing: 'This employee account is not linked to an employee profile.',
    inviteCodeNotFound: 'Company with this invite code was not found.',
    invalidCredentials: 'Invalid email or password.',
    emailNotVerified: 'Confirm your email from the message we sent, then log in.',
    userExists: 'A user with this email already exists.',
    branchMismatch: 'The selected branch does not belong to this company.',
    positionMismatch: 'The selected position does not belong to this company.',
    employeeMismatch: 'Employee does not match the required position for this shift.',
    scheduleDraftOnly: 'Only draft schedules can be published.',
    exchangePendingOnly: 'Only pending exchange requests can be updated.',
    invalidXlsx: 'Invalid XLSX file format.',
    employeeNotFound: 'Employee was not found.',
    absenceNotFound: 'Absence was not found.',
    scheduleNotFound: 'Schedule was not found.',
    shiftNotFound: 'Shift was not found.',
    exchangeNotFound: 'Exchange request was not found.',
    managersCannotJoin: 'Managers cannot join a company as employees.',
    managerJoinPending: 'Manager join request is already pending.',
    managerAlreadyActive: 'Manager is already active in another company.',
    managerRequestNotFound: 'Manager request not found.',
    ownerActionRequired: 'Only the company owner can perform this action.',
    permissionRequired: 'You do not have permission for this action.',
    noAccessEmployee: 'You do not have access to this employee resource.',
    invalidToken: 'Session expired. Please log in again.',
    loggedOut: 'Logged out successfully.',
  },
};

const directDetailMap = {
  'Invalid email or password.': 'invalidCredentials',
  'Email is not verified.': 'emailNotVerified',
  'A user with this email already exists.': 'userExists',
  'Token is not active.': 'invalidToken',
  'Could not validate credentials.': 'invalidToken',
  'Company invite code not found.': 'inviteCodeNotFound',
  'Managers cannot join a company as employees.': 'managersCannotJoin',
  'Manager join request is already pending.': 'managerJoinPending',
  'Manager is already active in another company.': 'managerAlreadyActive',
  'Manager request not found.': 'managerRequestNotFound',
  'Only the company owner can perform this action.': 'ownerActionRequired',
  'Branch does not belong to company.': 'branchMismatch',
  'Position does not belong to company.': 'positionMismatch',
  'Employee was not found.': 'employeeNotFound',
  'Absence was not found.': 'absenceNotFound',
  'Schedule was not found.': 'scheduleNotFound',
  'Shift was not found.': 'shiftNotFound',
  'Exchange request was not found.': 'exchangeNotFound',
  'Employee does not match the required position for this shift.': 'employeeMismatch',
  'Only draft schedules can be published.': 'scheduleDraftOnly',
  'Only pending requests can be updated.': 'exchangePendingOnly',
  'Invalid XLSX file format.': 'invalidXlsx',
  'This employee account is not linked to an employee profile.': 'employeeProfileMissing',
  'You do not have access to this employee resource.': 'noAccessEmployee',
  'Logged out successfully.': 'loggedOut',
};

function getMessages(language = getStoredLanguage()) {
  return translations[language] || translations.ru;
}

function translatePattern(detail, language) {
  const messages = getMessages(language);

  if (/^Position \d+ was not found\.$/.test(detail)) {
    return messages.positionMismatch;
  }

  if (/^The '.+' role is required for this action\.$/.test(detail)) {
    return messages.permissionRequired;
  }

  return null;
}

export function localizeBackendMessage(detail, language = getStoredLanguage()) {
  if (!detail || typeof detail !== 'string') {
    return detail;
  }

  const messages = getMessages(language);
  const key = directDetailMap[detail];
  if (key && messages[key]) {
    return messages[key];
  }

  const patternMatch = translatePattern(detail, language);
  if (patternMatch) {
    return patternMatch;
  }

  return detail;
}

export function extractApiErrorMessage(error, fallbackMessage, language = getStoredLanguage()) {
  const messages = getMessages(language);
  const defaultMessage = fallbackMessage || messages.requestFailed;

  if (!error) {
    return defaultMessage;
  }

  if (error.response?.data?.detail) {
    const { detail } = error.response.data;
    if (Array.isArray(detail)) {
      return messages.validationError;
    }
    if (typeof detail === 'string') {
      return localizeBackendMessage(detail, language);
    }
  }

  if (error.response?.status === 401) {
    return messages.sessionExpired;
  }

  if (error.response?.status === 403) {
    return messages.forbidden;
  }

  if (error.response?.status === 404) {
    return messages.notFound;
  }

  if (error.response?.status === 422) {
    return messages.validationError;
  }

  if (error.response?.status === 409) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return localizeBackendMessage(detail, language);
    }
  }

  if (error.response?.status >= 500) {
    return messages.serverError;
  }

  if (error.request && !error.response) {
    return messages.noResponse;
  }

  if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
    return messages.network;
  }

  return error.message || defaultMessage;
}
